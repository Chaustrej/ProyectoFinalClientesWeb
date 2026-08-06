# LeagueHub — Gestor de Liga Deportiva

Aplicación web SPA para gestionar ligas deportivas amateur multi-deporte, con dos modalidades de torneo con su liga y eliminación directa, estadísticas, gráficos y persistencia local en IndexedDB.

## 1. Integrantes y división del trabajo

- **[Juan Chaustre]** —  footer.js, toast.js,leagues,matches.js,players.js,teamDetail.js,app,router.js,sports-terms.js
- **[Nestor Rincon]** —  confirmDialog.js, navbar.js, dashboard.js, matchDetail.js, playerDetail.js, stats.js, teams.js, charts.js, seedData.js

Responsabilidades conjuntas: diseño de la db.js,README.md y Style.css

## 2. Catálogo de deportes soportados

La aplicación soporta 3 deportes mediante un mapa de terminología centralizado en `js/sports-terms.js`. La lógica interna (reglas de puntuación, estructura de datos) es idéntica en los tres; solo cambian las etiquetas visibles.

| Concepto | Fútbol ⚽ | Básquet 🏀 | Vóley 🏐 |
|---|---|---|---|
| Evento de anotación | Gol | Canasta | Punto |
| Etiqueta a favor | GF | PF | PF |
| Etiqueta en contra | GC | PC | PC |
| Ranking de anotadores | Goleadores | Encestadores | Anotadores |

## 3. Instrucciones para ejecutar

No requiere instalación ni servidor local.

1. Clona o descarga este repositorio.
2. Abre el archivo `index.html` directamente en un navegador moderno (Chrome, Firefox o Edge recomendados).
3. La aplicación crea automáticamente la base de datos `leaguehub-db` en IndexedDB la primera vez que se abre.
4. Para probar rápido: ve a **Ligas → Cargar liga de ejemplo**, que inserta una liga con 4 equipos y jugadores de muestra listos para generar el fixture.

## 4. Componentes implementados

| Componente | Ubicación | Responsabilidad |
|---|---|---|
| `NavBar` | `index.html` + `components/navbar.js` | Navegación global, indicador de liga activa y vista resaltada |
| `LeagueCard` | `views/leagues.js` | Tarjeta de una liga en el listado, con acciones de activar/exportar |
| `TeamCard` | `views/teams.js` | Tarjeta de equipo con escudo, colores y acciones |
| `PlayerCard` | `views/players.js` | Tarjeta de jugador con foto, número, posición y equipo |
| `MatchCard` | `views/matches.js`, `dashboard.js` | Tarjeta de partido con marcador o estado |
| `StandingsTable` | `views/stats.js` | Tabla de posiciones (modalidad liga) |
| `BracketView` | `views/stats.js` | Representación visual del bracket (modalidad eliminación directa) |
| `RankingTable` | `views/stats.js` | Tabla de top anotadores |
| `EventForm` | `views/matchDetail.js` | Sub-formulario para registrar una anotación en un partido |
| `ChartContainer` | `js/charts.js` | Funciones reutilizables que envuelven Chart.js (barras, líneas, torta, horizontal) |
| `ConfirmDialog` | `components/confirmDialog.js` | Diálogo modal de confirmación reutilizable (reemplaza `confirm()`) |
| `Toast` | `components/toast.js` | Notificaciones flotantes de éxito/error (reemplaza `alert()`) |


## 5. Esquema de IndexedDB



Base de datos: `leaguehub-db`

| Object Store | Índices | Relación |
|---|---|---|
| `leagues` | `by_name` (único), `by_active` | Raíz del modelo |
| `teams` | `by_league`, `by_name` | Pertenece a una `league` (`leagueId`) |
| `players` | `by_team`, `by_name` | Pertenece a un `team` (`teamId`) |
| `matches` | `by_league`, `by_home`, `by_away`, `by_date`, `by_status` | Pertenece a una `league`; referencia dos `teams` (`homeTeamId`, `awayTeamId`); en eliminación directa referencia al siguiente partido (`nextMatchId`) |
| `events` | `by_match`, `by_player` | Pertenece a un `match` (`matchId`) y a un `player` (`playerId`) |

Todas las operaciones pasan por la capa centralizada en `db.js` — ningún componente abre una transacción de IndexedDB directamente.

## 6. Decisiones técnicas relevantes

**Transacciones de integridad.** Las operaciones que afectan más de una entidad (finalizar partido, deshacer partido, eliminar equipo en cascada, activar liga, importar liga) se ejecutan dentro de una única transacción `readwrite` sobre todos los object stores involucrados. Si cualquier paso falla, `tx.onabort` revierte todo automáticamente, evitando estados intermedios inconsistentes (por ejemplo, un partido marcado como finalizado sin que las estadísticas de los equipos se hayan actualizado).

**Cálculo de la tabla de posiciones.** Se ordena por puntos ejemplo: 3 victoria / 1 empate / 0 derrota, y en caso de empate se desempata primero por diferencia de gol y luego por goles a favor.

**Adaptación por deporte.** Es puramente cosmética: un objeto central en `sports-terms.js` mapea cada deporte a sus etiquetas visibles como nombre del evento de anotación, etiquetas de tabla, ranking, ícono y color. Ningún componente tiene strings de deporte hardcodeados; todos leen del mapa según el deporte de la liga activa.

**Generación de bracket** El sorteo de la primera ronda es aleatorio. Las rondas siguientes se generan como partidos "plantilla" con equipos `null` (estado `pendiente`), enlazados mediante el campo `nextMatchId`. Al finalizar un partido, el ganador se coloca automáticamente en el slot vacío del partido siguiente, dentro de la misma transacción de "Finalizar partido".

**Eventos en memoria antes de finalizar.** Mientras un partido está "Programado", las anotaciones que se van agregando se mantienen en un array en memoria (no se persisten en IndexedDB todavía). Solo se guardan en la base de datos como parte de la transacción de "Finalizar partido", junto con la actualización de estadísticas.

**Limitación conocida en importación.** Al importar una liga en modalidad eliminación directa, el campo `nextMatchId` (enlace entre rondas del bracket) no se remapea automáticamente a los nuevos IDs generados — los partidos importados quedan sin ese enlace. El resto de los datos (equipos, jugadores, partidos, eventos, marcadores) se restaura correctamente.

## 7. Capturas de pantalla

- [![alt text](/capture/image.png) ] Dashboard (`#dashboard`)
- [ ![alt text](/capture/image-1.png)] Ligas (`#leagues`)
- [![alt text](/capture/image-2.png) ] Equipos (`#teams`)
- [![alt text](/capture/image-3.png) ] Detalle de Equipo (`#team/:id`)
- [ ![alt text](/capture/image-4.png)] Jugadores (`#players`)
- [ ![alt text](/capturei/mage-5.png)] Detalle de Jugador (`#player/:id`)
- [ ![alt text](/capture/image-6.png)] Partidos (`#matches`)
- [![alt text](/capture/image-7.png) ] Detalle de Partido (`#match/:id`)
- [![alt text](/capture/image-8.png) ] Estadísticas (`#stats`) 

## 8. Tecnologías

HTML, CSS y JavaScript vanilla (sin frameworks). Chart.js como única librería externa, cargada desde CDN, usada para los 6 gráficos de `#dashboard` y `#stats`.
