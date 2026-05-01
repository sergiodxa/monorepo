import type { MoveEffect, StatusEffectType } from "../domain/move";

import type { BattleEvent, BattlePosition, BattleState } from "./battle";
import type { CombatantState } from "./combatant-state";

import { State } from "./creature";

type Resolver<TKind extends MoveEffect["kind"]> = (
	effect: Extract<MoveEffect, { kind: TKind }>,
	context: Effects.Context,
) => BattleEvent[];

type ResolverMap = {
	[TKind in MoveEffect["kind"]]: Resolver<TKind>;
};

/** Applies authored move effects to mutable battle state and returns emitted events. */
export class Effects {
	/** Resolves any authored move effect by delegating to the matching static method. */
	static resolve(effect: MoveEffect, context: Effects.Context): BattleEvent[] {
		let resolver = RESOLVERS[effect.kind];
		return resolver(effect as never, context);
	}

	/** Leaves battle state unchanged for moves with no secondary behavior. */
	static none(
		_effect: Extract<MoveEffect, { kind: "none" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Resolves each nested effect in order and concatenates their events. */
	static compound(
		effect: Extract<MoveEffect, { kind: "compound" }>,
		context: Effects.Context,
	): BattleEvent[] {
		let events: BattleEvent[] = [];
		for (let nested of effect.effects) {
			events.push(...Effects.resolve(nested, context));
		}
		return events;
	}

	/** Leaves turn-order metadata unchanged because priority is resolved earlier. */
	static priority(
		_effect: Extract<MoveEffect, { kind: "priority" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Prevents the target from leaving the battle. */
	static trap(
		_effect: Extract<MoveEffect, { kind: "trap" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.target.volatile.trapped = true;
		return [{ type: "volatile-applied", target: context.targetPosition, effect: "trap" }];
	}

	/** Applies partial trapping and records which side caused it. */
	static partialTrap(
		effect: Extract<MoveEffect, { kind: "partial-trap" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.target.volatile.trapped = true;
		context.target.volatile.partiallyTrappedTurns = effect.turns;
		context.target.volatile.partialTrapSourceSide = context.userPosition.side;
		return [{ type: "volatile-applied", target: context.targetPosition, effect: "partial-trap" }];
	}

	/** Applies confusion turns to the target. */
	static confuse(
		effect: Extract<MoveEffect, { kind: "confuse" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.target.volatile.confusionTurns = effect.turns;
		return [{ type: "volatile-applied", target: context.targetPosition, effect: "confusion" }];
	}

	/** Applies flinch when the chance roll succeeds. */
	static flinch(
		effect: Extract<MoveEffect, { kind: "flinch" }>,
		context: Effects.Context,
	): BattleEvent[] {
		if (context.random() >= effect.chance) return [];
		context.target.volatile.flinched = true;
		return [{ type: "volatile-applied", target: context.targetPosition, effect: "flinch" }];
	}

	/** Applies protection to the user for the rest of the turn. */
	static protect(
		_effect: Extract<MoveEffect, { kind: "protect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.user.volatile.protecting = true;
		return [{ type: "volatile-applied", target: context.userPosition, effect: "protect" }];
	}

	/** Leaves multi-hit handling to damage resolution. */
	static multiHit(
		_effect: Extract<MoveEffect, { kind: "multi-hit" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves OHKO handling to damage resolution. */
	static ohko(
		_effect: Extract<MoveEffect, { kind: "ohko" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves fixed-damage handling to damage resolution. */
	static fixedDamage(
		_effect: Extract<MoveEffect, { kind: "fixed-damage" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves recoil handling to post-damage resolution. */
	static recoil(
		_effect: Extract<MoveEffect, { kind: "recoil" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Mutates one combatant stat stage and reports the resulting value. */
	static modifyStat(
		effect: Extract<MoveEffect, { kind: "modify-stat" }>,
		context: Effects.Context,
	): BattleEvent[] {
		let combatant = effect.target === "self" ? context.user : context.target;
		let position = effect.target === "self" ? context.userPosition : context.targetPosition;
		let current = combatant.statStages[effect.stat];
		let value = Math.max(-6, Math.min(6, current + effect.stages));
		combatant.statStages[effect.stat] = value;
		return [
			{
				type: "stat-stage-changed",
				target: position,
				stat: effect.stat,
				stages: effect.stages,
				value,
			},
		];
	}

	/** Routes a side-wide effect to its specific implementation. */
	static sideEffect(
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		let side = effect.target === "self" ? context.userPosition.side : context.targetPosition.side;

		switch (effect.effect) {
			case "reflect": {
				return Effects.reflect(effect, context, side);
			}
			case "light-screen": {
				return Effects.lightScreen(effect, context, side);
			}
			case "tailwind": {
				return Effects.tailwind(effect, context, side);
			}
		}
	}

	/** Routes a field-wide effect to its specific implementation. */
	static fieldEffect(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		switch (effect.effect) {
			case "trick-room": {
				return Effects.trickRoom(effect, context);
			}
			case "sun": {
				return Effects.sun(effect, context);
			}
			case "rain": {
				return Effects.rain(effect, context);
			}
			case "sand": {
				return Effects.sand(effect, context);
			}
			case "hail": {
				return Effects.hail(effect, context);
			}
			case "snow": {
				return Effects.snow(effect, context);
			}
			case "fog": {
				return Effects.fog(effect, context);
			}
			case "electric-terrain": {
				return Effects.electricTerrain(effect, context);
			}
			case "grassy-terrain": {
				return Effects.grassyTerrain(effect, context);
			}
			case "misty-terrain": {
				return Effects.mistyTerrain(effect, context);
			}
			case "psychic-terrain": {
				return Effects.psychicTerrain(effect, context);
			}
			case "gravity": {
				return Effects.gravity(effect, context);
			}
			case "wonder-room": {
				return Effects.wonderRoom(effect, context);
			}
			case "magic-room": {
				return Effects.magicRoom(effect, context);
			}
		}
	}

	/** Applies a major status directly to the target creature when possible. */
	static applyStatus(
		effect: Extract<MoveEffect, { kind: "apply-status" }>,
		context: Effects.Context,
	): BattleEvent[] {
		if (context.target.creature.status.state !== null) return [];
		if (effect.chance < 1 && context.random() >= effect.chance) return [];

		let status = Effects.getPersistentStatus(effect.status);
		context.target.creature.status.state = status;
		return [{ type: "status-applied", target: context.targetPosition, status }];
	}

	/** Applies Leech Seed to the target and records the source side. */
	static leechSeed(
		_effect: Extract<MoveEffect, { kind: "leech-seed" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.target.volatile.seeded = true;
		context.target.volatile.seededBy = context.userPosition.side;
		return [{ type: "volatile-applied", target: context.targetPosition, effect: "seed" }];
	}

	/** Leaves charge handling to the move resolution phase before effect dispatch. */
	static charge(
		_effect: Extract<MoveEffect, { kind: "charge" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Applies Reflect to one side. */
	static reflect(
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
		side: number,
	): BattleEvent[] {
		context.state.sides[side]!.effects.reflectTurns = effect.turns;
		return [{ type: "side-effect-applied", side, effect: "reflect", turns: effect.turns }];
	}

	/** Applies Light Screen to one side. */
	static lightScreen(
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
		side: number,
	): BattleEvent[] {
		context.state.sides[side]!.effects.lightScreenTurns = effect.turns;
		return [{ type: "side-effect-applied", side, effect: "light-screen", turns: effect.turns }];
	}

	/** Applies Tailwind to one side. */
	static tailwind(
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
		side: number,
	): BattleEvent[] {
		context.state.sides[side]!.effects.tailwindTurns = effect.turns;
		return [{ type: "side-effect-applied", side, effect: "tailwind", turns: effect.turns }];
	}

	/** Applies Trick Room to the field. */
	static trickRoom(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.trickRoomTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "trick-room", turns: effect.turns }];
	}

	/** Applies sun weather to the field. */
	static sun(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.weather = "sun";
		context.state.field.weatherTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "sun", turns: effect.turns }];
	}

	/** Applies rain weather to the field. */
	static rain(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.weather = "rain";
		context.state.field.weatherTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "rain", turns: effect.turns }];
	}

	/** Applies sand weather to the field. */
	static sand(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.weather = "sand";
		context.state.field.weatherTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "sand", turns: effect.turns }];
	}

	/** Applies hail weather to the field. */
	static hail(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.weather = "hail";
		context.state.field.weatherTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "hail", turns: effect.turns }];
	}

	/** Applies snow weather to the field. */
	static snow(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.weather = "snow";
		context.state.field.weatherTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "snow", turns: effect.turns }];
	}

	/** Applies fog weather to the field. */
	static fog(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.weather = "fog";
		context.state.field.weatherTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "fog", turns: effect.turns }];
	}

	/** Applies Electric Terrain to the field. */
	static electricTerrain(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.terrain = "electric";
		context.state.field.terrainTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "electric-terrain", turns: effect.turns }];
	}

	/** Applies Grassy Terrain to the field. */
	static grassyTerrain(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.terrain = "grassy";
		context.state.field.terrainTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "grassy-terrain", turns: effect.turns }];
	}

	/** Applies Misty Terrain to the field. */
	static mistyTerrain(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.terrain = "misty";
		context.state.field.terrainTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "misty-terrain", turns: effect.turns }];
	}

	/** Applies Psychic Terrain to the field. */
	static psychicTerrain(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.terrain = "psychic";
		context.state.field.terrainTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "psychic-terrain", turns: effect.turns }];
	}

	/** Applies Gravity to the field. */
	static gravity(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.gravityTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "gravity", turns: effect.turns }];
	}

	/** Applies Wonder Room to the field. */
	static wonderRoom(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.wonderRoomTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "wonder-room", turns: effect.turns }];
	}

	/** Applies Magic Room to the field. */
	static magicRoom(
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.field.magicRoomTurns = effect.turns;
		return [{ type: "field-effect-applied", effect: "magic-room", turns: effect.turns }];
	}

	/** Converts a move status effect into the persistent creature state enum. */
	static getPersistentStatus(status: StatusEffectType): State {
		switch (status) {
			case "burn": {
				return State.Burned;
			}
			case "paralysis": {
				return State.Paralyzed;
			}
			case "poison": {
				return State.Poisoned;
			}
			case "sleep": {
				return State.Asleep;
			}
			case "freeze": {
				return State.Frozen;
			}
			default: {
				throw new RangeError(`Unsupported status effect ${String(status)}.`);
			}
		}
	}
}

export namespace Effects {
	/** Mutable battle data exposed to effect implementations. */
	export interface Context {
		user: CombatantState;
		userPosition: BattlePosition;
		target: CombatantState;
		targetPosition: BattlePosition;
		state: BattleState;
		random(): number;
	}
}

const RESOLVERS: ResolverMap = {
	none: Effects.none,
	compound: Effects.compound,
	priority: Effects.priority,
	trap: Effects.trap,
	"partial-trap": Effects.partialTrap,
	confuse: Effects.confuse,
	flinch: Effects.flinch,
	protect: Effects.protect,
	"multi-hit": Effects.multiHit,
	ohko: Effects.ohko,
	"fixed-damage": Effects.fixedDamage,
	recoil: Effects.recoil,
	"modify-stat": Effects.modifyStat,
	"side-effect": Effects.sideEffect,
	"field-effect": Effects.fieldEffect,
	"apply-status": Effects.applyStatus,
	"leech-seed": Effects.leechSeed,
	charge: Effects.charge,
};
