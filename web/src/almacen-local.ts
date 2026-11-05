export type ClienteLocal = {
    id_cliente: string;
    nombre_completo: string;
    dpi: string;
    telefono: string;
    municipio: string;
};

export type ClientePendiente = ClienteLocal;
export type AltaClientePendiente = ClientePendiente & { fecha_alta: string };

export type SolicitudPendiente = {
    claveIdempotencia: string;
    clienteId: string;
    montoSolicitado: string;
    plazoMeses: number;
    motivo: string;
    fechaOperacion: string;
};

export type PagoPendiente = {
    idCredito: string;
    monto: string;
    canal: string;
    claveIdempotencia: string;
    fechaOperacion: string;
};

function abrirBase(): Promise<IDBDatabase> {
    return new Promise((resolver, rechazar) => {
        const solicitud = indexedDB.open("credito-vecino-local", 4);
        solicitud.onupgradeneeded = () => {
            const base = solicitud.result;
            if (!base.objectStoreNames.contains("clientes")) base.createObjectStore("clientes", { keyPath: "id_cliente" });
            if (!base.objectStoreNames.contains("solicitudes")) base.createObjectStore("solicitudes", { keyPath: "claveIdempotencia" });
            if (!base.objectStoreNames.contains("pagos")) base.createObjectStore("pagos", { keyPath: "claveIdempotencia" });
            if (!base.objectStoreNames.contains("clientes_pendientes")) base.createObjectStore("clientes_pendientes", { keyPath: "id_cliente" });
            if (!base.objectStoreNames.contains("consultas")) base.createObjectStore("consultas", { keyPath: "clave" });
        };
        solicitud.onsuccess = () => resolver(solicitud.result);
        solicitud.onerror = () => rechazar(solicitud.error);
    });
}

async function ejecutar<T>(
    tabla: "clientes" | "solicitudes" | "pagos" | "clientes_pendientes" | "consultas",
    modo: IDBTransactionMode,
    operacion: (almacen: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
    const base = await abrirBase();
    return new Promise((resolver, rechazar) => {
        const transaccion = base.transaction(tabla, modo);
        const solicitud = operacion(transaccion.objectStore(tabla));
        solicitud.onsuccess = () => resolver(solicitud.result);
        solicitud.onerror = () => rechazar(solicitud.error);
        transaccion.oncomplete = () => base.close();
        transaccion.onerror = () => { base.close(); rechazar(transaccion.error); };
    });
}

export async function guardarClientes(clientes: ClienteLocal[]): Promise<void> {
    const base = await abrirBase();
    await new Promise<void>((resolver, rechazar) => {
        const transaccion = base.transaction("clientes", "readwrite");
        for (const cliente of clientes) transaccion.objectStore("clientes").put(cliente);
        transaccion.oncomplete = () => { base.close(); resolver(); };
        transaccion.onerror = () => { base.close(); rechazar(transaccion.error); };
    });
}

export function obtenerClientes(): Promise<ClienteLocal[]> {
    return ejecutar("clientes", "readonly", almacen => almacen.getAll());
}

export async function guardarConsulta<T>(clave: string, datos: T): Promise<void> {
    await ejecutar("consultas", "readwrite", almacen => almacen.put({ clave, datos }));
}

export async function obtenerConsulta<T>(clave: string): Promise<T | null> {
    const registro = await ejecutar<{ clave: string; datos: T } | undefined>(
        "consultas", "readonly", almacen => almacen.get(clave)
    );
    return registro?.datos ?? null;
}

export async function guardarSolicitudPendiente(solicitud: SolicitudPendiente): Promise<void> {
    await ejecutar("solicitudes", "readwrite", almacen => almacen.put(solicitud));
}

export function obtenerSolicitudesPendientes(): Promise<SolicitudPendiente[]> {
    return ejecutar("solicitudes", "readonly", almacen => almacen.getAll());
}

export async function eliminarSolicitudPendiente(clave: string): Promise<void> {
    await ejecutar("solicitudes", "readwrite", almacen => almacen.delete(clave));
}

export async function guardarPagoPendiente(pago: PagoPendiente): Promise<void> {
    await ejecutar("pagos", "readwrite", almacen => almacen.put(pago));
}

export function obtenerPagosPendientes(): Promise<PagoPendiente[]> {
    return ejecutar("pagos", "readonly", almacen => almacen.getAll());
}

export async function eliminarPagoPendiente(clave: string): Promise<void> {
    await ejecutar("pagos", "readwrite", almacen => almacen.delete(clave));
}

export async function guardarClientePendiente(cliente: AltaClientePendiente): Promise<void> {
    await ejecutar("clientes_pendientes", "readwrite", almacen => almacen.put(cliente));
    await guardarClientes([cliente]);
}

export function obtenerClientesPendientes(): Promise<AltaClientePendiente[]> {
    return ejecutar("clientes_pendientes", "readonly", almacen => almacen.getAll());
}

export async function eliminarClientePendiente(id: string): Promise<void> {
    await ejecutar("clientes_pendientes", "readwrite", almacen => almacen.delete(id));
}
