import type {
  CharacterCustomization,
  FriendEntry,
  HatId,
  LanguageCode,
  OutfitId,
  PlayerProfileStats,
  QualityPreset,
  StageNumber,
  StageProgressRecord,
  WorldId,
  WorldProgressRecord,
} from '../shared/types.ts';

const STORAGE_CUSTOM = 'chain_escape_custom_v1';
const STORAGE_STATS = 'chain_escape_stats_v1';
const STORAGE_SETTINGS = 'chain_escape_settings_v1';
const STORAGE_FRIENDS = 'chain_escape_friends_v1';
const STORAGE_PLAYER_ID = 'chain_escape_player_id_v1';

export interface GameSettings {
  language: LanguageCode;
  quality: QualityPreset;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  showTouchControls: 'auto' | 'always' | 'off';
  cameraSensitivity: number;
}

export const DEFAULT_CUSTOMIZATION: CharacterCustomization = {
  name: 'HUSSIN',
  colorHex: '#ef4444',
  outfit: 'hoodie',
  hat: 'goggles',
  accessory: 'bedroll',
  face: 'determined',
};

export const DEFAULT_SETTINGS: GameSettings = {
  language: 'ar',
  quality: 'high',
  sfxVolume: 0.75,
  musicVolume: 0.45,
  muted: false,
  showTouchControls: 'auto',
  cameraSensitivity: 1.0,
};

function makeEmptyWorldProgress(): WorldProgressRecord {
  const s1: StageProgressRecord = { unlocked: true, completed: false, bestStars: 0, bestTimeSec: null };
  const s2: StageProgressRecord = { unlocked: true, completed: false, bestStars: 0, bestTimeSec: null };
  return {
    unlocked: true,
    completed: false,
    bestStars: 0,
    bestTimeSec: null,
    stages: { 1: s1, 2: s2 },
  };
}

export const DEFAULT_STATS: PlayerProfileStats = {
  level: 1,
  xp: 0,
  totalCompletions: 0,
  totalRescues: 0,
  totalFalls: 0,
  unlockedOutfits: ['hoodie', 'parka', 'forge'],
  unlockedHats: ['goggles', 'cap', 'beanie', 'none'],
  worldProgress: {
    sky_islands: makeEmptyWorldProgress(),
    ancient_jungle: makeEmptyWorldProgress(),
    lava_factory: makeEmptyWorldProgress(),
    frozen_peak: makeEmptyWorldProgress(),
    lost_temple: makeEmptyWorldProgress(),
    the_abyss: makeEmptyWorldProgress(),
  },
};

export function getOrCreatePlayerId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_PLAYER_ID);
    if (existing) return existing;
    const id = `plr_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STORAGE_PLAYER_ID, id);
    return id;
  } catch {
    return `plr_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function loadCustomization(): CharacterCustomization {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM);
    if (!raw) return { ...DEFAULT_CUSTOMIZATION };
    return { ...DEFAULT_CUSTOMIZATION, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CUSTOMIZATION };
  }
}

export function saveCustomization(c: CharacterCustomization): void {
  try {
    localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(c));
  } catch {
    // ignore storage errors
  }
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function loadStats(): PlayerProfileStats {
  try {
    const raw = localStorage.getItem(STORAGE_STATS);
    if (!raw) return structuredClone(DEFAULT_STATS);
    const parsed = JSON.parse(raw) as Partial<PlayerProfileStats> & {
      worldProgress?: Record<string, Partial<WorldProgressRecord>>;
    };
    const rawWp: Record<string, Partial<WorldProgressRecord> | undefined> =
      parsed.worldProgress ?? {};
    // Gracefully migrate legacy the_void -> the_abyss
    if (rawWp.the_void && !rawWp.the_abyss) {
      rawWp.the_abyss = rawWp.the_void;
    }

    const mergedWp = structuredClone(DEFAULT_STATS.worldProgress);
    (Object.keys(mergedWp) as WorldId[]).forEach((wid) => {
      const incoming = rawWp[wid];
      if (!incoming) return;
      mergedWp[wid] = {
        ...mergedWp[wid],
        ...incoming,
        stages: {
          1: {
            ...mergedWp[wid].stages![1],
            ...(incoming.stages?.[1] ?? {}),
          },
          2: {
            ...mergedWp[wid].stages![2],
            ...(incoming.stages?.[2] ?? {}),
          },
        },
      };
    });

    return {
      ...DEFAULT_STATS,
      ...parsed,
      worldProgress: mergedWp,
    };
  } catch {
    return structuredClone(DEFAULT_STATS);
  }
}

export function saveStats(stats: PlayerProfileStats): void {
  try {
    localStorage.setItem(STORAGE_STATS, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

export function recordWorldVictory(
  current: PlayerProfileStats,
  worldId: WorldId,
  stage: StageNumber,
  elapsedSec: number,
  starsEarned: number,
  rescues: number,
  falls: number,
): PlayerProfileStats {
  const next = structuredClone(current);
  const wp = next.worldProgress[worldId] ?? makeEmptyWorldProgress();
  if (!wp.stages) {
    wp.stages = makeEmptyWorldProgress().stages;
  }
  const st = wp.stages![stage];
  st.completed = true;
  st.bestStars = Math.max(st.bestStars, starsEarned);
  st.bestTimeSec = st.bestTimeSec === null ? elapsedSec : Math.min(st.bestTimeSec, elapsedSec);

  wp.completed = true;
  wp.bestStars = Math.max(wp.bestStars, starsEarned);
  wp.bestTimeSec = wp.bestTimeSec === null ? elapsedSec : Math.min(wp.bestTimeSec, elapsedSec);
  next.worldProgress[worldId] = wp;

  next.totalCompletions += 1;
  next.totalRescues += rescues;
  next.totalFalls += falls;
  next.xp += 120 + starsEarned * 50 + rescues * 20;
  next.level = 1 + Math.floor(next.xp / 250);

  const unlockOutfit = (id: OutfitId) => {
    if (!next.unlockedOutfits.includes(id)) next.unlockedOutfits.push(id);
  };
  const unlockHat = (id: HatId) => {
    if (!next.unlockedHats.includes(id)) next.unlockedHats.push(id);
  };

  if (next.totalCompletions >= 1) {
    unlockOutfit('temple');
    unlockHat('horns');
  }
  if (next.totalCompletions >= 2 || next.totalRescues >= 2) {
    unlockOutfit('void_suit');
    unlockHat('ninja');
  }
  if (starsEarned >= 3) {
    unlockHat('crown');
  }

  saveStats(next);
  return next;
}

export function loadSavedFriends(): FriendEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_FRIENDS);
    if (!raw) return [];
    return JSON.parse(raw) as FriendEntry[];
  } catch {
    return [];
  }
}

export function saveFriends(friends: FriendEntry[]): void {
  try {
    localStorage.setItem(STORAGE_FRIENDS, JSON.stringify(friends));
  } catch {
    // ignore
  }
}
