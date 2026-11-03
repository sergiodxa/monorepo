/**
 * Tests for the run engine: step order and outcomes, halts, groups, matrices, filters and scope,
 * concurrency, function steps, timeouts, closing calls and caching — each run against a real
 * temporary git repository with real child processes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { failure, success } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import type { CI, StepRun } from "./types.js";

import { runScript } from "./run.js";
import { createRepo, removeRepos } from "./test-repo.js";

/** Environment for every test run: a local runner, whatever the host running the tests says. */
const ENV = { ...process.env, CI: "" };

afterEach(removeRepos);

/** Runs `script` in a fresh repository holding `files`, with the cache on unless said otherwise. */
async function run(
	script: (ci: CI) => unknown,
	options: {
		files?: Record<string, string>;
		only?: string[];
		skip?: string[];
		scope?: string[];
		concurrency?: number;
	} = {},
) {
	let root = await createRepo(options.files ?? { "package.json": "{}\n" });
	return { root, report: await runScript(script, { root, env: ENV, ...options }) };
}

/** The status of each step, by label. */
function statuses(report: { steps: Array<{ label: string; status: string; filtered: boolean }> }) {
	return Object.fromEntries(
		report.steps.filter((step) => !step.filtered).map((step) => [step.label, step.status]),
	);
}

describe("steps", () => {
	test("runs steps in order and passes when every step passes", async () => {
		let order: string[] = [];
		let { report } = await run(async (ci) => {
			expect(ci.status).toBe("pending");
			await ci.step("One", () => {
				order.push("one");
			});
			await ci.step("Two", "echo two");
			order.push(ci.status);
		});
		expect(order).toEqual(["one", "passing"]);
		expect(report).toMatchObject({ status: "passing", exitCode: 0 });
		expect(report.steps[1]?.output).toBe("two\n");
	});

	test("keeps running after a failure and exits 1", async () => {
		let { report } = await run(async (ci) => {
			await ci.step("Fails", "echo broken >&2; exit 3");
			await ci.step("Still runs", "true");
		});
		expect(statuses(report)).toEqual({ Fails: "failed", "Still runs": "passed" });
		expect(report).toMatchObject({ status: "failing", exitCode: 1 });
		expect(report.steps[0]?.output).toBe("broken\n");
	});

	test("a failed halt step skips every later step", async () => {
		let { report } = await run(async (ci) => {
			await ci.step("Install", "exit 1", { halt: true });
			let later = await ci.step("Test", "true");
			expect(later.status).toBe("skipped");
		});
		expect(statuses(report)).toEqual({ Install: "failed", Test: "skipped" });
		expect(report.status).toBe("halted");
	});

	test("an argv runs without a shell", async () => {
		let { report } = await run(async (ci) => {
			await ci.step("Argv", ["echo", "$HOME", "a;b"]);
		});
		expect(report.steps[0]?.output).toBe("$HOME a;b\n");
	});

	test("runs a command in cwd with extra environment variables", async () => {
		let { report } = await run(
			async (ci) => {
				await ci.step("Here", 'pwd; echo "$GREETING"', { cwd: "app", env: { GREETING: "hello" } });
			},
			{ files: { "package.json": "{}", "app/file.txt": "" } },
		);
		expect(report.steps[0]?.output).toMatch(/\/app\nhello\n$/);
	});

	test("a step that runs past its timeout fails", async () => {
		let { report } = await run(async (ci) => {
			await ci.step("Slow", "sleep 5", { timeout: 100 });
		});
		expect(report.steps[0]).toMatchObject({ status: "failed" });
		expect(report.steps[0]?.output).toContain("Timed out after 100ms");
	});
});

describe("function steps", () => {
	test("a returned failure fails the step with its message", async () => {
		let { report } = await run(async (ci) => {
			await ci.step("Result", () => failure(new Error("coverage is 71%")));
			await ci.step("Ok", () => success(undefined));
		});
		expect(statuses(report)).toEqual({ Result: "failed", Ok: "passed" });
		expect(report.steps[0]?.output).toBe("coverage is 71%\n");
	});

	test("returning nothing fails when a command inside failed, and logs land in order", async () => {
		let { report } = await run(async (ci) => {
			await ci.step("Two commands", async (step) => {
				step.log("starting");
				await step.run("echo first");
				await step.run(["sh", "-c", "exit 2"]);
			});
		});
		expect(report.steps[0]).toMatchObject({ status: "failed", output: "starting\nfirst\n" });
	});

	test("a thrown error fails the step and the run goes on", async () => {
		let { report } = await run(async (ci) => {
			await ci.step("Throws", () => {
				throw new Error("boom");
			});
			await ci.step("After", "true");
		});
		expect(statuses(report)).toEqual({ Throws: "failed", After: "passed" });
		expect(report.steps[0]?.output).toContain("boom");
	});

	test("an error thrown outside a step fails the run", async () => {
		let { report } = await run(async (ci) => {
			await ci.step("Fine", "true");
			throw new Error("script bug");
		});
		expect(report.status).toBe("failing");
		expect(report.errors[0]).toMatchObject({
			where: null,
			message: expect.stringContaining("script bug"),
		});
	});
});

describe("parallel", () => {
	test("never runs more steps at once than the concurrency limit", async () => {
		let running = 0;
		let peak = 0;
		/** A step that holds its slot for a moment and records how many steps overlapped it. */
		let tracked: StepRun = async () => {
			running += 1;
			peak = Math.max(peak, running);
			await new Promise((resolve) => setTimeout(resolve, 20));
			running -= 1;
		};
		let { report } = await run(
			async (ci) => {
				await ci.parallel(
					"Group",
					[1, 2, 3, 4, 5].map((n) => () => ci.step(`Step ${n}`, tracked)),
				);
			},
			{ concurrency: 2 },
		);
		expect(peak).toBe(2);
		expect(report.status).toBe("passing");
	});

	test("failFast aborts a running sibling and skips later ones", async () => {
		let { report } = await run(async (ci) => {
			let outcome = await ci.parallel(
				"Checks",
				[() => ci.step("Slow", "sleep 5"), () => ci.step("Fast fail", "exit 1")],
				{ failFast: true },
			);
			expect(outcome.status).toBe("failing");
			await ci.parallel("After", [() => ci.step("Unaffected", "true")]);
		});
		expect(statuses(report)).toEqual({
			"Fast fail": "failed",
			Slow: "failed",
			Unaffected: "passed",
		});
		expect(report.steps.find((step) => step.name === "Slow")?.duration).toBeLessThan(4000);
	});
});

describe("matrix", () => {
	test("each item is an entry with its own steps and status, and halts stay in their entry", async () => {
		let { report } = await run(async (ci) => {
			let outcome = await ci.matrix("Apps", [{ name: "blog" }, { name: "shop" }], async (app) => {
				await ci.step("Build", app.name === "blog" ? "exit 1" : "true", { halt: true });
				await ci.step("Test", "true");
			});
			expect(outcome.status).toBe("failing");
		});
		expect(statuses(report)).toEqual({
			"Apps/blog › Build": "failed",
			"Apps/blog › Test": "skipped",
			"Apps/shop › Build": "passed",
			"Apps/shop › Test": "passed",
		});
		expect(report.entries).toEqual([
			{ matrix: "Apps", key: "blog", address: "Apps/blog", status: "halted" },
			{ matrix: "Apps", key: "shop", address: "Apps/shop", status: "passing" },
		]);
		expect(report.status).toBe("failing");
	});

	test("keys come from the key option, or the item itself", async () => {
		let { report } = await run(async (ci) => {
			await ci.matrix("Nodes", [22, 24], () => ci.step("Test", "true"));
			await ci.matrix("Apps", [{ dir: "a" }], () => ci.step("Test", "true"), {
				key: (item) => item.dir,
			});
		});
		expect(report.entries.map((entry) => entry.address)).toEqual([
			"Nodes/22",
			"Nodes/24",
			"Apps/a",
		]);
	});
});

describe("filters", () => {
	/** A script with a top-level step, a group, and a two-entry matrix. */
	let script = async (ci: CI) => {
		await ci.step("Doctor", "true");
		await ci.parallel("Tests", [
			() => ci.step("Tests for root", "true"),
			() => ci.matrix("Workspaces", ["a", "b"], (key) => ci.step(`Tests for ${key}`, "true")),
		]);
	};

	test("--only matches a step, a group or an entry address, and marks the run partial", async () => {
		let { report } = await run(script, { only: ["Workspaces/b"] });
		expect(statuses(report)).toEqual({ "Workspaces/b › Tests for b": "passed" });
		expect(report.partial).toBe(true);
		let group = await run(script, { only: ["Tests"] });
		expect(Object.keys(statuses(group.report)).sort()).toEqual([
			"Tests for root",
			"Workspaces/a › Tests for a",
			"Workspaces/b › Tests for b",
		]);
	});

	test("--skip leaves out every match, where * spans slashes", async () => {
		let { report } = await run(script, { skip: ["Tests*"] });
		expect(statuses(report)).toEqual({ Doctor: "passed" });
	});
});

/** A monorepo where the app depends on a package that depends on another. */
const MONOREPO = {
	"package.json": JSON.stringify({ workspaces: ["apps/*", "packages/*"] }),
	"apps/blog/package.json": JSON.stringify({
		name: "blog",
		dependencies: { "@acme/ui": "workspace:*" },
	}),
	"apps/blog/src/app.test.ts": "",
	"packages/ui/package.json": JSON.stringify({
		name: "@acme/ui",
		dependencies: { "@acme/tokens": "workspace:*" },
	}),
	"packages/tokens/package.json": JSON.stringify({ name: "@acme/tokens" }),
	"packages/tokens/README.md": "",
	"packages/empty/notes.txt": "",
};

describe("workspaces and scope", () => {
	test("ci.workspaces reads the graph, the files and has()", async () => {
		let { report } = await run(
			async (ci) => {
				let workspaces = await ci.workspaces();
				expect(workspaces.map((ws) => [ws.name, ws.path, ws.dependencies, ws.dependents])).toEqual([
					["blog", "apps/blog", ["@acme/ui"], []],
					["@acme/tokens", "packages/tokens", [], ["@acme/ui", "blog"]],
					["@acme/ui", "packages/ui", ["@acme/tokens"], ["blog"]],
				]);
				expect(workspaces.filter((ws) => ws.has("**/*.test.ts")).map((ws) => ws.name)).toEqual([
					"blog",
				]);
				expect(await workspaces[1]?.files()).toEqual([
					"packages/tokens/README.md",
					"packages/tokens/package.json",
				]);
			},
			{ files: MONOREPO },
		);
		expect(report.errors).toEqual([]);
	});

	test("--scope keeps the scoped workspace and its dependents, and sets ci.scope", async () => {
		let seen: unknown = null;
		let { report } = await run(
			async (ci) => {
				seen = ci.scope;
				await ci.matrix("Workspaces", await ci.workspaces(), () => ci.step("Test", "true"));
			},
			{ files: MONOREPO, scope: ["packages/ui"] },
		);
		expect(seen).toEqual(["packages/ui"]);
		expect(report.entries.map((entry) => entry.key)).toEqual(["blog", "@acme/ui"]);
		expect(report.partial).toBe(true);
	});
});

describe("closing calls", () => {
	test("ci.failure fails a run whose steps passed", async () => {
		let { report } = await run(async (ci) => {
			await ci.step("Ok", "true");
			ci.failure("Coverage dropped.", "Raise it to 80%.");
		});
		expect(report).toMatchObject({
			status: "failing",
			exitCode: 1,
			closing: { kind: "failure", title: "Coverage dropped.", detail: "Raise it to 80%." },
		});
	});

	test("ci.success on a failing run is a script error", async () => {
		let { report } = await run(async (ci) => {
			await ci.step("Broken", "exit 1");
			ci.success("All green.");
		});
		expect(report.exitCode).toBe(1);
		expect(report.errors[0]?.message).toBe("ci.success was called while the run is failing");
	});

	test("ci.success closes a passing run with exit 0", async () => {
		let { report } = await run(async (ci) => {
			await ci.step("Ok", "true");
			ci.success("All green.");
		});
		expect(report).toMatchObject({ exitCode: 0, closing: { kind: "success" }, signoff: null });
	});
});

describe("cache", () => {
	test("reuses a pass while the inputs are unchanged, and runs again when one changes", async () => {
		let root = await createRepo({ "package.json": "{}", "src/a.ts": "1" });
		let calls = 0;
		/** A cached step counting how often it really ran. */
		let script = async (ci: CI) => {
			await ci.step(
				"Count",
				() => {
					calls += 1;
				},
				{ cache: { inputs: ["src/**"] } },
			);
		};
		let first = await runScript(script, { root, env: ENV });
		let second = await runScript(script, { root, env: ENV });
		await writeFile(join(root, "src/a.ts"), "2");
		let third = await runScript(script, { root, env: ENV });
		let uncached = await runScript(script, { root, env: ENV, cache: false });
		expect([first, second, third, uncached].map((report) => report.steps[0]?.cached)).toEqual([
			false,
			true,
			false,
			false,
		]);
		expect(calls).toBe(3);
	});

	test("never stores a failure", async () => {
		let root = await createRepo({ "package.json": "{}" });
		let script = async (ci: CI) => {
			await ci.step("Fails", "exit 1", { cache: true });
		};
		await runScript(script, { root, env: ENV });
		let again = await runScript(script, { root, env: ENV });
		expect(again.steps[0]).toMatchObject({ status: "failed", cached: false });
	});

	test("a declared output that changed invalidates the pass", async () => {
		let root = await createRepo({ "package.json": "{}", ".gitignore": "dist\n" });
		let script = async (ci: CI) => {
			await ci.step("Build", "mkdir -p dist && echo built > dist/out.txt", {
				cache: { inputs: ["package.json"], outputs: ["dist"] },
			});
		};
		await runScript(script, { root, env: ENV });
		let hit = await runScript(script, { root, env: ENV });
		await writeFile(join(root, "dist/out.txt"), "tampered");
		let miss = await runScript(script, { root, env: ENV });
		expect([hit.steps[0]?.cached, miss.steps[0]?.cached]).toEqual([true, false]);
	});
});
