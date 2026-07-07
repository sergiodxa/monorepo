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
import type { BattlePosition, BattleSideState } from "./battle/battle";
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
import type { CreatureId } from "./world/ids";
import type { World } from "./world/world";

import { Battle as BattleRuntime } from "./battle/battle";
import { getCreatureSpecies, getCreatureStat } from "./battle/mechanics";
import { GameData } from "./data/game-data";
import { Stat } from "./data/stat";
import { selectView } from "./selectors";
import { markSpeciesCaught, markSpeciesSeen } from "./systems/bestiary-system";
import {
	captureCreature,
	captureStatusBonus,
	computeCaptureAttempt,
} from "./systems/capture-system";
import { spawnEncounter } from "./systems/encounter-system";
import { evolveCreature, getItemEvolution, getLevelUpEvolution } from "./systems/evolution-system";
import { awardBattleExperience, grantCreatureExperience } from "./systems/experience-system";
import { addInventoryItem, removeInventoryItem } from "./systems/inventory-system";
import { hasFreeMoveSlot, learnMove, movesLearnedBetween } from "./systems/learn-system";
import { isMedicineEffect } from "./systems/medicine-system";
import { healParty } from "./systems/party-system";
import { buyItem, changeMoney, sellItem } from "./systems/shop-system";
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
			case "attempt-capture": {
				return this.attemptCapture(command);
			}
			case "buy-item": {
				let result = buyItem(
					this.gameData,
					this.world,
					command.playerId,
					command.itemId,
					command.count,
				);
				if (!result.ok) return [];
				let count =
					this.selectInventory(command.playerId).entries.find(
						(entry) => entry.id === command.itemId,
					)?.count ?? 0;
				return [
					{ type: "inventory-updated", itemId: command.itemId, count },
					{ type: "money-changed", playerId: command.playerId, amount: result.balance },
				];
			}
			case "capture-creature": {
				let captured = captureCreature(
					this.world,
					command.playerId,
					command.creatureId,
					this.gameData,
					this.random,
				);
				return [
					{
						type: "creature-captured",
						creatureId: command.creatureId,
						placement: captured.placement,
						boxId: "boxId" in captured ? captured.boxId : undefined,
					},
				];
			}
			case "change-money": {
				let balance = changeMoney(this.world, command.playerId, command.amount);
				return [{ type: "money-changed", playerId: command.playerId, amount: balance }];
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
			case "learn-move": {
				let result = learnMove(
					this.gameData,
					this.world,
					command.creatureId,
					command.moveId,
					command.replaceSlotIndex,
				);
				if (!result.learned) {
					return [
						{
							type: "move-learn-declined",
							creatureId: command.creatureId,
							moveId: command.moveId,
						},
					];
				}
				return [
					{
						type: "learned-move",
						creatureId: command.creatureId,
						moveId: command.moveId,
						slotIndex: result.slotIndex,
						...(result.replacedMoveId ? { replacedMoveId: result.replacedMoveId } : {}),
					},
				];
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
			case "sell-item": {
				let result = sellItem(
					this.gameData,
					this.world,
					command.playerId,
					command.itemId,
					command.count,
				);
				if (!result.ok) return [];
				let count =
					this.selectInventory(command.playerId).entries.find(
						(entry) => entry.id === command.itemId,
					)?.count ?? 0;
				return [
					{ type: "inventory-updated", itemId: command.itemId, count },
					{ type: "money-changed", playerId: command.playerId, amount: result.balance },
				];
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
			case "use-item-on-creature": {
				return this.useItemOnCreature(command);
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

	/**
	 * Throws a capture item at a wild target and, on success, catches it and ends the battle.
	 *
	 * Reads the target's live HP and status from the running battle, runs the Gen 3
	 * capture formula with the ball's multiplier, and consumes the ball. A success
	 * converts the (encounter-located) target into an owned creature, marks the
	 * bestiary, and finalizes the battle with no experience; a failure just reports
	 * the shakes and leaves the battle awaiting the next action.
	 */
	private attemptCapture(command: Extract<Command, { type: "attempt-capture" }>): GameEvent[] {
		let runtime = this.battleRuntime.get(command.battleId);
		let item = this.gameData.items.get(command.itemId);
		if (!runtime || !item || !("effect" in item) || !("multiplier" in item.effect)) return [];

		let target: BattlePosition = command.target ?? { side: 1, slot: 0 };
		let side = runtime.battle.state.sides[target.side];
		let active = side?.active[target.slot];
		let participants = this.world.battleParticipants[command.battleId];
		// The party id list is flat across every team on the side, so the active
		// creature's id lives at a running offset (creatures of earlier teams plus
		// the team-local index), not at the bare per-team `creatureIndex`. With a
		// single team the two are equal, so single-team sides are unchanged.
		let creatureId =
			side && active
				? participants?.enemyParty[
						getFlatCreatureIndex(side, active.teamIndex, active.creatureIndex)
					]
				: undefined;
		if (!active || !creatureId) return [];
		// Only wild (encounter-located) creatures can be captured.
		if (this.world.creatureLocation[creatureId]?.kind !== "encounter") return [];

		let creature = active.combatant.creature;
		let maxHP = getCreatureStat(this.gameData, creature, Stat.HP);
		let species = getCreatureSpecies(this.gameData, creature);
		let attempt = computeCaptureAttempt({
			maxHP,
			currentHP: maxHP - creature.status.damage,
			catchRate: species.catchRate,
			ballMultiplier: item.effect.multiplier,
			statusBonus: captureStatusBonus(creature.status.state),
			random: this.random,
		});

		removeInventoryItem(this.world, command.playerId, command.itemId, 1);
		let ballCount =
			this.selectInventory(command.playerId).entries.find((entry) => entry.id === command.itemId)
				?.count ?? 0;

		let events: GameEvent[] = [
			{ type: "capture-attempted", shakes: attempt.shakes, success: attempt.success },
			{ type: "inventory-updated", itemId: command.itemId, count: ballCount },
		];
		if (!attempt.success) return events;

		let captured = captureCreature(
			this.world,
			command.playerId,
			creatureId,
			this.gameData,
			this.random,
		);
		markSpeciesCaught(this.world, command.playerId, creature.speciesId);
		events.push(
			{
				type: "creature-captured",
				creatureId,
				placement: captured.placement,
				boxId: "boxId" in captured ? captured.boxId : undefined,
			},
			{ type: "bestiary-updated", speciesId: creature.speciesId, status: "caught" },
			...this.finalizeBattle(command.battleId, 0, false),
		);
		return events;
	}

	/**
	 * Uses one overworld item on a creature, currently resolving evolution-stone use.
	 *
	 * The item must exist, be owned in the bag, and match the target creature's
	 * use-item evolution; only then is the creature evolved and one copy of the item
	 * consumed. A missing item, an empty bag stack, or a non-matching item/species is
	 * a no-op that returns no events and never touches the bag or the creature, so the
	 * caller can safely offer any item and let this decide whether it does anything.
	 */
	private useItemOnCreature(
		command: Extract<Command, { type: "use-item-on-creature" }>,
	): GameEvent[] {
		let item = this.gameData.items.get(command.itemId);
		if (!item) return [];

		let target = getItemEvolution(this.gameData, this.world, command.creatureId, command.itemId);
		if (!target) return [];

		if (!removeInventoryItem(this.world, command.playerId, command.itemId, 1)) return [];
		let count =
			this.selectInventory(command.playerId).entries.find((entry) => entry.id === command.itemId)
				?.count ?? 0;

		evolveCreature(this.world, command.creatureId, target);
		return [
			{ type: "inventory-updated", itemId: command.itemId, count },
			{ type: "creature-evolved", creatureId: command.creatureId, speciesId: target },
		];
	}

	/**
	 * Advances the current battle session with one set of turn commands.
	 *
	 * Player-side `use-item` commands are resolved here because the inventory lives in
	 * the world, not the battle runtime: each one looks the item up, checks the bag has
	 * a copy, decrements it, and injects the authored medicine effect the battle layer
	 * needs. An item with no remaining stock (or one that is not a medicine) is forwarded
	 * with a null effect so the turn stays well-formed but nothing is applied and the bag
	 * is untouched; a genuine use reports its removal through the same `inventory-updated`
	 * event the rest of the engine emits.
	 */
	private submitBattleTurn(battleId: string, commands: TurnCommand[]): GameEvent[] {
		let runtime = this.getBattleRuntime(battleId);
		let playerId = this.world.battleParticipants[battleId]?.playerId;
		let prepared: TurnCommand[] = [];
		let itemEvents: GameEvent[] = [];

		for (let command of commands) {
			if (command.type !== "use-item") {
				prepared.push(command);
				continue;
			}

			let item = this.gameData.items.get(command.itemId);
			let effect = item && "effect" in item && isMedicineEffect(item.effect) ? item.effect : null;
			// Only decrement and apply when the item exists and can actually be spent.
			if (!playerId || !effect || !removeInventoryItem(this.world, playerId, command.itemId, 1)) {
				prepared.push({ ...command, effect: null });
				continue;
			}

			let count =
				this.selectInventory(playerId).entries.find((entry) => entry.id === command.itemId)
					?.count ?? 0;
			itemEvents.push({ type: "inventory-updated", itemId: command.itemId, count });
			prepared.push({ ...command, effect });
		}

		let battleEvents = this.collectBattleEvents(battleId, runtime.session.next(prepared));
		return [...itemEvents, ...battleEvents];
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
			events.push(...this.finalizeBattle(battleId, finishEvent.winnerSide, true));
		}

		return events;
	}

	/**
	 * Writes back results, awards experience, clears mirrors, and returns the closing events.
	 *
	 * Shared by natural battle endings and by capture/escape, which end a battle from
	 * outside the turn resolver. Experience is awarded only on a genuine win
	 * (`awardExperience` and `winnerSide === 0`), not for a capture or flee.
	 */
	private finalizeBattle(
		battleId: string,
		winnerSide: number | null,
		awardExperience: boolean,
	): GameEvent[] {
		let events: GameEvent[] = [];
		let runtime = this.battleRuntime.get(battleId);
		if (runtime) writeBackPlayerBattleResults(this.world, runtime, battleId);

		let participants = this.world.battleParticipants[battleId];
		if (participants) {
			removeComponent(this.world.activeBattle, participants.playerId);

			if (awardExperience && winnerSide === 0) {
				let grants = awardBattleExperience(
					this.gameData,
					this.world,
					participants.enemyParty,
					participants.playerParty,
				);
				for (let grant of grants) {
					events.push({ type: "creature-experience-granted", ...grant });
					if (grant.levelAfter <= grant.levelBefore) continue;
					events.push(
						...this.emitLearnableMoves(grant.creatureId, grant.levelBefore, grant.levelAfter),
					);
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
			// Uncaptured wild creatures are despawned later by cleanupBattle, not here:
			// the presentation still reads the enemy summary through selectBattle while it
			// animates the finish, so deleting its components now would crash that read.
		}

		this.battleRuntime.delete(battleId);
		events.push({ type: "battle-finished", battleId, winnerSide });
		return events;
	}

	/**
	 * Resolves the moves a creature can learn for the levels it just crossed.
	 *
	 * For each move pinned to a newly reached level, a creature with a free slot
	 * auto-learns it (updating the stored moveset and emitting `learned-move`),
	 * while a creature whose four slots are full instead surfaces a `can-learn-move`
	 * event so the presentation can prompt the player to replace a move or skip.
	 * Auto-learning one move can free the next decision, so the moveset is re-read
	 * from the world for every candidate rather than snapshotted once.
	 */
	private emitLearnableMoves(
		creatureId: CreatureId,
		levelBefore: number,
		levelAfter: number,
	): GameEvent[] {
		let creature = createCreatureFromWorld(this.world, creatureId);
		let species = getCreatureSpecies(this.gameData, creature);
		let events: GameEvent[] = [];

		for (let moveId of movesLearnedBetween(species.learnset, levelBefore, levelAfter)) {
			let moveset = createCreatureFromWorld(this.world, creatureId).moveset;
			if (moveset.includes(moveId)) continue;

			if (hasFreeMoveSlot(moveset)) {
				let result = learnMove(this.gameData, this.world, creatureId, moveId);
				if (result.learned) {
					events.push({
						type: "learned-move",
						creatureId,
						moveId,
						slotIndex: result.slotIndex,
					});
				}
				continue;
			}

			events.push({ type: "can-learn-move", creatureId, moveId, currentMoveset: moveset });
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

/**
 * Maps one active slot's team and team-local creature index to its flat party-id index.
 *
 * A side's persistent id list is flat across every team, ordered by team, so the id
 * for an active combatant sits at the running offset of all earlier teams' creatures
 * plus its own team-local index. Single-team sides collapse the offset to zero, so the
 * flat index equals the team-local index and their mapping is unchanged.
 *
 * Exported for regression coverage: the equivalent per-team-index-vs-flat-list mismatch
 * was already fixed in `syncBattleState`.
 */
export function getFlatCreatureIndex(
	side: BattleSideState,
	teamIndex: number,
	creatureIndex: number,
): number {
	let offset = 0;
	for (let index = 0; index < teamIndex; index += 1) {
		offset += side.teams[index]?.creatures.length ?? 0;
	}
	return offset + creatureIndex;
}
