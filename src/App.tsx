import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameCanvas, type CanvasMode, type ProjectedLabel } from './components/GameCanvas.tsx';
import { GameHud } from './components/GameHud.tsx';
import { MenuScreens, type ScreenView } from './components/MenuScreens.tsx';
import { gameAudio } from './game/audio.ts';
import { MultiplayerClient } from './game/netClient.ts';
import {
  getOrCreatePlayerId,
  loadCustomization,
  loadSavedFriends,
  loadSettings,
  loadStats,
  recordWorldVictory,
  saveCustomization,
  saveFriends,
  saveSettings,
  type GameSettings,
} from './game/profileStore.ts';
import { createDefaultInput, RoomSimulation } from './shared/physicsSim.ts';
import { TUTORIAL_STAGE } from './shared/tutorialStage.ts';
import { getStageDef, WORLD_LIST } from './shared/worldsData.ts';
import type {
  CharacterCustomization,
  FriendEntry,
  PlayerInputState,
  PlayerProfileStats,
  RoomStateSnapshot,
  StageNumber,
  WorldId,
} from './shared/types.ts';

export default function App() {
  const localPlayerId = useMemo(() => getOrCreatePlayerId(), []);

  const [view, setView] = useState<ScreenView>('title');
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [customization, setCustomization] = useState<CharacterCustomization>(() =>
    loadCustomization(),
  );
  const [stats, setStats] = useState<PlayerProfileStats>(() => loadStats());
  const [friends, setFriends] = useState<FriendEntry[]>(() => loadSavedFriends());
  const [selectedWorldId, setSelectedWorldId] = useState<WorldId>('sky_islands');
  const [selectedStage, setSelectedStage] = useState<StageNumber>(1);
  const [roomState, setRoomState] = useState<RoomStateSnapshot | null>(null);
  const [labels, setLabels] = useState<ProjectedLabel[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');
  const [pingMs, setPingMs] = useState<number>(18);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [voiceMuted, setVoiceMuted] = useState<boolean>(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isLocalCoop, setIsLocalCoop] = useState<boolean>(false);
  const [isTutorial, setIsTutorial] = useState<boolean>(false);
  const [activeControlSlot, setActiveControlSlot] = useState<0 | 1>(0);
  const [victoryStars, setVictoryStars] = useState<number>(3);
  const [inputDeltaMs, setInputDeltaMs] = useState<number>(0);
  const [pendingInputsCount, setPendingInputsCount] = useState<number>(0);

  const snapshotRef = useRef<RoomStateSnapshot | null>(null);
  const localSimRef = useRef<RoomSimulation | null>(null);
  const localInputP1Ref = useRef<PlayerInputState>(createDefaultInput());
  const localInputP2Ref = useRef<PlayerInputState>(createDefaultInput());
  const inputSeqRef = useRef<number>(0);
  const pendingInputTimesRef = useRef<Map<number, number>>(new Map());
  const lastSentSeqRef = useRef<number>(0);
  const netRef = useRef<MultiplayerClient | null>(null);
  const viewRef = useRef<ScreenView>(view);
  viewRef.current = view;
  const victoryRecordedRef = useRef<boolean>(false);
  const activeSlotRef = useRef<0 | 1>(activeControlSlot);
  activeSlotRef.current = activeControlSlot;
  const isLocalCoopRef = useRef<boolean>(isLocalCoop);
  isLocalCoopRef.current = isLocalCoop;
  const isTutorialRef = useRef<boolean>(isTutorial);
  isTutorialRef.current = isTutorial;
  const settingsRef = useRef<GameSettings>(settings);
  settingsRef.current = settings;

  // Keep document dir & lang synced
  useEffect(() => {
    document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = settings.language;
    gameAudio.setMuted(settings.muted);
    gameAudio.setVolumes(settings.sfxVolume, settings.musicVolume);
  }, [settings]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 2600);
  }, []);

  const handleSimEvent = useCallback(
    (event: string, detail?: string) => {
      const ar = settingsRef.current.language === 'ar';
      if (
        event === 'checkpoint' ||
        event === 'rescue' ||
        event === 'fall' ||
        event === 'star' ||
        event === 'key' ||
        event === 'knockdown' ||
        event === 'gate_open' ||
        event === 'victory'
      ) {
        gameAudio.playEvent(event);
      }

      if (event === 'checkpoint') {
        showToast(ar ? 'تم الوصول لنقطة الحفظ!' : 'Checkpoint Reached!');
      } else if (event === 'rescue') {
        showToast(
          ar ? `تم إنقاذ ${detail || 'زميلك'}!` : `Rescued ${detail || 'teammate'}!`,
        );
      } else if (event === 'star') {
        showToast(ar ? 'نجمة تحدٍ جديدة!' : 'Challenge Star Collected!');
      } else if (event === 'key') {
        showToast(ar ? 'تم العثور على مفتاح البوابة!' : 'Gate Key Collected!');
      } else if (event === 'knockdown') {
        showToast(ar ? 'سقط أحد اللاعبين! ساعده!' : 'Teammate Knocked Down! Help them up!');
      } else if (event === 'gate_open') {
        showToast(ar ? 'انفتحت البوابة!' : 'Gate Opened!');
      } else if (event === 'host_migrated') {
        showToast(ar ? 'تم نقل قيادة الغرفة' : 'Host migrated');
      }
    },
    [showToast],
  );

  // Handle victory progression once when phase turns to 'victory'
  const processVictoryIfNeeded = useCallback((snap: RoomStateSnapshot) => {
    if (snap.phase === 'victory' && !victoryRecordedRef.current) {
      victoryRecordedRef.current = true;
      const st: StageNumber = snap.stage ?? 1;
      // التعليم لا يُسجَّل كإنجاز في الجزر السماوية؛ نجومه ووقته من تعريفه فقط
      const world = isTutorialRef.current ? TUTORIAL_STAGE : getStageDef(snap.worldId, st);
      let earned = 1;
      if (snap.elapsedSec <= world.parTimeSec && snap.falls <= 3) earned = 2;
      if (
        snap.elapsedSec <= world.parTimeSec &&
        snap.collectedStars.length >= Math.min(2, world.stars.length) &&
        snap.falls <= 1
      ) {
        earned = 3;
      }
      setVictoryStars(earned);
      if (!isTutorialRef.current) {
        setStats((prev) =>
          recordWorldVictory(
            prev,
            snap.worldId,
            st,
            snap.elapsedSec,
            earned,
            snap.rescues,
            snap.falls,
          ),
        );
      }
      setView('victory');
      gameAudio.playEvent('victory');
    }
  }, []);

  // Initialize MultiplayerClient once
  useEffect(() => {
    const client = new MultiplayerClient({
      onJoined: (_code, _pid, state) => {
        setRoomError(null);
        setIsLocalCoop(false);
        snapshotRef.current = state;
        setRoomState(state);
        setSelectedWorldId(state.worldId);
        setSelectedStage(state.stage ?? 1);
        victoryRecordedRef.current = false;
        setView(state.phase === 'playing' ? 'playing' : 'lobby');
      },
      onState: (state) => {
        const now = performance.now();
        const me = state.players.find((pl) => pl.id === localPlayerId);
        const ackSeq = me?.lastInputSeq ?? 0;
        if (ackSeq > 0) {
          const regAt = pendingInputTimesRef.current.get(ackSeq);
          if (regAt !== undefined) {
            setInputDeltaMs(Math.max(0, Math.round(now - regAt)));
          }
          for (const key of pendingInputTimesRef.current.keys()) {
            if (key <= ackSeq) {
              pendingInputTimesRef.current.delete(key);
            }
          }
          setPendingInputsCount(pendingInputTimesRef.current.size);
        }
        snapshotRef.current = state;
        setRoomState(state);
        setSelectedWorldId(state.worldId);
        setSelectedStage(state.stage ?? 1);
        if (state.phase === 'playing' && viewRef.current === 'lobby') {
          victoryRecordedRef.current = false;
          setView('playing');
          gameAudio.startWorldMusic(state.worldId);
        }
        processVictoryIfNeeded(state);
      },
      onEvent: (ev, detail) => {
        handleSimEvent(ev, detail);
      },
      onError: (msg) => {
        setRoomError(msg);
      },
      onConnectionChange: (s) => {
        setConnectionStatus(s);
      },
      onPing: (ms) => {
        setPingMs(ms);
      },
    });
    netRef.current = client;

    // Auto-join if ?room=CODE is present in URL
    const params = new URLSearchParams(window.location.search);
    const inviteRoom = params.get('room');
    if (inviteRoom && inviteRoom.trim().length >= 4) {
      client
        .joinRoom(inviteRoom.trim(), localPlayerId, loadCustomization())
        .catch(() => {
          setRoomError('ROOM_NOT_FOUND');
        });
    }

    return () => {
      client.disconnect();
      gameAudio.stopMusic();
    };
  }, [localPlayerId, handleSimEvent, processVictoryIfNeeded]);

  // Keyboard Controls (P1: WASD + Space + Shift + C + E, P2: Arrows + Enter + RShift + Slash, Tab switch, Esc pause)
  useEffect(() => {
    const held = new Set<string>();

    const registerLocalInput = () => {
      const seq = ++inputSeqRef.current;
      localInputP1Ref.current.inputSeq = seq;
      const map = pendingInputTimesRef.current;
      map.set(seq, performance.now());
      if (map.size > 64) {
        const oldest = map.keys().next().value;
        if (oldest !== undefined) map.delete(oldest);
      }
    };

    const syncInputsFromKeys = () => {
      const p1 = localInputP1Ref.current;
      const p2 = localInputP2Ref.current;

      // In single-player online mode, allow Arrow keys OR WASD for comfort
      const useArrowsForP1 = !isLocalCoopRef.current;

      let mx1 = 0;
      let mz1 = 0;
      if (held.has('KeyA') || (useArrowsForP1 && held.has('ArrowLeft'))) mx1 -= 1;
      if (held.has('KeyD') || (useArrowsForP1 && held.has('ArrowRight'))) mx1 += 1;
      if (held.has('KeyW') || (useArrowsForP1 && held.has('ArrowUp'))) mz1 -= 1;
      if (held.has('KeyS') || (useArrowsForP1 && held.has('ArrowDown'))) mz1 += 1;

      p1.moveX = mx1;
      p1.moveZ = mz1;
      p1.jumpHeld = held.has('Space');
      p1.sprintHeld = held.has('ShiftLeft');
      p1.crouchHeld = held.has('KeyC');
      p1.interactHeld = held.has('KeyE');

      let mx2 = 0;
      let mz2 = 0;
      if (held.has('ArrowLeft')) mx2 -= 1;
      if (held.has('ArrowRight')) mx2 += 1;
      if (held.has('ArrowUp')) mz2 -= 1;
      if (held.has('ArrowDown')) mz2 += 1;

      p2.moveX = mx2;
      p2.moveZ = mz2;
      p2.jumpHeld = held.has('Enter') || held.has('Numpad0');
      p2.sprintHeld = held.has('ShiftRight');
      p2.crouchHeld = held.has('ControlRight');
      p2.interactHeld = held.has('Slash');
      registerLocalInput();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      gameAudio.unlock();

      if (e.code === 'Escape') {
        if (viewRef.current === 'playing') {
          setView('paused');
        } else if (viewRef.current === 'paused') {
          setView('playing');
        }
        return;
      }

      if (e.code === 'Tab' && isLocalCoopRef.current && viewRef.current === 'playing') {
        e.preventDefault();
        setActiveControlSlot((prev) => (prev === 0 ? 1 : 0));
        return;
      }

      if (!held.has(e.code)) {
        if (e.code === 'Space') {
          if (activeSlotRef.current === 0 || !isLocalCoopRef.current) {
            localInputP1Ref.current.jumpPressed = true;
            gameAudio.playJump(false);
          } else {
            localInputP2Ref.current.jumpPressed = true;
            gameAudio.playJump(false);
          }
        }
        if (e.code === 'KeyE') {
          localInputP1Ref.current.interactPressed = true;
        }
        if (e.code === 'Enter' || e.code === 'Numpad0') {
          if (viewRef.current === 'title') {
            setView('play_select');
            return;
          }
          if (isLocalCoopRef.current) {
            localInputP2Ref.current.jumpPressed = true;
            gameAudio.playJump(false);
          }
        }
        if (e.code === 'Slash') {
          localInputP2Ref.current.interactPressed = true;
        }
      }

      held.add(e.code);
      syncInputsFromKeys();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      held.delete(e.code);
      syncInputsFromKeys();
    };

    const onBlur = () => {
      held.clear();
      syncInputsFromKeys();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Send local inputs to authoritative server at 30Hz when playing online
  useEffect(() => {
    if (view !== 'playing' || isLocalCoop) return;
    const timer = window.setInterval(() => {
      const curSeq = localInputP1Ref.current.inputSeq ?? 0;
      if (curSeq === lastSentSeqRef.current) {
        const nextSeq = ++inputSeqRef.current;
        localInputP1Ref.current.inputSeq = nextSeq;
        const map = pendingInputTimesRef.current;
        map.set(nextSeq, performance.now());
        if (map.size > 64) {
          const oldest = map.keys().next().value;
          if (oldest !== undefined) map.delete(oldest);
        }
      }
      lastSentSeqRef.current = localInputP1Ref.current.inputSeq ?? 0;
      netRef.current?.sendInput(localInputP1Ref.current);
      localInputP1Ref.current.jumpPressed = false;
      localInputP1Ref.current.interactPressed = false;
    }, 33);
    return () => window.clearInterval(timer);
  }, [view, isLocalCoop]);

  // Local Co-op fixed-step callback executed inside GameCanvas animation loop
  const onLocalStepTick = useCallback(
    (dt: number) => {
      if (!isLocalCoopRef.current || !localSimRef.current || viewRef.current !== 'playing') {
        return;
      }
      const sim = localSimRef.current;

      // If user clicked Switch (Tab) in solo practice, route primary WASD/Touch to activeControlSlot
      if (activeSlotRef.current === 0) {
        sim.setPlayerInput('local_p1', localInputP1Ref.current);
        sim.setPlayerInput('local_p2', localInputP2Ref.current);
      } else {
        sim.setPlayerInput('local_p2', localInputP1Ref.current);
        sim.setPlayerInput('local_p1', localInputP2Ref.current);
      }
      localInputP1Ref.current.jumpPressed = false;
      localInputP1Ref.current.interactPressed = false;
      localInputP2Ref.current.jumpPressed = false;
      localInputP2Ref.current.interactPressed = false;

      sim.step(dt);
      const snap = sim.getSnapshot();
      const ackSeq = snap.players[0]?.lastInputSeq ?? 0;
      if (ackSeq > 0) {
        const regAt = pendingInputTimesRef.current.get(ackSeq);
        if (regAt !== undefined) {
          setInputDeltaMs(Math.max(0, Math.round(performance.now() - regAt)));
        }
        for (const key of pendingInputTimesRef.current.keys()) {
          if (key <= ackSeq) pendingInputTimesRef.current.delete(key);
        }
        setPendingInputsCount(pendingInputTimesRef.current.size);
      }
      snapshotRef.current = snap;
      setRoomState(snap);
      processVictoryIfNeeded(snap);
    },
    [processVictoryIfNeeded],
  );

  const handleStartLocalCoop = (worldId: WorldId, stage: StageNumber = selectedStage) => {
    gameAudio.unlock();
    netRef.current?.leaveRoom();
    setIsLocalCoop(true);
    setIsTutorial(false);
    setSelectedWorldId(worldId);
    setSelectedStage(stage);
    victoryRecordedRef.current = false;

    const sim = new RoomSimulation(
      'LOCAL',
      worldId,
      'local_p1',
      (ev, detail) => {
        handleSimEvent(ev, detail);
      },
      stage,
    );
    sim.addPlayer('local_p1', customization, true);
    sim.addPlayer(
      'local_p2',
      {
        name: settings.language === 'ar' ? 'رفيقك' : 'Partner',
        colorHex: '#f59e0b',
        outfit: 'forge',
        hat: 'cap',
        accessory: 'bedroll',
        face: 'cheerful',
      },
      false,
    );
    sim.phase = 'playing';
    localSimRef.current = sim;
    const snap = sim.getSnapshot();
    snapshotRef.current = snap;
    setRoomState(snap);
    setView('playing');
    gameAudio.startWorldMusic(worldId);
  };

  // المرحلة التعليمية «البداية»: تعاون محلي بلاعبين على نفس الجهاز،
  // بنفس محاكاة RoomSimulation لكن بتعريف العالم التعليمي كتجاوز.
  const handleStartTutorial = () => {
    gameAudio.unlock();
    netRef.current?.leaveRoom();
    setIsLocalCoop(true);
    setIsTutorial(true);
    setSelectedWorldId('sky_islands');
    setSelectedStage(1);
    victoryRecordedRef.current = false;

    const sim = new RoomSimulation(
      'LOCAL',
      'sky_islands',
      'local_p1',
      (ev, detail) => {
        handleSimEvent(ev, detail);
      },
      1,
      TUTORIAL_STAGE,
    );
    sim.addPlayer('local_p1', customization, true);
    sim.addPlayer(
      'local_p2',
      {
        name: settings.language === 'ar' ? 'رفيقك' : 'Partner',
        colorHex: '#f59e0b',
        outfit: 'forge',
        hat: 'cap',
        accessory: 'bedroll',
        face: 'cheerful',
      },
      false,
    );
    sim.phase = 'playing';
    localSimRef.current = sim;
    const snap = sim.getSnapshot();
    snapshotRef.current = snap;
    setRoomState(snap);
    setView('playing');
    gameAudio.startWorldMusic('sky_islands');
  };

  const handleCreateOnlineRoom = () => {
    gameAudio.unlock();
    setRoomError(null);
    setIsTutorial(false);
    netRef.current
      ?.createRoom(localPlayerId, customization, selectedWorldId, selectedStage)
      .catch(() => setRoomError('Connection failed'));
  };

  const handleJoinOnlineRoom = (code: string) => {
    gameAudio.unlock();
    setRoomError(null);
    setIsTutorial(false);
    netRef.current
      ?.joinRoom(code, localPlayerId, customization)
      .catch(() => setRoomError('Connection failed'));
  };

  const handleUpdateSettings = (next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  const handleUpdateCustomization = (next: CharacterCustomization) => {
    setCustomization(next);
    saveCustomization(next);
    if (!isLocalCoop && roomState) {
      netRef.current?.updateCustomization(next);
    }
  };

  const handleSelectWorld = (wId: WorldId, st: StageNumber = 1) => {
    setSelectedWorldId(wId);
    setSelectedStage(st);
    if (!isLocalCoop && roomState && roomState.hostId === localPlayerId) {
      netRef.current?.selectWorld(wId, st);
    }
  };

  const handleLeaveRoom = () => {
    gameAudio.stopMusic();
    if (!isLocalCoop) {
      netRef.current?.leaveRoom();
    }
    localSimRef.current = null;
    snapshotRef.current = null;
    setRoomState(null);
    setIsLocalCoop(false);
    setIsTutorial(false);
  };

  const handleRestartGame = () => {
    victoryRecordedRef.current = false;
    if (isTutorialRef.current) {
      handleStartTutorial();
      return;
    }
    if (isLocalCoop) {
      handleStartLocalCoop(selectedWorldId, selectedStage);
    } else {
      netRef.current?.restartGame();
      setView('playing');
    }
  };

  const handleNextStage = () => {
    // بعد التعليم: الانتقال للمرحلة الأولى الحقيقية (الجزر السماوية 1)
    if (isTutorialRef.current) {
      handleStartLocalCoop('sky_islands', 1);
      return;
    }
    const curW = roomState?.worldId ?? selectedWorldId;
    const curS: StageNumber = roomState?.stage ?? selectedStage;
    let nextW: WorldId = curW;
    let nextS: StageNumber = 2;
    if (curS === 2) {
      const curOrder = getStageDef(curW, 1).order;
      const nextWorldObj = WORLD_LIST.find((w) => w.order === curOrder + 1);
      if (!nextWorldObj) return;
      nextW = nextWorldObj.id;
      nextS = 1;
    }
    victoryRecordedRef.current = false;
    setSelectedWorldId(nextW);
    setSelectedStage(nextS);
    if (isLocalCoop) {
      handleStartLocalCoop(nextW, nextS);
    } else {
      netRef.current?.selectWorld(nextW, nextS);
      netRef.current?.startGame();
      setView('playing');
    }
  };

  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const showTouchControls =
    settings.showTouchControls === 'always' ||
    (settings.showTouchControls === 'auto' && isTouchDevice);

  const canvasMode: CanvasMode =
    view === 'character'
      ? 'character'
      : view === 'lobby'
      ? 'lobby'
      : view === 'victory'
      ? 'victory'
      : view === 'playing' || view === 'paused'
      ? 'playing'
      : 'title';

  const activeFocusId = isLocalCoop
    ? activeControlSlot === 0
      ? 'local_p1'
      : 'local_p2'
    : localPlayerId;

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[#0b1020]"
      onPointerDown={() => gameAudio.unlock()}
    >
      {/* Isolated 3D WebGL Viewport */}
      <GameCanvas
        mode={canvasMode}
        worldId={selectedWorldId}
        stage={roomState?.stage ?? selectedStage}
        tutorialMode={isTutorial}
        quality={settings.quality}
        localCustomization={customization}
        snapshotRef={snapshotRef}
        localInputRef={localInputP1Ref}
        focusPlayerId={activeFocusId}
        cameraSensitivity={settings.cameraSensitivity}
        onProjectedLabels={setLabels}
        onLocalStepTick={onLocalStepTick}
      />

      {/* Event Toast Banner */}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shadow-xl pointer-events-none">
          {toastMsg}
        </div>
      )}

      {/* Active Gameplay HUD */}
      {(view === 'playing' || view === 'paused') && roomState && (
        <GameHud
          snapshot={roomState}
          labels={labels}
          localPlayerId={activeFocusId}
          lang={settings.language}
          isLocalCoop={isLocalCoop}
          isTutorial={isTutorial}
          activeControlSlot={activeControlSlot}
          onSwitchActiveSlot={() =>
            setActiveControlSlot((prev) => (prev === 0 ? 1 : 0))
          }
          pingMs={pingMs}
          inputDeltaMs={inputDeltaMs}
          pendingInputsCount={pendingInputsCount}
          isOnline={!isLocalCoop}
          muted={settings.muted}
          voiceMuted={voiceMuted}
          showTouchControls={showTouchControls}
          localInputRef={localInputP1Ref}
          onInputRegistered={() => {
            const seq = ++inputSeqRef.current;
            localInputP1Ref.current.inputSeq = seq;
            const map = pendingInputTimesRef.current;
            map.set(seq, performance.now());
            if (map.size > 64) {
              const oldest = map.keys().next().value;
              if (oldest !== undefined) map.delete(oldest);
            }
          }}
          onToggleMute={() =>
            handleUpdateSettings({ ...settings, muted: !settings.muted })
          }
          onToggleVoice={() => {
            netRef.current?.toggleVoice().then((active) => setVoiceMuted(!active));
          }}
          onPause={() => setView('paused')}
          onRestartCheckpoint={handleRestartGame}
        />
      )}

      {/* Menus, Lobby, Customizer, Worlds, Friends, Settings, Pause & Victory */}
      <MenuScreens
        view={view}
        setView={setView}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        customization={customization}
        onUpdateCustomization={handleUpdateCustomization}
        stats={stats}
        selectedWorldId={selectedWorldId}
        selectedStage={selectedStage}
        onSelectWorld={handleSelectWorld}
        roomState={roomState}
        localPlayerId={localPlayerId}
        connectionStatus={connectionStatus}
        roomError={roomError}
        friends={friends}
        onSaveFriends={(f) => {
          setFriends(f);
          saveFriends(f);
        }}
        onCreateOnlineRoom={handleCreateOnlineRoom}
        onJoinOnlineRoom={handleJoinOnlineRoom}
        onStartLocalCoop={handleStartLocalCoop}
        onStartTutorial={handleStartTutorial}
        isTutorial={isTutorial}
        onStartOnlineGame={() => {
          gameAudio.unlock();
          victoryRecordedRef.current = false;
          netRef.current?.startGame();
        }}
        onNextStage={handleNextStage}
        onLeaveRoom={handleLeaveRoom}
        onRestartGame={handleRestartGame}
        onResumeGame={() => setView('playing')}
        victoryEarnedStars={victoryStars}
      />
    </div>
  );
}
