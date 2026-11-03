/**
 * `GET /api/:name` — one package's reference: its own README, framed by facts the
 * app reads from the manifest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text } from "@sdxc/u/typography";
import { Typeset } from "@sdxc/ui";
import { DocsPageHeader, InstallCommand } from "@sdxc/ui/docs";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";
import type { Anchor } from "~/app/services/article";
import type { PackageEntry } from "~/app/services/packages";

import { withBundleCache } from "~/app/http/caching";
import notFound from "~/app/http/controllers/docs-not-found";
import { adsDayTag } from "~/app/services/ads";
import { preparePackageReadme, tableOfContents } from "~/app/services/article";
import { listGuidesAbout } from "~/app/services/docs";
import {
	buildPackageNav,
	CATALOGUE_PACKAGES,
	listComponentGroups,
	listUiExportGroups,
	listUtilityGroups,
} from "~/app/services/navigation";
import {
	findPackage,
	listApplicationsUsing,
	listPackageGroups,
	readPackageReadme,
} from "~/app/services/packages";
import {
	PACKAGE_MANAGER_KEY,
	REMEMBERED_TABS,
	rememberedTab,
} from "~/app/services/remembered-tabs";
import { absoluteUrl } from "~/config/constants";
import CatalogueIndex from "~/resources/components/catalogue-index";
import { isFeedbackSent } from "~/resources/components/docs-feedback-block";
import { CODE_LABELS, TERMINAL_TITLE } from "~/resources/components/docs-labels";
import { DOCS_COMPONENTS } from "~/resources/components/markdown-components";
import PackageFact from "~/resources/components/package-fact";
import PageActions from "~/resources/components/page-actions";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Where a package's source is read, which is what every "source" link points at. */
const SOURCE_BASE = "https://github.com/sergiodxa/monorepo/tree/main/packages/";

/** The closing section's anchor, the same one a guide's own closing section takes. */
const NEXT_ID = "where-to-go-next";

export default createAction(routes.api.show, async (ctx) => {
	let { name } = s.parse(s.object({ name: s.string() }), ctx.params);
	let tree = await buildPackageNav(name);

	let entry = findPackage(name);
	if (entry === null) return notFound(ctx, tree);

	let manager = rememberedTab(ctx.request.headers.get("Cookie"), PACKAGE_MANAGER_KEY);

	let users = listApplicationsUsing(entry.name);
	let guides = await listGuidesAbout(name);
	let group = listPackageGroups().find((candidate) =>
		candidate.packages.some((member) => member.directory === name),
	)?.title;

	let body = CATALOGUE_PACKAGES.has(name) ? null : await readReference(ctx, entry);
	let anchors: Anchor[] = [
		...(body?.anchors ?? []),
		...(guides.length > 0 ? [{ id: NEXT_ID, text: "Where to go next", level: 2 }] : []),
	];
	let markdownHref = routes.markdown.package.href({ name });
	let activePath = routes.api.show.href({ name });

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${entry.name} — sdxc`}
			description={entry.description}
			canonical={ctx.url.href}
			og={{ type: "article" }}
			siteFooter={false}
		>
			<DocsLayout
				tree={tree}
				filterQuery={ctx.url.searchParams.get("filter")}
				activePath={activePath}
				anchors={anchors}
				feedback={{ sent: isFeedbackSent(ctx.url) }}
			>
				<article>
					<header mix={[vstack({ gap: 4 })]}>
						<DocsPageHeader
							crumbs={[
								{ label: "API", href: routes.api.index.href() },
								...(group ? [{ label: group }] : []),
								{ label: entry.name },
							]}
							title={entry.name}
							mono
							description={entry.description}
							actions={
								<PageActions
									markdownHref={markdownHref}
									markdownUrl={absoluteUrl(markdownHref)}
									sourceUrl={`${SOURCE_BASE}${name}`}
								/>
							}
						/>

						<InstallCommand
							packages={[entry.name, ...entry.peers]}
							persist="cookie"
							selected={manager}
							title={TERMINAL_TITLE}
							labels={CODE_LABELS}
							aria-label={REMEMBERED_TABS[PACKAGE_MANAGER_KEY].label}
						/>

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

					{guides.length > 0 ? (
						<Typeset preset="docs" mix={[m("2.5rem", 0, 0, 0)]}>
							<h2 id={NEXT_ID}>Where to go next</h2>
							<ul>
								{guides.map((guide) => (
									<li key={guide.slug}>
										<a href={routes.docs.show.href({ slug: guide.slug })}>
											{guide.frontmatter.title}
										</a>
									</li>
								))}
							</ul>
						</Typeset>
					) : null}
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, adsDayTag());
});

/**
 * The index a catalogue package's page draws in place of its README: the utilities under
 * their families, or the theme contract ahead of the components that read it and the
 * subpaths the components are built from.
 */
async function readCatalogue(name: string) {
	if (name === "u") return await listUtilityGroups();
	return [
		{
			title: "@sdxc/ui",
			entries: [{ title: "Theming", href: routes.api.component.href({ component: "theming" }) }],
		},
		...(await listComponentGroups()),
		...(await listUiExportGroups()),
	];
}

/**
 * The package's README, prepared for this site.
 *
 * @param ctx - The request being answered, which is where a failure is logged.
 * @param entry - The package whose README to read.
 * @returns The rendered body and its headings, or `null` when the file is missing or will not parse, which leaves the page its manifest frame rather than no page.
 */
async function readReference(ctx: AppContext, entry: PackageEntry) {
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
