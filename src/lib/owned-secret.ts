/**
 * Deterministic ownership for secret bytes (inspired by
 * https://github.com/HowProgrammingWorks/Ownership — Owned / dispose / move).
 *
 * Goals for NoCloud identity material:
 * - single owner; move transfers exclusive access
 * - dispose zeroes memory so leftover secretKey is not casually readable
 * - use()/borrow() block after dispose or move
 * - third-party code gets only a short-lived borrow, not a durable reference
 */

export type OwnedState = 'owned' | 'moved' | 'disposed';

const zeroBytes = (bytes: Uint8Array): void => {
  bytes.fill(0);
};

export class OwnedSecret {
  #bytes: Uint8Array | null;
  #state: OwnedState = 'owned';

  constructor(bytes: Uint8Array) {
    // Own a copy so callers cannot keep a side-channel to the same buffer.
    this.#bytes = new Uint8Array(bytes);
  }

  get state(): OwnedState {
    return this.#state;
  }

  #assertOwned(): Uint8Array {
    if (this.#state !== 'owned' || !this.#bytes) {
      throw new ReferenceError(`OwnedSecret is ${this.#state}`);
    }
    return this.#bytes;
  }

  /** Exclusive read/write callback; bytes must not escape the callback. */
  use<T>(operation: (bytes: Uint8Array) => T): T {
    return operation(this.#assertOwned());
  }

  /** Read-only snapshot for APIs that require Uint8Array (sign/verify). */
  borrow(): Uint8Array {
    return this.#assertOwned().slice();
  }

  /** Transfer ownership; this instance becomes unusable. */
  move(): OwnedSecret {
    const bytes = this.#assertOwned();
    const next = new OwnedSecret(bytes);
    zeroBytes(bytes);
    this.#bytes = null;
    this.#state = 'moved';
    return next;
  }

  /** Drop ownership and overwrite secret material. */
  [Symbol.dispose](): void {
    if (this.#state !== 'owned' || !this.#bytes) {
      this.#state = 'disposed';
      this.#bytes = null;
      return;
    }
    zeroBytes(this.#bytes);
    this.#bytes = null;
    this.#state = 'disposed';
  }

  dispose(): void {
    this[Symbol.dispose]();
  }
}

/**
 * Revocable capability: after dispose/revoke, proxy access throws.
 * Useful when handing a temporary view to untrusted / third-party code.
 */
export const revocableView = <T extends object>(
  target: T,
): {
  value: T;
  revoke: () => void;
  dispose: () => void;
  [Symbol.dispose]: () => void;
} => {
  const { proxy, revoke } = Proxy.revocable(target, {});
  const dispose = () => {
    try {
      revoke();
    } catch {
      /* already revoked */
    }
  };
  return { value: proxy, revoke: dispose, dispose, [Symbol.dispose]: dispose };
};

/** AbortScope: cancel in-flight work tied to a lifetime (fetch, probes). */
export class AbortScope {
  #controller = new AbortController();

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  [Symbol.dispose](): void {
    if (!this.#controller.signal.aborted) {
      this.#controller.abort(new Error('AbortScope disposed'));
    }
  }

  dispose(): void {
    this[Symbol.dispose]();
  }
}
