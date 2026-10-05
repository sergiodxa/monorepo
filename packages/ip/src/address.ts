/**
 * The numeric form every address and range in the package is built on: a version
 * and the address as one unsigned integer. Parsing text into it and printing it as
 * RFC 5952 canonical text live here, so both classes agree on a single spelling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * An address as a number: 32 bits for IPv4, 128 for IPv6. A `bigint` for both
 * versions, so masking and comparison are the same operations whatever the width.
 */
export interface Address {
	version: 4 | 6;
	value: bigint;
}

/** How many bits an address of each version holds. */
export const ADDRESS_BITS = { 4: 32, 6: 128 } as const;

/**
 * A decimal octet as `URL` prints one: no leading zero, so `010` is refused rather
 * than read as decimal ten by one parser and octal eight by another.
 */
const IPV4_OCTET = /^(?:0|[1-9]\d{0,2})$/;

/** One IPv6 group: up to four hex digits, either case. */
const IPV6_GROUP = /^[\da-f]{1,4}$/i;

/** The first 80 bits of every IPv4-mapped address are zero, then sixteen ones. */
const IPV4_MAPPED_PREFIX = 0xffffn << 32n;

/**
 * Reads a dotted quad into its 32-bit value.
 *
 * @param text - Four decimal octets.
 * @returns The value, or `null` for any other spelling, octal, hex and bare integers included.
 */
function parseIPv4(text: string): bigint | null {
	let parts = text.split(".");
	if (parts.length !== 4) return null;

	let value = 0n;
	for (let part of parts) {
		if (!IPV4_OCTET.test(part)) return null;
		let octet = Number(part);
		if (octet > 255) return null;
		value = (value << 8n) | BigInt(octet);
	}
	return value;
}

/**
 * Converts colon-separated groups into 16-bit numbers, expanding a trailing dotted
 * quad into the two groups it occupies.
 *
 * @param parts - The groups on one side of a `::`, or all of them when there is none.
 * @param last - Whether these groups end the address, the only place a dotted quad may sit.
 * @returns The groups, or `null` when any of them is malformed.
 */
function parseGroups(parts: string[], last: boolean): number[] | null {
	let groups: number[] = [];

	for (let [index, part] of parts.entries()) {
		if (part.includes(".")) {
			if (!last || index !== parts.length - 1) return null;
			let embedded = parseIPv4(part);
			if (embedded === null) return null;
			groups.push(Number(embedded >> 16n), Number(embedded & 0xffffn));
			continue;
		}

		if (!IPV6_GROUP.test(part)) return null;
		groups.push(Number.parseInt(part, 16));
	}

	return groups;
}

/**
 * Reads IPv6 text into its 128-bit value. A `::` must stand for at least one group,
 * and a zone identifier (`%eth0`) fails, since no URL a Worker fetches carries one.
 *
 * @param text - An IPv6 address without brackets.
 * @returns The value, or `null` when the text is not an address.
 */
function parseIPv6(text: string): bigint | null {
	let halves = text.split("::");
	if (halves.length > 2) return null;
	let [rawHead = "", rawTail] = halves;

	let head = parseGroups(rawHead === "" ? [] : rawHead.split(":"), rawTail === undefined);
	let tail = parseGroups(rawTail === undefined || rawTail === "" ? [] : rawTail.split(":"), true);
	if (head === null || tail === null) return null;

	let groups = head;
	if (rawTail !== undefined) {
		let missing = 8 - head.length - tail.length;
		if (missing < 1) return null;
		groups = [...head, ...Array.from({ length: missing }, () => 0), ...tail];
	}
	if (groups.length !== 8) return null;

	return groups.reduce((value, group) => (value << 16n) | BigInt(group), 0n);
}

/**
 * Reads the text a URL host, a header or a DNS answer carries into an address.
 * Brackets are accepted around IPv6 only, the way a URL host spells it.
 *
 * @param text - The address as written.
 * @returns The address, or `null` when the text is not one.
 */
export function parseAddress(text: string): Address | null {
	if (text.startsWith("[") && text.endsWith("]")) {
		let value = parseIPv6(text.slice(1, -1));
		return value === null ? null : { version: 6, value };
	}

	if (text.includes(":")) {
		let value = parseIPv6(text);
		return value === null ? null : { version: 6, value };
	}

	let value = parseIPv4(text);
	return value === null ? null : { version: 4, value };
}

/**
 * Prints a 32-bit value as a dotted quad.
 *
 * @param value - The IPv4 address.
 * @returns Four decimal octets.
 */
function formatIPv4(value: bigint): string {
	return [24n, 16n, 8n, 0n].map((shift) => String((value >> shift) & 0xffn)).join(".");
}

/**
 * Prints a 128-bit value as RFC 5952 text: lowercase, no leading zeros, and the
 * longest run of two or more zero groups compressed, the first one on a tie. An
 * IPv4-mapped address ends in a dotted quad, as section 5 of the RFC recommends.
 *
 * @param value - The IPv6 address.
 * @returns The canonical text.
 */
function formatIPv6(value: bigint): string {
	if (value >> 32n === IPV4_MAPPED_PREFIX >> 32n) {
		return `::ffff:${formatIPv4(value & 0xffff_ffffn)}`;
	}

	let groups = Array.from({ length: 8 }, (_, index) =>
		Number((value >> BigInt(112 - index * 16)) & 0xffffn),
	);

	let bestStart = -1;
	let bestLength = 1;
	let runStart = -1;
	for (let [index, group] of [...groups, 1].entries()) {
		if (group === 0) {
			if (runStart === -1) runStart = index;
			continue;
		}
		if (runStart !== -1 && index - runStart > bestLength) {
			bestStart = runStart;
			bestLength = index - runStart;
		}
		runStart = -1;
	}

	let hex = groups.map((group) => group.toString(16));
	if (bestStart === -1) return hex.join(":");

	let head = hex.slice(0, bestStart).join(":");
	let tail = hex.slice(bestStart + bestLength).join(":");
	return `${head}::${tail}`;
}

/**
 * Prints an address as its one canonical spelling, so two spellings of the same
 * address always print the same string.
 *
 * @param address - The address to print.
 * @returns Dotted decimal for IPv4, RFC 5952 text for IPv6, without brackets.
 */
export function formatAddress(address: Address): string {
	return address.version === 4 ? formatIPv4(address.value) : formatIPv6(address.value);
}

/**
 * Clears every bit past the first `prefix`, giving the first address of the network
 * an address sits in.
 *
 * @param address - The address to mask.
 * @param prefix - How many leading bits to keep, already within the version's width.
 * @returns The network address.
 */
export function maskAddress(address: Address, prefix: number): Address {
	let hostBits = BigInt(ADDRESS_BITS[address.version] - prefix);
	return { version: address.version, value: (address.value >> hostBits) << hostBits };
}
