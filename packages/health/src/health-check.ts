/**
 * The health check runner: probes registered by name run in parallel, each bounded by a
 * timeout, and settle into an `application/health+json` report whose HTTP status a monitor
 * or load balancer can act on without reading the body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";

import type { Health } from "./types.js";

import { HEALTH_MEDIA_TYPE, isHealthResponse, parseHealth } from "./parse.js";

const DEFAULT_TIMEOUT_MS = 2_000;

const DEFAULT_FAIL_STATUS = 503;

/** The most of a dependency's health report read before it counts as unreadable. */
const MAX_REPORT_BYTES = 65_536;

/** How bad each status is, so a report takes the worst of its checks. */
const SEVERITY: Record<Health.Status, number> = { pass: 0, warn: 1, fail: 2 };

/** A probe and how it is judged, as registered. */
interface Registered<Context> {
	probe: Health.Probe<Context>;
	options: Health.ProbeOptions;
}

/**
 * What one probe's outcome means. `output` is what the report may show; `error` is what the
 * log records, so the message reaches the operator whatever the report exposes.
 */
interface Verdict {
	status: Health.Status;
	output?: string;
	error?: unknown;
	componentId?: string;
}

/**
 * Runs a service's dependency probes and reports their health in the Health Check Response
 * Format for HTTP APIs. One instance is configured per service; each request calls `respond`
 * with its own context, which every probe receives.
 *
 * @template Context What `check` and `respond` pass to each probe, e.g. a request context.
 * @example let health = new HealthCheck<AppContext>({ serviceId: "shop" }).probe("database", (ctx) => ctx.db.exec("SELECT 1"));
 */
export class HealthCheck<Context = void> {
	readonly #options: Health.Options;
	readonly #probes = new Map<string, Registered<Context>>();

	/**
	 * @param options How probes run, and the report fields describing the service.
	 * @throws {RangeError} When `timeout`, `maxAge` or `failStatus` is out of range.
	 */
	constructor(options: Health.Options = {}) {
		if (options.timeout !== undefined) assertTimeout(options.timeout);
		let maxAge = options.maxAge ?? 0;
		if (!Number.isSafeInteger(maxAge) || maxAge < 0) {
			throw new RangeError(`maxAge needs a non-negative integer, received ${maxAge}.`);
		}
		let failStatus = options.failStatus ?? DEFAULT_FAIL_STATUS;
		if (!Number.isInteger(failStatus) || failStatus < 400 || failStatus > 599) {
			throw new RangeError(`failStatus needs a 4xx or 5xx status, received ${failStatus}.`);
		}
		this.#options = options;
	}

	/**
	 * Registers a probe under `name`, replacing any probe already there. The probe passes when
	 * it resolves, unless it resolves to a non-2xx `Response`, a failed `@sdxc/result`, or a
	 * health report that is not passing; `signal` aborts when its timeout elapses.
	 *
	 * @param name The dependency's name; the check is reported as `<name>:responseTime`.
	 * @param probe Reaches the dependency, given the context and the timeout's signal.
	 * @param options Whether it is critical, its own timeout, and the check's descriptive fields.
	 * @throws {RangeError} When `name` holds a colon or `options.timeout` is not positive.
	 * @example health.probe("kv", () => env.KV.get("health"));
	 * @example health.probe("billing", (_, signal) => fetch("https://api.example.com/healthz", { signal }), { critical: false });
	 */
	probe(name: string, probe: Health.Probe<Context>, options: Health.ProbeOptions = {}): this {
		if (name.includes(":")) {
			throw new RangeError(`A probe name cannot contain a colon, received "${name}".`);
		}
		if (options.timeout !== undefined) assertTimeout(options.timeout);
		this.#probes.set(name, { probe, options });
		return this;
	}

	/**
	 * Runs every probe in parallel and resolves to the report. It never rejects: a probe that
	 * throws or hangs becomes a failed check, and every check that is not passing is logged
	 * on the current invocation's log with its error.
	 *
	 * @param context Handed to every probe.
	 */
	async check(context: Context): Promise<Health.Report> {
		let entries = await Promise.all(
			[...this.#probes].map(([name, registered]) => this.#run(name, registered, context)),
		);
		return this.#report(Object.fromEntries(entries));
	}

	/**
	 * The report as an `application/health+json` response: `200` for `pass` and `warn`, the
	 * configured `failStatus` for `fail`, and `Cache-Control: max-age` set to `maxAge`.
	 *
	 * @param context Handed to every probe.
	 * @example export default createAction(routes.health, (ctx) => health.respond(ctx));
	 */
	async respond(context: Context): Promise<Response> {
		let report = await this.check(context);
		return Response.json(report, {
			status: report.status === "fail" ? (this.#options.failStatus ?? DEFAULT_FAIL_STATUS) : 200,
			headers: {
				"Content-Type": HEALTH_MEDIA_TYPE,
				"Cache-Control": `max-age=${this.#options.maxAge ?? 0}`,
			},
		});
	}

	/** One probe as a `[key, [check]]` entry of the report's `checks`, timed from its start. */
	async #run(
		name: string,
		{ probe, options }: Registered<Context>,
		context: Context,
	): Promise<[string, Health.Check[]]> {
		let started = Date.now();
		let timeout = options.timeout ?? this.#options.timeout ?? DEFAULT_TIMEOUT_MS;
		let verdict = await settle(probe, context, timeout, this.#options.exposeErrors);
		let elapsed = Date.now() - started;
		let status = verdict.status === "fail" && options.critical === false ? "warn" : verdict.status;

		if (status !== "pass") {
			currentLog()?.warn("health.check_not_passing", {
				check: name,
				status,
				output: verdict.output,
				error: describe(verdict.error),
			});
		}

		let check = compact({
			componentId: options.componentId ?? verdict.componentId,
			componentType: options.componentType,
			status,
			observedValue: elapsed,
			observedUnit: "ms",
			time: new Date(started).toISOString(),
			output: status === "pass" ? undefined : verdict.output,
			affectedEndpoints: status === "pass" ? undefined : options.affectedEndpoints,
			links: options.links,
		});
		return [`${name}:responseTime`, [check]];
	}

	/** The service-level report: the worst check's status, and which checks are not passing. */
	#report(checks: Record<string, Health.Check[]>): Health.Report {
		let status: Health.Status = "pass";
		let notPassing: string[] = [];
		for (let [key, [check]] of Object.entries(checks)) {
			let checkStatus = check?.status ?? "pass";
			if (checkStatus !== "pass") notPassing.push(key);
			if (SEVERITY[checkStatus] > SEVERITY[status]) status = checkStatus;
		}

		let { version, releaseId, serviceId, description, notes, links } = this.#options;
		return compact({
			status,
			version,
			releaseId,
			serviceId,
			description,
			notes,
			output: notPassing.length > 0 ? `Checks not passing: ${notPassing.join(", ")}` : undefined,
			checks,
			links,
		}) as Health.Report;
	}
}

/**
 * Runs a probe against its timeout. Judging a `Response` (reading a health report) happens
 * inside the same race, so a dependency that stalls mid-body still times out.
 */
async function settle<Context>(
	probe: Health.Probe<Context>,
	context: Context,
	timeout: number,
	exposeErrors = false,
): Promise<Verdict> {
	let controller = new AbortController();
	let timer = setTimeout(
		() => controller.abort(new DOMException("The probe timed out", "TimeoutError")),
		timeout,
	);

	try {
		let judged = Promise.resolve()
			.then(() => probe(context, controller.signal))
			.then((value) => judge(value, exposeErrors));
		return await Promise.race([judged, rejectOnAbort(controller.signal)]);
	} catch (error) {
		if (controller.signal.aborted) return { status: "fail", output: "timeout", error };
		return { status: "fail", output: exposeErrors ? describe(error) : "error", error };
	} finally {
		clearTimeout(timer);
	}
}

/** A promise that rejects with the signal's reason once it aborts, and otherwise never settles. */
function rejectOnAbort(signal: AbortSignal): Promise<never> {
	return new Promise((_resolve, reject) => {
		signal.addEventListener("abort", () => reject(signal.reason), { once: true });
	});
}

/** What a probe's resolved value says about the dependency. */
async function judge(value: unknown, exposeErrors: boolean): Promise<Verdict> {
	if (value instanceof Response) return judgeResponse(value, exposeErrors);
	if (isFailedResult(value)) {
		return {
			status: "fail",
			output: exposeErrors ? value.error.message : "error",
			error: value.error,
		};
	}
	return { status: "pass" };
}

/**
 * A response passes on 2xx. A health report in it is read too, so a dependency answering
 * `200` while reporting `fail` fails, and one reporting `warn` warns. Any other body is
 * cancelled unread, so no connection stays open.
 */
async function judgeResponse(response: Response, exposeErrors: boolean): Promise<Verdict> {
	if (!isHealthResponse(response)) {
		await response.body?.cancel();
		return response.ok ? { status: "pass" } : { status: "fail", output: `HTTP ${response.status}` };
	}

	let text = await readCapped(response, MAX_REPORT_BYTES);
	let report = text === null ? null : parseHealth(text);
	if (report === null || isFailure(report)) {
		if (response.ok) return { status: "pass" };
		return { status: "fail", output: "unreadable health report", error: report?.error };
	}

	let { status, serviceId: componentId, output } = report.data;
	let reported = exposeErrors ? output : undefined;
	if (status === "fail") return { status, output: reported ?? "reported fail", componentId };
	if (!response.ok) return { status: "fail", output: `HTTP ${response.status}`, componentId };
	if (status === "warn") return { status, output: reported ?? "reported warn", componentId };
	return { status, componentId };
}

/** The body as text, or `null` once it passes `limit` bytes, at which point it is cancelled. */
async function readCapped(response: Response, limit: number): Promise<string | null> {
	let reader = response.body?.getReader();
	if (reader === undefined) return "";

	let decoder = new TextDecoder();
	let text = "";
	let size = 0;
	for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
		size += chunk.value.byteLength;
		if (size > limit) {
			await reader.cancel();
			return null;
		}
		text += decoder.decode(chunk.value, { stream: true });
	}
	return text + decoder.decode();
}

/** Whether `value` is an `@sdxc/result` failure. */
function isFailedResult(value: unknown): value is { status: "failure"; error: Error } {
	if (typeof value !== "object" || value === null) return false;
	return (
		"status" in value &&
		value.status === "failure" &&
		"error" in value &&
		value.error instanceof Error
	);
}

/** An error's message, or its string form when something other than an `Error` was thrown. */
function describe(error: unknown): string | undefined {
	if (error === undefined) return undefined;
	if (error instanceof Error) return error.message;
	return typeof error === "string" ? error : JSON.stringify(error);
}

/** A copy of `fields` without its `undefined` entries, so a report carries only what it states. */
function compact<T extends Record<string, unknown>>(fields: T): T {
	return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as T;
}

/** Rejects a timeout a timer cannot honor. */
function assertTimeout(timeout: number): void {
	if (!Number.isFinite(timeout) || timeout <= 0) {
		throw new RangeError(`timeout needs a positive number of milliseconds, received ${timeout}.`);
	}
}
