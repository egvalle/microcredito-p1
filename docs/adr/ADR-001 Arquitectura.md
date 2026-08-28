## ADR-001 – Adopción de arquitectura hexagonal

ADR-001

Estado: Aceptado

Fecha: 27/08/2026

## Contexto

Crédito Vecino, S.A. desarrolla un sistema de microcrédito que cubre clientes, solicitudes, evaluación, desembolso, amortización, intereses, pagos, cartera, mora y cierres. El proyecto está en etapa inicial y busca un núcleo de dominio sólido, sin acoplarlo aún a frameworks, base de datos, autenticación, chat o MCP, ya que estos canales se agregarán después.

## Problema / fuerzas que motivan la decisión

- El dominio financiero exige exactitud y debe poder probarse sin infraestructura real.

- El sistema se expondrá a futuro por varios canales (REST, frontend, chat, MCP, batch) sin duplicar reglas de negocio.

- El equipo es pequeño y trabaja con tiempo limitado, por lo que no conviene la complejidad de servicios distribuidos.

- Se requiere alta trazabilidad y auditabilidad de las operaciones.

## Alternativas consideradas

| Alternativa | Motivo de no selección |
| --- | --- |
| Arquitectura por capas | Filtra infraestructura hacia el dominio y facilita duplicar lógica al agregar canales. |
| Microservicios | Complejidad de infraestructura distribuida injustificada para el tamaño y etapa del proyecto. |
| Hexagonal + monolito modular | Seleccionada — ver Decisión. |

## Decisión tomada

El dominio es independiente de la infraestructura y se comunica con el exterior mediante puertos. Los adaptadores (HTTP, persistencia, chat, MCP, batch) dependen de esos puertos, nunca al revés. Todos los módulos se despliegan como un único sistema (monolito), con límites internos claros.

## Justificación

Aísla el dominio financiero —el de mayor riesgo— de HTTP, PostgreSQL, autenticación y demás infraestructura, permitiendo reutilizar los casos de uso desde distintos adaptadores sin duplicar lógica. Frente a capas, evita que la persistencia contamine el negocio; frente a microservicios, evita complejidad operativa que hoy no aporta valor.

## Consecuencias positivas

- El dominio se prueba sin base de datos ni servidor HTTP.

- Nuevos canales de entrada no duplican reglas de negocio.

- Cambiar tecnología de infraestructura afecta solo a los adaptadores.

## Consecuencias negativas o costos

- Capa adicional de abstracción (puertos/adaptadores) frente a una solución más directa.

- Al ser monolito, cualquier cambio exige redesplegar todo el sistema.


## Riesgos

- Que el dominio termine dependiendo de infraestructura por falta de disciplina.

- Que los límites entre módulos se vuelvan difusos con el tiempo.

## Medidas de mitigación

- Definir los puertos antes de implementar adaptadores y revisar que el dominio no importe infraestructura.

- Mantener los módulos separados con reglas claras de dependencia entre ellos, y cubrir el dominio con pruebas automatizadas.

## Impacto sobre desarrollo, pruebas e infraestructura

Desarrollo: primero casos de uso y entidades del dominio, luego adaptadores. Pruebas: el dominio se prueba de forma aislada, sin infraestructura real. Infraestructura: no se requiere PostgreSQL ni Express en esta fase; bastan adaptadores en memoria.

## Relación con SOLID, bajo acoplamiento y alta cohesión

El dominio define los puertos y los adaptadores dependen de ellos (DIP); cada módulo agrupa responsabilidades relacionadas (SRP) y se pueden agregar adaptadores sin modificar el dominio (OCP). Esto mantiene bajo acoplamiento entre dominio e infraestructura y alta cohesión dentro de cada módulo.

## Conclusión

Se adopta arquitectura hexagonal con monolito modular por aislar el dominio financiero, evitar duplicación de lógica y mantener una complejidad operativa acorde al alcance actual del proyecto. Una eventual migración a microservicios podría evaluarse más adelante, pero no forma parte de esta decisión.
