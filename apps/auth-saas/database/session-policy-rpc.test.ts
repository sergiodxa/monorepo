/**
 * Drives the tenant Durable Object's `setSessionPolicy` and `describeSessionPolicy`
 * RPC methods by construction, the same way `tenant-do.test.ts` drives every other
 * method — through `@sdxc/cloudflare-mocks` rather than a stubbed namespace. Kept as
 * its own file so `tenant-do.test.ts` does not have to carry this pass's whole surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { beforeEach, describe, expect, test } from "vitest";

import {
	CONCURRENT_SESSION_LIMIT_CEILING,
	CONCURRENT_SESSION_LIMIT_FLOOR,
	SESSION_ABSOLUTE_LIFETIME_CEILING_MS,
	SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
	SESSION_ABSOLUTE_LIFETIME_FLOOR_MS,
	SESSION_IDLE_LIFETIME_DEFAULT_MS,
} from "./session-policy";
import Tenant from "./tenant-do";

let state: DurableObjectStateMock;
let tenant: Tenant;

let actor = { type: "platform" as const, id: "system" };

beforeEach(async () => {
	state = createDurableObjectState();
	tenant = new Tenant(state, {} as Cloudflare.Env);
	await tenant.provision({ tenantId: "tenant_1", issuer: "https://tenant-1.example.com" });
});

/** Creates a subject with a verified email and a set password, ready to sign in with. */
async function createSubjectWithPassword(email: string, password: string): Promise<string> {
	let created = await tenant.createSubject({ identifiers: [{ kind: "email", value: email }] });
	if (!created.ok) throw new Error("unreachable");

	let added = await tenant.addIdentifier({
		subjectId: created.subjectId,
		kind: "email",
		value: email,
		actor: { kind: "subject" },
	});
	if (!added.ok || added.kind !== "email") throw new Error("unreachable");

	await tenant.verifyIdentifier({ ticket: added.ticket });

	let written = await tenant.setPassword({
		subjectId: created.subjectId,
		password,
		actor: { kind: "subject" },
	});
	if (!written.ok) throw new Error("unreachable");

	return created.subjectId;
}

/** Grants (or, passing no features, lapses) the `session_policy` entitlement. */
async function setEntitlement(hasEntitlement: boolean): Promise<void> {
	await tenant.applyEntitlements({
		plan: hasEntitlement ? "pro" : "free",
		features: hasEntitlement ? { session_policy: true } : {},
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});
}

describe("describeSessionPolicy", () => {
	test("a freshly provisioned tenant reports every field's platform default, sourced from the default", async () => {
		let described = await tenant.describeSessionPolicy({});

		expect(described).toMatchObject({
			absoluteLifetimeMs: { value: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS, source: "default" },
			idleLifetimeMs: { value: SESSION_IDLE_LIFETIME_DEFAULT_MS, source: "default" },
			concurrentSessionLimit: { value: null, source: "default" },
			sessionsAfterCredentialChange: { value: "revoke-others", source: "default" },
			bounds: {
				absoluteLifetimeMs: {
					floor: SESSION_ABSOLUTE_LIFETIME_FLOOR_MS,
					ceiling: SESSION_ABSOLUTE_LIFETIME_CEILING_MS,
					default: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
				},
				concurrentSessionLimit: {
					floor: CONCURRENT_SESSION_LIMIT_FLOOR,
					ceiling: CONCURRENT_SESSION_LIMIT_CEILING,
					default: null,
				},
			},
		});
	});

	test("reads open on every tier: a non-entitled tenant still answers its own (default) posture", async () => {
		await setEntitlement(false);

		let described = await tenant.describeSessionPolicy({});

		expect(described.absoluteLifetimeMs).toEqual({
			value: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			source: "default",
		});
	});

	test("an entitled tenant's own stored customization is in force and sourced from the tenant, even one looser than the default", async () => {
		await setEntitlement(true);

		await tenant.setSessionPolicy({
			policy: { absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS + 60 * 60 * 1000 },
			actor,
		});

		let described = await tenant.describeSessionPolicy({});

		expect(described.absoluteLifetimeMs).toEqual({
			value: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS + 60 * 60 * 1000,
			source: "tenant",
		});
	});

	test("once the entitlement lapses, a stored value tighter than the default stays in force, sourced from the tenant", async () => {
		await setEntitlement(true);
		await tenant.setSessionPolicy({
			policy: { absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_FLOOR_MS },
			actor,
		});

		await setEntitlement(false);

		let described = await tenant.describeSessionPolicy({});

		expect(described.absoluteLifetimeMs).toEqual({
			value: SESSION_ABSOLUTE_LIFETIME_FLOOR_MS,
			source: "tenant",
		});
	});

	test("once the entitlement lapses, a stored value looser than the default falls back to the default, sourced from the default", async () => {
		await setEntitlement(true);
		await tenant.setSessionPolicy({
			policy: { absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS + 60 * 60 * 1000 },
			actor,
		});

		await setEntitlement(false);

		let described = await tenant.describeSessionPolicy({});

		expect(described.absoluteLifetimeMs).toEqual({
			value: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			source: "default",
		});
	});
});

describe("setSessionPolicy", () => {
	test("refuses an out-of-bounds value, naming the field and the bound it violated", async () => {
		let result = await tenant.setSessionPolicy({
			policy: { absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_FLOOR_MS - 1 },
			actor,
		});

		expect(result).toMatchObject({ ok: false, field: "absoluteLifetimeMs" });
		if (result.ok) throw new Error("unreachable");
		expect(result.message).toContain(String(SESSION_ABSOLUTE_LIFETIME_FLOOR_MS));
	});

	test("writes only the given field, leaving every other column untouched", async () => {
		await setEntitlement(true);

		await tenant.setSessionPolicy({ policy: { concurrentSessionLimit: 3 }, actor });
		let result = await tenant.setSessionPolicy({
			policy: { absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS + 1000 },
			actor,
		});

		expect(result).toMatchObject({
			ok: true,
			policy: {
				sessionAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS + 1000,
				concurrentSessionLimit: 3,
			},
		});
	});

	test("reports the count of live sessions a shortened lifetime would end", async () => {
		await setEntitlement(true);
		let subjectId = await createSubjectWithPassword(
			"jane@example.com",
			"correct horse battery staple",
		);

		let signedIn = await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "correct horse battery staple",
			remembered: false,
		});
		expect(signedIn).toMatchObject({ ok: true, subjectId });

		let result = await tenant.setSessionPolicy({
			policy: { absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_FLOOR_MS },
			actor,
		});

		expect(result).toMatchObject({ ok: true, sessionsShortened: 1 });
	});

	test("reports zero for a lengthened lifetime, which ends nothing", async () => {
		await setEntitlement(true);
		await createSubjectWithPassword("jane@example.com", "correct horse battery staple");

		await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "correct horse battery staple",
			remembered: false,
		});

		let result = await tenant.setSessionPolicy({
			policy: { absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS + 60 * 60 * 1000 },
			actor,
		});

		expect(result).toMatchObject({ ok: true, sessionsShortened: 0 });
	});

	test("writes an audit row naming the actor and which fields moved", async () => {
		await setEntitlement(true);

		await tenant.setSessionPolicy({
			policy: { absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_FLOOR_MS },
			actor,
		});

		let page = await tenant.readAuditPage({
			from: 0,
			to: Date.now() + 60_000,
			action: "session_policy.changed",
		});
		if (!page.ok) throw new Error("unreachable");

		expect(page.events).toMatchObject([
			{
				actorType: "platform",
				actorId: "system",
				outcome: "succeeded",
				detail: {
					changed: {
						absoluteLifetimeMs: { from: null, to: SESSION_ABSOLUTE_LIFETIME_FLOOR_MS },
					},
				},
			},
		]);
	});
});
