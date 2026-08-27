export type Moneda = "GTQ" | "USD";

export class Dinero {

    private constructor(
        private readonly centavos: bigint,
        private readonly moneda: Moneda
    ) {}

    public static desdeCentavos(
        centavos: bigint,
        moneda: Moneda = "GTQ"
    ): Dinero {
        return new Dinero(centavos, moneda);
    }

    public static desdeQuetzales(valor: string): Dinero {
        return Dinero.desdeDecimal(valor, "GTQ");
    }

    public static desdeDecimal(
        valor: string,
        moneda: Moneda
    ): Dinero {

        if (!/^-?\d+(\.\d{1,2})?$/.test(valor)) {
            throw new Error(`Importe monetario inválido: ${valor}`);
        }

        const negativo = valor.startsWith("-");
        const valorAbsoluto = negativo ? valor.slice(1) : valor;

        const [parteEntera = "0", parteDecimal = ""] =
            valorAbsoluto.split(".");

        const decimales = parteDecimal.padEnd(2, "0");

        let totalCentavos =
            BigInt(parteEntera) * 100n +
            BigInt(decimales);

        if (negativo) {
            totalCentavos = -totalCentavos;
        }

        return new Dinero(
            totalCentavos,
            moneda
        );
    }

    public sumar(otro: Dinero): Dinero {
        this.validarMismaMoneda(otro);

        return new Dinero(
            this.centavos + otro.centavos,
            this.moneda
        );
    }

    public restar(otro: Dinero): Dinero {
        this.validarMismaMoneda(otro);

        return new Dinero(
            this.centavos - otro.centavos,
            this.moneda
        );
    }

    public esCero(): boolean {
        return this.centavos === 0n;
    }

    public esNegativo(): boolean {
        return this.centavos < 0n;
    }

    public esMayorQue(otro: Dinero): boolean {
        this.validarMismaMoneda(otro);

        return this.centavos > otro.centavos;
    }

    public esMayorOIgualQue(otro: Dinero): boolean {
        this.validarMismaMoneda(otro);

        return this.centavos >= otro.centavos;
    }

    public esMenorQue(otro: Dinero): boolean {
        this.validarMismaMoneda(otro);

        return this.centavos < otro.centavos;
    }

    public igualA(otro: Dinero): boolean {
        this.validarMismaMoneda(otro);

        return this.centavos === otro.centavos;
    }

    public obtenerCentavos(): bigint {
        return this.centavos;
    }

    public obtenerMoneda(): Moneda {
        return this.moneda;
    }

    public aDecimal(): string {

        const negativo = this.centavos < 0n;

        const valorAbsoluto =
            negativo ? -this.centavos : this.centavos;

        const enteros = valorAbsoluto / 100n;
        const decimales = valorAbsoluto % 100n;

        const resultado =
            `${enteros}.${decimales.toString().padStart(2, "0")}`;

        return negativo
            ? `-${resultado}`
            : resultado;
    }

    private validarMismaMoneda(otro: Dinero): void {

        if (this.moneda !== otro.moneda) {
            throw new Error(
                `No se pueden operar monedas diferentes: ` +
                `${this.moneda} y ${otro.moneda}`
            );
        }
    }
}