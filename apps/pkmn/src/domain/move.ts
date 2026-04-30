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
