
const SPORTS_TERMS = {
  futbol: {
    nombre: 'Fútbol',
    eventoAnotacion: 'Gol',
    eventoAnotacionPlural: 'Goles',
    etiquetaFavor: 'GF',
    etiquetaContra: 'GC',
    rankingAnotadores: 'Goleadores',
    icono: '⚽',
    colorPrimario: '#2e7d32'
  },
  basquet: {
    nombre: 'Básquet',
    eventoAnotacion: 'Canasta',
    eventoAnotacionPlural: 'Canastas',
    etiquetaFavor: 'PF',
    etiquetaContra: 'PC',
    rankingAnotadores: 'Encestadores',
    icono: '🏀',
    colorPrimario: '#e65100'
  },
  voley: {
    nombre: 'Vóley',
    eventoAnotacion: 'Punto',
    eventoAnotacionPlural: 'Puntos',
    etiquetaFavor: 'PF',
    etiquetaContra: 'PC',
    rankingAnotadores: 'Anotadores',
    icono: '🏐',
    colorPrimario: '#1565c0'
  }
};

function getTerms(sportCode) {
  return SPORTS_TERMS[sportCode] || SPORTS_TERMS.futbol;
}

export { SPORTS_TERMS, getTerms };