/**
 * Item content definitions for the PKMN content layer.
 *
 * This module centralizes the canonical item catalog used by the game content system, including battle items, capture tools, recovery items, and other inventory data. It provides the structured values that connect authored item behavior, pricing, categories, and special effects to the domain types consumed by the engine.
 *
 * As a content-layer source of truth, this file focuses on describing item data rather than implementing mechanics. The engine and domain layers can read from this module to resolve how items should appear, what they cost, and which content-specific rules or notes apply during gameplay.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Item } from "~/game/data/item";

import { ItemAttribute } from "~/game/data/item";
import { Stat } from "~/game/data/stat";
import { State } from "~/game/data/status";
import { Type } from "~/game/data/type";

export const ITEMS = {
	POKEBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		price: { buy: 200, sell: 100 },
		effect: { multiplier: 1 },
	},
	GREATBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		price: { buy: 600, sell: 300 },
		effect: { multiplier: 1.5 },
	},
	ULTRABALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		price: { buy: 1200, sell: 600 },
		effect: { multiplier: 2 },
	},
	MASTERBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		price: { buy: Number.POSITIVE_INFINITY, sell: 0 },
		effect: { multiplier: Number.POSITIVE_INFINITY },
	},
	BEASTBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Special-case catch rates for Ultra Beast style targets." },
	},
	DIVEBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective in or on water." },
	},
	DREAMBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on sleeping targets." },
	},
	DUSKBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective at night or in dark places." },
	},
	FASTBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on fast-fleeing targets." },
	},
	FRIENDBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Applies friendship bonus on capture." },
	},
	HEALBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Restores HP and status on capture." },
	},
	HEAVYBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on heavier targets." },
	},
	LEVELBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective against lower-level targets." },
	},
	LOVEBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on opposite-gender targets." },
	},
	LUREBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective in or on water." },
	},
	LUXURYBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Applies faster friendship growth on capture." },
	},
	MOONBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on species that evolve with Moon Stone." },
	},
	NESTBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on lower-level targets." },
	},
	NETBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on Water- and Bug-type targets." },
	},
	PREMIERBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Cosmetic commemorative capture tool." },
	},
	QUICKBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on the opening turn." },
	},
	REPEATBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on previously caught species." },
	},
	SAFARIBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Safari-specific capture tool." },
	},
	SPORTBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Sport-specific capture tool." },
	},
	TIMERBALL: {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective as battle turns increase." },
	},

	POTION: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		price: { buy: 300, sell: 150 },
		effect: { kind: "heal-hp", amount: 20 },
	},
	SUPERPOTION: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		price: { buy: 700, sell: 350 },
		effect: { kind: "heal-hp", amount: 60 },
	},
	HYPERPOTION: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		price: { buy: 1200, sell: 600 },
		effect: { kind: "heal-hp", amount: 120 },
	},
	MAXPOTION: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		price: { buy: 2500, sell: 1250 },
		effect: { kind: "heal-hp", amount: "full" },
	},
	FULLRESTORE: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		price: { buy: 3000, sell: 1500 },
		effect: { kind: "heal-hp-and-cure-status", amount: "full", status: "any" },
	},
	ANTIDOTE: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: [State.Poisoned] },
	},
	AWAKENING: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: [State.Asleep] },
	},
	BURNHEAL: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: [State.Burned] },
	},
	FRESHWATER: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "heal-hp", amount: 30 },
	},
	FULLHEAL: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: "any" },
	},
	ICEHEAL: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: [State.Frozen] },
	},
	LEMONADE: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "heal-hp", amount: 70 },
	},
	MAXREVIVE: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "revive", amount: "full" },
	},
	MOOMOOMILK: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "heal-hp", amount: 100 },
	},
	PARLYZEHEAL: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: [State.Paralyzed] },
	},
	REVIVALHERB: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "revive", amount: "full" },
	},
	REVIVE: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "revive", amount: "half" },
	},
	SODAPOP: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "heal-hp", amount: 50 },
	},
	ENERGYPOWDER: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "heal-hp", amount: 50 },
	},
	ENERGYROOT: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "heal-hp", amount: 120 },
	},
	HEALPOWDER: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: "any" },
	},
	ETHER: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "restore-pp", amount: 10, target: "one-move" },
	},
	MAXETHER: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "restore-pp", amount: "full", target: "one-move" },
	},
	ELIXIR: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "restore-pp", amount: 10, target: "all-moves" },
	},
	MAXELIXIR: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "restore-pp", amount: "full", target: "all-moves" },
	},
	PPUP: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "pp-boost", amount: 1 },
	},
	PPMAX: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "pp-boost", amount: "max" },
	},
	HPUP: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.HP, amount: 10 },
	},
	PROTEIN: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Attack, amount: 10 },
	},
	IRON: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Defense, amount: 10 },
	},
	CALCIUM: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.SpecialAttack, amount: 10 },
	},
	ZINC: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.SpecialDefense, amount: 10 },
	},
	CARBOS: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Speed, amount: 10 },
	},
	HEALTHFEATHER: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.HP, amount: 1 },
	},
	MUSCLEFEATHER: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Attack, amount: 1 },
	},
	RESISTFEATHER: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Defense, amount: 1 },
	},
	GENIUSFEATHER: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.SpecialAttack, amount: 1 },
	},
	CLEVERFEATHER: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.SpecialDefense, amount: 1 },
	},
	SWIFTFEATHER: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Speed, amount: 1 },
	},
	HEALTHMOCHI: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.HP, amount: 10 },
	},
	MUSCLEMOCHI: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Attack, amount: 10 },
	},
	RESISTMOCHI: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Defense, amount: 10 },
	},
	GENIUSMOCHI: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.SpecialAttack, amount: 10 },
	},
	CLEVERMOCHI: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.SpecialDefense, amount: 10 },
	},
	SWIFTMOCHI: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Speed, amount: 10 },
	},
	FRESHSTARTMOCHI: {
		category: "medicine",
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: "any" },
	},

	DIREHIT: {
		category: "stat-boosts",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "critical-rate", stages: 2 },
	},
	DIREHITLEGENDS: {
		category: "stat-boosts",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "critical-rate", stages: 2 },
	},
	GUARDSPEC: {
		category: "stat-boosts",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "mist" },
	},
	XACCURACY: {
		category: "stat-boosts",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "stat-stage", stat: "accuracy", stages: 1 },
	},
	XATTACK: {
		category: "stat-boosts",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "stat-stage", stat: Stat.Attack, stages: 1 },
	},
	XDEFENSE: {
		category: "stat-boosts",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "stat-stage", stat: Stat.Defense, stages: 1 },
	},
	XSPATK: {
		category: "stat-boosts",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "stat-stage", stat: Stat.SpecialAttack, stages: 1 },
	},
	XSPDEF: {
		category: "stat-boosts",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "stat-stage", stat: Stat.SpecialDefense, stages: 1 },
	},
	XSPEED: {
		category: "stat-boosts",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "stat-stage", stat: Stat.Speed, stages: 1 },
	},

	ABILITYSHIELD: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ABSORBBULB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ADAMANTCRYSTAL: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ADAMANTORB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	AIRBALLOON: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	AMULETCOIN: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ASSAULTVEST: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BIGROOT: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BINDINGBAND: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BLACKBELT: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	BLACKGLASSES: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	BLACKSLUDGE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BLUNDERPOLICY: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BOOSTERENERGY: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BRIGHTPOWDER: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CELLBATTERY: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CHARCOAL: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { damageTypeBoost: { type: Type.FIRE, multiplier: 1.1 }, flingPower: 30 },
	},
	CHOICEBAND: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CHOICESCARF: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CHOICESPECS: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CLEARAMULET: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CORNERSTONEMASK: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	COVERTCLOAK: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	DAMPROCK: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	DESTINYKNOT: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	DRACOPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	DRAGONFANG: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 70 },
	},
	DREADPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	EARTHPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	EJECTBUTTON: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	EJECTPACK: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ELECTRICSEED: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	EVERSTONE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	EVIOLITE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	EXPERTBELT: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FAIRYFEATHER: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FISTPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FLAMEORB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	FLAMEPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FLOATSTONE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FOCUSBAND: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FOCUSSASH: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	GRASSYSEED: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	GRIPCLAW: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 90 },
	},
	GRISEOUSCORE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	GRISEOUSORB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	HARDSTONE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 100 },
	},
	HEARTHFLAMEMASK: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	HEATROCK: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	HEAVYDUTYBOOTS: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ICICLEPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ICYROCK: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	INSECTPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	IRONBALL: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 130 },
	},
	IRONPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LAGGINGTAIL: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LEFTOVERS: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { endOfTurnHealFraction: 1 / 16 },
	},
	LIFEORB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LIGHTBALL: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	LIGHTCLAY: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LOADEDDICE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LUCKYEGG: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	LUMINOUSMOSS: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LUSTROUSGLOBE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LUSTROUSORB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MAGNET: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { damageTypeBoost: { type: Type.ELECTRIC, multiplier: 1.1 }, flingPower: 30 },
	},
	MEADOWPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MENTALHERB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	METRONOME: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MINDPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MIRACLESEED: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	MIRRORHERB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MISTYSEED: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MUSCLEBAND: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MYSTICWATER: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { damageTypeBoost: { type: Type.WATER, multiplier: 1.1 }, flingPower: 30 },
	},
	NEVERMELTICE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	NORMALGEM: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	PIXIEPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POISONBARB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 70 },
	},
	POWERANKLET: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERBAND: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERBELT: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERBRACER: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERHERB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERLENS: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERWEIGHT: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	PROTECTIVEPADS: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	PSYCHICSEED: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	PUNCHINGGLOVE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	QUICKCLAW: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	REDCARD: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	RINGTARGET: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ROCKYHELMET: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ROOMSERVICE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	RUSTEDSHIELD: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	RUSTEDSWORD: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SAFETYGOGGLES: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SCOPELENS: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SHARPBEAK: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 50 },
	},
	SHEDSHELL: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SHELLBELL: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SILKSCARF: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	SILVERPOWDER: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	SKYPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SMOKEBALL: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SMOOTHROCK: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SNOWBALL: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	SOFTSAND: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	SOOTHEBELL: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SOULDEW: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SPELLTAG: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	SPLASHPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SPOOKYPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	STICKYBARB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 80 },
	},
	STONEPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	TERRAINEXTENDER: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	THROATSPRAY: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	TOXICORB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	TOXICPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	TWISTEDSPOON: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
		battleEffect: { flingPower: 30 },
	},
	UTILITYUMBRELLA: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	WEAKNESSPOLICY: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	WELLSPRINGMASK: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	WHITEHERB: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	WIDELENS: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	WISEGLASSES: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ZAPPLATE: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ZOOMLENS: {
		category: "held-items",
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},

	HM01: {
		category: "all-machines",
		attributes: [ItemAttribute.Countable, ItemAttribute.UsableOverworld],
		price: { buy: 1000, sell: 500 },
		teachesMoveId: "CUT",
	},
	HM02: {
		category: "all-machines",
		attributes: [ItemAttribute.Countable, ItemAttribute.UsableOverworld],
		price: { buy: 1000, sell: 500 },
		teachesMoveId: "FLY",
	},
	HM03: {
		category: "all-machines",
		attributes: [ItemAttribute.Countable, ItemAttribute.UsableOverworld],
		price: { buy: 1000, sell: 500 },
		teachesMoveId: "SURF",
	},
	HM04: {
		category: "all-machines",
		attributes: [ItemAttribute.Countable, ItemAttribute.UsableOverworld],
		price: { buy: 1000, sell: 500 },
		teachesMoveId: "STRENGTH",
	},
	HM05: {
		category: "all-machines",
		attributes: [ItemAttribute.Countable, ItemAttribute.UsableOverworld],
		price: { buy: 1000, sell: 500 },
		teachesMoveId: "FLASH",
	},

	AUSPICIOUSARMOR: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	BERRYSWEET: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	CHIPPEDPOT: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	CLOVERSWEET: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	CRACKEDPOT: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	DAWNSTONE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	DRAGONSCALE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	DUBIOUSDISC: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	DUSKSTONE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	ELECTIRIZER: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	FIRESTONE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	FLOWERSWEET: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	GALARICACUFF: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	GALARICAWREATH: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	ICESTONE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	KINGSROCK: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	LEADERSCREST: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	LEAFSTONE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	LOVESWEET: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	MAGMARIZER: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	MALICIOUSARMOR: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	MASTERPIECETEACUP: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	METALALLOY: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	METALCOAT: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	MOONSTONE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	OVALSTONE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	PRISMSCALE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	PROTECTOR: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	RAZORCLAW: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	RAZORFANG: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	REAPERCLOTH: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	RIBBONSWEET: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	SCROLLOFDARKNESS: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	SCROLLOFWATERS: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	SHINYSTONE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	STARSWEET: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	STRAWBERRYSWEET: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	SUNSTONE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	SWEETAPPLE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	SYRUPYAPPLE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	TARTAPPLE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	THUNDERSTONE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	UNREMARKABLETEACUP: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	UPGRADE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	WATERSTONE: {
		category: "evolution",
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},

	BALMMUSHROOM: { category: "loot", attributes: [ItemAttribute.Countable] },
	BIGBAMBOOSHOOT: { category: "loot", attributes: [ItemAttribute.Countable] },
	BIGMUSHROOM: { category: "loot", attributes: [ItemAttribute.Countable] },
	BIGNUGGET: { category: "loot", attributes: [ItemAttribute.Countable] },
	BIGPEARL: { category: "loot", attributes: [ItemAttribute.Countable] },
	COMETSHARD: { category: "loot", attributes: [ItemAttribute.Countable] },
	HONEY: { category: "loot", attributes: [ItemAttribute.Countable] },
	NUGGET: { category: "loot", attributes: [ItemAttribute.Countable] },
	PEARL: { category: "loot", attributes: [ItemAttribute.Countable] },
	PEARLSTRING: { category: "loot", attributes: [ItemAttribute.Countable] },
	PRETTYFEATHER: { category: "loot", attributes: [ItemAttribute.Countable] },
	RAREBONE: { category: "loot", attributes: [ItemAttribute.Countable] },
	STARPIECE: { category: "loot", attributes: [ItemAttribute.Countable] },
	STARDUST: { category: "loot", attributes: [ItemAttribute.Countable] },
	TINYBAMBOOSHOOT: { category: "loot", attributes: [ItemAttribute.Countable] },
	TINYMUSHROOM: { category: "loot", attributes: [ItemAttribute.Countable] },

	CRYSTALCLUSTER: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	DNASPLICERS: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	GRACIDEA: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	METEORITE: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	NLUNARIZER: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	NSOLARIZER: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	PRISONBOTTLE: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	REINSOFUNITY: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	REVEALGLASS: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	ROTOMCATALOG: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	ROTOSTICK: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	ROTOMPHONE: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	SANDWICH: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	SYNCHROMACHINE: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },
	TERAORB: { category: "gameplay", attributes: [ItemAttribute.UsableOverworld] },

	ADVENTUREGUIDE: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	ARTICUNOTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	BRIARSBOOK: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	CATCHINGCHARM: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	COBALIONTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	ENTEITREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	EXPCHARM: { category: "plot-advancement", attributes: [ItemAttribute.UsableOverworld] },
	GLASTRIERTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	GLIMMERINGCHARM: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	GROUDONTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	HOOHTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	INDIGODISK: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	INDIGOSTYLECARD: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	KOFUSWALLET: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	KORAIDONSPOKEBALL: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	KUBFUTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	KYOGRETREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	KYUREMTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	LATIASTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	LATIOSTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	LUGIATREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	LUNALATREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	MARKCHARM: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	MIRAIDONSPOKEBALL: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	MOLTRESTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	MYTHICALPECHABERRY: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	NECROZMATREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	RAIKOUTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	RAYQUAZATREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	RESHIRAMTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	SCARLETBOOK: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	SHINYCHARM: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	SOLGALEOTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	SPECTRIERTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	SUICUNETREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	TEALMASK: { category: "plot-advancement", attributes: [ItemAttribute.UsableOverworld] },
	TEALSTYLECARD: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	TERRAKIONTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	VIOLETBOOK: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	VIRIZIONTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	ZAPDOSTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
	ZEKROMTREAT: {
		category: "plot-advancement",
		attributes: [ItemAttribute.UsableOverworld],
	},
} satisfies Record<string, Item>;
