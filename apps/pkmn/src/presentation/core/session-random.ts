/**
 * The random streams of one play session: a seeded session stream and one
 * stream derived from it per subsystem, so a bug report carrying the seed
 * replays the session and an extra draw in one subsystem never shifts another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { RandomState, Seed, SeededRandom } from "@sdxc/random";
import type { Schema } from "remix/data-schema";

import { createRandom, restoreRandom, systemSeed } from "@sdxc/random";
import { RANDOM_STATE_SCHEMA } from "@sdxc/random/schema";
import * as s from "remix/data-schema";

/**
 * Every stream a session draws from. It satisfies `Engine.Streams`, so the
 * whole object is what the engine receives.
 */
export interface SessionRandom {
	/** The session seed; `openSessionRandom(seed)` replays the session from it. */
	readonly seed: Seed;
	/** Overworld encounter checks, and the species and level they roll. */
	readonly encounters: SeededRandom;
	/** Event entities wandering the overworld, which draw on a timer. */
	readonly movement: SeededRandom;
	/** Spawned and captured creatures' natures, IVs and genders. */
	readonly creatures: SeededRandom;
	/** Every battle roll, capture shakes included. */
	readonly battle: SeededRandom;
}

/** Where every stream of a session stands, as a save file stores it. */
export interface SessionRandomState {
	seed: Seed;
	encounters: RandomState;
	movement: RandomState;
	creatures: RandomState;
	battle: RandomState;
}

/** Reads a stored `SessionRandomState`, which arrives from an untrusted save file. */
export const SESSION_RANDOM_STATE_SCHEMA: Schema<unknown, SessionRandomState> = s.object({
	seed: s.union([s.string(), s.number()]),
	encounters: RANDOM_STATE_SCHEMA,
	movement: RANDOM_STATE_SCHEMA,
	creatures: RANDOM_STATE_SCHEMA,
	battle: RANDOM_STATE_SCHEMA,
});

/**
 * Opens a session's streams from its seed; the same seed always opens the
 * same streams. A fresh session draws its seed from the system.
 *
 * @param seed - The session seed, a fresh one by default.
 */
export function openSessionRandom(seed: Seed = systemSeed()): SessionRandom {
	let session = createRandom(seed);
	return {
		seed,
		encounters: session.derive("encounters"),
		movement: session.derive("movement"),
		creatures: session.derive("creatures"),
		battle: session.derive("battle"),
	};
}

/** Captures where every stream stands, so a restored session draws what this one would. */
export function snapshotSessionRandom(random: SessionRandom): SessionRandomState {
	return {
		seed: random.seed,
		encounters: random.encounters.state(),
		movement: random.movement.state(),
		creatures: random.creatures.state(),
		battle: random.battle.state(),
	};
}

/** Resumes every stream exactly where `snapshotSessionRandom` captured it. */
export function restoreSessionRandom(state: SessionRandomState): SessionRandom {
	return {
		seed: state.seed,
		encounters: restoreRandom(state.encounters),
		movement: restoreRandom(state.movement),
		creatures: restoreRandom(state.creatures),
		battle: restoreRandom(state.battle),
	};
}

/**
 * Validates a stored session state and resumes its streams, or returns null
 * when the state is malformed, since it arrives from an untrusted save file.
 */
export function readSessionRandom(value: unknown): SessionRandom | null {
	let parsed = s.parseSafe(SESSION_RANDOM_STATE_SCHEMA, value);
	if (!parsed.success) return null;
	return restoreSessionRandom(parsed.value);
}
