/**
 * The `IP` value object and the `IP.Range` it carries: parsed, valid, immutable
 * addresses and networks that classify themselves, test membership and print as
 * canonical text. Parsing returns a `Result`, so nothing here throws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Address } from "./address.js";
import type { IPErrorCode } from "./error.js";
import type { Classification as IPClassification } from "./special-purpose.js";

import { ADDRESS_BITS, formatAddress, maskAddress, parseAddress } from "./address.js";
import { IPError } from "./error.js";
import { classify, embeddedIPv4 } from "./special-purpose.js";

/** A prefix length: `0`, or a decimal integer without a leading zero. */
const PREFIX_LENGTH = /^(?:0|[1-9]\d{0,2})$/;

/**
 * Builds an `IP` from a parsed address. Assigned by the class itself, so the
 * constructor stays private and every instance still comes from parsed text.
 */
let createIP: (address: Address) => IP;

/** Reads the address an `IP` holds, assigned by the class for the same reason. */
let addressOf: (ip: IP) => Address;

/** Builds an `IP.Range`, assigned by the range class so its constructor stays private. */
let createRange: (network: IP, prefix: number) => IPRange;

/**
 * A network: the first address and how many leading bits every member shares.
 * Its address never has bits set past the prefix, so one network has one spelling.
 *
 * @example
 * let range = IP.Range.parse("10.0.0.0/8");
 * if (isSuccess(range)) range.data.contains(ip);
 */
class IPRange {
	/**
	 * Parses `network/prefix` text, IPv4 or IPv6.
	 *
	 * @param text - The range as written, such as `10.0.0.0/8` or `2001:db8::/32`.
	 * @returns The range, or an `IP.Error` coded `invalid-range` for malformed text and
	 * `host-bits-set` when the address names a host inside the network.
	 *
	 * @example
	 * IP.Range.parse("10.0.0.0/8"); // success
	 * @example
	 * IP.Range.parse("10.0.0.1/8"); // failure: host-bits-set
	 */
	static parse(text: string): Result<IPRange, IPError> {
		let slash = text.lastIndexOf("/");
		let address = slash === -1 ? null : parseAddress(text.slice(0, slash));
		let length = text.slice(slash + 1);
		if (address === null || !PREFIX_LENGTH.test(length)) {
			return failure(new IPError("invalid-range", text));
		}

		let prefix = Number(length);
		if (prefix > ADDRESS_BITS[address.version]) return failure(new IPError("invalid-range", text));
		if (maskAddress(address, prefix).value !== address.value) {
			return failure(new IPError("host-bits-set", text));
		}

		return success(new IPRange(createIP(address), prefix));
	}

	/** The first address of the network. */
	readonly network: IP;

	/** How many leading bits every member shares. */
	readonly prefix: number;

	/**
	 * @param network - The network's first address, host bits already cleared.
	 * @param prefix - The prefix length, within the address's width.
	 */
	private constructor(network: IP, prefix: number) {
		this.network = network;
		this.prefix = prefix;
		Object.freeze(this);
	}

	static {
		createRange = (network, prefix) => new IPRange(network, prefix);
	}

	/** `4` or `6`, the version of every address in the range. */
	get version(): 4 | 6 {
		return this.network.version;
	}

	/**
	 * Whether an address is a member. An address of the other version is never one,
	 * so an IPv4-mapped IPv6 address is outside every IPv4 range.
	 *
	 * @param ip - The address to test.
	 * @returns `true` when the address shares the range's leading bits.
	 */
	contains(ip: IP): boolean {
		let address = addressOf(ip);
		if (address.version !== this.version) return false;
		return maskAddress(address, this.prefix).value === addressOf(this.network).value;
	}

	/**
	 * Compares by value, since two ranges parsed from the same text are two objects.
	 *
	 * @param other - The range to compare with.
	 * @returns `true` for the same network and prefix.
	 */
	equals(other: IPRange): boolean {
		return this.prefix === other.prefix && this.network.equals(other.network);
	}

	/**
	 * The canonical `network/prefix` text, the same for every spelling of one range,
	 * which makes it the key for a map, a rate limit or a database column.
	 *
	 * @returns Such as `10.0.0.0/8` or `2001:db8::/32`.
	 */
	toString(): string {
		return `${this.network.toString()}/${this.prefix}`;
	}

	/**
	 * Serializes as the canonical text, so a range goes into a log or a response as is.
	 *
	 * @returns The same string as {@link IPRange.toString}.
	 */
	toJSON(): string {
		return this.toString();
	}
}

/**
 * One parsed, valid IPv4 or IPv6 address. A function that takes an `IP` holds an
 * address that was checked, never `"unknown"`, `"10.0.0"` or a hostname. Compare two
 * with {@link IP.equals}, and key a map or a column on {@link IP.toString}.
 *
 * @example
 * let parsed = IP.parse("2001:DB8::0:1");
 * if (isFailure(parsed)) return parsed;
 * parsed.data.toString(); // "2001:db8::1"
 */
export class IP {
	/**
	 * The network class: `IP.Range.parse("10.0.0.0/8")`, and `IP.Range` as the type.
	 */
	static readonly Range: typeof IPRange = IPRange;

	/**
	 * The failure parsing returns, so `error instanceof IP.Error` narrows it.
	 */
	static readonly Error: typeof IPError = IPError;

	/**
	 * Parses the text a URL host, a header or a DNS answer carries. Brackets around
	 * IPv6 are accepted (`[::1]`). IPv4 must be canonical dotted decimal, so octal,
	 * hex and bare integers fail rather than naming a different address than they
	 * appear to; zone identifiers (`fe80::1%eth0`) fail too.
	 *
	 * @param text - The address as written.
	 * @returns The address, or an `IP.Error` coded `invalid-address`.
	 *
	 * @example
	 * IP.parse("[::1]"); // success
	 * @example
	 * IP.parse("010.0.0.1"); // failure: invalid-address
	 */
	static parse(text: string): Result<IP, IPError> {
		let address = parseAddress(text);
		if (address === null) return failure(new IPError("invalid-address", text));
		return success(new IP(address));
	}

	/** The parsed address, the whole state of an `IP`. */
	readonly #address: Address;

	/** `4` or `6`. */
	readonly version: 4 | 6;

	/**
	 * @param address - An address the parser produced.
	 */
	private constructor(address: Address) {
		this.#address = address;
		this.version = address.version;
		Object.freeze(this);
	}

	static {
		createIP = (address) => new IP(address);
		addressOf = (ip) => ip.#address;
	}

	/**
	 * What the IANA special-purpose registries say the address is for, judging an
	 * IPv4-mapped, NAT64 or 6to4 address by the IPv4 inside it.
	 */
	get classification(): IPClassification {
		return classify(this.#address);
	}

	/**
	 * Whether the address is on the public internet: `classification === "public"`,
	 * so `::ffff:10.0.0.1` is not and `::ffff:8.8.8.8` is.
	 */
	get isPublic(): boolean {
		return this.classification === "public";
	}

	/**
	 * The IPv4 address an IPv4-mapped (`::ffff:0:0/96`), NAT64 (`64:ff9b::/96`) or
	 * 6to4 (`2002::/16`) address carries, or `null` for any other address.
	 */
	get embeddedIPv4(): IP | null {
		let inner = embeddedIPv4(this.#address);
		return inner === null ? null : new IP(inner);
	}

	/**
	 * The network this address sits in, at the prefix length given for its version.
	 * A length outside the version's width is clamped into it.
	 *
	 * @param prefixes - The prefix length to use for each version.
	 * @returns The range, whose text keys a rate limit on a client's network.
	 *
	 * @example
	 * ip.network({ v4: 32, v6: 64 }).toString(); // "2001:db8:1:2::/64"
	 */
	network(prefixes: IP.Prefixes): IPRange {
		let width = ADDRESS_BITS[this.version];
		let requested = this.version === 4 ? prefixes.v4 : prefixes.v6;
		let prefix = Math.min(width, Math.max(0, Math.trunc(requested) || 0));
		return createRange(new IP(maskAddress(this.#address, prefix)), prefix);
	}

	/**
	 * Compares by value, since two `IP`s parsed from the same text are two objects.
	 *
	 * @param other - The address to compare with.
	 * @returns `true` for the same version and the same address.
	 */
	equals(other: IP): boolean {
		let address = addressOf(other);
		return this.#address.version === address.version && this.#address.value === address.value;
	}

	/**
	 * The canonical text: dotted decimal, or RFC 5952 IPv6 without brackets. Every
	 * spelling of one address prints the same string.
	 *
	 * @returns Such as `203.0.113.7` or `2001:db8::1`.
	 */
	toString(): string {
		return formatAddress(this.#address);
	}

	/**
	 * Serializes as the canonical text, so an address goes into a log or a response
	 * as is. A structured clone drops the methods; store the text and parse it back.
	 *
	 * @returns The same string as {@link IP.toString}.
	 */
	toJSON(): string {
		return this.toString();
	}
}

export namespace IP {
	/** A network, as `IP.Range.parse` and `ip.network` answer it. */
	export type Range = IPRange;

	/** The failure `IP.parse` and `IP.Range.parse` return. */
	export type Error = IPError;

	/** Why parsing failed. */
	export type ErrorCode = IPErrorCode;

	/** What an address is for, as the special-purpose registries name it. */
	export type Classification = IPClassification;

	/** A prefix length per version, since the same length means different things for each. */
	export interface Prefixes {
		v4: number;
		v6: number;
	}
}
