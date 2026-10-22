/**
 * Credits setup-written files the way `make` stubs do: `@author` / `@copyright` from the
 * project's package.json `author` or git `user.name`, never a kit maintainer hardcoded in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { addHeaderTags, headerTags, resolveAuthor } from "../author.js";

import type { SetupFile } from "./plan.js";

/**
 * Returns `files` with each module JSDoc closed by the project's author tags. A project with
 * no resolvable author leaves the sources unchanged.
 */
export async function creditSetupFiles(
	root: string,
	files: readonly SetupFile[],
): Promise<SetupFile[]> {
	let tags = headerTags(await resolveAuthor(root));
	if (tags === "") return [...files];
	return files.map((file) => ({
		path: file.path,
		content: addHeaderTags(file.content, tags),
	}));
}
