---
title: How to Report Usage-Based Metrics with Polar and Analytics Engine
excerpt: Track monthly active users in Analytics Engine and report them to Polar for usage-based billing.
tech: "@polar-sh/sdk@1.0.0" "@cloudflare/workers-types@4.0.0"
---

Usage based billing needs a meter and a billing system. If your app already runs on Cloudflare Workers, Analytics Engine can store high volume usage events, and Polar can turn those totals into billable usage.

In this tutorial, you will record authentication events, aggregate monthly active users per tenant, and send that usage to Polar from a daily cron job. The result is a practical MAU billing pipeline you can adapt for API calls, storage, or any other metered feature.

## Configure the Worker

```json {% path="wrangler.jsonc" %}
{
	"analytics_engine_datasets": [
		{
			"binding": "ANALYTICS",
			"dataset": "auth_saas_analytics"
		}
	],
	"vars": {
		"CF_ACCOUNT_ID": "your-account-id"
	}
}
```

This creates the `env.ANALYTICS` binding and gives the worker the Cloudflare account ID needed for SQL queries. Add `CF_API_TOKEN` and `POLAR_ACCESS_TOKEN` as secrets with `bunx wrangler secret put`.

## Record Authentication Events

```ts {% path="app/services/analytics.ts" %}
import { env } from "cloudflare:workers";

export interface MonthlyActiveUserRow {
	tenant_id: string;
	mau: number;
}

export default class AnalyticsService {
	static trackAuthentication(tenantId: string, subjectId: string): void {
		let month = new Date().toISOString().slice(0, 7);

		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, "mau", subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});
	}

	static getCurrentMonth(): string {
		return new Date().toISOString().slice(0, 7);
	}
}
```

Store the tenant ID, event type, user ID, and month in fixed positions. The important field is `blob3`, because later you will count distinct users from that column.

## Call the Tracker After Login

```ts {% path="app/routes/login.tsx" %}
import AnalyticsService from "../services/analytics";

export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let tenantId = String(formData.get("tenantId"));
	let userId = String(formData.get("userId"));

	// ... authenticate the user and create the session ...

	AnalyticsService.trackAuthentication(tenantId, userId);

	return Response.json({ ok: true });
}
```

Call the tracker after a successful authentication event. `writeDataPoint` is non blocking, so it does not add a round trip to your login flow.

## Query Monthly Active Users

```ts {% path="app/services/analytics.ts" %}
import { env } from "cloudflare:workers";

export interface MonthlyActiveUserRow {
	tenant_id: string;
	mau: number;
}

export default class AnalyticsService {
	static trackAuthentication(tenantId: string, subjectId: string): void {
		let month = new Date().toISOString().slice(0, 7);

		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, "mau", subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});
	}

	static async queryAllTenantsMAU(month: string): Promise<MonthlyActiveUserRow[]> {
		let query = `
			SELECT
				blob1 AS tenant_id,
				COUNT(DISTINCT blob3) AS mau
			FROM auth_saas_analytics
			WHERE blob2 = 'mau' AND blob4 = '${month}'
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

		let result = (await response.json()) as { data: MonthlyActiveUserRow[] };
		return result.data;
	}

	static async queryTenantMAU(tenantId: string, month: string): Promise<number> {
		let query = `
			SELECT COUNT(DISTINCT blob3) AS mau
			FROM auth_saas_analytics
			WHERE blob1 = '${tenantId}' AND blob2 = 'mau' AND blob4 = '${month}'
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

		let result = (await response.json()) as { data: Array<{ mau: number }> };
		return result.data[0]?.mau ?? 0;
	}

	static getCurrentMonth(): string {
		return new Date().toISOString().slice(0, 7);
	}
}
```

Analytics Engine writes through the binding, but reads happen through the SQL API. `COUNT(DISTINCT blob3)` gives you one active user per tenant for the month, even if that user logged in many times.

## Add the Polar Client

```json {% path="package.json" %}
{
	"dependencies": {
		"@polar-sh/sdk": "1.0.0"
	}
}
```

```ts {% path="app/services/polar.ts" %}
import { Polar } from "@polar-sh/sdk";
import { env } from "cloudflare:workers";

export default class PolarService {
	static get client() {
		return new Polar({ accessToken: env.POLAR_ACCESS_TOKEN });
	}

	static async reportMAU(
		polarCustomerId: string,
		mauCount: number,
		tenantId: string,
		month: string,
	): Promise<void> {
		await PolarService.client.events.ingest({
			events: [
				{
					customerId: polarCustomerId,
					name: "mau",
					metadata: {
						tenant_id: tenantId,
						month,
						count: mauCount,
					},
				},
			],
		});
	}
}
```

This wrapper keeps the reporting call small and predictable. The event metadata carries the tenant and month that produced the billed total.

## Report Usage Every Day

```ts {% path="app/jobs/report-mau.ts" %}
import { env } from "cloudflare:workers";
import AnalyticsService from "../services/analytics";
import PolarService from "../services/polar";

interface SubscriptionRow {
	tenant_id: string;
	polar_customer_id: string | null;
}

export async function reportMAU(): Promise<void> {
	let month = AnalyticsService.getCurrentMonth();
	let usage = await AnalyticsService.queryAllTenantsMAU(month);

	if (usage.length === 0) return;

	let tenantIds = usage.map((row) => row.tenant_id);
	let placeholders = tenantIds.map(() => "?").join(", ");
	let subscriptions = await env.PLATFORM_DB.prepare(
		`SELECT tenant_id, polar_customer_id FROM subscriptions WHERE tenant_id IN (${placeholders})`,
	)
		.bind(...tenantIds)
		.all<SubscriptionRow>();

	let customers = new Map<string, string>();
	for (let subscription of subscriptions.results) {
		if (subscription.polar_customer_id) {
			customers.set(subscription.tenant_id, subscription.polar_customer_id);
		}
	}

	for (let row of usage) {
		let polarCustomerId = customers.get(row.tenant_id);
		if (!polarCustomerId) continue;

		await PolarService.reportMAU(polarCustomerId, row.mau, row.tenant_id, month);
	}
}
```

This job assumes your `subscriptions` table stores the Polar customer ID for each tenant. It reads the monthly totals from Analytics Engine, maps tenants to Polar customers, and ingests one usage event per tenant.

## Schedule the Job

```json {% path="wrangler.jsonc" %}
{
	"analytics_engine_datasets": [
		{
			"binding": "ANALYTICS",
			"dataset": "auth_saas_analytics"
		}
	],
	"vars": {
		"CF_ACCOUNT_ID": "your-account-id"
	},
	"triggers": {
		"crons": ["0 1 * * *"]
	}
}
```

```ts {% path="entry.worker.ts" %}
import { reportMAU } from "./app/jobs/report-mau";

export default {
	async fetch(_request: Request) {
		return new Response("ok");
	},

	async scheduled() {
		await reportMAU();
	},
};
```

The cron runs once a day and reports the current month total. Daily reporting keeps the implementation simple while giving Polar up to date usage before invoicing.

## Show Current Usage in the Billing Route Module

```ts {% path="app/routes/settings.billing.tsx" %}
import AnalyticsService from "../services/analytics";

export async function loader() {
	let tenantId = "tenant_123";
	let month = AnalyticsService.getCurrentMonth();
	let mau = await AnalyticsService.queryTenantMAU(tenantId, month);

	return Response.json({ month, mau });
}
```

This loader gives your billing screen the same MAU number you report to Polar. If `tenantId` comes from user controlled input, validate it before building the Analytics SQL query.

## Final Thoughts

This flow keeps the application path simple. The app records events during authentication, the cron aggregates monthly usage, and Polar receives one billing event per tenant.

You can extend the same pattern to other metrics by changing the event name and the aggregation query. The trade off is that you need a scheduled job and a stable event schema, but you avoid building your own billing meter from scratch.
