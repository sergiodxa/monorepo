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
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Callout, CodeBlock, DocsPageHeader, InstallCommand } from "@sdxc/ui/docs";
import { createAction } from "remix/router";

import type { Anchor } from "~/app/services/article";

import { withBundleCache } from "~/app/http/caching";
import notFound from "~/app/http/controllers/docs-not-found";
import { readIconStyle } from "~/app/http/validators/icon-style";
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
import IconControls from "~/resources/components/icon-controls";
import IconDialog from "~/resources/components/icon-dialog";
import IconGrid, { ICON_FRAME_ATTRIBUTE } from "~/resources/components/icon-grid";
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

/** The grid the controls narrow and the dialog opens from. */
const GRID_ID = "icon-grid";

/** The one dialog every tile opens. */
const DIALOG_ID = "icon-detail";

/** Every heading the page holds, for the "On this page" rail. */
const ANCHORS: Anchor[] = [
	{ id: "usage", text: "Usage", level: 2 },
	{ id: "icons", text: "Icons", level: 2 },
];

/**
 * Renders the gallery. `?q=` hides the icons whose name and tags miss a word of it, and the
 * customization parameters restyle every tile; the query string is part of the page's
 * validator, so one narrowed or restyled grid never answers for another.
 */
export default createAction(routes.api.icons, async (ctx) => {
	let tree = await buildPackageNav(PACKAGE);
	let entry = findPackage(PACKAGE);
	if (entry === null) return notFound(ctx, tree);

	let query = ctx.url.searchParams.get("q")?.trim() ?? "";
	let style = readIconStyle(ctx.url.searchParams);
	let all = listIcons();
	let matching = filterIcons(all, query).length;
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

						<Callout
							kind="note"
							label="Credit"
							title="These icons are Lucide’s"
							mix={[raw({ maxInlineSize: "none" })]}
						>
							<p mix={[m(0), raw({ maxInlineSize: "none" })]}>
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
						lead="Filter by name or tag, set the size and stroke, then open an icon for its code."
					>
						<div mix={[vstack({ gap: 6, align: "stretch" })]}>
							<IconControls
								action={routes.api.icons.href()}
								gridId={GRID_ID}
								query={query}
								size={style.size}
								strokeWidth={style.strokeWidth}
								absoluteStrokeWidth={style.absoluteStrokeWidth}
								color={style.color}
								matching={matching}
								total={all.length}
								version={LUCIDE_VERSION}
							/>
							<IconGrid
								id={GRID_ID}
								icons={all}
								sprite={spriteHref()}
								query={query}
								style={style}
							/>
							<IconDialog id={DIALOG_ID} gridId={GRID_ID} frameAttribute={ICON_FRAME_ATTRIBUTE} />
						</div>
					</ReferenceSection>
				</article>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, `${adsDayTag()}:${ctx.url.search}`);
});
