
import { add } from './db.js';
async function seedSampleLeague() {
  const leagueId = await add('leagues', {
    name: 'Liga Demo Fútbol',
    sport: 'futbol',
    mode: 'liga',
    season: '2026-I',
    isActive: false,
    roundFormat: 'una',
    bracketSize: null
  });

  const teamNames = ['Halcones FC', 'Tigres United', 'Cóndores', 'Lobos FC'];
  const teamIds = [];

  for (const name of teamNames) {
    const teamId = await add('teams', {
      name,
      shield: null,
      primaryColor: '#' + Math.floor(Math.random() * 16777215).toString(16),
      secondaryColor: '#ffffff',
      city: 'Ciudad Demo',
      leagueId,
      played: 0, won: 0, drawn: 0, lost: 0,
      scoredFor: 0, scoredAgainst: 0, points: 0
    });
    teamIds.push(teamId);
  }

  const playerNames = ['Ana Gómez', 'Luis Torres', 'Carla Ruiz', 'Diego Paz', 'Sofía León'];
  for (const teamId of teamIds) {
    for (let i = 0; i < 3; i++) {
      await add('players', {
        name: playerNames[Math.floor(Math.random() * playerNames.length)] + ' ' + (i + 1),
        photo: null,
        position: ['Delantero', 'Mediocampo', 'Defensa'][i % 3],
        number: i + 1,
        teamId,
        matchesPlayed: 0,
        totalScored: 0
      });
    }
  }

  return leagueId;
}

export { seedSampleLeague };