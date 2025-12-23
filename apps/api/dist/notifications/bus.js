import { EventEmitter } from "node:events";
// Simple in-memory notification bus (per-process).
// Good enough for single-instance deployments; if we scale horizontally, swap for Redis/pubsub.
const emitter = new EventEmitter();
emitter.setMaxListeners(0);
function key(userId) {
    return `notifications:${userId}`;
}
export function publishNotificationsChanged(userId) {
    emitter.emit(key(userId));
}
export function subscribeNotificationsChanged(userId, fn) {
    const k = key(userId);
    emitter.on(k, fn);
    return () => {
        emitter.off(k, fn);
    };
}
//# sourceMappingURL=bus.js.map