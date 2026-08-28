import { Decimal } from "decimal.js";
import { Dinero } from "./dinero.js";

export interface DatosAmortizacion {
    capital: Dinero;
    tasaNominalAnual: Decimal;
    numeroCuotas: number;
}

export interface CuotaAmortizacion {
    numero: number;
    saldoInicial: Dinero;
    interes: Dinero;
    capital: Dinero;
    cuota: Dinero;
    saldoFinal: Dinero;
}

export class PlanAmortizacion {

    private readonly cuotas: CuotaAmortizacion[];

    public constructor(cuotas: CuotaAmortizacion[]) {
        this.cuotas = [...cuotas];
    }

    public obtenerCuotas(): readonly CuotaAmortizacion[] {
        return this.cuotas;
    }

    public obtenerUltimaCuota(): CuotaAmortizacion {

        const ultima = this.cuotas[this.cuotas.length - 1];

        if (!ultima) {
            throw new Error(
                "El plan de amortización no contiene cuotas"
            );
        }

        return ultima;
    }
}

export interface EstrategiaAmortizacion {
    generar(datos: DatosAmortizacion): PlanAmortizacion;
}

export class AmortizacionFrancesa
    implements EstrategiaAmortizacion {

    public generar(
        datos: DatosAmortizacion
    ): PlanAmortizacion {

        this.validarDatos(datos);

        const capitalInicial = new Decimal(
            datos.capital.obtenerCentavos().toString()
        ).div(100);

        const tasaMensual =
            datos.tasaNominalAnual.div(12);

        const uno = new Decimal(1);

        const cuotaTeorica = capitalInicial
            .mul(tasaMensual)
            .div(
                uno.minus(
                    uno
                        .plus(tasaMensual)
                        .pow(-datos.numeroCuotas)
                )
            );

        // La cuota ordinaria se expresa en centavos.
        const cuotaRedondeada =
            this.redondearMoneda(cuotaTeorica);

        // El saldo también se manejará en centavos
        // después de cada período.
        let saldo =
            this.redondearMoneda(capitalInicial);

        const cuotas: CuotaAmortizacion[] = [];

        for (
            let numero = 1;
            numero <= datos.numeroCuotas;
            numero++
        ) {

            const saldoInicial = saldo;

            // El interés del período queda expresado
            // en centavos.
            const interes = this.redondearMoneda(
                saldoInicial.mul(tasaMensual)
            );

            let capital: Decimal;
            let cuota: Decimal;
            let saldoFinal: Decimal;

            if (numero === datos.numeroCuotas) {

                // La última cuota liquida exactamente
                // el capital pendiente.
                capital = saldoInicial;

                cuota = this.redondearMoneda(
                    capital.plus(interes)
                );

                saldoFinal = new Decimal(0);

            } else {

                cuota = cuotaRedondeada;

                capital = this.redondearMoneda(
                    cuota.minus(interes)
                );

                saldoFinal = this.redondearMoneda(
                    saldoInicial.minus(capital)
                );
            }

            cuotas.push({
                numero,
                saldoInicial:
                    this.aDinero(saldoInicial),
                interes:
                    this.aDinero(interes),
                capital:
                    this.aDinero(capital),
                cuota:
                    this.aDinero(cuota),
                saldoFinal:
                    this.aDinero(saldoFinal)
            });

            saldo = saldoFinal;
        }

        return new PlanAmortizacion(cuotas);
    }

    private validarDatos(
        datos: DatosAmortizacion
    ): void {

        if (
            datos.capital.esCero() ||
            datos.capital.esNegativo()
        ) {
            throw new Error(
                "El capital debe ser mayor que cero"
            );
        }

        if (
            datos.tasaNominalAnual.isNegative() ||
            datos.tasaNominalAnual.isZero()
        ) {
            throw new Error(
                "La tasa nominal anual debe ser mayor que cero"
            );
        }

        if (
            !Number.isInteger(datos.numeroCuotas) ||
            datos.numeroCuotas <= 0
        ) {
            throw new Error(
                "El número de cuotas debe ser un entero mayor que cero"
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

        return Dinero.desdeCentavos(
            centavos
        );
    }

    private redondearMoneda(
        valor: Decimal
    ): Decimal {

        return valor.toDecimalPlaces(
            2,
            Decimal.ROUND_HALF_UP
        );
    }
}