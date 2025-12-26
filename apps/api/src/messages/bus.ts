import { EventEmitter } from "node:events";

// Simple in-memory messages bus (per-process).
// Good enough for single-instance deployments; if we scale horizontally, swap for Redis/pubsub.
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

function key(userId: string) {
  return `messages:${userId}`;
}

export function publishMessagesChanged(userId: string) {
  emitter.emit(key(userId));
}

export function subscribeMessagesChanged(userId: string, fn: () => void) {
  const k = key(userId);
  emitter.on(k, fn);
  return () => {
    emitter.off(k, fn);
  };
}


