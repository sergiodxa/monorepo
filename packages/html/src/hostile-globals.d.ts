/**
 * Compiles the package against a consumer's DOM globals instead of its own: `Element`
 * here is HTMLRewriter's, the shape a Cloudflare Worker's generated types declare and
 * merge into the ambient DOM. The package's typecheck fails from the moment a source
 * file reads a document through an ambient name rather than through `./lib/dom.js`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** HTMLRewriter's element handle, whose `append` takes content rather than nodes. */
interface Element {
	append(content: string | ReadableStream | Response): Element;
}
