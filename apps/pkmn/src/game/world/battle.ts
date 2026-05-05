/**
 * Bridges battle-specific state into the world layer so a single battle entity can expose the
 * participants, phase, sides, pending requests, logs, and per-combatant data needed by selectors
 * and other world-oriented systems.
 *
 * This module defines the component contracts and helper behavior that let battle runtime data be
 * registered, synchronized, queried, and cleaned up through the same world abstractions used by
 * the rest of the game engine, while keeping the underlying battle runtime encapsulated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type {
	Battle,
	BattleEvent,
	BattlePosition,
	BattleState,
	BattleSession,
} from "~/game/battle/battle";
import type {
	CombatantVolatileState,
	FieldEffectState,
	SideEffectState,
	StatStageState,
} from "~/game/battle/state";
import type { State } from "~/game/data/status";

import type { ComponentStore } from "./helpers";
import type { BattleId, CreatureId, PlayerId } from "./ids";
import type { World } from "./world";

import { createEntityId, ensureEntityRegistered } from "./entity";
import { getComponent, removeComponent, requireComponent } from "./helpers";

/** Participants attached to one battle entity. */
export interface BattleParticipantsComponent {
	/** Player entity on the allied side. */
	playerId: PlayerId;
	/** Opposing entity on the enemy side. */
	enemyId: PlayerId;
	/** Stable creature ids on the allied side. */
	playerParty: CreatureId[];
	/** Stable creature ids on the enemy side. */
	enemyParty: CreatureId[];
}

/** Runtime-only adapter used privately by the engine while the battle ECS is still being migrated. */
export interface BattleRuntimeHandle {
	/** Legacy battle resolver currently backing this battle entity. */
	battle: Battle;
	/** Active generator session used to submit battle input through the engine. */
	session: BattleSession;
}

/** Public battle phase mirrored into world components for selectors. */
export interface BattlePhaseComponent {
	/** Current turn number. */
	turn: number;
	/** Current lifecycle phase. */
	phase: BattleState["phase"];
	/** Winning side when the battle has finished. */
	winnerSide: number | null;
	/** Active battle format slot count. */
	slots: 1 | 2 | 3;
}

/** Shared field state mirrored for selectors. */
export interface BattleFieldComponent extends FieldEffectState {}

/** Per-side battle state mirrored for selectors. */
export interface BattleSideComponent {
	/** Owning battle entity. */
	battleId: BattleId;
	/** Side index in the battle state. */
	side: number;
	/** Whether this side may leave voluntarily. */
	canLeaveBattle: boolean;
	/** Pending Healing Wish count. */
	pendingHealingWishCount: number;
	/** Follow Me slot for the current turn, if any. */
	followMeUserSlot: number | null;
	/** Team index assigned to each active slot. */
	slotTeams: number[];
	/** Side-wide battle effects. */
	effects: SideEffectState;
}

/** Pending turn input mirrored for selectors. */
export interface BattlePendingTurnComponent {
	/** Ordered active slots that must submit a turn command. */
	requests: BattlePosition[];
}

/** Pending replacement input mirrored for selectors. */
export interface BattlePendingReplacementComponent {
	/** Ordered replacement requests that must be resolved. */
	requests: BattleEvent.ReplacementsRequestedEvent["requests"];
}

/** Ordered battle events emitted so far for one battle entity. */
export interface BattleLogComponent {
	/** Entire ordered battle event log for UI rendering. */
	events: BattleEvent[];
}

/** Transient member mirror for one creature participating in battle. */
export interface BattleMemberComponent {
	/** Owning battle entity. */
	battleId: BattleId;
	/** Backing persistent creature entity. */
	creatureId: CreatureId;
	/** Side index in the current battle. */
	side: number;
	/** Team index inside that side. */
	teamIndex: number;
	/** Creature index inside that team. */
	creatureIndex: number;
	/** Active slot when currently on the field. */
	activeSlot: number | null;
	/** Whether the team holding this member has been eliminated. */
	eliminated: boolean;
	/** Mutable damage currently taken in battle. */
	damage: number;
	/** Current persistent-style status shown in selectors. */
	status: State | null;
	/** Temporary battle-only stat stages. */
	statStages: StatStageState;
	/** Temporary battle-only volatile state. */
	volatile: CombatantVolatileState;
}

/** Stores one battle participants component per active battle entity. */
export type BattleParticipantsStore = ComponentStore<BattleParticipantsComponent>;

/** Stores one battle phase component per active battle entity. */
export type BattlePhaseStore = ComponentStore<BattlePhaseComponent>;

/** Stores one shared field component per active battle entity. */
export type BattleFieldStore = ComponentStore<BattleFieldComponent>;

/** Stores one side component per transient side entity. */
export type BattleSideStore = ComponentStore<BattleSideComponent>;

/** Stores one pending turn request component per active battle entity. */
export type BattlePendingTurnStore = ComponentStore<BattlePendingTurnComponent>;

/** Stores one pending replacement component per active battle entity. */
export type BattlePendingReplacementStore = ComponentStore<BattlePendingReplacementComponent>;

/** Stores one ordered event log per active battle entity. */
export type BattleLogStore = ComponentStore<BattleLogComponent>;

/** Stores one transient battle member component per active battle member entity. */
export type BattleMemberStore = ComponentStore<BattleMemberComponent>;

/** Returns the current ordered battle log for one battle id. */
export function getBattleLog(world: World, battleId: BattleId): BattleLogComponent {
	return requireComponent(world.battleLog, battleId, "battle log");
}

/**
 * Mirrors one runtime battle step back into ECS stores after the engine advances the private session.
 *
 * This keeps selectors world-driven even while the underlying turn resolver still lives in the generator
 * runtime. Every call rewrites the public battle mirrors from the authoritative runtime state so UI reads
 * never need to reach into battle internals.
 */
export function syncBattleState(
	world: World,
	runtime: BattleRuntimeHandle,
	battleId: BattleId,
	emittedEvents: BattleEvent[],
) {
	let participants = requireComponent(world.battleParticipants, battleId, "battle participants");
	let state = runtime.battle.state;
	let existingLog = getComponent(world.battleLog, battleId)?.events ?? [];

	world.battleLog[battleId] = { events: [...existingLog, ...emittedEvents] };
	world.battlePhase[battleId] = {
		turn: state.turn,
		phase: state.phase,
		winnerSide: state.winnerSide,
		slots: state.slots,
	};
	world.battleField[battleId] = structuredClone(state.field);

	if (state.phase === "awaiting-turn-input") {
		let requestEvent = emittedEvents.find((event) => event.type === "request-turn-commands");
		world.battlePendingTurn[battleId] = {
			requests:
				requestEvent?.type === "request-turn-commands"
					? structuredClone(requestEvent.requests)
					: [],
		};
		removeComponent(world.battlePendingReplacement, battleId);
	}

	if (state.phase === "awaiting-replacement") {
		let requestEvent = emittedEvents.find((event) => event.type === "request-replacements");
		world.battlePendingReplacement[battleId] = {
			requests:
				requestEvent?.type === "request-replacements" ? structuredClone(requestEvent.requests) : [],
		};
		removeComponent(world.battlePendingTurn, battleId);
	}

	if (state.phase !== "awaiting-turn-input") removeComponent(world.battlePendingTurn, battleId);
	if (state.phase !== "awaiting-replacement")
		removeComponent(world.battlePendingReplacement, battleId);

	for (let sideIndex = 0; sideIndex < state.sides.length; sideIndex += 1) {
		let side = state.sides[sideIndex]!;
		let sideEntityId = getBattleSideEntityId(battleId, sideIndex);
		ensureEntityRegistered(world.entities, sideEntityId);
		world.battleSide[sideEntityId] = {
			battleId,
			side: sideIndex,
			canLeaveBattle: side.canLeaveBattle,
			pendingHealingWishCount: side.pendingHealingWishCount,
			followMeUserSlot: side.followMeUserSlot,
			slotTeams: [...side.slotTeams],
			effects: structuredClone(side.effects),
		};

		for (let teamIndex = 0; teamIndex < side.teams.length; teamIndex += 1) {
			let team = side.teams[teamIndex]!;
			let creatureIds = sideIndex === 0 ? participants.playerParty : participants.enemyParty;

			for (let creatureIndex = 0; creatureIndex < team.creatures.length; creatureIndex += 1) {
				let creatureId = creatureIds[creatureIndex]!;
				let memberEntityId = getBattleMemberEntityId(battleId, sideIndex, teamIndex, creatureIndex);
				let activeSlot = getActiveSlotIndex(state, sideIndex, teamIndex, creatureIndex);
				let combatant = team.creatures[creatureIndex]!;
				ensureEntityRegistered(world.entities, memberEntityId);
				world.battleMember[memberEntityId] = {
					battleId,
					creatureId,
					side: sideIndex,
					teamIndex,
					creatureIndex,
					activeSlot,
					eliminated: team.eliminated,
					damage: combatant.creature.status.damage,
					status: combatant.creature.status.state,
					statStages: structuredClone(combatant.statStages),
					volatile: structuredClone(combatant.volatile),
				};
			}
		}
	}
}

/**
 * Returns the stable entity id for one side mirror within a specific battle.
 *
 * Side entities let selectors and future systems address side-wide effects without depending on array
 * positions as part of the public contract.
 */
export function getBattleSideEntityId(battleId: BattleId, sideIndex: number): string {
	return createEntityId("battle-side", `${battleId}:${sideIndex}`);
}

/**
 * Returns the stable entity id for one transient battle member mirror.
 *
 * The id encodes battle, side, team, and team-local creature index so the mirror can be rebuilt
 * deterministically after each runtime step.
 */
export function getBattleMemberEntityId(
	battleId: BattleId,
	sideIndex: number,
	teamIndex: number,
	creatureIndex: number,
): string {
	return createEntityId(
		"battle-member",
		`${battleId}:member:${sideIndex}:${teamIndex}:${creatureIndex}`,
	);
}

/**
 * Returns the active slot index for one team member, if it is currently on the field.
 *
 * The mirror stores field occupancy explicitly because selectors care about who is active, not just which
 * team owns a combatant.
 */
function getActiveSlotIndex(
	state: BattleState,
	sideIndex: number,
	teamIndex: number,
	creatureIndex: number,
): number | null {
	for (let slotIndex = 0; slotIndex < state.sides[sideIndex]!.active.length; slotIndex += 1) {
		let active = state.sides[sideIndex]!.active[slotIndex];
		if (active?.teamIndex === teamIndex && active.creatureIndex === creatureIndex) return slotIndex;
	}

	return null;
}
