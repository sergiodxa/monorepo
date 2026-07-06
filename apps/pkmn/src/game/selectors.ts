/**
 * Selector boundary for the game engine read side. This module defines the selector descriptors and view model shapes that presentation code can request from the current world state.
 *
 * It also provides the functions that resolve those requests by combining authored game data with runtime components into UI-oriented selections, without exposing the underlying storage details.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BattleEvent } from "./battle/battle";
import type { GameData } from "./data/game-data";
import type { BattleId, CreatureId, PlayerId } from "./world/ids";
import type { World } from "./world/world";

import { getCreatureCurrentHP, getCreatureLevel, getCreatureStat } from "./battle/mechanics";
import { Stat } from "./data/stat";
import { getBattleLog } from "./world/battle";
import {
	createCreatureFromWorld,
	getCreatureComponentSet,
	getPlayerBestiary,
	getPlayerInventory,
	getPlayerMoney,
	getPlayerParty,
	getPlayerProfile,
	getPlayerStorageBoxes,
} from "./world/world";

/** Selector descriptors accepted by `Engine.select`. */
export type Selector =
	| BattleSelector
	| BestiarySelector
	| CreatureSummarySelector
	| InventorySelector
	| PartySelector
	| PlayerSelector
	| StorageSelector
	| ActiveBattleSelector;

/** Selects the player summary view. */
export interface PlayerSelector {
	type: "player";
	playerId?: PlayerId;
}

/** Selects the party summary view. */
export interface PartySelector {
	type: "party";
	playerId?: PlayerId;
}

/** Selects the inventory summary view. */
export interface InventorySelector {
	type: "inventory";
	playerId?: PlayerId;
}

/** Selects the bestiary summary view. */
export interface BestiarySelector {
	type: "bestiary";
	playerId?: PlayerId;
}

/** Selects the storage summary view. */
export interface StorageSelector {
	type: "storage";
	playerId?: PlayerId;
}

/** Selects one creature summary view. */
export interface CreatureSummarySelector {
	type: "creature-summary";
	creatureId: CreatureId;
}

/** Selects the battle view for the current player's active battle. */
export interface ActiveBattleSelector {
	type: "active-battle";
	playerId?: PlayerId;
}

/** Selects the battle view for one battle id. */
export interface BattleSelector {
	type: "battle";
	battleId: BattleId;
}

/** Read model returned when the UI asks for one creature summary. */
export interface CreatureSummaryView {
	id: CreatureId;
	name: string;
	speciesId: string;
	level: number;
	maxHP: number;
	currentHP: number;
	status: string | null;
	moves: Array<{ id: string | null; pp: number }>;
	location: string;
	ownerId?: PlayerId;
}

/** Read model returned when the UI asks for the player summary. */
export interface PlayerView {
	id: PlayerId;
	name: string;
	money: number;
	party: PartyView;
	inventory: InventoryView;
	bestiary: BestiaryView;
	storage: StorageView;
	activeBattleId: BattleId | null;
}

/** Read model returned when the UI asks for the current party. */
export interface PartyView {
	playerId: PlayerId;
	creatures: CreatureSummaryView[];
}

/** Read model returned when the UI asks for grouped inventory entries. */
export interface InventoryView {
	playerId: PlayerId;
	entries: Array<{ id: string; name: string; category: string; count: number }>;
}

/** Read model returned when the UI asks for bestiary progress. */
export interface BestiaryView {
	playerId: PlayerId;
	entries: Array<{ speciesId: string; name: string; seen: boolean; caught: boolean }>;
}

/** Read model returned when the UI asks for storage contents. */
export interface StorageView {
	playerId: PlayerId;
	boxes: Array<{ id: string; name: string; creatures: CreatureSummaryView[] }>;
}

/** Read model returned when the UI asks for one battle. */
export interface BattleView {
	id: BattleId;
	turn: number;
	phase: string;
	winnerSide: number | null;
	pendingRequest: null | { type: "turn" | "replacement"; count: number };
	allies: CreatureSummaryView[];
	enemies: CreatureSummaryView[];
	events: BattleEvent[];
}

/** Any UI-oriented read model returned by the selector layer. */
export type Selection =
	| BattleView
	| BestiaryView
	| CreatureSummaryView
	| InventoryView
	| PartyView
	| PlayerView
	| StorageView
	| null;

/**
 * Builds one UI-oriented selection from the current engine world state.
 *
 * This dispatcher is the selector boundary for presentation code: callers ask for the shape they need and
 * receive a derived read model instead of assembling component data themselves.
 */
export function selectView(gameData: GameData, world: World, selector: Selector): Selection {
	switch (selector.type) {
		case "active-battle": {
			let playerId = selector.playerId ?? world.playerId;
			let battleId = world.activeBattle[playerId]?.battleId ?? null;
			if (battleId === null) return null;
			return selectBattleView(gameData, world, battleId);
		}
		case "battle": {
			return selectBattleView(gameData, world, selector.battleId);
		}
		case "bestiary": {
			return selectBestiaryView(gameData, world, selector.playerId ?? world.playerId);
		}
		case "creature-summary": {
			return selectCreatureSummaryView(gameData, world, selector.creatureId);
		}
		case "inventory": {
			return selectInventoryView(gameData, world, selector.playerId ?? world.playerId);
		}
		case "party": {
			return selectPartyView(gameData, world, selector.playerId ?? world.playerId);
		}
		case "player": {
			return selectPlayerView(gameData, world, selector.playerId ?? world.playerId);
		}
		case "storage": {
			return selectStorageView(gameData, world, selector.playerId ?? world.playerId);
		}
	}
}

/** Builds one creature summary by combining authored content with runtime components. */
export function selectCreatureSummaryView(
	gameData: GameData,
	world: World,
	creatureId: CreatureId,
): CreatureSummaryView {
	let creature = createCreatureFromWorld(world, creatureId);
	let components = getCreatureComponentSet(world, creatureId);
	let species = gameData.species.get(components.identity.speciesId);
	if (!species) throw new ReferenceError(`Missing species ${components.identity.speciesId}.`);

	return {
		id: creatureId,
		name: components.identity.nickname ?? components.identity.speciesId,
		speciesId: components.identity.speciesId,
		level: getCreatureLevel(gameData, creature),
		maxHP: getCreatureStat(gameData, creature, Stat.HP),
		currentHP: getCreatureCurrentHP(gameData, creature),
		status: components.status.state === null ? null : String(components.status.state),
		moves: components.moves.moveset.map((moveId, index) => ({
			id: moveId,
			pp: components.moves.pp[index]!,
		})),
		location: describeLocation(components.location),
		ownerId: components.ownership?.ownerId,
	};
}

/** Builds the player summary view from component selectors only. */
export function selectPlayerView(gameData: GameData, world: World, playerId: PlayerId): PlayerView {
	return {
		id: playerId,
		name: getPlayerProfile(world).name,
		money: getPlayerMoney(world, playerId),
		party: selectPartyView(gameData, world, playerId),
		inventory: selectInventoryView(gameData, world, playerId),
		bestiary: selectBestiaryView(gameData, world, playerId),
		storage: selectStorageView(gameData, world, playerId),
		activeBattleId: world.activeBattle[playerId]?.battleId ?? null,
	};
}

/** Builds the party summary view from creature ids and component stores. */
export function selectPartyView(gameData: GameData, world: World, playerId: PlayerId): PartyView {
	let party = getPlayerParty(world);
	return {
		playerId,
		creatures: party.creatureIds.map((creatureId) =>
			selectCreatureSummaryView(gameData, world, creatureId),
		),
	};
}

/** Builds grouped inventory entries enriched with authored item metadata. */
export function selectInventoryView(
	gameData: GameData,
	world: World,
	playerId: PlayerId,
): InventoryView {
	let inventory = getPlayerInventory(world);
	let entries = Object.entries(inventory.items)
		.filter(([, count]) => typeof count === "number" && count > 0)
		.map(([itemId, count]) => {
			let item = gameData.items.get(itemId);
			if (!item) throw new ReferenceError(`Missing item ${itemId}.`);

			return {
				id: itemId,
				name: itemId,
				category: String(item.category),
				count: count!,
			};
		});

	return { playerId, entries };
}

/** Builds bestiary progress entries by combining progress with species content. */
export function selectBestiaryView(
	gameData: GameData,
	world: World,
	playerId: PlayerId,
): BestiaryView {
	let bestiary = getPlayerBestiary(world);
	let speciesIds = Array.from(new Set([...bestiary.seen, ...bestiary.caught]));

	return {
		playerId,
		entries: speciesIds.map((speciesId) => {
			let species = gameData.species.get(speciesId);
			if (!species) throw new ReferenceError(`Missing species ${speciesId}.`);

			return {
				speciesId,
				name: speciesId,
				seen: bestiary.seen.includes(speciesId),
				caught: bestiary.caught.includes(speciesId),
			};
		}),
	};
}

/** Builds storage boxes by enriching stored creature ids into summary views. */
export function selectStorageView(
	gameData: GameData,
	world: World,
	playerId: PlayerId,
): StorageView {
	let storage = getPlayerStorageBoxes(world);
	return {
		playerId,
		boxes: storage.boxes.map((box) => ({
			id: box.id,
			name: box.name,
			creatures: box.creatureIds.map((creatureId) =>
				selectCreatureSummaryView(gameData, world, creatureId),
			),
		})),
	};
}

/** Builds the battle view entirely from engine-owned component mirrors. */
export function selectBattleView(gameData: GameData, world: World, battleId: BattleId): BattleView {
	let phase = world.battlePhase[battleId];
	let participants = world.battleParticipants[battleId];
	if (!phase || !participants) throw new ReferenceError(`Missing battle ${battleId}.`);

	let pendingRequest = world.battlePendingTurn[battleId]
		? { type: "turn" as const, count: world.battlePendingTurn[battleId]!.requests.length }
		: world.battlePendingReplacement[battleId]
			? {
					type: "replacement" as const,
					count: world.battlePendingReplacement[battleId]!.requests.length,
				}
			: null;

	return {
		id: battleId,
		turn: phase.turn,
		phase: phase.phase,
		winnerSide: phase.winnerSide,
		pendingRequest,
		allies: participants.playerParty.map((creatureId) =>
			selectBattleCreatureSummaryView(gameData, world, battleId, creatureId),
		),
		enemies: participants.enemyParty.map((creatureId) =>
			selectBattleCreatureSummaryView(gameData, world, battleId, creatureId),
		),
		events: getBattleLog(world, battleId).events,
	};
}

/**
 * Builds one battle-aware creature summary that prefers transient battle mirrors.
 *
 * Outside battle the persistent creature components are authoritative. During battle, transient damage and
 * status mirrors must win so the UI reflects the live turn state instead of the last saved snapshot.
 */
function selectBattleCreatureSummaryView(
	gameData: GameData,
	world: World,
	battleId: BattleId,
	creatureId: CreatureId,
): CreatureSummaryView {
	let summary = selectCreatureSummaryView(gameData, world, creatureId);
	let member = Object.values(world.battleMember).find(
		(candidate) => candidate?.battleId === battleId && candidate.creatureId === creatureId,
	);
	if (!member) return summary;

	return {
		...summary,
		currentHP: Math.max(0, summary.maxHP - member.damage),
		status: member.status === null ? null : String(member.status),
	};
}

/** Formats one creature location as a small selector-oriented label. */
function describeLocation(location: World["creatureLocation"][CreatureId] | undefined): string {
	if (!location) return "unplaced";
	if (location.kind === "party") return `party:${location.slot + 1}`;
	if (location.kind === "storage") return `storage:${location.boxId}:${location.slot + 1}`;
	if (location.kind === "battle")
		return `battle:${location.battleId}:${location.side}:${location.slot}`;
	return `encounter:${location.encounterId}`;
}
