/**
 * Monta customToolDefinitionIds no export de time SO Clínica a partir de:
 * 1) ObjectIds do export de referência (Mongo → actionId via config ou slug)
 * 2) Para actionIds do template ainda sem definição no workspace, chama
 *    ensureInternalActionDefinitions (mesmo workspaceId inferido dos docs).
 *
 * Uso:
 *   cd backend && npx tsx scripts/refactor-so-clinica-team-custom-tool-ids.ts
 *   npx tsx scripts/refactor-so-clinica-team-custom-tool-ids.ts --input ... --output ...
 *
 * Com mapa pré-computado (sem Mongo):
 *   npx tsx scripts/refactor-so-clinica-team-custom-tool-ids.ts --map-json ./map.json --workspace-id <id>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose, { Types } from 'mongoose';
import { loadDotenv } from '../src/config/load-dotenv.js';
import { WorkspaceToolDefinitionModel } from '../src/modules/tool-definitions/infra/workspace-tool-definition.model.js';
import { WorkspaceToolDefinitionRepository } from '../src/modules/tool-definitions/infra/workspace-tool-definition.repository.js';
import { ensureInternalActionDefinitions } from '../src/modules/team-planning/application/ensure-planner-tool-definitions.js';

loadDotenv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toolSlugToActionId(slug: string): string {
  const s = slug.trim().toLowerCase();
  if (s.startsWith('ba-')) {
    return s.slice(3).replace(/-/g, '_');
  }
  return s.replace(/-/g, '_');
}

function parseArgs(argv: string[]) {
  const out: {
    mapJson?: string;
    workspaceId?: string;
    referenceExport: string;
    inputTeam: string;
    outputTeam: string;
  } = {
    referenceExport: path.resolve(__dirname, '../../docs/teams/team-69f12ca817a149ecb4712b73-export.json'),
    inputTeam: path.resolve(process.env.HOME ?? '~', 'Downloads/so_clinica_conversacional_team.json'),
    outputTeam: path.resolve(process.env.HOME ?? '~', 'Downloads/so_clinica_conversacional_team.json'),
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--map-json' && argv[i + 1]) {
      out.mapJson = path.resolve(argv[++i]);
    } else if (a === '--workspace-id' && argv[i + 1]) {
      out.workspaceId = argv[++i];
    } else if (a === '--reference-export' && argv[i + 1]) {
      out.referenceExport = path.resolve(argv[++i]);
    } else if (a === '--input' && argv[i + 1]) {
      out.inputTeam = path.resolve(argv[++i]);
    } else if (a === '--output' && argv[i + 1]) {
      out.outputTeam = path.resolve(argv[++i]);
    }
  }
  return out;
}

function extractReferenceIds(refExportPath: string): string[] {
  const raw = fs.readFileSync(refExportPath, 'utf8');
  const data = JSON.parse(raw) as {
    agents?: Array<{ agent?: { capabilities?: { customToolDefinitionIds?: string[] } } }>;
  };
  const agents = data.agents ?? [];
  for (const wrap of agents) {
    const ids = wrap.agent?.capabilities?.customToolDefinitionIds;
    if (ids && ids.length > 0) return [...ids];
  }
  throw new Error(`Nenhuma lista customToolDefinitionIds não vazia em ${refExportPath}`);
}

function buildMapFromDocs(
  docs: Array<{
    _id: Types.ObjectId;
    slug?: string;
    config?: Record<string, unknown>;
  }>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const d of docs) {
    const cfg = (d.config ?? {}) as Record<string, unknown>;
    const fromCfg = typeof cfg.actionId === 'string' ? cfg.actionId.trim() : '';
    const actionId = fromCfg || toolSlugToActionId(String(d.slug ?? ''));
    if (!actionId) continue;
    map[actionId] = d._id.toString();
  }
  return map;
}

type TeamExport = {
  exportVersion?: string;
  exportedAt?: string;
  team?: Record<string, unknown>;
  agents?: AgentEnvelope[];
  [k: string]: unknown;
};

type AgentEnvelope = {
  agent: {
    capabilities: {
      tools: string[];
      customToolDefinitionIds: string[];
    };
    [k: string]: unknown;
  };
  sections?: {
    runtime?: {
      capabilities?: {
        tools?: string[];
        customToolDefinitionIds?: string[];
      };
    };
  };
};

function collectRequiredActionIds(team: TeamExport): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const wrap of team.agents ?? []) {
    const tools = wrap.agent?.capabilities?.tools ?? [];
    for (const t of tools) {
      const id = String(t).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function applyMap(team: TeamExport, map: Record<string, string>): void {
  for (const wrap of team.agents ?? []) {
    const tools = wrap.agent.capabilities.tools ?? [];
    const resolved: string[] = [];
    for (const t of tools) {
      const id = map[t];
      if (!id) {
        throw new Error(
          `Sem tool definition para actionId "${t}". Garanta presets + ensureInternalActionDefinitions.`,
        );
      }
      resolved.push(id);
    }
    wrap.agent.capabilities.customToolDefinitionIds = resolved;
    if (wrap.sections?.runtime?.capabilities) {
      wrap.sections.runtime.capabilities.customToolDefinitionIds = [...resolved];
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const rawTeam = fs.readFileSync(args.inputTeam, 'utf8');
  const team = JSON.parse(rawTeam) as TeamExport;
  const required = collectRequiredActionIds(team);

  let map: Record<string, string> = {};
  let workspaceId: string | undefined = args.workspaceId;

  if (args.mapJson) {
    map = JSON.parse(fs.readFileSync(args.mapJson, 'utf8')) as Record<string, string>;
  } else {
    const refIds = extractReferenceIds(args.referenceExport);
    const oids = refIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/teamagents';
    await mongoose.connect(uri);
    try {
      const docs = await WorkspaceToolDefinitionModel.find({
        _id: { $in: oids },
      })
        .lean()
        .exec();
      if (docs.length === 0) {
        throw new Error(
          `Nenhum documento WorkspaceToolDefinition encontrado para os ${oids.length} ids de referência. Verifique MONGODB_URI e base de dados.`,
        );
      }
      map = buildMapFromDocs(docs);
      workspaceId = String(docs[0].workspaceId);
      console.error(
        `[refactor-so-clinica] Mapa inicial: ${Object.keys(map).length} actionIds a partir de ${docs.length} docs (workspace ${workspaceId}).`,
      );
    } finally {
      await mongoose.disconnect();
    }
  }

  const missing = required.filter((a) => !map[a]);
  if (missing.length > 0) {
    if (!workspaceId) {
      throw new Error(
        `Faltam ${missing.length} actionIds no mapa. Passe --workspace-id ou use Mongo com export de referência. Ex.: ${missing.slice(0, 5).join(', ')}...`,
      );
    }
    console.error(
      `[refactor-so-clinica] A criar/associar definições em falta (${missing.length}): ${missing.join(', ')}`,
    );
    await mongoose.connect(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/teamagents');
    try {
      const repo = new WorkspaceToolDefinitionRepository();
      const ensuredIds = await ensureInternalActionDefinitions(workspaceId, missing, repo);
      if (ensuredIds.length !== missing.length) {
        throw new Error('ensureInternalActionDefinitions devolveu contagem inesperada');
      }
      for (let i = 0; i < missing.length; i++) {
        map[missing[i]] = ensuredIds[i]!;
      }
    } finally {
      await mongoose.disconnect();
    }
  }

  team.exportedAt = new Date().toISOString();
  if (team.team && team.team.singleAgentMode === undefined) {
    team.team.singleAgentMode = false;
  }

  applyMap(team, map);

  fs.writeFileSync(args.outputTeam, JSON.stringify(team, null, 2) + '\n', 'utf8');
  const usedIds = new Set<string>();
  for (const wrap of team.agents ?? []) {
    for (const id of wrap.agent.capabilities.customToolDefinitionIds) usedIds.add(id);
  }
  console.error(
    `[refactor-so-clinica] Escrito ${args.outputTeam} — ${team.agents?.length ?? 0} agentes, ${usedIds.size} tool definition ids distintos usados, ${required.length} actionIds no template.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
