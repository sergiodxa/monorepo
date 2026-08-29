/**
 * The HTTP check: probe a target through a region-pinned `GeoFetchDO`, evaluate the
 * response body against content-check rules, and classify the pair into an
 * up/degraded/down status. A class with a method per step, since the scheduled job and
 * the ad-hoc ping endpoint each interleave different work between the steps.
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
 * Location hints pinned to Cloudflare's EU jurisdiction — a hard constraint that overrides
 * a monitor's own location hint (ADR-013). `enam` was wrongly included here once, silently
 * probing North America monitors from Europe; keep this to exactly the two European hints.
 */
const EU_LOCATION_HINTS = new Set(["eeur", "weur"]);

/**
 * How many `GeoFetchDO` instances share one location hint's probing (ADR-009), keeping
 * one hung target from queueing the rest of its region behind a single actor. A fixed
 * constant — changing it re-hashes monitors onto new objects, an unexplained latency step.
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
	 * How long the Durable Object's handler ran — the billing metric, against
	 * `responseTimeMs`'s product metric (ADR-019 §2) — as a LOWER BOUND on the billed window
	 * (see {@link DO_WALL_TIME_HEADER}). `null` when this side's timeout aborted the call.
	 */
	doWallTimeMs: number | null;
	/**
	 * Where a redirect pointed, absolute, or `null` when redirects were followed or the
	 * response carried no usable `Location`. Exists so the public trial can tell a visitor
	 * their URL redirects and name the destination to check next.
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
	 * Whether a 3xx is followed; defaults to true, right for a monitor since the team chose
	 * the URL. The public trial passes false — `trial-guard.ts` vets the resolved address
	 * only for this URL, and `fetch` would otherwise follow an unvetted redirect internally.
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
	 * Fetches the target through the `GeoFetchDO` shard {@link shardFor} picks, charging the
	 * request cost up front since a request that fails part-way is still billed. Throws only
	 * when the Durable Object itself is unavailable; a failing target comes back as an unreachable {@link HttpProbeOutcome}.
	 */
	async probe(): Promise<HttpProbeOutcome> {
		let { locationHint, shardKey, contentChecks } = this.options;
		let needsBody = contentChecks.length > 0;
		/**
		 * The namespace is chosen before the id is minted — a jurisdiction is a property of the
		 * id, the same name yields a different id per jurisdiction, and `get` errors when the
		 * id's jurisdiction and the namespace's differ, as minting off the base namespace would.
		 */
		let namespace = EU_LOCATION_HINTS.has(locationHint)
			? env.GEO_FETCH.jurisdiction("eu")
			: env.GEO_FETCH;
		let id = namespace.idFromName(`${locationHint}:${shardFor(shardKey, SHARDS_PER_REGION)}`);
		let stub = namespace.get(id, { locationHint });

		/** A content check needs the body, so HEAD becomes GET to retrieve one. */
		let method = needsBody && this.options.method === "HEAD" ? "GET" : this.options.method;
		let signal = AbortSignal.timeout(this.options.timeoutSeconds * MS_PER_SECOND);

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
				 * Set here and not only on the object, because redirect mode is a client-side
				 * `fetch` option that no HTTP boundary carries — the header `GeoFetchDO` reads
				 * cannot substitute for it; this call still needs its own redirect mode set to match.
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
			if (signal.aborted) return this.recordWallTime(UNREACHABLE);
			/**
			 * Anything else means the call to the Durable Object itself failed, not the request it
			 * was asked to make — nothing was learned about the target. Propagates it as the
			 * infrastructure fault it is, so every `down` result reflects only what the target did.
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
	 * Charges the probe's Durable Object wall time and passes the outcome through. The
	 * header is a documented LOWER BOUND on the billed window (see {@link DO_WALL_TIME_HEADER}),
	 * so this always reports a real measurement; `null` means nothing was measured to charge for.
	 */
	private recordWallTime(outcome: HttpProbeOutcome): HttpProbeOutcome {
		recordCost("doDurationMs", outcome.doWallTimeMs ?? 0);
		return outcome;
	}
}

/**
 * Which of `shards` objects within a region a target's probes go through, via FNV-1a
 * over the key — an even spread over a handful of buckets, and the same answer for the
 * same key forever, so a monitor never drifts shards into an unexplained latency step.
 */
function shardFor(key: string, shards: number): number {
	let hash = 0x811c9dc5;

	for (let index = 0; index < key.length; index++) {
		hash ^= key.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	return (hash >>> 0) % shards;
}

/**
 * Resolves a response's `Location` against the probed URL, so a relative hop (`/login`,
 * the common case) comes back as somewhere a caller can actually name. Returns `null`
 * when it won't parse — half a destination is worse than none.
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
 * Reads the Durable Object's reported handler duration off a probe response. Returns
 * `null`, not 0, when the header is missing or unparseable — a measurement that never
 * happened and a handler that took no time are different facts; conflating them understates billing.
 */
function readWallTime(response: Response): number | null {
	let header = response.headers.get(DO_WALL_TIME_HEADER);
	if (header === null) return null;

	let value = Number(header);
	return Number.isFinite(value) ? value : null;
}
