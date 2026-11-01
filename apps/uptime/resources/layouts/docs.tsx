/**
 * The shell every `/docs` page composes into, under the marketing header: the guides pinned
 * on the left with support at their foot, the page closed by its neighbours, its headings on
 * the right, and a compact footer beside the guides; a narrow screen folds both sides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { TableOfContents } from "@sdxc/ui";
import type { Handle, RemixNode } from "remix/component";

import { MailIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { mbe, mbs, pbs } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { DocsFooter, DocsNav, DocsPager } from "@sdxc/ui";
import { DocsLayout as DocsShell } from "@sdxc/ui/patterns";

import type { DocSection } from "~/app/services/docs";

import { toDocsTree } from "~/app/services/docs";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** The marketing header: its 4rem bar and 1px rule, which every sticky column clears. */
const HEADER_HEIGHT = "calc(4rem + 1px)";

/**
 * How wide the shell (and the header and footer it shares a measure with) may grow:
 * room for the sidebar, a full reading measure and the heading rail side by side.
 */
const DOCS_MEASURE = "88rem";

/** The shell's width on a wide page, room for two columns beside the sidebar and the rail. */
const WIDE_MEASURE = "104rem";

/**
 * The article column's widest extent on every page, which code, tables and the hub's card
 * grids fill while running text keeps its reading measure.
 */
const ARTICLE_MEASURE = "64rem";

/**
 * Room between a page's header and what follows it, so the updated date and the page
 * actions read as the header's last line instead of the body's first.
 */
const PAGE_HEADER_GAP = "2.5rem";

/**
 * Room under a prose table before the next block, the same a paragraph leaves under it,
 * so the text after a table never touches its last row.
 */
const TABLE_GAP = "1rem";

/** Room between the article's last block and the page end, a step more than its own gaps. */
const PAGE_END_GAP = "3rem";

/**
 * The contact form, told which page the reader asks from, so their question arrives with
 * the page it is about.
 */
export function supportHref(page: string): string {
	return `${routes.docs.contact.index.href()}?page=${encodeURIComponent(page)}`;
}

namespace DocsLayout {
	export interface Labels {
		/** The guides' landmark name and the drawer's heading ("Documentation"). */
		nav: string;
		/** The visible label of the button that opens the drawer. */
		menu: string;
		close: string;
		/** "On this page". */
		toc: string;
		filter: { label: string; placeholder: string; noResults: string };
		/** The link pinned at the sidebar's foot. */
		support: string;
		pager: { nav: string; previous: string; next: string };
		/** The landmark name of the footer's legal links ("Legal"). */
		legal: string;
	}

	export interface Props {
		isSignedIn: boolean;
		/** The shared header and footer, from `buildMarketingChrome(ctx.intl.t)`. */
		chrome: ReturnType<typeof buildMarketingChrome>;
		sections: DocSection[];
		/** The path being read, which marks one sidebar link as current. */
		activePath: string;
		labels: Labels;
		/** The page's own headings; fewer than two draw neither the rail nor the bar's list. */
		anchors?: TableOfContents.Item[];
		previous?: DocsPager.Entry | null;
		next?: DocsPager.Entry | null;
		/** The section the page is filed under, which the pager leaves off a same-section card. */
		section?: string;
		/**
		 * What closes the page after the article (feedback, next steps, a route to support),
		 * spaced from the article, from each other and from the pager under them by one gap.
		 */
		pageEnd?: RemixNode;
		/**
		 * The page's closing pieces, such as feedback, drawn in the footer beside the sidebar
		 * above the legal links.
		 */
		footer?: RemixNode;
		/**
		 * Widens the shell for a page whose blocks sit side by side (the API reference's
		 * prose beside its code). Every page hands the shell the same settings and a wide
		 * page widens it with an important override, so the shell's styles keep their
		 * cascade order when a client-side navigation swaps one page for another.
		 */
		wide?: boolean;
		children: RemixNode;
	}
}

/**
 * Every translated string the shell draws, from a controller's own `ctx.intl.t`, so the
 * hub, the search page and each doc label the sidebar, the bar and the pager the same way.
 */
export function buildDocsLabels(t: Translate): DocsLayout.Labels {
	return {
		nav: t("docs.sidebar.title"),
		menu: t("docs.shell.menu"),
		close: t("docs.sidebar.closeMenu"),
		toc: t("docs.shell.toc"),
		filter: {
			label: t("docs.shell.filterLabel"),
			placeholder: t("docs.shell.filterLabel"),
			noResults: t("docs.shell.noResults"),
		},
		support: t("docs.shell.support"),
		pager: {
			nav: t("docs.pager.label"),
			previous: t("docs.pager.previous"),
			next: t("docs.pager.next"),
		},
		legal: t("landing.footer.sections.legal.title"),
	};
}

/**
 * Renders the docs shell inside the marketing chrome. A control chip longer than a phone's
 * line wraps inside the article, marked important so it outranks the chip's own later
 * cascade layer, and a long product label never widens the page.
 */
export default function DocsLayout(handle: Handle<DocsLayout.Props>) {
	return () => {
		let {
			isSignedIn,
			chrome,
			sections,
			activePath,
			labels,
			anchors = [],
			previous = null,
			next = null,
			section,
			pageEnd,
			footer,
			wide = false,
			children,
		} = handle.props;

		let sidebar = (
			<DocsNav
				tree={toDocsTree(sections, labels.nav)}
				activePath={activePath}
				filter={labels.filter}
				footer={
					<a
						href={supportHref(activePath)}
						mix={[
							hstack({ gap: 2, align: "center" }),
							text("sm"),
							weight("medium"),
							fg("neutral"),
							hover(fg("brand")),
						]}
					>
						<MailIcon size={16} aria-hidden="true" />
						{labels.support}
					</a>
				}
			/>
		);

		return (
			<div
				mix={[
					raw({ "--ui-marketing-measure": wide ? WIDE_MEASURE : DOCS_MEASURE }),
					wide
						? [
								when(
									'& [data-slot="docs-shell"]',
									raw({ maxInlineSize: `${WIDE_MEASURE} !important` }),
								),
								when('& [data-slot="docs-article"]', raw({ maxInlineSize: "none !important" })),
							]
						: [],
				]}
			>
				<MarketingLayout isSignedIn={isSignedIn} {...chrome} siteFooter={false}>
					<DocsShell
						sidebar={sidebar}
						toc={anchors}
						tocLabel={labels.toc}
						menuLabel={labels.menu}
						drawerLabel={labels.nav}
						closeLabel={labels.close}
						stickyTop={HEADER_HEIGHT}
						maxWidth={DOCS_MEASURE}
						measure={ARTICLE_MEASURE}
						main={false}
						footer={
							<DocsFooter
								legal={chrome.copyrightLine}
								links={chrome.legalLinks}
								linksLabel={labels.legal}
							>
								{footer}
							</DocsFooter>
						}
					>
						<div
							data-slot="docs-page"
							mix={[
								pbs("2rem"),
								when('& [data-slot="docs-page-header"]', mbe(PAGE_HEADER_GAP)),
								when('& [data-slot="typeset"] > table', mbe(TABLE_GAP)),
								when(
									'& [data-slot="ui-label"]',
									raw({
										maxInlineSize: "100%",
										whiteSpace: "normal !important",
										overflowWrap: "anywhere",
									}),
								),
							]}
						>
							{children}
							<div
								data-slot="docs-page-end"
								mix={[vstack({ gap: 10, align: "stretch" }), mbs(PAGE_END_GAP)]}
							>
								{pageEnd}
								<DocsPager
									previous={previous}
									next={next}
									section={section}
									labels={labels.pager}
								/>
							</div>
						</div>
					</DocsShell>
				</MarketingLayout>
			</div>
		);
	};
}
