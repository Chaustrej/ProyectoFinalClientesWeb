const DB_NAME = 'leaguehub-db';
const DB_VERSION = 1;
let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('leagues')) {
        const leagues = db.createObjectStore('leagues', { keyPath: 'id', autoIncrement: true });
        leagues.createIndex('by_name', 'name', { unique: true });
        leagues.createIndex('by_active', 'isActive', { unique: false });
      }

      if (!db.objectStoreNames.contains('teams')) {
        const teams = db.createObjectStore('teams', { keyPath: 'id', autoIncrement: true });
        teams.createIndex('by_league', 'leagueId', { unique: false });
        teams.createIndex('by_name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains('players')) {
        const players = db.createObjectStore('players', { keyPath: 'id', autoIncrement: true });
        players.createIndex('by_team', 'teamId', { unique: false });
        players.createIndex('by_name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains('matches')) {
        const matches = db.createObjectStore('matches', { keyPath: 'id', autoIncrement: true });
        matches.createIndex('by_league', 'leagueId', { unique: false });
        matches.createIndex('by_home', 'homeTeamId', { unique: false });
        matches.createIndex('by_away', 'awayTeamId', { unique: false });
        matches.createIndex('by_date', 'date', { unique: false });
        matches.createIndex('by_status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains('events')) {
        const events = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
        events.createIndex('by_match', 'matchId', { unique: false });
        events.createIndex('by_player', 'playerId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

function getStore(storeName, mode = 'readonly') {
  const tx = dbInstance.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

function add(storeName, data) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readwrite');
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readonly');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readonly');
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function update(storeName, data) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readwrite');
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getById(storeName, id) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readonly');
    const request = store.get(Number(id));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function remove(storeName, id) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readwrite');
    const request = store.delete(Number(id));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --- Ligas ---

function getAllLeagues() {
  return getAll('leagues');
}

function setActiveLeague(leagueId) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('leagues', 'readwrite');
    const store = tx.objectStore('leagues');
    const request = store.getAll();

    request.onsuccess = () => {
      const leagues = request.result;
      leagues.forEach((league) => {
        league.isActive = (league.id === Number(leagueId));
        store.put(league);
      });
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Transacción cancelada'));
  });
}

async function getActiveLeague() {
  const leagues = await getAllLeagues();
  return leagues.find(l => l.isActive) || null;
}

// --- Equipos ---

function getTeamsByLeague(leagueId) {
  return getAllByIndex('teams', 'by_league', Number(leagueId));
}

function getMatchesByTeam(teamId) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('matches', 'readonly');
    const store = tx.objectStore('matches');
    const homeIndex = store.index('by_home');
    const awayIndex = store.index('by_away');
    const results = [];

    homeIndex.getAll(Number(teamId)).onsuccess = (e) => {
      results.push(...e.target.result);
      awayIndex.getAll(Number(teamId)).onsuccess = (e2) => {
        results.push(...e2.target.result);
        resolve(results);
      };
    };

    tx.onerror = () => reject(tx.error);
  });
}

function deleteTeamCascade(teamId) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(['teams', 'players'], 'readwrite');
    const teamsStore = tx.objectStore('teams');
    const playersStore = tx.objectStore('players');
    const playersIndex = playersStore.index('by_team');

    const request = playersIndex.getAll(Number(teamId));
    request.onsuccess = () => {
      request.result.forEach(player => {
        playersStore.delete(player.id);
      });
      teamsStore.delete(Number(teamId));
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Transacción cancelada'));
  });
}

function deleteLeagueCascade(leagueId) {
  return new Promise((resolve, reject) => {
    const id = Number(leagueId);
    const tx = dbInstance.transaction(
      ['leagues', 'teams', 'players', 'matches', 'events'],
      'readwrite'
    );
    const leaguesStore = tx.objectStore('leagues');
    const teamsStore = tx.objectStore('teams');
    const playersStore = tx.objectStore('players');
    const matchesStore = tx.objectStore('matches');
    const eventsStore = tx.objectStore('events');

    const teamsIndex = teamsStore.index('by_league');
    const playersIndex = playersStore.index('by_team');
    const matchesIndex = matchesStore.index('by_league');
    const eventsIndex = eventsStore.index('by_match');

    const leagueRequest = leaguesStore.get(id);

    leagueRequest.onsuccess = () => {
      const league = leagueRequest.result;
      if (!league) {
        tx.abort();
        return;
      }
      const wasActive = league.isActive;

      const teamsRequest = teamsIndex.getAll(id);
      teamsRequest.onsuccess = () => {
        teamsRequest.result.forEach(team => {
          const playersRequest = playersIndex.getAll(team.id);
          playersRequest.onsuccess = () => {
            playersRequest.result.forEach(p => playersStore.delete(p.id));
          };
          teamsStore.delete(team.id);
        });
      };

      const matchesRequest = matchesIndex.getAll(id);
      matchesRequest.onsuccess = () => {
        matchesRequest.result.forEach(match => {
          const eventsRequest = eventsIndex.getAll(match.id);
          eventsRequest.onsuccess = () => {
            eventsRequest.result.forEach(ev => eventsStore.delete(ev.id));
          };
          matchesStore.delete(match.id);
        });
      };

      leaguesStore.delete(id);

      if (wasActive) {
        const allLeaguesRequest = leaguesStore.getAll();
        allLeaguesRequest.onsuccess = () => {
          const remaining = allLeaguesRequest.result.filter(l => l.id !== id);
          if (remaining.length > 0) {
            remaining[0].isActive = true;
            leaguesStore.put(remaining[0]);
          }
        };
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('No se pudo eliminar la liga. Intenta de nuevo.'));
  });
}
// --- Detalle de equipo ---

function getPlayersByTeam(teamId) {
  return getAllByIndex('players', 'by_team', Number(teamId));
}

async function getUpcomingMatchesByTeam(teamId) {
  const matches = await getMatchesByTeam(teamId);
  return matches
    .filter(m => m.status === 'programado')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function getFinishedMatchesByTeam(teamId) {
  const matches = await getMatchesByTeam(teamId);
  return matches
    .filter(m => m.status === 'finalizado')
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function getTeamPosition(teamId, leagueId) {
  const teams = await getTeamsByLeague(leagueId);
  const sorted = [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = a.scoredFor - a.scoredAgainst;
    const diffB = b.scoredFor - b.scoredAgainst;
    if (diffB !== diffA) return diffB - diffA;
    return b.scoredFor - a.scoredFor;
  });
  return sorted.findIndex(t => t.id === Number(teamId)) + 1;
}

// --- Jugadores ---

async function getPlayersByLeague(leagueId) {
  const teams = await getTeamsByLeague(leagueId);
  const allPlayers = [];

  for (const team of teams) {
    const players = await getPlayersByTeam(team.id);
    players.forEach(p => {
      p.teamName = team.name;
      p.teamPrimaryColor = team.primaryColor;
    });
    allPlayers.push(...players);
  }

  return allPlayers;
}

function getEventsByPlayer(playerId) {
  return getAllByIndex('events', 'by_player', Number(playerId));
}

async function getPlayerMatchHistory(playerId) {
  const events = await getEventsByPlayer(playerId);
  const matchIds = [...new Set(events.map(e => e.matchId))];
  const history = [];

  for (const matchId of matchIds) {
    const match = await getById('matches', matchId);
    if (!match) continue;
    const scoredInThisMatch = events.filter(e => e.matchId === matchId).length;
    history.push({ match, scored: scoredInThisMatch });
  }

  history.sort((a, b) => new Date(b.match.date) - new Date(a.match.date));
  return history;
}

// --- Generación de Fixture  ---

function generateFixture(leagueId, teams, roundFormat) {
  return new Promise((resolve, reject) => {
    const matches = [];
    const startDate = new Date();
    let matchDay = 0;

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + matchDay * 7);

        matches.push({
          leagueId: Number(leagueId),
          homeTeamId: teams[i].id,
          awayTeamId: teams[j].id,
          date: date.toISOString(),
          status: 'programado',
          homeScore: null,
          awayScore: null,
          round: null,
          nextMatchId: null
        });
        matchDay++;
      }
    }

    if (roundFormat === 'doble') {
      const returnMatches = matches.map(m => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + matchDay * 7);
        matchDay++;
        return {
          ...m,
          homeTeamId: m.awayTeamId,
          awayTeamId: m.homeTeamId,
          date: date.toISOString()
        };
      });
      matches.push(...returnMatches);
    }

    const tx = dbInstance.transaction('matches', 'readwrite');
    const store = tx.objectStore('matches');

    matches.forEach(match => store.add(match));

    tx.oncomplete = () => resolve(matches.length);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Transacción cancelada'));
  });
}

// --- Generación de Bracket  ---

function getRoundName(matchesInRound, totalTeams) {
  if (totalTeams === 4) {
    return matchesInRound === 2 ? 'Semifinal' : 'Final';
  }
  if (totalTeams === 8) {
    if (matchesInRound === 4) return 'Cuartos de Final';
    if (matchesInRound === 2) return 'Semifinal';
    return 'Final';
  }
  if (matchesInRound === 8) return 'Octavos de Final';
  if (matchesInRound === 4) return 'Cuartos de Final';
  if (matchesInRound === 2) return 'Semifinal';
  return 'Final';
}

function generateBracket(leagueId, teams) {
  return new Promise((resolve, reject) => {
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const tx = dbInstance.transaction('matches', 'readwrite');
    const store = tx.objectStore('matches');
    const startDate = new Date();
 
   
    function addMatch(match) {
      return new Promise((res, rej) => {
        const req = store.add(match);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    }
    function getMatch(id) {
      return new Promise((res, rej) => {
        const req = store.get(id);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    }
    function putMatch(match) {
      return new Promise((res, rej) => {
        const req = store.put(match);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      });
    }
 
    (async () => {
      try {
        let totalMatchesInRound = shuffled.length / 2;
        let previousRoundMatchIds = [];
 
        for (let i = 0; i < shuffled.length; i += 2) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + 7);
 
          const newId = await addMatch({
            leagueId: Number(leagueId),
            homeTeamId: shuffled[i].id,
            awayTeamId: shuffled[i + 1].id,
            date: date.toISOString(),
            status: 'programado',
            homeScore: null,
            awayScore: null,
            round: getRoundName(totalMatchesInRound, shuffled.length),
            nextMatchId: null
          });
          previousRoundMatchIds.push(newId);
        }
 
        totalMatchesInRound = totalMatchesInRound / 2;
 
        while (totalMatchesInRound >= 1) {
          const currentRoundIds = [];
          const date = new Date(startDate);
          date.setDate(date.getDate() + 14);
 
          for (let i = 0; i < totalMatchesInRound; i++) {
            const newId = await addMatch({
              leagueId: Number(leagueId),
              homeTeamId: null,
              awayTeamId: null,
              date: date.toISOString(),
              status: 'pendiente',
              homeScore: null,
              awayScore: null,
              round: getRoundName(totalMatchesInRound, shuffled.length),
              nextMatchId: null
            });
            currentRoundIds.push(newId);
          }
 
          // Enlazamos cada par de partidos de la ronda anterior con
          // el partido correspondiente de esta ronda
          for (let i = 0; i < previousRoundMatchIds.length; i += 2) {
            const nextId = currentRoundIds[i / 2];
 
            const m1 = await getMatch(previousRoundMatchIds[i]);
            m1.nextMatchId = nextId;
            await putMatch(m1);
 
            const m2 = await getMatch(previousRoundMatchIds[i + 1]);
            m2.nextMatchId = nextId;
            await putMatch(m2);
          }
 
          previousRoundMatchIds = currentRoundIds;
          totalMatchesInRound = totalMatchesInRound / 2;
        }
 
        resolve();
      } catch (err) {
        reject(err);
      }
    })();
 
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Transacción cancelada'));
  });
}

// --- Detalle de partido: eventos ---

async function getMatchEvents(matchId) {
  const events = await getAllByIndex('events', 'by_match', Number(matchId));
  for (const ev of events) {
    const player = await getById('players', ev.playerId);
    ev.playerName = player ? player.name : 'Jugador eliminado';
    ev.teamId = player ? player.teamId : null;
  }
  return events;
}

// --- Operación de integridad: Finalizar Partido ---

function finalizeMatch(matchId, events, mode) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(['matches', 'teams', 'players', 'events'], 'readwrite');
    const matchesStore = tx.objectStore('matches');
    const teamsStore = tx.objectStore('teams');
    const playersStore = tx.objectStore('players');
    const eventsStore = tx.objectStore('events');

    const matchRequest = matchesStore.get(Number(matchId));

    matchRequest.onsuccess = () => {
      const match = matchRequest.result;
      if (!match) {
        tx.abort();
        return;
      }

      const homeScore = events.filter(e => e.team === 'home').length;
      const awayScore = events.filter(e => e.team === 'away').length;

      match.status = 'finalizado';
      match.homeScore = homeScore;
      match.awayScore = awayScore;
      matchesStore.put(match);

      const homeTeamRequest = teamsStore.get(match.homeTeamId);
      homeTeamRequest.onsuccess = () => {
        const homeTeam = homeTeamRequest.result;
        updateTeamStats(homeTeam, homeScore, awayScore);
        teamsStore.put(homeTeam);
      };

      const awayTeamRequest = teamsStore.get(match.awayTeamId);
      awayTeamRequest.onsuccess = () => {
        const awayTeam = awayTeamRequest.result;
        updateTeamStats(awayTeam, awayScore, homeScore);
        teamsStore.put(awayTeam);
      };

      const scoredByPlayer = {};
      events.forEach(ev => {
        if (ev.playerId === null || ev.playerId === undefined) return;
        scoredByPlayer[ev.playerId] = (scoredByPlayer[ev.playerId] || 0) + 1;
      });

      Object.keys(scoredByPlayer).forEach(playerId => {
        const playerRequest = playersStore.get(Number(playerId));
        playerRequest.onsuccess = () => {
          const player = playerRequest.result;
          player.matchesPlayed += 1;
          player.totalScored += scoredByPlayer[playerId];
          playersStore.put(player);
        };
      });

      events.forEach(ev => {
        if (ev.playerId === null || ev.playerId === undefined) return;
        eventsStore.add({
          matchId: Number(matchId),
          playerId: Number(ev.playerId),
          type: ev.type || 'anotacion',
          minute: ev.minute || null
        });
      });

      if (mode === 'eliminacion' && match.nextMatchId) {
        const winnerTeamId = homeScore > awayScore ? match.homeTeamId : match.awayTeamId;

        const nextMatchRequest = matchesStore.get(match.nextMatchId);
        nextMatchRequest.onsuccess = () => {
          const nextMatch = nextMatchRequest.result;
          if (!nextMatch) return;

          if (nextMatch.homeTeamId === null) {
            nextMatch.homeTeamId = winnerTeamId;
          } else {
            nextMatch.awayTeamId = winnerTeamId;
          }

          if (nextMatch.homeTeamId !== null && nextMatch.awayTeamId !== null) {
            nextMatch.status = 'programado';
          }

          matchesStore.put(nextMatch);
        };
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('No se pudo finalizar el partido. Intenta de nuevo.'));
  });
}

function updateTeamStats(team, scoredFor, scoredAgainst) {
  team.played += 1;
  team.scoredFor += scoredFor;
  team.scoredAgainst += scoredAgainst;

  if (scoredFor > scoredAgainst) {
    team.won += 1;
    team.points += 3;
  } else if (scoredFor === scoredAgainst) {
    team.drawn += 1;
    team.points += 1;
  } else {
    team.lost += 1;
  }
}

// --- Operación de integridad inversa: Deshacer Partido ---

function undoMatch(matchId, mode) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(['matches', 'teams', 'players', 'events'], 'readwrite');
    const matchesStore = tx.objectStore('matches');
    const teamsStore = tx.objectStore('teams');
    const playersStore = tx.objectStore('players');
    const eventsStore = tx.objectStore('events');
    const eventsIndex = eventsStore.index('by_match');

    const matchRequest = matchesStore.get(Number(matchId));

    matchRequest.onsuccess = () => {
      const match = matchRequest.result;
      if (!match || match.status !== 'finalizado') {
        tx.abort();
        return;
      }

      if (mode === 'eliminacion' && match.nextMatchId) {
        const nextMatchRequest = matchesStore.get(match.nextMatchId);
        nextMatchRequest.onsuccess = () => {
          const nextMatch = nextMatchRequest.result;
          if (nextMatch && nextMatch.status === 'finalizado') {
            tx.abort();
            return;
          }
          proceedUndo();
        };
      } else {
        proceedUndo();
      }

      function proceedUndo() {
        const homeScore = match.homeScore;
        const awayScore = match.awayScore;

        match.status = 'programado';
        match.homeScore = null;
        match.awayScore = null;
        matchesStore.put(match);

        const homeTeamRequest = teamsStore.get(match.homeTeamId);
        homeTeamRequest.onsuccess = () => {
          const homeTeam = homeTeamRequest.result;
          revertTeamStats(homeTeam, homeScore, awayScore);
          teamsStore.put(homeTeam);
        };

        const awayTeamRequest = teamsStore.get(match.awayTeamId);
        awayTeamRequest.onsuccess = () => {
          const awayTeam = awayTeamRequest.result;
          revertTeamStats(awayTeam, awayScore, homeScore);
          teamsStore.put(awayTeam);
        };

        const eventsRequest = eventsIndex.getAll(Number(matchId));
        eventsRequest.onsuccess = () => {
          const events = eventsRequest.result;
          const scoredByPlayer = {};
          events.forEach(ev => {
            scoredByPlayer[ev.playerId] = (scoredByPlayer[ev.playerId] || 0) + 1;
          });

          Object.keys(scoredByPlayer).forEach(playerId => {
            const playerRequest = playersStore.get(Number(playerId));
            playerRequest.onsuccess = () => {
              const player = playerRequest.result;
              player.matchesPlayed = Math.max(0, player.matchesPlayed - 1);
              player.totalScored = Math.max(0, player.totalScored - scoredByPlayer[playerId]);
              playersStore.put(player);
            };
          });
        };

        if (mode === 'eliminacion' && match.nextMatchId) {
          const nextMatchRequest2 = matchesStore.get(match.nextMatchId);
          nextMatchRequest2.onsuccess = () => {
            const nextMatch = nextMatchRequest2.result;
            if (!nextMatch) return;

            if (nextMatch.homeTeamId === match.homeTeamId || nextMatch.homeTeamId === match.awayTeamId) {
              nextMatch.homeTeamId = null;
            } else if (nextMatch.awayTeamId === match.homeTeamId || nextMatch.awayTeamId === match.awayTeamId) {
              nextMatch.awayTeamId = null;
            }
            nextMatch.status = 'pendiente';
            matchesStore.put(nextMatch);
          };
        }
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('No se puede deshacer: el partido de la siguiente ronda ya está finalizado.'));
  });
}

function revertTeamStats(team, scoredFor, scoredAgainst) {
  team.played = Math.max(0, team.played - 1);
  team.scoredFor = Math.max(0, team.scoredFor - scoredFor);
  team.scoredAgainst = Math.max(0, team.scoredAgainst - scoredAgainst);

  if (scoredFor > scoredAgainst) {
    team.won = Math.max(0, team.won - 1);
    team.points = Math.max(0, team.points - 3);
  } else if (scoredFor === scoredAgainst) {
    team.drawn = Math.max(0, team.drawn - 1);
    team.points = Math.max(0, team.points - 1);
  } else {
    team.lost = Math.max(0, team.lost - 1);
  }
}

// --- Estadísticas: tabla de posiciones y rankings ---

async function getStandings(leagueId) {
  const teams = await getTeamsByLeague(leagueId);
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = a.scoredFor - a.scoredAgainst;
    const diffB = b.scoredFor - b.scoredAgainst;
    if (diffB !== diffA) return diffB - diffA;
    return b.scoredFor - a.scoredFor;
  });
}

async function getTopScorers(leagueId, limit = 10) {
  const players = await getPlayersByLeague(leagueId);
  return [...players]
    .sort((a, b) => b.totalScored - a.totalScored)
    .filter(p => p.totalScored > 0)
    .slice(0, limit);
}

async function getMatchesGroupedByRound(leagueId) {
  const matches = await getAllByIndex('matches', 'by_league', Number(leagueId));
  const grouped = {};
  matches.forEach(m => {
    const round = m.round || 'Sin ronda';
    if (!grouped[round]) grouped[round] = [];
    grouped[round].push(m);
  });
  return grouped;
}

// --- Dashboard ---

async function getNextMatch(leagueId) {
  const matches = await getAllByIndex('matches', 'by_league', Number(leagueId));
  const now = new Date();
  const upcoming = matches
    .filter(m => m.status === 'programado' && m.homeTeamId && m.awayTeamId && new Date(m.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return upcoming[0] || null;
}

async function getLastFinishedMatch(leagueId) {
  const matches = await getAllByIndex('matches', 'by_league', Number(leagueId));
  const finished = matches
    .filter(m => m.status === 'finalizado')
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return finished[0] || null;
}

// --- Datos para gráficos avanzados de Estadísticas ---

async function getPointsEvolutionByTeam(leagueId) {
  const teams = await getTeamsByLeague(leagueId);
  const matches = await getAllByIndex('matches', 'by_league', Number(leagueId));
  const finished = matches
    .filter(m => m.status === 'finalizado')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const evolution = {};
  teams.forEach(t => { evolution[t.id] = []; });

  const runningPoints = {};
  teams.forEach(t => { runningPoints[t.id] = 0; });

  const dateLabels = [];

  finished.forEach(match => {
    dateLabels.push(new Date(match.date).toLocaleDateString());

    const homePts = match.homeScore > match.awayScore ? 3 : match.homeScore === match.awayScore ? 1 : 0;
    const awayPts = match.awayScore > match.homeScore ? 3 : match.homeScore === match.awayScore ? 1 : 0;

    runningPoints[match.homeTeamId] += homePts;
    runningPoints[match.awayTeamId] += awayPts;

    teams.forEach(t => {
      evolution[t.id].push(runningPoints[t.id]);
    });
  });

  return { teams, dateLabels, evolution };
}

async function getScoresByRound(leagueId) {
  const matches = await getAllByIndex('matches', 'by_league', Number(leagueId));
  const finished = matches.filter(m => m.status === 'finalizado');

  const byRound = {};
  finished.forEach(m => {
    const round = m.round || 'Sin ronda';
    if (!byRound[round]) byRound[round] = 0;
    byRound[round] += (m.homeScore + m.awayScore);
  });

  return byRound;
}
