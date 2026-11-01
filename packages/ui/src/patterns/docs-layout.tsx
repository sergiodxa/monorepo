/**
 * The shell a docs page composes into: the sidebar pinned on the left from the header to the
 * viewport's foot, the article and its footer beside it, and the page's own headings in a
 * rail. Narrower screens fold the sidebar into a drawer and the headings into a sticky bar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { MenuIcon, XIcon } from "@sdxc/icons";
import { bg, borderEdge, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hidden, hstack, inlineFlex, insBs, shrink, sticky, vstack } from "@sdxc/u/layout";
import { overflowY } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { bs, maxBs, mis, minIs, pb, pbe, pbs } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { when } from "@sdxc/u/state";
import { overflowWrap, text, weight } from "@sdxc/u/typography";

import { Button } from "../components/button.js";
import { DialogDismiss } from "../components/dialog-dismiss.js";
import { Sidebar } from "../components/sidebar.js";
import { TOC_MIN_ITEMS, TableOfContents } from "../components/table-of-contents.js";

/** Width each `dock` value docks the sidebar from; narrower, it opens in the drawer. */
const DOCK_QUERY = { md: "(min-width: 48rem)", lg: "(min-width: 64rem)" } as const;

/** Every width under each `dock` value, where the drawer and its button take over. */
const UNDOCK_QUERY = { md: "(max-width: 47.9375rem)", lg: "(max-width: 63.9375rem)" } as const;

/**
 * Width the heading rail is drawn from. Narrower, a third column would squeeze the prose
 * under a readable measure, so the headings fold into the sticky bar instead.
 */
const RAIL_QUERY = "(min-width: 75rem)";

/** The sticky bar's height, which a jumped-to heading also clears below the rail width. */
const BAR_HEIGHT = "2.75rem";

/**
 * Room the docked sidebar keeps beside its links for a focus ring (3px wide, 2px out),
 * which its scroll box would otherwise clip; a matching negative margin keeps it aligned.
 */
const RING_CLEARANCE = "0.375rem";

/** Prop types for {@link DocsLayout}. */
export namespace DocsLayout {
	/** Which breakpoint docks the sidebar: `md` at 48rem, `lg` at 64rem. */
	export type Dock = keyof typeof DOCK_QUERY;

	export interface Props {
		/** The tree to read through, usually a `DocsNav`; drawn docked and again in the drawer. */
		sidebar: RemixNode;
		/** The article: a page header, the prose, then its pager and next steps. */
		children: RemixNode;
		/** The page's own headings; fewer than `tocMinItems` draw neither rail nor bar list. */
		toc?: TableOfContents.Item[];
		/** "On this page", for the rail's heading and the bar. */
		tocLabel: string;
		/** @default 2 */
		tocMinItems?: number;
		/** The bar button that opens the drawer below the dock width ("Menu"). */
		menuLabel: string;
		/** The drawer's heading and accessible name ("Documentation"). */
		drawerLabel: string;
		/** The drawer's close button's accessible name ("Close menu"). */
		closeLabel: string;
		/** Drawn under the headings in the rail, such as feedback or an edit link. */
		railFooter?: RemixNode;
		/**
		 * Closes the page across the article and rail columns, never under the sidebar, so
		 * the docked sidebar runs to the viewport's foot; usually a `DocsFooter`.
		 */
		footer?: RemixNode;
		/** A site header drawn above the shell, kept on screen as the page scrolls. */
		header?: RemixNode;
		/**
		 * The height of everything kept on screen above the shell (the `header` slot, or a
		 * site header the app draws around the layout), so sticky columns and jumped-to
		 * headings sit below it.
		 * @default "0px"
		 */
		stickyTop?: string;
		/** @default "lg" */
		dock?: Dock;
		/**
		 * The article column's widest extent, which code, images, tables and charts may fill.
		 * @default "64rem"
		 */
		measure?: string;
		/**
		 * The widest line of running text: paragraphs, lists, headings, quotes and callouts stop
		 * here while wider blocks keep growing to `measure`. Readable prose sits at 60–75ch.
		 * @default "66ch"
		 */
		proseMeasure?: string;
		/** The whole shell's widest extent. @default "88rem" */
		maxWidth?: string;
		/**
		 * Whether the article column is the page's `<main>` landmark; pass `false` when the
		 * app's own layout already draws one around the shell.
		 * @default true
		 */
		main?: boolean;
		/** Shared by the drawer and the button that opens it. @default "docs-drawer" */
		drawerId?: string;
	}
}

/**
 * Renders the three columns and their narrow-screen fallbacks. Load
 * `@sdxc/ui/table-of-contents` and `@sdxc/ui/dialog-dismiss` in the browser entry. Headings
 * with an `id` in the article get a `scroll-margin-top` that clears the sticky chrome, and
 * `--ui-docs-scroll-margin` carries the same offset for anything else jumped to.
 *
 * @example
 * <DocsLayout sidebar={<DocsNav tree={tree} activePath={path} />} toc={anchors} tocLabel="On this page" menuLabel="Menu" drawerLabel="Documentation" closeLabel="Close menu">
 * 	<DocsPageHeader title="Install" crumbs={crumbs} />
 * </DocsLayout>
 */
export function DocsLayout(handle: Handle<DocsLayout.Props>) {
	return () => {
		let {
			sidebar,
			children,
			toc = [],
			tocLabel,
			tocMinItems = TOC_MIN_ITEMS,
			menuLabel,
			drawerLabel,
			closeLabel,
			railFooter,
			footer,
			header,
			stickyTop = "0px",
			dock = "lg",
			measure = "64rem",
			proseMeasure = "66ch",
			maxWidth = "88rem",
			main = true,
			drawerId = "docs-drawer",
		} = handle.props;
		let outlined = toc.length >= tocMinItems;
		let docked = DOCK_QUERY[dock];
		let undocked = UNDOCK_QUERY[dock];

		return (
			<div
				data-slot="docs-layout"
				mix={[
					raw({
						inlineSize: "100%",
						"--docs-sticky-top": stickyTop,
						"--ui-docs-scroll-margin": outlined
							? `calc(${stickyTop} + ${BAR_HEIGHT} + 1rem)`
							: `calc(${stickyTop} + 1rem)`,
					}),
					media(
						undocked,
						raw({ "--ui-docs-scroll-margin": `calc(${stickyTop} + ${BAR_HEIGHT} + 1rem)` }),
					),
					media(RAIL_QUERY, raw({ "--ui-docs-scroll-margin": `calc(${stickyTop} + 1.5rem)` })),
				]}
			>
				{header ? (
					<div data-slot="docs-header" mix={[sticky(), insBs(0), z(3), bg()]}>
						{header}
					</div>
				) : null}

				<div
					data-slot="docs-shell"
					mix={[
						raw({
							"--docs-gutter": "1rem",
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							columnGap: "2.5rem",
							alignItems: "start",
							maxInlineSize: maxWidth,
							marginInline: "auto",
							paddingInline: "var(--docs-gutter)",
						}),
						media("(min-width: 48rem)", raw({ "--docs-gutter": "1.5rem" })),
						media("(min-width: 64rem)", raw({ "--docs-gutter": "2rem" })),
						media(docked, raw({ gridTemplateColumns: "15rem minmax(0, 1fr)" })),
						outlined
							? media(RAIL_QUERY, raw({ gridTemplateColumns: "15rem minmax(0, 1fr) 13rem" }))
							: [],
					]}
				>
					<div
						data-slot="docs-sidebar"
						mix={[
							hidden(),
							media(docked, [
								raw({
									display: "block",
									gridRow: "1 / span 2",
									alignSelf: "start",
									boxSizing: "border-box",
								}),
								sticky(),
								insBs("var(--docs-sticky-top)"),
								bs("calc(100dvh - var(--docs-sticky-top))"),
								overflowY("auto"),
								raw({
									overscrollBehavior: "contain",
									scrollbarWidth: "thin",
									paddingInline: RING_CLEARANCE,
									marginInline: `-${RING_CLEARANCE}`,
								}),
								pbs("2rem"),
								pbe("3rem"),
							]),
						]}
					>
						{sidebar}
					</div>

					<div data-slot="docs-content" mix={[minIs(0), media(docked, raw({ gridRow: "1" }))]}>
						<div
							data-slot="docs-bar"
							mix={[
								hstack({ gap: 1, align: "center" }),
								sticky(),
								insBs("var(--docs-sticky-top)"),
								z(2),
								raw({
									minBlockSize: BAR_HEIGHT,
									marginInline: "calc(-1 * var(--docs-gutter))",
									paddingInline: "calc(var(--docs-gutter) - 0.5rem) var(--docs-gutter)",
								}),
								bg(),
								borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
								media(docked, [
									raw({ marginInline: 0, paddingInline: 0 }),
									outlined ? [] : hidden(),
								]),
								media(RAIL_QUERY, hidden()),
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
									media(docked, hidden()),
								]}
							>
								<Button
									type="button"
									variant="ghost"
									color="neutral"
									size="sm"
									commandfor={drawerId}
									command="show-modal"
								>
									<MenuIcon size={16} aria-hidden="true" />
									{menuLabel}
								</Button>
							</span>

							{outlined ? (
								<TableOfContents items={toc} label={tocLabel} layout="bar" minItems={tocMinItems} />
							) : null}
						</div>

						{main ? (
							<main data-slot="docs-article" mix={articleMixins(measure, proseMeasure, footer)}>
								{children}
							</main>
						) : (
							<div data-slot="docs-article" mix={articleMixins(measure, proseMeasure, footer)}>
								{children}
							</div>
						)}
					</div>

					{outlined ? (
						<div
							data-slot="docs-rail"
							mix={[
								hidden(),
								media(RAIL_QUERY, [
									raw({ gridRow: "1" }),
									vstack({ gap: 6 }),
									sticky(),
									insBs("var(--docs-sticky-top)"),
									maxBs("calc(100dvh - var(--docs-sticky-top))"),
									overflowY("auto"),
									raw({ overscrollBehavior: "contain", scrollbarWidth: "thin" }),
									pb("2.5rem"),
								]),
							]}
						>
							<TableOfContents items={toc} label={tocLabel} minItems={tocMinItems} />
							{railFooter}
						</div>
					) : null}

					{footer ? (
						<div
							data-slot="docs-footer-area"
							mix={[minIs(0), media(docked, raw({ gridColumn: "2 / -1", gridRow: "2" }))]}
						>
							{footer}
						</div>
					) : null}
				</div>

				<Sidebar.MobileNav id={drawerId} aria-label={drawerLabel}>
					<Sidebar.Header>
						<span mix={[text("base"), weight("semibold"), fg("neutral.emphasis")]}>
							{drawerLabel}
						</span>
						<span mix={[mis("auto")]}>
							<Button
								type="button"
								variant="ghost"
								color="neutral"
								size="sm"
								commandfor={drawerId}
								command="close"
								aria-label={closeLabel}
							>
								<XIcon size={16} aria-hidden="true" />
							</Button>
						</span>
					</Sidebar.Header>
					<Sidebar.Content mix={[vstack({ gap: 0 }), pb("1rem")]}>{sidebar}</Sidebar.Content>
					<DialogDismiss />
				</Sidebar.MobileNav>
			</div>
		);
	};
}

/**
 * Running text in the article that stops at the prose measure. Elements a component draws
 * (`data-slot`) keep their own width unless listed, so a code block, file tree or props
 * table inside a list or a step still grows to the column.
 */
const PROSE_SELECTOR = [
	"& :where(p, ul, ol, dl, blockquote, h1, h2, h3, h4, h5, h6, hr):not([data-slot])",
	'& :where([data-slot="anchor-heading"], [data-slot="callout"], [data-slot="docs-page-header"])',
].join(", ");

/**
 * The article column: running text at a reading measure while code, images, tables and
 * charts fill the column, long words broken, wide code or tables scrolled inside their own
 * box, and headings that stop clear of the sticky chrome.
 */
function articleMixins(measure: string, proseMeasure: string, footer: RemixNode) {
	return [
		raw({ maxInlineSize: measure, "--ui-docs-prose-measure": proseMeasure }),
		when(PROSE_SELECTOR, raw({ maxInlineSize: "var(--ui-docs-prose-measure)" })),
		overflowWrap("break-word"),
		pbs("2rem"),
		pbe(footer ? "3rem" : "5rem"),
		media("(min-width: 48rem)", pbs("2.5rem")),
		when(
			"& :is(h2, h3, h4, h5, h6)[id]",
			raw({ scrollMarginBlockStart: "var(--ui-docs-scroll-margin)" }),
		),
		when("& :is(pre, table)", raw({ maxInlineSize: "100%", overflowX: "auto" })),
		when("& table", raw({ display: "block" })),
	];
}
