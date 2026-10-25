/**
 * Parses SPF records (RFC 7208 §12): the `v=spf1` version, each mechanism with its
 * qualifier, domain-spec and CIDR lengths, and the `redirect`, `exp` and unknown
 * modifiers. Any departure from the grammar is the `permerror` a receiver would return.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { IP } from "@sdxc/ip";
import { failure, isFailure, success } from "@sdxc/result";

import { RecordParseError } from "../errors.js";

import { parseMacroString } from "./macro.js";

/** RFC 7208 §12's `toplabel`: letters and digits with a letter, or an LDH label with a hyphen. */
const TOP_LABEL = /^(?:[A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*|[A-Za-z0-9]+-[A-Za-z0-9-]*[A-Za-z0-9])$/;

/** RFC 7208 §12's `ip4-network`: a dotted quad without leading zeros. */
const IP4_NETWORK =
	/^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** A CIDR length without a leading zero. */
const CIDR_LENGTH = /^(?:0|[1-9]\d{0,2})$/;

/** The qualifier a directive without one has. */
const DEFAULT_QUALIFIER = "+";

/** Groups the SPF types under one import surface. */
export namespace SPF {
	/** `+` pass, `-` fail, `~` softfail, `?` neutral. */
	export type Qualifier = "+" | "-" | "~" | "?";

	/** The outcome of `check_host()` (RFC 7208 §2.6). */
	export type Result =
		| "pass"
		| "fail"
		| "softfail"
		| "neutral"
		| "none"
		| "temperror"
		| "permerror";

	/** What every mechanism carries. */
	export interface MechanismBase {
		qualifier: Qualifier;
		/** The term as written, for reporting which one matched. */
		term: string;
	}

	/** `all`: matches every address. */
	export interface AllMechanism extends MechanismBase {
		type: "all";
	}

	/** `include` and `exists`: a required domain-spec, macros unexpanded. */
	export interface DomainMechanism extends MechanismBase {
		type: "include" | "exists";
		domain: string;
	}

	/** `a` and `mx`: an optional domain-spec and the prefix lengths an address is widened to. */
	export interface HostMechanism extends MechanismBase {
		type: "a" | "mx";
		/** `null` means the domain being evaluated. */
		domain: string | null;
		ip4Prefix: number;
		ip6Prefix: number;
	}

	/** `ptr`, which RFC 7208 asks publishers not to use. */
	export interface PtrMechanism extends MechanismBase {
		type: "ptr";
		domain: string | null;
	}

	/** `ip4` and `ip6`: a network, its host bits as written. */
	export interface NetworkMechanism extends MechanismBase {
		type: "ip4" | "ip6";
		address: string;
		prefix: number;
	}

	/** Any SPF mechanism. */
	export type Mechanism =
		| AllMechanism
		| DomainMechanism
		| HostMechanism
		| PtrMechanism
		| NetworkMechanism;

	/** A modifier other than `redirect` and `exp`, which evaluation ignores. */
	export interface Modifier {
		name: string;
		value: string;
	}

	/** A parsed SPF record. */
	export interface Record {
		mechanisms: Mechanism[];
		/** The `redirect=` domain-spec, macros unexpanded. */
		redirect: string | null;
		/** The `exp=` domain-spec, macros unexpanded. */
		explanation: string | null;
		/** Unknown modifiers, kept as written. */
		modifiers: Modifier[];
	}
}

/**
 * Whether a TXT record is an SPF record: it starts with `v=spf1`, case-insensitively,
 * followed by a space or nothing. Only these records count toward the one-record rule.
 */
export function isSpfRecord(text: string): boolean {
	return /^v=spf1(?: |$)/i.test(text);
}

/**
 * Parses an SPF record. An unknown mechanism, a malformed domain-spec, network or CIDR
 * length, and a repeated `redirect` or `exp` fail, since each makes `check_host()` return
 * `permerror`. Mechanism names compare case-insensitively.
 *
 * @param text - The TXT record, its character-strings concatenated.
 * @returns The record, or the syntax error that makes it a `permerror`.
 * @example parseSpfRecord("v=spf1 mx include:_spf.example.net -all")
 */
export function parseSpfRecord(text: string): Result<SPF.Record, RecordParseError> {
	if (!isSpfRecord(text)) return invalid("The record does not start with `v=spf1`");

	let record: SPF.Record = { mechanisms: [], redirect: null, explanation: null, modifiers: [] };
	for (let term of text.slice(6).split(" ")) {
		if (term === "") continue;
		let modifier = /^([A-Za-z][A-Za-z0-9._-]*)=(.*)$/.exec(term);
		let parsed = modifier
			? addModifier(record, modifier[1] ?? "", modifier[2] ?? "")
			: parseMechanism(term);
		if (isFailure(parsed)) return parsed;
		if (parsed.data !== null) record.mechanisms.push(parsed.data);
	}
	return success(record);
}

/**
 * Whether `spec` is a domain-spec: a valid macro-string that ends in a macro or in a
 * dot and a top label, so `example.com` and `%{d}` are domain-specs and `localhost` is not.
 */
export function isDomainSpec(spec: string): boolean {
	let tokens = parseMacroString(spec);
	if (tokens === null) return false;
	let last = tokens.at(-1);
	if (last !== undefined && typeof last !== "string" && last.kind === "macro") return true;
	let trimmed = spec.endsWith(".") ? spec.slice(0, -1) : spec;
	let dot = trimmed.lastIndexOf(".");
	return dot !== -1 && TOP_LABEL.test(trimmed.slice(dot + 1));
}

/** Records a modifier on `record`; `redirect` and `exp` may each appear once. */
function addModifier(
	record: SPF.Record,
	name: string,
	value: string,
): Result<null, RecordParseError> {
	let lower = name.toLowerCase();
	if (lower === "redirect" || lower === "exp") {
		let key: "redirect" | "explanation" = lower === "redirect" ? "redirect" : "explanation";
		if (record[key] !== null) return invalid(`\`${lower}\` appears more than once`);
		if (!isDomainSpec(value)) return invalid(`\`${value}\` is not a domain-spec`);
		record[key] = value;
		return success(null);
	}
	if (parseMacroString(value) === null) return invalid(`\`${name}=${value}\` has a broken macro`);
	record.modifiers.push({ name, value });
	return success(null);
}

/** Parses one directive: an optional qualifier, then a known mechanism. */
function parseMechanism(term: string): Result<SPF.Mechanism, RecordParseError> {
	let match = /^([+\-~?]?)([A-Za-z0-9]+)(.*)$/.exec(term);
	if (!match) return invalid(`\`${term}\` is not a mechanism or modifier`);
	let qualifier = (match[1] || DEFAULT_QUALIFIER) as SPF.Qualifier;
	let name = (match[2] ?? "").toLowerCase();
	let rest = match[3] ?? "";
	let base = { qualifier, term };

	switch (name) {
		case "all":
			return rest === "" ? success({ ...base, type: "all" }) : malformed(term);
		case "include":
		case "exists": {
			let domain = rest.slice(1);
			if (!rest.startsWith(":") || !isDomainSpec(domain)) return malformed(term);
			return success({ ...base, type: name, domain });
		}
		case "a":
		case "mx":
			return parseHostMechanism(base, name, rest);
		case "ptr": {
			if (rest === "") return success({ ...base, type: "ptr", domain: null });
			let domain = rest.slice(1);
			if (!rest.startsWith(":") || !isDomainSpec(domain)) return malformed(term);
			return success({ ...base, type: "ptr", domain });
		}
		case "ip4":
		case "ip6":
			return parseNetworkMechanism(base, name, rest);
		default:
			return invalid(`\`${name}\` is not an SPF mechanism`);
	}
}

/** `a` and `mx`: `[":" domain-spec] [ip4-cidr] ["//" ip6-cidr]`. */
function parseHostMechanism(
	base: SPF.MechanismBase,
	type: "a" | "mx",
	rest: string,
): Result<SPF.Mechanism, RecordParseError> {
	let match = /^(?::(.+?))?(?:\/(\d+))?(?:\/\/(\d+))?$/.exec(rest);
	if (!match) return malformed(base.term);
	let [, domain, ip4, ip6] = match;
	if (domain !== undefined && !isDomainSpec(domain)) return malformed(base.term);
	let ip4Prefix = cidr(ip4, 32);
	let ip6Prefix = cidr(ip6, 128);
	if (ip4Prefix === null || ip6Prefix === null) return malformed(base.term);
	return success({ ...base, type, domain: domain ?? null, ip4Prefix, ip6Prefix });
}

/** `ip4` and `ip6`: `":" network ["/" length]`. */
function parseNetworkMechanism(
	base: SPF.MechanismBase,
	type: "ip4" | "ip6",
	rest: string,
): Result<SPF.Mechanism, RecordParseError> {
	if (!rest.startsWith(":")) return malformed(base.term);
	let slash = rest.indexOf("/");
	let address = rest.slice(1, slash === -1 ? undefined : slash);
	let width = type === "ip4" ? 32 : 128;
	let prefix = cidr(slash === -1 ? undefined : rest.slice(slash + 1), width);
	if (prefix === null) return malformed(base.term);

	let ip = IP.parse(address);
	let valid = type === "ip4" ? IP4_NETWORK.test(address) : !isFailure(ip) && ip.data.version === 6;
	if (!valid) return malformed(base.term);
	return success({ ...base, type, address, prefix });
}

/** A CIDR length within `width`, the full width when absent, `null` when malformed. */
function cidr(text: string | undefined, width: number): number | null {
	if (text === undefined) return width;
	if (!CIDR_LENGTH.test(text)) return null;
	let length = Number(text);
	return length <= width ? length : null;
}

/** The failure for a term the grammar does not allow. */
function malformed(term: string): Result<never, RecordParseError> {
	return invalid(`\`${term}\` is malformed`);
}

/** The failure for a record that makes `check_host()` return `permerror`. */
function invalid(message: string): Result<never, RecordParseError> {
	return failure(new RecordParseError("spf", message));
}
