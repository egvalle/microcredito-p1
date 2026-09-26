import { Dinero } from "./dinero.js";

/**
 * CP-04.2 — 
 * Regla: a partir del día 91 de atraso, el crédito deja de devengar
 * interés corriente. Lo no reconocido se acumula en una cuenta de orden
 * (interesEnSuspenso), nunca como ingreso. Al regularizarse el crédito
 * (diasAtraso vuelve a 0), el devengo se reactiva y lo acumulado se
 * reconoce en el período de la regularización.
 */

export interface ResultadoDevengo {
    interesReconocido: Dinero;
    interesEnSuspenso: Dinero;
}

export class CalculadoraSuspensionInteres {

    private static readonly DIA_LIMITE_DEVENGO = 90;

    /**
     * Decide, para una cuota vencida con un interés corriente ya
     * calculado (tabla de amortización), cuánto se reconoce como
     * ingreso del período y cuánto se suspende.
     */
    public calcularDevengo(
        interesCorriente: Dinero,
        diasAtraso: number
    ): ResultadoDevengo {

        this.validarDias(diasAtraso);

        const cero =
            Dinero.desdeCentavos(
                0n,
                interesCorriente.obtenerMoneda()
            );

        if (
            diasAtraso <=
            CalculadoraSuspensionInteres
                .DIA_LIMITE_DEVENGO
        ) {
            return {
                interesReconocido: interesCorriente,
                interesEnSuspenso: cero
            };
        }

        return {
            interesReconocido: cero,
            interesEnSuspenso: interesCorriente
        };
    }

    /**
     * Al regularizarse el crédito, lo acumulado en interesEnSuspenso
     * se reconoce íntegro en el período de la regularización.
     */
    public regularizar(
        interesEnSuspensoAcumulado: Dinero
    ): ResultadoDevengo {

        const cero =
            Dinero.desdeCentavos(
                0n,
                interesEnSuspensoAcumulado.obtenerMoneda()
            );

        return {
            interesReconocido: interesEnSuspensoAcumulado,
            interesEnSuspenso: cero
        };
    }

    private validarDias(diasAtraso: number): void {

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
