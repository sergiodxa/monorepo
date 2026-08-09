/**
 * The human reporter: renders a suite's structured results, and fatal
 * pre-run failures, onto a `Sink` as plain text. It branches on diagnostic
 * codes and structured error fields, never on error message text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import type { Sink, SuiteResult, TestResult } from "./diagnostics";
import type { SpecError } from "./errors";
import type { SourceFile } from "./source";
import type { Value } from "./values";

import { positionAt } from "./source";
import { formatValue } from "./values";

/** Indentation prefixing every non-empty line of a failure's detail block. */
const DETAIL_INDENT = "  ";

/**
 * The structured fields a permission denial carries, read structurally so
 * errors reconstructed from the plugin wire protocol degrade gracefully
 * instead of depending on class identity.
 */
interface DenialFields {
	permission?: string;
	resource?: string;
}

/** The two sides a failed expectation carries, when its form has them. */
interface ComparisonFields {
	expected?: Value;
	observed?: Value;
}

/**
 * Render a finished suite: one status line per test in execution order, an
 * indented detail block after every failure, and a final summary line with
 * the pass/fail counts and the total duration.
 *
 * @param suite - The suite roll-up the runner produced.
 * @param sources - Loaded file texts by path, for turning spans into lines.
 * @param sink - Where the report is written.
 */
export function reportSuite(
	suite: SuiteResult,
	sources: Map<string, SourceFile>,
	sink: Sink,
): void {
	let separated = true;
	for (let result of suite.results) {
		if (result.status === "passed") {
			sink.write(`✓ ${result.title}\n`);
			separated = false;
			continue;
		}
		sink.write(`✗ ${result.title} (${failureLocation(result, sources)})\n`);
		separated = false;
		if (result.error !== undefined) {
			for (let line of detailLines(result.error)) {
				sink.write(line === "" ? "\n" : `${DETAIL_INDENT}${line}\n`);
			}
			sink.write("\n");
			separated = true;
		}
	}
	if (!separated) sink.write("\n");
	let total = 0;
	for (let result of suite.results) total += result.durationMs;
	sink.write(`${suite.passed} passed, ${suite.failed} failed (${Math.round(total)}ms)\n`);
}

/**
 * Render a failure that prevented any test from running — an unreadable
 * suite directory, a duplicate definition, a file that failed to parse.
 * Names the file (with line:column when the span is known and the file is
 * readable), the diagnostic code, the message, and the remedy when present.
 *
 * @param error - The load-time failure.
 * @param sink - Where the report is written.
 */
export function reportFatal(error: SpecError, sink: Sink): void {
	let location = fatalLocation(error);
	let suffix = location === undefined ? "" : ` (${location})`;
	sink.write(`✗ ${error.code}: ${error.message}${suffix}\n`);
	if (error.remedy !== undefined) {
		sink.write(`${DETAIL_INDENT}remedy: ${error.remedy}\n`);
	}
}

/**
 * Where a failing test points: `file:line` when the error's span falls in a
 * loaded source, the bare file path otherwise.
 */
function failureLocation(result: TestResult, sources: Map<string, SourceFile>): string {
	let file = result.error?.file ?? result.file;
	let span = result.error?.span;
	let source = sources.get(file);
	if (span !== undefined && source !== undefined) {
		let position = positionAt(source, span.start);
		return `${file}:${position.line}`;
	}
	return file;
}

/**
 * The unindented lines of a failure's detail block: the ADR-007-shaped
 * denial block for permission failures, otherwise the diagnostic code and
 * message followed by `expected:`/`observed:` and the remedy when carried.
 */
function detailLines(error: SpecError): string[] {
	let denial = denialBlock(error);
	if (denial !== undefined) return denial;
	let lines = [`${error.code}: ${error.message}`];
	let comparison = error as SpecError & ComparisonFields;
	if (comparison.expected !== undefined) pushLabeledValue(lines, "expected", comparison.expected);
	if (comparison.observed !== undefined) pushLabeledValue(lines, "observed", comparison.observed);
	if (error.remedy !== undefined) lines.push(`remedy: ${error.remedy}`);
	return lines;
}

/**
 * The denial block the design suite requires: the permission, the attempted
 * resource, and the exact flag that would grant it. Returns undefined when
 * the error is not a permission denial or lacks the structured fields.
 */
function denialBlock(error: SpecError): string[] | undefined {
	if (error.code !== "permission-denied") return undefined;
	let denial = error as SpecError & DenialFields;
	if (denial.permission === undefined || denial.resource === undefined) return undefined;
	if (denial.remedy === undefined) return undefined;
	return [
		`Permission denied: ${denial.permission}`,
		"",
		"The spec attempted to reach:",
		`> ${denial.resource}`,
		"",
		"Re-run with an appropriate permission, for example:",
		`> ${denial.remedy}`,
	];
}

/**
 * Append `label: value` to the detail lines, keeping each line of a
 * multi-line rendering its own detail line so indentation stays consistent.
 */
function pushLabeledValue(lines: string[], label: string, value: Value): void {
	let parts = formatValue(value).split("\n");
	lines.push(`${label}: ${parts[0] ?? ""}`);
	for (let part of parts.slice(1)) lines.push(part);
}

/**
 * Where a fatal error points: `file:line:column` when the span is known and
 * the file is readable (fatal errors predate any loaded-source map, so the
 * text is re-read from disk), the bare file path when it is not, undefined
 * when the error names no file.
 */
function fatalLocation(error: SpecError): string | undefined {
	if (error.file === undefined) return undefined;
	if (error.span === undefined) return error.file;
	let text: string;
	try {
		text = readFileSync(error.file, "utf8");
	} catch {
		return error.file;
	}
	let position = positionAt({ path: error.file, text }, error.span.start);
	return `${error.file}:${position.line}:${position.column}`;
}
