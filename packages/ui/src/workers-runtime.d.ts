/**
 * Type-checks the package against the `Element` a Cloudflare Worker's runtime types declare:
 * HTMLRewriter's element, whose `append`, `prepend`, `before` and `after` take its own content
 * and hide the DOM's node-taking ones, so a call that compiles against the DOM alone fails in a
 * Worker. This declaration makes it fail here first; declaration files emit nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The content HTMLRewriter's element methods accept, as the Workers runtime types declare it. */
type RewriterContent = string | ReadableStream | Response;

/** HTMLRewriter's element methods, merged into the DOM's `Element` as a Worker's types merge them. */
interface Element {
	before(content: RewriterContent, options?: { html?: boolean }): Element;
	after(content: RewriterContent, options?: { html?: boolean }): Element;
	prepend(content: RewriterContent, options?: { html?: boolean }): Element;
	append(content: RewriterContent, options?: { html?: boolean }): Element;
}
