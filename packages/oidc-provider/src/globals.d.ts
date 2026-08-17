/**
 * Ambient declaration for `?raw` SQL imports (migration files).
 *
 * Both hosts bundle the provider with Vite/@cloudflare/vite-plugin, and Vitest
 * resolves `?raw` too, so migration SQL is inlined at build/test time as a string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
declare module "*?raw" {
	const content: string;
	export default content;
}
