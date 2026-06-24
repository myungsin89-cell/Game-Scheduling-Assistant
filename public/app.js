/* =============================================================
 * ClassMatch Client Core Logic (app.js) - Simplified & Light Theme
 * Handles state, scheduling, standings calculation, UI rendering,
 * and data sync (LocalStorage / Remote server).
 * ============================================================= */

// 1. APPLICATION STATE
let state = {
  config: null,       // { title, sport, mannersEnabled, format, groupsCount, groupNames: [], playoffQualifiers, syncEnabled, syncUrl, adminPassword }
  teams: [],          // [ { id, name, groupIndex } ]
  matches: [],        // [ { id, type, groupIndex, round, teamA, teamB, scoreA, scoreB, winner, winnerSelect, manners: [], date, time, location, completed, teamASourceMatch, teamBSourceMatch } ]
  userRole: 'guest'   // 'guest' | 'admin'
};

const DEFAULT_PASSWORD = '0000';
let syncIntervalId = null;

// DOM ELEMENTS CACHE
const DOM = {
  app: document.getElementById('app'),
  setupWizard: document.getElementById('setup-wizard'),
  dashboard: document.getElementById('dashboard'),
  
  // Setup Wizard Steps
  wizardSteps: document.querySelectorAll('.step-indicator'),
  wizardContents: document.querySelectorAll('.wizard-step-content'),
  
  // Wizard Input Form Fields
  wizardTitle: document.getElementById('wizard-title'),
  wizardSport: document.getElementById('wizard-sport'),
  wizardSpecialToggle: document.getElementById('wizard-special-toggle'),
  wizardSpecialInput: document.getElementById('wizard-special-input'),
  specialScoresWizardContainer: document.getElementById('special-scores-wizard-container'),
  wizardGroupsCount: document.getElementById('wizard-groups-count'),
  groupNamesContainer: document.getElementById('group-names-container'),
  wizardTeamsTextarea: document.getElementById('wizard-teams-textarea'),
  wizardAutoFillBtn: document.getElementById('wizard-auto-fill-btn'),
  groupAssignmentPreview: document.getElementById('group-assignment-preview'),
  wizardPlayoffQualifiers: document.getElementById('wizard-playoff-qualifiers'),
  wizard3rdPlaceToggle: document.getElementById('wizard-3rd-place-toggle'),
  wizard3rdPlaceTournamentToggle: document.getElementById('wizard-3rd-place-tournament-toggle'),
  wizardGenerateBtn: document.getElementById('wizard-generate-btn'),
  
  // Dashboard Header & Stats
  heroTitle: document.getElementById('hero-title'),
  heroSubtitle: document.getElementById('hero-subtitle'),
  heroSportBadge: document.getElementById('hero-sport-badge'),
  progressPercent: document.getElementById('progress-percent'),
  totalMatchesCount: document.getElementById('total-matches-count'),
  completedMatchesCount: document.getElementById('completed-matches-count'),
  
  // Navigation Tabs & Panels
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  tabBtnBracket: document.getElementById('tab-btn-bracket'),
  tabBtnManners: document.getElementById('tab-btn-manners'),
  
  // Tab contents
  standingsGrids: document.getElementById('standings-grids'),
  scheduleList: document.getElementById('schedule-list'),
  bracketTree: document.getElementById('bracket-tree'),
  bracketGenerationAdmin: document.getElementById('bracket-generation-admin'),
  generateBracketBtn: document.getElementById('generate-bracket-btn'),
  specialHighlightsRow: document.getElementById('special-highlights-row'),
  specialTablesGrid: document.getElementById('special-tables-grid'),
  
  // Navbar Actions
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  adminLoginBtn: document.getElementById('admin-login-btn'),
  adminBadge: document.getElementById('admin-badge'),
  adminLogoutBtn: document.getElementById('admin-logout-btn'),
  settingsOpenBtn: document.getElementById('settings-open-btn'),
  serverBadge: document.getElementById('server-badge'),
  
  // Modals
  adminPasscodeModal: document.getElementById('admin-passcode-modal'),
  adminPasswordInput: document.getElementById('admin-password-input'),
  loginErrorMsg: document.getElementById('login-error-msg'),
  adminLoginSubmit: document.getElementById('admin-login-submit'),
  
  matchModal: document.getElementById('match-modal'),
  modalMatchId: document.getElementById('modal-match-id'),
  modalTeamAGroup: document.getElementById('modal-team-a-group'),
  modalTeamBGroup: document.getElementById('modal-team-b-group'),
  modalTeamAName: document.getElementById('modal-team-a-name'),
  modalTeamBName: document.getElementById('modal-team-b-name'),
  modalScoreA: document.getElementById('modal-score-a'),
  modalScoreB: document.getElementById('modal-score-b'),
  modalPsoBlock: document.getElementById('modal-pso-block'),
  modalPsoA: document.getElementById('modal-pso-a'),
  modalPsoB: document.getElementById('modal-pso-b'),
  modalWinnerALbl: document.getElementById('modal-winner-a-lbl'),
  modalWinnerBLbl: document.getElementById('modal-winner-b-lbl'),
  modalSpecialScoresBlock: document.getElementById('modal-special-scores-block'),
  modalDate: document.getElementById('modal-date'),
  modalTime: document.getElementById('modal-time'),
  modalLocation: document.getElementById('modal-location'),
  modalResetMatchBtn: document.getElementById('modal-reset-match-btn'),
  modalSaveMatchBtn: document.getElementById('modal-save-match-btn'),
  
  settingsModal: document.getElementById('settings-modal'),
  settingsSyncToggle: document.getElementById('settings-sync-toggle'),
  syncDetailsBlock: document.getElementById('sync-details-block'),
  settingsSyncUrl: document.getElementById('settings-sync-url'),
  settingsSyncCode: document.getElementById('settings-sync-code'),
  settingsCopyShareUrl: document.getElementById('settings-copy-share-url'),
  settingsTestConnection: document.getElementById('settings-test-connection'),
  connectionTestResult: document.getElementById('connection-test-result'),
  settingsOldPassword: document.getElementById('settings-old-password'),
  settingsNewPassword: document.getElementById('settings-new-password'),
  settingsChangePasswordBtn: document.getElementById('settings-change-password-btn'),
  passwordChangeResult: document.getElementById('password-change-result'),
  settingsExportBtn: document.getElementById('settings-export-btn'),
  settingsExportExcelBtn: document.getElementById('settings-export-excel-btn'),
  settingsImportFile: document.getElementById('settings-import-file'),
  settingsImportBtn: document.getElementById('settings-import-btn'),
  settingsResetAllBtn: document.getElementById('settings-reset-all-btn'),
  settingsTitle: document.getElementById('settings-title'),
  settingsSport: document.getElementById('settings-sport'),
  settingsSpecialInput: document.getElementById('settings-special-input'),
  
  // Schedule Filter Elements (Simplified)
  filterGroupSelect: document.getElementById('filter-group-select'),
  filterStatusSelect: document.getElementById('filter-status-select'),
  searchTeamInput: document.getElementById('search-team-input')
};

// 2. SCHEDULING ALGORITHMS (Generates matchups without date/time enforcement)

/**
 * Generates Round Robin matches using the Circle Method.
 */
function generateRoundRobin(teamsList, groupIndex, startRoundOffset = 0, repeatIndex = 0) {
  let list = [...teamsList];
  if (list.length % 2 !== 0) {
    list.push(null); // Dummy team represents a bye
  }

  const numTeams = list.length;
  const numRounds = numTeams - 1;
  const matches = [];

  let rotated = [...list];

  for (let r = 0; r < numRounds; r++) {
    const roundNumber = startRoundOffset + r + 1;
    
    for (let i = 0; i < numTeams / 2; i++) {
      const teamA = rotated[i];
      const teamB = rotated[numTeams - 1 - i];

      // A match is generated only if neither team is dummy (bye)
      if (teamA !== null && teamB !== null) {
        matches.push({
          id: `match-g${groupIndex}-r${roundNumber}-i${i}-rep${repeatIndex}`,
          type: 'league',
          groupIndex: groupIndex,
          round: roundNumber,
          teamA: teamA.id,
          teamB: teamB.id,
          scoreA: null,
          scoreB: null,
          winner: null,
          winnerSelect: 'auto',
          specialScores: {},
          date: '일정 미정',  // Default TBD
          time: '-',
          location: '-',
          completed: false
        });
      }
    }

    // Rotate elements (Circle method: keep first element fixed, rotate others)
    const next = [rotated[0]];
    next.push(rotated[rotated.length - 1]);
    for (let k = 1; k < rotated.length - 1; k++) {
      next.push(rotated[k]);
    }
    rotated = next;
  }

  return matches;
}

/**
 * Generates a single-elimination tournament bracket from a list of teams.
 * Supports dynamic size, automatically matching next power of 2 with byes.
 */
function generateTournamentBracket(teamsList, isPlayoff = false, thirdPlaceEnabled = false) {
  const count = teamsList.length;
  if (count < 2) return [];

  // 1. Determine next power of 2
  let power = 2;
  while (power < count) {
    power *= 2;
  }

  const matches = [];
  const firstRoundMatchesCount = power / 2;
  let round1Matches = [];

  // 2. Generate First Round matches (with potential byes)
  for (let i = 0; i < firstRoundMatchesCount; i++) {
    const matchId = `playoff-r1-m${i + 1}`;
    
    const teamAIdx = i * 2;
    const teamBIdx = i * 2 + 1;
    
    const teamA = teamAIdx < count ? teamsList[teamAIdx] : null;
    const teamB = teamBIdx < count ? teamsList[teamBIdx] : null;

    let completed = false;
    let winner = null;
    let scoreA = null;
    let scoreB = null;

    // Handle byes
    if (teamA === null && teamB !== null) {
      completed = true;
      winner = 'b';
      scoreA = 0;
      scoreB = 0;
    } else if (teamA !== null && teamB === null) {
      completed = true;
      winner = 'a';
      scoreA = 0;
      scoreB = 0;
    }

    const matchNode = {
      id: matchId,
      type: 'playoff',
      groupIndex: -1, 
      round: 1,
      teamA: teamA ? teamA.id : null,
      teamB: teamB ? teamB.id : null,
      teamANameOverride: teamA ? null : '부전승',
      teamBNameOverride: teamB ? null : '부전승',
      scoreA: scoreA,
      scoreB: scoreB,
      psoScoreA: null,
      psoScoreB: null,
      winner: winner,
      winnerSelect: 'auto',
      specialScores: {},
      date: '일정 미정',
      time: '-',
      location: '-',
      completed: completed,
      teamASourceMatch: null,
      teamBSourceMatch: null
    };

    matches.push(matchNode);
    round1Matches.push(matchNode);
  }

  // 3. Generate remaining rounds (Round 2, 3, etc.)
  let previousRoundMatches = round1Matches;
  let roundNum = 2;
  
  while (previousRoundMatches.length > 1) {
    const currentRoundMatchesCount = previousRoundMatches.length / 2;
    const currentRoundMatches = [];

    for (let i = 0; i < currentRoundMatchesCount; i++) {
      const matchId = `playoff-r${roundNum}-m${i + 1}`;
      const sourceMatchA = previousRoundMatches[i * 2];
      const sourceMatchB = previousRoundMatches[i * 2 + 1];

      let teamA = null;
      let teamB = null;
      let completed = false;
      let winner = null;
      let scoreA = null;
      let scoreB = null;

      // Propagate already completed matches (e.g. byes)
      if (sourceMatchA.completed) {
        teamA = sourceMatchA.winner === 'a' ? sourceMatchA.teamA : sourceMatchA.teamB;
      }
      if (sourceMatchB.completed) {
        teamB = sourceMatchB.winner === 'a' ? sourceMatchB.teamA : sourceMatchB.teamB;
      }

      const matchNode = {
        id: matchId,
        type: 'playoff',
        groupIndex: -1,
        round: roundNum,
        teamA: teamA,
        teamB: teamB,
        scoreA: scoreA,
        scoreB: scoreB,
        psoScoreA: null,
        psoScoreB: null,
        winner: winner,
        winnerSelect: 'auto',
        specialScores: {},
        date: '일정 미정',
        time: '-',
        location: '-',
        completed: completed,
        teamASourceMatch: sourceMatchA.id,
        teamBSourceMatch: sourceMatchB.id
      };

      matches.push(matchNode);
      currentRoundMatches.push(matchNode);
    }

    previousRoundMatches = currentRoundMatches;
    roundNum++;
  }

  // 4. Generate 3rd place match if enabled and teams >= 4
  if (thirdPlaceEnabled && count >= 4) {
    const finalRoundNum = roundNum - 1;
    const semifinalRoundNum = finalRoundNum - 1;
    const semiMatchAId = `playoff-r${semifinalRoundNum}-m1`;
    const semiMatchBId = `playoff-r${semifinalRoundNum}-m2`;

    let teamA = null;
    let teamB = null;
    const semiMatchA = matches.find(m => m.id === semiMatchAId);
    const semiMatchB = matches.find(m => m.id === semiMatchBId);

    if (semiMatchA && semiMatchA.completed) {
      teamA = semiMatchA.winner === 'a' ? semiMatchA.teamB : semiMatchA.teamA;
    }
    if (semiMatchB && semiMatchB.completed) {
      teamB = semiMatchB.winner === 'a' ? semiMatchB.teamB : semiMatchB.teamA;
    }

    matches.push({
      id: 'playoff-3rd',
      type: 'playoff',
      groupIndex: -1,
      round: finalRoundNum, // Display in the same round (column) as final
      teamA: teamA,
      teamB: teamB,
      scoreA: null,
      scoreB: null,
      psoScoreA: null,
      psoScoreB: null,
      winner: null,
      winnerSelect: 'auto',
      specialScores: {},
      date: '일정 미정',
      time: '-',
      location: '-',
      completed: false,
      teamASourceMatch: semiMatchAId,
      teamBSourceMatch: semiMatchBId
    });
  }

  return matches;
}

// Seeding top teams into playoffs in Hybrid mode
function generatePlayoffBracketFromStandings() {
  const standingsByGroup = [];
  const numGroups = state.config.groupsCount;
  
  for (let g = 0; g < numGroups; g++) {
    standingsByGroup.push(calculateLeagueStandings(g));
  }

  const qualifiersCount = parseInt(state.config.playoffQualifiers, 10);
  const playoffTeams = [];

  // Seeding
  if (numGroups === 1) {
    const list = standingsByGroup[0].map(row => row.team);
    if (qualifiersCount === 2) {
      if (list[0]) playoffTeams.push(list[0]);
      if (list[1]) playoffTeams.push(list[1]);
    } else if (qualifiersCount === 4) {
      // 1위 vs 4위, 2위 vs 3위
      if (list[0]) playoffTeams.push(list[0]);
      if (list[3]) playoffTeams.push(list[3]);
      if (list[1]) playoffTeams.push(list[1]);
      if (list[2]) playoffTeams.push(list[2]);
    } else if (qualifiersCount === 8) {
      // 1위 vs 8위, 4위 vs 5위, 2위 vs 7위, 3위 vs 6위
      if (list[0]) playoffTeams.push(list[0]);
      if (list[7]) playoffTeams.push(list[7]);
      if (list[3]) playoffTeams.push(list[3]);
      if (list[4]) playoffTeams.push(list[4]);
      if (list[1]) playoffTeams.push(list[1]);
      if (list[6]) playoffTeams.push(list[6]);
      if (list[2]) playoffTeams.push(list[2]);
      if (list[5]) playoffTeams.push(list[5]);
    } else {
      for (let rank = 0; rank < qualifiersCount; rank++) {
        if (list[rank]) playoffTeams.push(list[rank]);
      }
    }
  } else if (numGroups === 2 && qualifiersCount === 2) {
    if (standingsByGroup[0][0]) playoffTeams.push(standingsByGroup[0][0].team);
    if (standingsByGroup[1][1]) playoffTeams.push(standingsByGroup[1][1].team);
    if (standingsByGroup[1][0]) playoffTeams.push(standingsByGroup[1][0].team);
    if (standingsByGroup[0][1]) playoffTeams.push(standingsByGroup[0][1].team);
  } else {
    for (let rank = 0; rank < qualifiersCount; rank++) {
      for (let g = 0; g < numGroups; g++) {
        if (standingsByGroup[g][rank]) {
          playoffTeams.push(standingsByGroup[g][rank].team);
        }
      }
    }
  }

  if (playoffTeams.length < 2) {
    alert("결선 진출 자격을 갖춘 팀이 최소 2개팀 이상이어야 토너먼트를 진행할 수 있습니다.");
    return;
  }

  const playoffMatches = generateTournamentBracket(playoffTeams, true, state.config.thirdPlaceEnabled);
  state.matches = state.matches.filter(m => m.type !== 'playoff');
  state.matches = [...state.matches, ...playoffMatches];
}

// 3. STATS & STANDINGS CALCULATIONS

function checkHeadToHead(teamAId, teamBId) {
  // 두 팀 간의 리그 경기 결과만 필터링
  const mutualMatches = state.matches.filter(m => 
    m.completed && m.type === 'league' &&
    ((m.teamA === teamAId && m.teamB === teamBId) || (m.teamA === teamBId && m.teamB === teamAId))
  );
  
  let aWins = 0;
  let bWins = 0;
  
  mutualMatches.forEach(m => {
    if (m.winner === 'a') {
      if (m.teamA === teamAId) aWins++; else bWins++;
    } else if (m.winner === 'b') {
      if (m.teamB === teamBId) bWins++; else aWins++;
    }
  });
  
  return bWins - aWins; // 음수면 A 우위, 양수면 B 우위, 0이면 동률
}

function calculateLeagueStandings(groupIndex) {
  const groupTeams = state.teams.filter(t => t.groupIndex === groupIndex);
  
  const standings = {};
  groupTeams.forEach(t => {
    standings[t.id] = {
      team: t,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      scoreFor: 0,
      scoreAgainst: 0,
      scoreDiff: 0,
      points: 0,
      specialScoresCount: {}
    };
    if (state.config.specialScores) {
      state.config.specialScores.forEach(spec => {
        standings[t.id].specialScoresCount[spec.id] = 0;
      });
    }
  });

  const completedMatches = state.matches.filter(m => m.groupIndex === groupIndex && m.type === 'league' && m.completed);

  completedMatches.forEach(m => {
    const sA = m.scoreA || 0;
    const sB = m.scoreB || 0;
    const tA = m.teamA;
    const tB = m.teamB;

    if (!standings[tA] || !standings[tB]) return;

    standings[tA].played++;
    standings[tB].played++;
    standings[tA].scoreFor += sA;
    standings[tA].scoreAgainst += sB;
    standings[tB].scoreFor += sB;
    standings[tB].scoreAgainst += sA;

    if (m.winner === 'a') {
      standings[tA].won++;
      standings[tA].points += 3;
      standings[tB].lost++;
    } else if (m.winner === 'b') {
      standings[tB].won++;
      standings[tB].points += 3;
      standings[tA].lost++;
    } else if (m.winner === 'draw') {
      standings[tA].drawn++;
      standings[tA].points += 1;
      standings[tB].drawn++;
      standings[tB].points += 1;
    }
  });

  if (state.config.specialScores && state.config.specialScores.length > 0) {
    const allCompletedMatches = state.matches.filter(m => m.completed);
    allCompletedMatches.forEach(m => {
      if (m.specialScores) {
        Object.keys(m.specialScores).forEach(specId => {
          const teamIds = m.specialScores[specId] || [];
          teamIds.forEach(teamId => {
            if (standings[teamId]) {
              if (!standings[teamId].specialScoresCount[specId]) {
                standings[teamId].specialScoresCount[specId] = 0;
              }
              standings[teamId].specialScoresCount[specId]++;
            }
          });
        });
      }
    });
  }

  Object.values(standings).forEach(s => {
    s.scoreDiff = s.scoreFor - s.scoreAgainst;
  });

  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    
    // 승자승 (H2H) 타이 브레이커 우선 적용
    const h2h = checkHeadToHead(a.team.id, b.team.id);
    if (h2h !== 0) return h2h;
    
    if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
    if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor;
    return a.team.name.localeCompare(b.team.name);
  });
}

function calculateSpecialStandings(specId) {
  const spec = state.config.specialScores.find(s => s.id === specId);
  if (!spec) return [];

  const standings = {};
  state.teams.forEach(t => {
    standings[t.id] = {
      team: t,
      count: 0
    };
  });

  state.matches.filter(m => m.completed).forEach(m => {
    if (m.specialScores && m.specialScores[specId]) {
      m.specialScores[specId].forEach(teamId => {
        if (standings[teamId]) {
          standings[teamId].count++;
        }
      });
    }
  });

  const list = Object.values(standings);
  const name = spec.name.toLowerCase();
  const isPenalty = name.includes('벌점') || name.includes('벌') || name.includes('경고') || name.includes('패널티') || name.includes('demerit') || name.includes('penalty') || name.includes('감점');

  return list.sort((a, b) => {
    if (b.count !== a.count) {
      return isPenalty ? a.count - b.count : b.count - a.count;
    }
    return a.team.name.localeCompare(b.team.name);
  });
}

function propagateTournamentWinner(completedMatchId, winningTeamId) {
  const completedMatch = state.matches.find(m => m.id === completedMatchId);
  if (!completedMatch) return;

  let losingTeamId = null;
  if (winningTeamId) {
    losingTeamId = (winningTeamId === completedMatch.teamA) ? completedMatch.teamB : completedMatch.teamA;
  }

  state.matches.forEach(m => {
    if (m.type === 'playoff') {
      let updated = false;

      if (m.id !== 'playoff-3rd') {
        // 일반 매치: 승자를 상위 매치로 보냄
        if (m.teamASourceMatch === completedMatchId) {
          m.teamA = winningTeamId;
          updated = true;
        }
        if (m.teamBSourceMatch === completedMatchId) {
          m.teamB = winningTeamId;
          updated = true;
        }
      } else {
        // 3·4위 결정전: 패자를 매치로 보냄
        if (m.teamASourceMatch === completedMatchId) {
          m.teamA = losingTeamId;
          updated = true;
        }
        if (m.teamBSourceMatch === completedMatchId) {
          m.teamB = losingTeamId;
          updated = true;
        }
      }

      if (updated) {
        m.scoreA = null;
        m.scoreB = null;
        m.psoScoreA = null;
        m.psoScoreB = null;
        m.winner = null;
        m.completed = false;
      }
    }
  });
}

// 4. STORAGE & SYNC MODULE

function getIconForSpecialScore(name) {
  const n = name.trim();
  if (n.includes('배려') || n.includes('매너') || n.includes('친절') || n.includes('스포츠맨')) return '❤️';
  if (n.includes('벌') || n.includes('패널티') || n.includes('경고') || n.includes('감점')) return '⚠️';
  if (n.includes('질서') || n.includes('규칙') || n.includes('준수') || n.includes('정돈')) return '👍';
  if (n.includes('응원') || n.includes('협동') || n.includes('화합') || n.includes('단체')) return '📣';
  if (n.includes('득점') || n.includes('골') || n.includes('슈팅')) return '⚽';
  return '🏆';
}

function parseSpecialScoresInput(value) {
  const parts = value.split(',').map(p => p.trim()).filter(p => p.length > 0);
  return parts.map((name, index) => {
    return {
      id: `spec-${index + 1}`,
      name: name,
      icon: getIconForSpecialScore(name)
    };
  });
}

function migrateOldMannersData() {
  if (state.config) {
    if (state.config.mannersEnabled !== undefined && !state.config.specialScores) {
      if (state.config.mannersEnabled) {
        state.config.specialScores = [
          { id: 'spec-1', name: '질서 점수', icon: '👍' },
          { id: 'spec-2', name: '배려 점수', icon: '❤️' }
        ];
      } else {
        state.config.specialScores = [];
      }
      delete state.config.mannersEnabled;
    }

    if (state.matches && state.matches.length > 0) {
      state.matches.forEach(m => {
        if (m.manners && !m.specialScores) {
          m.specialScores = {};
          if (m.manners.length > 0) {
            m.specialScores['spec-2'] = [...m.manners];
          }
          delete m.manners;
        }
      });
    }
  }
}

async function loadData() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlCode = urlParams.get('code');

  if (urlCode) {
    const sanitizedCode = urlCode.replace(/[^a-zA-Z0-9-_]/g, '');
    if (sanitizedCode) {
      const syncUrl = window.location.origin;
      try {
        setServerStatus('loading');
        const res = await fetch(`${syncUrl}/api/data?code=${encodeURIComponent(sanitizedCode)}`);
        if (res.ok) {
          const remoteState = await res.json();
          if (remoteState && remoteState.config) {
            state = remoteState;
            state.config.syncEnabled = true;
            state.config.syncCode = sanitizedCode;
            state.config.syncUrl = syncUrl;
            migrateOldMannersData();
            saveStateLocally();
            setServerStatus('connected');
            return;
          } else {
            // 서버에 아직 저장된 데이터가 없는 경우, 기본 동기화 설정을 저장해두고 마법사를 보여줍니다.
            const initialSyncConfig = {
              syncEnabled: true,
              syncCode: sanitizedCode,
              syncUrl: syncUrl,
              adminPassword: DEFAULT_PASSWORD
            };
            localStorage.setItem('classmatch_config', JSON.stringify(initialSyncConfig));
            localStorage.removeItem('classmatch_teams');
            localStorage.removeItem('classmatch_matches');
            state.config = null;
            state.teams = [];
            state.matches = [];
            setServerStatus('local');
            return;
          }
        }
      } catch (err) {
        console.error("원격 서버 데이터 로드 실패.", err);
        setServerStatus('disconnected');
      }
    }
  }

  const localConfigStr = localStorage.getItem('classmatch_config');
  if (localConfigStr) {
    const tempConfig = JSON.parse(localConfigStr);
    if (tempConfig.syncEnabled) {
      const syncUrl = tempConfig.syncUrl || window.location.origin;
      try {
        setServerStatus('loading');
        const codeQuery = tempConfig.syncCode ? `?code=${encodeURIComponent(tempConfig.syncCode)}` : '';
        const res = await fetch(`${syncUrl}/api/data${codeQuery}`);
        if (!res.ok) throw new Error("서버 에러");
        
        const remoteState = await res.json();
        if (remoteState && remoteState.config) {
          state = remoteState;
          migrateOldMannersData();
          setServerStatus('connected');
          return;
        }
      } catch (err) {
        console.error("원격 서버 데이터 로드 실패. 로컬 데이터 대체.", err);
        setServerStatus('disconnected');
      }
    }
  }

  const config = localStorage.getItem('classmatch_config');
  const teams = localStorage.getItem('classmatch_teams');
  const matches = localStorage.getItem('classmatch_matches');

  if (config && teams && matches) {
    state.config = JSON.parse(config);
    state.teams = JSON.parse(teams);
    state.matches = JSON.parse(matches);
    migrateOldMannersData();
    setServerStatus('local');
  } else {
    state.config = null;
    state.teams = [];
    state.matches = [];
    setServerStatus('local');
  }
}

async function saveData() {
  if (state.config && state.config.syncEnabled) {
    saveStateLocally();
    const syncUrl = state.config.syncUrl || window.location.origin;
    try {
      setServerStatus('loading');
      const codeQuery = state.config.syncCode ? `?code=${encodeURIComponent(state.config.syncCode)}` : '';
      const res = await fetch(`${syncUrl}/api/data${codeQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: state.config,
          teams: state.teams,
          matches: state.matches
        })
      });
      if (res.ok) {
        setServerStatus('connected');
      } else {
        throw new Error("서버 저장 실패");
      }
    } catch (err) {
      console.error("서버 동기화 실패.", err);
      setServerStatus('disconnected');
    }
  } else {
    saveStateLocally();
    setServerStatus('local');
  }
}

function saveStateLocally() {
  if (state.config) {
    localStorage.setItem('classmatch_config', JSON.stringify(state.config));
    localStorage.setItem('classmatch_teams', JSON.stringify(state.teams));
    localStorage.setItem('classmatch_matches', JSON.stringify(state.matches));
  } else {
    localStorage.removeItem('classmatch_config');
    localStorage.removeItem('classmatch_teams');
    localStorage.removeItem('classmatch_matches');
  }
}

function setServerStatus(status) {
  DOM.serverBadge.className = 'sync-badge';
  const dot = DOM.serverBadge.querySelector('.badge-dot');
  const txt = DOM.serverBadge.querySelector('.badge-text');

  if (status === 'local') {
    DOM.serverBadge.classList.add('local-mode');
    txt.textContent = '로컬 저장 모드';
  } else if (status === 'connected') {
    DOM.serverBadge.classList.add('server-connected');
    txt.textContent = '서버 동기화됨';
  } else if (status === 'disconnected') {
    DOM.serverBadge.classList.add('server-disconnected');
    txt.textContent = '연결 끊김 (로컬 저장)';
  } else if (status === 'loading') {
    DOM.serverBadge.classList.add('server-connected');
    txt.textContent = '서버 통신 중...';
  }
}

// 5. VIEW RENDERING ENGINE

function renderApp() {
  if (state.config === null) {
    DOM.setupWizard.style.display = 'block';
    DOM.dashboard.style.display = 'none';
    initSetupWizard();
  } else {
    DOM.setupWizard.style.display = 'none';
    DOM.dashboard.style.display = 'block';
    
    DOM.heroTitle.textContent = state.config.title;
    DOM.heroSubtitle.textContent = `실시간 조별 순위와 경기 결과를 중계합니다.`;
    DOM.heroSportBadge.textContent = state.config.sport;
    document.title = `${state.config.title} - 경기배정도우미 스포츠 대시보드`;

    if (state.config.format === 'tournament' || state.config.format === 'hybrid') {
      DOM.tabBtnBracket.style.display = 'flex';
    } else {
      DOM.tabBtnBracket.style.display = 'none';
    }

    if (state.config.specialScores && state.config.specialScores.length > 0) {
      DOM.tabBtnManners.style.display = 'flex';
    } else {
      DOM.tabBtnManners.style.display = 'none';
    }

    populateFilterSelects();
    renderActiveTab();
    renderStats();
    renderAdminUI();
  }
}

function renderStats() {
  const total = state.matches.length;
  const completed = state.matches.filter(m => m.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  DOM.totalMatchesCount.textContent = total;
  DOM.completedMatchesCount.textContent = completed;
  DOM.progressPercent.textContent = `${percent}%`;
}

function renderActiveTab() {
  const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
  
  DOM.tabPanes.forEach(pane => {
    pane.classList.toggle('active', pane.id === activeTab);
  });

  if (activeTab === 'tab-standings') {
    renderStandingsView();
  } else if (activeTab === 'tab-schedule') {
    renderScheduleView();
  } else if (activeTab === 'tab-bracket') {
    renderBracketView();
  } else if (activeTab === 'tab-manners') {
    renderMannersView();
  }
}

function renderStandingsView() {
  DOM.standingsGrids.innerHTML = '';
  const numGroups = state.config.groupsCount;
  
  if (numGroups > 1) {
    DOM.standingsGrids.className = 'standings-grid-container cols-2';
  } else {
    DOM.standingsGrids.className = 'standings-grid-container';
  }

  for (let g = 0; g < numGroups; g++) {
    const groupName = state.config.groupNames[g] || `${String.fromCharCode(65 + g)}조`;
    const standingsList = calculateLeagueStandings(g);

    const card = document.createElement('div');
    card.className = 'board-card';
    card.style.padding = '20px';

    let specialHeaders = '';
    if (state.config.specialScores && state.config.specialScores.length > 0) {
      state.config.specialScores.forEach(spec => {
        specialHeaders += `<th>${spec.icon} ${spec.name}</th>`;
      });
    }

    let rowsHTML = '';
    standingsList.forEach((row, idx) => {
      let rankClass = 'rank-other';
      if (idx === 0) rankClass = 'rank-1';
      else if (idx === 1) rankClass = 'rank-2';
      else if (idx === 2) rankClass = 'rank-3';

      let specialTDs = '';
      if (state.config.specialScores && state.config.specialScores.length > 0) {
        state.config.specialScores.forEach(spec => {
          const count = row.specialScoresCount[spec.id] || 0;
          const isPenalty = spec.name.includes('벌점') || spec.name.includes('벌') || spec.name.includes('경고') || spec.name.includes('패널티') || spec.name.includes('demerit') || spec.name.includes('penalty') || spec.name.includes('감점');
          const colorClass = isPenalty ? 'color: var(--danger);' : 'color: var(--primary);';
          specialTDs += `<td class="bold text-center" style="${colorClass}">${count}</td>`;
        });
      }

      rowsHTML += `
        <tr>
          <td><span class="rank-badge ${rankClass}">${idx + 1}</span></td>
          <td class="team-name">${row.team.name}</td>
          <td>${row.played}</td>
          <td>${row.won}</td>
          <td>${row.drawn}</td>
          <td>${row.lost}</td>
          <td>${row.scoreFor}</td>
          <td>${row.scoreAgainst}</td>
          <td>${row.scoreDiff >= 0 ? '+' + row.scoreDiff : row.scoreDiff}</td>
          ${specialTDs}
          <td class="points">${row.points}</td>
        </tr>
      `;
    });

    const colSpanVal = 10 + (state.config.specialScores ? state.config.specialScores.length : 0);

    card.innerHTML = `
      <div class="table-title-block">
        <h3>${groupName} 순위표</h3>
      </div>
      <div class="table-container">
        <table class="standings-table">
          <thead>
            <tr>
              <th style="width: 50px;">순위</th>
              <th style="text-align: left; padding-left: 14px;">팀 이름</th>
              <th>경기수</th>
              <th>승</th>
              <th>무</th>
              <th>패</th>
              <th>득점</th>
              <th>실점</th>
              <th>득실차</th>
              ${specialHeaders}
              <th>승점</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML || `<tr><td colspan="${colSpanVal}" class="text-muted" style="padding: 20px;">등록된 팀이 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
    DOM.standingsGrids.appendChild(card);
  }
}

function populateFilterSelects() {
  const currentGroupFilter = DOM.filterGroupSelect.value || 'all';

  DOM.filterGroupSelect.innerHTML = '<option value="all">전체 보기</option>';
  for (let g = 0; g < state.config.groupsCount; g++) {
    const groupName = state.config.groupNames[g] || `${String.fromCharCode(65 + g)}조`;
    DOM.filterGroupSelect.innerHTML += `<option value="${g}">${groupName}</option>`;
  }
  if (state.config.format === 'hybrid') {
    DOM.filterGroupSelect.innerHTML += '<option value="playoff">결선 플레이오프</option>';
  }
  DOM.filterGroupSelect.value = currentGroupFilter;
}

/**
 * Renders matches in Schedule View based on simplified filters (Group, Status, Search Query).
 */
function renderScheduleView() {
  DOM.scheduleList.innerHTML = '';
  
  const groupFilter = DOM.filterGroupSelect.value;
  const statusFilter = DOM.filterStatusSelect.value;
  const searchQuery = DOM.searchTeamInput.value.trim().toLowerCase();

  const filteredMatches = state.matches.filter(m => {
    // 1. Group Filter
    if (groupFilter !== 'all') {
      if (groupFilter === 'playoff') {
        if (m.type !== 'playoff') return false;
      } else {
        if (m.groupIndex !== parseInt(groupFilter, 10) || m.type !== 'league') return false;
      }
    }
    // 2. Status Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending' && m.completed) return false;
      if (statusFilter === 'completed' && !m.completed) return false;
    }
    // 3. Search Query Filter
    if (searchQuery) {
      const teamA = state.teams.find(t => t.id === m.teamA);
      const teamB = state.teams.find(t => t.id === m.teamB);
      const nameA = teamA ? teamA.name.toLowerCase() : (m.teamANameOverride || '').toLowerCase();
      const nameB = teamB ? teamB.name.toLowerCase() : (m.teamBNameOverride || '').toLowerCase();
      if (!nameA.includes(searchQuery) && !nameB.includes(searchQuery)) return false;
    }
    return true;
  });

  if (filteredMatches.length === 0) {
    DOM.scheduleList.innerHTML = `
      <div class="board-card text-center" style="grid-column: 1 / -1; padding: 30px; color: var(--text-muted);">
        조건에 맞는 경기 일정이 존재하지 않습니다.
      </div>
    `;
    return;
  }

  // Sort: Put completed matches at the bottom, pending at the top
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });

  sortedMatches.forEach(m => {
    const card = document.createElement('div');
    card.className = 'match-card hover-card';

    let groupText = '';
    if (m.type === 'playoff') {
      groupText = '결선';
    } else {
      groupText = state.config.groupNames[m.groupIndex] || `${String.fromCharCode(65 + m.groupIndex)}조`;
    }

    const teamA = state.teams.find(t => t.id === m.teamA);
    const teamB = state.teams.find(t => t.id === m.teamB);
    const teamAName = teamA ? teamA.name : (m.teamANameOverride || '대기 중');
    const teamBName = teamB ? teamB.name : (m.teamBNameOverride || '대기 중');

    const aWinnerClass = m.completed && m.winner === 'a' ? 'winner' : '';
    const bWinnerClass = m.completed && m.winner === 'b' ? 'winner' : '';

    let scoreHTML = `<span class="score-display score-pending">대기 중</span>`;
    if (m.completed) {
      const hasPK = m.psoScoreA !== null && m.psoScoreB !== null;
      const scoreAText = hasPK ? `${m.scoreA} <span style="font-size:13px; font-weight:400; color:var(--text-muted);">(${m.psoScoreA})</span>` : m.scoreA;
      const scoreBText = hasPK ? `${m.scoreB} <span style="font-size:13px; font-weight:400; color:var(--text-muted);">(${m.psoScoreB})</span>` : m.scoreB;
      scoreHTML = `
        <span class="score-display ${aWinnerClass}">${scoreAText}</span>
        <span class="score-separator">:</span>
        <span class="score-display ${bWinnerClass}">${scoreBText}</span>
      `;
    }

    const adminBtnHTML = state.userRole === 'admin' ? `
      <button class="btn btn-outline btn-sm edit-match-btn" data-id="${m.id}" style="margin-top: 8px;">
        경기 결과 및 일정 수정
      </button>
    ` : '';

    // If date is "일정 미정" and time is "-", show cleanly
    let detailText = '';
    if (m.date === '일정 미정' && m.time === '-') {
      detailText = '일정 미정';
    } else {
      detailText = `${m.date} ${m.time} | ${m.location}`;
    }

    let mannersHTML = '';
    if (state.config.specialScores && state.config.specialScores.length > 0 && m.completed && m.specialScores) {
      Object.keys(m.specialScores).forEach(specId => {
        const spec = state.config.specialScores.find(s => s.id === specId);
        if (spec) {
          const teamIds = m.specialScores[specId] || [];
          teamIds.forEach(teamId => {
            const teamObj = state.teams.find(t => t.id === teamId);
            if (teamObj) {
              mannersHTML += `<span class="heart-indicator" style="background: var(--primary-light); border-color: var(--primary-border); color: var(--primary); margin-right: 4px; display: inline-flex; align-items: center; gap: 2px;">${spec.icon} ${teamObj.name}</span>`;
            }
          });
        }
      });
    }

    card.innerHTML = `
      <div class="match-card-header">
        <div class="match-info-meta">
          <span class="match-group-tag">${groupText}</span>
        </div>
        <span class="match-status-badge ${m.completed ? 'status-completed' : 'status-pending'}">
          ${m.completed ? '종료' : '진행 대기'}
        </span>
      </div>
      <div class="match-card-body">
        <div class="match-team team-a ${aWinnerClass}">${teamAName}</div>
        <div class="match-vs-score">${scoreHTML}</div>
        <div class="match-team team-b ${bWinnerClass}">${teamBName}</div>
      </div>
      <div class="match-card-footer">
        <div class="match-location-text">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>${detailText}</span>
        </div>
        <div class="match-manners-indication" style="display: flex; flex-wrap: wrap; gap: 4px; max-width: 60%; justify-content: flex-end;">${mannersHTML}</div>
      </div>
      ${adminBtnHTML}
    `;
    
    const btn = card.querySelector('.edit-match-btn');
    if (btn) {
      btn.addEventListener('click', () => openMatchResultModal(m.id));
    }

    DOM.scheduleList.appendChild(card);
  });
}

function renderBracketView() {
  DOM.bracketTree.innerHTML = '';
  
  const playoffMatches = state.matches.filter(m => m.type === 'playoff');
  
  if (state.config.format === 'hybrid' && playoffMatches.length === 0) {
    DOM.bracketTree.innerHTML = `
      <div class="text-center" style="padding: 30px; color: var(--text-muted); width: 100%;">
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">📊</span>
        아직 결선 플레이오프 토너먼트가 생성되지 않았습니다.<br>
        예선 리그전이 어느 정도 진행된 후, 관리자가 아래 버튼을 클릭하여 토너먼트를 즉시 생성할 수 있습니다.
      </div>
    `;
    if (state.userRole === 'admin') {
      DOM.bracketGenerationAdmin.style.display = 'block';
    } else {
      DOM.bracketGenerationAdmin.style.display = 'none';
    }
    return;
  }

  DOM.bracketGenerationAdmin.style.display = 'none';

  const rounds = {};
  playoffMatches.forEach(m => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });

  const roundKeys = Object.keys(rounds).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  roundKeys.forEach(rk => {
    const roundNumber = parseInt(rk, 10);
    const roundMatches = rounds[rk];

    const roundColumn = document.createElement('div');
    roundColumn.className = 'bracket-round';

    let roundTitle = `${roundNumber}강전`;
    const has3rdPlace = roundMatches.some(m => m.id === 'playoff-3rd');
    const normalMatchesCount = has3rdPlace ? roundMatches.length - 1 : roundMatches.length;

    if (normalMatchesCount === 1) {
      roundTitle = has3rdPlace ? '결승 및 3·4위전' : '결승전 (Final)';
    } else if (normalMatchesCount === 2) {
      roundTitle = '준결승전 (Semi-Final)';
    } else if (normalMatchesCount === 4) {
      roundTitle = '8강전';
    }

    const titleDiv = document.createElement('div');
    titleDiv.className = 'bracket-round-title';
    titleDiv.textContent = roundTitle;
    roundColumn.appendChild(titleDiv);

    // 3·4위전 매치를 결승전 매치 아래로 배치하기 위해 정렬
    const sortedRoundMatches = [...roundMatches].sort((a, b) => {
      if (a.id === 'playoff-3rd') return 1;
      if (b.id === 'playoff-3rd') return -1;
      return a.id.localeCompare(b.id);
    });

    sortedRoundMatches.forEach(m => {
      const node = document.createElement('div');
      node.className = 'bracket-match-node';
      if (m.id === 'playoff-3rd') {
        node.id = 'playoff-3rd';
      }

      const teamA = state.teams.find(t => t.id === m.teamA);
      const teamB = state.teams.find(t => t.id === m.teamB);
      
      const teamAName = teamA ? teamA.name : (m.teamANameOverride || '대기 중');
      const teamBName = teamB ? teamB.name : (m.teamBNameOverride || '대기 중');

      const aWinnerClass = m.completed && m.winner === 'a' ? 'winner' : '';
      const bWinnerClass = m.completed && m.winner === 'b' ? 'winner' : '';

      const hasPK = m.psoScoreA !== null && m.psoScoreB !== null;
      const scoreA = m.completed ? (hasPK ? `${m.scoreA}(${m.psoScoreA})` : m.scoreA) : '';
      const scoreB = m.completed ? (hasPK ? `${m.scoreB}(${m.psoScoreB})` : m.scoreB) : '';

      const editBtnHTML = state.userRole === 'admin' ? `
        <button class="btn btn-outline btn-sm edit-match-btn bracket-node-admin-btn" data-id="${m.id}">결과 입력</button>
      ` : '';

      let matchLabelHTML = '';
      if (m.id === 'playoff-3rd') {
        matchLabelHTML = `<div class="bracket-3rd-label">🥉 3·4위 결정전</div>`;
      } else if (normalMatchesCount === 1) {
        matchLabelHTML = `<div class="bracket-final-label">🏆 결승전</div>`;
      }

      node.innerHTML = `
        ${matchLabelHTML}
        <div class="bracket-node-team ${aWinnerClass}">
          <span class="bracket-node-team-name">${teamAName}</span>
          <span class="bracket-node-score">${scoreA}</span>
        </div>
        <div style="height: 1px; background: var(--primary-border); margin: 3px 0;"></div>
        <div class="bracket-node-team ${bWinnerClass}">
          <span class="bracket-node-team-name">${teamBName}</span>
          <span class="bracket-node-score">${scoreB}</span>
        </div>
        ${editBtnHTML}
      `;

      const btn = node.querySelector('.edit-match-btn');
      if (btn) {
        btn.addEventListener('click', () => openMatchResultModal(m.id));
      }

      roundColumn.appendChild(node);
    });

    DOM.bracketTree.appendChild(roundColumn);
  });
}

function renderMannersView() {
  DOM.specialHighlightsRow.innerHTML = '';
  DOM.specialTablesGrid.innerHTML = '';

  if (!state.config.specialScores || state.config.specialScores.length === 0) {
    DOM.specialHighlightsRow.innerHTML = `<div class="board-card text-center" style="padding: 20px; width: 100%; color: var(--text-muted);">활성화된 특별 부문이 없습니다.</div>`;
    return;
  }

  const numSpecs = state.config.specialScores.length;
  
  if (numSpecs === 2) {
    DOM.specialTablesGrid.className = 'special-tables-grid cols-2';
  } else if (numSpecs >= 3) {
    DOM.specialTablesGrid.className = 'special-tables-grid cols-3';
  } else {
    DOM.specialTablesGrid.className = 'special-tables-grid';
  }

  state.config.specialScores.forEach((spec, specIdx) => {
    const list = calculateSpecialStandings(spec.id);
    const topTeam = list[0] ? list[0].team.name : '-';
    const topScore = list[0] ? `${list[0].count}점` : '0점';

    const crownCard = document.createElement('div');
    let crownThemeClass = 'manners-king-gold';
    if (specIdx === 1) crownThemeClass = 'manners-queen-pink';
    else if (specIdx >= 2) {
      crownThemeClass = specIdx % 2 === 0 ? 'manners-king-gold' : 'manners-queen-pink';
    }

    crownCard.className = `board-card manners-crown-card ${crownThemeClass}`;
    
    const isPenalty = spec.name.includes('벌점') || spec.name.includes('벌') || spec.name.includes('경고') || spec.name.includes('패널티') || spec.name.includes('demerit') || spec.name.includes('penalty') || spec.name.includes('감점');
    const badgeText = isPenalty ? `🥇 최소 벌점` : `🥇 실시간 1위`;
    
    crownCard.innerHTML = `
      <div class="crown-icon">${spec.icon}</div>
      <div class="crown-title">${badgeText} (${spec.name})</div>
      <div class="crown-team">${topTeam}</div>
      <div class="crown-score">${topScore}</div>
    `;
    DOM.specialHighlightsRow.appendChild(crownCard);

    const tableCard = document.createElement('div');
    tableCard.className = 'board-card';
    tableCard.style.padding = '20px';

    let rowsHTML = '';
    list.forEach((row, idx) => {
      let rankClass = 'rank-other';
      if (idx === 0) rankClass = 'rank-1';
      else if (idx === 1) rankClass = 'rank-2';
      else if (idx === 2) rankClass = 'rank-3';

      const groupObj = state.config.groupNames[row.team.groupIndex] || `${String.fromCharCode(65 + row.team.groupIndex)}조`;

      rowsHTML += `
        <tr>
          <td><span class="rank-badge ${rankClass}">${idx + 1}</span></td>
          <td class="bold team-name">${row.team.name}</td>
          <td>${groupObj}</td>
          <td class="bold" style="color: var(--accent-pink); font-size: 14px;">${spec.icon} ${row.count}점</td>
        </tr>
      `;
    });

    tableCard.innerHTML = `
      <div class="table-title-block">
        <h3>${spec.icon} ${spec.name} 순위표</h3>
      </div>
      <div class="table-container">
        <table class="standings-table">
          <thead>
            <tr>
              <th style="width: 60px;">순위</th>
              <th style="text-align: left; padding-left: 14px;">팀 이름</th>
              <th>소속 조</th>
              <th>누적 점수</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML || '<tr><td colspan="4" class="text-muted" style="padding: 20px;">등록된 팀이 없습니다.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    DOM.specialTablesGrid.appendChild(tableCard);
  });
}

function renderAdminUI() {
  if (state.userRole === 'admin') {
    DOM.adminLoginBtn.style.display = 'none';
    DOM.adminBadge.style.display = 'flex';
  } else {
    DOM.adminLoginBtn.style.display = 'flex';
    DOM.adminBadge.style.display = 'none';
  }
}

// 6. SETUP WIZARD STATE MANAGER (2-Step short setup)

function updatePlayoffQualifiersOptions() {
  const groupsCount = parseInt(DOM.wizardGroupsCount.value, 10);
  const select = DOM.wizardPlayoffQualifiers;
  const prevValue = select.value;

  select.innerHTML = '';

  if (groupsCount === 1) {
    select.innerHTML = `
      <option value="2" selected>리그 상위 1, 2위팀 결승전 진행 (2강 결승)</option>
      <option value="4">리그 상위 1~4위팀 준결승/결승 진행 (4강 결선)</option>
      <option value="8">리그 상위 1~8위팀 토너먼트 진행 (8강 결선)</option>
    `;
    if (['2', '4', '8'].includes(prevValue)) {
      select.value = prevValue;
    } else {
      select.value = '2';
    }
  } else {
    select.innerHTML = `
      <option value="1">각 조 1위만 결선 진출 (조별 1위 간 토너먼트)</option>
      <option value="2" selected>각 조 1, 2위 진출 (4강 또는 8강 결선)</option>
      <option value="3">각 조 1, 2, 3위 진출</option>
      <option value="4">각 조 1, 2, 3, 4위 진출</option>
    `;
    if (['1', '2', '3', '4'].includes(prevValue)) {
      select.value = prevValue;
    } else {
      select.value = '2';
    }
  }
}

function initSetupWizard() {
  goToWizardStep(1);
  renderGroupNamesInputs();
  renderGroupAssignmentPreview();
  updatePlayoffQualifiersOptions();
  
  // Set default visibility based on default checked values
  const checkedFormat = document.querySelector('input[name="wizard-format"]:checked').value;
  document.getElementById('hybrid-options-block').style.display = checkedFormat === 'hybrid' ? 'block' : 'none';
  document.getElementById('league-options-block').style.display = (checkedFormat === 'league' || checkedFormat === 'hybrid') ? 'block' : 'none';
  document.getElementById('tournament-options-block').style.display = checkedFormat === 'tournament' ? 'block' : 'none';

  // Toggle special scores input
  const specToggle = document.getElementById('wizard-special-toggle');
  const specContainer = document.getElementById('special-scores-wizard-container');
  if (specToggle && specContainer) {
    specContainer.style.display = specToggle.checked ? 'block' : 'none';
    specToggle.onchange = (e) => {
      specContainer.style.display = e.target.checked ? 'block' : 'none';
    };
  }

  DOM.wizardGroupsCount.onchange = () => {
    renderGroupNamesInputs();
    renderGroupAssignmentPreview();
    updatePlayoffQualifiersOptions();
  };
  DOM.wizardTeamsTextarea.oninput = () => {
    renderGroupAssignmentPreview();
  };
}

function goToWizardStep(step) {
  DOM.wizardSteps.forEach(ind => {
    ind.classList.toggle('active', parseInt(ind.dataset.step, 10) === step);
  });
  DOM.wizardContents.forEach(cont => {
    cont.classList.toggle('active', parseInt(cont.dataset.step, 10) === step);
  });
}

function renderGroupNamesInputs() {
  DOM.groupNamesContainer.innerHTML = '';
  const count = parseInt(DOM.wizardGroupsCount.value, 10);
  for (let i = 0; i < count; i++) {
    const div = document.createElement('div');
    div.innerHTML = `
      <input type="text" class="group-name-input" data-index="${i}" value="${String.fromCharCode(65 + i)}조" placeholder="조 이름" style="padding: 6px 10px; font-size:13px;">
    `;
    DOM.groupNamesContainer.appendChild(div);
  }
}

function renderGroupAssignmentPreview() {
  DOM.groupAssignmentPreview.innerHTML = '';
  const gCount = parseInt(DOM.wizardGroupsCount.value, 10);
  const teamsText = DOM.wizardTeamsTextarea.value.trim();
  const teamsArr = teamsText.split('\n').map(t => t.trim()).filter(t => t.length > 0);

  const customNames = [];
  const inputs = DOM.groupNamesContainer.querySelectorAll('.group-name-input');
  inputs.forEach(inp => {
    customNames.push(inp.value.trim() || `${String.fromCharCode(65 + parseInt(inp.dataset.index, 10))}조`);
  });

  const groupsData = Array.from({ length: gCount }, () => []);
  teamsArr.forEach((teamName, idx) => {
    const targetGroupIdx = idx % gCount;
    groupsData[targetGroupIdx].push(teamName);
  });

  for (let i = 0; i < gCount; i++) {
    const grName = customNames[i] || `${String.fromCharCode(65 + i)}조`;
    const card = document.createElement('div');
    card.className = 'group-preview-card';
    
    let tagsHTML = '';
    groupsData[i].forEach(t => {
      tagsHTML += `<span class="preview-tag">${t}</span>`;
    });

    card.innerHTML = `
      <div class="group-preview-title">${grName} (${groupsData[i].length}팀)</div>
      <div class="group-preview-list">${tagsHTML || '<span class="text-muted" style="font-size:11px;">배정팀 없음</span>'}</div>
    `;
    DOM.groupAssignmentPreview.appendChild(card);
  }
}

function handleWizardGenerate() {
  const title = DOM.wizardTitle.value.trim() || '학교 스포츠 대회';
  const sport = DOM.wizardSport.value.trim() || '피구';
  const specialEnabled = DOM.wizardSpecialToggle.checked;
  const specialRaw = DOM.wizardSpecialInput.value.trim();
  const specialScores = specialEnabled ? parseSpecialScoresInput(specialRaw) : [];
  const format = document.querySelector('input[name="wizard-format"]:checked').value;
  const groupsCount = parseInt(DOM.wizardGroupsCount.value, 10);
  
  const groupNames = [];
  const inputs = DOM.groupNamesContainer.querySelectorAll('.group-name-input');
  inputs.forEach(inp => {
    groupNames.push(inp.value.trim() || `${String.fromCharCode(65 + parseInt(inp.dataset.index, 10))}조`);
  });

  const teamsText = DOM.wizardTeamsTextarea.value.trim();
  const rawTeams = teamsText.split('\n').map(t => t.trim()).filter(t => t.length > 0);

  if (rawTeams.length < 2) {
    alert("참가 팀을 최소 2개 팀 이상 등록해야 합니다.");
    return;
  }

  const teams = rawTeams.map((name, idx) => ({
    id: `team-${idx + 1}`,
    name: name,
    groupIndex: idx % groupsCount
  }));

  let matches = [];
  const leagueRepeats = parseInt(document.getElementById('wizard-league-repeats').value, 10) || 1;

  if (format === 'league' || format === 'hybrid') {
    for (let g = 0; g < groupsCount; g++) {
      const groupTeams = teams.filter(t => t.groupIndex === g);
      const groupSize = groupTeams.length % 2 === 0 ? groupTeams.length - 1 : groupTeams.length;
      
      for (let r = 0; r < leagueRepeats; r++) {
        const roundOffset = r * groupSize;
        const groupMatches = generateRoundRobin(groupTeams, g, roundOffset, r);
        matches = [...matches, ...groupMatches];
      }
    }
  } else if (format === 'tournament') {
    const thirdPlaceEnabled = DOM.wizard3rdPlaceTournamentToggle.checked;
    matches = generateTournamentBracket(teams, false, thirdPlaceEnabled);
  }

  const localConfigStr = localStorage.getItem('classmatch_config');
  const savedConfig = localConfigStr ? JSON.parse(localConfigStr) : null;

  const config = {
    title,
    sport,
    specialScores,
    format,
    groupsCount,
    groupNames,
    playoffQualifiers: DOM.wizardPlayoffQualifiers.value,
    leagueRepeats: leagueRepeats,
    thirdPlaceEnabled: format === 'hybrid' ? DOM.wizard3rdPlaceToggle.checked : (format === 'tournament' ? DOM.wizard3rdPlaceTournamentToggle.checked : false),
    syncEnabled: state.config ? state.config.syncEnabled : (savedConfig ? savedConfig.syncEnabled : false),
    syncUrl: state.config && state.config.syncUrl ? state.config.syncUrl : (savedConfig && savedConfig.syncUrl ? savedConfig.syncUrl : window.location.origin),
    syncCode: state.config && state.config.syncCode ? state.config.syncCode : (savedConfig && savedConfig.syncCode ? savedConfig.syncCode : ''),
    adminPassword: state.config ? state.config.adminPassword : (savedConfig ? savedConfig.adminPassword : DEFAULT_PASSWORD)
  };

  state.config = config;
  state.teams = teams;
  state.matches = matches;

  saveData().then(() => {
    renderApp();
  });
}

// 7. EVENT REGISTRATION

function registerWizardEvents() {
  document.querySelectorAll('.next-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      goToWizardStep(2);
    });
  });

  document.querySelectorAll('.prev-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      goToWizardStep(1);
    });
  });

  DOM.wizardAutoFillBtn.addEventListener('click', () => {
    DOM.wizardTeamsTextarea.value = "1반\n2반\n3반\n4반\n5반\n6반\n7반\n8반";
    renderGroupAssignmentPreview();
  });

  document.querySelectorAll('input[name="wizard-format"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isHybrid = e.target.value === 'hybrid';
      const isLeague = e.target.value === 'league';
      const isTournament = e.target.value === 'tournament';
      document.getElementById('hybrid-options-block').style.display = isHybrid ? 'block' : 'none';
      document.getElementById('league-options-block').style.display = (isLeague || isHybrid) ? 'block' : 'none';
      document.getElementById('tournament-options-block').style.display = isTournament ? 'block' : 'none';
    });
  });

  DOM.wizardGenerateBtn.addEventListener('click', handleWizardGenerate);
}

function registerTabEvents() {
  DOM.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderActiveTab();
    });
  });

  // Filters refilter listeners
  DOM.filterGroupSelect.addEventListener('change', () => renderScheduleView());
  DOM.filterStatusSelect.addEventListener('change', () => renderScheduleView());
  DOM.searchTeamInput.addEventListener('input', () => renderScheduleView());

  DOM.generateBracketBtn.addEventListener('click', () => {
    if (confirm("결선 토너먼트 대진표를 생성하시겠습니까? (기존 결선 일정이 있는 경우 덮어씌워집니다)")) {
      generatePlayoffBracketFromStandings();
      saveData().then(() => {
        renderApp();
      });
    }
  });
}

function registerModalEvents() {
  DOM.adminLoginBtn.addEventListener('click', () => {
    DOM.adminPasscodeModal.style.display = 'flex';
    DOM.adminPasswordInput.value = '';
    DOM.loginErrorMsg.style.display = 'none';
    DOM.adminPasswordInput.focus();
  });

  DOM.adminLogoutBtn.addEventListener('click', () => {
    state.userRole = 'guest';
    renderApp();
  });

  DOM.adminLoginSubmit.addEventListener('click', handleAdminLogin);
  DOM.adminPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAdminLogin();
  });

  document.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay').style.display = 'none';
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
  });

  DOM.modalSaveMatchBtn.addEventListener('click', handleSaveMatchScore);
  DOM.modalResetMatchBtn.addEventListener('click', handleResetMatchResult);

  DOM.settingsOpenBtn.addEventListener('click', openSettingsModal);
  DOM.settingsSyncToggle.addEventListener('change', (e) => {
    DOM.syncDetailsBlock.style.display = e.target.checked ? 'block' : 'none';
  });

  DOM.settingsTestConnection.addEventListener('click', handleTestServerConnection);
  DOM.settingsCopyShareUrl.addEventListener('click', handleCopyShareUrl);
  DOM.settingsChangePasswordBtn.addEventListener('click', handleSaveNewPassword);
  DOM.settingsExportBtn.addEventListener('click', handleExportBackup);
  DOM.settingsExportExcelBtn.addEventListener('click', handleExportExcel);
  DOM.settingsImportBtn.addEventListener('click', () => DOM.settingsImportFile.click());
  DOM.settingsImportFile.addEventListener('change', handleImportBackup);
  DOM.settingsResetAllBtn.addEventListener('click', handleResetAllWipe);
}

// 8. HANDLERS FOR DIALOGS AND EDITING

function handleAdminLogin() {
  const input = DOM.adminPasswordInput.value;
  const targetPassword = (state.config && state.config.adminPassword) || DEFAULT_PASSWORD;

  if (input === targetPassword) {
    state.userRole = 'admin';
    DOM.adminPasscodeModal.style.display = 'none';
    renderApp();
  } else {
    DOM.loginErrorMsg.style.display = 'block';
  }
}

function openMatchResultModal(matchId) {
  const m = state.matches.find(match => match.id === matchId);
  if (!m) return;

  DOM.modalMatchId.value = matchId;

  const teamAObj = state.teams.find(t => t.id === m.teamA);
  const teamBObj = state.teams.find(t => t.id === m.teamB);

  const teamAName = teamAObj ? teamAObj.name : (m.teamANameOverride || '부전승');
  const teamBName = teamBObj ? teamBObj.name : (m.teamBNameOverride || '부전승');

  DOM.modalTeamAName.textContent = teamAName;
  DOM.modalTeamBName.textContent = teamBName;

  if (m.type === 'playoff') {
    DOM.modalTeamAGroup.textContent = '토너먼트';
    DOM.modalTeamBGroup.textContent = '토너먼트';
  } else {
    const nameA = state.config.groupNames[teamAObj.groupIndex] || '예선';
    const nameB = state.config.groupNames[teamBObj.groupIndex] || '예선';
    DOM.modalTeamAGroup.textContent = nameA;
    DOM.modalTeamBGroup.textContent = nameB;
  }

  DOM.modalScoreA.value = m.scoreA !== null ? m.scoreA : 0;
  DOM.modalScoreB.value = m.scoreB !== null ? m.scoreB : 0;

  if (m.type === 'playoff') {
    DOM.modalPsoBlock.style.display = 'block';
    DOM.modalPsoA.value = (m.psoScoreA !== undefined && m.psoScoreA !== null) ? m.psoScoreA : '';
    DOM.modalPsoB.value = (m.psoScoreB !== undefined && m.psoScoreB !== null) ? m.psoScoreB : '';
  } else {
    DOM.modalPsoBlock.style.display = 'none';
    DOM.modalPsoA.value = '';
    DOM.modalPsoB.value = '';
  }

  DOM.modalDate.value = (m.date === '일정 미정') ? '' : m.date;
  DOM.modalTime.value = (m.time === '-') ? '' : m.time;
  DOM.modalLocation.value = (m.location === '-') ? '' : m.location;

  DOM.modalWinnerALbl.textContent = `${teamAName} 승리`;
  DOM.modalWinnerBLbl.textContent = `${teamBName} 승리`;

  document.querySelector(`input[name="modal-winner-select"][value="${m.winnerSelect || 'auto'}"]`).checked = true;

  DOM.modalSpecialScoresBlock.innerHTML = '';
  if (state.config.specialScores && state.config.specialScores.length > 0) {
    DOM.modalSpecialScoresBlock.style.display = 'block';
    
    let specialHTML = `
      <h4>❤️ 특별 부문 점수 부여</h4>
      <p class="input-helper" style="margin-bottom: 12px;">각 부문에 해당하는 활약을 펼치거나 규칙을 준수한 팀에 체크합니다. (벌점의 경우 경고 조치된 팀에 체크)</p>
    `;

    state.config.specialScores.forEach(spec => {
      const isCheckedA = m.specialScores && m.specialScores[spec.id] && m.specialScores[spec.id].includes(m.teamA);
      const isCheckedB = m.specialScores && m.specialScores[spec.id] && m.specialScores[spec.id].includes(m.teamB);
      const disabledA = !teamAObj ? 'disabled' : '';
      const disabledB = !teamBObj ? 'disabled' : '';

      specialHTML += `
        <div class="special-score-row" style="margin-bottom: 12px; border-bottom: 1px solid var(--border-light); padding-bottom: 12px;">
          <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px; color: var(--primary-hover);">${spec.icon} ${spec.name}</div>
          <div class="grid grid-2">
            <label class="checkbox-container">
              <input type="checkbox" class="special-chk" data-score-id="${spec.id}" data-team="a" ${isCheckedA ? 'checked' : ''} ${disabledA}>
              <span class="checkmark"></span>
              <span>${teamAName} (+1)</span>
            </label>
            <label class="checkbox-container">
              <input type="checkbox" class="special-chk" data-score-id="${spec.id}" data-team="b" ${isCheckedB ? 'checked' : ''} ${disabledB}>
              <span class="checkmark"></span>
              <span>${teamBName} (+1)</span>
            </label>
          </div>
        </div>
      `;
    });

    DOM.modalSpecialScoresBlock.innerHTML = specialHTML;
    
    const rows = DOM.modalSpecialScoresBlock.querySelectorAll('.special-score-row');
    if (rows.length > 0) {
      rows[rows.length - 1].style.borderBottom = 'none';
      rows[rows.length - 1].style.paddingBottom = '0';
      rows[rows.length - 1].style.marginBottom = '0';
    }
  } else {
    DOM.modalSpecialScoresBlock.style.display = 'none';
  }

  DOM.modalResetMatchBtn.style.display = m.completed ? 'block' : 'none';
  DOM.matchModal.style.display = 'flex';
}

function handleSaveMatchScore() {
  const matchId = DOM.modalMatchId.value;
  const m = state.matches.find(match => match.id === matchId);
  if (!m) return;

  const scoreA = parseInt(DOM.modalScoreA.value, 10);
  const scoreB = parseInt(DOM.modalScoreB.value, 10);
  
  if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
    alert("올바른 점수 수치를 입력하세요.");
    return;
  }

  m.scoreA = scoreA;
  m.scoreB = scoreB;
  m.completed = true;

  m.date = DOM.modalDate.value.trim() || '일정 미정';
  m.time = DOM.modalTime.value.trim() || '-';
  m.location = DOM.modalLocation.value.trim() || '-';

  const selection = document.querySelector('input[name="modal-winner-select"]:checked').value;
  m.winnerSelect = selection;

  // PK 점수 파싱 및 검증
  if (m.type === 'playoff') {
    const psoAVal = DOM.modalPsoA.value.trim();
    const psoBVal = DOM.modalPsoB.value.trim();
    m.psoScoreA = psoAVal !== '' ? parseInt(psoAVal, 10) : null;
    m.psoScoreB = psoBVal !== '' ? parseInt(psoBVal, 10) : null;

    if (m.psoScoreA !== null && (isNaN(m.psoScoreA) || m.psoScoreA < 0)) {
      alert("올바른 A팀 승부차기 점수를 입력하세요.");
      return;
    }
    if (m.psoScoreB !== null && (isNaN(m.psoScoreB) || m.psoScoreB < 0)) {
      alert("올바른 B팀 승부차기 점수를 입력하세요.");
      return;
    }
  } else {
    m.psoScoreA = null;
    m.psoScoreB = null;
  }

  if (selection === 'auto') {
    if (scoreA > scoreB) {
      m.winner = 'a';
    } else if (scoreB > scoreA) {
      m.winner = 'b';
    } else {
      if (m.type === 'playoff') {
        if (m.psoScoreA !== null && m.psoScoreB !== null) {
          if (m.psoScoreA > m.psoScoreB) {
            m.winner = 'a';
          } else if (m.psoScoreB > m.psoScoreA) {
            m.winner = 'b';
          } else {
            alert("동점인 경우 승부차기 점수도 동점일 수 없습니다. 최종 승리 팀을 결정할 수 있게 다른 점수를 입력하거나 판정 승리팀을 수동으로 선택해 주십시오.");
            m.completed = false;
            return;
          }
        } else {
          alert("토너먼트 경기는 동점이 될 수 없습니다. 승부차기 점수를 입력하거나 판정 승리팀을 수동으로 선택해 주십시오.");
          m.completed = false;
          return;
        }
      } else {
        m.winner = 'draw';
      }
    }
  } else if (selection === 'draw') {
    if (m.type === 'playoff') {
      alert("토너먼트 경기는 무승부 처리가 불가능합니다.");
      m.completed = false;
      return;
    }
    m.winner = 'draw';
  } else if (selection === 'a') {
    m.winner = 'a';
  } else if (selection === 'b') {
    m.winner = 'b';
  }

  m.specialScores = {};
  if (state.config.specialScores && state.config.specialScores.length > 0) {
    state.config.specialScores.forEach(spec => {
      m.specialScores[spec.id] = [];
      const chkA = DOM.modalSpecialScoresBlock.querySelector(`.special-chk[data-score-id="${spec.id}"][data-team="a"]`);
      const chkB = DOM.modalSpecialScoresBlock.querySelector(`.special-chk[data-score-id="${spec.id}"][data-team="b"]`);
      if (chkA && chkA.checked && m.teamA) m.specialScores[spec.id].push(m.teamA);
      if (chkB && chkB.checked && m.teamB) m.specialScores[spec.id].push(m.teamB);
    });
  }

  if (m.type === 'playoff') {
    const winnerTeamId = m.winner === 'a' ? m.teamA : m.teamB;
    if (winnerTeamId) {
      propagateTournamentWinner(m.id, winnerTeamId);
    }
  }

  DOM.matchModal.style.display = 'none';
  saveData().then(() => {
    renderApp();
  });
}

function handleResetMatchResult() {
  const matchId = DOM.modalMatchId.value;
  const m = state.matches.find(match => match.id === matchId);
  if (!m) return;

  if (confirm("경기 결과를 초기화하시겠습니까?")) {
    m.scoreA = null;
    m.scoreB = null;
    m.psoScoreA = null;
    m.psoScoreB = null;
    m.winner = null;
    m.completed = false;
    m.specialScores = {};

    if (m.type === 'playoff') {
      propagateTournamentWinner(m.id, null);
    }

    DOM.matchModal.style.display = 'none';
    saveData().then(() => {
      renderApp();
    });
  }
}

function openSettingsModal() {
  DOM.settingsSyncToggle.checked = state.config ? state.config.syncEnabled : false;
  DOM.syncDetailsBlock.style.display = DOM.settingsSyncToggle.checked ? 'block' : 'none';
  DOM.settingsSyncUrl.value = state.config && state.config.syncUrl ? state.config.syncUrl : window.location.origin;
  DOM.settingsSyncCode.value = state.config && state.config.syncCode ? state.config.syncCode : '';
  DOM.connectionTestResult.className = 'test-result-msg';
  DOM.connectionTestResult.textContent = '';
  DOM.passwordChangeResult.className = 'test-result-msg';
  DOM.passwordChangeResult.textContent = '';
  DOM.settingsOldPassword.value = '';
  DOM.settingsNewPassword.value = '';
  
  DOM.settingsTitle.value = state.config ? state.config.title : '';
  DOM.settingsSport.value = state.config ? state.config.sport : '';
  if (state.config && state.config.specialScores) {
    DOM.settingsSpecialInput.value = state.config.specialScores.map(s => s.name).join(', ');
  } else {
    DOM.settingsSpecialInput.value = '';
  }

  DOM.settingsModal.style.display = 'flex';
}

async function handleTestServerConnection() {
  const url = DOM.settingsSyncUrl.value.trim();
  if (!url) {
    DOM.connectionTestResult.className = 'test-result-msg test-fail';
    DOM.connectionTestResult.textContent = 'API URL을 입력하십시오.';
    return;
  }

  DOM.connectionTestResult.className = 'test-result-msg';
  DOM.connectionTestResult.textContent = '연결 시도 중...';

  const codeVal = DOM.settingsSyncCode.value.trim() || 'test';
  try {
    const res = await fetch(`${url}/api/data?code=${encodeURIComponent(codeVal)}`);
    if (res.ok) {
      DOM.connectionTestResult.className = 'test-result-msg test-success';
      DOM.connectionTestResult.textContent = '✅ 서버 연결 성공!';
    } else {
      throw new Error();
    }
  } catch (err) {
    DOM.connectionTestResult.className = 'test-result-msg test-fail';
    DOM.connectionTestResult.textContent = '❌ 연결 실패. 서버 구동 상태나 CORS 설정을 확인해 주십시오.';
  }
}

function handleCopyShareUrl() {
  const codeVal = DOM.settingsSyncCode.value.trim().replace(/[^a-zA-Z0-9-_]/g, '');
  if (!codeVal) {
    alert("먼저 우리 학교 코드를 영어나 숫자로 입력한 뒤 복사해 주세요.");
    return;
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}?code=${encodeURIComponent(codeVal)}`;

  navigator.clipboard.writeText(shareUrl).then(() => {
    alert(`✅ 공유 주소가 클립보드에 복사되었습니다!\n\n동료 선생님들께 이 주소를 전달하면, 설정할 필요 없이 '${codeVal}' 학교 코드로 바로 자동 연결됩니다.\n\n주소: ${shareUrl}`);
  }).catch(err => {
    console.error("클립보드 복사 실패. 대체 복사 시도.", err);
    try {
      const tempInput = document.createElement("input");
      tempInput.value = shareUrl;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);
      alert(`✅ 공유 주소가 복사되었습니다!\n\n동료 선생님들께 이 주소를 전달하면, 설정할 필요 없이 '${codeVal}' 학교 코드로 바로 자동 연결됩니다.\n\n주소: ${shareUrl}`);
    } catch (e) {
      alert(`복사에 실패했습니다. 아래 주소를 직접 복사해 주세요:\n\n${shareUrl}`);
    }
  });
}

async function handleSaveNewPassword() {
  const oldPw = DOM.settingsOldPassword.value;
  const newPw = DOM.settingsNewPassword.value.trim();
  const currentPw = (state.config && state.config.adminPassword) || DEFAULT_PASSWORD;

  if (oldPw !== currentPw) {
    DOM.passwordChangeResult.className = 'test-result-msg test-fail';
    DOM.passwordChangeResult.textContent = '현재 비밀번호가 일치하지 않습니다.';
    return;
  }

  if (newPw.length < 4) {
    DOM.passwordChangeResult.className = 'test-result-msg test-fail';
    DOM.passwordChangeResult.textContent = '새 비밀번호는 4글자 이상이어야 합니다.';
    return;
  }

  state.config.adminPassword = newPw;
  DOM.passwordChangeResult.className = 'test-result-msg test-success';
  DOM.passwordChangeResult.textContent = '✅ 비밀번호 변경 성공!';
  DOM.settingsOldPassword.value = '';
  DOM.settingsNewPassword.value = '';

  saveData();
}

DOM.settingsModal.querySelectorAll('.modal-close-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.config) {
      const prevSync = state.config.syncEnabled;
      const prevUrl = state.config.syncUrl;
      const prevCode = state.config.syncCode || '';
      const prevTitle = state.config.title;
      const prevSport = state.config.sport;
      const prevSpecial = state.config.specialScores ? state.config.specialScores.map(s => s.name).join(', ') : '';

      state.config.syncEnabled = DOM.settingsSyncToggle.checked;
      state.config.syncUrl = DOM.settingsSyncUrl.value.trim() || window.location.origin;
      state.config.syncCode = DOM.settingsSyncCode.value.trim().replace(/[^a-zA-Z0-9-_]/g, '');
      state.config.title = DOM.settingsTitle.value.trim() || '학교 스포츠 대회';
      state.config.sport = DOM.settingsSport.value.trim() || '피구';

      const newSpecialRaw = DOM.settingsSpecialInput.value.trim();
      state.config.specialScores = parseSpecialScoresInput(newSpecialRaw);

      if (prevSync !== state.config.syncEnabled || 
          prevUrl !== state.config.syncUrl ||
          prevCode !== state.config.syncCode ||
          prevTitle !== state.config.title ||
          prevSport !== state.config.sport ||
          prevSpecial !== newSpecialRaw) {
        saveData().then(() => {
          location.reload();
        });
      }
    }
  });
});

function handleExportBackup() {
  if (!state.config) return;
  const backupData = JSON.stringify(state, null, 2);
  const blob = new Blob([backupData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `classmatch-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleExportExcel() {
  if (!state.config) return;

  let csvContent = "";

  // 1. Title Block
  csvContent += `대회 결과 보고서 (경기배정도우미)\r\n`;
  csvContent += `대회명,${state.config.title || ''}\r\n`;
  csvContent += `종목,${state.config.sport || ''}\r\n`;
  csvContent += `출력일시,${new Date().toLocaleString()}\r\n\r\n`;

  // 2. League Standings
  csvContent += `[1] 예선 리그 순위표\r\n`;
  
  let standingsHeaders = ["조/구분", "순위", "팀 이름", "경기수", "승", "무", "패", "득점", "실점", "득실차"];
  if (state.config.specialScores) {
    state.config.specialScores.forEach(spec => {
      standingsHeaders.push(spec.name);
    });
  }
  standingsHeaders.push("승점");
  csvContent += standingsHeaders.join(",") + "\r\n";

  const numGroups = state.config.groupsCount;
  for (let g = 0; g < numGroups; g++) {
    const groupName = state.config.groupNames[g] || `${String.fromCharCode(65 + g)}조`;
    const standingsList = calculateLeagueStandings(g);

    standingsList.forEach((row, idx) => {
      let rowData = [
        groupName,
        idx + 1,
        row.team.name,
        row.played,
        row.won,
        row.drawn,
        row.lost,
        row.scoreFor,
        row.scoreAgainst,
        row.scoreDiff
      ];
      if (state.config.specialScores) {
        state.config.specialScores.forEach(spec => {
          rowData.push(row.specialScoresCount[spec.id] || 0);
        });
      }
      rowData.push(row.points);
      csvContent += rowData.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\r\n";
    });
  }
  csvContent += "\r\n";

  // 3. Match Results
  csvContent += `[2] 경기 일정 및 결과\r\n`;
  let matchHeaders = ["조/구분", "라운드/단계", "팀 A", "점수 A", "점수 B", "팀 B", "승리팀", "일정/날짜", "시간", "장소", "완료여부"];
  csvContent += matchHeaders.join(",") + "\r\n";

  state.matches.forEach(m => {
    let groupText = m.type === 'playoff' ? '결선 토너먼트' : (state.config.groupNames[m.groupIndex] || `${String.fromCharCode(65 + m.groupIndex)}조`);
    let roundText = m.type === 'playoff' ? (m.id === 'playoff-3rd' ? '3·4위 결정전' : `${m.round}회전`) : `${m.round}라운드`;
    
    const teamA = state.teams.find(t => t.id === m.teamA);
    const teamB = state.teams.find(t => t.id === m.teamB);
    const teamAName = teamA ? teamA.name : (m.teamANameOverride || '대기 중');
    const teamBName = teamB ? teamB.name : (m.teamBNameOverride || '대기 중');

    let winnerText = "대기";
    if (m.completed) {
      if (m.winner === 'a') winnerText = teamAName;
      else if (m.winner === 'b') winnerText = teamBName;
      else winnerText = "무승부";
    }

    let rowData = [
      groupText,
      roundText,
      teamAName,
      m.completed ? m.scoreA : "-",
      m.completed ? m.scoreB : "-",
      teamBName,
      winnerText,
      m.date,
      m.time,
      m.location,
      m.completed ? "종료" : "대기"
    ];
    csvContent += rowData.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\r\n";
  });
  csvContent += "\r\n";

  // 4. Special Scores Standings
  if (state.config.specialScores && state.config.specialScores.length > 0) {
    csvContent += `[3] 특별 부문 순위표\r\n`;
    let specHeaders = ["부문명", "순위", "팀 이름", "소속 조", "누적 점수"];
    csvContent += specHeaders.join(",") + "\r\n";

    state.config.specialScores.forEach(spec => {
      const list = calculateSpecialStandings(spec.id);
      list.forEach((row, idx) => {
        const groupObj = state.config.groupNames[row.team.groupIndex] || `${String.fromCharCode(65 + row.team.groupIndex)}조`;
        let rowData = [
          spec.name,
          idx + 1,
          row.team.name,
          groupObj,
          row.count
        ];
        csvContent += rowData.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",") + "\r\n";
      });
    });
  }

  // 한글 깨짐을 방지하는 UTF-8 BOM 헤더 부착
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `classmatch-results-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleImportBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (parsed && parsed.config && parsed.teams && parsed.matches) {
        if (confirm("백업본 데이터로 덮어씌우시겠습니까?")) {
          state = parsed;
          saveData().then(() => {
            alert("백업본 복원 성공!");
            DOM.settingsModal.style.display = 'none';
            renderApp();
          });
        }
      } else {
        alert("올바른 백업 JSON 형식이 아닙니다.");
      }
    } catch (err) {
      alert("파일 로드 중 파싱 에러가 발생했습니다.");
    }
  };
  reader.readAsText(file);
}

function handleResetAllWipe() {
  if (confirm("모든 데이터를 리셋하고 설정 단계로 돌아가시겠습니까? 경기 결과 기록이 영구 삭제됩니다.")) {
    state.config = null;
    state.teams = [];
    state.matches = [];
    
    localStorage.removeItem('classmatch_config');
    localStorage.removeItem('classmatch_teams');
    localStorage.removeItem('classmatch_matches');
    
    DOM.settingsModal.style.display = 'none';
    renderApp();
  }
}

// 9. SYNC POLLING

function startSyncPolling() {
  if (syncIntervalId) clearInterval(syncIntervalId);

  if (state.config && state.config.syncEnabled) {
    const syncUrl = state.config.syncUrl || window.location.origin;
    syncIntervalId = setInterval(async () => {
      // 화면이 보이지 않는 백그라운드 상태인 경우 요청을 차단하여 트래픽 최적화
      if (document.visibilityState !== 'visible') return;
      if (DOM.matchModal.style.display === 'flex' || DOM.settingsModal.style.display === 'flex') return;

      try {
        const codeQuery = state.config.syncCode ? `?code=${encodeURIComponent(state.config.syncCode)}` : '';
        const res = await fetch(`${syncUrl}/api/data${codeQuery}`);
        if (res.ok) {
          const remoteState = await res.json();
          if (remoteState && remoteState.config) {
            if (JSON.stringify(remoteState.matches) !== JSON.stringify(state.matches) || 
                JSON.stringify(remoteState.config) !== JSON.stringify(state.config)) {
              state = remoteState;
              setServerStatus('connected');
              renderApp();
            }
          }
        }
      } catch (err) {
        setServerStatus('disconnected');
      }
    }, 15000); // 15초로 조회 주기를 조정하여 트래픽 절약
  }
}

// BOOTSTRAP INIT
window.addEventListener('DOMContentLoaded', () => {
  registerWizardEvents();
  registerTabEvents();
  registerModalEvents();

  loadData().then(() => {
    renderApp();
    startSyncPolling();
  });
});
