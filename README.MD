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