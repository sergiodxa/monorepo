---
title: How to Build a Multi-Handler Cloudflare Worker
excerpt: Combine HTTP, scheduled, and queue handlers in a single Cloudflare Worker for a complete backend.
tech: @cloudflare/workers-types@4.0.0
---

A single Cloudflare Worker can do more than respond to HTTP requests. It can run scheduled tasks on cron, process background jobs through queues, and serve your web application, all from the same codebase. This keeps your infrastructure simple: one Worker, one deployment, one place to manage your backend logic.

The pattern works well for services that need periodic maintenance tasks alongside their main functionality. Think of an e-commerce backend that serves product pages, sends order confirmation emails in the background, and runs nightly inventory reports. Instead of deploying three separate Workers, you combine them into one.

## Define the Worker Export Structure

```ts {% path="worker.ts" %}
export default {
	async fetch(request) {
		// Handle HTTP requests
	},

	async scheduled(controller) {
		// Handle cron triggers
	},

	async queue(batch) {
		// Handle queue messages
	},
} satisfies ExportedHandler<Cloudflare.Env>;
```

The `ExportedHandler` type from Cloudflare ensures type safety across all handlers. You can [generate these environment types automatically with wrangler](/tutorials/generate-cloudflare-environment-type-with-wrangler). Each handler receives different arguments: `fetch` gets the incoming `Request`, `scheduled` gets a controller with cron information, and `queue` gets a batch of messages.

## Handle HTTP Requests

```ts {% path="worker.ts" %}
export default {
	async fetch(request, env) {
		let url = new URL(request.url);

		if (url.pathname === "/health") {
			return new Response("OK", { status: 200 });
		}

		if (url.pathname === "/api/orders" && request.method === "POST") {
			let order = await request.json();
			// Save order to database...
			await env.QUEUE.send({ type: "sendEmail", orderId: order.id });
			return Response.json({ success: true, orderId: order.id });
		}

		return new Response("Not Found", { status: 404 });
	},
	// ...
} satisfies ExportedHandler<Cloudflare.Env>;
```

The `fetch` handler processes all incoming HTTP requests. You can route requests manually like this, use a framework like Hono, or integrate with React Router. The handler can also enqueue background work, as shown with the order confirmation email.

## Route Scheduled Tasks by Cron Expression

```ts {% path="worker.ts" %}
import { waitUntil } from "cloudflare:workers";

export default {
	// ...
	async scheduled(controller, env) {
		// Every hour: generate reports
		if (controller.cron === "0 * * * *") {
			waitUntil(env.QUEUE.send({ type: "generateReport", report: "hourly-sales" }));
		}

		// Every day at midnight: cleanup old data
		if (controller.cron === "0 0 * * *") {
			waitUntil(env.QUEUE.send({ type: "dailyCleanup" }));
			waitUntil(env.QUEUE.send({ type: "generateReport", report: "daily-summary" }));
		}

		// Every Monday at 9 AM: send weekly digest
		if (controller.cron === "0 9 * * 1") {
			waitUntil(env.QUEUE.send({ type: "sendWeeklyDigest" }));
		}
	},
	// ...
} satisfies ExportedHandler<Cloudflare.Env>;
```

The `scheduled` handler receives a controller with the `cron` property matching the expression that triggered it. By checking `controller.cron`, you can run different logic for different schedules. The `waitUntil` function ensures the Worker stays alive until the background work completes [without blocking the response](/tutorials/use-waituntil-for-non-blocking-cache-writes).

Notice how the scheduled handler delegates work to the queue. This pattern keeps cron handlers lightweight: they dispatch messages, while the queue handler does the heavy lifting.

## Process Queue Messages with Type Validation

```ts {% path="worker.ts" %}
import { waitUntil } from "cloudflare:workers";

export default {
	// ...
	async queue(batch, env) {
		let { z } = await import("zod/v4");

		for (let message of batch.messages) {
			let result = z
				.discriminatedUnion("type", [
					z.object({ type: z.literal("sendEmail"), orderId: z.string() }),
					z.object({ type: z.literal("processOrder"), orderId: z.string() }),
					z.object({ type: z.literal("generateReport"), report: z.string() }),
					z.object({ type: z.literal("dailyCleanup") }),
					z.object({ type: z.literal("sendWeeklyDigest") }),
				])
				.safeParse(message.body);

			if (!result.success) {
				console.error("Invalid message", result.error, message.body);
				message.ack();
				continue;
			}

			let data = result.data;

			if (data.type === "sendEmail") {
				let { sendOrderConfirmation } = await import("./jobs/email");
				waitUntil(sendOrderConfirmation(data.orderId, env));
			}

			if (data.type === "processOrder") {
				let { processOrder } = await import("./jobs/orders");
				waitUntil(processOrder(data.orderId, env));
			}

			if (data.type === "generateReport") {
				let { generateReport } = await import("./jobs/reports");
				waitUntil(generateReport(data.report, env));
			}

			if (data.type === "dailyCleanup") {
				let { cleanup } = await import("./jobs/maintenance");
				waitUntil(cleanup(env));
			}

			if (data.type === "sendWeeklyDigest") {
				let { sendDigest } = await import("./jobs/digest");
				waitUntil(sendDigest(env));
			}

			message.ack();
		}
	},
} satisfies ExportedHandler<Cloudflare.Env>;
```

The `queue` handler processes batches of messages. Using Zod's `discriminatedUnion`, you [validate and type each message](/tutorials/build-a-type-safe-queue-job-system-with-zod) before routing it to the appropriate job handler. Invalid messages are logged and acknowledged to prevent them from being retried indefinitely.

Each job is dynamically imported to keep the initial bundle small. The `waitUntil` function ensures all jobs complete before the Worker terminates.

## Export Durable Objects and Workflows

```ts {% path="worker.ts" %}
import { RateLimiter } from "./do/rate-limiter";
import { OrderWorkflow } from "./workflows/order";

export { RateLimiter, OrderWorkflow };

export default {
	// handlers...
} satisfies ExportedHandler<Cloudflare.Env>;
```

If your Worker uses Durable Objects or Workflows, export them from the same entry file. Cloudflare requires these exports to be at the module level alongside the default export.

## Configure Cron Triggers in wrangler.toml

```txt {% path="wrangler.toml" %}
[triggers]
crons = [
  "0 * * * *",
  "0 0 * * *",
  "0 9 * * 1"
]
```

Define all your cron expressions in `wrangler.toml`. Each expression triggers the `scheduled` handler, which then routes based on `controller.cron`.

## Final Thoughts

This multi-handler pattern lets you build complete backend systems in a single Worker. HTTP requests serve your web application, cron triggers run periodic maintenance, and queues handle background processing. The key is keeping each handler focused: cron handlers dispatch work, queue handlers process it, and HTTP handlers serve users. This separation makes the code easier to test and maintain as your application grows.
