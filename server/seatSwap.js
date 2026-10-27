// Waiting-room seat exchange; identities and all player preferences travel with the seat record.
import { ERR } from '../shared/constants.js';
const OK = Object.freeze({ ok: true });
const fail = (error, detail = undefined) => detail ? { error, detail } : { error };

export function clearSeatSwap(room) {
  if (room.seatSwap?.timer) clearTimeout(room.seatSwap.timer);
  room.seatSwap = null;
}

export function seatSwap(lobby, session, msg) {
  const room = lobby.roomOf(session);
  if (!room) return fail(ERR.NOT_IN_ROOM);
  if (room.match) return fail(ERR.ROOM_STARTED);
  const mine = room.seatOf(session.playerId);
  if (!mine || mine.left || room.mode === 'solo') return fail(ERR.BAD_TARGET);
  if (room.seatSwap && room.seatSwap.expiresAt <= Date.now()) clearSeatSwap(room);
  const exchange = (a, b) => {
    lobby.dropReplay(room, a.playerId);
    if (!b.isBot) lobby.dropReplay(room, b.playerId);
    const index = a.seat;
    a.seat = b.seat;
    b.seat = index;
    room.seats[a.seat] = a;
    room.seats[b.seat] = b;
    for (const s of room.seats) if (s && !s.isBot) s.ready = false;
    if (room.versionVote) lobby.voidVersionVote(room, 'members');
    clearSeatSwap(room);
    lobby.broadcastState(room);
    return OK;
  };
  if (msg.t === 'room.swapSeat') {
    const target = room.seats[msg.seat];
    if (!target || target.playerId !== msg.playerId || target === mine || target.left || (!target.isBot && !target.connected)) return fail(ERR.BAD_TARGET);
    if (room.seatSwap) return fail(ERR.BAD_TARGET, 'seat exchange pending');
    if (target.isBot) return exchange(mine, target);
    const id = (room.seatSwapSeq || 0) + 1;
    room.seatSwapSeq = id;
    const request = { id, from: mine.playerId, to: target.playerId, fromSeat: mine.seat, toSeat: target.seat,
      expiresAt: Date.now() + 30_000, timer: null };
    room.seatSwap = request;
    request.timer = setTimeout(() => lobby.queueEvent(room, () => {
      if (room.seatSwap !== request) return;
      clearSeatSwap(room);
      if (!room.disposed) lobby.broadcastState(room);
    }), 30_000);
    request.timer.unref?.();
    lobby.broadcastState(room);
    return OK;
  }
  const request = room.seatSwap;
  if (!request || request.id !== msg.requestId || ![request.from, request.to].includes(session.playerId)) return fail(ERR.BAD_TARGET);
  if (!msg.accept) {
    clearSeatSwap(room);
    lobby.broadcastState(room);
    return OK;
  }
  if (request.to !== session.playerId) return fail(ERR.BAD_TARGET);
  const from = room.seats[request.fromSeat], to = room.seats[request.toSeat];
  if (!from || !to || from.playerId !== request.from || to.playerId !== request.to || !from.connected || !to.connected) {
    clearSeatSwap(room);
    lobby.broadcastState(room);
    return fail(ERR.BAD_TARGET);
  }
  return exchange(from, to);
}
