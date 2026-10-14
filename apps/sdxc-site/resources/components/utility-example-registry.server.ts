/**
 * Resolves the module behind one `@sdxc/u` example frame. Each example is its own module
 * under `utility-examples/<utility>/`, loaded only when its frame is asked for, so a frame
 * costs one example rather than the whole catalogue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { slugOf } from "~/app/services/utility-examples";

/**
 * What an example module publishes. The page reads `title`, `description` and the code
 * from the module's text, so both strings are written as plain double-quoted literals.
 */
export interface UtilityExampleModule {
	title: string;
	/** One or two sentences introducing the example, with code in backticks. */
	description: string;
	/** The example as it renders; its source is what the page prints. */
	render: () => RemixNode;
	/**
	 * The markup to print in place of `render`'s source, for an example drawn through an
	 * island, whose own source would show the island rather than the utility.
	 */
	code?: string;
	/**
	 * How the canvas lays the example out: centred on it, or stretched across its width for
	 * an example about width itself.
	 * @default "center"
	 */
	align?: "center" | "stretch";
}

const modules = import.meta.glob<UtilityExampleModule>("./utility-examples/*/*.tsx", {
	import: "default",
});

/**
 * One example's module, or `null` when the utility has no example by that slug.
 *
 * @param utility - The utility's exported name, which is its folder's name.
 * @param slug - The example's file name without its ordering prefix.
 */
export async function findUtilityExample(
	utility: string,
	slug: string,
): Promise<UtilityExampleModule | null> {
	for (let [path, load] of Object.entries(modules)) {
		let [, folder, file] = /\/utility-examples\/([^/]+)\/([^/]+)\.tsx$/.exec(path) ?? [];
		if (folder === utility && file && slugOf(file) === slug) return await load();
	}
	return null;
}
