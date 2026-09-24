/**
 * An in-process `IdempotencyStore` for tests and single-isolate development. Each call
 * runs to completion without awaiting, so claims are atomic within one isolate; records
 * vanish with the isolate, which is why production uses the data-table store.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { success } from "@sdxc/result";

import type { IdempotencyStoreError } from "./errors.js";
import type { ClaimOutcome, ClaimRequest, IdempotencyStore, StoredResponse } from "./types.js";

/** One record, shaped like a row of the data-table store. */
interface MemoryRecord {
	fingerprint: string | null;
	lease: string;
	leaseExpiresAt: number;
	expiresAt: number;
	response: StoredResponse | null;
}

/**
 * Keeps records in a `Map`. Expired records are dropped on each claim, so memory stays
 * proportional to the keys still inside their window.
 */
export class MemoryStore implements IdempotencyStore {
	#records = new Map<string, MemoryRecord>();

	/**
	 * Claims the id, or reports the live record that stops it. Answers a copy of any stored
	 * response, so a caller mutating it cannot change a later replay.
	 *
	 * @param request - The id, fingerprint and instants to judge the record by
	 */
	async claim(request: ClaimRequest): Promise<Result<ClaimOutcome, IdempotencyStoreError>> {
		for (let [id, record] of this.#records) {
			if (record.expiresAt <= request.now) this.#records.delete(id);
		}

		let current = this.#records.get(request.id);
		if (current !== undefined) {
			if (current.response !== null) {
				return success({
					status: "completed",
					fingerprint: current.fingerprint,
					response: structuredClone(current.response),
				});
			}
			if (current.leaseExpiresAt > request.now) {
				return success({ status: "in-flight", fingerprint: current.fingerprint });
			}
		}

		let lease = crypto.randomUUID();
		this.#records.set(request.id, {
			fingerprint: request.fingerprint,
			lease,
			leaseExpiresAt: request.now + request.leaseMs,
			expiresAt: request.expiresAt,
			response: null,
		});
		return success({ status: "claimed", lease });
	}

	/**
	 * Stores the outcome while `lease` holds.
	 *
	 * @param id - The record id
	 * @param lease - The lease `claim` handed out
	 * @param response - The outcome to replay
	 * @param expiresAt - Epoch milliseconds until which the outcome is replayed
	 */
	async complete(
		id: string,
		lease: string,
		response: StoredResponse,
		expiresAt: number,
	): Promise<Result<void, IdempotencyStoreError>> {
		let current = this.#records.get(id);
		if (current?.lease === lease) {
			this.#records.set(id, { ...current, response: structuredClone(response), expiresAt });
		}
		return success(undefined);
	}

	/**
	 * Drops the claim while `lease` holds and the record is still in flight.
	 *
	 * @param id - The record id
	 * @param lease - The lease `claim` handed out
	 */
	async release(id: string, lease: string): Promise<Result<void, IdempotencyStoreError>> {
		let current = this.#records.get(id);
		if (current?.lease === lease && current.response === null) this.#records.delete(id);
		return success(undefined);
	}
}
