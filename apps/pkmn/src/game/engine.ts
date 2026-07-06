/**
 * Runtime boundary for one game session, wiring authored data, mutable world state, command dispatch, and view selection into a single module.
 *
 * It defines the engine contract used to apply gameplay intents, manage transient battle runtime state, and produce persistent snapshots without exposing internal storage details to callers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@pkg/result";

import type { BattleEvent, ReplacementCommand, TurnCommand } from "./battle/battle";
import type { Command } from "./commands";
import type { GameDataSource } from "./data/game-data";
import type { GameEvent } from "./events";
import type {
	BattleView,
	BestiaryView,
	CreatureSummaryView,
	InventoryView,
	PartyView,
	PlayerView,
	Selection,
	Selector,
	StorageView,
} from "./selectors";
import type { World } from "./world/world";

import { Battle as BattleRuntime } from "./battle/battle";
import { GameData } from "./data/game-data";
import { selectView } from "./selectors";
import { markSpeciesCaught, markSpeciesSeen } from "./systems/bestiary-system";
import { captureCreature } from "./systems/capture-system";
import { despawnEncounter, spawnEncounter } from "./systems/encounter-system";
import { evolveCreature, getLevelUpEvolution } from "./systems/evolution-system";
import { awardBattleExperience, grantCreatureExperience } from "./systems/experience-system";
import { addInventoryItem, removeInventoryItem } from "./systems/inventory-system";
import { healParty } from "./systems/party-system";
import {
	ensureStorageBox,
	moveCreatureToParty,
	moveCreatureToStorage,
} from "./systems/storage-system";
import {
	cleanupBattle,
	syncBattleState,
	writeBackPlayerBattleResults,
	type BattleRuntimeHandle,
} from "./world/battle";
import { ensureEntityRegistered } from "./world/entity";
import { pickPersistentWorld, removeComponent } from "./world/helpers";
import { migrateWorld } from "./world/migrate";
import { createCreatureFromWorld } from "./world/world";

export namespace Engine {
	/** Input required to boot one engine instance. */
	export interface Options {
		/** Static authored content used to build runtime lookups. */
		content: GameDataSource;
		/** Initial world state used when the engine starts. */
		world: World;
		/** Seedable RNG threaded into battles so whole sessions are reproducible. */
		random?(): number;
	}
}

/** Central runtime boundary that owns commands, selectors, and mutable world state. */
export class Engine {
	/** Loaded static content indexed for runtime lookups. */
	private readonly gameData: GameData;

	/** Mutable ECS world owned exclusively by this engine instance. */
	private readonly world: World;

	/** Private transient bridge while the battle runtime is still generator-driven. */
	private readonly battleRuntime = new Map<string, BattleRuntimeHandle>();

	/** Seedable RNG passed into every battle for reproducible sessions. */
	private readonly random: () => number;

	/** @param options - Static content and initial world state for this engine instance */
	private constructor(options: Engine.Options) {
		this.gameData = unwrap(GameData.create(options.content));
		this.world = migrateWorld(structuredClone(options.world));
		this.random = options.random ?? Math.random;
	}

	/** Boots a new engine instance from static content and initial world state. */
	static create(options: Engine.Options): Engine {
		return new Engine(options);
	}

	/**
	 * Applies one engine command and returns the UI-facing events produced by that transition.
	 *
	 * The engine is the only mutable runtime boundary on purpose: callers submit intents here, then read the
	 * resulting state back through selectors instead of holding references to internal stores or sessions.
	 */
	dispatch(command: Command): GameEvent[] {
		switch (command.type) {
			case "add-inventory-item": {
				let inventory = addInventoryItem(
					this.world,
					command.playerId,
					command.itemId,
					command.count,
				);
				return [
					{
						type: "inventory-updated",
						itemId: command.itemId,
						count: inventory.items[command.itemId] ?? 0,
					},
				];
			}
			case "capture-creature": {
				let captured = captureCreature(this.world, command.playerId, command.creatureId);
				return [
					{
						type: "creature-captured",
						creatureId: command.creatureId,
						placement: captured.placement,
						boxId: "boxId" in captured ? captured.boxId : undefined,
					},
				];
			}
			case "evolve-creature": {
				evolveCreature(this.world, command.creatureId, command.speciesId);
				return [
					{
						type: "creature-evolved",
						creatureId: command.creatureId,
						speciesId: command.speciesId,
					},
				];
			}
			case "grant-creature-experience": {
				let result = grantCreatureExperience(
					this.gameData,
					this.world,
					command.creatureId,
					command.experience,
				);
				return [{ type: "creature-experience-granted", creatureId: command.creatureId, ...result }];
			}
			case "heal-party": {
				let count = healParty(this.gameData, this.world, command.playerId);
				return [{ type: "party-healed", playerId: command.playerId, count }];
			}
			case "mark-species-caught": {
				markSpeciesCaught(this.world, command.playerId, command.speciesId);
				return [{ type: "bestiary-updated", speciesId: command.speciesId, status: "caught" }];
			}
			case "mark-species-seen": {
				markSpeciesSeen(this.world, command.playerId, command.speciesId);
				return [{ type: "bestiary-updated", speciesId: command.speciesId, status: "seen" }];
			}
			case "remove-inventory-item": {
				let removed = removeInventoryItem(
					this.world,
					command.playerId,
					command.itemId,
					command.count,
				);
				if (!removed) return [];
				let count =
					this.selectInventory(command.playerId).entries.find(
						(entry) => entry.id === command.itemId,
					)?.count ?? 0;
				return [{ type: "inventory-updated", itemId: command.itemId, count }];
			}
			case "spawn-encounter": {
				let { creatureId } = spawnEncounter(this.gameData, this.world, command, this.random);
				return [
					{
						type: "encounter-spawned",
						encounterId: command.encounterId,
						creatureId,
						speciesId: command.speciesId,
						level: command.level,
					},
				];
			}
			case "start-battle": {
				return this.startBattle(command);
			}
			case "store-creature": {
				ensureStorageBox(this.world, command.playerId, command.boxId, command.boxId);
				if (!moveCreatureToStorage(this.world, command.playerId, command.creatureId, command.boxId))
					return [];
				return [
					{
						type: "creature-placement-changed",
						creatureId: command.creatureId,
						placement: "storage",
						boxId: command.boxId,
					},
				];
			}
			case "submit-battle-replacements": {
				return this.submitBattleReplacements(command.battleId, command.commands);
			}
			case "submit-battle-turn": {
				return this.submitBattleTurn(command.battleId, command.commands);
			}
			case "withdraw-creature": {
				if (!moveCreatureToParty(this.world, command.playerId, command.creatureId, command.boxId))
					return [];
				return [
					{
						type: "creature-placement-changed",
						creatureId: command.creatureId,
						placement: "party",
					},
				];
			}
		}
	}

	/**
	 * Selects one UI-oriented read model through the engine boundary.
	 *
	 * Selectors intentionally return derived views instead of raw components so the UI stays insulated from
	 * ECS layout details and future storage refactors.
	 */
	select(selector: Selector): Selection {
		return selectView(this.gameData, this.world, selector);
	}

	/** Returns the current player read model. */
	selectPlayer(playerId = this.world.playerId): PlayerView {
		return this.select({ type: "player", playerId }) as PlayerView;
	}

	/** Returns the current party read model. */
	selectParty(playerId = this.world.playerId): PartyView {
		return this.select({ type: "party", playerId }) as PartyView;
	}

	/** Returns the current inventory read model. */
	selectInventory(playerId = this.world.playerId): InventoryView {
		return this.select({ type: "inventory", playerId }) as InventoryView;
	}

	/** Returns the current bestiary read model. */
	selectBestiary(playerId = this.world.playerId): BestiaryView {
		return this.select({ type: "bestiary", playerId }) as BestiaryView;
	}

	/** Returns the current storage read model. */
	selectStorage(playerId = this.world.playerId): StorageView {
		return this.select({ type: "storage", playerId }) as StorageView;
	}

	/** Returns one creature summary read model. */
	selectCreatureSummary(creatureId: string): CreatureSummaryView {
		return this.select({ type: "creature-summary", creatureId }) as CreatureSummaryView;
	}

	/** Returns the current active battle read model for one player, if any. */
	selectActiveBattle(playerId = this.world.playerId): BattleView | null {
		return this.select({ type: "active-battle", playerId }) as BattleView | null;
	}

	/** Returns the current battle read model for one battle id. */
	selectBattle(battleId: string): BattleView {
		return this.select({ type: "battle", battleId }) as BattleView;
	}

	/**
	 * Returns a save-oriented snapshot with runtime-only stores omitted.
	 *
	 * Persisted data stays stable even while the engine uses extra transient mirrors and private battle
	 * sessions to drive the current frame.
	 */
	snapshot() {
		return pickPersistentWorld(this.world);
	}

	/** Creates a transient battle entity backed by the current battle resolver. */
	private startBattle(command: Extract<Command, { type: "start-battle" }>): GameEvent[] {
		// Reclaim mirrors from any battle whose session has already ended.
		for (let battleId of Object.keys(this.world.battlePhase)) {
			if (!this.battleRuntime.has(battleId)) cleanupBattle(this.world, battleId);
		}

		let playerCreatures = command.playerParty.map((creatureId) =>
			createCreatureFromWorld(this.world, creatureId),
		);
		let enemyCreatures = command.enemyParty.map((creatureId) =>
			createCreatureFromWorld(this.world, creatureId),
		);
		let battle = new BattleRuntime({
			gameData: this.gameData,
			sides: [{ teams: [playerCreatures], canLeaveBattle: true }, { teams: [enemyCreatures] }],
			slots: command.slots,
			random: this.random,
		});
		let session = battle.start();

		ensureEntityRegistered(this.world.entities, command.battleId);
		this.world.activeBattle[command.playerId] = { battleId: command.battleId };
		this.world.battleParticipants[command.battleId] = {
			playerId: command.playerId,
			enemyId: command.enemyId,
			playerParty: [...command.playerParty],
			enemyParty: [...command.enemyParty],
		};
		this.battleRuntime.set(command.battleId, { battle, session });

		let events = this.collectBattleEvents(command.battleId, session.next());
		return [{ type: "battle-started", battleId: command.battleId }, ...events];
	}

	/** Advances the current battle session with one set of turn commands. */
	private submitBattleTurn(battleId: string, commands: TurnCommand[]): GameEvent[] {
		let runtime = this.getBattleRuntime(battleId);
		return this.collectBattleEvents(battleId, runtime.session.next(commands));
	}

	/** Advances the current battle session with one set of replacement choices. */
	private submitBattleReplacements(battleId: string, commands: ReplacementCommand[]): GameEvent[] {
		let runtime = this.getBattleRuntime(battleId);
		return this.collectBattleEvents(battleId, runtime.session.next(commands));
	}

	/** Drains ordered battle events until the runtime requests new input or finishes. */
	private collectBattleEvents(
		battleId: string,
		initial: IteratorResult<BattleEvent, BattleEvent>,
	): GameEvent[] {
		let emitted: BattleEvent[] = [];
		let cursor = initial;

		while (!cursor.done) {
			emitted.push(cursor.value);
			if (
				cursor.value.type === "request-turn-commands" ||
				cursor.value.type === "request-replacements"
			) {
				break;
			}
			cursor = this.getBattleRuntime(battleId).session.next();
		}

		if (cursor.done) emitted.push(cursor.value);
		syncBattleState(this.world, this.getBattleRuntime(battleId), battleId, emitted);

		let events: GameEvent[] =
			emitted.length > 0 ? [{ type: "battle-events-appended", battleId, events: emitted }] : [];
		let last = emitted[emitted.length - 1];
		if (last?.type === "request-turn-commands") {
			events.push({ type: "battle-input-requested", battleId, request: "turn" });
		}
		if (last?.type === "request-replacements") {
			events.push({ type: "battle-input-requested", battleId, request: "replacement" });
		}
		let finishEvent = emitted.find((event) => event.type === "battle-finished");
		if (finishEvent?.type === "battle-finished") {
			let runtime = this.getBattleRuntime(battleId);
			writeBackPlayerBattleResults(this.world, runtime, battleId);
			let participants = this.world.battleParticipants[battleId];
			if (participants) {
				removeComponent(this.world.activeBattle, participants.playerId);

				// Award experience for a win before enemies are cleared, then report
				// each gain and any evolution the level-up unlocks.
				if (finishEvent.winnerSide === 0) {
					let grants = awardBattleExperience(
						this.gameData,
						this.world,
						participants.enemyParty,
						participants.playerParty,
					);
					for (let grant of grants) {
						events.push({ type: "creature-experience-granted", ...grant });
						if (grant.levelAfter <= grant.levelBefore) continue;
						let choice = getLevelUpEvolution(this.gameData, this.world, grant.creatureId);
						if (choice) {
							events.push({
								type: "creature-can-evolve",
								creatureId: grant.creatureId,
								choices: [choice],
							});
						}
					}
				}

				// Wild creatures that were not captured leave with the battle.
				for (let enemyId of participants.enemyParty) {
					let location = this.world.creatureLocation[enemyId];
					if (location?.kind === "encounter" && !this.world.ownership[enemyId]) {
						despawnEncounter(this.world, enemyId);
					}
				}
			}
			this.battleRuntime.delete(battleId);
			events.push({ type: "battle-finished", battleId, winnerSide: finishEvent.winnerSide });
		}

		return events;
	}

	/** Returns the private runtime handle for one active battle session. */
	private getBattleRuntime(battleId: string): BattleRuntimeHandle {
		let runtime = this.battleRuntime.get(battleId);
		if (runtime) return runtime;
		throw new ReferenceError(`Missing battle runtime for ${battleId}.`);
	}
}
