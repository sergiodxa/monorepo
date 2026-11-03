/**
 * A docs sidebar drawn from a {@link DocsTree}: sections under plain labels, pages and
 * titled groups of pages, the current page marked and scrolled into view, an optional
 * title filter that works with or without script, and a footer for support links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ChevronRightIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { transition, transitionDuration } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { hidden, hstack, shrink, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, minBs, minIs, mis, p, pi } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { rotate } from "@sdxc/u/transform";
import { text, weight } from "@sdxc/u/typography";

import { Sidebar } from "../components/sidebar.js";

import type { DocsTreeMatches } from "./utils/docs-filter.js";
import type { DocsTree } from "./utils/docs-tree.js";

import { DocsNavTools } from "./docs-nav-tools.js";
import { matchDocsTree } from "./utils/docs-filter.js";

/** Prop types for {@link DocsNav}. */
export namespace DocsNav {
	export interface Props {
		/** The pages to list; `tree.label` names the navigation landmark. */
		tree: DocsTree;
		/** The path being read, which marks one link `aria-current="page"`. */
		activePath: string;
		/**
		 * A field that filters pages by title, with the line shown when nothing matches. Without
		 * script it submits `name` (default `"filter"`) to the page; pass that parameter back as
		 * `query` and the tree renders filtered.
		 */
		filter?: {
			label: string;
			placeholder: string;
			noResults: string;
			name?: string;
			query?: string;
		};
		/**
		 * Drawn under the tree, such as "Contact support" or a status link, flush with the
		 * nav's edge; give its links the rows' inline padding (or render them as
		 * `Sidebar.MenuLink`s) to line their text up with the pages above.
		 */
		footer?: RemixNode;
		/**
		 * Folds every group except the ones holding the current page, for a tree whose
		 * groups run to hundreds of pages.
		 * @default false
		 */
		collapseGroups?: boolean;
		/**
		 * When a link prefetches its page.
		 * @default "intent"
		 */
		prefetch?: Sidebar.Prefetch;
	}
}

/**
 * Renders the tree in reading order. A group whose `href` is set links its own page from
 * its summary, and every group is a native `<details>`, so folding needs no script. Load
 * `@sdxc/ui/docs/docs-nav-tools` in the browser entry for the scroll-to-current and the filter.
 *
 * @example
 * <DocsNav tree={tree} activePath={url.pathname} />
 * @example
 * <DocsNav tree={tree} activePath={path} filter={{ label: "Filter pages", placeholder: "Filter", noResults: "No page matches" }} footer={<a href="/support">Contact support</a>} />
 */
export function DocsNav(handle: Handle<DocsNav.Props>) {
	return () => {
		let {
			tree,
			activePath,
			filter,
			footer,
			collapseGroups = false,
			prefetch = "intent",
		} = handle.props;
		let query = filter?.query ?? "";
		let matches = filter ? matchDocsTree(tree, query) : null;
		let context: ItemContext = { activePath, collapseGroups, prefetch, matches };

		return (
			<div
				data-docs-nav=""
				mix={[
					vstack({ gap: 4 }),
					minIs(0),
					when("& [hidden]", raw({ display: "none !important" })),
				]}
			>
				<DocsNavTools
					filter={
						filter
							? {
									label: filter.label,
									placeholder: filter.placeholder,
									name: filter.name ?? "filter",
									query,
								}
							: undefined
					}
				/>
				<Sidebar.Nav aria-label={tree.label} mix={[raw({ gap: "1.25rem" })]}>
					{tree.sections.map((section) => (
						<div
							key={section.title}
							data-docs-nav-section=""
							hidden={matches ? !section.items.some((item) => matches.shown.has(item)) : undefined}
							mix={[vstack({ gap: 1 })]}
						>
							<p mix={[m(0), p(1, 2.5), text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
								{section.title}
							</p>
							<Sidebar.Menu data-docs-nav-list="" mix={[m(0), p(0), listStyle("none")]}>
								{section.items.map((item) => (
									<NavItem key={item.href ?? item.title} item={item} context={context} depth={0} />
								))}
							</Sidebar.Menu>
						</div>
					))}
					{filter ? (
						<p
							data-docs-nav-empty=""
							hidden={!matches || matches.shown.size > 0}
							mix={[m(0), p(2, 2.5), text("sm"), fg("neutral.muted")]}
						>
							{filter.noResults}
						</p>
					) : null}
				</Sidebar.Nav>
				{footer ? <div data-docs-nav-footer="">{footer}</div> : null}
			</div>
		);
	};
}

/** What every row needs from the nav it sits in. */
interface ItemContext {
	activePath: string;
	collapseGroups: boolean;
	prefetch: Sidebar.Prefetch;
	/** What the server-side filter query keeps; `null` draws every page. */
	matches: DocsTreeMatches | null;
}

namespace NavItem {
	export interface Props {
		item: DocsTree.Item;
		context: ItemContext;
		/** 0 for a section's own rows, which use the larger menu row. */
		depth: number;
	}
}

/** Whether `item` is, or holds, the page at `path`. */
function holds(item: DocsTree.Item, path: string): boolean {
	return item.href === path || (item.items ?? []).some((child) => holds(child, path));
}

/** One page, or a group folding its pages under a summary. */
function NavItem(handle: Handle<NavItem.Props>) {
	return () => {
		let { item, context, depth } = handle.props;
		let { activePath, collapseGroups, prefetch, matches } = context;
		let filteredOut = matches ? !matches.shown.has(item) : undefined;
		let Row = depth === 0 ? Sidebar.MenuItem : Sidebar.MenuSubItem;
		let badge = item.badge ? <Sidebar.MenuBadge>{item.badge}</Sidebar.MenuBadge> : null;

		if (!item.items || item.items.length === 0) {
			if (item.href === undefined) return null;
			let Link = depth === 0 ? Sidebar.MenuLink : Sidebar.MenuSubLink;
			return (
				<Row hidden={filteredOut}>
					<Link href={item.href} prefetch={prefetch} active={item.href === activePath}>
						<span data-docs-nav-title="">{item.title}</span>
						{badge}
					</Link>
				</Row>
			);
		}

		let own = !collapseGroups || holds(item, activePath);
		let opened = !own && (matches?.opened.has(item) ?? false);
		let current = item.href !== undefined && item.href === activePath;

		return (
			<Row hidden={filteredOut}>
				<details open={own || opened} data-docs-nav-opened={opened ? "" : undefined}>
					<summary
						mix={[
							hstack({ gap: 2, align: "center" }),
							minBs("2.25rem"),
							pi("0.625rem"),
							text("sm"),
							fg("neutral.muted"),
							listStyle("none"),
							raw({ cursor: "pointer", borderRadius: "var(--ui-radius-lg, 0.5rem)" }),
							hover(fg("neutral.emphasis")),
							when("&::-webkit-details-marker", hidden()),
						]}
					>
						{item.href ? (
							<a
								href={item.href}
								aria-current={current ? "page" : undefined}
								mix={[
									fg("inherit"),
									raw({ textDecoration: "none" }),
									when('&[aria-current="page"]', [fg("neutral.emphasis"), weight("medium")]),
								]}
							>
								<span data-docs-nav-title="">{item.title}</span>
							</a>
						) : (
							<span data-docs-nav-title="">{item.title}</span>
						)}
						{badge}
						<ChevronRightIcon
							size={14}
							aria-hidden="true"
							mix={[
								shrink(0),
								mis("auto"),
								transition("transform"),
								media("(prefers-reduced-motion: reduce)", transitionDuration("0s")),
								when("[open] > summary > &", rotate(90)),
							]}
						/>
					</summary>
					<Sidebar.MenuSub mix={[m(0), mis("0.625rem"), listStyle("none")]}>
						{item.items.map((child) => (
							<NavItem
								key={child.href ?? child.title}
								item={child}
								context={context}
								depth={depth + 1}
							/>
						))}
					</Sidebar.MenuSub>
				</details>
			</Row>
		);
	};
}
