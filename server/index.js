// Webling presence: rooms keyed by a page hash, relaying joins, leaves, looks and boops.
// Nothing is written to disk and nothing is logged per user. Run: PORT=8787 node index.js
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

const ROOM_RE = /^[a-f0-9]{32,64}$/;
const STAGES = new Set(['baby', 'adult', 'legend']);
const ROOM_CAP = 300; // people per page
const ROSTER_MAX = 40; // peers sent to a newcomer (clients draw at most a dozen anyway)
const MSG_MAX = 1024; // bytes
const RATE = { burst: 20, perSec: 5 };

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const look = (p) => ({
  name: clean(p?.name, 16),
  seed: clean(p?.seed, 32) || 'x',
  stage: STAGES.has(p?.stage) ? p.stage : 'baby',
});

export function startServer({ port = 8787 } = {}) {
  const rooms = new Map(); // room → Map(id → client)

  const http = createServer((req, res) => {
    if (req.url === '/health') {
      let people = 0;
      for (const r of rooms.values()) people += r.size;
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, rooms: rooms.size, people }));
    }
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ server: http, maxPayload: MSG_MAX });

  const broadcast = (room, msg, except) => {
    const data = JSON.stringify(msg);
    for (const c of room.values()) if (c !== except && c.ws.readyState === 1) c.ws.send(data);
  };

  const leave = (c) => {
    const room = c.room && rooms.get(c.room);
    if (!room?.delete(c.id)) return;
    if (!room.size) rooms.delete(c.room);
    else broadcast(room, { t: 'leave', id: c.id, count: room.size });
    c.room = null;
  };

  wss.on('connection', (ws) => {
    const c = { ws, id: randomBytes(6).toString('hex'), room: null, pet: null, tokens: RATE.burst, at: Date.now(), alive: true };
    ws.client = c;
    ws.on('pong', () => (c.alive = true));

    ws.on('message', (data) => {
      const now = Date.now();
      c.tokens = Math.min(RATE.burst, c.tokens + ((now - c.at) / 1000) * RATE.perSec);
      c.at = now;
      if (c.tokens < 1) return;
      c.tokens--;
      let m;
      try {
        m = JSON.parse(data);
      } catch {
        return;
      }

      if (m.t === 'join' && ROOM_RE.test(m.room)) {
        leave(c);
        const room = rooms.get(m.room) || new Map();
        if (room.size >= ROOM_CAP) return ws.send(JSON.stringify({ t: 'full' }));
        rooms.set(m.room, room);
        c.room = m.room;
        c.pet = look(m.pet);
        const peers = [...room.values()].slice(-ROSTER_MAX).map((p) => ({ id: p.id, pet: p.pet }));
        room.set(c.id, c);
        ws.send(JSON.stringify({ t: 'roster', you: c.id, count: room.size, peers }));
        broadcast(room, { t: 'join', peer: { id: c.id, pet: c.pet }, count: room.size }, c);
      } else if (m.t === 'look' && c.room) {
        c.pet = look(m.pet);
        broadcast(rooms.get(c.room), { t: 'look', id: c.id, pet: c.pet }, c);
      } else if (m.t === 'emote' && c.room && m.kind === 'boop') {
        const room = rooms.get(c.room);
        if (!room.has(m.to) || m.to === c.id) return;
        broadcast(room, { t: 'emote', kind: 'boop', from: c.id, to: m.to, name: c.pet.name });
      }
    });

    ws.on('close', () => leave(c));
    ws.on('error', () => leave(c));
  });

  // Drop connections that stopped answering pings.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.client.alive) { ws.terminate(); continue; }
      ws.client.alive = false;
      ws.ping();
    }
  }, 30e3);

  return new Promise((resolve) => {
    http.listen(port, () => {
      resolve({
        port: http.address().port,
        rooms,
        close: () => new Promise((r) => {
          clearInterval(heartbeat);
          for (const ws of wss.clients) ws.terminate();
          wss.close(() => http.close(() => r()));
        }),
      });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { port } = await startServer({ port: Number(process.env.PORT) || 8787 });
  console.log(`webling presence on ws://localhost:${port}`);
}
