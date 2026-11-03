/**
 * `GET /api/icons` — the `@sdxc/icons` reference as a gallery: how to render an icon, the
 * credit to Lucide, who draws every one of them, and every icon in one grid narrowed by
 * `?q=`. The filter is a plain form, so a narrowed grid has an address and needs no script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LUCIDE_VERSION } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Button, SearchField } from "@sdxc/ui";
import { Callout, CodeBlock, DocsPageHeader, InstallCommand } from "@sdxc/ui/docs";
import { createAction } from "remix/router";

import type { Anchor } from "~/app/services/article";

import { withBundleCache } from "~/app/http/caching";
import notFound from "~/app/http/controllers/docs-not-found";
import { adsDayTag } from "~/app/services/ads";
import { filterIcons, listIcons, LUCIDE_LINKS, spriteHref } from "~/app/services/icons";
import { buildPackageNav } from "~/app/services/navigation";
import { findPackage, listPackageGroups } from "~/app/services/packages";
import {
	PACKAGE_MANAGER_KEY,
	REMEMBERED_TABS,
	rememberedTab,
} from "~/app/services/remembered-tabs";
import { absoluteUrl } from "~/config/constants";
import { isFeedbackSent } from "~/resources/components/docs-feedback-block";
import { CODE_LABELS, TERMINAL_TITLE } from "~/resources/components/docs-labels";
import IconGrid from "~/resources/components/icon-grid";
import PageActions from "~/resources/components/page-actions";
import ReferenceSection from "~/resources/components/reference-section";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The package directory this page is the reference for. */
const PACKAGE = "icons";

/** Where the package's source is read. */
const SOURCE_URL = "https://github.com/sergiodxa/monorepo/tree/main/packages/icons";

/** The two ways to render an icon, which is all a reader needs before picking one. */
const USAGE = `import { HeartIcon, Icon } from "@sdxc/icons";

<HeartIcon aria-hidden="true" />
<Icon name="heart" aria-hidden="true" />`;

/** Every heading the page holds, for the "On this page" rail. */
const ANCHORS: Anchor[] = [
	{ id: "usage", text: "Usage", level: 2 },
	{ id: "icons", text: "Icons", level: 2 },
];

/**
 * Renders the gallery. `?q=` keeps only the icons whose name or tags hold every word of it,
 * and it is part of the page's validator, so a narrowed grid never answers for another.
 */
export default createAction(routes.api.icons, async (ctx) => {
	let tree = await buildPackageNav(PACKAGE);
	let entry = findPackage(PACKAGE);
	if (entry === null) return notFound(ctx, tree);

	let query = ctx.url.searchParams.get("q")?.trim() ?? "";
	let all = listIcons();
	let icons = filterIcons(all, query);
	let manager = rememberedTab(ctx.request.headers.get("Cookie"), PACKAGE_MANAGER_KEY);
	let group = listPackageGroups().find((candidate) =>
		candidate.packages.some((member) => member.directory === PACKAGE),
	)?.title;
	let markdownHref = routes.markdown.package.href({ name: PACKAGE });

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${entry.name} — sdxc`}
			description={entry.description}
			canonical={absoluteUrl(routes.api.icons.href())}
			og={{ type: "article" }}
			siteFooter={false}
		>
			<DocsLayout
				tree={tree}
				activePath={routes.api.icons.href()}
				anchors={ANCHORS}
				feedback={{ sent: isFeedbackSent(ctx.url) }}
			>
				<article mix={[vstack({ gap: 10, align: "stretch" })]}>
					<header mix={[vstack({ gap: 4, align: "stretch" })]}>
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
									sourceUrl={SOURCE_URL}
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

						<Callout kind="note" label="Credit" title="These icons are Lucide’s">
							<p mix={[m(0)]}>
								Every icon here is drawn by the{" "}
								<a href={LUCIDE_LINKS.home} mix={[fg("brand")]}>
									Lucide
								</a>{" "}
								contributors and published under the{" "}
								<a href={LUCIDE_LINKS.license} mix={[fg("brand")]}>
									ISC license
								</a>
								. @sdxc/icons packages Lucide {LUCIDE_VERSION} as remix/component components.
								Lucide’s{" "}
								<a href={LUCIDE_LINKS.docs} mix={[fg("brand")]}>
									own documentation
								</a>{" "}
								covers the design guidelines behind them, and if they serve your app,{" "}
								<a href={LUCIDE_LINKS.sponsor} mix={[fg("brand")]}>
									sponsor Lucide
								</a>
								.
							</p>
						</Callout>
					</header>

					<ReferenceSection
						id="usage"
						title="Usage"
						lead="Import the icon you know by its component, or render one chosen at runtime by name."
					>
						<div mix={[vstack({ gap: 3, align: "stretch" })]}>
							<CodeBlock language="tsx" labels={CODE_LABELS} code={USAGE} />
							<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
								Props, defaults and accessible names are in the{" "}
								<a href={markdownHref} mix={[fg("brand")]}>
									package reference
								</a>
								.
							</p>
						</div>
					</ReferenceSection>

					<ReferenceSection
						id="icons"
						title="Icons"
						lead={countLabel(icons.length, all.length, query)}
					>
						<div mix={[vstack({ gap: 6, align: "stretch" })]}>
							<SearchField aria-label="Filter icons">
								<form
									method="get"
									action={routes.api.icons.href()}
									mix={[hstack({ gap: 2, align: "center" })]}
								>
									<div mix={[raw({ flex: "1 1 auto", minInlineSize: "0" })]}>
										<SearchField.Input
											name="q"
											aria-label="Filter icons by name or tag"
											placeholder="Filter by name or tag"
											defaultValue={query}
										/>
									</div>
									<Button type="submit" variant="outline" color="neutral">
										Filter
									</Button>
								</form>
							</SearchField>

							{icons.length > 0 ? (
								<IconGrid icons={icons} sprite={spriteHref()} />
							) : (
								<p mix={[m(0), text("base"), fg("neutral")]}>
									No icon matches “{query}”.{" "}
									<a href={routes.api.icons.href()} mix={[fg("brand")]}>
										Show every icon
									</a>
								</p>
							)}
						</div>
					</ReferenceSection>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, `${adsDayTag()}:${query}`);
});

/** The line under the grid's heading: how many icons it holds, and of how many. */
function countLabel(shown: number, total: number, query: string): string {
	let format = new Intl.NumberFormat("en-US");
	if (query === "") return `${format.format(total)} icons from Lucide ${LUCIDE_VERSION}.`;
	return `${format.format(shown)} of ${format.format(total)} icons match “${query}”.`;
}
