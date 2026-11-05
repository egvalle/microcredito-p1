import { Dinero } from "./dinero.js";

export interface EstadoDevengo {
    interesReconocido: Dinero;
    interesEnSuspenso: Dinero;
}

export interface ResultadoDevengo {
    estado: EstadoDevengo;
    reconocidoEnPeriodo: Dinero;
    suspendidoEnPeriodo: Dinero;
}

export interface ResultadoRegularizacion {
    estado: EstadoDevengo;
    reconocidoEnPeriodo: Dinero;
}

export class CalculadoraSuspensionInteres {
    private static readonly DIA_LIMITE_DEVENGO = 90;

    /**
     * Registra el interés nuevo de un período.
     *
     * Hasta el día 90 se reconoce como ingreso.
     * Desde el día 91 se acumula en suspenso.
     */
    public registrarDevengo(
        interesCorrienteDelPeriodo: Dinero,
        diasAtraso: number,
        estadoAnterior: EstadoDevengo
    ): ResultadoDevengo {
        this.validarDias(diasAtraso);
        this.validarMonto(interesCorrienteDelPeriodo);

        const cero = Dinero.desdeCentavos(
            0n,
            interesCorrienteDelPeriodo.obtenerMoneda()
        );

        if (diasAtraso <= CalculadoraSuspensionInteres.DIA_LIMITE_DEVENGO) {
            const estado: EstadoDevengo = {
                interesReconocido: estadoAnterior.interesReconocido.sumar(
                    interesCorrienteDelPeriodo
                ),
                interesEnSuspenso: estadoAnterior.interesEnSuspenso
            };

            return {
                estado,
                reconocidoEnPeriodo: interesCorrienteDelPeriodo,
                suspendidoEnPeriodo: cero
            };
        }

        const estado: EstadoDevengo = {
            interesReconocido: estadoAnterior.interesReconocido,
            interesEnSuspenso: estadoAnterior.interesEnSuspenso.sumar(
                interesCorrienteDelPeriodo
            )
        };

        return {
            estado,
            reconocidoEnPeriodo: cero,
            suspendidoEnPeriodo: interesCorrienteDelPeriodo
        };
    }

    /**
     * Al regularizar, reconoce el saldo suspendido y lo deja en cero.
     */
    public regularizar(
        estadoAnterior: EstadoDevengo
    ): ResultadoRegularizacion {
        const suspendido = estadoAnterior.interesEnSuspenso;
        const cero = Dinero.desdeCentavos(
            0n,
            suspendido.obtenerMoneda()
        );

        return {
            estado: {
                interesReconocido: estadoAnterior.interesReconocido.sumar(
                    suspendido
                ),
                interesEnSuspenso: cero
            },
            reconocidoEnPeriodo: suspendido
        };
    }

    private validarDias(diasAtraso: number): void {
        if (!Number.isInteger(diasAtraso) || diasAtraso < 0) {
            throw new Error(
                "Los días de atraso deben ser un entero mayor o igual a cero"
            );
        }
    }

    private validarMonto(interes: Dinero): void {
        if (interes.esNegativo()) {
            throw new Error(
                "El interés corriente del período no puede ser negativo"
            );
        }
    }
}