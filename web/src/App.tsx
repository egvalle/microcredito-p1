import { useEffect, useState, type FormEvent } from "react";
import { Dinero } from "../../src/dominio/dinero.js";
import {
    eliminarClientePendiente,
    eliminarPagoPendiente,
    eliminarSolicitudPendiente,
    guardarClientes,
    guardarConsulta,
    guardarClientePendiente,
    guardarPagoPendiente,
    guardarSolicitudPendiente,
    obtenerClientes,
    obtenerConsulta,
    obtenerClientesPendientes,
    obtenerPagosPendientes,
    obtenerSolicitudesPendientes,
    type AltaClientePendiente,
    type PagoPendiente,
    type SolicitudPendiente
} from "./almacen-local.js";
import pendingOperations from "./assets/pending-operations.svg";

type Pantalla = "inicio" | "buscar" | "registrar" | "solicitud" | "plan" | "confirmacion" | "creditos" | "detalle" | "mora" | "pago" | "comprobante" | "sincronizacion" | "gerencia" | "cierre" | "chat";
type EstadoConexion = "cargando" | "conectado" | "sin_conexion";

type Cliente = {
    id_cliente: string;
    nombre_completo: string;
    dpi: string;
    telefono: string;
    municipio: string;
};

type SolicitudGuardada = {
    id_solicitud: string;
    estado: string;
    monto_centavos: string;
    plazo_meses: number;
};

type SolicitudGestion = {
    id_solicitud: string;
    id_cliente: string;
    nombre_completo: string;
    monto_centavos: string;
    plazo_meses: number;
    fecha_operacion: string;
    estado: string;
    id_credito: string | null;
};

type Asesor = { id_asesor: string; nombre_completo: string };

type CarteraGerencial = {
    cartera_activa_centavos: string;
    cartera_mora_centavos: string;
    cartera_riesgo_centavos: string;
    porcentaje_riesgo: string;
    incobrable_mes_centavos: string;
    tramos: Array<{ tramo: string; saldo_centavos: string; porcentaje: string; creditos: string[] }>;
    morosos: Array<{ id_credito: string; dias_atraso: number; tramo: string; saldo_centavos: string }>;
};

type Cierre = {
    resumen: {
        tipo: string;
        fecha_inicio: string;
        fecha_corte: string;
        desembolsos_centavos: string;
        recuperaciones_centavos: string;
        cartera_activa_centavos: string;
        cartera_riesgo_centavos: string;
        incobrable_mes_centavos: string;
        conceptos: {
            gastos_centavos: string;
            moratorio_centavos: string;
            corriente_centavos: string;
            capital_centavos: string;
            excedente_centavos: string;
        };
    };
    creado_en: string;
    ya_existia?: boolean;
};

type Simulacion = {
    tna_bps: number;
    cuotas: Array<{
        numero: number;
        fecha_vencimiento: string;
        interes: string;
        capital: string;
        cuota: string;
        saldo_final: string;
    }>;
};

function fechaLocal(): string {
    const hoy = new Date();
    return [
        String(hoy.getFullYear()).padStart(4, "0"),
        String(hoy.getMonth() + 1).padStart(2, "0"),
        String(hoy.getDate()).padStart(2, "0")
    ].join("-");
}

type ResumenCredito = {
    id_credito: string;
    fecha_otorgamiento: string;
    capital_centavos: string;
    plazo_meses: number;
    tna_bps: number;
};

type DetalleCredito = ResumenCredito & {
    reestructurado: boolean;
    fecha_corte: string;
    saldo_capital_centavos: string;
    dias_atraso: number;
    tramo: string;
    estado: string;
    cuotas_pagadas: number;
    cuotas_vencidas: number;
    proxima_cuota: null | { numero: number; vencimiento: string; monto_centavos: string };
    cuotas: Array<{
        numero_cuota: number;
        fecha_vencimiento: string;
        monto_cuota_centavos: string;
        capital_centavos: string;
        interes_centavos: string;
        saldo_final_centavos: string;
    }>;
    pagos: Array<{
        id: string;
        fecha: string;
        monto_centavos: string;
        canal: string;
        aplicado: boolean;
    }>;
};

type PagoGuardado = {
    id: string;
    fecha: string;
    monto_centavos: string;
    canal: string;
    aplicado: boolean;
    duplicado?: boolean;
    pendiente?: boolean;
    aplicacion?: {
        gastos_centavos: string;
        moratorio_centavos: string;
        corriente_centavos: string;
        capital_centavos: string;
    };
};

type DeudaActual = {
    fecha_corte: string;
    dias_atraso: number;
    incobrable: boolean;
    cuota: null | {
        numero: number;
        vencimiento: string;
        gastos_centavos: string;
        moratorio_centavos: string;
        corriente_centavos: string;
        capital_centavos: string;
        total_centavos: string;
    };
};

type MoraDetalle = {
    politica: string;
    cuota: number | null;
    dias_atraso: number;
    capital_en_mora_centavos: string;
    mora_pendiente_centavos: string;
    tramos: Array<{
        desde: number;
        hasta: number;
        dias: number;
        tasa_bps: number;
        importe_quetzales_sin_redondear: string;
    }>;
};

type MensajeChat = { role: "user" | "assistant"; content: string };
type FuenteChat = { doc_id: string; titulo: string; vigencia: string };

function mostrarQuetzales(centavos: string): string {
    return "Q" + (Number(centavos) / 100).toLocaleString("es-GT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

export function App() {
    const [pantalla, setPantalla] = useState<Pantalla>("inicio");
    const [conexion, setConexion] =
        useState<EstadoConexion>("cargando");
    const [busqueda, setBusqueda] = useState("");
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [clienteSeleccionado, setClienteSeleccionado] =
        useState<Cliente | null>(null);
    const [error, setError] = useState("");
    const [monto, setMonto] = useState("10000");
    const [plazoMeses, setPlazoMeses] = useState(12);
    const [motivo, setMotivo] = useState("");
    const [fechaOperacion, setFechaOperacion] = useState(fechaLocal);
    const [plan, setPlan] = useState<Simulacion | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [solicitudGuardada, setSolicitudGuardada] =
        useState<SolicitudGuardada | null>(null);
    const [nombreNuevo, setNombreNuevo] = useState("");
    const [idNuevo, setIdNuevo] = useState("");
    const [dpiNuevo, setDpiNuevo] = useState("");
    const [telefonoNuevo, setTelefonoNuevo] = useState("");
    const [municipioNuevo, setMunicipioNuevo] = useState("");
    const [fechaAlta, setFechaAlta] = useState(fechaLocal);
    const [creditos, setCreditos] = useState<ResumenCredito[]>([]);
    const [detalleCredito, setDetalleCredito] = useState<DetalleCredito | null>(null);
    const [fechaDetalle, setFechaDetalle] = useState(fechaLocal);
    const [busquedaParaPago, setBusquedaParaPago] = useState(false);
    const [pendientes, setPendientes] = useState(0);
    const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudPendiente[]>([]);
    const [pagosPendientes, setPagosPendientes] = useState<PagoPendiente[]>([]);
    const [clientesPendientes, setClientesPendientes] = useState<AltaClientePendiente[]>([]);
    const [errorSincronizacion, setErrorSincronizacion] = useState("");
    const [solicitudesGestion, setSolicitudesGestion] = useState<SolicitudGestion[]>([]);
    const [estadoGestion, setEstadoGestion] = useState("SOLICITADO");
    const [asesores, setAsesores] = useState<Asesor[]>([]);
    const [idAsesor, setIdAsesor] = useState("AS-01");
    const [codigoCredito, setCodigoCredito] = useState("");
    const [fechaGerencia, setFechaGerencia] = useState(fechaLocal);
    const [carteraGerencial, setCarteraGerencial] = useState<CarteraGerencial | null>(null);
    const [tramoSeleccionado, setTramoSeleccionado] = useState("");
    const [detalleDesdeGerencia, setDetalleDesdeGerencia] = useState(false);
    const [tipoCierre, setTipoCierre] = useState<"DIARIO" | "MENSUAL">("DIARIO");
    const [cierre, setCierre] = useState<Cierre | null>(null);

    useEffect(() => {
        if (pantalla !== "gerencia") return;
        void fetch(`/api/gerencia/cartera?fecha=${encodeURIComponent(fechaGerencia)}`)
            .then(async respuesta => {
                if (!respuesta.ok) throw new Error("No se pudo consultar la cartera");
                setCarteraGerencial(await respuesta.json() as CarteraGerencial);
            })
            .catch(() => setError("No se pudo consultar la cartera para esta fecha"));
    }, [pantalla, fechaGerencia]);
    const [planDesde, setPlanDesde] = useState<"solicitud" | "detalle">("solicitud");
    const [montoPago, setMontoPago] = useState("");
    const [canalPago, setCanalPago] = useState("EFECTIVO");
    const [pagoGuardado, setPagoGuardado] = useState<PagoGuardado | null>(null);
    const [ultimoPago, setUltimoPago] = useState<PagoPendiente | null>(null);
    const [fechaPago, setFechaPago] = useState(fechaLocal);
    const [deudaActual, setDeudaActual] = useState<DeudaActual | null>(null);
    const [moraDetalle, setMoraDetalle] = useState<MoraDetalle | null>(null);
    const [mensajesChat, setMensajesChat] = useState<MensajeChat[]>([]);
    const [preguntaChat, setPreguntaChat] = useState("");
    const [fuentesChat, setFuentesChat] = useState<FuenteChat[]>([]);
    const [consultandoChat, setConsultandoChat] = useState(false);

    useEffect(() => {
        if (pantalla !== "pago" || !detalleCredito) return;
        setDeudaActual(null);
        void fetch(`/api/creditos/${encodeURIComponent(detalleCredito.id_credito)}/deuda?fecha=${encodeURIComponent(fechaPago)}`)
            .then(async respuesta => {
                if (!respuesta.ok) throw new Error("No se pudo calcular la cuota");
                const deuda = await respuesta.json() as DeudaActual;
                setDeudaActual(deuda);
                setMontoPago(deuda.cuota ? (Number(deuda.cuota.total_centavos) / 100).toFixed(2) : "");
                void guardarConsulta(`deuda:${detalleCredito.id_credito}:${fechaPago}`, deuda).catch(() => {});
            })
            .catch(async () => {
                const guardada = await obtenerConsulta<DeudaActual>(`deuda:${detalleCredito.id_credito}:${fechaPago}`).catch(() => null);
                if (guardada) {
                    setDeudaActual(guardada);
                    setMontoPago(guardada.cuota ? (Number(guardada.cuota.total_centavos) / 100).toFixed(2) : "");
                } else setError("Consulta la cuota con conexión antes de registrar un pago sin conexión para esta fecha");
            });
    }, [pantalla, detalleCredito, fechaPago]);

    useEffect(() => {
        if (!/^\d+(\.\d{1,2})?$/.test(monto)) { setPlan(null); return; }
        const controlador = new AbortController();
        const temporizador = window.setTimeout(() => {
            void fetch("/api/simulacion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ monto, plazoMeses, fechaOperacion }),
                signal: controlador.signal
            }).then(async respuesta => {
                setPlan(respuesta.ok ? await respuesta.json() as Simulacion : null);
            }).catch(() => setPlan(null));
        }, 250);
        return () => { window.clearTimeout(temporizador); controlador.abort(); };
    }, [monto, plazoMeses, fechaOperacion]);

    useEffect(() => {
        void fetch("/api/health")
            .then(respuesta => {
                if (!respuesta.ok) {
                    throw new Error();
                }

                return respuesta.json() as Promise<{ estado: string }>;
            })
            .then(resultado => {
                setConexion(
                    resultado.estado === "conectado"
                        ? "conectado"
                        : "sin_conexion"
                );
            })
            .catch(() => setConexion("sin_conexion"));

        void actualizarPendientes();
        void sincronizarSolicitudes();
        const alConectar = () => { void sincronizarSolicitudes(); };
        const alDesconectar = () => setConexion("sin_conexion");
        window.addEventListener("online", alConectar);
        window.addEventListener("offline", alDesconectar);
        return () => {
            window.removeEventListener("online", alConectar);
            window.removeEventListener("offline", alDesconectar);
        };

    }, []);

    async function actualizarPendientes(): Promise<void> {
        try {
            const [clientesLocales, solicitudes, pagos] = await Promise.all([obtenerClientesPendientes(), obtenerSolicitudesPendientes(), obtenerPagosPendientes()]);
            setPendientes(clientesLocales.length + solicitudes.length + pagos.length);
            setClientesPendientes(clientesLocales);
            setSolicitudesPendientes(solicitudes);
            setPagosPendientes(pagos);
        } catch {
            setPendientes(0);
        }
    }

    async function sincronizarSolicitudes(): Promise<void> {
        setErrorSincronizacion("");
        try {
            const estado = await fetch("/api/health");
            if (!estado.ok) throw new Error("La API no está disponible");
            const clientesLocales = await obtenerClientesPendientes();
            let fallo = false;
            let detalleFallo = "";
            for (const cliente of clientesLocales) {
                const respuesta = await fetch("/api/clientes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        idCliente: cliente.id_cliente,
                        nombreCompleto: cliente.nombre_completo,
                        dpi: cliente.dpi,
                        telefono: cliente.telefono,
                        municipio: cliente.municipio,
                        fechaAlta: cliente.fecha_alta
                    })
                });
                if (!respuesta.ok) {
                    const datos = await respuesta.json() as { mensaje?: string };
                    detalleFallo = datos.mensaje ?? "No se pudo sincronizar un cliente";
                    fallo = true;
                    break;
                }
                await eliminarClientePendiente(cliente.id_cliente);
            }
            const lista = await obtenerSolicitudesPendientes();
            for (const solicitud of fallo ? [] : lista) {
                const respuesta = await fetch("/api/solicitudes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(solicitud)
                });
                if (!respuesta.ok) {
                    const datos = await respuesta.json() as { mensaje?: string };
                    detalleFallo = datos.mensaje ?? "No se pudo sincronizar una solicitud";
                    fallo = true;
                    break;
                }
                await eliminarSolicitudPendiente(solicitud.claveIdempotencia);
            }
            const pagos = await obtenerPagosPendientes();
            for (const pago of fallo ? [] : pagos) {
                const respuesta = await fetch(`/api/creditos/${encodeURIComponent(pago.idCredito)}/pagos`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(pago)
                });
                if (!respuesta.ok) {
                    const datos = await respuesta.json() as { mensaje?: string; monto_correcto_centavos?: string };
                    detalleFallo = datos.mensaje ?? "No se pudo sincronizar un pago";
                    if (datos.monto_correcto_centavos) detalleFallo += `. Monto correcto: ${mostrarQuetzales(datos.monto_correcto_centavos)}`;
                    fallo = true;
                    break;
                }
                await eliminarPagoPendiente(pago.claveIdempotencia);
            }
            await actualizarPendientes();
            setConexion("conectado");
            if (fallo) setErrorSincronizacion(`${detalleFallo}. Las operaciones pendientes siguen guardadas.`);
        } catch {
            setConexion("sin_conexion");
            setErrorSincronizacion("Sin conexión. Las operaciones siguen guardadas en este dispositivo.");
        }
    }

    async function buscarClientes(termino: string): Promise<void> {
        setError("");

        try {
            const parametros = new URLSearchParams({ buscar: termino });
            const respuesta = await fetch(
                "/api/clientes?" + parametros.toString()
            );

            if (!respuesta.ok) {
                throw new Error("No se pudo consultar la lista de clientes");
            }

            const encontrados = await respuesta.json() as Cliente[];
            setClientes(encontrados);
            void guardarClientes(encontrados).catch(() => {});
        } catch (problema) {
            try {
                const terminoNormalizado = termino.toLocaleLowerCase("es");
                const guardados = await obtenerClientes();
                setClientes(guardados.filter(cliente =>
                    [cliente.nombre_completo, cliente.dpi, cliente.telefono]
                        .some(valor => valor.toLocaleLowerCase("es").includes(terminoNormalizado))
                ));
            } catch {
                setClientes([]);
                setError(problema instanceof Error ? problema.message : "Ocurrió un error al buscar clientes");
            }
        }
    }

    function enviarBusqueda(evento: FormEvent<HTMLFormElement>): void {
        evento.preventDefault();
        void buscarClientes(busqueda);
    }

    function abrirBusqueda(paraPago = false): void {
        setPantalla("buscar");
        setBusquedaParaPago(paraPago);
        setClienteSeleccionado(null);
        setError("");
        setBusqueda("");
        void buscarClientes("");
    }

    async function verCreditos(): Promise<void> {
        if (!clienteSeleccionado) return;
        setError("");
        try {
            const respuesta = await fetch(`/api/clientes/${encodeURIComponent(clienteSeleccionado.id_cliente)}/creditos`);
            if (!respuesta.ok) throw new Error("No se pudieron consultar los créditos");
            const encontrados = await respuesta.json() as ResumenCredito[];
            setCreditos(encontrados);
            void guardarConsulta(`creditos:${clienteSeleccionado.id_cliente}`, encontrados).catch(() => {});
            setPantalla("creditos");
        } catch (problema) {
            const guardados = await obtenerConsulta<ResumenCredito[]>(`creditos:${clienteSeleccionado.id_cliente}`).catch(() => null);
            if (guardados) { setCreditos(guardados); setPantalla("creditos"); }
            else setError(problema instanceof Error ? problema.message : "No se pudieron consultar los créditos");
        }
    }

    async function cargarGestion(estado: string): Promise<void> {
        setError("");
        setEstadoGestion(estado);
        try {
            const [solicitudesRespuesta, asesoresRespuesta] = await Promise.all([
                fetch(`/api/solicitudes?estado=${encodeURIComponent(estado)}`),
                fetch("/api/asesores")
            ]);
            if (!solicitudesRespuesta.ok || !asesoresRespuesta.ok) throw new Error("No se pudo consultar la gestión");
            setSolicitudesGestion(await solicitudesRespuesta.json() as SolicitudGestion[]);
            setAsesores(await asesoresRespuesta.json() as Asesor[]);
            setPantalla("gerencia");
        } catch (problema) {
            setError(problema instanceof Error ? problema.message : "No se pudo consultar la gestión");
        }
    }

    async function aprobarSolicitud(id: string): Promise<void> {
        setError("");
        try {
            const respuesta = await fetch(`/api/solicitudes/${encodeURIComponent(id)}/aprobar`, { method: "POST" });
            const datos = await respuesta.json() as { mensaje?: string };
            if (!respuesta.ok) throw new Error(datos.mensaje ?? "No se pudo aprobar la solicitud");
            await cargarGestion("APROBADO");
        } catch (problema) {
            setError(problema instanceof Error ? problema.message : "No se pudo aprobar la solicitud");
        }
    }

    async function desembolsarSolicitud(id: string): Promise<void> {
        setError("");
        try {
            const respuesta = await fetch(`/api/solicitudes/${encodeURIComponent(id)}/desembolsar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idCredito: codigoCredito.trim(), idAsesor })
            });
            const datos = await respuesta.json() as { mensaje?: string };
            if (!respuesta.ok) throw new Error(datos.mensaje ?? "No se pudo desembolsar el crédito");
            setCodigoCredito("");
            await cargarGestion("DESEMBOLSADO");
        } catch (problema) {
            setError(problema instanceof Error ? problema.message : "No se pudo desembolsar el crédito");
        }
    }

    async function operarCierre(guardar: boolean): Promise<void> {
        setError("");
        try {
            const respuesta = await fetch(
                guardar ? "/api/gerencia/cierres" :
                    `/api/gerencia/cierres?tipo=${tipoCierre}&fecha=${encodeURIComponent(fechaGerencia)}`,
                guardar ? {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tipo: tipoCierre, fecha: fechaGerencia })
                } : undefined
            );
            const datos = await respuesta.json() as Cierre & { mensaje?: string };
            if (!respuesta.ok) throw new Error(datos.mensaje ?? "No se pudo consultar el cierre");
            setCierre(datos);
        } catch (problema) {
            setError(problema instanceof Error ? problema.message : "No se pudo consultar el cierre");
        }
    }

    async function verDetalle(idCredito: string, fecha = fechaDetalle, desdeGerencia = false): Promise<void> {
        setError("");
        try {
            const respuesta = await fetch(`/api/creditos/${encodeURIComponent(idCredito)}?fecha=${encodeURIComponent(fecha)}`);
            if (!respuesta.ok) throw new Error("No se pudo consultar el crédito");
            const detalle = await respuesta.json() as DetalleCredito;
            setDetalleCredito(detalle);
            void guardarConsulta(`detalle:${idCredito}:${fecha}`, detalle).catch(() => {});
            setFechaDetalle(fecha);
            setDetalleDesdeGerencia(desdeGerencia);
            setPantalla("detalle");
        } catch (problema) {
            const guardado = await obtenerConsulta<DetalleCredito>(`detalle:${idCredito}:${fecha}`).catch(() => null);
            if (guardado) { setDetalleCredito(guardado); setFechaDetalle(fecha); setDetalleDesdeGerencia(desdeGerencia); setPantalla("detalle"); }
            else {
                setFechaDetalle(detalleCredito?.fecha_corte ?? fechaDetalle);
                setError(problema instanceof Error ? problema.message : "No se pudo consultar el crédito");
            }
        }
    }

    async function verMora(): Promise<void> {
        if (!detalleCredito) return;
        setError("");
        try {
            const respuesta = await fetch(`/api/creditos/${encodeURIComponent(detalleCredito.id_credito)}/mora?fecha=${encodeURIComponent(fechaDetalle)}`);
            if (!respuesta.ok) throw new Error("No se pudo explicar la mora");
            setMoraDetalle(await respuesta.json() as MoraDetalle);
            setPantalla("mora");
        } catch (problema) {
            setError(problema instanceof Error ? problema.message : "No se pudo explicar la mora");
        }
    }

    async function enviarPreguntaChat(evento: FormEvent<HTMLFormElement>): Promise<void> {
        evento.preventDefault();
        const pregunta = preguntaChat.trim();
        if (!pregunta || consultandoChat) return;
        const conversacion = [...mensajesChat, { role: "user" as const, content: pregunta }];
        setMensajesChat(conversacion);
        setPreguntaChat("");
        setConsultandoChat(true);
        setError("");
        try {
            const respuesta = await fetch("/api/gerencia/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mensajes: conversacion.slice(-12) })
            });
            const datos = await respuesta.json() as { respuesta?: string; fuentes?: FuenteChat[]; mensaje?: string };
            if (!respuesta.ok) throw new Error(datos.mensaje ?? "No se pudo consultar al asistente");
            setMensajesChat([...conversacion, { role: "assistant", content: datos.respuesta ?? "" }]);
            setFuentesChat(datos.fuentes ?? []);
        } catch (problema) {
            setError(problema instanceof Error ? problema.message : "No se pudo consultar al asistente");
        } finally {
            setConsultandoChat(false);
        }
    }

    function volverAlInicio(): void {
        setPantalla("inicio");
        setClienteSeleccionado(null);
        setError("");
    }

    function continuarSolicitud(): void {
        setPantalla("solicitud");
        setError("");
        setMonto("10000");
        setPlazoMeses(12);
        setMotivo("");
    }

    async function confirmarSolicitud(evento: FormEvent<HTMLFormElement>): Promise<void> {
        evento.preventDefault();

        if (!clienteSeleccionado) {
            setError("Selecciona un cliente");
            return;
        }
        const centavosSolicitud = Dinero.desdeQuetzales(monto).obtenerCentavos();
        if (centavosSolicitud < 100000n || centavosSolicitud > 2500000n) {
            setError("El monto debe estar entre Q1,000.00 y Q25,000.00");
            return;
        }

        setGuardando(true);
        setError("");

        try {
            const solicitud: SolicitudPendiente = {
                claveIdempotencia: crypto.randomUUID(),
                clienteId: clienteSeleccionado.id_cliente,
                montoSolicitado: monto,
                plazoMeses,
                motivo,
                fechaOperacion
            };
            let respuesta: Response;
            try {
                respuesta = await fetch("/api/solicitudes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(solicitud)
                });
            } catch {
                await guardarSolicitudPendiente(solicitud);
                await actualizarPendientes();
                setSolicitudGuardada({
                    id_solicitud: solicitud.claveIdempotencia,
                    estado: "PENDIENTE",
                    monto_centavos: Dinero.desdeQuetzales(monto).obtenerCentavos().toString(),
                    plazo_meses: plazoMeses
                });
                setPantalla("confirmacion");
                return;
            }
            const datos = await respuesta.json() as SolicitudGuardada & { mensaje?: string };

            if (!respuesta.ok) {
                throw new Error(datos.mensaje ?? "No se pudo registrar la solicitud");
            }

            setSolicitudGuardada(datos);
            setPantalla("confirmacion");
        } catch (problema) {
            setError(problema instanceof Error
                ? problema.message
                : "No se pudo registrar la solicitud");
        } finally {
            setGuardando(false);
        }
    }

    async function registrarCliente(evento: FormEvent<HTMLFormElement>): Promise<void> {
        evento.preventDefault();
        const clienteLocal: AltaClientePendiente = {
            id_cliente: idNuevo.trim() || crypto.randomUUID(),
            nombre_completo: nombreNuevo.trim(),
            dpi: dpiNuevo.replace(/\s/g, ""),
            telefono: telefonoNuevo.trim(),
            municipio: municipioNuevo.trim(),
            fecha_alta: fechaAlta
        };
        if (clienteLocal.nombre_completo.length < 3 || !/^(\d{13}|DPI-FICT-\d{6})$/.test(clienteLocal.dpi) || (idNuevo.trim() !== "" && !/^CL-\d{4}$/.test(idNuevo.trim())) || clienteLocal.telefono.length < 8 || clienteLocal.municipio.length < 2) {
            setError("Revisa el nombre, DPI, teléfono y municipio");
            return;
        }
        setGuardando(true);
        setError("");

        try {
            let respuesta: Response;
            try {
                respuesta = await fetch("/api/clientes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    idCliente: clienteLocal.id_cliente,
                    nombreCompleto: nombreNuevo,
                    dpi: dpiNuevo,
                    telefono: telefonoNuevo,
                    municipio: municipioNuevo,
                    fechaAlta
                })
                });
            } catch {
                await guardarClientePendiente(clienteLocal);
                await actualizarPendientes();
                setClienteSeleccionado(clienteLocal);
                setClientes(actuales => [clienteLocal, ...actuales]);
                setPantalla("buscar");
                return;
            }
            const datos = await respuesta.json() as Cliente & { mensaje?: string };
            if (!respuesta.ok) {
                throw new Error(datos.mensaje ?? "No se pudo registrar el cliente");
            }

            setClienteSeleccionado(datos);
            setPantalla("buscar");
            setClientes(actuales => [datos, ...actuales]);
            void guardarClientes([datos]).catch(() => {});
        } catch (problema) {
            setError(problema instanceof Error ? problema.message : "No se pudo registrar el cliente");
        } finally {
            setGuardando(false);
        }
    }

    async function registrarPago(evento: FormEvent<HTMLFormElement>): Promise<void> {
        evento.preventDefault();
        if (!detalleCredito || !deudaActual?.cuota) return;
        if (!/^\d+(\.\d{1,2})?$/.test(montoPago)) {
            setError("Ingresa un monto con hasta dos decimales");
            return;
        }
        const centavosPago = Dinero.desdeQuetzales(montoPago).obtenerCentavos();
        if (centavosPago <= 0n || centavosPago > 250000000n) {
            setError("El monto del pago no es válido");
            return;
        }
        if (deudaActual.incobrable) {
            setError("El crédito es incobrable y no admite este pago");
            return;
        }
        setGuardando(true);
        setError("");
        try {
            const pago: PagoPendiente = {
                idCredito: detalleCredito.id_credito,
                monto: montoPago,
                canal: canalPago,
                claveIdempotencia: crypto.randomUUID(),
                fechaOperacion: fechaPago
            };
            let respuesta: Response;
            try {
                respuesta = await fetch(`/api/creditos/${encodeURIComponent(detalleCredito.id_credito)}/pagos`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(pago)
                });
            } catch {
                if (centavosPago !== BigInt(deudaActual.cuota.total_centavos)) {
                    setError(`El monto correcto es ${mostrarQuetzales(deudaActual.cuota.total_centavos)}`);
                    return;
                }
                const anteriores = await obtenerPagosPendientes();
                if (anteriores.some(actual => actual.idCredito === pago.idCredito && actual.fechaOperacion === pago.fechaOperacion)) {
                    setError("Ya existe un pago pendiente de sincronizar para este crédito y fecha");
                    return;
                }
                await guardarPagoPendiente(pago);
                setUltimoPago(pago);
                await actualizarPendientes();
                setPagoGuardado({
                    id: pago.claveIdempotencia,
                    fecha: fechaPago,
                    monto_centavos: centavosPago.toString(),
                    canal: canalPago,
                    aplicado: false,
                    pendiente: true
                });
                setPantalla("comprobante");
                return;
            }
            const datos = await respuesta.json() as PagoGuardado & { mensaje?: string };
            if (!respuesta.ok) {
                const correcto = (datos as { monto_correcto_centavos?: string }).monto_correcto_centavos;
                throw new Error(correcto ? `${datos.mensaje}. Monto correcto: ${mostrarQuetzales(correcto)}` : datos.mensaje ?? "No se pudo registrar el pago");
            }
            setPagoGuardado(datos);
            setUltimoPago(pago);
            setPantalla("comprobante");
        } catch (problema) {
            setError(problema instanceof Error ? problema.message : "No se pudo registrar el pago");
        } finally {
            setGuardando(false);
        }
    }

    async function reintentarPago(): Promise<void> {
        if (!ultimoPago) return;
        setGuardando(true);
        setError("");
        try {
            const respuesta = await fetch(`/api/creditos/${encodeURIComponent(ultimoPago.idCredito)}/pagos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ultimoPago)
            });
            const datos = await respuesta.json() as PagoGuardado & { mensaje?: string };
            if (!respuesta.ok) throw new Error(datos.mensaje ?? "No se pudo verificar el pago");
            setPagoGuardado(datos);
        } catch (problema) {
            setError(problema instanceof Error ? problema.message : "No se pudo verificar el pago");
        } finally {
            setGuardando(false);
        }
    }

    const indicadorConexion = (
        <div className="sync-status">
            <span>Estado de conexión</span>
            <strong
                className={
                    conexion === "conectado"
                        ? "connection-pill connected"
                        : "connection-pill disconnected"
                }
            >
                {conexion === "cargando"
                    ? "Verificando…"
                    : conexion === "conectado"
                      ? "Conectado"
                      : "Sin conexión"}
            </strong>
        </div>
    );

    if (pantalla === "buscar") {
        return (
            <main className="app-shell">
                <div className="mobile-screen">
                    <header className="top-bar">
                        <button
                            className="icon-button"
                            type="button"
                            aria-label="Volver al inicio"
                            onClick={volverAlInicio}
                        >
                            ←
                        </button>
                    </header>

                    <section className="page-content search-content">
                        <h1>Buscar cliente</h1>
                        <p className="page-subtitle">
                            Nombre, DPI, teléfono o código de crédito
                        </p>
                        <div
                            className="progress-track"
                            aria-label="Paso 1 de 3"
                        >
                            <span className="progress-value progress-value-search" />
                        </div>

                        <form
                            className="search-form"
                            onSubmit={enviarBusqueda}
                        >
                            <label className="sr-only" htmlFor="busqueda-cliente">
                                Buscar cliente
                            </label>
                            <input
                                id="busqueda-cliente"
                                type="search"
                                value={busqueda}
                                onChange={evento =>
                                    setBusqueda(evento.target.value)
                                }
                                placeholder="Nombre, DPI, teléfono o crédito"
                                autoComplete="off"
                            />
                            <button className="primary-button" type="submit">
                                Buscar
                            </button>
                        </form>

                        {error && (
                            <div className="inline-error" role="alert">
                                {error}
                            </div>
                        )}

                        {clienteSeleccionado ? (
                            <section
                                className="selected-client"
                                aria-live="polite"
                            >
                                <div className="client-avatar">
                                    {clienteSeleccionado.nombre_completo
                                        .charAt(0)
                                        .toLocaleUpperCase("es")}
                                </div>
                                <div>
                                    <h2>
                                        {clienteSeleccionado.nombre_completo}
                                    </h2>
                                    <p>
                                        DPI {clienteSeleccionado.dpi} ·{" "}
                                        {clienteSeleccionado.telefono}
                                    </p>
                                    <p>{clienteSeleccionado.municipio}</p>
                                </div>
                                <button
                                    type="button"
                                    className="text-button"
                                    onClick={() =>
                                        setClienteSeleccionado(null)
                                    }
                                >
                                    Cambiar cliente
                                </button>
                                <button
                                    type="button"
                                    className="primary-button continue-button"
                                    onClick={busquedaParaPago ? () => void verCreditos() : continuarSolicitud}
                                >
                                    {busquedaParaPago ? "Ver créditos" : "Continuar con solicitud"}
                                </button>
                                {!busquedaParaPago && <button className="text-button" type="button" onClick={() => void verCreditos()}>Ver créditos del cliente</button>}
                            </section>
                        ) : (
                            <div className="client-list">
                                {clientes.map(cliente => (
                                    <button
                                        className="client-row"
                                        key={cliente.id_cliente}
                                        type="button"
                                        onClick={() =>
                                            setClienteSeleccionado(cliente)
                                        }
                                    >
                                        <span className="client-avatar">
                                            {cliente.nombre_completo
                                                .charAt(0)
                                                .toLocaleUpperCase("es")}
                                        </span>
                                        <span className="client-row-card">
                                            <strong>
                                                {cliente.nombre_completo}
                                            </strong>
                                            <small>
                                                DPI {cliente.dpi} ·{" "}
                                                {cliente.telefono}
                                            </small>
                                        </span>
                                    </button>
                                ))}

                                {!error && clientes.length === 0 && (
                                    <p className="empty-state">
                                        No se encontraron clientes.
                                    </p>
                                )}
                            </div>
                        )}

                        <button
                            type="button"
                            className="text-button register-client-link"
                            onClick={() => { setError(""); setPantalla("registrar"); }}
                        >
                            ¿No aparece? Registrar cliente nuevo →
                        </button>
                    </section>
                </div>
            </main>
        );
    }

    if (pantalla === "registrar") {
        return (
            <main className="app-shell">
                <div className="mobile-screen">
                    <header className="top-bar">
                        <button className="icon-button" type="button" aria-label="Volver a buscar cliente" onClick={() => { setError(""); setPantalla("buscar"); }}>←</button>
                    </header>
                    <section className="page-content flow-content">
                        <p className="page-kicker">ORIGINACIÓN</p>
                        <h1>Registrar cliente</h1>
                        <p className="page-subtitle">Datos para identificar y contactar al cliente.</p>
                        <form className="credit-form" onSubmit={registrarCliente}>
                            <label htmlFor="id-nuevo">Código de cliente (opcional)</label>
                            <input id="id-nuevo" value={idNuevo} onChange={evento => setIdNuevo(evento.target.value)} placeholder="Se genera automáticamente" maxLength={7} />
                            <label htmlFor="nombre-nuevo">Nombre completo</label>
                            <input id="nombre-nuevo" value={nombreNuevo} onChange={evento => setNombreNuevo(evento.target.value)} minLength={3} maxLength={150} autoComplete="name" required />
                            <label htmlFor="dpi-nuevo">DPI</label>
                            <input id="dpi-nuevo" value={dpiNuevo} onChange={evento => setDpiNuevo(evento.target.value)} placeholder="13 dígitos o DPI ficticio" required />
                            <label htmlFor="telefono-nuevo">Teléfono</label>
                            <input id="telefono-nuevo" value={telefonoNuevo} onChange={evento => setTelefonoNuevo(evento.target.value)} type="tel" minLength={8} maxLength={30} autoComplete="tel" required />
                            <label htmlFor="municipio-nuevo">Municipio</label>
                            <input id="municipio-nuevo" value={municipioNuevo} onChange={evento => setMunicipioNuevo(evento.target.value)} minLength={2} maxLength={100} required />
                            <label htmlFor="fecha-alta">Fecha de alta</label>
                            <input id="fecha-alta" type="date" value={fechaAlta} onChange={evento => setFechaAlta(evento.target.value)} required />
                            {error && <div className="inline-error" role="alert">{error}</div>}
                            <button className="primary-button" type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Registrar cliente"}</button>
                        </form>
                    </section>
                </div>
            </main>
        );
    }

    if (pantalla === "creditos" && clienteSeleccionado) {
        return (
            <main className="app-shell"><div className="mobile-screen">
                <header className="top-bar"><button className="icon-button" type="button" aria-label="Volver al cliente" onClick={() => setPantalla("buscar")}>←</button></header>
                <section className="page-content flow-content">
                    <h1>Créditos del cliente</h1>
                    <p className="page-subtitle">{clienteSeleccionado.nombre_completo}</p>
                    {creditos.length === 0 && <p className="empty-state">Este cliente aún no tiene créditos desembolsados.</p>}
                    <div className="client-list">
                        {creditos.map(credito => <button className="credit-row" key={credito.id_credito} type="button" onClick={() => void verDetalle(credito.id_credito)}>
                            <strong>{credito.id_credito}</strong>
                            <span>{mostrarQuetzales(credito.capital_centavos)} · {credito.plazo_meses} meses</span>
                            <small>Otorgado el {credito.fecha_otorgamiento}</small>
                        </button>)}
                    </div>
                    {error && <div className="inline-error" role="alert">{error}</div>}
                </section>
            </div></main>
        );
    }

    if (pantalla === "plan") {
        const filas = planDesde === "solicitud"
            ? (plan?.cuotas ?? []).map(cuota => ({
                numero: cuota.numero, fecha: cuota.fecha_vencimiento,
                interes: `Q${cuota.interes}`, capital: `Q${cuota.capital}`,
                total: `Q${cuota.cuota}`, saldo: `Q${cuota.saldo_final}`
            }))
            : (detalleCredito?.cuotas ?? []).map(cuota => ({
                numero: cuota.numero_cuota, fecha: cuota.fecha_vencimiento,
                interes: mostrarQuetzales(cuota.interes_centavos),
                capital: mostrarQuetzales(cuota.capital_centavos),
                total: mostrarQuetzales(cuota.monto_cuota_centavos),
                saldo: mostrarQuetzales(cuota.saldo_final_centavos)
            }));
        return <main className="app-shell"><div className="mobile-screen">
            <header className="top-bar"><button className="icon-button" type="button" aria-label="Volver" onClick={() => setPantalla(planDesde)}>←</button></header>
            <section className="page-content flow-content">
                <p className="page-kicker">{planDesde === "solicitud" ? "SIMULACIÓN" : detalleCredito?.id_credito}</p>
                <h1>Plan de amortización</h1>
                <section className="simulation-card">
                    <div><span>Capital</span><b>{planDesde === "solicitud" ? `Q${monto}` : mostrarQuetzales(detalleCredito?.capital_centavos ?? "0")}</b></div>
                    <div><span>Plazo</span><b>{planDesde === "solicitud" ? plazoMeses : detalleCredito?.plazo_meses} meses</b></div>
                    <div><span>TNA</span><b>{planDesde === "solicitud" ? "36" : ((detalleCredito?.tna_bps ?? 0) / 100).toFixed(2)} %</b></div>
                </section>
                <div className="plan-scroll" role="region" aria-label="Plan de amortización" tabIndex={0}>
                    <table className="plan-table">
                        <thead><tr><th>Cuota</th><th>Vence</th><th>Interés</th><th>Capital</th><th>Total</th><th>Saldo</th></tr></thead>
                        <tbody>{filas.map(fila => <tr key={fila.numero}>
                            <td>{fila.numero}</td><td>{fila.fecha}</td><td>{fila.interes}</td><td>{fila.capital}</td><td>{fila.total}</td><td>{fila.saldo}</td>
                        </tr>)}</tbody>
                    </table>
                </div>
                <button className="primary-button" type="button" onClick={() => setPantalla(planDesde)}>Continuar</button>
            </section>
        </div></main>;
    }

    if (pantalla === "detalle" && detalleCredito) {
        return (
            <main className="app-shell"><div className="mobile-screen">
                <header className="top-bar"><button className="icon-button" type="button" aria-label="Volver" onClick={() => setPantalla(detalleDesdeGerencia ? "gerencia" : "creditos")}>←</button></header>
                <section className="page-content flow-content">
                    <h1>Detalle del crédito</h1>
                    <p className="page-subtitle">{detalleCredito.id_credito}</p>
                    <label className="date-label" htmlFor="fecha-detalle">Fecha de corte</label>
                    <input className="date-input" id="fecha-detalle" type="date" value={fechaDetalle} onChange={evento => { setFechaDetalle(evento.target.value); void verDetalle(detalleCredito.id_credito, evento.target.value, detalleDesdeGerencia); }} />
                    <section className="simulation-card">
                        <strong>{detalleCredito.estado} · {detalleCredito.tramo}</strong>
                        <div><span>Saldo de capital</span><b>{mostrarQuetzales(detalleCredito.saldo_capital_centavos)}</b></div>
                        <div><span>Días de atraso</span><b>{detalleCredito.dias_atraso}</b></div>
                        <div><span>Cuotas pagadas</span><b>{detalleCredito.cuotas_pagadas}</b></div>
                        <div><span>Cuotas vencidas</span><b>{detalleCredito.cuotas_vencidas}</b></div>
                        {detalleCredito.proxima_cuota && <div><span>Próxima cuota · {detalleCredito.proxima_cuota.vencimiento}</span><b>{mostrarQuetzales(detalleCredito.proxima_cuota.monto_centavos)}</b></div>}
                    </section>
                    {detalleCredito.dias_atraso > 0 && <button className="text-button" type="button" onClick={() => void verMora()}>Ver detalle de mora</button>}
                    <section className="simulation-card">
                        <strong>Condiciones originales</strong>
                        <div><span>Capital</span><b>{mostrarQuetzales(detalleCredito.capital_centavos)}</b></div>
                        <div><span>Plazo</span><b>{detalleCredito.plazo_meses} meses</b></div>
                        <div><span>TNA</span><b>{(detalleCredito.tna_bps / 100).toFixed(2)} %</b></div>
                    </section>
                    <button className="text-button" type="button" onClick={() => { setPlanDesde("detalle"); setPantalla("plan"); }}>Ver plan de amortización</button>
                    <h2 className="section-title">Pagos registrados</h2>
                    {detalleCredito.pagos.length === 0 && <p className="empty-state">No hay pagos registrados.</p>}
                    <div className="data-list">{detalleCredito.pagos.map(pago => <div key={pago.id} className="data-row"><strong>{pago.fecha}</strong><span>{pago.canal} · {pago.aplicado ? "Aplicado" : "Pendiente de aplicación"}</span><b>{mostrarQuetzales(pago.monto_centavos)}</b></div>)}</div>
                    <button className="primary-button" type="button" onClick={() => { setMontoPago(""); setFechaPago(fechaDetalle); setError(""); setPantalla("pago"); }}>Registrar pago</button>
                </section>
            </div></main>
        );
    }

    if (pantalla === "mora" && moraDetalle && detalleCredito) {
        return (
            <main className="app-shell"><div className="mobile-screen">
                <header className="top-bar"><button className="icon-button" type="button" aria-label="Volver al crédito" onClick={() => setPantalla("detalle")}>←</button></header>
                <section className="page-content flow-content">
                    <h1>Detalle de mora</h1>
                    <p className="page-subtitle">Crédito {detalleCredito.id_credito} · cuota {moraDetalle.cuota}</p>
                    <section className="simulation-card">
                        <strong>{moraDetalle.dias_atraso} días de atraso</strong>
                        <div><span>Capital de la cuota en mora</span><b>{mostrarQuetzales(moraDetalle.capital_en_mora_centavos)}</b></div>
                        <div><span>Interés moratorio pendiente</span><b>{mostrarQuetzales(moraDetalle.mora_pendiente_centavos)}</b></div>
                        <p>Política aplicada: {moraDetalle.politica}. La mora se calcula solo sobre el capital pendiente.</p>
                    </section>
                    <h2 className="section-title">Días y tasas recorridos</h2>
                    <div className="data-list">{moraDetalle.tramos.map(tramo => <div className="data-row" key={tramo.desde}>
                        <strong>Días {tramo.desde}–{tramo.hasta}</strong>
                        <span>{tramo.dias} días al {(tramo.tasa_bps / 100).toFixed(2)} % anual</span>
                        <b>Q{tramo.importe_quetzales_sin_redondear}</b>
                    </div>)}</div>
                    <p className="page-subtitle">Los importes de cada tramo se redondean juntos al final.</p>
                    <button className="primary-button" type="button" onClick={() => setPantalla("pago")}>Registrar pago</button>
                </section>
            </div></main>
        );
    }

    if (pantalla === "pago" && detalleCredito) {
        return (
            <main className="app-shell"><div className="mobile-screen">
                <header className="top-bar"><button className="icon-button" type="button" aria-label="Volver al crédito" onClick={() => setPantalla("detalle")}>←</button></header>
                <section className="page-content flow-content">
                    <h1>Registrar pago</h1>
                    <p className="page-subtitle">Crédito {detalleCredito.id_credito}</p>
                    <form className="credit-form" onSubmit={registrarPago}>
                        <label htmlFor="fecha-pago">Fecha de operación</label>
                        <input id="fecha-pago" type="date" value={fechaPago} onChange={evento => setFechaPago(evento.target.value)} required />
                        {deudaActual?.cuota && <section className="simulation-card">
                            <strong>Cuota {deudaActual.cuota.numero} · {deudaActual.dias_atraso} días de atraso</strong>
                            <div><span>Gastos</span><b>{mostrarQuetzales(deudaActual.cuota.gastos_centavos)}</b></div>
                            <div><span>Interés moratorio</span><b>{mostrarQuetzales(deudaActual.cuota.moratorio_centavos)}</b></div>
                            <div><span>Interés corriente</span><b>{mostrarQuetzales(deudaActual.cuota.corriente_centavos)}</b></div>
                            <div><span>Capital</span><b>{mostrarQuetzales(deudaActual.cuota.capital_centavos)}</b></div>
                            <div><span>Total exacto</span><b>{mostrarQuetzales(deudaActual.cuota.total_centavos)}</b></div>
                        </section>}
                        {deudaActual?.incobrable && <div className="inline-error" role="alert">Este crédito es incobrable.</div>}
                        <label htmlFor="monto-pago">Monto recibido</label>
                        <div className="amount-input"><span>Q</span><input id="monto-pago" type="number" min="0.01" step="0.01" value={montoPago} onChange={evento => setMontoPago(evento.target.value)} required /></div>
                        <label htmlFor="canal-pago">Método de pago</label>
                        <select id="canal-pago" value={canalPago} onChange={evento => setCanalPago(evento.target.value)}><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option></select>
                        <p className="page-subtitle">El saldo se actualizará cuando se aplique el pago a los conceptos del crédito.</p>
                        {error && <div className="inline-error" role="alert">{error}</div>}
                        <button className="primary-button" type="submit" disabled={guardando || !deudaActual?.cuota || deudaActual.incobrable}>{guardando ? "Guardando…" : "Confirmar pago"}</button>
                    </form>
                </section>
            </div></main>
        );
    }

    if (pantalla === "comprobante" && pagoGuardado) {
        return (
            <main className="app-shell"><div className="mobile-screen">
                <section className="page-content confirmation-content">
                    <div className="confirmation-mark" aria-hidden="true">✓</div>
                    <h1>{pagoGuardado.pendiente ? "Pago guardado en el dispositivo" : "Pago registrado"}</h1>
                    <p className="page-subtitle">{pagoGuardado.pendiente ? "Se enviará al recuperar conexión. Conserva este código como constancia provisional." : `Recibido y aplicado el ${pagoGuardado.fecha}.`}</p>
                    {pagoGuardado.duplicado && <div className="inline-error" role="status">Clave repetida: el pago ya estaba registrado y no se duplicó.</div>}
                    <section className="confirmation-card">
                        <span>Monto</span><strong>{mostrarQuetzales(pagoGuardado.monto_centavos)}</strong>
                        <span>Método</span><strong>{pagoGuardado.canal}</strong>
                        <span>Comprobante</span><strong>{pagoGuardado.id}</strong>
                        {pagoGuardado.aplicacion && <>
                            <span>Gastos</span><strong>{mostrarQuetzales(pagoGuardado.aplicacion.gastos_centavos)}</strong>
                            <span>Moratorio</span><strong>{mostrarQuetzales(pagoGuardado.aplicacion.moratorio_centavos)}</strong>
                            <span>Interés</span><strong>{mostrarQuetzales(pagoGuardado.aplicacion.corriente_centavos)}</strong>
                            <span>Capital</span><strong>{mostrarQuetzales(pagoGuardado.aplicacion.capital_centavos)}</strong>
                        </>}
                    </section>
                    {error && <div className="inline-error" role="alert">{error}</div>}
                    {ultimoPago && !pagoGuardado.pendiente && <button className="text-button" type="button" onClick={() => void reintentarPago()} disabled={guardando}>Reintentar el mismo pago</button>}
                    <button className="primary-button" type="button" onClick={volverAlInicio}>Volver al inicio</button>
                </section>
            </div></main>
        );
    }

    if (pantalla === "sincronizacion") {
        return (
            <main className="app-shell"><div className="mobile-screen">
                <header className="top-bar"><button className="icon-button" type="button" aria-label="Volver al inicio" onClick={volverAlInicio}>←</button></header>
                <section className="page-content flow-content">
                    <h1>Operaciones pendientes</h1>
                    <p className="page-subtitle">Se guardan en este dispositivo hasta enviarse.</p>
                    {pendientes === 0 && <p className="empty-state">No hay operaciones pendientes.</p>}
                    <div className="data-list">
                        {clientesPendientes.map(cliente => <div className="data-row" key={cliente.id_cliente}><strong>Registro de cliente</strong><span>{cliente.nombre_completo}</span><b>{cliente.dpi}</b></div>)}
                        {solicitudesPendientes.map(solicitud => <div className="data-row" key={solicitud.claveIdempotencia}><strong>Nueva solicitud</strong><span>Cliente {solicitud.clienteId}</span><b>Q{solicitud.montoSolicitado}</b></div>)}
                        {pagosPendientes.map(pago => <div className="data-row" key={pago.claveIdempotencia}><strong>Pago de crédito</strong><span>{pago.idCredito}</span><b>Q{pago.monto}</b></div>)}
                    </div>
                    {errorSincronizacion && <div className="inline-error" role="alert">{errorSincronizacion}</div>}
                    {pendientes > 0 && <button className="primary-button" type="button" onClick={() => void sincronizarSolicitudes()}>Sincronizar ahora</button>}
                </section>
            </div></main>
        );
    }

    if (pantalla === "cierre") {
        return <main className="app-shell"><div className="mobile-screen">
            <header className="top-bar"><button className="icon-button" type="button" aria-label="Volver al tablero" onClick={() => setPantalla("gerencia")}>←</button></header>
            <section className="page-content manager-content">
                <p className="page-kicker">COMITÉ GERENCIAL</p>
                <h1>Cierre diario y mensual</h1>
                <label className="date-label" htmlFor="fecha-cierre">Fecha de corte</label>
                <input className="date-input" id="fecha-cierre" type="date" value={fechaGerencia} onChange={evento => { setFechaGerencia(evento.target.value); setCierre(null); }} />
                <div className="manager-tabs">
                    <button type="button" className={tipoCierre === "DIARIO" ? "tab-active" : ""} onClick={() => { setTipoCierre("DIARIO"); setCierre(null); }}>Diario</button>
                    <button type="button" className={tipoCierre === "MENSUAL" ? "tab-active" : ""} onClick={() => { setTipoCierre("MENSUAL"); setCierre(null); }}>Mensual</button>
                </div>
                <div className="manager-actions">
                    <button className="primary-button" type="button" onClick={() => void operarCierre(true)}>Ejecutar cierre</button>
                    <button className="text-button" type="button" onClick={() => void operarCierre(false)}>Consultar guardado</button>
                </div>
                {cierre && <section className="simulation-card">
                    <strong>{cierre.resumen.tipo} · {cierre.resumen.fecha_inicio} al {cierre.resumen.fecha_corte}</strong>
                    <div><span>Desembolsos</span><b>{mostrarQuetzales(cierre.resumen.desembolsos_centavos)}</b></div>
                    <div><span>Recuperaciones</span><b>{mostrarQuetzales(cierre.resumen.recuperaciones_centavos)}</b></div>
                    <div><span>Gastos</span><b>{mostrarQuetzales(cierre.resumen.conceptos.gastos_centavos)}</b></div>
                    <div><span>Interés moratorio</span><b>{mostrarQuetzales(cierre.resumen.conceptos.moratorio_centavos)}</b></div>
                    <div><span>Interés corriente</span><b>{mostrarQuetzales(cierre.resumen.conceptos.corriente_centavos)}</b></div>
                    <div><span>Capital recuperado</span><b>{mostrarQuetzales(cierre.resumen.conceptos.capital_centavos)}</b></div>
                    <div><span>Excedente</span><b>{mostrarQuetzales(cierre.resumen.conceptos.excedente_centavos)}</b></div>
                    <div><span>Cartera activa</span><b>{mostrarQuetzales(cierre.resumen.cartera_activa_centavos)}</b></div>
                    <div><span>Cartera en riesgo</span><b>{mostrarQuetzales(cierre.resumen.cartera_riesgo_centavos)}</b></div>
                    <div><span>Incobrable del mes</span><b>{mostrarQuetzales(cierre.resumen.incobrable_mes_centavos)}</b></div>
                </section>}
                {error && <div className="inline-error" role="alert">{error}</div>}
            </section>
        </div></main>;
    }

    if (pantalla === "chat") {
        return (
            <main className="app-shell"><div className="mobile-screen">
                <header className="top-bar"><button className="icon-button" type="button" aria-label="Volver al tablero" onClick={() => setPantalla("gerencia")}>←</button></header>
                <section className="page-content chat-content">
                    <p className="page-kicker">COMITÉ GERENCIAL</p>
                    <h1>Asistente de políticas</h1>
                    <p className="page-subtitle">Responde con base en los documentos cargados y muestra sus fuentes.</p>
                    <div className="chat-messages" aria-live="polite">
                        {mensajesChat.length === 0 && <p className="empty-state">Pregunta sobre políticas de mora, cobros o procedimientos.</p>}
                        {mensajesChat.map((mensaje, indice) => <article className={`chat-message chat-${mensaje.role}`} key={`${indice}-${mensaje.role}`}>
                            <strong>{mensaje.role === "user" ? "Tú" : "Asistente"}</strong>
                            <p>{mensaje.content}</p>
                            {mensaje.role === "assistant" && indice === mensajesChat.length - 1 && fuentesChat.length > 0 && <div className="chat-sources"><strong>Fuentes</strong>{fuentesChat.map(fuente => <span key={fuente.doc_id}>{fuente.doc_id} · {fuente.titulo}</span>)}</div>}
                        </article>)}
                        {consultandoChat && <p className="empty-state" role="status">Consultando Ollama. La primera respuesta puede tardar unos minutos…</p>}
                    </div>
                    {error && <div className="inline-error" role="alert">{error}</div>}
                    <form className="chat-form" onSubmit={evento => void enviarPreguntaChat(evento)}>
                        <label htmlFor="pregunta-chat">Tu pregunta</label>
                        <textarea id="pregunta-chat" rows={3} maxLength={2000} value={preguntaChat} onChange={evento => setPreguntaChat(evento.target.value)} placeholder="¿Cómo se calcula el interés moratorio?" required />
                        <button className="primary-button" type="submit" disabled={consultandoChat || !preguntaChat.trim()}>{consultandoChat ? "Consultando…" : "Enviar pregunta"}</button>
                    </form>
                </section>
            </div></main>
        );
    }

    if (pantalla === "gerencia") {
        return (
            <main className="app-shell"><div className="mobile-screen">
                <header className="top-bar"><button className="icon-button" type="button" aria-label="Volver al inicio" onClick={volverAlInicio}>←</button></header>
                <section className="page-content manager-content">
                    <p className="page-kicker">COMITÉ GERENCIAL</p>
                    <h1>Tablero general</h1>
                    <label className="date-label" htmlFor="fecha-gerencia">Fecha de corte</label>
                    <input className="date-input" id="fecha-gerencia" type="date" value={fechaGerencia} onChange={evento => setFechaGerencia(evento.target.value)} />
                    {carteraGerencial && <>
                        <div className="dashboard-grid">
                            <div className="dashboard-card"><span>Cartera activa</span><strong>{mostrarQuetzales(carteraGerencial.cartera_activa_centavos)}</strong></div>
                            <div className="dashboard-card"><span>Cartera en mora</span><strong>{mostrarQuetzales(carteraGerencial.cartera_mora_centavos)}</strong></div>
                            <div className="dashboard-card"><span>Cartera en riesgo</span><strong>{mostrarQuetzales(carteraGerencial.cartera_riesgo_centavos)}</strong><small>{carteraGerencial.porcentaje_riesgo} % de cartera activa</small></div>
                            <div className="dashboard-card"><span>Incobrable del mes</span><strong>{mostrarQuetzales(carteraGerencial.incobrable_mes_centavos)}</strong></div>
                        </div>
                        <h2 className="section-title">Riesgo por tramo</h2>
                        <div className="manager-tabs">
                            {carteraGerencial.tramos.filter(tramo => tramo.saldo_centavos !== "0").map(tramo => <button key={tramo.tramo} type="button" className={tramoSeleccionado === tramo.tramo ? "tab-active" : ""} onClick={() => setTramoSeleccionado(tramo.tramo)}>{tramo.tramo} · {tramo.porcentaje} %</button>)}
                        </div>
                        {tramoSeleccionado && <div className="manager-list">{carteraGerencial.morosos.filter(credito => credito.tramo === tramoSeleccionado).map(credito => <button className="credit-row" key={credito.id_credito} type="button" onClick={() => void verDetalle(credito.id_credito, fechaGerencia, true)}><strong>{credito.id_credito}</strong><span>{credito.dias_atraso} días de atraso · {mostrarQuetzales(credito.saldo_centavos)}</span></button>)}</div>}
                    </>}
                    <button className="primary-button" type="button" onClick={() => { setError(""); setPantalla("cierre"); }}>Ver cierre diario y mensual</button>
                    <button className="action-card" type="button" onClick={() => { setError(""); setPantalla("chat"); }}><strong>Chat con IA</strong><span>Consultar políticas y documentos</span></button>
                    <h2 className="section-title">Gestión de solicitudes</h2>
                    <div className="manager-tabs">
                        {(["SOLICITADO", "APROBADO", "DESEMBOLSADO"] as const).map(estado => <button key={estado} type="button" className={estadoGestion === estado ? "tab-active" : ""} onClick={() => void cargarGestion(estado)}>{estado === "SOLICITADO" ? "Pendientes" : estado === "APROBADO" ? "Aprobadas" : "Desembolsadas"}</button>)}
                    </div>
                    {error && <div className="inline-error" role="alert">{error}</div>}
                    {solicitudesGestion.length === 0 && <p className="empty-state">No hay solicitudes en este estado.</p>}
                    <div className="manager-list">
                        {solicitudesGestion.map(solicitud => <section className="manager-card" key={solicitud.id_solicitud}>
                            <strong>{solicitud.nombre_completo}</strong>
                            <span>{mostrarQuetzales(solicitud.monto_centavos)} · {solicitud.plazo_meses} meses · {solicitud.fecha_operacion}</span>
                            <small>{solicitud.id_solicitud}</small>
                            {estadoGestion === "SOLICITADO" && <button className="primary-button" type="button" onClick={() => void aprobarSolicitud(solicitud.id_solicitud)}>Aprobar solicitud</button>}
                            {estadoGestion === "APROBADO" && <form className="credit-form" onSubmit={evento => { evento.preventDefault(); void desembolsarSolicitud(solicitud.id_solicitud); }}>
                                <label htmlFor={`codigo-${solicitud.id_solicitud}`}>Código de crédito</label>
                                <input id={`codigo-${solicitud.id_solicitud}`} value={codigoCredito} onChange={evento => setCodigoCredito(evento.target.value)} placeholder="CV-2026-9001" pattern="CV-[0-9]{4}-[0-9]{4}" required />
                                <label htmlFor={`asesor-${solicitud.id_solicitud}`}>Asesor</label>
                                <select id={`asesor-${solicitud.id_solicitud}`} value={idAsesor} onChange={evento => setIdAsesor(evento.target.value)}>{asesores.map(asesor => <option key={asesor.id_asesor} value={asesor.id_asesor}>{asesor.id_asesor} · {asesor.nombre_completo}</option>)}</select>
                                <button className="primary-button" type="submit">Desembolsar crédito</button>
                            </form>}
                            {solicitud.id_credito && <b>Crédito {solicitud.id_credito}</b>}
                        </section>)}
                    </div>
                </section>
            </div></main>
        );
    }

    if (pantalla === "solicitud" && clienteSeleccionado) {
        const cuotas = plan?.cuotas ?? [];
        const cuotaRegular = cuotas[0];
        const cuotaFinal = cuotas[cuotas.length - 1];

        return (
            <main className="app-shell">
                <div className="mobile-screen">
                    <header className="top-bar">
                        <button className="icon-button" type="button" aria-label="Volver a buscar cliente" onClick={() => setPantalla("buscar")}>
                            ←
                        </button>
                    </header>
                    <section className="page-content flow-content">
                        <p className="page-kicker">ORIGINACIÓN · PASO 2 DE 3</p>
                        <h1>Nueva solicitud</h1>
                        <div className="selected-client compact-client">
                            <span className="client-avatar">{clienteSeleccionado.nombre_completo.charAt(0)}</span>
                            <div>
                                <h2>{clienteSeleccionado.nombre_completo}</h2>
                                <p>DPI {clienteSeleccionado.dpi}</p>
                            </div>
                        </div>

                        <form className="credit-form" onSubmit={confirmarSolicitud}>
                            <label htmlFor="monto-solicitado">Monto solicitado</label>
                            <div className="amount-input">
                                <span>Q</span>
                                <input
                                    id="monto-solicitado"
                                    type="number"
                                    min="1000"
                                    max="25000"
                                    step="0.01"
                                    value={monto}
                                    onChange={evento => setMonto(evento.target.value)}
                                    required
                                />
                            </div>

                            <label htmlFor="plazo-meses">Plazo</label>
                            <select id="plazo-meses" value={plazoMeses} onChange={evento => setPlazoMeses(Number(evento.target.value))}>
                                {Array.from({ length: 22 }, (_, indice) => indice + 3).map(plazo => (
                                    <option key={plazo} value={plazo}>{plazo} meses</option>
                                ))}
                            </select>

                            <label htmlFor="fecha-operacion">Fecha de operación</label>
                            <input id="fecha-operacion" type="date" value={fechaOperacion} onChange={evento => setFechaOperacion(evento.target.value)} required />

                            <label htmlFor="motivo-solicitud">Motivo</label>
                            <textarea
                                id="motivo-solicitud"
                                value={motivo}
                                onChange={evento => setMotivo(evento.target.value)}
                                minLength={3}
                                maxLength={500}
                                placeholder="¿Para qué utilizará el crédito?"
                                required
                            />

                            <section className="simulation-card" aria-live="polite">
                                <strong>Simulación · TNA 36%</strong>
                                {cuotaRegular && cuotaFinal ? (
                                    <>
                                        <div><span>Cuota mensual</span><b>Q{cuotaRegular.cuota}</b></div>
                                        <div><span>Última cuota</span><b>Q{cuotaFinal.cuota}</b></div>
                                    </>
                                ) : <p>{conexion === "sin_conexion" ? "Sin conexión: puedes guardar la solicitud; el plan estará disponible al reconectar." : "Ingresa un monto válido para ver la simulación."}</p>}
                            </section>

                            {cuotas.length > 0 && <button className="text-button" type="button" onClick={() => { setPlanDesde("solicitud"); setPantalla("plan"); }}>Ver plan de amortización</button>}

                            {error && <div className="inline-error" role="alert">{error}</div>}
                            <button className="primary-button" type="submit" disabled={guardando}>
                                {guardando ? "Guardando…" : "Confirmar solicitud"}
                            </button>
                        </form>
                    </section>
                </div>
            </main>
        );
    }

    if (pantalla === "confirmacion" && clienteSeleccionado && solicitudGuardada) {
        return (
            <main className="app-shell">
                <div className="mobile-screen">
                    <section className="page-content confirmation-content">
                        <div className="confirmation-mark" aria-hidden="true">✓</div>
                        <p className="page-kicker">{solicitudGuardada.estado === "PENDIENTE" ? "GUARDADA EN EL DISPOSITIVO" : "SOLICITUD REGISTRADA"}</p>
                        <h1>{solicitudGuardada.estado === "PENDIENTE" ? "Pendiente de sincronizar" : "Enviada para revisión"}</h1>
                        <p className="page-subtitle">{solicitudGuardada.estado === "PENDIENTE" ? "Se enviará cuando vuelva la conexión." : "La solicitud quedó guardada y pendiente de evaluación."}</p>
                        <section className="confirmation-card">
                            <span>Cliente</span><strong>{clienteSeleccionado.nombre_completo}</strong>
                            <span>Monto solicitado</span><strong>Q{(Number(solicitudGuardada.monto_centavos) / 100).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</strong>
                            <span>Plazo</span><strong>{solicitudGuardada.plazo_meses} meses</strong>
                            <span>Código</span><strong className="request-code">{solicitudGuardada.id_solicitud}</strong>
                        </section>
                        <button className="primary-button" type="button" onClick={volverAlInicio}>Volver al inicio</button>
                        {solicitudGuardada.estado !== "PENDIENTE" && <button className="text-button" type="button" onClick={() => void cargarGestion("SOLICITADO")}>Continuar en gerencia</button>}
                    </section>
                </div>
            </main>
        );
    }

    return (
        <main className="app-shell">
            <div className="mobile-screen">
                <section className="page-content home-content">
                    <header className="home-heading">
                        <div className="home-title">
                            <p className="page-kicker">CRÉDITO VECINO</p>
                            <h1>Hola</h1>
                            <p className="page-subtitle">Asesor de crédito</p>
                        </div>
                        {indicadorConexion}
                    </header>

                    <div
                        className="progress-track home-progress"
                        aria-label="Paso 1 de 3"
                    >
                        <span className="progress-value" />
                    </div>

                    <div className="home-actions">
                        <button
                            className="primary-button"
                            type="button"
                            onClick={() => abrirBusqueda()}
                        >
                            Buscar cliente
                        </button>

                        <button
                            className="action-card"
                            type="button"
                            onClick={() => abrirBusqueda()}
                        >
                            <strong>＋ Nueva solicitud</strong>
                            <span>Registrar o seleccionar cliente</span>
                        </button>

                        <button
                            className="action-card"
                            type="button"
                            onClick={() => abrirBusqueda(true)}
                        >
                            <strong>₲ Registrar pago</strong>
                            <span>Cobros en agencia o campo</span>
                        </button>
                        <button className="action-card" type="button" onClick={() => void cargarGestion("SOLICITADO")}>
                            <strong>Gestión gerencial</strong>
                            <span>Revisar solicitudes y cartera</span>
                        </button>
                    </div>

                    <footer className="home-footer">
                        <div className="pending-operations">
                            <img
                                src={pendingOperations}
                                width="342"
                                height="36"
                                alt=""
                            />
                            <span>{pendientes === 0 ? "Sin operaciones pendientes" : `${pendientes} ${pendientes === 1 ? "operación pendiente" : "operaciones pendientes"}`}</span>
                        </div>
                        {pendientes > 0 && <button className="text-button" type="button" onClick={() => setPantalla("sincronizacion")}>Ver y sincronizar</button>}
                        <p className="sync-time">
                            Última sincronización
                            <strong>No disponible</strong>
                        </p>
                    </footer>
                </section>
            </div>
        </main>
    );
}