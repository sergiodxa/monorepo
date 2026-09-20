/**
 * The sweep that finds a rollout nobody has finished: a `release.*` flag
 * declares an owner and an expiry date in its `metadata`, and a rollout that
 * outlives that date is a branch nobody reads kept alive by a value in KV.
 * Nothing here sends the report anywhere yet — the internal-ops notification
 * channel this would ride on does not exist in this codebase, and wiring the
 * sweep itself onto a schedule belongs beside every other cron job this
 * platform still owes rather than inside the function that answers "which
 * flags are overdue."
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FlagStore, FlagStoreError } from "@sdxc/flags-engine/store";
import type { Result } from "@sdxc/result";

import { parseFlagSet } from "@sdxc/flags-engine";
import { isFailure, success } from "@sdxc/result";

/** The prefix every flag this report considers is written under. */
const RELEASE_PREFIX = "release.";

/** One rollout whose declared expiry has already passed. */
export interface OverdueReleaseFlag {
	key: string;
	owner: string;
	expiresAt: string;
}

/**
 * Reads the metadata a `release.*` definition declares, answering `undefined`
 * for one missing an owner or an expiry — a definition without both never
 * counts as overdue, since there is nothing to report it against.
 */
function ownedExpiry(metadata: Readonly<Record<string, unknown>> | undefined):
	| {
			owner: string;
			expiresAt: string;
	  }
	| undefined {
	let owner = metadata?.["owner"];
	let expiresAt = metadata?.["expiresAt"];

	if (typeof owner !== "string" || typeof expiresAt !== "string") return undefined;

	return { owner, expiresAt };
}

/**
 * Finds every `release.*` definition whose declared `expiresAt` has passed.
 * `kill.*` flags carry no expiry and never appear here, whatever their
 * `metadata` holds — a withdrawal has none to outlive.
 *
 * @param store - The definition set to read.
 * @param now - The time to compare `expiresAt` against, defaulting to the
 * current time; a sweep passes its own so a run stays reproducible.
 * @returns Every overdue rollout, owner and key included, or the reason the
 * store could not be read.
 */
export async function findOverdueReleaseFlags(
	store: FlagStore,
	now: number = Date.now(),
): Promise<Result<readonly OverdueReleaseFlag[], FlagStoreError>> {
	let read = await store.read();
	if (isFailure(read)) return read;

	let snapshot = parseFlagSet(read.data);
	let overdue: OverdueReleaseFlag[] = [];

	for (let [key, flag] of snapshot.flags) {
		if (!key.startsWith(RELEASE_PREFIX)) continue;

		let declared = ownedExpiry(flag.metadata);
		if (declared === undefined) continue;

		if (Date.parse(declared.expiresAt) <= now) overdue.push({ key, ...declared });
	}

	return success(overdue);
}
