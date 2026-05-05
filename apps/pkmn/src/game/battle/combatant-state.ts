/**
 * Battle combatant state bridges a persistent creature record with the temporary
 * state required while that creature participates in combat. This module defines
 * the small state container that keeps battle-scoped data close to the creature
 * it augments without changing the underlying saved entity.
 *
 * The module centralizes the volatile flags and temporary stat stage adjustments
 * that only matter during an active battle. By isolating those concerns here, the
 * rest of the battle engine can depend on a single, well-defined runtime shape
 * for combatant-specific state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Creature } from "~/game/world/creature";

import { createCombatantVolatileState, createStatStageState } from "./state";

/** Volatile battle-only state layered on top of a persistent creature. */
export class CombatantState {
	/** Temporary flags that only exist for the duration of a battle. */
	readonly volatile = createCombatantVolatileState();

	/** Temporary stat stage boosts and drops applied while this combatant stays active. */
	readonly statStages = createStatStageState();

	/**
	 * @param creature - The persistent creature save state used by this combatant
	 */
	constructor(public readonly creature: Creature) {}
}
