import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startServer } from '../index.js';

const ROOM = 'a'.repeat(40);

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    const w = waiters.findIndex((x) => x.t === m.t);
    if (w >= 0) waiters.splice(w, 1)[0].resolve(m);
    else inbox.push(m);
  });
  return {
    ws,
    open: () => new Promise((r) => ws.once('open', r)),
    send: (m) => ws.send(JSON.stringify(m)),
    next: (t) => {
      const i = inbox.findIndex((m) => m.t === t);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((resolve) => waiters.push({ t, resolve }));
    },
  };
}

test('join, roster, boop and leave', async () => {
  const srv = await startServer({ port: 0 });
  try {
    const a = client(srv.port), b = client(srv.port);
    await Promise.all([a.open(), b.open()]);

    a.send({ t: 'join', room: ROOM, pet: { name: 'Mochi<script>', seed: 's1', stage: 'adult' } });
    const ra = await a.next('roster');
    assert.equal(ra.count, 1);
    assert.deepEqual(ra.peers, []);

    b.send({ t: 'join', room: ROOM, pet: { name: 'Bean', seed: 's2', stage: 'nonsense' } });
    const rb = await b.next('roster');
    assert.equal(rb.count, 2);
    assert.equal(rb.peers[0].pet.name, 'Mochiscript', 'names are sanitised');
    const joined = await a.next('join');
    assert.equal(joined.peer.pet.stage, 'baby', 'unknown stages fall back to baby');

    b.send({ t: 'emote', kind: 'boop', to: ra.you });
    const boop = await a.next('emote');
    assert.equal(boop.from, rb.you);
    assert.equal(boop.name, 'Bean');

    b.ws.close();
    const left = await a.next('leave');
    assert.equal(left.id, rb.you);
    assert.equal(left.count, 1);
    a.ws.close();
  } finally {
    await srv.close();
  }
});

test('rejects bad rooms and keeps rooms apart', async () => {
  const srv = await startServer({ port: 0 });
  try {
    const a = client(srv.port), b = client(srv.port);
    await Promise.all([a.open(), b.open()]);
    a.send({ t: 'join', room: 'https://example.com/', pet: {} });
    a.send({ t: 'join', room: 'b'.repeat(40), pet: { name: 'A' } });
    b.send({ t: 'join', room: 'c'.repeat(40), pet: { name: 'B' } });
    const [ra, rb] = await Promise.all([a.next('roster'), b.next('roster')]);
    assert.equal(ra.count, 1);
    assert.equal(rb.count, 1);
    assert.equal(srv.rooms.size, 2, 'the raw URL was never accepted as a room');
    a.ws.close();
    b.ws.close();
  } finally {
    await srv.close();
  }
});
