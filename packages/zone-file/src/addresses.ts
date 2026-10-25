/**
 * IP address codecs for A and AAAA data and the SVCB address hints: the strict dotted-quad
 * reading, RFC 5952 canonical IPv6, and the octets each spells on the wire.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A dotted-quad IPv4 address without leading zeros, which `inet_aton` would read as octal
 * and browsers as decimal, so an address carrying them has no single meaning.
 */
const IPV4_PATTERN = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Whether text is an IPv4 address in the dotted-quad form A data takes. */
export function isIpv4(value: string): boolean {
	return IPV4_PATTERN.test(value);
}

/** An IPv6 literal in RFC 5952 canonical form, or `null` when the text is not one. */
export function canonicalIpv6(value: string): string | null {
	if (!value.includes(":")) return null;
	let url = URL.parse(`http://[${value}]/`);
	return url ? url.hostname.slice(1, -1) : null;
}

/** The four octets of a dotted-quad IPv4 address, or `null` when the text is not one. */
export function ipv4Octets(value: string): Uint8Array | null {
	return isIpv4(value) ? Uint8Array.from(value.split("."), Number) : null;
}

/** The sixteen octets of an IPv6 address, or `null` when the text is not one. */
export function ipv6Octets(value: string): Uint8Array | null {
	let canonical = canonicalIpv6(value);
	if (canonical === null) return null;
	let [head = "", tail] = canonical.split("::");
	let leading = head === "" ? [] : head.split(":");
	let trailing = tail === undefined || tail === "" ? [] : tail.split(":");
	let zeros = Array.from({ length: 8 - leading.length - trailing.length }, () => "0");
	let groups = tail === undefined ? leading : [...leading, ...zeros, ...trailing];
	let octets = new Uint8Array(16);
	groups.forEach((group, index) => {
		let word = Number.parseInt(group, 16);
		octets[index * 2] = word >> 8;
		octets[index * 2 + 1] = word & 0xff;
	});
	return octets;
}

/** Prints sixteen octets as an RFC 5952 canonical IPv6 address. */
export function printIpv6(octets: Uint8Array): string {
	let groups = Array.from({ length: 8 }, (_, index) =>
		(((octets[index * 2] ?? 0) << 8) | (octets[index * 2 + 1] ?? 0)).toString(16),
	);
	return canonicalIpv6(groups.join(":")) ?? groups.join(":");
}
