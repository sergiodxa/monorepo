/**
 * Content-check service for response-body assertions. It evaluates a single rule
 * (contains, not_contains, or regex, with optional case sensitivity and
 * empty-body handling), aggregates multiple rules into a pass/fail summary,
 * validates regex patterns, and produces human-readable check descriptions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SelectMonitorContentCheck } from "~/db/schema";

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

/**
 * Check response body against a single content rule
 */
export function checkContentRule(
	responseBody: string,
	check: Pick<SelectMonitorContentCheck, "id" | "type" | "value" | "caseSensitive">,
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

/**
 * Check response body against multiple content rules
 */
export function checkContentRules(
	responseBody: string,
	checks: Pick<SelectMonitorContentCheck, "id" | "type" | "value" | "caseSensitive">[],
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

/**
 * Validate a regex pattern
 */
export function isValidRegex(pattern: string): boolean {
	try {
		new RegExp(pattern);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get human-readable description of a content check
 */
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
