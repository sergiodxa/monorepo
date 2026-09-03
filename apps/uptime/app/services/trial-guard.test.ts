/**
 * Tests the fence in front of the public trial probe: the blocklist (exercised range by
 * range, including the address spellings that exist only to evade a check like this), a
 * challenge that fails closed even with no secret configured, and refusal reasons kept
 * distinguishable so a test can tell a budget refusal from a missing checkbox. Both outbound
 * calls are intercepted with MSW so a probe's skipped calls are as visible as the ones it made.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimitMock } from "@sdxc/cloudflare-mocks";

import { createEnv, createKVNamespace, createRateLimit } from "@sdxc/cloudflare-mocks";
import { logger } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { TrialProbeRequest } from "~/app/services/trial-guard";

/** Probes one caller may make in a minute, as the deployed binding is configured. */
const TRIAL_PROBE_LIMIT = 3;

/** Holds today's counter, so a test seeds it and reads back what the guard wrote. */
let kv = createKVNamespace();

/**
 * The counter's namespace is spied on as well as stored to: the write's `expirationTtl`, and
 * a read that a billed or refused probe never made, are not things a stored value can say.
 */
let kvGet = vi.spyOn(kv, "get");
let kvPut = vi.spyOn(kv, "put");

/** The per-caller limiter, counting for real, so a refusal is an allowance actually spent. */
let limiter: RateLimitMock = createRateLimit({ limit: TRIAL_PROBE_LIMIT, period: 60 });

/**
 * Turnstile's two keys sit behind accessors, since the service reads them off `env` at call
 * time: the tests move each one between configured, empty and absent, which is what makes an
 * unconfigured deployment testable.
 */
let turnstileSecretKey: string | undefined = "turnstile-secret";
let turnstileSiteKey: string | undefined = "turnstile-site";

let env = createEnv<Env>({ KV: kv, TRIAL_RATE_LIMITER: limiter });
Object.defineProperty(env, "TURNSTILE_SECRET_KEY", { get: () => turnstileSecretKey });
Object.defineProperty(env, "TURNSTILE_SITE_KEY", { get: () => turnstileSiteKey });

vi.doMock("cloudflare:workers", () => ({
	env,
	waitUntil: (promise: Promise<unknown>) => void promise,
}));

let { checkTarget, guardTrialProbe, isPublicAddress, TRIAL_DAILY_BUDGET, trialTurnstileSiteKey } =
	await import("~/app/services/trial-guard");

/** Records this test's DNS answers, keyed `name:type`. */
let dnsRecords = new Map<string, string[]>();

/** Queries that should fail outright, keyed `name:type`, for the unresolvable cases. */
let dnsFailures = new Set<string>();

/** Whether siteverify reports the token as valid, and the status it answers with. */
let turnstileSuccess = true;
let turnstileStatus = 200;

/** The key today's global counter lives under. */
let budgetKey = `trial:budget:${new Date().toISOString().slice(0, 10)}`;

/** The DNS-over-HTTPS endpoint the resolver queries. */
const DOH_URL = "https://cloudflare-dns.com/dns-query";

/** Turnstile's verification endpoint. */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Every DNS query that left, so a test can tell a skipped lookup from a failed one. */
let dnsQueries: { name: string; type: string }[] = [];

/** One siteverify submission as it went on the wire. */
interface Verification {
	method: string;
	body: URLSearchParams;
}

/** Every siteverify submission that left, in order. */
let verifications: Verification[] = [];

/**
 * Both outbound endpoints, answering out of {@link dnsRecords}/{@link dnsFailures} and the
 * Turnstile switches, so a test steers them just by setting that state. Registered as
 * defaults, so `resetHandlers` puts them back between tests.
 */
let server = setupServer(
	http.get(DOH_URL, ({ request }) => {
		let url = new URL(request.url);
		let name = url.searchParams.get("name") ?? "";
		let type = url.searchParams.get("type") ?? "";
		dnsQueries.push({ name, type });
		if (dnsFailures.has(`${name}:${type}`)) return new HttpResponse("{}", { status: 502 });

		let values = dnsRecords.get(`${name}:${type}`) ?? [];
		return HttpResponse.json({
			Status: 0,
			Answer: values.map((data) => ({ name, type: type === "A" ? 1 : 28, TTL: 60, data })),
		});
	}),
	http.post(SITEVERIFY_URL, async ({ request }) => {
		verifications.push({ method: request.method, body: new URLSearchParams(await request.text()) });
		if (turnstileStatus !== 200) return new HttpResponse("{}", { status: turnstileStatus });
		return HttpResponse.json({ success: turnstileSuccess });
	}),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * A submission from a visitor, with the address the platform reported for them. Free
 * unless a test says otherwise, since that is the path every control here exists for.
 */
function submission(
	target: string,
	options: { token?: string | null; address?: string; billed?: boolean } = {},
): TrialProbeRequest {
	let headers = new Headers();
	headers.set("CF-Connecting-IP", options.address ?? "203.0.113.9");
	return {
		target,
		token: options.token === undefined ? "token-1" : options.token,
		request: new Request("https://uptime.test/try", { method: "POST", headers }),
		billed: options.billed ?? false,
	};
}

/**
 * The namespace and the limiter outlive the test that used them, so every test clears
 * yesterday's counter and any spent allowance first. `logger.error` is silenced here too,
 * since the unconfigured-secret case logs by design and a test below asserts on that call.
 */
beforeEach(async () => {
	let { keys } = await kv.list();
	for (let key of keys) await kv.delete(key.name);
	kvGet.mockClear();
	kvPut.mockClear();
	limiter.reset();

	turnstileSuccess = true;
	turnstileStatus = 200;
	turnstileSecretKey = "turnstile-secret";
	turnstileSiteKey = "turnstile-site";

	dnsRecords.clear();
	dnsFailures.clear();
	dnsRecords.set("example.com:A", ["93.184.216.34"]);
	dnsRecords.set("example.com:AAAA", []);

	dnsQueries = [];
	verifications = [];

	vi.spyOn(logger, "error").mockImplementation(() => {});
});

describe("isPublicAddress", () => {
	test.each([
		["0.0.0.0", "this-network"],
		["0.1.2.3", "this-network"],
		["10.0.0.1", "RFC1918 10/8"],
		["10.255.255.254", "RFC1918 10/8"],
		["100.64.0.1", "carrier-grade NAT"],
		["100.127.255.254", "carrier-grade NAT"],
		["127.0.0.1", "loopback"],
		["127.255.255.254", "loopback"],
		["169.254.1.1", "link-local"],
		["169.254.169.254", "cloud instance metadata"],
		["172.16.0.1", "RFC1918 172.16/12"],
		["172.31.255.254", "RFC1918 172.16/12"],
		["192.0.0.1", "IETF protocol assignments"],
		["192.0.2.1", "TEST-NET-1"],
		["192.168.0.1", "RFC1918 192.168/16"],
		["192.168.255.254", "RFC1918 192.168/16"],
		["198.18.0.1", "benchmarking"],
		["198.51.100.1", "TEST-NET-2"],
		["203.0.113.1", "TEST-NET-3"],
		["224.0.0.1", "multicast"],
		["239.255.255.255", "multicast"],
		["240.0.0.1", "reserved"],
		["255.255.255.255", "broadcast"],
	])("refuses %s (%s)", (address) => {
		expect(isPublicAddress(address)).toBe(false);
	});

	test.each([
		["::", "unspecified"],
		["::1", "loopback"],
		["::2", "IPv4-compatible"],
		["100::1", "discard-only"],
		["2001::1", "Teredo"],
		["2001:db8::1", "documentation"],
		["fc00::1", "unique-local"],
		["fd12:3456:789a::1", "unique-local"],
		["fe80::1", "link-local"],
		["febf:ffff::1", "link-local"],
		["ff02::1", "multicast"],
		["::ffff:127.0.0.1", "IPv4-mapped loopback"],
		["::ffff:7f00:1", "IPv4-mapped loopback, group notation"],
		["::ffff:169.254.169.254", "IPv4-mapped metadata address"],
		["::ffff:10.0.0.1", "IPv4-mapped RFC1918"],
		["64:ff9b::a9fe:a9fe", "NAT64-wrapped metadata address"],
		["64:ff9b::7f00:1", "NAT64-wrapped loopback"],
		["2002:7f00:1::", "6to4-wrapped loopback"],
		["2002:a9fe:a9fe::", "6to4-wrapped metadata address"],
	])("refuses %s (%s)", (address) => {
		expect(isPublicAddress(address)).toBe(false);
	});

	test.each([
		["8.8.8.8"],
		["1.1.1.1"],
		["93.184.216.34"],
		["172.32.0.1"],
		["100.128.0.1"],
		["2606:4700:4700::1111"],
		["2a00:1450:4001:80f::200e"],
		["::ffff:8.8.8.8"],
	])("allows the public address %s", (address) => {
		expect(isPublicAddress(address)).toBe(true);
	});

	test("refuses anything that is not a parseable address", () => {
		expect(isPublicAddress("not-an-address")).toBe(false);
		expect(isPublicAddress("1.2.3")).toBe(false);
		expect(isPublicAddress("1.2.3.4.5")).toBe(false);
		expect(isPublicAddress("256.0.0.1")).toBe(false);
		expect(isPublicAddress("::1::2")).toBe(false);
		expect(isPublicAddress("fffff::1")).toBe(false);
	});
});

describe("checkTarget", () => {
	test("adds https to a bare domain, which is what people type", () => {
		let result = checkTarget("example.com");

		expect(isFailure(result)).toBe(false);
		if (isFailure(result)) return;
		expect(result.data.href).toBe("https://example.com/");
	});

	test("keeps an explicit scheme, path and query", () => {
		let result = checkTarget("http://example.com/health?deep=1");

		expect(isFailure(result)).toBe(false);
		if (isFailure(result)) return;
		expect(result.data.href).toBe("http://example.com/health?deep=1");
	});

	test("trims surrounding whitespace and refuses an empty target", () => {
		expect(isFailure(checkTarget("  example.com  "))).toBe(false);

		let result = checkTarget("   ");
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.detail).toBe("empty");
	});

	test.each([
		["ftp://example.com"],
		["file:///etc/passwd"],
		["gopher://example.com"],
		["ws://example.com"],
	])("refuses the non-http scheme in %s", (target) => {
		let result = checkTarget(target);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("blocked-target");
		expect(result.error.detail).toBe("unsupported-scheme");
	});

	test("refuses credentials in the URL rather than presenting them to a third party", () => {
		let result = checkTarget("https://user:secret@example.com");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.detail).toBe("credentials-in-url");
	});

	test("allows the two default ports and refuses every other one", () => {
		expect(isFailure(checkTarget("https://example.com:443"))).toBe(false);
		expect(isFailure(checkTarget("http://example.com:80"))).toBe(false);

		let result = checkTarget("https://example.com:8080");
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.detail).toBe("unsupported-port");
	});

	test.each([
		["localhost"],
		["localhost."],
		["app.localhost"],
		["printer.local"],
		["db.internal"],
		["wiki.intranet"],
		["nas.lan"],
		["files.corp"],
		["vault.private"],
		["router.home.arpa"],
		["thing.test"],
		["thing.invalid"],
		["thing.example"],
		["wiki"],
		["."],
	])("refuses the non-public hostname %s", (hostname) => {
		let result = checkTarget(hostname);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("blocked-target");
	});

	test("does not mistake a public name for a reserved suffix", () => {
		expect(isFailure(checkTarget("example.com"))).toBe(false);
		expect(isFailure(checkTarget("localhost.example.com"))).toBe(false);
		expect(isFailure(checkTarget("testing.dev"))).toBe(false);
	});

	test.each([
		["https://127.0.0.1"],
		["https://10.0.0.1"],
		["https://172.16.0.1"],
		["https://192.168.1.1"],
		["https://169.254.169.254"],
		["https://100.64.0.1"],
		["https://[::1]"],
		["https://[fd00::1]"],
		["https://[fe80::1]"],
		["https://[::ffff:127.0.0.1]"],
		["https://[64:ff9b::a9fe:a9fe]"],
	])("refuses the private literal in %s", (target) => {
		let result = checkTarget(target);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.detail).toBe("private-address");
	});

	test.each([
		["https://2130706433", "the bare integer form of 127.0.0.1"],
		["https://0x7f000001", "the hexadecimal form"],
		["https://0177.0.0.1", "the octal form"],
		["https://127.1", "the short form"],
	])("refuses %s (%s), which URL normalizes before we ever see it", (target) => {
		let result = checkTarget(target);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.detail).toBe("private-address");
	});

	test("allows a public literal", () => {
		expect(isFailure(checkTarget("https://8.8.8.8"))).toBe(false);
		expect(isFailure(checkTarget("https://[2606:4700:4700::1111]"))).toBe(false);
	});
});

describe("guardTrialProbe", () => {
	test("grants a probe for a public name, and reports what it resolved to", async () => {
		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(false);
		if (isFailure(result)) return;
		expect(result.data.url.href).toBe("https://example.com/");
		expect(result.data.addresses).toEqual(["93.184.216.34"]);
		expect(result.data.budgetRemaining).toBe(TRIAL_DAILY_BUDGET - 1);
	});

	test("refuses a public name that resolves to a private address", async () => {
		dnsRecords.set("example.com:A", ["127.0.0.1"]);

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("blocked-target");
		expect(result.error.detail).toBe("private-address");
	});

	test("refuses when any one of the resolved addresses is private", async () => {
		dnsRecords.set("example.com:A", ["93.184.216.34"]);
		dnsRecords.set("example.com:AAAA", ["fd00::1"]);

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.detail).toBe("private-address");
	});

	test("refuses a name that does not resolve at all", async () => {
		dnsFailures.add("example.com:A");
		dnsFailures.add("example.com:AAAA");

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.detail).toBe("unresolvable");
	});

	test("refuses rather than judging a name on half an answer", async () => {
		dnsFailures.add("example.com:AAAA");

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.detail).toBe("partial-resolution");
	});

	test("refuses a name that resolves to nothing", async () => {
		dnsRecords.set("example.com:A", []);
		dnsRecords.set("example.com:AAAA", []);

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.detail).toBe("no-address");
	});

	test("does not resolve an address literal, since there is no name to resolve", async () => {
		let result = await guardTrialProbe(submission("https://8.8.8.8"));

		expect(isFailure(result)).toBe(false);
		if (isFailure(result)) return;
		expect(result.data.addresses).toEqual(["8.8.8.8"]);

		expect(dnsQueries).toEqual([]);
	});

	test("verifies the token against siteverify with the secret and the calling address", async () => {
		await guardTrialProbe(submission("example.com", { token: "token-9", address: "198.51.100.7" }));

		expect(verifications).toHaveLength(1);
		let [verification] = verifications;
		expect(verification?.method).toBe("POST");
		expect(verification?.body.get("secret")).toBe("turnstile-secret");
		expect(verification?.body.get("response")).toBe("token-9");
		expect(verification?.body.get("remoteip")).toBe("198.51.100.7");
	});

	test("refuses when siteverify rejects the token", async () => {
		turnstileSuccess = false;

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("failed-challenge");
	});

	/** The token is never sent for verification, so nothing is spent asking. */
	test("tells an unfinished form apart from a rejected token, and asks nobody about it", async () => {
		let result = await guardTrialProbe(submission("example.com", { token: null }));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("challenge-incomplete");
		expect(verifications).toEqual([]);
	});

	test("treats an empty token the same as no token at all", async () => {
		let result = await guardTrialProbe(submission("example.com", { token: "" }));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("challenge-incomplete");
	});

	test("fails closed when siteverify cannot be reached", async () => {
		turnstileStatus = 500;

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("failed-challenge");
	});

	test("refuses, loudly, when no secret is configured rather than passing unchallenged", async () => {
		turnstileSecretKey = undefined;
		let log = vi.spyOn(logger, "error").mockImplementation(() => {});

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		/**
		 * The reason is `unavailable`: the visitor completed everything asked of them, so the
		 * deployment is what's broken here.
		 */
		expect(result.error.reason).toBe("unavailable");
		expect(result.error.detail).toBe("turnstile-unconfigured");
		expect(verifications).toEqual([]);
		expect(log).toHaveBeenCalledWith("trial_guard.turnstile_unconfigured", expect.anything());
	});

	test("refuses when the secret is present but empty", async () => {
		turnstileSecretKey = "";

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("unavailable");
	});

	test("keys the caller budget on CF-Connecting-IP, never on a client-supplied header", async () => {
		let headers = new Headers();
		headers.set("CF-Connecting-IP", "198.51.100.2");
		headers.set("X-Forwarded-For", "1.2.3.4");

		await guardTrialProbe({
			target: "example.com",
			token: "token-1",
			request: new Request("https://uptime.test/try", { method: "POST", headers }),
			billed: false,
		});

		expect(limiter.count("trial-probe:198.51.100.2")).toBe(1);
		expect(limiter.count("trial-probe:1.2.3.4")).toBe(0);
	});

	test("spends exactly one unit of the binding's budget per probe", async () => {
		await guardTrialProbe(submission("example.com"));

		/**
		 * The binding counts one request per call, with a ceiling of three per minute, so a
		 * second call here would silently cut a visitor's allowance from three probes to one.
		 * Cheap to assert, and a failure here reads as the feature breaking outright.
		 */
		expect(limiter.count("trial-probe:203.0.113.9")).toBe(1);
	});

	/**
	 * The caller's whole minute is spent before it submits, so the refusal comes from the
	 * binding's own counter reaching its ceiling.
	 */
	test("refuses an address that is over its budget, before anything is spent on it", async () => {
		for (let spent = 0; spent < TRIAL_PROBE_LIMIT; spent++) {
			await limiter.limit({ key: "trial-probe:203.0.113.9" });
		}

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("rate-limited");
		expect(result.error.retryAfterSeconds).toBeGreaterThan(0);
		expect(kvGet).not.toHaveBeenCalled();
		expect(dnsQueries).toEqual([]);
		expect(verifications).toEqual([]);
	});

	test("counts a granted probe against today's global budget", async () => {
		await guardTrialProbe(submission("example.com"));

		expect(await kv.get(budgetKey)).toBe("1");
		/** Two days, which the stored counter cannot report back on its own. */
		expect(kvPut).toHaveBeenCalledWith(budgetKey, "1", { expirationTtl: 172_800 });
	});

	test("continues from the count already stored for the day", async () => {
		await kv.put(budgetKey, "41");

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(false);
		if (isFailure(result)) return;
		expect(result.data.budgetRemaining).toBe(TRIAL_DAILY_BUDGET - 42);
		expect(await kv.get(budgetKey)).toBe("42");
		expect(kvPut).toHaveBeenCalledWith(budgetKey, "42", { expirationTtl: 172_800 });
	});

	test("refuses once the day's budget is spent, and says so distinguishably", async () => {
		await kv.put(budgetKey, String(TRIAL_DAILY_BUDGET));

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("budget-exhausted");
		expect(result.error.detail).toBe("daily-cap");
		/** The day's counter stays exactly as spent, since a refused probe adds nothing to it. */
		expect(await kv.get(budgetKey)).toBe(String(TRIAL_DAILY_BUDGET));
	});

	test("treats an unreadable counter as exhaustion rather than as unlimited spend", async () => {
		kvGet.mockImplementationOnce(async () => {
			throw new Error("KV is unavailable");
		});

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("budget-exhausted");
		expect(result.error.detail).toBe("counter-unavailable");
	});

	test("still grants the probe when the counter cannot be written back", async () => {
		kvPut.mockImplementationOnce(async () => {
			throw new Error("KV is unavailable");
		});

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(false);
	});

	test("refuses a blocked target without spending a challenge or a DNS lookup on it", async () => {
		let result = await guardTrialProbe(submission("http://169.254.169.254/latest/meta-data/"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("blocked-target");
		expect(dnsQueries).toEqual([]);
		expect(verifications).toEqual([]);
		expect(kvPut).not.toHaveBeenCalled();
	});

	test("spends none of the free-tier controls on a billed probe", async () => {
		let result = await guardTrialProbe(submission("example.com", { token: null, billed: true }));

		expect(isFailure(result)).toBe(false);
		if (isFailure(result)) return;
		/** A billed probe takes nothing out of the day's allowance, so there is nothing to report. */
		expect(result.data.budgetRemaining).toBeNull();
		expect(limiter.count("trial-probe:203.0.113.9")).toBe(0);
		expect(kvGet).not.toHaveBeenCalled();
		expect(kvPut).not.toHaveBeenCalled();
		expect(verifications).toEqual([]);
	});

	test("holds a billed probe to the same target rules as a free one", async () => {
		let result = await guardTrialProbe(
			submission("http://169.254.169.254/latest/meta-data/", { billed: true }),
		);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("blocked-target");
	});

	test("still resolves and verifies a billed probe's hostname", async () => {
		dnsRecords.set("example.com:A", ["127.0.0.1"]);

		let result = await guardTrialProbe(submission("example.com", { billed: true }));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("blocked-target");
		expect(result.error.detail).toBe("private-address");
	});
});

describe("trialTurnstileSiteKey", () => {
	test("hands the page the configured site key", () => {
		expect(trialTurnstileSiteKey()).toBe("turnstile-site");
	});

	test("is null when unconfigured, so the page renders no widget", () => {
		turnstileSiteKey = undefined;
		expect(trialTurnstileSiteKey()).toBeNull();

		turnstileSiteKey = "";
		expect(trialTurnstileSiteKey()).toBeNull();
	});
});
