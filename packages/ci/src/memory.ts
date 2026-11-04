/**
 * Declared memory reservations for concurrent steps: parse human sizes, expose the machine's
 * total and free bytes, and a pool that holds bytes the way the slot semaphore holds weights.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { freemem, totalmem } from "node:os";

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/** Bytes of RAM on this machine, for scripts sizing a step's `memory` reservation. */
export interface MachineMemory {
	/** `os.totalmem()` at the start of the run. */
	total: number;
	/** `os.freemem()` at the start of the run. */
	free: number;
}

/** The machine's total and free memory right now. */
export function machineMemory(): MachineMemory {
	return { total: totalmem(), free: freemem() };
}

/**
 * The default memory budget: three quarters of total RAM, leaving the rest for the OS, the
 * runner and anything else sharing the machine.
 */
export function defaultMemoryBudget(total = totalmem()): number {
	return Math.floor(total * 0.75);
}

/**
 * Parses a size such as `2GB`, `512MB`, `1.5GiB` or a bare byte count into bytes. Units are
 * powers of 1024 (`K`/`KB`/`KiB`, `M`/`MB`/`MiB`, `G`/`GB`/`GiB`).
 */
export function parseMemorySize(text: string): Result<number, Error> {
	let match = /^(\d+(?:\.\d+)?)\s*(k|kb|kib|m|mb|mib|g|gb|gib|b)?$/i.exec(text.trim());
	if (match === null) {
		return failure(new Error(`expects a size such as 2GB, 512MB or 1048576, not "${text}"`));
	}
	let value = Number(match[1]);
	let unit = (match[2] ?? "b").toLowerCase();
	let factor = 1;
	if (unit === "g" || unit === "gb" || unit === "gib") factor = 1024 ** 3;
	else if (unit === "m" || unit === "mb" || unit === "mib") factor = 1024 ** 2;
	else if (unit === "k" || unit === "kb" || unit === "kib") factor = 1024;
	return success(Math.floor(value * factor));
}

/** A holder waiting for bytes: how many it needs, and how to wake it. */
interface Waiter {
	bytes: number;
	wake: () => void;
}

/**
 * A byte-limited queue of async work. Holders take as many bytes as their reservation, up to the
 * limit, and wait in arrival order. A reservation above the limit takes every byte, so a heavy
 * holder runs alone instead of waiting forever — the same rule `weight` uses for slots.
 */
export class MemoryPool {
	readonly #limit: number;
	#available: number;
	readonly #waiting: Waiter[] = [];

	/** @param limit - The most bytes held at once; anything below 1 counts as 1 */
	constructor(limit: number) {
		this.#limit = Math.max(1, Math.floor(limit));
		this.#available = this.#limit;
	}

	/** The budget this pool was created with, in bytes. */
	get limit(): number {
		return this.#limit;
	}

	/**
	 * Resolves once `bytes` are free, to the function that gives them back; call it exactly once.
	 * Zero bytes take nothing and resolve immediately. Holders are served in arrival order.
	 *
	 * @param bytes - Bytes to hold; at least 0
	 */
	async acquire(bytes = 0): Promise<() => void> {
		let needed = Math.min(this.#limit, Math.max(0, Math.floor(bytes)));
		if (needed === 0) return () => {};
		if (this.#waiting.length === 0 && this.#available >= needed) {
			this.#available -= needed;
		} else {
			await new Promise<void>((resolve) => {
				this.#waiting.push({ bytes: needed, wake: resolve });
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

	/** Wakes waiters from the front for as long as the first one's bytes are free. */
	#drain(): void {
		let next = this.#waiting[0];
		while (next !== undefined && this.#available >= next.bytes) {
			this.#waiting.shift();
			this.#available -= next.bytes;
			next.wake();
			next = this.#waiting[0];
		}
	}
}
