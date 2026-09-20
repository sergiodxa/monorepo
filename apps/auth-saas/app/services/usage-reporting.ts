/**
 * Reports one settled UTC day's usage and cost to the billing provider, per
 * tenant, so revenue, consumption and cost join on the customer record that
 * already holds revenue. Reads the day's active-user counts straight from
 * `tenant_usage_day` and the day's cost from the cost ledger's own analytics
 * dataset, then hands both to the provider as one `usage.ingest` call.
 *
 * Nothing here runs on a schedule yet — a scheduled job, once one exists,
 * calls `reportDailyUsage` once a day, the same way `closeTenantMeteringDay`,
 * the mail rate limit's sweep and the entitlement projection's own sweeps are
 * still waiting on one shared trigger. Reporting a day also depends on two
 * other jobs having already run for it: `closeTenantMeteringDay`, which is
 * what fills `tenant_usage_day` in the first place, and the cost ledger's own
 * `flush`, which is what writes the analytics points this reads back. Both
 * are real and tested, and neither has a live caller yet either, so a day
 * reported today reads whatever those two happened to produce for it — most
 * likely nothing, until all three are wired to a trigger together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, UsageEvent } from "@sdxc/billing";
import type { Database } from "remix/data-table";

import { supports } from "@sdxc/billing";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";

import { COST_RESOURCES } from "~/app/lib/cost-rates";
import Customer from "~/app/models/customer";
import Tenant from "~/app/models/tenant";
import TenantUsageDay from "~/app/models/tenant-usage-day";
import { dayOf } from "~/database/metering";

/** One UTC day, in milliseconds — the same unit `metering.ts`'s `dayOf` keys against. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Analytics Engine dataset `cost-ledger.ts`'s `flush` writes to, and this reads back. */
const ANALYTICS_ENGINE_DATASET = "auth-saas-analytics";

/**
 * The `doubleN` column `flush`'s own blob/double layout prices a point's cost
 * under. `flush` writes `[...COST_RESOURCES.map(...), cents]`, so the priced
 * total always sits one past the last resource, and stays there as a new
 * resource is appended to `COST_RESOURCES` rather than inserted.
 */
const CENTS_DOUBLE_COLUMN = `double${COST_RESOURCES.length + 1}`;

/** Why a tenant's day was left out of the ingest call. */
export type UsageReportingSkipReason = "tenant_not_found" | "no_provider_customer";

/** One tenant-day the job read but did not report, and why. */
export interface SkippedTenantDay {
	tenantId: string;
	day: number;
	reason: UsageReportingSkipReason;
}

export interface ReportDailyUsageOptions {
	/** The UTC day to report, as `dayOf` keys it. Defaults to yesterday. */
	day?: number;
}

export interface ReportDailyUsageResult {
	day: number;
	/** How many tenant-days were included in a successful `usage.ingest` call. */
	reported: number;
	/** Every tenant-day the job read but left out, and why. */
	skipped: readonly SkippedTenantDay[];
}

/**
 * Throws for a day outside what a Worker's own clock could ever produce,
 * since this value is interpolated into the raw SQL string the Analytics
 * Engine HTTP API is called with and never reaches a parameterized query.
 *
 * @param day - The day to validate.
 */
function assertValidDay(day: number): void {
	if (!Number.isInteger(day) || day < 0 || day > Number.MAX_SAFE_INTEGER) {
		throw new TypeError(`invalid day: ${day}`);
	}
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
 * Reads back the ledger's own analytics dataset for one UTC day, summed per
 * tenant. One request covers every tenant at once — `flush`'s blobs carry the
 * source, the tenant id and the rate-card version, but no day or date of
 * their own, so day-scoping here has nothing to filter on but Analytics
 * Engine's own recorded write time for each point; that is a real limitation
 * of what the ledger currently writes, not a guess on this function's part,
 * and it means a point replayed or backfilled for a past day would be
 * attributed to whichever day it was actually written on instead.
 *
 * @param day - The UTC day to sum cost for, as `dayOf` keys it.
 * @returns Each tenant's summed cost for that day, in cents, keyed by tenant id.
 */
async function queryDailyCostByTenant(day: number): Promise<Map<string, number>> {
	assertValidDay(day);

	let dayStart = formatUtcDateTime(day * DAY_MS);
	let dayEnd = formatUtcDateTime((day + 1) * DAY_MS);

	let query = `
		SELECT blob2 AS tenant_id, SUM(${CENTS_DOUBLE_COLUMN}) AS cents
		FROM ${ANALYTICS_ENGINE_DATASET}
		WHERE timestamp >= toDateTime('${dayStart}') AND timestamp < toDateTime('${dayEnd}')
		GROUP BY blob2
	`;

	let response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.CF_API_TOKEN}`,
				"Content-Type": "text/plain",
			},
			body: query,
		},
	);

	if (!response.ok) {
		let error = await response.text();
		throw new Error(`analytics engine cost query failed: ${error}`);
	}

	let result = (await response.json()) as { data: Array<{ tenant_id: string; cents: number }> };

	let costs = new Map<string, number>();
	for (let row of result.data) costs.set(row.tenant_id, row.cents);
	return costs;
}

/**
 * Formats a cost in cents as the plain decimal string `Cost.amount` requires:
 * nine places, so a per-tenant daily fraction of a cent survives rather than
 * rounding to zero or, as a JavaScript number would past `1e-6`, printing in
 * exponential notation a billing platform's parser rejects.
 *
 * @param cents - The cost, in cents.
 * @returns `cents` as a fixed nine-decimal-place string.
 */
function costToDecimalString(cents: number): string {
	return cents.toFixed(9);
}

/**
 * Reports one settled UTC day's usage to the billing provider: for every
 * tenant that closed a metering day, one `auth.dau` event carrying that day's
 * distinct authenticating subjects and one `infra.cost` event carrying that
 * day's modelled cost, both named to the customer that owns the tenant.
 *
 * Every event's `externalId` is derived from the tenant, the day and the
 * event's own name rather than from the moment of sending, so a retried
 * delivery and a re-run of the same day both collapse to one counted event
 * at the provider.
 *
 * @param db - The control plane's database.
 * @param billing - The configured billing provider.
 * @param options - The day to report; defaults to yesterday, UTC.
 * @returns How many tenant-days were reported, and every one left out and why.
 * @throws The provider's own `BillingError` when it reports a retryable
 * failure, so a caller running this on a schedule retries the whole day; a
 * non-retryable failure is logged and swallowed instead, since the next run
 * costs nothing.
 */
export async function reportDailyUsage(
	db: Database,
	billing: Billing,
	options: ReportDailyUsageOptions = {},
): Promise<ReportDailyUsageResult> {
	let day = options.day ?? dayOf(Date.now()) - 1;

	if (!supports(billing, "usage")) {
		currentLog()?.warn("usage_reporting.unsupported", { day });
		return { day, reported: 0, skipped: [] };
	}

	let usageRows = await TenantUsageDay.listByDay(db, day);
	if (usageRows.length === 0) return { day, reported: 0, skipped: [] };

	let costByTenant = await queryDailyCostByTenant(day);

	let events: UsageEvent[] = [];
	let skipped: SkippedTenantDay[] = [];

	for (let row of usageRows) {
		let tenant = await Tenant.findById(db, row.tenant_id);
		if (!tenant) {
			skipped.push({ tenantId: row.tenant_id, day, reason: "tenant_not_found" });
			currentLog()?.warn("usage_reporting.tenant_not_found", { tenantId: row.tenant_id, day });
			continue;
		}

		let customer = await Customer.findById(db, tenant.customer_id);
		if (!customer || customer.provider_customer_id === null) {
			skipped.push({ tenantId: tenant.id, day, reason: "no_provider_customer" });
			currentLog()?.warn("usage_reporting.no_provider_customer", { tenantId: tenant.id, day });
			continue;
		}

		let metadata = { tenantId: tenant.id, tier: tenant.plan_slug };
		let cents = costByTenant.get(tenant.id) ?? 0;

		events.push({
			name: "auth.dau",
			customer: { externalId: customer.id },
			externalId: `auth.dau:${tenant.id}:${day}`,
			metadata: { ...metadata, subjects: row.subjects },
		});

		events.push({
			name: "infra.cost",
			customer: { externalId: customer.id },
			externalId: `infra.cost:${tenant.id}:${day}`,
			metadata,
			cost: { amount: costToDecimalString(cents), currency: "usd" },
		});
	}

	if (events.length === 0) return { day, reported: 0, skipped };

	let result = await billing.usage.ingest(events);

	if (isFailure(result)) {
		if (result.error.retryable) throw result.error;

		currentLog()?.warn("usage_reporting.ingest_failed", {
			day,
			code: result.error.code,
			message: result.error.message,
		});

		return { day, reported: 0, skipped };
	}

	return { day, reported: events.length / 2, skipped };
}
