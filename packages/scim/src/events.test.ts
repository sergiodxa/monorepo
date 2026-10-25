/**
 * Tests for RFC 9967 SCIM events: each builder against the RFC's figures, the token's
 * `secevent+jwt` signing and verification through `@sdxc/jwt`, and the asynchronous
 * request's `Prefer` reading and `202 Accepted` answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK, JWT, SecurityEventToken } from "@sdxc/jwt";
import { describe, expect, test } from "vitest";

import {
	acceptedResponse,
	createScimEvent,
	EVENT_URIS,
	prefersAsync,
	ScimEventToken,
	scimEvents,
} from "./events.js";
import {
	ASYNC_ERROR,
	ASYNC_RESPONSE,
	CREATE_FULL,
	CREATE_NOTICE,
	DELETE,
	PATCH_FULL,
	PATCH_NOTICE,
} from "./fixtures/rfc9967-events.js";

import { ScimError } from "./index.js";

/** A compact token's protected header, decoded from its base64url first segment. */
function header(token: string): Record<string, unknown> {
	let segment = (token.split(".")[0] ?? "").replaceAll("-", "+").replaceAll("_", "/");
	return JSON.parse(atob(segment)) as Record<string, unknown>;
}

/** The registered claims RFC 9967's figures share, as `createScimEvent` input. */
function common(fixture: { jti: string; iat: number; iss: string; aud: string[] }) {
	return {
		id: fixture.jti,
		issuedAt: new Date(fixture.iat * 1000),
		issuer: fixture.iss,
		audience: fixture.aud,
	};
}

describe("createScimEvent", () => {
	test("builds RFC 9967 Figure 4, a create:full event", () => {
		let { format: _, ...subject } = CREATE_FULL.sub_id;
		let token = createScimEvent({
			...common(CREATE_FULL),
			subject,
			events: [scimEvents.create({ data: CREATE_FULL.events[EVENT_URIS.createFull].data })],
		});
		expect(token.payload).toEqual(CREATE_FULL);
	});

	test("builds RFC 9967 Figure 5, a create:notice event", () => {
		let { format: _, ...subject } = CREATE_NOTICE.sub_id;
		let token = createScimEvent({
			...common(CREATE_NOTICE),
			subject,
			events: [scimEvents.create({ attributes: ["id", "name", "userName", "password", "emails"] })],
		});
		expect(token.payload).toEqual(CREATE_NOTICE);
	});

	test("builds RFC 9967 Figures 6 and 7, a patch in each mode with its version", () => {
		let { format: _, ...subject } = PATCH_FULL.sub_id;
		let version = "a330bc54f0671c9";
		let full = createScimEvent({
			...common(PATCH_FULL),
			subject,
			events: [scimEvents.patch({ data: PATCH_FULL.events[EVENT_URIS.patchFull].data, version })],
		});
		let notice = createScimEvent({
			...common(PATCH_NOTICE),
			subject,
			events: [scimEvents.patch({ attributes: ["members"], version })],
		});
		expect(full.payload).toEqual(PATCH_FULL);
		expect(notice.payload).toEqual(PATCH_NOTICE);
	});

	test("builds RFC 9967 Figure 10, a delete event with no payload", () => {
		let { format: _, ...subject } = DELETE.sub_id;
		let token = createScimEvent({ ...common(DELETE), subject, events: [scimEvents.delete()] });
		expect(token.payload).toEqual(DELETE);
	});

	test("builds RFC 9967 Figures 14 and 15, asynchronous completions with their txn", () => {
		let { format: _, ...subject } = ASYNC_RESPONSE.sub_id;
		let version = 'W/"huJj29dMNgu3WXPD"';
		let ok = createScimEvent({
			...common(ASYNC_RESPONSE),
			subject,
			transaction: ASYNC_RESPONSE.txn,
			events: [scimEvents.asyncResponse({ method: "PUT", status: 200, version })],
		});
		let failed = createScimEvent({
			...common(ASYNC_ERROR),
			subject,
			transaction: ASYNC_ERROR.txn,
			events: [
				scimEvents.asyncResponse({
					method: "PUT",
					status: 400,
					version,
					error: new ScimError(400, "Request is unparsable", { scimType: "invalidSyntax" }),
				}),
			],
		});
		expect(ok.payload).toEqual(ASYNC_RESPONSE);
		expect(failed.payload).toEqual(ASYNC_ERROR);
	});

	test("fills a fresh jti and the current iat, and never a sub claim", () => {
		let before = Math.floor(Date.now() / 1000);
		let token = createScimEvent({
			issuer: "https://scim.example.com",
			audience: "https://receiver.example.com",
			subject: { uri: "/Users/1" },
			events: [scimEvents.feedAdd()],
		});
		expect(token.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(token.issuedAt?.getTime()).toBeGreaterThanOrEqual(before * 1000);
		expect(token.payload).not.toHaveProperty("sub");
		expect(token.payload).not.toHaveProperty("txn");
		expect(token.events).toEqual({ [EVENT_URIS.feedAdd]: {} });
	});
});

describe("ScimEventToken", () => {
	test("signs as secevent+jwt and verifies back with its subject, txn and events", async () => {
		let keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
		let signed = await createScimEvent({
			issuer: "https://scim.example.com",
			audience: "https://receiver.example.com",
			subject: { uri: "/Users/1", externalId: "jdoe" },
			transaction: "txn-1",
			events: [scimEvents.deactivate()],
		}).sign(JWK.Algorithm.ES256, keys);

		expect(header(signed).typ).toBe("secevent+jwt");
		let token = await ScimEventToken.verify(signed, keys, {
			issuer: "https://scim.example.com",
			audience: "https://receiver.example.com",
		});
		expect(token.subjectId).toEqual({ format: "scim", uri: "/Users/1", externalId: "jdoe" });
		expect(token.transaction).toBe("txn-1");
		expect(token.events).toEqual({ [EVENT_URIS.deactivate]: {} });
	});

	test("refuses to verify a token of another type", async () => {
		let keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
		let plain = await new JWT({ events: { [EVENT_URIS.delete]: {} } }).sign(
			JWK.Algorithm.ES256,
			keys,
		);
		await expect(ScimEventToken.verify(plain, keys)).rejects.toThrow();
	});

	test("verifies as a SecurityEventToken, refusing a SET that carries exp", async () => {
		let keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
		let token = createScimEvent({
			issuer: "https://scim.example.com",
			audience: "https://receiver.example.com",
			subject: { uri: "/Users/1" },
			events: [scimEvents.delete()],
		});
		token.expirationTime = Math.floor(Date.now() / 1000) + 3600;

		expect(token).toBeInstanceOf(SecurityEventToken);
		await expect(
			ScimEventToken.verify(await token.sign(JWK.Algorithm.ES256, keys), keys),
		).rejects.toMatchObject({ claim: "exp" });
	});

	test("reads no subject from a sub_id in another format", () => {
		let token = new ScimEventToken({ sub_id: { format: "email", email: "a@example.com" } });
		expect(token.subjectId).toBeNull();
		expect(token.events).toEqual({});
	});
});

describe("asynchronous requests", () => {
	test("reads respond-async among the Prefer preferences", () => {
		let ask = (prefer: string) =>
			prefersAsync(new Request("https://example.com", { headers: { Prefer: prefer } }));
		expect(ask("respond-async")).toBe(true);
		expect(ask("return=minimal, Respond-Async; wait=10")).toBe(true);
		expect(ask("return=representation")).toBe(false);
		expect(prefersAsync(new Request("https://example.com"))).toBe(false);
	});

	test("answers RFC 9967 Figure 13's empty 202 with Set-Txn", async () => {
		let response = acceptedResponse({
			transaction: "734f0614e3274f288f93ac74119dcf78",
			location: "/Users/2819c223-7f76-453a-919d-413861904646",
		});
		expect(response.status).toBe(202);
		expect(Object.fromEntries(response.headers)).toEqual({
			"set-txn": "734f0614e3274f288f93ac74119dcf78",
			"preference-applied": "respond-async",
			location: "/Users/2819c223-7f76-453a-919d-413861904646",
		});
		expect(await response.text()).toBe("");
	});
});
