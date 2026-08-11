/**
 * The flow check: run a customer's executable spec and report what it concluded (ADR-027).
 *
 * Nothing here writes to a database, meters anything, or knows what a monitor is — a caller
 * that wants those does them itself, the same division `http-check.ts`, `dns-check.ts` and
 * `tcp-check.ts` already keep.
 *
 * Three things bound a run, and all three are decided here rather than by the spec:
 *
 * - **Which capabilities exist.** `http`, `url` and `jwt`, and nothing else. This is not a
 *   permission decision, it is registration: a spec calling `fs.write` or `cli.run` fails
 *   with an unknown name, because there is no grant that could ever lift it. There is no
 *   filesystem, no process, and no environment to read.
 * - **What the network grant covers.** Only hosts under a domain the team has **verified**,
 *   and only the ones this spec names. That is what stops the feature being a way to automate
 *   somebody else's site: a flow drives a sequence — signing in, carrying a token, calling the
 *   endpoint it authorises — so unlike an HTTP monitor, which sends one request a stranger
 *   could send anyway, it may only ever be pointed at a domain the team has proved it owns.
 *   Resolved on every run from team state, never stored, so un-verifying a domain stops its
 *   flows at the next check.
 * - **How much a run may do.** A request ceiling and a wall-clock deadline, both enforced by
 *   the wrapper around the `http` plugin, so what a run costs is bounded before it starts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";
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
	ToolContext,
	Value,
} from "@pkg/spec/workers";

import { failure, isFailure } from "@pkg/result";
import {
	createHttpPlugin,
	createJwtPlugin,
	createNoFilesystemWorkspace,
	createUrlPlugin,
	loadSources,
	parseGrants,
	positionAt,
	runTests,
	ToolError,
} from "@pkg/spec/workers";

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
	 * The team's **verified** domains. The only thing that decides what this run may reach, and
	 * passed rather than resolved because it is team state, not monitor state — a domain
	 * un-verified this morning has to stop this afternoon's check.
	 */
	verifiedDomains: readonly string[];
	/** Overrides the {@link FLOW_RUN_TIMEOUT_MS} deadline. For tests. */
	timeoutMs?: number;
	/** Overrides the {@link FLOW_RUN_MAX_REQUESTS} ceiling. For tests. */
	maxRequests?: number;
}

/**
 * Runs a flow's spec and reports what it concluded.
 *
 * Never throws: a spec that will not parse, a monitor with no hosts to reach, or a run that
 * could not start is an `error` result carrying the reason. That status exists to keep this
 * app's own failures out of the customer's outage history — only `down` means their flow is
 * broken.
 */
export async function runFlowCheck(input: FlowCheckInput): Promise<FlowCheckResult> {
	let loaded = loadSources([{ path: SOURCE_PATH, text: input.source }]);
	if (isFailure(loaded)) return errorResult(loaded.error.message);

	let hosts = specHosts(input.source);
	let resolved = resolveAllowedHosts(hosts, input.verifiedDomains);

	/**
	 * Refused up front rather than left to the grant to deny mid-run, so the reason names the
	 * host and the domain policy instead of a `--allow-net` flag no customer can pass. A spec
	 * that reaches somewhere the team has not verified is a monitor to fix, and nothing about
	 * it should be attempted first.
	 */
	if (resolved.refused.length > 0) {
		return errorResult(
			`This flow reaches ${resolved.refused.join(", ")}, which no verified domain on this team covers. A flow monitor can only drive a domain the team has verified.`,
		);
	}

	/**
	 * No hosts at all: either the spec makes no requests, or every URL it uses is computed at
	 * run time and therefore unverifiable. Both are configuration errors reported once rather
	 * than runs that fail every request. `parseGrants` would read `--allow-net=` as a
	 * malformed scope list, which is a true but unhelpful way to say the same thing.
	 */
	if (resolved.allowed === "") {
		return errorResult(
			"This flow names no host to reach. Every URL it requests has to be written in the spec, so it can be checked against the team's verified domains.",
		);
	}

	let grants = parseGrants([`--allow-net=${resolved.allowed}`]);
	if (isFailure(grants)) return errorResult(grants.error.message);

	let budget = createRequestBudget({
		maxRequests: input.maxRequests ?? FLOW_RUN_MAX_REQUESTS,
		timeoutMs: input.timeoutMs ?? FLOW_RUN_TIMEOUT_MS,
	});

	let startedAt = Date.now();
	let outcome = await runTests({
		suite: loaded.data,
		plugins: [budget.wrap(createHttpPlugin()), createUrlPlugin(), createJwtPlugin()],
		grants: grants.data.grants,
		createWorkspace: createNoFilesystemWorkspace,
	});
	let durationMs = Date.now() - startedAt;

	if (isFailure(outcome)) {
		return { ...errorResult(outcome.error.message), requestsMade: budget.spent(), durationMs };
	}

	let suite = outcome.data;
	let failed = suite.results.find((result) => result.status === "failed");

	return {
		status: statusOf(failed, budget.overspent()),
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
 * Failure codes that mean the **monitor** is wrong rather than the flow it watches.
 *
 * A spec that reaches a host it was not allowed, or calls a namespace this run does not
 * register, describes a check that could never have succeeded — so it is an `error`, and it
 * stays out of the customer's outage history. An assertion that did not hold, a request that
 * failed, a flow that ran out of time: those are the flow being broken, which is `down`.
 */
const MISCONFIGURED = new Set(["permission-denied", "unknown-name", "ambiguous-name"]);

/**
 * Which status a completed run reports.
 *
 * @param failed - The first failing test, or `undefined` when every test passed.
 * @param overspent - Whether the run was cut off for making too many requests.
 */
function statusOf(failed: TestResult | undefined, overspent: boolean): FlowStatus {
	if (failed === undefined) return "up";
	// Checked before the code, because the refusal surfaces as an ordinary tool error and a
	// spec too big to run is a monitor to fix, not an outage to page somebody about.
	if (overspent) return "error";
	let code = failed.error?.code;
	return code !== undefined && MISCONFIGURED.has(code) ? "error" : "down";
}

/**
 * Every host a spec's own text names.
 *
 * Collected from **every string literal in the file** that parses as an absolute HTTP URL,
 * rather than from the arguments of `http.*` calls specifically. That is deliberate: a URL can
 * reach a request through a fixture's returned object or a `let`-bound field, so following
 * only direct arguments would miss hosts a run genuinely uses. Reading every literal can only
 * be too generous about what a spec *wants*, never too strict — and wanting a host grants
 * nothing on its own, since {@link resolveAllowedHosts} still has to find it under a verified
 * domain.
 *
 * Comments are not literals, so a URL mentioned in a comment names nothing.
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

/** Which of a spec's hosts a team may actually reach, and which it may not. */
export interface ResolvedHosts {
	/** The `--allow-net` scope list: exactly the hosts covered by a verified domain. */
	allowed: string;
	/** Hosts the spec names that no verified domain covers, sorted. */
	refused: string[];
}

/**
 * Resolves a spec's hosts against a team's **verified** domains.
 *
 * This is the whole authorization story for a flow monitor, and it is why a flow monitor is
 * gated harder than an HTTP monitor: an HTTP monitor sends one request a stranger could send
 * anyway, while a flow drives a sequence — signing in, carrying a token, calling the endpoint
 * it authorises. So a flow may only ever be pointed at a domain the team has proved it owns,
 * which means this tool cannot be turned into a way to automate somebody else's site.
 *
 * Ownership of a domain covers its subdomains: a team that has verified `example.com` controls
 * the zone, so `app.example.com` and `api.example.com` are theirs too. Nothing wider than
 * that — `notexample.com` and `example.com.evil.test` both fail the label boundary.
 *
 * The result is an **exact** host list rather than a wildcard, because `--allow-net` scopes
 * match a host exactly. That is the stricter reading and the right one: the grant ends up
 * naming only the hosts this spec actually asks for, so a flow authorised for `app.example.com`
 * cannot reach `internal.example.com` even though the team owns both.
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
		// A scope may carry a port; ownership is a property of the name, so compare without it.
		let name = host.toLowerCase().split(":")[0] ?? "";
		if (domains.some((domain) => name === domain || name.endsWith(`.${domain}`))) {
			allowed.push(host);
		} else {
			refused.push(host);
		}
	}

	return { allowed: allowed.join(","), refused };
}

/** The `host` or `host:port` of an absolute HTTP URL, or `null` for anything else. */
function hostOf(text: string): string | null {
	let url: URL;
	try {
		url = new URL(text);
	} catch {
		return null;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;
	// `URL.host` carries the port only when it is non-default, which is exactly the shape
	// `--allow-net` wants: a scope with no port matches any port on that host.
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
 * `maxRequests` calls, and none at all past `deadline`.
 *
 * Enforced here rather than by racing the whole run against a timer, because a race cannot
 * stop what it abandoned — the run would keep making requests nobody is waiting for. A
 * refusal at the plugin boundary instead fails the statement that asked, which fails the
 * test, which is reported with the reason. Both refusals are `ToolError`s and not permission
 * denials: neither is something a grant could allow.
 */
function createRequestBudget(limits: { maxRequests: number; timeoutMs: number }): {
	wrap(plugin: Plugin): Plugin;
	spent(): number;
	overspent(): boolean;
} {
	let spent = 0;
	let overspent = false;
	let deadline = Date.now() + limits.timeoutMs;

	return {
		spent: () => spent,
		overspent: () => overspent,
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
						return failure(
							new ToolError(
								`This flow ran out of time: a run may take at most ${limits.timeoutMs}ms.`,
							),
						);
					}
					if (spent >= limits.maxRequests) {
						overspent = true;
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
 * monitor row — no file is opened, which is what makes this work with no filesystem.
 */
function lineOf(source: string, result: TestResult): number | null {
	let span = result.error?.span;
	if (span === undefined) return null;
	return positionAt({ path: SOURCE_PATH, text: source }, span.start).line;
}

/**
 * The failure, formatted for a human reading an incident: the message, and the expected and
 * observed values when the failure was an assertion.
 *
 * Assembled here rather than through the package's reporter, which renders for a terminal
 * (colour, indentation, a suite summary) and reads the source off a disk to do it.
 */
function detailOf(result: TestResult): string | null {
	let error = result.error;
	if (error === undefined) return null;

	let lines = [error.message];
	if (error.remedy !== undefined) lines.push(error.remedy);
	return lines.join("\n");
}
