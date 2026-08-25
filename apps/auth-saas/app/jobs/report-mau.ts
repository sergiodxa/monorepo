/**
 * Daily scheduled job that reports each tenant's Monthly Active Users (MAU) to Polar
 * for usage-based billing. Queries Analytics Engine for per-tenant MAU, joins it to
 * Polar customer IDs from D1, and pushes the counts to Polar's meters API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Logger } from "@pkg/logger";
import { PolarClient } from "@pkg/polar";
import { env } from "cloudflare:workers";

import AnalyticsService from "~/app/services/analytics";

interface SubscriptionRow {
	tenant_id: string;
	/** Present only for tenants with an active Polar subscription. */
	polar_customer_id: string | null;
}

/**
 * Runs daily at 1:00 AM UTC via cron trigger. A tenant with an active Polar
 * subscription gets its MAU reported; a per-tenant report failure is logged
 * and counted, letting the run continue for the remaining tenants.
 *
 * @param controller - Cloudflare scheduled controller with cron metadata
 * @returns A promise that resolves when the reporting run completes.
 * @throws Propagates any error from the MAU query or D1 lookup; per-tenant
 * Polar report failures are caught and logged instead.
 * @example
 * // Wired from the worker's scheduled handler:
 * if (controller.cron === "0 1 * * *") await reportMAU(controller);
 */
export async function reportMAU(controller: ScheduledController): Promise<void> {
	let logger = new Logger();
	let polar = new PolarClient({ accessToken: env.POLAR_ACCESS_TOKEN });
	let month = AnalyticsService.getCurrentMonth();

	logger.info("MAU reporting job started", {
		month,
		cron: controller.cron,
	});

	try {
		let mauResults = await AnalyticsService.queryAllTenantsMAU(month);

		if (mauResults.length === 0) {
			logger.info("No MAU data to report", { month });
			return;
		}

		logger.info("Fetched MAU data", {
			month,
			tenant_count: mauResults.length,
		});

		let tenantIds = mauResults.map((r) => r.tenant_id);
		let placeholders = tenantIds.map(() => "?").join(", ");

		let subscriptions = await env.PLATFORM_DB.prepare(
			`SELECT tenant_id, polar_customer_id FROM subscriptions WHERE tenant_id IN (${placeholders})`,
		)
			.bind(...tenantIds)
			.all<SubscriptionRow>();

		let customerMap = new Map<string, string>();
		for (let sub of subscriptions.results) {
			if (sub.polar_customer_id) {
				customerMap.set(sub.tenant_id, sub.polar_customer_id);
			}
		}

		let reported = 0;
		let skipped = 0;
		let failed = 0;

		for (let { tenant_id, mau } of mauResults) {
			let polarCustomerId = customerMap.get(tenant_id);

			if (!polarCustomerId) {
				skipped++;
				continue;
			}

			try {
				await polar.reportMAU(polarCustomerId, mau, tenant_id, month);
				reported++;
			} catch (error) {
				failed++;
				logger.error("Failed to report MAU to Polar", {
					tenant_id,
					polar_customer_id: polarCustomerId,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		logger.info("MAU reporting completed", {
			month,
			reported,
			skipped,
			failed,
		});
	} catch (error) {
		logger.error("MAU reporting job failed", {
			month,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}
