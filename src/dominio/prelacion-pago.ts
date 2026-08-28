import { Dinero, Moneda } from "./dinero.js";

export interface DeudaPago {
    gastos: Dinero;
    interesMoratorio: Dinero;
    interesCorriente: Dinero;
    capital: Dinero;
}

export interface AplicacionPago {
    gastos: Dinero;
    interesMoratorio: Dinero;
    interesCorriente: Dinero;
    capital: Dinero;
    excedente: Dinero;
}

interface ContextoPago {
    disponible: Dinero;
    deuda: DeudaPago;
    aplicado: AplicacionPago;
}

abstract class AplicadorPago {

    private siguiente?: AplicadorPago;

    public establecerSiguiente(
        siguiente: AplicadorPago
    ): AplicadorPago {

        this.siguiente = siguiente;

        return siguiente;
    }

    public procesar(
        contexto: ContextoPago
    ): ContextoPago {

        const resultado =
            this.aplicar(contexto);

        if (
            this.siguiente &&
            !resultado.disponible.esCero()
        ) {
            return this.siguiente.procesar(
                resultado
            );
        }

        return resultado;
    }

    protected abstract aplicar(
        contexto: ContextoPago
    ): ContextoPago;

    protected calcularMontoAplicable(
        disponible: Dinero,
        deuda: Dinero
    ): Dinero {

        if (disponible.esMayorQue(deuda)) {
            return deuda;
        }

        return disponible;
    }
}

class AplicadorGastos extends AplicadorPago {

    protected aplicar(
        contexto: ContextoPago
    ): ContextoPago {

        const monto = this.calcularMontoAplicable(
            contexto.disponible,
            contexto.deuda.gastos
        );

        return {
            disponible:
                contexto.disponible.restar(monto),

            deuda: {
                ...contexto.deuda,
                gastos:
                    contexto.deuda.gastos.restar(monto)
            },

            aplicado: {
                ...contexto.aplicado,
                gastos:
                    contexto.aplicado.gastos.sumar(monto)
            }
        };
    }
}

class AplicadorInteresMoratorio
    extends AplicadorPago {

    protected aplicar(
        contexto: ContextoPago
    ): ContextoPago {

        const monto = this.calcularMontoAplicable(
            contexto.disponible,
            contexto.deuda.interesMoratorio
        );

        return {
            disponible:
                contexto.disponible.restar(monto),

            deuda: {
                ...contexto.deuda,
                interesMoratorio:
                    contexto.deuda.interesMoratorio
                        .restar(monto)
            },

            aplicado: {
                ...contexto.aplicado,
                interesMoratorio:
                    contexto.aplicado.interesMoratorio
                        .sumar(monto)
            }
        };
    }
}

class AplicadorInteresCorriente
    extends AplicadorPago {

    protected aplicar(
        contexto: ContextoPago
    ): ContextoPago {

        const monto = this.calcularMontoAplicable(
            contexto.disponible,
            contexto.deuda.interesCorriente
        );

        return {
            disponible:
                contexto.disponible.restar(monto),

            deuda: {
                ...contexto.deuda,
                interesCorriente:
                    contexto.deuda.interesCorriente
                        .restar(monto)
            },

            aplicado: {
                ...contexto.aplicado,
                interesCorriente:
                    contexto.aplicado.interesCorriente
                        .sumar(monto)
            }
        };
    }
}

class AplicadorCapital extends AplicadorPago {

    protected aplicar(
        contexto: ContextoPago
    ): ContextoPago {

        const monto = this.calcularMontoAplicable(
            contexto.disponible,
            contexto.deuda.capital
        );

        return {
            disponible:
                contexto.disponible.restar(monto),

            deuda: {
                ...contexto.deuda,
                capital:
                    contexto.deuda.capital.restar(monto)
            },

            aplicado: {
                ...contexto.aplicado,
                capital:
                    contexto.aplicado.capital.sumar(monto)
            }
        };
    }
}

export class PrelacionPago {

    private readonly primerAplicador:
        AplicadorPago;

    public constructor() {

        const gastos =
            new AplicadorGastos();

        const moratorio =
            new AplicadorInteresMoratorio();

        const corriente =
            new AplicadorInteresCorriente();

        const capital =
            new AplicadorCapital();

        gastos
            .establecerSiguiente(moratorio)
            .establecerSiguiente(corriente)
            .establecerSiguiente(capital);

        this.primerAplicador = gastos;
    }

    public aplicar(
        pago: Dinero,
        deuda: DeudaPago
    ): AplicacionPago {

        this.validar(pago, deuda);

        const moneda =
            pago.obtenerMoneda();

        const cero =
            this.crearCero(moneda);

        const contextoInicial: ContextoPago = {
            disponible: pago,

            deuda,

            aplicado: {
                gastos: cero,
                interesMoratorio: cero,
                interesCorriente: cero,
                capital: cero,
                excedente: cero
            }
        };

        const resultado =
            this.primerAplicador.procesar(
                contextoInicial
            );

        return {
            ...resultado.aplicado,
            excedente: resultado.disponible
        };
    }

    private validar(
        pago: Dinero,
        deuda: DeudaPago
    ): void {

        if (
            pago.esCero() ||
            pago.esNegativo()
        ) {
            throw new Error(
                "El pago debe ser mayor que cero"
            );
        }

        const conceptos = [
            deuda.gastos,
            deuda.interesMoratorio,
            deuda.interesCorriente,
            deuda.capital
        ];

        for (const concepto of conceptos) {

            if (concepto.esNegativo()) {
                throw new Error(
                    "Los componentes de la deuda no pueden ser negativos"
                );
            }

            if (
                concepto.obtenerMoneda() !==
                pago.obtenerMoneda()
            ) {
                throw new Error(
                    "El pago y la deuda deben utilizar la misma moneda"
                );
            }
        }
    }

    private crearCero(
        moneda: Moneda
    ): Dinero {

        return Dinero.desdeCentavos(
            0n,
            moneda
        );
    }
}