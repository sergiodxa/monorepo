/**
 * The failure parsing returns for text that is not an address or a range. It keeps
 * a machine-readable code and the rejected text, so a caller can answer with its
 * own wording and a log can show what arrived.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why text was refused: not an address, not a `network/prefix` range, or a range
 * whose address has bits set past its prefix (`10.0.0.1/8`), which names a host
 * where a network was meant.
 */
export type IPErrorCode = "invalid-address" | "invalid-range" | "host-bits-set";

/** Returned inside a `Failure` by `IP.parse` and `IP.Range.parse`, never thrown. */
export class IPError extends Error {
	/** Machine-readable cause, for a caller that maps it to its own message. */
	readonly code: IPErrorCode;

	/** The rejected text, verbatim. */
	readonly input: string;

	/**
	 * @param code - Why the text was refused.
	 * @param input - The text as it was given.
	 */
	constructor(code: IPErrorCode, input: string) {
		super(`${code}: ${JSON.stringify(input)}`);
		this.name = "IPError";
		this.code = code;
		this.input = input;
	}
}
