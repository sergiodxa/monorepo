/**
 * Declares the command contracts accepted by this game engine boundary. It centralizes the intent shapes that other modules can submit when they need to request state changes without depending on implementation details.
 *
 * This module groups each command payload under the `Command` namespace and exposes a single discriminated union for consuming, validating, and routing those requests consistently across the file's callers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ReplacementCommand, TurnCommand } from "./battle/battle";
import type { ItemId } from "./data/item";
import type { SpeciesId } from "./data/species";
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

	/** Fully restores every party creature's HP, status, and PP. */
	export interface HealParty {
		type: "heal-party";
		playerId: PlayerId;
	}
}

/** Intent submitted through the engine boundary. */
export type Command =
	| Command.AddInventoryItem
	| Command.CaptureCreature
	| Command.EvolveCreature
	| Command.GrantCreatureExperience
	| Command.HealParty
	| Command.MarkSpeciesCaught
	| Command.MarkSpeciesSeen
	| Command.RemoveInventoryItem
	| Command.StartBattle
	| Command.StoreCreature
	| Command.SubmitBattleReplacements
	| Command.SubmitBattleTurn
	| Command.WithdrawCreature;
