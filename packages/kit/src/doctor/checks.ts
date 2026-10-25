/**
 * The checks `sdxc doctor` runs, in report order, and the two forms the report takes: one line
 * per check for a person and one JSON document for an agent. Adding a check means adding it to
 * `CHECKS`; both forms print it without further changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Check, CheckReport } from "./check.js";

import { complexityCheck } from "./complexity.js";
import { constantNamesCheck } from "./constant-names.js";
import { crapCheck } from "./crap.js";
import { dependenciesCheck } from "./dependencies.js";
import { duplicationCheck } from "./duplication.js";
import { emailsCheck } from "./emails.js";
import { envCheck } from "./env.js";
import { fanOutCheck } from "./fan-out.js";
import { featureScatterCheck } from "./feature-scatter.js";
import { fetchParamCheck } from "./fetch-param.js";
import { installedCheck } from "./installed.js";
import { jsdocCheck } from "./jsdoc.js";
import { layoutCheck } from "./layout.js";
import { localConstCheck } from "./local-const.js";
import { loggerCheck } from "./logger.js";
import { migrationsCheck } from "./migrations.js";
import { modelsCheck } from "./models.js";
import { moduleSizeCheck } from "./module-size.js";
import { mutationCheck } from "./mutation.js";
import { orphansCheck } from "./orphans.js";
import { pinsCheck } from "./pins.js";
import { processEnvCheck } from "./process-env.js";
import { remixCheck } from "./remix.js";
import { resultThrowsCheck } from "./result-throws.js";
import { routesCheck } from "./routes.js";
import { stackImportsCheck } from "./stack-imports.js";
import { testRatioCheck } from "./test-ratio.js";
import { typegenCheck } from "./typegen.js";
import { uiCheck } from "./ui.js";

/**
 * Every built-in check: release drift, the install and the `remix` peer first, then the
 * Worker's secrets and types, then the app's own code, layout, quality metrics and source
 * conventions, then copied components.
 */
export const CHECKS: readonly Check[] = [
	pinsCheck,
	installedCheck,
	remixCheck,
	envCheck,
	typegenCheck,
	migrationsCheck,
	layoutCheck,
	routesCheck,
	modelsCheck,
	emailsCheck,
	jsdocCheck,
	complexityCheck,
	moduleSizeCheck,
	dependenciesCheck,
	fanOutCheck,
	orphansCheck,
	featureScatterCheck,
	duplicationCheck,
	resultThrowsCheck,
	localConstCheck,
	constantNamesCheck,
	stackImportsCheck,
	processEnvCheck,
	fetchParamCheck,
	loggerCheck,
	testRatioCheck,
	crapCheck,
	mutationCheck,
	uiCheck,
];

/** Whether any check failed, which makes `sdxc doctor` exit 1. */
export function hasFailure(reports: readonly CheckReport[]): boolean {
	return reports.some((report) => report.status === "fail");
}

/**
 * One line per check: its status and name in aligned columns, what it found with each finding
 * after a colon, and the fix after it, so a line reads whole when copied on its own.
 */
export function formatText(reports: readonly CheckReport[]): string {
	let width = Math.max(0, ...reports.map((report) => report.name.length));
	return reports
		.map((report) => {
			let line = `${report.status.padEnd(4)}  ${report.name.padEnd(width)}  ${report.message}`;
			if (report.findings.length > 0) line += `: ${report.findings.join("; ")}`;
			if (report.fix !== null) line += `. Fix: ${report.fix}`;
			return `${line}\n`;
		})
		.join("");
}

/** The report as one JSON document, `ok` false exactly when the run exits 1. */
export function formatJSON(reports: readonly CheckReport[]): string {
	let checks = reports.map(({ name, status, message, findings, fix }) => ({
		name,
		status,
		message,
		findings,
		fix,
	}));
	return `${JSON.stringify({ ok: !hasFailure(reports), checks }, null, 2)}\n`;
}
