/**
 * Tests `sdxc deploy` as a developer meets it: build, migrate and deploy run in that order behind
 * one confirmation, a failed step stops the ones after it and says what already happened, and a
 * run without a terminal needs `--yes`. Every `cf` call is a scripted reply; nothing is deployed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { ExecReply } from "@sdxc/cli/test";

import { invoke } from "@sdxc/cli/test";
import { success } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

/** The production database id the fixture's build output binds as `DB`. */
const DATABASE_ID = "1549b30f-b4ba-48b0-b08a-76b8003a37db";

/** `cf auth whoami` for a login that reaches one account. */
const WHOAMI = JSON.stringify({
	authenticated: true,
	email: "ada@example.com",
	accounts: [{ id: "acc123", name: "Ada's Account" }],
});

/** The commands a full deploy runs, as `invoke` keys them. */
const COMMANDS = {
	whoami: "cf auth whoami",
	build: "bun run build",
	list: `cf d1 migrations list ${DATABASE_ID} --dir database/migrations`,
	migrate: "bun bootstrap/cli.ts db migrate --remote",
	deploy: "cf deploy --prebuilt",
};

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A project holding `files`, each path relative to its root. */
async function project(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-deploy-"));
	PROJECTS.push(root);
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/**
 * An app on Bun with a build script, a command line, two migrations and the build output a
 * `vp build` leaves, binding `env` (a D1 `DB` unless given).
 */
function app(env: Record<string, unknown> = { DB: { type: "d1", name: "app", id: DATABASE_ID } }) {
	return {
		"package.json": JSON.stringify({
			name: "app",
			packageManager: "bun@1.3.0",
			scripts: { build: "vp build" },
		}),
		"bootstrap/cli.ts": "await cli.run(process.argv.slice(2));\n",
		"database/migrations/0001_init.sql": "CREATE TABLE posts (id TEXT);\n",
		"database/migrations/0002_tags.sql": "CREATE TABLE tags (id TEXT);\n",
		".cloudflare/output/v0/workers/default/worker.config.json": JSON.stringify({
			name: "app",
			env,
		}),
	};
}

/** Replies for a deploy where every step succeeds and `pending` are the unapplied migrations. */
function replies(pending: string[] = ["0002_tags.sql"]): Record<string, ExecReply> {
	return {
		[COMMANDS.whoami]: { stdout: WHOAMI },
		[COMMANDS.build]: {},
		[COMMANDS.list]: { stdout: JSON.stringify(pending.map((Name) => ({ Name }))) },
		[COMMANDS.migrate]: {},
		[COMMANDS.deploy]: {},
	};
}

/** The commands a run executed, as a shell user writes them. */
function ran(calls: { command: string[] }[]): string[] {
	return calls.map((call) => call.command.join(" "));
}

describe("sdxc deploy", () => {
	test("builds, migrates, then deploys, after printing the plan", async () => {
		let root = await project(app());

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: replies(),
		});

		expect(run.code).toBe(0);
		expect(ran(run.exec)).toEqual([
			COMMANDS.whoami,
			COMMANDS.build,
			COMMANDS.list,
			COMMANDS.migrate,
			COMMANDS.deploy,
		]);
		expect(run.stdout).toContain("Worker:     app");
		expect(run.stdout).toContain("Account:    Ada's Account (acc123), as ada@example.com");
		expect(run.stdout).toContain(`Migrations: 1 pending on DB (${DATABASE_ID})\n  0002_tags.sql`);
		expect(run.stdout).toContain("Applied 1 migrations and deployed app");
	});

	test("refuses without a terminal and --yes, before running anything", async () => {
		let root = await project(app());

		let run = await invoke(createSDXC(), ["deploy"], { cwd: root, interactive: false });

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("needs --yes");
		expect(run.exec).toEqual([]);
	});

	test("asks on a terminal and touches nothing remote when the answer is no", async () => {
		let root = await project(app());

		let run = await invoke(createSDXC(), ["deploy"], {
			cwd: root,
			answers: { confirm: false },
			exec: replies(),
		});

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("nothing was migrated or deployed");
		expect(ran(run.exec)).toEqual([COMMANDS.whoami, COMMANDS.build, COMMANDS.list]);
	});

	test("deploys once the terminal answer is yes", async () => {
		let root = await project(app());

		let run = await invoke(createSDXC(), ["deploy"], {
			cwd: root,
			answers: { confirm: true },
			exec: replies(),
		});

		expect(run.code).toBe(0);
		expect(ran(run.exec)).toContain(COMMANDS.deploy);
	});

	test("prints the plan and changes nothing remote with --dry-run", async () => {
		let root = await project(app());

		let run = await invoke(createSDXC(), ["deploy", "--dry-run"], {
			cwd: root,
			interactive: false,
			exec: replies(),
		});

		expect(run.code).toBe(0);
		expect(run.stdout).toContain("0002_tags.sql");
		expect(run.stdout).toContain("Dry run: nothing was migrated or deployed");
		expect(ran(run.exec)).toEqual([COMMANDS.whoami, COMMANDS.build, COMMANDS.list]);
	});

	test("tells cf the deploy is confirmed, so it applies migrations without asking again", async () => {
		let root = await project(app());
		let envs: Record<string, Record<string, string | undefined>> = {};

		await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: async (command, request) => {
				let shown = command.join(" ");
				envs[shown] = request.env;
				return success({ code: 0, stdout: replies()[shown]?.stdout ?? "", stderr: "", output: "" });
			},
		});

		expect(envs[COMMANDS.migrate]).toMatchObject({ CI: "1" });
		expect(envs[COMMANDS.migrate]?.PATH).toContain(join(root, "node_modules", ".bin"));
	});

	test("stops after a failed build, saying nothing was migrated or deployed", async () => {
		let root = await project(app());

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: { ...replies(), [COMMANDS.build]: { code: 1 } },
		});

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("Build failed; nothing was migrated or deployed");
		expect(ran(run.exec)).toEqual([COMMANDS.whoami, COMMANDS.build]);
	});

	test("deploys nothing after failed migrations", async () => {
		let root = await project(app());

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: { ...replies(), [COMMANDS.migrate]: { code: 1 } },
		});

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("Migrations failed; the Worker was not deployed");
		expect(ran(run.exec)).not.toContain(COMMANDS.deploy);
	});

	test("names the applied migrations when the deploy after them fails", async () => {
		let root = await project(app());

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: { ...replies(), [COMMANDS.deploy]: { code: 1 } },
		});

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("Deploy failed; migrations 0002_tags.sql were applied");
	});

	test("skips the migration step when none are pending", async () => {
		let root = await project(app());

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: replies([]),
		});

		expect(run.code).toBe(0);
		expect(run.stdout).toContain("Migrations: none to apply (none pending on DB)");
		expect(ran(run.exec)).not.toContain(COMMANDS.migrate);
	});

	test("lists no migrations for a Worker without a D1 database", async () => {
		let root = await project(app({}));

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: replies(),
		});

		expect(run.code).toBe(0);
		expect(ran(run.exec)).toEqual([COMMANDS.whoami, COMMANDS.build, COMMANDS.deploy]);
	});

	test("deploys the existing output with --skip-build and --skip-migrations", async () => {
		let root = await project(app());

		let run = await invoke(createSDXC(), ["deploy", "--yes", "--skip-build", "--skip-migrations"], {
			cwd: root,
			interactive: false,
			exec: replies(),
		});

		expect(run.code).toBe(0);
		expect(run.stdout).toContain("existing .cloudflare/output (--skip-build)");
		expect(ran(run.exec)).toEqual([COMMANDS.whoami, COMMANDS.deploy]);
	});

	test("stops before the build when cf is not logged in", async () => {
		let root = await project(app());

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: { [COMMANDS.whoami]: { stdout: JSON.stringify({ authenticated: false }) } },
		});

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("cf auth login");
		expect(ran(run.exec)).toEqual([COMMANDS.whoami]);
	});

	test("stops before anything remote while the database keeps the template's placeholder id", async () => {
		let placeholder = "00000000-0000-4000-8000-000000000000";
		let root = await project(app({ DB: { type: "d1", id: placeholder } }));

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: replies(),
		});

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("cf d1 create");
		expect(ran(run.exec)).toEqual([COMMANDS.whoami, COMMANDS.build]);
	});
});
