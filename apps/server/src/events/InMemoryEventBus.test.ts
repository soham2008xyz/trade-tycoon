import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventBus } from './InMemoryEventBus';
import type { RoomEvent } from './EventBus';
import type { LobbyState } from '@trade-tycoon/game-logic';

const lobbyEvent = (roomId: string): RoomEvent => ({
  type: 'lobby_update',
  state: { roomId, players: [], status: 'lobby' } as LobbyState,
});

describe('InMemoryEventBus', () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  it('delivers events to current subscribers of a room', async () => {
    const received: RoomEvent[] = [];
    await bus.subscribe('R1', (ev) => received.push(ev));
    await bus.publish('R1', lobbyEvent('R1'));
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('lobby_update');
  });

  it('does not deliver events from another room', async () => {
    const received: RoomEvent[] = [];
    await bus.subscribe('R1', (ev) => received.push(ev));
    await bus.publish('R2', lobbyEvent('R2'));
    expect(received).toHaveLength(0);
  });

  it('does not deliver events published before subscription', async () => {
    const received: RoomEvent[] = [];
    await bus.publish('R1', lobbyEvent('R1'));
    await bus.subscribe('R1', (ev) => received.push(ev));
    expect(received).toHaveLength(0);
  });

  it('stops delivering after unsubscribe', async () => {
    const received: RoomEvent[] = [];
    const unsub = await bus.subscribe('R1', (ev) => received.push(ev));
    unsub();
    await bus.publish('R1', lobbyEvent('R1'));
    expect(received).toHaveLength(0);
  });

  it('fans out to multiple subscribers of the same room', async () => {
    const a: RoomEvent[] = [];
    const b: RoomEvent[] = [];
    await bus.subscribe('R1', (ev) => a.push(ev));
    await bus.subscribe('R1', (ev) => b.push(ev));
    await bus.publish('R1', lobbyEvent('R1'));
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('continues fan-out even if one subscriber throws', async () => {
    const errSpy = console.error;
    console.error = () => {};
    const after: RoomEvent[] = [];
    await bus.subscribe('R1', () => {
      throw new Error('boom');
    });
    await bus.subscribe('R1', (ev) => after.push(ev));
    await bus.publish('R1', lobbyEvent('R1'));
    expect(after).toHaveLength(1);
    console.error = errSpy;
  });

  it('lets a subscriber unsubscribe itself inside its own handler without breaking other subscribers', async () => {
    const a: RoomEvent[] = [];
    const b: RoomEvent[] = [];
    let unsubA: (() => void) | null = null;
    unsubA = await bus.subscribe('R1', (ev) => {
      a.push(ev);
      unsubA?.();
    });
    await bus.subscribe('R1', (ev) => b.push(ev));
    await bus.publish('R1', lobbyEvent('R1'));
    await bus.publish('R1', lobbyEvent('R1'));
    expect(a).toHaveLength(1); // unsubscribed after first
    expect(b).toHaveLength(2);
  });
});
