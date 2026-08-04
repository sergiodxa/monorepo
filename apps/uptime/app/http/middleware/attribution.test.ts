/**
 * Tests the first-touch attribution record: what it keeps off a URL, and what it refuses to.
 *
 * The normalization is the part with rules in it, so it is tested directly against
 * `readAttribution` rather than through a request. Every case passes a fixed instant, so
 * nothing here depends on the clock.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { readAttribution } from "~/app/http/middleware/attribution";

const NOW = new Date("2026-08-04T12:00:00Z").getTime();

/** The record for a URL, at a fixed instant. */
function read(url: string) {
	return readAttribution(new URL(url), NOW);
}

describe("readAttribution", () => {
	test("records the landing path and the instant", () => {
		let record = read("https://uptime.test/for/agencies");

		expect(record.landingPath).toBe("/for/agencies");
		expect(record.arrivedAt).toBe(NOW);
		expect(record.source).toBeNull();
		expect(record.campaign).toBeNull();
	});

	test("reads utm parameters", () => {
		let record = read("https://uptime.test/?utm_source=newsletter&utm_campaign=august");

		expect(record.source).toBe("newsletter");
		expect(record.campaign).toBe("august");
	});

	test("accepts the shorter aliases an outreach link is likelier to carry", () => {
		expect(read("https://uptime.test/?ref=outreach").source).toBe("outreach");
		expect(read("https://uptime.test/?campaign=agencies").campaign).toBe("agencies");
	});

	test("prefers utm_source over the aliases when a link carries both", () => {
		expect(read("https://uptime.test/?ref=b&utm_source=a").source).toBe("a");
	});

	test("folds case, so one source is not counted as two", () => {
		expect(read("https://uptime.test/?ref=Twitter").source).toBe("twitter");
	});

	/**
	 * The query string is where the personal data on this site lives — `/try?url=` pre-fills
	 * with somebody's own address. The landing path must never carry it.
	 */
	test("keeps the path and drops the query string", () => {
		let record = read("https://uptime.test/try?url=https://someones-private-staging.example");

		expect(record.landingPath).toBe("/try");
		expect(JSON.stringify(record)).not.toContain("private-staging");
	});

	/**
	 * The value reaches an internal email and a database column, so what matters is that
	 * nothing outside a slug survives — not that a hostile input is rejected outright. A
	 * stripped `<script>` becomes the harmless word `script`, which is the right outcome: it
	 * still attributes the visit and carries no markup.
	 */
	test("strips anything that is not a slug out of a campaign value", () => {
		expect(read("https://uptime.test/?ref=%3Cscript%3E").source).toBe("script");
		expect(read("https://uptime.test/?ref=a<b>c").source).toBe("abc");
		expect(read("https://uptime.test/?ref=a'b\"c;d").source).toBe("abcd");
		// The slug characters that are kept, so the rule isn't "strip everything".
		expect(read("https://uptime.test/?ref=my.campaign_1-x").source).toBe("my.campaign_1-x");
	});

	test("truncates a long value rather than storing it", () => {
		let record = read(`https://uptime.test/?ref=${"a".repeat(500)}`);

		expect(record.source).toHaveLength(64);
	});

	test("treats an empty parameter as absent", () => {
		expect(read("https://uptime.test/?ref=").source).toBeNull();
		expect(read("https://uptime.test/?ref=%20").source).toBeNull();
	});
});
