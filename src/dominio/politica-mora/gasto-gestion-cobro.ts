import { Dinero } from "../dinero.js";

/**
 * CP-02 — Gasto de gestión de cobro en campo (art. 42, Decreto 19-2002).
 *
 * Q25.00 fijos, generado una sola vez por cuota vencida, 
 */
export class GastoGestionCobro {

    private static readonly MONTO =
        Dinero.desdeQuetzales("25.00");

    private static readonly DIA_ACTIVACION = 31;

    public calcular(
        diasAtraso: number,
        yaFueGenerado: boolean
    ): Dinero {

        this.validar(diasAtraso);

        const cero =
            Dinero.desdeCentavos(0n);

        if (yaFueGenerado) {
            return cero;
        }

        if (
            diasAtraso >=
            GastoGestionCobro.DIA_ACTIVACION
        ) {
            return GastoGestionCobro.MONTO;
        }

        return cero;
    }

    private validar(diasAtraso: number): void {

        if (
            !Number.isInteger(diasAtraso) ||
            diasAtraso < 0
        ) {
            throw new Error(
                "Los días de atraso deben ser un entero mayor o igual a cero"
            );
        }
    }
}
