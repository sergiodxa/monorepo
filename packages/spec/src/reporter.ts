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

/** The fields that identify and group a permission denial. */
interface DenialGrouping {
	/** Which permission family the denial required. */
	permission: string;
	/** The resource the spec attempted to reach. */
	resource: string;
	/** The exact `spec run --allow-*` flag that would grant it. */
	remedy: string;
	/** An extra line after the remedy, e.g. the `--allow-config` hint. */
	hint?: string;
}

/**
 * One affected test in a denial group: its title and the `file[:line]` it
 * failed at, resolved through the loaded sources for cross-file anchoring.
 */
interface AffectedTest {
	title: string;
	location: string;
}

/**
 * A run of denials that share a remedy — the same missing grant. Distinct
 * remedies (e.g. `--allow-net=a.com` vs `--allow-net=localhost`) stay in
 * separate groups even when their permission family matches.
 */
interface DenialGroup {
	/** The permission family every denial in the group required. */
	permission: string;
	/** Distinct resources attempted, in first-seen order. */
	resources: string[];
	/** The remedy shared by every denial in the group. */
	remedy: string;
	/** An extra line after the remedy, shared by the group when present. */
	hint?: string;
	/** The tests that failed for this grant, in execution order. */
	tests: AffectedTest[];
}

/**
 * Render a finished suite: a status line per passing test and per ungrouped
 * failure (with its indented detail block), then one accumulated block per
 * missing grant — permission denials sharing a remedy are collapsed into a
 * single block that names the grant and lists every affected test — and
 * finally a summary line with the pass/fail counts and the run's wall-clock
 * duration (never the sum of per-test durations, which overcounts overlap).
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
	let groups: DenialGroup[] = [];
	let byRemedy = new Map<string, DenialGroup>();
	for (let result of suite.results) {
		if (result.status === "passed") {
			sink.write(`✓ ${result.title}\n`);
			separated = false;
			continue;
		}
		let grouping = result.error === undefined ? undefined : groupableDenial(result.error);
		if (grouping !== undefined) {
			accumulateDenial(groups, byRemedy, grouping, {
				title: result.title,
				location: failureLocation(result, sources),
			});
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
	for (let group of groups) {
		if (!separated) sink.write("\n");
		sink.write(`✗ ${groupHeader(group)}\n`);
		for (let line of groupDetailLines(group)) {
			sink.write(line === "" ? "\n" : `${DETAIL_INDENT}${line}\n`);
		}
		sink.write("\n");
		separated = true;
	}
	if (!separated) sink.write("\n");
	// The run's wall-clock, not the sum of per-test durations: under concurrency
	// those overlap, so their sum overcounts elapsed time and would climb as the
	// real run got faster. `wallMs` tracks true elapsed time at every concurrency.
	sink.write(`${suite.passed} passed, ${suite.failed} failed (${Math.round(suite.wallMs)}ms)\n`);
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
	if (error.hint !== undefined) {
		sink.write(`${DETAIL_INDENT}${error.hint}\n`);
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
	if (denial !== undefined) {
		if (error.hint !== undefined) return [...denial, "", error.hint];
		return denial;
	}
	let lines = [`${error.code}: ${error.message}`];
	let comparison = error as SpecError & ComparisonFields;
	if (comparison.expected !== undefined) pushLabeledValue(lines, "expected", comparison.expected);
	if (comparison.observed !== undefined) pushLabeledValue(lines, "observed", comparison.observed);
	if (error.remedy !== undefined) lines.push(`remedy: ${error.remedy}`);
	if (error.hint !== undefined) lines.push(error.hint);
	return lines;
}

/**
 * The grouping fields of a permission denial the reporter accumulates, or
 * undefined when the error is not a groupable denial. A denial is groupable
 * exactly when {@link denialBlock} would render it — code `permission-denied`
 * with structured `permission`, `resource`, and `remedy` — so a degraded
 * denial missing any field falls back to the inline per-test detail path.
 */
function groupableDenial(error: SpecError): DenialGrouping | undefined {
	if (denialBlock(error) === undefined) return undefined;
	let denial = error as SpecError & DenialFields;
	let permission = denial.permission;
	let resource = denial.resource;
	let remedy = error.remedy;
	if (permission === undefined || resource === undefined || remedy === undefined) return undefined;
	return { permission, resource, remedy, hint: error.hint };
}

/**
 * Fold one denial into the group its remedy keys — creating the group in
 * first-seen order when new — recording the resource (deduplicated, first-seen
 * order) and the affected test in execution order.
 */
function accumulateDenial(
	groups: DenialGroup[],
	byRemedy: Map<string, DenialGroup>,
	grouping: DenialGrouping,
	test: AffectedTest,
): void {
	let group = byRemedy.get(grouping.remedy);
	if (group === undefined) {
		group = {
			permission: grouping.permission,
			resources: [],
			remedy: grouping.remedy,
			hint: grouping.hint,
			tests: [],
		};
		byRemedy.set(grouping.remedy, group);
		groups.push(group);
	}
	if (!group.resources.includes(grouping.resource)) group.resources.push(grouping.resource);
	group.tests.push(test);
}

/**
 * The header of a denial group's block: the permission and how many tests it
 * accounts for, with `test`/`tests` agreeing in number.
 */
function groupHeader(group: DenialGroup): string {
	let count = group.tests.length;
	return `Permission denied: ${group.permission} (${count} ${count === 1 ? "test" : "tests"})`;
}

/**
 * The unindented body lines of a denial group's block: the attempted
 * resources, the shared remedy, and the affected tests. The two label lines
 * stay verbatim so the design suite's substring assertions keep matching.
 */
function groupDetailLines(group: DenialGroup): string[] {
	let lines = ["", "The spec attempted to reach:"];
	for (let resource of group.resources) lines.push(`> ${resource}`);
	lines.push("", "Re-run with an appropriate permission, for example:", `> ${group.remedy}`);
	if (group.hint !== undefined) lines.push("", group.hint);
	lines.push("", "Affected tests:");
	for (let test of group.tests) lines.push(`- ${test.title} (${test.location})`);
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
