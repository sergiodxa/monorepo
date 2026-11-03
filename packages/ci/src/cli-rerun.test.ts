/**
 * Tests for what `sdxc-ci run` keeps between runs: the `Logs:` line and the JSON report's
 * `logs` field pointing at the recorded run, and `--rerun-failed` running only the steps the
 * last recorded run failed — driven through `invoke()` against real temporary repositories.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";
import { createRepo, removeRepos } from "./test-repo.js";

/** The environment a local run sees: no CI variable and no GitHub Actions. */
const ENV = { CI: "", GITHUB_ACTIONS: "" };

/** A script whose `Test` step fails while `flaky.txt` holds `fail`, closing with a plain success. */
const SCRIPT = `export default async (ci) => {
	await ci.step("Lint", "echo linted");
	await ci.step("Test", "echo testing && test \\"$(cat flaky.txt)\\" != fail");
	ci.success("Done.");
};
`;

afterEach(removeRepos);

/** A committed repository holding `ci.ts`, with `Test` failing until `flaky.txt` changes. */
async function repoWith(script: string = SCRIPT): Promise<string> {
	return createRepo({ "package.json": "{}\n", "ci.ts": script, "flaky.txt": "fail\n" });
}

/** The directory a `Logs:` line names, or `null` when the output has none. */
function logsOf(stdout: string): string | null {
	return /^Logs: (.+)$/m.exec(stdout)?.[1] ?? null;
}

describe("sdxc-ci run records", () => {
	test("prints the run's log directory after the summary, holding each step's log", async () => {
		let cwd = await repoWith();
		let run = await invoke(cli, ["run", "ci.ts", "--no-cache"], { cwd, env: ENV });
		expect(run.code).toBe(1);
		let logs = logsOf(run.stdout);
		expect(logs).not.toBeNull();
		expect(run.stdout.trimEnd().endsWith(`Logs: ${logs}`)).toBe(true);
		if (logs === null) return;
		expect((await readdir(join(logs, "logs"))).sort()).toEqual(["01-lint.log", "02-test.log"]);
		expect(await readFile(join(logs, "logs", "02-test.log"), "utf8")).toContain("testing");
	});

	test("puts the log directory in the JSON report instead of printing it", async () => {
		let cwd = await repoWith();
		let run = await invoke(cli, ["run", "ci.ts", "--json"], { cwd, env: ENV });
		expect(logsOf(run.stdout)).toBeNull();
		let report = JSON.parse(run.stdout) as { logs: string };
		expect(await readFile(join(report.logs, "report.json"), "utf8")).toContain('"Test"');
	});

	test("records nothing for `list`", async () => {
		let cwd = await repoWith();
		await invoke(cli, ["list", "ci.ts"], { cwd, env: ENV });
		let rerun = await invoke(cli, ["run", "ci.ts", "--rerun-failed"], { cwd, env: ENV });
		expect(rerun.code).toBe(2);
	});
});

describe("sdxc-ci run --rerun-failed", () => {
	test("runs only the steps the last run failed", async () => {
		let cwd = await repoWith();
		await invoke(cli, ["run", "ci.ts", "--no-cache"], { cwd, env: ENV });
		await writeFile(join(cwd, "flaky.txt"), "pass\n");
		let rerun = await invoke(cli, ["run", "ci.ts", "--rerun-failed", "--json"], {
			cwd,
			env: ENV,
		});
		expect(rerun.code).toBe(0);
		let report = JSON.parse(rerun.stdout) as { partial: boolean; steps: Array<{ label: string }> };
		expect(report.partial).toBe(true);
		expect(report.steps.map((step) => step.label)).toEqual(["Test"]);
	});

	test("exits 2 when no run is recorded", async () => {
		let cwd = await repoWith();
		let rerun = await invoke(cli, ["run", "ci.ts", "--rerun-failed"], { cwd, env: ENV });
		expect(rerun.code).toBe(2);
		expect(rerun.stderr).toContain("no earlier run is recorded");
	});

	test("exits 0 without running when the last run failed nothing", async () => {
		let cwd = await repoWith();
		await writeFile(join(cwd, "flaky.txt"), "pass\n");
		await invoke(cli, ["run", "ci.ts"], { cwd, env: ENV });
		let rerun = await invoke(cli, ["run", "ci.ts", "--rerun-failed"], { cwd, env: ENV });
		expect(rerun.code).toBe(0);
		expect(rerun.stdout).toBe("Nothing to re-run: the last run had no failed steps\n");
	});
});
