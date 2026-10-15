/**
 * Tests for the command-line middleware: `log()` opens a `command` log or joins the one a host
 * already opened, publishes it as `ctx.log` and for `currentLog()`, and records the command's
 * path, duration and the exit code of a run that throws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { command, commands, createCLI, ExitError, success, usage } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { CurrentLog, log } from "./cli.js";
import { createLogger } from "./create-logger.js";
import { currentLog } from "./current.js";
import { Log } from "./log.js";

const CONTRACT = commands({
	users: commands({ find: command({ description: "Find a user" }) }),
});

/** A logger whose records land in an array the test reads. */
function collectingLogger() {
	let records: Record<string, unknown>[] = [];
	let logger = createLogger({ service: "app", sink: (record) => void records.push(record) });
	return { logger, records };
}

describe("log()", () => {
	test("opens a command log, publishes ctx.log, and records the command path", async () => {
		let { logger, records } = collectingLogger();
		let cli = createCLI({ name: "app", commands: CONTRACT, middleware: [log(logger)] });
		cli.map(CONTRACT.users.find, (ctx) => {
			ctx.log.set({ user: { id: "u1" } });
			currentLog()?.inc("db.count");
			expect(ctx.get(CurrentLog)).toBe(ctx.log);
			return success();
		});

		let run = await invoke(cli, ["users", "find"]);

		expect(run.code).toBe(0);
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({
			service: "app",
			kind: "command",
			"command.path": "users find",
			"user.id": "u1",
			"db.count": 1,
			outcome: "ok",
		});
		expect(records[0]?.duration_ms).toEqual(expect.any(Number));
	});

	test("fails the log and records the exit code of a run that throws", async () => {
		let { logger, records } = collectingLogger();
		let cli = createCLI({ name: "app", commands: CONTRACT, middleware: [log(logger)] });
		cli.map(CONTRACT.users.find, () => {
			throw new ExitError(3, "no such user");
		});

		let run = await invoke(cli, ["users", "find"]);

		expect(run.code).toBe(3);
		expect(records[0]).toMatchObject({
			kind: "command",
			"command.path": "users find",
			"command.exit_code": 3,
			"error.type": "ExitError",
			outcome: "error",
		});
	});

	test("fails the log and records the exit code of a run that answers a failure", async () => {
		let { logger, records } = collectingLogger();
		let cli = createCLI({ name: "app", commands: CONTRACT, middleware: [log(logger)] });
		cli.map(CONTRACT.users.find, () => usage("Name a user"));

		let run = await invoke(cli, ["users", "find"]);

		expect(run.code).toBe(2);
		expect(records[0]).toMatchObject({
			"command.exit_code": 2,
			"error.type": "UsageError",
			outcome: "error",
		});
	});

	test("joins the log a host already opened, recording the run's duration on it", async () => {
		let { logger, records } = collectingLogger();
		let emitted: Record<string, unknown>[] = [];
		let host = new Log({ kind: "job", sink: (record) => void emitted.push(record) });
		let cli = createCLI({ name: "app", commands: CONTRACT, middleware: [log(logger)] });
		cli.map(CONTRACT.users.find, (ctx) => {
			expect(ctx.log).toBe(host);
			return success();
		});

		let run = await host.run(() => invoke(cli, ["users", "find"]));

		expect(run.code).toBe(0);
		expect(records).toHaveLength(0);
		expect(emitted).toHaveLength(1);
		expect(emitted[0]).toMatchObject({ kind: "job", "command.path": "users find" });
		expect(emitted[0]?.["command.duration_ms"]).toEqual(expect.any(Number));
	});
});
