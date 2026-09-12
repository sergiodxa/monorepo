/**
 * The CommonMark and GitHub Flavored Markdown specifications, run example by
 * example: parse the source, print the tree, and compare the HTML literally
 * against what the specification shows. Each suite asserts a floor, so the
 * number of examples the parser reads can only go up.
 *
 * Set `MARKDOWN_SPEC_EXAMPLES=1` to expand every example into its own case,
 * which names the section and the line of each one that fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Markdown } from "../index.js";

import { toHTML } from "./to-html.js";

/** One example, in the shape the specifications' own test runner reads. */
interface Example {
	markdown: string;
	html: string;
	example: number;
	start_line: number;
	end_line: number;
	section: string;
}

/** What one run over a specification leaves behind: the asserted count, and what to read. */
interface Outcome {
	passed: number;
	failures: Example[];
}

/**
 * Reads a vendored example set. The files sit under `docs/vendor`, where the
 * note beside them records the release each one was taken from.
 */
function load(path: string): Example[] {
	return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as Example[];
}

const COMMONMARK = load("../../../../docs/vendor/commonmark/spec.json");

const GFM = load("../../../../docs/vendor/gfm/spec.json");

/**
 * The floor each suite holds, so a regression below it fails. Raise a number
 * whenever a run clears it; the examples still short of it are the deliberate
 * divergences the design document records, each with a reason.
 */
const COMMONMARK_BASELINE = 648;

const GFM_BASELINE = 658;

/** Both suites parse well over a thousand documents, which the default budget cuts short. */
const SUITE_TIMEOUT_MS = 120_000;

/** Whether the run expands every example into a case of its own. */
const EXAMPLES = process.env["MARKDOWN_SPEC_EXAMPLES"] === "1";

/** Failing sections named in the assertion message, beyond which the list stops being readable. */
const REPORTED_SECTIONS = 40;

/**
 * The comparison the specifications' own runner makes: the source through the
 * parser and the printer, against the expected HTML, byte for byte. A document
 * the parser rejects has no HTML at all, so it counts as a failure.
 */
function render(markdown: string) {
	let result = Markdown.parse(markdown);
	if (isFailure(result)) return null;
	return toHTML(result.data.document);
}

/**
 * Expands a specification into one case per example, which the detail run adds
 * so a failing example names its section and the line it was written on.
 */
function cases(examples: Example[]) {
	test.each(examples)("example $example, $section, line $start_line", (example) => {
		expect(render(example.markdown)).toBe(example.html);
	});
}

/** Runs a whole specification, keeping the failures so the message can name them. */
function run(examples: Example[]): Outcome {
	let passed = 0;
	let failures: Example[] = [];

	for (let example of examples) {
		if (render(example.markdown) === example.html) passed += 1;
		else failures.push(example);
	}

	return { passed, failures };
}

/**
 * Groups the failures by section and names the first of each, so a developer
 * reads where the parser stands from the assertion alone and nothing is logged
 * while the suite is green.
 */
function summarize(name: string, examples: Example[], outcome: Outcome) {
	let sections = new Map<string, Example[]>();
	for (let failure of outcome.failures) {
		let group = sections.get(failure.section) ?? [];
		group.push(failure);
		sections.set(failure.section, group);
	}

	let lines = [`${name}: ${outcome.passed}/${examples.length} examples pass`];
	for (let [section, group] of [...sections].slice(0, REPORTED_SECTIONS)) {
		let [first] = group;
		lines.push(`  ${section}: ${group.length} failing, from example ${first?.example}`);
	}
	if (sections.size > REPORTED_SECTIONS) {
		lines.push(`  …and ${sections.size - REPORTED_SECTIONS} more sections`);
	}

	return lines.join("\n");
}

describe("CommonMark", () => {
	test("reads the vendored examples", () => {
		expect(COMMONMARK.length).toBeGreaterThan(600);
	});

	test(
		"passes at least the recorded baseline",
		() => {
			let outcome = run(COMMONMARK);
			expect(outcome.passed, summarize("CommonMark", COMMONMARK, outcome)).toBeGreaterThanOrEqual(
				COMMONMARK_BASELINE,
			);
		},
		SUITE_TIMEOUT_MS,
	);

	if (EXAMPLES) {
		describe("every example", () => {
			cases(COMMONMARK);
		});
	}
});

describe("GitHub Flavored Markdown", () => {
	test("reads the vendored examples", () => {
		expect(GFM.length).toBeGreaterThan(600);
	});

	test(
		"passes at least the recorded baseline",
		() => {
			let outcome = run(GFM);
			expect(outcome.passed, summarize("GFM", GFM, outcome)).toBeGreaterThanOrEqual(GFM_BASELINE);
		},
		SUITE_TIMEOUT_MS,
	);

	if (EXAMPLES) {
		describe("every example", () => {
			cases(GFM);
		});
	}
});
