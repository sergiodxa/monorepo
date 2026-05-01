import type { BattleStatStage } from "../domain/move";

import { Class } from "../domain/move";
import { Stat } from "../domain/stat";

/** Records the last move-based damage a combatant took during the current turn. */
export interface DamageHistoryState {
	amount: number;
	source: { side: number; slot: number };
	moveClass: Class;
}

/** Battle-only effects that apply to one active combatant and clear on switch. */
export interface CombatantVolatileState {
	seeded: boolean;
	trapped: boolean;
	seededBy: number | null;
	confusionTurns: number;
	invulnerable: boolean;
	flinched: boolean;
	protecting: boolean;
	enduring: boolean;
	destinyBonded: boolean;
	chargedElectric: boolean;
	focusEnergy: boolean;
	aquaRing: boolean;
	cursed: boolean;
	partiallyTrappedTurns: number;
	partialTrapSourceSide: number | null;
	charging: boolean;
	chargingMoveId: string | null;
	recharging: boolean;
	actedThisBattle: boolean;
	identified: boolean;
	attracted: boolean;
	tauntedTurns: number;
	encoreTurns: number;
	encoredMoveSlot: 0 | 1 | 2 | 3 | null;
	rampageTurns: number;
	rampageMoveSlot: 0 | 1 | 2 | 3 | null;
	disabledMoveSlot: 0 | 1 | 2 | 3 | null;
	disableTurns: number;
	lastMoveSlot: 0 | 1 | 2 | 3 | null;
	lastDamageThisTurn: DamageHistoryState | null;
}

/** Temporary stat stage changes applied during battle. */
export type StatStageState = Record<BattleStatStage, number>;

/** Side-wide battle effects shared by one side. */
export interface SideEffectState {
	reflectTurns: number;
	lightScreenTurns: number;
	safeguardTurns: number;
	mistTurns: number;
	tailwindTurns: number;
	luckyChantTurns: number;
	spikesLayers: number;
	toxicSpikesLayers: number;
	stealthRock: boolean;
	stickyWeb: boolean;
}

/** Whole-field battle effects shared by both sides. */
export interface FieldEffectState {
	weather: null | "sun" | "rain" | "sand" | "hail" | "snow" | "fog";
	weatherTurns: number;
	terrain: null | "electric" | "grassy" | "misty" | "psychic";
	terrainTurns: number;
	trickRoomTurns: number;
	gravityTurns: number;
	wonderRoomTurns: number;
	magicRoomTurns: number;
}

/** Returns a fresh combatant volatile state with no active temporary effects. */
export function createCombatantVolatileState(): CombatantVolatileState {
	return {
		seeded: false,
		trapped: false,
		seededBy: null,
		confusionTurns: 0,
		invulnerable: false,
		flinched: false,
		protecting: false,
		enduring: false,
		destinyBonded: false,
		chargedElectric: false,
		focusEnergy: false,
		aquaRing: false,
		cursed: false,
		partiallyTrappedTurns: 0,
		partialTrapSourceSide: null,
		charging: false,
		chargingMoveId: null,
		recharging: false,
		actedThisBattle: false,
		identified: false,
		attracted: false,
		tauntedTurns: 0,
		encoreTurns: 0,
		encoredMoveSlot: null,
		rampageTurns: 0,
		rampageMoveSlot: null,
		disabledMoveSlot: null,
		disableTurns: 0,
		lastMoveSlot: null,
		lastDamageThisTurn: null,
	};
}

/** Returns a fresh stat stage table with all stages neutral. */
export function createStatStageState(): StatStageState {
	return {
		[Stat.Attack]: 0,
		[Stat.Defense]: 0,
		[Stat.SpecialAttack]: 0,
		[Stat.SpecialDefense]: 0,
		[Stat.Speed]: 0,
		accuracy: 0,
		evasion: 0,
	};
}

/** Returns a fresh side effect state with no active protections or hazards. */
export function createSideEffectState(): SideEffectState {
	return {
		reflectTurns: 0,
		lightScreenTurns: 0,
		safeguardTurns: 0,
		mistTurns: 0,
		tailwindTurns: 0,
		luckyChantTurns: 0,
		spikesLayers: 0,
		toxicSpikesLayers: 0,
		stealthRock: false,
		stickyWeb: false,
	};
}

/** Returns a fresh field effect state with neutral weather, terrain, and rooms. */
export function createFieldEffectState(): FieldEffectState {
	return {
		weather: null,
		weatherTurns: 0,
		terrain: null,
		terrainTurns: 0,
		trickRoomTurns: 0,
		gravityTurns: 0,
		wonderRoomTurns: 0,
		magicRoomTurns: 0,
	};
}
