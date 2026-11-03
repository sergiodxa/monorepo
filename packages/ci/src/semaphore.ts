/**
 * A counting semaphore: at most `limit` holders at once, the rest waiting in arrival order. A
 * run takes one slot per running step, so nested groups and matrices never hold slots themselves
 * and can never wait on slots their own steps need.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A slot-limited queue of async work. */
export class Semaphore {
	#available: number;
	readonly #waiting: Array<() => void> = [];

	/** @param limit - The most holders at once; anything below 1 counts as 1 */
	constructor(limit: number) {
		this.#available = Math.max(1, Math.floor(limit));
	}

	/** Resolves once a slot is free, to the function that gives it back; call it exactly once. */
	async acquire(): Promise<() => void> {
		if (this.#available > 0) {
			this.#available -= 1;
		} else {
			await new Promise<void>((resolve) => {
				this.#waiting.push(resolve);
			});
		}
		let released = false;
		return () => {
			if (released) return;
			released = true;
			let next = this.#waiting.shift();
			if (next === undefined) this.#available += 1;
			else next();
		};
	}
}
