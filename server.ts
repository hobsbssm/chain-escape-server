import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomSimulation } from './src/shared/physicsSim.ts';
import { WORLDS } from './src/shared/worldsData.ts';
import type {
  CharacterCustomization,
  ClientToServerMessage,
  ServerToClientMessage,
  StageNumber,
  WorldId,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parsedPort = Number(process.env.PORT || 3000);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
const MAX_PLAYERS = 6;
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface ConnectedClient {
  ws: WebSocket;
  playerId: string;
  roomCode: string | null;
}

interface ServerRoom {
  code: string;
  sim: RoomSimulation;
  clients: Map<string, ConnectedClient>;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  lastTickMs: number;
}

const rooms = new Map<string, ServerRoom>();
const allClients = new Set<ConnectedClient>();

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return `C${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

function sanitizeStage(raw: unknown): StageNumber {
  return raw === 2 ? 2 : 1;
}

function sanitizeCustomization(raw: unknown): CharacterCustomization {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const safeName =
    typeof c.name === 'string' && c.name.trim().length > 0
      ? c.name.trim().slice(0, 16)
      : 'Adventurer';
  const colorHex =
    typeof c.colorHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.colorHex)
      ? c.colorHex
      : '#ef4444';
  const validOutfits = ['hoodie', 'parka', 'forge', 'temple', 'void_suit'] as const;
  const validHats = ['goggles', 'cap', 'beanie', 'horns', 'crown', 'ninja', 'none'] as const;
  const validAcc = ['bedroll', 'lantern', 'cape', 'wings', 'none'] as const;
  const validFaces = ['determined', 'cheerful', 'masked', 'bandaged'] as const;

  return {
    name: safeName,
    colorHex,
    outfit: validOutfits.includes(c.outfit as (typeof validOutfits)[number])
      ? (c.outfit as CharacterCustomization['outfit'])
      : 'hoodie',
    hat: validHats.includes(c.hat as (typeof validHats)[number])
      ? (c.hat as CharacterCustomization['hat'])
      : 'goggles',
    accessory: validAcc.includes(c.accessory as (typeof validAcc)[number])
      ? (c.accessory as CharacterCustomization['accessory'])
      : 'bedroll',
    face: validFaces.includes(c.face as (typeof validFaces)[number])
      ? (c.face as CharacterCustomization['face'])
      : 'determined',
  };
}

function sendJson(ws: WebSocket, msg: ServerToClientMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastRoom(room: ServerRoom, msg: ServerToClientMessage): void {
  const payload = JSON.stringify(msg);
  for (const client of room.clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function detachClientFromRoom(client: ConnectedClient, permanent: boolean): void {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  if (!room) return;

  room.clients.delete(client.playerId);

  if (permanent) {
    const prevHost = room.sim.hostId;
    room.sim.removePlayer(client.playerId);
    broadcastRoom(room, {
      type: 'room:event',
      event: 'player_left',
      detail: client.playerId,
    });
    if (room.sim.hostId !== prevHost && room.sim.players.length > 0) {
      broadcastRoom(room, {
        type: 'room:event',
        event: 'host_migrated',
        detail: room.sim.hostId,
      });
    }
    if (room.sim.players.length === 0) {
      rooms.delete(room.code);
      return;
    }
    broadcastRoom(room, { type: 'room:state', state: room.sim.getSnapshot() });
  } else {
    room.sim.setPlayerConnected(client.playerId, false);
    broadcastRoom(room, { type: 'room:state', state: room.sim.getSnapshot() });
    const existingTimer = room.disconnectTimers.get(client.playerId);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      room.disconnectTimers.delete(client.playerId);
      if (!room.clients.has(client.playerId)) {
        const prevHost = room.sim.hostId;
        room.sim.removePlayer(client.playerId);
        broadcastRoom(room, {
          type: 'room:event',
          event: 'player_left',
          detail: client.playerId,
        });
        if (room.sim.hostId !== prevHost && room.sim.players.length > 0) {
          broadcastRoom(room, {
            type: 'room:event',
            event: 'host_migrated',
            detail: room.sim.hostId,
          });
        }
        if (room.sim.players.length === 0) {
          rooms.delete(room.code);
        } else {
          broadcastRoom(room, { type: 'room:state', state: room.sim.getSnapshot() });
        }
      }
    }, 20000);
    room.disconnectTimers.set(client.playerId, timer);
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size, connectedPlayers: allClients.size });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = String(req.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ exists: false });
      return;
    }
    res.json({
      exists: true,
      code: room.code,
      worldId: room.sim.worldId,
      stage: room.sim.stage,
      phase: room.sim.phase,
      playerCount: room.sim.players.length,
      maxPlayers: MAX_PLAYERS,
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const client: ConnectedClient = {
      ws,
      playerId: `p_${Math.random().toString(36).slice(2, 10)}`,
      roomCode: null,
    };
    allClients.add(client);

    ws.on('message', (data) => {
      let msg: ClientToServerMessage;
      try {
        msg = JSON.parse(data.toString()) as ClientToServerMessage;
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;

      if (msg.type === 'ping') {
        sendJson(ws, { type: 'pong', clientTime: msg.clientTime });
        if (client.roomCode) {
          const room = rooms.get(client.roomCode);
          const p = room?.sim.players.find((pl) => pl.id === client.playerId);
          if (p) {
            p.pingMs = Math.max(4, Math.min(999, Math.round(Date.now() - msg.clientTime)));
          }
        }
        return;
      }

      if (msg.type === 'room:create') {
        detachClientFromRoom(client, true);
        if (typeof msg.playerId === 'string' && msg.playerId.trim().length > 0) {
          client.playerId = msg.playerId.trim().slice(0, 32);
        }
        const worldId: WorldId = WORLDS[msg.worldId] ? msg.worldId : 'sky_islands';
        const stage = sanitizeStage(msg.stage);
        const code = generateRoomCode();
        const sim = new RoomSimulation(
          code,
          worldId,
          client.playerId,
          (event, detail) => {
            const r = rooms.get(code);
            if (r) broadcastRoom(r, { type: 'room:event', event, detail });
          },
          stage,
        );
        const custom = sanitizeCustomization(msg.customization);
        sim.addPlayer(client.playerId, custom, true);
        const room: ServerRoom = {
          code,
          sim,
          clients: new Map([[client.playerId, client]]),
          disconnectTimers: new Map(),
          lastTickMs: Date.now(),
        };
        rooms.set(code, room);
        client.roomCode = code;
        sendJson(ws, {
          type: 'room:joined',
          roomCode: code,
          playerId: client.playerId,
          state: sim.getSnapshot(),
        });
        return;
      }

      if (msg.type === 'room:join') {
        const code = String(msg.roomCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const room = rooms.get(code);
        if (!room) {
          sendJson(ws, { type: 'room:error', message: 'ROOM_NOT_FOUND' });
          return;
        }
        if (typeof msg.playerId === 'string' && msg.playerId.trim().length > 0) {
          client.playerId = msg.playerId.trim().slice(0, 32);
        }
        const existingPlayer = room.sim.players.find((p) => p.id === client.playerId);
        if (!existingPlayer && room.sim.players.length >= MAX_PLAYERS) {
          sendJson(ws, { type: 'room:error', message: 'ROOM_FULL' });
          return;
        }
        if (client.roomCode && client.roomCode !== code) {
          detachClientFromRoom(client, true);
        }
        const timer = room.disconnectTimers.get(client.playerId);
        if (timer) {
          clearTimeout(timer);
          room.disconnectTimers.delete(client.playerId);
        }
        const custom = sanitizeCustomization(msg.customization);
        room.sim.addPlayer(client.playerId, custom, room.sim.hostId === client.playerId);
        room.sim.setPlayerConnected(client.playerId, true);
        room.clients.set(client.playerId, client);
        client.roomCode = code;

        const snap = room.sim.getSnapshot();
        sendJson(ws, {
          type: 'room:joined',
          roomCode: code,
          playerId: client.playerId,
          state: snap,
        });
        broadcastRoom(room, {
          type: 'room:event',
          event: 'player_joined',
          detail: custom.name,
        });
        broadcastRoom(room, { type: 'room:state', state: snap });
        return;
      }

      if (msg.type === 'room:leave') {
        detachClientFromRoom(client, true);
        return;
      }

      if (!client.roomCode) return;
      const room = rooms.get(client.roomCode);
      if (!room) return;

      if (msg.type === 'room:select_world') {
        if (room.sim.hostId !== client.playerId) return;
        if (!WORLDS[msg.worldId]) return;
        const stage = sanitizeStage(msg.stage ?? room.sim.stage);
        room.sim.resetWorld(msg.worldId, stage);
        broadcastRoom(room, { type: 'room:state', state: room.sim.getSnapshot() });
        return;
      }

      if (msg.type === 'room:update_custom') {
        const p = room.sim.players.find((pl) => pl.id === client.playerId);
        if (p) {
          p.customization = sanitizeCustomization(msg.customization);
          broadcastRoom(room, { type: 'room:state', state: room.sim.getSnapshot() });
        }
        return;
      }

      if (msg.type === 'room:start') {
        if (room.sim.hostId !== client.playerId) return;
        room.sim.resetWorld(room.sim.worldId, room.sim.stage);
        room.sim.phase = 'playing';
        room.lastTickMs = Date.now();
        broadcastRoom(room, { type: 'room:state', state: room.sim.getSnapshot() });
        return;
      }

      if (msg.type === 'room:restart') {
        if (room.sim.hostId !== client.playerId) return;
        room.sim.resetWorld(room.sim.worldId, room.sim.stage);
        room.sim.phase = 'playing';
        room.lastTickMs = Date.now();
        broadcastRoom(room, { type: 'room:state', state: room.sim.getSnapshot() });
        return;
      }

      if (msg.type === 'game:input') {
        room.sim.setPlayerInput(client.playerId, msg.input);
        return;
      }

      if (msg.type === 'voice:state') {
        const p = room.sim.players.find((pl) => pl.id === client.playerId);
        if (p) {
          p.voiceMuted = Boolean(msg.muted);
          p.voiceSpeaking = Boolean(msg.speaking);
        }
        return;
      }

      if (msg.type === 'voice:signal') {
        const target = room.clients.get(msg.targetPlayerId);
        if (target) {
          sendJson(target.ws, {
            type: 'voice:signal',
            fromPlayerId: client.playerId,
            signal: msg.signal,
          });
        }
      }
    });

    ws.on('close', () => {
      allClients.delete(client);
      detachClientFromRoom(client, false);
    });
  });

  // Authoritative 30Hz physics simulation & state broadcast loop
  setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      const dt = Math.min(0.05, Math.max(0.001, (now - room.lastTickMs) / 1000));
      room.lastTickMs = now;
      if (room.sim.phase === 'playing' || room.sim.phase === 'victory') {
        room.sim.step(dt);
        broadcastRoom(room, { type: 'room:state', state: room.sim.getSnapshot() });
      }
    }
  }, 33);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve the Vite build (dist/) if it exists. The server must
    // still start and answer /api/health even when dist/ is missing (e.g. a
    // build step was skipped), so the static hosting is guarded instead of
    // crashing on a missing index.html.
    const distDir = path.resolve(__dirname, 'dist');
    const distIndex = path.join(distDir, 'index.html');
    if (fs.existsSync(distIndex)) {
      app.use(express.static(distDir));
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
          res.status(404).json({ error: 'NOT_FOUND' });
          return;
        }
        res.sendFile(distIndex);
      });
    } else {
      console.warn(
        'WARNING: dist/index.html not found — serving API/WebSocket only. Run `npm run build` to enable the web client.',
      );
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Chain Escape server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
