/**
 * Guard for the two rules in `~/app/lib/public-claims`, run against this app's real
 * public copy: the six locale files and the marketing content records.
 *
 * The scanner is exercised against fixtures first. A codebase with no current violations
 * cannot otherwise prove a guard would catch one — every assertion below would pass just
 * as well against a scanner that always returned nothing.
 *
 * Everything is scanned as *source* rather than as rendered strings or imported data, and
 * that is the whole design. At runtime an interpolated figure and a hardcoded one are the
 * same characters: `formatUsd(BASE_PRICE_USD)` evaluates to `"$5"`, so a walk over the
 * imported records flags the copy that is already correct and cannot see the copy that
 * isn't. Source text is the only representation in which `"{{price}}/month"` and
 * `"$5/month"` are still distinguishable, and the second is the failure.
 *
 * The one exemption is two fields on a `/vs/:slug` pricing row, applied per source line in
 * the marketing scan below — see `quotesACompetitor`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Glob } from "bun";

import type { ClaimViolation } from "~/app/lib/public-claims";

import { BASE_PRICE_USD, formatPings, formatUsd, INCLUDED_PINGS } from "~/app/lib/pricing";
import { findClaimViolations } from "~/app/lib/public-claims";
import { audiences } from "~/resources/content/marketing";

/** App root, resolved from this file so the scan does not depend on the working directory. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Formats violations as one line each, so a failure names every site at once. */
function report(file: string, violations: ClaimViolation[]): string {
	return violations.map((v) => `${file}:${v.line} [${v.rule}: ${v.match}] ${v.text}`).join("\n");
}

describe("findClaimViolations", () => {
	test("catches a price restated as a literal", () => {
		let violations = findClaimViolations('let a = "$5/mo includes 100,000 pings";');

		expect(violations).toHaveLength(1);
		expect(violations[0]?.rule).toBe("pricing-literal");
		expect(violations[0]?.match).toBe("$5");
	});

	test("catches an allowance restated without a currency symbol", () => {
		let violations = findClaimViolations('let a = "Your subscription includes 100,000 pings";');

		expect(violations).toHaveLength(1);
		expect(violations[0]?.match).toBe("100,000");
	});

	test("passes copy that interpolates the figures", () => {
		expect(findClaimViolations('let a = "{{price}}/month includes {{included}} pings";')).toEqual(
			[],
		);
	});

	/**
	 * The rule has to survive next to the numbers it is not about. This app is full of
	 * millisecond timeouts in exactly the range the pricing figures live in, and a rule that
	 * flagged them would be turned off within a week.
	 */
	test("ignores numbers that are not prices", () => {
		expect(
			findClaimViolations('let a = "Connection timeout in milliseconds (default: 10000)";'),
		).toEqual([]);
		expect(findClaimViolations("let timeoutMs = 100000;")).toEqual([]);
		expect(findClaimViolations('let a = "Check every 5 minutes";')).toEqual([]);
	});

	test("catches unsupported social proof", () => {
		for (let claim of [
			"Join thousands of teams",
			"Trusted by 400 agencies",
			"Teams are switching to Uptime",
			"1,200 customers rely on us",
			"Industry-leading reliability",
		]) {
			let violations = findClaimViolations(`let a = ${JSON.stringify(claim)};`);
			expect(violations.map((v) => v.rule)).toContain("social-proof");
		}
	});

	test("passes copy that claims nothing about other customers", () => {
		expect(findClaimViolations('let a = "Monitor every client site from one dashboard";')).toEqual(
			[],
		);
	});

	/** A docblock explaining the rule must not be a violation of it. */
	test("ignores comments", () => {
		expect(findClaimViolations('// never write "$5/mo includes 100,000 pings"')).toEqual([]);
		expect(findClaimViolations('/* e.g. "$5/mo per 100,000 pings" */')).toEqual([]);
	});
});

describe("locale copy", () => {
	let paths = [...new Glob("app/locales/*.ts").scanSync(ROOT)].sort();

	test("scans every locale", () => {
		expect(paths.length).toBe(6);
	});

	for (let path of paths) {
		test(`${path} restates no price and claims no social proof`, () => {
			let violations = findClaimViolations(readFileSync(join(ROOT, path), "utf8"));

			expect(report(path, violations)).toBe("");
		});
	}
});

describe("marketing content", () => {
	let path = "resources/content/marketing.ts";
	let source = readFileSync(join(ROOT, path), "utf8");
	let lines = source.split("\n");

	/**
	 * Two fields on a `/vs/:slug` pricing row are meant to hold a currency literal, and
	 * neither is a claim about our model: `theirCost` quotes a competitor's published price
	 * as they state it, hedges and all, and `ourCost` covers the rows a ping volume cannot
	 * express (seat pricing, tool sprawl) where the answer is copy rather than a projection.
	 * Recognised by the source line they sit on, since that is the representation being
	 * scanned — and only for the pricing rule.
	 */
	function quotesACompetitor(violation: ClaimViolation): boolean {
		let line = lines[violation.line - 1] ?? "";
		return line.includes("theirCost:") || line.includes("ourCost:");
	}

	test("restates no price of ours and claims no social proof", () => {
		let violations = findClaimViolations(source).filter((violation) => {
			return violation.rule === "social-proof" || !quotesACompetitor(violation);
		});

		expect(report(path, violations)).toBe("");
	});

	/**
	 * The inverse failure, and the one a literal-hunting rule cannot see: copy that stopped
	 * quoting the price at all, or that interpolates a figure which no longer matches the
	 * model. At least one audience page has to carry both current numbers.
	 */
	test("the indie-hackers page quotes the current price and allowance", () => {
		let page = audiences["indie-hackers"];

		expect(page).toBeDefined();
		expect(page?.metaDescription).toContain(formatUsd(BASE_PRICE_USD));
		expect(page?.metaDescription).toContain(formatPings(INCLUDED_PINGS));
	});
});
