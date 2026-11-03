/**
 * A weighted counting semaphore: holders take as many slots as their weight, up to the limit,
 * and wait in arrival order. A run takes slots per running step, so nested groups and matrices
 * never hold slots themselves and can never wait on slots their own steps need.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A holder waiting for slots: how many it needs, and how to wake it. */
interface Waiter {
	weight: number;
	wake: () => void;
}

/** A slot-limited queue of async work. */
export class Semaphore {
	readonly #limit: number;
	#available: number;
	readonly #waiting: Waiter[] = [];

	/** @param limit - The most slots held at once; anything below 1 counts as 1 */
	constructor(limit: number) {
		this.#limit = Math.max(1, Math.floor(limit));
		this.#available = this.#limit;
	}

	/**
	 * Resolves once `weight` slots are free, to the function that gives them back; call it
	 * exactly once. A weight above the limit takes every slot, so a heavy holder runs alone
	 * instead of waiting forever. Holders are served in arrival order.
	 *
	 * @param weight - Slots to hold; at least 1
	 * @default weight 1
	 */
	async acquire(weight = 1): Promise<() => void> {
		let needed = Math.min(this.#limit, Math.max(1, Math.floor(weight)));
		if (this.#waiting.length === 0 && this.#available >= needed) {
			this.#available -= needed;
		} else {
			await new Promise<void>((resolve) => {
				this.#waiting.push({ weight: needed, wake: resolve });
			});
		}
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.#available += needed;
			this.#drain();
		};
	}

	/** Wakes waiters from the front for as long as the first one's slots are free. */
	#drain(): void {
		let next = this.#waiting[0];
		while (next !== undefined && this.#available >= next.weight) {
			this.#waiting.shift();
			this.#available -= next.weight;
			next.wake();
			next = this.#waiting[0];
		}
	}
}
