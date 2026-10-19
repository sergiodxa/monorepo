/**
 * The `sdxc deploy` handler: builds the project, then runs the app's own `db migrate --remote`
 * and `deploy` commands, so new code never reaches production ahead of the schema it expects
 * and each app decides how it is migrated and where it ships.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { stat } from "node:fs/promises";
import { basename, join } from "node:path";

import { createCommand, ExecError, exit, failure, success, usage } from "@sdxc/cli";
import { isFailure, isSuccess, wrap } from "@sdxc/result";

import type { MigrationStep } from "../deploy/plan.js";

import { SDXC_COMMANDS } from "../contract.js";
import { deployFailure, formatPlan, isUnknown, migrates, parsePending } from "../deploy/plan.js";
import { project } from "../middleware.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import { readManifest } from "../upgrade/project.js";

import { CLI_ENTRY, commandLine, projectPath } from "./run.js";

/**
 * Runs build, `db migrate --remote` and `deploy` in that order and stops at the first failure,
 * whose message says what production now runs. Every remote change waits for a yes: `--yes`, or
 * a terminal answer after the plan; without a terminal, a missing `--yes` is a usage error.
 */
export default createCommand(SDXC_COMMANDS.deploy, {
	middleware: [project()],
	/** Fails naming the step that stopped the run and the steps that already ran. */
	async handler(ctx) {
		let { yes, dryRun } = ctx.flags;
		let skip = new Set(ctx.flags.skip);
		if (!yes && !dryRun && !ctx.stdin.isTTY) {
			return usage("Deploying to production without a terminal needs --yes");
		}
		if (skip.has("migrate") && skip.has("deploy")) {
			return usage("--skip migrate and --skip deploy leave nothing to run in production");
		}
		let root = ctx.project.root;
		let path = projectPath(root, ctx.env.PATH);
		if (!isSuccess(await wrap(() => stat(join(root, CLI_ENTRY))))) {
			return failure(
				new Error(
					`${CLI_ENTRY} is missing; sdxc deploy runs the app's db migrate --remote and deploy commands from it`,
				),
			);
		}
		let manifest = await readManifest(root);
		if (isFailure(manifest)) return manifest;
		let app = manifest.data.manifest.name ?? basename(root);

		if (!skip.has("build")) {
			if (manifest.data.manifest.scripts?.build === undefined) {
				return failure(
					new Error("package.json has no build script; add one, or pass --skip build"),
				);
			}
			let manager = await packageManager({
				declared: manifest.data.manifest.packageManager,
				findLockFile: lockFileAtOrAbove(root),
			});
			let built = await ctx.exec([...manager.run, "build"], {
				cwd: root,
				stdio: "inherit",
				env: { PATH: path },
			});
			if (isFailure(built)) {
				return failure(new Error("Build failed; nothing was migrated or deployed"));
			}
		}

		let migrations: MigrationStep = { status: "skipped", reason: "--skip migrate" };
		if (!skip.has("migrate")) {
			let listing = await commandLine(root, ["db", "migrate", "--remote", "--pending"]);
			if (isFailure(listing)) return listing;
			let listed = await ctx.exec(listing.data, {
				cwd: root,
				stdio: "collect",
				env: { PATH: path },
			});
			if (isSuccess(listed)) {
				migrations = { status: "pending", names: parsePending(listed.data.stdout) };
			} else if (isUnknown(listed.error, "flag")) {
				migrations = { status: "unlisted" };
			} else if (isUnknown(listed.error, "command")) {
				return failure(
					new Error(
						"The app's command line has no db migrate command; add one that applies production migrations with --remote, or pass --skip migrate",
					),
				);
			} else {
				return failure(
					new Error(
						`Listing pending migrations with db migrate --remote --pending failed; nothing was migrated or deployed: ${listed.error.message}`,
					),
				);
			}
		}

		if (!skip.has("deploy")) {
			let checking = await commandLine(root, ["deploy", "--dry-run"]);
			if (isFailure(checking)) return checking;
			let checked = await ctx.exec(checking.data, {
				cwd: root,
				stdio: "inherit",
				env: { PATH: path },
			});
			if (isFailure(checked)) {
				return failure(
					new Error(
						exitCode(checked.error) === 2
							? "The app's command line has no deploy command taking --dry-run; add one, or pass --skip deploy"
							: "The app's deploy --dry-run failed; nothing was migrated or deployed",
					),
				);
			}
		}

		ctx.stdout(
			formatPlan({
				app,
				build: !skip.has("build"),
				migrations,
				deploy: !skip.has("deploy"),
			}),
		);
		if (dryRun) {
			ctx.stdout("Dry run: nothing was migrated or deployed\n");
			return success();
		}
		if (!yes) {
			let confirmed = await ctx.prompt.confirm({
				message: skip.has("deploy")
					? `Apply ${app}'s migrations to production?`
					: `Deploy ${app} to production?`,
				default: false,
				name: "confirm",
			});
			if (isFailure(confirmed)) return confirmed;
			if (!confirmed.data) return exit(1, "Not confirmed; nothing was migrated or deployed");
		}

		if (migrates(migrations)) {
			let command = await commandLine(root, ["db", "migrate", "--remote"]);
			if (isFailure(command)) return command;
			/** `CI=1` makes `cf` take the yes this run already got instead of asking again. */
			let migrated = await ctx.exec(command.data, {
				cwd: root,
				stdio: "inherit",
				env: { PATH: path, CI: "1" },
			});
			if (isFailure(migrated)) {
				return failure(
					new Error(
						"Migrations failed, so nothing was deployed; the ones before the failure may be applied",
					),
				);
			}
		}

		if (skip.has("deploy")) {
			ctx.stdout(`${migrated(migrations)}; deploy skipped\n`);
			return success();
		}
		let command = await commandLine(root, ["deploy"]);
		if (isFailure(command)) return command;
		let deployed = await ctx.exec(command.data, {
			cwd: root,
			stdio: "inherit",
			env: { PATH: path },
		});
		if (isFailure(deployed)) return failure(new Error(deployFailure(migrations)));
		ctx.stdout(`${migrated(migrations)} and deployed ${app}\n`);
		return success();
	},
});

/** The exit code a failed child reported; `undefined` when it never ran or was killed. */
function exitCode(error: Error): number | undefined {
	return error instanceof ExecError && error.code !== null ? error.code : undefined;
}

/** What the migration step did, as the closing line reports it. */
function migrated(step: MigrationStep): string {
	if (step.status === "unlisted") return "Ran db migrate --remote";
	if (step.status === "pending" && step.names.length > 0) {
		return `Applied ${step.names.length} migrations`;
	}
	return "Applied no migrations";
}
