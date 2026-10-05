/**
 * The IANA IPv4 and IPv6 Special-Purpose Address Registries as one table, each row
 * citing the RFC it comes from, plus the three IPv6 forms that carry an IPv4 address
 * inside. Classifying an address is a longest-prefix match against this table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address } from "./address.js";

import { ADDRESS_BITS, maskAddress, parseAddress } from "./address.js";

/**
 * What a special-purpose range is for. `public` is every address no row claims, and
 * the few rows inside a reserved block that the registry marks globally reachable.
 */
export type Classification =
	| "public"
	| "unspecified"
	| "loopback"
	| "private"
	| "shared"
	| "link-local"
	| "documentation"
	| "benchmarking"
	| "multicast"
	| "reserved"
	| "unique-local"
	| "teredo"
	| "discard";

/** One registry row, as written in the RFC that defines it. */
interface Row {
	range: string;
	classification: Classification;
	rfc: string;
}

/** A row with its range parsed, ready to match against. */
interface ParsedRow {
	network: Address;
	prefix: number;
	classification: Classification;
}

/**
 * Every special-purpose range, both versions in one list. Where rows nest, the
 * longest prefix decides, so `::1/128` is loopback inside the reserved `::/0`, and
 * the globally reachable anycast addresses inside `192.0.0.0/24` stay public.
 * Multicast and the IPv6 space outside `2000::/3` come from the address
 * architecture rather than the special-purpose registries, and are listed here so one
 * table answers for every address.
 */
export const SPECIAL_PURPOSE_RANGES: readonly Row[] = [
	{ range: "0.0.0.0/8", classification: "reserved", rfc: "RFC 791" },
	{ range: "0.0.0.0/32", classification: "unspecified", rfc: "RFC 1122" },
	{ range: "10.0.0.0/8", classification: "private", rfc: "RFC 1918" },
	{ range: "100.64.0.0/10", classification: "shared", rfc: "RFC 6598" },
	{ range: "127.0.0.0/8", classification: "loopback", rfc: "RFC 1122" },
	{ range: "169.254.0.0/16", classification: "link-local", rfc: "RFC 3927" },
	{ range: "172.16.0.0/12", classification: "private", rfc: "RFC 1918" },
	{ range: "192.0.0.0/24", classification: "reserved", rfc: "RFC 6890" },
	{ range: "192.0.0.9/32", classification: "public", rfc: "RFC 7723" },
	{ range: "192.0.0.10/32", classification: "public", rfc: "RFC 8155" },
	{ range: "192.0.2.0/24", classification: "documentation", rfc: "RFC 5737" },
	{ range: "192.88.99.0/24", classification: "reserved", rfc: "RFC 7526" },
	{ range: "192.168.0.0/16", classification: "private", rfc: "RFC 1918" },
	{ range: "198.18.0.0/15", classification: "benchmarking", rfc: "RFC 2544" },
	{ range: "198.51.100.0/24", classification: "documentation", rfc: "RFC 5737" },
	{ range: "203.0.113.0/24", classification: "documentation", rfc: "RFC 5737" },
	{ range: "224.0.0.0/4", classification: "multicast", rfc: "RFC 5771" },
	{ range: "240.0.0.0/4", classification: "reserved", rfc: "RFC 1112" },
	{ range: "255.255.255.255/32", classification: "reserved", rfc: "RFC 919" },
	{ range: "::/0", classification: "reserved", rfc: "RFC 4291" },
	{ range: "::/128", classification: "unspecified", rfc: "RFC 4291" },
	{ range: "::1/128", classification: "loopback", rfc: "RFC 4291" },
	{ range: "64:ff9b:1::/48", classification: "reserved", rfc: "RFC 8215" },
	{ range: "100::/64", classification: "discard", rfc: "RFC 6666" },
	{ range: "100:0:0:1::/64", classification: "reserved", rfc: "RFC 9780" },
	{ range: "2000::/3", classification: "public", rfc: "RFC 4291" },
	{ range: "2001::/23", classification: "reserved", rfc: "RFC 2928" },
	{ range: "2001::/32", classification: "teredo", rfc: "RFC 4380" },
	{ range: "2001:1::1/128", classification: "public", rfc: "RFC 7723" },
	{ range: "2001:1::2/128", classification: "public", rfc: "RFC 8155" },
	{ range: "2001:1::3/128", classification: "public", rfc: "RFC 9665" },
	{ range: "2001:2::/48", classification: "benchmarking", rfc: "RFC 5180" },
	{ range: "2001:3::/32", classification: "public", rfc: "RFC 7450" },
	{ range: "2001:4:112::/48", classification: "public", rfc: "RFC 7535" },
	{ range: "2001:20::/28", classification: "public", rfc: "RFC 7343" },
	{ range: "2001:30::/28", classification: "public", rfc: "RFC 9374" },
	{ range: "2001:db8::/32", classification: "documentation", rfc: "RFC 3849" },
	{ range: "3fff::/20", classification: "documentation", rfc: "RFC 9637" },
	{ range: "5f00::/16", classification: "reserved", rfc: "RFC 9602" },
	{ range: "fc00::/7", classification: "unique-local", rfc: "RFC 4193" },
	{ range: "fe80::/10", classification: "link-local", rfc: "RFC 4291" },
	{ range: "ff00::/8", classification: "multicast", rfc: "RFC 4291" },
];

/**
 * The IPv6 prefixes that carry an IPv4 address, and the bit offset it starts at:
 * IPv4-mapped (RFC 4291), NAT64 (RFC 6052) and 6to4 (RFC 3056).
 */
export const EMBEDDING_RANGES: readonly { range: string; offset: number }[] = [
	{ range: "::ffff:0:0/96", offset: 96 },
	{ range: "64:ff9b::/96", offset: 96 },
	{ range: "2002::/16", offset: 16 },
];

/**
 * The parsed table, longest prefix first so the first match is the most specific.
 * Filled on first use, keeping module evaluation free of work.
 */
const PARSED_ROWS: ParsedRow[] = [];

/** The parsed embedding prefixes, filled on first use. */
const PARSED_EMBEDDINGS: { network: Address; prefix: number; offset: number }[] = [];

/**
 * Splits a table row's `network/prefix` text. The tables are written by hand and
 * their tests classify the first and last address of every row, which fails for a
 * row this drops.
 *
 * @param range - A range from one of the tables.
 * @returns The network and prefix length, or an empty list for a malformed row.
 */
function parseRow(range: string): { network: Address; prefix: number }[] {
	let [text = "", prefix = ""] = range.split("/");
	let network = parseAddress(text);
	return network === null ? [] : [{ network, prefix: Number(prefix) }];
}

/**
 * Whether an address sits inside a network.
 *
 * @param address - The address to test.
 * @param network - The network's first address.
 * @param prefix - The network's prefix length.
 * @returns `true` for the same version and the same leading `prefix` bits.
 */
function inNetwork(address: Address, network: Address, prefix: number): boolean {
	return (
		address.version === network.version && maskAddress(address, prefix).value === network.value
	);
}

/**
 * The IPv4 address an IPv6 address carries inside it, so an address like
 * `::ffff:169.254.169.254` is judged by the IPv4 it reaches.
 *
 * @param address - Any address.
 * @returns The embedded IPv4, or `null` for IPv4 and for IPv6 outside the three prefixes.
 */
export function embeddedIPv4(address: Address): Address | null {
	if (address.version === 4) return null;

	if (PARSED_EMBEDDINGS.length === 0) {
		for (let row of EMBEDDING_RANGES) {
			PARSED_EMBEDDINGS.push(
				...parseRow(row.range).map((parsed) => ({ ...parsed, offset: row.offset })),
			);
		}
	}

	for (let { network, prefix, offset } of PARSED_EMBEDDINGS) {
		if (!inNetwork(address, network, prefix)) continue;
		let shift = BigInt(ADDRESS_BITS[6] - offset - ADDRESS_BITS[4]);
		return { version: 4, value: (address.value >> shift) & 0xffff_ffffn };
	}

	return null;
}

/**
 * Classifies an address by its most specific row, after unwrapping an embedded
 * IPv4, so `::ffff:10.0.0.1` is `private` and `::ffff:8.8.8.8` is `public`.
 *
 * @param address - Any address.
 * @returns The classification of the most specific row, or `public` when none matches.
 */
export function classify(address: Address): Classification {
	let inner = embeddedIPv4(address);
	if (inner !== null) return classify(inner);

	if (PARSED_ROWS.length === 0) {
		let rows = SPECIAL_PURPOSE_RANGES.flatMap((row) =>
			parseRow(row.range).map((parsed) => ({ ...parsed, classification: row.classification })),
		);
		PARSED_ROWS.push(...rows.sort((a, b) => b.prefix - a.prefix));
	}

	let row = PARSED_ROWS.find(({ network, prefix }) => inNetwork(address, network, prefix));
	return row?.classification ?? "public";
}
