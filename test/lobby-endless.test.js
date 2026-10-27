import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lobby } from '../server/lobby.js';
import { SessionRegistry } from '../server/net.js';
import { StubMatch } from '../server/match/StubMatch.js';
import { validateC2S } from '../shared/protocol.js';
import { startServer } from '../server/index.js';
import { Match } from '../server/match/Match.js';
import { FakeBattle } from './match/fakeBattle.js';
import { give, legalTileFor } from './match/harness.js';
import { TestClient } from './helpers/wsClient.js';

test('endless toggle validates booleans and is host-only, resets readiness and reaches match options', () => {
  assert.equal(validateC2S({ t: 'room.setEndless', on: true }), null);
  for (const on of [1, 'true', null, undefined]) assert.notEqual(validateC2S({ t: 'room.setEndless', on }), null);
  let matchOptions;
  class CaptureMatch extends StubMatch { constructor(opts) { super(opts); matchOptions = opts; } }
  const lobby = new Lobby({ registry: new SessionRegistry(), MatchClass: CaptureMatch });
  const host = { playerId: 'host', name: 'Host', connected: true };
  const guest = { playerId: 'guest', name: 'Guest', connected: true };
  try {
    lobby.create(host, { mode: 'coop', difficulty: 'NORMAL' });
    const room = lobby.getRoom(host.roomCode);
    lobby.join(guest, { code: room.code });
    lobby.ready(guest, { ready: true });
    assert.equal(room.toState().endless, false);
    assert.equal(lobby.setEndless(guest, { on: true }).error, 'NOT_HOST');
    assert.ok(lobby.setEndless(host, { on: true }).ok);
    assert.equal(room.toState().endless, true);
    assert.equal(room.seats[1].ready, false);
    lobby.ready(guest, { ready: true });
    assert.ok(lobby.start(host).ok);
    assert.equal(matchOptions.endless, true);
    assert.equal(lobby.setEndless(host, { on: false }).error, 'ROOM_STARTED');
  } finally { lobby.shutdown(); }
});

for (const mode of ['solo', 'coop']) test(`endless ${mode} leave sends one complete result before detaching the socket, teammates keep playing`, async () => {
  let match;
  class TestMatch extends Match {
    constructor(opts) { super({ ...opts, BattleClass: FakeBattle, clientCombat: false, botRehearsal: 0 }); match = this; }
  }
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true, MatchClass: TestMatch });
  const clients = [];
  try {
    const connect = async (name) => {
      const c = await TestClient.connect(`ws://127.0.0.1:${srv.port}/ws`);
      clients.push(c);
      c.playerId = (await c.hello(name)).playerId;
      return c;
    };
    const host = await connect('Host');
    assert.equal((await host.request({ t: 'room.create', mode, difficulty: 'FUNNY' })).t, 'ok');
    const room = await host.waitFor('room.state');
    assert.equal((await host.request({ t: 'room.setEndless', on: true })).t, 'ok');
    let guest;
    if (mode === 'coop') {
      guest = await connect('Guest');
      await guest.request({ t: 'room.join', code: room.code });
      await guest.request({ t: 'room.ready', ready: true });
    }
    assert.equal((await host.request({ t: 'room.start' })).t, 'ok');
    for (const p of match.order) { p.bandId = 'band_bldsk'; p.lp = 28; }
    match.gd.endlessStartRound = 15;
    match.startRound(17);
    const ps = match.players.get(host.playerId);
    const chessId = match.gd.visibleChess[0];
    give(match, ps, chessId, 'board', legalTileFor(match, ps, chessId));
    const reply = await host.request({ t: 'g.leave' });
    assert.equal(reply.t, 'ok');
    const result = await host.waitFor('m.result');
    assert.equal(result.reason, 'quit');
    assert.equal(result.roundsPassed, 16);
    assert.ok(result.players.find(p => p.playerId === host.playerId).lineup.some(p => p.id === chessId));
    assert.ok(host.log.indexOf(result) < host.log.indexOf(reply), 'result arrives before leave is acknowledged');
    assert.equal(ps.board.size, mode === 'coop' ? 0 : 1, 'solo report is made before the abandoned match is disposed');
    if (guest) {
      assert.equal(match.ended, false);
      assert.equal(guest.log.filter(m => m.t === 'm.result').length, 0);
      assert.equal((await guest.request({ t: 'room.leave' })).t, 'ok');
      assert.equal((await guest.waitFor('m.result')).reason, 'quit');
    }
    assert.equal(host.log.filter(m => m.t === 'm.result').length, 1);
  } finally {
    await Promise.all(clients.map(c => c.terminate()));
    await srv.close();
  }
});
