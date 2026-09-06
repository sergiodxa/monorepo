/**
 * Types Vite's `?raw` import suffix, which inlines a file's text at build time. The
 * migrations are imported that way because a Durable Object has no filesystem to
 * read them from at boot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

declare module "*.sql?raw" {
	const content: string;
	export default content;
}
