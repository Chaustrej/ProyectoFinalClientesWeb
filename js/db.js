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