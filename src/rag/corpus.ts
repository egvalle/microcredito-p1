import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export interface DocumentoCorpus {
    id: string;
    titulo: string;
    vigencia: string;
    sha256: string;
    fragmentos: string[];
}

const separador = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

export async function leerCorpus(directorio: string): Promise<DocumentoCorpus[]> {
    const archivos = (await readdir(directorio)).filter(nombre => nombre.endsWith(".md")).sort();
    if (archivos.length !== 7) {
        throw new Error(`Se esperaban 7 documentos del corpus; se encontraron ${archivos.length}`);
    }

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 700,
        chunkOverlap: 100,
        separators: ["\n## ", "\n\n", "\n", " ", ""]
    });

    return Promise.all(archivos.map(async nombre => {
        const original = await readFile(join(directorio, nombre), "utf8");
        const encabezado = original.match(separador);
        if (!encabezado) throw new Error(`Falta el encabezado del corpus: ${nombre}`);

        const campos = new Map((encabezado[1] ?? "").split(/\r?\n/)
            .map(linea => linea.match(/^([a-z_]+):\s*(.+)$/))
            .filter((valor): valor is RegExpMatchArray => valor !== null)
            .map(valor => [valor[1] ?? "", valor[2] ?? ""]));
        const id = campos.get("doc_id");
        const titulo = campos.get("titulo");
        const vigencia = campos.get("vigencia");
        if (!id || !titulo || !vigencia || `${id}.md` !== nombre) {
            throw new Error(`Metadatos inválidos del corpus: ${nombre}`);
        }

        const contenido = original.slice(encabezado[0].length)
            .replace(/\[INSTRUCCI[ÓO]N PARA EL ASISTENTE DE IA:[\s\S]*?\]/gi, "")
            .trim();
        const documentos = await splitter.createDocuments([contenido]);
        return {
            id,
            titulo,
            vigencia,
            sha256: createHash("sha256").update(original).digest("hex"),
            fragmentos: documentos.map(documento => documento.pageContent)
        };
    }));
}
