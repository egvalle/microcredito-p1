import { Decimal } from "decimal.js";
import { Dinero } from "./dinero.js";

export interface DatosMora {
    capitalVencido: Dinero;
    tasaMoraAnual: Decimal;
    diasMora: number;
    diasBase?: number;
}

export class CalculadoraMora {

    public calcular(datos: DatosMora): Dinero {

        this.validar(datos);

        const diasBase = datos.diasBase ?? 365;

        const capital = new Decimal(
            datos.capitalVencido
                .obtenerCentavos()
                .toString()
        ).div(100);

        const mora = capital
            .mul(datos.tasaMoraAnual)
            .mul(datos.diasMora)
            .div(diasBase);

        return this.aDinero(mora);
    }

    private validar(datos: DatosMora): void {

        if (
            datos.capitalVencido.esCero() ||
            datos.capitalVencido.esNegativo()
        ) {
            throw new Error(
                "El capital vencido debe ser mayor que cero"
            );
        }

        if (
            datos.tasaMoraAnual.isZero() ||
            datos.tasaMoraAnual.isNegative()
        ) {
            throw new Error(
                "La tasa de mora anual debe ser mayor que cero"
            );
        }

        if (
            !Number.isInteger(datos.diasMora) ||
            datos.diasMora <= 0
        ) {
            throw new Error(
                "Los días de mora deben ser un entero mayor que cero"
            );
        }

        if (
            datos.diasBase !== undefined &&
            (
                !Number.isInteger(datos.diasBase) ||
                datos.diasBase <= 0
            )
        ) {
            throw new Error(
                "La base de días debe ser un entero mayor que cero"
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