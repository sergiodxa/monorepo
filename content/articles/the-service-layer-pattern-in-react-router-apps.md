---
title: The Service Layer Pattern in React Router Apps
excerpt: Organize your business logic into services to improve testability and reusability.
technologies: react-router@7.0.0
---

Route modules in React Router apps tend to accumulate business logic over time. A loader that started with a simple database query now validates SSL certificates, calculates expiry dates, and formats status messages. An action that once created a single record now orchestrates multiple operations across different systems.

The service layer pattern offers a way to organize this complexity. By extracting business logic into dedicated service modules, you create reusable units of functionality that can be tested independently, shared across routes, and reasoned about in isolation. This approach complements [dependency injection in loaders and actions](/articles/dependency-injection-in-remix-loaders-and-actions) by giving you well-defined units to inject. For organizing multiple services into business workflows, see the [use case pattern](/articles/use-case-pattern-vs-service-layer).

## What Is a Service?

A service is a module that encapsulates a specific piece of business logic. It takes inputs, performs operations, and returns results. Services know nothing about HTTP requests, route parameters, or React components. They focus purely on the domain logic.

Consider checking if an SSL certificate is expiring:

```ts {% path="app/services/check-ssl.ts" %}
import { differenceInDays, isBefore } from "date-fns";

export type SslStatus = "unknown" | "valid" | "expiring" | "expired" | "error";

export interface SslCheckResult {
	status: SslStatus;
	daysUntilExpiry: number | null;
}

export function calculateSslStatus(expiresAt: Date | null, warningDays: number): SslCheckResult {
	if (!expiresAt) {
		return { status: "unknown", daysUntilExpiry: null };
	}

	let now = new Date();
	let daysUntilExpiry = differenceInDays(expiresAt, now);

	if (isBefore(expiresAt, now)) {
		return { status: "expired", daysUntilExpiry };
	}

	if (daysUntilExpiry <= warningDays) {
		return { status: "expiring", daysUntilExpiry };
	}

	return { status: "valid", daysUntilExpiry };
}
```

This function has no knowledge of routes, requests, or responses. It takes a date and a threshold, then returns a result. You can call it from a loader, an action, a scheduled job, or a test.

## Extracting Logic from Loaders

Loaders often start simple but grow complex as requirements evolve. Here is a loader with embedded business logic:

```tsx {% path="app/routes/monitors.$id.tsx" %}
import type { Route } from "./+types/monitors.$id";
import { differenceInDays, isBefore } from "date-fns";

export async function loader({ params, context }: Route.LoaderArgs) {
	let monitor = await context.db.query.monitors.findFirst({
		where: (fields, ops) => ops.eq(fields.id, params.id),
	});

	if (!monitor) throw new Response("Not found", { status: 404 });

	// SSL status calculation embedded in loader
	let sslStatus = "unknown";
	let daysUntilExpiry = null;

	if (monitor.sslExpiresAt) {
		let now = new Date();
		daysUntilExpiry = differenceInDays(monitor.sslExpiresAt, now);

		if (isBefore(monitor.sslExpiresAt, now)) {
			sslStatus = "expired";
		} else if (daysUntilExpiry <= monitor.sslWarningDays) {
			sslStatus = "expiring";
		} else {
			sslStatus = "valid";
		}
	}

	return { monitor, sslStatus, daysUntilExpiry };
}
```

The SSL logic clutters the loader and cannot be reused elsewhere. Extracting it into a service cleans up the route module:

```tsx {% path="app/routes/monitors.$id.tsx" %}
import type { Route } from "./+types/monitors.$id";
import { calculateSslStatus } from "~/services/check-ssl";

export async function loader({ params, context }: Route.LoaderArgs) {
	let monitor = await context.db.query.monitors.findFirst({
		where: (fields, ops) => ops.eq(fields.id, params.id),
	});

	if (!monitor) throw new Response("Not found", { status: 404 });

	let { status, daysUntilExpiry } = calculateSslStatus(
		monitor.sslExpiresAt,
		monitor.sslWarningDays,
	);

	return { monitor, sslStatus: status, daysUntilExpiry };
}
```

The loader now focuses on what it should: fetching data and coordinating the response. The SSL calculation lives in a service that can be tested and reused independently.

## Services for Actions

Actions benefit even more from services because they often orchestrate multiple operations. Consider an action that sends alerts to different channels:

```tsx {% path="app/routes/actions.send-alert.tsx" %}
import type { Route } from "./+types/actions.send-alert";
import { sendSlackAlert } from "~/services/send-slack-alert";
import { sendDiscordAlert } from "~/services/send-discord-alert";

export async function action({ request, context }: Route.ActionArgs) {
	let formData = await request.formData();
	let monitorId = formData.get("monitorId") as string;
	let status = formData.get("status") as "down" | "recovered";

	let monitor = await context.db.query.monitors.findFirst({
		where: (fields, ops) => ops.eq(fields.id, monitorId),
		with: { team: true, alertChannels: true },
	});

	if (!monitor) throw new Response("Not found", { status: 404 });

	let alertPromises = monitor.alertChannels.map((channel) => {
		let params = {
			monitor: { name: monitor.name, url: monitor.url, id: monitor.id },
			status,
			timestamp: new Date(),
		};

		if (channel.type === "slack") {
			return sendSlackAlert({ ...params, webhookUrl: channel.webhookUrl });
		}
		if (channel.type === "discord") {
			return sendDiscordAlert({ ...params, webhookUrl: channel.webhookUrl });
		}
	});

	await Promise.all(alertPromises);

	return { success: true };
}
```

Each alert service handles the specifics of its platform: message formatting, API calls, and error handling. The action coordinates these services without knowing the details of Slack or Discord APIs.

## Composing Services

Services can call other services to build more complex operations. An authentication flow might compose multiple services:

```ts {% path="app/services/login/with-credential.ts" %}
import bcrypt from "bcryptjs";

import { MissingValidationError } from "~/errors";
import Credential from "~/models/credential";
import Subject from "~/models/subject";

import generateCode from "./generate-code";

// Using Result types for error handling
// See: /articles/result-objects-in-ts
type Result<T, E> = { success: true; data: T } | { success: false; error: E };

function success<T>(data: T): Result<T, never> {
	return { success: true, data };
}

function failure<E>(error: E): Result<never, E> {
	return { success: false, error };
}

interface Input {
	email: string;
	password: string;
	clientId: string;
	redirectUri: string;
	state: string;
}

export default async function loginWithCredential(db: Database, input: Input) {
	let subject = await Subject.findByEmail(db, input.email);

	if (!subject) {
		return failure(new Error("Invalid credentials"));
	}

	let credential = await Credential.find(db, subject.id);

	if (!credential) {
		return failure(new Error("Invalid credentials"));
	}

	if (credential.verifiedAt === null) {
		return failure(new MissingValidationError("Verify your email address."));
	}

	let valid = await bcrypt.compare(input.password, credential.passwordHash);

	if (!valid) {
		return failure(new Error("Invalid credentials"));
	}

	let result = await generateCode({
		subjectId: subject.id,
		clientId: input.clientId,
	});

	if (!result.success) return result;

	let url = new URL(input.redirectUri);
	url.searchParams.set("state", input.state);
	url.searchParams.set("code", result.data.code);

	return success({ url, subjectId: subject.id });
}
```

This service composes model operations and another service (`generateCode`) to implement the complete login flow. The [Result type pattern](/articles/result-objects-in-ts) makes error handling explicit and type-safe. The action that calls this service remains simple:

```tsx {% path="app/routes/login.tsx" %}
import type { Route } from "./+types/login";
import loginWithCredential from "~/services/login/with-credential";

export async function action({ request, context }: Route.ActionArgs) {
	let formData = await request.formData();

	let result = await loginWithCredential(context.db, {
		email: formData.get("email") as string,
		password: formData.get("password") as string,
		clientId: formData.get("clientId") as string,
		redirectUri: formData.get("redirectUri") as string,
		state: formData.get("state") as string,
	});

	if (!result.success) {
		return { error: result.error.message };
	}

	return redirect(result.data.url.toString());
}
```

## Testing Services

Services are straightforward to test because they have no framework dependencies. You can test them with plain function calls:

```ts {% path="app/services/check-ssl.test.ts" %}
import { describe, expect, test } from "bun:test";
import { calculateSslStatus } from "./check-ssl";

describe("calculateSslStatus", () => {
	test("returns unknown when no expiry date", () => {
		let result = calculateSslStatus(null, 30);
		expect(result.status).toBe("unknown");
		expect(result.daysUntilExpiry).toBeNull();
	});

	test("returns expired when date is in the past", () => {
		let pastDate = new Date("2020-01-01");
		let result = calculateSslStatus(pastDate, 30);
		expect(result.status).toBe("expired");
	});

	test("returns expiring when within warning threshold", () => {
		let soon = new Date();
		soon.setDate(soon.getDate() + 15);
		let result = calculateSslStatus(soon, 30);
		expect(result.status).toBe("expiring");
	});

	test("returns valid when beyond warning threshold", () => {
		let future = new Date();
		future.setDate(future.getDate() + 90);
		let result = calculateSslStatus(future, 30);
		expect(result.status).toBe("valid");
	});
});
```

No mocking of requests, no setting up route contexts, no rendering components. The service is a pure function that transforms inputs to outputs. This makes services much easier to test than [testing loaders and actions directly](/tutorials/test-remix-loaders-and-actions), though you will still want integration tests for your routes. For more on [designing code for testability](/articles/designing-for-testability-in-serverless-functions), extracting pure functions is the key technique.

## Organizing Services

A common structure groups services by domain or feature:

```txt
app/
  services/
    alerts/
      send-slack-alert.ts
      send-discord-alert.ts
      send-email-alert.ts
    auth/
      login-with-credential.ts
      login-with-provider.ts
      generate-code.ts
    monitoring/
      check-ssl.ts
      check-content.ts
      check-dns.ts
```

For smaller apps, a flat structure works fine:

```txt
app/
  services/
    check-ssl.ts
    check-content.ts
    send-slack-alert.ts
    login-with-credential.ts
```

The key is consistency. Pick a structure and apply it throughout the codebase.

## When to Create a Service

Not every piece of logic needs to be a service. A simple database query that appears in one loader can stay in that loader. Services make sense when:

1. **Logic is reused across routes**: If two loaders calculate the same thing, extract it.
2. **Logic is complex**: If a calculation has multiple branches or edge cases, it deserves its own module.
3. **Logic needs testing**: If you want to test business rules independently, put them in a service.
4. **Logic is domain-specific**: If the code represents a core business concept, make it explicit.

The goal is not to have zero logic in loaders and actions. The goal is to keep them focused on their primary job: handling HTTP requests and coordinating responses.

## Trade-offs

The service layer adds indirection. Instead of seeing all the code in one place, you follow imports to understand what happens. For small apps or simple operations, this overhead may not be worth it.

Services also require discipline. It is tempting to pass the entire request or context to a service for convenience. Resist this. Services should receive only the data they need. This keeps them decoupled and testable.

Finally, services can proliferate. Without guidelines, you might end up with dozens of tiny services that each do one thing. Balance granularity with practicality. A service should represent a meaningful unit of work, not a single function call.

## Conclusion

The service layer pattern helps manage complexity in React Router apps by separating business logic from route handling. Services are reusable, testable, and focused. They let loaders and actions stay thin while the real work happens in dedicated modules.

Start small. When you notice logic duplicated across routes or a loader growing unwieldy, extract a service. Over time, you will build a library of domain operations that make your app easier to understand and maintain.
