/**
 * Ambient declaration for `?raw` SQL imports (migration files).
 *
 * Both hosts bundle the provider with Vite/@cloudflare/vite-plugin, and `bun:test`
 * resolves `?raw` too, so migration SQL is inlined at build/test time as a string.
 */
declare module "*?raw" {
	const content: string;
	export default content;
}
