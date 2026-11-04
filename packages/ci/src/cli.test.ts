/**
 * Tests for the `sdxc-ci` command line: running and listing a script, the signoff guards, the
 * push of the tested commit, posting a recorded signoff, and verifying one — driven through
 * `invoke()` against real temporary repositories, with GitHub's API answered by MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";
import { createBareRepo, createRepo, gitIn, removeRepos } from "./test-repo.js";

/** The repository every GitHub-backed test points `origin` at. */
const REPO_URL = "https://github.com/acme/app.git";

/** The environment a local run sees: a token, and no CI variable. */
const ENV = { GITHUB_TOKEN: "test-token", CI: "" };

/** A script whose steps pass, closing with a signoff. */
const GREEN_SCRIPT = `export default async (ci) => {
	await ci.step("Lint", "true");
	await ci.matrix("Apps", ["blog", "shop"], (app) => ci.step(\`Test \${app}\`, "true"));
	await ci.signoff("All systems go.");
};
`;

const SERVER = setupServer();

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterEach(async () => {
	SERVER.resetHandlers();
	await removeRepos();
});
afterAll(() => SERVER.close());

/** A committed repository holding `ci.ts` with `script`, with `origin` pointing at GitHub. */
async function repoWith(script: string): Promise<string> {
	let root = await createRepo({ "package.json": "{}\n", "ci.ts": script });
	gitIn(root, "remote", "add", "origin", REPO_URL);
	return root;
}

/** Answers GitHub's commit lookup and records each status posted. */
function acceptStatuses(): Array<Record<string, unknown>> {
	let posted: Array<Record<string, unknown>> = [];
	SERVER.use(
		http.get("https://api.github.com/repos/acme/app/commits/:sha", () =>
			HttpResponse.json({ sha: "x" }),
		),
		http.post(
			"https://api.github.com/repos/acme/app/statuses/:sha",
			async ({ request, params }) => {
				posted.push({ sha: params.sha, ...((await request.json()) as Record<string, unknown>) });
				return HttpResponse.json({}, { status: 201 });
			},
		),
	);
	return posted;
}

describe("sdxc-ci run", () => {
	test("prints each step and the summary, and exits with the run's code", async () => {
		let cwd = await repoWith(`export default async (ci) => {
	await ci.step("Lint", "true");
	await ci.step("Test", "echo 'expected 1 to be 2' && exit 1");
	ci.failure("CI failed. Do not push.");
};
`);
		let run = await invoke(cli, ["run", "ci.ts"], { cwd, env: ENV });
		expect(run.code).toBe(1);
		expect(run.stdout).toMatch(/^✓ Lint {2}\d+\.\ds\n✗ Test {2}\d+\.\ds\n {2}expected 1 to be 2\n/);
		expect(run.stdout).toContain("✗ failing — 1 of 2 steps failed");
		expect(run.stdout).toContain("CI failed. Do not push.");
	});

	test("--json prints the report", async () => {
		let cwd = await repoWith(
			`export default async (ci) => { await ci.step("Lint", "echo ok"); };\n`,
		);
		let run = await invoke(cli, ["run", "ci.ts", "--json"], { cwd, env: ENV });
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toMatchObject({
			status: "passing",
			exitCode: 0,
			runner: "local",
			steps: [{ name: "Lint", status: "passed", cached: false, output: "ok\n" }],
		});
	});

	test("exits 2 for a script without a default export or a filter that matches nothing", async () => {
		let cwd = await repoWith(`export const nothing = 1;\n`);
		let missing = await invoke(cli, ["run", "ci.ts"], { cwd, env: ENV });
		expect(missing.code).toBe(2);
		expect(missing.stderr).toContain("must default-export a CI script");
		await writeFile(
			join(cwd, "ci.ts"),
			`export default async (ci) => { await ci.step("Lint", "true"); };\n`,
		);
		let unmatched = await invoke(cli, ["run", "ci.ts", "--only", "Nope"], { cwd, env: ENV });
		expect(unmatched.code).toBe(2);
	});

	test("signs a green run off on GitHub and records it", async () => {
		let cwd = await repoWith(GREEN_SCRIPT);
		let posted = acceptStatuses();
		let run = await invoke(cli, ["run", "ci.ts"], { cwd, env: ENV });
		let head = gitIn(cwd, "rev-parse", "HEAD");
		expect(run.code).toBe(0);
		expect(run.stdout).toContain(`Signed off ${head.slice(0, 10)} as sdxc/ci.`);
		expect(posted).toEqual([
			{
				sha: head,
				state: "success",
				context: "sdxc/ci",
				description: expect.stringMatching(/^Passed on .+ in \d+\.\ds$/),
			},
		]);
	});

	test("never signs off a dirty tree, a partial run or a remote run", async () => {
		let cwd = await repoWith(GREEN_SCRIPT);
		let partial = await invoke(cli, ["run", "ci.ts", "--skip", "Lint"], { cwd, env: ENV });
		let remote = await invoke(cli, ["run", "ci.ts"], { cwd, env: { ...ENV, CI: "true" } });
		let disabled = await invoke(cli, ["run", "ci.ts", "--no-signoff"], { cwd, env: ENV });
		await writeFile(join(cwd, "scratch.txt"), "uncommitted");
		let dirty = await invoke(cli, ["run", "ci.ts"], { cwd, env: ENV });
		expect(partial.stdout).toContain(
			"Not signed off: --only, --skip, --scope or --since left steps out",
		);
		expect(remote.stdout).toContain("Not signed off: remote runs never sign off");
		expect(disabled.stdout).toContain("Not signed off: --no-signoff");
		expect(dirty.stdout).toContain(
			"Not signed off: the run started with uncommitted or untracked files",
		);
		expect([partial.code, remote.code, disabled.code, dirty.code]).toEqual([0, 0, 0, 0]);
	});

	test("--push pushes exactly the tested commit, and fails when it cannot sign off", async () => {
		let cwd = await createRepo({ "package.json": "{}\n", "ci.ts": GREEN_SCRIPT });
		let bare = await createBareRepo();
		gitIn(cwd, "remote", "add", "origin", bare);
		let run = await invoke(cli, ["run", "ci.ts", "--push"], { cwd, env: ENV });
		expect(gitIn(bare, "rev-parse", "main")).toBe(gitIn(cwd, "rev-parse", "HEAD"));
		expect(run.code).toBe(1);
		expect(run.stdout).toContain("Not signed off: origin does not point at a GitHub repository");
	});

	test("--push without ci.signoff pushes nothing and exits 1", async () => {
		let cwd = await repoWith(
			`export default async (ci) => { await ci.step("Lint", "true"); ci.success("Done."); };\n`,
		);
		let run = await invoke(cli, ["run", "ci.ts", "--push"], { cwd, env: ENV });
		expect(run.code).toBe(1);
		expect(run.stderr).toContain("Nothing was pushed");
	});
});

describe("sdxc-ci list", () => {
	test("prints every step a passing run reaches, without running any", async () => {
		let cwd = await repoWith(`export default async (ci) => {
	await ci.step("Lint", "exit 1", { halt: true });
	await ci.matrix("Apps", ["blog", "shop"], (app) => ci.step("Test", "exit 1"));
};
`);
		let run = await invoke(cli, ["list", "ci.ts"], { cwd, env: ENV });
		expect(run).toMatchObject({ code: 0, stdout: "Lint\nApps/blog › Test\nApps/shop › Test\n" });
		let keys = await invoke(cli, ["list", "ci.ts", "--matrix", "Apps", "--json"], {
			cwd,
			env: ENV,
		});
		expect(JSON.parse(keys.stdout)).toEqual(["blog", "shop"]);
	});
});

describe("sdxc-ci signoff", () => {
	test("posts the signoff a green run recorded", async () => {
		let cwd = await repoWith(GREEN_SCRIPT);
		await invoke(cli, ["run", "ci.ts", "--no-signoff"], { cwd, env: ENV });
		let posted = acceptStatuses();
		let run = await invoke(cli, ["signoff"], { cwd, env: ENV });
		expect(run.code).toBe(0);
		expect(posted).toHaveLength(1);
	});

	test("refuses a commit no green run recorded", async () => {
		let cwd = await repoWith(GREEN_SCRIPT);
		let run = await invoke(cli, ["signoff"], { cwd, env: ENV });
		expect(run.code).toBe(1);
		expect(run.stderr).toContain("No green run is recorded");
	});

	test("refuses a commit GitHub does not have yet", async () => {
		let cwd = await repoWith(GREEN_SCRIPT);
		await invoke(cli, ["run", "ci.ts", "--no-signoff"], { cwd, env: ENV });
		SERVER.use(
			http.get("https://api.github.com/repos/acme/app/commits/:sha", () =>
				HttpResponse.json({}, { status: 422 }),
			),
		);
		let run = await invoke(cli, ["signoff"], { cwd, env: ENV });
		expect(run.code).toBe(1);
		expect(run.stdout).toContain("the commit is not on GitHub yet");
	});
});

describe("sdxc-ci verify", () => {
	/** Answers the commit's statuses and each creator's permission. */
	function answer(statuses: unknown[], permissions: Record<string, string>): void {
		SERVER.use(
			http.get("https://api.github.com/repos/acme/app/commits/abc/statuses", () =>
				HttpResponse.json(statuses),
			),
			http.get(
				"https://api.github.com/repos/acme/app/collaborators/:login/permission",
				({ params }) =>
					HttpResponse.json({ permission: permissions[String(params.login)] ?? "read" }),
			),
		);
	}

	/** A status as GitHub lists it. */
	function status(login: string, state = "success", context = "sdxc/ci") {
		return {
			state,
			context,
			description: "Passed on laptop in 1m 2s",
			created_at: "2026-11-03T10:00:00Z",
			creator: { login },
		};
	}

	test("exits 0 for a contributor's signoff", async () => {
		answer([status("ada")], { ada: "write" });
		let run = await invoke(cli, ["verify", "abc", "--repo", "acme/app", "--json"], { env: ENV });
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toMatchObject({ signed: true, by: "ada" });
	});

	test("exits 1 without a status, or when only a non-contributor posted one", async () => {
		answer([status("ada", "success", "other/check")], {});
		let none = await invoke(cli, ["verify", "abc", "--repo", "acme/app"], { env: ENV });
		answer([status("mallory")], { mallory: "read" });
		let outsider = await invoke(cli, ["verify", "abc", "--repo", "acme/app"], { env: ENV });
		expect(none).toMatchObject({
			code: 1,
			stdout: "Not signed off: the commit has no sdxc/ci status\n",
		});
		expect(outsider.code).toBe(1);
		expect(outsider.stdout).toContain("mallory has no write access");
	});

	test("exits 2 when GitHub cannot answer, so an outage never reads as unsigned", async () => {
		SERVER.use(
			http.get("https://api.github.com/repos/acme/app/commits/abc/statuses", () =>
				HttpResponse.json({}, { status: 502 }),
			),
		);
		let run = await invoke(cli, ["verify", "abc", "--repo", "acme/app"], { env: ENV });
		expect(run.code).toBe(2);
	});

	test("--wait polls until the signoff appears", async () => {
		let calls = 0;
		SERVER.use(
			http.get("https://api.github.com/repos/acme/app/commits/abc/statuses", () => {
				calls += 1;
				return HttpResponse.json(calls === 1 ? [] : [status("ada")]);
			}),
			http.get("https://api.github.com/repos/acme/app/collaborators/:login/permission", () =>
				HttpResponse.json({ permission: "admin" }),
			),
		);
		let run = await invoke(cli, ["verify", "abc", "--repo", "acme/app", "--wait", "6s"], {
			env: ENV,
		});
		expect(run.code).toBe(0);
		expect(calls).toBe(2);
	}, 15_000);

	test("rejects a malformed --wait or --repo with exit 2", async () => {
		let wait = await invoke(cli, ["verify", "abc", "--repo", "acme/app", "--wait", "soon"], {
			env: ENV,
		});
		let repo = await invoke(cli, ["verify", "abc", "--repo", "acme"], { env: ENV });
		expect([wait.code, repo.code]).toEqual([2, 2]);
	});
});

describe("sdxc-ci --worktree, --since and --watch", () => {
	test("--worktree signs off from a clean worktree while the main checkout is dirty", async () => {
		let cwd = await repoWith(GREEN_SCRIPT);
		await writeFile(join(cwd, "scratch.txt"), "other session");
		let posted = acceptStatuses();
		let run = await invoke(cli, ["run", "ci.ts", "--worktree"], { cwd, env: ENV });
		let head = gitIn(cwd, "rev-parse", "HEAD");
		expect(run.code).toBe(0);
		expect(run.stdout).toContain("Running in worktree");
		expect(run.stdout).toContain(`Signed off ${head.slice(0, 10)} as sdxc/ci.`);
		expect(posted).toHaveLength(1);
		expect(gitIn(cwd, "status", "--porcelain")).toContain("scratch.txt");
	});

	test("--since scopes list to the workspaces the range changed", async () => {
		let cwd = await createRepo({
			"package.json": JSON.stringify({ workspaces: ["packages/*"] }),
			"packages/a/package.json": JSON.stringify({ name: "a" }),
			"packages/b/package.json": JSON.stringify({ name: "b" }),
			"ci.ts": `export default async (ci) => {
	await ci.matrix("Workspaces", await ci.workspaces(), (ws) => ci.step("Test", "true"));
};
`,
		});
		gitIn(cwd, "checkout", "-b", "topic");
		await writeFile(
			join(cwd, "packages/a/package.json"),
			JSON.stringify({ name: "a", version: "2" }),
		);
		gitIn(cwd, "add", "-A");
		gitIn(cwd, "commit", "--quiet", "--no-verify", "-m", "Change a");
		let listed = await invoke(cli, ["list", "ci.ts", "--since", "main", "--json"], {
			cwd,
			env: ENV,
		});
		expect(listed.code).toBe(0);
		expect(JSON.parse(listed.stdout)).toEqual([
			{ name: "Test", label: "Workspaces/a › Test", entry: "Workspaces/a" },
		]);
	});

	test("--watch rejects --push", async () => {
		let cwd = await repoWith(GREEN_SCRIPT);
		let run = await invoke(cli, ["run", "ci.ts", "--watch", "--push"], { cwd, env: ENV });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("--watch cannot be combined with --push");
	});
});
