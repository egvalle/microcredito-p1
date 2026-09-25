import { Dinero } from "../dinero.js";

export interface DatosPoliticaMora {
    capitalEnMora: Dinero;
    diasAtraso: number;
}

/**
 * Puerto de política moratoria (Strategy). El motor depende únicamente
 * de esta abstracción — nunca de una implementación concreta 
 */
export interface PoliticaMora {
    calcularInteresMoratorio(
        datos: DatosPoliticaMora
    ): Dinero;
}
