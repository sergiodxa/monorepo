import type { MoveEffect, StatusEffectType } from "../domain/move";

import { Stat } from "../domain/stat";

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

	/** Applies the recharge volatile so the user must skip its next action. */
	static recharge(
		_effect: Extract<MoveEffect, { kind: "recharge" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.user.volatile.recharging = true;
		return [{ type: "volatile-applied", target: context.userPosition, effect: "recharge" }];
	}

	/** Prevents the target from leaving the battle. */
	static trap(
		_effect: Extract<MoveEffect, { kind: "trap" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.target.volatile.trapped = true;
		return [{ type: "volatile-applied", target: context.targetPosition, effect: "trap" }];
	}

	/** Leaves forced switching to battle resolution. */
	static forceSwitchTarget(
		_effect: Extract<MoveEffect, { kind: "force-switch-target" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves self-switching to battle resolution. */
	static switchSelf(
		_effect: Extract<MoveEffect, { kind: "switch-self" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
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
		if (effect.chance < 1 && context.random() >= effect.chance) return [];
		context.target.volatile.flinched = true;
		return [{ type: "volatile-applied", target: context.targetPosition, effect: "flinch" }];
	}

	/** Prevents the target from using status moves for a fixed number of turns. */
	static taunt(
		effect: Extract<MoveEffect, { kind: "taunt" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.target.volatile.tauntedTurns = effect.turns;
		return [{ type: "volatile-applied", target: context.targetPosition, effect: "taunt" }];
	}

	/** Forces the target to repeat its last successfully chosen move. */
	static encore(
		effect: Extract<MoveEffect, { kind: "encore" }>,
		context: Effects.Context,
	): BattleEvent[] {
		if (context.target.volatile.lastMoveSlot === null) return [];
		context.target.volatile.encoreTurns = effect.turns;
		context.target.volatile.encoredMoveSlot = context.target.volatile.lastMoveSlot;
		return [{ type: "volatile-applied", target: context.targetPosition, effect: "encore" }];
	}

	/** Disables one move slot on the target for a fixed number of turns. */
	static disable(
		effect: Extract<MoveEffect, { kind: "disable" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.target.volatile.disabledMoveSlot = effect.slot;
		context.target.volatile.disableTurns = effect.turns;
		return [{ type: "volatile-applied", target: context.targetPosition, effect: "disable" }];
	}

	/** Marks the target as identified so ghost-type immunities can be ignored. */
	static identify(
		_effect: Extract<MoveEffect, { kind: "identify" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.target.volatile.identified = true;
		return [{ type: "volatile-applied", target: context.targetPosition, effect: "identify" }];
	}

	/** Applies attraction to the target. */
	static attract(
		_effect: Extract<MoveEffect, { kind: "attract" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.target.volatile.attracted = true;
		return [{ type: "volatile-applied", target: context.targetPosition, effect: "attract" }];
	}

	/** Marks the user as the redirection target for opposing attacks this turn. */
	static followMe(
		_effect: Extract<MoveEffect, { kind: "follow-me" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.sides[context.userPosition.side]!.followMeUserSlot = context.userPosition.slot;
		return [];
	}

	/** Applies protection to the user for the rest of the turn. */
	static protect(
		_effect: Extract<MoveEffect, { kind: "protect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.user.volatile.protecting = true;
		return [{ type: "volatile-applied", target: context.userPosition, effect: "protect" }];
	}

	/** Applies endurance to the user for the rest of the turn. */
	static endure(
		_effect: Extract<MoveEffect, { kind: "endure" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.user.volatile.enduring = true;
		return [{ type: "volatile-applied", target: context.userPosition, effect: "endure" }];
	}

	/** Applies Destiny Bond to the user until its next action or switch. */
	static destinyBond(
		_effect: Extract<MoveEffect, { kind: "destiny-bond" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.user.volatile.destinyBonded = true;
		return [{ type: "volatile-applied", target: context.userPosition, effect: "destiny-bond" }];
	}

	/** Marks the user so its next Electric move is empowered. */
	static chargedElectric(
		_effect: Extract<MoveEffect, { kind: "charged-electric" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.user.volatile.chargedElectric = true;
		return [{ type: "volatile-applied", target: context.userPosition, effect: "charged-electric" }];
	}

	/** Raises the user's critical-hit ratio for later attacks. */
	static focusEnergy(
		_effect: Extract<MoveEffect, { kind: "focus-energy" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.user.volatile.focusEnergy = true;
		return [{ type: "volatile-applied", target: context.userPosition, effect: "focus-energy" }];
	}

	/** Applies Aqua Ring healing to the user until it switches out. */
	static aquaRing(
		_effect: Extract<MoveEffect, { kind: "aqua-ring" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.user.volatile.aquaRing = true;
		return [{ type: "volatile-applied", target: context.userPosition, effect: "aqua-ring" }];
	}

	/** Marks the side so the next switch-in is restored by Healing Wish. */
	static healingWish(
		_effect: Extract<MoveEffect, { kind: "healing-wish" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.state.sides[context.userPosition.side]!.pendingHealingWishCount += 1;
		return [];
	}

	/** Leaves Curse's split Ghost/non-Ghost behavior to battle resolution. */
	static curse(
		_effect: Extract<MoveEffect, { kind: "curse" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves Belly Drum's HP cost and stat update to battle resolution. */
	static bellyDrum(
		_effect: Extract<MoveEffect, { kind: "belly-drum" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves HP-floor handling to damage resolution. */
	static cannotKO(
		_effect: Extract<MoveEffect, { kind: "cannot-ko" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Removes protection from the target before later effects resolve. */
	static breakProtect(
		_effect: Extract<MoveEffect, { kind: "break-protect" }>,
		context: Effects.Context,
	): BattleEvent[] {
		context.target.volatile.protecting = false;
		return [];
	}

	/** Leaves first-turn gating to pre-move resolution. */
	static firstTurnOnly(
		_effect: Extract<MoveEffect, { kind: "first-turn-only" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves locked-turn rampage handling to move resolution. */
	static rampage(
		_effect: Extract<MoveEffect, { kind: "rampage" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves miss crash handling to battle resolution. */
	static crashOnMiss(
		_effect: Extract<MoveEffect, { kind: "crash-on-miss" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
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

	/** Leaves user-HP fixed damage handling to damage resolution. */
	static fixedDamageUserHP(
		_effect: Extract<MoveEffect, { kind: "fixed-damage-user-hp" }>,
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

	/** Leaves drain healing to post-damage resolution. */
	static drain(
		_effect: Extract<MoveEffect, { kind: "drain" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves user KO handling to post-damage resolution. */
	static selfDestruct(
		_effect: Extract<MoveEffect, { kind: "self-destruct" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Resets temporary stat stages for the chosen combatants. */
	static resetStatStages(
		effect: Extract<MoveEffect, { kind: "reset-stat-stages" }>,
		context: Effects.Context,
	): BattleEvent[] {
		if (effect.target === "all-active") {
			let events: BattleEvent[] = [];
			for (let [sideIndex, side] of context.state.sides.entries()) {
				for (let [slotIndex, active] of side.active.entries()) {
					if (!active) continue;
					events.push(
						...Effects.resetCombatantStatStages(active.combatant, {
							side: sideIndex,
							slot: slotIndex,
						}),
					);
				}
			}
			return events;
		}

		let combatant = effect.target === "self" ? context.user : context.target;
		let position = effect.target === "self" ? context.userPosition : context.targetPosition;
		return Effects.resetCombatantStatStages(combatant, position);
	}

	/** Clears selected side effects from one or both sides. */
	static clearSideEffects(
		effect: Extract<MoveEffect, { kind: "clear-side-effects" }>,
		context: Effects.Context,
	): BattleEvent[] {
		let sides =
			effect.target === "both"
				? [0, 1]
				: [effect.target === "self" ? context.userPosition.side : context.targetPosition.side];
		let events: BattleEvent[] = [];

		for (let sideIndex of sides) {
			let side = context.state.sides[sideIndex]!;
			for (let cleared of effect.effects) {
				if (Effects.clearSideEffect(side.effects, cleared) === false) continue;
				events.push({ type: "side-effect-applied", side: sideIndex, effect: cleared, turns: 0 });
			}
		}

		return events;
	}

	/** Mutates one combatant stat stage and reports the resulting value. */
	static modifyStat(
		effect: Extract<MoveEffect, { kind: "modify-stat" }>,
		context: Effects.Context,
	): BattleEvent[] {
		let combatant = effect.target === "self" ? context.user : context.target;
		let position = effect.target === "self" ? context.userPosition : context.targetPosition;
		let side = context.state.sides[position.side]!;
		if (effect.target === "target" && effect.stages < 0 && side.effects.mistTurns > 0) return [];
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
			case "safeguard": {
				return Effects.safeguard(effect, context, side);
			}
			case "mist": {
				return Effects.mist(effect, context, side);
			}
			case "lucky-chant": {
				return Effects.luckyChant(effect, context, side);
			}
			case "spikes": {
				return Effects.spikes(effect, context, side);
			}
			case "toxic-spikes": {
				return Effects.toxicSpikes(effect, context, side);
			}
			case "stealth-rock": {
				return Effects.stealthRock(effect, context, side);
			}
			case "sticky-web": {
				return Effects.stickyWeb(effect, context, side);
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
		if (context.state.sides[context.targetPosition.side]!.effects.safeguardTurns > 0) return [];

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

	/** Leaves conditional damage calculations to battle resolution. */
	static doublePowerOnDamagedTarget(
		_effect: Extract<MoveEffect, { kind: "double-power-on-damaged-target" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves status-conditional damage calculations to battle resolution. */
	static doublePowerOnStatusTarget(
		_effect: Extract<MoveEffect, { kind: "double-power-on-status-target" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves speed-based power calculations to battle resolution. */
	static powerFromTargetSpeed(
		_effect: Extract<MoveEffect, { kind: "power-from-target-speed" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves inverse speed-based power calculations to battle resolution. */
	static powerFromUserSpeed(
		_effect: Extract<MoveEffect, { kind: "power-from-user-speed" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves low-HP power calculations to battle resolution. */
	static powerFromUserHP(
		_effect: Extract<MoveEffect, { kind: "power-from-user-hp" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves weight-based power calculations to battle resolution. */
	static powerFromWeight(
		_effect: Extract<MoveEffect, { kind: "power-from-weight" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves this-turn damage checks to battle resolution. */
	static doublePowerIfTargetDamagedThisTurn(
		_effect: Extract<MoveEffect, { kind: "double-power-if-target-damaged-this-turn" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves reflected physical damage to battle resolution. */
	static counterLastPhysicalHit(
		_effect: Extract<MoveEffect, { kind: "counter-last-physical-hit" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves boost-on-KO handling to battle resolution. */
	static boostOnKO(
		_effect: Extract<MoveEffect, { kind: "boost-on-ko" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves Focus Punch interruption checks to battle resolution. */
	static failIfUserDamagedThisTurn(
		_effect: Extract<MoveEffect, { kind: "fail-if-user-damaged-this-turn" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves delayed attack scheduling to battle resolution. */
	static delayedAttack(
		_effect: Extract<MoveEffect, { kind: "delayed-attack" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
	}

	/** Leaves Endeavor-style HP-gap damage calculations to battle resolution. */
	static fixedDamageTargetHPGap(
		_effect: Extract<MoveEffect, { kind: "fixed-damage-target-hp-gap" }>,
		_context: Effects.Context,
	): BattleEvent[] {
		return [];
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
		if (!("turns" in effect)) return [];
		context.state.sides[side]!.effects.reflectTurns = effect.turns;
		return [{ type: "side-effect-applied", side, effect: "reflect", turns: effect.turns }];
	}

	/** Applies Light Screen to one side. */
	static lightScreen(
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
		side: number,
	): BattleEvent[] {
		if (!("turns" in effect)) return [];
		context.state.sides[side]!.effects.lightScreenTurns = effect.turns;
		return [{ type: "side-effect-applied", side, effect: "light-screen", turns: effect.turns }];
	}

	/** Applies Tailwind to one side. */
	static tailwind(
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
		side: number,
	): BattleEvent[] {
		if (!("turns" in effect)) return [];
		context.state.sides[side]!.effects.tailwindTurns = effect.turns;
		return [{ type: "side-effect-applied", side, effect: "tailwind", turns: effect.turns }];
	}

	/** Applies Safeguard to one side. */
	static safeguard(
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
		side: number,
	): BattleEvent[] {
		if (!("turns" in effect)) return [];
		context.state.sides[side]!.effects.safeguardTurns = effect.turns;
		return [{ type: "side-effect-applied", side, effect: "safeguard", turns: effect.turns }];
	}

	/** Applies Mist to one side. */
	static mist(
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
		side: number,
	): BattleEvent[] {
		if (!("turns" in effect)) return [];
		context.state.sides[side]!.effects.mistTurns = effect.turns;
		return [{ type: "side-effect-applied", side, effect: "mist", turns: effect.turns }];
	}

	/** Applies Lucky Chant to one side. */
	static luckyChant(
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
		side: number,
	): BattleEvent[] {
		if (!("turns" in effect)) return [];
		context.state.sides[side]!.effects.luckyChantTurns = effect.turns;
		return [{ type: "side-effect-applied", side, effect: "lucky-chant", turns: effect.turns }];
	}

	/** Adds Spikes layers to one side up to the usual maximum. */
	static spikes(
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
		side: number,
	): BattleEvent[] {
		if (!("layers" in effect)) return [];
		let layers = Math.min(3, context.state.sides[side]!.effects.spikesLayers + effect.layers);
		context.state.sides[side]!.effects.spikesLayers = layers;
		return [{ type: "side-effect-applied", side, effect: "spikes", layers }];
	}

	/** Adds Toxic Spikes layers to one side up to the usual maximum. */
	static toxicSpikes(
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
		side: number,
	): BattleEvent[] {
		if (!("layers" in effect)) return [];
		let layers = Math.min(2, context.state.sides[side]!.effects.toxicSpikesLayers + effect.layers);
		context.state.sides[side]!.effects.toxicSpikesLayers = layers;
		return [{ type: "side-effect-applied", side, effect: "toxic-spikes", layers }];
	}

	/** Places Stealth Rock on one side. */
	static stealthRock(
		_effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
		side: number,
	): BattleEvent[] {
		context.state.sides[side]!.effects.stealthRock = true;
		return [{ type: "side-effect-applied", side, effect: "stealth-rock" }];
	}

	/** Places Sticky Web on one side. */
	static stickyWeb(
		_effect: Extract<MoveEffect, { kind: "side-effect" }>,
		context: Effects.Context,
		side: number,
	): BattleEvent[] {
		context.state.sides[side]!.effects.stickyWeb = true;
		return [{ type: "side-effect-applied", side, effect: "sticky-web" }];
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

	/** Resets one combatant to neutral temporary stat stages and reports every change. */
	private static resetCombatantStatStages(
		combatant: CombatantState,
		position: BattlePosition,
	): BattleEvent[] {
		let events: BattleEvent[] = [];
		let stats = [
			Stat.Attack,
			Stat.Defense,
			Stat.SpecialAttack,
			Stat.SpecialDefense,
			Stat.Speed,
			"accuracy",
			"evasion",
		] as const;

		for (let stat of stats) {
			let value = combatant.statStages[stat];
			if (value === 0) continue;
			combatant.statStages[stat] = 0;
			events.push({
				type: "stat-stage-changed",
				target: position,
				stat,
				stages: -value,
				value: 0,
			});
		}

		return events;
	}

	/** Clears one side effect and returns whether mutable state changed. */
	private static clearSideEffect(
		effects: Effects.Context["state"]["sides"][number]["effects"],
		effect: Extract<MoveEffect, { kind: "clear-side-effects" }>["effects"][number],
	): boolean {
		switch (effect) {
			case "reflect": {
				if (effects.reflectTurns === 0) return false;
				effects.reflectTurns = 0;
				return true;
			}
			case "light-screen": {
				if (effects.lightScreenTurns === 0) return false;
				effects.lightScreenTurns = 0;
				return true;
			}
			case "tailwind": {
				if (effects.tailwindTurns === 0) return false;
				effects.tailwindTurns = 0;
				return true;
			}
			case "safeguard": {
				if (effects.safeguardTurns === 0) return false;
				effects.safeguardTurns = 0;
				return true;
			}
			case "mist": {
				if (effects.mistTurns === 0) return false;
				effects.mistTurns = 0;
				return true;
			}
			case "lucky-chant": {
				if (effects.luckyChantTurns === 0) return false;
				effects.luckyChantTurns = 0;
				return true;
			}
			case "spikes": {
				if (effects.spikesLayers === 0) return false;
				effects.spikesLayers = 0;
				return true;
			}
			case "toxic-spikes": {
				if (effects.toxicSpikesLayers === 0) return false;
				effects.toxicSpikesLayers = 0;
				return true;
			}
			case "stealth-rock": {
				if (effects.stealthRock === false) return false;
				effects.stealthRock = false;
				return true;
			}
			case "sticky-web": {
				if (effects.stickyWeb === false) return false;
				effects.stickyWeb = false;
				return true;
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
	recharge: Effects.recharge,
	trap: Effects.trap,
	"force-switch-target": Effects.forceSwitchTarget,
	"switch-self": Effects.switchSelf,
	"partial-trap": Effects.partialTrap,
	confuse: Effects.confuse,
	flinch: Effects.flinch,
	taunt: Effects.taunt,
	encore: Effects.encore,
	disable: Effects.disable,
	identify: Effects.identify,
	attract: Effects.attract,
	"follow-me": Effects.followMe,
	protect: Effects.protect,
	endure: Effects.endure,
	"destiny-bond": Effects.destinyBond,
	"charged-electric": Effects.chargedElectric,
	"focus-energy": Effects.focusEnergy,
	"aqua-ring": Effects.aquaRing,
	"healing-wish": Effects.healingWish,
	curse: Effects.curse,
	"cannot-ko": Effects.cannotKO,
	"belly-drum": Effects.bellyDrum,
	"first-turn-only": Effects.firstTurnOnly,
	"break-protect": Effects.breakProtect,
	"crash-on-miss": Effects.crashOnMiss,
	rampage: Effects.rampage,
	"multi-hit": Effects.multiHit,
	ohko: Effects.ohko,
	"fixed-damage": Effects.fixedDamage,
	"fixed-damage-user-hp": Effects.fixedDamageUserHP,
	recoil: Effects.recoil,
	drain: Effects.drain,
	"self-destruct": Effects.selfDestruct,
	"reset-stat-stages": Effects.resetStatStages,
	"clear-side-effects": Effects.clearSideEffects,
	"modify-stat": Effects.modifyStat,
	"side-effect": Effects.sideEffect,
	"field-effect": Effects.fieldEffect,
	"apply-status": Effects.applyStatus,
	"leech-seed": Effects.leechSeed,
	"double-power-on-damaged-target": Effects.doublePowerOnDamagedTarget,
	"double-power-on-status-target": Effects.doublePowerOnStatusTarget,
	"power-from-target-speed": Effects.powerFromTargetSpeed,
	"power-from-user-speed": Effects.powerFromUserSpeed,
	"power-from-user-hp": Effects.powerFromUserHP,
	"power-from-weight": Effects.powerFromWeight,
	"double-power-if-target-damaged-this-turn": Effects.doublePowerIfTargetDamagedThisTurn,
	"counter-last-physical-hit": Effects.counterLastPhysicalHit,
	"boost-on-ko": Effects.boostOnKO,
	"fail-if-user-damaged-this-turn": Effects.failIfUserDamagedThisTurn,
	"delayed-attack": Effects.delayedAttack,
	"fixed-damage-target-hp-gap": Effects.fixedDamageTargetHPGap,
	charge: Effects.charge,
};
