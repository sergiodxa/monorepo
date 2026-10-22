/**
 * The `sdxc fix` handlers: command-shaped repairs, `.env.example` secrets, and model/email
 * registration through the same codemods `make` uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SDXC_COMMANDS } from "../contract.js";
import { fixCommands, fixEmails, fixEnv, fixModels } from "../fix/index.js";
import { packageRoot, project } from "../middleware.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import { readManifest } from "../upgrade/project.js";

/** Middleware every `fix` handler runs behind. */
const FIX_MIDDLEWARE = [project(), packageRoot()] as const;

/** `sdxc fix` with no member: command-shaped repairs from doctor. */
export const group = createCommand(SDXC_COMMANDS.fix, {
	middleware: FIX_MIDDLEWARE,
	async handler(ctx) {
		let read = await readManifest(ctx.project.root);
		if (isFailure(read)) return read;
		let manager = await packageManager({
			declared: read.data.manifest.packageManager,
			findLockFile: lockFileAtOrAbove(ctx.project.root),
		});
		let fixed = await fixCommands(ctx, {
			root: ctx.project.root,
			packageRoot: ctx.packageRoot,
			manager,
			config: ctx.project.config,
			manifest: read.data.manifest,
			dryRun: ctx.flags.dryRun,
		});
		if (isFailure(fixed)) return fixed;
		if (fixed.data.length === 0) ctx.stdout("Nothing to fix\n");
		return success();
	},
});

/** `sdxc fix env`. */
export const env = createCommand(SDXC_COMMANDS.fix.env, {
	middleware: FIX_MIDDLEWARE,
	async handler(ctx) {
		let fixed = await fixEnv(ctx.project.root, { dryRun: ctx.flags.dryRun });
		if (isFailure(fixed)) return fixed;
		if (fixed.data.missing.length === 0) {
			ctx.stdout("Every secret is already in .env.example\n");
			return success();
		}
		if (ctx.flags.dryRun) ctx.stdout(fixed.data.diff);
		else ctx.stdout(`appended ${fixed.data.missing.join(", ")} to .env.example\n`);
		return success();
	},
});

/** `sdxc fix models`. */
export const models = createCommand(SDXC_COMMANDS.fix.models, {
	middleware: FIX_MIDDLEWARE,
	async handler(ctx) {
		let fixed = await fixModels(ctx.project.root, { dryRun: ctx.flags.dryRun });
		if (isFailure(fixed)) return fixed;
		if (fixed.data.length === 0) {
			ctx.stdout("Every model is already registered\n");
			return success();
		}
		for (let row of fixed.data) {
			if (ctx.flags.dryRun) for (let diff of row.diffs) ctx.stdout(diff);
			else ctx.stdout(`registered ${row.file}\n`);
		}
		return success();
	},
});

/** `sdxc fix emails`. */
export const emails = createCommand(SDXC_COMMANDS.fix.emails, {
	middleware: FIX_MIDDLEWARE,
	async handler(ctx) {
		let fixed = await fixEmails(ctx.project.root, { dryRun: ctx.flags.dryRun });
		if (isFailure(fixed)) return fixed;
		if (fixed.data.length === 0) {
			ctx.stdout("Every declared email is already mapped\n");
			return success();
		}
		for (let row of fixed.data) {
			if (ctx.flags.dryRun) for (let diff of row.diffs) ctx.stdout(diff);
			else ctx.stdout(`mapped ${row.name} → ${row.template}\n`);
		}
		return success();
	},
});
