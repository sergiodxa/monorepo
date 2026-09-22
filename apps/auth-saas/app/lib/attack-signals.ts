/**
 * Attack signals: one analytics data point per security-relevant outcome on a
 * tenant-facing surface, written through `env.ANALYTICS` the same binding and
 * dataset the cost ledger writes to, distinguished from a cost row by its own
 * `kind` blob. Unlike the cost ledger, nothing here accumulates across a
 * request — a call site that already knows an outcome records it immediately,
 * as its own discrete event, through {@link recordAttackSignal}.
 *
 * {@link readFailedSignInsByHour} reads the same dataset back through
 * Cloudflare's Analytics Engine SQL API, the way `usage-reporting.ts` already
 * reads the cost ledger's own rows back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currentLog } from "@sdxc/logger";

/** The tenant-facing surface a signal was observed on. */
export type AttackSignalSurface =
	| "credential"
	| "mail-sending"
	| "token"
	| "authorization"
	| "protocol"
	| "management"
	| "device-authorization"
	| "device-approval";

/** What happened, from a caller's own decision point. */
export type AttackSignalOutcome =
	| "succeeded"
	| "refused-credential"
	| "refused-rate-limit"
	| "refused-turnstile"
	| "refused-backoff";

/** One discrete, already-decided security outcome, ready to write. */
export interface AttackSignal {
	tenantId: string;
	surface: AttackSignalSurface;
	outcome: AttackSignalOutcome;
	/** Detail already at hand at the call site, e.g. `"invalid-credentials"` or `"rate_limit.exceeded"`. */
	reason?: string;
	/** Coarse geography, e.g. `request.cf?.country`. */
	country?: string;
}

/** What {@link recordAttackSignal} needs to write the row. */
export interface AttackSignalEnv {
	ANALYTICS: AnalyticsEngineDataset;
}

/** The `blob1` value that marks a row as an attack signal rather than a cost-ledger row. */
const ATTACK_SIGNAL_KIND = "attack_signal";

/**
 * Writes one attack signal as its own analytics data point, indexed by tenant
 * id: `blob1` carries the fixed {@link ATTACK_SIGNAL_KIND} tag, so a query can
 * always tell this row apart from a cost-ledger row sharing the same dataset,
 * and `double1` carries a constant `1` to sum for a count.
 *
 * Catches and logs its own failure rather than throwing: instrumentation
 * failing the request it observes would be worse than no instrumentation.
 *
 * @param env - Where `ANALYTICS` is bound.
 * @param signal - The outcome to record.
 * @example
 * recordAttackSignal(env, {
 * 	tenantId: ctx.tenant.id,
 * 	surface: "credential",
 * 	outcome: "refused-credential",
 * 	reason: "invalid-credentials",
 * 	country: requestOrigin(ctx.request).country ?? undefined,
 * });
 */
export function recordAttackSignal(env: AttackSignalEnv, signal: AttackSignal): void {
	try {
		env.ANALYTICS.writeDataPoint({
			indexes: [signal.tenantId],
			blobs: [
				ATTACK_SIGNAL_KIND,
				signal.tenantId,
				signal.surface,
				signal.outcome,
				signal.reason ?? "",
				signal.country ?? "",
			],
			doubles: [1],
		});
	} catch (error) {
		currentLog()?.warn("attack_signal.write_failed", {
			message: error instanceof Error ? error.message : String(error),
		});
	}
}

/** The dataset {@link recordAttackSignal} writes to, and {@link readFailedSignInsByHour} reads back. */
const ANALYTICS_ENGINE_DATASET = "auth-saas-analytics";

/** The credential of the account this dataset lives in, for the SQL HTTP API's own bearer auth. */
export interface AttackSignalQueryEngine {
	accountId: string;
	apiToken: string;
}

export interface ReadFailedSignInsByHourInput {
	tenantId: string;
	/** Start of the window, in epoch milliseconds, inclusive. */
	from: number;
	/** End of the window, in epoch milliseconds, exclusive. */
	to: number;
}

/** One hour's failed sign-in count. */
export interface FailedSignInsByHour {
	/** The hour's own start, `"YYYY-MM-DD HH:00:00"`, in UTC. */
	hour: string;
	count: number;
}

/**
 * A tenant id is interpolated into the raw SQL string this call sends, so
 * this rejects anything outside a typeid's own charset before it ever
 * reaches the query, the same defense `usage-reporting.ts`'s `assertValidDay`
 * gives the day it interpolates.
 *
 * @param tenantId - The tenant id to validate.
 */
function assertQueryableTenantId(tenantId: string): void {
	if (!/^[A-Za-z0-9_-]+$/.test(tenantId)) throw new TypeError(`invalid tenant id: ${tenantId}`);
}

/**
 * Formats an epoch instant the way the Analytics Engine SQL API's `toDateTime`
 * parses reliably: a space-separated, UTC, second-precision string with no
 * timezone suffix.
 *
 * @param epochMs - The instant to format.
 * @returns `"YYYY-MM-DD HH:MM:SS"`, in UTC.
 */
function formatUtcDateTime(epochMs: number): string {
	return new Date(epochMs).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Reads back a tenant's failed sign-ins, bucketed by hour, over a window —
 * the query a security dashboard's own trailing-baseline comparison would
 * run, proving the write shape {@link recordAttackSignal} lays down is
 * genuinely queryable.
 *
 * @param engine - The account and API token the Analytics Engine SQL API
 * authenticates with; the same credential `domain.ts`'s `HostnameClient`
 * already holds for the account's other Cloudflare API calls.
 * @param input - The tenant to read, and the window's start (inclusive) and
 * end (exclusive), in epoch milliseconds.
 * @returns Each hour in the window that saw at least one failed sign-in, with
 * its count, oldest first.
 */
export async function readFailedSignInsByHour(
	engine: AttackSignalQueryEngine,
	input: ReadFailedSignInsByHourInput,
): Promise<FailedSignInsByHour[]> {
	assertQueryableTenantId(input.tenantId);

	let from = formatUtcDateTime(input.from);
	let to = formatUtcDateTime(input.to);

	let query = `
		SELECT toStartOfHour(timestamp) AS hour, SUM(double1) AS count
		FROM ${ANALYTICS_ENGINE_DATASET}
		WHERE blob1 = '${ATTACK_SIGNAL_KIND}'
			AND blob2 = '${input.tenantId}'
			AND blob4 = 'refused-credential'
			AND timestamp >= toDateTime('${from}') AND timestamp < toDateTime('${to}')
		GROUP BY hour
		ORDER BY hour
	`;

	let response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${engine.accountId}/analytics_engine/sql`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${engine.apiToken}`,
				"Content-Type": "text/plain",
			},
			body: query,
		},
	);

	if (!response.ok) {
		let error = await response.text();
		throw new Error(`analytics engine attack-signal query failed: ${error}`);
	}

	let result = (await response.json()) as { data: Array<{ hour: string; count: number }> };

	return result.data.map((row) => ({ hour: row.hour, count: row.count }));
}
