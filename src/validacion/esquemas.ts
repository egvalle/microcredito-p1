import { format, isValid, parseISO } from "date-fns";
import { z } from "zod";

export const fechaCorteEsquema = z.string().refine(valor =>
    /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
    isValid(parseISO(valor)) &&
    format(parseISO(valor), "yyyy-MM-dd") === valor,
    "FECHA_INVALIDA: usa una fecha real AAAA-MM-DD"
);

export const idCreditoEsquema = z.string().regex(/^CV-\d{4}-\d{4}$/);
export const claveIdempotenciaEsquema = z.uuid();
export const montoEsquema = z.string().regex(/^\d+(\.\d{1,2})?$/);

export const pagoEsquema = z.object({
    monto: montoEsquema,
    canal: z.enum(["EFECTIVO", "TRANSFERENCIA"]),
    claveIdempotencia: claveIdempotenciaEsquema,
    fechaOperacion: fechaCorteEsquema
});
