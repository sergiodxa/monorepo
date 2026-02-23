---
title: How to Use Cloudflare Workflows for Long-Running Tasks
excerpt: Build reliable background jobs with automatic retries and timeouts using Cloudflare Workflows.
tech: @cloudflare/workers-types@4.0.0
---

An uptime monitoring service needs to ping a URL, check the response, run content validations, write analytics, and send alerts. If the analytics write fails, you don't want to re-ping the URL or re-run validations. You want to retry just that one step.

Cloudflare Workflows provide durable execution for exactly this scenario. Each step is automatically persisted, so failures trigger retries for that specific step without losing progress. This makes workflows ideal for multi-step operations like sending notifications, processing data pipelines, or coordinating API calls across services.

## Create a Workflow Class

Start by creating a class that extends `WorkflowEntrypoint`. This is the foundation of your workflow:

```ts {% path="app/workflows/monitor.ts" %}
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";

export namespace Ping {
	export interface WorkflowParams {
		monitorId: string;
	}
}

export class Ping extends WorkflowEntrypoint<Cloudflare.Env> {
	override async run(event: WorkflowEvent<Ping.WorkflowParams>, step: WorkflowStep) {
		let { monitorId } = event.payload;
		let instanceId = event.instanceId;

		// Workflow logic goes here
	}
}
```

The `WorkflowEntrypoint` class provides the `run` method that receives two arguments: an `event` containing your workflow parameters and instance ID, and a `step` object for defining individual workflow steps. The generic type parameter `Cloudflare.Env` gives you access to your environment bindings.

## Define Workflow Steps with `step.do()`

Each discrete operation in your workflow should be wrapped in `step.do()`. This ensures the step is durable and can be retried independently:

```ts {% path="app/workflows/monitor.ts" %}
let monitor = await step.do("find monitor by id", async () => {
	let result = await db.query.monitors.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, monitorId);
		},
		columns: {
			id: true,
			name: true,
			url: true,
			method: true,
			expectedStatus: true,
			timeoutSeconds: true,
		},
	});
	return result;
});

if (!monitor) {
	// Monitor was deleted before workflow could run
	return;
}
```

The first argument to `step.do()` is a descriptive name for the step. This name appears in logs and the Cloudflare dashboard, making it easier to debug workflow executions. The second argument is an async function that performs the actual work. Whatever you return from this function is persisted and available for subsequent steps.

## Configure Retries and Timeouts

For steps that might fail due to network issues or external service problems, configure automatic retries:

```ts {% path="app/workflows/monitor.ts" %}
let result = await step.do(
	"ping monitor",
	{
		retries: {
			limit: 3,
			delay: 1000,
			backoff: "exponential",
		},
		timeout: monitor.timeoutSeconds * 1000,
	},
	async () => {
		let response = await fetch(monitor.url, {
			method: monitor.method,
			signal: AbortSignal.timeout(monitor.timeoutSeconds * 1000),
		});

		return {
			responseStatus: response.status,
			responseTimeMs: Number(response.headers.get("X-Response-Time")),
			completedAt: new Date(),
		};
	},
);
```

The `retries` configuration accepts three properties: `limit` sets the maximum number of retry attempts, `delay` specifies the initial delay in milliseconds between retries, and `backoff` determines how the delay increases. With `"exponential"` backoff, delays double after each attempt (1s, 2s, 4s). For more control over retry behavior, you can [implement configurable backoff strategies](/tutorials/implement-retry-with-configurable-backoff). The `timeout` option sets the maximum time in milliseconds a step can run before being terminated.

## Chain Multiple Steps Together

Workflows shine when you need to coordinate multiple operations. Each step can use data from previous steps:

```ts {% path="app/workflows/monitor.ts" %}
let contentCheckResult = await step.do("run content checks", async () => {
	if (monitor.contentChecks.length === 0) {
		return { allPassed: true, failedCount: 0 };
	}

	let summary = checkContentRules(result.responseBody ?? "", monitor.contentChecks);

	return {
		allPassed: summary.allPassed,
		failedCount: summary.failedCount,
	};
});

await step.do("write to analytics engine", async () => {
	let statusMatches = result.responseStatus === monitor.expectedStatus;
	let contentChecksPassed = contentCheckResult.allPassed;
	let status: "up" | "down" = statusMatches && contentChecksPassed ? "up" : "down";

	writePingResult({
		monitorId: monitor.id,
		status,
		responseTimeMs: result.responseTimeMs,
		responseStatus: result.responseStatus,
	});
});

await step.do("send alerts", async () => {
	let currentStatus: "up" | "down" =
		result.responseStatus === monitor.expectedStatus && contentCheckResult.allPassed
			? "up"
			: "down";

	if (currentStatus === "up") return;

	await Promise.allSettled(
		alerts.map(async (alert) => {
			// Send alert via email, Slack, or Discord
		}),
	);
});
```

Each step runs sequentially, and if a step fails after exhausting its retries, the workflow stops at that point. The next time the workflow is triggered, it can resume from the failed step rather than starting over.

## Handle Errors Gracefully

Wrap your workflow execution in a try/catch to handle errors and ensure cleanup:

```ts {% path="app/workflows/monitor.ts" %}
export class Ping extends WorkflowEntrypoint<Cloudflare.Env> {
	override async run(event: WorkflowEvent<Ping.WorkflowParams>, step: WorkflowStep) {
		let { monitorId } = event.payload;
		let instanceId = event.instanceId;
		let logger = new BatchedLogger(`workflow:ping:${instanceId}`);

		try {
			await this.execute(event, step, logger);
		} catch (error) {
			logger.error("workflow.ping.error", {
				instanceId,
				monitorId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		} finally {
			logger.flush();
		}
	}

	private async execute(
		event: WorkflowEvent<Ping.WorkflowParams>,
		step: WorkflowStep,
		logger: BatchedLogger,
	) {
		// All your step.do() calls go here
	}
}
```

By separating the execution logic into a private method, you keep error handling clean and ensure resources like loggers are always flushed, even when the workflow fails. The [batched logger pattern](/articles/the-batchedlogger-pattern-for-workers) works well here for collecting logs throughout the workflow and sending them in one batch.

## Register the Workflow in wrangler.toml

Add your workflow to your Cloudflare Workers configuration:

```txt {% path="wrangler.toml" %}
[[workflows]]
name = "ping-workflow"
binding = "PING_WORKFLOW"
class_name = "Ping"
```

This creates a binding that lets you trigger the workflow from your Worker code. The `class_name` must match your exported class name.

## Trigger the Workflow

Start a workflow instance from anywhere in your Worker:

```ts {% path="app/routes/monitors.trigger.ts" %}
import { env } from "cloudflare:workers";

export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let monitorId = formData.get("monitorId");

	let instance = await env.MONITOR_WORKFLOW.create({
		id: `monitor-${monitorId}-${Date.now()}`,
		params: { monitorId },
	});

	return { instanceId: instance.id };
}
```

The `create` method accepts an `id` for the workflow instance (useful for deduplication) and `params` that match your `WorkflowParams` type. You can also use scheduled triggers or Durable Object alarms to start workflows automatically.

## Final Thoughts

Cloudflare Workflows provide a robust foundation for background tasks that need reliability guarantees. The step-based execution model means you can build complex pipelines without worrying about partial failures corrupting your data. Use retries for network calls, timeouts for external services, and structured logging to debug issues in production. For tasks that don't need workflow durability, consider using [Cloudflare Queues with a job framework](/tutorials/build-a-job-framework-for-cloudflare-queues) instead.
