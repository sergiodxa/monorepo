/**
 * The `@author` and `@copyright` tags closing the module JSDoc of every file `make` and `create`
 * write, credited to the project's package.json `author` or else the git user, so a generated
 * file opens with the header the project's documentation rules ask for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

import { isFailure, isSuccess, wrap } from "@sdxc/result";

/** Who a generated file credits; `url` is linked from the `@author` tag when present. */
export interface Author {
	name: string;
	url: string | null;
}

/**
 * Reads a package.json `author` in either npm form: `"Name <email> (url)"`, where the email and
 * url are optional, or `{ name, email, url }`. Anything without a name is `null`.
 */
export function parseAuthor(field: unknown): Author | null {
	if (typeof field === "string") {
		let match = /^([^<(]*?)\s*(?:<[^>]*>)?\s*(?:\(([^)]*)\))?\s*$/.exec(field.trim());
		let name = match?.[1]?.trim() ?? "";
		if (name === "") return null;
		let url = match?.[2]?.trim() ?? "";
		return { name, url: url === "" ? null : url };
	}
	if (typeof field !== "object" || field === null || Array.isArray(field)) return null;
	let { name, url } = field as { name?: unknown; url?: unknown };
	if (typeof name !== "string" || name.trim() === "") return null;
	return {
		name: name.trim(),
		url: typeof url === "string" && url.trim() !== "" ? url.trim() : null,
	};
}

/**
 * The author of files written under `directory`: the `author` of the nearest package.json from
 * `directory` up to the repository root (the first folder holding `.git`), else `git config
 * user.name` there, else `null`, so a file carries no tags rather than a guessed name.
 * `directory` may not exist yet; the search starts from it all the same.
 */
export async function resolveAuthor(directory: string): Promise<Author | null> {
	let existing: string | null = null;
	for (let current = directory; ; current = dirname(current)) {
		let found = await wrap(() => stat(current));
		if (isSuccess(found) && found.data.isDirectory()) {
			existing ??= current;
			let text = await wrap(() => readFile(join(current, "package.json"), "utf8"));
			if (isSuccess(text)) {
				let manifest = wrap(() => JSON.parse(text.data) as { author?: unknown });
				let author = isFailure(manifest) ? null : parseAuthor(manifest.data.author);
				if (author !== null) return author;
			}
			if (isSuccess(await wrap(() => stat(join(current, ".git"))))) break;
		}
		if (dirname(current) === current) break;
	}
	if (existing === null) return null;
	let name = await gitUserName(existing);
	return name === null ? null : { name, url: null };
}

/** `git config user.name` as git resolves it in `cwd`, or `null` when git or the name is missing. */
function gitUserName(cwd: string): Promise<string | null> {
	return new Promise((resolve) => {
		execFile("git", ["config", "user.name"], { cwd }, (error, stdout) => {
			let name = error === null ? stdout.trim() : "";
			resolve(name === "" ? null : name);
		});
	});
}

/**
 * The lines a module JSDoc ends with to credit `author`: a blank comment line, `@author` (linked
 * when there is a url) and `@copyright` with the UTC `year`, each led by a newline so the result
 * splices in right before the line that closes the block. With no author it is empty.
 */
export function headerTags(author: Author | null, year = new Date().getUTCFullYear()): string {
	if (author === null) return "";
	let credit = author.url === null ? author.name : `[${author.name}](${author.url})`;
	return `\n *\n * @author ${credit}\n * @copyright ${author.name} ${year}`;
}

/**
 * `source` with `tags` added to the module JSDoc it opens with (after a `#!` line, if any). A
 * file that opens with no JSDoc, or whose JSDoc already has an `@author`, is answered as it is.
 */
export function addHeaderTags(source: string, tags: string): string {
	if (tags === "") return source;
	let start = source.startsWith("#!") ? source.indexOf("\n") + 1 : 0;
	if (!source.startsWith("/**", start)) return source;
	let end = source.indexOf("*/", start);
	if (end === -1) return source;
	let block = source.slice(start, end);
	if (block.includes("@author")) return source;
	let close = block.lastIndexOf("\n");
	if (close === -1) return source;
	let at = start + close;
	return `${source.slice(0, at)}${tags}${source.slice(at)}`;
}
