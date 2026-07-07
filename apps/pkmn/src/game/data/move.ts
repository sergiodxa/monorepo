/**
 * Central move data contracts used by the game data layer. This module defines
 * the identifiers, enums, and effect shapes that describe how move records are
 * represented once loaded into the engine.
 *
 * It provides the shared vocabulary for move behavior without embedding any
 * specific content entries, allowing other parts of the system to read, validate,
 * and apply move data through stable, content-agnostic types.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Stat } from "./stat";

/** String identifier of a move in loaded game data. */
export type MoveId = string;

export enum StatusEffectType {
	Burn = "burn",
	Paralysis = "paralysis",
	Poison = "poison",
	Sleep = "sleep",
	Freeze = "freeze",
}

export enum DamageClass {
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
	| { kind: "force-switch-target" }
	| { kind: "switch-self"; preserveStatStages?: boolean }
	| { kind: "partial-trap"; turns: number }
	| { kind: "confuse"; turns: number }
	| { kind: "flinch"; chance: number }
	| { kind: "taunt"; turns: number }
	| { kind: "encore"; turns: number }
	| { kind: "disable"; turns: number; slot: 0 | 1 | 2 | 3 }
	| { kind: "identify" }
	| { kind: "attract" }
	| { kind: "follow-me" }
	| { kind: "protect" }
	| { kind: "endure" }
	| { kind: "destiny-bond" }
	| { kind: "charged-electric" }
	| { kind: "focus-energy" }
	| { kind: "aqua-ring" }
	| { kind: "healing-wish" }
	| { kind: "curse" }
	| { kind: "cannot-ko" }
	| { kind: "belly-drum" }
	| { kind: "first-turn-only" }
	| { kind: "break-protect" }
	| { kind: "crash-on-miss"; ratio: number }
	| { kind: "rampage"; turns: number }
	| { kind: "multi-hit"; hits: number | [number, number] }
	| { kind: "ohko" }
	| { kind: "power-from-held-item" }
	| { kind: "fixed-damage"; value: number }
	| { kind: "fixed-damage"; amount: "user-level" | "half-target-hp" }
	| { kind: "fixed-damage-user-hp" }
	| { kind: "recoil"; ratio: number }
	| { kind: "heal"; ratio: number }
	| { kind: "drain"; ratio: number; requiresSleepingTarget?: boolean }
	| { kind: "self-destruct" }
	| { kind: "reset-stat-stages"; target: "self" | "target" | "all-active" }
	| { kind: "clear-side-effects"; target: "self" | "target" | "both"; effects: SideEffectType[] }
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
	| {
			kind: "apply-status";
			status: StatusEffectType;
			chance: number;
			poisonVariant?: "regular" | "escalating";
	  }
	| { kind: "leech-seed" }
	| {
			kind:
				| "double-power-on-damaged-target"
				| "double-power-if-target-damaged-this-turn"
				| "double-power-on-status-target"
				| "power-from-target-speed"
				| "power-from-user-speed"
				| "power-from-user-hp"
				| "power-from-weight";
	  }
	| { kind: "counter-last-physical-hit" }
	| { kind: "counter-last-special-hit"; ratio: number }
	| { kind: "counter-last-any-hit"; ratio: number }
	| { kind: "fixed-damage-target-hp-gap" }
	| { kind: "boost-on-ko"; stat: BattleStatStage; stages: number }
	| { kind: "fail-if-user-damaged-this-turn" }
	| { kind: "delayed-attack"; turns: number }
	| { kind: "charge"; invulnerable?: boolean };

export function isStatusEffectType(value: unknown): value is StatusEffectType {
	return (
		typeof value === "string" && Object.values(StatusEffectType).includes(value as StatusEffectType)
	);
}

export interface Move {
	type: string;
	damageClass: DamageClass;
	power: number;
	accuracy: number;
	pp: number;
	criticalHitStages?: number;
	effect: MoveEffect;
}
