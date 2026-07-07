import type { BattleStatStage, MoveId } from "./move";
/**
 * Canonical item data contracts for the game data layer.
 *
 * This module defines the shared identifiers, enums, and structured effect shapes
 * used to describe items in a content-agnostic way. It gives the rest of the game
 * a stable vocabulary for item categories, attributes, pricing, and behavior data
 * without coupling engine logic to any specific content source.
 *
 * The declarations in this file act as the boundary between authored item records
 * and the systems that consume them. By centralizing these data shapes here, the
 * module helps keep item loading, validation, and gameplay rules aligned around a
 * single representation of what an item is allowed to express.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { State } from "./status";
import type { Type } from "./type";

import { Stat } from "./stat";

/** String identifier of an item in loaded game data. */
export type ItemId = string;

/** Buy and sell values used by shops. */
export interface Price {
	buy: number;
	sell: number;
}

/** Attribute flags engines can inspect to determine what an item can do. */
export enum ItemAttribute {
	Countable,
	Consumable,
	UsableOverworld,
	UsableInBattle,
	Holdable,
	HoldablePassive,
	HoldableActive,
	Underground,
}

/** Capture-specific data consumed by battle rules. */
export interface CaptureEffect {
	multiplier: number;
	notes?: string;
}

export namespace MedicineEffect {
	export interface HealHP {
		kind: "heal-hp";
		amount: number | "full";
	}

	export interface CureStatus {
		kind: "cure-status";
		status: State[] | "any";
	}

	export interface HealHPAndCureStatus {
		kind: "heal-hp-and-cure-status";
		amount: number | "full";
		status: State[] | "any";
	}

	export interface Revive {
		kind: "revive";
		amount: "half" | "full";
	}

	export interface RestorePP {
		kind: "restore-pp";
		amount: number | "full";
		target: "one-move" | "all-moves";
	}

	export interface PPBoost {
		kind: "pp-boost";
		amount: 1 | "max";
	}

	export interface RaiseEV {
		kind: "raise-ev";
		stat: Stat;
		amount: number;
	}
}

/** Medicine-specific payload used by healing and training items. */
export type MedicineEffect =
	| MedicineEffect.HealHP
	| MedicineEffect.CureStatus
	| MedicineEffect.HealHPAndCureStatus
	| MedicineEffect.Revive
	| MedicineEffect.RestorePP
	| MedicineEffect.PPBoost
	| MedicineEffect.RaiseEV;

export namespace BattleItemEffect {
	export interface StatStage {
		kind: "stat-stage";
		stat: BattleStatStage;
		stages: number;
	}

	export interface CriticalRate {
		kind: "critical-rate";
		stages: number;
	}

	export interface Mist {
		kind: "mist";
	}
}

/** Battle-specific payload used by directly activated battle items. */
export type BattleItemEffect =
	| BattleItemEffect.StatStage
	| BattleItemEffect.CriticalRate
	| BattleItemEffect.Mist;

/**
 * Passive battle behavior a held item grants to its wielder.
 *
 * These effects apply automatically while a creature carries the item during a
 * battle, without spending an action. Every field is optional so one item can
 * express a single behavior or several at once, and an item that holds nothing
 * relevant simply omits the field. The shape stays content-agnostic: it names
 * generic mechanics (residual healing, a type-matched damage multiplier) rather
 * than any specific item, so engine systems can read it without knowing content.
 */
export interface HeldItemBattleEffect {
	/**
	 * Fraction of the wielder's maximum HP restored at the end of each turn.
	 * A value of `1 / 16` restores `floor(maxHP / 16)` while the wielder is not
	 * fainted and not already at full HP.
	 */
	endOfTurnHealFraction?: number;
	/**
	 * Multiplier applied to the wielder's outgoing damage when the move being used
	 * matches `type`. Moves of any other type are unaffected.
	 */
	damageTypeBoost?: {
		type: Type;
		multiplier: number;
	};
}

export namespace Item {
	/** Shared shape for every item regardless of its specialized payload. */
	export interface Base {
		category: string;
		attributes: [ItemAttribute, ...ItemAttribute[]];
		price?: Price;
		/** Passive behavior applied while this item is held during a battle. */
		battleEffect?: HeldItemBattleEffect;
	}

	export interface Capture extends Base {
		effect: CaptureEffect;
	}

	export interface Medicine extends Base {
		effect: MedicineEffect;
	}

	export interface BattleItem extends Base {
		effect: BattleItemEffect;
	}

	export interface TeachesMove extends Base {
		teachesMoveId: MoveId;
	}

	export interface Misc extends Base {}
}

/**
 * Item behaviors are derived from attributes.
 * Extra fields only provide the payload needed once an engine knows the item is usable.
 */
export type Item = Item.Capture | Item.Medicine | Item.BattleItem | Item.TeachesMove | Item.Misc;
