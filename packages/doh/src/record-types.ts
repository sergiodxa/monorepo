/**
 * Maps record type mnemonics to the IANA codes the JSON API writes in `type`, and back,
 * with RFC 3597's `TYPEnnn` spelling for any code without a mnemonic here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The IANA codes of the record types a caller is likely to ask for or see in an answer. */
const TYPE_CODES: Record<string, number> = {
	A: 1,
	NS: 2,
	CNAME: 5,
	SOA: 6,
	PTR: 12,
	HINFO: 13,
	MX: 15,
	TXT: 16,
	AAAA: 28,
	LOC: 29,
	SRV: 33,
	NAPTR: 35,
	DNAME: 39,
	DS: 43,
	SSHFP: 44,
	RRSIG: 46,
	NSEC: 47,
	DNSKEY: 48,
	NSEC3: 50,
	NSEC3PARAM: 51,
	TLSA: 52,
	SMIMEA: 53,
	CDS: 59,
	CDNSKEY: 60,
	OPENPGPKEY: 61,
	SVCB: 64,
	HTTPS: 65,
	URI: 256,
	CAA: 257,
};

/** The mnemonic for each code in {@link TYPE_CODES}. */
const TYPE_NAMES = new Map(Object.entries(TYPE_CODES).map(([name, code]) => [code, name]));

/** The mnemonic for a type code, or `TYPEnnn` when it has none here. */
export function typeName(code: number): string {
	return TYPE_NAMES.get(code) ?? `TYPE${code}`;
}

/**
 * The spelling of a type as the query's `type` parameter and as a record's `type`: the
 * uppercase mnemonic, and a known mnemonic for `TYPEnnn` when one exists.
 */
export function canonicalType(type: string): string {
	let upper = type.trim().toUpperCase();
	let generic = /^TYPE(\d+)$/.exec(upper);
	return generic ? typeName(Number(generic[1])) : upper;
}
