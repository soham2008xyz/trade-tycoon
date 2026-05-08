import type { EventBus, RoomEvent } from './EventBus';

type Handler = (event: RoomEvent) => void;

/**
 * Single-process EventBus. Maintains a Map of `roomId → Set<Handler>` and
 * fans out synchronously inside `publish`. Used by tests and by the local
 * dev server (where every connected SSE stream lives in the same Node
 * process anyway).
 */
export class InMemoryEventBus implements EventBus {
  private readonly subscribers = new Map<string, Set<Handler>>();

  async publish(roomId: string, event: RoomEvent): Promise<void> {
    const handlers = this.subscribers.get(roomId);
    if (!handlers) return;
    // Snapshot so a handler unsubscribing inside its own callback (e.g. a
    // disconnecting SSE stream) does not break the iteration.
    for (const handler of [...handlers]) {
      try {
        handler(event);
      } catch (err) {
        console.error('[InMemoryEventBus] subscriber threw, continuing fan-out', err);
      }
    }
  }

  async subscribe(roomId: string, handler: Handler): Promise<() => void> {
    let handlers = this.subscribers.get(roomId);
    if (!handlers) {
      handlers = new Set();
      this.subscribers.set(roomId, handlers);
    }
    handlers.add(handler);
    return () => {
      const set = this.subscribers.get(roomId);
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) this.subscribers.delete(roomId);
    };
  }
}
