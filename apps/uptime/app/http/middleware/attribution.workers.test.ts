/**
 * Tests the first-touch attribution record: what it keeps off a URL, and what it refuses to.
 *
 * The normalization is the part with rules in it, so these cases call `readAttribution`
 * directly, each passing a fixed instant so nothing here depends on the clock.
 *
 * The middleware itself is exercised through a router carrying the same head-of-chain
 * `HEAD` handling and session the app installs, confirming a probe gets a read-only pass
 * through it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { headRequests } from "@pkg/http/middleware/head-requests";
import { env } from "cloudflare:test";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { describe, expect, test } from "vitest";

import type { TrialAttribution } from "~/app/http/middleware/attribution";

import { attribution, readAttribution, TRIAL_ATTRIBUTION } from "~/app/http/middleware/attribution";
import { createSessionMiddleware } from "~/app/http/middleware/session";

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
	 * with somebody's own address. The landing path always resolves to the bare pathname.
	 */
	test("keeps the path and drops the query string", () => {
		let record = read("https://uptime.test/try?url=https://someones-private-staging.example");

		expect(record.landingPath).toBe("/try");
		expect(JSON.stringify(record)).not.toContain("private-staging");
	});

	/**
	 * The value reaches an internal email and a database column, so what matters is that only a
	 * slug survives. A stripped `<script>` becomes the harmless word `script`, which still
	 * attributes the visit in plain text.
	 */
	test("strips anything that is not a slug out of a campaign value", () => {
		expect(read("https://uptime.test/?ref=%3Cscript%3E").source).toBe("script");
		expect(read("https://uptime.test/?ref=a<b>c").source).toBe("abc");
		expect(read("https://uptime.test/?ref=a'b\"c;d").source).toBe("abcd");
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

describe("attribution middleware", () => {
	/**
	 * Runs one request through the middleware chain the app installs around this: `HEAD`
	 * handling first, then the real cookie + KV session, then the middleware under test.
	 *
	 * @param request - The request to send.
	 * @returns Whatever the session held for the first-touch key by the time the handler ran.
	 */
	async function run(request: Request): Promise<TrialAttribution | undefined> {
		let captured: TrialAttribution | undefined;

		let router = createRouter({
			middleware: [
				headRequests(),
				createSessionMiddleware(env.KV, "s3cr3t", false) as Middleware,
				attribution,
			],
		});

		router.get("/for/agencies", (ctx) => {
			captured = ctx.get(Session)?.get(TRIAL_ATTRIBUTION) as TrialAttribution | undefined;
			return new Response("ok", { headers: { "Content-Type": "text/html" } });
		});

		await router.fetch(request);

		return captured;
	}

	test("records first-touch attribution on a GET page view", async () => {
		let record = await run(new Request("https://uptime.test/for/agencies?ref=outreach"));

		expect(record?.landingPath).toBe("/for/agencies");
		expect(record?.source).toBe("outreach");
	});

	/**
	 * The guard reads `context.request.method`, preserved as-is by the head-of-chain `HEAD`
	 * middleware even though it rewrites `context.method` to `GET` and runs the whole handler;
	 * a probe must still read as `HEAD` here, or every monitoring check would count as a first arrival.
	 */
	test("records nothing for a HEAD probe of the same page", async () => {
		let record = await run(
			new Request("https://uptime.test/for/agencies?ref=outreach", { method: "HEAD" }),
		);

		expect(record).toBeUndefined();
	});
});
