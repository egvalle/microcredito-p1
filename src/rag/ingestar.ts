import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { leerCorpus } from "./corpus.js";
import { crearEmbeddings, ingerirCorpus } from "./vector.js";

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL) throw new Error("Debes definir DATABASE_URL");
    const rutaDatos = process.env.CV_DATA_DIR ?? process.env.DATOS_CANONICOS_DIR ?? "./datos";
    const documentos = await leerCorpus(resolve(rutaDatos, "corpus"));
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        await pool.query(await readFile(resolve("src/persistencia/schema.sql"), "utf8"));
        const resultado = await ingerirCorpus(pool, documentos, crearEmbeddings());
        console.log(`Corpus: ${resultado.documentos} documentos; ${resultado.fragmentos} fragmentos nuevos`);
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    console.error("No se pudo ingresar el corpus:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
