/**
 * The shell every `/docs` page composes into, inside the marketing header and footer: the
 * guides by section on the left with support at their foot, the page in the middle closed
 * by its neighbours, and its own headings on the right; a narrow screen folds both sides.
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
import { mbe, mbs, pbe, pbs } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { DocsNav, DocsPager } from "@sdxc/ui";
import { DocsLayout as DocsShell } from "@sdxc/ui/patterns";

import type { DocSection } from "~/app/services/docs";

import { toDocsTree } from "~/app/services/docs";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** The marketing header's height, which every sticky column and jumped-to heading clears. */
const HEADER_HEIGHT = "4rem";

/**
 * How wide the shell (and the header and footer it shares a measure with) may grow:
 * room for the sidebar, a full reading measure and the heading rail side by side.
 */
const DOCS_MEASURE = "88rem";

/**
 * Room between a page's header and what follows it, so the updated date and the page
 * actions read as the header's last line instead of the body's first.
 */
const PAGE_HEADER_GAP = "2.5rem";

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
		 * The article's widest line; the hub, which lays cards out rather than prose, widens it.
		 * @default "48rem"
		 */
		measure?: string;
		/**
		 * What closes the page after the article (feedback, next steps, a route to support),
		 * spaced from the article and from each other by one gap.
		 */
		pageEnd?: RemixNode;
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
			measure = "48rem",
			pageEnd,
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
			<div mix={[raw({ "--ui-marketing-measure": DOCS_MEASURE })]}>
				<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
					<DocsShell
						sidebar={sidebar}
						toc={anchors}
						tocLabel={labels.toc}
						menuLabel={labels.menu}
						drawerLabel={labels.nav}
						closeLabel={labels.close}
						stickyTop={HEADER_HEIGHT}
						maxWidth={DOCS_MEASURE}
						measure={measure}
						main={false}
					>
						<div
							data-slot="docs-page"
							mix={[
								pbs("2rem"),
								pbe("5rem"),
								when('& [data-slot="docs-page-header"]', mbe(PAGE_HEADER_GAP)),
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
							{pageEnd ? (
								<div
									data-slot="docs-page-end"
									mix={[vstack({ gap: 10, align: "stretch" }), mbs(PAGE_END_GAP)]}
								>
									{pageEnd}
								</div>
							) : null}
							<DocsPager previous={previous} next={next} section={section} labels={labels.pager} />
						</div>
					</DocsShell>
				</MarketingLayout>
			</div>
		);
	};
}
