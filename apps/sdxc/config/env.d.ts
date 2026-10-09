/**
 * Ambient declarations the build supplies outside `cloudflare.config.ts`: the Vite
 * build stamp the cache validator is derived from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Identifier stamped on the build by Vite, which the cache validator is derived from;
 * `null` under the dev server, whose pages carry no validator.
 */
declare const __BUILD_ID__: string | null;
