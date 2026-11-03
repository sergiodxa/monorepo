/**
 * How a run reads on a terminal: one line per finished step as it finishes, a failed step's log
 * indented under it, then a summary naming every failure, the closing message and what the
 * signoff did. Colors come from the caller, so a pipe gets plain text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Reporter, RunReport, ScriptErrorRecord, StepRecord } from "./run.js";

import { formatDuration } from "./signoff.js";

/** Wraps text in one color or weight; the identity when color is off. */
export type Paint = (text: string) => string;

/** The colors a report uses. */
export interface Palette {
	green: Paint;
	red: Paint;
	yellow: Paint;
	dim: Paint;
	bold: Paint;
}

/** A palette that leaves text as it is, for pipes and tests. */
export const PLAIN: Palette = {
	green: (text) => text,
	red: (text) => text,
	yellow: (text) => text,
	dim: (text) => text,
	bold: (text) => text,
};

/** `text` with every line indented by two spaces, without a trailing newline. */
function indent(text: string): string {
	return text
		.replace(/\n+$/, "")
		.split("\n")
		.map((line) => `  ${line}`)
		.join("\n");
}

/** One finished step as the run prints it. */
export function formatStep(step: StepRecord, palette: Palette, verbose: boolean): string {
	if (step.status === "skipped") return `${palette.dim(`- ${step.label}  skipped`)}\n`;
	let time = step.cached
		? palette.dim(`cached (${formatDuration(step.duration)})`)
		: palette.dim(formatDuration(step.duration));
	let mark = step.status === "passed" ? palette.green("✓") : palette.red("✗");
	let line = `${mark} ${step.label}  ${time}\n`;
	let showLog = step.output.trim() !== "" && (step.status === "failed" || verbose);
	return showLog ? `${line}${indent(step.output)}\n` : line;
}

/** A script error as the run prints it. */
export function formatError(error: ScriptErrorRecord, palette: Palette): string {
	let where = error.where === null ? "script" : error.where;
	return `${palette.red("✗")} ${where} threw outside a step\n${indent(error.message)}\n`;
}

/** A reporter printing each step through `write` as it finishes. */
export function textReporter(
	write: (text: string) => void,
	palette: Palette,
	verbose: boolean,
): Reporter {
	return {
		step: (record) => write(formatStep(record, palette, verbose)),
		error: (record) => write(formatError(record, palette)),
	};
}

/** The summary printed after the last step: totals, each failure, the closing call, the signoff. */
export function formatSummary(report: RunReport, palette: Palette): string {
	let counted = report.steps.filter((step) => !step.filtered);
	let failed = counted.filter((step) => step.status === "failed");
	let cached = counted.filter((step) => step.cached).length;
	let filtered = report.steps.length - counted.length;
	let lines: string[] = [""];
	let totals = [
		failed.length > 0
			? `${failed.length} of ${counted.length} steps failed`
			: `${counted.filter((step) => step.status === "passed").length} steps passed`,
		...(cached > 0 ? [`${cached} cached`] : []),
		...(filtered > 0 ? [`${filtered} filtered out`] : []),
	].join(", ");
	let mark = report.status === "passing" ? palette.green("✓") : palette.red("✗");
	lines.push(
		`${mark} ${palette.bold(report.status)} — ${totals} (${formatDuration(report.duration)})`,
	);
	for (let step of failed) lines.push(`  ${palette.red("✗")} ${step.label}`);
	for (let error of report.errors)
		lines.push(`  ${palette.red("✗")} ${error.where ?? "script"}: ${error.message.split("\n")[0]}`);
	if (report.closing !== null) {
		let paint =
			report.closing.kind === "failure" || report.exitCode !== 0 ? palette.red : palette.green;
		let detail = report.closing.detail === null ? "" : `  ${palette.dim(report.closing.detail)}`;
		lines.push(`${paint(report.closing.title)}${detail}`);
	}
	lines.push(...signoffLines(report, palette));
	return `${lines.join("\n")}\n`;
}

/** What the signoff did, or why a passing run was not signed off. */
function signoffLines(report: RunReport, palette: Palette): string[] {
	let signoff = report.signoff;
	if (signoff === null) return [];
	let sha = signoff.sha?.slice(0, 10) ?? "";
	if (signoff.posted) {
		let pushed = signoff.pushed ? "Pushed and signed off" : "Signed off";
		return [palette.green(`${pushed} ${sha} as sdxc/ci.`)];
	}
	return [palette.yellow(`Not signed off: ${signoff.reason ?? "unknown reason"}`)];
}

/** The plain-object form `--json` prints. */
export function jsonReport(report: RunReport): unknown {
	return {
		status: report.status,
		exitCode: report.exitCode,
		runner: report.runner,
		partial: report.partial,
		duration: report.duration,
		steps: report.steps
			.filter((step) => !step.filtered)
			.map(({ name, label, entry, status, cached, duration, output }) => ({
				name,
				label,
				entry,
				status,
				cached,
				duration,
				output,
			})),
		entries: report.entries,
		errors: report.errors,
		closing: report.closing,
		signoff: report.signoff,
	};
}
