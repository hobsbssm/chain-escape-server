import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Anchor,
  Flag,
  Hand,
  KeyRound,
  Mic,
  MicOff,
  Pause,
  RotateCcw,
  Skull,
  Star,
  Timer,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type {
  ChainVisualState,
  ContextActionHint,
  LanguageCode,
  PlayerInputState,
  RoomStateSnapshot,
} from '../shared/types.ts';
import { getStageDef } from '../shared/worldsData.ts';
import { TUTORIAL_STAGE } from '../shared/tutorialStage.ts';
import type { ProjectedLabel } from './GameCanvas.tsx';

interface GameHudProps {
  snapshot: RoomStateSnapshot;
  labels: ProjectedLabel[];
  localPlayerId: string;
  lang: LanguageCode;
  isLocalCoop: boolean;
  /** عند true تُعرض خطوات المرحلة التعليمية المقفلة */
  isTutorial?: boolean;
  activeControlSlot: 0 | 1;
  onSwitchActiveSlot?: () => void;
  pingMs: number;
  inputDeltaMs: number;
  pendingInputsCount: number;
  isOnline: boolean;
  muted: boolean;
  voiceMuted: boolean;
  showTouchControls: boolean;
  localInputRef: React.MutableRefObject<PlayerInputState>;
  onInputRegistered?: () => void;
  onToggleMute: () => void;
  onToggleVoice: () => void;
  onPause: () => void;
  onRestartCheckpoint: () => void;
}

function formatTimer(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getInteractLabel(
  hint: ContextActionHint | undefined,
  ar: boolean,
  compact = false,
): string {
  switch (hint) {
    case 'help_ally':
      return compact ? (ar ? 'مساعدة' : 'Help') : ar ? 'مساعدة الزميل (E)' : 'Help Ally (E)';
    case 'hoist_ally':
      return compact ? (ar ? 'رفع' : 'Hoist') : ar ? 'رفع الصديق (E)' : 'Hoist Ally (E)';
    case 'rotate_mirror':
      return compact ? (ar ? 'مرآة' : 'Mirror') : ar ? 'تدوير المرآة (E)' : 'Rotate Mirror (E)';
    case 'swing_rope':
      return compact ? (ar ? 'حبل' : 'Rope') : ar ? 'تأرجح بالحبل (E)' : 'Grab Rope (E)';
    case 'chain_pull':
      return compact ? (ar ? 'شد' : 'Winch') : ar ? 'شد السلسلة (E)' : 'Pull Winch (E)';
    case 'winch':
      return compact ? (ar ? 'رافعة' : 'Lever') : ar ? 'سحب الرافعة (E)' : 'Pull Lever (E)';
    case 'anchor':
      return compact ? (ar ? 'تثبيت' : 'Anchor') : ar ? 'تثبيت السلسلة (E)' : 'Anchor (E)';
    case 'grab_crate':
      return compact ? (ar ? 'صندوق' : 'Crate') : ar ? 'سحب الصندوق (E)' : 'Grab Crate (E)';
    case 'collect_key':
      return compact ? (ar ? 'مفتاح' : 'Key') : ar ? 'التقاط المفتاح' : 'Take Key';
    case 'pull_friend':
    default:
      return compact ? (ar ? 'سحب' : 'Pull') : ar ? 'سحب الصديق (E)' : 'Pull Friend (E)';
  }
}

/** خطوات المرحلة التعليمية بالترتيب — نص عربي أساساً مع إنجليزية مختصرة */
const TUTORIAL_STEPS: {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  keysAr: string;
  keysEn: string;
  touchAr: string;
  touchEn: string;
}[] = [
  {
    titleAr: 'المشي والقفز',
    titleEn: 'Walk & Jump',
    bodyAr: 'امشِ للأمام واقفز فوق الفجوة الأولى لتصل إلى المنصة التالية.',
    bodyEn: 'Walk forward and jump over the first gap to reach the next platform.',
    keysAr: 'WASD للتحرك · Space للقفز',
    keysEn: 'WASD Move · Space Jump',
    touchAr: 'العصا للتحرك · زر القفز',
    touchEn: 'Joystick to move · Jump button',
  },
  {
    titleAr: 'القفز المزدوج',
    titleEn: 'Double Jump',
    bodyAr:
      'الفجوة أمامك عريضة: قفزة واحدة لا تكفي! اضغط زر القفز مرتين — الثانية وأنت في الهواء — لتعبر.',
    bodyEn:
      'This gap is too wide for one jump! Press jump twice — the second mid-air — to cross it.',
    keysAr: 'Space ثم Space مرة أخرى في الهواء',
    keysEn: 'Space, then Space again mid-air',
    touchAr: 'اضغط زر القفز مرتين في الهواء',
    touchEn: 'Tap the Jump button twice mid-air',
  },
  {
    titleAr: 'السحب بالسلسلة',
    titleEn: 'Chain Pull',
    bodyAr:
      'أنتما مربوطان بسلسلة! ابتعد أحدكما عن الآخر حتى تشتد السلسلة، ثم يضغط الساحب زر التفاعل مطولاً فيُسحب شريكه نحوه. بدّل بين اللاعبين عند الحاجة.',
    bodyEn:
      'You are chained together! Move apart until the chain is taut, then the puller holds the action button to drag their partner closer. Switch players if needed.',
    keysAr: 'E مطولاً للسحب · Tab للتبديل بين اللاعبين',
    keysEn: 'Hold E to pull · Tab to switch players',
    touchAr: 'زر السحب مطولاً · زر التبديل بين اللاعبين',
    touchEn: 'Hold the Pull button · Switch button to swap players',
  },
  {
    titleAr: 'الإنقاذ عند السقوط',
    titleEn: 'Rescue a Fall',
    bodyAr:
      'قف على حافة الجرف الأحمر ويمشِ لاعب واحد فقط من الحافة (أو قفزة واحدة دون قفز مزدوج) فيتعلق بالسلسلة بدل السقوط. الشريك يثبّت نفسه ثم يسحبه بالسلسلة حتى يعود للأرض.',
    bodyEn:
      'One player only walks off the red cliff edge (or one single jump, no double jump) and hangs on the chain instead of falling. The partner braces, then pulls them back up to safety.',
    keysAr: 'الشريك: C للتثبيت + E مطولاً للسحب',
    keysEn: 'Partner: C to brace + hold E to pull',
    touchAr: 'الشريك: زر التثبيت + زر السحب مطولاً',
    touchEn: 'Partner: Brace button + hold Pull button',
  },
  {
    titleAr: 'الوصول إلى النهاية',
    titleEn: 'Reach the Finish',
    bodyAr:
      'أحسنتما! اعبرا الفجوة الأخيرة معاً (القفز المزدوج يساعد) واصلا إلى منصة النهاية الخضراء.',
    bodyEn:
      'Well done! Cross the last gap together (double jump helps) and reach the green finish platform.',
    keysAr: 'WASD + Space (مرتين للقفز المزدوج)',
    keysEn: 'WASD + Space (twice for double jump)',
    touchAr: 'العصا + زر القفز',
    touchEn: 'Joystick + Jump button',
  },
];

export const GameHud: React.FC<GameHudProps> = ({
  snapshot,
  labels,
  localPlayerId,
  lang,
  isLocalCoop,
  isTutorial = false,
  activeControlSlot,
  onSwitchActiveSlot,
  pingMs,
  inputDeltaMs,
  pendingInputsCount,
  isOnline,
  muted,
  voiceMuted,
  showTouchControls,
  localInputRef,
  onInputRegistered,
  onToggleMute,
  onToggleVoice,
  onPause,
  onRestartCheckpoint,
}) => {
  const ar = lang === 'ar';
  const world = isTutorial
    ? TUTORIAL_STAGE
    : getStageDef(snapshot.worldId, snapshot.stage ?? 1);
  const maxTension = snapshot.chains.reduce((m, c) => Math.max(m, c.tension), 0);
  const dominantChainState: ChainVisualState =
    snapshot.chains[0]?.state ?? 'relaxed';

  const chainLabels: Record<ChainVisualState, { ar: string; en: string; color: string }> = {
    relaxed: { ar: 'سلسلة مرنة', en: 'Relaxed', color: 'text-emerald-400' },
    tensioned: { ar: 'شد عالٍ!', en: 'High Tension!', color: 'text-orange-400' },
    swinging: { ar: 'تأرجح بالسلسلة', en: 'Swinging', color: 'text-sky-400' },
    pulling: { ar: 'سحب تعاوني', en: 'Co-op Pull', color: 'text-amber-300' },
    collision: { ar: 'احتكاك بالحافة', en: 'Edge Contact', color: 'text-slate-300' },
  };

  const localPlayer = snapshot.players.find((p) => p.id === localPlayerId);
  const hasKeyPuzzle = world.puzzles.some((p) => p.kind === 'key_item');
  const totalKeys = world.puzzles.filter((p) => p.kind === 'key_item').length;
  const anyKnockedDown = snapshot.players.some((p) => p.knockedDown);
  const anyHanging = snapshot.players.some((p) => p.hanging);
  const anyHighTension = maxTension >= 0.84;

  // Map per-player max adjacent chain tension to flag players stretched too far
  const playerMaxTension = new Map<string, number>();
  snapshot.chains.forEach((ch, idx) => {
    const a = snapshot.players[idx];
    const b = snapshot.players[idx + 1];
    if (a) playerMaxTension.set(a.id, Math.max(playerMaxTension.get(a.id) ?? 0, ch.tension));
    if (b) playerMaxTension.set(b.id, Math.max(playerMaxTension.get(b.id) ?? 0, ch.tension));
  });

  // Virtual Joystick tracking
  const joyRef = useRef<HTMLDivElement | null>(null);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const joyTouchId = useRef<number | null>(null);

  const updateJoystick = (clientX: number, clientY: number) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setJoyKnob({ x: dx, y: dy });
    localInputRef.current.moveX = dx / maxR;
    localInputRef.current.moveZ = dy / maxR;
    onInputRegistered?.();
  };

  const resetJoystick = () => {
    joyTouchId.current = null;
    setJoyKnob({ x: 0, y: 0 });
    localInputRef.current.moveX = 0;
    localInputRef.current.moveZ = 0;
    onInputRegistered?.();
  };

  const totalCheckpoints = Math.max(1, world.checkpoints.length);
  const progressPct = Math.round((snapshot.checkpointIndex / (totalCheckpoints - 1 || 1)) * 100);
  const chainInfo = chainLabels[dominantChainState];
  const interactHighlight =
    localPlayer?.anim === 'pulling' ||
    localPlayer?.contextAction === 'help_ally' ||
    localPlayer?.contextAction === 'hoist_ally' ||
    Boolean(localPlayer?.swingingRopeId);

  // ---- المرحلة التعليمية: خطوات مقفلة تُكتشف من لقطة المحاكاة فقط ----
  // لا نعيد كتابة الفيزياء: كل كشف يعتمد على مواضع اللاعبين وحالاتهم
  // (anim/tension/rescues) التي تنتجها RoomSimulation أصلاً.
  const [tutStep, setTutStep] = useState(0);
  const tutRescueBaseRef = useRef<number | null>(null);
  const tutDragLastRef = useRef<{ x: number; z: number } | null>(null);
  const tutDragAccumRef = useRef(0);
  const tutDoubleSeenRef = useRef(false);
  const tutPrevVyRef = useRef<Map<string, { vy: number; grounded: boolean }>>(
    new Map(),
  );

  const resetTutorialTracking = () => {
    tutRescueBaseRef.current = null;
    tutDragLastRef.current = null;
    tutDragAccumRef.current = 0;
    tutDoubleSeenRef.current = false;
    tutPrevVyRef.current.clear();
  };

  useEffect(() => {
    if (!isTutorial) return;
    // إعادة تشغيل التعليم (الوقت عاد للصفر) تعيد الخطوات للبداية
    if (snapshot.elapsedSec < 0.15) {
      if (tutStep !== 0) setTutStep(0);
      resetTutorialTracking();
      return;
    }
    const players = snapshot.players;
    if (tutStep === 0) {
      // (أ) المشي والقفز: الوصول لمنصة ما بعد الفجوة الأولى (z <= -20.5)
      if (players.some((p) => p.z <= -20.5)) setTutStep(1);
    } else if (tutStep === 1) {
      // (ب) القفز المزدوج: لا يكفي الوصول للمنصة — القفزة الواحدة مع
      // الركض تعبر الفجوة بمساعدة التسلق. نرصد القفزة الثانية نفسها
      // بإشارتين مكملتين (أي منهما تكفي):
      // 1) قفزة مفاجئة في السرعة العمودية أثناء الطيران فوق الفجوة
      //    (القفزة الثانية ترفع vy إلى 9.4 في إطار واحد؛ الجاذبية
      //    والسحب لا يرفعانها أكثر من ~0.3 في الإطار، والتسلق
      //    مستبعد لأن منطقة الفجوة z∈[-28.5,-22.5] خارج بصمة المنصتين)
      // 2) بلوغ ارتفاع 5م فوق الفجوة (القفزة الواحدة أقصاها ~4.5م
      //    حتى مع الركض والتسلق، والمزدوجة المثبتة ~6.3م)
      for (const p of players) {
        const prev = tutPrevVyRef.current.get(p.id);
        if (
          prev &&
          !prev.grounded &&
          !p.grounded &&
          p.vy - prev.vy > 2.0 &&
          p.vy > 5 &&
          p.z >= -28.5 &&
          p.z <= -22.5
        ) {
          tutDoubleSeenRef.current = true;
        }
        if (!p.grounded && p.y >= 5.0 && p.z >= -31 && p.z <= -20) {
          tutDoubleSeenRef.current = true;
        }
      }
      if (
        tutDoubleSeenRef.current &&
        players.some((p) => p.y >= 3.3 && p.z >= -35.5 && p.z <= -28.5)
      ) {
        setTutStep(2);
        resetTutorialTracking();
      }
    } else if (tutStep === 2) {
      // (ج) السحب بالسلسلة: لاعب بحالة 'dragged' مع شد سلسلة مرتفع،
      // ويُسحب فعلياً مسافة 1.5م على الأقل نحو شريكه
      const tension = snapshot.chains[0]?.tension ?? 0;
      const dragged = players.find((p) => p.anim === 'dragged');
      if (dragged && tension > 0.5) {
        if (tutDragLastRef.current) {
          tutDragAccumRef.current += Math.hypot(
            dragged.x - tutDragLastRef.current.x,
            dragged.z - tutDragLastRef.current.z,
          );
        }
        tutDragLastRef.current = { x: dragged.x, z: dragged.z };
        if (tutDragAccumRef.current >= 1.5) {
          setTutStep(3);
          resetTutorialTracking();
        }
      } else {
        tutDragLastRef.current = null;
      }
    } else if (tutStep === 3) {
      // (د) الإنقاذ عند السقوط: عداد rescues في المحاكاة يزيد فقط عندما
      // يعود لاعب كان معلقاً بالسلسلة (hanging) إلى الأرض
      if (tutRescueBaseRef.current === null) {
        tutRescueBaseRef.current = snapshot.rescues;
      } else if (snapshot.rescues > tutRescueBaseRef.current) {
        setTutStep(4);
        resetTutorialTracking();
      }
    }
    // الخطوة (هـ) تكتمل بالوصول لمنصة النهاية — تنهيها المحاكاة (victory)
    // حفظ سرعة كل لاعب وحالته للمقارنة في الإطار التالي (كشف القفز المزدوج)
    const nextPrev = new Map<string, { vy: number; grounded: boolean }>();
    for (const p of snapshot.players) {
      nextPrev.set(p.id, { vy: p.vy, grounded: p.grounded });
    }
    tutPrevVyRef.current = nextPrev;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, isTutorial, tutStep]);

  return (
    <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
      {/* Projected World-Space Player Nameplates */}
      {labels.map((lbl) =>
        lbl.visible ? (
          <div
            key={lbl.id}
            style={{ transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)` }}
            className="absolute top-0 left-0 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950/80 border border-white/15 text-[11px] font-bold text-white whitespace-nowrap shadow-md"
          >
            {lbl.isHost && <span className="text-amber-400">★</span>}
            <span>{lbl.name}</span>
            {lbl.knockedDown && (
              <span className="text-amber-400 font-extrabold">
                {ar ? 'سقط!' : 'DOWN!'}
              </span>
            )}
            {!lbl.knockedDown && lbl.hanging && (
              <span className="text-rose-400 font-extrabold">
                {ar ? 'يتعلق!' : 'HANGING!'}
              </span>
            )}
            {isOnline && (
              lbl.voiceMuted ? (
                <MicOff className="w-3 h-3 text-slate-400" />
              ) : (
                <Mic className={`w-3 h-3 ${lbl.voiceSpeaking ? 'text-emerald-400' : 'text-sky-300'}`} />
              )
            )}
          </div>
        ) : null,
      )}

      {/* Top HUD Bar */}
      <div className="flex items-start justify-between gap-2 p-3 sm:p-4">
        {/* Teammate Status Cluster with Character Portraits */}
        <div className="flex flex-col gap-1.5 min-w-[162px] max-w-[225px]">
          {snapshot.players.map((pl) => {
            const pTension = playerMaxTension.get(pl.id) ?? 0;
            const tooFar = pTension >= 0.84;
            return (
              <div
                key={pl.id}
                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-slate-950/85 border ${
                  pl.knockedDown
                    ? 'border-amber-400/90'
                    : pl.hanging
                    ? 'border-rose-500/80'
                    : tooFar
                    ? 'border-orange-400/85'
                    : pl.id === localPlayerId
                    ? 'border-orange-400/70'
                    : 'border-white/10'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`relative w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border shadow-inner overflow-hidden ${
                      isOnline && pl.voiceSpeaking
                        ? 'ring-2 ring-emerald-400 border-emerald-300'
                        : 'border-white/35'
                    }`}
                    style={{ backgroundColor: pl.customization.colorHex }}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                      <circle cx="12" cy="11" r="6.2" fill="#fde68a" />
                      <path d="M5.8 10.5C6.2 6.5 9.2 4.8 12 4.8c2.8 0 5.8 1.7 6.2 5.7H5.8z" fill="#334155" />
                      {pl.customization.hat === 'goggles' && (
                        <g fill="#f59e0b" stroke="#1e293b" strokeWidth="0.9">
                          <circle cx="9.6" cy="8.2" r="2.1" />
                          <circle cx="14.4" cy="8.2" r="2.1" />
                        </g>
                      )}
                      {pl.knockedDown ? (
                        <path d="M8.5 12.2l2 2m0-2l-2 2m5-2l2 2m0-2l-2 2" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
                      ) : (
                        <g fill="#0f172a">
                          <circle cx="9.8" cy="12" r="1.05" />
                          <circle cx="14.2" cy="12" r="1.05" />
                        </g>
                      )}
                    </svg>
                    {isOnline && (
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-slate-950 ${
                          pl.voiceMuted ? 'bg-slate-500' : pl.voiceSpeaking ? 'bg-emerald-400' : 'bg-sky-400'
                        }`}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate text-white leading-tight">
                      {pl.customization.name}
                    </div>
                    <div className="h-1 w-14 rounded-full bg-slate-800 mt-1 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.round(Math.max(15, pl.balance * 100))}%`,
                          backgroundColor: pl.knockedDown ? '#ef4444' : tooFar ? '#f97316' : '#22c55e',
                        }}
                      />
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-semibold shrink-0 ${
                    pl.knockedDown
                      ? 'text-amber-300 font-extrabold'
                      : pl.hanging
                      ? 'text-rose-300 font-extrabold'
                      : tooFar
                      ? 'text-orange-300 font-extrabold'
                      : 'text-slate-300'
                  }`}
                >
                  {pl.finished
                    ? ar
                      ? 'وصل'
                      : 'Goal'
                    : pl.knockedDown
                    ? ar
                      ? 'سقط!'
                      : 'Down!'
                    : pl.hanging
                    ? ar
                      ? 'إنقاذ!'
                      : 'Save!'
                    : !pl.connected
                    ? ar
                      ? 'إعادة'
                      : 'Reconn'
                    : tooFar
                    ? ar
                      ? 'بعيد!'
                      : 'Far!'
                    : pl.swingingRopeId
                    ? ar
                      ? 'متأرجح'
                      : 'Swing'
                    : pl.anim === 'dragged'
                    ? ar
                      ? 'يُسحب'
                      : 'Pulled'
                    : pl.grabbingId || pl.anim === 'pulling'
                    ? ar
                      ? 'سحب'
                      : 'Pull'
                    : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* Center Stage Metrics */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3 py-1.5 rounded-xl bg-slate-950/85 border border-white/15 shadow-lg">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-300 whitespace-nowrap">
            <Flag className="w-4 h-4 text-orange-400" />
            <span>
              {ar ? world.nameAr : world.nameEn} ·{' '}
              <span className="text-orange-300">
                {ar ? `م${snapshot.stage ?? 1}` : `S${snapshot.stage ?? 1}`}
              </span>
            </span>
            <span className="text-slate-400 font-mono-num">
              {snapshot.checkpointIndex + 1}/{totalCheckpoints}
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1 text-xs sm:text-sm font-mono-num font-bold text-white">
            <Timer className="w-4 h-4 text-sky-400" />
            <span>{formatTimer(snapshot.elapsedSec)}</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1 text-xs sm:text-sm font-mono-num font-bold text-rose-300">
            <Skull className="w-4 h-4 text-rose-400" />
            <span>{snapshot.falls}</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1 text-xs sm:text-sm font-mono-num font-bold text-yellow-300">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span>
              {snapshot.collectedStars.length}/{world.stars.length}
            </span>
          </div>
          {hasKeyPuzzle && (
            <>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1 text-xs sm:text-sm font-mono-num font-bold text-amber-300">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>
                  {snapshot.collectedKeys.length}/{totalKeys}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Top Action Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {isOnline && (
            <button
              onClick={onToggleVoice}
              title={ar ? 'الميكروفون' : 'Microphone'}
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
                voiceMuted
                  ? 'bg-slate-950/85 border-white/15 text-slate-300 hover:text-white'
                  : 'bg-emerald-600/90 border-emerald-400 text-white'
              }`}
            >
              {voiceMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={onToggleMute}
            title={ar ? 'كتم الصوت' : 'Mute Audio'}
            className="w-10 h-10 rounded-xl bg-slate-950/85 border border-white/15 text-white flex items-center justify-center hover:border-orange-400/60"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {!isOnline && (
            <button
              onClick={onRestartCheckpoint}
              title={ar ? 'إعادة المرحلة' : 'Restart Stage'}
              className="w-10 h-10 rounded-xl bg-slate-950/85 border border-white/15 text-white flex items-center justify-center hover:border-orange-400/60"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onPause}
            title={ar ? 'إيقاف مؤقت' : 'Pause'}
            className="w-10 h-10 rounded-xl bg-slate-950/85 border border-white/15 text-white flex items-center justify-center hover:border-orange-400/60"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Knockdown / Hanging / High Tension Rescue Alert Banner */}
      {anyKnockedDown ? (
        <div className="mx-auto mt-1 w-fit px-4 py-1.5 rounded-lg bg-amber-950/90 border border-amber-400/80 text-xs font-extrabold text-amber-100 shadow-lg">
          {ar
            ? 'زميلك سقط! اقترب واضغط E أو اسحبه بالسلسلة لرفعه'
            : 'Teammate down! Approach & press E or pull via chain to help them up'}
        </div>
      ) : anyHanging ? (
        <div className="mx-auto mt-1 w-fit px-4 py-1.5 rounded-lg bg-rose-950/90 border border-rose-500/70 text-xs font-extrabold text-rose-100 shadow-lg">
          {ar
            ? 'أحد الزملاء معلق بالسلسلة! تحرك للخلف أو اقفز لإنقاذه'
            : 'Teammate hanging on the chain! Pull back or jump to hoist them up'}
        </div>
      ) : anyHighTension ? (
        <div className="mx-auto mt-1 w-fit px-4 py-1.5 rounded-lg bg-orange-950/90 border border-orange-400/70 text-xs font-extrabold text-orange-100 shadow-lg">
          {ar
            ? 'شد السلسلة مرتفع جداً — أحد اللاعبين بعيد عن الفريق!'
            : 'High chain tension — a teammate is getting too far!'}
        </div>
      ) : null}

      {/* Tutorial Step Banner (locked steps, keyboard + touch) */}
      {isTutorial && (
        <div className="pointer-events-auto mx-auto mt-2 w-[min(560px,92vw)] rounded-2xl bg-slate-950/90 border-2 border-amber-400/70 p-3.5 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[11px] font-black">
                {ar
                  ? `الخطوة ${tutStep + 1} من ${TUTORIAL_STEPS.length}`
                  : `Step ${tutStep + 1} of ${TUTORIAL_STEPS.length}`}
              </span>
              <span className="text-sm font-black text-white">
                {ar ? TUTORIAL_STEPS[tutStep].titleAr : TUTORIAL_STEPS[tutStep].titleEn}
              </span>
            </div>
            {tutStep < TUTORIAL_STEPS.length - 1 && (
              <button
                onClick={() => {
                  resetTutorialTracking();
                  setTutStep((s) => Math.min(TUTORIAL_STEPS.length - 1, s + 1));
                }}
                className="shrink-0 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300"
              >
                {ar ? 'تخطي هذه الخطوة' : 'Skip this step'}
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs font-bold text-amber-100 leading-relaxed">
            {ar ? TUTORIAL_STEPS[tutStep].bodyAr : TUTORIAL_STEPS[tutStep].bodyEn}
          </p>
          {tutStep === 1 &&
            !tutDoubleSeenRef.current &&
            snapshot.players.some(
              (p) => p.y >= 3.3 && p.z >= -35.5 && p.z <= -28.5,
            ) && (
              <p className="mt-1 text-[11px] font-extrabold text-rose-300 leading-relaxed">
                {ar
                  ? 'وصلت للمنصة لكن دون قفز مزدوج — ارجع للمنصة السابقة (اقفز مع السقوط) وحاول مجدداً بقفزتين.'
                  : 'You reached the platform without a double jump — go back (jump with the drop) and try again with two jumps.'}
              </p>
            )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="px-2 py-1 rounded-lg bg-slate-900 border border-white/15 text-[11px] font-bold text-sky-300">
              {ar ? 'كيبورد: ' : 'Keyboard: '}
              {ar ? TUTORIAL_STEPS[tutStep].keysAr : TUTORIAL_STEPS[tutStep].keysEn}
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-900 border border-white/15 text-[11px] font-bold text-emerald-300">
              {ar ? 'لمس: ' : 'Touch: '}
              {ar ? TUTORIAL_STEPS[tutStep].touchAr : TUTORIAL_STEPS[tutStep].touchEn}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5">
            {TUTORIAL_STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i < tutStep
                    ? 'bg-emerald-400'
                    : i === tutStep
                    ? 'bg-amber-400'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom Center Progress & Chain Tension Meter */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 w-[min(450px,90vw)]">
        {/* Local Co-op Active Player Switcher */}
        {isLocalCoop && onSwitchActiveSlot && (
          <div className="pointer-events-auto flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950/85 border border-white/15 text-[11px] text-slate-200">
            <span>
              {ar
                ? `اللاعب النشط بالماوس/اللمس: لاعب ${activeControlSlot + 1}`
                : `Primary Focus: Player ${activeControlSlot + 1}`}
            </span>
            <button
              onClick={onSwitchActiveSlot}
              className="px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold"
            >
              {ar ? 'تبديل (Tab)' : 'Switch (Tab)'}
            </button>
          </div>
        )}

        <div className="w-full px-3.5 py-2 rounded-xl bg-slate-950/85 border border-white/15 shadow-lg">
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold mb-1.5">
            <span className={chainInfo.color}>
              {ar ? chainInfo.ar : chainInfo.en}
            </span>
            <div className="flex items-center gap-2">
              {!showTouchControls && (snapshot.players.length > 1 || localPlayer?.contextAction !== 'none') && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    localInputRef.current.interactPressed = true;
                    localInputRef.current.interactHeld = true;
                    onInputRegistered?.();
                  }}
                  onPointerUp={() => {
                    localInputRef.current.interactHeld = false;
                    onInputRegistered?.();
                  }}
                  onPointerCancel={() => {
                    localInputRef.current.interactHeld = false;
                    onInputRegistered?.();
                  }}
                  onPointerLeave={() => {
                    if (localInputRef.current.interactHeld) {
                      localInputRef.current.interactHeld = false;
                      onInputRegistered?.();
                    }
                  }}
                  className={`pointer-events-auto flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[11px] font-extrabold transition-colors select-none ${
                    interactHighlight
                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                      : 'bg-sky-600/85 hover:bg-sky-500 text-white border-sky-300/60'
                  }`}
                >
                  <Hand className="w-3 h-3" />
                  <span>{getInteractLabel(localPlayer?.contextAction, ar, false)}</span>
                </button>
              )}
              <span className="text-slate-400 font-mono-num">
                {progressPct}%
              </span>
            </div>
          </div>
          {/* Tension + Progress Dual Bar */}
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full transition-all duration-150"
              style={{
                width: `${Math.max(8, Math.round(maxTension * 100))}%`,
                backgroundColor:
                  maxTension > 0.72 ? '#ef4444' : maxTension > 0.4 ? '#f59e0b' : '#22c55e',
              }}
            />
          </div>
          {!showTouchControls && (
            <div className="mt-1.5 text-[10px] text-slate-400 text-center whitespace-nowrap overflow-hidden text-ellipsis">
              {isLocalCoop
                ? ar
                  ? 'لاعب 1: WASD + Space + E (تفاعل/سحب) · لاعب 2: الأسهم + Enter + / (تفاعل) · Tab تبديل'
                  : 'P1: WASD + Space + E (Action) · P2: Arrows + Enter + / (Action) · Tab Switch'
                : ar
                ? 'WASD تحرك · Space قفز · Shift ركض · E تفاعل/إنقاذ/سحب · C تثبيت · سحب الماوس كاميرا'
                : 'WASD Move · Space Jump · Shift Sprint · E Action/Rescue/Pull · C Brace · Drag Camera'}
            </div>
          )}
        </div>
      </div>

      {/* Compact Input-to-Snapshot Latency & Desync Indicator */}
      {(() => {
        const isDesync = isOnline && (inputDeltaMs > 150 || pendingInputsCount > 4);
        const isElevated = isOnline && !isDesync && inputDeltaMs > 80;
        const statusText = isDesync
          ? ar
            ? 'عدم تزامن'
            : 'DESYNC'
          : isElevated
          ? ar
            ? 'بطء'
            : 'LAG'
          : ar
          ? 'متزامن'
          : 'SYNC';
        const toneClass = isDesync
          ? 'text-rose-400 border-rose-500/50'
          : isElevated
          ? 'text-amber-300 border-amber-500/40'
          : 'text-emerald-400 border-white/10';
        return (
          <div
            dir="ltr"
            title={
              ar
                ? 'فرق التوقيت بين تسجيل الإدخال المحلي وتحديث حالة الخادم'
                : 'Delta between local input registration and server snapshot update'
            }
            className={`fixed ${
              showTouchControls ? 'top-16 right-3' : 'bottom-3 left-3'
            } flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/85 border text-[11px] font-mono-num ${toneClass}`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span className="font-bold">{statusText}</span>
            <span className="text-slate-300">Δ {inputDeltaMs}ms</span>
            {isOnline && (
              <span className="text-slate-400 border-l border-white/15 pl-2">
                RTT {pingMs}ms
              </span>
            )}
          </div>
        );
      })()}

      {/* Touch Controls (Virtual Joystick + Context-Aware Action Buttons) */}
      {showTouchControls && (
        <>
          <div
            ref={joyRef}
            onPointerDown={(e) => {
              e.stopPropagation();
              joyTouchId.current = e.pointerId;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              updateJoystick(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (joyTouchId.current !== e.pointerId) return;
              updateJoystick(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              if (joyTouchId.current !== e.pointerId) return;
              resetJoystick();
            }}
            onPointerCancel={resetJoystick}
            className="pointer-events-auto fixed bottom-6 left-5 w-28 h-28 rounded-full bg-slate-950/65 border-2 border-white/25 flex items-center justify-center touch-none"
          >
            <div
              className="w-12 h-12 rounded-full bg-white/85 shadow-md"
              style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
            />
          </div>

          <div className="pointer-events-auto fixed bottom-6 right-5 grid grid-cols-2 gap-2.5">
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                localInputRef.current.interactPressed = true;
                localInputRef.current.interactHeld = true;
                onInputRegistered?.();
              }}
              onPointerUp={() => {
                localInputRef.current.interactHeld = false;
                onInputRegistered?.();
              }}
              onPointerCancel={() => {
                localInputRef.current.interactHeld = false;
                onInputRegistered?.();
              }}
              onPointerLeave={() => {
                if (localInputRef.current.interactHeld) {
                  localInputRef.current.interactHeld = false;
                  onInputRegistered?.();
                }
              }}
              className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center active:scale-95 transition-colors ${
                interactHighlight
                  ? 'bg-amber-500 border-amber-200 text-slate-950 shadow-lg'
                  : 'bg-slate-900/85 border-sky-400/70 text-white'
              }`}
            >
              <Hand className={`w-5 h-5 ${interactHighlight ? 'text-slate-950' : 'text-sky-300'}`} />
              <span className="text-[9px] font-bold">
                {getInteractLabel(localPlayer?.contextAction, ar, true)}
              </span>
            </button>
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                localInputRef.current.jumpPressed = true;
                localInputRef.current.jumpHeld = true;
                onInputRegistered?.();
              }}
              onPointerUp={() => {
                localInputRef.current.jumpHeld = false;
                onInputRegistered?.();
              }}
              onPointerCancel={() => {
                localInputRef.current.jumpHeld = false;
                onInputRegistered?.();
              }}
              className="w-16 h-16 rounded-full bg-orange-600/90 border-2 border-amber-300 text-white flex flex-col items-center justify-center shadow-lg active:scale-95"
            >
              <Zap className="w-6 h-6" />
              <span className="text-[10px] font-extrabold">{ar ? 'قفز' : 'Jump'}</span>
            </button>
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                localInputRef.current.crouchHeld = true;
                onInputRegistered?.();
              }}
              onPointerUp={() => {
                localInputRef.current.crouchHeld = false;
                onInputRegistered?.();
              }}
              onPointerCancel={() => {
                localInputRef.current.crouchHeld = false;
                onInputRegistered?.();
              }}
              className="w-13 h-13 rounded-full bg-slate-900/85 border border-white/25 text-white flex flex-col items-center justify-center active:scale-95"
            >
              <Anchor className="w-4 h-4 text-emerald-300" />
              <span className="text-[9px] font-bold">{ar ? 'تثبيت' : 'Brace'}</span>
            </button>
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                localInputRef.current.sprintHeld = true;
                onInputRegistered?.();
              }}
              onPointerUp={() => {
                localInputRef.current.sprintHeld = false;
                onInputRegistered?.();
              }}
              onPointerCancel={() => {
                localInputRef.current.sprintHeld = false;
                onInputRegistered?.();
              }}
              className="w-13 h-13 rounded-full bg-slate-900/85 border border-white/25 text-white flex flex-col items-center justify-center active:scale-95"
            >
              <span className="text-xs font-extrabold text-amber-300">
                {ar ? 'ركض' : 'Run'}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
