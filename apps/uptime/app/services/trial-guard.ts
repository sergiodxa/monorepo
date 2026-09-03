/**
 * The fence in front of the public "try it" probe: the checks that must all pass before
 * an anonymous visitor gets to make this Worker fetch a URL they chose.
 *
 * Three things can go wrong with that outbound request: the target can be private
 * ({@link checkTarget}), the caller can be a script ({@link verifyChallenge}), and the
 * volume can be unbounded ({@link consumeCallerBudget}, {@link spendDailyBudget}).
 * {@link guardTrialProbe} runs all three, cheapest first, and returns one `Result`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Adapter, RateLimiterBinding } from "@sdxc/rate-limit";
import type { Result } from "@sdxc/result";

import { logger } from "@sdxc/logger";
import { CloudflareAdapter, MemoryAdapter } from "@sdxc/rate-limit";
import { failure, isFailure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import { recordCost } from "~/app/services/cost";
import { resolveDns } from "~/app/services/dns-check";

/** Cloudflare's server-side verification endpoint for a Turnstile token. */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Free probes the whole site performs in one UTC day, across every visitor.
 *
 * A cost fence, not a marketing quota: sized so a normal day is unaffected and a bad
 * day of scripted traffic costs only cents in Durable Object billing.
 */
export const TRIAL_DAILY_BUDGET = 500;

/** Key namespace for the daily counter, kept stable so a deploy doesn't reset the day. */
const BUDGET_PREFIX = "trial:budget";

/**
 * How long a day's counter outlives its day: two days, so a request served either side of
 * the UTC boundary always finds its own day's key, and the keys expire themselves
 * automatically.
 */
const BUDGET_TTL_SECONDS = 172_800;

/**
 * Probes one address may spend per {@link CALLER_WINDOW}, mirroring the `simple.limit`
 * on the `TRIAL_RATE_LIMITER` binding (kept in step by hand; it reports neither number
 * back). A shaping limit — {@link TRIAL_DAILY_BUDGET} is the real cost fence.
 */
const CALLER_LIMIT = 3;

/** Length of the caller budget's window; matches the binding's `simple.period` of 60. */
const CALLER_WINDOW = "1 minute";

/** Key namespace for the caller budget, kept stable so the counters survive a deploy. */
const CALLER_PREFIX = "trial-probe";

/**
 * Stand-in for a caller whose address the platform did not report, so every such request
 * counts against one shared bucket, keeping an unidentifiable caller inside the limit.
 */
const UNKNOWN_ADDRESS = "unknown";

/**
 * Address ranges that are not on the public internet, as `[network, prefix length]`.
 * `169.254.0.0/16` matters most: it holds the cloud metadata address
 * `169.254.169.254`, the highest-value target an open prober could reach.
 */
const BLOCKED_IPV4: readonly (readonly [string, number])[] = [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.0.2.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["198.51.100.0", 24],
	["203.0.113.0", 24],
	["224.0.0.0", 4],
	["240.0.0.0", 4],
];

/**
 * IPv6 ranges that are not on the public internet, as `[network, prefix length]`. Teredo
 * (`2001::/32`) is blocked as a whole prefix, since no genuine monitored site sits behind
 * it; the prefixes carrying a routable IPv4 are unpacked and checked — see {@link embeddedIpv4}.
 */
const BLOCKED_IPV6: readonly (readonly [string, number])[] = [
	["::", 96],
	["100::", 64],
	["2001::", 32],
	["2001:db8::", 32],
	["fc00::", 7],
	["fe80::", 10],
	["ff00::", 8],
];

/**
 * Name suffixes that never denote a public host: resolver-local names, private-network
 * conventions, and RFC 2606 reserved TLDs. Matched against the name's last labels, so
 * listing `example` blocks suffixes like `foo.example` while leaving `example.com` alone.
 */
const BLOCKED_SUFFIXES: readonly string[] = [
	"localhost",
	"local",
	"internal",
	"intranet",
	"lan",
	"corp",
	"private",
	"home.arpa",
	"test",
	"invalid",
	"example",
];

/** Ports a trial probe may use. */
const ALLOWED_PORTS: readonly string[] = ["", "80", "443"];

/** Why a trial probe was refused, at the granularity the page needs to explain itself. */
export type TrialRefusalReason =
	/** The URL points somewhere an anonymous visitor may not send us. */
	| "blocked-target"
	/**
	 * The form arrived with no Turnstile token — what an unticked widget looks like. An
	 * unfinished form the visitor clears by finishing the widget already on the page.
	 */
	| "challenge-incomplete"
	/** A Turnstile token was supplied and Cloudflare did not accept it. */
	| "failed-challenge"
	/** This address has spent its budget; it can try again shortly. */
	| "rate-limited"
	/** The site has performed all the free probes it will perform today. */
	| "budget-exhausted"
	/**
	 * Something on this deployment stopped the check before it could run, so nothing was
	 * learned about the target — a fault attributable to the deployment itself. See
	 * {@link TrialRefusal} on `detail` for the specific cause, meant for the logs.
	 */
	| "unavailable";

/**
 * A refused trial probe.
 *
 * `reason` drives what the page shows a visitor; `detail` names the specific rule that
 * fired, meant for an operator reading production logs.
 */
export class TrialRefusal extends Error {
	/** Which control refused, and therefore what the page should say. */
	readonly reason: TrialRefusalReason;

	/** The specific rule that fired, meant for an operator reading logs. */
	readonly detail: string;

	/**
	 * Seconds until the caller could succeed, when that is knowable from a rate limit's
	 * window. `null` for the daily budget too: its reset is UTC midnight, which the caller
	 * can derive on its own.
	 */
	readonly retryAfterSeconds: number | null;

	/**
	 * @param reason - Which control refused.
	 * @param detail - The rule that fired, in log vocabulary.
	 * @param retryAfterSeconds - Seconds until a retry could work, when known.
	 */
	constructor(reason: TrialRefusalReason, detail: string, retryAfterSeconds: number | null = null) {
		super(`Trial probe refused: ${reason} (${detail})`);
		this.name = "TrialRefusal";
		this.reason = reason;
		this.detail = detail;
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

/** One visitor asking for one free probe. */
export interface TrialProbeRequest {
	/** The target exactly as it was typed, with or without a scheme. */
	target: string;
	/** The token Turnstile's widget produced, or `null` when the form sent none. */
	token: string | null;
	/**
	 * The request being served, read only for `CF-Connecting-IP`. Passing the request keeps
	 * the "never trust `X-Forwarded-For`" rule enforced in this one place.
	 */
	request: Request;
	/**
	 * Whether the caller is charging this probe to an account, which turns off the
	 * free-tier controls: the per-address budget, the challenge, and the daily budget.
	 * Required, so every call site commits to an answer about who is paying.
	 */
	billed: boolean;
}

/** Permission to perform one free probe, and what was learned getting there. */
export interface TrialProbeGrant {
	/** The normalized absolute URL to probe. */
	url: URL;
	/**
	 * The addresses the hostname resolved to when it was checked, all of them public — a
	 * record of what was verified. {@link guardTrialProbe} explains why the probe itself
	 * cannot be pinned to them.
	 */
	addresses: string[];
	/**
	 * Free probes left in today's global budget once this one is counted, or `null` for a
	 * billed probe, which spends none of it and therefore has nothing to report.
	 */
	budgetRemaining: number | null;
}

/**
 * The Turnstile secret, when the running deployment has one.
 *
 * Read structurally off `env` so an absent secret is a describable state: {@link
 * verifyChallenge} turns it into a refusal for every probe, keeping the app running.
 *
 * @returns The secret, or `undefined` when this deployment has none.
 */
function turnstileSecret(): string | undefined {
	let candidate: unknown = (env as { TURNSTILE_SECRET_KEY?: unknown }).TURNSTILE_SECRET_KEY;
	if (typeof candidate !== "string" || candidate.length === 0) return undefined;
	return candidate;
}

/**
 * The Turnstile site key the page renders its widget with, read the same structural way
 * as the secret. A deployment with none renders no widget, so the form sends no token and
 * {@link verifyChallenge} refuses every probe — the safe failure mode for an open prober.
 *
 * @returns The site key, or `null` when this deployment has none.
 */
export function trialTurnstileSiteKey(): string | null {
	let candidate: unknown = (env as { TURNSTILE_SITE_KEY?: unknown }).TURNSTILE_SITE_KEY;
	if (typeof candidate !== "string" || candidate.length === 0) return null;
	return candidate;
}

/**
 * The `TRIAL_RATE_LIMITER` binding, when the running deployment declares one.
 *
 * Read structurally off `env`, so a deploy predating the `ratelimits` entry, or a local
 * runtime without it, still serves the page with an absent binding treated as valid.
 *
 * @returns The binding, or `undefined` when this deployment has none.
 */
function rateLimiterBinding(): RateLimiterBinding | undefined {
	let candidate: unknown = (env as { TRIAL_RATE_LIMITER?: unknown }).TRIAL_RATE_LIMITER;
	if (typeof candidate !== "object" || candidate === null) return undefined;
	if (!("limit" in candidate) || typeof candidate.limit !== "function") return undefined;
	return candidate as RateLimiterBinding;
}

/**
 * The caller budget's backend, built on the first request and reused after that, since a
 * binding off `env` becomes available only once a request begins.
 */
let callerLimiter: Adapter | undefined;

/**
 * Backend counting the caller budget. The binding bills nothing per call, keeping this
 * limit cheaper than the thing it protects. Isolate memory serves as a fallback when no
 * binding exists — weaker, since each isolate keeps its own count, but free.
 *
 * @returns The adapter to count with.
 */
function createCallerAdapter(): Adapter {
	let binding = rateLimiterBinding();
	let options = { limit: CALLER_LIMIT, window: CALLER_WINDOW } as const;

	if (binding === undefined) return new MemoryAdapter(options);
	return new CloudflareAdapter(binding, options);
}

/**
 * Spends one probe from the calling address's budget, keyed on `CF-Connecting-IP` since
 * `X-Forwarded-For` is spoofable by the client. Fails **open** on a broken backend, since
 * this limit only shapes traffic — {@link spendDailyBudget} is what bounds real spend.
 *
 * @param request - The request being served.
 * @returns A refusal when the address is over budget, `null` when it may proceed.
 */
async function consumeCallerBudget(request: Request): Promise<TrialRefusal | null> {
	callerLimiter ??= createCallerAdapter();

	let address = request.headers.get("CF-Connecting-IP") ?? UNKNOWN_ADDRESS;
	let decision = await callerLimiter.consume(`${CALLER_PREFIX}:${address}`);

	if (isFailure(decision)) {
		logger.error("trial_guard.rate_limit_unavailable", { message: decision.error.message });
		return null;
	}

	if (decision.data.allowed) return null;
	return new TrialRefusal("rate-limited", "caller-budget", decision.data.retryAfter);
}

/**
 * Parses a canonical dotted-quad into a 32-bit number. `URL` normalizes every legacy
 * spelling — octal, hex, bare integers — into dotted decimal while parsing, which is why
 * the blocklist safely runs against the already-normalized `url.hostname`.
 *
 * @param literal - A dotted-decimal address.
 * @returns The address as a number, or `null` when it is not one.
 */
function parseIpv4(literal: string): number | null {
	let parts = literal.split(".");
	if (parts.length !== 4) return null;

	let value = 0;
	for (let part of parts) {
		if (!/^\d{1,3}$/.test(part)) return null;
		let octet = Number(part);
		if (octet > 255) return null;
		value = value * 256 + octet;
	}
	return value;
}

/**
 * Converts textual IPv6 groups into numbers, expanding a trailing dotted quad into the two
 * groups it occupies.
 *
 * @param parts - Colon-separated groups, without any `::` compression.
 * @returns The groups as numbers, or `null` when any of them is malformed.
 */
function parseIpv6Groups(parts: string[]): number[] | null {
	let groups: number[] = [];

	for (let [index, part] of parts.entries()) {
		if (part.includes(".")) {
			if (index !== parts.length - 1) return null;
			let embedded = parseIpv4(part);
			if (embedded === null) return null;
			groups.push(Math.floor(embedded / 65_536), embedded % 65_536);
			continue;
		}

		if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
		groups.push(Number.parseInt(part, 16));
	}

	return groups;
}

/**
 * An IPv6 address, as the eight 16-bit groups it is made of: a tuple, so the prefix table
 * and {@link embeddedIpv4} can index every position with a guaranteed value present.
 */
type Ipv6Groups = readonly [number, number, number, number, number, number, number, number];

/**
 * Narrows a list of groups to an address, rejecting any length but eight. The destructured
 * defaults below are unreachable once the length check passes; they exist only to give the
 * destructure a tuple type.
 *
 * @param groups - The groups parsed out of a literal.
 * @returns The address, or `null` when there are not exactly eight groups.
 */
function toIpv6Groups(groups: number[]): Ipv6Groups | null {
	if (groups.length !== 8) return null;
	let [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0] = groups;
	return [a, b, c, d, e, f, g, h];
}

/**
 * Parses an IPv6 literal into its eight groups. `rawTail` is `undefined` exactly when the
 * literal used no `::` compression, which decides whether the groups need zero-padding.
 *
 * @param literal - An IPv6 address without surrounding brackets.
 * @returns Eight 16-bit groups, or `null` when the literal is not a valid address.
 */
function parseIpv6(literal: string): Ipv6Groups | null {
	let halves = literal.split("::");
	if (halves.length > 2) return null;
	let [rawHead = "", rawTail] = halves;

	let head = parseIpv6Groups(rawHead === "" ? [] : rawHead.split(":"));
	let tail = parseIpv6Groups(rawTail === undefined || rawTail === "" ? [] : rawTail.split(":"));
	if (head === null || tail === null) return null;

	if (rawTail === undefined) return toIpv6Groups(head);

	let missing = 8 - head.length - tail.length;
	if (missing < 1) return null;
	return toIpv6Groups([...head, ...Array.from({ length: missing }, () => 0), ...tail]);
}

/**
 * The IPv4 address an IPv6 address carries inside it: `::ffff:0:0/96` IPv4-mapped,
 * `64:ff9b::/96` NAT64, and `2002::/16` 6to4 — three notations that could otherwise
 * smuggle an address like `169.254.169.254` past an IPv6-only blocklist.
 *
 * @param groups - The eight groups of an IPv6 address.
 * @returns The embedded IPv4 as a number, or `null` when this address embeds none.
 */
function embeddedIpv4(groups: Ipv6Groups): number | null {
	let isMapped =
		groups[0] === 0 &&
		groups[1] === 0 &&
		groups[2] === 0 &&
		groups[3] === 0 &&
		groups[4] === 0 &&
		groups[5] === 0xffff;
	if (isMapped) return groups[6] * 65_536 + groups[7];

	let isNat64 =
		groups[0] === 0x0064 &&
		groups[1] === 0xff9b &&
		groups[2] === 0 &&
		groups[3] === 0 &&
		groups[4] === 0 &&
		groups[5] === 0;
	if (isNat64) return groups[6] * 65_536 + groups[7];

	if (groups[0] === 0x2002) return groups[1] * 65_536 + groups[2];

	return null;
}

/**
 * Whether an IPv4 address falls inside a `[network, prefix]` range. Compares by division:
 * a 32-bit shift in JavaScript operates on signed integers, so masking `240.0.0.0/4`
 * would produce a negative number, breaking the comparison at the top of the address space.
 *
 * @param address - The address, as a number.
 * @param network - The range's network address, dotted-decimal.
 * @param prefix - The range's prefix length in bits.
 * @returns Whether the address is in the range.
 */
function inIpv4Range(address: number, network: string, prefix: number): boolean {
	let base = parseIpv4(network);
	if (base === null) return false;
	let size = 2 ** (32 - prefix);
	return Math.floor(address / size) === Math.floor(base / size);
}

/**
 * The 128 bits of an IPv6 address, most significant first, so a prefix comparison is a
 * string comparison.
 *
 * @param groups - The address, as eight groups.
 * @returns 128 characters of `0` and `1`.
 */
function toBits(groups: Ipv6Groups): string {
	return groups.map((group) => group.toString(2).padStart(16, "0")).join("");
}

/**
 * Whether an IPv6 address falls inside a `[network, prefix]` range. Compared as text, bit
 * by bit, since a prefix off a group boundary — `fc00::/7`, `fe80::/10` — needs a partial
 * mask, and a wrong one would silently widen or narrow the range.
 *
 * @param address - The address, as eight groups.
 * @param network - The range's network address, in IPv6 notation.
 * @param prefix - The range's prefix length in bits.
 * @returns Whether the address is in the range.
 */
function inIpv6Range(address: Ipv6Groups, network: string, prefix: number): boolean {
	let base = parseIpv6(network);
	if (base === null) return false;
	return toBits(address).slice(0, prefix) === toBits(base).slice(0, prefix);
}

/**
 * Whether an address literal is one a trial probe may be pointed at.
 *
 * An unparseable literal is refused, so only a form this function fully recognizes can
 * get through.
 *
 * @param literal - An IPv4 or IPv6 address, without brackets.
 * @returns Whether the address is on the public internet.
 */
export function isPublicAddress(literal: string): boolean {
	let ipv4 = parseIpv4(literal);
	if (ipv4 !== null) {
		return !BLOCKED_IPV4.some(([network, prefix]) => inIpv4Range(ipv4, network, prefix));
	}

	let ipv6 = parseIpv6(literal);
	if (ipv6 === null) return false;

	let embedded = embeddedIpv4(ipv6);
	if (embedded !== null) {
		return !BLOCKED_IPV4.some(([network, prefix]) => inIpv4Range(embedded, network, prefix));
	}

	return !BLOCKED_IPV6.some(([network, prefix]) => inIpv6Range(ipv6, network, prefix));
}

/**
 * The bare address a hostname encodes directly, when the hostname is itself a literal.
 *
 * A bracketed hostname is IPv6 by definition; anything else is a literal only if it parses
 * as IPv4, since `URL` leaves those bare.
 *
 * @param hostname - A hostname as `URL` normalized it, IPv6 still bracketed.
 * @returns The bare address, or `null` when the hostname is a name.
 */
function addressLiteral(hostname: string): string | null {
	if (hostname.startsWith("[")) return hostname.slice(1, -1);
	return parseIpv4(hostname) === null ? null : hostname;
}

/**
 * Whether a hostname is one a trial probe may be pointed at, judged on the name alone. A
 * single-label name is refused since resolver search domains could turn it into an
 * internal host, and a trailing root dot is stripped first so `localhost.` still matches.
 *
 * @param hostname - A normalized hostname, already lowercased by `URL`.
 * @returns Whether the name may be probed.
 */
function isAllowedHostname(hostname: string): boolean {
	let name = hostname.replace(/\.+$/, "");
	if (!name.includes(".")) return false;
	return !BLOCKED_SUFFIXES.some((suffix) => name === suffix || name.endsWith(`.${suffix}`));
}

/**
 * Normalizes what the visitor typed and applies every rule decidable from the URL alone.
 * Credentials are refused, since this Worker would otherwise relay them to a third party,
 * and only the two HTTP default ports are allowed, keeping the page from scanning a host.
 *
 * @param target - The target as typed.
 * @returns The normalized URL, or a refusal naming the rule that fired.
 */
export function checkTarget(target: string): Result<URL, TrialRefusal> {
	let trimmed = target.trim();
	if (trimmed === "") return failure(new TrialRefusal("blocked-target", "empty"));

	/**
	 * A scheme is only recognized when it is followed by `//`. Without that, `example.com:8080`
	 * reads as the scheme `example.com`, since a scheme may contain dots.
	 */
	let scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(trimmed)?.[1]?.toLowerCase();
	if (scheme !== undefined && scheme !== "http" && scheme !== "https") {
		return failure(new TrialRefusal("blocked-target", "unsupported-scheme"));
	}

	let url: URL;
	try {
		url = new URL(scheme === undefined ? `https://${trimmed}` : trimmed);
	} catch {
		return failure(new TrialRefusal("blocked-target", "unparseable"));
	}

	if (url.hostname === "") return failure(new TrialRefusal("blocked-target", "no-hostname"));
	if (url.username !== "" || url.password !== "") {
		return failure(new TrialRefusal("blocked-target", "credentials-in-url"));
	}
	if (!ALLOWED_PORTS.includes(url.port)) {
		return failure(new TrialRefusal("blocked-target", "unsupported-port"));
	}

	let literal = addressLiteral(url.hostname);
	if (literal !== null) {
		if (!isPublicAddress(literal)) {
			return failure(new TrialRefusal("blocked-target", "private-address"));
		}
		return success(url);
	}

	if (!isAllowedHostname(url.hostname)) {
		return failure(new TrialRefusal("blocked-target", "blocked-hostname"));
	}

	return success(url);
}

/**
 * Resolves a hostname and checks every address it answers with. A literal blocklist only
 * stops `http://127.0.0.1`; the real attack is a public name whose `A` record points at an
 * internal address — caught only by resolving the name first, so any resolution failure refuses the target.
 *
 * @param hostname - The hostname to resolve.
 * @returns The resolved public addresses, or a refusal.
 */
async function checkResolvedAddresses(hostname: string): Promise<Result<string[], TrialRefusal>> {
	let [a, aaaa] = await Promise.allSettled([
		resolveDns(hostname, "A"),
		resolveDns(hostname, "AAAA"),
	]);

	if (a.status === "rejected" && aaaa.status === "rejected") {
		return failure(new TrialRefusal("blocked-target", "unresolvable"));
	}
	if (a.status === "rejected" || aaaa.status === "rejected") {
		return failure(new TrialRefusal("blocked-target", "partial-resolution"));
	}

	let addresses = [...a.value.values, ...aaaa.value.values];
	if (addresses.length === 0) {
		return failure(new TrialRefusal("blocked-target", "no-address"));
	}

	for (let address of addresses) {
		if (!isPublicAddress(address)) {
			return failure(new TrialRefusal("blocked-target", "private-address"));
		}
	}

	return success(addresses);
}

/**
 * Verifies a Turnstile token server-side. Fails **closed** in every direction, including
 * an unconfigured deployment, since an open prober is worse than a degraded page. A
 * missing token is kept distinct from a rejected one, since only it is a form to finish.
 *
 * @param token - The token the widget produced.
 * @param address - The calling address, which Turnstile cross-checks against the token.
 * @returns The refusal to answer with, or `null` when the caller may proceed.
 */
async function verifyChallenge(
	token: string | null,
	address: string | null,
): Promise<TrialRefusal | null> {
	let secret = turnstileSecret();
	if (secret === undefined) {
		logger.error("trial_guard.turnstile_unconfigured", {
			reason: "TURNSTILE_SECRET_KEY is not configured; trial probes cannot be challenged",
		});
		return new TrialRefusal("unavailable", "turnstile-unconfigured");
	}

	if (token === null || token === "") {
		return new TrialRefusal("challenge-incomplete", "no-token");
	}

	let body = new URLSearchParams({ secret, response: token });
	if (address !== null) body.set("remoteip", address);

	try {
		let response = await fetch(SITEVERIFY_URL, { method: "POST", body });
		if (!response.ok) {
			logger.error("trial_guard.turnstile_unavailable", { status: response.status });
			return new TrialRefusal("failed-challenge", "siteverify-unavailable");
		}

		let parsed = s.parseSafe(s.object({ success: s.boolean() }), await response.json());
		if (!parsed.success) {
			logger.error("trial_guard.turnstile_unreadable");
			return new TrialRefusal("failed-challenge", "siteverify-unreadable");
		}

		if (parsed.value.success) return null;
		return new TrialRefusal("failed-challenge", "token-rejected");
	} catch (error) {
		logger.error("trial_guard.turnstile_unavailable", {
			message: error instanceof Error ? error.message : String(error),
		});
		return new TrialRefusal("failed-challenge", "siteverify-unreachable");
	}
}

/**
 * Counts one probe against today's global budget in a KV counter keyed on the UTC day.
 * **Approximate by construction**, since KV lacks atomic increment — a burst can slightly
 * overshoot the cap, and a read failure counts as exhaustion, the safe side of that gap.
 *
 * @returns Probes left after this one, or a refusal when the day is spent.
 */
async function spendDailyBudget(): Promise<Result<number, TrialRefusal>> {
	let day = new Date().toISOString().slice(0, 10);
	let key = `${BUDGET_PREFIX}:${day}`;

	let used = 0;
	try {
		recordCost("kvRead");
		let stored = await env.KV.get(key);
		let parsed = stored === null ? 0 : Number.parseInt(stored, 10);
		used = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
	} catch (error) {
		logger.error("trial_guard.budget_unreadable", {
			message: error instanceof Error ? error.message : String(error),
		});
		return failure(new TrialRefusal("budget-exhausted", "counter-unavailable"));
	}

	if (used >= TRIAL_DAILY_BUDGET) {
		return failure(new TrialRefusal("budget-exhausted", "daily-cap"));
	}

	try {
		recordCost("kvMutation");
		await env.KV.put(key, String(used + 1), { expirationTtl: BUDGET_TTL_SECONDS });
	} catch (error) {
		logger.error("trial_guard.budget_unwritable", {
			message: error instanceof Error ? error.message : String(error),
		});
	}

	return success(TRIAL_DAILY_BUDGET - (used + 1));
}

/**
 * Runs every control and answers whether this visitor gets their free probe. Call once
 * per submission: a grant already counts against both budgets, so deciding not to probe
 * afterward still spends one. A `billed` probe skips only the free-tier controls.
 *
 * @param probe - The visitor's submission.
 * @returns Permission to probe, or the reason they were refused.
 */
export async function guardTrialProbe(
	probe: TrialProbeRequest,
): Promise<Result<TrialProbeGrant, TrialRefusal>> {
	if (!probe.billed) {
		let limited = await consumeCallerBudget(probe.request);
		if (limited !== null) return failure(limited);
	}

	let target = checkTarget(probe.target);
	if (isFailure(target)) return target;

	if (!probe.billed) {
		let address = probe.request.headers.get("CF-Connecting-IP");
		let challenge = await verifyChallenge(probe.token, address);
		if (challenge !== null) return failure(challenge);
	}

	let literal = addressLiteral(target.data.hostname);
	let addresses = literal === null ? [] : [literal];
	if (literal === null) {
		let resolved = await checkResolvedAddresses(target.data.hostname);
		if (isFailure(resolved)) return resolved;
		addresses = resolved.data;
	}

	if (probe.billed) return success({ url: target.data, addresses, budgetRemaining: null });

	let budget = await spendDailyBudget();
	if (isFailure(budget)) return budget;

	return success({ url: target.data, addresses, budgetRemaining: budget.data });
}
