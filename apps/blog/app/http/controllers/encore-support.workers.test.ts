/**
 * Drives the Encore support page through the real router inside workerd, against the local
 * session KV and rate-limit binding, with mail captured by a memory transport: the page, a
 * delivered request and its confirmation, validation, delivery failure, the honeypot fields
 * the page renders, the spam verdicts, and the abuse guards. Each request's spam filter is the
 * test's own, so no reputation service is ever called.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { NormalizedMessage, SentMessage, Transport } from "@sdxc/mail";
import type { Result } from "@sdxc/result";
import type { SpamFilter } from "@sdxc/spam";

import { MailError } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { failure } from "@sdxc/result";
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";
import { MemoryCheck } from "@sdxc/spam/memory";
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { SUPPORT_RATE_LIMIT, SUPPORT_SENDER } from "~/app/services/support-desk";

import createApplication from "../../../bootstrap/app";

const ORIGIN = "https://blog.test";
const PATH = "/apps/encore/support";
const INBOX = "support-inbox@example.com";

/** A transport whose provider refuses every message, as a rejected send does. */
class RejectingTransport implements Transport {
	async send(_message: NormalizedMessage): Promise<Result<SentMessage, MailError>> {
		return failure(new MailError("rejected"));
	}
}

/** A full `App.Env` over the real bindings, with the secrets a local run cannot read. */
function environment(overrides: Partial<App.Env> = {}): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		SUPPORT_INBOX: INBOX,
		SUPPORT_RATE_LIMITER: env.SUPPORT_RATE_LIMITER,
		waitUntil: () => {},
		...overrides,
	};
}

/** A client address of its own per call, so one test never spends another's budget. */
function uniqueAddress() {
	let bytes = crypto.getRandomValues(new Uint8Array(2));
	return `10.${bytes[0]}.${bytes[1]}.${Math.floor(Math.random() * 250) + 1}`;
}

/** The honeypot fields a rendered form carries, read from its HTML as a browser would post them. */
function honeypotFields(html: string) {
	let token = html.match(/<input type="hidden" name="(hp-token)" value="([^"]+)"/);
	let trap = html.match(/<input type="text" id="(hp_[a-z]+)"/);
	if (!token?.[1] || !token[2] || !trap?.[1])
		throw new Error("the page rendered no honeypot fields");
	return { tokenField: token[1], token: token[2], trapField: trap[1] };
}

/** The honeypot fields of a freshly loaded support page. */
async function issuedFields() {
	return honeypotFields(await (await load()).text());
}

/**
 * A valid submission carrying the honeypot fields of a freshly loaded page, with any field
 * replaced and the trap set to `trap`.
 */
async function submission(fields: Record<string, string> = {}, trap = "") {
	let honeypot = await issuedFields();
	return new URLSearchParams({
		name: "Ada Lovelace",
		email: "ada@example.com",
		topic: "Bug report",
		platform: "iPhone",
		osVersion: "iOS 26.1",
		appVersion: "1.2",
		message:
			"The timer stops when I reveal the second card.\n\nSteps: open a game, reveal two cards.",
		[honeypot.tokenField]: honeypot.token,
		[honeypot.trapField]: trap,
		...fields,
	});
}

interface SubmitOptions {
	transport?: Transport;
	/** @default a filter with no checks, so every valid request is ham */
	spamFilter?: SpamFilter;
	env?: Partial<App.Env>;
	address?: string;
	headers?: Record<string, string>;
}

/** Posts the form the way a same-origin browser does. */
function submit(body: URLSearchParams, options: SubmitOptions = {}) {
	let app = createApplication(environment(options.env), {
		mailTransport: options.transport,
		spamFilter: options.spamFilter ?? createSpamFilter({ checks: [] }),
	});
	return app.fetch(
		new Request(new URL(PATH, ORIGIN), {
			method: "POST",
			redirect: "manual",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				"sec-fetch-site": "same-origin",
				"cf-connecting-ip": options.address ?? uniqueAddress(),
				...options.headers,
			},
			body,
		}),
	);
}

/** Loads the page, carrying a session cookie when one is given. */
function load(cookie?: string) {
	let app = createApplication(environment());
	return app.fetch(new Request(new URL(PATH, ORIGIN), { headers: cookie ? { cookie } : {} }));
}

describe("GET /apps/encore/support", () => {
	test("renders the public support page with its title, description and form", async () => {
		let response = await load();
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/<title[^>]*>Encore Support<\/title>/);
		expect(html).toContain(
			'content="Get help with Encore: Music Party Game for iPhone, iPad, Apple Watch, and Mac. Report a problem, ask a question, or suggest a feature."',
		);
		expect(html).toContain('action="/apps/encore/support"');
		expect(html).toMatch(
			/name="email"[^>]*autocomplete="email"|autocomplete="email"[^>]*name="email"/,
		);
		expect(html).toContain("Send support request");
		expect(html).toContain("Describe your question, problem, or suggestion…");
		expect(html).toContain("Please don’t include passwords, payment details");
		expect(html).toContain('href="/apps/encore/privacy"');
	});

	test("renders the honeypot trap out of reach of people and autofill", async () => {
		let html = await (await load()).text();

		expect(html).toMatch(/<div aria-hidden="true" inert class="[^"]+"><label for="hp_[a-z]+">/);
		expect(html).toMatch(
			/<input type="text" id="hp_[a-z]+" name="hp_[a-z]+" value="" tabindex="-1" autocomplete="off"/,
		);
		expect(html).not.toContain('name="website"');
	});

	test("labels every visible control", async () => {
		let html = await (await load()).text();

		for (let id of ["support-topic", "support-platform", "support-message"]) {
			expect(html).toContain(`for="${id}"`);
			expect(html).toContain(`id="${id}"`);
		}
	});
});

describe("POST /apps/encore/support", () => {
	test("mails the request to the inbox, replying to the visitor, then confirms once", async () => {
		let transport = new MemoryTransport();
		let response = await submit(await submission(), { transport });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(PATH);

		let message = transport.last;
		expect(transport.messages).toHaveLength(1);
		expect(message?.to).toEqual([{ email: INBOX }]);
		expect(message?.from).toEqual(SUPPORT_SENDER);
		expect(message?.replyTo).toEqual([{ email: "ada@example.com", name: "Ada Lovelace" }]);
		expect(message?.subject).toBe("[Encore] Bug report on iPhone");
		for (let fact of ["Ada Lovelace", "ada@example.com", "iOS 26.1", "1.2", "Steps: open a game"]) {
			expect(message?.text).toContain(fact);
		}

		let cookie = response.headers.get("set-cookie")?.split(";")[0];
		expect(cookie).toBeDefined();

		let confirmation = await (await load(cookie)).text();
		expect(confirmation).toContain(
			"Your support request has been sent. We’ll reply to the email address you provided.",
		);
		expect(confirmation).not.toContain('name="message"');

		let reload = await (await load(cookie)).text();
		expect(reload).not.toContain("Your support request has been sent.");
		expect(reload).toContain('name="message"');
	});

	test("escapes what the visitor wrote in the email", async () => {
		let transport = new MemoryTransport();
		await submit(await submission({ message: "<script>alert(1)</script> breaks the lobby" }), {
			transport,
		});

		expect(transport.last?.html).not.toContain("<script>alert(1)</script>");
		expect(transport.last?.html).toContain("&lt;script&gt;");
	});

	test("rejects invalid fields with field-level errors, keeping the values, sending nothing", async () => {
		let transport = new MemoryTransport();
		let response = await submit(
			await submission({ email: "not-an-email", topic: "Refund", message: "Help me please now" }),
			{ transport },
		);
		let html = await response.text();

		expect(response.status).toBe(400);
		expect(transport.messages).toHaveLength(0);
		expect(html).toContain("Enter a valid email address, like name@example.com.");
		expect(html).toContain("Choose a topic.");
		expect(html).toContain('aria-invalid="true"');
		expect(html).toContain('value="not-an-email"');
		expect(html).toContain("Help me please now");
	});

	test("requires an email and a message", async () => {
		let response = await submit(await submission({ email: "", message: "" }), {
			transport: new MemoryTransport(),
		});
		let html = await response.text();

		expect(response.status).toBe(400);
		expect(html).toContain("Enter your email address so we can reply.");
		expect(html).toContain("Enter a message describing how we can help.");
	});

	test("reports a rejected delivery as an error and preserves the message", async () => {
		let response = await submit(await submission(), { transport: new RejectingTransport() });
		let html = await response.text();

		expect(response.status).toBe(503);
		expect(html).toContain(
			"We couldn’t send your request. Your message has been preserved—please try again.",
		);
		expect(html).toContain("The timer stops when I reveal the second card.");
		expect(response.headers.get("location")).toBeNull();
	});

	test("fails closed when no support inbox is configured", async () => {
		let transport = new MemoryTransport();
		let response = await submit(await submission(), {
			transport,
			env: { SUPPORT_INBOX: undefined },
		});

		expect(response.status).toBe(503);
		expect(transport.messages).toHaveLength(0);
	});

	test("answers a filled honeypot like a success without sending", async () => {
		let transport = new MemoryTransport();
		let response = await submit(await submission({}, "https://spam.example"), { transport });

		expect(response.status).toBe(303);
		expect(transport.messages).toHaveLength(0);
	});

	test("asks to send again when the honeypot token is missing, keeping the values", async () => {
		let transport = new MemoryTransport();
		let body = await submission();
		body.delete("hp-token");
		let response = await submit(body, { transport });
		let html = await response.text();

		expect(response.status).toBe(400);
		expect(transport.messages).toHaveLength(0);
		expect(html).toContain("This form expired before it was sent.");
		expect(html).toContain("The timer stops when I reveal the second card.");
		expect(honeypotFields(html).token).toBeTruthy();
	});

	test("refuses a forged honeypot token without sending", async () => {
		let transport = new MemoryTransport();
		let response = await submit(await submission({ "hp-token": "forged.token" }), { transport });

		expect(response.status).toBe(400);
		expect(transport.messages).toHaveLength(0);
	});

	test("re-renders a rejected form with fields that verify on the next send", async () => {
		let transport = new MemoryTransport();
		let rejected = await submit(await submission({ email: "not-an-email" }), { transport });
		let honeypot = honeypotFields(await rejected.text());

		let retry = await submission();
		retry.set(honeypot.tokenField, honeypot.token);
		let response = await submit(retry, { transport });

		expect(response.status).toBe(303);
		expect(transport.messages).toHaveLength(1);
	});

	test("answers a request scored as spam like a success without sending", async () => {
		let transport = new MemoryTransport();
		let check = new MemoryCheck({ signals: [{ check: "test.spam", score: 10 }] });
		let response = await submit(await submission(), {
			transport,
			spamFilter: createSpamFilter({ checks: [check] }),
		});

		expect(response.status).toBe(303);
		expect(transport.messages).toHaveLength(0);
		expect(check.last).toMatchObject({
			content: expect.stringContaining("The timer stops"),
			format: "text",
			author: { name: "Ada Lovelace", email: "ada@example.com" },
			renderedAt: expect.any(Date),
		});
		expect(check.last?.author?.ip).toMatch(/^10\./);
	});

	test("delivers a request the filter is unsure about, flagged with its signals", async () => {
		let transport = new MemoryTransport();
		let check = new MemoryCheck({
			signals: [{ check: "links.count", score: 6, detail: "4 links" }],
		});
		let response = await submit(await submission(), {
			transport,
			spamFilter: createSpamFilter({ checks: [check] }),
		});

		expect(response.status).toBe(303);
		expect(transport.last?.subject).toBe("[Possible spam] [Encore] Bug report on iPhone");
		expect(transport.last?.text).toContain("This request may be spam (score 6)");
		expect(transport.last?.text).toContain("links.count");
		expect(transport.last?.text).toContain("The timer stops when I reveal the second card.");
	});

	test("delivers normally when a reputation check is down", async () => {
		let transport = new MemoryTransport();
		let check = new MemoryCheck().failNext("unavailable");
		let response = await submit(await submission(), {
			transport,
			spamFilter: createSpamFilter({ checks: [check] }),
		});

		expect(response.status).toBe(303);
		expect(transport.last?.subject).toBe("[Encore] Bug report on iPhone");
	});

	test("discards a BBCode link dump under the default rules", async () => {
		let transport = new MemoryTransport();
		let message =
			"Great app! [url=https://pills.example]cheap pills online[/url] [url=https://pills.example/2]big discount[/url]";
		let response = await submit(await submission({ message }), {
			transport,
			spamFilter: createSpamFilter({ checks: DEFAULT_RULES }),
		});

		expect(response.status).toBe(303);
		expect(transport.messages).toHaveLength(0);
	});

	test("limits how often one address may submit, keeping the values", async () => {
		let transport = new MemoryTransport();
		let address = uniqueAddress();
		for (let attempt = 0; attempt < SUPPORT_RATE_LIMIT; attempt++) {
			await submit(await submission(), { transport, address });
		}

		let response = await submit(await submission(), { transport, address });
		let html = await response.text();

		expect(response.status).toBe(429);
		expect(transport.messages).toHaveLength(SUPPORT_RATE_LIMIT);
		expect(html).toContain("please wait a minute and try again");
		expect(html).toContain("The timer stops when I reveal the second card.");
	});

	test("refuses a cross-site post", async () => {
		let transport = new MemoryTransport();
		let response = await submit(await submission(), {
			transport,
			headers: { "sec-fetch-site": "cross-site" },
		});

		expect(response.status).toBe(403);
		expect(transport.messages).toHaveLength(0);
	});
});
