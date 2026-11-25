import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Crown,
  Flag,
  Globe,
  GraduationCap,
  HeartHandshake,
  Keyboard,
  Link2,
  Lock,
  Play,
  RotateCcw,
  Settings,
  Shirt,
  Smartphone,
  Star,
  UserPlus,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import { ChainEscapeLogo } from './ChainEscapeLogo.tsx';
import { getStageDef, WORLD_LIST, WORLDS } from '../shared/worldsData.ts';
import { TUTORIAL_STAGE } from '../shared/tutorialStage.ts';
import type { GameSettings } from '../game/profileStore.ts';
import type {
  AccessoryId,
  CharacterCustomization,
  FaceStyleId,
  FriendEntry,
  HatId,
  OutfitId,
  PlayerProfileStats,
  RoomStateSnapshot,
  StageNumber,
  WorldId,
} from '../shared/types.ts';

export type ScreenView =
  | 'title'
  | 'play_select'
  | 'howto'
  | 'lobby'
  | 'character'
  | 'worlds'
  | 'friends'
  | 'settings'
  | 'playing'
  | 'paused'
  | 'victory';

interface MenuScreensProps {
  view: ScreenView;
  setView: (v: ScreenView) => void;
  settings: GameSettings;
  onUpdateSettings: (s: GameSettings) => void;
  customization: CharacterCustomization;
  onUpdateCustomization: (c: CharacterCustomization) => void;
  stats: PlayerProfileStats;
  selectedWorldId: WorldId;
  selectedStage: StageNumber;
  onSelectWorld: (w: WorldId, st?: StageNumber) => void;
  roomState: RoomStateSnapshot | null;
  localPlayerId: string;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  roomError: string | null;
  friends: FriendEntry[];
  onSaveFriends: (f: FriendEntry[]) => void;
  onCreateOnlineRoom: () => void;
  onJoinOnlineRoom: (code: string) => void;
  onStartLocalCoop: (worldId: WorldId, stage?: StageNumber) => void;
  onStartTutorial: () => void;
  isTutorial?: boolean;
  onStartOnlineGame: () => void;
  onNextStage: () => void;
  onLeaveRoom: () => void;
  onRestartGame: () => void;
  onResumeGame: () => void;
  victoryEarnedStars: number;
}

const COLOR_SWATCHES = [
  '#ef4444',
  '#f59e0b',
  '#2563eb',
  '#9333ea',
  '#16a34a',
  '#475569',
];

const OUTFITS: { id: OutfitId; ar: string; en: string }[] = [
  { id: 'hoodie', ar: 'سترة المغامر', en: 'Explorer Hoodie' },
  { id: 'parka', ar: 'معطف القطب', en: 'Alpine Parka' },
  { id: 'forge', ar: 'درع المصنع', en: 'Forge Vest' },
  { id: 'temple', ar: 'رداء المعبد', en: 'Temple Tunic' },
  { id: 'void_suit', ar: 'بدلة الفراغ', en: 'Void Suit' },
];

const HATS: { id: HatId; ar: string; en: string }[] = [
  { id: 'goggles', ar: 'نظارة طيار', en: 'Aviator Goggles' },
  { id: 'cap', ar: 'قبعة رياضية', en: 'Explorer Cap' },
  { id: 'beanie', ar: 'قبعة صوفية', en: 'Winter Beanie' },
  { id: 'horns', ar: 'خوذة الفايكنج', en: 'Viking Horns' },
  { id: 'ninja', ar: 'لثام النينجا', en: 'Ninja Hood' },
  { id: 'crown', ar: 'تاج النجوم', en: 'Star Crown' },
  { id: 'none', ar: 'بدون قبعة', en: 'None' },
];

const ACCESSORIES: { id: AccessoryId; ar: string; en: string }[] = [
  { id: 'bedroll', ar: 'حقيبة سفر', en: 'Bedroll Pack' },
  { id: 'lantern', ar: 'حقيبة الفانوس', en: 'Lantern Pack' },
  { id: 'cape', ar: 'عباءة الأبطال', en: 'Hero Cape' },
  { id: 'wings', ar: 'أجنحة السماء', en: 'Sky Wings' },
  { id: 'none', ar: 'بدون إكسسوار', en: 'None' },
];

const FACES: { id: FaceStyleId; ar: string; en: string }[] = [
  { id: 'determined', ar: 'واثق', en: 'Determined' },
  { id: 'cheerful', ar: 'مبتهج', en: 'Cheerful' },
  { id: 'masked', ar: 'مقنع', en: 'Masked' },
  { id: 'bandaged', ar: 'مقاتل', en: 'Scrappy' },
];

export const MenuScreens: React.FC<MenuScreensProps> = ({
  view,
  setView,
  settings,
  onUpdateSettings,
  customization,
  onUpdateCustomization,
  stats,
  selectedWorldId,
  selectedStage,
  onSelectWorld,
  roomState,
  localPlayerId,
  connectionStatus,
  roomError,
  friends,
  onSaveFriends,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onStartLocalCoop,
  onStartTutorial,
  isTutorial = false,
  onStartOnlineGame,
  onNextStage,
  onLeaveRoom,
  onRestartGame,
  onResumeGame,
  victoryEarnedStars,
}) => {
  const ar = settings.language === 'ar';
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [customTab, setCustomTab] = useState<'outfit' | 'hat' | 'acc'>('outfit');
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendCode, setNewFriendCode] = useState('');

  const copyRoomLink = (code: string) => {
    const url = `${window.location.origin}?room=${code}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  // TITLE SCREEN
  if (view === 'title') {
    return (
      <div className="fixed inset-0 z-10 flex flex-col justify-between p-5 sm:p-8 pointer-events-none">
        {/* Top bar: Player Profile Badge */}
        <div className="flex items-start justify-between">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-950/85 border border-white/15 shadow-xl">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white border border-white/30"
              style={{ backgroundColor: customization.colorHex }}
            >
              {customization.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-extrabold text-white">{customization.name}</div>
              <div className="text-xs text-amber-300 font-bold">
                {ar ? `المستوى ${stats.level}` : `Level ${stats.level}`} · {stats.totalRescues}{' '}
                {ar ? 'إنقاذ' : 'Rescues'}
              </div>
            </div>
          </div>

          <button
            onClick={() =>
              onUpdateSettings({ ...settings, language: ar ? 'en' : 'ar' })
            }
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/85 border border-white/15 text-xs font-bold text-slate-200 hover:border-orange-400/60"
          >
            <Globe className="w-4 h-4 text-sky-400" />
            <span>{ar ? 'English' : 'العربية'}</span>
          </button>
        </div>

        {/* Side Menu Stack leaving center 3D sky islands open */}
        <div className="flex flex-col items-start gap-4 max-w-xs w-full my-auto pointer-events-auto">
          <ChainEscapeLogo />
          <p className="text-xs sm:text-sm font-bold text-amber-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
            {ar ? 'اهربوا معاً أو اسقطوا معاً!' : 'Stay Together. Escape Together!'}
          </p>

          <div className="flex flex-col gap-2.5 w-full">
            <button
              onClick={onStartTutorial}
              className="w-full py-3.5 px-5 rounded-xl flex items-center justify-between text-white font-black text-base bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg"
            >
              <span>{ar ? 'البداية — تعلّم اللعب' : 'START — Learn to Play'}</span>
              <GraduationCap className="w-5 h-5 fill-white" />
            </button>

            <button
              onClick={() => setView('play_select')}
              className="game-btn-primary w-full py-3.5 px-5 rounded-xl flex items-center justify-between text-white font-black text-base"
            >
              <span>{ar ? 'العب الآن' : 'PLAY'}</span>
              <Play className="w-5 h-5 fill-white" />
            </button>

            <button
              onClick={() => setView('howto')}
              className="game-btn-secondary w-full py-3 px-5 rounded-xl flex items-center justify-between text-white font-bold text-sm"
            >
              <span>{ar ? 'كيف تلعب' : 'HOW TO PLAY'}</span>
              <BookOpen className="w-4 h-4 text-emerald-300" />
            </button>

            <button
              onClick={() => setView('character')}
              className="game-btn-secondary w-full py-3 px-5 rounded-xl flex items-center justify-between text-white font-bold text-sm"
            >
              <span>{ar ? 'الشخصيات' : 'CHARACTER'}</span>
              <Shirt className="w-4 h-4 text-orange-300" />
            </button>

            <button
              onClick={() => setView('worlds')}
              className="game-btn-secondary w-full py-3 px-5 rounded-xl flex items-center justify-between text-white font-bold text-sm"
            >
              <span>{ar ? 'العوالم' : 'WORLDS'}</span>
              <Star className="w-4 h-4 text-amber-300" />
            </button>

            <button
              onClick={() => setView('friends')}
              className="game-btn-secondary w-full py-3 px-5 rounded-xl flex items-center justify-between text-white font-bold text-sm"
            >
              <span>{ar ? 'الأصدقاء والغرف' : 'FRIENDS & ROOMS'}</span>
              <Users className="w-4 h-4 text-sky-300" />
            </button>

            <button
              onClick={() => setView('settings')}
              className="game-btn-secondary w-full py-3 px-5 rounded-xl flex items-center justify-between text-white font-bold text-sm"
            >
              <span>{ar ? 'الإعدادات' : 'SETTINGS'}</span>
              <Settings className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>

        {/* Single flat control hint line */}
        <div className="text-center text-[11px] font-semibold text-slate-200 bg-slate-950/70 w-fit mx-auto px-4 py-1.5 rounded-lg border border-white/10">
          {ar
            ? 'WASD تحرك · Space قفز · E سحب وتثبيت السلسلة · Enter للبدء السريع'
            : 'WASD Move · Space Jump · E Grab & Anchor Chain · Enter Quick Start'}
        </div>
      </div>
    );
  }

  // HOW TO PLAY SCREEN
  if (view === 'howto') {
    const howtoSections: {
      icon: React.ReactNode;
      titleAr: string;
      titleEn: string;
      rows: { ar: string; en: string }[];
    }[] = [
      {
        icon: <Keyboard className="w-5 h-5 text-sky-300" />,
        titleAr: 'التحكم بالكيبورد',
        titleEn: 'Keyboard Controls',
        rows: [
          { ar: 'WASD أو الأسهم: التحرك', en: 'WASD / Arrow keys: Move' },
          { ar: 'Space: القفز — اضغطه مرتين في الهواء للقفز المزدوج', en: 'Space: Jump — press twice mid-air for Double Jump' },
          { ar: 'Shift: الركض · C: التثبيت ضد شد السلسلة', en: 'Shift: Sprint · C: Brace against chain pull' },
          { ar: 'E: التفاعل / سحب الشريك / إنقاذ الساقط / تشغيل الرافعات', en: 'E: Interact / Pull partner / Rescue the fallen / Work levers' },
          { ar: 'Tab: التبديل بين اللاعبين (تعاون محلي) · Esc: إيقاف مؤقت', en: 'Tab: Switch players (local co-op) · Esc: Pause' },
          { ar: 'سحب الماوس: تدوير الكاميرا', en: 'Drag mouse: Rotate camera' },
          { ar: 'اللاعب الثاني (كيبورد): الأسهم للتحرك · Enter للقفز · / للتفاعل', en: 'Player 2 (keyboard): Arrows to move · Enter to jump · / to interact' },
        ],
      },
      {
        icon: <Smartphone className="w-5 h-5 text-emerald-300" />,
        titleAr: 'التحكم باللمس',
        titleEn: 'Touch Controls',
        rows: [
          { ar: 'العصا الافتراضية (يسار): التحرك', en: 'Virtual joystick (left): Move' },
          { ar: 'زر القفز: قفز — اضغطه مرتين في الهواء للقفز المزدوج', en: 'Jump button: Jump — tap twice mid-air for Double Jump' },
          { ar: 'زر السحب: تفاعل / سحب الشريك / إنقاذ (اضغط مطولاً للسحب)', en: 'Pull button: Interact / Pull partner / Rescue (hold to pull)' },
          { ar: 'زر التثبيت: ثبّت نفسك حتى لا تجرك السلسلة · زر الركض للسرعة', en: 'Brace button: Hold your ground against the chain · Run button for speed' },
          { ar: 'زر التبديل: يبدّل التحكم بين اللاعب الأول والثاني', en: 'Switch button: Swaps control between Player 1 and Player 2' },
        ],
      },
      {
        icon: <Link2 className="w-5 h-5 text-amber-300" />,
        titleAr: 'آلية السلسلة',
        titleEn: 'How the Chain Works',
        rows: [
          { ar: 'كل اللاعبين مربوطون بسلسلة واحدة طولها 6.5 أمتار — لا يمكنك الابتعاد أكثر من ذلك عن شريكك.', en: 'All players share one chain, 6.5m long — you cannot move farther than that from your partner.' },
          { ar: 'إذا ابتعدتما تشتد السلسلة وتسحب الطرف الأخف نحو الآخر — استخدموها لعبور الفجوات معاً.', en: 'When you drift apart the chain goes taut and pulls the lighter side — use it to cross gaps together.' },
          { ar: 'اضغط E مطولاً (أو زر السحب) لسحب شريكك نحوك؛ ومن كان أعلى يسحب من كان أسفل.', en: 'Hold E (or the Pull button) to drag your partner toward you; the higher player pulls the lower one up.' },
          { ar: 'ثبّت نفسك بـ C (أو زر التثبيت) عندما يسحبك شريكك أو تشتد السلسلة عند حافة.', en: 'Brace with C (or the Brace button) when your partner pulls you or the chain strains at an edge.' },
        ],
      },
      {
        icon: <HeartHandshake className="w-5 h-5 text-rose-300" />,
        titleAr: 'الإنقاذ والسحب',
        titleEn: 'Rescue & Pulling',
        rows: [
          { ar: 'إذا سقط زميلك أرضاً (Knocked Down): اقترب منه واضغط E لرفعه فوراً.', en: 'If a teammate is knocked down: walk up close and press E to lift them immediately.' },
          { ar: 'إذا سقط زميلك من حافة وتعلق بالسلسلة: لا تقفز معه! ثبّت نفسك واسحبه حتى يعود للأرض.', en: 'If a teammate falls off an edge and hangs on the chain: do not jump after them! Brace and pull them back up.' },
          { ar: 'إذا سقط الجميع تحت الحد الأدنى تعودون معاً إلى آخر نقطة حفظ.', en: 'If everyone falls below the limit, you all respawn together at the last checkpoint.' },
        ],
      },
      {
        icon: <Star className="w-5 h-5 text-yellow-300" />,
        titleAr: 'النجوم ونقاط الحفظ',
        titleEn: 'Stars & Checkpoints',
        rows: [
          { ar: 'في كل مرحلة 3 نجوم تحدي — بعضها في أماكن جانبية أو فوق منصات عالية.', en: 'Every stage hides 3 challenge stars — some in side areas or above high platforms.' },
          { ar: 'نقاط الحفظ (الأعلام) تُفتح بتقدمك؛ السقوط يعيدك لآخر نقطة وصلتها.', en: 'Checkpoints (flags) unlock as you advance; falling sends you back to the last one reached.' },
          { ar: 'الفوز يعتمد على الوقت: أكمل المرحلة ضمن الوقت المثالي وبسقوط قليل لتحصل على 3 نجوم.', en: 'Victory is scored on time: finish within the par time with few falls to earn 3 stars.' },
          { ar: 'أكمل المراحل واجمع النجوم لفتح أزياء وقبعات جديدة لشخصيتك.', en: 'Complete stages and collect stars to unlock new outfits and hats for your character.' },
        ],
      },
      {
        icon: <Users className="w-5 h-5 text-sky-300" />,
        titleAr: 'أوضاع اللعب',
        titleEn: 'Play Modes',
        rows: [
          { ar: 'تعاون محلي: لاعبان على جهاز واحد — مثالي للتعلم مع صديق بجانبك.', en: 'Local co-op: 2 players on one device — ideal for learning with a friend beside you.' },
          { ar: 'أونلاين: غرف خاصة لـ 2–6 لاعبين برمز دعوة، بفيزياء سلسلة متزامنة.', en: 'Online: private rooms for 2–6 players with an invite code and synchronized chain physics.' },
          { ar: 'ابدأ بالمرحلة التعليمية «البداية» قبل أول عالم — تعلمك كل الأساسيات في دقائق.', en: 'Start with the tutorial stage "The Beginning" before the first world — it teaches every basic in minutes.' },
        ],
      },
    ];
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/75 overflow-y-auto">
        <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-white/15 p-5 sm:p-6 shadow-2xl space-y-5 my-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-300" />
              {ar ? 'كيف تلعب' : 'How to Play'}
            </h2>
            <button
              onClick={() => setView('title')}
              className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 max-h-[62vh] overflow-y-auto pe-1">
            {howtoSections.map((sec) => (
              <div
                key={sec.titleEn}
                className="p-4 rounded-xl bg-slate-950/80 border border-white/10"
              >
                <div className="flex items-center gap-2 text-base font-extrabold text-white mb-2">
                  {sec.icon}
                  <span>{ar ? sec.titleAr : sec.titleEn}</span>
                </div>
                <ul className="space-y-1.5">
                  {sec.rows.map((r) => (
                    <li
                      key={r.en}
                      className="text-xs text-slate-300 leading-relaxed flex gap-2"
                    >
                      <span className="text-amber-400 shrink-0">•</span>
                      <span>{ar ? r.ar : r.en}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={onStartTutorial}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-black text-white flex items-center justify-center gap-2"
            >
              <GraduationCap className="w-4 h-4" />
              <span>
                {ar ? 'ابدأ المرحلة التعليمية «البداية»' : 'Start the Tutorial Stage'}
              </span>
            </button>
            <button
              onClick={() => setView('title')}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold text-white flex items-center justify-center gap-2"
            >
              <Flag className="w-4 h-4 text-amber-300" />
              <span>{ar ? 'القائمة الرئيسية' : 'Main Menu'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PLAY MODE SELECTOR (Online Room vs Local 2-Player Co-op)
  if (view === 'play_select') {
    const stageDef = getStageDef(selectedWorldId, selectedStage);
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/70">
        <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-white/15 p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white">
              {ar ? 'اختر وضع اللعب' : 'Select Play Mode'}
            </h2>
            <button
              onClick={() => setView('title')}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Local-only build notice: no hosted server in this APK */}
          <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 text-xs font-bold text-amber-200 leading-relaxed">
            {ar
              ? 'نسخة محلية فقط: اللعب عبر الإنترنت مع أصدقاء على هواتف أخرى غير متاح في هذه النسخة لأنها بدون سيرفر. استخدم "تعاون محلي ثنائي" للعب لاعبين على نفس الجهاز.'
              : 'Local-only build: online play with friends on other phones is NOT available in this version (no server). Use "Local 2-Player Co-op" to play two players on this device.'}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Online Multiplayer Room */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-orange-500/40 flex flex-col justify-between gap-4">
              <div>
                <div className="text-base font-extrabold text-orange-400">
                  {ar ? 'اللعب الجماعي عبر الإنترنت (2-6 لاعبين)' : 'Online Co-op Room (2–6 Players)'}
                </div>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {ar
                    ? 'أنشئ غرفة خاصة وشارك رمز الدعوة مع أصدقائك، أو انضم لغرفة قائمة بمزامنة فيزيائية كاملة.'
                    : 'Host a private room and share the invite code, or join an existing room with real-time synchronized chain physics.'}
                </p>
              </div>
              <div className="space-y-2.5">
                <button
                  onClick={onCreateOnlineRoom}
                  className="game-btn-primary w-full py-2.5 px-4 rounded-xl text-sm font-black text-white"
                >
                  {ar ? 'إنشاء غرفة خاصة' : 'Create Private Room'}
                </button>
                <div className="flex gap-2">
                  <input
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder={ar ? 'رمز الغرفة (مثلاً 7F3K9D)' : 'Room Code'}
                    maxLength={8}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs font-mono-num text-white uppercase focus:outline-none focus:border-orange-400"
                  />
                  <button
                    onClick={() => joinCodeInput.trim() && onJoinOnlineRoom(joinCodeInput.trim())}
                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white"
                  >
                    {ar ? 'انضمام' : 'Join'}
                  </button>
                </div>
              </div>
            </div>

            {/* Local 2-Player Co-op */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-sky-500/40 flex flex-col justify-between gap-4">
              <div>
                <div className="text-base font-extrabold text-sky-400">
                  {ar ? 'تعاون محلي ثنائي (فوري)' : 'Local 2-Player Co-op'}
                </div>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {ar
                    ? 'تحكم بشخصيتين مربوطتين بالسلسلة على نفس الجهاز (WASD + الأسهم، أو بدّل بالزر Tab). مثالي للعب الفوري أو مع صديق بجانبك.'
                    : 'Play two chained adventurers on one device (WASD + Arrows, or press Tab to switch). Instant chain physics & co-op puzzles.'}
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-amber-300 truncate">
                    {ar
                      ? `${stageDef.nameAr} — ${stageDef.stageTitleAr}`
                      : `${stageDef.nameEn} — ${stageDef.stageTitleEn}`}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 bg-slate-900 p-0.5 rounded-lg border border-white/10">
                    {([1, 2] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => onSelectWorld(selectedWorldId, st)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          selectedStage === st
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {ar ? `م${st}` : `S${st}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onStartLocalCoop(selectedWorldId, selectedStage)}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-black text-white transition-colors"
              >
                {ar ? 'ابدأ اللعب الثنائي الآن' : 'Start Local Co-op Now'}
              </button>
              <button
                onClick={onStartTutorial}
                className="w-full py-2 px-4 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-xs font-bold text-white flex items-center justify-center gap-2"
              >
                <GraduationCap className="w-4 h-4" />
                <span>
                  {ar ? 'جديد؟ ابدأ بالمرحلة التعليمية «البداية»' : 'New? Start with the Tutorial Stage'}
                </span>
              </button>
            </div>
          </div>

          {roomError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs font-bold text-rose-200">
              {roomError === 'ROOM_NOT_FOUND'
                ? ar
                  ? 'لم يتم العثور على غرفة بهذا الرمز.'
                  : 'Room code not found.'
                : roomError === 'ROOM_FULL'
                ? ar
                  ? 'الغرفة ممتلئة (الحد الأقصى 6 لاعبين).'
                  : 'Room is full (max 6 players).'
                : roomError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // WAITING LOBBY (Online Multiplayer)
  if (view === 'lobby' && roomState) {
    const isHost = roomState.hostId === localPlayerId;
    const curStage: StageNumber = roomState.stage ?? 1;
    const curWorld = getStageDef(roomState.worldId, curStage);
    const worldIdx = WORLD_LIST.findIndex((w) => w.id === roomState.worldId);

    return (
      <div className="fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
        {/* Top Lobby Header */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => {
              onLeaveRoom();
              setView('title');
            }}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/85 border border-white/15 text-sm font-bold text-white hover:border-orange-400/60"
          >
            <ArrowRight className={`w-4 h-4 ${ar ? '' : 'rotate-180'}`} />
            <span>{ar ? 'مغادرة' : 'Leave'}</span>
          </button>

          <div className="px-5 py-2 rounded-xl bg-slate-950/85 border border-white/15 text-base font-black text-white">
            {ar ? 'ساحة الانتظار' : 'Waiting Lobby'} ·{' '}
            <span className="text-amber-400 font-mono-num">
              {roomState.players.length}/6
            </span>
          </div>

          <button
            onClick={() => copyRoomLink(roomState.roomCode)}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-950/90 border border-orange-400/50 text-white hover:bg-slate-900"
          >
            <div className="text-start">
              <div className="text-[10px] text-slate-400">
                {ar ? 'رمز الغرفة (اضغط للنسخ)' : 'Room Code (Click to copy)'}
              </div>
              <div className="text-sm font-mono-num font-black tracking-widest text-amber-300">
                {roomState.roomCode}
              </div>
            </div>
            {copiedCode ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-slate-300" />
            )}
          </button>
        </div>

        {/* Bottom Lobby Controls & World/Stage Selector */}
        <div className="flex flex-col sm:flex-row items-end justify-between gap-4">
          {/* Connected Players Roster */}
          <div className="pointer-events-auto flex flex-wrap gap-2 bg-slate-950/85 border border-white/15 p-3 rounded-2xl">
            {roomState.players.map((pl) => (
              <div
                key={pl.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10"
              >
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: pl.customization.colorHex }}
                />
                <span className="text-xs font-bold text-white">{pl.customization.name}</span>
                {pl.isHost && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                <span className="text-[10px] font-mono-num text-emerald-400">
                  {pl.connected ? `${pl.pingMs}ms` : ar ? 'منقطع' : 'Offline'}
                </span>
              </div>
            ))}
          </div>

          {/* World & Stage Picker + Start Button */}
          <div className="pointer-events-auto w-full sm:w-84 rounded-2xl bg-slate-950/90 border border-white/15 p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <button
                disabled={!isHost}
                onClick={() => {
                  const prev = WORLD_LIST[(worldIdx - 1 + WORLD_LIST.length) % WORLD_LIST.length];
                  onSelectWorld(prev.id, curStage);
                }}
                className="p-2 rounded-lg bg-slate-800 disabled:opacity-40 text-white"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <div className="text-center">
                <div className="text-[11px] text-amber-400 font-bold">
                  {ar ? `العالم ${curWorld.order}` : `World ${curWorld.order}`}
                </div>
                <div className="text-sm font-black text-white">
                  {ar ? curWorld.nameAr : curWorld.nameEn}
                </div>
                <div className="text-[11px] text-slate-300">
                  {ar ? curWorld.stageTitleAr : curWorld.stageTitleEn}
                </div>
              </div>
              <button
                disabled={!isHost}
                onClick={() => {
                  const next = WORLD_LIST[(worldIdx + 1) % WORLD_LIST.length];
                  onSelectWorld(next.id, curStage);
                }}
                className="p-2 rounded-lg bg-slate-800 disabled:opacity-40 text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl">
              {([1, 2] as const).map((st) => (
                <button
                  key={st}
                  disabled={!isHost}
                  onClick={() => onSelectWorld(curWorld.id, st)}
                  className={`py-1.5 rounded-lg text-xs font-extrabold transition-colors disabled:opacity-60 ${
                    curStage === st
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {ar ? `المرحلة ${st}` : `Stage ${st}`}
                </button>
              ))}
            </div>

            {isHost ? (
              <button
                onClick={onStartOnlineGame}
                className="game-btn-primary w-full py-3 rounded-xl text-sm font-black text-white"
              >
                {ar ? 'بدء اللعبة' : 'Start Game'}
              </button>
            ) : (
              <div className="text-center py-2 text-xs font-bold text-slate-300 bg-slate-900 rounded-xl">
                {ar ? 'بانتظار قائد الغرفة لبدء المغامرة...' : 'Waiting for host to start...'}
              </div>
            )}
            <div className="text-[10px] text-center text-slate-400">
              {connectionStatus === 'connected'
                ? ar
                  ? 'متصل بالخادم الفيزيائي المباشر — شارك الرمز ليدخل أصدقاؤك'
                  : 'Connected to live server — share room code with friends'
                : ar
                ? 'جاري الاتصال...'
                : 'Connecting...'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CHARACTER CUSTOMIZATION (live 3D pedestal right beside panel)
  if (view === 'character') {
    return (
      <div className="fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setView('title')}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/85 border border-white/15 text-sm font-bold text-white"
          >
            <ArrowRight className={`w-4 h-4 ${ar ? '' : 'rotate-180'}`} />
            <span>{ar ? 'رجوع' : 'Back'}</span>
          </button>
          <div className="px-5 py-2 rounded-xl bg-slate-950/85 border border-white/15 text-base font-black text-white">
            {ar ? 'تخصيص الشخصية' : 'Character Studio'}
          </div>
          <div className="w-20" />
        </div>

        <div className="pointer-events-auto self-end w-full sm:w-[400px] rounded-2xl bg-slate-950/90 border border-white/15 p-5 space-y-4 shadow-2xl my-auto">
          {/* Name Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              {ar ? 'اسم اللاعب' : 'Player Name'}
            </label>
            <input
              value={customization.name}
              onChange={(e) =>
                onUpdateCustomization({ ...customization, name: e.target.value.slice(0, 14) })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-sm font-bold text-white focus:outline-none focus:border-orange-400"
            />
          </div>

          {/* Category Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-900">
            <button
              onClick={() => setCustomTab('outfit')}
              className={`py-2 rounded-lg text-xs font-bold ${
                customTab === 'outfit' ? 'bg-orange-600 text-white' : 'text-slate-300'
              }`}
            >
              {ar ? 'الأزياء' : 'Outfits'}
            </button>
            <button
              onClick={() => setCustomTab('hat')}
              className={`py-2 rounded-lg text-xs font-bold ${
                customTab === 'hat' ? 'bg-orange-600 text-white' : 'text-slate-300'
              }`}
            >
              {ar ? 'الرأس' : 'Headgear'}
            </button>
            <button
              onClick={() => setCustomTab('acc')}
              className={`py-2 rounded-lg text-xs font-bold ${
                customTab === 'acc' ? 'bg-orange-600 text-white' : 'text-slate-300'
              }`}
            >
              {ar ? 'الإكسسوارات' : 'Gear'}
            </button>
          </div>

          {customTab === 'outfit' && (
            <div className="grid grid-cols-2 gap-2">
              {OUTFITS.map((o) => {
                const unlocked = stats.unlockedOutfits.includes(o.id);
                const active = customization.outfit === o.id;
                return (
                  <button
                    key={o.id}
                    disabled={!unlocked}
                    onClick={() => onUpdateCustomization({ ...customization, outfit: o.id })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                      active
                        ? 'bg-orange-600/25 border-orange-400 text-white'
                        : unlocked
                        ? 'bg-slate-900 border-white/10 text-slate-200 hover:border-white/30'
                        : 'bg-slate-900/40 border-white/5 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <span>{ar ? o.ar : o.en}</span>
                    {!unlocked && <Lock className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          )}

          {customTab === 'hat' && (
            <div className="grid grid-cols-2 gap-2">
              {HATS.map((h) => {
                const unlocked = stats.unlockedHats.includes(h.id);
                const active = customization.hat === h.id;
                return (
                  <button
                    key={h.id}
                    disabled={!unlocked}
                    onClick={() => onUpdateCustomization({ ...customization, hat: h.id })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                      active
                        ? 'bg-orange-600/25 border-orange-400 text-white'
                        : unlocked
                        ? 'bg-slate-900 border-white/10 text-slate-200 hover:border-white/30'
                        : 'bg-slate-900/40 border-white/5 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <span>{ar ? h.ar : h.en}</span>
                    {!unlocked && <Lock className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          )}

          {customTab === 'acc' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {ACCESSORIES.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onUpdateCustomization({ ...customization, accessory: a.id })}
                    className={`p-2.5 rounded-xl border text-xs font-bold ${
                      customization.accessory === a.id
                        ? 'bg-orange-600/25 border-orange-400 text-white'
                        : 'bg-slate-900 border-white/10 text-slate-200'
                    }`}
                  >
                    {ar ? a.ar : a.en}
                  </button>
                ))}
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                  {ar ? 'نمط الوجه' : 'Face Style'}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {FACES.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onUpdateCustomization({ ...customization, face: f.id })}
                      className={`py-1.5 rounded-lg text-[11px] font-bold border ${
                        customization.face === f.id
                          ? 'bg-sky-600/30 border-sky-400 text-white'
                          : 'bg-slate-900 border-white/10 text-slate-300'
                      }`}
                    >
                      {ar ? f.ar : f.en}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Color Swatches */}
          <div>
            <div className="text-xs font-bold text-slate-300 mb-2">
              {ar ? 'لون الشخصية' : 'Outfit Color'}
            </div>
            <div className="flex items-center gap-2.5">
              {COLOR_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  onClick={() => onUpdateCustomization({ ...customization, colorHex: hex })}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    customization.colorHex === hex
                      ? 'border-white scale-110'
                      : 'border-white/25'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            {ar
              ? 'أكمل المراحل واجمع 3 نجوم لفتح خوذة الفايكنج وبدلة الفراغ وتاج النجوم.'
              : 'Complete worlds & earn 3 stars to unlock Viking Horns, Void Suit & Star Crown.'}
          </p>
        </div>
        <div />
      </div>
    );
  }

  // WORLDS & STAGES SELECTOR (6 Worlds · 12 Stages)
  if (view === 'worlds') {
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/75 overflow-y-auto">
        <div className="w-full max-w-5xl rounded-2xl bg-slate-900 border border-white/15 p-5 sm:p-6 shadow-2xl space-y-5 my-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white">
              {ar ? 'عوالم CHAIN ESCAPE الستة · 12 مرحلة' : 'The 6 Worlds of Chain Escape · 12 Stages'}
            </h2>
            <button
              onClick={() => setView('title')}
              className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tutorial Stage — comes before World 1 */}
          <button
            onClick={onStartTutorial}
            className="w-full text-start p-4 rounded-xl border-2 border-emerald-400/70 bg-emerald-950/60 hover:bg-emerald-900/60 transition-colors flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-emerald-300 shrink-0" />
              <div>
                <div className="text-base font-black text-white">
                  {ar ? 'البداية — المرحلة التعليمية' : 'The Beginning — Tutorial Stage'}
                </div>
                <p className="text-xs text-emerald-100/90 mt-0.5 leading-relaxed">
                  {ar
                    ? 'قبل أول عالم: تعلّم المشي والقفز، القفز المزدوج، السحب بالسلسلة، والإنقاذ — بلاعبين على جهاز واحد.'
                    : 'Before World 1: learn walking & jumping, double jump, chain pulling & rescue — 2 players on one device.'}
                </p>
              </div>
            </div>
            <span className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500 text-xs font-black text-slate-950">
              {ar ? 'ابدأ التعلم' : 'Start Learning'}
            </span>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {WORLD_LIST.map((w) => {
              const prog = stats.worldProgress[w.id];
              const isSelected = selectedWorldId === w.id;
              const activeWorldStage: StageNumber = isSelected ? selectedStage : 1;
              return (
                <div
                  key={w.id}
                  onClick={() => onSelectWorld(w.id, activeWorldStage)}
                  className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-slate-800/90 border-orange-400 shadow-lg'
                      : 'bg-slate-950/80 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-amber-300 mb-1">
                      <span>{ar ? `العالم ${w.order}` : `World ${w.order}`}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              prog.bestStars >= s
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <h3 className="text-base font-black text-white">
                      {ar ? w.nameAr : w.nameEn}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {ar ? w.subtitleAr : w.subtitleEn}
                    </p>
                  </div>

                  {/* Stage 1 & Stage 2 Selector Pills */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {([1, 2] as const).map((st) => {
                      const sDef = getStageDef(w.id, st);
                      const sProg = prog.stages?.[st];
                      const activePill = isSelected && selectedStage === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectWorld(w.id, st);
                          }}
                          className={`p-2 rounded-lg border text-start transition-colors ${
                            activePill
                              ? 'bg-amber-500/20 border-amber-400 text-white'
                              : 'bg-slate-900/90 border-white/10 text-slate-300 hover:border-white/30'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-amber-300">
                              {ar ? `مرحلة ${st}` : `Stage ${st}`}
                            </span>
                            <span className="font-mono-num text-yellow-400">
                              {sProg && sProg.bestStars > 0 ? `★${sProg.bestStars}` : '—'}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold truncate mt-0.5">
                            {ar ? sDef.stageTitleAr : sDef.stageTitleEn}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-[11px] font-mono-num text-slate-400">
                      {prog.stages?.[activeWorldStage]?.bestTimeSec != null
                        ? `${Math.floor(prog.stages[activeWorldStage].bestTimeSec!)}s`
                        : ar
                        ? 'جديد'
                        : 'New'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWorld(w.id, activeWorldStage);
                        onStartLocalCoop(w.id, activeWorldStage);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white"
                    >
                      {ar ? `العب م${activeWorldStage}` : `Play S${activeWorldStage}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // FRIENDS & ROOM INVITES
  if (view === 'friends') {
    const addFriend = () => {
      if (!newFriendName.trim()) return;
      const entry: FriendEntry = {
        id: `fr_${Date.now()}`,
        name: newFriendName.trim().slice(0, 16),
        status: newFriendCode.trim() ? 'in_room' : 'online',
        roomCode: newFriendCode.trim().toUpperCase().slice(0, 8) || undefined,
        colorHex: COLOR_SWATCHES[friends.length % COLOR_SWATCHES.length],
      };
      onSaveFriends([...friends, entry]);
      setNewFriendName('');
      setNewFriendCode('');
    };

    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/75">
        <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-white/15 p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white">
              {ar ? 'الأصدقاء والانضمام لغرفهم' : 'Friends & Room Invites'}
            </h2>
            <button
              onClick={() => setView('title')}
              className="p-2 rounded-lg bg-slate-800 text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
            <div className="text-xs font-bold text-slate-300">
              {ar ? 'إضافة صديق أو رمز غرفة صديق' : 'Save Friend & Room Code'}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                placeholder={ar ? 'اسم الصديق' : 'Friend Name'}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs text-white"
              />
              <input
                value={newFriendCode}
                onChange={(e) => setNewFriendCode(e.target.value.toUpperCase())}
                placeholder={ar ? 'رمز الغرفة (اختياري)' : 'Room Code (opt)'}
                className="w-full sm:w-36 px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-xs font-mono-num text-white uppercase"
              />
              <button
                onClick={addFriend}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white flex items-center justify-center gap-1"
              >
                <UserPlus className="w-4 h-4" />
                <span>{ar ? 'إضافة' : 'Add'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {friends.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                {ar
                  ? 'لا يوجد أصدقاء محفوظون بعد. أضف صديقاً أو أنشئ غرفة خاصة وشارك الرابط مع فريقك!'
                  : 'No saved friends yet. Add a friend or create a private room to share an invite link.'}
              </div>
            ) : (
              friends.map((fr) => (
                <div
                  key={fr.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/75 border border-white/10"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-sm"
                      style={{ backgroundColor: fr.colorHex }}
                    />
                    <div>
                      <div className="text-sm font-bold text-white">{fr.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono-num">
                        {fr.roomCode
                          ? `${ar ? 'غرفة:' : 'Room:'} ${fr.roomCode}`
                          : ar
                          ? 'محفوظ في القائمة'
                          : 'Saved'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {fr.roomCode && (
                      <button
                        onClick={() => onJoinOnlineRoom(fr.roomCode!)}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white"
                      >
                        {ar ? 'انضمام' : 'Join'}
                      </button>
                    )}
                    <button
                      onClick={() => onSaveFriends(friends.filter((x) => x.id !== fr.id))}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // SETTINGS MODAL
  if (view === 'settings') {
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/75">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/15 p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white">
              {ar ? 'الإعدادات' : 'Settings'}
            </h2>
            <button
              onClick={() => setView('title')}
              className="p-2 rounded-lg bg-slate-800 text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Language */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-200">
                {ar ? 'اللغة' : 'Language'}
              </span>
              <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl">
                <button
                  onClick={() => onUpdateSettings({ ...settings, language: 'ar' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    settings.language === 'ar' ? 'bg-orange-600 text-white' : 'text-slate-400'
                  }`}
                >
                  العربية
                </button>
                <button
                  onClick={() => onUpdateSettings({ ...settings, language: 'en' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    settings.language === 'en' ? 'bg-orange-600 text-white' : 'text-slate-400'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* Quality Preset */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-200">
                {ar ? 'جودة الرسوميات' : 'Graphics Quality'}
              </span>
              <div className="flex gap-1 bg-slate-950 p-1 rounded-xl">
                {(['low', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => onUpdateSettings({ ...settings, quality: q })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${
                      settings.quality === q ? 'bg-orange-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    {ar
                      ? q === 'low'
                        ? 'منخفضة'
                        : q === 'medium'
                        ? 'متوسطة'
                        : 'عالية'
                      : q}
                  </button>
                ))}
              </div>
            </div>

            {/* Touch Controls */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-200">
                {ar ? 'أزرار اللمس' : 'Touch Controls'}
              </span>
              <div className="flex gap-1 bg-slate-950 p-1 rounded-xl">
                {(['auto', 'always', 'off'] as const).map((tc) => (
                  <button
                    key={tc}
                    onClick={() => onUpdateSettings({ ...settings, showTouchControls: tc })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                      settings.showTouchControls === tc ? 'bg-sky-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    {ar
                      ? tc === 'auto'
                        ? 'تلقائي'
                        : tc === 'always'
                        ? 'دائماً'
                        : 'إيقاف'
                      : tc}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio sliders */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-orange-400" />
                  {ar ? 'صوت المؤثرات' : 'SFX Volume'}
                </span>
                <span className="font-mono-num">{Math.round(settings.sfxVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.sfxVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, sfxVolume: Number(e.target.value) })
                }
                className="w-full accent-orange-500"
              />
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>{ar ? 'صوت الموسيقى' : 'Music Volume'}</span>
                <span className="font-mono-num">{Math.round(settings.musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, musicVolume: Number(e.target.value) })
                }
                className="w-full accent-orange-500"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PAUSE MODAL
  if (view === 'paused') {
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/75">
        <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-white/15 p-6 shadow-2xl space-y-3 text-center">
          <h2 className="text-xl font-black text-white">
            {ar ? 'إيقاف مؤقت' : 'Game Paused'}
          </h2>
          <button
            onClick={onResumeGame}
            className="game-btn-primary w-full py-3 rounded-xl text-sm font-black text-white"
          >
            {ar ? 'استئناف اللعب' : 'Resume'}
          </button>
          <button
            onClick={onRestartGame}
            className="game-btn-secondary w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{ar ? 'إعادة المرحلة' : 'Restart Stage'}</span>
          </button>
          <button
            onClick={() => {
              onLeaveRoom();
              setView('title');
            }}
            className="w-full py-2.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-xs font-bold text-rose-200 hover:bg-rose-900/70"
          >
            {ar ? 'العودة للقائمة الرئيسية' : 'Exit to Main Menu'}
          </button>
        </div>
      </div>
    );
  }

  // VICTORY MODAL
  if (view === 'victory' && roomState) {
    const curStage: StageNumber = roomState.stage ?? 1;
    const stageDef = isTutorial
      ? TUTORIAL_STAGE
      : getStageDef(roomState.worldId, curStage);
    const nextWorld = WORLD_LIST.find((w) => w.order === stageDef.order + 1);
    const hasNext = isTutorial || curStage === 1 || Boolean(nextWorld);
    const nextLabel = isTutorial
      ? ar
        ? `العالم الأول: ${getStageDef('sky_islands', 1).nameAr} — ${getStageDef('sky_islands', 1).stageTitleAr}`
        : `World 1: ${getStageDef('sky_islands', 1).nameEn} — ${getStageDef('sky_islands', 1).stageTitleEn}`
      : curStage === 1
      ? ar
        ? `المرحلة التالية: ${getStageDef(roomState.worldId, 2).stageTitleAr}`
        : `Next Stage: ${getStageDef(roomState.worldId, 2).stageTitleEn}`
      : nextWorld
      ? ar
        ? `العالم التالي: ${nextWorld.nameAr}`
        : `Next World: ${nextWorld.nameEn}`
      : '';

    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/70">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-400/40 p-6 shadow-2xl text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                className={`w-10 h-10 ${
                  victoryEarnedStars >= s
                    ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.7)]'
                    : 'text-slate-700'
                }`}
              />
            ))}
          </div>
          <h2 className="text-2xl font-black text-amber-300">
            {ar ? 'انتصار جماعي!' : 'Team Victory!'}
          </h2>
          <p className="text-xs text-slate-300">
            {ar
              ? `${stageDef.nameAr} · المرحلة ${curStage}: ${stageDef.stageTitleAr}`
              : `${stageDef.nameEn} · Stage ${curStage}: ${stageDef.stageTitleEn}`}
          </p>

          <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/80 p-3 rounded-xl border border-white/10">
            <div>
              <div className="text-[11px] text-slate-400">{ar ? 'الوقت' : 'Time'}</div>
              <div className="text-base font-mono-num font-black text-white">
                {Math.round(roomState.elapsedSec)}s
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">{ar ? 'الإنقاذات' : 'Rescues'}</div>
              <div className="text-base font-mono-num font-black text-emerald-400">
                {roomState.rescues}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">{ar ? 'السقوط' : 'Falls'}</div>
              <div className="text-base font-mono-num font-black text-rose-400">
                {roomState.falls}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            {hasNext && (
              <button
                onClick={onNextStage}
                className="game-btn-primary w-full py-3 rounded-xl text-sm font-black text-white"
              >
                {nextLabel}
              </button>
            )}
            <button
              onClick={onRestartGame}
              className="game-btn-secondary w-full py-2.5 rounded-xl text-xs font-bold text-white"
            >
              {ar ? 'إعادة المرحلة' : 'Play Again'}
            </button>
            <button
              onClick={() => {
                onLeaveRoom();
                setView('title');
              }}
              className="w-full py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
            >
              {ar ? 'القائمة الرئيسية' : 'Main Menu'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
