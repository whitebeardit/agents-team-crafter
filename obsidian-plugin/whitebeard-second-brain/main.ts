import { App, Editor, MarkdownView, Notice, Platform, Plugin, PluginSettingTab, Setting } from "obsidian";
import { joinWebUiBaseUrl } from "./src/url.js";
import { buildWebPathFromVaultFile } from "./src/path-heuristic.js";

interface WhitebeardSecondBrainSettings {
  webUiBaseUrl: string;
}

const DEFAULT_SETTINGS: WhitebeardSecondBrainSettings = {
  webUiBaseUrl: "https://localhost:3000",
};

function readFrontmatterId(fileContent: string): string | null {
  if (!fileContent.startsWith("---\n")) return null;
  const end = fileContent.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const block = fileContent.slice(4, end);
  const m = block.match(/"id"\s*:\s*"([^"]+)"/) ?? block.match(/"id"\s*:\s*'([^']+)'/);
  return m?.[1]?.trim() ?? null;
}

export default class WhitebeardSecondBrainPlugin extends Plugin {
  settings: WhitebeardSecondBrainSettings = DEFAULT_SETTINGS;
  private statusBarItem?: HTMLElement;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new WhitebeardSecondBrainSettingTab(this.app, this));
    this.addCommand({
      id: "open-in-webui",
      name: "Whitebeard: open in WebUI",
      editorCallback: (_editor: Editor, view: MarkdownView) => {
        void this.openInWebUi(view);
      },
    });
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar();
    this.app.workspace.on("file-open", () => this.updateStatusBar());
  }

  private updateStatusBar() {
    if (!this.statusBarItem) return;
    if (!Platform.isDesktop) {
      this.statusBarItem.setText("");
      return;
    }
    try {
      // Obsidian desktop (Electron) expoe `require`.
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const { execFileSync } = require("child_process") as typeof import("node:child_process");
      const basePath = (this.app.vault.adapter as { basePath?: string }).basePath;
      if (!basePath) {
        this.statusBarItem.setText("git —");
        return;
      }
      const head = execFileSync("git", ["-C", basePath, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
      this.statusBarItem.setText(`git ${head.slice(0, 7)}`);
    } catch {
      this.statusBarItem.setText("git —");
    }
  }

  private async openInWebUi(view: MarkdownView) {
    const file = view.file;
    if (!file) {
      new Notice("Nenhum ficheiro aberto");
      return;
    }
    const text = await this.app.vault.read(file);
    const id = readFrontmatterId(text);
    if (!id) {
      new Notice('O frontmatter precisa do campo "id" (UUID da nota).');
      return;
    }
    const base = this.settings.webUiBaseUrl.trim();
    if (!base) {
      new Notice("Configure o Web UI base URL nas definicoes do plugin.");
      return;
    }
    const webPath = buildWebPathFromVaultFile(file.path, id);
    if (!webPath) {
      new Notice("Caminho nao suportado (esperado parties/... ou agents/.../learnings/...).");
      return;
    }
    const url = joinWebUiBaseUrl(base, webPath);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class WhitebeardSecondBrainSettingTab extends PluginSettingTab {
  plugin: WhitebeardSecondBrainPlugin;

  constructor(app: App, plugin: WhitebeardSecondBrainPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Whitebeard second-brain" });
    new Setting(containerEl)
      .setName("Web UI base URL")
      .setDesc("Origem da aplicacao web Next.js (sem /api/v1). Ex.: https://app.seudominio.com")
      .addText((text) =>
        text.setPlaceholder("https://…").setValue(this.plugin.settings.webUiBaseUrl).onChange(async (v) => {
          this.plugin.settings.webUiBaseUrl = v;
          await this.plugin.saveSettings();
        }),
      );
  }
}
