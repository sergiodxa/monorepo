/**
 * Serves every published package's README as a resource a person can attach, listing each
 * by its scoped name and reading only a package that exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "@sdxc/mcp/server";

import resourceset from "~/app/mcp/resources";
import { findPackage, listPackageGroups, readPackageReadme } from "~/app/services/packages";

/** Lists every package across the groups; reads one, or answers `null` for an unknown name. */
export default createResource(resourceset.package, {
	list: () =>
		listPackageGroups().flatMap((group) =>
			group.packages.map((entry) => ({
				uri: resourceset.package.href({ name: entry.directory }),
				name: entry.name,
				title: entry.name,
				description: entry.description,
			})),
		),

	read: async (ctx) => {
		if (findPackage(ctx.variables.name) === null) return null;
		return await readPackageReadme(ctx.variables.name);
	},
});
