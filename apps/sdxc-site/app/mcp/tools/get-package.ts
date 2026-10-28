/**
 * Answers `get_package`: one package in full, its README plus the facts its manifest states.
 * A name written with the `@sdxc/` scope, as a model that learned it from an import writes
 * it, is the same ask as the bare name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "sdxc/mcp/server";

import toolset from "~/app/mcp/tools";
import { findPackage, listApplicationsUsing, readPackageReadme } from "~/app/services/packages";
import { absoluteUrl } from "~/config/constants";
import routes from "~/routes/web";

/** Reads the package, or refuses an unknown name with where to look instead. */
export default createTool(toolset.getPackage, async (ctx) => {
	let name = ctx.input.name.replace(/^@sdxc\//, "");
	let entry = findPackage(name);

	if (entry === null) {
		throw new ToolError(
			`No published package called "${ctx.input.name}". Call search_packages to find one, or list_packages to see the whole set.`,
		);
	}

	return {
		name: entry.name,
		description: entry.description,
		install: ["npm add", entry.name, ...entry.peers].join(" "),
		subpaths: entry.subpaths.map((subpath) =>
			subpath === "." ? entry.name : `${entry.name}${subpath.slice(1)}`,
		),
		installsWith: entry.internalDependencies.map((directory) => `@sdxc/${directory}`),
		dependsOn: entry.externalDependencies,
		usedBy: listApplicationsUsing(entry.name),
		url: absoluteUrl(routes.api.show.href({ name: entry.directory })),
		markdownUrl: absoluteUrl(routes.markdown.package.href({ name: entry.directory })),
		readme: (await readPackageReadme(entry.directory)) ?? null,
	};
});
