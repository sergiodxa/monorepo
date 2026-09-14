/**
 * Strict SemVer 2.0.0 reading, the single gate every other export goes through
 * so one grammar decides what counts as a version. Text arrives from registries,
 * git tags and user agents, so a rejection is a `Result` failure instead of a throw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { SemVer } from "./types.js";

import { InvalidSemVerError } from "./invalid-semver-error.js";

/**
 * SemVer 2.0.0, with the `v` a git tag or a user agent tends to carry in front
 * of it. Each core element is canonical, so a padded `01.2.3` is rejected rather
 * than silently read as `1.2.3`.
 */
const VERSION =
	/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][\da-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][\da-zA-Z-]*))*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/;

/**
 * Read a version string into its elements, accepting an optional leading `v` and
 * dropping build metadata, which SemVer 2.0.0 excludes from precedence.
 *
 * @param text - Text to read, e.g. a version served by a registry.
 * @returns The version's elements, or an `InvalidSemVerError` naming the rejected text.
 *
 * @example
 * parse("v1.2.3"); // { status: "success", data: { major: 1, minor: 2, patch: 3, prerelease: [] } }
 * @example
 * parse("1.2"); // { status: "failure", error: InvalidSemVerError }
 */
export function parse(text: string): Result<SemVer, InvalidSemVerError> {
	let match = VERSION.exec(text);

	if (match === null) return failure(new InvalidSemVerError(text));

	return success({
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		prerelease: match[4] === undefined ? [] : match[4].split("."),
	});
}
