import type { Creature } from "./creature";

/** Volatile battle-only state layered on top of a persistent creature. */
export class CombatantState {
	/** Temporary flags that only exist for the duration of a battle. */
	readonly volatile = {
		seeded: false,
		trapped: false,
	};

	/**
	 * @param creature - The persistent creature save state used by this combatant
	 */
	constructor(public readonly creature: Creature) {}
}
