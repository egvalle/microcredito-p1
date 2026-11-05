import type { Pool } from "pg";
import { OllamaEmbeddings } from "@langchain/ollama";
import type { DocumentoCorpus } from "./corpus.js";
import { validarFechaCorte } from "../persistencia/consultar-estado.js";

export interface GeneradorEmbeddings {
    embedDocuments(textos: string[]): Promise<number[][]>;
    embedQuery(texto: string): Promise<number[]>;
}

export interface FuenteRag {
    doc_id: string;
    titulo: string;
    vigencia: string;
    fragmento: number;
    contenido: string;
    distancia: number;
}

export function crearEmbeddings(): GeneradorEmbeddings {
    return new OllamaEmbeddings({
        model: "bge-m3",
        baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
        fetch: (input, init) => fetch(input, {
            ...init,
            signal: AbortSignal.timeout(180_000)
        })
    });
}

function vectorSql(vector: number[]): string {
    if (vector.length !== 1024 || vector.some(numero => !Number.isFinite(numero))) {
        throw new Error("El modelo bge-m3 debe devolver 1024 valores numéricos por vector");
    }
    return `[${vector.join(",")}]`;
}

export async function ingerirCorpus(
    pool: Pool,
    documentos: DocumentoCorpus[],
    embeddings: GeneradorEmbeddings
): Promise<{ documentos: number; fragmentos: number }> {
    let fragmentos = 0;
    for (const documento of documentos) {
        const anterior = await pool.query<{ sha256: string }>(
            "SELECT sha256 FROM documentos_rag WHERE doc_id = $1", [documento.id]
        );
        if (anterior.rows[0]?.sha256 === documento.sha256) continue;

        const vectores = await embeddings.embedDocuments(documento.fragmentos);
        if (vectores.length !== documento.fragmentos.length) {
            throw new Error(`Embeddings incompletos para ${documento.id}`);
        }
        const valores = vectores.map(vectorSql);
        const cliente = await pool.connect();
        try {
            await cliente.query("BEGIN");
            await cliente.query(
                `INSERT INTO documentos_rag (doc_id, titulo, vigencia, sha256)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (doc_id) DO UPDATE SET
                    titulo = EXCLUDED.titulo, vigencia = EXCLUDED.vigencia,
                    sha256 = EXCLUDED.sha256, actualizado_en = CURRENT_TIMESTAMP`,
                [documento.id, documento.titulo, documento.vigencia, documento.sha256]
            );
            await cliente.query("DELETE FROM fragmentos_rag WHERE doc_id = $1", [documento.id]);
            for (let indice = 0; indice < valores.length; indice++) {
                await cliente.query(
                    `INSERT INTO fragmentos_rag (doc_id, numero, contenido, embedding)
                     VALUES ($1, $2, $3, $4::vector)`,
                    [documento.id, indice, documento.fragmentos[indice], valores[indice]]
                );
            }
            await cliente.query("COMMIT");
            fragmentos += valores.length;
        } catch (error) {
            await cliente.query("ROLLBACK");
            throw error;
        } finally {
            cliente.release();
        }
    }
    return { documentos: documentos.length, fragmentos };
}

export async function buscarFuentes(
    pool: Pool,
    pregunta: string,
    embeddings: GeneradorEmbeddings,
    limite = 4,
    docId?: string
): Promise<FuenteRag[]> {
    if (!pregunta.trim()) throw new Error("La pregunta no puede estar vacía");
    if (!Number.isInteger(limite) || limite < 1 || limite > 10) {
        throw new Error("El límite debe estar entre 1 y 10");
    }
    const vector = vectorSql(await embeddings.embedQuery(pregunta));
    const resultado = await pool.query<FuenteRag>(
        `SELECT f.doc_id, d.titulo, d.vigencia, f.numero AS fragmento,
                f.contenido, (f.embedding <=> $1::vector) AS distancia
         FROM fragmentos_rag f
         JOIN documentos_rag d ON d.doc_id = f.doc_id
         WHERE ($3::text IS NULL OR d.doc_id = $3)
         ORDER BY f.embedding <=> $1::vector
         LIMIT $2`,
        [vector, limite, docId ?? null]
    );
    return resultado.rows.map(fuente => ({
        ...fuente,
        distancia: Number(fuente.distancia),
        contenido: fuente.contenido.replace(/\[INSTRUCCI[ÓO]N PARA EL ASISTENTE DE IA:[\s\S]*?\]/gi, "").trim()
    })).filter(fuente => fuente.contenido.length > 0);
}

export async function buscarPoliticaVigente(
    pool: Pool,
    pregunta: string,
    fechaOtorgamiento: string,
    embeddings: GeneradorEmbeddings
): Promise<FuenteRag[]> {
    validarFechaCorte(fechaOtorgamiento);
    const politica = await pool.query<{ codigo: string }>(
        `SELECT codigo FROM politicas_mora
         WHERE (vigencia_desde IS NULL OR vigencia_desde <= $1)
           AND (vigencia_hasta IS NULL OR vigencia_hasta >= $1)
         ORDER BY vigencia_desde DESC NULLS LAST LIMIT 1`,
        [fechaOtorgamiento]
    );
    const codigo = politica.rows[0]?.codigo;
    if (!codigo) throw new Error("No existe una política para esa fecha de otorgamiento");
    return buscarFuentes(pool, pregunta, embeddings, 4, codigo);
}
