import { ClasificadorMora, TramoMora } from "./cartera.js";
import { Dinero } from "./dinero.js";
import { CatalogoPoliticas } from "./politica-mora/catalogo-politicas.js";

export type NombreEstadoCredito =
    | "SOLICITADO"
    | "VIGENTE"
    | "EN_MORA"
    | "CANCELADO";

export interface ResultadoPagoCredito {
    diasAtrasoRestantes: number;
    saldoPendiente: Dinero;
    cuotasVencidasPendientes: number;
}

export interface EstadoCredito {
    obtenerNombre(): NombreEstadoCredito;

    registrarPago(
        credito: Credito,
        resultado: ResultadoPagoCredito
    ): void;

    registrarAtraso(
        credito: Credito,
        diasAtraso: number
    ): void;
}

export class Credito {
    private estado: EstadoCredito;
    private diasAtraso: number;
    private readonly fechaOtorgamiento: Date;
    private readonly clasificadorMora: ClasificadorMora;

    public constructor(
        estadoInicial: EstadoCredito,
        fechaOtorgamiento: Date,
        diasAtrasoInicial: number = 0
    ) {
        if (Number.isNaN(fechaOtorgamiento.getTime())) {
            throw new Error("La fecha de otorgamiento no es válida");
        }

        this.validarDias(diasAtrasoInicial);

        this.estado = estadoInicial;
        this.diasAtraso = diasAtrasoInicial;
        this.fechaOtorgamiento = new Date(fechaOtorgamiento.getTime());
        this.clasificadorMora = new ClasificadorMora();
    }

    public obtenerFechaOtorgamiento(): Date {
        return new Date(this.fechaOtorgamiento.getTime());
    }

    public obtenerEstado(): NombreEstadoCredito {
        return this.estado.obtenerNombre();
    }

    public obtenerDiasAtraso(): number {
        return this.diasAtraso;
    }

    public obtenerTramoMora(): TramoMora {
        return this.clasificadorMora.clasificar(this.diasAtraso);
    }

    public calcularInteresMoratorio(
        catalogo: CatalogoPoliticas,
        capitalEnMora: Dinero
    ): Dinero {
        if (this.diasAtraso === 0) {
            throw new Error(
                "Un crédito sin días de atraso no genera interés moratorio"
            );
        }

        const politica = catalogo.resolver(this.fechaOtorgamiento);

        return politica.calcularInteresMoratorio({
            capitalEnMora,
            diasAtraso: this.diasAtraso
        });
    }

    public registrarPago(resultado: ResultadoPagoCredito): void {
        const {
            diasAtrasoRestantes,
            saldoPendiente,
            cuotasVencidasPendientes
        } = resultado;

        this.validarDias(diasAtrasoRestantes);

        if (saldoPendiente.esNegativo()) {
            throw new Error("El saldo pendiente no puede ser negativo");
        }

        if (
            !Number.isInteger(cuotasVencidasPendientes) ||
            cuotasVencidasPendientes < 0
        ) {
            throw new Error(
                "Las cuotas vencidas pendientes deben ser un entero mayor o igual a cero"
            );
        }

        if (
            (diasAtrasoRestantes === 0) !==
            (cuotasVencidasPendientes === 0)
        ) {
            throw new Error(
                "Los días de atraso y las cuotas vencidas pendientes son inconsistentes"
            );
        }

        this.estado.registrarPago(this, resultado);
    }

    public registrarAtraso(diasAtraso: number): void {
        this.validarDias(diasAtraso);
        this.estado.registrarAtraso(this, diasAtraso);
    }

    public cambiarEstado(nuevoEstado: EstadoCredito): void {
        this.estado = nuevoEstado;
    }

    public actualizarDiasAtraso(diasAtraso: number): void {
        this.validarDias(diasAtraso);
        this.diasAtraso = diasAtraso;
    }

    private validarDias(diasAtraso: number): void {
        if (!Number.isInteger(diasAtraso) || diasAtraso < 0) {
            throw new Error(
                "Los días de atraso deben ser un entero mayor o igual a cero"
            );
        }
    }
}

export class EstadoSolicitado implements EstadoCredito {
    public obtenerNombre(): NombreEstadoCredito {
        return "SOLICITADO";
    }

    public registrarPago(
        _credito: Credito,
        _resultado: ResultadoPagoCredito
    ): void {
        throw new Error(
            "Un crédito solicitado no puede recibir pagos"
        );
    }

    public registrarAtraso(
        _credito: Credito,
        _diasAtraso: number
    ): void {
        throw new Error(
            "Un crédito solicitado no puede entrar en mora"
        );
    }
}

export class EstadoVigente implements EstadoCredito {
    public obtenerNombre(): NombreEstadoCredito {
        return "VIGENTE";
    }

    public registrarPago(
        credito: Credito,
        resultado: ResultadoPagoCredito
    ): void {
        credito.actualizarDiasAtraso(resultado.diasAtrasoRestantes);

        if (
            resultado.saldoPendiente.esCero() &&
            resultado.cuotasVencidasPendientes === 0
        ) {
            credito.cambiarEstado(new EstadoCancelado());
            return;
        }

        if (resultado.diasAtrasoRestantes > 0) {
            credito.cambiarEstado(new EstadoEnMora());
        }
    }

    public registrarAtraso(
        credito: Credito,
        diasAtraso: number
    ): void {
        if (diasAtraso === 0) {
            throw new Error("Un atraso debe tener al menos un día");
        }

        credito.actualizarDiasAtraso(diasAtraso);
        credito.cambiarEstado(new EstadoEnMora());
    }
}

export class EstadoEnMora implements EstadoCredito {
    public obtenerNombre(): NombreEstadoCredito {
        return "EN_MORA";
    }

    public registrarPago(
        credito: Credito,
        resultado: ResultadoPagoCredito
    ): void {
        credito.actualizarDiasAtraso(resultado.diasAtrasoRestantes);

        if (resultado.diasAtrasoRestantes > 0) {
            return;
        }

        if (
            resultado.saldoPendiente.esCero() &&
            resultado.cuotasVencidasPendientes === 0
        ) {
            credito.cambiarEstado(new EstadoCancelado());
            return;
        }

        credito.cambiarEstado(new EstadoVigente());
    }

    public registrarAtraso(
        credito: Credito,
        diasAtraso: number
    ): void {
        if (diasAtraso === 0) {
            throw new Error(
                "Un crédito en mora no puede registrar cero días como nuevo atraso"
            );
        }

        credito.actualizarDiasAtraso(diasAtraso);
    }
}

export class EstadoCancelado implements EstadoCredito {
    public obtenerNombre(): NombreEstadoCredito {
        return "CANCELADO";
    }

    public registrarPago(
        _credito: Credito,
        _resultado: ResultadoPagoCredito
    ): void {
        throw new Error(
            "Un crédito cancelado no puede recibir pagos"
        );
    }

    public registrarAtraso(
        _credito: Credito,
        _diasAtraso: number
    ): void {
        throw new Error(
            "Un crédito cancelado no puede entrar en mora"
        );
    }
}