import type { Item } from "../domain/item";

import { ItemAttribute, ItemCategory } from "../domain/item";
import { Stat } from "../domain/stat";
import { State } from "../engine/creature";

export const ITEMS = {
	POKEBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		price: { buy: 200, sell: 100 },
		effect: { multiplier: 1 },
	},
	GREATBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		price: { buy: 600, sell: 300 },
		effect: { multiplier: 1.5 },
	},
	ULTRABALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		price: { buy: 1200, sell: 600 },
		effect: { multiplier: 2 },
	},
	MASTERBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		price: { buy: Number.POSITIVE_INFINITY, sell: 0 },
		effect: { multiplier: Number.POSITIVE_INFINITY },
	},
	BEASTBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Special-case catch rates for Ultra Beast style targets." },
	},
	DIVEBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective in or on water." },
	},
	DREAMBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on sleeping targets." },
	},
	DUSKBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective at night or in dark places." },
	},
	FASTBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on fast-fleeing targets." },
	},
	FRIENDBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Applies friendship bonus on capture." },
	},
	HEALBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Restores HP and status on capture." },
	},
	HEAVYBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on heavier targets." },
	},
	LEVELBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective against lower-level targets." },
	},
	LOVEBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on opposite-gender targets." },
	},
	LUREBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective in or on water." },
	},
	LUXURYBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Applies faster friendship growth on capture." },
	},
	MOONBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on species that evolve with Moon Stone." },
	},
	NESTBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on lower-level targets." },
	},
	NETBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on Water- and Bug-type targets." },
	},
	PREMIERBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Cosmetic commemorative capture tool." },
	},
	QUICKBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on the opening turn." },
	},
	REPEATBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective on previously caught species." },
	},
	SAFARIBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Safari-specific capture tool." },
	},
	SPORTBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "Sport-specific capture tool." },
	},
	TIMERBALL: {
		category: ItemCategory.StandardBalls,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { multiplier: 1, notes: "More effective as battle turns increase." },
	},

	POTION: {
		category: ItemCategory.Medicine,
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
		category: ItemCategory.Medicine,
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
		category: ItemCategory.Medicine,
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
		category: ItemCategory.Medicine,
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
		category: ItemCategory.Medicine,
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
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: [State.Poisoned] },
	},
	AWAKENING: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: [State.Asleep] },
	},
	BURNHEAL: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: [State.Burned] },
	},
	FRESHWATER: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "heal-hp", amount: 30 },
	},
	FULLHEAL: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: "any" },
	},
	ICEHEAL: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: [State.Frozen] },
	},
	LEMONADE: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "heal-hp", amount: 70 },
	},
	MAXREVIVE: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "revive", amount: "full" },
	},
	MOOMOOMILK: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "heal-hp", amount: 100 },
	},
	PARLYZEHEAL: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: [State.Paralyzed] },
	},
	REVIVALHERB: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "revive", amount: "full" },
	},
	REVIVE: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "revive", amount: "half" },
	},
	SODAPOP: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "heal-hp", amount: 50 },
	},
	ENERGYPOWDER: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "heal-hp", amount: 50 },
	},
	ENERGYROOT: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "heal-hp", amount: 120 },
	},
	HEALPOWDER: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: "any" },
	},
	ETHER: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "restore-pp", amount: 10, target: "one-move" },
	},
	MAXETHER: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "restore-pp", amount: "full", target: "one-move" },
	},
	ELIXIR: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "restore-pp", amount: 10, target: "all-moves" },
	},
	MAXELIXIR: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "restore-pp", amount: "full", target: "all-moves" },
	},
	PPUP: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "pp-boost", amount: 1 },
	},
	PPMAX: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "pp-boost", amount: "max" },
	},
	HPUP: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.HP, amount: 10 },
	},
	PROTEIN: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Attack, amount: 10 },
	},
	IRON: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Defense, amount: 10 },
	},
	CALCIUM: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.SpecialAttack, amount: 10 },
	},
	ZINC: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.SpecialDefense, amount: 10 },
	},
	CARBOS: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Speed, amount: 10 },
	},
	HEALTHFEATHER: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.HP, amount: 1 },
	},
	MUSCLEFEATHER: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Attack, amount: 1 },
	},
	RESISTFEATHER: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Defense, amount: 1 },
	},
	GENIUSFEATHER: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.SpecialAttack, amount: 1 },
	},
	CLEVERFEATHER: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.SpecialDefense, amount: 1 },
	},
	SWIFTFEATHER: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Speed, amount: 1 },
	},
	HEALTHMOCHI: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.HP, amount: 10 },
	},
	MUSCLEMOCHI: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Attack, amount: 10 },
	},
	RESISTMOCHI: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Defense, amount: 10 },
	},
	GENIUSMOCHI: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.SpecialAttack, amount: 10 },
	},
	CLEVERMOCHI: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.SpecialDefense, amount: 10 },
	},
	SWIFTMOCHI: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "raise-ev", stat: Stat.Speed, amount: 10 },
	},
	FRESHSTARTMOCHI: {
		category: ItemCategory.Medicine,
		attributes: [
			ItemAttribute.Countable,
			ItemAttribute.Consumable,
			ItemAttribute.UsableOverworld,
			ItemAttribute.UsableInBattle,
		],
		effect: { kind: "cure-status", status: "any" },
	},

	DIREHIT: {
		category: ItemCategory.StatBoosts,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "critical-rate", stages: 2 },
	},
	DIREHITLEGENDS: {
		category: ItemCategory.StatBoosts,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "critical-rate", stages: 2 },
	},
	GUARDSPEC: {
		category: ItemCategory.StatBoosts,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "mist" },
	},
	XACCURACY: {
		category: ItemCategory.StatBoosts,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "stat-stage", stat: "accuracy", stages: 1 },
	},
	XATTACK: {
		category: ItemCategory.StatBoosts,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "stat-stage", stat: Stat.Attack, stages: 1 },
	},
	XDEFENSE: {
		category: ItemCategory.StatBoosts,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "stat-stage", stat: Stat.Defense, stages: 1 },
	},
	XSPATK: {
		category: ItemCategory.StatBoosts,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "stat-stage", stat: Stat.SpecialAttack, stages: 1 },
	},
	XSPDEF: {
		category: ItemCategory.StatBoosts,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "stat-stage", stat: Stat.SpecialDefense, stages: 1 },
	},
	XSPEED: {
		category: ItemCategory.StatBoosts,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableInBattle],
		effect: { kind: "stat-stage", stat: Stat.Speed, stages: 1 },
	},

	ABILITYSHIELD: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ABSORBBULB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ADAMANTCRYSTAL: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ADAMANTORB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	AIRBALLOON: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	AMULETCOIN: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ASSAULTVEST: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BIGROOT: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BINDINGBAND: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BLACKBELT: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BLACKGLASSES: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BLACKSLUDGE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BLUNDERPOLICY: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BOOSTERENERGY: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	BRIGHTPOWDER: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CELLBATTERY: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CHARCOAL: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CHOICEBAND: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CHOICESCARF: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CHOICESPECS: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CLEARAMULET: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	CORNERSTONEMASK: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	COVERTCLOAK: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	DAMPROCK: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	DESTINYKNOT: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	DRACOPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	DRAGONFANG: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	DREADPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	EARTHPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	EJECTBUTTON: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	EJECTPACK: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ELECTRICSEED: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	EVERSTONE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	EVIOLITE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	EXPERTBELT: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FAIRYFEATHER: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FISTPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FLAMEORB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FLAMEPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FLOATSTONE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FOCUSBAND: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	FOCUSSASH: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	GRASSYSEED: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	GRIPCLAW: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	GRISEOUSCORE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	GRISEOUSORB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	HARDSTONE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	HEARTHFLAMEMASK: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	HEATROCK: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	HEAVYDUTYBOOTS: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ICICLEPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ICYROCK: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	INSECTPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	IRONBALL: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	IRONPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LAGGINGTAIL: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LEFTOVERS: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LIFEORB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LIGHTBALL: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LIGHTCLAY: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LOADEDDICE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LUCKYEGG: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LUMINOUSMOSS: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LUSTROUSGLOBE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	LUSTROUSORB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MAGNET: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MEADOWPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MENTALHERB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	METRONOME: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MINDPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MIRACLESEED: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MIRRORHERB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MISTYSEED: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MUSCLEBAND: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	MYSTICWATER: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	NEVERMELTICE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	NORMALGEM: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	PIXIEPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POISONBARB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERANKLET: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERBAND: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERBELT: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERBRACER: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERHERB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERLENS: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	POWERWEIGHT: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	PROTECTIVEPADS: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	PSYCHICSEED: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	PUNCHINGGLOVE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	QUICKCLAW: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	REDCARD: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	RINGTARGET: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ROCKYHELMET: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ROOMSERVICE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	RUSTEDSHIELD: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	RUSTEDSWORD: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SAFETYGOGGLES: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SCOPELENS: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SHARPBEAK: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SHEDSHELL: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SHELLBELL: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SILKSCARF: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SILVERPOWDER: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SKYPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SMOKEBALL: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SMOOTHROCK: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SNOWBALL: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SOFTSAND: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SOOTHEBELL: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SOULDEW: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SPELLTAG: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SPLASHPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	SPOOKYPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	STICKYBARB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	STONEPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	TERRAINEXTENDER: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	THROATSPRAY: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	TOXICORB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	TOXICPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	TWISTEDSPOON: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	UTILITYUMBRELLA: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	WEAKNESSPOLICY: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	WELLSPRINGMASK: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	WHITEHERB: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	WIDELENS: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	WISEGLASSES: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ZAPPLATE: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},
	ZOOMLENS: {
		category: ItemCategory.HeldItems,
		attributes: [ItemAttribute.Countable, ItemAttribute.Holdable],
	},

	HM01: {
		category: ItemCategory.AllMachines,
		attributes: [ItemAttribute.Countable, ItemAttribute.UsableOverworld],
		price: { buy: 1000, sell: 500 },
		teachesMoveId: "CUT",
	},
	HM02: {
		category: ItemCategory.AllMachines,
		attributes: [ItemAttribute.Countable, ItemAttribute.UsableOverworld],
		price: { buy: 1000, sell: 500 },
		teachesMoveId: "FLY",
	},
	HM03: {
		category: ItemCategory.AllMachines,
		attributes: [ItemAttribute.Countable, ItemAttribute.UsableOverworld],
		price: { buy: 1000, sell: 500 },
		teachesMoveId: "SURF",
	},
	HM04: {
		category: ItemCategory.AllMachines,
		attributes: [ItemAttribute.Countable, ItemAttribute.UsableOverworld],
		price: { buy: 1000, sell: 500 },
		teachesMoveId: "STRENGTH",
	},
	HM05: {
		category: ItemCategory.AllMachines,
		attributes: [ItemAttribute.Countable, ItemAttribute.UsableOverworld],
		price: { buy: 1000, sell: 500 },
		teachesMoveId: "FLASH",
	},

	AUSPICIOUSARMOR: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	BERRYSWEET: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	CHIPPEDPOT: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	CLOVERSWEET: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	CRACKEDPOT: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	DAWNSTONE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	DRAGONSCALE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	DUBIOUSDISC: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	DUSKSTONE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	ELECTIRIZER: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	FIRESTONE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	FLOWERSWEET: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	GALARICACUFF: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	GALARICAWREATH: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	ICESTONE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	KINGSROCK: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	LEADERSCREST: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	LEAFSTONE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	LOVESWEET: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	MAGMARIZER: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	MALICIOUSARMOR: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	MASTERPIECETEACUP: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	METALALLOY: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	METALCOAT: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	MOONSTONE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	OVALSTONE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	PRISMSCALE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	PROTECTOR: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	RAZORCLAW: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	RAZORFANG: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	REAPERCLOTH: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	RIBBONSWEET: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	SCROLLOFDARKNESS: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	SCROLLOFWATERS: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	SHINYSTONE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	STARSWEET: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	STRAWBERRYSWEET: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	SUNSTONE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	SWEETAPPLE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	SYRUPYAPPLE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	TARTAPPLE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	THUNDERSTONE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	UNREMARKABLETEACUP: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	UPGRADE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},
	WATERSTONE: {
		category: ItemCategory.Evolution,
		attributes: [ItemAttribute.Countable, ItemAttribute.Consumable, ItemAttribute.UsableOverworld],
	},

	BALMMUSHROOM: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	BIGBAMBOOSHOOT: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	BIGMUSHROOM: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	BIGNUGGET: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	BIGPEARL: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	COMETSHARD: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	HONEY: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	NUGGET: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	PEARL: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	PEARLSTRING: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	PRETTYFEATHER: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	RAREBONE: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	STARPIECE: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	STARDUST: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	TINYBAMBOOSHOOT: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },
	TINYMUSHROOM: { category: ItemCategory.Loot, attributes: [ItemAttribute.Countable] },

	CRYSTALCLUSTER: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	DNASPLICERS: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	GRACIDEA: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	METEORITE: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	NLUNARIZER: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	NSOLARIZER: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	PRISONBOTTLE: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	REINSOFUNITY: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	REVEALGLASS: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	ROTOMCATALOG: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	ROTOSTICK: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	ROTOMPHONE: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	SANDWICH: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	SYNCHROMACHINE: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },
	TERAORB: { category: ItemCategory.Gameplay, attributes: [ItemAttribute.UsableOverworld] },

	ADVENTUREGUIDE: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	ARTICUNOTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	BRIARSBOOK: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	CATCHINGCHARM: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	COBALIONTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	ENTEITREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	EXPCHARM: { category: ItemCategory.PlotAdvancement, attributes: [ItemAttribute.UsableOverworld] },
	GLASTRIERTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	GLIMMERINGCHARM: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	GROUDONTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	HOOHTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	INDIGODISK: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	INDIGOSTYLECARD: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	KOFUSWALLET: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	KORAIDONSPOKEBALL: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	KUBFUTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	KYOGRETREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	KYUREMTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	LATIASTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	LATIOSTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	LUGIATREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	LUNALATREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	MARKCHARM: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	MIRAIDONSPOKEBALL: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	MOLTRESTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	MYTHICALPECHABERRY: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	NECROZMATREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	RAIKOUTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	RAYQUAZATREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	RESHIRAMTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	SCARLETBOOK: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	SHINYCHARM: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	SOLGALEOTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	SPECTRIERTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	SUICUNETREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	TEALMASK: { category: ItemCategory.PlotAdvancement, attributes: [ItemAttribute.UsableOverworld] },
	TEALSTYLECARD: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	TERRAKIONTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	VIOLETBOOK: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	VIRIZIONTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	ZAPDOSTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
	ZEKROMTREAT: {
		category: ItemCategory.PlotAdvancement,
		attributes: [ItemAttribute.UsableOverworld],
	},
} satisfies Record<string, Item>;
