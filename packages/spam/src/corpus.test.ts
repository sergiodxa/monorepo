/**
 * Runs the labelled corpus through a filter built from the default rules, one test per entry,
 * so a weight change that misjudges a submission names that submission and the signals it drew.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { HAM, SPAM } from "./corpus.fixtures.js";

import { createSpamFilter, DEFAULT_RULES } from "./index.js";

/** The filter every entry is scored by: default rules and thresholds, nothing remote. */
const FILTER = createSpamFilter({ checks: DEFAULT_RULES });

describe.each([
	["ham", HAM],
	["spam", SPAM],
])("%s corpus", (_label, entries) => {
	test.each(entries.map((entry) => [entry.name, entry] as const))("%s", async (_name, entry) => {
		let assessment = await FILTER.check(entry.submission);
		expect({ verdict: assessment.verdict, signals: assessment.signals }).toMatchObject({
			verdict: entry.expected,
		});
		expect(assessment.failures).toEqual([]);
	});
});

test("the corpus covers both labels generously", () => {
	expect(HAM.length).toBeGreaterThanOrEqual(10);
	expect(SPAM.length).toBeGreaterThanOrEqual(10);
});
