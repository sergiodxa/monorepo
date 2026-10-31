/**
 * The shell every `/docs` page composes into, inside the marketing header and footer: the
 * guides by section on the left, the page in the middle closed by its neighbours, and its
 * own headings on the right. A narrow screen folds both sides into a sticky bar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import { MenuIcon } from "@sdxc/icons";
import { bg, borderEdge, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hidden, hstack, inlineFlex, insBs, shrink, sticky, vstack } from "@sdxc/u/layout";
import { overflowY } from "@sdxc/u/overflow";
import { at, media } from "@sdxc/u/responsive";
import { maxBs, minIs, pb, pbe, pbs } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { when } from "@sdxc/u/state";
import { overflowWrap, text, weight } from "@sdxc/u/typography";
import { Button, DialogDismiss, Sidebar } from "@sdxc/ui";
import { marketingContainer } from "@sdxc/ui/styles";

import type { DocSection } from "~/app/services/docs";
import type { DocsPagerEntry } from "~/resources/components/docs-pager";
import type { DocsTocAnchor } from "~/resources/components/docs-toc";

import DocsNav from "~/resources/components/docs-nav";
import DocsPager from "~/resources/components/docs-pager";
import DocsToc, { TOC_MIN_ANCHORS } from "~/resources/components/docs-toc";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";

/** The drawer a narrow screen opens, and the button that opens it, agree on this id. */
const DRAWER_ID = "docs-drawer";

/**
 * Width the sidebar docks from. Narrower, the guides open in a drawer from the sticky bar,
 * since a docked column would leave the prose too narrow to read.
 */
const DOCK_BREAKPOINT = "(min-width: 64rem)";

/** Width the heading rail is drawn from; narrower, the headings fold into the sticky bar. */
const RAIL_BREAKPOINT = "(min-width: 75rem)";

/** The marketing header's height, which every sticky column below it clears. */
const HEADER_HEIGHT = "4rem";

/** The sticky bar's height, which a jumped-to heading also clears on a narrow screen. */
const BAR_HEIGHT = "2.75rem";

/**
 * How wide the shell (and the header and footer it shares a container with) may grow:
 * room for the sidebar, a full reading measure and the heading rail side by side.
 */
const DOCS_MEASURE = "88rem";

namespace DocsLayout {
	export interface Labels {
		/** The guides' landmark name and the drawer's heading ("Documentation"). */
		nav: string;
		searchPlaceholder: string;
		noResults: string;
		/** The visible label of the button that opens the drawer. */
		menu: string;
		/** "On this page". */
		toc: string;
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
		anchors?: DocsTocAnchor[];
		previous?: DocsPagerEntry | null;
		next?: DocsPagerEntry | null;
		children: RemixNode;
	}
}

/**
 * Every translated string the shell draws, from a controller's own `ctx.intl.t`, so the
 * hub and each page label the sidebar, the bar and the pager the same way.
 */
export function buildDocsLabels(t: Translate): DocsLayout.Labels {
	return {
		nav: t("docs.sidebar.title"),
		searchPlaceholder: t("docs.sidebar.searchPlaceholder"),
		noResults: t("docs.shell.noResults"),
		menu: t("docs.shell.menu"),
		toc: t("docs.shell.toc"),
		pager: {
			nav: t("docs.pager.label"),
			previous: t("docs.pager.previous"),
			next: t("docs.pager.next"),
		},
	};
}

/** Renders the docs shell inside the marketing chrome. */
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
			children,
		} = handle.props;
		let outlined = anchors.length >= TOC_MIN_ANCHORS;

		let navSections = sections.map((section) => ({
			title: section.title,
			docs: section.docs.map((doc) => ({ path: doc.path, title: doc.frontmatter.title })),
		}));

		let nav = (
			<DocsNav
				sections={navSections}
				activePath={activePath}
				label={labels.nav}
				searchPlaceholder={labels.searchPlaceholder}
				noResults={labels.noResults}
			/>
		);

		return (
			<div mix={[raw({ "--ui-marketing-measure": DOCS_MEASURE })]}>
				<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
					<div data-slot="docs-frame" mix={[raw({ containerType: "inline-size" })]}>
						<div
							data-slot="docs-shell"
							mix={[
								marketingContainer(),
								raw({
									"--docs-gutter": "1rem",
									display: "grid",
									gridTemplateColumns: "minmax(0, 1fr)",
									columnGap: "2.5rem",
									alignItems: "start",
								}),
								at("md", raw({ "--docs-gutter": "1.5rem" })),
								at("lg", raw({ "--docs-gutter": "2rem" })),
								media(DOCK_BREAKPOINT, raw({ gridTemplateColumns: "15rem minmax(0, 1fr)" })),
								outlined
									? media(
											RAIL_BREAKPOINT,
											raw({ gridTemplateColumns: "15rem minmax(0, 1fr) 13rem" }),
										)
									: [],
							]}
						>
							<aside
								data-slot="docs-sidebar"
								mix={[
									hidden(),
									media(DOCK_BREAKPOINT, [
										raw({ display: "block" }),
										sticky(),
										insBs(HEADER_HEIGHT),
										maxBs(`calc(100dvh - ${HEADER_HEIGHT})`),
										overflowY("auto"),
										raw({ overscrollBehavior: "contain", scrollbarWidth: "thin" }),
										pbs("2rem"),
										pbe("3rem"),
									]),
								]}
							>
								{nav}
							</aside>

							<div data-slot="docs-content" mix={[minIs(0)]}>
								<div
									data-slot="docs-bar"
									mix={[
										hstack({ gap: 1, align: "center" }),
										sticky(),
										insBs(HEADER_HEIGHT),
										z(2),
										raw({
											minBlockSize: BAR_HEIGHT,
											marginInline: "calc(-1 * var(--docs-gutter))",
											paddingInline: "calc(var(--docs-gutter) - 0.5rem) var(--docs-gutter)",
										}),
										bg("neutral.bg-tint"),
										borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
										media(DOCK_BREAKPOINT, [
											raw({ marginInline: 0, paddingInline: 0 }),
											outlined ? [] : hidden(),
										]),
										media(RAIL_BREAKPOINT, hidden()),
									]}
								>
									<span
										mix={[
											inlineFlex(),
											shrink(0),
											outlined
												? raw({
														borderInlineEnd: "1px solid var(--ui-neutral-border)",
														paddingInlineEnd: "0.25rem",
													})
												: [],
											media(DOCK_BREAKPOINT, hidden()),
										]}
									>
										<Button
											type="button"
											variant="ghost"
											color="neutral"
											size="sm"
											commandfor={DRAWER_ID}
											command="show-modal"
										>
											<MenuIcon size={16} aria-hidden="true" />
											{labels.menu}
										</Button>
									</span>

									{outlined ? <DocsToc anchors={anchors} label={labels.toc} layout="bar" /> : null}
								</div>

								<div
									data-slot="docs-article"
									mix={[
										raw({ maxInlineSize: "48rem" }),
										overflowWrap("break-word"),
										pbs("2rem"),
										pbe("5rem"),
										media("(min-width: 48rem)", pbs("2.5rem")),
										when(
											"& :is(h2, h3, h4)[id]",
											raw({
												scrollMarginBlockStart: `calc(${HEADER_HEIGHT} + ${BAR_HEIGHT} + 1rem)`,
											}),
										),
										media(
											RAIL_BREAKPOINT,
											when(
												"& :is(h2, h3, h4)[id]",
												raw({ scrollMarginBlockStart: `calc(${HEADER_HEIGHT} + 1.5rem)` }),
											),
										),
										when(
											"& table",
											raw({ display: "block", maxInlineSize: "100%", overflowX: "auto" }),
										),
									]}
								>
									{children}
									<DocsPager previous={previous} next={next} labels={labels.pager} />
								</div>
							</div>

							{outlined ? (
								<div
									data-slot="docs-rail"
									mix={[
										hidden(),
										media(RAIL_BREAKPOINT, [
											raw({ display: "block" }),
											sticky(),
											insBs(HEADER_HEIGHT),
											maxBs(`calc(100dvh - ${HEADER_HEIGHT})`),
											overflowY("auto"),
											pb("2.5rem"),
										]),
									]}
								>
									<DocsToc anchors={anchors} label={labels.toc} />
								</div>
							) : null}
						</div>
					</div>

					<Sidebar.MobileNav id={DRAWER_ID} aria-label={labels.nav}>
						<Sidebar.Header>
							<span mix={[text("base"), weight("semibold"), fg("neutral.emphasis")]}>
								{labels.nav}
							</span>
						</Sidebar.Header>
						<Sidebar.Content mix={[vstack({ gap: 0 }), pb("1rem")]}>{nav}</Sidebar.Content>
						<DialogDismiss />
					</Sidebar.MobileNav>
				</MarketingLayout>
			</div>
		);
	};
}
