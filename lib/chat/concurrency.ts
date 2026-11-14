// Bound expensive inference per process as well as per account. Deployments with
// multiple replicas also need a shared gateway limit; an in-memory gate is local.
export function createChatGate(capacity = 2) {
  const active = new Set<string>();
  return {
    acquire(userId: string): (() => void) | null {
      if (active.has(userId) || active.size >= capacity) return null;
      active.add(userId);
      let released = false;
      return () => { if (!released) { released = true; active.delete(userId); } };
    }
  };
}
export const chatGate = createChatGate();
