---
title: How to Implement Content Matching Rules
excerpt: Build a content matching system that validates response bodies using contains, not contains, and regex rules.
technologies: typescript@5.0.0
---

When building an uptime monitoring system, checking if a URL returns a 200 status code is often not enough—[status codes can lie](/articles/status-codes-lie). You need to verify that the response body contains the expected content. Maybe you want to ensure your API returns a specific JSON field, or that your homepage includes a particular text, or that an error message does not appear in the response.

This tutorial shows you how to implement a content matching system that supports three types of rules: contains, not contains, and regex patterns. Each rule can be case sensitive or case insensitive, and you can run multiple rules against a single response.

## Define the Types

```ts {% path="app/services/check-content.ts" %}
export type ContentCheckType = "contains" | "not_contains" | "regex";

export interface ContentCheckResult {
	checkId: string;
	type: ContentCheckType;
	value: string;
	passed: boolean;
	error?: string;
}

export interface ContentCheckSummary {
	allPassed: boolean;
	results: ContentCheckResult[];
	failedCount: number;
	passedCount: number;
}
```

The `ContentCheckResult` interface represents the outcome of a single rule check. It includes the check ID for tracking, the type of check performed, the value being matched, whether it passed, and an optional error message explaining why it failed.

The `ContentCheckSummary` provides an overview when running multiple rules: whether all passed, individual results, and counts for quick evaluation.

## Implement the Single Rule Checker

```ts {% path="app/services/check-content.ts" %}
export function checkContentRule(
	responseBody: string,
	check: { id: string; type: ContentCheckType; value: string; caseSensitive: boolean },
): ContentCheckResult {
	let { id, type, value, caseSensitive } = check;

	// Handle empty response body
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

	// Prepare strings for comparison
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

The function first handles empty response bodies as a special case. For `not_contains` rules, an empty body passes because it cannot contain the forbidden value. For other rules, an empty body fails immediately.

For case insensitive matching, both the response body and the search value are converted to lowercase before comparison. The regex check uses the `i` flag for case insensitivity instead, allowing the pattern to match regardless of case.

The regex implementation wraps the `RegExp` constructor in a try/catch to handle invalid patterns gracefully. Instead of throwing an error, it returns a failed result with a descriptive error message.

## Run Multiple Rules

```ts {% path="app/services/check-content.ts" %}
export function checkContentRules(
	responseBody: string,
	checks: { id: string; type: ContentCheckType; value: string; caseSensitive: boolean }[],
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

This function maps over all the rules and runs each one through `checkContentRule`. It then aggregates the results into a summary that tells you at a glance whether all rules passed and provides detailed results for each individual check.

When no rules are provided, the function returns a passing summary with empty results. This makes it safe to call even when content checking is optional.

## Add Validation Helpers

```ts {% path="app/services/check-content.ts" %}
export function isValidRegex(pattern: string): boolean {
	try {
		new RegExp(pattern);
		return true;
	} catch {
		return false;
	}
}

export function getCheckDescription(
	type: ContentCheckType,
	value: string,
	caseSensitive: boolean,
): string {
	let casePart = caseSensitive ? " (case sensitive)" : "";

	switch (type) {
		case "contains":
			return `Response contains "${value}"${casePart}`;
		case "not_contains":
			return `Response does not contain "${value}"${casePart}`;
		case "regex":
			return `Response matches pattern "${value}"${casePart}`;
		default:
			return `Unknown check type: ${type}`;
	}
}
```

The `isValidRegex` function lets you validate regex patterns before saving them to your database. Use this in your form validation to give users immediate feedback about invalid patterns.

The `getCheckDescription` function generates human readable descriptions of each rule. This is useful for displaying rules in your UI or including in alert notifications when a check fails.

## Use the Content Checker

```ts {% path="app/services/monitor.ts" %}
import { checkContentRules } from "./check-content";

async function checkMonitor(monitor: Monitor) {
	let response = await fetch(monitor.url);
	let body = await response.text();

	let contentCheck = checkContentRules(body, monitor.contentChecks);

	let isUp = response.ok && contentCheck.allPassed;

	return {
		isUp,
		statusCode: response.status,
		contentCheck,
	};
}
```

Combine the content checker with your HTTP monitoring logic. A monitor is only considered "up" when both the HTTP response is successful and all content rules pass—this maps directly to [the three states of service health](/articles/the-three-states-of-service-health). The `contentCheck` object provides detailed information about which rules failed and why, useful for debugging and alerting.
