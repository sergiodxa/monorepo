/**
 * A queue whose messages live in an array, for tests and for anything running jobs without a
 * platform behind it. It serializes what it holds, counts its own attempts, and keeps its own
 * dead-letter list, so it answers as a remote backend would rather than standing in for one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { success } from "@sdxc/result";

import type { ClaimOptions, JobDelivery, JobMessage, JobQueue, Settlement } from "../queue.js";

import { envelope } from "../jobs.js";

/** How long a claim holds a delivery when a caller names no lease. */
const DEFAULT_LEASE = "30 seconds";

/** What the array holds: the written body, and the state that decides who sees it next. */
interface Entry {
	id: string;
	text: string;
	attempts: number;
	/** When it becomes claimable, which a delay moves forward. */
	readyAt: number;
	/** When the current claim expires, or `undefined` when nothing holds it. */
	leasedUntil: number | undefined;
}

/** How a memory queue tells the time. */
export interface MemoryQueueOptions {
	/**
	 * Reads the current time in milliseconds. A test supplies its own so a delay can pass
	 * without waiting for it.
	 *
	 * @default Date.now
	 */
	now?: () => number;
}

/** A memory queue, plus what a test needs to drive and read it. */
export interface MemoryQueue extends JobQueue {
	/**
	 * Runs everything claimable through `deliver` and answers with what each ended as, in the
	 * order they were claimed. The one-shot a test wants where a worker loop would poll.
	 */
	drain(deliver: (delivery: JobDelivery) => Promise<Settlement>): Promise<Settlement[]>;
	/** Every body still on the queue, parsed, in the order they were enqueued. */
	readonly messages: unknown[];
	/** Every body that ran out of attempts or was dead-lettered, parsed. */
	readonly deadLettered: unknown[];
	/** Empties the queue and its dead-letter list. */
	reset(): void;
}

/**
 * Holds messages in an array for the life of the instance.
 *
 * Retries are this package's to count here, so a dispatcher's `maxAttempts` decides when a
 * delivery is dead-lettered instead of redelivered.
 *
 * @param options How it tells the time.
 * @example createJobDispatcher({ queue: memory.queue() });
 */
export function queue(options: MemoryQueueOptions = {}): MemoryQueue {
	let clock = options.now ?? Date.now;
	let pending: Entry[] = [];
	let dead: string[] = [];
	let sequence = 0;

	/** The delivery one entry is handed over as, with the body parsed back. */
	function deliveryOf(entry: Entry): JobDelivery {
		return {
			id: entry.id,
			attempts: entry.attempts,
			body: JSON.parse(entry.text) as unknown,
		};
	}

	/** Drops one entry from the queue, whatever its state. */
	function remove(id: string): Entry | undefined {
		let index = pending.findIndex((entry) => entry.id === id);
		if (index === -1) return undefined;
		return pending.splice(index, 1)[0];
	}

	return {
		retries: "core",

		send(messages: JobMessage[]): Promise<Result<void, never>> {
			let at = clock();

			for (let message of messages) {
				sequence += 1;
				pending.push({
					id: `memory-${sequence}`,
					text: JSON.stringify(envelope(message.job, message.body)),
					attempts: 0,
					readyAt: at + (message.delay === undefined ? 0 : toMs(message.delay)),
					leasedUntil: undefined,
				});
			}

			return Promise.resolve(success(undefined));
		},

		claim({ limit, lease }: ClaimOptions): Promise<Result<JobDelivery[], never>> {
			let at = clock();
			let held = toMs(lease);
			let claimed: JobDelivery[] = [];

			for (let entry of pending) {
				if (claimed.length === limit) break;
				if (entry.readyAt > at) continue;
				if (entry.leasedUntil !== undefined && entry.leasedUntil > at) continue;

				entry.attempts += 1;
				entry.leasedUntil = at + held;
				claimed.push(deliveryOf(entry));
			}

			return Promise.resolve(success(claimed));
		},

		settle(delivery: JobDelivery, settlement: Settlement): Promise<Result<void, never>> {
			if (settlement.type === "ack") {
				remove(delivery.id);
				return Promise.resolve(success(undefined));
			}

			if (settlement.type === "dead-letter") {
				let entry = remove(delivery.id);
				if (entry !== undefined) dead.push(entry.text);
				return Promise.resolve(success(undefined));
			}

			let entry = pending.find((held) => held.id === delivery.id);

			if (entry !== undefined) {
				entry.leasedUntil = undefined;
				entry.readyAt = clock() + delayOf(settlement.delay);
			}

			return Promise.resolve(success(undefined));
		},

		async drain(deliver): Promise<Settlement[]> {
			let settlements: Settlement[] = [];
			let at = clock();

			/** Claimed up front, so a retry landing back on the queue is not run again here. */
			let claimable = pending.filter((entry) => entry.readyAt <= at);

			for (let entry of claimable) {
				entry.attempts += 1;
				let settlement = await deliver(deliveryOf(entry));
				settlements.push(settlement);
				await this.settle?.(deliveryOf(entry), settlement);
			}

			return settlements;
		},

		get messages() {
			return pending.map((entry) => JSON.parse(entry.text) as unknown);
		},

		get deadLettered() {
			return dead.map((text) => JSON.parse(text) as unknown);
		},

		reset() {
			pending = [];
			dead = [];
			sequence = 0;
		},
	};
}

/** How long a retry holds a delivery back, defaulting to the lease a claim would have taken. */
function delayOf(delay: DurationInput | undefined): number {
	return toMs(delay ?? DEFAULT_LEASE);
}
