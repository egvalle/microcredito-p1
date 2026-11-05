import "dotenv/config";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import express from "express";
import { Pool } from "pg";
import { Decimal } from "decimal.js";
import { Dinero } from "../dominio/dinero.js";
import { AmortizacionFrancesa } from "../dominio/plan-amortizacion.js";
import { generarFechasVencimiento } from "../dominio/calendario-cuotas.js";
import { consultarEstadoCredito, validarFechaCorte } from "../persistencia/consultar-estado.js";
import { guardarAplicaciones } from "../persistencia/guardar-aplicaciones.js";
import { consultarCartera } from "../persistencia/consultar-cartera.js";
import { calcularCierre, type TipoCierre } from "../persistencia/consultar-cierre.js";
import { explicarMoraCuota } from "../persistencia/estado-cartera.js";
import { consultarVencimientos } from "../persistencia/consultar-vencimientos.js";
import { pagoEsquema } from "../validacion/esquemas.js";
import { accesoPermitido, validarConfiguracionAcceso } from "./acceso.js";
import { responderChat, type MensajeChat } from "../rag/chat.js";

const puerto = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const usuarioAcceso = process.env.APP_BASIC_USER;
const claveAcceso = process.env.APP_BASIC_PASSWORD;
validarConfiguracionAcceso(host, usuarioAcceso, claveAcceso);
const cadenaConexion = process.env.DATABASE_URL;
const pool = cadenaConexion
    ? new Pool({ connectionString: cadenaConexion })
    : null;
const app = express();

app.use((solicitud, respuesta, siguiente) => {
    if (!usuarioAcceso || !claveAcceso) { siguiente(); return; }
    if (!accesoPermitido(solicitud.headers.authorization, usuarioAcceso, claveAcceso)) {
        respuesta.setHeader("WWW-Authenticate", 'Basic realm="Credito Vecino"');
        respuesta.status(401).send("Acceso requerido");
        return;
    }
    siguiente();
});

app.use(express.json());

app.get("/api/health", async (_solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ estado: "sin_configurar" });
        return;
    }

    try {
        await pool.query("SELECT 1");
        respuesta.json({ estado: "conectado" });
    } catch {
        respuesta.status(503).json({ estado: "sin_conexion" });
    }
});

app.post("/api/gerencia/chat", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }

    const mensajes = solicitud.body?.mensajes;
    if (!Array.isArray(mensajes) || mensajes.length === 0 || mensajes.length > 12 ||
        mensajes.some((mensaje: unknown) => {
            if (typeof mensaje !== "object" || mensaje === null) return true;
            const actual = mensaje as Record<string, unknown>;
            return !["user", "assistant"].includes(String(actual.role)) ||
                typeof actual.content !== "string" || actual.content.trim().length === 0 ||
                actual.content.length > 2000;
        }) || mensajes.at(-1)?.role !== "user") {
        respuesta.status(400).json({ mensaje: "Envía una pregunta válida y hasta 12 mensajes de contexto" });
        return;
    }

    try {
        respuesta.json(await responderChat(pool, mensajes as MensajeChat[]));
    } catch (problema) {
        respuesta.status(503).json({
            mensaje: problema instanceof Error ? problema.message : "No se pudo responder la consulta"
        });
    }
});

app.get("/api/clientes", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({
            mensaje: "La base de datos no está configurada"
        });
        return;
    }

    const busqueda =
        typeof solicitud.query.buscar === "string"
            ? solicitud.query.buscar.trim()
            : "";

    try {
        const resultado = await pool.query(
            "SELECT id_cliente, nombre_completo, dpi, telefono, municipio " +
            "FROM clientes " +
            "WHERE $1 = '' " +
            "OR nombre_completo ILIKE '%' || $1 || '%' " +
            "OR dpi ILIKE '%' || $1 || '%' " +
            "OR telefono ILIKE '%' || $1 || '%' " +
            "OR EXISTS (SELECT 1 FROM creditos cr WHERE cr.id_cliente = clientes.id_cliente " +
            "AND cr.id_credito ILIKE '%' || $1 || '%') " +
            "ORDER BY nombre_completo " +
            "LIMIT 20",
            [busqueda]
        );

        respuesta.json(resultado.rows);
    } catch {
        respuesta.status(500).json({
            mensaje: "No se pudo consultar la lista de clientes"
        });
    }
});

app.post("/api/clientes", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }

    const { idCliente, nombreCompleto, dpi, telefono, municipio, fechaAlta } = solicitud.body ?? {};
    if (
        typeof nombreCompleto !== "string" || nombreCompleto.trim().length < 3 || nombreCompleto.length > 150 ||
        typeof dpi !== "string" || !(/^(\d{13}|DPI-FICT-\d{6})$/.test(dpi.replace(/\s/g, ""))) ||
        typeof telefono !== "string" || telefono.trim().length < 8 || telefono.length > 30 ||
        typeof municipio !== "string" || municipio.trim().length < 2 || municipio.length > 100
    ) {
        respuesta.status(400).json({ mensaje: "Revisa el nombre, DPI, teléfono y municipio" });
        return;
    }
    try {
        validarFechaCorte(fechaAlta);
    } catch {
        respuesta.status(400).json({ mensaje: "La fecha de alta no es válida" });
        return;
    }
    if (idCliente !== undefined && (typeof idCliente !== "string" || !(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idCliente) || /^CL-\d{4}$/.test(idCliente)))) {
        respuesta.status(400).json({ mensaje: "El identificador del cliente no es válido" });
        return;
    }

    try {
        const resultado = await pool.query(
            `INSERT INTO clientes
                (id_cliente, nombre_completo, dpi, telefono, municipio, fecha_alta)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id_cliente) DO UPDATE SET id_cliente = EXCLUDED.id_cliente
             RETURNING id_cliente, nombre_completo, dpi, telefono, municipio, fecha_alta::text`,
            [idCliente ?? randomUUID(), nombreCompleto.trim(), dpi.replace(/\s/g, ""), telefono.trim(), municipio.trim(), fechaAlta]
        );
        const cliente = resultado.rows[0];
        if (cliente.nombre_completo !== nombreCompleto.trim() || cliente.dpi !== dpi.replace(/\s/g, "") || cliente.telefono !== telefono.trim() || cliente.municipio !== municipio.trim() || cliente.fecha_alta !== fechaAlta) {
            respuesta.status(409).json({ mensaje: "El identificador ya corresponde a otro cliente" });
            return;
        }
        respuesta.status(201).json(cliente);
    } catch (problema) {
        if ((problema as { code?: string }).code === "23505") {
            respuesta.status(409).json({ mensaje: "Ya existe un cliente con ese DPI" });
            return;
        }
        respuesta.status(500).json({ mensaje: "No se pudo registrar el cliente" });
    }
});

app.get("/api/clientes/:id", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({
            mensaje: "La base de datos no está configurada"
        });
        return;
    }

    try {
        const resultado = await pool.query(
            "SELECT id_cliente, nombre_completo, dpi, telefono, " +
            "municipio, fecha_alta::text " +
            "FROM clientes WHERE id_cliente = $1",
            [solicitud.params.id]
        );

        if (resultado.rowCount === 0) {
            respuesta.status(404).json({
                mensaje: "No se encontró el cliente"
            });
            return;
        }

        respuesta.json(resultado.rows[0]);
    } catch {
        respuesta.status(500).json({
            mensaje: "No se pudo consultar el cliente"
        });
    }
});

app.post("/api/simulacion", (solicitud, respuesta) => {
    const { monto, plazoMeses, fechaOperacion } = solicitud.body ?? {};
    if (typeof monto !== "string" || !/^\d+(\.\d{1,2})?$/.test(monto) || !Number.isInteger(plazoMeses) || plazoMeses < 3 || plazoMeses > 24) {
        respuesta.status(400).json({ mensaje: "Monto o plazo inválido" });
        return;
    }
    try {
        const capital = Dinero.desdeQuetzales(monto);
        if (capital.obtenerCentavos() < 100000n || capital.obtenerCentavos() > 2500000n) {
            respuesta.status(422).json({ mensaje: "El monto debe estar entre Q1,000.00 y Q25,000.00" });
            return;
        }
        const fechas = generarFechasVencimiento(fechaOperacion, plazoMeses);
        const cuotas = new AmortizacionFrancesa().generar({
            capital,
            tasaNominalAnual: new Decimal("0.36"),
            numeroCuotas: plazoMeses
        }).obtenerCuotas();
        respuesta.json({
            tna_bps: 3600,
            cuotas: cuotas.map((cuota, indice) => ({
                numero: cuota.numero,
                fecha_vencimiento: fechas[indice],
                interes: cuota.interes.aDecimal(),
                capital: cuota.capital.aDecimal(),
                cuota: cuota.cuota.aDecimal(),
                saldo_final: cuota.saldoFinal.aDecimal()
            }))
        });
    } catch {
        respuesta.status(400).json({ mensaje: "Revisa la fecha de operación" });
    }
});

app.post("/api/solicitudes", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({
            mensaje: "La base de datos no está configurada"
        });
        return;
    }

    const { clienteId, montoSolicitado, plazoMeses, motivo, claveIdempotencia, fechaOperacion } = solicitud.body ?? {};
    const monto = typeof montoSolicitado === "string"
        ? montoSolicitado
        : String(montoSolicitado ?? "");

    if (
        typeof clienteId !== "string" ||
        clienteId.trim().length === 0 ||
        clienteId.length > 100
    ) {
        respuesta.status(400).json({ mensaje: "El cliente seleccionado no es válido" });
        return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(monto)) {
        respuesta.status(400).json({ mensaje: "El monto debe tener hasta dos decimales" });
        return;
    }

    const centavos = BigInt(monto.split(".")[0] ?? "0") * 100n +
        BigInt((monto.split(".")[1] ?? "").padEnd(2, "0") || "0");

    if (centavos < 100000n || centavos > 2500000n) {
        respuesta.status(422).json({ mensaje: "El monto debe estar entre Q1,000.00 y Q25,000.00" });
        return;
    }

    if (!Number.isInteger(plazoMeses) || plazoMeses < 3 || plazoMeses > 24) {
        respuesta.status(422).json({ mensaje: "El plazo debe estar entre 3 y 24 meses" });
        return;
    }

    if (typeof motivo !== "string" || motivo.trim().length < 3 || motivo.trim().length > 500) {
        respuesta.status(400).json({ mensaje: "Describe el motivo en 3 a 500 caracteres" });
        return;
    }
    try {
        generarFechasVencimiento(fechaOperacion, plazoMeses);
    } catch {
        respuesta.status(400).json({ mensaje: "La fecha de operación no es válida" });
        return;
    }

    if (typeof claveIdempotencia !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claveIdempotencia)) {
        respuesta.status(400).json({ mensaje: "La clave de la solicitud no es válida" });
        return;
    }

    try {
        const idSolicitud = randomUUID();
        const resultado = await pool.query(
            `INSERT INTO solicitudes_credito
                (id_solicitud, id_cliente, monto_centavos, plazo_meses, tna_bps, motivo, clave_idempotencia, fecha_operacion)
             VALUES ($1, $2, $3, $4, 3600, $5, $6, $7)
             ON CONFLICT (clave_idempotencia) DO UPDATE
                SET clave_idempotencia = EXCLUDED.clave_idempotencia
             RETURNING id_solicitud, id_cliente, monto_centavos::text,
                       plazo_meses, tna_bps, motivo, estado, fecha_solicitud,
                       fecha_operacion::text`,
            [idSolicitud, clienteId, centavos.toString(), plazoMeses, motivo.trim(), claveIdempotencia, fechaOperacion]
        );

        if (
            resultado.rows[0].id_cliente !== clienteId ||
            resultado.rows[0].monto_centavos !== centavos.toString() ||
            resultado.rows[0].plazo_meses !== plazoMeses ||
            resultado.rows[0].motivo !== motivo.trim() ||
            resultado.rows[0].fecha_operacion !== fechaOperacion
        ) {
            respuesta.status(409).json({ mensaje: "La clave ya corresponde a otra solicitud" });
            return;
        }

        respuesta.status(201).json(resultado.rows[0]);
    } catch (problema) {
        const codigo = (problema as { code?: string }).code;
        if (codigo === "23503") {
            respuesta.status(404).json({ mensaje: "No se encontró el cliente seleccionado" });
            return;
        }

        respuesta.status(500).json({ mensaje: "No se pudo registrar la solicitud" });
    }
});

app.get("/api/solicitudes", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }
    const estado = typeof solicitud.query.estado === "string" ? solicitud.query.estado : "SOLICITADO";
    if (!["SOLICITADO", "APROBADO", "DESEMBOLSADO", "RECHAZADO"].includes(estado)) {
        respuesta.status(400).json({ mensaje: "Estado de solicitud inválido" });
        return;
    }
    try {
        const resultado = await pool.query(
            `SELECT s.id_solicitud, s.id_cliente, c.nombre_completo,
                    s.monto_centavos::text, s.plazo_meses, s.tna_bps,
                    s.fecha_operacion::text, s.estado, s.id_credito
             FROM solicitudes_credito s JOIN clientes c ON c.id_cliente = s.id_cliente
             WHERE s.estado = $1 ORDER BY s.fecha_solicitud DESC LIMIT 100`,
            [estado]
        );
        respuesta.json(resultado.rows);
    } catch {
        respuesta.status(500).json({ mensaje: "No se pudieron consultar las solicitudes" });
    }
});

app.get("/api/asesores", async (_solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }
    try {
        const resultado = await pool.query(
            `SELECT id_asesor, nombre_completo FROM asesores ORDER BY id_asesor`
        );
        respuesta.json(resultado.rows);
    } catch {
        respuesta.status(500).json({ mensaje: "No se pudieron consultar los asesores" });
    }
});

app.get("/api/gerencia/cartera", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }
    const fecha = typeof solicitud.query.fecha === "string" ? solicitud.query.fecha : "";
    try {
        respuesta.json(await consultarCartera(pool, fecha));
    } catch (problema) {
        respuesta.status(400).json({ mensaje: problema instanceof Error ? problema.message : "No se pudo consultar la cartera" });
    }
});

app.get("/api/gerencia/vencimientos", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }
    const fecha = typeof solicitud.query.fecha === "string" ? solicitud.query.fecha : "";
    const dias = Number(solicitud.query.dias);
    try {
        respuesta.json(await consultarVencimientos(pool, fecha, dias));
    } catch (problema) {
        respuesta.status(400).json({ mensaje: problema instanceof Error ? problema.message : "No se pudieron consultar los vencimientos" });
    }
});

app.get("/api/gerencia/cierres", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }
    const tipo = solicitud.query.tipo;
    const fecha = solicitud.query.fecha;
    if ((tipo !== "DIARIO" && tipo !== "MENSUAL") || typeof fecha !== "string") {
        respuesta.status(400).json({ mensaje: "Indica tipo y fecha del cierre" });
        return;
    }
    try {
        validarFechaCorte(fecha);
        const resultado = await pool.query(
            `SELECT resumen, creado_en FROM cierres WHERE tipo = $1 AND fecha_corte = $2`,
            [tipo, fecha]
        );
        if (!resultado.rows[0]) {
            respuesta.status(404).json({ mensaje: "El cierre aún no se ha ejecutado" });
            return;
        }
        respuesta.json(resultado.rows[0]);
    } catch {
        respuesta.status(400).json({ mensaje: "Fecha de corte inválida" });
    }
});

app.post("/api/gerencia/cierres", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }
    const { tipo, fecha } = solicitud.body ?? {};
    if ((tipo !== "DIARIO" && tipo !== "MENSUAL") || typeof fecha !== "string") {
        respuesta.status(400).json({ mensaje: "Indica tipo y fecha del cierre" });
        return;
    }
    try {
        validarFechaCorte(fecha);
        const existente = await pool.query(
            `SELECT resumen, creado_en FROM cierres WHERE tipo = $1 AND fecha_corte = $2`,
            [tipo, fecha]
        );
        const resumen = await calcularCierre(pool, tipo as TipoCierre, fecha);
        await pool.query(
            `INSERT INTO cierres (tipo, fecha_corte, resumen)
             VALUES ($1, $2, $3::jsonb)
             ON CONFLICT (tipo, fecha_corte) DO UPDATE
             SET resumen = EXCLUDED.resumen, creado_en = CURRENT_TIMESTAMP`,
            [tipo, fecha, JSON.stringify(resumen)]
        );
        const guardado = await pool.query(
            `SELECT resumen, creado_en FROM cierres WHERE tipo = $1 AND fecha_corte = $2`,
            [tipo, fecha]
        );
        respuesta.status(existente.rows[0] ? 200 : 201).json({ ...guardado.rows[0], ya_existia: Boolean(existente.rows[0]) });
    } catch (problema) {
        respuesta.status(400).json({ mensaje: problema instanceof Error ? problema.message : "No se pudo ejecutar el cierre" });
    }
});

app.post("/api/solicitudes/:id/aprobar", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }
    try {
        const resultado = await pool.query(
            `UPDATE solicitudes_credito SET estado = 'APROBADO'
             WHERE id_solicitud = $1 AND estado = 'SOLICITADO'
             RETURNING id_solicitud, estado`,
            [solicitud.params.id]
        );
        if (resultado.rowCount === 0) {
            respuesta.status(409).json({ mensaje: "La solicitud no está pendiente de aprobación" });
            return;
        }
        respuesta.json(resultado.rows[0]);
    } catch {
        respuesta.status(400).json({ mensaje: "No se pudo aprobar la solicitud" });
    }
});

app.post("/api/solicitudes/:id/desembolsar", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }
    const { idCredito, idAsesor } = solicitud.body ?? {};
    if (typeof idCredito !== "string" || !/^CV-\d{4}-\d{4}$/.test(idCredito) ||
        typeof idAsesor !== "string" || !/^AS-\d{2}$/.test(idAsesor)) {
        respuesta.status(400).json({ mensaje: "Código de crédito o asesor inválido" });
        return;
    }

    const conexion = await pool.connect();
    try {
        await conexion.query("BEGIN");
        const solicitudDb = await conexion.query<{
            estado: string;
            id_cliente: string;
            monto_centavos: string;
            plazo_meses: number;
            tna_bps: number;
            fecha_operacion: string | null;
            id_credito: string | null;
        }>(
            `SELECT estado, id_cliente, monto_centavos::text, plazo_meses,
                    tna_bps, fecha_operacion::text, id_credito
             FROM solicitudes_credito WHERE id_solicitud = $1 FOR UPDATE`,
            [solicitud.params.id]
        );
        const datos = solicitudDb.rows[0];
        if (!datos) {
            await conexion.query("ROLLBACK");
            respuesta.status(404).json({ mensaje: "No se encontró la solicitud" });
            return;
        }
        if (datos.estado === "DESEMBOLSADO" && datos.id_credito === idCredito) {
            await conexion.query("ROLLBACK");
            respuesta.json({ id_credito: idCredito, duplicado: true });
            return;
        }
        if (datos.estado !== "APROBADO" || !datos.fecha_operacion) {
            await conexion.query("ROLLBACK");
            respuesta.status(409).json({ mensaje: "La solicitud debe estar aprobada y tener fecha de operación" });
            return;
        }
        const fechas = generarFechasVencimiento(datos.fecha_operacion, datos.plazo_meses);
        const cuotas = new AmortizacionFrancesa().generar({
            capital: Dinero.desdeCentavos(BigInt(datos.monto_centavos)),
            tasaNominalAnual: new Decimal(datos.tna_bps).div(10000),
            numeroCuotas: datos.plazo_meses
        }).obtenerCuotas();

        await conexion.query(
            `INSERT INTO creditos
                (id_credito, id_cliente, id_asesor, fecha_otorgamiento,
                 capital_centavos, plazo_meses, tna_bps)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [idCredito, datos.id_cliente, idAsesor, datos.fecha_operacion,
             datos.monto_centavos, datos.plazo_meses, datos.tna_bps]
        );
        for (let indice = 0; indice < cuotas.length; indice += 1) {
            const cuota = cuotas[indice];
            if (!cuota) throw new Error("Falta una cuota del plan");
            await conexion.query(
                `INSERT INTO cuotas_credito
                    (id_credito, numero_cuota, fecha_vencimiento, saldo_inicial_centavos,
                     interes_centavos, capital_centavos, monto_cuota_centavos, saldo_final_centavos)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [idCredito, cuota.numero, fechas[indice],
                 cuota.saldoInicial.obtenerCentavos().toString(),
                 cuota.interes.obtenerCentavos().toString(),
                 cuota.capital.obtenerCentavos().toString(),
                 cuota.cuota.obtenerCentavos().toString(),
                 cuota.saldoFinal.obtenerCentavos().toString()]
            );
        }
        await conexion.query(
            `UPDATE solicitudes_credito SET estado = 'DESEMBOLSADO', id_credito = $2
             WHERE id_solicitud = $1`,
            [solicitud.params.id, idCredito]
        );
        await conexion.query("COMMIT");
        respuesta.status(201).json({ id_credito: idCredito, cuotas: cuotas.length });
    } catch (problema) {
        await conexion.query("ROLLBACK");
        if ((problema as { code?: string }).code === "23505") {
            respuesta.status(409).json({ mensaje: "El código de crédito ya existe" });
        } else if ((problema as { code?: string }).code === "23503") {
            respuesta.status(404).json({ mensaje: "No se encontró el asesor" });
        } else {
            respuesta.status(500).json({ mensaje: "No se pudo desembolsar el crédito" });
        }
    } finally {
        conexion.release();
    }
});

app.get("/api/clientes/:id/creditos", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }

    try {
        const resultado = await pool.query(
            `SELECT id_credito, fecha_otorgamiento::text,
                    capital_centavos::text, plazo_meses, tna_bps
             FROM creditos WHERE id_cliente = $1
             ORDER BY fecha_otorgamiento DESC, id_credito DESC`,
            [solicitud.params.id]
        );
        respuesta.json(resultado.rows);
    } catch {
        respuesta.status(500).json({ mensaje: "No se pudieron consultar los créditos" });
    }
});

app.get("/api/creditos/:id", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }

    try {
        const fecha = typeof solicitud.query.fecha === "string" ? solicitud.query.fecha : "";
        const calculado = await consultarEstadoCredito(pool, solicitud.params.id, fecha);
        if (!calculado) {
            respuesta.status(404).json({ mensaje: "No se encontró el crédito" });
            return;
        }
        const [credito, cuotas, pagos] = await Promise.all([
            pool.query(
                `SELECT id_credito, id_cliente, fecha_otorgamiento::text,
                        capital_centavos::text, plazo_meses, tna_bps, reestructurado
                 FROM creditos WHERE id_credito = $1`,
                [solicitud.params.id]
            ),
            pool.query(
                `SELECT numero_cuota, fecha_vencimiento::text,
                        monto_cuota_centavos::text, capital_centavos::text,
                        interes_centavos::text, saldo_final_centavos::text
                 FROM cuotas_credito WHERE id_credito = $1
                 ORDER BY numero_cuota`,
                [solicitud.params.id]
            ),
            pool.query(
                `SELECT p.id, p.fecha::text, p.monto_centavos::text, p.canal,
                        a.pago_id IS NOT NULL AS aplicado
                 FROM pagos p
                 LEFT JOIN aplicaciones_pagos a ON a.pago_id = p.id
                 WHERE p.id_credito = $1 ORDER BY p.fecha DESC, p.id DESC`,
                [solicitud.params.id]
            )
        ]);

        if (credito.rowCount === 0) {
            respuesta.status(404).json({ mensaje: "No se encontró el crédito" });
            return;
        }

        const estado = calculado.estado;
        const tramo = estado.incobrable ? "INCOBRABLE" :
            estado.diasAtraso > 90 ? "VENCIDO" :
            estado.diasAtraso > 60 ? "MORA_3" :
            estado.diasAtraso > 30 ? "MORA_2" :
            estado.diasAtraso > 0 ? "MORA_1" : "SIN_MORA";
        respuesta.json({
            ...credito.rows[0], cuotas: cuotas.rows, pagos: pagos.rows,
            fecha_corte: fecha,
            saldo_capital_centavos: estado.saldoCapital.toString(),
            dias_atraso: estado.diasAtraso,
            tramo,
            estado: estado.saldoCapital === 0n ? "CANCELADO" :
                estado.incobrable ? "INCOBRABLE" :
                estado.diasAtraso > 0 ? "EN_MORA" : "VIGENTE",
            cuotas_pagadas: estado.cuotas.filter(cuota =>
                cuota.capitalPendiente + cuota.interesPendiente +
                cuota.moraPendiente + cuota.gastosPendientes === 0n
            ).length,
            cuotas_vencidas: estado.cuotas.filter(cuota =>
                cuota.vencimiento < fecha &&
                cuota.capitalPendiente + cuota.interesPendiente +
                cuota.moraPendiente + cuota.gastosPendientes > 0n
            ).length,
            proxima_cuota: estado.proximaCuota ? {
                numero: estado.proximaCuota.numero,
                vencimiento: estado.proximaCuota.vencimiento,
                monto_centavos: estado.montoExigible.toString()
            } : null
        });
    } catch {
        respuesta.status(500).json({ mensaje: "No se pudo consultar el crédito" });
    }
});

app.get("/api/creditos/:id/deuda", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }
    const fecha = typeof solicitud.query.fecha === "string" ? solicitud.query.fecha : "";
    try {
        const resultado = await consultarEstadoCredito(pool, solicitud.params.id, fecha);
        if (!resultado) {
            respuesta.status(404).json({ mensaje: "No se encontró el crédito" });
            return;
        }
        const cuota = resultado.estado.proximaCuota;
        respuesta.json({
            id_credito: solicitud.params.id,
            fecha_corte: fecha,
            politica: resultado.politica,
            dias_atraso: resultado.estado.diasAtraso,
            incobrable: resultado.estado.incobrable,
            saldo_capital_centavos: resultado.estado.saldoCapital.toString(),
            cuota: cuota ? {
                numero: cuota.numero,
                vencimiento: cuota.vencimiento,
                gastos_centavos: cuota.gastosPendientes.toString(),
                moratorio_centavos: cuota.moraPendiente.toString(),
                corriente_centavos: cuota.interesPendiente.toString(),
                capital_centavos: cuota.capitalPendiente.toString(),
                total_centavos: resultado.estado.montoExigible.toString()
            } : null
        });
    } catch (problema) {
        respuesta.status(400).json({ mensaje: problema instanceof Error ? problema.message : "No se pudo calcular la deuda" });
    }
});

app.get("/api/creditos/:id/mora", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }
    const fecha = typeof solicitud.query.fecha === "string" ? solicitud.query.fecha : "";
    const numero = solicitud.query.cuota === undefined ? undefined : Number(solicitud.query.cuota);
    if (numero !== undefined && (!Number.isInteger(numero) || numero < 1)) {
        respuesta.status(400).json({ codigo: "CUOTA_INVALIDA", mensaje: "Indica un número de cuota válido" });
        return;
    }
    try {
        const calculado = await consultarEstadoCredito(pool, solicitud.params.id, fecha);
        if (!calculado) {
            respuesta.status(404).json({ mensaje: "No se encontró el crédito" });
            return;
        }
        const mora = explicarMoraCuota(calculado.estado, fecha, calculado.politicaFuente, numero);
        if (!mora) {
            respuesta.status(404).json({ codigo: "CUOTA_INEXISTENTE", mensaje: "No se encontró la cuota" });
            return;
        }
        respuesta.json({
            id_credito: solicitud.params.id,
            fecha_corte: fecha,
            politica: calculado.politica,
            ...mora
        });
    } catch (problema) {
        respuesta.status(400).json({ mensaje: problema instanceof Error ? problema.message : "No se pudo explicar la mora" });
    }
});

app.post("/api/creditos/:id/pagos", async (solicitud, respuesta) => {
    if (!pool) {
        respuesta.status(503).json({ mensaje: "La base de datos no está configurada" });
        return;
    }

    const validacion = pagoEsquema.safeParse(solicitud.body);
    if (!validacion.success) {
        respuesta.status(400).json({ codigo: "DATOS_INVALIDOS", mensaje: "Revisa el monto, canal, clave y fecha del pago" });
        return;
    }
    const { monto, canal, claveIdempotencia, fechaOperacion } = validacion.data;
    const [parteEntera = "0", parteDecimal = ""] = monto.split(".");
    const centavos = BigInt(parteEntera) * 100n + BigInt(parteDecimal.padEnd(2, "0") || "0");
    if (centavos <= 0n || centavos > 250000000n) {
        respuesta.status(422).json({ mensaje: "El monto del pago no es válido" });
        return;
    }

    const conexion = await pool.connect();
    try {
        await conexion.query("BEGIN");
        await conexion.query("SELECT pg_advisory_xact_lock(hashtext($1))", [solicitud.params.id]);
        const anterior = await conexion.query(
            `SELECT id, id_credito, fecha::text, monto_centavos::text, canal
             FROM pagos WHERE clave_idempotencia = $1`,
            [claveIdempotencia]
        );
        if (anterior.rows[0]) {
            const pago = anterior.rows[0];
            await conexion.query("ROLLBACK");
            if (pago.id_credito !== solicitud.params.id || pago.fecha !== fechaOperacion || pago.monto_centavos !== centavos.toString() || pago.canal !== canal) {
                respuesta.status(409).json({ mensaje: "La clave ya corresponde a otro pago" });
            } else {
                const aplicacion = await pool.query(
                    `SELECT gastos_centavos::text, interes_moratorio_centavos::text AS moratorio_centavos,
                            interes_corriente_centavos::text AS corriente_centavos,
                            capital_centavos::text
                     FROM aplicaciones_pagos WHERE pago_id = $1`,
                    [pago.id]
                );
                respuesta.status(200).json({ ...pago, duplicado: true, aplicado: aplicacion.rowCount !== 0, aplicacion: aplicacion.rows[0] ?? null });
            }
            return;
        }

        const antes = await consultarEstadoCredito(conexion, solicitud.params.id, fechaOperacion);
        if (!antes) {
            await conexion.query("ROLLBACK");
            respuesta.status(404).json({ mensaje: "No se encontró el crédito" });
            return;
        }
        if (antes.estado.incobrable) {
            await conexion.query("ROLLBACK");
            respuesta.status(422).json({ codigo: "CREDITO_INCOBRABLE", mensaje: "El crédito es incobrable" });
            return;
        }
        if (!antes.estado.proximaCuota) {
            await conexion.query("ROLLBACK");
            respuesta.status(409).json({ codigo: "CUOTA_PAGADA", mensaje: "El crédito no tiene cuotas pendientes" });
            return;
        }
        if (centavos !== antes.estado.montoExigible) {
            await conexion.query("ROLLBACK");
            respuesta.status(422).json({
                codigo: "MONTO_NO_EXACTO",
                mensaje: "El monto no coincide con la cuota exigible",
                monto_correcto_centavos: antes.estado.montoExigible.toString()
            });
            return;
        }

        const resultado = await conexion.query(
            `INSERT INTO pagos (clave_idempotencia, id_credito, fecha, monto_centavos, canal)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, id_credito, fecha::text, monto_centavos::text, canal`,
            [claveIdempotencia, solicitud.params.id, fechaOperacion, centavos.toString(), canal]
        );
        const pago = resultado.rows[0];
        const fechaFinal = await conexion.query<{ fecha: string }>(
            `SELECT MAX(fecha)::text AS fecha FROM pagos WHERE id_credito = $1`,
            [solicitud.params.id]
        );
        const despues = await consultarEstadoCredito(conexion, solicitud.params.id, fechaFinal.rows[0]?.fecha ?? fechaOperacion);
        if (!despues) throw new Error("No se pudo reconstruir el crédito");
        await guardarAplicaciones(conexion, despues.estado.aplicaciones);
        await conexion.query("COMMIT");
        const aplicacion = despues.estado.aplicaciones.find(actual => actual.pagoId === String(pago.id));
        respuesta.status(201).json({
            ...pago,
            aplicado: true,
            aplicacion: aplicacion ? {
                gastos_centavos: aplicacion.gastos.toString(),
                moratorio_centavos: aplicacion.moratorio.toString(),
                corriente_centavos: aplicacion.corriente.toString(),
                capital_centavos: aplicacion.capital.toString()
            } : null
        });
    } catch (problema) {
        await conexion.query("ROLLBACK");
        if ((problema as { code?: string }).code === "23503") {
            respuesta.status(404).json({ mensaje: "No se encontró el crédito" });
            return;
        }
        respuesta.status(500).json({ mensaje: "No se pudo registrar el pago" });
    } finally {
        conexion.release();
    }
});

app.use(express.static(resolve(process.cwd(), "client-dist")));

app.get(/.*/, (_solicitud, respuesta) => {
    respuesta.sendFile(resolve(process.cwd(), "client-dist/index.html"));
});

app.listen(puerto, host, () => {
    console.log(`API disponible en ${host}:${puerto}`);
});

process.on("SIGTERM", async () => {
    await pool?.end();
    process.exit(0);
});


