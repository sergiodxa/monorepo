/**
 * The namespace that identifies Atom and the default a text construct assumes,
 * shared across the package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Stores the Atom 1.0 namespace URI, which identifies the format rather than any
 * prefix a document happens to bind it to.
 */
export const ATOM_NAMESPACE = "http://www.w3.org/2005/Atom";

/**
 * Stores the text type assumed when a construct omits its `type` attribute,
 * which RFC 4287 §3.1.1 defines as `text`.
 */
export const DEFAULT_TEXT_TYPE = "text";
