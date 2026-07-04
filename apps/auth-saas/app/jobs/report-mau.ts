import { Logger } from "@pkg/logger";
import { env } from "cloudflare:workers";

import AnalyticsService from "~/app/services/analytics";
import PolarService from "~/app/services/polar";

/** Database row for subscription data with Polar customer ID. */
interface SubscriptionRow {
	/** Tenant identifier. */
	tenant_id: string;
	/** Polar customer ID for billing, null if not subscribed. */
	polar_customer_id: string | null;
}

/**
 * Daily scheduled job to report Monthly Active Users (MAU) to Polar for usage-based billing.
 *
 * This job runs daily at 1:00 AM UTC via cron trigger and:
 * 1. Queries Analytics Engine for MAU counts per tenant
 * 2. Fetches subscription data from D1 to get Polar customer IDs
 * 3. Reports MAU to Polar meters API for each tenant with an active subscription
 *
 * Tenants without Polar subscriptions are skipped. Failed reports are logged but
 * do not prevent other tenants from being processed.
 *
 * @param controller - Cloudflare scheduled controller with cron metadata
 */
export async function reportMAU(controller: ScheduledController): Promise<void> {
	let logger = new Logger();
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
				await PolarService.reportMAU(polarCustomerId, mau, tenant_id, month);
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
