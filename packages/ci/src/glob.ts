/**
 * The two pattern languages a run reads. File globs (`**`, `*`, `?`, `{a,b}`) match paths a
 * segment at a time; name patterns match step and entry addresses, where `*` spans slashes so
 * `Workspaces/*` reaches an entry keyed `@sdxc/jwt`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Characters a regular expression gives meaning to, escaped when a pattern holds them literally. */
const SPECIAL = /[.+^$(){}|[\]\\,]/g;

/**
 * A regular expression matching whole paths against a file glob: `**` crosses directories, `*`
 * and `?` stay inside one segment, and `{a,b}` matches either alternative.
 *
 * @example fileGlob("src/**\/*.test.{ts,tsx}").test("src/a/b.test.tsx") // true
 */
export function fileGlob(pattern: string): RegExp {
	let source = "";
	let depth = 0;
	let index = 0;
	while (index < pattern.length) {
		let rest = pattern.slice(index);
		let character = pattern[index] ?? "";
		if (rest.startsWith("**/")) {
			source += "(?:.*/)?";
			index += 3;
			continue;
		}
		if (rest.startsWith("**")) {
			source += ".*";
			index += 2;
			continue;
		}
		if (character === "{") {
			depth += 1;
			source += "(?:";
		} else if (character === "}" && depth > 0) {
			depth -= 1;
			source += ")";
		} else if (character === "," && depth > 0) {
			source += "|";
		} else {
			source += wildcard(character, "[^/]");
		}
		index += 1;
	}
	return new RegExp(`^${source}$`);
}

/**
 * A regular expression matching a whole step or entry address, where `*` matches any run of
 * characters, slashes included, and `?` any one; every other character matches itself.
 *
 * @example namePattern("Tests*").test("Tests for root") // true
 */
export function namePattern(pattern: string): RegExp {
	let source = pattern
		.split("")
		.map((character) => wildcard(character, "."))
		.join("");
	return new RegExp(`^${source}$`);
}

/** One pattern character as regular-expression source, `any` standing for one wildcard character. */
function wildcard(character: string, any: string): string {
	if (character === "*") return `${any}*`;
	if (character === "?") return any;
	return character.replace(SPECIAL, "\\$&");
}
