/**
 * Verifies the sequential script runner drives host effects in order.
 *
 * A run executes synchronous commands (set-flag, give-item, heal-party,
 * face-player, move) back-to-back and parks on a blocking `message` until the host
 * resumes it, then continues. A trainer battle command blocks the same way; a
 * warp blocks and is never resumed (the map reload replaces the runner). The
 * runner forwards authored command data to the host and assigns no meaning itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { ScriptCommand } from "../render/map-schema";

import { ScriptRunner, type ScriptHost, type TrainerBattleData } from "./event-script";

/** A host that records every effect call so a test can assert order. */
function recordingHost() {
	let calls: string[] = [];
	let host: ScriptHost = {
		showMessage: (text) => void calls.push(`message:${text}`),
		giveItem: (itemId, count) => void calls.push(`give:${itemId}:${count}`),
		healParty: () => void calls.push("heal"),
		setFlag: (flag) => void calls.push(`flag:${flag}`),
		facePlayer: () => void calls.push("face"),
		move: (route) => void calls.push(`move:${route.join(",")}`),
		startTrainerBattle: (trainerId) => void calls.push(`trainer:${trainerId}`),
		warp: (toMap, toX, toY) => void calls.push(`warp:${toMap}:${toX}:${toY}`),
	};
	return { host, calls };
}

test("a script of synchronous commands runs to completion in one advance", () => {
	let script: ScriptCommand[] = [
		{ do: "set-flag", flag: "seen" },
		{ do: "give-item", itemId: "POTION", count: 2 },
		{ do: "heal-party" },
	];
	let { host, calls } = recordingHost();
	let runner = new ScriptRunner(script, host);

	runner.advance();

	expect(runner.done).toBe(true);
	expect(calls).toEqual(["flag:seen", "give:POTION:2", "heal"]);
});

test("a message blocks the runner until the host resumes it", () => {
	let script: ScriptCommand[] = [
		{ do: "message", text: "Hello!" },
		{ do: "set-flag", flag: "greeted" },
	];
	let { host, calls } = recordingHost();
	let runner = new ScriptRunner(script, host);

	runner.advance();
	expect(runner.blocked).toBe(true);
	expect(calls).toEqual(["message:Hello!"]);

	// Advancing again while blocked is a no-op: the flag must not run early.
	runner.advance();
	expect(calls).toEqual(["message:Hello!"]);

	runner.resume();
	expect(runner.done).toBe(true);
	expect(calls).toEqual(["message:Hello!", "flag:greeted"]);
});

test("commands after a message run in order once dismissed", () => {
	let script: ScriptCommand[] = [
		{ do: "face-player" },
		{ do: "message", text: "A" },
		{ do: "message", text: "B" },
		{ do: "set-flag", flag: "done" },
	];
	let { host, calls } = recordingHost();
	let runner = new ScriptRunner(script, host);

	runner.advance();
	expect(calls).toEqual(["face", "message:A"]);
	runner.resume();
	expect(calls).toEqual(["face", "message:A", "message:B"]);
	runner.resume();
	expect(runner.done).toBe(true);
	expect(calls).toEqual(["face", "message:A", "message:B", "flag:done"]);
});

test("a trainer battle command blocks and forwards its id, resuming after", () => {
	let script: ScriptCommand[] = [
		{ do: "message", text: "Fight me!" },
		{ do: "start-trainer-battle", trainerId: "rival" },
		{ do: "set-flag", flag: "beat-rival" },
	];
	let trainer: TrainerBattleData = { party: [{ speciesId: "RATTATA", level: 5 }] };
	let { host, calls } = recordingHost();
	let runner = new ScriptRunner(script, host, trainer);

	runner.advance();
	runner.resume(); // dismiss the message → starts the battle, blocks again
	expect(runner.blocked).toBe(true);
	expect(calls).toEqual(["message:Fight me!", "trainer:rival"]);

	runner.resume(); // battle ended
	expect(runner.done).toBe(true);
	expect(calls).toEqual(["message:Fight me!", "trainer:rival", "flag:beat-rival"]);
});

test("a warp blocks and ends the run without resuming", () => {
	let script: ScriptCommand[] = [{ do: "warp", toMap: "town", toX: 5, toY: 12 }];
	let { host, calls } = recordingHost();
	let runner = new ScriptRunner(script, host);

	runner.advance();
	expect(runner.blocked).toBe(true);
	expect(calls).toEqual(["warp:town:5:12"]);
});
