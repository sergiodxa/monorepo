---
title: Designing for Testability in Serverless Functions
excerpt: Pure functions and dependency injection make serverless code easy to test without mocking infrastructure.
---

Serverless functions are notoriously difficult to test. They run in managed environments, depend on external services, and often mix business logic with infrastructure concerns. The result? Developers either skip tests entirely or write brittle integration tests that require spinning up local emulators.

But it doesn't have to be this way. The key insight is that testability is a design problem, not a tooling problem. By structuring your code around pure functions and explicit dependencies, you can test the vast majority of your serverless logic with simple, fast unit tests. This same principle applies when [organizing business logic into services](/articles/the-service-layer-pattern-in-react-router-apps) in web applications.

## The Problem with Typical Serverless Code

Most serverless functions look something like this:

```ts {% path="functions/check-website.ts" %}
export async function handler(event: Event) {
	let response = await fetch(event.url);
	let body = await response.text();

	if (!body.includes(event.expectedText)) {
		await sendAlert(event.url, "Content check failed");
		return { status: "failed" };
	}

	return { status: "ok" };
}
```

This code is hard to test because it directly calls `fetch` and `sendAlert`. To test it, you need to mock global functions, set up network interception, or run actual HTTP requests. Each approach has drawbacks: mocking is fragile, interception adds complexity, and real requests are slow and flaky.

## Extract Pure Functions

The first step toward testability is extracting the core logic into pure functions. A pure function takes inputs and returns outputs without side effects. It doesn't call external services, read from databases, or modify global state.

Consider a content checking function:

```ts {% path="services/check-content.ts" %}
export interface ContentCheckResult {
	checkId: string;
	type: "contains" | "not_contains" | "regex";
	value: string;
	passed: boolean;
	error?: string;
}

export function checkContentRule(
	responseBody: string,
	check: { id: string; type: string; value: string; caseSensitive: boolean },
): ContentCheckResult {
	let { id, type, value, caseSensitive } = check;

	if (!responseBody) {
		if (type === "not_contains") {
			return { checkId: id, type, value, passed: true };
		}
		return {
			checkId: id,
			type,
			value,
			passed: false,
			error: "Response body is empty",
		};
	}

	let bodyToCheck = caseSensitive ? responseBody : responseBody.toLowerCase();
	let valueToCheck = caseSensitive ? value : value.toLowerCase();

	switch (type) {
		case "contains": {
			let passed = bodyToCheck.includes(valueToCheck);
			return {
				checkId: id,
				type,
				value,
				passed,
				error: passed ? undefined : `Response does not contain "${value}"`,
			};
		}

		case "not_contains": {
			let passed = !bodyToCheck.includes(valueToCheck);
			return {
				checkId: id,
				type,
				value,
				passed,
				error: passed ? undefined : `Response contains "${value}" but should not`,
			};
		}

		case "regex": {
			try {
				let flags = caseSensitive ? "" : "i";
				let regex = new RegExp(value, flags);
				let passed = regex.test(responseBody);
				return {
					checkId: id,
					type,
					value,
					passed,
					error: passed ? undefined : `Response does not match pattern "${value}"`,
				};
			} catch {
				return {
					checkId: id,
					type,
					value,
					passed: false,
					error: `Invalid regex pattern: ${value}`,
				};
			}
		}

		default: {
			return {
				checkId: id,
				type,
				value,
				passed: false,
				error: `Unknown check type: ${type}`,
			};
		}
	}
}
```

This function has no dependencies on external services. It takes a string and a configuration object, then returns a result. Testing it is trivial:

```ts {% path="services/check-content.test.ts" %}
import { describe, expect, test } from "bun:test";
import { checkContentRule } from "./check-content";

describe("checkContentRule", () => {
	test("passes when text is found (case insensitive by default)", () => {
		let result = checkContentRule("Hello World", {
			id: "1",
			type: "contains",
			value: "world",
			caseSensitive: false,
		});
		expect(result.passed).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("fails when text is not found", () => {
		let result = checkContentRule("Hello World", {
			id: "1",
			type: "contains",
			value: "foo",
			caseSensitive: false,
		});
		expect(result.passed).toBe(false);
		expect(result.error).toContain("does not contain");
	});

	test("respects case sensitivity", () => {
		let result = checkContentRule("Hello World", {
			id: "1",
			type: "contains",
			value: "world",
			caseSensitive: true,
		});
		expect(result.passed).toBe(false);
	});

	test("handles invalid regex gracefully", () => {
		let result = checkContentRule("test", {
			id: "1",
			type: "regex",
			value: "[invalid",
			caseSensitive: false,
		});
		expect(result.passed).toBe(false);
		expect(result.error).toContain("Invalid regex");
	});
});
```

These tests run in milliseconds. No network, no mocking, no setup. Just inputs and outputs.

## Compose Pure Functions

Once you have individual pure functions, you can compose them into higher level operations that remain pure:

```ts {% path="services/check-content.ts" %}
export interface ContentCheckSummary {
	allPassed: boolean;
	results: ContentCheckResult[];
	failedCount: number;
	passedCount: number;
}

export function checkContentRules(
	responseBody: string,
	checks: Array<{ id: string; type: string; value: string; caseSensitive: boolean }>,
): ContentCheckSummary {
	if (checks.length === 0) {
		return {
			allPassed: true,
			results: [],
			failedCount: 0,
			passedCount: 0,
		};
	}

	let results = checks.map((check) => checkContentRule(responseBody, check));
	let passedCount = results.filter((r) => r.passed).length;
	let failedCount = results.filter((r) => !r.passed).length;

	return {
		allPassed: failedCount === 0,
		results,
		failedCount,
		passedCount,
	};
}
```

Testing the composition is just as straightforward:

```ts {% path="services/check-content.test.ts" %}
describe("checkContentRules", () => {
	test("returns all passed for empty checks array", () => {
		let result = checkContentRules("test body", []);
		expect(result.allPassed).toBe(true);
		expect(result.results).toHaveLength(0);
	});

	test("handles multiple check types", () => {
		let result = checkContentRules("Status: OK Code: 200", [
			{ id: "1", type: "contains", value: "Status", caseSensitive: false },
			{ id: "2", type: "not_contains", value: "error", caseSensitive: false },
			{ id: "3", type: "regex", value: "\\d{3}", caseSensitive: false },
		]);
		expect(result.allPassed).toBe(true);
		expect(result.passedCount).toBe(3);
	});
});
```

## Push Side Effects to the Edges

The goal is to push all side effects (HTTP requests, database calls, notifications) to the edges of your system. Your serverless handler becomes a thin orchestration layer:

```ts {% path="functions/check-website.ts" %}
import { checkContentRules } from "../services/check-content";

export async function handler(event: Event, deps: Dependencies) {
	let response = await deps.fetch(event.url);
	let body = await response.text();

	let result = checkContentRules(body, event.checks);

	if (!result.allPassed) {
		await deps.sendAlert(event.url, result);
	}

	return result;
}
```

The handler now receives its dependencies explicitly. The business logic lives in `checkContentRules`, which is fully tested. The handler itself is so simple that you might not even need to test it, or you can test it with a single integration test that verifies the wiring.

## Dependency Injection for External Services

When you do need to test code that interacts with external services, [dependency injection](/articles/dependency-injection-in-remix-loaders-and-actions) makes it manageable:

```ts {% path="functions/check-website.ts" %}
interface Dependencies {
	fetch: typeof fetch;
	sendAlert: (url: string, result: ContentCheckSummary) => Promise<void>;
}

export function createHandler(deps: Dependencies) {
	return async function handler(event: Event) {
		let response = await deps.fetch(event.url);
		let body = await response.text();

		let result = checkContentRules(body, event.checks);

		if (!result.allPassed) {
			await deps.sendAlert(event.url, result);
		}

		return result;
	};
}

// Production usage
export const handler = createHandler({
	fetch: globalThis.fetch,
	sendAlert: sendAlertToSlack,
});
```

Now testing the handler is straightforward:

```ts {% path="functions/check-website.test.ts" %}
test("sends alert when checks fail", async () => {
	let alertSent = false;

	let handler = createHandler({
		fetch: async () => new Response("Hello World"),
		sendAlert: async () => {
			alertSent = true;
		},
	});

	await handler({
		url: "https://example.com",
		checks: [{ id: "1", type: "contains", value: "foo", caseSensitive: false }],
	});

	expect(alertSent).toBe(true);
});
```

## The Testing Pyramid for Serverless

This approach naturally creates a testing pyramid:

1. **Unit tests for pure functions**: Fast, numerous, cover edge cases
2. **Integration tests for handlers**: Few, verify wiring with fake dependencies
3. **E2E tests for the deployed function**: Minimal, verify infrastructure works

Most of your tests should be unit tests for pure functions. These give you confidence in your business logic without the overhead of infrastructure concerns.

## Benefits Beyond Testing

Designing for testability has benefits beyond testing itself:

**Readability**: Pure functions are easier to understand because their behavior depends only on their inputs.

**Reusability**: The same content checking logic can be used in different contexts: serverless functions, CLI tools, or web applications. In a [monorepo with shared packages](/articles/building-a-monorepo-with-shared-packages), these pure functions naturally live in shared packages that multiple apps can consume.

**Debugging**: When something goes wrong, you can reproduce the issue by calling the pure function with the same inputs.

**Refactoring**: You can change the implementation of a pure function without affecting the rest of the system, as long as the inputs and outputs remain the same.

## Conclusion

Testability in serverless functions comes from design choices, not testing frameworks. By extracting business logic into pure functions and injecting dependencies for external services, you can write fast, reliable tests that give you confidence in your code.

The pattern is simple: keep your functions pure, push side effects to the edges, and make dependencies explicit. Your tests will thank you.
