/**
 * Drives `POST /invitations/accept` through a real router, standing the route
 * up the same way `bootstrap/management-app.ts` itself mounts it: no bearer
 * token, the invitation's own token as the whole credential. A full
 * invite-then-accept round trip creates a real membership and signs the
 * invited address into the platform dashboard; accepting the same token twice,
 * an unknown token, and an expired one all answer the same refusal; and
 * accepting a second invitation for an address that already holds a platform
 * dashboard subject reuses it rather than minting a duplicate.
 *
 * `cloudflare:workers` is mocked with a real, freshly-constructed platform
 * tenant object routed through `TENANT.getByName`, the same way
 * `subjects/export.test.ts` already stands in for a Durable Object reached
 * from outside itself — `accept.ts` reads `env.TENANT` at call time and, through
 * `session-cookie.ts`, `env.SESSION_SECRET` at module load time, so the mock is
 * installed before anything downstream of it is imported.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	createDurableObjectNamespace,
	createDurableObjectState,
	createEnv,
} from "@sdxc/cloudflare-mocks";
import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { isFailure, unwrap } from "@sdxc/result";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Models } from "~/app/models";
import type Tenant from "~/database/tenant-do";

const PLATFORM_DOMAIN = "auth.sergiodxa.com";

/** Replaced fresh in `beforeEach`; the mock below closes over this one reference. */
let platformTenantDO: InstanceType<typeof Tenant>;

/**
 * Binds the RPC methods `accept.ts` calls through the namespace as the
 * platform tenant object's own properties — `Object.assign` in
 * `createDurableObjectNamespace`'s own stub wrapper only copies own
 * properties, so a class instance's prototype methods need binding here the
 * same way `subjects/export.test.ts` already binds `exportSubjectPage`.
 */
function platformTenantStub(tenantDO: InstanceType<typeof Tenant>) {
	return {
		findSubjectByVerifiedEmail: tenantDO.findSubjectByVerifiedEmail.bind(tenantDO),
		createSubject: tenantDO.createSubject.bind(tenantDO),
		openSessionForSubject: tenantDO.openSessionForSubject.bind(tenantDO),
	};
}

/**
 * Built once, module scope, since `vi.doMock` only runs its factory once — every
 * test's own fresh `platformTenantDO` needs {@link tenantNamespace.reset} in
 * `beforeEach`, or a later test resolves the first test's own cached stub
 * instead of its own.
 */
let tenantNamespace = createDurableObjectNamespace<Tenant>((name) =>
	name === PLATFORM_DOMAIN ? platformTenantStub(platformTenantDO) : {},
);

vi.doMock("cloudflare:workers", async (importOriginal) => {
	let actual = await importOriginal<typeof import("cloudflare:workers")>();
	return {
		...actual,
		env: createEnv<Cloudflare.Env>({
			PLATFORM_DOMAIN,
			SESSION_SECRET: "test-session-secret",
			TENANT: tenantNamespace,
		}),
	};
});

let { conformance } = await import("~/app/http/controllers/management/test-harness");
let { database } = await import("~/app/http/middleware/database");
let { models: modelsMiddleware } = await import("~/app/http/middleware/models");
let { sessionCookie } = await import("~/app/lib/session-cookie");
let invitationsAccept = (await import("~/app/http/controllers/management/invitations/accept"))
	.default;
let routes = (await import("~/routes/management")).default;
let { createTestDatabase } = await import("~/app/test/db");
let { bindModels } = await import("~/app/test/models");
let TenantObject = (await import("~/database/tenant-do")).default;

let db: Awaited<ReturnType<typeof createTestDatabase>>;

let models: Models;

beforeEach(async () => {
	db = await createTestDatabase();
	models = bindModels(db);

	let state = createDurableObjectState();
	platformTenantDO = new TenantObject(state, {
		TOTP_SEAL_KEY: randomToken({ bytes: 32 }),
	} as Cloudflare.Env);
	tenantNamespace.reset();
});

/** Builds a router mapping only `invitationsAccept`, with no auth middleware, matching how it is mounted for real. */
function buildRouter() {
	let router = createRouter({ middleware: [conformance, database(() => db), modelsMiddleware()] });
	router.map(routes.invitationsAccept, invitationsAccept);
	return router;
}

/** Mints a tenant and an open invitation against it, returning the plaintext token. */
async function mintInvitation(
	overrides: {
		email?: string;
		role?: "owner" | "admin" | "member";
		expiresAt?: number;
	} = {},
) {
	let unique = crypto.randomUUID();
	let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
	let tenant = unwrap(
		await models.tenants.create({
			customer_id: customer.id,
			name: "Acme, Inc.",
			slug: `acme-${unique}`,
			issuer: `https://${unique}.example.com`,
		}),
	);

	let token = randomToken({ bytes: 32 });
	let hashed = await sha256(token);
	if (isFailure(hashed)) throw new Error("unreachable: token hashing failed");
	let tokenHash = Hex.encode(hashed.data);

	let invitation = unwrap(
		await models.tenantMemberInvitations.create({
			tenant_id: tenant.id,
			email: overrides.email ?? "jane@example.com",
			role: overrides.role ?? "admin",
			token_hash: tokenHash,
			invited_by: "sub_1",
			expires_at: overrides.expiresAt ?? Date.now() + 60_000,
		}),
	);

	return { tenant, invitation, token };
}

/** Posts a token to `/invitations/accept`. */
function acceptRequest(token: string): Request {
	return new Request("https://api.example.com/invitations/accept", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ token }),
	});
}

describe("POST /invitations/accept", () => {
	test("a full invite-then-accept round trip creates a membership and signs the person in", async () => {
		let { tenant, token } = await mintInvitation({ role: "admin" });

		let response = await buildRouter().fetch(acceptRequest(token));

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ tenantId: tenant.id, role: "admin" });
		expect(body).not.toHaveProperty("subjectId");

		let setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toMatch(/^__Host-session=/);

		let sessionToken = await sessionCookie.parse(setCookie?.split(";")[0] ?? null);
		expect(sessionToken).not.toBeNull();

		let resolved = await platformTenantDO.resolveSession({
			token: sessionToken as string,
			ip: null,
			userAgent: null,
			country: null,
			region: null,
			city: null,
		});
		expect(resolved.status).toBe("active");
		let subjectId = resolved.status === "active" ? resolved.subjectId : null;

		let membership = await models.memberships.findByTenantAndSubject(
			tenant.id,
			subjectId as string,
		);
		expect(membership).toMatchObject({
			tenant_id: tenant.id,
			subject_id: subjectId,
			role: "admin",
		});
	});

	test("accepting the same token twice fails the second time", async () => {
		let { token } = await mintInvitation();
		let router = buildRouter();

		let first = await router.fetch(acceptRequest(token));
		let second = await router.fetch(acceptRequest(token));

		expect(first.status).toBe(200);
		expect(second.status).toBe(404);
	});

	test("answers 400 validationFailed for a body sent as anything but JSON", async () => {
		let { token } = await mintInvitation();

		let response = await buildRouter().fetch(
			new Request("https://api.example.com/invitations/accept", {
				method: "POST",
				headers: { "Content-Type": "text/plain" },
				body: JSON.stringify({ token }),
			}),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses an unknown token", async () => {
		let response = await buildRouter().fetch(acceptRequest("this-token-was-never-minted"));
		expect(response.status).toBe(404);
	});

	test("refuses an expired invitation", async () => {
		let { token } = await mintInvitation({ expiresAt: Date.now() - 1 });

		let response = await buildRouter().fetch(acceptRequest(token));
		expect(response.status).toBe(404);
	});

	test("reuses an existing platform dashboard subject rather than creating a duplicate", async () => {
		let router = buildRouter();

		let first = await mintInvitation({ email: "jane@example.com", role: "member" });
		let firstResponse = await router.fetch(acceptRequest(first.token));
		expect(firstResponse.status).toBe(200);

		let second = await mintInvitation({ email: "jane@example.com", role: "admin" });
		let secondResponse = await router.fetch(acceptRequest(second.token));
		expect(secondResponse.status).toBe(200);

		let subjects = await platformTenantDO.listSubjects();
		expect(subjects.ok).toBe(true);
		if (subjects.ok) expect(subjects.subjects).toHaveLength(1);

		let firstMembership = await models.memberships.findByTenantAndSubject(
			first.tenant.id,
			subjects.ok ? subjects.subjects[0]!.id : "",
		);
		let secondMembership = await models.memberships.findByTenantAndSubject(
			second.tenant.id,
			subjects.ok ? subjects.subjects[0]!.id : "",
		);
		expect(firstMembership).toMatchObject({ role: "member" });
		expect(secondMembership).toMatchObject({ role: "admin" });
	});
});
