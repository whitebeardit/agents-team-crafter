import * as esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outdir = join(__dirname, "dist");
mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: [join(__dirname, "main.ts")],
  bundle: true,
  platform: "browser",
  target: "es2022",
  format: "cjs",
  outfile: join(outdir, "main.js"),
  external: ["obsidian"],
  sourcemap: "inline",
});

const manifest = readFileSync(join(__dirname, "manifest.json"), "utf8");
writeFileSync(join(outdir, "manifest.json"), manifest);
try {
  copyFileSync(join(__dirname, "styles.css"), join(outdir, "styles.css"));
} catch {
  /* optional */
}
console.log("Built to dist/main.js");
