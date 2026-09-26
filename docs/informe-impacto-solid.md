# Informe de impacto SOLID (E6)
## Sistema de Gestión de Microcrédito — Crédito Vecino, S. A.

## 1. Punto de partida

| Dato | Valor |
|---|---|
| Commit de entrega del Proyecto 1 | `fb1c184` — "Se agrega informe consolidado de todos los puntos" (etiquetado como `entrega-p1`) |
| Commit de entrega del Proyecto 2 | `58392d3` — "Correcciones y evolucion del nucleo" |
| Repositorio | `https://github.com/egvalle/microcredito-p1` |

El cambio de requisito absorbido es el de la sección 7 del enunciado:
política de mora escalonada por tramo de atraso (CP-01), vigente a partir
del 1 de octubre de 2026, coexistiendo con la política plana del 24 %
para créditos otorgados antes de esa fecha.

---

## 2. Métricas del cambio (sección 8.1)

Medido con `git diff --stat entrega-p1 HEAD -- src/dominio/`, donde
`entrega-p1` = `fb1c184` (commit de entrega del P1):

| Métrica | Valor medido | Interpretación |
|---|---|---|
| Archivos del núcleo **creados** | **7**: `politica-mora/catalogo-politicas.ts`, `politica-mora/politica-mora.ts`, `politica-mora/politica-plana.ts`, `politica-mora/politica-escalonada.ts`, `politica-mora/politica-retroactiva.ts`, `politica-mora/gasto-gestion-cobro.ts`, `suspension-interes.ts` | Bueno: la funcionalidad nueva vive en archivos nuevos, no incrustada en los existentes. |
| Archivos del núcleo **modificados** (ya existían en el P1) | **2**: `credito.ts` (+81/−4), `cartera.ts` (+161/−0) | Dentro del rango razonable. `credito.ts` se tocó para agregar `fechaOtorgamiento` y conectar el catálogo; `cartera.ts` se tocó para el desglose de cartera por tramo. |
| ¿Se modificó `calculadora-mora.ts`?| **No** — no aparece en el diff, 0 líneas de diferencia | Confirma que el principio abierto/cerrado se sostuvo: la política escalonada y su conexión con `Credito` no requirieron tocar el motor de cálculo. |
| Pruebas del P1 que dejaron de pasar | Todas las pruebas correctas | Ninguna regresión esperada sobre la suite original. |
| Pruebas del P1 que hubo que reescribir | **1 archivo**: `tests/credito.test.ts` — se actualizaron las 18 invocaciones de `new Credito(...)` para incluir el nuevo parámetro `fechaOtorgamiento`. Ninguna aserción original se modificó ni se eliminó; solo se adaptó la firma del constructor. | Justificado: el constructor cambió porque el dominio ganó un dato legítimo (fecha de otorgamiento), no porque se ocultara una regresión. Ninguna prueba original perdió cobertura. |
| Líneas netas añadidas al núcleo | **9 archivos cambiados, 678 inserciones(+), 4 eliminaciones(−)** sobre `src/dominio/` | Por encima del rango orientativo de 60–120 líneas, pero es esperable: el cambio no fue solo la política escalonada (CP-01), sino también el desglose de cartera por tramo, la suspensión de interés corriente y los gastos de gestión de cobro — funcionalidad adicional del Proyecto 2, no solo el requisito puntual de la sección 7. |

**`git diff --stat` real (`entrega-p1` = `fb1c184` → `58392d3`):**

```
 src/dominio/cartera.ts                            | 161 ++++++++++++++++++++
 src/dominio/credito.ts                            |  81 ++++++++++-
 src/dominio/politica-mora/catalogo-politicas.ts   |  26 ++++
 src/dominio/politica-mora/gasto-gestion-cobro.ts  |  50 +++++++
 src/dominio/politica-mora/politica-escalonada.ts  | 170 ++++++++++++++++++++++
 src/dominio/politica-mora/politica-mora.ts        |  16 ++
 src/dominio/politica-mora/politica-plana.ts       |  39 +++++
 src/dominio/politica-mora/politica-retroactiva.ts |  52 +++++++
 src/dominio/suspension-interes.ts                 |  87 +++++++++++
 9 files changed, 678 insertions(+), 4 deletions(-)
```

---

## 3. Los cinco principios, con evidencia (sección 8.2)

| Principio | Pregunta | Evidencia concreta |
|---|---|---|
| **S — Responsabilidad única** | ¿Quién decide en qué tramo está una cuota, y quién decide cuánto cuesta ese tramo? | Son clases distintas y probadas por separado: `ClasificadorMora` (en `cartera.ts`) decide el tramo a partir de los días de atraso; `PoliticaMoraEscalonada` (en `politica-mora/politica-escalonada.ts`) decide cuánto cuesta cada tramo, leyendo la tabla `TABLA_MORA_ESCALONADA`. `Credito.calcularInteresMoratorio()` no calcula nada: solo conoce su propia `fechaOtorgamiento` (Information Expert) y delega. |
| **O — Abierto/cerrado** | ¿Se pudo agregar la política escalonada sin abrir el motor de cálculo? | Sí. `calculadora-mora.ts` tiene 0 líneas de diferencia contra el proyecto 1. La política escalonada vive en un archivo nuevo (`politica-escalonada.ts`) que implementa el puerto `PoliticaMora`; la conexión con `Credito` se hizo agregando un método nuevo (`calcularInteresMoratorio`), no modificando la lógica de estados existente. |
| **L — Sustitución de Liskov** | ¿Se pueden intercambiar la política plana, la escalonada y la retroactiva sin romper invariantes? | `tests/politica-mora/contrato-politica.test.ts` ejecuta la misma batería (interés nunca excede el capital, monotonía creciente, rechazo de capital cero) contra las tres implementaciones (`PoliticaMoraPlana`, `PoliticaMoraEscalonada`, `PoliticaMoraRetroactiva`) sin diferenciar casos por tipo concreto. |
| **I — Segregación de interfaces** | ¿El puerto `PoliticaMora` expone solo lo que el motor necesita? | La interfaz (`politica-mora.ts`) tiene un único método: `calcularInteresMoratorio(datos: DatosPoliticaMora): Dinero`. Ninguna de las tres implementaciones lanza "no soportado" ni deja métodos vacíos. |
| **D — Inversión de dependencias** | ¿`Credito` depende de la abstracción o de una política concreta? | `Credito.calcularInteresMoratorio(catalogo: CatalogoPoliticas, capitalEnMora: Dinero)` recibe `CatalogoPoliticas` inyectado como parámetro. `Credito` no importa `PoliticaMoraPlana` ni `PoliticaMoraEscalonada` por nombre concreto; solo conoce el tipo `CatalogoPoliticas`, que a su vez expone `PoliticaMora` (la abstracción) como tipo de retorno de `resolver()`. |

**GRASP:**
- **Experto en información:** `Credito` es quien conoce su `fechaOtorgamiento` y sus `diasAtraso`; por eso es quien resuelve la política y arma los datos que la política necesita, en vez de que un caso de uso externo tenga que extraer esos datos y ensamblarlos.
- **Polimorfismo, no switch:** `CatalogoPoliticas.resolver()` retorna una instancia de `PoliticaMora`; la decisión se resuelve con despacho polimórfico sobre esa interfaz, no con un `switch` sobre un enum de tipo de política.

---

## 4. Puntos de fricción

- **`tests/credito.test.ts`** tuvo que abrirse porque el constructor de `Credito` ganó un parámetro obligatorio (`fechaOtorgamiento`). Esto no es una señal de acoplamiento del diseño original: es el costo esperado de agregar un dato de dominio que el P1 nunca modeló (el P1 no necesitaba saber cuándo se otorgó el crédito, porque solo existía una política).
- **`cartera.ts`** se amplió (no se reescribió) para exponer el desglose por tramo que pide 7.8; se agregaron tipos y un método (`calcularPorTramo`) sin tocar `ClasificadorMora` ni `CalculadoraCarteraRiesgo.calcular()` original.
- **`CatalogoPoliticas`** existía en el repositorio desde antes pero no estaba conectado a ningún flujo real (solo se probaba con datos sueltos `{capitalEnMora, diasAtraso}`, nunca con un `Credito`). El punto de fricción real no fue de diseño sino de integración pendiente: la pieza estaba construida pero aislada.

---

## 5. Resultado de las pruebas

 ✓ tests/plan-amortizacion.test.ts (9 tests) 15ms
 ✓ tests/credito.test.ts (17 tests) 10ms
 ✓ tests/politica-mora/contrato-politica.test.ts (14 tests) 10ms
 ✓ tests/cartera.test.ts (16 tests) 11ms
 ✓ tests/cartera-por-tramo.test.ts (4 tests) 9ms
 ✓ tests/politica-mora/politica-mora.test.ts (12 tests) 11ms
 ✓ tests/prelacion-pago.test.ts (9 tests) 9ms
 ✓ tests/calculadora-mora.test.ts (8 tests) 8ms
 ✓ tests/dinero.test.ts (8 tests) 6ms
 ✓ tests/gasto-gestion-cobro.test.ts (4 tests) 5ms
 ✓ tests/suspension-interes.test.ts (4 tests) 3ms

 Test Files  11 passed (11)
      Tests  105 passed (105)
   Start at  19:34:29
   Duration  2.45s (transform 584ms, setup 0ms, collect 1.52s, tests 96ms, environment 5ms, prepare 1.90s)

---

## 6. Conclusión


El diseño del Proyecto 1 aplicó correctamente el patrón Strategy para la
política de mora: el motor de cálculo (`calculadora-mora.ts`) nunca tuvo
que modificarse para absorber el cambio de requisito. Sin embargo, el
cumplimiento de SOLID no era completo por sí solo — `CatalogoPoliticas`
existía como pieza aislada, sin ningún punto del dominio que la
consumiera con datos reales. La evolución del P2 consistió en cerrar esa
integración (conectar `Credito` con el catálogo vía `fechaOtorgamiento`)
sin abrir el motor. Lo que se haría distinto: Si el P1 hubiera incluido `fechaOtorgamiento` desde el
inicio como dato del crédito, aunque no hubiera política que la
necesitara todavía, esta integración habría costado cero cambios en el
constructor de `Credito`.]
