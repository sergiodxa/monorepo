import { Item, Type } from "../domain/item";

import { MOVES } from "./moves";

export const ITEMS = {
	POKEBALL: {
		type: Type.Pokeball,
		price: { buy: 200, sell: 100 },
	},
	GREATBALL: {
		type: Type.Pokeball,
		price: { buy: 600, sell: 300 },
	},
	ULTRABALL: {
		type: Type.Pokeball,
		price: { buy: 1200, sell: 600 },
	},
	MASTERBALL: {
		type: Type.Pokeball,
		price: { buy: Number.POSITIVE_INFINITY, sell: 0 },
	},
	POTION: {
		type: Type.Medicine,
		price: { buy: 300, sell: 150 },
	},
	SUPERPOTION: {
		type: Type.Medicine,
		price: { buy: 700, sell: 350 },
	},
	HYPERPOTION: {
		type: Type.Medicine,
		price: { buy: 1200, sell: 600 },
	},
	MAXPOTION: {
		type: Type.Medicine,
		price: { buy: 2500, sell: 1250 },
	},
	FULLRESTORE: {
		type: Type.Medicine,
		price: { buy: 3000, sell: 1500 },
	},
	HM01: {
		type: Type.HM,
		price: { buy: 1000, sell: 500 },
		teaches: MOVES["CUT"],
	},
	HM02: {
		type: Type.HM,
		price: { buy: 1000, sell: 500 },
		teaches: MOVES["FLY"],
	},
	HM03: {
		type: Type.HM,
		price: { buy: 1000, sell: 500 },
		teaches: MOVES["SURF"],
	},
	HM04: {
		type: Type.HM,
		price: { buy: 1000, sell: 500 },
		teaches: MOVES["STRENGTH"],
	},
	HM05: {
		type: Type.HM,
		price: { buy: 1000, sell: 500 },
		teaches: MOVES["FLASH"],
	},
} satisfies Record<string, Item>;
