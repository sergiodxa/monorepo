import type { Creature } from "./creature";

/** Volatile battle-only state that should not be serialized with the creature. */
export interface CombatantState {
	/** The underlying persistent creature save state. */
	creature: Creature;
	/** Temporary flags that only exist for the duration of a battle. */
	volatile: {
		seeded: boolean;
	};
}

/** Creates the initial battle-only state for a combatant. */
export function createCombatantState(creature: Creature): CombatantState {
	return {
		creature,
		volatile: {
			seeded: false,
		},
	};
}
