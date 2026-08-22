type Listener = (...args: unknown[]) => void;

export class EventEmitter {
  events = new Map<string, Set<Listener>>();

  on(name: string, fn: Listener) {
    const event = this.events.get(name);
    if (event) event.add(fn);
    else this.events.set(name, new Set([fn]));
  }

  emit(name: string, ...args: unknown[]) {
    const event = this.events.get(name);
    if (!event) return;
    for (const fn of event.values()) {
      fn(...args);
    }
  }

  remove(name: string, fn: Listener) {
    const event = this.events.get(name);
    if (!event) return;
    event.delete(fn);
  }

  clear(name?: string) {
    if (name) this.events.delete(name);
    else this.events.clear();
  }
}
