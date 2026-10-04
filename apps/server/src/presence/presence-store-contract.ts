import { it, expect } from 'vitest';
import type { PresenceStore } from './PresenceStore';

/**
 * Behavior every `PresenceStore` implementation must share. Each backend's
 * test file calls this with its own factory so the in-memory and Redis
 * versions can't drift apart.
 */
export function describePresenceStoreContract(makeStore: () => Promise<PresenceStore>) {
  it('returns an empty record for an unknown room', async () => {
    const store = await makeStore();
    expect((await store.getLastSeen('NOROOM')).size).toBe(0);
  });

  it('records and overwrites last-seen per player', async () => {
    const store = await makeStore();
    await store.touch('R1', 'alice', 100);
    await store.touch('R1', 'bob', 150);
    await store.touch('R1', 'alice', 200);
    expect(await store.getLastSeen('R1')).toEqual(
      new Map([
        ['alice', 200],
        ['bob', 150],
      ])
    );
  });

  it('keeps rooms isolated from each other', async () => {
    const store = await makeStore();
    await store.touch('R1', 'alice', 100);
    await store.touch('R2', 'alice', 999);
    expect(await store.getLastSeen('R1')).toEqual(new Map([['alice', 100]]));
    expect(await store.getLastSeen('R2')).toEqual(new Map([['alice', 999]]));
  });

  it('seedIfAbsent writes only when there is no record', async () => {
    const store = await makeStore();
    await store.seedIfAbsent('R1', 'alice', 100);
    await store.seedIfAbsent('R1', 'alice', 500);
    await store.touch('R1', 'bob', 300);
    await store.seedIfAbsent('R1', 'bob', 900);
    expect(await store.getLastSeen('R1')).toEqual(
      new Map([
        ['alice', 100],
        ['bob', 300],
      ])
    );
  });

  it('forget removes one player and is idempotent', async () => {
    const store = await makeStore();
    await store.touch('R1', 'alice', 100);
    await store.touch('R1', 'bob', 150);
    await store.forget('R1', 'alice');
    await store.forget('R1', 'alice');
    await store.forget('NOROOM', 'ghost');
    expect(await store.getLastSeen('R1')).toEqual(new Map([['bob', 150]]));
  });

  it('stores a hostile player id as plain data', async () => {
    const store = await makeStore();
    await store.touch('R1', '__proto__', 42);
    expect(await store.getLastSeen('R1')).toEqual(new Map([['__proto__', 42]]));
  });
}
