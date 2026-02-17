---
title: How to Build a Type-Safe Queue Job System with Zod
excerpt: Use Zod discriminated unions to validate and route queue messages with full type safety.
tech: zod@4.0.0 @cloudflare/workers-types@4.0.0
---

A single queue handler receives messages for cleanup jobs, notification jobs, and statistics aggregation. Each message type has different fields and triggers different logic. Without validation, a malformed message crashes your handler or silently routes to the wrong job.

Zod's discriminated unions solve this by validating the message structure and narrowing the type based on a discriminator field. You get compile-time safety and runtime validation in one step: TypeScript knows exactly which fields exist after validation, and invalid messages are rejected before they reach your [job handlers](/tutorials/build-a-job-framework-for-cloudflare-queues).

## Define the Queue Message Schema

Create a schema that defines all possible message types using `z.discriminatedUnion`. Each variant has a `type` field that acts as the discriminator:

```ts {% path="app/jobs/schema.ts" %}
import { z } from "zod/v4";

export const QueueMessageSchema = z
	.discriminatedUnion("type", [
		z.object({ type: z.literal("ping") }),
		z.object({ type: z.literal("clean") }),
		z.object({ type: z.literal("cleanCronJobPings") }),
		z.object({ type: z.literal("enqueuePendingDomains") }),
		z.object({ type: z.literal("verifyDomainOwnership") }),
		z.object({ type: z.literal("checkSsl") }),
		z.object({ type: z.literal("checkDns") }),
		z.object({ type: z.literal("checkTcp") }),
		z.object({ type: z.literal("checkCronJobs") }),
		z.object({ type: z.literal("aggregateDailyStats") }),
	])
	.transform((data) => data.type);
```

The `z.discriminatedUnion` function takes a discriminator key (`"type"`) and an array of object schemas. Each schema must have that key as a literal. The `.transform()` at the end extracts just the type string, making it easier to use in switch statements or conditionals. This validation returns a [Result-like object](/articles/result-objects-in-ts) where you check `success` before accessing the data.

## Validate Messages in the Queue Handler

Use `safeParse` to validate incoming messages. This returns a result object with either the parsed data or validation errors:

```ts {% path="app/entry.worker.ts" %}
import { z } from "zod/v4";
import { env, waitUntil } from "cloudflare:workers";

export default {
	async queue(batch) {
		for (let message of batch.messages) {
			let result = z
				.discriminatedUnion("type", [
					z.object({ type: z.literal("ping") }),
					z.object({ type: z.literal("clean") }),
					z.object({ type: z.literal("cleanCronJobPings") }),
					z.object({ type: z.literal("enqueuePendingDomains") }),
					z.object({ type: z.literal("verifyDomainOwnership") }),
					z.object({ type: z.literal("checkSsl") }),
					z.object({ type: z.literal("checkDns") }),
					z.object({ type: z.literal("checkTcp") }),
					z.object({ type: z.literal("checkCronJobs") }),
					z.object({ type: z.literal("aggregateDailyStats") }),
				])
				.transform((data) => data.type)
				.safeParse(message.body);

			if (result.success === false) {
				console.error("Invalid message received in queue", {
					error: result.error,
					message: message.body,
				});
				message.ack();
				continue;
			}

			// result.data is now typed as the union of all type literals
		}
	},
} satisfies ExportedHandler<Cloudflare.Env>;
```

When validation fails, log the error with the original message body for debugging, then acknowledge the message to prevent it from being retried. Invalid messages should not block the queue. This is an example of [classifying errors as non-retriable](/tutorials/classify-errors-for-job-retry-behavior): validation failures will never succeed on retry.

## Route Messages to Job Handlers

After validation, `result.data` contains the message type as a string literal union. Use conditionals to route each type to its handler:

```ts {% path="app/entry.worker.ts" %}
if (result.data === "ping") {
	let { PingJob } = await import("./jobs/ping");
	waitUntil(PingJob.run({ message }));
}

if (result.data === "clean") {
	let { CleanJob } = await import("./jobs/clean");
	waitUntil(CleanJob.run({ message, uptime }));
}

if (result.data === "cleanCronJobPings") {
	let { CleanCronJobPingsJob } = await import("./jobs/clean-cron-job-pings");
	waitUntil(CleanCronJobPingsJob.run({ message, uptime }));
}

if (result.data === "checkSsl") {
	let { CheckSslJob } = await import("./jobs/check-ssl");
	waitUntil(CheckSslJob.run({ message, uptime }));
}

if (result.data === "checkDns") {
	let { CheckDnsJob } = await import("./jobs/check-dns");
	waitUntil(CheckDnsJob.run({ message, uptime }));
}

if (result.data === "checkTcp") {
	let { CheckTcpJob } = await import("./jobs/check-tcp");
	waitUntil(CheckTcpJob.run({ message, uptime }));
}

if (result.data === "checkCronJobs") {
	let { CheckCronJobsJob } = await import("./jobs/check-cron-jobs");
	waitUntil(CheckCronJobsJob.run({ message, uptime }));
}

if (result.data === "aggregateDailyStats") {
	let { AggregateDailyStatsJob } = await import("./jobs/aggregate-daily-stats");
	waitUntil(AggregateDailyStatsJob.run({ message, uptime }));
}
```

Dynamic imports keep the initial bundle small by only loading job code when needed. The `waitUntil` function from `cloudflare:workers` ensures the job runs to completion [even after the response is sent](/tutorials/use-waituntil-for-non-blocking-cache-writes).

## Send Type-Safe Messages to the Queue

When sending messages to the queue, TypeScript ensures you only send valid message types:

```ts {% path="app/entry.worker.ts" %}
import { env, waitUntil } from "cloudflare:workers";

export default {
	async scheduled(controller) {
		// Every minute
		if (controller.cron === "* * * * *") {
			waitUntil(env.QUEUE.send({ type: "checkCronJobs" }));
		}

		// Every 10 minutes
		if (controller.cron === "*/10 * * * *") {
			waitUntil(env.QUEUE.send({ type: "enqueuePendingDomains" }));
		}

		// Every day at midnight
		if (controller.cron === "0 0 * * *") {
			waitUntil(env.QUEUE.send({ type: "clean" }));
			waitUntil(env.QUEUE.send({ type: "cleanCronJobPings" }));
		}

		// Every day at 6 AM UTC
		if (controller.cron === "0 6 * * *") {
			waitUntil(env.QUEUE.send({ type: "checkSsl" }));
		}

		// Every hour
		if (controller.cron === "0 * * * *") {
			waitUntil(env.QUEUE.send({ type: "checkDns" }));
		}

		// Every 5 minutes
		if (controller.cron === "*/5 * * * *") {
			waitUntil(env.QUEUE.send({ type: "checkTcp" }));
		}

		// Every day at 1 AM UTC
		if (controller.cron === "0 1 * * *") {
			waitUntil(env.QUEUE.send({ type: "aggregateDailyStats" }));
		}
	},
} satisfies ExportedHandler<Cloudflare.Env>;
```

The `scheduled` handler uses cron expressions to trigger different jobs at different intervals. Each `env.QUEUE.send()` call enqueues a message that will be processed by the `queue` handler.

## Add Payload Data to Message Types

For messages that need additional data, extend the schema with more fields:

```ts {% path="app/jobs/schema.ts" %}
import { z } from "zod/v4";

export const QueueMessageSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("ping") }),
	z.object({ type: z.literal("clean") }),
	z.object({
		type: z.literal("sendNotification"),
		userId: z.string(),
		channel: z.enum(["email", "sms", "push"]),
	}),
	z.object({
		type: z.literal("processUpload"),
		fileId: z.string(),
		bucket: z.string(),
	}),
]);

export type QueueMessage = z.infer<typeof QueueMessageSchema>;
```

Now you can send messages with payloads and access them in a type safe way:

```ts {% path="app/entry.worker.ts" %}
// Sending a message with payload
await env.QUEUE.send({
	type: "sendNotification",
	userId: "user_123",
	channel: "email",
});

// In the queue handler, after validation
if (result.data.type === "sendNotification") {
	let { NotificationJob } = await import("./jobs/notification");
	waitUntil(
		NotificationJob.run({
			message,
			userId: result.data.userId,
			channel: result.data.channel,
		}),
	);
}
```

The discriminated union ensures that when you check `result.data.type === "sendNotification"`, TypeScript knows `userId` and `channel` exist on `result.data`.

## Final Thoughts

Zod discriminated unions provide a clean pattern for building type safe queue systems. You get runtime validation to catch malformed messages, compile time safety to prevent sending invalid message types, and automatic type narrowing when routing messages to handlers. This pattern scales well as you add more job types, since each new type is just another variant in the union.

Combine this validation approach with a [job framework](/tutorials/build-a-job-framework-for-cloudflare-queues) to handle the actual job execution, and add [error classification](/tutorials/classify-errors-for-job-retry-behavior) to control retry behavior for different failure types.
