/**
 * Runs a customer's executable spec and reports what it concluded (ADR-027).
 *
 * Decides three things itself: which capabilities exist (`http`, `url`, `jwt` and `sample`
 * only), which hosts a verified domain covers, and how many requests and how much time a run
 * gets before it is cut off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type {
	ArgumentNode,
	BlockNode,
	ExpressionNode,
	Plugin,
	RhsNode,
	SpecError,
	StatementNode,
	TestResult,
	ToolArg,
	Seed,
	ToolContext,
	Value,
} from "@sdxc/spec/workers";

import { randomToken } from "@sdxc/crypto";
import { failure, isFailure } from "@sdxc/result";
import {
	createHttpPlugin,
	createJwtPlugin,
	createNoFilesystemWorkspace,
	createSamplePlugin,
	createUrlPlugin,
	loadSources,
	parseGrants,
	positionAt,
	runTests,
	ToolError,
} from "@sdxc/spec/workers";

import type { FlowStatus } from "~/database/schema";

import { FLOW_RUN_MAX_REQUESTS, FLOW_RUN_TIMEOUT_MS } from "~/app/lib/pricing";

/** The path a flow's single source is reported under. Shown in failure detail. */
const SOURCE_PATH = "flow.spec";

export type { FlowStatus };

/** What one flow check concluded. */
export interface FlowCheckResult {
	status: FlowStatus;
	testsTotal: number;
	testsPassed: number;
	testsFailed: number;
	/** HTTP requests the run performed. The billable quantity — see `flow_monitor_results`. */
	requestsMade: number;
	/** The first failing test's title, when a test failed. */
	failedTest: string | null;
	/** The 1-based line of the source that failure happened on, when it is known. */
	failedAtLine: number | null;
	/** The formatted first failure: what was expected, what was observed. */
	failureDetail: string | null;
	durationMs: number | null;
	/** Why the run could not be performed. Only set alongside an `error` status. */
	errorMessage: string | null;
}

/** What a flow check needs to run. */
export interface FlowCheckInput {
	/** The spec source, as the customer wrote it. */
	source: string;
	/**
	 * The team's **verified** domains — the only thing that decides what this run may reach.
	 * Passed in fresh from team state on every call, so a domain un-verified this morning
	 * already stops this afternoon's check.
	 */
	verifiedDomains: readonly string[];
	/**
	 * What the run's generated data descends from. Drawn fresh per run by default, because a
	 * flow that signs somebody up needs a different address every check rather than the same
	 * one colliding with itself; pass a fixed value to reproduce a run's data.
	 */
	seed?: Seed;
	/** Overrides the {@link FLOW_RUN_TIMEOUT_MS} deadline. For tests. */
	timeoutMs?: number;
	/** Overrides the {@link FLOW_RUN_MAX_REQUESTS} ceiling. For tests. */
	maxRequests?: number;
}

/**
 * Runs a flow's spec and reports what it concluded.
 *
 * A spec that will not parse, names no reachable host, or cannot start returns an `error`
 * result carrying the reason, so only `down` ever lands in the customer's outage history.
 */
export async function runFlowCheck(input: FlowCheckInput): Promise<FlowCheckResult> {
	let inspection = inspectFlowSource(input.source, input.verifiedDomains);
	if (!inspection.ok) return errorResult(inspection.message);

	let loaded = loadSources([{ path: SOURCE_PATH, text: input.source }]);
	if (isFailure(loaded)) return errorResult(loaded.error.message);

	let grants = parseGrants([`--allow-net=${inspection.allowed}`]);
	if (isFailure(grants)) return errorResult(grants.error.message);

	let budget = createRequestBudget({
		maxRequests: input.maxRequests ?? FLOW_RUN_MAX_REQUESTS,
		timeoutMs: input.timeoutMs ?? FLOW_RUN_TIMEOUT_MS,
	});

	let startedAt = Date.now();
	let outcome = await runTests({
		suite: loaded.data,
		plugins: [
			budget.wrap(createHttpPlugin()),
			createUrlPlugin(),
			createJwtPlugin(),
			createSamplePlugin(),
		],
		grants: grants.data.grants,
		createWorkspace: createNoFilesystemWorkspace,
		seed: input.seed ?? randomToken(),
	});
	let durationMs = Date.now() - startedAt;

	if (isFailure(outcome)) {
		return { ...errorResult(outcome.error.message), requestsMade: budget.spent(), durationMs };
	}

	let suite = outcome.data;
	let failed = suite.results.find((result) => result.status === "failed");

	return {
		status: statusOf(failed, budget.exhausted()),
		testsTotal: suite.results.length,
		testsPassed: suite.passed,
		testsFailed: suite.failed,
		requestsMade: budget.spent(),
		failedTest: failed?.title ?? null,
		failedAtLine: failed === undefined ? null : lineOf(input.source, failed),
		failureDetail: failed === undefined ? null : detailOf(failed),
		durationMs,
		errorMessage: null,
	};
}

/**
 * Failure codes for a check that could never have succeeded — a host the run had no grant
 * for, or a namespace it does not register. These mean the monitor is misconfigured, so the
 * run reports `error` and stays out of the customer's outage history.
 */
const MISCONFIGURED = new Set(["permission-denied", "unknown-name", "ambiguous-name"]);

/**
 * Which status a completed run reports.
 *
 * Checked ahead of the failing test's own error code, so a run cut off for exceeding one of
 * its caps is treated as a monitor problem to fix. Both caps read the same way to a customer
 * — the run was stopped before it could answer — so both keep the flow out of outage history
 * and away from the alert path.
 *
 * @param failed - The first failing test, or `undefined` when every test passed.
 * @param exhausted - Whether the run was cut off for running past its time or request cap.
 */
function statusOf(failed: TestResult | undefined, exhausted: boolean): FlowStatus {
	if (failed === undefined) return "up";
	if (exhausted) return "error";
	let code = failed.error?.code;
	return code !== undefined && MISCONFIGURED.has(code) ? "error" : "down";
}

/**
 * Every host a spec's text names, collected from every string literal that parses as an
 * absolute HTTP URL — including one reached through a fixture or a `let`-bound field —
 * since {@link resolveAllowedHosts} checks each one against a verified domain.
 *
 * @param source - The spec text.
 * @returns The hosts, sorted; empty when the spec names none or will not parse.
 */
export function specHosts(source: string): string[] {
	let loaded = loadSources([{ path: SOURCE_PATH, text: source }]);
	if (isFailure(loaded)) return [];

	let hosts = new Set<string>();
	for (let file of loaded.data.files) {
		for (let literal of stringLiterals(file.tests, file.definitions)) {
			let host = hostOf(literal);
			if (host !== null) hosts.add(host);
		}
	}

	return [...hosts].sort();
}

/** Whether a source can be run at all, and what it would be allowed to reach. */
export type FlowSourceInspection =
	| {
			ok: true;
			/** The `--allow-net` scope list a run of this source would get. */
			allowed: string;
			/** The hosts it names, all of them covered by a verified domain. */
			hosts: string[];
	  }
	| {
			ok: false;
			/** Why it cannot run, phrased for whoever wrote the spec. */
			message: string;
			/** Which of its hosts no verified domain covers; empty for the other reasons. */
			refused: string[];
	  };

/**
 * Can this source be run by this team, and what would it reach?
 *
 * The one place the three rules about a source live, so the form that accepts a monitor and
 * the sweep that runs it always agree on what counts as valid.
 *
 * @param source - The spec text.
 * @param verifiedDomains - The team's verified hostnames.
 */
export function inspectFlowSource(
	source: string,
	verifiedDomains: readonly string[],
): FlowSourceInspection {
	let loaded = loadSources([{ path: SOURCE_PATH, text: source }]);
	if (isFailure(loaded)) return { ok: false, message: loaded.error.message, refused: [] };

	let resolved = resolveAllowedHosts(specHosts(source), verifiedDomains);

	/**
	 * Refused up front, naming the host and the domain policy in the customer's own terms: a
	 * spec reaching somewhere the team has not verified is a monitor for them to fix.
	 */
	if (resolved.refused.length > 0) {
		return {
			ok: false,
			message: `This flow reaches ${resolved.refused.join(", ")}, which no verified domain on this team covers. A flow monitor can only drive a domain the team has verified.`,
			refused: resolved.refused,
		};
	}

	/**
	 * No hosts at all means the spec makes no requests, or every URL it uses is computed at run
	 * time and unverifiable. Reporting it once here, as a configuration error, gives the
	 * customer one clear message to act on.
	 */
	if (resolved.allowed === "") {
		return {
			ok: false,
			message:
				"This flow names no host to reach. Every URL it requests has to be written in the spec, so it can be checked against the team's verified domains.",
			refused: [],
		};
	}

	return { ok: true, allowed: resolved.allowed, hosts: resolved.allowed.split(",") };
}

/** Which of a spec's hosts a team may actually reach, and which it may not. */
export interface ResolvedHosts {
	/** The `--allow-net` scope list: exactly the hosts covered by a verified domain. */
	allowed: string;
	/** Hosts the spec names that no verified domain covers, sorted. */
	refused: string[];
}

/**
 * Resolves a spec's hosts against a team's **verified** domains: ownership of a domain
 * covers its subdomains, so `example.com` covers `app.example.com` but not
 * `notexample.com`, and the result names only the exact hosts the spec asked for.
 *
 * @param hosts - What the spec names, from {@link specHosts}.
 * @param verifiedDomains - The team's verified hostnames.
 */
export function resolveAllowedHosts(
	hosts: readonly string[],
	verifiedDomains: readonly string[],
): ResolvedHosts {
	let domains = verifiedDomains.map((domain) => domain.trim().toLowerCase()).filter(Boolean);
	let allowed: string[] = [];
	let refused: string[] = [];

	for (let host of hosts) {
		let name = host.toLowerCase().split(":")[0] ?? "";
		if (domains.some((domain) => name === domain || name.endsWith(`.${domain}`))) {
			allowed.push(host);
		} else {
			refused.push(host);
		}
	}

	return { allowed: allowed.join(","), refused };
}

/**
 * The `host` or `host:port` of an absolute HTTP URL, or `null` for anything else.
 *
 * `URL.host` carries the port only when it is non-default, which is exactly the shape
 * `--allow-net` wants: a scope with no port matches any port on that host.
 */
function hostOf(text: string): string | null {
	let url: URL;
	try {
		url = new URL(text);
	} catch {
		return null;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;
	return url.host === "" ? null : url.host;
}

/**
 * Every string literal reachable from a file's tests and definitions, in no order.
 *
 * @yields Each string literal's decoded value.
 */
function* stringLiterals(
	tests: readonly { given?: BlockNode; when?: BlockNode; then?: BlockNode }[],
	definitions: readonly { body: BlockNode }[],
): Generator<string> {
	for (let test of tests) {
		for (let block of [test.given, test.when, test.then]) {
			if (block !== undefined) yield* fromBlock(block);
		}
	}
	for (let definition of definitions) yield* fromBlock(definition.body);
}

/**
 * Every string literal inside a block, recursing through `eventually` and objects.
 *
 * @yields Each string literal's decoded value.
 */
function* fromBlock(block: BlockNode): Generator<string> {
	for (let statement of block.statements) yield* fromStatement(statement);
}

/**
 * See {@link fromBlock}.
 *
 * @yields Each string literal's decoded value.
 */
function* fromStatement(statement: StatementNode): Generator<string> {
	switch (statement.kind) {
		case "let":
		case "return":
			yield* fromRhs(statement.value);
			return;
		case "expect":
		case "call":
			for (let argument of statement.args) yield* fromArgument(argument);
			return;
		case "eventually":
			yield* fromBlock(statement.block);
			return;
	}
}

/**
 * See {@link fromBlock}.
 *
 * @yields Each string literal's decoded value.
 */
function* fromRhs(rhs: RhsNode): Generator<string> {
	if (rhs.kind === "fixture-call") return;
	if (rhs.kind === "call-expr") {
		for (let argument of rhs.args) yield* fromArgument(argument);
		return;
	}
	yield* fromExpression(rhs);
}

/**
 * See {@link fromBlock}.
 *
 * @yields Each string literal's decoded value.
 */
function* fromArgument(argument: ArgumentNode): Generator<string> {
	if (argument.kind === "word") return;
	yield* fromExpression(argument);
}

/**
 * See {@link fromBlock}.
 *
 * @yields Each string literal's decoded value.
 */
function* fromExpression(expression: ExpressionNode): Generator<string> {
	if (expression.kind === "string") {
		yield expression.value;
		return;
	}
	if (expression.kind === "object") {
		for (let entry of expression.entries) yield* fromExpression(entry.value);
	}
}

/**
 * Wraps the `http` plugin so a run's cost is bounded before it starts: it may make at most
 * `maxRequests` calls, and none at all past `deadline`, each refusal failing the statement
 * that asked so the test reports it as an ordinary `ToolError`.
 */
function createRequestBudget(limits: { maxRequests: number; timeoutMs: number }): {
	wrap(plugin: Plugin): Plugin;
	spent(): number;
	exhausted(): boolean;
} {
	let spent = 0;
	let exhausted = false;
	let deadline = Date.now() + limits.timeoutMs;

	return {
		spent: () => spent,
		exhausted: () => exhausted,
		wrap(plugin) {
			return {
				namespace: plugin.namespace,
				describe: () => plugin.describe(),
				dispose: plugin.dispose?.bind(plugin),
				async call(
					tool: string,
					args: ToolArg[],
					context: ToolContext,
				): Promise<Result<Value, SpecError>> {
					if (Date.now() > deadline) {
						exhausted = true;
						return failure(
							new ToolError(
								`This flow ran out of time: a run may take at most ${limits.timeoutMs}ms.`,
							),
						);
					}
					if (spent >= limits.maxRequests) {
						exhausted = true;
						return failure(
							new ToolError(
								`This flow made too many requests: a run may make at most ${limits.maxRequests}.`,
							),
						);
					}
					spent += 1;
					return await plugin.call(tool, args, context);
				},
			};
		},
	};
}

/** A result for a run that could not be performed, with the counters all zero. */
function errorResult(message: string): FlowCheckResult {
	return {
		status: "error",
		testsTotal: 0,
		testsPassed: 0,
		testsFailed: 0,
		requestsMade: 0,
		failedTest: null,
		failedAtLine: null,
		failureDetail: null,
		durationMs: null,
		errorMessage: message,
	};
}

/**
 * The 1-based line a failure happened on, from the span the error carries.
 *
 * `positionAt` is pure and takes the source text, which this app already holds on the
 * monitor row, so the line resolves entirely from data already in memory.
 */
function lineOf(source: string, result: TestResult): number | null {
	let span = result.error?.span;
	if (span === undefined) return null;
	return positionAt({ path: SOURCE_PATH, text: source }, span.start).line;
}

/**
 * The failure, formatted for a human reading an incident: the message, and the expected and
 * observed values when the failure was an assertion.
 */
function detailOf(result: TestResult): string | null {
	let error = result.error;
	if (error === undefined) return null;

	let lines = [error.message];
	if (error.remedy !== undefined) lines.push(error.remedy);
	return lines.join("\n");
}
