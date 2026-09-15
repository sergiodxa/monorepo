/**
 * The chrome every signed-in page wears: the rail naming the app's sections, the header
 * carrying the page's own name and whatever acts on it, and the column the page's content
 * sits in. It exists so each page describes only what it shows.
 *
 * Copy arrives already translated, so the layout renders text without reaching for a
 * dictionary and a controller stays the one place a key is named.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import {
	ChevronsUpDownIcon,
	InboxIcon,
	LogOutIcon,
	RssIcon,
	SearchIcon,
	SettingsIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, borderEdge, fg, translucent } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, env, listStyle, raw } from "@sdxc/u/general";
import {
	basis,
	fixed,
	flex,
	flexCol,
	gap,
	grid,
	grow,
	hidden,
	inline,
	inlineFlex,
	insBe,
	insBs,
	insIe,
	insIs,
	items,
	justify,
	self,
	shrink,
	sticky,
	vstack,
} from "@sdxc/u/layout";
import { boxSizing } from "@sdxc/u/layout";
import { overflowY } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import {
	bleed,
	bs,
	is,
	m,
	maxIs,
	mbs,
	minBs,
	minIs,
	p,
	pb,
	pbe,
	pi,
	pis,
	safeAreaPadding,
} from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { hover, when } from "@sdxc/u/state";
import { tabularNums, text, textAlign, textDecoration, truncate, weight } from "@sdxc/u/typography";
import { Avatar, Heading, Menu, NavLink, Sidebar } from "@sdxc/ui";

import DocumentLayout from "~/resources/layouts/document";
import OutboundMark from "~/resources/views/outbound-mark";
import routes from "~/routes/web";

/**
 * Width of the measure prose and fields are read at.
 *
 * The page itself fills the pane the rail leaves it, since a list of rows is scanned down
 * rather than read across and the rail already spends the width a cap used to. Content that
 * wants this measure caps itself here on whichever surface it appears: a sentence is no
 * easier to follow, nor a field easier to fill, for spanning a window.
 */
export const PAGE_COLUMN = "48rem";

/**
 * Gutter the page keeps from the edges of the pane it is read in, which the header and the
 * content below it both take, so the two sit on one vertical line on every surface.
 */
const PAGE_GUTTER = 6;

/**
 * Where the sections stand as a rail down the side of the page. Its own width is what the
 * boundary is set by: below it a rail would spend a third of a narrow screen naming four
 * places, so the sections take the bottom of the screen instead and the page keeps the
 * whole of the width it has.
 */
const SECTION_RAIL = "(min-width: 64rem)";

/** The same boundary read the other way, where the sections are a bar along the bottom. */
const SECTION_BAR = "(max-width: 63.999rem)";

/** Width the rail takes out of the screen, leaving the rest of it as the page's own pane. */
const RAIL_WIDTH = "16rem";

/**
 * Where the header's row has the width for an action to say in words what its mark says,
 * and for the page's own name to still be read beside it. A feed carries three actions,
 * which is the widest set any surface has; at this width their words and a name worth
 * reading both fit, and below it the marks stand alone rather than squeezing the name to
 * its own ellipsis.
 *
 * It counts the gutters and, above 64rem, the rail as well: a screen of 64rem hands the
 * row 45rem of its own, so the words arriving at 45rem of screen keeps one rule true on
 * both sides of the width the rail appears at.
 */
const WIDE_HEADER = "(min-width: 45rem)";

/**
 * Edge of the glyphs the chrome is drawn with, which is the size the marks on a post's row
 * and the one on its title already wear.
 */
const ICON_SIZE = 16;

/** The root this app sets its type at, which turns that edge into a length to compute with. */
const ROOT_FONT_SIZE = 16;

/** That same edge as a length, for the arithmetic lining the rail's second level up. */
const ICON_WIDTH = `${ICON_SIZE / ROOT_FONT_SIZE}rem`;

/** Inline padding a rail row keeps from the rail's own edges. */
const RAIL_ROW_PADDING = "0.75rem";

/** Space between a rail row's mark and the name beside it. */
const RAIL_ROW_GAP = "0.75rem";

/**
 * Where a feed's name begins under the Feeds heading: past the row's own padding, the mark
 * that heading carries, and the gap after it. Computed from those three rather than set to
 * the number they happen to add up to, so the column stays straight if any of them moves.
 */
const RAIL_NEST_INDENT = `calc(${RAIL_ROW_PADDING} + ${ICON_WIDTH} + ${RAIL_ROW_GAP})`;

/** Ties the rail's search box to the label naming it. */
const RAIL_SEARCH_FIELD_ID = "rail-search";

/**
 * The parameter a search travels in, which the rail's box submits under and the search page
 * reads its query back out of. It is named here, where the box that sends it lives, and the
 * page that answers reads it from here, so one search has one name.
 */
export const SEARCH_PARAM = "q";

/**
 * Height of the header, held rather than grown into: a page with three actions beside its
 * name and a page with none draw the same band, so the content below starts on one line
 * wherever a reader is. The name gives way to its own ellipsis to keep it.
 */
const HEADER_HEIGHT = "3.5rem";

/** Height of the section bar, which a cell of it is no shorter than. */
const BAR_HEIGHT = "3.5rem";

/**
 * What the page leaves clear below its last line on a screen the sections bar: the bar's
 * own height and the gutter the page keeps everywhere else, plus whatever a phone reserves
 * below the bar for the hardware it is held in.
 */
const BAR_CLEARANCE = `calc(${BAR_HEIGHT} + 1.5rem + ${env("safe-area-inset-bottom", "0px")})`;

/** The `id` the viewer's own menu answers to, which its trigger names in `commandfor`. */
const USER_MENU_ID = "user-menu";

/**
 * Runs a list out to the edges of the page's pane, taking back the gutter the page keeps
 * around everything else. The rules between rows and the fill under the pointer then reach
 * both edges, which is what makes a run of rows read as one list rather than as a stack of
 * cards.
 *
 * The gutter is not lost, it moves: a row carries it as {@link listRowGutter}, so the words
 * land exactly where the page would have put them.
 */
export function listBleed() {
	return bleed(PAGE_GUTTER);
}

/**
 * The inline padding a row of a bled list carries, which is the page's own gutter now spent
 * inside the row rather than around the list.
 */
export function listRowGutter() {
	return pi(PAGE_GUTTER);
}

/**
 * The size a note on the page is drawn at: padded in proportion to the line or two of news
 * it carries rather than to the paragraph a panel is built for, so a sentence about a sweep
 * sits among rows of posts at the weight of a remark rather than of a section.
 *
 * Every alert in the app takes it, so the sweep that finished, the file that imported and
 * the cursor that went stale all read as the same kind of thing. The fill and the edge the
 * tone is carried in are left alone, since a tighter note has less room to say what it is.
 */
export function pageNote() {
	/**
	 * Carried on the note's own slot rather than bare: the component sets this padding
	 * itself, and two rules of equal weight are settled by which was written to the
	 * stylesheet last, which is not something a caller can see. Naming the slot makes this
	 * the more specific rule and so the one that holds wherever it lands in the sheet.
	 */
	return [when('&[data-slot="alert"]', [p(2, 3), gap(2), rounded("md")])];
}

/**
 * The letters a viewer with no picture is drawn with: the first of their first word and the
 * first of their last, which is what tells two readers of one app apart at this size.
 *
 * @param name - The viewer's name, which an absent claim leaves empty.
 */
function initials(name: string): string {
	let words = name.split(/\s+/).filter((word) => word.length > 0);
	if (words.length === 0) return "";
	let first = words[0] ?? "";
	let last = words.length > 1 ? (words[words.length - 1] ?? "") : "";
	return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
}

export namespace AppLayout {
	/** Where a heading points when the thing it names lives outside the app. */
	export interface HeadingLink {
		href: string;
		/**
		 * What following the heading does, since the heading's own words name the thing and
		 * not the trip. It reaches a screen reader beside the heading text and a pointer
		 * through the tooltip `title` gives.
		 */
		label: string;
	}

	/** The chrome's copy, translated by the controller that renders the page. */
	export interface Nav {
		/** Accessible name for the sections themselves. */
		label: string;
		reading: string;
		feeds: string;
		search: string;
		/** Names the rail's search box, which carries no visible label of its own. */
		searchLabel: string;
		/** What the rail's empty search box says it is for. */
		searchPlaceholder: string;
		/** Names the group of followed feeds the rail lists under its Feeds heading. */
		subscriptions: string;
		settings: string;
		/** Names the trigger the viewer's own menu opens from, and the menu it opens. */
		account: string;
		logout: string;
	}

	/** One followed feed as the rail lists it, with its count already in words. */
	export interface RailFeed {
		id: string;
		title: string;
		/** How many posts are waiting, shown as the number itself beside the name. */
		unreadCount: number;
		/**
		 * That count said in full for a screen reader, or `null` for a feed with nothing
		 * waiting — which is a row that carries no count at all, the way the feed list's own
		 * rows do.
		 */
		unreadLabel: string | null;
	}

	/** The signed-in reader, as the chrome shows them back to themselves. */
	export interface Viewer {
		name: string;
		email: string;
		/** The picture their provider holds, which an account without one leaves empty. */
		avatar: string;
	}

	export interface Props {
		/** Text for the `<title>` element. */
		documentTitle: string;
		/** The page's own name, which the header carries. */
		heading: string;
		/** Where that name leads, for a page whose subject has a home of its own. */
		headingLink?: HeadingLink;
		/**
		 * Controls acting on what the header names, laid out in a row at the end of its line.
		 * They keep that line at every width, so each one says in a mark what it says in
		 * words on a screen with the room for both.
		 */
		actions?: RemixNode;
		/**
		 * The path being read, which is what marks the one thing in the chrome the reader is
		 * standing on: a section, one of the feeds under the Feeds heading, or the account
		 * menu's own entry. A path naming none of them lights none of them.
		 */
		currentPath: string;
		/** The request's detected language, set as `<html lang>`. */
		locale?: string;
		nav: Nav;
		viewer: Viewer;
		/** The followed feeds the rail lists, capped by whoever gathers them. */
		feeds: RailFeed[];
		/** What the reader last searched for, put back into the rail's box. */
		searchQuery: string;
		children: RemixNode;
	}
}

/**
 * One link in a row of them, which is what a page's own filters are. The one being read
 * wears the app's strongest foreground and the rest settle to body copy, which is the pair
 * of shades an unread post and a read one already differ by on every other surface.
 *
 * The weight stays put across the row for the reason a post's title holds its own: a
 * heavier face is a wider one, so marking a label current would nudge the ones beside it
 * along the line. Pointing at a label underlines it, which is what the app's other links do.
 */
export function AppNavLink(
	handle: Handle<{ href: string; label: string; icon?: RemixNode; isCurrent: boolean }>,
) {
	return () => {
		let { href, icon, label, isCurrent } = handle.props;

		return (
			<NavLink
				href={href}
				aria-current={isCurrent ? "page" : undefined}
				mix={[
					inlineFlex(),
					items("center"),
					gap(1),
					text("sm"),
					weight("medium"),
					textDecoration("none"),
					hover(textDecoration({ line: "underline", thickness: 1, offset: 4 })),
				]}
			>
				{icon}
				{label}
			</NavLink>
		);
	};
}

/**
 * The words beside an action's mark, carried wherever the header's row has the width for
 * both. On a narrower screen the mark stands alone and the name the control itself holds is
 * what a screen reader announces and a pointer rests on, which is how a post's row says the
 * same things in the same place.
 */
export function ActionLabel(handle: Handle<{ children: RemixNode }>) {
	return () => <span mix={[hidden(), media(WIDE_HEADER, inline())]}>{handle.props.children}</span>;
}
/** Renders the sections, the header and the page around a signed-in page's content. */
export default function AppLayout(handle: Handle<AppLayout.Props>) {
	return () => {
		let {
			actions,
			children,
			currentPath,
			documentTitle,
			feeds,
			heading,
			headingLink,
			locale,
			nav,
			searchQuery,
			viewer,
		} = handle.props;

		/**
		 * One thing in the chrome is the place being read, and it is whichever link leads
		 * exactly where the reader already is. A feed's own page is that feed's row rather
		 * than the Feeds heading above it, which is what a reader following the rail down
		 * expects of the row they just clicked.
		 */
		function isCurrent(href: string): boolean {
			return currentPath === href;
		}

		let sections: Array<{ href: string; label: string; icon: RemixNode }> = [
			{
				href: routes.reading.href(),
				label: nav.reading,
				/** Everything every followed feed has published, waiting to be worked through. */
				icon: <InboxIcon size={ICON_SIZE} />,
			},
			{
				href: routes.feeds.index.href(),
				label: nav.feeds,
				/** The mark a site puts on its own feed, which is what this section collects. */
				icon: <RssIcon size={ICON_SIZE} />,
			},
			{
				href: routes.search.href(),
				label: nav.search,
				icon: <SearchIcon size={ICON_SIZE} />,
			},
		];

		/** The Feeds section, which is the one carrying the reader's subscriptions beneath it. */
		let feedsHref = routes.feeds.index.href();

		/** The Search section, which the rail answers with a box and the bar with a cell. */
		let searchHref = routes.search.href();

		return (
			<DocumentLayout title={documentTitle} locale={locale}>
				{/**
				 * Two columns from the width the rail earns, and one below it, where the sections
				 * have left the flow for the foot of the screen. The page's own pane is told it may
				 * be narrower than its contents, which is what keeps a long word or a wide row
				 * inside it rather than pushing the whole grid sideways.
				 */}
				<div
					mix={[media(SECTION_RAIL, [grid(), raw({ gridTemplateColumns: `${RAIL_WIDTH} 1fr` })])]}
				>
					{/**
					 * The sections, in the two shapes they take. Beside the page they are a rail that
					 * holds its place as the page scrolls past it, listing the reader's feeds under
					 * the Feeds heading and resting the viewer's own menu at the foot of it. Under
					 * the page they are a bar across the bottom of the screen: three places and the
					 * viewer, each one tap away, which is what a drawer behind a button would charge
					 * two taps and a way back out for.
					 */}
					<div
						mix={[
							fixed(),
							insBe(0),
							insIs(0),
							insIe(0),
							z(20),
							flex(),
							items("stretch"),
							translucent(),
							bg("neutral.tint"),
							borderEdge("block-start", { color: "neutral.border", width: 1 }),
							safeAreaPadding("bottom"),
							media(SECTION_RAIL, [
								sticky(),
								insBs(0),
								insBe("auto"),
								self("start"),
								bs("100dvh"),
								overflowY("auto"),
								flexCol(),
								gap(4),
								p(4, 3),
								border("none"),
								borderEdge("inline-end", { color: "neutral.border", width: 1 }),
							]),
						]}
					>
						{/**
						 * Searching starts where the reader's eye already is, so the rail opens with the
						 * box rather than with a link to a page holding one. One field and no submit:
						 * a form with a single text input is sent by the return key, which is the whole
						 * of the interaction.
						 *
						 * The rail is the only place it fits, so below that width Search keeps the cell
						 * it always had among the sections.
						 */}
						<form
							method="get"
							action={routes.search.href()}
							mix={[hidden(), media(SECTION_RAIL, [flex(), shrink()])]}
						>
							<label htmlFor={RAIL_SEARCH_FIELD_ID} mix={[visuallyHidden()]}>
								{nav.searchLabel}
							</label>
							<input
								/**
								 * Keyed by the page it was drawn for, so moving between pages replaces the
								 * field rather than patching it. The runtime keeps an editable value across
								 * a reload when the incoming HTML changes only the serialized default,
								 * which is the right call for a field a reader owns — and the wrong one
								 * here, where the URL owns it: the box says what the page beside it is
								 * filtered by, so a query left behind would claim a filter nothing applied.
								 */
								data-rmx-key={`${RAIL_SEARCH_FIELD_ID}:${currentPath}?${searchQuery}`}
								id={RAIL_SEARCH_FIELD_ID}
								type="search"
								name={SEARCH_PARAM}
								placeholder={nav.searchPlaceholder}
								defaultValue={searchQuery}
								autoComplete="off"
								mix={[
									is("full"),
									minIs(0),
									boxSizing("border-box"),
									p(2, 3),
									rounded("lg"),
									border({ color: "neutral.border", width: 1 }),
									bg("neutral.bg"),
									fg("neutral.emphasis"),
									raw({ font: "inherit", fontSize: "0.875rem" }),
								]}
							/>
						</form>

						{/**
						 * The sections sit directly under the box, and the slack in the rail is spent
						 * here, between them and the menu at the foot: a reader following a feed grows
						 * this list, and nothing above the menu moves when they do.
						 *
						 * It scrolls on its own once the feeds outrun the rail, so a long subscription
						 * list runs past the bottom of this rather than pushing the menu off the screen.
						 */}
						<nav
							aria-label={nav.label}
							mix={[
								grow(),
								minIs(0),
								media(SECTION_RAIL, [grow(), basis("0%"), minBs(0), overflowY("auto")]),
							]}
						>
							<ul
								mix={[
									listStyle(),
									m(0),
									p(0),
									flex(),
									items("stretch"),
									bs("full"),
									media(SECTION_RAIL, [flexCol(), gap(1), bs("auto")]),
								]}
							>
								{sections.map((section) => (
									<li
										key={section.href}
										mix={[
											grow(),
											basis("0%"),
											minIs(0),
											media(SECTION_RAIL, [grow(0), basis("auto")]),
										]}
									>
										<Sidebar.Item
											href={section.href}
											current={isCurrent(section.href)}
											mix={[
												pi(RAIL_ROW_PADDING),
												gap(RAIL_ROW_GAP),
												/**
												 * Search keeps a cell of its own down here, where the rail's box
												 * has nowhere to sit: a bar of cells is no place for a field, and
												 * a phone still needs the way to search.
												 */
												section.href === searchHref && media(SECTION_RAIL, hidden()),
												media(SECTION_BAR, [
													flexCol(),
													items("center"),
													justify("center"),
													gap(1),
													pi(1),
													pb(2),
													bs("full"),
													minBs(BAR_HEIGHT),
													text("xs"),
													textAlign("center"),
												]),
											]}
										>
											{section.icon}
											{/**
											 * The word itself gives way to an ellipsis in the bar, where four
											 * cells share the width of a phone, rather than widening a cell and
											 * pushing the row past the screen.
											 */}
											<span mix={[minIs(0), maxIs("full"), truncate()]}>{section.label}</span>
										</Sidebar.Item>

										{/**
										 * The subscriptions themselves, under the heading that names them and
										 * leads to the whole list. They belong to the rail: a bar along the
										 * bottom of a phone has room for places, not for a tree, and the Feeds
										 * page is where a reader meets their feeds at that width.
										 */}
										{section.href === feedsHref && feeds.length > 0 && (
											<ul
												aria-label={nav.subscriptions}
												mix={[
													listStyle(),
													m(0),
													p(0),
													hidden(),
													media(SECTION_RAIL, [flex(), flexCol(), gap("2px"), mbs(1)]),
												]}
											>
												{feeds.map((feed) => (
													<li key={feed.id}>
														<Sidebar.Item
															href={routes.feeds.show.href({ feedId: feed.id })}
															current={isCurrent(routes.feeds.show.href({ feedId: feed.id }))}
															/**
															 * A level down from the sections and quieter for it, so an
															 * eye running the rail still finds Search past twenty feeds.
															 * The indent lines these names up under the heading's own.
															 */
															mix={[
																minBs("1.75rem"),
																pi(RAIL_ROW_PADDING),
																pis(RAIL_NEST_INDENT),
																gap(RAIL_ROW_GAP),
																pb(1),
																text("xs"),
																fg("neutral.muted"),
															]}
														>
															<span mix={[grow(), minIs(0), truncate()]}>{feed.title}</span>

															{/**
															 * The number alone beside the name, which is what a column of
															 * them is read by; the phrase it stands for is said in full
															 * for anyone listening rather than looking. A feed with
															 * nothing waiting carries neither.
															 */}
															{feed.unreadLabel && (
																<>
																	<span aria-hidden="true" mix={[shrink(), tabularNums()]}>
																		{feed.unreadCount}
																	</span>
																	<span mix={[visuallyHidden()]}>{feed.unreadLabel}</span>
																</>
															)}
														</Sidebar.Item>
													</li>
												))}
											</ul>
										)}
									</li>
								))}
							</ul>
						</nav>

						{/**
						 * The viewer, with what belongs to their account behind their own face: the
						 * preferences and the way out, which are about who is signed in rather than
						 * about where to read. It is a menu the browser opens and closes on its own,
						 * which is what lets a page shipping almost no script carry one.
						 */}
						<div mix={[flex(), items("center"), shrink(), media(SECTION_RAIL, [is("full")])]}>
							<button
								type="button"
								commandfor={USER_MENU_ID}
								command="toggle-popover"
								aria-label={nav.account}
								title={nav.account}
								mix={[
									flex(),
									items("center"),
									gap(2),
									minIs(0),
									p(2),
									pi(3),
									border("none"),
									rounded("lg"),
									bg("transparent"),
									fg("inherit"),
									raw({ font: "inherit" }),
									textAlign("start"),
									cursor("pointer"),
									hover(bg("neutral.bg-tint-hover")),
									media(SECTION_RAIL, is("full")),
								]}
							>
								<Avatar size="sm">
									{viewer.avatar ? <Avatar.Image src={viewer.avatar} alt="" /> : null}
									<Avatar.Fallback>{initials(viewer.name)}</Avatar.Fallback>
								</Avatar>

								{/**
								 * The bar spends its width on the three places; the face alone says whose
								 * menu this is there, and the name the trigger carries says it in words.
								 */}
								<span
									mix={[
										hidden(),
										media(SECTION_RAIL, [
											inline(),
											grow(),
											basis("0%"),
											minIs(0),
											truncate(),
											text("sm"),
											weight("medium"),
											fg("neutral.emphasis"),
										]),
									]}
								>
									{viewer.name}
								</span>

								<ChevronsUpDownIcon
									size={ICON_SIZE}
									mix={[hidden(), shrink(), media(SECTION_RAIL, inline())]}
								/>
							</button>

							{/**
							 * Opening upward from a trigger that sits at the foot of the rail and at the
							 * foot of the screen alike, so the menu lands over the page either way.
							 */}
							<Menu
								id={USER_MENU_ID}
								placement="top-start"
								aria-label={nav.account}
								mix={[minIs("14rem")]}
							>
								{/**
								 * Whose account this is, which the trigger says in a name and a face. The
								 * address is what tells two accounts of one person apart, and this is the
								 * one place the app has to show it.
								 *
								 * Both lines name their own foreground. A popover is painted by the browser
								 * with its own `color`, which beats what the page around it inherits, so
								 * text set loose inside one reads as black on whatever the surface is: the
								 * name takes the shade an unread post's title wears and the address the
								 * shade a read one settles to, which is the pairing every row already uses.
								 */}
								<div mix={[vstack({ gap: 0 }), p(2, 3), minIs(0)]}>
									<span mix={[truncate(), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
										{viewer.name}
									</span>
									<span mix={[truncate(), text("xs"), fg("neutral.muted")]}>{viewer.email}</span>
								</div>

								<Menu.Separator />

								{/**
								 * The preferences live here rather than in the rail because they are about
								 * the account rather than about somewhere to read. The reader standing on
								 * that page is told so by the row itself, which is the one place in the
								 * chrome that can say it once Settings is no longer a section.
								 */}
								<Menu.Item
									href={routes.settings.index.href()}
									aria-current={isCurrent(routes.settings.index.href()) ? "page" : undefined}
								>
									<SettingsIcon size={ICON_SIZE} />
									{nav.settings}
								</Menu.Item>

								<Menu.Item href={routes.logout.index.href()}>
									<LogOutIcon size={ICON_SIZE} />
									{nav.logout}
								</Menu.Item>
							</Menu>
						</div>
					</div>

					<div mix={[minIs(0)]}>
						{/**
						 * The band spans the page's pane so its rule does, and the row inside it keeps
						 * the same gutter the content below does, so the two sit on one vertical line.
						 */}
						<header
							mix={[
								sticky(),
								insBs(0),
								z(10),
								translucent(),
								bg("neutral.tint"),
								borderEdge("block-end", { color: "neutral.border", width: 1 }),
							]}
						>
							{/**
							 * One row at every width, set in its height, which is what keeps the page
							 * below it starting on the same line from surface to surface.
							 */}
							<div
								mix={[
									pi(PAGE_GUTTER),
									bs(HEADER_HEIGHT),
									boxSizing("border-box"),
									flex(),
									items("center"),
									gap(3),
									media(WIDE_HEADER, gap(4)),
								]}
							>
								<Heading
									level={1}
									mix={[grow(), minIs(0), flex(), items("center"), text("lg"), weight("semibold")]}
								>
									{headingLink ? (
										/**
										 * The page's own name is what carries its subject off to the site behind
										 * it, so the obvious words are the ones worth clicking. It keeps the
										 * heading's color, so it reads as the page's name rather than as a link.
										 */
										<a
											href={headingLink.href}
											target="_blank"
											rel="noopener noreferrer"
											title={headingLink.label}
											mix={[
												inlineFlex(),
												items("center"),
												gap(2),
												minIs(0),
												fg("neutral.emphasis"),
												textDecoration("none"),
												hover(textDecoration("underline")),
											]}
										>
											{/**
											 * The name gives way to an ellipsis inside its own span, leaving the
											 * mark beside it whole: what the mark says about where the link goes
											 * holds however little of the name is left.
											 */}
											<span mix={[minIs(0), truncate()]}>{heading}</span>
											<span mix={[visuallyHidden()]}>{headingLink.label}</span>
											<OutboundMark mix={[shrink()]} />
										</a>
									) : (
										<span mix={[minIs(0), truncate()]}>{heading}</span>
									)}
								</Heading>

								{actions && <div mix={[flex(), items("center"), gap(2), shrink()]}>{actions}</div>}
							</div>
						</header>

						{/**
						 * The page's own content, filling the pane the rail leaves it and keeping clear
						 * of the bar the sections make below it, so the last row of a list is read
						 * rather than sat under.
						 */}
						<main
							mix={[
								vstack({ gap: 6 }),
								p(PAGE_GUTTER),
								pbe(BAR_CLEARANCE),
								media(SECTION_RAIL, pbe(PAGE_GUTTER)),
							]}
						>
							{children}
						</main>
					</div>
				</div>
			</DocumentLayout>
		);
	};
}
