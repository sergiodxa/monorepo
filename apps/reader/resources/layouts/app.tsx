/**
 * The chrome every signed-in page wears: the sidebar a reader searches and navigates from,
 * the header carrying the page's own name and whatever acts on it, and the column the
 * page's content sits in. It exists so each page describes only what it shows.
 *
 * The sidebar is three bands. The search box sits at the top and the reader's own menu at
 * the foot, both held still; between them the queue and every feed the reader follows,
 * which is the band that grows with a subscription list and scrolls within itself. One
 * piece of markup serves both shapes it takes: a drawer a narrow screen opens over the
 * page, and a rail beside the page from the width that has room for one.
 *
 * Copy arrives already translated, so the layout renders text without reaching for a
 * dictionary and a controller stays the one place a key is named.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import {
	BookmarkIcon,
	ChevronsUpDownIcon,
	FolderIcon,
	InboxIcon,
	LogOutIcon,
	MoonIcon,
	PanelLeftIcon,
	PinIcon,
	RssIcon,
	SearchIcon,
	SettingsIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, borderEdge, fg, translucent } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import {
	basis,
	fixed,
	flex,
	flexCol,
	flexWrap,
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
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import {
	bleed,
	bs,
	is,
	m,
	maxBs,
	maxIs,
	minBs,
	minIs,
	p,
	pb,
	pi,
	safeAreaPadding,
} from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { hover, when } from "@sdxc/u/state";
import { tabularNums, text, textDecoration, truncate, weight } from "@sdxc/u/typography";
import { Avatar, Heading, Logo, Menu, NavLink, Sidebar } from "@sdxc/ui";
import { Frame } from "remix/ui";

import { SIDEBAR_FEEDS_FRAME } from "~/resources/components/sidebar-frame";
import DocumentLayout from "~/resources/layouts/document";
import OutboundMark from "~/resources/views/outbound-mark";
import routes from "~/routes/web";

/**
 * Width of the measure prose and fields are read at.
 *
 * The page itself fills the pane the sidebar leaves it, since a list of rows is scanned
 * down rather than read across and the sidebar already spends the width a cap used to.
 * Content that wants this measure caps itself here on whichever surface it appears: a
 * sentence is no easier to follow, nor a field easier to fill, for spanning a window.
 */
export const PAGE_COLUMN = "48rem";

/**
 * Gutter the page keeps from the edges of the pane it is read in, which the header and the
 * content below it both take, so the two sit on one vertical line on every surface.
 */
const PAGE_GUTTER = 6;

/**
 * Where the sidebar stands as a rail down the side of the page. Its own width is what the
 * boundary is set by: below it a rail would spend a third of a narrow screen, so the same
 * three bands become a drawer the reader opens over the page and the page keeps the whole
 * of the width it has.
 */
const SIDEBAR_RAIL = "(min-width: 64rem)";

/** Width the rail takes out of the screen, leaving the rest of it as the page's own pane. */
const RAIL_WIDTH = "16rem";

/** Width the same bands take as a drawer, held inside the narrowest screen they open over. */
const DRAWER_WIDTH = "min(85vw, 18rem)";

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

/** Ties the sidebar's search box to the label naming it. */
const SIDEBAR_SEARCH_FIELD_ID = "sidebar-search";

/**
 * The parameter a search travels in, which the sidebar's box submits under and the reading
 * queue reads its query back out of. It is named here, where the box that sends it lives,
 * and the page that answers reads it from here, so one search has one name.
 */
export const SEARCH_PARAM = "q";

/**
 * Height of a field standing in the app's top band: the sidebar's search box, and whatever
 * a page puts among its own actions. A field is the one thing up there with a height of its
 * own — a page's name is as tall as its line — so the field is what the band is measured
 * from, and both sides read it from here.
 */
export const BAND_FIELD_HEIGHT = "2.25rem";

/** Space the band keeps above and below whatever stands in it. */
const BAND_PADDING = "0.625rem";

/** Weight of the rule closing the band, which both halves draw and both count inside. */
const BAND_RULE_WIDTH = 1;

/**
 * Height of the app's top band, which the sidebar's own header and the page's header both
 * draw. The two sit side by side across the top of the screen, so one height is what puts
 * their lower rules on one line and makes the divider read as a single rule across the
 * whole width rather than as two that nearly meet.
 *
 * A page whose actions outrun its row wraps them beneath its name, which is the one case a
 * header grows past this; the sidebar is a drawer at every width where that happens, so
 * there is no band beside it to line up with.
 */
const BAND_HEIGHT = `calc(${BAND_FIELD_HEIGHT} + ${BAND_PADDING} * 2 + ${BAND_RULE_WIDTH}px)`;

/**
 * The rule under the band, drawn once here so the sidebar's half and the page's half are
 * the same colour and weight, and counted inside {@link BAND_HEIGHT} on both, so the two
 * meet as one line across the width of the screen.
 */
function bandRule() {
	return borderEdge("block-end", { color: "neutral.border", width: BAND_RULE_WIDTH });
}

/** The `id` the viewer's own menu answers to, which its trigger names in `commandfor`. */
const USER_MENU_ID = "user-menu";

/** The `id` the sidebar answers to, which the header's trigger names in `commandfor`. */
const SIDEBAR_ID = "app-sidebar";

/**
 * Edge of every mark down the sidebar's first column: the glyphs naming the two places,
 * and the picture standing for each feed. One size for all of them is what makes that
 * column a column, and setting it rather than leaving it to the image is what keeps a row
 * the same height before a picture arrives as after — and for a picture that never comes.
 */
const RAIL_MARK_SIZE = "1.25rem";

/** The initials a feed's mark falls back to, sized to sit inside {@link RAIL_MARK_SIZE}. */
const RAIL_MARK_TEXT = "0.5rem";

/** Inline padding a sidebar row keeps from the sidebar's own edges. */
const ROW_PADDING = "0.75rem";

/** Space between a sidebar row's mark and the name beside it. */
const ROW_GAP = "0.75rem";

/**
 * One row of the sidebar's navigation: its mark in the first column at the size every
 * other mark is drawn at, and its name in the second. Carried by the two places and by
 * each feed alike, which is what puts every name on one vertical line — the column it
 * begins at being the padding, the mark and the gap rather than a number set to match.
 *
 * Each rule names the slot it lands on. The components set this padding and these mark
 * sizes themselves, and two rules of equal weight are settled by which was written to the
 * stylesheet last, which is not something a caller can see; naming the slot makes these
 * the more specific rules and so the ones that hold wherever they land in the sheet.
 *
 * @param slot - The `data-slot` the row's own component stamps on itself.
 */
function railRow(slot: string) {
	return [
		when(`&[data-slot="${slot}"]`, [pi(ROW_PADDING), gap(ROW_GAP)]),
		when(`&[data-slot="${slot}"] > svg`, [is(RAIL_MARK_SIZE), bs(RAIL_MARK_SIZE), shrink()]),
	];
}

/** The same first-column size, carried by a mark the sidebar draws as a picture. */
function railMark() {
	return [
		when('&[data-slot="image-placeholder"]', [
			is(RAIL_MARK_SIZE),
			bs(RAIL_MARK_SIZE),
			raw({ fontSize: RAIL_MARK_TEXT }),
		]),
	];
}

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
 * The letters something with no picture is drawn with: the first of its first word and the
 * first of its last, which is what tells one name from another at the size a mark is read
 * at. It stands in for the viewer's own face and for a feed the publisher gave no picture.
 *
 * @param name - The name to reduce, which an absent one leaves empty.
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
		/** Accessible name for the sidebar's navigation. */
		label: string;
		reading: string;
		/**
		 * Names the list of posts the reader asked to keep, or `null` where keeping is
		 * turned off — which is what takes the row out of the sidebar rather than a second
		 * question asked here.
		 */
		saved: string | null;
		/** Names the sidebar's search box, which carries no visible label of its own. */
		searchLabel: string;
		/** What the sidebar's empty search box says it is for. */
		searchPlaceholder: string;
		/** Names the control a narrow screen opens the sidebar from. */
		openSidebar: string;
		settings: string;
		/** Names the trigger the viewer's own menu opens from, and the menu it opens. */
		account: string;
		logout: string;
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
		 * Each one says in a mark what it says in words on a screen with the room for both,
		 * and on a screen without the room for the row they wrap beneath the page's name.
		 */
		actions?: RemixNode;
		/**
		 * The path being read, which is what marks the one thing in the chrome the reader is
		 * standing on: the queue, one of the feeds under the Feeds heading, or the account
		 * menu's own entry. A path naming none of them lights none of them.
		 */
		currentPath: string;
		/** The request's detected language, set as `<html lang>`. */
		locale?: string;
		nav: Nav;
		viewer: Viewer;
		/**
		 * Where the sidebar's feed band is fetched from, which is an address rather than the
		 * list itself: the band is drawn by the server on its own, into the frame below, so
		 * that what it says can be redrawn without the page around it.
		 */
		sidebarFeedsSrc: string;
		/** What the reader last searched for, put back into the sidebar's box. */
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

export namespace SidebarFeeds {
	/** One followed feed as the sidebar lists it, with its count already in words. */
	export interface Feed {
		id: string;
		/**
		 * The mark the publisher puts on their own feed, or `null` for one that puts none,
		 * whose name is drawn in initials instead.
		 */
		imageUrl: string | null;
		title: string;
		/** How many posts are waiting, shown as the number itself beside the name. */
		unreadCount: number;
		/**
		 * That count said in full for a screen reader, or `null` for a feed with nothing
		 * waiting — which is a row that carries no count at all.
		 */
		unreadLabel: string | null;
	}

	/** A band of the rail that is a heading and the feeds under it, and leads nowhere. */
	export interface Group {
		/** The word heading the band. */
		label: string;
		feeds: Feed[];
		/** What the feeds beneath it add up to, which is the only place this number is from. */
		unreadCount: number;
		/** That sum said in full for a screen reader, or `null` for a band with nothing waiting. */
		unreadLabel: string | null;
	}

	/**
	 * One folder as the rail draws it: a heading that is itself the way into the folder's
	 * own stream, and the feeds filed there beneath it.
	 */
	export interface Folder {
		id: string;
		title: string;
		/** Where the folder's own stream is read, which its heading leads to. */
		href: string;
		feeds: Feed[];
		/** What the feeds beneath it add up to, which is the only place this number is from. */
		unreadCount: number;
		/** That sum said in full for a screen reader, or `null` for a folder with nothing waiting. */
		unreadLabel: string | null;
	}

	/**
	 * One kept query as the rail draws it: a name, and the queue's own address under the
	 * narrowing it holds. It carries no count, because a number beside each one is a scan
	 * per entry on every page of the app, paid by readers who are not searching.
	 */
	export interface Search {
		id: string;
		label: string;
		href: string;
	}

	export interface Props {
		/** The queries the reader kept, drawn as addresses of the queue itself. */
		searches: Search[];
		/** The word heading the kept queries. */
		searchesLabel: string;
		/** The feeds the reader has filed nowhere, drawn below the folders. */
		feeds: Feed[];
		/** The reader's folders, each drawn as a heading over the feeds filed in it. */
		folders: Folder[];
		/**
		 * The feeds the reader pinned, drawn first under a heading of their own. A pin is
		 * their own answer about a subscription, so it is drawn where they put it and no
		 * derived grouping moves it.
		 */
		pinned: Group | null;
		/**
		 * The feeds nobody grouped and that publish almost nothing, drawn last. It keeps a
		 * monthly newsletter from being buried by a feed that publishes hourly, and it is
		 * derived from the measured rate rather than from anything the reader was asked.
		 */
		quiet: Group | null;
		/** The word heading the band, which names the reader's own subscriptions. */
		label: string;
		/** Names the list of feeds under that heading, for anyone listening to it. */
		listLabel: string;
		/** The page being read, which is what lights the feed a reader is standing in. */
		currentPath: string;
	}
}

/**
 * One followed feed as a row of the rail, wherever it is drawn: under a folder's name or
 * under the heading that gathers the ones a reader has filed nowhere.
 *
 * A level down from the queue and quieter for it, so an eye running the sidebar still
 * tells the one place from the many feeds.
 */
function SidebarFeedRow(handle: Handle<{ feed: SidebarFeeds.Feed; isCurrent: boolean }>) {
	return () => {
		let { feed, isCurrent } = handle.props;

		return (
			<Sidebar.Item
				href={routes.feed.href({ feed: feed.id })}
				current={isCurrent}
				mix={[railRow("item"), text("xs"), fg("neutral.muted")]}
			>
				{/**
				 * The mark the publisher puts on their own feed, which is what an eye finds a
				 * known publication by before it reads the name. It is the picture the feed
				 * document itself named and already stored, so drawing it asks nobody who the
				 * reader follows.
				 *
				 * A publisher who named none, or whose picture has since gone, leaves the
				 * initials of the name — and the name itself is right beside it, so nothing is
				 * lost either way.
				 */}
				<Logo size="sm" mix={railMark()}>
					{feed.imageUrl ? (
						<Logo.Image
							src={feed.imageUrl}
							alt={feed.title}
							loading="lazy"
							referrerPolicy="no-referrer"
						/>
					) : null}
					<Logo.Fallback>{initials(feed.title)}</Logo.Fallback>
				</Logo>

				<span mix={[grow(), minIs(0), truncate()]}>{feed.title}</span>

				{/**
				 * The number alone beside the name, which is what a column of them is read by;
				 * the phrase it stands for is said in full for anyone listening rather than
				 * looking. A feed with nothing waiting carries neither.
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
		);
	};
}

/**
 * One band of the rail: a heading naming what it gathers, and the feeds under it.
 *
 * It leads nowhere, and nothing is lost by that — the whole of the list it names is the
 * rows directly beneath it — which leaves one thing in the sidebar lit at a time, the feed
 * being read rather than the feed and the word above it.
 */
function SidebarBand(
	handle: Handle<{
		group: SidebarFeeds.Group;
		icon: RemixNode;
		listLabel: string;
		currentPath: string;
	}>,
) {
	return () => {
		let { currentPath, group, icon, listLabel } = handle.props;

		return (
			<Sidebar.Group>
				<Sidebar.GroupLabel
					mix={[
						railRow("group-label"),
						when('&[data-slot="group-label"]', [
							pb("0.5rem"),
							minBs("2.25rem"),
							justify("start"),
							text("sm"),
							weight("medium"),
							fg("neutral"),
							raw({ textTransform: "none", letterSpacing: "normal" }),
						]),
					]}
				>
					{icon}
					<span mix={[minIs(0), truncate()]}>{group.label}</span>

					{/**
					 * What the feeds beneath it add up to, said as the number for an eye and in
					 * full for anyone listening, so an arriving post is visible without the band
					 * being read row by row.
					 */}
					{group.unreadLabel && (
						<>
							<span aria-hidden="true" mix={[shrink(), tabularNums()]}>
								{group.unreadCount}
							</span>
							<span mix={[visuallyHidden()]}>{group.unreadLabel}</span>
						</>
					)}
				</Sidebar.GroupLabel>

				<Sidebar.Nav aria-label={listLabel}>
					{group.feeds.map((feed) => (
						<SidebarFeedRow
							key={feed.id}
							feed={feed}
							isCurrent={currentPath === routes.feed.href({ feed: feed.id })}
						/>
					))}
				</Sidebar.Nav>
			</Sidebar.Group>
		);
	};
}

/**
 * The feeds a reader follows, as the sidebar lists them. It is rendered into the sidebar's
 * own frame rather than by the layout around it, so the counts beside these names can be
 * redrawn on their own when a post is marked read further down the page.
 */
export function SidebarFeeds(handle: Handle<SidebarFeeds.Props>) {
	return () => {
		let { currentPath, feeds, folders, label, listLabel, pinned, quiet, searches, searchesLabel } =
			handle.props;

		/** Read from the path the band was asked for, since it is drawn apart from the page. */
		function isCurrent(href: string): boolean {
			return currentPath === href;
		}

		/** A reader following nothing is shown no heading for it, and no empty list under one. */
		if (
			feeds.length === 0 &&
			folders.length === 0 &&
			pinned === null &&
			quiet === null &&
			searches.length === 0
		) {
			return null;
		}

		return (
			<>
				{/**
				 * The queries the reader kept, above their feeds: each one is an address of the
				 * queue under a narrowing they wrote, so it belongs beside the queue rather than
				 * among the publications it reads from.
				 */}
				{searches.length > 0 && (
					<Sidebar.Group>
						<Sidebar.GroupLabel
							mix={[
								railRow("group-label"),
								when('&[data-slot="group-label"]', [
									pb("0.5rem"),
									minBs("2.25rem"),
									justify("start"),
									text("sm"),
									weight("medium"),
									fg("neutral"),
									raw({ textTransform: "none", letterSpacing: "normal" }),
								]),
							]}
						>
							<SearchIcon size={ICON_SIZE} />
							<span mix={[minIs(0), truncate()]}>{searchesLabel}</span>
						</Sidebar.GroupLabel>

						<Sidebar.Nav aria-label={searchesLabel}>
							{searches.map((search) => (
								<Sidebar.Item
									key={search.id}
									href={search.href}
									current={isCurrent(search.href)}
									mix={[railRow("item"), text("xs"), fg("neutral.muted")]}
								>
									<span mix={[grow(), minIs(0), truncate()]}>{search.label}</span>
								</Sidebar.Item>
							))}
						</Sidebar.Nav>
					</Sidebar.Group>
				)}

				{/**
				 * What the reader said they never want to miss, first, because that is what
				 * saying it was for.
				 */}
				{pinned && (
					<SidebarBand
						group={pinned}
						icon={<PinIcon size={ICON_SIZE} />}
						listLabel={pinned.label}
						currentPath={currentPath}
					/>
				)}

				{folders.map((folder) => (
					<Sidebar.Group key={folder.id}>
						{/**
						 * The folder's name, and the way into reading it as one stream. It is a
						 * row rather than a plain heading because a folder is somewhere a reader
						 * goes, and it wears the weight the Feeds heading below wears so the two
						 * read as the peers they are.
						 */}
						<Sidebar.Item
							href={folder.href}
							current={isCurrent(folder.href)}
							mix={[railRow("item"), text("sm"), weight("medium"), fg("neutral")]}
						>
							<FolderIcon size={ICON_SIZE} />

							<span mix={[grow(), minIs(0), truncate()]}>{folder.title}</span>

							{/**
							 * What the feeds beneath it add up to, said as the number for an eye and
							 * in full for anyone listening. It is the sum of the rows under it and
							 * nothing else, so a heading can never disagree with them.
							 */}
							{folder.unreadLabel && (
								<>
									<span aria-hidden="true" mix={[shrink(), tabularNums()]}>
										{folder.unreadCount}
									</span>
									<span mix={[visuallyHidden()]}>{folder.unreadLabel}</span>
								</>
							)}
						</Sidebar.Item>

						<Sidebar.Nav aria-label={folder.title}>
							{folder.feeds.map((feed) => (
								<SidebarFeedRow
									key={feed.id}
									feed={feed}
									isCurrent={isCurrent(routes.feed.href({ feed: feed.id }))}
								/>
							))}
						</Sidebar.Nav>
					</Sidebar.Group>
				))}

				{feeds.length > 0 && (
					<Sidebar.Group>
						{/**
						 * The reader's own subscriptions, headed by the word naming them. It is
						 * drawn as a peer of the queue above — the same mark, the same column, the
						 * same casing as its own word — rather than as a category divider, because
						 * that is what it is: the other thing this sidebar holds.
						 *
						 * It leads nowhere, and nothing is lost by that: the whole of the list it
						 * names is the rows directly beneath it, on every page. That leaves one
						 * thing in the sidebar lit at a time, which is the feed being read rather
						 * than the feed and the word above it.
						 */}
						<Sidebar.GroupLabel
							mix={[
								railRow("group-label"),
								when('&[data-slot="group-label"]', [
									pb("0.5rem"),
									minBs("2.25rem"),
									justify("start"),
									text("sm"),
									weight("medium"),
									fg("neutral"),
									raw({ textTransform: "none", letterSpacing: "normal" }),
								]),
							]}
						>
							{/** The mark a site puts on its own feed, which is what these rows are. */}
							<RssIcon size={ICON_SIZE} />
							<span mix={[minIs(0), truncate()]}>{label}</span>
						</Sidebar.GroupLabel>

						<Sidebar.Nav aria-label={listLabel}>
							{feeds.map((feed) => (
								<SidebarFeedRow
									key={feed.id}
									feed={feed}
									isCurrent={isCurrent(routes.feed.href({ feed: feed.id }))}
								/>
							))}
						</Sidebar.Nav>
					</Sidebar.Group>
				)}

				{/**
				 * Last, holding the feeds nobody grouped and nothing published. No post moves
				 * with them: this is a way of drawing the rail, and a quiet feed's posts sit in
				 * the queue where their date puts them.
				 */}
				{quiet && (
					<SidebarBand
						group={quiet}
						icon={<MoonIcon size={ICON_SIZE} />}
						listLabel={quiet.label}
						currentPath={currentPath}
					/>
				)}
			</>
		);
	};
}

/** Renders the sidebar, the header and the page around a signed-in page's content. */
export default function AppLayout(handle: Handle<AppLayout.Props>) {
	return () => {
		let {
			actions,
			children,
			currentPath,
			documentTitle,
			heading,
			headingLink,
			locale,
			nav,
			searchQuery,
			sidebarFeedsSrc,
			viewer,
		} = handle.props;

		/**
		 * One thing in the chrome is the place being read, and it is whichever link leads
		 * exactly where the reader already is. A feed's own page is that feed's row rather
		 * than the queue above it, which is what a reader following the sidebar down expects
		 * of the row they just clicked.
		 */
		function isCurrent(href: string): boolean {
			return currentPath === href;
		}

		return (
			<DocumentLayout title={documentTitle} locale={locale}>
				{/**
				 * Two columns from the width the rail earns, and one below it, where the sidebar
				 * has left the flow to wait behind its own trigger. The page's own pane is told
				 * it may be narrower than its contents, which is what keeps a long word or a wide
				 * row inside it rather than pushing the whole grid sideways.
				 */}
				<div
					mix={[media(SIDEBAR_RAIL, [grid(), raw({ gridTemplateColumns: `${RAIL_WIDTH} 1fr` })])]}
				>
					{/**
					 * The three bands, in the two shapes they take. Below the rail's width they are a
					 * drawer the browser opens over the page and dismisses on its own, which is what
					 * lets a page shipping almost no script carry one. From that width up the same
					 * element is the rail beside the page, holding its place as the page scrolls.
					 *
					 * The popover's own display, inset, margin and size all come from the browser's
					 * stylesheet, so each one is named back here for whichever shape is in play.
					 */}
					<aside
						id={SIDEBAR_ID}
						popover="auto"
						mix={[
							hidden(),
							flexCol(),
							fixed(),
							insBs(0),
							insBe(0),
							insIs(0),
							insIe("auto"),
							z(30),
							m(0),
							p(0),
							is(DRAWER_WIDTH),
							maxIs("none"),
							bs("full"),
							maxBs("none"),
							boxSizing("border-box"),
							/** The bands hold the edges; the slack between them is the middle one's to scroll. */
							overflow("hidden"),
							border("none"),
							borderEdge("inline-end", { color: "neutral.border", width: 1 }),
							bg("neutral.tint"),
							shadow("lg"),
							safeAreaPadding("left"),
							when("&::backdrop", bg("rgba(0, 0, 0, 0.4)")),
							when("&:popover-open", raw({ display: "flex !important" })),
							media(SIDEBAR_RAIL, [
								/**
								 * Beating the rule above rather than the browser's: a reader who opened the
								 * drawer and then widened their window leaves that more specific rule
								 * matching, and the rail is what this width draws either way.
								 */
								raw({ display: "flex !important" }),
								sticky(),
								insBs(0),
								insBe("auto"),
								insIs("auto"),
								self("start"),
								is("auto"),
								bs("100dvh"),
								translucent(),
								shadow("none"),
							]),
						]}
					>
						{/**
						 * Searching starts where the reader's eye already is, so the sidebar opens with
						 * the box rather than with a link to a page holding one. One field and no
						 * submit: a form with a single text input is sent by the return key, which is
						 * the whole of the interaction.
						 *
						 * The band holds its height whatever the middle one is carrying, so a reader
						 * following a hundred feeds reaches the box without scrolling to it.
						 */}
						<Sidebar.Header
							mix={[bs(BAND_HEIGHT), pb(BAND_PADDING), pi(3), items("center"), bandRule()]}
						>
							<form method="get" action={routes.reading.index.href()} mix={[flex(), is("full")]}>
								<label htmlFor={SIDEBAR_SEARCH_FIELD_ID} mix={[visuallyHidden()]}>
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
									data-rmx-key={`${SIDEBAR_SEARCH_FIELD_ID}:${currentPath}?${searchQuery}`}
									id={SIDEBAR_SEARCH_FIELD_ID}
									type="search"
									name={SEARCH_PARAM}
									placeholder={nav.searchPlaceholder}
									defaultValue={searchQuery}
									autoComplete="off"
									mix={[
										is("full"),
										minIs(0),
										bs(BAND_FIELD_HEIGHT),
										boxSizing("border-box"),
										p(0, 3),
										rounded("lg"),
										border({ color: "neutral.border", width: 1 }),
										bg("neutral.bg"),
										fg("neutral.emphasis"),
										raw({ font: "inherit", fontSize: "0.875rem" }),
									]}
								/>
							</form>
						</Sidebar.Header>

						{/**
						 * The band that grows: the queue, then every feed the reader follows under the
						 * heading naming them. It scrolls on its own once those outrun the sidebar, so a
						 * long subscription list runs past the bottom of this rather than pushing the
						 * menu below it off the screen.
						 */}
						<Sidebar.Content>
							<Sidebar.Nav aria-label={nav.label}>
								<Sidebar.Item
									href={routes.reading.index.href()}
									current={isCurrent(routes.reading.index.href())}
									mix={railRow("item")}
								>
									{/** Everything every followed feed has published, waiting to be worked through. */}
									<InboxIcon size={ICON_SIZE} />
									<span mix={[minIs(0), truncate()]}>{nav.reading}</span>
								</Sidebar.Item>

								{/**
								 * Under the queue, since a post reaches this list from that one: it is the same
								 * posts, kept rather than worked through, and the one list here nothing prunes.
								 */}
								{nav.saved && (
									<Sidebar.Item
										href={routes.saved.href()}
										current={isCurrent(routes.saved.href())}
										mix={railRow("item")}
									>
										{/** The mark a row is kept with, worn by the list of everything kept. */}
										<BookmarkIcon size={ICON_SIZE} />
										<span mix={[minIs(0), truncate()]}>{nav.saved}</span>
									</Sidebar.Item>
								)}
							</Sidebar.Nav>

							{/**
							 * The feeds themselves, drawn by the server into this band and redrawn into it
							 * alone. What they say changes as the reader reads — a post opened here moves a
							 * count in the sidebar — and the page they read it on is several fetched pages
							 * long by then, so the band is refetched by name rather than the document that
							 * holds it. Without script it arrives with the page like any other markup.
							 */}
							<Frame name={SIDEBAR_FEEDS_FRAME} src={sidebarFeedsSrc} />
						</Sidebar.Content>

						{/**
						 * The viewer, with what belongs to their account behind their own face: the
						 * preferences and the way out, which are about who is signed in rather than
						 * about where to read. The band holds its height, so the menu is where it was
						 * however far down their feeds a reader has scrolled.
						 */}
						<Sidebar.Footer mix={[p(3)]}>
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
									is("full"),
									p(2),
									pi(3),
									border("none"),
									rounded("lg"),
									bg("transparent"),
									fg("inherit"),
									raw({ font: "inherit" }),
									cursor("pointer"),
									hover(bg("neutral.bg-tint-hover")),
								]}
							>
								<Avatar size="sm">
									{viewer.avatar ? <Avatar.Image src={viewer.avatar} alt="" /> : null}
									<Avatar.Fallback>{initials(viewer.name)}</Avatar.Fallback>
								</Avatar>

								<span
									mix={[
										grow(),
										basis("0%"),
										minIs(0),
										truncate(),
										text("sm"),
										weight("medium"),
										fg("neutral.emphasis"),
										raw({ textAlign: "start" }),
									]}
								>
									{viewer.name}
								</span>

								<ChevronsUpDownIcon size={ICON_SIZE} mix={[shrink()]} />
							</button>

							{/**
							 * Opening upward from a trigger that sits at the foot of the sidebar in either
							 * shape, so the menu lands over the page rather than off the bottom of it.
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
								 * The preferences live here rather than in the sidebar's navigation because
								 * they are about the account rather than about somewhere to read. The reader
								 * standing on that page is told so by the row itself, which is the one place
								 * in the chrome that can say it.
								 */}
								<Menu.Item
									href={routes.settings.href()}
									aria-current={isCurrent(routes.settings.href()) ? "page" : undefined}
								>
									<SettingsIcon size={ICON_SIZE} />
									{nav.settings}
								</Menu.Item>

								<Menu.Item href={routes.logout.index.href()}>
									<LogOutIcon size={ICON_SIZE} />
									{nav.logout}
								</Menu.Item>
							</Menu>
						</Sidebar.Footer>
					</aside>

					<div mix={[minIs(0)]}>
						{/**
						 * The band spans the page's pane so its rule does, and the row inside it keeps
						 * the same gutter the content below does, so the two sit on one vertical line.
						 */}
						<header mix={[sticky(), insBs(0), z(10), translucent(), bg("neutral.tint")]}>
							{/**
							 * One row wherever the width allows one, and its least height is what every
							 * page draws, so the page below starts on the same line from surface to
							 * surface. On a screen too narrow for the row, the actions wrap beneath the
							 * page's name rather than running off the side of it.
							 */}
							<div
								mix={[
									pi(PAGE_GUTTER),
									pb(BAND_PADDING),
									minBs(BAND_HEIGHT),
									boxSizing("border-box"),
									/**
									 * The rule rides on the row rather than on the band around it, so both
									 * halves of the app's top band measure the same thing: the height the
									 * band is set to, with the rule counted inside it.
									 */
									bandRule(),
									flex(),
									flexWrap("wrap"),
									items("center"),
									gap(3),
									media(WIDE_HEADER, gap(4)),
								]}
							>
								{/**
								 * The way to the sidebar on a screen that keeps it behind one, sitting before
								 * the page's name the way the sidebar itself sits before the page.
								 */}
								<button
									type="button"
									commandfor={SIDEBAR_ID}
									command="toggle-popover"
									aria-label={nav.openSidebar}
									title={nav.openSidebar}
									mix={[
										inlineFlex(),
										items("center"),
										justify("center"),
										shrink(),
										p(2),
										border("none"),
										rounded("md"),
										bg("transparent"),
										fg("neutral.muted"),
										cursor("pointer"),
										hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
										media(SIDEBAR_RAIL, hidden()),
									]}
								>
									<PanelLeftIcon size={ICON_SIZE} />
								</button>

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

								{actions && (
									/**
									 * Allowed to be narrower than the controls it holds, so a row too small
									 * for them wraps them onto a line of their own rather than running them
									 * off the side of the page.
									 */
									<div
										mix={[
											flex(),
											items("center"),
											flexWrap("wrap"),
											justify("end"),
											gap(2),
											minIs(0),
										]}
									>
										{actions}
									</div>
								)}
							</div>
						</header>

						{/** The page's own content, filling the pane the sidebar leaves it. */}
						<main mix={[vstack({ gap: 6 }), p(PAGE_GUTTER)]}>{children}</main>
					</div>
				</div>
			</DocumentLayout>
		);
	};
}
