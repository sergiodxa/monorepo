/**
 * A store over a Cloudflare KV namespace, holding the whole definition set as one
 * JSON value under one key. Filling a snapshot is a single `get` served from the
 * edge cache, and an admin write rewrites the value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { FlagStore, StoredFlagSet } from "./index.js";

import { FlagStoreError } from "./index.js";

/** The key the set lives under when the caller names none. */
const DEFAULT_KEY = "flags";

/** Where a Worker KV store keeps its set. */
export interface WorkerKVFlagStoreOptions {
	/**
	 * The key the whole set is stored under. An application holding more than one set
	 * gives each of them its own.
	 *
	 * @default "flags"
	 */
	key?: string;
}

/** Whether the value is a JSON object, which is what both a set and its flags are. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether a parsed value is a set, which it is when it carries flags as an object.
 * That is as far as a store looks: what a definition has to be is the engine's
 * question, answered in one place against one schema.
 *
 * @param value What the stored JSON parsed to.
 */
function isFlagSet(value: unknown): value is StoredFlagSet {
	return isRecord(value) && isRecord(value["flags"]);
}

/**
 * Reads and writes one definition set in a KV namespace.
 *
 * A key holding nothing reads as an empty set, so a namespace an admin has yet to
 * write to is a working store rather than a failure a caller has to special-case.
 */
export class WorkerKVFlagStore implements FlagStore {
	readonly #kv: KVNamespace;

	/** The key the set lives under, for a caller that also manages the namespace. */
	readonly key: string;

	/**
	 * @param kv The namespace the set is stored in.
	 * @param options The key the set lives under.
	 */
	constructor(kv: KVNamespace, { key = DEFAULT_KEY }: WorkerKVFlagStoreOptions = {}) {
		this.#kv = kv;
		this.key = key;
	}

	/**
	 * @returns The stored set, an empty one when the key holds nothing, `invalid_value`
	 * when what it holds is not a JSON object, and `unavailable` when the namespace
	 * refused the read.
	 */
	async read(): Promise<Result<StoredFlagSet, FlagStoreError>> {
		let text: string | null;

		try {
			text = await this.#kv.get(this.key, "text");
		} catch (cause) {
			return failure(this.#refused("read", cause));
		}

		if (text === null) return success({ flags: {} });

		let value: unknown;

		try {
			value = JSON.parse(text);
		} catch (cause) {
			return failure(
				new FlagStoreError(`The value stored at ${this.key} is not JSON.`, {
					code: "invalid_value",
					location: this.key,
					cause,
				}),
			);
		}

		if (!isFlagSet(value)) {
			return failure(
				new FlagStoreError(`The value stored at ${this.key} holds no flags object.`, {
					code: "invalid_value",
					location: this.key,
				}),
			);
		}

		return success(value);
	}

	/**
	 * Replaces the whole set, which is the write a store backed by one value takes.
	 * It lives on the store that has the capability, so an admin path writes through
	 * the same key every reader reads through.
	 *
	 * @param set The definitions every later read answers with.
	 * @returns Nothing on success, `invalid_value` for a set JSON cannot write, and
	 * `unavailable` when the namespace refused the put.
	 */
	async write(set: StoredFlagSet): Promise<Result<void, FlagStoreError>> {
		let text: string;

		try {
			text = JSON.stringify(set);
		} catch (cause) {
			return failure(
				new FlagStoreError(`The set given for ${this.key} cannot be written as JSON.`, {
					code: "invalid_value",
					location: this.key,
					cause,
				}),
			);
		}

		try {
			await this.#kv.put(this.key, text);
		} catch (cause) {
			return failure(this.#refused("write", cause));
		}

		return success(undefined);
	}

	/**
	 * States a namespace failure as the code a caller branches on, carrying what KV
	 * threw so the original reason survives the translation.
	 *
	 * @param operation What was being attempted, which the message names.
	 * @param cause What the namespace threw.
	 */
	#refused(operation: "read" | "write", cause: unknown): FlagStoreError {
		let reason = cause instanceof Error ? cause.message : String(cause);

		return new FlagStoreError(`The namespace could not ${operation} ${this.key}: ${reason}`, {
			code: "unavailable",
			location: this.key,
			cause,
		});
	}
}
