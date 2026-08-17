/**
 * Tests the first-touch attribution record: what it keeps off a URL, and what it refuses to.
 *
 * The normalization is the part with rules in it, so it is tested directly against
 * `readAttribution` rather than through a request. Every case passes a fixed instant, so
 * nothing here depends on the clock.
 *
 * The middleware itself is exercised through a router carrying the same head-of-chain
 * `HEAD` handling and session the app installs, because the one thing it must never do is
 * write on a probe.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { headRequests } from "@pkg/http/middleware/head-requests";
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
				createSessionMiddleware(createFakeKV(), "s3cr3t", false) as Middleware,
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
	 * The guard reads the *original* request method on purpose. The head-of-chain `HEAD`
	 * middleware rewrites `context.method` to `GET` and runs the whole handler, so reading
	 * `context.method` here would make every monitoring probe look like a first arrival:
	 * it would claim the visitor's first touch for whichever path a machine happened to
	 * probe, and it would write a session — and therefore a `Set-Cookie` — for a caller
	 * that has no session and no campaign behind it. A probe must never be attributed.
	 */
	test("records nothing for a HEAD probe of the same page", async () => {
		let record = await run(
			new Request("https://uptime.test/for/agencies?ref=outreach", { method: "HEAD" }),
		);

		expect(record).toBeUndefined();
	});
});

/** Builds an in-memory `KVNamespace` fake, so the session round-trips without a real binding. */
function createFakeKV(): KVNamespace {
	let values = new Map<string, string>();

	return {
		async get(key: string) {
			return values.get(key) ?? null;
		},
		async getWithMetadata(key: string) {
			return { value: values.get(key) ?? null, metadata: null, cacheStatus: null };
		},
		async put(key: string, value: string | ArrayBuffer | ReadableStream | ArrayBufferView) {
			if (typeof value !== "string") return;
			values.set(key, value);
		},
		async delete(key: string) {
			values.delete(key);
		},
		async list() {
			return { keys: [], list_complete: true, cursor: "" };
		},
	} as unknown as KVNamespace;
}
