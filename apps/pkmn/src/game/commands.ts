/**
 * Declares the command contracts accepted by this game engine boundary. It centralizes the intent shapes that other modules can submit when they need to request state changes without depending on implementation details.
 *
 * This module groups each command payload under the `Command` namespace and exposes a single discriminated union for consuming, validating, and routing those requests consistently across the file's callers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BattlePosition, ReplacementCommand, TurnCommand } from "./battle/battle";
import type { ItemId } from "./data/item";
import type { MoveId } from "./data/move";
import type { NatureId } from "./data/nature";
import type { SpeciesId } from "./data/species";
import type { StatSet } from "./data/stat";
import type { BattleId, CreatureId, PlayerId } from "./world/ids";

/** Commands accepted by the game engine boundary. */
export namespace Command {
	/** Creates a new transient battle session and registers it in the world. */
	export interface StartBattle {
		type: "start-battle";
		battleId: BattleId;
		playerId: PlayerId;
		enemyId: PlayerId;
		playerParty: CreatureId[];
		enemyParty: CreatureId[];
		slots?: 1 | 2 | 3;
	}

	/** Submits one full turn of commands for every requested active slot. */
	export interface SubmitBattleTurn {
		type: "submit-battle-turn";
		battleId: BattleId;
		commands: TurnCommand[];
	}

	/** Submits replacements for every requested empty battle slot. */
	export interface SubmitBattleReplacements {
		type: "submit-battle-replacements";
		battleId: BattleId;
		commands: ReplacementCommand[];
	}

	/** Adds one or more items to the player's inventory. */
	export interface AddInventoryItem {
		type: "add-inventory-item";
		playerId: PlayerId;
		itemId: ItemId;
		count: number;
	}

	/** Removes one or more items from the player's inventory. */
	export interface RemoveInventoryItem {
		type: "remove-inventory-item";
		playerId: PlayerId;
		itemId: ItemId;
		count: number;
	}

	/** Buys one or more copies of an item, deducting the player's money. */
	export interface BuyItem {
		type: "buy-item";
		playerId: PlayerId;
		itemId: ItemId;
		count: number;
	}

	/** Sells one or more copies of an item, crediting the player's money. */
	export interface SellItem {
		type: "sell-item";
		playerId: PlayerId;
		itemId: ItemId;
		count: number;
	}

	/** Adjusts the player's money by a signed amount (rewards or penalties). */
	export interface ChangeMoney {
		type: "change-money";
		playerId: PlayerId;
		amount: number;
	}

	/** Records that one species has been seen. */
	export interface MarkSpeciesSeen {
		type: "mark-species-seen";
		playerId: PlayerId;
		speciesId: SpeciesId;
	}

	/** Records that one species has been caught. */
	export interface MarkSpeciesCaught {
		type: "mark-species-caught";
		playerId: PlayerId;
		speciesId: SpeciesId;
	}

	/** Moves one owned creature from the party into storage. */
	export interface StoreCreature {
		type: "store-creature";
		playerId: PlayerId;
		creatureId: CreatureId;
		boxId: string;
	}

	/** Moves one stored creature into the active party. */
	export interface WithdrawCreature {
		type: "withdraw-creature";
		playerId: PlayerId;
		creatureId: CreatureId;
		boxId: string;
	}

	/** Converts one encounter creature into an owned creature. */
	export interface CaptureCreature {
		type: "capture-creature";
		playerId: PlayerId;
		creatureId: CreatureId;
	}

	/** Grants earned experience to one creature entity. */
	export interface GrantCreatureExperience {
		type: "grant-creature-experience";
		creatureId: CreatureId;
		experience: number;
	}

	/** Updates one creature's species identity after evolution resolves. */
	export interface EvolveCreature {
		type: "evolve-creature";
		creatureId: CreatureId;
		speciesId: SpeciesId;
	}

	/**
	 * Uses one overworld item on a specific creature.
	 *
	 * Today this resolves evolution-stone use: when the item matches the creature's
	 * use-item evolution the creature evolves and the item is consumed; any other
	 * item leaves the bag and the creature untouched.
	 */
	export interface UseItemOnCreature {
		type: "use-item-on-creature";
		playerId: PlayerId;
		creatureId: CreatureId;
		itemId: ItemId;
	}

	/** Fully restores every party creature's HP, status, and PP. */
	export interface HealParty {
		type: "heal-party";
		playerId: PlayerId;
	}

	/** Creates a wild creature at an encounter location, rolling any omitted fields. */
	export interface SpawnEncounter {
		type: "spawn-encounter";
		encounterId: string;
		speciesId: SpeciesId;
		level: number;
		natureId?: NatureId;
		iv?: Partial<StatSet>;
		moveIds?: MoveId[];
	}

	/** Throws a capture item at a wild target, ending the battle on success. */
	export interface AttemptCapture {
		type: "attempt-capture";
		battleId: BattleId;
		playerId: PlayerId;
		itemId: ItemId;
		target?: BattlePosition;
	}

	/**
	 * Resolves a pending level-up move offer for one creature.
	 *
	 * When the creature has a free slot the move is appended and `replaceSlotIndex`
	 * is ignored. When its four slots are full, `replaceSlotIndex` names the slot to
	 * overwrite; an out-of-range or negative index (or an omitted one on a full
	 * moveset) is treated as declining the move.
	 */
	export interface LearnMove {
		type: "learn-move";
		creatureId: CreatureId;
		moveId: MoveId;
		/** Slot to overwrite when full; out-of-range/negative or omitted declines. */
		replaceSlotIndex?: number;
	}
}

/** Intent submitted through the engine boundary. */
export type Command =
	| Command.AddInventoryItem
	| Command.AttemptCapture
	| Command.BuyItem
	| Command.CaptureCreature
	| Command.ChangeMoney
	| Command.EvolveCreature
	| Command.GrantCreatureExperience
	| Command.HealParty
	| Command.LearnMove
	| Command.MarkSpeciesCaught
	| Command.MarkSpeciesSeen
	| Command.RemoveInventoryItem
	| Command.SellItem
	| Command.SpawnEncounter
	| Command.StartBattle
	| Command.StoreCreature
	| Command.SubmitBattleReplacements
	| Command.SubmitBattleTurn
	| Command.UseItemOnCreature
	| Command.WithdrawCreature;
