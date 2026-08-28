import { ClasificadorMora, TramoMora } from "./cartera.js";

export type NombreEstadoCredito =
    | "SOLICITADO"
    | "VIGENTE"
    | "EN_MORA"
    | "CANCELADO";

export interface EstadoCredito {

    obtenerNombre(): NombreEstadoCredito;

    registrarPago(
        credito: Credito,
        diasAtrasoRestantes: number
    ): void;

    registrarAtraso(
        credito: Credito,
        diasAtraso: number
    ): void;
}

export class Credito {

    private estado: EstadoCredito;

    private diasAtraso: number;

    private readonly clasificadorMora:
        ClasificadorMora;

    public constructor(
        estadoInicial: EstadoCredito,
        diasAtrasoInicial: number = 0
    ) {

        if (
            !Number.isInteger(diasAtrasoInicial) ||
            diasAtrasoInicial < 0
        ) {
            throw new Error(
                "Los días de atraso deben ser un entero mayor o igual a cero"
            );
        }

        this.estado = estadoInicial;
        this.diasAtraso = diasAtrasoInicial;

        this.clasificadorMora =
            new ClasificadorMora();
    }

    public obtenerEstado():
        NombreEstadoCredito {

        return this.estado.obtenerNombre();
    }

    public obtenerDiasAtraso():
        number {

        return this.diasAtraso;
    }

    public obtenerTramoMora():
        TramoMora {

        return this.clasificadorMora
            .clasificar(
                this.diasAtraso
            );
    }

    public registrarPago(
        diasAtrasoRestantes: number
    ): void {

        this.validarDias(
            diasAtrasoRestantes
        );

        this.estado.registrarPago(
            this,
            diasAtrasoRestantes
        );
    }

    public registrarAtraso(
        diasAtraso: number
    ): void {

        this.validarDias(
            diasAtraso
        );

        this.estado.registrarAtraso(
            this,
            diasAtraso
        );
    }

    public cambiarEstado(
        nuevoEstado: EstadoCredito
    ): void {

        this.estado = nuevoEstado;
    }

    public actualizarDiasAtraso(
        diasAtraso: number
    ): void {

        this.validarDias(
            diasAtraso
        );

        this.diasAtraso =
            diasAtraso;
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

export class EstadoSolicitado
    implements EstadoCredito {

    public obtenerNombre():
        NombreEstadoCredito {

        return "SOLICITADO";
    }

    public registrarPago(): void {

        throw new Error(
            "Un crédito solicitado no puede recibir pagos"
        );
    }

    public registrarAtraso(): void {

        throw new Error(
            "Un crédito solicitado no puede entrar en mora"
        );
    }
}

export class EstadoVigente
    implements EstadoCredito {

    public obtenerNombre():
        NombreEstadoCredito {

        return "VIGENTE";
    }

    public registrarPago(
        credito: Credito,
        diasAtrasoRestantes: number
    ): void {

        credito.actualizarDiasAtraso(
            diasAtrasoRestantes
        );

        if (diasAtrasoRestantes > 0) {
            credito.cambiarEstado(
                new EstadoEnMora()
            );
        }
    }

    public registrarAtraso(
        credito: Credito,
        diasAtraso: number
    ): void {

        if (diasAtraso === 0) {
            throw new Error(
                "Un atraso debe tener al menos un día"
            );
        }

        credito.actualizarDiasAtraso(
            diasAtraso
        );

        credito.cambiarEstado(
            new EstadoEnMora()
        );
    }
}

export class EstadoEnMora
    implements EstadoCredito {

    public obtenerNombre():
        NombreEstadoCredito {

        return "EN_MORA";
    }

    public registrarPago(
        credito: Credito,
        diasAtrasoRestantes: number
    ): void {

        credito.actualizarDiasAtraso(
            diasAtrasoRestantes
        );

        if (diasAtrasoRestantes === 0) {

            credito.cambiarEstado(
                new EstadoVigente()
            );
        }
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

        credito.actualizarDiasAtraso(
            diasAtraso
        );
    }
}

export class EstadoCancelado
    implements EstadoCredito {

    public obtenerNombre():
        NombreEstadoCredito {

        return "CANCELADO";
    }

    public registrarPago(): void {

        throw new Error(
            "Un crédito cancelado no puede recibir pagos"
        );
    }

    public registrarAtraso(): void {

        throw new Error(
            "Un crédito cancelado no puede entrar en mora"
        );
    }
}