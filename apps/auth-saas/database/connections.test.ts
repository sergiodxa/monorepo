/**
 * Drives the tenant Durable Object's connection RPC methods the way
 * `totp.test.ts` and `subjects.test.ts` drive their own: by construction,
 * against a real SQLite database, through `@sdxc/cloudflare-mocks`.
 *
 * Covers: a catalog-backed connection pre-fills its endpoints and only asks for
 * a client id and secret; a from-scratch connection validates every field its
 * kind requires; a mapping naming an unknown attribute is refused at save
 * time; a duplicate slug is refused, and so is changing an existing
 * connection's slug; `setConnectionEnabled(true)` refuses a connection with no
 * secret; `describeConnections` never exposes the sealed secret and lists
 * only enabled connections; `removeConnection` succeeds today with nothing to
 * check yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { beforeEach, describe, expect, test } from "vitest";

import type { SaveConnectionInput } from "./connections";

import Tenant from "./tenant-do";

let state: DurableObjectStateMock;
let tenant: Tenant;

beforeEach(async () => {
	state = createDurableObjectState();
	tenant = new Tenant(state, { TOTP_SEAL_KEY: randomToken({ bytes: 32 }) } as Cloudflare.Env);
	await tenant.provision({ tenantId: "ten_1", issuer: "https://acme.auth.example" });
});

/** The record `saveConnection` accepts for a from-scratch OAuth2 connection when a test does not care about most of it. */
function genericInput(overrides: Partial<SaveConnectionInput> = {}): SaveConnectionInput {
	return {
		slug: "acme-oauth",
		displayName: "Acme OAuth",
		kind: "oauth2",
		authorizationEndpoint: "https://provider.example/authorize",
		tokenEndpoint: "https://provider.example/token",
		userinfoEndpoint: "https://provider.example/userinfo",
		clientId: "client-123",
		clientSecret: "shh-secret",
		callbackOrigin: "https://acme.auth.example.com",
		...overrides,
	};
}

describe("saveConnection", () => {
	test("a catalog-backed connection pre-fills its endpoints and only asks for a client id and secret", async () => {
		let saved = await tenant.saveConnection({
			slug: "acme-google",
			catalogEntry: "google",
			clientId: "google-client-id",
			clientSecret: "google-client-secret",
			callbackOrigin: "https://acme.auth.example",
		});

		expect(saved).toMatchObject({
			ok: true,
			connection: {
				slug: "acme-google",
				kind: "oidc",
				catalogEntry: "google",
				displayName: "Google",
				enabled: false,
				issuer: "https://accounts.google.com",
				authorizationEndpoint: null,
				tokenEndpoint: null,
				userinfoEndpoint: null,
				clientId: "google-client-id",
				hasClientSecret: true,
				scopes: ["openid", "email", "profile"],
				subjectClaim: "sub",
				emailAuthority: true,
			},
			callbackUrl: "https://acme.auth.example/u/connections/acme-google/callback",
		});

		if (!saved.ok) throw new Error("unreachable");
		expect(JSON.stringify(saved.connection)).not.toContain("google-client-secret");
	});

	test("a catalog-backed connection may override its default scopes", async () => {
		let saved = await tenant.saveConnection({
			slug: "acme-google-scoped",
			catalogEntry: "google",
			clientId: "google-client-id",
			clientSecret: "google-client-secret",
			scopes: ["openid", "email"],
			callbackOrigin: "https://acme.auth.example",
		});

		expect(saved).toMatchObject({ ok: true, connection: { scopes: ["openid", "email"] } });
	});

	test("refuses an unknown catalog entry", async () => {
		let saved = await tenant.saveConnection({
			slug: "acme-unknown",
			catalogEntry: "not-a-real-provider",
			clientId: "client-id",
			callbackOrigin: "https://acme.auth.example",
		});

		expect(saved).toMatchObject({ ok: false, reason: "unknown-catalog-entry" });
	});

	test("a from-scratch OIDC connection requires an issuer", async () => {
		let saved = await tenant.saveConnection(
			genericInput({ kind: "oidc", authorizationEndpoint: undefined, issuer: undefined }),
		);

		expect(saved).toMatchObject({ ok: false, reason: "missing-issuer" });
	});

	test("a from-scratch OAuth2 connection requires every endpoint", async () => {
		let saved = await tenant.saveConnection(genericInput({ tokenEndpoint: undefined }));

		expect(saved).toMatchObject({
			ok: false,
			reason: "missing-endpoint",
			endpoint: "tokenEndpoint",
		});
	});

	test("a from-scratch connection with no catalog entry requires a kind", async () => {
		let saved = await tenant.saveConnection(genericInput({ kind: undefined }));

		expect(saved).toMatchObject({ ok: false, reason: "missing-kind" });
	});

	test("writes a from-scratch connection disabled, with its whole shape", async () => {
		let saved = await tenant.saveConnection(genericInput());

		expect(saved).toMatchObject({
			ok: true,
			connection: {
				slug: "acme-oauth",
				kind: "oauth2",
				catalogEntry: null,
				enabled: false,
				authorizationEndpoint: "https://provider.example/authorize",
				tokenEndpoint: "https://provider.example/token",
				userinfoEndpoint: "https://provider.example/userinfo",
				hasClientSecret: true,
			},
		});
	});

	test("refuses a duplicate slug", async () => {
		await tenant.saveConnection(genericInput());
		let second = await tenant.saveConnection(genericInput({ displayName: "Someone Else" }));

		expect(second).toMatchObject({ ok: false, reason: "duplicate-slug" });
	});

	test("refuses changing an existing connection's slug", async () => {
		let created = await tenant.saveConnection(genericInput());
		if (!created.ok) throw new Error("unreachable");

		let updated = await tenant.saveConnection(
			genericInput({ connectionId: created.connection.id, slug: "renamed-slug" }),
		);

		expect(updated).toMatchObject({ ok: false, reason: "slug-immutable" });
	});

	test("updates an existing connection in place, keeping its sealed secret when none is given again", async () => {
		let created = await tenant.saveConnection(genericInput());
		if (!created.ok) throw new Error("unreachable");

		let updated = await tenant.saveConnection(
			genericInput({
				connectionId: created.connection.id,
				displayName: "Acme OAuth Renamed",
				clientSecret: undefined,
			}),
		);

		expect(updated).toMatchObject({
			ok: true,
			connection: { displayName: "Acme OAuth Renamed", hasClientSecret: true },
		});
	});

	test("saves a connection with no secret yet", async () => {
		let saved = await tenant.saveConnection(genericInput({ clientSecret: undefined }));

		expect(saved).toMatchObject({ ok: true, connection: { hasClientSecret: false } });
	});

	test("refuses a mapping naming an unknown attribute key", async () => {
		let saved = await tenant.saveConnection(
			genericInput({
				mappings: [{ source: "department", target: "department", apply: "on-create" }],
			}),
		);

		expect(saved).toMatchObject({
			ok: false,
			reason: "unknown-mapping-target",
			target: "department",
		});
	});

	test("accepts a mapping onto a standard profile column", async () => {
		let saved = await tenant.saveConnection(
			genericInput({
				mappings: [{ source: "given_name", target: "givenName", apply: "on-every-sign-in" }],
			}),
		);

		expect(saved).toMatchObject({
			ok: true,
			connection: {
				mappings: [{ source: "given_name", target: "givenName", apply: "on-every-sign-in" }],
			},
		});
	});

	test("accepts a mapping onto a declared attribute key once it is defined", async () => {
		await tenant.defineAttribute({ key: "department", type: "string", visibility: "claim" });

		let saved = await tenant.saveConnection(
			genericInput({
				mappings: [{ source: "department", target: "department", apply: "on-create" }],
			}),
		);

		expect(saved).toMatchObject({
			ok: true,
			connection: {
				mappings: [{ source: "department", target: "department", apply: "on-create" }],
			},
		});
	});
});

describe("setConnectionEnabled", () => {
	test("refuses to enable a connection with no client secret sealed", async () => {
		let created = await tenant.saveConnection(genericInput({ clientSecret: undefined }));
		if (!created.ok) throw new Error("unreachable");

		let enabled = await tenant.setConnectionEnabled({
			slug: created.connection.slug,
			enabled: true,
		});

		expect(enabled).toMatchObject({ ok: false, reason: "missing-secret" });
	});

	test("enables a connection once it holds a sealed secret", async () => {
		let created = await tenant.saveConnection(genericInput());
		if (!created.ok) throw new Error("unreachable");

		let enabled = await tenant.setConnectionEnabled({
			slug: created.connection.slug,
			enabled: true,
		});

		expect(enabled).toMatchObject({ ok: true, connection: { enabled: true } });
	});

	test("disables an enabled connection", async () => {
		let created = await tenant.saveConnection(genericInput());
		if (!created.ok) throw new Error("unreachable");

		await tenant.setConnectionEnabled({ slug: created.connection.slug, enabled: true });
		let disabled = await tenant.setConnectionEnabled({
			slug: created.connection.slug,
			enabled: false,
		});

		expect(disabled).toMatchObject({ ok: true, connection: { enabled: false } });
	});

	test("refuses an unknown slug", async () => {
		let result = await tenant.setConnectionEnabled({ slug: "no-such-slug", enabled: true });
		expect(result).toMatchObject({ ok: false, reason: "not-found" });
	});
});

describe("describeConnections", () => {
	test("lists only enabled connections, and never the sealed secret", async () => {
		let enabledOne = await tenant.saveConnection(genericInput({ slug: "enabled-one" }));
		let disabledOne = await tenant.saveConnection(genericInput({ slug: "disabled-one" }));
		if (!enabledOne.ok || !disabledOne.ok) throw new Error("unreachable");

		await tenant.setConnectionEnabled({ slug: "enabled-one", enabled: true });

		let described = await tenant.describeConnections({});

		expect(described.connections).toHaveLength(1);
		expect(described.connections[0]).toMatchObject({ slug: "enabled-one", enabled: true });
		expect(JSON.stringify(described.connections)).not.toContain("shh-secret");
		for (let connection of described.connections) {
			expect(connection).not.toHaveProperty("clientSecret");
			expect(connection).not.toHaveProperty("clientSecretSealed");
		}
	});

	test("answers no connections for a tenant that has configured none", async () => {
		let described = await tenant.describeConnections({});
		expect(described.connections).toEqual([]);
	});
});

describe("removeConnection", () => {
	test("removes a connection with nothing yet to check it against", async () => {
		let created = await tenant.saveConnection(genericInput());
		if (!created.ok) throw new Error("unreachable");

		let removed = await tenant.removeConnection({
			slug: created.connection.slug,
			unlinkIdentities: false,
		});

		expect(removed).toMatchObject({ ok: true });

		let enabled = await tenant.setConnectionEnabled({
			slug: created.connection.slug,
			enabled: true,
		});
		expect(enabled).toMatchObject({ ok: false, reason: "not-found" });
	});

	test("refuses an unknown slug", async () => {
		let result = await tenant.removeConnection({ slug: "no-such-slug", unlinkIdentities: false });
		expect(result).toMatchObject({ ok: false, reason: "not-found" });
	});
});
