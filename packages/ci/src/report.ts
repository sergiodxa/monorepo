/**
 * How a run reads: one line per finished step, a live status line on a terminal, collapsible
 * groups and annotations on GitHub Actions, then a summary naming every failure and flaky step,
 * the closing message and what the signoff did. Colors come from the caller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { appendFile } from "node:fs/promises";

import type { Result } from "@sdxc/result";

import { wrap } from "@sdxc/result";

import type { Reporter, RunReport, ScriptErrorRecord, StartedStep, StepRecord } from "./run.js";

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
	let time = palette.dim(describeTime(step));
	let mark = step.status === "passed" ? palette.green("✓") : palette.red("✗");
	let flaky = step.flaky ? `  ${palette.yellow(describeFlaky(step))}` : "";
	let line = `${mark} ${step.label}  ${time}${flaky}\n`;
	let showLog = step.output.trim() !== "" && (step.status === "failed" || verbose);
	return showLog ? `${line}${indent(step.output)}\n` : line;
}

/** How a passed-on-retry step reads wherever it is listed. */
function describeFlaky(step: StepRecord): string {
	return `flaky, passed on attempt ${step.attempts}`;
}

/** How long a step took, or that its pass was reused. */
function describeTime(step: StepRecord): string {
	return step.cached ? `cached (${formatDuration(step.duration)})` : formatDuration(step.duration);
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

/** A step count with the noun agreeing: `1 step`, `3 steps`. */
function steps(count: number): string {
	return count === 1 ? "1 step" : `${count} steps`;
}

/** The run's totals in one line: passed or failed, flaky, cached and filtered-out counts. */
function describeTotals(report: RunReport): string {
	let counted = report.steps.filter((step) => !step.filtered);
	let failed = counted.filter((step) => step.status === "failed").length;
	let flaky = counted.filter((step) => step.flaky).length;
	let cached = counted.filter((step) => step.cached).length;
	let filtered = report.steps.length - counted.length;
	return [
		failed > 0
			? `${failed} of ${steps(counted.length)} failed`
			: `${steps(counted.filter((step) => step.status === "passed").length)} passed`,
		...(flaky > 0 ? [`${flaky} flaky`] : []),
		...(cached > 0 ? [`${cached} cached`] : []),
		...(filtered > 0 ? [`${filtered} filtered out`] : []),
	].join(", ");
}

/**
 * The summary printed after the last step: totals, each failure, each flaky step, the closing
 * call, the signoff. A flaky step is listed even on a passing run, so a retry never hides it.
 */
export function formatSummary(report: RunReport, palette: Palette): string {
	let counted = report.steps.filter((step) => !step.filtered);
	let lines: string[] = [""];
	let mark = report.status === "passing" ? palette.green("✓") : palette.red("✗");
	lines.push(
		`${mark} ${palette.bold(report.status)} — ${describeTotals(report)} (${formatDuration(report.duration)})`,
	);
	for (let step of counted.filter((each) => each.status === "failed"))
		lines.push(`  ${palette.red("✗")} ${step.label}`);
	for (let step of counted.filter((each) => each.flaky))
		lines.push(`  ${palette.yellow("!")} ${step.label}  ${palette.yellow(describeFlaky(step))}`);
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
			.map(({ name, label, entry, status, cached, duration, output, attempts, flaky }) => ({
				name,
				label,
				entry,
				status,
				cached,
				duration,
				attempts,
				flaky,
				output,
			})),
		entries: report.entries,
		errors: report.errors,
		closing: report.closing,
		signoff: report.signoff,
	};
}

/** Clears the cursor's line and returns to its start, so the next write replaces it. */
const CLEAR_LINE = "\r\x1b[2K";

/** The status line's lead mark. */
const RUNNING_MARK = "⠿";

/** Milliseconds between status-line redraws while nothing else prints. */
const REDRAW_INTERVAL = 1000;

/** Where the progress reporter reads time and schedules redraws; tests replace both. */
export interface ProgressOptions {
	/** The current time in milliseconds. @default Date.now */
	now?: () => number;
	/**
	 * Calls `tick` every second until the returned function runs. @default an unref'd
	 * `setInterval`, so a pending redraw never keeps the process alive
	 */
	schedule?: (tick: () => void) => () => void;
	/** The terminal's width in columns. @default the standard output's, else 80 */
	columns?: () => number;
}

/** A repeating unref'd timer, stopped by the returned function. */
function scheduleEverySecond(tick: () => void): () => void {
	let timer = setInterval(tick, REDRAW_INTERVAL);
	timer.unref?.();
	return () => clearInterval(timer);
}

/** Whole elapsed seconds, as `12s` or `6m 12s`, so the status line changes once a second. */
export function formatElapsed(milliseconds: number): string {
	let seconds = Math.max(0, Math.floor(milliseconds / 1000));
	if (seconds < 60) return `${seconds}s`;
	return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * The status line naming the running steps, oldest first, within `width` columns: steps that do
 * not fit become `+N more`, and a first step too long for the line is cut with an ellipsis.
 */
export function formatRunning(running: readonly StartedStep[], now: number, width: number): string {
	if (running.length === 0) return "";
	let head = `${RUNNING_MARK} ${running.length} running: `;
	let parts = running.map((step) => `${step.label} ${formatElapsed(now - step.startedAt)}`);
	let limit = Math.max(head.length + 1, width - 1);
	for (let shown = parts.length; shown > 0; shown--) {
		let rest = parts.length - shown;
		let line = `${head}${parts.slice(0, shown).join(", ")}${rest > 0 ? `, +${rest} more` : ""}`;
		if (line.length <= limit) return line;
	}
	let more = parts.length > 1 ? `, +${parts.length - 1} more` : "";
	let room = limit - head.length - more.length - 1;
	return `${head}${(parts[0] ?? "").slice(0, Math.max(0, room))}…${more}`;
}

/**
 * A reporter for an interactive terminal: each finished step prints as `textReporter` prints it,
 * above one status line naming the running steps and their elapsed time. The line is redrawn on
 * every event and every second, and `finished` clears it and stops the timer.
 */
export function progressReporter(
	write: (text: string) => void,
	palette: Palette,
	verbose: boolean,
	options: ProgressOptions = {},
): Reporter {
	let now = options.now ?? Date.now;
	let schedule = options.schedule ?? scheduleEverySecond;
	let columns = options.columns ?? (() => process.stdout.columns ?? 80);
	let running: StartedStep[] = [];
	let drawn = false;
	let stop: (() => void) | null = null;

	/** Replaces the status line with `text` above it and the current running steps below. */
	function draw(text = ""): void {
		let line = formatRunning(running, now(), columns());
		let status = line === "" ? "" : palette.dim(line);
		if (text === "" && status === "" && !drawn) return;
		write(`${drawn ? CLEAR_LINE : ""}${text}${status}`);
		drawn = status !== "";
	}

	return {
		started(step) {
			running.push(step);
			stop ??= schedule(() => draw());
			draw();
		},
		step(record) {
			let index = running.findIndex((step) => step.label === record.label);
			if (index !== -1) running.splice(index, 1);
			draw(formatStep(record, palette, verbose));
		},
		error(record) {
			draw(formatError(record, palette));
		},
		finished() {
			stop?.();
			stop = null;
			running = [];
			draw();
		},
	};
}

/** `text` safe as a workflow command's message: `%`, `\r` and `\n` percent-encoded. */
function escapeData(text: string): string {
	return text.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

/** `text` safe as a workflow command's property, which also ends at `:` and `,`. */
function escapeProperty(text: string): string {
	return escapeData(text).replaceAll(":", "%3A").replaceAll(",", "%2C");
}

/** The line a failed step's annotation carries: its output's first non-empty line. */
function firstLine(output: string): string {
	return (
		output
			.split("\n")
			.map((line) => line.trim())
			.find((line) => line !== "") ?? "failed"
	);
}

/**
 * A reporter for GitHub Actions: each finished step is a collapsible log group titled with its
 * outcome, a failed step also raises an error annotation naming it, and a script error raises
 * one too, so failures show on the run's page without opening the log.
 */
export function actionsReporter(write: (text: string) => void): Reporter {
	return {
		step(record) {
			if (record.status === "skipped") {
				write(`- ${record.label}  skipped\n`);
				return;
			}
			let mark = record.status === "passed" ? "✓" : "✗";
			let flaky = record.flaky ? `  ${describeFlaky(record)}` : "";
			let output = record.output.replace(/\n+$/, "");
			write(`::group::${mark} ${record.label}  ${describeTime(record)}${flaky}\n`);
			if (output !== "") write(`${output}\n`);
			write("::endgroup::\n");
			if (record.status === "failed")
				write(
					`::error title=${escapeProperty(record.label)}::${escapeData(firstLine(record.output))}\n`,
				);
		},
		error(record) {
			let where = record.where ?? "script";
			write(
				`::error title=${escapeProperty(`${where} threw outside a step`)}::${escapeData(record.message)}\n`,
			);
		},
	};
}

/** `text` safe inside a Markdown table cell. */
function escapeCell(text: string): string {
	return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

/** The Markdown a run adds to a GitHub Actions job summary: its status, then a row per step that ran. */
export function formatStepSummary(report: RunReport): string {
	let ran = report.steps.filter((step) => !step.filtered && step.status !== "skipped");
	let icon = report.status === "passing" ? "✅" : "❌";
	let lines = [
		`### ${icon} CI ${report.status}: ${describeTotals(report)} (${formatDuration(report.duration)})`,
		"",
	];
	if (ran.length > 0) {
		lines.push("| Status | Step | Duration | Notes |", "| --- | --- | --- | --- |");
		for (let step of ran) {
			let status = step.status === "passed" ? "✅ passed" : "❌ failed";
			let notes = [
				...(step.cached ? ["cached"] : []),
				...(step.flaky ? [describeFlaky(step)] : []),
			].join(", ");
			lines.push(
				`| ${status} | ${escapeCell(step.label)} | ${formatDuration(step.duration)} | ${notes} |`,
			);
		}
		lines.push("");
	}
	return `${lines.join("\n")}\n`;
}

/** Appends the run's Markdown summary to `path`, the file `GITHUB_STEP_SUMMARY` names. */
export async function appendStepSummary(
	path: string,
	report: RunReport,
): Promise<Result<void, Error>> {
	return wrap(() => appendFile(path, formatStepSummary(report)));
}
