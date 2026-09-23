/**
 * The shell every documentation page composes into: the tree on the left, a trail
 * across the top, the page in the middle, and — where a page has one — its own
 * headings on the right. Guides and package references share it, so a reader moving
 * between the two never loses the tree they were navigating with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { MenuIcon } from "@sdxc/icons";
import { borderEdge, fg } from "@sdxc/u/color";
import {
	basis,
	block,
	hidden,
	hstack,
	inlineFlex,
	insBs,
	self,
	shrink,
	sticky,
	vstack,
} from "@sdxc/u/layout";
import { overflow, overflowX, overflowY } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { bs, is, maxBs, maxIs, mis, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, tracking, weight } from "@sdxc/u/typography";
import { Breadcrumbs, Button, Sidebar } from "@sdxc/ui";

import type { NavTree } from "~/app/services/navigation-tree";

import { findNeighbours } from "~/app/services/navigation-tree";
import DocsNav from "~/resources/components/docs-nav";
import DocsPager from "~/resources/components/docs-pager";
import { SiteNav } from "~/resources/components/site-header";
import routes from "~/routes/web";

/** The drawer a narrow screen opens, and the button that opens it, agree on this id. */
const DRAWER_ID = "docs-drawer";

/** Width the docked rail collapses at, which is where `Sidebar` hands over to the drawer. */
const DRAWER_BREAKPOINT = "(max-width: 47.9375rem)";

/**
 * Width the page has to reach before the in-page rail is drawn beside the prose. Below it
 * the tree already takes 16rem of the viewport, and the two columns together would leave
 * the prose too narrow to read.
 */
const ASIDE_BREAKPOINT = "(min-width: 75rem)";

/** Height the rail's header sets, which the trail across the page matches. */
const HEADER_HEIGHT = "4rem";

namespace DocsLayout {
	/** One step of the trail; the step the reader is on carries no destination. */
	export interface Crumb {
		label: string;
		href?: string;
	}

	export interface Props {
		tree: NavTree;
		/** The path being read, which is what marks one link in the tree as current. */
		activePath: string;
		breadcrumbs: Crumb[];
		children: RemixNode;
		/** The page's own in-page navigation, drawn beside it where there is room. */
		aside?: RemixNode;
	}
}

/** Renders the tree, the trail, and the page between them. */
export default function DocsLayout(handle: Handle<DocsLayout.Props>) {
	return () => {
		let { activePath, aside, breadcrumbs, children, tree } = handle.props;
		let { next, previous } = findNeighbours(tree, activePath);

		let heading = (
			<a
				href={routes.home.href()}
				mix={[fg("neutral.emphasis"), text("base"), weight("semibold"), tracking("tight")]}
			>
				sdxc
			</a>
		);

		return (
			<Sidebar.Provider>
				<Sidebar
					collapsible="offcanvas"
					mix={[
						/* The rail holds the viewport rather than the document, so a page scrolls past it. */
						sticky(),
						insBs(0),
						self("start"),
						bs("100dvh"),
						/*
						 * The rail animates its own width, and a transition running on that property
						 * holds the old value; pulling the rail out of the flow by its own width
						 * hands the space back at once, alongside the slide it already performs.
						 */
						when('[data-slot="provider"]:has([data-slot="toggle"]:checked) &', [
							mis("calc(-1 * var(--sidebar-width, 16rem))"),
							overflowX("hidden"),
						]),
					]}
				>
					<Sidebar.Header>{heading}</Sidebar.Header>
					<Sidebar.Content>
						<DocsNav tree={tree} activePath={activePath} />
					</Sidebar.Content>
				</Sidebar>

				<Sidebar.MobileNav id={DRAWER_ID} aria-label="Documentation">
					<Sidebar.Header>{heading}</Sidebar.Header>
					<Sidebar.Content>
						<DocsNav tree={tree} activePath={activePath} />
					</Sidebar.Content>
				</Sidebar.MobileNav>

				<Sidebar.Inset mix={[overflow("visible")]}>
					<header
						mix={[
							hstack({ gap: 3, align: "center" }),
							p(0, 5),
							is("100%"),
							bs(HEADER_HEIGHT),
							borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
							media("(min-width: 48rem)", p(0, 8)),
						]}
					>
						{/* The rail is what a wide screen collapses; a narrow one has the drawer instead. */}
						<span mix={[inlineFlex(), media(DRAWER_BREAKPOINT, hidden())]}>
							<Sidebar.Trigger id="docs-rail-toggle" aria-label="Collapse the documentation tree" />
						</span>

						<span mix={[hidden(), media(DRAWER_BREAKPOINT, inlineFlex())]}>
							<Button
								type="button"
								variant="ghost"
								color="neutral"
								size="sm"
								commandfor={DRAWER_ID}
								command="show-modal"
								aria-label="Open the documentation tree"
							>
								<MenuIcon size={18} aria-hidden="true" />
							</Button>
						</span>

						{breadcrumbs.length > 0 ? (
							<Breadcrumbs aria-label="Breadcrumb">
								<Breadcrumbs.List>
									{breadcrumbs.map((crumb) => (
										<Breadcrumbs.Item key={crumb.label}>
											{crumb.href ? (
												<Breadcrumbs.Link href={crumb.href}>{crumb.label}</Breadcrumbs.Link>
											) : (
												<span>{crumb.label}</span>
											)}
										</Breadcrumbs.Item>
									))}
								</Breadcrumbs.List>
							</Breadcrumbs>
						) : null}

						{/* The trail already fills a narrow header; the drawer carries these there. */}
						<span
							mix={[
								hidden(),
								mis("auto"),
								media("(min-width: 48rem)", hstack({ gap: 3, align: "center" })),
							]}
						>
							<SiteNav activePath={activePath} />
						</span>
					</header>

					<div
						mix={[
							vstack({ gap: 10 }),
							is("100%"),
							p(8, 5, 16, 5),
							media("(min-width: 60rem)", p(10, 8, 20, 8)),
							media(ASIDE_BREAKPOINT, [hstack({ gap: 12, align: "start", justify: "between" })]),
						]}
					>
						<main mix={[is("100%"), maxIs("48rem")]}>
							{children}
							<DocsPager previous={previous} next={next} />
						</main>

						{aside ? (
							/*
							 * Held against the viewport so the headings stay reachable down a long page,
							 * and given a width it keeps: the rail is only worth drawing at its own size,
							 * so the prose beside it yields the space instead of squeezing it to a column
							 * of broken words.
							 */
							<div
								mix={[
									hidden(),
									media(ASIDE_BREAKPOINT, [
										block(),
										basis("16rem"),
										shrink(0),
										sticky(),
										insBs("2rem"),
										maxBs("calc(100dvh - 4rem)"),
										overflowY("auto"),
									]),
								]}
							>
								{aside}
							</div>
						) : null}
					</div>
				</Sidebar.Inset>
			</Sidebar.Provider>
		);
	};
}
