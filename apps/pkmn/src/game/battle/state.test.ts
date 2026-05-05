/**
 * Verifies the battle state test module that exercises the factory functions
 * responsible for producing fresh state objects used by the battle domain.
 * The assertions in this file lock down the default shape and neutral values
 * expected when those state containers are initialized.
 *
 * This module focuses on the contract of state creation rather than any
 * specific data set, ensuring the battle layer can rely on predictable initial
 * conditions for combatant, side, and field state across future changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { Stat } from "~/game/data/stat";

import {
	createCombatantVolatileState,
	createFieldEffectState,
	createSideEffectState,
	createStatStageState,
} from "./state";

test("createCombatantVolatileState starts with no active combatant effects", () => {
	let state = createCombatantVolatileState();

	expect(state).toEqual({
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
	});
});

test("createStatStageState starts every mutable stat at neutral", () => {
	let state = createStatStageState();

	expect(state).toEqual({
		[Stat.Attack]: 0,
		[Stat.Defense]: 0,
		[Stat.SpecialAttack]: 0,
		[Stat.SpecialDefense]: 0,
		[Stat.Speed]: 0,
		accuracy: 0,
		evasion: 0,
	});
});

test("createSideEffectState starts with no barriers or hazards", () => {
	let state = createSideEffectState();

	expect(state).toEqual({
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
	});
});

test("createFieldEffectState starts with neutral shared battlefield conditions", () => {
	let state = createFieldEffectState();

	expect(state).toEqual({
		weather: null,
		weatherTurns: 0,
		terrain: null,
		terrainTurns: 0,
		trickRoomTurns: 0,
		gravityTurns: 0,
		wonderRoomTurns: 0,
		magicRoomTurns: 0,
	});
});
