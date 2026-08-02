/**
 * The fence in front of the public "try it" probe: the checks that must all pass before an
 * anonymous visitor gets to make this Worker fetch a URL they chose.
 *
 * Everything here exists because that probe is an outbound request made on a stranger's
 * behalf, from our egress and under our domain. Three distinct things can go wrong with
 * that and each has its own control: the target can be somewhere a stranger has no
 * business reaching through us ({@link checkTarget}), the caller can be a script rather
 * than a person ({@link verifyChallenge}), and the volume can be whatever a bored person
 * with a loop decides ({@link consumeCallerBudget} per address, {@link spendDailyBudget}
 * across the whole site).
 *
 * One entry point, {@link guardTrialProbe}, runs all three and answers with a single
 * `Result` so the page's action branches once. The refusal reasons stay distinguishable on
 * purpose: "we stopped for the day" and "your site is unreachable" are different sentences
 * to show a visitor, and collapsing them would make the page lie.
 *
 * Ordering is by cost, cheapest first, so the expensive checks are only reached by
 * requests that survived the free ones: the caller budget is a binding call that bills
 * nothing, the target rules are pure string work, the challenge is one round trip, DNS is
 * one or two more, and the daily budget is the only step that spends KV.
 *
 * ## Billed probes
 *
 * A caller that is charging the probe to an account passes `billed` and skips the three
 * controls that exist purely because an anonymous probe is free — the per-address budget,
 * the challenge, and the daily budget. None of them are protecting anything for a request
 * that pays its own way, and the daily cost fence in particular must not be spent by
 * traffic that is not costing us anything. The target rules and the resolve-and-verify
 * step are *not* skipped: those are about this Worker not being used as an attack proxy,
 * which is as true of a signed-in caller as of a stranger.
 *
 * What this deliberately does not do: perform the probe, decide what to tell the visitor,
 * or record anything to Analytics Engine. A caller granted a probe does those itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Adapter, RateLimiterBinding } from "@pkg/rate-limit";
import type { Result } from "@pkg/result";

import { logger } from "@pkg/logger";
import { CloudflareAdapter, MemoryAdapter } from "@pkg/rate-limit";
import { failure, isFailure, success } from "@pkg/result";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import { recordCost } from "~/app/services/cost";
import { resolveDns } from "~/app/services/dns-check";

/** Cloudflare's server-side verification endpoint for a Turnstile token. */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Free probes the whole site performs in one UTC day, across every visitor.
 *
 * A cost fence, not a marketing quota. Each probe runs through a Durable Object, so the
 * bill for the trial page scales with however many requests reach it, and without a
 * ceiling one afternoon of somebody's script is an unbounded invoice. The number is set
 * where a normal day of curious visitors never notices it and a bad day costs cents.
 */
export const TRIAL_DAILY_BUDGET = 500;

/** Key namespace for the daily counter, kept stable so a deploy doesn't reset the day. */
const BUDGET_PREFIX = "trial:budget";

/**
 * How long a day's counter outlives its day. Two days rather than one so a request served
 * either side of the UTC boundary always finds its own day's key, and so the keys expire
 * themselves instead of needing a sweep.
 */
const BUDGET_TTL_SECONDS = 172_800;

/**
 * Probes one address may spend per {@link CALLER_WINDOW}, mirroring the `simple.limit`
 * declared for the `TRIAL_RATE_LIMITER` binding in `wrangler.jsonc` (the binding reports
 * neither number back, so the two are kept in step by hand and drift shows up only in what
 * a caller is told about its own budget).
 *
 * Three, against the sixty the authenticated endpoints get, because the surface is
 * different: a caller running a billed API hard is a caller paying for it, while this
 * probes on behalf of a stranger for free. Somebody trying the tool runs a check, reads the
 * result and thinks about it, so one probe a minute would cover the happy path — but this
 * budget is spent before {@link verifyChallenge} runs, so a submission the challenge
 * refuses, which is what an impatient visitor submitting ahead of the widget gets, spends
 * an allowance with no check behind it. Three is room for those retries, and still nothing
 * a script can work with.
 *
 * It is still only a shaping limit. Addresses are free, so the honest cost fence is
 * {@link TRIAL_DAILY_BUDGET}, which this cannot substitute for.
 */
const CALLER_LIMIT = 3;

/** Length of the caller budget's window; matches the binding's `simple.period` of 60. */
const CALLER_WINDOW = "1 minute";

/** Key namespace for the caller budget, kept stable so the counters survive a deploy. */
const CALLER_PREFIX = "trial-probe";

/**
 * Stand-in for a caller whose address the platform did not report, so those requests share
 * one bucket rather than escaping the limit by being unidentifiable.
 */
const UNKNOWN_ADDRESS = "unknown";

/**
 * Address ranges that are not on the public internet, as `[network, prefix length]`.
 *
 * Every entry is a range a probe reaching it would mean this Worker was used to touch
 * something a stranger cannot touch themselves, or a range no answer can come back from.
 * `169.254.0.0/16` is the one worth naming: it holds `169.254.169.254`, the cloud instance
 * metadata address, which is the single most valuable target an open prober has.
 *
 * The rest, in order: `0.0.0.0/8` this-network, `10/8`, `172.16/12` and `192.168/16`
 * RFC1918, `100.64/10` carrier-grade NAT, `127/8` loopback, `192.0.0/24` IETF protocol
 * assignments, `198.18/15` benchmarking, the three documentation ranges, `224/4` multicast
 * and `240/4` reserved (which is where the `255.255.255.255` broadcast address lives).
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
 * IPv6 ranges that are not on the public internet, as `[network, prefix length]`.
 *
 * `::/96` covers both the unspecified address and the deprecated IPv4-compatible form, and
 * it is what blocks `::1`. Then `100::/64` discard-only, `2001::/32` Teredo, `2001:db8::/32`
 * documentation, `fc00::/7` unique-local, `fe80::/10` link-local and `ff00::/8` multicast.
 *
 * Teredo is refused wholesale rather than unpacked. It hides a client IPv4 in the last two
 * groups XORed with `ffff`, so reading it back is possible, but a Teredo target is not
 * something a real monitored site is reachable at, and refusing the whole prefix cannot be
 * gotten wrong the way an unpacking can.
 *
 * The prefixes that *are* unpacked instead of listed here are the ones that carry a real,
 * routable IPv4 inside them — see {@link embeddedIpv4}.
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
 * Name suffixes that never denote a host on the public internet: the special-use names a
 * resolver answers locally, the private-network conventions, and RFC 2606's reserved TLDs.
 *
 * Matched against the last labels of the name, so `example.com` is unaffected by `example`
 * being listed — the rule is "ends in `.example`", not "contains it".
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
	 * The form arrived with no Turnstile token, which is what an unticked widget looks
	 * like. Not a failure — an unfinished form, and the only reason here the visitor can
	 * clear by doing one more thing on the page they are already looking at.
	 */
	| "challenge-incomplete"
	/** A Turnstile token was supplied and Cloudflare did not accept it. */
	| "failed-challenge"
	/** This address has spent its budget; it can try again shortly. */
	| "rate-limited"
	/** The site has performed all the free probes it will perform today. */
	| "budget-exhausted"
	/**
	 * Something on our side stopped the check before it could run, so nothing at all was
	 * learned about the target. A statement about this deployment rather than about the
	 * visitor's URL, and the only reason here they cannot act on — see {@link TrialRefusal}
	 * on `detail`, which is where the specific fault is named for whoever reads the logs.
	 */
	| "unavailable";

/**
 * A refused trial probe.
 *
 * `reason` is what the page branches on and shows a visitor; `detail` names the specific
 * rule that fired and is for logs — it distinguishes an unroutable literal from an
 * unresolvable name from a scheme we do not speak, none of which the visitor needs spelled
 * out but all of which someone reading production logs does.
 */
export class TrialRefusal extends Error {
	/** Which control refused, and therefore what the page should say. */
	readonly reason: TrialRefusalReason;

	/** The specific rule that fired, for logs rather than for display. */
	readonly detail: string;

	/**
	 * Seconds until the caller could succeed, when that is knowable — a rate limit's
	 * window. `null` for refusals with no useful wait, including the daily budget: the
	 * next UTC midnight is derivable by the caller and is not a "retry after".
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
	 * The request being served. Read only for `CF-Connecting-IP` — the caller passes the
	 * request rather than an address so that the "never trust `X-Forwarded-For`" rule is
	 * enforced in one place instead of at every call site.
	 */
	request: Request;
	/**
	 * Whether the caller is charging this probe to an account, which turns off the three
	 * free-tier controls — see this module's own doc comment. Stated rather than optional
	 * so that every call site has to have an opinion about who is paying.
	 */
	billed: boolean;
}

/** Permission to perform one free probe, and what was learned getting there. */
export interface TrialProbeGrant {
	/** The normalized absolute URL to probe. */
	url: URL;
	/**
	 * The addresses the hostname resolved to when it was checked, all of them public. A
	 * record of what was verified, not an instruction — see {@link guardTrialProbe} on why
	 * the probe cannot be pinned to them.
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
 * Read structurally rather than off the generated `Cloudflare.Env` so that an absent
 * secret is a state this module can *describe* rather than a crash. It is not a state it
 * tolerates: {@link verifyChallenge} refuses every probe without one.
 *
 * @returns The secret, or `undefined` when this deployment has none.
 */
function turnstileSecret(): string | undefined {
	let candidate: unknown = (env as { TURNSTILE_SECRET_KEY?: unknown }).TURNSTILE_SECRET_KEY;
	if (typeof candidate !== "string" || candidate.length === 0) return undefined;
	return candidate;
}

/**
 * The Turnstile site key, for the page to render the widget with.
 *
 * Not a secret — it ships to the browser — but read the same structural way, so the page
 * renders without the key rather than failing. A page given `null` renders no widget at
 * all, and a deployment in that state is broken rather than merely unconfigured: with no
 * widget the form sends no token, and {@link verifyChallenge} refuses a probe with no
 * token. That is the intended shape of the failure — an unprotected prober is the one
 * outcome worse than a page that cannot run a check.
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
 * Read structurally rather than off the generated `Cloudflare.Env`, which is what lets an
 * absent binding be a supported state instead of a crash: a deploy predating the
 * `ratelimits` entry, or a local runtime configured without it, still serves the page.
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
 * The caller budget's backend, built on the first request and reused after that: the
 * adapter reads a binding off `env`, which is not module-scope work.
 */
let callerLimiter: Adapter | undefined;

/**
 * Backend counting the caller budget.
 *
 * The binding bills nothing per call, which is the whole reason it and not KV counts a
 * limit whose job is to be cheaper than the thing it protects. Without it the count falls
 * back to the isolate's own memory: weaker, since each isolate gets its own budget, but
 * free, and still enough to bound one connection hammering the form.
 *
 * @returns The adapter to count with.
 */
function createCallerAdapter(): Adapter {
	let binding = rateLimiterBinding();
	// `as const` keeps the window a duration literal rather than widening it to `string`.
	let options = { limit: CALLER_LIMIT, window: CALLER_WINDOW } as const;

	if (binding === undefined) return new MemoryAdapter(options);
	return new CloudflareAdapter(binding, options);
}

/**
 * Spends one probe from the calling address's budget.
 *
 * Only `CF-Connecting-IP` identifies the caller. `X-Forwarded-For` is supplied by the
 * client, so keying on it would let anyone mint a fresh bucket per request and the limit
 * would count nothing.
 *
 * A backend that cannot answer fails **open**: the address limit shapes traffic, while
 * {@link spendDailyBudget} is what bounds spend, so refusing every visitor because the
 * limiter is unreachable would trade a real outage for a hypothetical one.
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
 * Parses a canonical dotted-quad into a 32-bit number.
 *
 * Only the canonical form is accepted, and only the canonical form ever arrives: `URL`
 * normalizes every legacy IPv4 spelling — octal `0177.0.0.1`, hex `0x7f000001`, the bare
 * integer `2130706433` — into dotted decimal while parsing, which is exactly why the
 * blocklist runs against `url.hostname` and never against the string the visitor typed.
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
 * An IPv6 address, as the eight 16-bit groups it is made of. A tuple rather than an array
 * so the prefix table and {@link embeddedIpv4} can index it without every position being
 * possibly-absent.
 */
type Ipv6Groups = readonly [number, number, number, number, number, number, number, number];

/**
 * Narrows a list of groups to an address, rejecting any length but eight.
 *
 * @param groups - The groups parsed out of a literal.
 * @returns The address, or `null` when there are not exactly eight groups.
 */
function toIpv6Groups(groups: number[]): Ipv6Groups | null {
	if (groups.length !== 8) return null;
	// The defaults are unreachable past the length check; they exist to build a tuple.
	let [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0] = groups;
	return [a, b, c, d, e, f, g, h];
}

/**
 * Parses an IPv6 literal into its eight groups.
 *
 * @param literal - An IPv6 address without surrounding brackets.
 * @returns Eight 16-bit groups, or `null` when the literal is not a valid address.
 */
function parseIpv6(literal: string): Ipv6Groups | null {
	let halves = literal.split("::");
	if (halves.length > 2) return null;
	// `rawTail` is `undefined` exactly when the literal used no `::` compression.
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
 * The IPv4 address an IPv6 address carries inside it, for the prefixes that carry a real
 * one: `::ffff:0:0/96` IPv4-mapped, `64:ff9b::/96` the well-known NAT64 prefix, and
 * `2002::/16` 6to4.
 *
 * All three are ways to write an IPv4 destination in IPv6 notation, so all three are ways
 * to write `169.254.169.254` past a blocklist that only reads IPv6 prefixes. Unpacking and
 * re-checking the inner address is what closes that, and it is also what keeps a genuinely
 * public mapped address like `::ffff:8.8.8.8` usable.
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
 * Whether an IPv4 address falls inside a `[network, prefix]` range.
 *
 * Compares by division rather than by bit masking: a 32-bit shift in JavaScript operates
 * on signed integers, so masking `240.0.0.0/4` there produces a negative number and the
 * comparison silently stops working for the top of the address space.
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
 * Whether an IPv6 address falls inside a `[network, prefix]` range.
 *
 * Compared bit by bit as text rather than by masking each group, because a prefix that
 * does not land on a group boundary — `fc00::/7`, `fe80::/10` — needs a partial mask, and
 * a wrong one silently widens or narrows the range instead of failing.
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
 * Anything that is not a parseable IP literal is refused rather than allowed, so a form
 * this function does not understand cannot be the form that gets through.
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
 * The address a hostname *is*, when it is a literal rather than a name to be resolved.
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
 * Whether a hostname is one a trial probe may be pointed at, judged on the name alone.
 *
 * A name with no dot in it is refused. Those are resolved through the resolver's search
 * domains, which is how `wiki` or `grafana` becomes an internal host, and no site worth
 * trying out is reachable at a single label.
 *
 * The root label is stripped before anything is compared. `URL` keeps a trailing dot, so
 * `localhost.` arrives as `localhost.` — a fully qualified name that resolves exactly like
 * `localhost` and matches none of the suffixes below unless the dot is removed first.
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
 * Normalizes what the visitor typed and applies every rule that can be decided from the
 * URL itself, without asking the network anything.
 *
 * A bare domain gets `https://`, because that is what people type and refusing it would be
 * pedantry. A string that already names a scheme keeps it, and keeps it only if it is
 * `http` or `https` — the point of the trial is an HTTP check, and every other scheme is
 * either something we cannot check or something (`file:`, `gopher:`) whose only use here
 * would be reaching past the checks that follow.
 *
 * Credentials are refused: a URL carrying `user:password@` would have this Worker present
 * someone else's credentials to a third party. Ports are held to the two HTTP defaults,
 * which stops the page from being a port scanner pointed at whatever public host the
 * visitor names — the blocklist below stops it reaching private hosts, but nothing else
 * stops it enumerating open ports on public ones.
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
 * Resolves a hostname and checks every address it answers with.
 *
 * This is the check that matters. A literal blocklist stops `http://127.0.0.1`, which
 * nobody serious tries; the actual attack is `http://whatever.attacker.com` with an `A`
 * record of `127.0.0.1`, and only resolving the name first catches it. The cost is one
 * DNS-over-HTTPS round trip against an endpoint this app already depends on, which is
 * cheap next to the probe it gates.
 *
 * Both record types are queried, and a failure on either refuses the target. A name with
 * no `AAAA` answers successfully with an empty list, so an error here means the name does
 * not resolve or the resolver could not be reached — neither of which is a state to probe
 * on the strength of the other record type.
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
 * Verifies a Turnstile token server-side.
 *
 * Fails **closed** in every direction, including when Cloudflare's endpoint cannot be
 * reached and when this deployment has no secret at all: a challenge that was not verified
 * was not passed, and the page degrading is a smaller problem than the prober being open.
 * There is deliberately no escape hatch for an unconfigured environment — a secret rotated
 * away or dropped from a deploy would otherwise open the free prober to the whole internet
 * with nothing but a log line to show for it. The log stays, at error level on every
 * request, because it is the operator's only signal; what changes is that the request
 * stops there.
 *
 * The two ways a challenge can fail are kept apart, because they are different sentences
 * to show a visitor. No token at all is what an unticked widget looks like, and the person
 * who submitted the form early needs to finish it, not reload the page. A token Cloudflare
 * actively rejected — or one it could not be asked about — is the case the "try again"
 * wording was written for.
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
 * Counts one probe against today's global budget.
 *
 * A KV counter keyed on the UTC day. **Approximate by construction**: KV has no atomic
 * increment and is eventually consistent, so concurrent requests can read the same count
 * and a burst can overshoot the cap. That is accepted, because the alternative — a Durable
 * Object or D1 row per probe — spends the kind of money this budget exists to bound, and
 * overshooting a cost fence by a handful is not a failure of the fence.
 *
 * The read failing is treated as exhaustion. A counter that cannot be read is a budget
 * that cannot be enforced, and the whole point of the budget is that unbounded spend is
 * the outcome to avoid; the page saying "not today" is the safe side of that. The write
 * failing is not, since the probe was already authorized and one lost increment is noise.
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
 * Runs every control and answers whether this visitor gets their free probe.
 *
 * Call once per submission and branch on the result; a granted free probe has already been
 * counted against both budgets, so a caller that then decides not to probe has spent one
 * anyway. That is deliberate — the alternative is a second call to commit, and a control
 * that is only enforced when the caller remembers to finish the handshake is not a control.
 *
 * A `billed` probe is held to the target rules and the address resolution and to nothing
 * else, so it spends neither budget and is never challenged. Both halves of that matter:
 * the free-tier controls would be charging an account for protections it is not using, and
 * the SSRF controls are the ones that have nothing to do with who is paying.
 *
 * ## What this cannot promise
 *
 * The address checked is not the address fetched. `fetch` takes a URL and resolves the
 * name itself, and the Workers runtime offers no way to pin a connection to an address
 * already validated — so between this check and the probe, a record with a one-second TTL
 * can change from a public address to a private one. That is DNS rebinding, and this
 * design does not close it. Closing it needs the resolution and the connection to be the
 * same act, which means an egress proxy that validates the address it is about to connect
 * to, not a check in front of `fetch`.
 *
 * Two things blunt it without fixing it: the probe leaves through Cloudflare's network,
 * which has no route to RFC1918 space in the first place, and a rebind only reaches
 * whatever the *edge* can reach, not this account's private infrastructure — which is why
 * the residual risk is worth stating rather than worth blocking the feature over. Neither
 * is a guarantee, and neither should be quoted as one.
 *
 * Beyond that: only `A` and `AAAA` are checked, so a target reached through a `CNAME`
 * chain is judged on the addresses at the end of it and not on the chain; a resolver may
 * legitimately answer this Worker and the probe differently, since neither the DoH
 * endpoint here nor the resolver behind `fetch` is authoritative; and redirects are not
 * covered at all — a public URL answering `302 http://169.254.169.254/` is followed by
 * whoever performs the probe, so the probe itself must not follow redirects, or must
 * re-check each hop through {@link checkTarget}.
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

	// A literal was already judged on its own value; there is no name to resolve.
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
