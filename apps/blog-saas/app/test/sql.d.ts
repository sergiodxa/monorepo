/**
 * Ambient declaration for Vite/bun `?raw` text imports of `.sql` files, used by the
 * in-memory test database harness to load migration SQL as a string. Lets `tsc`
 * type the `?raw` import in `app/test/db.ts` (bun resolves it at runtime).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
declare module "*.sql?raw" {
	const content: string;
	export default content;
}
