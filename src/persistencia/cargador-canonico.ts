import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolClient } from "pg";

type EventoCliente = {
    seq: number;
    tipo: "CLIENTE";
    id_cliente: string;
    nombre_completo: string;
    dpi: string;
    telefono: string;
    municipio: string;
    fecha_alta: string;
};

type EventoDesembolso = {
    seq: number;
    tipo: "DESEMBOLSO";
    id_credito: string;
    id_cliente: string;
    id_asesor: string;
    fecha: string;
    capital_centavos: number;
    plazo_meses: number;
    tna_bps: number;
    reestructurado: boolean;
};

type EventoPago = {
    seq: number;
    tipo: "PAGO";
    clave_idempotencia: string;
    id_credito: string;
    fecha: string;
    monto_centavos: number;
    canal: string;
};

type EventoCanonico =
    | EventoCliente
    | EventoDesembolso
    | EventoPago;

type Asesor = {
    id_asesor: string;
    nombre_completo: string;
};

type Politica = {
    nombre: string;
    tipo: "plana" | "escalonada";
    vigencia_otorgamiento?: {
        desde?: string;
        hasta?: string;
    };
    autor: string;
    motivo: string;
    [campo: string]: unknown;
};

type ArchivoPoliticas = {
    politicas_mora: Record<string, Politica>;
    [campo: string]: unknown;
};

export type ResumenCargaCanonica = {
    yaEstabaCargada: boolean;
    sha256: string;
    eventosLeidos: number;
    clientesLeidos: number;
    desembolsosLeidos: number;
    pagosLeidos: number;
    pagosUnicos: number;
    pagosDuplicados: number;
};

const CONTEOS_ESPERADOS = {
    eventos: 363,
    clientes: 60,
    desembolsos: 75,
    pagos: 228,
    asesores: 6
} as const;

function esRegistro(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function texto(
    registro: Record<string, unknown>,
    campo: string
): string {
    const valor = registro[campo];

    if (typeof valor !== "string" || valor.trim() === "") {
        throw new Error(`El campo "${campo}" debe ser texto no vacío`);
    }

    return valor;
}

function entero(
    registro: Record<string, unknown>,
    campo: string,
    minimo = 0
): number {
    const valor = registro[campo];

    if (!Number.isSafeInteger(valor) || (valor as number) < minimo) {
        throw new Error(
            `El campo "${campo}" debe ser un entero seguro mayor o igual a ${minimo}`
        );
    }

    return valor as number;
}

function fecha(
    registro: Record<string, unknown>,
    campo: string
): string {
    const valor = texto(registro, campo);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        throw new Error(`El campo "${campo}" debe usar el formato AAAA-MM-DD`);
    }

    const fechaUtc = new Date(`${valor}T00:00:00.000Z`);

    if (
        Number.isNaN(fechaUtc.getTime()) ||
        fechaUtc.toISOString().slice(0, 10) !== valor
    ) {
        throw new Error(`El campo "${campo}" contiene una fecha inválida`);
    }

    return valor;
}

function analizarEvento(valor: unknown, linea: number): EventoCanonico {
    if (!esRegistro(valor)) {
        throw new Error(`El evento en la línea ${linea} no es un objeto JSON`);
    }

    const seq = entero(valor, "seq", 1);
    const tipo = texto(valor, "tipo");

    if (tipo === "CLIENTE") {
        return {
            seq,
            tipo,
            id_cliente: texto(valor, "id_cliente"),
            nombre_completo: texto(valor, "nombre_completo"),
            dpi: texto(valor, "dpi"),
            telefono: texto(valor, "telefono"),
            municipio: texto(valor, "municipio"),
            fecha_alta: fecha(valor, "fecha_alta")
        };
    }

    if (tipo === "DESEMBOLSO") {
        const plazo = entero(valor, "plazo_meses", 3);
        const reestructurado = valor.reestructurado;

        if (plazo > 24) {
            throw new Error(
                `Plazo fuera del rango permitido en la línea ${linea}`
            );
        }

        if (typeof reestructurado !== "boolean") {
            throw new Error(
                `El campo "reestructurado" debe ser booleano en la línea ${linea}`
            );
        }

        return {
            seq,
            tipo,
            id_credito: texto(valor, "id_credito"),
            id_cliente: texto(valor, "id_cliente"),
            id_asesor: texto(valor, "id_asesor"),
            fecha: fecha(valor, "fecha"),
            capital_centavos: entero(valor, "capital_centavos", 1),
            plazo_meses: plazo,
            tna_bps: entero(valor, "tna_bps"),
            reestructurado
        };
    }

    if (tipo === "PAGO") {
        return {
            seq,
            tipo,
            clave_idempotencia: texto(valor, "clave_idempotencia"),
            id_credito: texto(valor, "id_credito"),
            fecha: fecha(valor, "fecha"),
            monto_centavos: entero(valor, "monto_centavos", 1),
            canal: texto(valor, "canal")
        };
    }

    throw new Error(`Tipo de evento desconocido en la línea ${linea}: ${tipo}`);
}

function analizarEventos(contenido: string): EventoCanonico[] {
    const eventos = contenido
        .split(/\r?\n/)
        .map((linea, indice) => ({ linea: linea.trim(), numero: indice + 1 }))
        .filter(item => item.linea.length > 0)
        .map(item => {
            let json: unknown;

            try {
                json = JSON.parse(item.linea);
            } catch {
                throw new Error(`JSON inválido en la línea ${item.numero}`);
            }

            return analizarEvento(json, item.numero);
        })
        .sort((a, b) => a.seq - b.seq);

    for (let indice = 1; indice < eventos.length; indice += 1) {
        if (eventos[indice - 1]?.seq === eventos[indice]?.seq) {
            throw new Error(
                `La secuencia ${eventos[indice]?.seq} está repetida`
            );
        }
    }

    return eventos;
}

function analizarCsv(contenido: string): Record<string, string>[] {
    const filas: string[][] = [];
    let fila: string[] = [];
    let celda = "";
    let entreComillas = false;
    const textoCsv = contenido.replace(/^\uFEFF/, "");

    for (let indice = 0; indice < textoCsv.length; indice += 1) {
        const caracter = textoCsv[indice];

        if (caracter === undefined) {
            continue;
        }

        if (entreComillas) {
            if (caracter === '"' && textoCsv[indice + 1] === '"') {
                celda += '"';
                indice += 1;
            } else if (caracter === '"') {
                entreComillas = false;
            } else {
                celda += caracter;
            }

            continue;
        }

        if (caracter === '"' && celda.length === 0) {
            entreComillas = true;
        } else if (caracter === ",") {
            fila.push(celda);
            celda = "";
        } else if (caracter === "\n") {
            fila.push(celda);
            filas.push(fila);
            fila = [];
            celda = "";
        } else if (caracter !== "\r") {
            celda += caracter;
        }
    }

    if (entreComillas) {
        throw new Error("El CSV contiene una celda con comillas sin cerrar");
    }

    if (celda.length > 0 || fila.length > 0) {
        fila.push(celda);
        filas.push(fila);
    }

    const filasNoVacias = filas.filter(
        actual => actual.some(valor => valor.trim() !== "")
    );

    const encabezados = filasNoVacias.shift();

    if (!encabezados || encabezados.length === 0) {
        throw new Error("El CSV no contiene encabezados");
    }

    return filasNoVacias.map((valores, indice) => {
        if (valores.length !== encabezados.length) {
            throw new Error(
                `Número de columnas incorrecto en la fila CSV ${indice + 2}`
            );
        }

        return Object.fromEntries(
            encabezados.map((encabezado, columna) => [
                encabezado,
                valores[columna] ?? ""
            ])
        );
    });
}

function analizarAsesores(contenido: string): Asesor[] {
    const filas = analizarCsv(contenido);

    return filas.map((fila, indice) => {
        const id = fila.id_asesor;
        const nombre = fila.nombre_completo;

        if (!id || !nombre) {
            throw new Error(`Datos de asesor incompletos en la fila ${indice + 2}`);
        }

        return {
            id_asesor: id,
            nombre_completo: nombre
        };
    });
}

function analizarPoliticas(contenido: string): ArchivoPoliticas {
    let valor: unknown;

    try {
        valor = JSON.parse(contenido);
    } catch {
        throw new Error("politicas.json no contiene JSON válido");
    }

    if (!esRegistro(valor) || !esRegistro(valor.politicas_mora)) {
        throw new Error("politicas.json no contiene el catálogo de mora esperado");
    }

    const politicas: Record<string, Politica> = {};

    for (const [codigo, configuracion] of Object.entries(valor.politicas_mora)) {
        if (!esRegistro(configuracion)) {
            throw new Error(`Configuración inválida para la política ${codigo}`);
        }

        const tipo = configuracion.tipo;

        if (tipo !== "plana" && tipo !== "escalonada") {
            throw new Error(`Tipo inválido para la política ${codigo}`);
        }

        politicas[codigo] = {
            ...configuracion,
            nombre: texto(configuracion, "nombre"),
            tipo,
            autor: texto(configuracion, "autor"),
            motivo: texto(configuracion, "motivo")
        };
    }

    return {
        ...valor,
        politicas_mora: politicas
    } as ArchivoPoliticas;
}

async function insertarPoliticas(
    cliente: PoolClient,
    politicas: ArchivoPoliticas
): Promise<void> {
    for (const [codigo, politica] of Object.entries(politicas.politicas_mora)) {
        const vigencia = politica.vigencia_otorgamiento;

        await cliente.query(
            `INSERT INTO politicas_mora
                (codigo, nombre, tipo, vigencia_desde, vigencia_hasta,
                 parametros, autor, motivo)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
            [
                codigo,
                politica.nombre,
                politica.tipo,
                vigencia?.desde ?? null,
                vigencia?.hasta ?? null,
                JSON.stringify(politica),
                politica.autor,
                politica.motivo
            ]
        );
    }

    await cliente.query(
        `INSERT INTO configuracion_sistema (clave, valor)
         VALUES ($1, $2::jsonb)`,
        ["politicas_canonicas", JSON.stringify(politicas)]
    );
}

export async function cargarDatosCanonicos(
    pool: Pool,
    directorioDatos: string
): Promise<ResumenCargaCanonica> {
    const [eventosBuffer, huellaContenido, asesoresContenido, politicasContenido] =
        await Promise.all([
            readFile(join(directorioDatos, "eventos.jsonl")),
            readFile(join(directorioDatos, "eventos.sha256"), "utf8"),
            readFile(join(directorioDatos, "asesores.csv"), "utf8"),
            readFile(join(directorioDatos, "politicas.json"), "utf8")
        ]);

    const sha256 = createHash("sha256")
        .update(eventosBuffer)
        .digest("hex");

    const huellaEsperada = huellaContenido.trim().split(/\s+/)[0];

    if (!huellaEsperada || !/^[a-fA-F0-9]{64}$/.test(huellaEsperada)) {
        throw new Error("eventos.sha256 no contiene una huella SHA-256 válida");
    }

    if (sha256.toLowerCase() !== huellaEsperada.toLowerCase()) {
        throw new Error(
            `La huella de eventos.jsonl no coincide. Esperada: ${huellaEsperada}; calculada: ${sha256}`
        );
    }

    const eventos = analizarEventos(eventosBuffer.toString("utf8"));
    const asesores = analizarAsesores(asesoresContenido);
    const politicas = analizarPoliticas(politicasContenido);

    const clientes = eventos.filter(
        (evento): evento is EventoCliente => evento.tipo === "CLIENTE"
    );
    const desembolsos = eventos.filter(
        (evento): evento is EventoDesembolso => evento.tipo === "DESEMBOLSO"
    );
    const pagos = eventos.filter(
        (evento): evento is EventoPago => evento.tipo === "PAGO"
    );

    const clavesPago = new Set(pagos.map(pago => pago.clave_idempotencia));
    const pagosUnicos = clavesPago.size;
    const pagosDuplicados = pagos.length - pagosUnicos;

    if (
        eventos.length !== CONTEOS_ESPERADOS.eventos ||
        clientes.length !== CONTEOS_ESPERADOS.clientes ||
        desembolsos.length !== CONTEOS_ESPERADOS.desembolsos ||
        pagos.length !== CONTEOS_ESPERADOS.pagos ||
        asesores.length !== CONTEOS_ESPERADOS.asesores
    ) {
        throw new Error(
            `Conteos canónicos incorrectos: eventos=${eventos.length}, ` +
            `clientes=${clientes.length}, desembolsos=${desembolsos.length}, ` +
            `pagos=${pagos.length}, asesores=${asesores.length}`
        );
    }

    const clienteDb = await pool.connect();

    try {
        await clienteDb.query("BEGIN");

        const cargaExistente = await clienteDb.query<{
            id: string;
            estado: string;
            eventos_leidos: number;
            clientes_leidos: number;
            desembolsos_leidos: number;
            pagos_leidos: number;
            pagos_unicos: number;
            pagos_duplicados: number;
        }>(
            `SELECT id, estado, eventos_leidos, clientes_leidos,
                    desembolsos_leidos, pagos_leidos, pagos_unicos,
                    pagos_duplicados
             FROM cargas_canonicas
             WHERE sha256_eventos = $1
             FOR UPDATE`,
            [sha256]
        );

        const existente = cargaExistente.rows[0];

        if (existente) {
            if (existente.estado !== "COMPLETADA") {
                throw new Error(
                    "Existe una carga previa con estado incompleto; requiere revisión"
                );
            }

            await clienteDb.query("COMMIT");

            return {
                yaEstabaCargada: true,
                sha256,
                eventosLeidos: existente.eventos_leidos,
                clientesLeidos: existente.clientes_leidos,
                desembolsosLeidos: existente.desembolsos_leidos,
                pagosLeidos: existente.pagos_leidos,
                pagosUnicos: existente.pagos_unicos,
                pagosDuplicados: existente.pagos_duplicados
            };
        }

        const cargaResult = await clienteDb.query<{ id: string }>(
            `INSERT INTO cargas_canonicas
                (sha256_eventos, nombre_archivo, estado)
             VALUES ($1, $2, 'EN_PROCESO')
             RETURNING id`,
            [sha256, "eventos.jsonl"]
        );

        const cargaId = cargaResult.rows[0]?.id;

        if (!cargaId) {
            throw new Error("No se pudo crear el registro de carga canónica");
        }

        for (const asesor of asesores) {
            await clienteDb.query(
                `INSERT INTO asesores (id_asesor, nombre_completo)
                 VALUES ($1, $2)`,
                [asesor.id_asesor, asesor.nombre_completo]
            );
        }

        for (const evento of eventos) {
            const eventoResult = await clienteDb.query<{ id: string }>(
                `INSERT INTO eventos_canonicos
                    (carga_id, secuencia_fuente, tipo, payload)
                 VALUES ($1, $2, $3, $4::jsonb)
                 RETURNING id`,
                [
                    cargaId,
                    evento.seq,
                    evento.tipo,
                    JSON.stringify(evento)
                ]
            );

            const eventoId = eventoResult.rows[0]?.id;

            if (!eventoId) {
                throw new Error(
                    `No se pudo registrar el evento ${evento.seq}`
                );
            }

            if (evento.tipo === "CLIENTE") {
                await clienteDb.query(
                    `INSERT INTO clientes
                        (id_cliente, nombre_completo, dpi, telefono,
                         municipio, fecha_alta, evento_origen_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        evento.id_cliente,
                        evento.nombre_completo,
                        evento.dpi,
                        evento.telefono,
                        evento.municipio,
                        evento.fecha_alta,
                        eventoId
                    ]
                );
            } else if (evento.tipo === "DESEMBOLSO") {
                await clienteDb.query(
                    `INSERT INTO creditos
                        (id_credito, id_cliente, id_asesor,
                         fecha_otorgamiento, capital_centavos,
                         plazo_meses, tna_bps, reestructurado,
                         evento_origen_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        evento.id_credito,
                        evento.id_cliente,
                        evento.id_asesor,
                        evento.fecha,
                        evento.capital_centavos,
                        evento.plazo_meses,
                        evento.tna_bps,
                        evento.reestructurado,
                        eventoId
                    ]
                );
            } else {
                const pagoInsertado = await clienteDb.query<{ id: string }>(
                    `INSERT INTO pagos
                        (clave_idempotencia, id_credito, fecha,
                         monto_centavos, canal, evento_origen_id)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (clave_idempotencia) DO NOTHING
                     RETURNING id`,
                    [
                        evento.clave_idempotencia,
                        evento.id_credito,
                        evento.fecha,
                        evento.monto_centavos,
                        evento.canal,
                        eventoId
                    ]
                );

                if (pagoInsertado.rows.length === 0) {
                    const pagoPrevio = await clienteDb.query<{
                        id_credito: string;
                        fecha: string;
                        monto_centavos: string;
                        canal: string;
                    }>(
                        `SELECT id_credito, fecha::text, monto_centavos::text, canal
                         FROM pagos
                         WHERE clave_idempotencia = $1`,
                        [evento.clave_idempotencia]
                    );

                    const previo = pagoPrevio.rows[0];

                    if (
                        !previo ||
                        previo.id_credito !== evento.id_credito ||
                        previo.fecha !== evento.fecha ||
                        Number(previo.monto_centavos) !== evento.monto_centavos ||
                        previo.canal !== evento.canal
                    ) {
                        throw new Error(
                            `La clave de idempotencia ${evento.clave_idempotencia} ` +
                            "se repite con datos diferentes"
                        );
                    }
                }
            }
        }

        await insertarPoliticas(clienteDb, politicas);

        const resumen: ResumenCargaCanonica = {
            yaEstabaCargada: false,
            sha256,
            eventosLeidos: eventos.length,
            clientesLeidos: clientes.length,
            desembolsosLeidos: desembolsos.length,
            pagosLeidos: pagos.length,
            pagosUnicos,
            pagosDuplicados
        };

        await clienteDb.query(
            `UPDATE cargas_canonicas
             SET estado = 'COMPLETADA',
                 eventos_leidos = $2,
                 clientes_leidos = $3,
                 desembolsos_leidos = $4,
                 pagos_leidos = $5,
                 pagos_unicos = $6,
                 pagos_duplicados = $7,
                 completada_en = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [
                cargaId,
                resumen.eventosLeidos,
                resumen.clientesLeidos,
                resumen.desembolsosLeidos,
                resumen.pagosLeidos,
                resumen.pagosUnicos,
                resumen.pagosDuplicados
            ]
        );

        await clienteDb.query("COMMIT");
        return resumen;
    } catch (error) {
        await clienteDb.query("ROLLBACK");
        throw error;
    } finally {
        clienteDb.release();
    }
}