/**
 * Test-only harness for driving the whole app over HTTP: in-memory Cloudflare
 * bindings, a migrated database, a container holding the same services production
 * registers, and a client that keeps cookies between requests so a multi-step flow can
 * be exercised the way a browser performs it.
 *
 * The `cloudflare:workers` mock is installed here, at module load and before the
 * application is imported, so every module that captures `env` at load time captures
 * these bindings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mock } from "bun:test";

import type { Customer } from "@pkg/polar";
import type { Database } from "remix/data-table";

import { createKVNamespace, createR2Bucket, createRateLimit } from "@pkg/cloudflare-mocks";
import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { KVSessionStorage } from "@pkg/session-storage-kv";
import { createCookie } from "remix/cookie";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import { MailTransport } from "~/app/services/mail-transport";

/** Requests a limiter allows per window when a test does not ask for a smaller budget. */
const DEFAULT_RATE_LIMIT = 1000;

/** Secret every app instance signs its session cookie with under test. */
const COOKIE_SECRET = "test-cookie-secret";

/** Cookie name, KV prefix and TTL the session middleware uses, mirrored for direct writes. */
const SESSION_COOKIE_NAME = "auth:session";
const SESSION_PREFIX = "session:";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/** The five limiter budgets, by the name {@link RateLimiters} exposes each one under. */
export interface RateLimitBudgets {
	token?: number;
	introspect?: number;
	revoke?: number;
	authorize?: number;
	login?: number;
}

/** How a test wants its app instance configured. */
export interface TestAppOptions {
	/** Per-limiter budgets, so a test can drive one limiter to its threshold. */
	limits?: RateLimitBudgets;
	/**
	 * The billing client provisioning resolves. Defaults to one that answers every call
	 * with a canned customer, so a test that is not about billing never reaches the
	 * network; pass a failing one to exercise a sign-in that outlives a billing outage,
	 * or a recording one to assert on the customer provisioning produced.
	 */
	polar?: PolarClient;
	/**
	 * Transport every mailer in this instance delivers through. Defaults to a recording
	 * one, so a test reads what was sent instead of mocking a provider; pass a transport
	 * that fails to exercise a send path's behaviour when delivery is refused.
	 */
	mailTransport?: MailTransport;
}

/**
 * A billing client that succeeds without talking to anything.
 *
 * Shaped as the subset of the real client provisioning calls, because the vendor SDK
 * would otherwise be loaded and a request issued for a concern no HTTP test is about.
 */
function createStubPolarClient(): PolarClient {
	let customer = { id: "cus_test", email: "", externalId: null } as unknown as Customer;

	let stub: Pick<PolarClient, "createCustomer" | "findCustomerByEmail" | "updateCustomer"> = {
		async createCustomer(email) {
			return { ...customer, email } as Customer;
		},
		async findCustomerByEmail() {
			return null;
		},
		async updateCustomer(_id, updates) {
			return { ...customer, externalId: updates.externalId ?? null } as Customer;
		},
	};

	return stub as unknown as PolarClient;
}

/** Secrets read from `env` at call time, given values no real provider would accept. */
const TEST_ENV = {
	GITHUB_CLIENT_ID: "test-github-client-id",
	GITHUB_CLIENT_SECRET: "test-github-client-secret",
};

let kv = createKVNamespace();
let r2 = createR2Bucket();

/**
 * Stand-in for the platform's `waitUntil`: the work is already running by the time it is
 * handed over, so this only has to keep a rejection from becoming an unhandled one. A
 * test asserting on a background write yields once (`await Bun.sleep(0)`) before reading.
 */
function waitUntil(promise: Promise<unknown>): void {
	void promise.catch(() => {});
}

mock.module("cloudflare:workers", () => ({ env: { KV: kv, R2: r2 }, waitUntil }));

/**
 * The application modules, imported on first use rather than at module load.
 *
 * They cannot be static imports: the `cloudflare:workers` mock above has to be in
 * place before any of them captures `env`. They cannot be top-level awaits either —
 * a test file's `beforeEach` can run before an imported module's top-level await has
 * settled, which surfaces as the harness's own bindings being uninitialized.
 */
async function loadModules() {
	modules ??= Promise.all([
		import("~/bootstrap/app"),
		import("~/app/services/rate-limiters"),
		import("~/app/lib/test/db"),
		import("remix/data-table"),
	]).then(([app, rateLimiters, db, dataTable]) => ({
		application: app.default,
		RateLimiters: rateLimiters.default,
		createTestDatabase: db.createTestDatabase,
		DatabaseKey: dataTable.Database,
	}));

	return await modules;
}

/** Cached result of {@link loadModules}, so every instance shares one module graph. */
let modules:
	| Promise<{
			application: (typeof import("~/bootstrap/app"))["default"];
			RateLimiters: (typeof import("~/app/services/rate-limiters"))["default"];
			createTestDatabase: (typeof import("~/app/lib/test/db"))["createTestDatabase"];
			DatabaseKey: (typeof import("remix/data-table"))["Database"];
	  }>
	| undefined;

/** One isolated app instance: its router, its storage, and a cookie-keeping client. */
export interface TestApp {
	/**
	 * The app's router, exposed so a test can map an extra route onto it.
	 *
	 * That is how the guards get exercised before the pages they protect exist: a stub
	 * action mapped here still passes through the whole global middleware chain, so what
	 * the test drives is the real session, logging and rendering path.
	 */
	router: ReturnType<Awaited<ReturnType<typeof loadModules>>["application"]>;
	/** The migrated in-memory database every controller resolves. */
	db: Database;
	/** The KV namespace backing sessions and authorization codes. */
	kv: ReturnType<typeof createKVNamespace>;
	/** The bucket the signing keys are generated into on first use. */
	r2: ReturnType<typeof createR2Bucket>;
	/**
	 * The recording transport both mailers deliver through, so a test asserts on the
	 * messages the app actually produced rather than on a mocked provider. It records
	 * nothing when the test supplied a transport of its own.
	 */
	mail: MemoryTransport;
	/**
	 * Sends a request through the router inside a container scope, carrying cookies
	 * from previous responses so a session survives across calls.
	 */
	fetch(request: Request): Promise<Response>;
	/** Discards stored cookies, which is how a test starts as a different visitor. */
	resetCookies(): void;
	/**
	 * Puts a token pair into a real browser session and hands the client the signed
	 * cookie naming it, so the next request arrives signed in to this server itself.
	 *
	 * Writes through the same storage and signs with the same secret the app uses, so
	 * what a test sets up is what the session middleware reads back.
	 */
	signIn(accessToken: string, refreshToken: string): Promise<void>;
}

/**
 * Builds an app instance backed by fresh in-memory storage.
 *
 * Each call resets the shared KV and R2 bindings, so tests never see each other's
 * sessions, codes or signing keys.
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
	let { application, RateLimiters, createTestDatabase, DatabaseKey } = await loadModules();

	kv = createKVNamespace();
	r2 = createR2Bucket();
	mock.module("cloudflare:workers", () => ({ env: { ...TEST_ENV, KV: kv, R2: r2 }, waitUntil }));

	// Captured after the reset so this instance keeps its own bindings even once a
	// later `createTestApp()` has replaced the module-level ones.
	let appKv = kv;
	let appR2 = r2;

	let { db } = createTestDatabase();

	let container = new ServiceContainer();
	container.singleton(DatabaseKey, () => db);
	container.singleton(PolarClient, () => options.polar ?? createStubPolarClient());

	// A recording transport unless the test brought its own, registered under the same key
	// production registers the platform one under — so what a test drives is the real
	// middleware, the real mailer and the real email classes, with only delivery replaced.
	let recorder = new MemoryTransport();
	let transport: MailTransport = options.mailTransport ?? recorder;
	container.singleton(MailTransport, () => transport);
	container.singleton(
		Mailer,
		() => new Mailer({ transport, from: MAIL_FROM, replyTo: MAIL_REPLY_TO }),
	);
	container.singleton(
		RateLimiters,
		() =>
			new RateLimiters({
				token: createRateLimit({ limit: options.limits?.token ?? DEFAULT_RATE_LIMIT }),
				introspect: createRateLimit({ limit: options.limits?.introspect ?? DEFAULT_RATE_LIMIT }),
				revoke: createRateLimit({ limit: options.limits?.revoke ?? DEFAULT_RATE_LIMIT }),
				authorize: createRateLimit({ limit: options.limits?.authorize ?? DEFAULT_RATE_LIMIT }),
				login: createRateLimit({ limit: options.limits?.login ?? DEFAULT_RATE_LIMIT }),
			}),
	);

	let router = application({ kv: appKv, cookieSecret: COOKIE_SECRET, secure: false });
	let cookies = new Map<string, string>();

	return {
		router,
		db,
		kv: appKv,
		r2: appR2,
		mail: recorder,
		resetCookies() {
			cookies.clear();
		},
		async signIn(accessToken, refreshToken) {
			let storage = new KVSessionStorage(appKv, {
				ttlSeconds: SESSION_TTL_SECONDS,
				prefix: SESSION_PREFIX,
			});

			let session = await storage.read(null);
			session.set("accessToken", accessToken);
			session.set("refreshToken", refreshToken);

			let id = await storage.save(session);
			if (!id) throw new Error("The session was not persisted");

			let serialized = await createCookie(SESSION_COOKIE_NAME, {
				secrets: [COOKIE_SECRET],
			}).serialize(id);

			let pair = serialized.split(";")[0]!;
			let separator = pair.indexOf("=");
			cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
		},
		async fetch(request) {
			if (cookies.size > 0 && !request.headers.has("cookie")) {
				request.headers.set(
					"cookie",
					[...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
				);
			}

			let response = await container.scope(() => router.fetch(request));

			for (let header of response.headers.getSetCookie()) {
				let pair = header.split(";")[0];
				if (!pair) continue;
				let separator = pair.indexOf("=");
				if (separator < 0) continue;
				cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
			}

			return response;
		},
	};
}
