/**
 * The HTTP check, as the three steps it actually is: probe the target through a
 * region-pinned `GeoFetchDO`, evaluate the response body against content-check rules,
 * and classify the pair into an up/degraded/down status. Shared by the scheduled
 * `CheckHttpJob` and the ad-hoc `POST /api/v1/ping` endpoint, the same way
 * `dns-check.ts` and `tcp-check.ts` are shared by their sweep and their manual action.
 *
 * A class with a method per step rather than one `check()` function, because the two
 * callers do different work between the steps: the job reads the monitor's previous
 * status, commits a `monitor_results` row and dispatches alerts around them, while the
 * ad-hoc endpoint has nothing to interleave and calls {@link HttpCheck.run}. Nothing
 * here writes to a database, sends a notification, or knows what a monitor is beyond
 * {@link HttpCheck.forMonitor}'s mapping — a caller that wants those does them itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import type { ContentCheckRule } from "~/app/data/content-check";
import type { MonitorStatus, SelectMonitor } from "~/database/schema";

import ContentCheck from "~/app/data/content-check";
import { DO_WALL_TIME_HEADER, NO_REDIRECT_HEADER, PROBE_OUTCOME_HEADER } from "~/app/do/geo-fetch";
import { recordCost } from "~/app/services/cost";

const MS_PER_SECOND = 1000;

/**
 * Location hints whose `GeoFetchDO` is pinned to Cloudflare's EU jurisdiction, which is
 * Europe's two hints and nothing else (ADR-013).
 *
 * A jurisdiction is a hard constraint on where the object runs; a location hint is only a
 * preference, and the jurisdiction wins when they disagree. `enam` — eastern *North
 * America* — was in this set, so a monitor asking to be probed from North America was
 * probed from Europe and its `response_time_ms` measured the wrong continent.
 *
 * Whether the pin belongs here at all is deliberately still open. It cannot be an
 * obligation about stored personal data: this object has no storage, no alarms and no
 * state that outlives the request — it proxies a fetch, times it, and returns — while the
 * personal data in this system lives in D1 and KV, neither of which is
 * jurisdiction-scoped. ADR-013 records the product question; until it is answered the two
 * European hints keep the pin, because dropping it is the change that needs the answer.
 */
const EU_LOCATION_HINTS = new Set(["eeur", "weur"]);

/**
 * How many `GeoFetchDO` instances share the probing for one location hint (ADR-009).
 *
 * A single Durable Object is a single-threaded actor, so without this every monitor in a
 * region queues behind one object and one hung target degrades the whole region. Eight
 * raises that ceiling ~8× while leaving enough monitors per shard for concurrent probes
 * to keep amortising the object's billed duration window.
 *
 * A constant rather than configuration on purpose: changing it re-hashes every monitor
 * onto a different object, which puts a step change in every latency series for no reason
 * a user can see, so it should be a deliberate code change with a changelog note.
 */
const SHARDS_PER_REGION = 8;

/**
 * What one region-hinted fetch observed. `failed` covers everything that stopped the
 * request from producing a response at all — timeout, DNS failure, refused connection.
 */
export interface HttpProbeOutcome {
	responseStatus: number | null;
	responseTimeMs: number | null;
	/**
	 * How long the Durable Object's handler ran, which is the billing metric, against
	 * `responseTimeMs`'s product metric (ADR-019 §2). A LOWER BOUND on the billed
	 * window — see {@link DO_WALL_TIME_HEADER}. `null` when the object never reported
	 * one, which is the case when this side's timeout aborted the call.
	 */
	doWallTimeMs: number | null;
	/**
	 * Where a redirect pointed, absolute, or `null` when the response carried no usable
	 * `Location`. Only ever set when redirects were not followed — a followed redirect
	 * resolves to its destination and there is no hop left to report.
	 *
	 * It exists so the public trial can tell a visitor their URL redirects and offer to
	 * check the destination instead. Without it the page can say a redirect happened but
	 * not where to, which is the half of the answer that is no use.
	 */
	location: string | null;
	body: string;
	failed: boolean;
}

/** The outcome for a target that never answered: no status, no timing, classified down. */
const UNREACHABLE: HttpProbeOutcome = {
	responseStatus: null,
	responseTimeMs: null,
	doWallTimeMs: null,
	location: null,
	body: "",
	failed: true,
};

/** Everything one HTTP check needs to know about its target and how to judge it. */
export interface HttpCheckOptions {
	url: string;
	method: string;
	/** Sent with the probe. A monitor has none; an ad-hoc ping may carry auth headers. */
	headers?: Record<string, string>;
	/** Request body, for the methods that take one. */
	body?: string;
	expectedStatus: number;
	degradedAfterMs: number;
	timeoutSeconds: number;
	locationHint: DurableObjectLocationHint;
	/**
	 * What this target's shard within its region is derived from, so it always probes
	 * through the same one of {@link SHARDS_PER_REGION} objects. A monitor uses its id;
	 * an ad-hoc ping uses its URL, which keeps a repeated CI check on one warm object.
	 */
	shardKey: string;
	/**
	 * Rules the response body is judged against. Also what decides whether a body is
	 * fetched at all — an empty list means the probe never reads one.
	 */
	contentChecks: ContentCheckRule[];
	/**
	 * Whether a 3xx is followed. Defaults to true, which is right for a monitor: the team
	 * configured the URL, so wherever it redirects is somewhere they chose.
	 *
	 * The public trial passes false, and must. `trial-guard.ts` validates the addresses a
	 * stranger's hostname resolves to before the probe runs, and a target answering
	 * `302 http://169.254.169.254/` reaches cloud metadata regardless, because `fetch`
	 * follows the hop after the guard has finished deciding. With this false the redirect
	 * comes back as a 3xx to classify instead of a request nobody vetted.
	 */
	followRedirects?: boolean;
}

/** Everything {@link HttpCheck.run} learned, for a caller with nothing to interleave. */
export interface HttpCheckResult {
	outcome: HttpProbeOutcome;
	contentChecksPassed: boolean;
	status: MonitorStatus;
}

export class HttpCheck {
	constructor(readonly options: HttpCheckOptions) {}

	/**
	 * The check a stored monitor describes. The column-to-option mapping lives here so
	 * the job doesn't restate it, and so a new monitor column that affects checking is
	 * one edit rather than two.
	 *
	 * @param monitor The monitor row to check.
	 * @param contentChecks Its enabled content checks; pass `[]` when it has none.
	 */
	static forMonitor(monitor: SelectMonitor, contentChecks: ContentCheckRule[]): HttpCheck {
		return new HttpCheck({
			url: monitor.url,
			method: monitor.method,
			expectedStatus: monitor.expected_status,
			degradedAfterMs: monitor.degraded_after_ms,
			timeoutSeconds: monitor.timeout_seconds,
			/** The column is declared as a plain text enum, so its value set is asserted here. */
			locationHint: monitor.location_hint as DurableObjectLocationHint,
			shardKey: monitor.id,
			contentChecks,
		});
	}

	/**
	 * Fetches the target through a `GeoFetchDO` instance pinned to the configured region,
	 * which is what measures the response time. Which of that region's
	 * {@link SHARDS_PER_REGION} instances is decided by {@link shardFor}, so the same
	 * target always probes through the same one.
	 *
	 * Records both of the probe's costs — the Durable Object request and the wall time it
	 * reported — so every caller is charged for the probe without having to remember to.
	 *
	 * Throws only when the Durable Object itself is unavailable, which is an
	 * infrastructure fault the caller should retry rather than a statement about the
	 * target. The two ways the target itself can fail both come back as an unreachable
	 * {@link HttpProbeOutcome}: the object reports a request it couldn't complete as an
	 * `unreachable` response, and the configured timeout aborts the call here.
	 */
	async probe(): Promise<HttpProbeOutcome> {
		let { locationHint, shardKey, contentChecks } = this.options;
		let needsBody = contentChecks.length > 0;
		/**
		 * The namespace is chosen before the id is minted, because a jurisdiction is a
		 * property of the id: the same name yields a different id in each jurisdiction, and
		 * `get` errors when the id's jurisdiction and the namespace's differ. Minting off
		 * `env.GEO_FETCH` and then calling `get` on the EU subnamespace is that mismatch.
		 */
		let namespace = EU_LOCATION_HINTS.has(locationHint)
			? env.GEO_FETCH.jurisdiction("eu")
			: env.GEO_FETCH;
		let id = namespace.idFromName(`${locationHint}:${shardFor(shardKey, SHARDS_PER_REGION)}`);
		let stub = namespace.get(id, { locationHint });

		/** A content check needs the body, so HEAD becomes GET to retrieve one. */
		let method = needsBody && this.options.method === "HEAD" ? "GET" : this.options.method;
		let signal = AbortSignal.timeout(this.options.timeoutSeconds * MS_PER_SECOND);

		// Counted before the call, because a request that fails part-way is still billed.
		recordCost("doRequest");

		try {
			let headers = new Headers(this.options.headers);
			if (this.options.followRedirects === false) headers.set(NO_REDIRECT_HEADER, "1");

			let response = await stub.fetch(this.options.url, {
				method,
				headers,
				body: this.options.body,
				signal,
				/**
				 * Set here and not only on the object, because this is the side that follows.
				 * A request arriving at a `fetch` handler already has redirect mode `manual`,
				 * so `GeoFetchDO` was always handing the 3xx straight back; what resolved the
				 * `Location` and re-issued it — through this same stub, at whatever the target
				 * named — was this call taking the platform default. Redirect mode is a
				 * client-side property and nothing on an HTTP boundary carries it, so the
				 * header the object reads cannot substitute for this.
				 */
				redirect: this.options.followRedirects === false ? "manual" : "follow",
			});

			/**
			 * The object reached us but couldn't reach the target: a `down` result. Its wall
			 * time is kept anyway — a probe that failed still occupied the object, and that
			 * is the expensive case worth watching.
			 */
			if (response.headers.get(PROBE_OUTCOME_HEADER) === "unreachable") {
				return this.recordWallTime({ ...UNREACHABLE, doWallTimeMs: readWallTime(response) });
			}

			let body = needsBody ? await response.text().catch(() => "") : "";

			return this.recordWallTime({
				responseStatus: response.status,
				responseTimeMs: Number(response.headers.get("X-Response-Time") ?? 0),
				doWallTimeMs: readWallTime(response),
				location: absoluteLocation(response, this.options.url),
				body,
				failed: false,
			});
		} catch (error) {
			// The configured timeout elapsed, which is also a `down` result.
			if (signal.aborted) return this.recordWallTime(UNREACHABLE);
			/**
			 * Anything else means the call to the Durable Object failed rather than the
			 * request it was asked to make, so nothing was learned about the target.
			 * Propagate it as the infrastructure fault it is instead of recording a `down`
			 * the target didn't earn.
			 */
			throw error;
		}
	}

	/**
	 * Whether the probed body satisfies every enabled content check, which is vacuously
	 * true when there are none. Delegates the matching itself to `ContentCheck.evaluate`,
	 * so the rules mean the same thing here as they do for a stored monitor.
	 */
	evaluate(outcome: HttpProbeOutcome): boolean {
		if (this.options.contentChecks.length === 0) return true;
		return ContentCheck.evaluate(this.options.contentChecks, outcome.body);
	}

	/** Classifies a check as up/degraded/down per `docs/http-monitors.md`'s status model. */
	classify(outcome: HttpProbeOutcome, contentChecksPassed: boolean): MonitorStatus {
		if (outcome.failed) return "down";
		if (outcome.responseStatus !== this.options.expectedStatus) return "down";
		if (!contentChecksPassed) return "down";
		if ((outcome.responseTimeMs ?? 0) >= this.options.degradedAfterMs) return "degraded";
		return "up";
	}

	/** {@link probe} then {@link evaluate} then {@link classify}, with nothing in between. */
	async run(): Promise<HttpCheckResult> {
		let outcome = await this.probe();
		let contentChecksPassed = this.evaluate(outcome);
		return { outcome, contentChecksPassed, status: this.classify(outcome, contentChecksPassed) };
	}

	/**
	 * Charges the probe's Durable Object wall time and passes the outcome through.
	 *
	 * The header is a documented LOWER BOUND on the billed window — see
	 * {@link DO_WALL_TIME_HEADER} — so this understates rather than invents. `null` means
	 * the object never reported one (this side's timeout aborted the call), and there is
	 * nothing honest to charge for a window nobody measured.
	 */
	private recordWallTime(outcome: HttpProbeOutcome): HttpProbeOutcome {
		recordCost("doDurationMs", outcome.doWallTimeMs ?? 0);
		return outcome;
	}
}

/**
 * Which of `shards` objects within a region a target's probes go through.
 *
 * FNV-1a over the key, which is all this needs: an even spread over a handful of buckets
 * and, more importantly, the same answer for the same key forever. A monitor that drifted
 * between shards would show a step change in its response times that nothing the user did
 * explains, so this is derived from the key and never from a counter, the clock, or
 * randomness.
 */
function shardFor(key: string, shards: number): number {
	let hash = 0x811c9dc5;

	for (let index = 0; index < key.length; index++) {
		hash ^= key.charCodeAt(index);
		// `Math.imul` because the FNV prime overflows a double's exact integer range.
		hash = Math.imul(hash, 0x01000193);
	}

	return (hash >>> 0) % shards;
}

/**
 * Resolves a response's `Location` against the URL that was probed, so a relative hop
 * (`/login`, the common case) comes back as somewhere a caller can actually name.
 *
 * `null` rather than the raw header when it will not parse: a caller offering to check the
 * destination needs a URL it can probe, and half of one is worse than none.
 */
function absoluteLocation(response: Response, probedUrl: string): string | null {
	let location = response.headers.get("location");
	if (location === null) return null;

	try {
		return new URL(location, probedUrl).toString();
	} catch {
		return null;
	}
}

/**
 * Reads the Durable Object's reported handler duration off a probe response.
 *
 * Returns `null` rather than 0 when the header is missing or unparseable, because a
 * measurement that didn't happen and a handler that took no time are different facts
 * and averaging the two would understate the billed window further than it already is.
 */
function readWallTime(response: Response): number | null {
	let header = response.headers.get(DO_WALL_TIME_HEADER);
	if (header === null) return null;

	let value = Number(header);
	return Number.isFinite(value) ? value : null;
}
