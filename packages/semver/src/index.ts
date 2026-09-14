/**
 * Public surface of the semver package: the version shape and the comparison
 * union, strict SemVer 2.0.0 reading with its error, the total precedence
 * ordering, and the eight comparisons one version can be tested against another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { SemVer, SemVerComparison } from "./types.js";

export { compare } from "./compare.js";
export { InvalidSemVerError } from "./invalid-semver-error.js";
export { parse } from "./parse.js";
export { satisfies } from "./satisfies.js";
