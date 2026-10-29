/**
 * Serves every handwritten guide as a resource a person can attach, listed in the order the
 * docs sidebar shows them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "@sdxc/mcp/server";

import resourceset from "~/app/mcp/resources";
import { listGuides, readGuide } from "~/app/services/docs";

/** Lists every guide across the sections; reads one by its slug. */
export default createResource(resourceset.guide, {
	list: async () => {
		let sections = await listGuides();

		return sections.flatMap((section) =>
			section.guides.map((guide) => ({
				uri: resourceset.guide.href({ slug: guide.slug }),
				name: guide.slug,
				title: guide.frontmatter.title,
				description: guide.frontmatter.description,
			})),
		);
	},

	read: async (ctx) => await readGuide(ctx.variables.slug),
});
