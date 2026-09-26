import { ClasificadorMora, TramoMora } from "./cartera.js";
import { Dinero } from "./dinero.js";
import { CatalogoPoliticas } from "./politica-mora/catalogo-politicas.js";

export type NombreEstadoCredito =
    | "SOLICITADO"
    | "VIGENTE"
    | "EN_MORA"
    | "CANCELADO";

export interface EstadoCredito {

    obtenerNombre(): NombreEstadoCredito;

    registrarPago(
        credito: Credito,
        diasAtrasoRestantes: number,
        saldoLiquidado?: boolean
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

    private readonly clasificadorMora:
        ClasificadorMora;

    /**
     * @param fechaOtorgamiento Fecha en que el crédito fue otorgado.
     * Se recibe siempre como parámetro — el núcleo nunca lee la fecha
     * del sistema (puerto Reloj, P1). Es la fecha que determina, vía
     * CatalogoPoliticas, qué política moratoria le corresponde a este
     * crédito durante toda su vida (P1, 6.3.1).
     */
    public constructor(
        estadoInicial: EstadoCredito,
        fechaOtorgamiento: Date,
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
        this.fechaOtorgamiento = fechaOtorgamiento;

        this.clasificadorMora =
            new ClasificadorMora();
    }

    public obtenerFechaOtorgamiento():
        Date {

        return this.fechaOtorgamiento;
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

    /**
     * Calcula el interés moratorio de este crédito real: resuelve la
     * política que le corresponde según su propia fecha de
     * otorgamiento (Information Expert — el crédito es quien conoce
     * esa fecha) y le delega el cálculo (Strategy). El motor de
     * cálculo (calculadora-mora.ts) no se toca para nada: la
     * coexistencia de políticas se resuelve aquí, no ahí (OCP).
     *
     * @param catalogo Resuelve política plana vs. escalonada según
     * fecha de otorgamiento (7.6). Se inyecta — Credito no conoce las
     * políticas concretas (DIP).
     * @param capitalEnMora Capital vencido de la cuota en mora.
     */
    public calcularInteresMoratorio(
        catalogo: CatalogoPoliticas,
        capitalEnMora: Dinero
    ): Dinero {

        if (this.diasAtraso === 0) {
            throw new Error(
                "Un crédito sin días de atraso no genera interés moratorio"
            );
        }

        const politica =
            catalogo.resolver(
                this.fechaOtorgamiento
            );

        return politica.calcularInteresMoratorio({
            capitalEnMora,
            diasAtraso: this.diasAtraso
        });
    }

    public registrarPago(
        diasAtrasoRestantes: number,
        saldoLiquidado: boolean = false
    ): void {

        this.validarDias(
            diasAtrasoRestantes
        );

        if (saldoLiquidado && diasAtrasoRestantes !== 0) {
            throw new Error(
                "Un saldo liquidado no puede dejar días de atraso pendientes"
            );
        }

        this.estado.registrarPago(
            this,
            diasAtrasoRestantes,
            saldoLiquidado
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
        diasAtrasoRestantes: number,
        saldoLiquidado: boolean = false
    ): void {

        credito.actualizarDiasAtraso(
            diasAtrasoRestantes
        );

        if (diasAtrasoRestantes === 0 && saldoLiquidado) {

            credito.cambiarEstado(
                new EstadoCancelado()
            );

            return;
        }

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