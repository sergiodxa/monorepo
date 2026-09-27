/**
 * Drives the magic-link leg of the hosted flow through a real tenant router:
 * the request step renders the identical confirmation whether or not the
 * address resolves, the link and the code both complete a real sign-in, a
 * wrong browser and a wrong code each land on their own distinct screen, and
 * the Worker-level per-address budget refuses over its own limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { NormalizedMessage } from "@sdxc/mail";
import type { MemoryTransport } from "@sdxc/mail/memory";
import type { RateLimitKVNamespace } from "@sdxc/rate-limit";
import type { Middleware, RequestHandler } from "remix/router";

import { totp } from "@sdxc/crypto";
import { MemoryTransport as MemoryMailTransport } from "@sdxc/mail/memory";
import mail from "@sdxc/mail/middleware";
import { isFailure } from "@sdxc/result";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import type { Harness } from "~/app/http/controllers/hosted/test-harness";
import type Tenant from "~/database/tenant-do";

import {
	buildHarness,
	cookieFrom,
	createTestClient,
	createTestSubjectWithPassword,
	REDIRECT_URI,
} from "~/app/http/controllers/hosted/test-harness";
import i18n from "~/app/http/middleware/i18n";
import { platformSender } from "~/app/http/middleware/mail-sender";
import render from "~/app/http/middleware/render";
import { tenant } from "~/app/http/middleware/tenant";
import { magicLinkRateLimit } from "~/app/http/middleware/tenant-rate-limit";
import { MagicLinkNoAccountEmail } from "~/app/mail/magic-link-no-account-email";
import { MagicLinkSignInEmail } from "~/app/mail/magic-link-sign-in-email";
import routes from "~/routes/tenant";

import { magicLinkSubmit } from "./magic-link";

let harness: Harness;

beforeEach(async () => {
	harness = await buildHarness();
});

/** A valid `/authorize` query for the given client, everything else defaulted. */
function authorizeQuery(clientId: string): string {
	return new URLSearchParams({
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		response_type: "code",
		scope: "openid",
		code_challenge: "a-valid-looking-challenge",
		code_challenge_method: "S256",
	}).toString();
}

/** Begins authorization and returns the `/u/magic-link` path parked against that interaction. */
async function reachMagicLinkRequest(
	harnessValue: Harness,
	clientId: string,
): Promise<{ magicLinkPath: string; interactionId: string }> {
	let response = await harnessValue.router.fetch(
		harnessValue.request(`/authorize?${authorizeQuery(clientId)}`),
	);
	let location = new URL(response.headers.get("Location") ?? "", REDIRECT_URI);
	let interactionId = location.searchParams.get("interaction");
	if (!interactionId) throw new Error("expected an interaction id");
	return { magicLinkPath: `/u/magic-link?interaction=${interactionId}`, interactionId };
}

function form(fields: Record<string, string>): FormData {
	let body = new FormData();
	for (let [key, value] of Object.entries(fields)) body.set(key, value);
	return body;
}

/** Pulls the mailed link's absolute URL out of the message's own HTML body. */
function extractMagicLinkUrl(message: NormalizedMessage): string {
	let html = message.html ?? "";
	let match = /href="([^"]*\/u\/magic-link\/complete\?token=[^"]+)"/.exec(html);
	if (!match?.[1]) throw new Error("expected a magic-link URL in the sent message");
	return match[1];
}

/** Pulls the mailed eight-character code out of the message's own text body. */
function extractMagicLinkCode(message: NormalizedMessage): string {
	let text = message.text ?? "";
	let match = /\b[0-9A-Z]{4}-[0-9A-Z]{4}\b/.exec(text);
	if (!match) throw new Error("expected a magic-link code in the sent message");
	return match[0];
}

/** Enrols and activates a TOTP factor for the subject. */
async function enrolFactor(harnessValue: Harness, subjectId: string): Promise<void> {
	let begun = await harnessValue.tenantDO.beginTotpEnrolment({ subjectId });
	if (!begun.ok) throw new Error("unreachable");

	let code = await totp.code(begun.setupKey);
	if (isFailure(code)) throw new Error("unreachable");

	let activated = await harnessValue.tenantDO.activateTotpFactor({
		enrolmentId: begun.enrolmentId,
		code: code.data,
	});
	if (!activated.ok) throw new Error("unreachable");
}

describe("magic-link", () => {
	test("a full request-then-link-complete round trip signs in with a real session cookie", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid"]);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "ada@example.com",
			password: "correct horse battery staple",
		});
		let { magicLinkPath } = await reachMagicLinkRequest(harness, client.id);

		let submitted = await harness.router.fetch(
			harness.request(magicLinkPath, { method: "POST", body: form({ email: "ada@example.com" }) }),
		);
		expect(submitted.status).toBe(200);
		let nonceCookie = cookieFrom(submitted);

		let transport = harness.mailTransport as MemoryTransport;
		expect(transport.last?.email).toBeInstanceOf(MagicLinkSignInEmail);
		let url = extractMagicLinkUrl(transport.last as NormalizedMessage);
		let landingPath = new URL(url).pathname + new URL(url).search;

		let landing = await harness.router.fetch(harness.request(landingPath, { cookie: nonceCookie }));
		expect(landing.status).toBe(200);
		expect(landing.headers.get("Referrer-Policy")).toBe("no-referrer");

		let token = new URL(url).searchParams.get("token") as string;
		let completed = await harness.router.fetch(
			harness.request(routes.hostedMagicLinkCompleteSubmit.href(), {
				method: "POST",
				body: form({ token }),
				cookie: nonceCookie,
			}),
		);

		expect(completed.status).toBe(302);
		expect(completed.headers.get("Set-Cookie")).toMatch(/^__Host-session=/);
	});

	test("a full request-then-code-complete round trip signs in with a real session cookie", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid"]);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "grace@example.com",
			password: "correct horse battery staple",
		});
		let { magicLinkPath } = await reachMagicLinkRequest(harness, client.id);

		let submitted = await harness.router.fetch(
			harness.request(magicLinkPath, {
				method: "POST",
				body: form({ email: "grace@example.com" }),
			}),
		);
		let nonceCookie = cookieFrom(submitted);

		let transport = harness.mailTransport as MemoryTransport;
		let code = extractMagicLinkCode(transport.last as NormalizedMessage);

		let completed = await harness.router.fetch(
			harness.request(routes.hostedMagicLinkCompleteSubmit.href(), {
				method: "POST",
				body: form({ code }),
				cookie: nonceCookie,
			}),
		);

		expect(completed.status).toBe(302);
		expect(completed.headers.get("Set-Cookie")).toMatch(/^__Host-session=/);
	});

	test("an unknown address gets the same confirmation page and status as a known address, but a no_account email", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid"]);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let { magicLinkPath: pathA } = await reachMagicLinkRequest(harness, client.id);
		let known = await harness.router.fetch(
			harness.request(pathA, { method: "POST", body: form({ email: "jane@example.com" }) }),
		);

		let { magicLinkPath: pathB } = await reachMagicLinkRequest(harness, client.id);
		let unknown = await harness.router.fetch(
			harness.request(pathB, { method: "POST", body: form({ email: "nobody@example.com" }) }),
		);

		expect(known.status).toBe(unknown.status);
		let [knownBody, unknownBody] = await Promise.all([known.text(), unknown.text()]);
		// The code field's label/input pair carries a fresh accessibility id each
		// render, unrelated to anything this response is asserting uniform, so it
		// is normalized out before the two bodies are compared.
		let normalizeRenderIds = (html: string) => html.replace(/"s[0-9a-f]+-\d+"/g, '"s-id"');
		expect(normalizeRenderIds(knownBody)).toBe(normalizeRenderIds(unknownBody));

		let transport = harness.mailTransport as MemoryTransport;
		expect(transport.messages).toHaveLength(2);
		expect(transport.messages[0]?.email).toBeInstanceOf(MagicLinkSignInEmail);
		expect(transport.messages[1]?.email).toBeInstanceOf(MagicLinkNoAccountEmail);
	});

	test("a wrong-browser link landing renders the distinct guidance rather than a plain invalid screen", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid"]);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "hedy@example.com",
			password: "correct horse battery staple",
		});

		let { magicLinkPath: pathA } = await reachMagicLinkRequest(harness, client.id);
		await harness.router.fetch(
			harness.request(pathA, { method: "POST", body: form({ email: "hedy@example.com" }) }),
		);
		let transport = harness.mailTransport as MemoryTransport;
		let url = extractMagicLinkUrl(transport.last as NormalizedMessage);
		let token = new URL(url).searchParams.get("token") as string;

		let { magicLinkPath: pathB } = await reachMagicLinkRequest(harness, client.id);
		let submittedB = await harness.router.fetch(
			harness.request(pathB, { method: "POST", body: form({ email: "nobody-else@example.com" }) }),
		);
		let otherNonceCookie = cookieFrom(submittedB);

		let completed = await harness.router.fetch(
			harness.request(routes.hostedMagicLinkCompleteSubmit.href(), {
				method: "POST",
				body: form({ token }),
				cookie: otherNonceCookie,
			}),
		);

		expect(completed.status).toBe(400);
		let body = await completed.text();
		expect(body).toContain("Open this on the device you requested it from");
	});

	test("a wrong code decrements attempts and eventually locks out through the real HTTP surface", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid"]);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "katherine@example.com",
			password: "correct horse battery staple",
		});
		let { magicLinkPath } = await reachMagicLinkRequest(harness, client.id);

		let submitted = await harness.router.fetch(
			harness.request(magicLinkPath, {
				method: "POST",
				body: form({ email: "katherine@example.com" }),
			}),
		);
		let nonceCookie = cookieFrom(submitted);

		async function attemptWrongCode() {
			return harness.router.fetch(
				harness.request(routes.hostedMagicLinkCompleteSubmit.href(), {
					method: "POST",
					body: form({ code: "0000-0000" }),
					cookie: nonceCookie,
				}),
			);
		}

		let first = await attemptWrongCode();
		let second = await attemptWrongCode();
		let third = await attemptWrongCode();
		let fourth = await attemptWrongCode();
		let fifth = await attemptWrongCode();
		let sixth = await attemptWrongCode();

		expect(first.status).toBe(400);
		expect(second.status).toBe(400);
		expect(third.status).toBe(400);
		expect(fourth.status).toBe(400);
		expect(fifth.status).toBe(400);
		expect(sixth.status).toBe(400);

		let fifthBody = await fifth.text();
		let sixthBody = await sixth.text();
		expect(fifthBody).toContain("This link no longer works");
		expect(sixthBody).toContain("This link no longer works");
	});

	test("a magic-link sign-in needing a second factor redirects into the second-factor flow", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid"]);
		let subjectId = await createTestSubjectWithPassword(harness.tenantDO, {
			email: "grace-hopper@example.com",
			password: "correct horse battery staple",
		});
		await enrolFactor(harness, subjectId);

		let { magicLinkPath, interactionId } = await reachMagicLinkRequest(harness, client.id);
		let submitted = await harness.router.fetch(
			harness.request(magicLinkPath, {
				method: "POST",
				body: form({ email: "grace-hopper@example.com" }),
			}),
		);
		let nonceCookie = cookieFrom(submitted);

		let transport = harness.mailTransport as MemoryTransport;
		let code = extractMagicLinkCode(transport.last as NormalizedMessage);

		let completed = await harness.router.fetch(
			harness.request(routes.hostedMagicLinkCompleteSubmit.href(), {
				method: "POST",
				body: form({ code }),
				cookie: nonceCookie,
			}),
		);

		expect(completed.status).toBe(302);
		let location = completed.headers.get("Location") ?? "";
		expect(location).toContain("/u/second-factor");
		expect(location).toContain(`interaction=${interactionId}`);
		expect(location).toContain("mode=prove");
		expect(completed.headers.get("Set-Cookie")).toMatch(/^__Host-session=/);
	});

	test("Referrer-Policy: no-referrer is on every screen of the flow, the link-landing GET included", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid"]);
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "margaret@example.com",
			password: "correct horse battery staple",
		});
		let { magicLinkPath } = await reachMagicLinkRequest(harness, client.id);

		let requestShow = await harness.router.fetch(harness.request(magicLinkPath));
		expect(requestShow.headers.get("Referrer-Policy")).toBe("no-referrer");

		let submitted = await harness.router.fetch(
			harness.request(magicLinkPath, {
				method: "POST",
				body: form({ email: "margaret@example.com" }),
			}),
		);
		expect(submitted.headers.get("Referrer-Policy")).toBe("no-referrer");

		let transport = harness.mailTransport as MemoryTransport;
		let url = extractMagicLinkUrl(transport.last as NormalizedMessage);
		let landingPath = new URL(url).pathname + new URL(url).search;

		let landing = await harness.router.fetch(harness.request(landingPath));
		expect(landing.headers.get("Referrer-Policy")).toBe("no-referrer");
	});
});

describe("magicLinkSubmit under magicLinkRateLimit", () => {
	/** A KV namespace double backed by a Map, the way `tenant-rate-limit.test.ts`'s own fake works. */
	function memoryKv(): RateLimitKVNamespace {
		let entries = new Map<string, string>();
		return {
			async get(key) {
				return entries.get(key) ?? null;
			},
			async put(key, value) {
				entries.set(key, value);
			},
			async delete(key) {
				entries.delete(key);
			},
		};
	}

	test("refuses a connecting address spraying many addresses past the Worker-level budget", async () => {
		let client = await createTestClient(harness.tenantDO, ["openid"]);
		let { interactionId } = await reachMagicLinkRequest(harness, client.id);

		let testSender = { email: "no-reply@example.com", name: "Test Sender" };
		let middleware: Middleware[] = [
			tenant(() => harness.tenantDO as unknown as DurableObjectStub<Tenant>),
			render as Middleware,
			formData() as Middleware,
			i18n as Middleware,
			platformSender(testSender),
			mail({ transport: new MemoryMailTransport(), from: testSender }) as Middleware,
		];
		let router = createRouter({ middleware });
		router.map(routes.hostedMagicLinkSubmit, {
			middleware: [magicLinkRateLimit(memoryKv())],
			handler: magicLinkSubmit as RequestHandler,
		});

		function attempt(email: string) {
			let body = new URLSearchParams({ email });
			return router.fetch(
				harness.request(`/u/magic-link?interaction=${interactionId}`, {
					method: "POST",
					body,
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
				}),
			);
		}

		let responses: Response[] = [];
		for (let i = 0; i < 11; i += 1) {
			responses.push(await attempt(`address-${i}@example.com`));
		}

		let statuses = responses.map((response) => response.status);
		expect(statuses.slice(0, 10).every((status) => status !== 429)).toBe(true);
		expect(statuses.at(-1)).toBe(429);
	});
});
