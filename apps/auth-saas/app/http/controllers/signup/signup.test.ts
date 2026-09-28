/**
 * Drives the platform self-serve onboarding flow through a real router mapping every
 * `/signup` route: a full submit-then-verify round trip provisions a real tenant,
 * owned by a real membership, and signs its new owner into the platform dashboard; a
 * taken email refuses without writing a pending signup or a tenant; an unknown or
 * expired ticket, and a ticket verified twice, both render the same invalid state
 * without provisioning anything the second time; a submission with no Turnstile
 * token is refused before anything is written; and the owner's address is screened
 * for disposable domains, likely typos and a mail server, with DoH answered by MSW.
 *
 * `cloudflare:workers` is mocked with a real, freshly-constructed platform tenant
 * object routed through `TENANT.getByName`, standing in for a Durable Object reached
 * from outside itself — every controller here reads `env.TENANT` at call time and,
 * through the session cookie helper's own module, `env.SESSION_SECRET` at module load
 * time, so the mock is installed before anything downstream of it is imported.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestHandler } from "remix/router";

import { MemoryCaptcha } from "@sdxc/captcha/memory";
import {
	createDurableObjectNamespace,
	createDurableObjectState,
	createEnv,
} from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type Tenant from "~/database/tenant-do";

const PLATFORM_DOMAIN = "auth.sergiodxa.com";
const EMAIL_FROM = "Auth SaaS <noreply@auth.sergiodxa.com>";

/** Replaced fresh in `beforeEach`; the mock below closes over this one reference. */
let platformTenantDO: InstanceType<typeof Tenant>;

/**
 * Binds the RPC methods this flow calls through the namespace as the tenant
 * object's own properties — `Object.assign` in `createDurableObjectNamespace`'s
 * own stub wrapper only copies own properties, so a class instance's prototype
 * methods need binding here rather than being reachable straight off the stub.
 */
function tenantStub(tenantDO: InstanceType<typeof Tenant>) {
	return {
		describePasswordPolicy: tenantDO.describePasswordPolicy.bind(tenantDO),
		createSubject: tenantDO.createSubject.bind(tenantDO),
		addIdentifier: tenantDO.addIdentifier.bind(tenantDO),
		setPassword: tenantDO.setPassword.bind(tenantDO),
		verifyIdentifier: tenantDO.verifyIdentifier.bind(tenantDO),
		describeSubject: tenantDO.describeSubject.bind(tenantDO),
		openSessionForSubject: tenantDO.openSessionForSubject.bind(tenantDO),
		resolveSession: tenantDO.resolveSession.bind(tenantDO),
		provision: tenantDO.provision.bind(tenantDO),
	};
}

/**
 * Constructs a Durable Object stub for a name resolved through the namespace.
 * Assigned once `~/database/tenant-do`'s own default export loads below —
 * referenced here only from inside the closures {@link tenantNamespace} calls
 * later, by which point every top-level `await` in this file has resolved.
 */
let buildTenant: (state: DurableObjectState) => InstanceType<typeof Tenant>;

/**
 * Built once, module scope, since `vi.doMock` only runs its factory once — every
 * test's own fresh `platformTenantDO` needs `tenantNamespace.reset()` in
 * `beforeEach`, or a later test resolves the first test's own cached stub instead
 * of its own. A name other than the platform's own resolves to a fresh tenant
 * object each time, standing in for the tenant `provisionTenant` provisions.
 */
let tenantNamespace = createDurableObjectNamespace<Tenant>((name) => {
	if (name === PLATFORM_DOMAIN) return tenantStub(platformTenantDO);
	return tenantStub(buildTenant(createDurableObjectState()));
});

vi.doMock("cloudflare:workers", async (importOriginal) => {
	let actual = await importOriginal<typeof import("cloudflare:workers")>();
	return {
		...actual,
		env: createEnv<Cloudflare.Env>({
			PLATFORM_DOMAIN,
			SESSION_SECRET: "test-session-secret",
			EMAIL_FROM,
			TURNSTILE_SITE_KEY: "test-site-key",
			TURNSTILE_SECRET_KEY: "test-secret-key",
			TENANT: tenantNamespace,
		}),
	};
});

let { database } = await import("~/app/http/middleware/database");
let { Mail } = await import("~/app/http/middleware/mail");
let render = (await import("~/app/http/middleware/render")).default;
let { signupShow, signupSubmit } = await import("~/app/http/controllers/signup/show");
let { turnstileVerification } = await import("~/app/http/middleware/turnstile-verification");
let i18n = (await import("~/app/http/middleware/i18n")).default;
let signupPending = (await import("~/app/http/controllers/signup/pending")).default;
let signupVerify = (await import("~/app/http/controllers/signup/verify")).default;
let signupResend = (await import("~/app/http/controllers/signup/resend")).default;
let { sessionCookie } = await import("~/app/lib/session-cookie");
let Customer = (await import("~/app/models/customer")).default;
let Membership = (await import("~/app/models/membership")).default;
let TenantModel = (await import("~/app/models/tenant")).default;
let PendingSignup = (await import("~/app/models/pending-signup")).default;
let routes = (await import("~/routes/web")).default;
let { createTestDatabase } = await import("~/app/test/db");
let TenantObject = (await import("~/database/tenant-do")).default;

buildTenant = (state) =>
	new TenantObject(state, { TOTP_SEAL_KEY: randomToken({ bytes: 32 }) } as Cloudflare.Env);

let db: Awaited<ReturnType<typeof createTestDatabase>>;
let mailTransport: MemoryTransport;

/** Cloudflare's DoH endpoint, which the owner-address mail-server check asks. */
let DOH_URL = "https://cloudflare-dns.com/dns-query";

/** DNS answers by domain: MX records, or a DNS status such as NXDOMAIN (3). */
let dnsAnswers = new Map<string, string[] | { Status: number }>();

/** Answers every MX query from `dnsAnswers`, and any other type with no records. */
let server = setupServer(
	http.get(DOH_URL, ({ request }) => {
		let url = new URL(request.url);
		let name = url.searchParams.get("name") ?? "";
		let type = url.searchParams.get("type");
		let reply = dnsAnswers.get(name) ?? [];
		if (!Array.isArray(reply)) return HttpResponse.json({ Status: reply.Status });
		let records = type === "MX" ? reply : [];
		return HttpResponse.json({
			Status: 0,
			Answer: records.map((data) => ({ name: `${name}.`, type: 15, TTL: 300, data })),
		});
	}),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Sign-up always challenges; every non-empty token passes unless a test queues otherwise. */
let turnstile = new MemoryCaptcha({ field: "cf-turnstile-response" });

beforeEach(async () => {
	turnstile.reset();
	dnsAnswers = new Map([["example.com", ["10 mx.example.com."]]]);
	db = await createTestDatabase();

	let state = createDurableObjectState();
	platformTenantDO = new TenantObject(state, {
		TOTP_SEAL_KEY: randomToken({ bytes: 32 }),
	} as Cloudflare.Env);
	tenantNamespace.reset();

	mailTransport = new MemoryTransport();
});

/** Builds the platform web router mapping every `/signup` route, matching how `bootstrap/app.ts` mounts them. */
function buildRouter() {
	let mailer = new Mailer({
		transport: mailTransport,
		from: { email: "noreply@auth.example.com" },
	});

	let middleware: Middleware[] = [
		database(() => db) as Middleware,
		(ctx, next) => {
			ctx.set(Mail, mailer, { property: "mail" });
			return next();
		},
		render as Middleware,
		formData() as Middleware,
	];
	let router = createRouter({ middleware });

	router.map(routes.signup.show, signupShow);
	router.map(routes.signup.submit, {
		middleware: [i18n as Middleware, turnstileVerification(turnstile)],
		handler: signupSubmit as RequestHandler,
	});
	router.map(routes.signup.pending, signupPending);
	router.map(routes.signup.verify, signupVerify);
	router.map(routes.signup.resend, signupResend);

	return router;
}

/** Posts a URL-encoded form through the router, carrying a Turnstile token by default. */
function postForm(
	router: ReturnType<typeof buildRouter>,
	path: string,
	fields: Record<string, string>,
): Promise<Response> {
	let body = new URLSearchParams({ "cf-turnstile-response": "a-valid-token", ...fields });

	return router.fetch(
		new Request(`https://${PLATFORM_DOMAIN}${path}`, {
			method: "POST",
			body,
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
		}),
	);
}

/** Reads the ticket a just-submitted signup's email carries, from the mailer's captured message. */
function ticketFromLastMessage(): string {
	let sent = mailTransport.last;
	let match = /[?&]ticket=([^&"<\s]+)/.exec(sent?.html ?? "");
	if (!match?.[1]) throw new Error("expected the sent message to carry a ticket");
	return decodeURIComponent(match[1]);
}

describe("signup", () => {
	test("a full submit-then-verify round trip provisions a tenant owned by its new subject", async () => {
		let router = buildRouter();

		let submitResponse = await postForm(router, "/signup", {
			organizationName: "Acme, Inc.",
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		expect(submitResponse.status).toBe(302);
		let pendingLocation = new URL(submitResponse.headers.get("Location") ?? "");
		expect(pendingLocation.pathname).toBe("/signup/pending");
		let subjectId = pendingLocation.searchParams.get("subject");
		expect(subjectId).toBeTruthy();

		let pending = await PendingSignup.findBySubjectId(db, subjectId ?? "");
		expect(pending).toMatchObject({ subject_id: subjectId, organization_name: "Acme, Inc." });

		let ticket = ticketFromLastMessage();

		let verifyResponse = await router.fetch(
			new Request(`https://${PLATFORM_DOMAIN}/signup/verify?ticket=${ticket}`),
		);
		expect(verifyResponse.status).toBe(200);
		let body = await verifyResponse.text();
		expect(body).toContain("all set");

		let setCookie = verifyResponse.headers.get("Set-Cookie");
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
		let resolvedSubjectId = resolved.status === "active" ? resolved.subjectId : null;
		expect(resolvedSubjectId).toBe(subjectId);

		let customers = await db.findMany(Customer.table, { where: { name: "Acme, Inc." } });
		expect(customers).toHaveLength(1);

		let tenants = await TenantModel.listByCustomer(db, customers[0]!.id);
		expect(tenants).toHaveLength(1);

		let membership = await Membership.findByTenantAndSubject(db, tenants[0]!.id, subjectId ?? "");
		expect(membership).toMatchObject({ role: "owner", subject_id: subjectId });

		let stillPending = await PendingSignup.findBySubjectId(db, subjectId ?? "");
		expect(stillPending).toBeNull();
	});

	test("submitting with an email already claimed refuses without creating a pending row or a tenant", async () => {
		let router = buildRouter();

		await postForm(router, "/signup", {
			organizationName: "First Org",
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let second = await postForm(router, "/signup", {
			organizationName: "Second Org",
			email: "jane@example.com",
			password: "another strong password",
		});

		expect(second.status).toBe(400);
		let body = await second.text();
		expect(body).toContain("already exists");

		let customers = await db.findMany(Customer.table, { where: { name: "Second Org" } });
		expect(customers).toHaveLength(0);
	});

	test("verifying an unknown ticket renders the invalid state and provisions nothing", async () => {
		let router = buildRouter();

		let response = await router.fetch(
			new Request(`https://${PLATFORM_DOMAIN}/signup/verify?ticket=this-was-never-minted`),
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("no longer works");

		let customers = await db.findMany(Customer.table, {});
		expect(customers).toHaveLength(0);
	});

	test("verifying the same valid ticket twice provisions exactly once and refuses the replay", async () => {
		let router = buildRouter();

		await postForm(router, "/signup", {
			organizationName: "Acme, Inc.",
			email: "jane@example.com",
			password: "correct horse battery staple",
		});
		let ticket = ticketFromLastMessage();

		let first = await router.fetch(
			new Request(`https://${PLATFORM_DOMAIN}/signup/verify?ticket=${ticket}`),
		);
		let second = await router.fetch(
			new Request(`https://${PLATFORM_DOMAIN}/signup/verify?ticket=${ticket}`),
		);

		expect(first.status).toBe(200);
		expect(second.status).toBe(400);
		let secondBody = await second.text();
		expect(secondBody).toContain("no longer works");

		let customers = await db.findMany(Customer.table, { where: { name: "Acme, Inc." } });
		expect(customers).toHaveLength(1);
		let tenants = await TenantModel.listByCustomer(db, customers[0]!.id);
		expect(tenants).toHaveLength(1);
	});

	test("refuses a submission with no Turnstile token", async () => {
		let router = buildRouter();

		let body = new URLSearchParams({
			organizationName: "Acme, Inc.",
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let response = await router.fetch(
			new Request(`https://${PLATFORM_DOMAIN}/signup`, {
				method: "POST",
				body,
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			}),
		);

		expect(response.status).toBe(400);
		let customers = await db.findMany(Customer.table, {});
		expect(customers).toHaveLength(0);
	});

	test("refuses a submission whose Turnstile token is rejected", async () => {
		turnstile.failNext("rejected");

		let router = buildRouter();
		let response = await postForm(router, "/signup", {
			organizationName: "Acme, Inc.",
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("robot");
	});
	test.each([
		["an IP-literal domain", "jane@127.0.0.1"],
		["a single-label domain", "jane@localhost"],
		["a zero-width character", "ja\u200bne@example.com"],
	])("refuses an owner address with %s before anything is written", async (_name, email) => {
		let response = await postForm(buildRouter(), "/signup", {
			organizationName: "Acme, Inc.",
			email,
			password: "correct horse battery staple",
		});

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Enter a valid email address.");
		expect(await db.findMany(Customer.table, {})).toHaveLength(0);
	});

	test("refuses a disposable owner address", async () => {
		let response = await postForm(buildRouter(), "/signup", {
			organizationName: "Acme, Inc.",
			email: "jane@mailinator.com",
			password: "correct horse battery staple",
		});

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Disposable addresses");
		expect(mailTransport.last).toBeUndefined();
	});

	test("offers the likely spelling of a mistyped provider, and keeps the address once confirmed", async () => {
		dnsAnswers.set("gmaill.com", ["10 mx.gmaill.com."]);
		let router = buildRouter();
		let fields = {
			organizationName: "Acme, Inc.",
			email: "jane@gmaill.com",
			password: "correct horse battery staple",
		};

		let offered = await postForm(router, "/signup", fields);

		expect(offered.status).toBe(400);
		let html = await offered.text();
		expect(html).toContain("Did you mean jane@gmail.com?");
		expect(html).toContain('value="jane@gmail.com"');
		expect(html).toContain('name="confirmedEmail" value="jane@gmaill.com"');

		let kept = await postForm(router, "/signup", { ...fields, confirmedEmail: "jane@gmaill.com" });

		expect(kept.status).toBe(302);
	});

	test("offers the likely spelling before refusing a typo domain the disposable list holds", async () => {
		let response = await postForm(buildRouter(), "/signup", {
			organizationName: "Acme, Inc.",
			email: "jane@gmial.com",
			password: "correct horse battery staple",
		});

		let html = await response.text();
		expect(html).toContain("Did you mean jane@gmail.com?");
		expect(html).not.toContain("Disposable addresses");
	});

	test("refuses an owner address whose domain does not exist", async () => {
		dnsAnswers.set("no-such-domain.example", { Status: 3 });

		let response = await postForm(buildRouter(), "/signup", {
			organizationName: "Acme, Inc.",
			email: "jane@no-such-domain.example",
			password: "correct horse battery staple",
		});

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("can't receive email");
	});

	test("lets the address through when the mail-server lookup itself fails", async () => {
		server.use(http.get(DOH_URL, () => HttpResponse.error()));

		let response = await postForm(buildRouter(), "/signup", {
			organizationName: "Acme, Inc.",
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		expect(response.status).toBe(302);
	});
});
