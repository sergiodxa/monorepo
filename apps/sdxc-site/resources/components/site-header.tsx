/**
 * The site's top-level destinations, as a bar with a phone sheet for the landing pages and
 * as a bare row the documentation shell drops into its own header. Both surfaces offer the
 * same places and the same search, so a reader who learns one header keeps the other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, borderEdge, fg } from "@sdxc/u/color";
import { rounded, transition, transitionBehavior } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import {
	flex,
	grid,
	gridTemplate,
	hidden,
	hstack,
	inline,
	inlineFlex,
	repeat,
	vstack,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { light, media } from "@sdxc/u/responsive";
import { is, m, maxBs, maxIs, minBs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, tracking, weight } from "@sdxc/u/typography";
import { Dialog, NavLink } from "@sdxc/ui";
import { SiteHeader as UiSiteHeader } from "@sdxc/ui/patterns";
import { isApplePlatform } from "@sdxc/user-agent/helpers";
import { Frame } from "remix/component";

import { DrawerDismiss } from "~/resources/components/drawer-dismiss";
import { searchFrameSrc } from "~/resources/components/search-box";
import { SearchQuickLinks } from "~/resources/components/search-quick-links";
import { SEARCH_EXIT_MS } from "~/resources/components/search-surface";
import { SEARCH_DIALOG_ID, SearchTrigger } from "~/resources/components/search-trigger";
import routes from "~/routes/web";

/** Where the collection is read and its issues are filed. */
const REPOSITORY_HREF = "https://github.com/sergiodxa/monorepo";

/**
 * Widths a phone reads at, where the search link's shortcut hint names keys no screen has.
 * The hint draws its own `display` in a later style layer, so hiding it takes importance.
 */
const PHONE_QUERY = "(max-width: 29.9375rem)";

/** A destination the header can mark as the page being read. */
type Destination = "docs" | "api" | "utilities" | "components";

namespace SiteHeader {
	export interface Props {
		/** The path being read, which is what marks one destination as the current page. */
		activePath?: string;
		/**
		 * Text the search dialog opens holding, with its results already rendered; the
		 * `/search` page passes its own query so the dialog continues that search.
		 */
		searchQuery?: string;
	}

	export interface NavProps extends Props {}
}

/**
 * Renders the wordmark, the destinations and search as the bar a page hangs under. Below
 * 48rem the destinations move into a full-screen sheet behind a 44px menu button, so every
 * row a thumb reaches is at least 44px tall.
 */
export default function SiteHeader(handle: Handle<SiteHeader.Props>) {
	return () => {
		let { activePath = "", searchQuery } = handle.props;
		let current = currentDestination(activePath);

		return (
			<UiSiteHeader
				collapseAt="lg"
				navLabel="Site"
				brand={
					<a
						href={routes.home.href()}
						mix={[fg("neutral.emphasis"), text("lg"), weight("semibold"), tracking("tight")]}
					>
						sdxc
					</a>
				}
				items={[
					{ label: "Docs", href: routes.docs.index.href(), current: current === "docs" },
					{ label: "API", href: routes.api.index.href(), current: current === "api" },
					{
						label: "Utilities",
						href: routes.api.show.href({ name: "u" }),
						current: current === "utilities",
					},
					{
						label: "Components",
						href: routes.api.show.href({ name: "ui" }),
						current: current === "components",
					},
					{ label: "GitHub", href: REPOSITORY_HREF },
				]}
				tools={<SiteSearch activePath={activePath} searchQuery={searchQuery} />}
				sheet={
					<>
						<SheetLinks />
						<DrawerDismiss />
					</>
				}
				mix={[
					raw({ "--site-header-gutter": "1.25rem" }),
					media("(min-width: 48rem)", raw({ "--site-header-gutter": "calc(3rem + 1px)" })),
					when(
						'& :is([data-slot="site-header-row"], [data-slot="site-header-sheet"] > *)',
						raw({ paddingInline: "var(--site-header-gutter) !important" }),
					),
					media(
						"(max-width: 47.9375rem)",
						when("& [data-search-trigger]", raw({ blockSize: "2.5rem", borderRadius: "0.625rem" })),
					),
				]}
			/>
		);
	};
}

/**
 * The places a reader reaches once, at the foot of the phone sheet: the main rows stay the
 * destinations a reader returns to, and these sit in two quieter columns under a hairline.
 */
function SheetLinks(_handle: Handle) {
	return () => (
		<ul
			aria-label="More"
			mix={[
				grid(),
				gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }),
				raw({ columnGap: "1rem" }),
				m(0),
				p(0),
				raw({ paddingBlockStart: "0.75rem" }),
				listStyle("none"),
				borderEdge("block-start", { color: "neutral.border", width: 1, style: "solid" }),
				raw({ paddingBlockEnd: "max(1rem, env(safe-area-inset-bottom))" }),
			]}
		>
			{[
				{ label: "Changelog", href: routes.docs.changelog.href() },
				{ label: "Philosophy", href: routes.philosophy.href() },
				{ label: "Showcase", href: routes.showcase.href() },
				{ label: "Sponsor", href: routes.sponsors.href() },
			].map((link) => (
				<li key={link.href}>
					<a
						href={link.href}
						mix={[
							flex(),
							raw({ alignItems: "center" }),
							minBs("2.75rem"),
							text("base"),
							fg("neutral"),
							when("&:hover", fg("neutral.emphasis")),
						]}
					>
						{link.label}
					</a>
				</li>
			))}
		</ul>
	);
}

/**
 * Renders the destinations alone, for a shell that already draws its own bar. On a phone
 * the search link drops its shortcut hint, which leaves the row narrow enough to sit
 * beside a wordmark or a menu button at 320px.
 */
export function SiteNav(handle: Handle<SiteHeader.NavProps>) {
	return () => {
		let { activePath = "", searchQuery } = handle.props;
		let current = currentDestination(activePath);

		return (
			<div mix={[hstack({ gap: 3, align: "center" })]}>
				<SiteSearch activePath={activePath} searchQuery={searchQuery} />

				<nav
					aria-label="Site"
					mix={[
						hstack({ gap: 4, align: "center" }),
						text("sm"),
						media("(min-width: 30rem)", [hstack({ gap: 6, align: "center" }), text("base")]),
					]}
				>
					<NavLink
						href={routes.docs.index.href()}
						aria-current={current === "docs" ? "page" : undefined}
					>
						Docs
					</NavLink>
					<NavLink
						href={routes.api.index.href()}
						aria-current={current === "api" ? "page" : undefined}
					>
						API
					</NavLink>
					<NavLink
						href={routes.api.show.href({ name: "u" })}
						aria-current={current === "utilities" ? "page" : undefined}
					>
						U
					</NavLink>
					<NavLink
						href={routes.api.show.href({ name: "ui" })}
						aria-current={current === "components" ? "page" : undefined}
					>
						UI
					</NavLink>

					<span mix={[hidden(), media("(min-width: 30rem)", inline())]}>
						<NavLink href={REPOSITORY_HREF} rel="noreferrer">
							GitHub
						</NavLink>
					</span>
				</nav>
			</div>
		);
	};
}

/**
 * Renders the search link and the dialog it opens, which every key binding opens too. On a
 * phone the link drops its shortcut hint, since a touch screen has none of those keys.
 */
function SiteSearch(handle: Handle<SiteHeader.Props>) {
	return () => (
		<div
			mix={[inlineFlex(), media(PHONE_QUERY, when("& kbd", raw({ display: "none !important" })))]}
		>
			<SearchTrigger appleKeyboard={isApplePlatform()} />
			<Dialog
				id={SEARCH_DIALOG_ID}
				aria-label="Search the documentation"
				closedby="any"
				mix={[
					p(0),
					bg("transparent"),
					rounded("none"),
					overflow("visible"),
					raw({ boxShadow: "none" }),
					transitionBehavior("allow-discrete"),
					transition("display, overlay", { duration: SEARCH_EXIT_MS }),
					light(when("&::backdrop", bg("rgb(0 0 0 / 0.12)"))),
					is("min(40rem, 100% - 2rem)"),
					maxIs("none"),
					maxBs("calc(100dvh - min(12vh, 6rem) - 1rem)"),
					raw({ marginBlock: "min(12vh, 6rem) auto" }),
				]}
			>
				<div mix={[vstack({ gap: 2 }), minBs(0)]}>
					<Frame
						name="search"
						src={searchFrameSrc(routes.searchFrame.href(), handle.props.searchQuery ?? "")}
					/>
					<SearchQuickLinks currentPath={handle.props.activePath ?? ""} />
				</div>
			</Dialog>
		</div>
	);
}

/**
 * The destination a path belongs to. Each catalogue sits under `/api`, so the broader
 * destination yields to the narrower ones.
 */
function currentDestination(path: string): Destination | null {
	if (isWithin(path, routes.api.show.href({ name: "u" }))) return "utilities";
	if (isWithin(path, routes.api.show.href({ name: "ui" }))) return "components";
	if (isWithin(path, routes.docs.index.href())) return "docs";
	if (isWithin(path, routes.api.index.href())) return "api";
	return null;
}

/**
 * Whether a path is the destination or a page beneath it. A segment boundary is what
 * keeps `/api/ui` from counting as a page under `/api/u`.
 */
function isWithin(path: string, destination: string): boolean {
	return path === destination || path.startsWith(`${destination}/`);
}
