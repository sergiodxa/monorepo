/**
 * Drives `POST /billing/tenants/:tenantId/portal` and `.../checkout` through a real
 * router mapping both, matching how `bootstrap/app.ts` mounts them: only the
 * tenant owner's own dashboard session reaches the billing platform, and anyone
 * else is refused before a portal session or a checkout is opened.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { MemoryBilling } from "@sdxc/billing/providers/memory";
import {
	createDurableObjectNamespace,
	createDurableObjectState,
	createEnv,
} from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Models } from "~/app/models";
import type Tenant from "~/database/tenant-do";

const PLATFORM_DOMAIN = "auth.sergiodxa.com";

/** Replaced fresh in `beforeEach`; the mocks below close over this one reference. */
let platformTenantDO: InstanceType<typeof Tenant>;

let tenantNamespace = createDurableObjectNamespace<Tenant>(() => ({
	resolveSession: platformTenantDO.resolveSession.bind(platformTenantDO),
}));

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

/** The billing platform every route under test reaches, standing in for Polar. */
let billing = new MemoryBilling({
	catalog: { pro: { amount: 2900, currency: "usd", interval: "month" } },
});

vi.doMock("~/app/lib/billing", () => ({ polar: billing }));

let { database } = await import("~/app/http/middleware/database");
let { models: modelsMiddleware } = await import("~/app/http/middleware/models");
let billingCheckout = (await import("~/app/http/controllers/billing/checkout")).default;
let billingPortal = (await import("~/app/http/controllers/billing/portal")).default;
let { serializeSessionCookie } = await import("~/app/http/middleware/hosted-session");
let { ensureProviderCustomer } = await import("~/app/services/billing-customer");
let webRoutes = (await import("~/routes/web")).default;
let { createTestDatabase } = await import("~/app/test/db");
let { bindModels } = await import("~/app/test/models");
let TenantObject = (await import("~/database/tenant-do")).default;

let db: Awaited<ReturnType<typeof createTestDatabase>>;

let models: Models;

/** Builds the platform web router mapping both billing routes, matching how `bootstrap/app.ts` mounts them. */
function buildBillingRouter() {
	let router = createRouter({
		middleware: [
			database(() => db) as Middleware,
			modelsMiddleware() as Middleware,
			formData() as Middleware,
		],
	});

	router.map(webRoutes.billing.checkout, billingCheckout);
	router.map(webRoutes.billing.portal, billingPortal);

	return router;
}

beforeEach(async () => {
	db = await createTestDatabase();
	models = bindModels(db);
	platformTenantDO = new TenantObject(createDurableObjectState(), {
		TOTP_SEAL_KEY: randomToken({ bytes: 32 }),
	} as Cloudflare.Env);
	tenantNamespace.reset();
});

/** Creates a platform subject and opens a session for it, returning its id and a `Cookie` header value. */
async function signIn(): Promise<{ subjectId: string; cookie: string }> {
	let created = await platformTenantDO.createSubject({
		identifiers: [{ kind: "email", value: `${crypto.randomUUID()}@example.com` }],
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

/**
 * Provisions a tenant whose customer already holds a provider customer, so its
 * portal can open. Each gets its own email, since `billing` outlives every test's
 * fresh database and refuses one address joined to two customers.
 */
async function provisionTenant() {
	let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
	let tenant = unwrap(
		await models.tenants.create({
			customer_id: customer.id,
			name: "Acme, Inc.",
			slug: `acme-${crypto.randomUUID()}`,
			issuer: `https://acme-${crypto.randomUUID()}.example.com`,
		}),
	);
	await ensureProviderCustomer(models, billing, customer, {
		email: `${crypto.randomUUID()}@example.com`,
	});
	return tenant;
}

/** A form-encoded POST against the billing router, carrying `cookie` when given. */
function billingPost(path: string, fields: Record<string, string>, cookie?: string): Request {
	let headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded" });
	if (cookie) headers.set("Cookie", cookie);
	return new Request(`https://${PLATFORM_DOMAIN}${path}`, {
		method: "POST",
		body: new URLSearchParams(fields),
		headers,
	});
}

/** One billing route under test, and the form a valid request to it carries. */
interface BillingRoute {
	name: string;
	path: (tenantId: string) => string;
	fields: Record<string, string>;
}

/** The two billing routes, each with the form a valid request to it carries. */
const ROUTES: BillingRoute[] = [
	{
		name: "portal",
		path: (tenantId: string) => webRoutes.billing.portal.href({ tenantId }),
		fields: {},
	},
	{
		name: "checkout",
		path: (tenantId: string) => webRoutes.billing.checkout.href({ tenantId }),
		fields: { email: "owner@example.com", product: "pro" },
	},
];

describe.each(ROUTES)("POST /billing/tenants/:tenantId/$name", (route) => {
	test("refuses a request carrying no dashboard session", async () => {
		let tenant = await provisionTenant();

		let response = await buildBillingRouter().fetch(
			billingPost(route.path(tenant.id), route.fields),
		);

		expect(response.status).toBe(401);
	});

	test("refuses a signed-in subject holding no membership of the tenant", async () => {
		let tenant = await provisionTenant();
		let { cookie } = await signIn();

		let response = await buildBillingRouter().fetch(
			billingPost(route.path(tenant.id), route.fields, cookie),
		);

		expect(response.status).toBe(403);
	});

	test.each(["admin", "member"] as const)("refuses a tenant %s", async (role) => {
		let tenant = await provisionTenant();
		let { subjectId, cookie } = await signIn();
		unwrap(await models.memberships.create({ tenant_id: tenant.id, subject_id: subjectId, role }));

		let response = await buildBillingRouter().fetch(
			billingPost(route.path(tenant.id), route.fields, cookie),
		);

		expect(response.status).toBe(403);
	});

	test("redirects the tenant's owner to the billing platform's hosted page", async () => {
		let tenant = await provisionTenant();
		let { subjectId, cookie } = await signIn();
		unwrap(
			await models.memberships.create({
				tenant_id: tenant.id,
				subject_id: subjectId,
				role: "owner",
			}),
		);

		let response = await buildBillingRouter().fetch(
			billingPost(route.path(tenant.id), route.fields, cookie),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toMatch(/^https:\/\//);
	});
});
