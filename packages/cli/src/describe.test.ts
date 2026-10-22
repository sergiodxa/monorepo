/**
 * Tests for the contract as data: `cli.describe()`, `--help --json`, and `cli.check()`, which
 * a tool uses to test a command line against the program without running it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vite-plus/test";

import { argument } from "./argument.js";
import { createCLI } from "./cli.js";
import { command, commands } from "./command.js";
import { flag } from "./flag.js";
import { prompt } from "./prompt.js";
import { invoke } from "./test.js";

/** A program with a group, a prompted argument, value flags, a schema and a hidden command. */
const CONTRACT = commands({
	make: commands({
		description: "Write a file",
		controller: command({
			description: "A controller",
			arguments: {
				name: argument(s.string(), { prompt: prompt.text({ message: "Name?" }) }),
			},
			flags: {
				method: flag.string("method", {
					schema: s.enum_(["get", "post"]),
					default: "get",
					description: "The method",
				}),
				dryRun: flag.boolean("dry-run", { short: "n", description: "Print only" }),
				skip: flag.string("skip", { valueName: "file" }).list(),
			},
			examples: ["make controller posts"],
			tasks: true,
		}),
		secret: command({ description: "Hidden", hidden: true }),
	}),
	routes: command({
		description: "List routes",
		flags: { json: flag.boolean("json", { description: "As JSON" }) },
	}),
});

/** The program under test. */
function program() {
	return createCLI({ name: "sdxc", version: "2026.10.19", commands: CONTRACT });
}

describe("describe", () => {
	test("describes every visible command with its arguments, flags and examples", () => {
		let root = program().describe();
		expect(root?.title).toBe("sdxc");
		expect(root?.commands.map((child) => child.title)).toEqual(["sdxc make", "sdxc routes"]);
		expect(root?.flags.map((flag) => flag.name)).toEqual(["version", "help"]);

		let controller = program().describe(["make", "controller"]);
		expect(controller?.path).toEqual(["make", "controller"]);
		expect(controller?.arguments).toEqual([
			{ name: "name", description: null, required: true, variadic: false, rest: false },
		]);
		expect(controller?.examples).toEqual(["sdxc make controller posts"]);
		expect(controller?.flags.map((flag) => [flag.name, flag.short, flag.builtin])).toEqual([
			["method", null, false],
			["dry-run", "n", false],
			["skip", null, false],
			["progress", null, true],
			["help", "h", true],
		]);
		let method = controller?.flags[0];
		expect(method).toMatchObject({ kind: "string", value: "value", default: "get" });
		expect(controller?.flags[2]).toMatchObject({ list: true, value: "file" });
	});

	test("leaves hidden commands out and answers undefined for a path that names nothing", () => {
		let make = program().describe(["make"]);
		expect(make?.commands.map((child) => child.path.at(-1))).toEqual(["controller"]);
		expect(program().describe(["make", "nothing"])).toBeUndefined();
	});
});

describe("--help --json", () => {
	test("prints the description of the command it follows", async () => {
		let run = await invoke(program(), ["make", "controller", "--help", "--json"]);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual(program().describe(["make", "controller"]));
	});

	test("prints data for a command with its own --json flag too", async () => {
		let run = await invoke(program(), ["routes", "--json", "--help"]);
		expect((JSON.parse(run.stdout) as { title: string }).title).toBe("sdxc routes");
	});

	test("prints the text help when --json comes after --", async () => {
		let run = await invoke(program(), ["routes", "--help", "--", "--json"]);
		expect(run.stdout).toContain("Usage:");
	});
});

describe("check", () => {
	test("accepts a command line the program would run", async () => {
		let checked = await program().check(["make", "controller", "posts", "--method", "post", "-n"]);
		expect(isSuccess(checked) && checked.data.path).toEqual(["make", "controller"]);
	});

	test("accepts a value a terminal run would ask for", async () => {
		expect(isSuccess(await program().check(["make", "controller"]))).toBe(true);
	});

	test("reports every unknown flag, unknown command and rejected value at once", async () => {
		let checked = await program().check([
			"make",
			"controller",
			"posts",
			"--method",
			"put",
			"--force",
		]);
		expect(isFailure(checked) && checked.error.name).toBe("UsageError");
		expect(isFailure(checked) && checked.error.message).toContain("--force");
		expect(isFailure(checked) && checked.error.message).toContain("--method");

		let unknown = await program().check(["make", "contoller"]);
		expect(isFailure(unknown) && unknown.error.message).toContain('did you mean "controller"');
	});

	test("accepts --help on any command, whatever else the line holds", async () => {
		expect(isSuccess(await program().check(["make", "controller", "--help"]))).toBe(true);
	});
});
