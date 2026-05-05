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

import { Stat } from "./stat";

/** String identifier of an item in loaded game data. */
export type ItemId = string;

/** Buy and sell values used by shops. */
export interface Price {
	buy: number;
	sell: number;
}

/** Content-backed category assigned to an item. */
export enum ItemCategory {
	StatBoosts,
	EffortDrop,
	Medicine,
	Other,
	InAPinch,
	PickyHealing,
	TypeProtection,
	BakingOnly,
	Collectibles,
	Evolution,
	Spelunking,
	HeldItems,
	Choice,
	EffortTraining,
	BadHeldItems,
	Training,
	Plates,
	SpeciesSpecific,
	TypeEnhancement,
	EventItems,
	Gameplay,
	PlotAdvancement,
	Unused,
	Loot,
	AllMail,
	Vitamins,
	Healing,
	PpRecovery,
	Revival,
	StatusCures,
	Mulch,
	SpecialBalls,
	StandardBalls,
	DexCompletion,
	Scarves,
	AllMachines,
	Flutes,
	ApricornBalls,
	ApricornBox,
	DataCards,
	Jewels,
	MiracleShooter,
	MegaStones,
	Memories,
	ZCrystals,
	SpeciesCandies,
	CatchingBonus,
	DynamaxCrystals,
	NatureMints,
	CurryIngredients,
	TeraShard,
	SandwichIngredients,
	TmMaterials,
	Picnic,
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

export namespace Item {
	/** Shared shape for every item regardless of its specialized payload. */
	export interface Base {
		category: ItemCategory;
		attributes: [ItemAttribute, ...ItemAttribute[]];
		price?: Price;
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
