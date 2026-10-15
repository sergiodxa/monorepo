/**
 * Tests for the `spec` command line: exit codes and human output for
 * passing suites, failing expectations, permission denials, usage errors, and
 * unreadable suite directories — driven through `invoke()` with both streams captured.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import type { InvokeOptions } from "@sdxc/cli/test";

import { invoke } from "@sdxc/cli/test";
import { afterEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

const CREATED_DIRS: string[] = [];

afterEach(async () => {
	for (let dir of CREATED_DIRS.splice(0)) {
		await rm(dir, { recursive: true, force: true });
	}
});

async function makeSuiteDir(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "spec-cli-"));
	CREATED_DIRS.push(root);
	for (let [relativePath, text] of Object.entries(files)) {
		let path = join(root, relativePath);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, text, "utf8");
	}
	return root;
}

/**
 * Runs `spec` with `argv`, answering its exit code and what it printed on each stream. The run
 * sees the host's PATH unless `options.env` replaces the whole environment.
 */
async function spec(
	argv: string[],
	options: InvokeOptions = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
	return invoke(cli, argv, { env: { PATH: process.env.PATH }, ...options });
}

describe("spec run", () => {
	test("a passing suite exits 0 and reports the summary", async () => {
		let root = await makeSuiteDir({
			"pass.spec": `use fs

test "writes are visible" {
	when {
		write "out.txt" "content"
	}
	then {
		expect file "out.txt" exists
	}
}
`,
		});
		let { code, stdout } = await spec(["run", root]);

		expect(code).toBe(0);
		expect(stdout).toContain("✓ writes are visible");
		expect(stdout).toContain("1 passed, 0 failed");
	});

	test("a failing expectation exits 1 and names the failing test", async () => {
		let root = await makeSuiteDir({
			"fail.spec": `test "the answer is wrong" {
	then {
		expect 1 2
	}
}
`,
		});
		let { code, stdout } = await spec(["run", root]);

		expect(code).toBe(1);
		expect(stdout).toContain("✗ the answer is wrong");
		expect(stdout).toContain("0 passed, 1 failed");
	});

	test("an ungranted cli.run is denied, naming --allow-run, before any spawn", async () => {
		let root = await makeSuiteDir({
			"denied.spec": `use cli

test "running a program needs a grant" {
	when {
		let result = run "definitely-not-a-real-binary" "--version"
	}
}
`,
		});
		let { code, stdout } = await spec(["run", root]);

		expect(code).toBe(1);
		expect(stdout).toContain("Permission denied: run");
		expect(stdout).toContain("--allow-run");
		expect(stdout).not.toContain("failed to start");
	});

	test("the cross-file use scoping holds through the real CLI", async () => {
		let root = await makeSuiteDir({
			"commands/marker.spec": `use fs

command touch_marker {
	write "marker.txt" "made"
}
`,
			"run.spec": `test "helpers carry their defining file's imports" {
	when {
		touch_marker
	}
	then {
		expect fs.file "marker.txt" contains "made"
	}
}
`,
		});
		let { code, stdout } = await spec(["run", root]);

		expect(code).toBe(0);
		expect(stdout).toContain("1 passed, 0 failed");
	});

	test("a failure inside a cross-file command reports the defining file and line", async () => {
		let root = await makeSuiteDir({
			"commands/helper.spec": `# A helper whose body fails; its error must point here, not at the caller.
command broken {
	let x = missing_binding
}
`,
			"main.spec": `test "calls broken" {
	when {
		broken
	}
}
`,
		});
		let { code, stdout } = await spec(["run", root]);

		expect(code).toBe(1);
		expect(stdout).toContain("commands/helper.spec:3");
	});

	test("--help exits 0 and prints usage", async () => {
		let { code, stdout } = await spec(["--help"]);

		expect(code).toBe(0);
		expect(stdout).toContain("Usage:");
		expect(stdout).toContain("run");
	});

	test("run --help exits 0 and lists every flag", async () => {
		let { code, stdout } = await spec(["run", "--help"]);

		expect(code).toBe(0);
		expect(stdout).toContain("Usage: spec run [directory]");
		for (let name of [
			"--concurrency, --jobs <N>",
			"--retries <N>",
			"--seed <value>",
			"--run-id <value>",
			"--artifacts <dir>",
			"--allow-run[=",
			"--allow-net[=<host[:port],...>]",
			"--allow-env[=",
			"--allow-host-fs[=",
			"--allow-db[=",
			"--allow-plugins[=",
			"--allow-config",
		]) {
			expect(stdout).toContain(name);
		}
	});

	test("run --help groups its flags under headings", async () => {
		let { stdout } = await spec(["run", "--help"]);

		let headings = stdout.split("\n").filter((line) => /^\S.*:$/.test(line));
		expect(headings).toEqual([
			"Arguments:",
			"Options:",
			"Scheduling:",
			"Generated data:",
			"Diagnostics:",
			"Permissions (denied unless granted):",
			"Examples:",
		]);
		expect(stdout).toMatch(/Scheduling:\n {2}--concurrency, --jobs <N>/);
		expect(stdout).not.toContain("--no-progress");
	});

	test("no command exits 2 and prints usage on stderr", async () => {
		let { code, stderr } = await spec([]);

		expect(code).toBe(2);
		expect(stderr).toContain("Usage: spec <command>");
	});

	test("an unknown command exits 2 and names it", async () => {
		let { code, stderr } = await spec(["rnu"]);

		expect(code).toBe(2);
		expect(stderr).toContain('Unknown command "rnu"');
		expect(stderr).toContain('did you mean "run"?');
	});

	test("an unknown flag exits 2", async () => {
		let root = await makeSuiteDir({
			"pass.spec": `test "irrelevant" {
	then {
		expect true
	}
}
`,
		});
		let { code, stderr } = await spec(["run", root, "--frobnicate"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Unknown flag --frobnicate");
	});

	test("a nonexistent suite directory exits 2", async () => {
		let root = await makeSuiteDir({});
		let { code, stdout } = await spec(["run", join(root, "missing")]);

		expect(code).toBe(2);
		expect(stdout).toContain("load-error");
	});
});

describe("--seed", () => {
	/** A suite whose only test fails, printing the address it generated. */
	async function probeSuite(): Promise<string> {
		return makeSuiteDir({
			"probe.spec": `use sample

test "reports the address it drew" {
	when {
		let person = sample.person
	}
	then {
		expect person.email "not-the-drawn-address"
	}
}
`,
		});
	}

	/** The generated value, read out of the failure the probe suite reports. */
	function drawnValue(output: string): string {
		let observed = /observed "([^"]+)"/.exec(output);
		if (observed?.[1] === undefined) throw new Error(`no observed value in:\n${output}`);
		return observed[1];
	}

	test("repeats a run's data when no seed is given", async () => {
		let root = await probeSuite();

		let first = await spec(["run", root]);
		let second = await spec(["run", root]);

		expect(drawnValue(first.stdout)).toBe(drawnValue(second.stdout));
	});

	test("changes the data when the seed changes", async () => {
		let root = await probeSuite();

		let one = await spec(["run", root, "--seed=one"]);
		let two = await spec(["run", root, "--seed=two"]);

		expect(drawnValue(one.stdout)).not.toBe(drawnValue(two.stdout));
	});

	test("prints a drawn seed, and replaying it reproduces the run", async () => {
		let root = await probeSuite();

		let drawn = await spec(["run", root, "--seed=random"]);

		let printed = /seed (\d+) \(replay with --seed=(\d+)\)/.exec(drawn.stdout);
		expect(printed).not.toBeNull();
		expect(printed?.[1]).toBe(printed?.[2]);

		let replay = await spec(["run", root, `--seed=${printed?.[1]}`]);

		expect(drawnValue(replay.stdout)).toBe(drawnValue(drawn.stdout));
	});

	test("a seed with no value is a usage error", async () => {
		let root = await probeSuite();
		let { code, stderr } = await spec(["run", root, "--seed"]);

		expect(code).toBe(2);
		expect(stderr).toContain("--seed needs a value");
	});

	test("an empty seed is the same usage error as a missing one", async () => {
		let root = await probeSuite();
		let { code, stderr } = await spec(["run", root, "--seed="]);

		expect(code).toBe(2);
		expect(stderr).toContain("--seed needs a value\n");
	});

	test("takes its value as the next argument too", async () => {
		let root = await probeSuite();
		let { stdout } = await spec(["run", "--seed", "42", root]);

		expect(stdout).toContain("seed 42 (replay with --seed=42)");
	});

	test("prints the given seed too, so any run's header replays it", async () => {
		let root = await probeSuite();
		let { stdout } = await spec(["run", root, "--seed=fixed"]);

		expect(stdout).toContain("seed fixed (replay with --seed=fixed)");
	});
});

describe("--run-id", () => {
	/** A suite whose only test passes, for flags observed through the header. */
	async function trivialSuite(): Promise<string> {
		return makeSuiteDir({
			"trivial.spec": `test "holds" {
	then {
		expect 1 1
	}
}
`,
		});
	}

	test("the header prints a drawn run id as a replay flag", async () => {
		let root = await trivialSuite();

		let first = await spec(["run", root]);
		let second = await spec(["run", root]);

		let pattern = /run ([a-z0-9]+) \(replay with --run-id=([a-z0-9]+)\)/;
		let one = pattern.exec(first.stdout);
		let two = pattern.exec(second.stdout);
		expect(one?.[1]).toBe(one?.[2]);
		/** The one value in the runtime that must not reproduce across runs. */
		expect(one?.[1]).not.toBe(two?.[1]);
	});

	test("replays the given run id verbatim", async () => {
		let root = await trivialSuite();
		let { code, stdout } = await spec(["run", root, "--run-id=nightly-42"]);

		expect(code).toBe(0);
		expect(stdout).toContain("run nightly-42 (replay with --run-id=nightly-42)");
	});

	test("a run id with no value is a usage error", async () => {
		let root = await trivialSuite();
		let { code, stderr } = await spec(["run", root, "--run-id"]);

		expect(code).toBe(2);
		expect(stderr).toContain("--run-id needs a value");
	});

	test("a malformed --retries is a usage error", async () => {
		let root = await trivialSuite();
		let { code, stderr } = await spec(["run", root, "--retries=two"]);

		expect(code).toBe(2);
		expect(stderr).toContain("--retries: expects a non-negative integer");
	});

	test("an --artifacts directory with no value is a usage error", async () => {
		let root = await trivialSuite();
		let { code, stderr } = await spec(["run", root, "--artifacts="]);

		expect(code).toBe(2);
		expect(stderr).toContain("--artifacts needs a value");
	});
});

describe("bases", () => {
	test("the header prints each resolved base, environment variable first", async () => {
		let root = await makeSuiteDir({
			"config.jsonc": `{
	"bases": {
		"web": { "env": "SPEC_CLI_BASE_FIXTURE", "default": "http://localhost:4000" },
		"work": { "default": "http://localhost:4020" }
	}
}
`,
			"trivial.spec": `test "holds" {
	then {
		expect 1 1
	}
}
`,
		});
		let { code, stdout } = await spec(["run", root], {
			env: { SPEC_CLI_BASE_FIXTURE: "https://staging.example.com" },
		});

		expect(code).toBe(0);
		expect(stdout).toContain(`base "web" → https://staging.example.com`);
		expect(stdout).toContain(`base "work" → http://localhost:4020`);
	});

	test("a base that resolves to nothing is a load error naming its variable", async () => {
		let root = await makeSuiteDir({
			"config.jsonc": `{
	"bases": { "web": { "env": "SPEC_CLI_MISSING_BASE" } }
}
`,
			"trivial.spec": `test "holds" {
	then {
		expect 1 1
	}
}
`,
		});
		let { code, stdout } = await spec(["run", root]);

		expect(code).toBe(2);
		expect(stdout).toContain("SPEC_CLI_MISSING_BASE");
	});
});

describe("isolation from the host process", () => {
	test("a relative suite directory resolves against the invocation's cwd", async () => {
		let root = await makeSuiteDir({
			"trivial.spec": `test "holds" {
	then {
		expect 1 1
	}
}
`,
		});

		let { code, stdout } = await spec(["run", basename(root)], { cwd: dirname(root) });

		expect(code).toBe(0);
		expect(stdout).toContain("1 passed, 0 failed");
	});

	test("env.get reads the invocation's env, not the host process's", async () => {
		let root = await makeSuiteDir({
			"read.spec": `use env

test "reads the invocation's variables" {
	when {
		let isolated = env.get "SPEC_CLI_ISOLATED"
		let home = env.get "HOME" "unset"
	}
	then {
		expect isolated "from-invoke"
		expect home "unset"
	}
}
`,
		});

		let { code, stdout } = await spec(["run", root, "--allow-env=SPEC_CLI_ISOLATED,HOME"], {
			env: { SPEC_CLI_ISOLATED: "from-invoke" },
		});

		expect(process.env.HOME).toBeDefined();
		expect(code).toBe(0);
		expect(stdout).toContain("1 passed, 0 failed");
	});
});

describe("scheduling flags", () => {
	/** A suite whose only test passes, for flags that change how a run is scheduled. */
	async function trivialSuite(): Promise<string> {
		return makeSuiteDir({
			"trivial.spec": `test "holds" {
	then {
		expect 1 1
	}
}
`,
		});
	}

	test.each([
		["--concurrency=4"],
		["--jobs=4"],
		["--jobs", "4"],
		["--retries=0"],
		["--retries", "2"],
	])("%j is accepted", async (...flags) => {
		let root = await trivialSuite();
		let { code, stdout } = await spec(["run", root, ...flags]);

		expect(code).toBe(0);
		expect(stdout).toContain("1 passed, 0 failed");
	});

	test.each(["0", "-1", "+4", "1.5", "0x4", " 4", "four"])(
		"--jobs=%j is a usage error naming the flag as typed",
		async (value) => {
			let root = await trivialSuite();
			let { code, stderr } = await spec(["run", root, `--jobs=${value}`]);

			expect(code).toBe(2);
			expect(stderr).toContain(`--jobs: expects a positive integer; got ${JSON.stringify(value)}`);
		},
	);

	test("an empty --jobs is a usage error naming the flag as typed", async () => {
		let root = await trivialSuite();
		let { code, stderr } = await spec(["run", root, "--jobs="]);

		expect(code).toBe(2);
		expect(stderr).toContain("--jobs needs a value\n");
	});

	test("a negative --retries is a usage error", async () => {
		let root = await trivialSuite();
		let { code, stderr } = await spec(["run", root, "--retries=-1"]);

		expect(code).toBe(2);
		expect(stderr).toContain("--retries: expects a non-negative integer");
	});

	test("two suite directories are a usage error", async () => {
		let root = await trivialSuite();
		let { code, stderr } = await spec(["run", root, root]);

		expect(code).toBe(2);
		expect(stderr).toContain("Unexpected argument");
	});
});

describe("permission flags", () => {
	/** A suite whose only test runs `echo`, which needs a run grant naming it. */
	async function echoSuite(): Promise<string> {
		return makeSuiteDir({
			"echo.spec": `use cli

test "echo runs" {
	when {
		let result = run "echo" "hi"
	}
	then {
		expect result.exit_code 0
	}
}
`,
		});
	}

	test.each([
		[["--allow-run"]],
		[["--allow-run=echo"]],
		[["--allow-run=sh,echo"]],
		[["--allow-run= sh , echo ,"]],
		[["--allow-run=sh", "--allow-run=echo"]],
		[["--allow-run=sh", "--allow-run"]],
		[["--allow-run", "--allow-run=sh"]],
	])("%j grants echo", async (flags) => {
		let root = await echoSuite();
		let { code, stdout } = await spec(["run", root, ...flags]);

		expect(code, stdout).toBe(0);
	});

	test.each([[[]], [["--allow-run=sh"]], [["--allow-net"]]])(
		"%j leaves echo denied",
		async (flags) => {
			let root = await echoSuite();
			let { code, stdout } = await spec(["run", root, ...flags]);

			expect(code).toBe(1);
			expect(stdout).toContain("Permission denied: run");
		},
	);

	test("a bare --allow-run before the directory leaves the directory a positional", async () => {
		let root = await echoSuite();
		let { code, stdout } = await spec(["run", "--allow-run", root]);

		expect(code, stdout).toBe(0);
	});

	test("an empty scope list is a usage error", async () => {
		let root = await echoSuite();
		let { code, stderr } = await spec(["run", root, "--allow-net="]);

		expect(code).toBe(2);
		expect(stderr).toContain("--allow-net needs a value");
	});

	test("an unknown permission family is a usage error", async () => {
		let root = await echoSuite();
		let { code, stderr } = await spec(["run", root, "--allow-device=camera"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Unknown flag --allow-device");
	});

	test("--allow-config takes no value", async () => {
		let root = await echoSuite();
		let { code, stderr } = await spec(["run", root, "--allow-config=yes"]);

		expect(code).toBe(2);
		expect(stderr).toContain("--allow-config takes no value");
	});

	test("config grants apply only with --allow-config, and the denial hints at it", async () => {
		let root = await echoSuite();
		await writeFile(
			join(root, "config.jsonc"),
			`{ "permissions": { "allow": [["run", "echo"]] } }\n`,
			"utf8",
		);

		let denied = await spec(["run", root]);
		expect(denied.code).toBe(1);
		expect(denied.stdout).toContain("Permission denied: run");
		expect(denied.stdout).toContain("re-run with --allow-config");

		let granted = await spec(["run", root, "--allow-config"]);
		expect(granted.code, granted.stdout).toBe(0);
	});
});
