/**
 * Reads JSON with comments and trailing commas, the format of `tsconfig.json` and
 * `wrangler.jsonc`, through `JSON.parse`, with errors positioned in the text the user wrote.
 * Import it as a namespace, `import * as JSONC from "@sdxc/jsonc"`, beside the global `JSON`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export { JSONCParseError } from "./errors.js";
export { parse } from "./parse.js";
export { strip } from "./strip.js";
