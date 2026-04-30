import { Stat } from "./stat";
import { Type } from "./type";

/** String identifier of a move in loaded game data. */
export type MoveId = string;

export enum StatusEffectType {
	Burn = "burn",
	Paralysis = "paralysis",
	Poison = "poison",
	Sleep = "sleep",
	Freeze = "freeze",
}

export enum Class {
	Physical = "physical",
	Special = "special",
	Status = "status",
}

export type MoveEffect =
	| { kind: "none" }
	| { kind: "priority"; value: number }
	| { kind: "trap" }
	| { kind: "confuse"; turns: number }
	| { kind: "protect" }
	| { kind: "modify-stat"; stat: Exclude<Stat, Stat.HP>; stages: number; target: "self" | "target" }
	| {
			kind: "side-effect";
			effect: "reflect" | "light-screen" | "tailwind";
			turns: number;
			target: "self" | "target";
	  }
	| { kind: "field-effect"; effect: "trick-room"; turns: number }
	| { kind: "apply-status"; status: StatusEffectType; chance: number }
	| { kind: "leech-seed" }
	| { kind: "charge" };

export function isStatusEffectType(value: unknown): value is StatusEffectType {
	return (
		typeof value === "string" && Object.values(StatusEffectType).includes(value as StatusEffectType)
	);
}

export interface Move {
	type: Type;
	class: Class;
	power: number;
	accuracy: number;
	pp: number;
	effect: MoveEffect;
}
