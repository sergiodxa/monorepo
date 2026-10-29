/**
 * The shell every documentation page composes into: the tree on the left, a trail
 * across the top, the page in the middle closed by its author's credit, and — where a
 * page has one — its own headings on the right.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { MenuIcon } from "@sdxc/icons";
import { borderEdge, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import {
	basis,
	hidden,
	hstack,
	inlineFlex,
	insBs,
	relative,
	shrink,
	sticky,
	vstack,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { bs, is, maxBs, maxIs, mis, p, pbe } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { before } from "@sdxc/u/state";
import { text, tracking, weight } from "@sdxc/u/typography";
import { Breadcrumbs, Button, Sidebar } from "@sdxc/ui";

import type { NavTree } from "~/app/services/navigation-tree";

import { findNeighbours } from "~/app/services/navigation-tree";
import AuthorNote from "~/resources/components/author-note";
import DocsNav from "~/resources/components/docs-nav";
import DocsPager from "~/resources/components/docs-pager";
import { DrawerDismiss } from "~/resources/components/drawer-dismiss";
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

/**
 * How much of the viewport the sticky docs aside leaves clear of the site header and
 * the content's block-start padding (`2.5rem` from `p(10, …)` at the aside breakpoint),
 * so the rail fits on screen before it sticks and still clears the header once it does.
 */
const ASIDE_VIEWPORT_CLEARANCE = "6.5rem";

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
				<Sidebar collapsible="offcanvas" mix={[bs("auto")]}>
					<Sidebar.Header mix={[sticky(), insBs(0), z(1)]}>{heading}</Sidebar.Header>
					<Sidebar.Content
						mix={[sticky(), insBs(HEADER_HEIGHT), maxBs(`calc(100dvh - ${HEADER_HEIGHT})`)]}
					>
						<DocsNav tree={tree} activePath={activePath} />
					</Sidebar.Content>
				</Sidebar>

				<Sidebar.MobileNav id={DRAWER_ID} aria-label={tree.label}>
					<Sidebar.Header>{heading}</Sidebar.Header>
					<Sidebar.Content>
						<DocsNav tree={tree} activePath={activePath} />
					</Sidebar.Content>
					<DrawerDismiss />
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
						<span mix={[inlineFlex(), media(DRAWER_BREAKPOINT, hidden())]}>
							<Sidebar.Trigger id="docs-rail-toggle" aria-label="Collapse the sidebar" />
						</span>

						<span mix={[hidden(), media(DRAWER_BREAKPOINT, inlineFlex())]}>
							<Button
								type="button"
								variant="ghost"
								color="neutral"
								size="sm"
								commandfor={DRAWER_ID}
								command="show-modal"
								aria-label="Open the sidebar"
							>
								<MenuIcon size={18} aria-hidden="true" />
							</Button>
						</span>

						{breadcrumbs.length > 0 ? (
							<span mix={[hidden(), media("(min-width: 48rem)", inlineFlex())]}>
								<Breadcrumbs aria-label="Breadcrumb">
									<Breadcrumbs.List>
										{breadcrumbs.map((crumb) => (
											<Breadcrumbs.Item key={crumb.label}>
												{crumb.href ? (
													<Breadcrumbs.Link href={crumb.href}>{crumb.label}</Breadcrumbs.Link>
												) : (
													<Breadcrumbs.Link aria-current="page">{crumb.label}</Breadcrumbs.Link>
												)}
											</Breadcrumbs.Item>
										))}
									</Breadcrumbs.List>
								</Breadcrumbs>
							</span>
						) : null}

						<span mix={[mis("auto")]}>
							<SiteNav activePath={activePath} />
						</span>
					</header>

					<div
						mix={[
							vstack({ gap: 10 }),
							is("100%"),
							relative(),
							raw({ isolation: "isolate" }),

							before(
								raw({
									content: '""',
									position: "absolute",
									insetBlockStart: 0,
									insetInline: 0,
									blockSize: "28rem",
									zIndex: -1,
									backgroundImage:
										"linear-gradient(to right, var(--ui-neutral-border) 1px, transparent 1px), linear-gradient(to bottom, var(--ui-neutral-border) 1px, transparent 1px)",
									backgroundSize: "3rem 3rem",
									opacity: 0.45,
									maskImage: "radial-gradient(70% 90% at 30% 0%, black, transparent 75%)",
									WebkitMaskImage: "radial-gradient(70% 90% at 30% 0%, black, transparent 75%)",
									pointerEvents: "none",
								}),
							),
							p(8, 5, 16, 5),
							media("(min-width: 60rem)", p(10, 8, 20, 8)),
							media(ASIDE_BREAKPOINT, [hstack({ gap: 12, align: "start", justify: "between" })]),
						]}
					>
						<main mix={[is("100%"), maxIs("48rem")]}>
							{children}
							<DocsPager previous={previous} next={next} />
							<AuthorNote />
						</main>

						{aside ? (
							<div
								mix={[
									hidden(),
									media(ASIDE_BREAKPOINT, [
										vstack({ gap: 0, align: "stretch" }),
										basis("16rem"),
										shrink(0),
										sticky(),
										insBs(HEADER_HEIGHT),
										maxBs(`calc(100dvh - ${ASIDE_VIEWPORT_CLEARANCE})`),
										overflow("hidden"),
										pbe(8),
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
