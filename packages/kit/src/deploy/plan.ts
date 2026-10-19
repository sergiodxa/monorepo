/**
 * What `sdxc deploy` shows before it touches production and says when a step fails: the steps
 * it runs, the migrations the app's own `db migrate --remote --pending` lists, and where
 * production stands after a failure, worded from what already ran.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ExecError } from "@sdxc/cli";

/** The steps `sdxc deploy` runs, in order; `--skip` names any of them. */
export const DEPLOY_STEPS = ["build", "migrate", "deploy"] as const;

/** One of the steps `sdxc deploy` runs. */
export type DeployStep = (typeof DEPLOY_STEPS)[number];

/**
 * What the migration step does, as the plan reports it. `unlisted` is an app whose `db migrate`
 * has no `--pending`: its `--remote` run still happens, since applying is safe to repeat.
 */
export type MigrationStep =
	| { status: "pending"; names: string[] }
	| { status: "unlisted" }
	| { status: "skipped"; reason: string };

/** Everything the confirmation prints. */
export interface Plan {
	app: string;
	/** `false` when `--skip build` deploys the output an earlier build wrote. */
	build: boolean;
	migrations: MigrationStep;
	deploy: boolean;
}

/** The migration names `db migrate --pending` printed, one per line, in the order it applies them. */
export function parsePending(stdout: string): string[] {
	return stdout
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "");
}

/**
 * Whether the app's command line ended with the usage error its parser prints for `kind`, such
 * as `Unknown command "deploy" for blog` or `Unknown flag --pending`.
 *
 * @param error - The failure of a run whose stderr was collected
 * @param kind - The word the message starts with
 */
export function isUnknown(error: Error, kind: "command" | "flag"): boolean {
	return (
		error instanceof ExecError &&
		error.code === 2 &&
		error.stderr.includes(kind === "command" ? "Unknown command" : "Unknown flag")
	);
}

/** Whether the migration step applies anything once the plan is confirmed. */
export function migrates(step: MigrationStep): boolean {
	return step.status === "unlisted" || (step.status === "pending" && step.names.length > 0);
}

/** The plan as the terminal shows it, one fact per line and one line per pending migration. */
export function formatPlan(plan: Plan): string {
	let lines = [
		`App:        ${plan.app}`,
		`Build:      ${plan.build ? "built just now" : "the existing build output (--skip build)"}`,
	];
	let migrations = plan.migrations;
	if (migrations.status === "skipped") {
		lines.push(`Migrations: none to apply (${migrations.reason})`);
	} else if (migrations.status === "unlisted") {
		lines.push(
			"Migrations: db migrate --remote runs; the app's db migrate has no --pending to list them",
		);
	} else if (migrations.names.length === 0) {
		lines.push("Migrations: none pending");
	} else {
		lines.push(`Migrations: ${migrations.names.length} pending`);
		for (let name of migrations.names) lines.push(`  ${name}`);
	}
	lines.push(`Deploy:     ${plan.deploy ? "the app's deploy command" : "skipped (--skip deploy)"}`);
	return `${lines.join("\n")}\n`;
}

/** Where production stands when the app's `deploy` fails after the migration step. */
export function deployFailure(step: MigrationStep): string {
	if (step.status === "unlisted") {
		return "Deploy failed after db migrate --remote ran, so production may run the previous version on a newer schema";
	}
	if (step.status === "pending" && step.names.length > 0) {
		return `Deploy failed; migrations ${step.names.join(", ")} were applied, so production runs the previous version on the new schema`;
	}
	return "Deploy failed; no migrations were applied, and production still runs the previous version";
}
