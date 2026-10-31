/**
 * A docs sidebar drawn from a {@link DocsTree}: sections under plain labels, pages and
 * titled groups of pages, the current page marked and scrolled into view, an optional
 * title filter, and a footer for support links. The same tree feeds the pager.
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

import type { DocsTree } from "../utils/docs-tree.js";

import { DocsNavTools } from "./docs-nav-tools.js";
import { Sidebar } from "./sidebar.js";

/** Prop types for {@link DocsNav}. */
export namespace DocsNav {
	export interface Props {
		/** The pages to list; `tree.label` names the navigation landmark. */
		tree: DocsTree;
		/** The path being read, which marks one link `aria-current="page"`. */
		activePath: string;
		/**
		 * A field that filters pages by title, with the line shown when nothing matches.
		 * It appears once the page's script loads.
		 */
		filter?: { label: string; placeholder: string; noResults: string };
		/** Drawn under the tree, such as "Contact support" or a status link. */
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
 * `@sdxc/ui/docs-nav-tools` in the browser entry for the scroll-to-current and the filter.
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
		let context: ItemContext = { activePath, collapseGroups, prefetch };

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
					filter={filter ? { label: filter.label, placeholder: filter.placeholder } : undefined}
				/>
				<Sidebar.Nav aria-label={tree.label} mix={[raw({ gap: "1.25rem" })]}>
					{tree.sections.map((section) => (
						<div key={section.title} data-docs-nav-section="" mix={[vstack({ gap: 1 })]}>
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
							hidden
							mix={[m(0), p(2, 2.5), text("sm"), fg("neutral.muted")]}
						>
							{filter.noResults}
						</p>
					) : null}
				</Sidebar.Nav>
				{footer ? <div mix={[pi("0.625rem")]}>{footer}</div> : null}
			</div>
		);
	};
}

/** What every row needs from the nav it sits in. */
interface ItemContext {
	activePath: string;
	collapseGroups: boolean;
	prefetch: Sidebar.Prefetch;
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
		let { activePath, collapseGroups, prefetch } = context;
		let Row = depth === 0 ? Sidebar.MenuItem : Sidebar.MenuSubItem;
		let badge = item.badge ? <Sidebar.MenuBadge>{item.badge}</Sidebar.MenuBadge> : null;

		if (!item.items || item.items.length === 0) {
			if (item.href === undefined) return null;
			let Link = depth === 0 ? Sidebar.MenuLink : Sidebar.MenuSubLink;
			return (
				<Row>
					<Link href={item.href} prefetch={prefetch} active={item.href === activePath}>
						<span>{item.title}</span>
						{badge}
					</Link>
				</Row>
			);
		}

		let open = !collapseGroups || holds(item, activePath);
		let current = item.href !== undefined && item.href === activePath;

		return (
			<Row>
				<details open={open}>
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
								{item.title}
							</a>
						) : (
							<span>{item.title}</span>
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
