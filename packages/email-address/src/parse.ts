/**
 * Parses an email address into the forms an app stores, delivers to and compares on:
 * NFKC-normalized, split at the last `@`, a dot-atom local part within RFC 5321's
 * limits, and a lowercased, ASCII-encoded (punycode) hostname as the domain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/** A parsed address, every field already normalized. */
export interface EmailAddress {
	/**
	 * The address to store and deliver to: the local part with its case as entered, since
	 * RFC 5321 lets the mail host treat case as significant, and the ASCII domain.
	 */
	address: string;
	/**
	 * The comparison form for uniqueness and lookups: `address` with its local part
	 * lowercased. Dots and plus tags stay, since only the mail host knows what they mean.
	 */
	canonical: string;
	/** NFKC-normalized, case as entered. */
	localPart: string;
	/** Lowercased and ASCII-encoded, the form DNS and SMTP use. */
	domain: string;
}

/** Why an address or domain was refused, the code an app maps to its own message. */
export type EmailAddressReason =
	| "missing-at-sign"
	| "local-part-empty"
	| "local-part-too-long"
	| "local-part-invalid"
	| "domain-empty"
	| "domain-too-long"
	| "domain-invalid"
	| "address-too-long";

/** The failure `parseEmailAddress` and `normalizeDomain` return; `reason` says which rule failed. */
export class InvalidEmailAddressError extends Error {
	override name = "InvalidEmailAddressError";

	readonly reason: EmailAddressReason;

	/** @param reason - The rule the input failed. */
	constructor(reason: EmailAddressReason) {
		super(`Invalid email address: ${reason}`);
		this.reason = reason;
	}
}

/** RFC 5321 §4.5.3.1.1, counted in UTF-8 octets as RFC 6531 keeps it. */
const MAX_LOCAL_PART_OCTETS = 64;

/** RFC 5321's 256-octet path minus its angle brackets. */
const MAX_ADDRESS_OCTETS = 254;

/** RFC 1035's 255-octet wire limit in presentation form, without the root's trailing dot. */
const MAX_DOMAIN_OCTETS = 253;

/**
 * An RFC 5322 dot-atom: runs of `atext` joined by single dots. RFC 6531 extends `atext`
 * with non-ASCII, admitted here except controls, format characters (invisible joiners),
 * unassigned and private-use code points (`\p{C}`) and separators (`\p{Z}`).
 */
const DOT_ATOM_PATTERN =
	/^(?:[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]|[^\p{ASCII}\p{C}\p{Z}])+(?:\.(?:[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]|[^\p{ASCII}\p{C}\p{Z}])+)*$/u;

/**
 * The ASCII a domain may hold before IDNA encoding: letters, digits, hyphen and dot.
 * Any other ASCII (`%`, `:`, `?`, `#`, `[`, `_`…) is refused up front, since the URL host
 * parser would otherwise decode or drop it and yield a different, valid host.
 */
const DOMAIN_ASCII_PATTERN = /^(?:[A-Za-z0-9.-]|[^\p{ASCII}])+$/u;

/** An RFC 1123 LDH label of the encoded domain: 1–63 octets, no leading or trailing hyphen. */
const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** A top-level label of digits alone makes the domain an IPv4 address, refused as a literal. */
const NUMERIC_LABEL_PATTERN = /^[0-9]+$/;

/**
 * Parses and normalizes an email address. Surrounding whitespace is trimmed; quoted local
 * parts, IP-literal and single-label domains are refused, since public mail hosts neither
 * issue nor route them.
 *
 * @param input - The address as the person typed it.
 * @returns The normalized address, or the rule it failed.
 * @example parseEmailAddress("Jane@Bücher.example") // success({ address: "Jane@xn--bcher-kva.example", canonical: "jane@xn--bcher-kva.example", … })
 */
export function parseEmailAddress(input: string): Result<EmailAddress, InvalidEmailAddressError> {
	let normalized = input.normalize("NFKC").trim();
	let at = normalized.lastIndexOf("@");
	if (at === -1) return invalid("missing-at-sign");

	let localPart = normalized.slice(0, at);
	if (localPart.length === 0) return invalid("local-part-empty");
	if (octets(localPart) > MAX_LOCAL_PART_OCTETS) return invalid("local-part-too-long");
	if (!DOT_ATOM_PATTERN.test(localPart)) return invalid("local-part-invalid");

	let domain = normalizeDomain(normalized.slice(at + 1));
	if (domain.status === "failure") return domain;

	let address = `${localPart}@${domain.data}`;
	if (octets(address) > MAX_ADDRESS_OCTETS) return invalid("address-too-long");

	return success({
		address,
		canonical: `${localPart.toLowerCase()}@${domain.data}`,
		localPart,
		domain: domain.data,
	});
}

/**
 * Normalizes a bare domain by the rule an address's domain follows: NFKC, trimmed,
 * IDNA-encoded to lowercase ASCII, at least two LDH labels, and a top-level label that
 * is not all digits. A trailing root dot is refused, so one domain has one spelling.
 *
 * @param input - The domain as typed, Unicode or ASCII.
 * @returns The ASCII domain, or the rule it failed.
 * @example normalizeDomain("Straße.DE") // success("xn--strae-oqa.de")
 */
export function normalizeDomain(input: string): Result<string, InvalidEmailAddressError> {
	let domain = input.normalize("NFKC").trim();
	if (domain.length === 0) return invalid("domain-empty");
	if (!DOMAIN_ASCII_PATTERN.test(domain)) return invalid("domain-invalid");

	let encoded = encodeHostname(domain);
	if (encoded === null) return invalid("domain-invalid");
	if (encoded.length > MAX_DOMAIN_OCTETS) return invalid("domain-too-long");

	let labels = encoded.split(".");
	if (labels.length < 2 || !labels.every((label) => LABEL_PATTERN.test(label))) {
		return invalid("domain-invalid");
	}
	if (NUMERIC_LABEL_PATTERN.test(labels.at(-1) ?? "")) return invalid("domain-invalid");

	return success(encoded);
}

/**
 * IDNA-encodes a hostname through the URL host parser, which applies UTS #46 mapping
 * and punycode the way browsers and resolvers do. The input is pre-screened to letters,
 * digits, hyphens, dots and non-ASCII, so the parser's result is the host alone.
 *
 * @returns The lowercased ASCII hostname, or `null` when the parser refuses it.
 */
function encodeHostname(domain: string): string | null {
	let url = `http://${domain}/`;
	if (!URL.canParse(url)) return null;
	return new URL(url).hostname;
}

/** The UTF-8 length RFC 5321 and RFC 6531 limits are counted in. */
function octets(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

/** The failure for `reason`. */
function invalid(reason: EmailAddressReason) {
	return failure(new InvalidEmailAddressError(reason));
}
