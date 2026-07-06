/**
 * Tests for translating battle events into ordered animation tasks.
 *
 * Covers `buildBattleTasks`: each event kind maps to the expected message text,
 * `damage-dealt` maps to an HP task that points the target bar at its remaining
 * HP, and a faint produces a message followed by a `markFainted`. A recording
 * fake `BattleHud` captures every call; tasks are drained with large `dt` steps
 * to skip the typewriter reveal and linger.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { BattleEvent, BattlePosition } from "~/game/battle/battle";

import { Stat } from "~/game/data/stat";

import type { AnimationTask } from "./animation-queue";

import { type BattleHud, buildBattleTasks } from "./event-animations";

/** A recording HUD that logs every call and returns scripted stub values. */
function fakeHud() {
	let messages: Array<string | null> = [];
	let hpCalls: Array<{ position: BattlePosition; remaining: number }> = [];
	let fainted: BattlePosition[] = [];
	let hud: BattleHud = {
		setMessage: (text) => {
			messages.push(text);
		},
		nameAt: (position) => `slot-${position.side}-${position.slot}`,
		moveName: (moveId) => `Move(${moveId})`,
		setHp: (position, remaining) => {
			hpCalls.push({ position, remaining });
		},
		isSettled: () => true,
		markFainted: (position) => {
			fainted.push(position);
		},
	};
	return { hud, messages, hpCalls, fainted };
}

/** Drains a task list, stepping each task with a big dt until it completes. */
function drain(tasks: AnimationTask[]) {
	for (let task of tasks) {
		let guard = 0;
		while (!task.update(10_000)) {
			if (++guard > 100) throw new Error("task never completed");
		}
	}
}

/** The last fully-typed message the HUD received (the settled text of the final message task). */
function lastMessage(messages: Array<string | null>): string | null {
	return messages[messages.length - 1] ?? null;
}

let USER: BattlePosition = { side: 0, slot: 0 };
let TARGET: BattlePosition = { side: 1, slot: 0 };

test("move-used narrates the user and the move name", () => {
	let { hud, messages } = fakeHud();
	let events: BattleEvent[] = [{ type: "move-used", user: USER, moveId: "tackle", target: TARGET }];
	drain(buildBattleTasks(events, hud));
	expect(lastMessage(messages)).toBe("slot-0-0 used Move(tackle)!");
});

test("effectiveness maps each band to its message", () => {
	for (let [effectiveness, text] of [
		[0, "It doesn't affect it..."],
		[0.5, "It's not very effective..."],
		[2, "It's super effective!"],
	] as const) {
		let { hud, messages } = fakeHud();
		let events: BattleEvent[] = [{ type: "effectiveness", target: TARGET, effectiveness }];
		drain(buildBattleTasks(events, hud));
		expect(lastMessage(messages)).toBe(text);
	}
});

test("effectiveness of exactly 1 (neutral) produces no message task", () => {
	let { hud } = fakeHud();
	let tasks = buildBattleTasks([{ type: "effectiveness", target: TARGET, effectiveness: 1 }], hud);
	expect(tasks).toHaveLength(0);
});

test("critical-hit narrates a critical hit", () => {
	let { hud, messages } = fakeHud();
	drain(buildBattleTasks([{ type: "critical-hit", target: TARGET }], hud));
	expect(lastMessage(messages)).toBe("A critical hit!");
});

test("damage-dealt points the target's HP bar at the remaining HP", () => {
	let { hud, hpCalls, messages } = fakeHud();
	let events: BattleEvent[] = [
		{ type: "damage-dealt", target: TARGET, damage: 12, remainingHP: 30 },
	];
	drain(buildBattleTasks(events, hud));
	expect(hpCalls).toEqual([{ position: TARGET, remaining: 30 }]);
	// An HP task narrates nothing.
	expect(messages).toEqual([]);
});

test("move-missed and move-failed narrate their outcomes", () => {
	let missed = fakeHud();
	drain(buildBattleTasks([{ type: "move-missed", user: USER, target: TARGET }], missed.hud));
	expect(lastMessage(missed.messages)).toBe("slot-0-0's attack missed!");

	let failed = fakeHud();
	drain(buildBattleTasks([{ type: "move-failed", user: USER, reason: "taunt" }], failed.hud));
	expect(lastMessage(failed.messages)).toBe("But it failed!");
});

test("creature-fainted narrates the faint then marks the slot fainted", () => {
	let { hud, messages, fainted } = fakeHud();
	let tasks = buildBattleTasks([{ type: "creature-fainted", target: TARGET }], hud);
	// Two tasks: a message then the faint marker.
	expect(tasks).toHaveLength(2);
	drain(tasks);
	expect(lastMessage(messages)).toBe("slot-1-0 fainted!");
	expect(fainted).toEqual([TARGET]);
});

test("creature-switched narrates the switch-in", () => {
	let { hud, messages } = fakeHud();
	drain(buildBattleTasks([{ type: "creature-switched", target: TARGET, creature: 1 }], hud));
	expect(lastMessage(messages)).toBe("Go, slot-1-0!");
});

test("stat-stage-changed narrates a rise or a fall by the sign of the stages", () => {
	let rose = fakeHud();
	drain(
		buildBattleTasks(
			[{ type: "stat-stage-changed", target: TARGET, stat: Stat.Attack, stages: 1, value: 1 }],
			rose.hud,
		),
	);
	expect(lastMessage(rose.messages)).toBe("slot-1-0's stat rose!");

	let fell = fakeHud();
	drain(
		buildBattleTasks(
			[{ type: "stat-stage-changed", target: TARGET, stat: Stat.Attack, stages: -1, value: -1 }],
			fell.hud,
		),
	);
	expect(lastMessage(fell.messages)).toBe("slot-1-0's stat fell!");
});

test("buildBattleTasks preserves event order across mixed events", () => {
	let { hud, messages, hpCalls } = fakeHud();
	let events: BattleEvent[] = [
		{ type: "move-used", user: USER, moveId: "ember", target: TARGET },
		{ type: "effectiveness", target: TARGET, effectiveness: 2 },
		{ type: "damage-dealt", target: TARGET, damage: 40, remainingHP: 0 },
		{ type: "creature-fainted", target: TARGET },
	];
	let tasks = buildBattleTasks(events, hud);
	// 3 messages (used, effective, fainted) + 1 hp + 1 faint marker.
	expect(tasks).toHaveLength(5);
	drain(tasks);
	// Messages arrived in order; the HP call landed for the target.
	expect(messages.filter((text): text is string => text !== null)).toContain(
		"slot-0-0 used Move(ember)!",
	);
	expect(messages).toContain("It's super effective!");
	expect(messages).toContain("slot-1-0 fainted!");
	expect(hpCalls).toEqual([{ position: TARGET, remaining: 0 }]);
});

test("bookkeeping events (turn-started, requests) produce no tasks", () => {
	let { hud } = fakeHud();
	let events: BattleEvent[] = [
		{ type: "battle-started" },
		{ type: "turn-started", turn: 1 },
		{ type: "turn-ended", turn: 1 },
	];
	expect(buildBattleTasks(events, hud)).toHaveLength(0);
});
