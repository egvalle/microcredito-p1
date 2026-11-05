export function generarFechasVencimiento(
    fechaDesembolso: string,
    numeroCuotas: number
): string[] {
    const coincidencia =
        /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaDesembolso);

    if (!coincidencia) {
        throw new Error(
            "La fecha de desembolso debe tener formato AAAA-MM-DD"
        );
    }

    const anioInicial = Number(coincidencia[1]);
    const mesInicial = Number(coincidencia[2]);
    const diaInicial = Number(coincidencia[3]);

    const fechaValidacion = new Date(
        Date.UTC(anioInicial, mesInicial - 1, diaInicial)
    );

    if (
        fechaValidacion.getUTCFullYear() !== anioInicial ||
        fechaValidacion.getUTCMonth() !== mesInicial - 1 ||
        fechaValidacion.getUTCDate() !== diaInicial
    ) {
        throw new Error("La fecha de desembolso no es válida");
    }

    if (!Number.isInteger(numeroCuotas) || numeroCuotas <= 0) {
        throw new Error(
            "El número de cuotas debe ser un entero mayor que cero"
        );
    }

    return Array.from({ length: numeroCuotas }, (_, indice) => {
        const mesAbsoluto = mesInicial - 1 + indice + 1;
        const anio = anioInicial + Math.floor(mesAbsoluto / 12);
        const mes = mesAbsoluto % 12;
        const ultimoDiaDelMes = new Date(
            Date.UTC(anio, mes + 1, 0)
        ).getUTCDate();
        const dia = Math.min(diaInicial, ultimoDiaDelMes);

        return [
            String(anio).padStart(4, "0"),
            String(mes + 1).padStart(2, "0"),
            String(dia).padStart(2, "0")
        ].join("-");
    });
}