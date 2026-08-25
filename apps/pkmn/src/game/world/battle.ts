/**
 * Bridges battle-specific state into the world layer so one battle entity
 * carries the participants, phase, sides, pending requests, logs, and
 * per-combatant data that selectors and other world systems read, while the
 * underlying battle runtime stays encapsulated.
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
	playerId: PlayerId;
	enemyId: PlayerId;
	playerParty: CreatureId[];
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
	turn: number;
	phase: BattleState["phase"];
	/** Winning side when the battle has finished. */
	winnerSide: number | null;
	slots: 1 | 2 | 3;
}

/** Shared field state mirrored for selectors. */
export interface BattleFieldComponent extends FieldEffectState {}

/** Per-side battle state mirrored for selectors. */
export interface BattleSideComponent {
	battleId: BattleId;
	side: number;
	canLeaveBattle: boolean;
	pendingHealingWishCount: number;
	followMeUserSlot: number | null;
	slotTeams: number[];
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
	battleId: BattleId;
	creatureId: CreatureId;
	side: number;
	teamIndex: number;
	creatureIndex: number;
	/** Active slot when currently on the field. */
	activeSlot: number | null;
	/** Whether the team holding this member has been eliminated. */
	eliminated: boolean;
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
 * Copies player-side combatant results into persistent stores because battles
 * run on cloned aggregates. Downgrades escalating (toxic) poison to regular
 * poison per the Gen 3 battle-end rule, walking the player side in flat order.
 */
export function writeBackPlayerBattleResults(
	world: World,
	runtime: BattleRuntimeHandle,
	battleId: BattleId,
) {
	let participants = requireComponent(world.battleParticipants, battleId, "battle participants");
	let playerSide = runtime.battle.state.sides[0];
	if (!playerSide) return;

	let partyIndex = 0;
	for (let team of playerSide.teams) {
		for (let combatant of team.creatures) {
			let creatureId = participants.playerParty[partyIndex];
			partyIndex += 1;
			if (!creatureId) continue;

			let status = combatant.creature.status;
			world.creatureHealth[creatureId] = { damage: status.damage };

			let poison = status.poison === "escalating" ? "regular" : status.poison;
			world.creatureStatus[creatureId] =
				poison && status.state !== null ? { state: status.state, poison } : { state: status.state };

			let moves = world.creatureMoves[creatureId];
			if (moves) {
				world.creatureMoves[creatureId] = {
					moveset: [...moves.moveset],
					pp: [...status.pp] as [number, number, number, number],
				};
			}
		}
	}
}

/**
 * Deletes every transient mirror component and entity id for one finished
 * battle. Runs only once the presentation finishes animating the ending, so
 * selectBattle can read the enemy meanwhile; mirrors carry no save value.
 */
export function cleanupBattle(world: World, battleId: BattleId) {
	let removedIds = new Set<string>([battleId]);

	let participants = getComponent(world.battleParticipants, battleId);
	for (let enemyId of participants?.enemyParty ?? []) {
		let kind = world.creatureLocation[enemyId]?.kind;
		if ((kind === "encounter" || kind === "trainer") && !world.ownership[enemyId]) {
			removeComponent(world.creatureIdentity, enemyId);
			removeComponent(world.creatureProgress, enemyId);
			removeComponent(world.creatureMoves, enemyId);
			removeComponent(world.creatureHealth, enemyId);
			removeComponent(world.creatureStatus, enemyId);
			removeComponent(world.creatureLocation, enemyId);
			removeComponent(world.ownership, enemyId);
			removedIds.add(enemyId);
		}
	}

	removeComponent(world.battleParticipants, battleId);
	removeComponent(world.battlePhase, battleId);
	removeComponent(world.battleField, battleId);
	removeComponent(world.battleLog, battleId);
	removeComponent(world.battlePendingTurn, battleId);
	removeComponent(world.battlePendingReplacement, battleId);

	for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
		let sideEntityId = getBattleSideEntityId(battleId, sideIndex);
		if (world.battleSide[sideEntityId]) {
			removeComponent(world.battleSide, sideEntityId);
			removedIds.add(sideEntityId);
		}
	}

	for (let memberId of Object.keys(world.battleMember)) {
		if (world.battleMember[memberId]?.battleId === battleId) {
			removeComponent(world.battleMember, memberId);
			removedIds.add(memberId);
		}
	}

	for (let playerId of Object.keys(world.activeBattle)) {
		if (world.activeBattle[playerId]?.battleId === battleId) {
			removeComponent(world.activeBattle, playerId);
		}
	}

	world.entities = world.entities.filter((entityId) => !removedIds.has(entityId));
}

/**
 * Mirrors one battle step into ECS stores so selectors stay world-driven
 * while the resolver lives in the generator runtime. Creature indices use
 * one running offset per side, since the party array is flat across teams.
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

		let creatureIds = sideIndex === 0 ? participants.playerParty : participants.enemyParty;
		let partyIndex = 0;

		for (let teamIndex = 0; teamIndex < side.teams.length; teamIndex += 1) {
			let team = side.teams[teamIndex]!;

			for (let creatureIndex = 0; creatureIndex < team.creatures.length; creatureIndex += 1) {
				let creatureId = creatureIds[partyIndex]!;
				partyIndex += 1;
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
 * Returns the active slot index for one team member, if it is currently
 * on the field. The mirror stores occupancy explicitly, since selectors
 * need to know who is active, beyond which team owns a combatant.
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
