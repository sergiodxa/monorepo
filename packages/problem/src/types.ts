/**
 * The shapes of an RFC 9457 problem document: the parsed form a reader receives,
 * the options a writer passes, and the field-level issue a validation failure lists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A problem document as read, with every standard member resolved: `type` and `title`
 * carry their RFC defaults when the document omits them, and the extension members sit
 * under `extensions` so none of them can shadow a standard one.
 *
 * @template Extensions - The extension members, as a schema validated them.
 */
export interface Problem<Extensions extends object = Record<string, unknown>> {
	/** The URI a client branches on; `"about:blank"` means the status alone describes it. */
	type: string;
	title: string;
	status: number;
	detail: string | null;
	/** Identifies this occurrence, for a caller to quote back in a support request. */
	instance: string | null;
	extensions: Extensions;
}

/**
 * What a writer passes to describe a problem. Only `status` is required: an omitted
 * `type` writes `"about:blank"`, and an omitted `title` writes the status phrase.
 *
 * @template Extensions - The extension members written at the document's top level.
 */
export interface ProblemOptions<Extensions extends object = Record<string, unknown>> {
	status: number;
	type?: string;
	title?: string;
	detail?: string | null;
	instance?: string | null;
	extensions?: Extensions;
}

/** One invalid field, the entry shape of a validation failure's `errors` extension. */
export interface ProblemIssue {
	/** An RFC 6901 JSON Pointer into the request body; `""` names the body itself. */
	pointer: string;
	/** A stable code for a caller branching without reading `message`. */
	code: string;
	message: string;
}
