import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (Postgres embutido em WASM) precisa rodar fora do bundle do servidor.
  serverExternalPackages: ["@electric-sql/pglite", "exceljs"],
  // Não gerar AGENTS.md automaticamente no repositório.
  agentRules: false,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
