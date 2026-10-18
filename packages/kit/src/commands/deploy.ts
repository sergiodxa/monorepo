/**
 * The `sdxc deploy` handler: builds the project, applies its pending production migrations
 * through the app's own `db migrate --remote`, then deploys with `cf deploy --prebuilt`, so new
 * code never reaches production ahead of the schema it expects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { stat } from "node:fs/promises";
import { join } from "node:path";

import { createCommand, exit, failure, success, usage } from "@sdxc/cli";
import { isFailure, isSuccess, wrap } from "@sdxc/result";

import type { MigrationStep } from "../deploy/plan.js";

import { SDXC_COMMANDS } from "../contract.js";
import {
	formatPlan,
	hasMigrations,
	parseIdentity,
	parsePending,
	PLACEHOLDER_DATABASE_ID,
	readBuiltWorker,
} from "../deploy/plan.js";
import { project } from "../middleware.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import { readManifest } from "../upgrade/project.js";

import { CLI_ENTRY, commandLine, projectPath } from "./run.js";

/**
 * Runs build, migrate and deploy in that order and stops at the first failure, whose message
 * says what production now runs. Every remote change waits for a yes: `--yes`, or a terminal
 * answer after the plan; without a terminal, a missing `--yes` is a usage error before any step.
 */
export default createCommand(SDXC_COMMANDS.deploy, {
	middleware: [project()],
	/** Fails naming the step that stopped the run and the steps that already ran. */
	async handler(ctx) {
		let { yes, dryRun, skipBuild, skipMigrations } = ctx.flags;
		if (!yes && !dryRun && !ctx.stdin.isTTY) {
			return usage("Deploying to production without a terminal needs --yes");
		}
		let root = ctx.project.root;
		let path = projectPath(root, ctx.env.PATH);

		let whoami = await ctx.exec(["cf", "auth", "whoami"], {
			cwd: root,
			stdio: "collect",
			env: { PATH: path },
		});
		if (isFailure(whoami)) {
			return failure(new Error(`cf auth whoami failed: ${whoami.error.message}`));
		}
		let identity = parseIdentity(whoami.data.stdout, ctx.env.CLOUDFLARE_ACCOUNT_ID);
		if (isFailure(identity)) return identity;

		if (!skipBuild) {
			let manifest = await readManifest(root);
			if (isFailure(manifest)) return manifest;
			if (manifest.data.manifest.scripts?.build === undefined) {
				return failure(
					new Error("package.json has no build script; add one, or pass --skip-build"),
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

		let worker = await readBuiltWorker(root);
		if (isFailure(worker)) return worker;
		let database = worker.data.database;
		let chain = ctx.project.config.make.migrations.default ?? "database/migrations";
		let migrations: MigrationStep;
		if (skipMigrations) {
			migrations = { status: "skipped", reason: "--skip-migrations" };
		} else if (database === undefined) {
			migrations = { status: "skipped", reason: "the Worker has no D1 database" };
		} else if (!(await hasMigrations(join(root, chain)))) {
			migrations = { status: "skipped", reason: `${chain} holds no migrations` };
		} else if (database.id === PLACEHOLDER_DATABASE_ID) {
			return failure(
				new Error(
					`${database.binding} still has the template's placeholder id; run cf d1 create and put its id in cloudflare.config.ts`,
				),
			);
		} else {
			let listed = await ctx.exec(["cf", "d1", "migrations", "list", database.id, "--dir", chain], {
				cwd: root,
				stdio: "collect",
				env: { PATH: path },
			});
			if (isFailure(listed)) {
				return failure(new Error(`cf d1 migrations list failed: ${listed.error.message}`));
			}
			let pending = parsePending(listed.data.stdout);
			if (isFailure(pending)) return pending;
			migrations =
				pending.data.length === 0
					? { status: "skipped", reason: `none pending on ${database.binding}` }
					: { status: "pending", database, names: pending.data };
		}
		if (
			migrations.status === "pending" &&
			!isSuccess(await wrap(() => stat(join(root, CLI_ENTRY))))
		) {
			return failure(
				new Error(
					`${migrations.names.length} migrations are pending, and ${CLI_ENTRY}, whose db migrate --remote applies them, is missing; apply them yourself and pass --skip-migrations`,
				),
			);
		}

		ctx.stdout(
			formatPlan({
				worker: worker.data.name,
				identity: identity.data,
				prebuilt: skipBuild,
				migrations,
			}),
		);
		if (dryRun) {
			ctx.stdout("Dry run: nothing was migrated or deployed\n");
			return success();
		}
		if (!yes) {
			let confirmed = await ctx.prompt.confirm({
				message: `Deploy ${worker.data.name} to production?`,
				default: false,
				name: "confirm",
			});
			if (isFailure(confirmed)) return confirmed;
			if (!confirmed.data) return exit(1, "Not confirmed; nothing was migrated or deployed");
		}

		let applied = migrations.status === "pending" ? migrations.names : [];
		if (applied.length > 0) {
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
						"Migrations failed; the Worker was not deployed. cf applies migrations one at a time, so the ones before the failure may be applied",
					),
				);
			}
		}

		let deployed = await ctx.exec(["cf", "deploy", "--prebuilt"], {
			cwd: root,
			stdio: "inherit",
			env: { PATH: path },
		});
		if (isFailure(deployed)) {
			return failure(
				new Error(
					applied.length === 0
						? "Deploy failed; no migrations were applied, and production still runs the previous Worker"
						: `Deploy failed; migrations ${applied.join(", ")} were applied, so production runs the previous Worker on the new schema`,
				),
			);
		}
		ctx.stdout(
			applied.length === 0
				? `Deployed ${worker.data.name}\n`
				: `Applied ${applied.length} migrations and deployed ${worker.data.name}\n`,
		);
		return success();
	},
});
