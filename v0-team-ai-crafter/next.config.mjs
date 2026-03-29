import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Raiz fixa do app: sem isso, múltiplos lockfiles acima fazem o Turbopack resolver
  // módulos (ex.: tailwindcss) a partir de pastas erradas e recompilar em loop.
  turbopack: {
    root: __dirname,
  },
  // HMR / dev quando acessado pelo IP da rede local.
  allowedDevOrigins: ["10.0.0.148", "127.0.0.1", "localhost"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
