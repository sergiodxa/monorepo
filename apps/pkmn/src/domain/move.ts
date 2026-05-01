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

/** Mutable battle stat stages that moves can raise or lower. */
export type BattleStatStage = Exclude<Stat, Stat.HP> | "accuracy" | "evasion";

export type SideEffectType =
	| "reflect"
	| "light-screen"
	| "tailwind"
	| "safeguard"
	| "mist"
	| "lucky-chant"
	| "spikes"
	| "toxic-spikes"
	| "stealth-rock"
	| "sticky-web";

export type FieldEffectType =
	| "trick-room"
	| "sun"
	| "rain"
	| "sand"
	| "hail"
	| "snow"
	| "fog"
	| "electric-terrain"
	| "grassy-terrain"
	| "misty-terrain"
	| "psychic-terrain"
	| "gravity"
	| "wonder-room"
	| "magic-room";

export type MoveEffect =
	| { kind: "none" }
	| { kind: "compound"; effects: MoveEffect[] }
	| { kind: "priority"; value: number }
	| { kind: "recharge" }
	| { kind: "trap" }
	| { kind: "partial-trap"; turns: number }
	| { kind: "confuse"; turns: number }
	| { kind: "flinch"; chance: number }
	| { kind: "taunt"; turns: number }
	| { kind: "encore"; turns: number }
	| { kind: "disable"; turns: number; slot: 0 | 1 | 2 | 3 }
	| { kind: "identify" }
	| { kind: "attract" }
	| { kind: "protect" }
	| { kind: "multi-hit"; hits: number | [number, number] }
	| { kind: "ohko" }
	| { kind: "fixed-damage"; value: number }
	| { kind: "recoil"; ratio: number }
	| { kind: "modify-stat"; stat: BattleStatStage; stages: number; target: "self" | "target" }
	| {
			kind: "side-effect";
			effect: "reflect" | "light-screen" | "tailwind" | "safeguard" | "mist" | "lucky-chant";
			turns: number;
			target: "self" | "target";
	  }
	| {
			kind: "side-effect";
			effect: "spikes" | "toxic-spikes";
			layers: number;
			target: "self" | "target";
	  }
	| {
			kind: "side-effect";
			effect: "stealth-rock" | "sticky-web";
			target: "self" | "target";
	  }
	| { kind: "field-effect"; effect: FieldEffectType; turns: number }
	| { kind: "apply-status"; status: StatusEffectType; chance: number }
	| { kind: "leech-seed" }
	| { kind: "charge"; invulnerable?: boolean };

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
