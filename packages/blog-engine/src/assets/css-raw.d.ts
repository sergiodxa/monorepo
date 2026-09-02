/**
 * Vite resolves a `?raw` import to the file's text, which is how the engine
 * serves a stylesheet it does not own from a route of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

declare module "*.css?raw" {
	const content: string;
	export default content;
}
