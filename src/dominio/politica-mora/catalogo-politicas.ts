import { PoliticaMora } from "./politica-mora.js";

/**
 * Resuelve qué política moratoria aplica a un crédito según su fecha
 * de otorgamiento 
 */
export class CatalogoPoliticas {

    private static readonly FECHA_VIGENCIA_ESCALONADA =
        Date.UTC(2026, 9, 1); // 1 de octubre de 2026 (mes 9 = octubre)

    public constructor(
        private readonly politicaAnterior: PoliticaMora,
        private readonly politicaEscalonada: PoliticaMora
    ) {}

    public resolver(
        fechaOtorgamiento: Date
    ): PoliticaMora {

        return fechaOtorgamiento.getTime() <
            CatalogoPoliticas.FECHA_VIGENCIA_ESCALONADA
            ? this.politicaAnterior
            : this.politicaEscalonada;
    }
}
