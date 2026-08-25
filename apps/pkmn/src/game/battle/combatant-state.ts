/**
 * Bridges a persistent creature record with the temporary state a creature
 * needs while it participates in combat, keeping battle-scoped data close to
 * the creature it augments while the underlying saved entity stays intact. It
 * centralizes volatile flags and stat stage adjustments so the rest of the
 * battle engine depends on a single, well-defined runtime shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Creature } from "~/game/world/creature";

import {
	createCombatantMajorStatusState,
	createCombatantVolatileState,
	createStatStageState,
} from "./state";

/** Volatile battle-only state layered on top of a persistent creature. */
export class CombatantState {
	/** Temporary flags that only exist for the duration of a battle. */
	readonly volatile = createCombatantVolatileState();

	/** Runtime counters for persistent statuses that need battle-local bookkeeping. */
	readonly majorStatus = createCombatantMajorStatusState();

	/** Temporary stat stage boosts and drops applied while this combatant stays active. */
	readonly statStages = createStatStageState();

	/**
	 * @param creature - The persistent creature save state used by this combatant
	 */
	constructor(public readonly creature: Creature) {}
}
