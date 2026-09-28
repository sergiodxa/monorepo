/**
 * Drives the platform's own administrative dashboard through a real router mapping
 * every `/dashboard` route, matching how `bootstrap/app.ts` mounts them: an
 * unauthenticated request redirects to sign-in; a signed-in subject sees every
 * tenant they administer and can create another one, owned by the same customer;
 * registering an agent client goes through the real, public Management API route
 * (mounted here the same way `bootstrap/management-app.ts` mounts it), reached over
 * a `SELF` service-binding stand-in that forwards this same session cookie, and its
 * plaintext secret is shown exactly once; and a subject with no membership on a
 * tenant is refused that tenant's own agent-clients page.
 *
 * `cloudflare:workers` is mocked with a real, freshly-constructed platform tenant
 * object routed through `TENANT.getByName`, the same way `signup.test.ts` and
 * `invitations/accept.test.ts` already stand in for a Durable Object reached from
 * outside itself. `SELF` is mocked as a `Fetcher`-shaped stand-in whose `fetch`
 * dispatches straight into a router mapping only the real `agentClientsRegister`
 * action with its real `managementAuth`/`managementRateLimit`/`managementIdempotency`
 * middleware, so the dogfooded call exercises the actual production route rather
 * than a hand-rolled stub of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import {
	createDurableObjectNamespace,
	createDurableObjectState,
	createEnv,
} from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type Tenant from "~/database/tenant-do";

const PLATFORM_DOMAIN = "auth.sergiodxa.com";

/** Replaced fresh in `beforeEach`; the mocks below close over this one reference. */
let platformTenantDO: InstanceType<typeof Tenant>;

/** Dispatches a `SELF.fetch()` call into the test's own management-route router, assigned once that router is built. */
let managementFetch: (request: Request) => Promise<Response>;

/**
 * Binds the RPC methods this flow calls through the namespace as the tenant
 * object's own properties, the same way `signup.test.ts`'s own `tenantStub` does.
 */
function tenantStub(tenantDO: InstanceType<typeof Tenant>) {
	return { provision: tenantDO.provision.bind(tenantDO) };
}

/** The platform tenant's own stub carries the extra RPCs a dashboard session and a machine-credential registration both need. */
function platformStub(tenantDO: InstanceType<typeof Tenant>) {
	return {
		...tenantStub(tenantDO),
		createSubject: tenantDO.createSubject.bind(tenantDO),
		openSessionForSubject: tenantDO.openSessionForSubject.bind(tenantDO),
		resolveSession: tenantDO.resolveSession.bind(tenantDO),
		revokeSession: tenantDO.revokeSession.bind(tenantDO),
		registerClient: tenantDO.registerClient.bind(tenantDO),
		defineScopes: tenantDO.defineScopes.bind(tenantDO),
	};
}

/** A name other than the platform's own resolves to a fresh tenant object, standing in for a newly-provisioned tenant. */
let buildTenant: (state: DurableObjectState) => InstanceType<typeof Tenant>;

let tenantNamespace = createDurableObjectNamespace<Tenant>((name) => {
	if (name === PLATFORM_DOMAIN) return platformStub(platformTenantDO);
	return tenantStub(buildTenant(createDurableObjectState()));
});

vi.doMock("cloudflare:workers", async (importOriginal) => {
	let actual = await importOriginal<typeof import("cloudflare:workers")>();
	return {
		...actual,
		env: createEnv<Cloudflare.Env>({
			PLATFORM_DOMAIN,
			SESSION_SECRET: "test-session-secret",
			TENANT: tenantNamespace,
			SELF: { fetch: (request: Request) => managementFetch(request) } as Cloudflare.Env["SELF"],
			MANAGEMENT_RATE_LIMITER: {
				limit: async () => ({ success: true }),
			} as unknown as Cloudflare.Env["MANAGEMENT_RATE_LIMITER"],
		}),
	};
});

let { database } = await import("~/app/http/middleware/database");
let render = (await import("~/app/http/middleware/render")).default;
let { dashboardShow, dashboardCreateTenant } =
	await import("~/app/http/controllers/dashboard/show");
let { dashboardAgentClientsShow, dashboardAgentClientsRegister } =
	await import("~/app/http/controllers/dashboard/agent-clients");
let { dashboardSignOut } = await import("~/app/http/controllers/dashboard/sign-out");
let { createAgentClientsRegisterAction } =
	await import("~/app/http/controllers/management/agent-clients/register");
let { resolveDashboardSession, dashboardSignInUrl } =
	await import("~/app/http/middleware/dashboard-session");
let { serializeSessionCookie } = await import("~/app/http/middleware/hosted-session");
let { sessionCookie } = await import("~/app/lib/session-cookie");
let Customer = (await import("~/app/models/customer")).default;
let Membership = (await import("~/app/models/membership")).default;
let webRoutes = (await import("~/routes/web")).default;
let managementRoutes = (await import("~/routes/management")).default;
let { createTestDatabase } = await import("~/app/test/db");
let TenantObject = (await import("~/database/tenant-do")).default;

let db: Awaited<ReturnType<typeof createTestDatabase>>;

buildTenant = (state) =>
	new TenantObject(state, { TOTP_SEAL_KEY: randomToken({ bytes: 32 }) } as Cloudflare.Env);

/** Builds the platform web router mapping every `/dashboard` route, matching how `bootstrap/app.ts` mounts them. */
function buildDashboardRouter() {
	let middleware: Middleware[] = [
		database(() => db) as Middleware,
		render as Middleware,
		formData() as Middleware,
	];
	let router = createRouter({ middleware });

	router.map(webRoutes.dashboard.show, dashboardShow);
	router.map(webRoutes.dashboard.createTenant, dashboardCreateTenant);
	router.map(webRoutes.dashboard.agentClients, dashboardAgentClientsShow);
	router.map(webRoutes.dashboard.registerAgentClient, dashboardAgentClientsRegister);
	router.map(webRoutes.dashboard.signOut, dashboardSignOut);

	return router;
}

/** Builds the management router mapping only `agentClientsRegister`, matching how `bootstrap/management-app.ts` mounts it. */
function buildManagementRouter() {
	let router = createRouter({ middleware: [database(() => db) as Middleware] });

	router.map(
		managementRoutes.agentClientsRegister,
		createAgentClientsRegisterAction({
			issuer: `https://api.${PLATFORM_DOMAIN}`,
			resolveDashboardSubjectId: async (ctx) =>
				(await resolveDashboardSession(ctx))?.subjectId ?? null,
			limiter: { limit: async () => ({ success: true }) },
			resolveStub: (tenantId) => tenantNamespace.getByName(tenantId) as never,
			hostnameClient: () => ({}) as never,
			r2: {} as never,
		}),
	);

	return router;
}

beforeEach(async () => {
	db = await createTestDatabase();

	let state = createDurableObjectState();
	platformTenantDO = new TenantObject(state, {
		TOTP_SEAL_KEY: randomToken({ bytes: 32 }),
	} as Cloudflare.Env);
	await platformTenantDO.applyEntitlements({
		plan: "pro",
		features: { machine_access: true },
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});
	tenantNamespace.reset();

	managementFetch = (request) => buildManagementRouter().fetch(request);
});

/** Creates a platform subject and opens a session for it, returning its id and a `Cookie` header value. */
async function signIn(): Promise<{ subjectId: string; cookie: string }> {
	let unique = crypto.randomUUID();
	let created = await platformTenantDO.createSubject({
		identifiers: [{ kind: "email", value: `${unique}@example.com` }],
	});
	if (!created.ok) throw new Error("unreachable: test subject creation failed");

	let session = await platformTenantDO.openSessionForSubject({
		subjectId: created.subjectId,
		amr: ["test"],
		remembered: true,
		ip: null,
		userAgent: null,
		country: null,
		region: null,
		city: null,
	});

	let setCookie = await serializeSessionCookie(session, true);
	return { subjectId: created.subjectId, cookie: setCookie.split(";")[0] as string };
}

/** Provisions a tenant owned by a fresh customer, with `subjectId` as its owning member. */
async function provisionOwnedTenant(subjectId: string, name = "Acme, Inc.") {
	let customer = await Customer.create(db, { name });
	let unique = crypto.randomUUID();
	let tenant = await (
		await import("~/app/models/tenant")
	).default.create(db, {
		customerId: customer.id,
		name,
		slug: `acme-${unique}`,
		issuer: `https://acme-${unique}.example.com`,
	});
	await Membership.create(db, { tenantId: tenant.id, subjectId, role: "owner" });
	return { customer, tenant };
}

/** A GET request against the dashboard router, carrying `cookie` when given. */
function dashboardGet(path: string, cookie?: string): Request {
	let headers = new Headers();
	if (cookie) headers.set("Cookie", cookie);
	return new Request(`https://${PLATFORM_DOMAIN}${path}`, { headers });
}

/** A form-encoded POST request against the dashboard router, carrying `cookie` when given. */
function dashboardPost(path: string, fields: Array<[string, string]>, cookie?: string): Request {
	let body = new URLSearchParams();
	for (let [key, value] of fields) body.append(key, value);

	let headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded" });
	if (cookie) headers.set("Cookie", cookie);

	return new Request(`https://${PLATFORM_DOMAIN}${path}`, { method: "POST", body, headers });
}

describe("GET /dashboard", () => {
	test("an unauthenticated request redirects to sign-in with the right return_to", async () => {
		let response = await buildDashboardRouter().fetch(
			dashboardGet(webRoutes.dashboard.show.href()),
		);

		expect(response.status).toBe(302);
		let location = response.headers.get("Location") ?? "";
		expect(location).toBe(dashboardSignInUrl(webRoutes.dashboard.show.href()));
		expect(new URL(location).searchParams.get("return_to")).toBe("/dashboard");
	});

	test("a signed-in subject with one tenant sees it listed, and creating a second tenant lists both under the same customer", async () => {
		let router = buildDashboardRouter();
		let { subjectId, cookie } = await signIn();
		let { customer, tenant: first } = await provisionOwnedTenant(subjectId, "Acme, Inc.");

		let showResponse = await router.fetch(dashboardGet(webRoutes.dashboard.show.href(), cookie));
		expect(showResponse.status).toBe(200);
		let firstBody = await showResponse.text();
		expect(firstBody).toContain("Acme, Inc.");
		expect(firstBody).toContain(first.slug);

		let createResponse = await router.fetch(
			dashboardPost(
				webRoutes.dashboard.createTenant.href(),
				[["organizationName", "Acme Labs"]],
				cookie,
			),
		);
		expect(createResponse.status).toBe(302);
		expect(createResponse.headers.get("Location")).toBe(webRoutes.dashboard.show.href());

		let administered = await Membership.administeredTenants(db, subjectId);
		expect(administered).toHaveLength(2);
		let customerIds = new Set(administered.map((entry) => entry.tenant.customer_id));
		expect(customerIds).toEqual(new Set([customer.id]));
		expect(administered.map((entry) => entry.tenant.name).sort()).toEqual([
			"Acme Labs",
			"Acme, Inc.",
		]);

		let secondShow = await router.fetch(dashboardGet(webRoutes.dashboard.show.href(), cookie));
		let secondBody = await secondShow.text();
		expect(secondBody).toContain("Acme, Inc.");
		expect(secondBody).toContain("Acme Labs");
	});
});

describe("GET/POST /dashboard/tenants/:tenantId/agent-clients", () => {
	test("registering an agent client succeeds through the real Management API route, and its secret is shown exactly once", async () => {
		let router = buildDashboardRouter();
		let { subjectId, cookie } = await signIn();
		let { tenant } = await provisionOwnedTenant(subjectId);

		let registerResponse = await router.fetch(
			dashboardPost(
				webRoutes.dashboard.registerAgentClient.href({ tenantId: tenant.id }),
				[
					["name", "CI bot"],
					["scopes", "clients:write"],
					["scopes", "subjects:read"],
				],
				cookie,
			),
		);

		expect(registerResponse.status).toBe(200);
		let registerBody = await registerResponse.text();
		expect(registerBody).toContain("won't see it again");
		expect(registerBody).toMatch(/client_/);

		let listResponse = await router.fetch(
			dashboardGet(webRoutes.dashboard.agentClients.href({ tenantId: tenant.id }), cookie),
		);
		expect(listResponse.status).toBe(200);
		let listBody = await listResponse.text();
		expect(listBody).not.toContain("won't see it again");
	});

	test("a subject with no membership on the tenant is refused that tenant's agent-clients page", async () => {
		let router = buildDashboardRouter();
		let { cookie } = await signIn();
		let outsider = await provisionOwnedTenant((await signIn()).subjectId);

		let response = await router.fetch(
			dashboardGet(webRoutes.dashboard.agentClients.href({ tenantId: outsider.tenant.id }), cookie),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe(webRoutes.dashboard.show.href());
	});
});

describe("POST /dashboard/sign-out", () => {
	test("revokes the session at the platform tenant, not just the cookie", async () => {
		let router = buildDashboardRouter();
		let { cookie } = await signIn();

		let signOutResponse = await router.fetch(
			dashboardPost(webRoutes.dashboard.signOut.href(), [], cookie),
		);
		expect(signOutResponse.status).toBe(302);
		expect(signOutResponse.headers.get("Location")).toBe(webRoutes.index.href());

		let token = await sessionCookie.parse(cookie);
		let resolved = await platformTenantDO.resolveSession({
			token: token as string,
			ip: null,
			userAgent: null,
			country: null,
			region: null,
			city: null,
		});
		expect(resolved.status).not.toBe("active");

		let afterSignOut = await router.fetch(dashboardGet(webRoutes.dashboard.show.href(), cookie));
		expect(afterSignOut.status).toBe(302);
		expect(afterSignOut.headers.get("Location")).toBe(
			dashboardSignInUrl(webRoutes.dashboard.show.href()),
		);
	});
});
