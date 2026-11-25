# نشر سيرفر Chain Escape العام | Deploying the Chain Escape Public Server

> الهدف: سيرفر عام واحد يتصل به كل اللاعبين من هواتف مختلفة، فيلعبون معاً عبر الإنترنت.
> The goal: one public server every player connects to, so friends on different phones play together online.

## 1) نشر السيرفر مجاناً على Render | Deploy the server free on Render

1. **أنشئ حساباً مجانياً** على https://render.com (سجّل بـ GitHub — أسهل للخطوة التالية).
   Create a free account at https://render.com (sign up with GitHub — easiest for the next step).
2. **ارفع هذا المشروع إلى مستودع GitHub** (خاص أو عام).
   Push this project to a GitHub repository (private or public).
3. في لوحة Render: **New + → Blueprint** → اختر المستودع. سيكتشف Render ملف `render.yaml` تلقائياً وينشئ الخدمة.
   In the Render dashboard: **New + → Blueprint** → pick the repository. Render auto-detects `render.yaml` and creates the service.
   - النوع: **Free Web Service** — الخطة `free`، أمر البناء `npm install --legacy-peer-deps && npm run build`، أمر التشغيل `npm start`.
     Type: **Free Web Service** — plan `free`, build command `npm install --legacy-peer-deps && npm run build`, start command `npm start`.
     (ملاحظة: `--legacy-peer-deps` ضروري لأن vite 8 يطلب esbuild ‏^0.27/0.28 بينما المشروع يثبّت ‏^0.25 — بدونه يفشل `npm install`.)
     (Note: `--legacy-peer-deps` is required because vite 8 wants esbuild ^0.27/0.28 while the project pins ^0.25 — plain `npm install` fails to resolve.)
   - متغيرات البيئة: `NODE_ENV=production` (موجود في `render.yaml`). **لا تضبط `PORT` يدوياً** — Render يحقنه تلقائياً.
     Environment variables: `NODE_ENV=production` (already in `render.yaml`). **Do not set `PORT` manually** — Render injects it automatically.
4. انتظر اكتمال النشر (أول مرة: بضع دقائق)، ثم افتح:
   Wait for the first deploy (a few minutes), then open:

   ```
   https://<service-name>.onrender.com/api/health
   ```

   يجب أن يرد `{"ok": true, ...}`. انسخ هذا الرابط — هو عنوان السيرفر العام.
   It must return `{"ok": true, ...}`. Copy this URL — it is the public server address.

> ⚠️ قيد الخطة المجانية: الخدمة "تنام" بعد ~15 دقيقة بلا نشاط، وأول اتصال بعد النوم قد يتأخر 30–60 ثانية حتى تستيقظ. الغرف واللاعبون يعيشون في الذاكرة فقط — إعادة تشغيل الخدمة تمسح الغرف النشطة.
> Free-plan limit: the service sleeps after ~15 min idle; the first connection after sleep can take 30–60 s to wake. Rooms live in memory only — a restart clears active rooms.

## 2) ربط الـAPK بالسيرفر العام | Point the APK at the public server

عنوان السيرفر يُضبط **وقت البناء** عبر `VITE_SERVER_URL` في `src/game/netClient.ts`.
The server address is set **at build time** via `VITE_SERVER_URL` in `src/game/netClient.ts`.

```bash
VITE_SERVER_URL=https://<service-name>.onrender.com npm run build
```

- `https://…` → يتصل عبر `wss`، و`http://…` → عبر `ws` (تلقائياً).
  `https://…` connects over `wss`, `http://…` over `ws` (automatic).
- بدون المتغير يعود العميل للسلوك القديم: نفس مضيف الصفحة (`/ws`) — مناسب للتطوير المحلي فقط.
  Without the variable the client falls back to the old behaviour: same host as the page (`/ws`) — local dev only.
- بعد البناء بهذا المتغير، يُبنى الـAPK من `dist/` كالمعتاد (Capacitor) — كل نسخة APK تحمل عنوان السيرفر المضمّن فيها.
  After building with this variable, build the APK from `dist/` as usual (Capacitor) — each APK carries the baked-in server URL.

## 3) تشغيل محلي / Docker | Local run / Docker

```bash
npm install
npm run build        # يبني العميل إلى dist/ (يخدمه السيرفر في الإنتاج)
NODE_ENV=production PORT=3000 npm start
curl http://localhost:3000/api/health   # -> {"ok":true,"activeRooms":0,"connectedPlayers":0}
```

```bash
docker build -t chain-escape-server .
docker run --rm -p 3000:3000 -e NODE_ENV=production chain-escape-server
```

## ملفات النشر | Deployment files

| الملف | الدور |
|---|---|
| `render.yaml` | مخطط Render: Free Web Service، `npm start`، فحص الصحة `/api/health` |
| `Dockerfile` | صورة Node 20: بناء العميل ثم تشغيل السيرفر بـ `tsx` |
| `server.ts` | يقرأ `PORT`، يستمع على `0.0.0.0`، ويخدم `dist/` في الإنتاج |
| `.env.example` | متغيرات `PORT` و`NODE_ENV` و`VITE_SERVER_URL` موثقة |
