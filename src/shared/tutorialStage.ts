import type { StageNumber, WorldDef } from './types.ts';

/**
 * المرحلة التعليمية «البداية» — Chain Escape.
 *
 * تعريف مرحلة مستقل عمداً خارج STAGE_CATALOG: المرحلة تعليمية محلية فقط
 * (تعاون محلي بلاعبين) ولا تنتمي لأي عالم من العوالم الستة ولا تُعرض في
 * سيرفر اللعب الجماعي. لهذا السبب يحمل `id: 'sky_islands'` (فيأخذ ثيم
 * الجزر السماوية من worldScene) و`stage: 1` كقيمة شكلية، والتمييز الحقيقي
 * يتم عبر تمرير هذا التعريف كـ worldOverride لمحاكاة RoomSimulation
 * وعبر علامة isTutorial في App/GameCanvas/GameHud.
 *
 * هندسة المسار (الاتجاه -z، القمم = y + h/2):
 * - البداية (قمة 1.5) ← فجوة 3م تتطلب قفزة ← منصتا المشي (قمة 1.7 ثم 2.2)
 * - فجوة 6.25م مع صعود 1.6م: القفز المزدوج قمتها ~6.3م بينما القفزة
 *   الواحدة (حتى مع الركض ومساعد التسلق) لا تتجاوز ~4.5م — لذلك يكشف
 *   GameHud القفز المزدوج من الارتفاع (y ≥ 5.0 فوق الفجوة) لا من الوصول
 *   وحده، وإلا عبرها لاعب بقفزة واحدة مع الركض والتسلق.
 * - منصة السحب العريضة (قمة 2.4): سحب الشريك بالسلسلة على أرض مستوية
 * - الجرف (قمة 3.6): لاعب يسقط/يمشي من الحافة فيتعلق بالسلسلة، والشريك
 *   يسحبه فيُحتسب إنقاذ (rescues+1) عند عودته للأرض — ثم فجوة 8م تُعبر
 *   بالقفز المزدوج إلى منصة الهبوط (قمة 1.7) فمنصة النهاية (قمة 2.25).
 * السقوط في أي فجوة يعيد اللاعبين لآخر نقطة حفظ (لا يوجد موت نهائي).
 */
export const TUTORIAL_STAGE: WorldDef = {
  id: 'sky_islands',
  stage: 1 as StageNumber,
  order: 0,
  nameAr: 'البداية',
  nameEn: 'The Beginning',
  stageTitleAr: 'تعلّم أساسيات السلسلة',
  stageTitleEn: 'Learn the Chain Basics',
  subtitleAr:
    'مرحلة تعليمية قصيرة: المشي والقفز، القفز المزدوج، السحب بالسلسلة، والإنقاذ',
  subtitleEn:
    'Short tutorial: walk & jump, double jump, chain pull & rescue',
  skyTopHex: '#3b82f6',
  skyHorizonHex: '#fde68a',
  fogHex: '#dbeafe',
  fogDensity: 0.0085,
  ambientSkyHex: '#93c5fd',
  ambientGroundHex: '#b45309',
  sunHex: '#fff7ed',
  gravity: 25,
  allowDoubleJump: true,
  chainMaxLength: 6.5,
  parTimeSec: 120,
  spawn: { x: 0, y: 1.5, z: 0 },
  finish: { x: 0, y: 1.5, z: -80 },
  fallLimitY: -14,
  platforms: [
    {
      id: 'tut_start',
      kind: 'stone',
      x: 0, y: 0, z: -2, w: 12, h: 3, d: 12,
      decorativeArch: true, bannerColor: '#f59e0b',
    },
    // الخطوة (أ): فجوة 3م بعد حافة البداية (z=-8) — لا تُعبر مشياً
    {
      id: 'tut_step_a1',
      kind: 'stone',
      x: -1.5, y: 0.5, z: -13.5, w: 6, h: 2.4, d: 5,
    },
    {
      id: 'tut_step_a2',
      kind: 'stone',
      x: 2, y: 1.0, z: -20, w: 6, h: 2.4, d: 5.5,
    },
    // الخطوة (ب): فجوة 6.25م + صعود 1.6م — قفز مزدوج إجباري
    {
      id: 'tut_double',
      kind: 'stone',
      x: 0, y: 2.6, z: -32, w: 7, h: 2.4, d: 6,
      bannerColor: '#0284c7',
    },
    // الخطوة (ج): منصة السحب العريضة
    {
      id: 'tut_pull',
      kind: 'stone',
      x: 0, y: 1.2, z: -42, w: 14, h: 2.4, d: 10,
      bannerColor: '#f59e0b',
    },
    // الخطوة (د): الجرف الذي يُسقط منه لاعب فيتعلق بالسلسلة
    {
      id: 'tut_cliff',
      kind: 'stone',
      x: 0, y: 2.4, z: -54, w: 8, h: 2.4, d: 8,
      bannerColor: '#dc2626',
    },
    // الهبوط بعد الجرف (فجوة 8م) ثم النهاية
    {
      id: 'tut_land',
      kind: 'stone',
      x: 0, y: 0.5, z: -70, w: 8, h: 2.4, d: 8,
    },
    {
      id: 'tut_finish',
      kind: 'stone',
      x: 0, y: 0.5, z: -80, w: 14, h: 3.5, d: 12,
      decorativeArch: true, bannerColor: '#16a34a',
    },
  ],
  puzzles: [],
  hazards: [],
  checkpoints: [
    { index: 0, x: 0, y: 0.5, z: -2 },
    { index: 1, x: 0, y: 2.8, z: -32 },
    { index: 2, x: 0, y: 1.4, z: -42 },
    { index: 3, x: 0, y: 2.6, z: -54 },
  ],
  stars: [
    // فوق منصة القفز المزدوج — تُلتقط أثناء القفزة نفسها (اختيارية)
    { id: 'tut_star_1', x: 0, y: 5.2, z: -32 },
  ],
};
