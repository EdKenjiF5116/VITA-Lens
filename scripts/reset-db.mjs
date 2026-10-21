// Apaga o banco embutido (PGlite). Na próxima execução, o VITA Lens recria as tabelas e os dados de demonstração.
import fs from "node:fs";
import path from "node:path";

const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
fs.rmSync(dir, { recursive: true, force: true });
console.log(`Banco removido: ${dir}. Rode "npm run dev" para recriar com os dados de demonstração.`);
