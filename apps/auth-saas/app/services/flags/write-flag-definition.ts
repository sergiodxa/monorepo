/**
 * The write path a release flag or kill switch definition goes through: a
 * schema check against exactly what the engine would refuse, a version guard
 * so two edits in flight resolve as a conflict rather than a silent overwrite,
 * and a `flag_change` row appended once the write lands. Nothing here is
 * mounted on a route yet — a staff-authenticated one calls it once platform
 * staff have a way to sign in at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EvaluationContext, FlagValue, MaybePromise, ResolutionDetails } from "@sdxc/flags";
import type { FlagStore, FlagStoreError, StoredFlagSet } from "@sdxc/flags-engine/store";
import type { Result } from "@sdxc/result";
import type { Issue } from "remix/data-schema";
import type { Database } from "remix/data-table";

import { evaluateAll, FLAG_DEFINITION_SCHEMA, parseFlagSet } from "@sdxc/flags-engine";
import { isFailure } from "@sdxc/result";
import { generateUUIDv7 } from "@sdxc/uuid";
import * as s from "remix/data-schema";

import FlagChange from "~/app/models/flag-change";

/** A store an admin write can commit to, on top of the read every store already answers. */
export interface WritableFlagStore extends FlagStore {
	/**
	 * Replaces the whole definition set.
	 *
	 * @param set - The definitions every later read answers with.
	 */
	write(set: StoredFlagSet): MaybePromise<Result<void, FlagStoreError>>;
}

/** What writing one flag definition needs. */
export interface WriteFlagDefinitionInput {
	/** The `release.*` or `kill.*` key the draft is written under. */
	key: string;
	/** The definition as an editor submitted it, checked against the engine's own schema. */
	draft: unknown;
	/** The `version` the caller read the set at, so a write racing another one is refused. */
	expectedVersion: string | undefined;
	/** Who made the change, recorded on the `flag_change` row. */
	actor: string;
}

export type WriteFlagDefinitionResult =
	| { ok: true; version: string }
	| { ok: false; reason: "invalid_definition"; issues: readonly Issue[] }
	| { ok: false; reason: "stale_version"; currentVersion: string | undefined }
	| { ok: false; reason: "store_error"; error: FlagStoreError };

/**
 * Writes one flag definition: checks the draft with `FLAG_DEFINITION_SCHEMA`,
 * declines a write whose `expectedVersion` has moved since the caller read
 * it, and otherwise merges the accepted definition into the store's set under
 * a freshly minted revision — recording the change once the write lands.
 *
 * @param store - The definition set to read from and write back to.
 * @param db - Database connection the `flag_change` row is appended through.
 * @param input - The key, the draft, the version the caller read, and who is writing.
 * @returns The new revision on success, or which check declined the write.
 */
export async function writeFlagDefinition(
	store: WritableFlagStore,
	db: Database,
	input: WriteFlagDefinitionInput,
): Promise<WriteFlagDefinitionResult> {
	let checked = s.parseSafe(FLAG_DEFINITION_SCHEMA, input.draft);
	if (!checked.success) return { ok: false, reason: "invalid_definition", issues: checked.issues };

	let read = await store.read();
	if (isFailure(read)) return { ok: false, reason: "store_error", error: read.error };

	let stored = read.data;
	if (stored.version !== input.expectedVersion) {
		return { ok: false, reason: "stale_version", currentVersion: stored.version };
	}

	let before = stored.flags[input.key];
	let version = generateUUIDv7();

	let written = await store.write({
		...stored,
		flags: { ...stored.flags, [input.key]: checked.value },
		version,
	});
	if (isFailure(written)) return { ok: false, reason: "store_error", error: written.error };

	await FlagChange.record(db, {
		key: input.key,
		before: before === undefined ? null : JSON.stringify(before),
		after: JSON.stringify(checked.value),
		actor: input.actor,
	});

	return { ok: true, version };
}

/**
 * Answers "who would this draft serve" without touching the store: parses
 * the edited set exactly as the engine would and resolves every flag it
 * carries against a context typed into a form, so a rollout is checked
 * before it ever reaches KV.
 *
 * @param draft - The definition set as an editor is currently drafting it.
 * @param context - The tenant context to preview the draft against.
 * @returns Every flag the draft carries, resolved for that context.
 */
export function previewFlagDefinition(
	draft: StoredFlagSet,
	context: EvaluationContext,
): Record<string, ResolutionDetails<FlagValue>> {
	return evaluateAll(parseFlagSet(draft), context);
}
