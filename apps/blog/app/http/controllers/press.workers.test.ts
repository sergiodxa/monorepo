/**
 * Drives the press kit through the real router inside workerd, against the local session KV
 * and rate-limit binding, with mail captured by a memory transport: the designed page in each
 * language, its Markdown twin, and an invitation delivered to the author or refused in the
 * organizer's language. The spam filter has no checks, so no reputation service is called.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryTransport } from "@sdxc/mail/memory";
import { createSpamFilter } from "@sdxc/spam";
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { PRESS_SENDER } from "~/app/services/support-desk";
import { PROFILE } from "~/config/profile";

const ORIGIN = "https://blog.test";

/** A full `App.Env` over the real bindings, with the secrets a local run cannot read. */
function environment(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		SUPPORT_RATE_LIMITER: env.SUPPORT_RATE_LIMITER,
		waitUntil: () => {},
	};
}

/** A client address of its own per call, so one test never spends another's budget. */
function uniqueAddress() {
	let bytes = crypto.getRandomValues(new Uint8Array(3));
	return `10.${bytes[0]}.${bytes[1]}.${((bytes[2] ?? 0) % 250) + 1}`;
}

/** Requests `path` with `headers`, through a router that mails into `transport`. */
function fetchPage(path: string, init: RequestInit = {}, transport = new MemoryTransport()) {
	let app = createWebRouter(environment(), {
		mailTransport: transport,
		spamFilter: createSpamFilter({ checks: [] }),
	});
	return app.fetch(new Request(new URL(path, ORIGIN), { redirect: "manual", ...init }));
}

/**
 * The honeypot fields a rendered form carries, read from its HTML as a browser would post
 * them, with the trap holding `trap`.
 */
function honeypotFields(html: string, trap: string): Record<string, string> {
	let token = html.match(/<input type="hidden" name="(hp-token)" value="([^"]+)"/);
	let field = html.match(/<input type="text" id="(hp_[a-z]+)"/);
	if (!token?.[1] || !token[2] || !field?.[1])
		throw new Error("the page rendered no honeypot fields");
	return { [token[1]]: token[2], [field[1]]: trap };
}

/**
 * Posts an invitation from a freshly loaded page in `lang`, with any field replaced and the
 * honeypot trap holding `trap`.
 */
async function invite(
	fields: Record<string, string>,
	lang: string,
	transport: MemoryTransport,
	trap = "",
) {
	let page = await (await fetchPage(`/press?lang=${lang}`)).text();
	let body = new URLSearchParams({
		name: "Ada Lovelace",
		email: "ada@example.com",
		kind: "conference",
		event: "Remix Jam 2027",
		message: "Would you give a talk at Remix Jam next year? We cover travel.",
		...honeypotFields(page, trap),
		...fields,
	});
	return fetchPage(
		`/press?lang=${lang}`,
		{
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				"sec-fetch-site": "same-origin",
				"cf-connecting-ip": uniqueAddress(),
			},
			body,
		},
		transport,
	);
}

describe("GET /press", () => {
	test("renders the English kit with its sections, photos and invitation form", async () => {
		let response = await fetchPage("/press");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/<title[^>]*>Press Kit<\/title>/);
		expect(html).toContain('lang="en"');
		for (let heading of ["Quick facts", "Bios", "Photos", "Talks and appearances", "Invite me"]) {
			expect(html).toContain(heading);
		}
		expect(html).toContain("SEHR-hyoh sah-lahm-BREE");
		expect(html).toContain('src="/press/sergio-xalambri-helmet.jpg"');
		expect(html).toContain('src="/.well-known/avatar"');
		expect(html).toContain("The Remix Way");
		expect(html).toContain('action="/press?lang=en"');
		expect(html).toContain('src="/privacy-pass"');
		expect(html).toContain('href="/press?lang=es-AR"');
	});

	test("answers in Spanish for a Spanish browser or ?lang=es", async () => {
		let byHeader = await (
			await fetchPage("/press", { headers: { "accept-language": "es-PE" } })
		).text();
		let byQuery = await (await fetchPage("/press?lang=es")).text();

		for (let html of [byHeader, byQuery]) {
			expect(html).toMatch(/<title[^>]*>Kit de prensa<\/title>/);
			expect(html).toContain("Biografías");
			expect(html).toContain("la X suena como una S");
		}
	});

	test("answers Markdown when the request prefers it", async () => {
		let response = await fetchPage("/press", { headers: { accept: "text/markdown" } });

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(await response.text()).toContain("## Bios");
	});
});

describe("GET /press.md", () => {
	test("writes the kit as Markdown, bios as quotes and photos as absolute links", async () => {
		let response = await fetchPage("/press.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body).toMatch(/^# Press Kit\n/);
		expect(body).toContain("> Sergio Xalambrí is an Argentinian web developer");
		expect(body).toContain(`(${ORIGIN}/press/sergio-xalambri-helmet.jpg)`);
		expect(body).toContain("[The Remix Way](https://www.youtube.com/watch?v=o07u1oKE6VA)");
	});

	test("writes the Spanish kit for ?lang=es-AR", async () => {
		let body = await (await fetchPage("/press.md?lang=es-AR")).text();

		expect(body).toMatch(/^# Kit de prensa\n/);
		expect(body).toContain("## Charlas y apariciones");
	});
});

describe("POST /press", () => {
	test("mails the invitation to the author, replying to the organizer, then confirms", async () => {
		let transport = new MemoryTransport();
		let response = await invite({}, "en", transport);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/press?lang=en#contact");
		expect(transport.messages).toHaveLength(1);
		expect(transport.last?.to).toEqual([{ email: PROFILE.email }]);
		expect(transport.last?.from).toEqual(PRESS_SENDER);
		expect(transport.last?.replyTo).toEqual([{ email: "ada@example.com", name: "Ada Lovelace" }]);
		expect(transport.last?.subject).toBe("[Press] conference: Remix Jam 2027");

		let cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
		let confirmation = await (await fetchPage("/press?lang=en", { headers: { cookie } })).text();
		expect(confirmation).toContain("Thanks! Your message is on its way");
		expect(confirmation).not.toContain('name="message"');
	});

	test("refuses invalid fields in the organizer's language, keeping what they typed", async () => {
		let transport = new MemoryTransport();
		let response = await invite({ email: "no-es-un-email", kind: "" }, "es-AR", transport);
		let html = await response.text();

		expect(response.status).toBe(400);
		expect(transport.messages).toHaveLength(0);
		expect(html).toContain("Escribí un email válido, como nombre@ejemplo.com.");
		expect(html).toContain("Elegí qué estás organizando.");
		expect(html).toContain('value="no-es-un-email"');
	});

	test("answers a filled trap like a success without sending", async () => {
		let transport = new MemoryTransport();
		let response = await invite({}, "en", transport, "https://spam.example");

		expect(response.status).toBe(303);
		expect(transport.messages).toHaveLength(0);
	});
});
