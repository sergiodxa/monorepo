/**
 * The package half of the MCP surface: finding a package, seeing the whole set, and
 * reading one in full, plus the package references as pickable resources.
 *
 * Every answer names the page and its markdown twin, so a model that wants more than the
 * record it was given knows exactly where to go next without guessing a URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource, createToolController, ToolError } from "@sdxc/mcp";

import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";
import {
	findPackage,
	listApplicationsUsing,
	listPackageGroups,
	readPackageReadme,
} from "~/app/services/packages";
import { searchPackages } from "~/app/services/search";
import { absoluteUrl } from "~/app/services/site";
import routes from "~/routes/web";

/** Answers the three package tools, which share the manifests they all read from. */
export const packagesController = createToolController(toolset.packages, {
	actions: {
		search: async (ctx) => {
			let matches = await searchPackages(ctx.input.query, ctx.input.limit);

			if (matches.length === 0) {
				throw new ToolError(
					`No package matched "${ctx.input.query}". Try a broader word, or call list_packages to see the whole set.`,
				);
			}

			return matches.map((match) => ({
				name: match.name,
				description: match.description,
				url: absoluteUrl(match.href),
				markdownUrl: absoluteUrl(match.markdownHref),
			}));
		},

		list: (ctx) => {
			let groups = listPackageGroups();
			let requested = ctx.input.group;

			if (requested !== undefined) {
				let wanted = requested.toLowerCase();
				let matching = groups.filter((group) => group.title.toLowerCase() === wanted);

				if (matching.length === 0) {
					let known = groups.map((group) => group.title).join(", ");
					throw new ToolError(`No group called "${requested}". The groups are: ${known}.`);
				}

				groups = matching;
			}

			return groups.map((group) => ({
				group: group.title,
				packages: group.packages.map((entry) => ({
					name: entry.name,
					description: entry.description,
					url: absoluteUrl(routes.api.show.href({ name: entry.directory })),
				})),
			}));
		},

		get: async (ctx) => {
			/* A model that learned the name from an import writes the scope; both are the same ask. */
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
				install: `npm add ${entry.name}`,
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
		},
	},
});

/** Serves every published package reference as a resource a person can attach. */
export const packageResource = createResource(resourceset.package, {
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
