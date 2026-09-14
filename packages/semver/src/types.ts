/**
 * The shapes the package speaks in: a version taken apart for precedence, and
 * the closed set of comparisons one version can be asked to stand in against
 * another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A version taken apart for precedence. Build metadata carries no precedence, so
 * a parsed version keeps none of it and two versions differing only in build
 * metadata rank equally.
 */
export interface SemVer {
	major: number;
	minor: number;
	patch: number;
	/** The dot-separated identifiers after the `-`, empty for a release. */
	prerelease: string[];
}

/**
 * The comparisons available without range syntax, small enough that an editor
 * can render it as a list: `~` holds within one minor, `^` within the left-most
 * non-zero element.
 */
export type SemVerComparison = "=" | "!=" | "<" | "<=" | ">" | ">=" | "~" | "^";
