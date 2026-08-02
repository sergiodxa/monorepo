/**
 * Tests the fence in front of the public trial probe. Three things are worth pinning here
 * and the rest follows from them.
 *
 * The first is the blocklist, exercised range by range rather than by sampling, because
 * every entry in it is a separate decision and a missing one is invisible until it is
 * exploited. That includes the spellings that only exist to get past a check like this:
 * the legacy IPv4 forms `URL` silently normalizes, the IPv6 prefixes that carry an IPv4
 * inside them, and the fully qualified `localhost.` that matches no suffix rule until its
 * root label is stripped.
 *
 * The second is that the challenge fails closed in every direction, an absent secret
 * included. An unconfigured deployment refuses rather than passing, and it says so in the
 * log, because the alternative — a quietly unchallenged prober — looks identical to a
 * protected one from outside until the bill arrives.
 *
 * The third is that the refusals stay apart. A test asserting only `isFailure` would pass
 * while the page told a visitor their site was down because we had run out of budget, or
 * told somebody who had not ticked the box to reload the page.
 *
 * The fourth is what a billed probe does and does not skip: the three free-tier controls
 * go, and the two that keep this Worker from being an attack proxy stay. Both halves are
 * asserted, because the failure modes are a spent budget nobody owed and an open prober.
 *
 * The Cloudflare bindings (`KV`, `TRIAL_RATE_LIMITER`) are stubbed via
 * `mock.module("cloudflare:workers", ...)`, and both outbound calls — DNS-over-HTTPS and
 * Turnstile's siteverify — are stubbed on the global `fetch`, routed by hostname so a test
 * can fail one without touching the other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import { logger } from "@pkg/logger";
import { isFailure } from "@pkg/result";

import type { TrialProbeRequest } from "~/app/services/trial-guard";

/** Stands in for KV, so a test can seed today's counter and read back what was written. */
let kvStore = new Map<string, string>();
let kvGetMock = mock(async (key: string) => kvStore.get(key) ?? null);
let kvPutMock = mock(async (key: string, value: string, _options?: unknown) => {
	kvStore.set(key, value);
});

/** What the rate limiter binding answers; flipped by the rate-limit tests. */
let rateLimitAllowed = true;
let rateLimitMock = mock(async (_options: { key: string }) => ({ success: rateLimitAllowed }));

/**
 * The bindings and secrets the service reads. Mutated rather than re-mocked between tests,
 * because the service reads both Turnstile keys off this object at call time — which is the
 * behaviour that lets an absent secret be a supported state.
 */
let envStub: Record<string, unknown> = {
	KV: { get: kvGetMock, put: kvPutMock },
	TRIAL_RATE_LIMITER: { limit: rateLimitMock },
};

mock.module("cloudflare:workers", () => ({
	env: envStub,
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

/** Builds the DoH JSON answer for one query out of {@link dnsRecords}. */
function respondDns(url: URL): Response {
	let name = url.searchParams.get("name") ?? "";
	let type = url.searchParams.get("type") ?? "";
	if (dnsFailures.has(`${name}:${type}`)) return new Response("{}", { status: 502 });

	let values = dnsRecords.get(`${name}:${type}`) ?? [];
	return Response.json({
		Status: 0,
		Answer: values.map((data) => ({ name, type: type === "A" ? 1 : 28, TTL: 60, data })),
	});
}

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

beforeEach(() => {
	kvStore.clear();
	kvGetMock.mockClear();
	kvPutMock.mockClear();
	kvGetMock.mockImplementation(async (key: string) => kvStore.get(key) ?? null);
	kvPutMock.mockImplementation(async (key: string, value: string) => {
		kvStore.set(key, value);
	});

	rateLimitAllowed = true;
	rateLimitMock.mockClear();

	turnstileSuccess = true;
	turnstileStatus = 200;
	envStub.TURNSTILE_SECRET_KEY = "turnstile-secret";
	envStub.TURNSTILE_SITE_KEY = "turnstile-site";

	dnsRecords.clear();
	dnsFailures.clear();
	dnsRecords.set("example.com:A", ["93.184.216.34"]);
	dnsRecords.set("example.com:AAAA", []);

	// Silenced rather than left to print: the unconfigured-secret case logs on every request
	// by design, and one of the tests below asserts on exactly that call.
	spyOn(logger, "error").mockImplementation(() => {});

	globalThis.fetch = mock(async (input: unknown) => {
		let url = new URL(input instanceof URL ? input.href : String(input));
		if (url.hostname === "cloudflare-dns.com") return respondDns(url);
		if (url.hostname === "challenges.cloudflare.com") {
			if (turnstileStatus !== 200) return new Response("{}", { status: turnstileStatus });
			return Response.json({ success: turnstileSuccess });
		}
		throw new Error(`unexpected fetch to ${url.href}`);
	}) as unknown as typeof fetch;
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

		let calls = (globalThis.fetch as unknown as ReturnType<typeof mock>).mock.calls;
		expect(calls.some((call) => String(call[0]).includes("cloudflare-dns.com"))).toBe(false);
	});

	test("verifies the token against siteverify with the secret and the calling address", async () => {
		await guardTrialProbe(submission("example.com", { token: "token-9", address: "198.51.100.7" }));

		let calls = (globalThis.fetch as unknown as ReturnType<typeof mock>).mock.calls;
		let verification = calls.find((call) => String(call[0]).includes("siteverify"));
		expect(verification).toBeDefined();

		let init = verification?.[1] as RequestInit;
		expect(init.method).toBe("POST");
		let body = init.body as URLSearchParams;
		expect(body.get("secret")).toBe("turnstile-secret");
		expect(body.get("response")).toBe("token-9");
		expect(body.get("remoteip")).toBe("198.51.100.7");
	});

	test("refuses when siteverify rejects the token", async () => {
		turnstileSuccess = false;

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("failed-challenge");
	});

	test("tells an unfinished form apart from a rejected token, and asks nobody about it", async () => {
		let result = await guardTrialProbe(submission("example.com", { token: null }));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("challenge-incomplete");
		// The token is never sent for verification, so nothing is spent asking.
		let calls = (globalThis.fetch as unknown as ReturnType<typeof mock>).mock.calls;
		expect(calls.some((call) => String(call[0]).includes("siteverify"))).toBe(false);
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
		delete envStub.TURNSTILE_SECRET_KEY;
		let log = spyOn(logger, "error").mockImplementation(() => {});

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		/**
		 * `unavailable` and not `failed-challenge`: the visitor completed everything asked of
		 * them, and this deployment is the thing that is wrong.
		 */
		expect(result.error.reason).toBe("unavailable");
		expect(result.error.detail).toBe("turnstile-unconfigured");
		let calls = (globalThis.fetch as unknown as ReturnType<typeof mock>).mock.calls;
		expect(calls.some((call) => String(call[0]).includes("siteverify"))).toBe(false);
		expect(log).toHaveBeenCalledWith("trial_guard.turnstile_unconfigured", expect.anything());
	});

	test("refuses when the secret is present but empty", async () => {
		envStub.TURNSTILE_SECRET_KEY = "";

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

		expect(rateLimitMock).toHaveBeenCalledWith({ key: "trial-probe:198.51.100.2" });
	});

	test("spends exactly one unit of the binding's budget per probe", async () => {
		await guardTrialProbe(submission("example.com"));

		/**
		 * The binding counts one request per call and its ceiling is three per minute, so a
		 * second call here would silently cut a visitor's allowance from three probes to one.
		 * Cheap to assert, and the failure it catches looks like the feature being broken
		 * rather than like a limit being wrong.
		 */
		expect(rateLimitMock).toHaveBeenCalledTimes(1);
	});

	test("refuses an address that is over its budget, before anything is spent on it", async () => {
		rateLimitAllowed = false;

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("rate-limited");
		expect(result.error.retryAfterSeconds).toBeGreaterThan(0);
		expect(kvGetMock).not.toHaveBeenCalled();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	test("counts a granted probe against today's global budget", async () => {
		await guardTrialProbe(submission("example.com"));

		expect(kvPutMock).toHaveBeenCalledWith(budgetKey, "1", { expirationTtl: 172_800 });
	});

	test("continues from the count already stored for the day", async () => {
		kvStore.set(budgetKey, "41");

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(false);
		if (isFailure(result)) return;
		expect(result.data.budgetRemaining).toBe(TRIAL_DAILY_BUDGET - 42);
		expect(kvPutMock).toHaveBeenCalledWith(budgetKey, "42", { expirationTtl: 172_800 });
	});

	test("refuses once the day's budget is spent, and says so distinguishably", async () => {
		kvStore.set(budgetKey, String(TRIAL_DAILY_BUDGET));

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("budget-exhausted");
		expect(result.error.detail).toBe("daily-cap");
		expect(kvPutMock).not.toHaveBeenCalled();
	});

	test("treats an unreadable counter as exhaustion rather than as unlimited spend", async () => {
		kvGetMock.mockImplementation(async () => {
			throw new Error("KV is unavailable");
		});

		let result = await guardTrialProbe(submission("example.com"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("budget-exhausted");
		expect(result.error.detail).toBe("counter-unavailable");
	});

	test("still grants the probe when the counter cannot be written back", async () => {
		kvPutMock.mockImplementation(async () => {
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
		expect(globalThis.fetch).not.toHaveBeenCalled();
		expect(kvPutMock).not.toHaveBeenCalled();
	});

	test("spends none of the free-tier controls on a billed probe", async () => {
		let result = await guardTrialProbe(submission("example.com", { token: null, billed: true }));

		expect(isFailure(result)).toBe(false);
		if (isFailure(result)) return;
		// Nothing to report: a billed probe takes nothing out of the day's allowance.
		expect(result.data.budgetRemaining).toBeNull();
		expect(rateLimitMock).not.toHaveBeenCalled();
		expect(kvGetMock).not.toHaveBeenCalled();
		expect(kvPutMock).not.toHaveBeenCalled();

		let calls = (globalThis.fetch as unknown as ReturnType<typeof mock>).mock.calls;
		expect(calls.some((call) => String(call[0]).includes("siteverify"))).toBe(false);
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
		delete envStub.TURNSTILE_SITE_KEY;
		expect(trialTurnstileSiteKey()).toBeNull();

		envStub.TURNSTILE_SITE_KEY = "";
		expect(trialTurnstileSiteKey()).toBeNull();
	});
});
