/**
 * The DNSSEC pieces DS and DNSKEY data share: the algorithm mnemonics RFC 4034 lets a zone
 * file write in place of a number, and the key tag a DS record names its DNSKEY by, so a
 * delegation's DS set can be matched against the child's keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The DNSSEC algorithm numbers by IANA mnemonic; the uppercase mnemonic reads as its number. */
const ALGORITHMS: Record<string, number> = {
	RSAMD5: 1,
	DH: 2,
	DSA: 3,
	RSASHA1: 5,
	"DSA-NSEC3-SHA1": 6,
	"RSASHA1-NSEC3-SHA1": 7,
	RSASHA256: 8,
	RSASHA512: 10,
	"ECC-GOST": 12,
	ECDSAP256SHA256: 13,
	ECDSAP384SHA384: 14,
	ED25519: 15,
	ED448: 16,
	INDIRECT: 252,
	PRIVATEDNS: 253,
	PRIVATEOID: 254,
};

/** An algorithm field as a number, read from its decimal or its mnemonic; `null` for neither. */
export function readAlgorithm(field: string | undefined): number | null {
	if (field === undefined) return null;
	if (/^\d+$/.test(field)) {
		let number = Number(field);
		return number <= 0xff ? number : null;
	}
	return ALGORITHMS[field.toUpperCase()] ?? null;
}

/**
 * The key tag of DNSKEY RDATA (RFC 4034 Appendix B): the octets summed as big-endian 16-bit
 * words with the carry folded back in once, and for an RSA/MD5 (algorithm 1) key the
 * modulus's second- and third-to-last octets, as that appendix specifies for it.
 *
 * @param rdata - The DNSKEY RDATA in wire form: flags, protocol, algorithm and key.
 */
export function keyTag(rdata: Uint8Array): number {
	if (rdata[3] === 1 && rdata.length >= 7)
		return ((rdata[rdata.length - 3] ?? 0) << 8) | (rdata[rdata.length - 2] ?? 0);
	let sum = 0;
	for (let index = 0; index < rdata.length; index++)
		sum += index % 2 === 0 ? (rdata[index] ?? 0) << 8 : (rdata[index] ?? 0);
	sum += (sum >> 16) & 0xffff;
	return sum & 0xffff;
}
