import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  isPathInsideDir,
  sanitizePathSegment,
  subjectSlugFromPrompt,
  teamFolderSegment,
} from '../domain/team-gallery-path.js';

const MAX_SUBJECT_LEN = 48;

export interface ITeamGalleryAlbum {
  subjectSlug: string;
  fileCount: number;
}

export interface ITeamGalleryFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

function defaultGalleryRoot(): string {
  const env = process.env.MEDIA_GALLERY_ROOT?.trim();
  if (env) return path.isAbsolute(env) ? env : path.resolve(process.cwd(), env);
  return path.resolve(process.cwd(), 'data/gallery');
}

export class TeamGalleryService {
  constructor(private readonly rootDir: string = defaultGalleryRoot()) {}

  /** Raiz absoluta (para testes). */
  getRootDir(): string {
    return this.rootDir;
  }

  private teamBaseAbs(workspaceId: string, teamId: string, teamName: string): string {
    const teamSeg = teamFolderSegment(teamName, teamId);
    return path.resolve(this.rootDir, workspaceId, teamSeg);
  }

  private imagensDirAbs(workspaceId: string, teamId: string, teamName: string, subjectSlug: string): string {
    const base = this.teamBaseAbs(workspaceId, teamId, teamName);
    const safeSubject = sanitizePathSegment(subjectSlug, MAX_SUBJECT_LEN);
    return path.resolve(base, safeSubject, 'imagens');
  }

  /**
   * Descarrega bytes da URL da OpenAI e grava em disco.
   */
  async persistFromUrl(params: {
    workspaceId: string;
    teamId: string;
    teamName: string;
    prompt: string;
    imageUrl: string;
    subjectSlug?: string;
  }): Promise<{ subjectSlug: string; filename: string; bytesWritten: number } | null> {
    const subjectSlug = sanitizePathSegment(params.subjectSlug || subjectSlugFromPrompt(params.prompt), MAX_SUBJECT_LEN);
    const dir = this.imagensDirAbs(
      params.workspaceId,
      params.teamId,
      params.teamName,
      subjectSlug,
    );
    await mkdir(dir, { recursive: true });

    const res = await fetch(params.imageUrl, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    const ext =
      ct.includes('png') ? 'png' : ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : ct.includes('webp') ? 'webp' : 'png';
    const filename = `${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
    const dest = path.join(dir, filename);
    const resolvedDest = path.resolve(dest);
    if (!isPathInsideDir(this.teamBaseAbs(params.workspaceId, params.teamId, params.teamName), resolvedDest)) {
      return null;
    }
    await writeFile(resolvedDest, buf);
    return { subjectSlug, filename, bytesWritten: buf.length };
  }

  /**
   * Grava bytes já recebidos de provedores que devolvem data URLs/base64.
   */
  async persistBuffer(params: {
    workspaceId: string;
    teamId: string;
    teamName: string;
    prompt: string;
    bytes: Buffer;
    contentType?: string;
    subjectSlug?: string;
  }): Promise<{ subjectSlug: string; filename: string; bytesWritten: number } | null> {
    const subjectSlug = sanitizePathSegment(params.subjectSlug || subjectSlugFromPrompt(params.prompt), MAX_SUBJECT_LEN);
    const dir = this.imagensDirAbs(
      params.workspaceId,
      params.teamId,
      params.teamName,
      subjectSlug,
    );
    await mkdir(dir, { recursive: true });
    const ct = (params.contentType ?? '').toLowerCase();
    const ext =
      ct.includes('png') ? 'png' : ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : ct.includes('webp') ? 'webp' : 'png';
    const filename = `${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
    const dest = path.join(dir, filename);
    const resolvedDest = path.resolve(dest);
    if (!isPathInsideDir(this.teamBaseAbs(params.workspaceId, params.teamId, params.teamName), resolvedDest)) {
      return null;
    }
    await writeFile(resolvedDest, params.bytes);
    return { subjectSlug, filename, bytesWritten: params.bytes.length };
  }

  async listAlbums(workspaceId: string, teamId: string, teamName: string): Promise<ITeamGalleryAlbum[]> {
    const base = this.teamBaseAbs(workspaceId, teamId, teamName);
    let entries: string[];
    try {
      entries = await readdir(base);
    } catch {
      return [];
    }
    const out: ITeamGalleryAlbum[] = [];
    for (const name of entries) {
      if (name === '.' || name === '..') continue;
      const imagens = path.join(base, name, 'imagens');
      try {
        const files = await readdir(imagens);
        out.push({ subjectSlug: name, fileCount: files.filter((f) => !f.startsWith('.')).length });
      } catch {
        out.push({ subjectSlug: name, fileCount: 0 });
      }
    }
    return out.sort((a, b) => a.subjectSlug.localeCompare(b.subjectSlug));
  }

  async listFiles(
    workspaceId: string,
    teamId: string,
    teamName: string,
    subjectSlug: string,
  ): Promise<ITeamGalleryFile[]> {
    const imagens = this.imagensDirAbs(workspaceId, teamId, teamName, subjectSlug);
    const resolvedBase = path.resolve(imagens);
    if (!isPathInsideDir(this.teamBaseAbs(workspaceId, teamId, teamName), resolvedBase)) {
      return [];
    }
    let names: string[];
    try {
      names = await readdir(resolvedBase);
    } catch {
      return [];
    }
    const out: ITeamGalleryFile[] = [];
    for (const filename of names) {
      if (filename.startsWith('.')) continue;
      const fp = path.join(resolvedBase, filename);
      try {
        const st = await stat(fp);
        if (!st.isFile()) continue;
        out.push({
          filename,
          sizeBytes: st.size,
          createdAt: st.birthtime.toISOString(),
        });
      } catch {
        continue;
      }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  resolveFilePath(
    workspaceId: string,
    teamId: string,
    teamName: string,
    subjectSlug: string,
    filename: string,
  ): string | null {
    const base = this.teamBaseAbs(workspaceId, teamId, teamName);
    const safeSubject = sanitizePathSegment(subjectSlug, MAX_SUBJECT_LEN);
    const imagens = path.join(base, safeSubject, 'imagens', filename);
    const resolved = path.resolve(imagens);
    if (!isPathInsideDir(base, resolved)) return null;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return null;
    return resolved;
  }

  async readFileBuffer(
    workspaceId: string,
    teamId: string,
    teamName: string,
    subjectSlug: string,
    filename: string,
  ): Promise<Buffer | null> {
    const fp = this.resolveFilePath(workspaceId, teamId, teamName, subjectSlug, filename);
    if (!fp) return null;
    try {
      return await readFile(fp);
    } catch {
      return null;
    }
  }

  async deleteFile(
    workspaceId: string,
    teamId: string,
    teamName: string,
    subjectSlug: string,
    filename: string,
  ): Promise<boolean> {
    const fp = this.resolveFilePath(workspaceId, teamId, teamName, subjectSlug, filename);
    if (!fp) return false;
    try {
      await rm(fp, { force: true });
      return true;
    } catch {
      return false;
    }
  }

  guessContentType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'application/octet-stream';
  }
}

let singleton: TeamGalleryService | undefined;

export function getTeamGalleryService(): TeamGalleryService {
  if (!singleton) singleton = new TeamGalleryService();
  return singleton;
}

/** Testes: reset singleton */
export function resetTeamGalleryServiceForTests(): void {
  singleton = undefined;
}
