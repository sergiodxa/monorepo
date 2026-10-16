/**
 * The `.bin` files the Cloudflare plugin bundles as Worker data modules, which a Worker
 * imports as their raw bytes. The social card fonts ship this way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A file bundled as a Worker data module, which the Worker receives as its raw bytes. */
declare module "*.bin" {
	const bytes: ArrayBuffer;
	export default bytes;
}
