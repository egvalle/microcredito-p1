import { timingSafeEqual } from "node:crypto";

export function validarConfiguracionAcceso(
    host: string,
    usuario: string | undefined,
    clave: string | undefined
): void {
    if (host !== "127.0.0.1" && (!usuario || !clave)) {
        throw new Error("El acceso por red requiere APP_BASIC_USER y APP_BASIC_PASSWORD");
    }
}

export function accesoPermitido(
    encabezado: string | undefined,
    usuario: string,
    clave: string
): boolean {
    const codificado = /^Basic (.+)$/i.exec(encabezado ?? "")?.[1];
    if (!codificado) return false;
    const recibido = Buffer.from(codificado, "base64");
    const esperado = Buffer.from(`${usuario}:${clave}`);
    return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}
