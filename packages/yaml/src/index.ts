/**
 * Provides YAML reading and writing over a documented subset of YAML 1.2: `parse`
 * and `stringify`, named after their `JSON` counterparts and exported one by one, so
 * a caller that only reads never carries the writer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { StringifyOptions } from "./lib/stringify.js";

export { YAMLParseError, YAMLStringifyError } from "./lib/errors.js";
export { parse } from "./lib/parse.js";
export { stringify } from "./lib/stringify.js";
