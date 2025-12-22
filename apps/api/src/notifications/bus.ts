import { EventEmitter } from "node:events";

// Simple in-memory notification bus (per-process).
// Good enough for single-instance deployments; if we scale horizontally, swap for Redis/pubsub.
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

function key(userId: string) {
  return `notifications:${userId}`;
}

export function publishNotificationsChanged(userId: string) {
  emitter.emit(key(userId));
}

export function subscribeNotificationsChanged(userId: string, fn: () => void) {
  const k = key(userId);
  emitter.on(k, fn);
  return () => {
    emitter.off(k, fn);
  };
}


