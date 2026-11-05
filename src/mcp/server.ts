import "dotenv/config";
import { Pool } from "pg";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { crearServidorMcp } from "./herramientas.js";

if (!process.env.DATABASE_URL) throw new Error("Debes definir DATABASE_URL");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const servidor = crearServidorMcp(pool);
await servidor.connect(new StdioServerTransport());
process.on("SIGTERM", async () => { await pool.end(); process.exit(0); });