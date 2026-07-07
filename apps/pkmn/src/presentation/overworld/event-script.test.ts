/**
 * Verifies the resumable command interpreter drives host effects in order.
 *
 * A run executes synchronous commands (control-switch, control-self-switch,
 * give-item, heal-party, face-player, move) back-to-back and parks on a blocking
 * command (text, show-choices, the battle commands, wait, warp) until the host
 * calls `resume()`, then continues. `show-choices` resumes with a picked index and
 * runs that branch's commands; `conditional-branch` runs its `then`/`else` against
 * the injected flag context (a `selfSwitch` condition reading the interacting
 * event's namespaced flag). A warp blocks and is never resumed (the map reload
 * replaces the runner). The runner forwards authored data to the host and assigns
 * no meaning itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { EventCommand } from "../render/map-schema";

import { EventCommandRunner, type EventCommandHost, type EventFlagContext } from "./event-script";

/** A host that records every effect call so a test can assert order. */
function recordingHost() {
	let calls: string[] = [];
	let host: EventCommandHost = {
		showText: (text) => void calls.push(`text:${text}`),
		showChoices: (prompt, labels) => void calls.push(`choices:${prompt ?? ""}:${labels.join(",")}`),
		controlSwitch: (flag, value) => void calls.push(`switch:${flag}:${value}`),
		controlSelfSwitch: (flag, value) => void calls.push(`self:${flag}:${value}`),
		giveItem: (itemId, count) => void calls.push(`give:${itemId}:${count}`),
		healParty: () => void calls.push("heal"),
		facePlayer: () => void calls.push("face"),
		move: (steps) => void calls.push(`move:${steps.join(",")}`),
		startTrainerBattle: (trainer) => void calls.push(`trainer:${trainer.name ?? "?"}`),
		startWildBattle: (speciesId, level) => void calls.push(`wild:${speciesId}:${level}`),
		wait: (frames) => void calls.push(`wait:${frames}`),
		warp: (map, x, y) => void calls.push(`warp:${map}:${x}:${y}`),
	};
	return { host, calls };
}

/** A flag context reading the given set of on-flags, namespacing self-switches by name. */
function flagContext(onFlags: Set<string> = new Set()): EventFlagContext {
	return {
		isFlagOn: (flag) => onFlags.has(flag),
		selfSwitchFlag: (name) => `self:${name}`,
	};
}

/** Builds a runner over the given commands with a recording host and flag context. */
function runnerFor(commands: EventCommand[], onFlags?: Set<string>) {
	let { host, calls } = recordingHost();
	let runner = new EventCommandRunner(commands, host, flagContext(onFlags));
	return { runner, calls };
}

test("a list of synchronous commands runs to completion in one advance", () => {
	let commands: EventCommand[] = [
		{ kind: "control-switch", flag: "seen", value: true },
		{ kind: "give-item", itemId: "POTION", count: 2 },
		{ kind: "heal-party" },
	];
	let { runner, calls } = runnerFor(commands);

	runner.advance();

	expect(runner.done).toBe(true);
	expect(calls).toEqual(["switch:seen:true", "give:POTION:2", "heal"]);
});

test("text blocks the runner until the host resumes it", () => {
	let commands: EventCommand[] = [
		{ kind: "text", text: "Hello!" },
		{ kind: "control-switch", flag: "greeted", value: true },
	];
	let { runner, calls } = runnerFor(commands);

	runner.advance();
	expect(runner.blocked).toBe(true);
	expect(calls).toEqual(["text:Hello!"]);

	// Advancing again while blocked is a no-op: the switch must not run early.
	runner.advance();
	expect(calls).toEqual(["text:Hello!"]);

	runner.resume();
	expect(runner.done).toBe(true);
	expect(calls).toEqual(["text:Hello!", "switch:greeted:true"]);
});

test("commands after text run in order once each message is dismissed", () => {
	let commands: EventCommand[] = [
		{ kind: "face-player" },
		{ kind: "text", text: "A" },
		{ kind: "text", text: "B" },
		{ kind: "control-switch", flag: "done", value: true },
	];
	let { runner, calls } = runnerFor(commands);

	runner.advance();
	expect(calls).toEqual(["face", "text:A"]);
	runner.resume();
	expect(calls).toEqual(["face", "text:A", "text:B"]);
	runner.resume();
	expect(runner.done).toBe(true);
	expect(calls).toEqual(["face", "text:A", "text:B", "switch:done:true"]);
});

test("show-choices blocks, then runs the picked branch's commands on resume", () => {
	let commands: EventCommand[] = [
		{
			kind: "show-choices",
			prompt: "Well?",
			choices: [
				{ label: "Yes", commands: [{ kind: "control-switch", flag: "yes", value: true }] },
				{ label: "No", commands: [{ kind: "control-switch", flag: "no", value: true }] },
			],
		},
	];
	let { runner, calls } = runnerFor(commands);

	runner.advance();
	expect(runner.blocked).toBe(true);
	expect(calls).toEqual(["choices:Well?:Yes,No"]);

	runner.resume(1); // pick "No"
	expect(runner.done).toBe(true);
	expect(calls).toEqual(["choices:Well?:Yes,No", "switch:no:true"]);
});

test("conditional-branch runs then when its switch holds and else otherwise", () => {
	let build = (): EventCommand[] => [
		{
			kind: "conditional-branch",
			condition: { switch: "flag" },
			then: [{ kind: "text", text: "then" }],
			else: [{ kind: "text", text: "else" }],
		},
	];

	let held = runnerFor(build(), new Set(["flag"]));
	held.runner.advance();
	expect(held.calls).toEqual(["text:then"]);

	let missed = runnerFor(build(), new Set());
	missed.runner.advance();
	expect(missed.calls).toEqual(["text:else"]);
});

test("conditional-branch reads a selfSwitch condition through the namespaced flag", () => {
	let commands: EventCommand[] = [
		{
			kind: "conditional-branch",
			condition: { selfSwitch: "A" },
			then: [{ kind: "text", text: "open" }],
		},
	];
	// The context namespaces "A" to "self:A"; only that flag being on makes the branch hold.
	let { runner, calls } = runnerFor(commands, new Set(["self:A"]));

	runner.advance();
	expect(calls).toEqual(["text:open"]);
});

test("conditional-branch with no else and a false condition runs nothing", () => {
	let commands: EventCommand[] = [
		{
			kind: "conditional-branch",
			condition: { switch: "off" },
			then: [{ kind: "text", text: "x" }],
		},
	];
	let { runner, calls } = runnerFor(commands);

	runner.advance();
	expect(runner.done).toBe(true);
	expect(calls).toEqual([]);
});

test("control-self-switch forwards the namespaced flag and its value", () => {
	let commands: EventCommand[] = [{ kind: "control-self-switch", name: "A", value: true }];
	let { runner, calls } = runnerFor(commands);

	runner.advance();
	expect(runner.done).toBe(true);
	expect(calls).toEqual(["self:self:A:true"]);
});

test("a trainer battle command blocks and forwards its party, resuming after", () => {
	let commands: EventCommand[] = [
		{ kind: "text", text: "Fight me!" },
		{
			kind: "start-trainer-battle",
			trainer: { name: "Rival", party: [{ speciesId: "RATTATA", level: 5 }] },
		},
		{ kind: "control-switch", flag: "beat-rival", value: true },
	];
	let { runner, calls } = runnerFor(commands);

	runner.advance();
	runner.resume(); // dismiss the message → starts the battle, blocks again
	expect(runner.blocked).toBe(true);
	expect(calls).toEqual(["text:Fight me!", "trainer:Rival"]);

	runner.resume(); // battle ended
	expect(runner.done).toBe(true);
	expect(calls).toEqual(["text:Fight me!", "trainer:Rival", "switch:beat-rival:true"]);
});

test("a wild-encounter command blocks and forwards its species and level", () => {
	let commands: EventCommand[] = [{ kind: "wild-encounter", speciesId: "MEWTWO", level: 70 }];
	let { runner, calls } = runnerFor(commands);

	runner.advance();
	expect(runner.blocked).toBe(true);
	expect(calls).toEqual(["wild:MEWTWO:70"]);

	runner.resume();
	expect(runner.done).toBe(true);
});

test("a give-item and heal-party dispatch to the host synchronously", () => {
	let commands: EventCommand[] = [
		{ kind: "give-item", itemId: "MASTER_BALL", count: 1 },
		{ kind: "heal-party" },
		{ kind: "move", steps: ["up", "left"] },
	];
	let { runner, calls } = runnerFor(commands);

	runner.advance();
	expect(runner.done).toBe(true);
	expect(calls).toEqual(["give:MASTER_BALL:1", "heal", "move:up,left"]);
});

test("wait blocks for its frames and resumes into the next command", () => {
	let commands: EventCommand[] = [
		{ kind: "wait", frames: 30 },
		{ kind: "control-switch", flag: "after-wait", value: true },
	];
	let { runner, calls } = runnerFor(commands);

	runner.advance();
	expect(runner.blocked).toBe(true);
	expect(calls).toEqual(["wait:30"]);

	runner.resume();
	expect(runner.done).toBe(true);
	expect(calls).toEqual(["wait:30", "switch:after-wait:true"]);
});

test("a warp blocks and ends the run without resuming", () => {
	let commands: EventCommand[] = [{ kind: "warp", map: "town", x: 5, y: 12 }];
	let { runner, calls } = runnerFor(commands);

	runner.advance();
	expect(runner.blocked).toBe(true);
	expect(calls).toEqual(["warp:town:5:12"]);
});
