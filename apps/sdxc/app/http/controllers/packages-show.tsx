/**
 * `GET /api/:name` — one package's reference: its own README, framed by
 * facts the app reads from the manifest. The README is the file npm and GitHub show
 * too, so its links are rewritten rather than its text edited, and the frame around
 * it carries what a manifest knows and prose would only repeat badly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text } from "@sdxc/u/typography";
import { Typeset } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { Anchor } from "~/app/services/article";
import type { PackageEntry } from "~/app/services/packages";

import { withBundleCache } from "~/app/http/caching";
import notFound from "~/app/http/controllers/docs-not-found";
import { readOptionSelections } from "~/app/http/cookies";
import { sponsorsTag } from "~/app/http/middleware/sponsors";
import { preparePackageReadme, tableOfContents } from "~/app/services/article";
import {
	buildPackageNav,
	CATALOGUE_PACKAGES,
	listComponentEntries,
	listUtilityGroups,
} from "~/app/services/navigation";
import {
	findPackage,
	listApplicationsUsing,
	listPackageGroups,
	readPackageReadme,
} from "~/app/services/packages";
import { absoluteUrl } from "~/app/services/site";
import CatalogueIndex from "~/resources/components/catalogue-index";
import InstallCommand from "~/resources/components/install-command";
import { DOCS_COMPONENTS } from "~/resources/components/markdown-components";
import PackageFact from "~/resources/components/package-fact";
import PageActions from "~/resources/components/page-actions";
import PageTitle from "~/resources/components/page-title";
import { TableOfContents } from "~/resources/components/table-of-contents";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Where a package's source is read, which is what every "source" link points at. */
const SOURCE_BASE = "https://github.com/sergiodxa/monorepo/tree/main/packages/";

export default createAction(routes.api.show, async (ctx) => {
	let { name } = s.parse(s.object({ name: s.string() }), ctx.params);
	let tree = await buildPackageNav(name);

	let entry = findPackage(name);
	if (entry === null) return notFound(ctx, tree);

	let selections = await readOptionSelections(ctx.request);

	let users = listApplicationsUsing(entry.name);
	let group = listPackageGroups().find((candidate) =>
		candidate.packages.some((member) => member.directory === name),
	)?.title;
	/* A catalogue's README indexes hundreds of pages, so the page draws that index instead. */
	let body = CATALOGUE_PACKAGES.has(name) ? null : await readReference(ctx, entry);
	let anchors: Anchor[] = body?.anchors ?? [];
	let markdownHref = routes.markdown.package.href({ name });

	let response = await ctx.render(
		<DocumentLayout
			title={`${entry.name} — sdxc`}
			description={entry.description}
			canonical={ctx.url.href}
			selections={selections}
			og={{ type: "article" }}
			sponsors={ctx.sponsors}
		>
			<DocsLayout
				tree={tree}
				activePath={routes.api.show.href({ name })}
				breadcrumbs={[{ label: "API", href: routes.api.index.href() }, { label: entry.name }]}
				aside={<TableOfContents anchors={anchors} />}
			>
				<article>
					<header mix={[vstack({ gap: 4 })]}>
						<PageTitle eyebrow={group} title={entry.name} mono>
							{entry.description}
						</PageTitle>

						<InstallCommand command={`npm add ${entry.name}`}>{null}</InstallCommand>

						<dl mix={[vstack({ gap: 2 }), m(0)]}>
							{entry.internalDependencies.length > 0 ? (
								<PackageFact label="Installs with">
									{entry.internalDependencies.map((dependency) => (
										<a
											key={dependency}
											href={routes.api.show.href({ name: dependency })}
											mix={[font("mono"), text("sm"), fg("brand")]}
										>
											@sdxc/{dependency}
										</a>
									))}
								</PackageFact>
							) : null}

							{entry.externalDependencies.length > 0 ? (
								<PackageFact label="Depends on">
									{entry.externalDependencies.map((dependency) => (
										<code key={dependency} mix={[font("mono"), text("sm")]}>
											{dependency}
										</code>
									))}
								</PackageFact>
							) : null}

							{users.length > 0 ? (
								<PackageFact label="Used by">
									<span mix={[text("sm"), fg("neutral")]}>{users.join(", ")}</span>
								</PackageFact>
							) : null}

							<PackageFact label="Source">
								<a href={`${SOURCE_BASE}${name}`} mix={[text("sm"), fg("brand")]}>
									packages/{name}
								</a>
							</PackageFact>
						</dl>

						<PageActions
							markdownHref={markdownHref}
							markdownUrl={absoluteUrl(markdownHref)}
							sourceUrl={`${SOURCE_BASE}${name}`}
						/>
					</header>

					{body ? (
						<Typeset preset="docs" mix={[m("2.5rem", 0, 0, 0)]}>
							{body.content}
						</Typeset>
					) : (
						<div mix={[m("2.5rem", 0, 0, 0)]}>
							<CatalogueIndex groups={await readCatalogue(name)} />
						</div>
					)}
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(ctx.sponsors));
});

/**
 * The index a catalogue package's page draws in place of its README: the utilities under
 * their families, or the theme contract ahead of the components that read it.
 */
async function readCatalogue(name: string) {
	if (name === "u") return await listUtilityGroups();
	return [
		{ title: "Theming", href: routes.api.component.href({ component: "theming" }) },
		...(await listComponentEntries()),
	];
}

/**
 * The package's README, prepared for this site.
 *
 * @param ctx - The request being answered, which is where a failure is logged.
 * @param entry - The package whose README to read.
 * @returns The rendered body and its headings, or `null` when the file is missing or
 * will not parse, which leaves the page its manifest frame rather than no page.
 */
async function readReference(ctx: RequestContext, entry: PackageEntry) {
	let source = await readPackageReadme(entry.directory);
	if (source === null) return null;

	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) {
		ctx.log.fail(parsed.error, {
			package: entry.name,
			line: parsed.error.position?.start.line ?? null,
		});
		return null;
	}

	let prepared = preparePackageReadme(parsed.data.document, entry.directory);
	if (isFailure(prepared)) {
		ctx.log.fail(prepared.error, {
			package: entry.name,
			line: prepared.error.position?.start.line ?? null,
		});
		return null;
	}

	return {
		content: toRemix(prepared.data, { components: DOCS_COMPONENTS }),
		anchors: tableOfContents(prepared.data),
	};
}
