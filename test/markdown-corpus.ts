/**
 * Collects the repository's markdown content and runs it through the repository's
 * own formatter. Two normalizers never agree by accident, so the serializer's
 * output being a fixed point of the formatter is a property worth checking.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";

/** Every markdown file the applications serve as content, which is what the parser reads daily. */
const CONTENT = "apps/*/resources/**/*.md";

/**
 * @param root - The repository root the glob runs from
 * @returns Every content file, sorted so a failure names a stable one first
 */
export function contentFiles(root: string): string[] {
	return globSync(CONTENT, { cwd: root })
		.filter((path) => !path.includes("/node_modules/"))
		.sort();
}

/**
 * Formats markdown the way the repository formats a file on disk, reading standard
 * input so a candidate string can be compared against its formatted self without
 * a file being written anywhere.
 *
 * @param source - The markdown to format
 * @param root - The repository root, where the formatter finds its configuration
 * @returns The formatted source
 */
export function format(source: string, root: string): string {
	return execFileSync("vp", ["fmt", "--stdin-filepath=content.md"], {
		cwd: root,
		encoding: "utf8",
		input: source,
		maxBuffer: 32 * 1024 * 1024,
	});
}
