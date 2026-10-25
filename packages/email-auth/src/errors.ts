/**
 * The failure every parser in this package returns: which protocol's grammar the text
 * broke and where, so a caller reports "the SPF record is invalid" with the reason a
 * mail receiver would act on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The record or document formats this package reads. */
export type EmailAuthProtocol =
	| "dmarc"
	| "dmarc-report"
	| "spf"
	| "mta-sts"
	| "mta-sts-policy"
	| "tls-rpt"
	| "dkim"
	| "bimi";

/**
 * Text that a receiver would discard: a record without its version tag, a broken term, a
 * policy file missing a required field. Returned inside a `Failure`, never thrown.
 */
export class RecordParseError extends Error {
	override name = "RecordParseError";

	readonly protocol: EmailAuthProtocol;

	/**
	 * @param protocol - The format the text was read as.
	 * @param message - What made the text invalid.
	 */
	constructor(protocol: EmailAuthProtocol, message: string) {
		super(message);
		this.protocol = protocol;
	}
}
