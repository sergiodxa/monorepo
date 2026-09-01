/**
 * Tests for the `spec` CLI entry point: exit codes and human output for
 * passing suites, failing expectations, permission denials, usage errors, and
 * unreadable suite directories — driven through `main` with a buffer sink.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import type { Sink } from "./diagnostics";

import { main } from "./cli";

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

/** A sink that buffers everything the CLI writes, for output assertions. */
function makeSink(): { sink: Sink; output: () => string } {
	let buffer = "";
	return {
		sink: {
			write(text) {
				buffer += text;
			},
		},
		output: () => buffer,
	};
}

describe("main", () => {
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
		let { sink, output } = makeSink();

		let code = await main(["run", root], sink);

		expect(code).toBe(0);
		expect(output()).toContain("✓ writes are visible");
		expect(output()).toContain("1 passed, 0 failed");
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
		let { sink, output } = makeSink();

		let code = await main(["run", root], sink);

		expect(code).toBe(1);
		expect(output()).toContain("✗ the answer is wrong");
		expect(output()).toContain("0 passed, 1 failed");
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
		let { sink, output } = makeSink();

		let code = await main(["run", root], sink);

		expect(code).toBe(1);
		expect(output()).toContain("Permission denied: run");
		expect(output()).toContain("--allow-run");
		expect(output()).not.toContain("failed to start");
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
		let { sink, output } = makeSink();

		let code = await main(["run", root], sink);

		expect(code).toBe(0);
		expect(output()).toContain("1 passed, 0 failed");
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
		let { sink, output } = makeSink();

		let code = await main(["run", root], sink);

		expect(code).toBe(1);
		expect(output()).toContain("commands/helper.spec:3");
	});

	test("--help exits 0 and prints usage", async () => {
		let { sink, output } = makeSink();

		let code = await main(["--help"], sink);

		expect(code).toBe(0);
		expect(output()).toContain("Usage:");
		expect(output()).toContain("--allow-run");
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
		let { sink, output } = makeSink();

		let code = await main(["run", root, "--frobnicate"], sink);

		expect(code).toBe(2);
		expect(output()).toContain("--frobnicate");
	});

	test("a nonexistent suite directory exits 2", async () => {
		let root = await makeSuiteDir({});
		let { sink, output } = makeSink();

		let code = await main(["run", join(root, "missing")], sink);

		expect(code).toBe(2);
		expect(output()).toContain("load-error");
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
		let first = makeSink();
		let second = makeSink();

		await main(["run", root], first.sink);
		await main(["run", root], second.sink);

		expect(drawnValue(first.output())).toBe(drawnValue(second.output()));
	});

	test("changes the data when the seed changes", async () => {
		let root = await probeSuite();
		let one = makeSink();
		let two = makeSink();

		await main(["run", root, "--seed=one"], one.sink);
		await main(["run", root, "--seed=two"], two.sink);

		expect(drawnValue(one.output())).not.toBe(drawnValue(two.output()));
	});

	test("prints a drawn seed, and replaying it reproduces the run", async () => {
		let root = await probeSuite();
		let drawn = makeSink();

		await main(["run", root, "--seed=random"], drawn.sink);

		let printed = /seed (\d+) \(replay with --seed=(\d+)\)/.exec(drawn.output());
		expect(printed).not.toBeNull();
		expect(printed?.[1]).toBe(printed?.[2]);

		let replay = makeSink();
		await main(["run", root, `--seed=${printed?.[1]}`], replay.sink);

		expect(drawnValue(replay.output())).toBe(drawnValue(drawn.output()));
	});

	test("a seed with no value is a usage error", async () => {
		let root = await probeSuite();
		let { sink, output } = makeSink();

		let code = await main(["run", root, "--seed"], sink);

		expect(code).toBe(2);
		expect(output()).toContain("--seed expects a value");
	});

	test("does not print a seed line when the seed was given", async () => {
		let root = await probeSuite();
		let { sink, output } = makeSink();

		await main(["run", root, "--seed=fixed"], sink);

		expect(output()).not.toContain("replay with");
	});
});
