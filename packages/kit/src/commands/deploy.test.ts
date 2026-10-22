/**
 * Tests `sdxc deploy` as a developer meets it: the build, the app's `db migrate --remote` and its
 * `deploy` run in that order behind one confirmation, a failed step stops the ones after it and
 * says what already happened, and a run without a terminal needs `--yes`. Nothing is deployed.
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
import { afterEach, describe, expect, test } from "vite-plus/test";

import { createSDXC } from "../cli.js";

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

/** The commands a full deploy runs, as `invoke` keys them. */
const COMMANDS = {
	build: "bun run build",
	pending: "bun bootstrap/cli.ts db migrate --remote --pending",
	check: "bun bootstrap/cli.ts deploy --dry-run",
	migrate: "bun bootstrap/cli.ts db migrate --remote",
	deploy: "bun bootstrap/cli.ts deploy",
};

/** The usage error the app's command line prints for a command it lacks. */
const UNKNOWN_COMMAND: ExecReply = { code: 2, stderr: 'Unknown command "migrate" for app db\n' };

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** An app on Bun with a build script and a command line. */
async function project(): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-deploy-"));
	PROJECTS.push(root);
	let files = {
		"package.json": JSON.stringify({
			name: "app",
			packageManager: "bun@1.3.0",
			scripts: { build: "vp build" },
		}),
		"bootstrap/cli.ts": "await cli.run(process.argv.slice(2));\n",
	};
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** Replies for a deploy where every step succeeds and `pending` are the unapplied migrations. */
function replies(pending: string[] = ["0002_tags.sql"]): Record<string, ExecReply> {
	return {
		[COMMANDS.build]: {},
		[COMMANDS.pending]: { stdout: pending.map((name) => `${name}\n`).join("") },
		[COMMANDS.check]: {},
		[COMMANDS.migrate]: {},
		[COMMANDS.deploy]: {},
	};
}

/** The commands a run executed, as a shell user writes them. */
function ran(calls: { command: string[] }[]): string[] {
	return calls.map((call) => call.command.join(" "));
}

describe("sdxc deploy", () => {
	test("builds, runs the app's migrate, then its deploy, after printing the plan", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: replies(),
		});

		expect(run.code).toBe(0);
		expect(ran(run.exec)).toEqual([
			COMMANDS.build,
			COMMANDS.pending,
			COMMANDS.check,
			COMMANDS.migrate,
			COMMANDS.deploy,
		]);
		expect(run.stdout).toContain("App:        app");
		expect(run.stdout).toContain("Migrations: 1 pending\n  0002_tags.sql");
		expect(run.stdout).toContain("Deploy:     the app's deploy command");
		expect(run.stdout).toContain("Applied 1 migrations and deployed app");
	});

	test("refuses without a terminal and --yes, before running anything", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy"], { cwd: root, interactive: false });

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("needs --yes");
		expect(run.exec).toEqual([]);
	});

	test("asks on a terminal and touches nothing remote when the answer is no", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy"], {
			cwd: root,
			answers: { confirm: false },
			exec: replies(),
		});

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("nothing was migrated or deployed");
		expect(ran(run.exec)).toEqual([COMMANDS.build, COMMANDS.pending, COMMANDS.check]);
	});

	test("deploys once the terminal answer is yes", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy"], {
			cwd: root,
			answers: { confirm: true },
			exec: replies(),
		});

		expect(run.code).toBe(0);
		expect(ran(run.exec)).toContain(COMMANDS.deploy);
	});

	test("prints the plan and changes nothing remote with --dry-run", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy", "--dry-run"], {
			cwd: root,
			interactive: false,
			exec: replies(),
		});

		expect(run.code).toBe(0);
		expect(run.stdout).toContain("0002_tags.sql");
		expect(run.stdout).toContain("Dry run: nothing was migrated or deployed");
		expect(ran(run.exec)).toEqual([COMMANDS.build, COMMANDS.pending, COMMANDS.check]);
	});

	test("tells cf the deploy is confirmed, so it applies migrations without asking again", async () => {
		let root = await project();
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
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: { ...replies(), [COMMANDS.build]: { code: 1 } },
		});

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("Build failed; nothing was migrated or deployed");
		expect(ran(run.exec)).toEqual([COMMANDS.build]);
	});

	test("deploys nothing after failed migrations", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: { ...replies(), [COMMANDS.migrate]: { code: 1 } },
		});

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("Migrations failed, so nothing was deployed");
		expect(ran(run.exec)).not.toContain(COMMANDS.deploy);
	});

	test("names the applied migrations when the deploy after them fails", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: { ...replies(), [COMMANDS.deploy]: { code: 1 } },
		});

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("Deploy failed; migrations 0002_tags.sql were applied");
	});

	test("skips the migration step when none are pending", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: replies([]),
		});

		expect(run.code).toBe(0);
		expect(run.stdout).toContain("Migrations: none pending");
		expect(ran(run.exec)).not.toContain(COMMANDS.migrate);
	});

	test("runs db migrate --remote unlisted when the app's db migrate has no --pending", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: {
				...replies(),
				[COMMANDS.pending]: { code: 2, stderr: "Unknown flag --pending\n" },
				[COMMANDS.deploy]: { code: 1 },
			},
		});

		expect(run.stdout).toContain("the app's db migrate has no --pending to list them");
		expect(ran(run.exec)).toContain(COMMANDS.migrate);
		expect(run.stderr).toContain("Deploy failed after db migrate --remote ran");
	});

	test("stops before anything remote when the app has no db migrate command", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: { ...replies(), [COMMANDS.pending]: UNKNOWN_COMMAND },
		});

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("no db migrate command");
		expect(run.stderr).toContain("--skip migrate");
		expect(ran(run.exec)).toEqual([COMMANDS.build, COMMANDS.pending]);
	});

	test("stops before anything remote when the app has no deploy command", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy", "--yes"], {
			cwd: root,
			interactive: false,
			exec: { ...replies(), [COMMANDS.check]: UNKNOWN_COMMAND },
		});

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("no deploy command");
		expect(ran(run.exec)).not.toContain(COMMANDS.migrate);
	});

	test("leaves out the steps --skip names, repeated or as a list", async () => {
		let root = await project();

		let repeated = await invoke(
			createSDXC(),
			["deploy", "--yes", "--skip", "build", "--skip", "migrate"],
			{ cwd: root, interactive: false, exec: replies() },
		);
		let listed = await invoke(createSDXC(), ["deploy", "--yes", "--skip=build,migrate"], {
			cwd: root,
			interactive: false,
			exec: replies(),
		});

		expect(repeated.code).toBe(0);
		expect(repeated.stdout).toContain("the existing build output (--skip build)");
		expect(repeated.stdout).toContain("Migrations: none to apply (--skip migrate)");
		expect(ran(repeated.exec)).toEqual([COMMANDS.check, COMMANDS.deploy]);
		expect(ran(listed.exec)).toEqual([COMMANDS.check, COMMANDS.deploy]);
	});

	test("migrates without deploying with --skip deploy", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["deploy", "--yes", "--skip", "deploy"], {
			cwd: root,
			interactive: false,
			exec: replies(),
		});

		expect(run.code).toBe(0);
		expect(ran(run.exec)).toEqual([COMMANDS.build, COMMANDS.pending, COMMANDS.migrate]);
		expect(run.stdout).toContain("Applied 1 migrations; deploy skipped");
	});

	test("refuses to skip both remote steps, or a step it does not run", async () => {
		let root = await project();

		let both = await invoke(createSDXC(), ["deploy", "--yes", "--skip=migrate,deploy"], {
			cwd: root,
			interactive: false,
		});
		let unknown = await invoke(createSDXC(), ["deploy", "--yes", "--skip", "tests"], {
			cwd: root,
			interactive: false,
		});

		expect(both.code).toBe(2);
		expect(both.stderr).toContain("leave nothing to run in production");
		expect(unknown.code).toBe(2);
		expect(both.exec).toEqual([]);
	});
});
