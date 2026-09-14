/**
 * A store holding its definitions in an object, for tests and for a set compiled
 * into the worker that reads it. It answers a read synchronously, so a caller
 * whose flags are already in memory pays a function call to load them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { success } from "@sdxc/result";

import type { FlagStore, FlagStoreError, StoredFlagSet } from "./index.js";

/**
 * Holds one definition set for the life of the instance.
 *
 * Every read hands over a copy, so a caller walking a set keeps reading what it
 * read while the store goes on being written to.
 */
export class InMemoryFlagStore implements FlagStore {
	#set: StoredFlagSet;

	/**
	 * @param set The definitions the store starts out holding, empty by default.
	 */
	constructor(set: StoredFlagSet = { flags: {} }) {
		this.#set = set;
	}

	/**
	 * @returns The set being held, always as a success: definitions in memory are
	 * reachable by the code that holds them.
	 */
	read(): Result<StoredFlagSet, FlagStoreError> {
		return success(structuredClone(this.#set));
	}

	/**
	 * Replaces the whole set, which is the write a store backed by one value takes.
	 * It lives on the store that has the capability, so an admin path writes through
	 * the same object every reader reads through.
	 *
	 * @param set The definitions every later read answers with.
	 */
	write(set: StoredFlagSet): void {
		this.#set = set;
	}
}
