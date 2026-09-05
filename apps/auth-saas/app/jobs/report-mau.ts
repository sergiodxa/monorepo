/**
 * Daily scheduled job that reports each tenant's Monthly Active Users (MAU) to the
 * billing platform for usage-based billing. Queries Analytics Engine for per-tenant
 * MAU, keeps the tenants that are billing customers, and ingests one event each.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UsageEvent } from "@sdxc/billing";

import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";

import { CONNECTION, failureFields, MAU_METER, polar } from "~/app/lib/billing";
import AnalyticsService from "~/app/services/analytics";

/** A tenant that is a customer of the connection this deployment bills through. */
interface CustomerRow {
	tenant_id: string;
}

/**
 * Runs daily at 1:00 AM UTC via cron trigger. Every tenant that is a billing
 * customer contributes one event to a single ingest call, keyed by tenant and
 * day so a re-run of the same day is counted once rather than twice. What the run
 * did lands on the cron trigger's log, which the scheduled handler opens around it.
 *
 * @returns A promise that resolves when the reporting run completes.
 * @throws When the MAU query, the customer lookup, or the ingest call fails.
 * @example
 * logger.open("cron", { cron: { expression: controller.cron } }).run(() => reportMAU());
 */
export async function reportMAU(): Promise<void> {
	let log = currentLog();
	let month = AnalyticsService.getCurrentMonth();
	let day = new Date().toISOString().slice(0, 10);

	log?.set({ job: { name: "report-mau" }, mau: { month } });

	let mauResults = await AnalyticsService.queryAllTenantsMAU(month);

	if (mauResults.length === 0) {
		log?.set({ tenants: { count: 0 } }).note("mau.empty");
		return;
	}

	log?.set({ tenants: { count: mauResults.length } });

	let tenantIds = mauResults.map((r) => r.tenant_id);
	let placeholders = tenantIds.map((_, index) => `?${index + 2}`).join(", ");

	let customers = await env.PLATFORM_DB.prepare(
		`SELECT tenant_id FROM billing_customers
		 WHERE connection = ?1 AND is_default = 1 AND tenant_id IN (${placeholders})`,
	)
		.bind(CONNECTION, ...tenantIds)
		.all<CustomerRow>();

	let billable = new Set(customers.results.map((row) => row.tenant_id));

	let events: UsageEvent[] = [];
	let skipped = 0;

	for (let { tenant_id, mau } of mauResults) {
		if (!billable.has(tenant_id)) {
			skipped++;
			continue;
		}

		events.push({
			name: MAU_METER,
			customer: { externalId: tenant_id },
			externalId: `${MAU_METER}_${tenant_id}_${day}`,
			metadata: { month, count: mau },
		});
	}

	if (events.length === 0) {
		log?.set({ mau: { reported: 0, skipped, accepted: 0 } }).note("mau.reported");
		return;
	}

	let ingested = await polar.usage.ingest(events);

	if (isFailure(ingested)) {
		log?.fail(ingested.error, { billing: failureFields(ingested.error) });
		throw ingested.error;
	}

	log
		?.set({ mau: { reported: events.length, skipped, accepted: ingested.data.accepted } })
		.note("mau.reported");
}
