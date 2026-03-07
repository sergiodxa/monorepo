---
title: How to Report Usage-Based Metrics with Polar and Analytics Engine
excerpt: Track Monthly Active Users with Analytics Engine and report to Polar for billing.
tech: "@polar-sh/sdk@1.0.0" "@cloudflare/workers-types@4.0.0"
---

Usage-based billing requires two things: a reliable way to track metrics and a billing provider that can ingest them. If you're running a SaaS on Cloudflare Workers, you already have access to Analytics Engine for high-volume metrics tracking. Combine that with Polar's events API, and you can build a complete MAU billing system without managing any additional infrastructure.

The flow works like this: your application writes events to Analytics Engine on every authentication. A scheduled worker runs daily to query MAU counts per tenant, then reports those counts to Polar. Polar uses the data to calculate usage charges at the end of each billing cycle.

## Configure Analytics Engine

Add the Analytics Engine binding to your `wrangler.jsonc`:

```json {% path="wrangler.jsonc" %}
{
	"analytics_engine_datasets": [
		{
			"binding": "ANALYTICS",
			"dataset": "auth-saas-analytics"
		}
	]
}
```

The `binding` is how you access it in code (`env.ANALYTICS`), and the `dataset` is the table name you'll use in SQL queries. You also need environment variables for querying:

```json {% path="wrangler.jsonc" %}
{
	"vars": {
		"CF_ACCOUNT_ID": "your-account-id"
	}
}
```

Add `CF_API_TOKEN` as a secret using `wrangler secret put CF_API_TOKEN`. This token needs Analytics read permissions to query the data.

## Track Authentication Events

Analytics Engine uses a specific data model: `blobs` for strings, `doubles` for numbers, and `indexes` for filterable values. Design your schema carefully since you'll query against these positions later.

```ts {% path="app/services/analytics.ts" %}
import { env } from "cloudflare:workers";

export default class AnalyticsService {
	/**
	 * Track an authentication event for MAU counting.
	 * Called on successful login or token refresh.
	 */
	static trackAuthentication(tenantId: string, subjectId: string): void {
		let month = new Date().toISOString().slice(0, 7); // YYYY-MM

		// Write MAU event for unique user counting
		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, "mau", subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});

		// Also track raw authentication events
		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, "authentication", subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});
	}

	/**
	 * Track user registration.
	 */
	static trackRegistration(tenantId: string, subjectId: string): void {
		let month = new Date().toISOString().slice(0, 7);

		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, "registration", subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});
	}
}
```

The data model here is:

- `blob1`: tenant ID (the customer you're billing)
- `blob2`: event type (mau, authentication, registration)
- `blob3`: subject ID (the user performing the action)
- `blob4`: month in YYYY-MM format
- `double1`: count (always 1 for individual events)
- `index1`: tenant ID (for efficient filtering)

Writing `subjectId` in `blob3` is crucial. When you query MAU, you'll count distinct values of `blob3`, giving you unique users per tenant per month.

## Call Tracking on Authentication

Wire up the tracking in your authentication flow. Call it after successful login:

```ts {% path="app/controllers/auth.ts" %}
import AnalyticsService from "~/app/services/analytics";

export async function handleAuthentication(tenantId: string, userId: string) {
	// ... perform authentication logic ...

	// Track for MAU billing (non-blocking)
	AnalyticsService.trackAuthentication(tenantId, userId);

	// ... return tokens/session ...
}
```

The `writeDataPoint` call is synchronous and non-blocking. It queues the data for ingestion without waiting for confirmation, so it won't slow down your authentication response.

## Query MAU from Analytics Engine

The Analytics Engine binding only supports writing. To read data, you need to call the Cloudflare Analytics SQL API directly:

```ts {% path="app/services/analytics.ts" %}
import { env } from "cloudflare:workers";

interface MAUResult {
	tenant_id: string;
	mau: number;
}

export default class AnalyticsService {
	// ... previous methods ...

	/**
	 * Query MAU for all tenants for a specific month.
	 * Returns tenant IDs with their unique user counts.
	 */
	static async queryAllTenantsMAU(month: string): Promise<MAUResult[]> {
		let query = `
      SELECT
        blob1 AS tenant_id,
        COUNT(DISTINCT blob3) AS mau
      FROM auth-saas-analytics
      WHERE
        blob2 = 'mau'
        AND blob4 = '${month}'
      GROUP BY blob1
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
			throw new Error(`Analytics Engine query failed: ${error}`);
		}

		let result = (await response.json()) as { data: MAUResult[] };
		return result.data;
	}

	/**
	 * Query MAU for a single tenant.
	 */
	static async queryMAU(tenantId: string, month: string): Promise<number> {
		let query = `
      SELECT COUNT(DISTINCT blob3) AS mau
      FROM auth-saas-analytics
      WHERE
        blob1 = '${tenantId}'
        AND blob2 = 'mau'
        AND blob4 = '${month}'
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
			throw new Error(`Analytics Engine query failed: ${error}`);
		}

		let result = (await response.json()) as { data: Array<{ mau: number }> };
		return result.data[0]?.mau ?? 0;
	}

	static getCurrentMonth(): string {
		return new Date().toISOString().slice(0, 7);
	}
}
```

The query uses `COUNT(DISTINCT blob3)` to count unique users. This is the core of MAU calculation: no matter how many times a user authenticates in a month, they count as one active user.

## Set Up the Polar SDK

Install the Polar SDK and create a service wrapper:

```bash
bun add @polar-sh/sdk
```

```ts {% path="app/services/polar.ts" %}
import { Polar } from "@polar-sh/sdk";
import { env } from "cloudflare:workers";

export default class PolarService {
	static get client() {
		return new Polar({ accessToken: env.POLAR_ACCESS_TOKEN });
	}

	/**
	 * Ingest usage events for billing.
	 * Events are accumulated and charged at the end of the billing cycle.
	 */
	static async ingestEvents(
		events: Array<{
			customerId: string;
			name: string;
			metadata?: Record<string, string | number | boolean>;
			timestamp?: Date;
		}>,
	): Promise<void> {
		await PolarService.client.events.ingest({
			events: events.map((event) => ({
				customerId: event.customerId,
				name: event.name,
				metadata: event.metadata,
				timestamp: event.timestamp,
			})),
		});
	}

	/**
	 * Report MAU count for a tenant.
	 * Called daily by the scheduled reporting job.
	 */
	static async reportMAU(
		polarCustomerId: string,
		mauCount: number,
		tenantId: string,
		month: string,
	): Promise<void> {
		await PolarService.ingestEvents([
			{
				customerId: polarCustomerId,
				name: "mau",
				metadata: {
					tenant_id: tenantId,
					month,
					count: mauCount,
				},
			},
		]);
	}
}
```

Add `POLAR_ACCESS_TOKEN` as a secret: `wrangler secret put POLAR_ACCESS_TOKEN`. You can get this token from your Polar dashboard under Settings > API Keys.

## Create the Scheduled Reporting Job

The reporting job runs daily via a cron trigger. It queries all tenant MAU counts, looks up their Polar customer IDs, and reports the metrics:

```ts {% path="app/jobs/report-mau.ts" %}
import { Logger } from "@pkg/logger";
import { env } from "cloudflare:workers";
import AnalyticsService from "../services/analytics";
import PolarService from "../services/polar";

interface SubscriptionRow {
	tenant_id: string;
	polar_customer_id: string | null;
}

export async function reportMAU(controller: ScheduledController): Promise<void> {
	let logger = new Logger();
	let month = AnalyticsService.getCurrentMonth();

	logger.info("MAU reporting job started", {
		month,
		cron: controller.cron,
	});

	try {
		// 1. Query all tenant MAU counts from Analytics Engine
		let mauResults = await AnalyticsService.queryAllTenantsMAU(month);

		if (mauResults.length === 0) {
			logger.info("No MAU data to report", { month });
			return;
		}

		logger.info("Fetched MAU data", {
			month,
			tenant_count: mauResults.length,
		});

		// 2. Look up Polar customer IDs for each tenant
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

		// 3. Report MAU to Polar for each tenant
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
```

The job handles failures gracefully. If one tenant's report fails, it logs the error and continues with other tenants. The final log includes counts of successful, skipped, and failed reports.

## Configure the Cron Trigger

Add the cron trigger to your `wrangler.jsonc`:

```json {% path="wrangler.jsonc" %}
{
	"triggers": {
		"crons": ["0 1 * * *"]
	}
}
```

This runs the job daily at 1:00 AM UTC. Wire it up in your worker:

```ts {% path="entry.worker.ts" %}
import { reportMAU } from "./app/jobs/report-mau";

export default {
	async fetch(request: Request) {
		// ... handle HTTP requests ...
	},

	async scheduled(controller: ScheduledController) {
		await reportMAU(controller);
	},
};
```

## Display Usage in Your Dashboard

You can also show current usage to customers in their billing dashboard by querying Analytics Engine directly:

```ts {% path="app/controllers/billing.ts" %}
import AnalyticsService from "~/app/services/analytics";

export async function getBillingData(tenantId: string) {
	let month = AnalyticsService.getCurrentMonth();
	let mau = await AnalyticsService.queryMAU(tenantId, month);

	return {
		month,
		mau,
		// Include pricing tiers, estimates, etc.
	};
}
```

## Handle Edge Cases

A few things to consider for production use:

**Validation**: Always validate input before constructing SQL queries. The example above uses string interpolation, so you should validate that `month` matches YYYY-MM format and that tenant IDs are valid UUIDs to prevent SQL injection.

**Idempotency**: Polar's events API handles duplicate events by deduplicating based on customer ID, event name, and timestamp. Since you're reporting daily with month granularity, sending the same report twice won't double-charge customers.

**Timezone handling**: The `getCurrentMonth()` function uses UTC. Make sure your billing cycle also uses UTC, or adjust accordingly.

**Sampling**: Analytics Engine samples data at very high volumes. For billing, you likely want exact counts. The MAU use case works because you're counting distinct users, not summing event counts. If you need exact sums, consider using a traditional database.

## Final Thoughts

This architecture separates concerns cleanly. Analytics Engine handles the high-volume event ingestion that would overwhelm a traditional database. The daily job aggregates and reports only what's needed for billing. Polar handles the payment processing and invoicing.

The same pattern works for any usage metric: API calls, storage bytes, compute time. Write events to Analytics Engine with the appropriate dimensions, query and aggregate in your scheduled job, and report to Polar. Your application stays responsive because event tracking is non-blocking, and your billing stays accurate because you're using purpose-built tools for each part of the pipeline.
