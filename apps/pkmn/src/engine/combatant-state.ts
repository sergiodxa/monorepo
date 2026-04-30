import type { Creature } from "./creature";

import { createCombatantVolatileState, createStatStageState } from "./battle-state";

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
