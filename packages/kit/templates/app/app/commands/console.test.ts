/**
 * The `console` command, which hands the terminal to Bun's REPL with the app preloaded.
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vite-plus/test";

import { cli } from "~/app/initializers/cli";

/** The REPL's command line, as `console` starts it. */
const REPL = ["bun", "--preload", "./bootstrap/console.ts", "--interactive"];

describe("console", () => {
	test("starts Bun's REPL with bootstrap/console.ts preloaded", async () => {
		let run = await invoke(cli, ["console"], { exec: { [REPL.join(" ")]: { code: 0 } } });

		expect(run.code).toBe(0);
		expect(run.exec.map((call) => call.command)).toEqual([REPL]);
	});

	test("fails when the REPL does", async () => {
		let run = await invoke(cli, ["console"], { exec: { [REPL.join(" ")]: { code: 1 } } });

		expect(run.code).toBe(1);
	});
});
