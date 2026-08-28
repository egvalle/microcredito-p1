import { Decimal } from "decimal.js";
import { Dinero, Moneda } from "./dinero.js";

export type TramoMora =
    | "SIN_MORA"
    | "MORA_1"
    | "MORA_2"
    | "MORA_3"
    | "VENCIDO"
    | "INCOBRABLE";

export interface EspecificacionTramoMora {
    cumple(diasAtraso: number): boolean;
    obtenerTramo(): TramoMora;
}

class Mora1Specification
    implements EspecificacionTramoMora {

    public cumple(diasAtraso: number): boolean {
        return diasAtraso >= 1 && diasAtraso <= 30;
    }

    public obtenerTramo(): TramoMora {
        return "MORA_1";
    }
}

class Mora2Specification
    implements EspecificacionTramoMora {

    public cumple(diasAtraso: number): boolean {
        return diasAtraso >= 31 && diasAtraso <= 60;
    }

    public obtenerTramo(): TramoMora {
        return "MORA_2";
    }
}

class Mora3Specification
    implements EspecificacionTramoMora {

    public cumple(diasAtraso: number): boolean {
        return diasAtraso >= 61 && diasAtraso <= 90;
    }

    public obtenerTramo(): TramoMora {
        return "MORA_3";
    }
}

class VencidoSpecification
    implements EspecificacionTramoMora {

    public cumple(diasAtraso: number): boolean {
        return diasAtraso >= 91 && diasAtraso <= 120;
    }

    public obtenerTramo(): TramoMora {
        return "VENCIDO";
    }
}

class IncobrableSpecification
    implements EspecificacionTramoMora {

    public cumple(diasAtraso: number): boolean {
        return diasAtraso > 120;
    }

    public obtenerTramo(): TramoMora {
        return "INCOBRABLE";
    }
}

export class ClasificadorMora {

    private readonly especificaciones:
        readonly EspecificacionTramoMora[];

    public constructor() {
        this.especificaciones = [
            new Mora1Specification(),
            new Mora2Specification(),
            new Mora3Specification(),
            new VencidoSpecification(),
            new IncobrableSpecification()
        ];
    }

    public clasificar(
        diasAtraso: number
    ): TramoMora {

        this.validarDias(diasAtraso);

        if (diasAtraso === 0) {
            return "SIN_MORA";
        }

        const especificacion =
            this.especificaciones.find(
                actual =>
                    actual.cumple(diasAtraso)
            );

        if (!especificacion) {
            throw new Error(
                "No fue posible clasificar los días de atraso"
            );
        }

        return especificacion.obtenerTramo();
    }

    private validarDias(
        diasAtraso: number
    ): void {

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

export interface CreditoCartera {
    id: string;
    saldoCapital: Dinero;
    diasAtraso: number;
    reestructurado: boolean;
    incobrable: boolean;
}

export interface ResultadoCarteraRiesgo {
    carteraActiva: Dinero;
    capitalEnRiesgo: Dinero;
    proporcionRiesgo: Decimal;
    porcentajeRiesgo: Decimal;
}

export class CalculadoraCarteraRiesgo {

    public calcular(
        creditos: readonly CreditoCartera[]
    ): ResultadoCarteraRiesgo {

        if (creditos.length === 0) {
            throw new Error(
                "La cartera debe contener al menos un crédito"
            );
        }

        this.validarCreditos(creditos);

        const moneda =
            creditos[0]?.saldoCapital.obtenerMoneda();

        if (!moneda) {
            throw new Error(
                "No fue posible determinar la moneda de la cartera"
            );
        }

        let carteraActiva =
            this.cero(moneda);

        let capitalEnRiesgo =
            this.cero(moneda);

        for (const credito of creditos) {

            if (credito.incobrable) {
                continue;
            }

            carteraActiva =
                carteraActiva.sumar(
                    credito.saldoCapital
                );

            if (this.estaEnRiesgo(credito)) {
                capitalEnRiesgo =
                    capitalEnRiesgo.sumar(
                        credito.saldoCapital
                    );
            }
        }

        const proporcionRiesgo =
            carteraActiva.esCero()
                ? new Decimal(0)
                : new Decimal(
                    capitalEnRiesgo
                        .obtenerCentavos()
                        .toString()
                ).div(
                    carteraActiva
                        .obtenerCentavos()
                        .toString()
                );

        const porcentajeRiesgo =
            proporcionRiesgo
                .mul(100)
                .toDecimalPlaces(
                    2,
                    Decimal.ROUND_HALF_UP
                );

        return {
            carteraActiva,
            capitalEnRiesgo,
            proporcionRiesgo,
            porcentajeRiesgo
        };
    }

    private estaEnRiesgo(
        credito: CreditoCartera
    ): boolean {

        return (
            credito.diasAtraso > 30 ||
            credito.reestructurado
        );
    }

    private validarCreditos(
        creditos: readonly CreditoCartera[]
    ): void {

        const moneda =
            creditos[0]?.saldoCapital.obtenerMoneda();

        for (const credito of creditos) {

            if (credito.saldoCapital.esNegativo()) {
                throw new Error(
                    "El saldo de capital no puede ser negativo"
                );
            }

            if (
                !Number.isInteger(credito.diasAtraso) ||
                credito.diasAtraso < 0
            ) {
                throw new Error(
                    "Los días de atraso deben ser un entero mayor o igual a cero"
                );
            }

            if (
                credito.saldoCapital.obtenerMoneda() !==
                moneda
            ) {
                throw new Error(
                    "Todos los créditos de la cartera deben utilizar la misma moneda"
                );
            }
        }
    }

    private cero(
        moneda: Moneda
    ): Dinero {

        return Dinero.desdeCentavos(
            0n,
            moneda
        );
    }
}