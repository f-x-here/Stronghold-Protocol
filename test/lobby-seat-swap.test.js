import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.js';
import { StubMatch } from '../server/match/StubMatch.js';
import { TestClient } from './helpers/wsClient.js';
import { validateC2S } from '../shared/protocol.js';

test('seat swap protocol validates identities, seats and explicit answers', () => {
  assert.equal(validateC2S({ t: 'room.swapSeat', seat: 19, playerId: 'doctor_1' }), null);
  assert.notEqual(validateC2S({ t: 'room.swapSeat', seat: 20, playerId: 'doctor_1' }), null);
  assert.notEqual(validateC2S({ t: 'room.swapSeat', seat: 1 }), null);
  assert.equal(validateC2S({ t: 'room.answerSeatSwap', requestId: 1, accept: true }), null);
  assert.notEqual(validateC2S({ t: 'room.answerSeatSwap', requestId: 1, accept: 1 }), null);
});

test('AI accepts immediately; humans consent; identity, readiness and stale-request guards survive exchanges', async () => {
  const srv = await startServer({ host: '127.0.0.1', port: 0, quiet: true, MatchClass: StubMatch, assetIndex: false, studio: false });
  const clients = [];
  try {
    const connect = async (name) => {
      const c = await TestClient.connect(`ws://127.0.0.1:${srv.port}/ws`);
      c.id = (await c.hello(name)).playerId;
      clients.push(c);
      return c;
    };
    const a = await connect('Host'), b = await connect('Guest'), outsider = await connect('Other');
    assert.equal((await a.request({ t: 'room.create', mode: 'coop', difficulty: 'NORMAL', capacity: 20 })).t, 'ok');
    let state = await a.waitFor('room.state');
    await b.request({ t: 'room.join', code: state.code });
    await a.request({ t: 'room.addBot' });
    state = await a.waitFor('room.state', s => !!s.seats[2]);
    const bot = state.seats[2].playerId;
    await b.request({ t: 'room.ready', ready: true });
    assert.equal((await a.request({ t: 'room.swapSeat', seat: 2, playerId: bot })).t, 'ok');
    state = await a.waitFor('room.state', s => s.seats[2]?.playerId === a.id);
    assert.equal(state.seats[0].playerId, bot);
    assert.equal(state.hostId, a.id);
    assert.equal(state.seats[1].ready, false);
    assert.equal(state.seatSwap, undefined);
    assert.equal((await a.request({ t: 'room.swapSeat', seat: 1, playerId: b.id })).t, 'ok');
    state = await a.waitFor('room.state', s => !!s.seatSwap);
    let requestId = state.seatSwap.id;
    assert.equal(state.seats[1].playerId, b.id, 'no movement before agreement');
    assert.equal((await outsider.request({ t: 'room.answerSeatSwap', requestId, accept: true })).code, 'NOT_IN_ROOM');
    assert.equal((await a.request({ t: 'room.answerSeatSwap', requestId, accept: true })).code, 'BAD_TARGET');
    assert.equal((await b.request({ t: 'room.answerSeatSwap', requestId, accept: false })).t, 'ok');
    assert.equal((await b.request({ t: 'room.answerSeatSwap', requestId, accept: true })).code, 'BAD_TARGET');
    await a.request({ t: 'room.swapSeat', seat: 1, playerId: b.id });
    state = await a.waitFor('room.state', s => !!s.seatSwap && s.seatSwap.id !== requestId);
    requestId = state.seatSwap.id;
    assert.equal((await b.request({ t: 'room.answerSeatSwap', requestId, accept: true })).t, 'ok');
    state = await a.waitFor('room.state', s => s.seats[1]?.playerId === a.id);
    assert.equal(state.seats[2].playerId, b.id);
    assert.equal(state.seats[2].seat, 2);
    assert.equal((await a.request({ t: 'room.swapSeat', seat: 2, playerId: 'stale_player' })).code, 'BAD_TARGET');
    await a.request({ t: 'room.swapSeat', seat: 2, playerId: b.id });
    state = await a.waitFor('room.state', s => !!s.seatSwap);
    requestId = state.seatSwap.id;
    await b.request({ t: 'room.leave' });
    state = await a.waitFor('room.state', s => !s.seats[2]);
    assert.equal(state.seatSwap, undefined, 'leaving clears the request');
    await b.request({ t: 'room.join', code: state.code });
    assert.equal((await b.request({ t: 'room.answerSeatSwap', requestId, accept: true })).code, 'BAD_TARGET');
    await b.request({ t: 'room.ready', ready: true });
    await a.request({ t: 'room.start' });
    assert.equal((await a.request({ t: 'room.swapSeat', seat: 0, playerId: b.id })).code, 'ROOM_STARTED');
  } finally {
    await Promise.all(clients.map(c => c.terminate()));
    await srv.close();
  }
});
