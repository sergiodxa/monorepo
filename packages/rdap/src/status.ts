/**
 * The status vocabulary: the EPP codes RFC 8056 maps onto RDAP's lowercase words,
 * plus the values only RDAP defines, and the conversion from the wire spelling to the
 * camelCase name a registrar's dashboard shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Every status value a domain lookup names, in its EPP spelling. RFC 8056 maps each
 * EPP code to RDAP words (`clientTransferProhibited` ⇄ `client transfer prohibited`);
 * `active`, `inactive`, `locked`, `associated`, `removed` and `obscured` are RDAP's own.
 */
export const EPP_STATUSES = [
	"addPeriod",
	"autoRenewPeriod",
	"clientDeleteProhibited",
	"clientHold",
	"clientRenewProhibited",
	"clientTransferProhibited",
	"clientUpdateProhibited",
	"pendingCreate",
	"pendingDelete",
	"pendingRenew",
	"pendingRestore",
	"pendingTransfer",
	"pendingUpdate",
	"redemptionPeriod",
	"renewPeriod",
	"serverDeleteProhibited",
	"serverHold",
	"serverRenewProhibited",
	"serverTransferProhibited",
	"serverUpdateProhibited",
	"transferPeriod",
	"active",
	"inactive",
	"locked",
	"associated",
	"removed",
	"obscured",
] as const;

/** The known statuses, for the membership test every converted value takes. */
const KNOWN = new Set<string>(EPP_STATUSES);

/**
 * Converts an RDAP status to its EPP spelling. A value outside `EPP_STATUSES` is kept
 * exactly as the registry wrote it, so a caller can still log a status this package
 * has no name for.
 *
 * @param value - The status as it appears in the response.
 * @returns The EPP spelling, or the original text.
 */
export function eppStatus(value: string): string {
	let words = value.trim().toLowerCase().split(/\s+/);
	let camel = words
		.map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
		.join("");
	return KNOWN.has(camel) ? camel : value;
}
