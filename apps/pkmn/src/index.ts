/**
 * Boots the pkmn browser entrypoint by composing the static content registries,
 * creating the initial world state, starting the demo battle flow, and mounting
 * the UI into the `#app` root element.
 *
 * This module is the application boundary between the document environment and
 * the game runtime. It wires together engine creation, world migration, seeded
 * entity identifiers, and the first dispatched events so the rest of the app
 * can render from a fully initialized runtime state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { ITEMS } from "~/content/items";
import { TYPE_MATCHUPS } from "~/content/matchups";
import { MOVES } from "~/content/moves";
import { NATURES } from "~/content/natures";
import { SPECIES } from "~/content/species";
import { Engine } from "~/game/engine";
import { createBattleId, createCreatureId, createPlayerId } from "~/game/world/ids";
import { migrateWorld } from "~/game/world/migrate";
import { mountUI } from "~/ui";

let playerId = createPlayerId("hero");
let rivalId = createPlayerId("rival");
let starterId = createCreatureId("starter-1");
let reserveId = createCreatureId("reserve-1");
let rivalCreatureId = createCreatureId("rival-1");

let engine = Engine.create({
	content: {
		species: SPECIES,
		moves: MOVES,
		items: ITEMS,
		natures: NATURES,
		typeChart: TYPE_MATCHUPS,
	},
	world: migrateWorld({
		entities: [playerId, rivalId, starterId, reserveId, rivalCreatureId],
		playerId,
		playerProfile: {
			[playerId]: { name: "Hero" },
			[rivalId]: { name: "Rival" },
		},
		party: {
			[playerId]: { creatureIds: [starterId] },
			[rivalId]: { creatureIds: [rivalCreatureId] },
		},
		inventory: {
			[playerId]: { items: { POTION: 2, POKEBALL: 3 } },
			[rivalId]: { items: {} },
		},
		bestiary: {
			[playerId]: { seen: [], caught: [] },
			[rivalId]: { seen: [], caught: [] },
		},
		storageBoxes: {
			[playerId]: { boxes: [{ id: "box-1", name: "Box 1", creatureIds: [reserveId] }] },
			[rivalId]: { boxes: [] },
		},
		creature: {
			[starterId]: createBootstrapCreature("BULBASAUR"),
			[reserveId]: createBootstrapCreature("CHARMANDER"),
			[rivalCreatureId]: createBootstrapCreature("SQUIRTLE"),
		},
	}),
});

let startupEvents = engine.dispatch({
	type: "start-battle",
	battleId: createBattleId("demo"),
	playerId,
	enemyId: rivalId,
	playerParty: [starterId],
	enemyParty: [rivalCreatureId],
	slots: 1,
});

let root = document.getElementById("app");
if (root === null) throw new ReferenceError("Missing #app root element.");
mountUI(root, engine, startupEvents);

/** Creates one small bootstrap creature payload for migration into ECS components. */
function createBootstrapCreature(species: "BULBASAUR" | "CHARMANDER" | "SQUIRTLE") {
	return {
		species,
		nature: "HARDY",
		experience: 0,
		moveset: ["TACKLE", null, null, null] as ["TACKLE", null, null, null],
		status: {
			state: null,
			damage: 0,
			pp: [35, 0, 0, 0] as [number, number, number, number],
		},
		iv: {
			hp: 31,
			attack: 31,
			defense: 31,
			"special-attack": 31,
			"special-defense": 31,
			speed: 31,
		},
		ev: {
			hp: 0,
			attack: 0,
			defense: 0,
			"special-attack": 0,
			"special-defense": 0,
			speed: 0,
		},
	};
}
