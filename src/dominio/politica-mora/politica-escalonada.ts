import { Decimal } from "decimal.js";

import { Dinero } from "../dinero.js";
import {
    DatosPoliticaMora,
    PoliticaMora
} from "./politica-mora.js";

export interface TramoMoratorio {
    tramo: "MORA_1" | "MORA_2" | "MORA_3" | "VENCIDO";
    diasInicio: number;
    diasFin: number;
    tasaNominalAnual: Decimal;
    fechaVigencia: string;
    autor: string;
    motivo: string;
}

/**
 * Política institucional versionada (sección 7.2, Acta 09-2026).
 * Estas cinco cifras se pueden cambiar aquí sin recompilar la lógica
 * de cálculo y sin tocar calculadora-mora.ts.
 */
export const TABLA_MORA_ESCALONADA: readonly TramoMoratorio[] = [
    {
        tramo: "MORA_1",
        diasInicio: 1,
        diasFin: 30,
        tasaNominalAnual: new Decimal("0.18"),
        fechaVigencia: "2026-10-01",
        autor: "Comité de Crédito - Acta 09-2026",
        motivo: "Descuido: se cobra, pero suave."
    },
    {
        tramo: "MORA_2",
        diasInicio: 31,
        diasFin: 60,
        tasaNominalAnual: new Decimal("0.24"),
        fechaVigencia: "2026-10-01",
        autor: "Comité de Crédito - Acta 09-2026",
        motivo: "Atraso real: se activa gestión de cobro en campo."
    },
    {
        tramo: "MORA_3",
        diasInicio: 61,
        diasFin: 90,
        tasaNominalAnual: new Decimal("0.30"),
        fechaVigencia: "2026-10-01",
        autor: "Comité de Crédito - Acta 09-2026",
        motivo: "Deterioro: último tramo con devengo de interés corriente."
    },
    {
        tramo: "VENCIDO",
        diasInicio: 91,
        diasFin: 120,
        tasaNominalAnual: new Decimal("0.36"),
        fechaVigencia: "2026-10-01",
        autor: "Comité de Crédito - Acta 09-2026",
        motivo: "Se suspende el devengo de interés corriente (P1, 6.5)."
    }
];

const DIAS_BASE = 360;

/**
 * Política escalonada por tramo de atraso (CP-01), vigente a partir
 * del 1 de octubre de 2026 para créditos otorgados desde esa fecha.
 */
export class PoliticaMoraEscalonada implements PoliticaMora {

    public calcularInteresMoratorio(
        datos: DatosPoliticaMora
    ): Dinero {

        this.validar(datos);

        const capital = new Decimal(
            datos.capitalEnMora
                .obtenerCentavos()
                .toString()
        ).div(100);

        let totalSinRedondear = new Decimal(0);

        for (const tramo of TABLA_MORA_ESCALONADA) {

            const diasEnTramo =
                this.diasEnTramo(
                    datos.diasAtraso,
                    tramo.diasInicio,
                    tramo.diasFin
                );

            if (diasEnTramo === 0) {
                continue;
            }

            const tasaDiaria =
                tramo.tasaNominalAnual.div(DIAS_BASE);

            totalSinRedondear = totalSinRedondear.plus(
                capital
                    .mul(tasaDiaria)
                    .mul(diasEnTramo)
            );
        }

        const resultado =
            this.aDinero(totalSinRedondear);

        //el moratorio acumulado nunca excede
        // el propio capital en mora.
        if (resultado.esMayorQue(datos.capitalEnMora)) {
            return datos.capitalEnMora;
        }

        return resultado;
    }

    private diasEnTramo(
        diasAtraso: number,
        inicio: number,
        fin: number
    ): number {

        return Math.max(
            0,
            Math.min(diasAtraso, fin) - inicio + 1
        );
    }

    private validar(datos: DatosPoliticaMora): void {

        if (
            datos.capitalEnMora.esCero() ||
            datos.capitalEnMora.esNegativo()
        ) {
            throw new Error(
                "El capital en mora debe ser mayor que cero"
            );
        }

        if (
            !Number.isInteger(datos.diasAtraso) ||
            datos.diasAtraso < 1 ||
            datos.diasAtraso > 120
        ) {
            throw new Error(
                "La política escalonada solo aplica entre 1 y 120 " +
                "días de atraso; a partir del día 121 el crédito es " +
                "incobrable y sale de la cartera (P1 6.7)."
            );
        }
    }

    private aDinero(valor: Decimal): Dinero {

        const centavos = BigInt(
            valor
                .mul(100)
                .toDecimalPlaces(
                    0,
                    Decimal.ROUND_HALF_UP
                )
                .toFixed(0)
        );

        return Dinero.desdeCentavos(centavos);
    }
}
