/**
 * An in-process `SetStore` for tests and single-isolate development. Pending SETs live in
 * insertion-ordered maps, so a poll returns the oldest first, and everything vanishes with
 * the isolate; production keeps SETs in durable storage behind the same interface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { success } from "@sdxc/result";

import type { SecurityEvents } from "../../security-events.js";

/**
 * Keeps each stream's pending SETs in a `Map`, and the errors recipients reported in
 * another, readable through `errors` so an issuer can see which SETs were refused.
 *
 * @example
 * let store = new MemorySetStore();
 * await store.add("rp-1", set.id, await set.sign(JWK.Algorithm.ES256, keys));
 */
export class MemorySetStore implements SecurityEvents.SetStore {
	#pending = new Map<string, Map<string, string>>();
	#errors = new Map<string, Map<string, SecurityEvents.ErrorBody>>();

	/**
	 * Queues a SET, keeping its place when the `jti` is already pending.
	 *
	 * @param stream - The recipient's stream
	 * @param id - The SET's `jti`
	 * @param set - The signed SET
	 */
	async add(stream: string, id: string, set: string): Promise<Result<void, Error>> {
		let pending = this.#pending.get(stream) ?? new Map<string, string>();
		pending.set(id, set);
		this.#pending.set(stream, pending);
		return success(undefined);
	}

	/**
	 * The oldest pending SETs.
	 *
	 * @param stream - The recipient's stream
	 * @param limit - The most SETs to return; all of them when omitted
	 */
	async pending(stream: string, limit?: number): Promise<Result<SecurityEvents.Batch, Error>> {
		let entries = [...(this.#pending.get(stream) ?? new Map<string, string>())];
		let returned = limit === undefined ? entries : entries.slice(0, limit);
		return success({
			sets: Object.fromEntries(returned),
			moreAvailable: returned.length < entries.length,
		});
	}

	/**
	 * Forgets SETs the recipient received.
	 *
	 * @param stream - The recipient's stream
	 * @param ids - The acknowledged `jti` values
	 */
	async acknowledge(stream: string, ids: string[]): Promise<Result<void, Error>> {
		let pending = this.#pending.get(stream);
		for (let id of ids) pending?.delete(id);
		return success(undefined);
	}

	/**
	 * Forgets SETs the recipient found invalid and records why.
	 *
	 * @param stream - The recipient's stream
	 * @param errors - Each refused SET's error, by `jti`
	 */
	async reject(
		stream: string,
		errors: Record<string, SecurityEvents.ErrorBody>,
	): Promise<Result<void, Error>> {
		let pending = this.#pending.get(stream);
		let recorded = this.#errors.get(stream) ?? new Map<string, SecurityEvents.ErrorBody>();
		for (let [id, error] of Object.entries(errors)) {
			pending?.delete(id);
			recorded.set(id, error);
		}
		this.#errors.set(stream, recorded);
		return success(undefined);
	}

	/**
	 * The errors a recipient reported for the stream's SETs.
	 *
	 * @param stream - The recipient's stream
	 * @returns Each refused SET's error, by `jti`
	 */
	errors(stream: string): Record<string, SecurityEvents.ErrorBody> {
		return Object.fromEntries(this.#errors.get(stream) ?? []);
	}
}
