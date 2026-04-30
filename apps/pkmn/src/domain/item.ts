import type { Move } from "./move";

export enum Type {
	Pokeball,
	Medicine,
	HM,
	MT,
	Key,
}

interface Price {
	buy: number;
	sell: number;
}

export type Item =
	| { type: Type.Pokeball; price: Price }
	| { type: Type.Medicine; price: Price }
	| { type: Type.HM; price: Price; teaches: Move }
	| { type: Type.MT; price: Price; teaches: Move }
	| { type: Type.Key };

export enum Usage {
	UseBait,
	UseBall,
	UseBicycle,
	UseCardKey,
	UseCoinCase,
	UseDireHit,
	UseEscapeRope,
	UseEvoStone,
	UseGoodRod,
	UseGuardSpec,
	UseItemfinder,
	UseMaxRepel,
	UseMedicine,
	UseOaksParcel,
	UseOldRod,
	UsePokedex,
	UsePokeDoll,
	UsePokeFlute,
	UsePPRestore,
	UsePPUp,
	UseRepel,
	UseRock,
	UseSuperRepel,
	UseSuperRod,
	UseSurfboard,
	UseTownMap,
	UseVitamin,
	UseXAccuracy,
	UseXStat,
	UnusableItem,
}
