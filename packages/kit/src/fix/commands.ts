/**
 * Command-shaped `sdxc fix` repairs: re-run `typegen`, `ui update`, package install and
 * `upgrade` when those are already the doctor check's `fix`, without new mutation logic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { join } from "node:path";

import type { AnyCommandContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Config } from "../config.js";
import type { CheckReport } from "../doctor/check.js";
import type { PackageManager } from "../package-manager.js";
import type { Manifest } from "../upgrade/project.js";

import { createDoctorContext, runChecks } from "../doctor/check.js";
import { CHECKS } from "../doctor/checks.js";

/** What one command-shaped fix ran or would run. */
export interface CommandFix {
	check: string;
	command: string[];
}

/** Context `fix` needs to exec and print. */
export type FixContext = Pick<AnyCommandContext, "stdout" | "exec">;

/**
 * Re-runs the command-shaped doctor checks and executes each repairable `fix`. Under
 * `dryRun` it prints the commands and changes nothing.
 */
export async function fixCommands(
	ctx: FixContext,
	options: {
		root: string;
		packageRoot: string;
		manager: PackageManager;
		config: Config;
		manifest: Manifest;
		dryRun: boolean;
	},
): Promise<Result<CommandFix[], Error>> {
	let context = createDoctorContext({
		root: options.root,
		manifest: options.manifest,
		config: options.config,
		manager: options.manager,
		packageRoot: options.packageRoot,
	});
	let names = new Set(["typegen", "ui", "installed", "pins", "remix"]);
	let reports = await runChecks(
		CHECKS.filter((check) => names.has(check.name)),
		context,
	);
	let bin = join(options.packageRoot, "src/bin.ts");
	let fixes: CommandFix[] = [];
	for (let report of reports) {
		if (report.status !== "warn" && report.status !== "fail") continue;
		if (report.fix === null) continue;
		let command = parseFixCommand(report, options.manager, bin);
		if (command === null) continue;
		fixes.push({ check: report.name, command });
		if (options.dryRun) {
			ctx.stdout(`would run ${command.join(" ")}\n`);
			continue;
		}
		ctx.stdout(`running ${command.join(" ")}\n`);
		let ran = await ctx.exec(command, { cwd: options.root, stdio: "inherit" });
		if (isFailure(ran)) {
			return failure(new Error(`${command.join(" ")} failed`));
		}
	}
	return success(fixes);
}

/**
 * Turns a doctor `fix` string into an argv the project can run. Only command-shaped fixes
 * are accepted; prose instructions return `null`.
 */
export function parseFixCommand(
	report: CheckReport,
	manager: PackageManager,
	bin: string,
): string[] | null {
	let fix = report.fix;
	if (fix === null) return null;
	if (fix === manager.install.join(" ")) return [...manager.install];
	if (fix.startsWith("sdxc ")) {
		return ["bun", bin, ...fix.slice("sdxc ".length).split(/\s+/).filter(Boolean)];
	}
	return null;
}
