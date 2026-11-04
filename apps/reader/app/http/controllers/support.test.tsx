/**
 * Tests the support form: it never prints the support inbox, it remembers the help page a
 * reader came from, a valid message is mailed to the inbox with the sender as reply-to, a
 * filled trap is thanked and dropped, and a refusal returns the form with the message kept.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { MemoryTransport } from "@sdxc/mail/memory";
import { unwrap } from "@sdxc/result";
import { createSpamFilter } from "@sdxc/spam";
import { describe, expect, test } from "vitest";

import support from "~/app/http/controllers/support";
import supportDesk from "~/app/http/middleware/support-desk";
import { createTestRouter, fetchRoute } from "~/app/test/controller";
import { SUPPORT_INBOX } from "~/config/support";
import routes from "~/routes/web";

/** The honeypot the form is issued and checked with, as the router builds it. */
const HONEYPOT = new Honeypot({ secret: "honeypot:test-secret" });

/** A router with the form mapped behind its guards, mailing into `transport`. */
function createRouter(transport: MemoryTransport) {
	let router = createTestRouter(null);
	router.map(routes.support, {
		middleware: [
			log(createLogger({ service: "test", sink: () => {} })) as Middleware,
			honeypot(HONEYPOT, { onFailure: () => null }),
			supportDesk({
				transport,
				from: "reader@example.com",
				spamFilter: createSpamFilter({ checks: [] }),
			}),
		],
		actions: support.actions,
	});
	return router;
}

/** The honeypot fields a freshly drawn form would carry. */
async function honeypotFields(): Promise<Record<string, string>> {
	let fields = unwrap(await HONEYPOT.issue({ now: new Date(Date.now() - 60_000) }));
	return { [fields.tokenField]: fields.token };
}

/** A message a person would send. */
const MESSAGE = {
	name: "Ada",
	email: "ada@example.com",
	topic: "problem",
	page: "feed-not-updating",
	message: "My feed from example.com stopped updating three days ago.",
};

describe("GET /support", () => {
	test("draws the form without ever printing the inbox, remembering the page left", async () => {
		let response = await fetchRoute(
			createRouter(new MemoryTransport()),
			`${routes.support.index.href()}?from=feed-not-updating`,
		);
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).not.toContain(SUPPORT_INBOX);
		expect(html).toContain('name="page" value="feed-not-updating"');
		expect(html).toContain("A feed stopped updating");
		expect(html).toContain('rel="canonical" href="https://reader.sergiodxa.com/support"');
		expect(html).not.toContain('canonical" href="https://reader.sergiodxa.com/support?');
	});

	test("forgets a page that is not a help page", async () => {
		let response = await fetchRoute(
			createRouter(new MemoryTransport()),
			`${routes.support.index.href()}?from=elsewhere`,
		);

		expect(await response.text()).toContain('name="page" value=""');
	});
});

describe("POST /support", () => {
	test("mails the inbox with the sender as reply-to, then thanks them", async () => {
		let transport = new MemoryTransport();
		let response = await fetchRoute(createRouter(transport), routes.support.action.href(), {
			...MESSAGE,
			...(await honeypotFields()),
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${routes.support.index.href()}?sent=1`);
		expect(transport.messages).toHaveLength(1);
		expect(transport.last?.to.map((address) => address.email)).toEqual([SUPPORT_INBOX]);
		expect(transport.last?.replyTo.map((address) => address.email)).toEqual([MESSAGE.email]);
		expect(transport.last?.subject).toContain("problem");
	});

	test("returns the form with the message kept and the problem named", async () => {
		let transport = new MemoryTransport();
		let response = await fetchRoute(createRouter(transport), routes.support.action.href(), {
			...MESSAGE,
			email: "not an address",
			...(await honeypotFields()),
		});
		let html = await response.text();

		expect(response.status).toBe(400);
		expect(html).toContain("Enter a valid email address");
		expect(html).toContain(MESSAGE.message);
		expect(transport.messages).toHaveLength(0);
	});

	test("thanks a filled trap and mails nothing", async () => {
		let transport = new MemoryTransport();
		let fields = unwrap(await HONEYPOT.issue({ now: new Date(Date.now() - 60_000) }));
		let response = await fetchRoute(createRouter(transport), routes.support.action.href(), {
			...MESSAGE,
			[fields.tokenField]: fields.token,
			[fields.trapField]: "https://spam.example",
		});

		expect(response.status).toBe(303);
		expect(transport.messages).toHaveLength(0);
	});

	test("asks again for a form that arrived without its token", async () => {
		let transport = new MemoryTransport();
		let response = await fetchRoute(createRouter(transport), routes.support.action.href(), MESSAGE);

		expect(response.status).toBe(400);
		expect(transport.messages).toHaveLength(0);
	});

	test("thanks the reader on the page it redirects to", async () => {
		let response = await fetchRoute(
			createRouter(new MemoryTransport()),
			`${routes.support.index.href()}?sent=1`,
		);

		expect(await response.text()).toContain("A person will reply");
	});
});
