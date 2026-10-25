/**
 * SPF's `check_host()` (RFC 7208 §4): whether an IP may send mail for a domain, walking
 * the record's mechanisms, `include`s and `redirect` over DNS-over-HTTPS while holding
 * the 10-lookup and 2-void-lookup limits, and expanding `exp` on a `fail`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DoH } from "@sdxc/doh";

import { IP } from "@sdxc/ip";
import { isFailure } from "@sdxc/result";

import type { LookupOptions } from "../lookup.js";

import { lookup, normalizeDomain } from "../lookup.js";

import type { MacroContext } from "./macro.js";
import type { SPF } from "./record.js";

import { dottedAddress, expandMacros, parseMacroString, usesValidatedName } from "./macro.js";
import { isSpfRecord, parseSpfRecord } from "./record.js";

/** RFC 7208 §4.6.4's cap on terms that query DNS. */
const MAX_LOOKUPS = 10;

/** RFC 7208 §4.6.4's recommended cap on queries that answer with nothing. */
const MAX_VOID_LOOKUPS = 2;

/** The most MX hosts, and PTR names, one mechanism resolves addresses for. */
const MAX_ADDRESS_LOOKUPS = 10;

/** The result each qualifier produces when its mechanism matches. */
const QUALIFIER_RESULTS: Record<SPF.Qualifier, SPF.Result> = {
	"+": "pass",
	"-": "fail",
	"~": "softfail",
	"?": "neutral",
};

/** The message `check_host()` is asked about. */
export interface CheckHostInput {
	/** The SMTP client's IP address. */
	ip: string;
	/** The domain whose policy applies: the MAIL FROM domain, or the HELO name. */
	domain: string;
	/** The MAIL FROM address; without a local-part it reads as `postmaster@domain`. */
	sender: string;
	/** The HELO/EHLO name, for `%{h}`. */
	helo?: string;
	/** The checking host's name, for `%{r}` in explanations. */
	receiver?: string;
}

/** How `check_host()` reaches DNS and how strict its limits are. */
export interface CheckHostOptions extends LookupOptions {
	/**
	 * Queries returning no records allowed before `permerror`.
	 *
	 * @default 2
	 */
	maxVoidLookups?: number;
}

/** The outcome of one `check_host()`. */
export interface SpfEvaluation {
	result: SPF.Result;
	/** The term that decided the result, `null` when none matched. */
	mechanism: string | null;
	/** The expanded `exp` text on a `fail`, when the domain publishes one. */
	explanation: string | null;
	/** Why the result is `temperror`, `permerror` or `none`. */
	problem: string | null;
	/** Terms that queried DNS, counted against the limit of 10. */
	lookups: number;
	/** Queries that answered with no records or NXDOMAIN. */
	voidLookups: number;
}

/** What evaluating one domain's record produced. */
interface Outcome {
	result: SPF.Result;
	mechanism: string | null;
	explanation: string | null;
	problem: string | null;
}

/**
 * Evaluates whether `input.ip` may send mail for `input.domain` (RFC 7208 §4). DNS
 * failures yield `temperror`; syntax errors, more than one SPF record, an `include` or
 * `redirect` target without a record, and exceeding a lookup limit yield `permerror`.
 *
 * @param input - The client IP, the domain, the sender and optionally the HELO name.
 * @param options - Resolver, signal, timeout and the void-lookup limit.
 * @returns The result, the term that decided it, and the lookups it took.
 * @example await checkHost({ ip: "192.0.2.10", domain: "example.com", sender: "user@example.com" })
 */
export async function checkHost(
	input: CheckHostInput,
	options: CheckHostOptions = {},
): Promise<SpfEvaluation> {
	let evaluator = new Evaluator(input, options);
	let outcome = await evaluator.start();
	return { ...outcome, lookups: evaluator.lookups, voidLookups: evaluator.voidLookups };
}

/** One `check_host()` run: the counters every nested evaluation shares. */
class Evaluator {
	lookups = 0;
	voidLookups = 0;

	readonly #input: CheckHostInput;
	readonly #options: CheckHostOptions;
	readonly #ip: IP | null;
	readonly #sender: string;
	#validatedName: string | null = null;

	/**
	 * @param input - The message being checked.
	 * @param options - DNS and limit options.
	 */
	constructor(input: CheckHostInput, options: CheckHostOptions) {
		this.#input = input;
		this.#options = options;
		let parsed = IP.parse(input.ip);
		let ip = isFailure(parsed) ? null : parsed.data;
		this.#ip = ip?.version === 6 && ip.toString().startsWith("::ffff:") ? ip.embeddedIPv4 : ip;
		this.#sender = withLocalPart(input.sender.trim());
	}

	/** Evaluates the top-level domain after checking the inputs. */
	async start(): Promise<Outcome> {
		if (this.#ip === null) return problem("permerror", `${this.#input.ip} is not an IP address`);
		return this.check(normalizeDomain(this.#input.domain));
	}

	/** Evaluates `domain`'s record (RFC 7208 §4.3–§4.7). */
	async check(domain: string): Promise<Outcome> {
		if (!isValidDomain(domain)) return problem("none", `${domain} is not a domain name`);

		let answer = await lookup(domain, "TXT", this.#options);
		if (isFailure(answer)) return problem("temperror", answer.error.message);
		let records = answer.data.records.map((record) => record.text).filter(isSpfRecord);
		let [text] = records;
		if (text === undefined) return problem("none", `${domain} publishes no SPF record`);
		if (records.length > 1) return problem("permerror", `${domain} publishes several SPF records`);

		let record = parseSpfRecord(text);
		if (isFailure(record)) return problem("permerror", record.error.message);

		for (let mechanism of record.data.mechanisms) {
			let matched = await this.matches(mechanism, domain);
			if (typeof matched !== "boolean") return matched;
			if (!matched) continue;
			let result = QUALIFIER_RESULTS[mechanism.qualifier];
			let explanation =
				result === "fail" ? await this.explain(record.data.explanation, domain) : null;
			return { result, mechanism: mechanism.term, explanation, problem: null };
		}

		let hasAll = record.data.mechanisms.some((mechanism) => mechanism.type === "all");
		if (record.data.redirect === null || hasAll) return problem("neutral", null);

		let limited = this.countLookup();
		if (limited) return limited;
		let target = await this.expand(record.data.redirect, domain);
		if (target === null) return problem("permerror", "`redirect` expands to nothing");
		let redirected = await this.check(target);
		if (redirected.result === "none") {
			return problem("permerror", `The redirect target ${target} has no SPF record`);
		}
		return redirected;
	}

	/**
	 * Whether one mechanism matches, or the outcome that ends evaluation: a `temperror`
	 * from DNS or a `permerror` from a limit or a broken nested record.
	 */
	async matches(mechanism: SPF.Mechanism, domain: string): Promise<boolean | Outcome> {
		let ip = this.#ip as IP;
		switch (mechanism.type) {
			case "all":
				return true;
			case "ip4":
			case "ip6": {
				let network = IP.parse(mechanism.address);
				if (isFailure(network) || network.data.version !== ip.version) return false;
				return network.data.network({ v4: mechanism.prefix, v6: mechanism.prefix }).contains(ip);
			}
			case "include":
				return this.include(mechanism.domain, domain);
			case "a":
			case "mx":
			case "ptr":
			case "exists": {
				let limited = this.countLookup();
				if (limited) return limited;
				let target =
					mechanism.domain === null ? domain : await this.expand(mechanism.domain, domain);
				if (target === null) return problem("permerror", `${mechanism.term} expands to nothing`);
				if (mechanism.type === "a") return this.matchAddresses(target, mechanism);
				if (mechanism.type === "mx") return this.matchMx(target, mechanism);
				if (mechanism.type === "ptr") return this.matchPtr(target);
				return this.matchExists(target);
			}
		}
	}

	/** `include`: matches on the target's `pass`; its errors end evaluation. */
	async include(spec: string, domain: string): Promise<boolean | Outcome> {
		let limited = this.countLookup();
		if (limited) return limited;
		let target = await this.expand(spec, domain);
		if (target === null) return problem("permerror", `include:${spec} expands to nothing`);
		let nested = await this.check(target);
		if (nested.result === "pass") return true;
		if (nested.result === "temperror" || nested.result === "permerror") return nested;
		if (nested.result === "none") {
			return problem("permerror", `The included domain ${target} has no SPF record`);
		}
		return false;
	}

	/** `a`: whether any of the target's addresses, widened to the prefix, holds the IP. */
	async matchAddresses(target: string, mechanism: SPF.HostMechanism): Promise<boolean | Outcome> {
		let addresses = await this.addresses(target);
		if (!Array.isArray(addresses)) return addresses;
		if (addresses.length === 0) return this.countVoid();
		return addresses.some((address) => this.within(address, mechanism));
	}

	/** `mx`: the `a` test over each MX host, at most ten of them. */
	async matchMx(target: string, mechanism: SPF.HostMechanism): Promise<boolean | Outcome> {
		let answer = await lookup(target, "MX", this.#options);
		if (isFailure(answer)) return problem("temperror", answer.error.message);
		let hosts = answer.data.records.map((record) => record.exchange).filter((host) => host !== ".");
		if (hosts.length === 0) return this.countVoid();
		if (hosts.length > MAX_ADDRESS_LOOKUPS) {
			return problem("permerror", `${target} has more than ${MAX_ADDRESS_LOOKUPS} MX hosts`);
		}
		for (let host of hosts) {
			let addresses = await this.addresses(host);
			if (!Array.isArray(addresses)) return addresses;
			if (addresses.some((address) => this.within(address, mechanism))) return true;
		}
		return false;
	}

	/** `ptr`: whether a validated name of the IP is the target or below it. */
	async matchPtr(target: string): Promise<boolean | Outcome> {
		let names = await this.validatedNames();
		if (names === null) return false;
		if (names.length === 0) return this.countVoid();
		return names.some((name) => name === target || name.endsWith(`.${target}`));
	}

	/** `exists`: whether the target has any A record, whatever the IP's version. */
	async matchExists(target: string): Promise<boolean | Outcome> {
		let answer = await lookup(target, "A", this.#options);
		if (isFailure(answer)) return problem("temperror", answer.error.message);
		if (answer.data.records.length === 0) return this.countVoid();
		return true;
	}

	/** The target's addresses of the IP's version, or the `temperror` a DNS failure is. */
	async addresses(target: string): Promise<IP[] | Outcome> {
		if ((this.#ip as IP).version === 4) {
			let answer = await lookup(target, "A", this.#options);
			if (isFailure(answer)) return problem("temperror", answer.error.message);
			return parseAddresses(answer.data.records);
		}
		let answer = await lookup(target, "AAAA", this.#options);
		if (isFailure(answer)) return problem("temperror", answer.error.message);
		return parseAddresses(answer.data.records);
	}

	/** Whether `address`, widened to the mechanism's prefix, contains the client IP. */
	within(address: IP, mechanism: SPF.HostMechanism): boolean {
		let ip = this.#ip as IP;
		if (address.version !== ip.version) return false;
		return address.network({ v4: mechanism.ip4Prefix, v6: mechanism.ip6Prefix }).contains(ip);
	}

	/**
	 * The IP's validated names (RFC 7208 §5.5): PTR names, at most ten, whose own
	 * addresses include the IP. `null` when the PTR lookup fails, which matches nothing.
	 */
	async validatedNames(): Promise<string[] | null> {
		let ip = this.#ip as IP;
		let suffix = ip.version === 4 ? "in-addr.arpa" : "ip6.arpa";
		let reversed = dottedAddress(ip.toString()).split(".").reverse().join(".");
		let answer = await lookup(`${reversed}.${suffix}`, "PTR", this.#options);
		if (isFailure(answer)) return null;

		let validated: string[] = [];
		for (let record of answer.data.records.slice(0, MAX_ADDRESS_LOOKUPS)) {
			let name = normalizeDomain(record.target);
			let addresses = await this.addresses(name);
			if (!Array.isArray(addresses)) continue;
			if (addresses.some((address) => address.equals(ip))) validated.push(name);
		}
		return validated;
	}

	/** Expands a domain-spec for `domain`, `null` when it uses a letter it may not. */
	async expand(spec: string, domain: string): Promise<string | null> {
		let tokens = parseMacroString(spec);
		if (tokens === null) return null;
		let expanded = expandMacros(tokens, await this.context(domain, tokens));
		return expanded === null ? null : normalizeDomain(expanded);
	}

	/**
	 * The `exp` text for a `fail` (RFC 7208 §6.2): the one TXT record at the expanded
	 * name, itself expanded. Any failure along the way leaves the result without one.
	 */
	async explain(spec: string | null, domain: string): Promise<string | null> {
		if (spec === null) return null;
		let target = await this.expand(spec, domain);
		if (target === null) return null;
		let answer = await lookup(target, "TXT", this.#options);
		if (isFailure(answer) || answer.data.records.length !== 1) return null;
		let tokens = parseMacroString((answer.data.records[0]?.text ?? "").replaceAll(" ", "%_"));
		if (tokens === null) return null;
		return expandMacros(tokens, await this.context(domain, tokens), true);
	}

	/** The macro context for `domain`, computing `%{p}` only when the tokens use it. */
	async context(
		domain: string,
		tokens: ReturnType<typeof parseMacroString>,
	): Promise<MacroContext> {
		if (tokens !== null && usesValidatedName(tokens) && this.#validatedName === null) {
			let names = (await this.validatedNames()) ?? [];
			this.#validatedName =
				names.find((name) => name === domain) ??
				names.find((name) => name.endsWith(`.${domain}`)) ??
				names[0] ??
				"unknown";
		}
		return {
			sender: this.#sender,
			domain,
			ip: (this.#ip as IP).toString(),
			helo: this.#input.helo ?? "unknown",
			validatedName: this.#validatedName ?? "unknown",
			receiver: this.#input.receiver ?? "unknown",
			timestamp: Math.floor(Date.now() / 1000),
		};
	}

	/** Counts a DNS-querying term, or returns the `permerror` for the eleventh. */
	countLookup(): Outcome | null {
		this.lookups += 1;
		if (this.lookups <= MAX_LOOKUPS) return null;
		return problem("permerror", `More than ${MAX_LOOKUPS} DNS lookups`);
	}

	/** Counts a query that found nothing: no match, or `permerror` past the limit. */
	countVoid(): false | Outcome {
		this.voidLookups += 1;
		let limit = this.#options.maxVoidLookups ?? MAX_VOID_LOOKUPS;
		if (this.voidLookups <= limit) return false;
		return problem("permerror", `More than ${limit} DNS lookups returned nothing`);
	}
}

/** The addresses among A or AAAA records. */
function parseAddresses(records: readonly (DoH.ARecord | DoH.AAAARecord)[]): IP[] {
	return records.flatMap((record) => {
		let parsed = IP.parse(record.address);
		return isFailure(parsed) ? [] : [parsed.data];
	});
}

/**
 * Whether `domain` is a name `check_host()` evaluates (RFC 7208 §4.3): at least two
 * labels, none empty or longer than 63 octets, 253 octets in all.
 */
function isValidDomain(domain: string): boolean {
	if (domain.length > 253) return false;
	let labels = domain.split(".");
	return labels.length > 1 && labels.every((label) => label.length > 0 && label.length <= 63);
}

/** A sender with `postmaster` as its local-part when it was written without one. */
function withLocalPart(sender: string): string {
	let at = sender.lastIndexOf("@");
	if (at === -1) return `postmaster@${sender}`;
	return at === 0 ? `postmaster${sender}` : sender;
}

/** An outcome that no mechanism decided. */
function problem(result: SPF.Result, message: string | null): Outcome {
	return { result, mechanism: null, explanation: null, problem: message };
}
