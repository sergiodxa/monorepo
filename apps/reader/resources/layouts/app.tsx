/**
 * The chrome every signed-in page wears: the app shell whose sidebar a reader navigates their
 * feeds from, the top bar they search from, and the page header carrying the page's own name
 * and whatever acts on it. It exists so each page describes only what it shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import {
	BookmarkIcon,
	LifeBuoyIcon,
	FolderIcon,
	InboxIcon,
	LogOutIcon,
	RssIcon,
	SearchIcon,
	SettingsIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { hidden, inline } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { textDecoration, weight } from "@sdxc/u/typography";
import { Avatar, Logo, Menu, SearchField } from "@sdxc/ui";
import { AppShell } from "@sdxc/ui/app/app-shell";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { Frame } from "remix/component";

import type { Shortcuts } from "~/resources/components/shortcuts";

import ShortcutsIsland from "~/resources/components/shortcuts";
import { SIDEBAR_FEEDS_FRAME } from "~/resources/components/sidebar-frame";
import DocumentLayout from "~/resources/layouts/document";
import OutboundMark from "~/resources/views/outbound-mark";
import routes from "~/routes/web";

export {
	BAND_FIELD_HEIGHT,
	listBleed,
	listRowGutter,
	PAGE_COLUMN,
	pageNote,
} from "~/resources/layouts/app-page";

/**
 * The `id` the shell is drawn under. The sidebar takes `${id}-sidebar`, which is the
 * {@link SIDEBAR_ID} the keys that walk the rail's links look it up by.
 */
const SHELL_ID = "app";

/** The `id` the sidebar answers to, which the keys that walk its feeds look it up by. */
export const SIDEBAR_ID = `${SHELL_ID}-sidebar`;

/** Names the search field the `/` key puts the caret in from anywhere on the page. */
export const SIDEBAR_SEARCH_FIELD_ID = "app-search";

/**
 * The parameter a search travels in, which the top bar's box submits under and the reading
 * queue reads its query back out of. It is named here, where the box that sends it lives,
 * so one search has one name.
 */
export const SEARCH_PARAM = "q";

/** The `id` the viewer's own menu answers to, which its trigger names in `commandfor`. */
const USER_MENU_ID = "user-menu";

/** Edge of the glyphs the chrome is drawn with, which is the size a nav row's icon slot holds. */
const ICON_SIZE = 16;

/** Where an action has the width to say in words what its mark says. */
const WIDE_HEADER = "(min-width: 45rem)";

/**
 * The letters something with no picture is drawn with: the first of its first word and the
 * first of its last, which tells one name from another at the size a mark is read at.
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
		 * Names the list of posts the reader asked to keep, or `null` where keeping is turned
		 * off, which takes the row out of the sidebar.
		 */
		saved: string | null;
		/** Names the top bar's search box, which carries no visible label of its own. */
		searchLabel: string;
		/** What the empty search box says it is for. */
		searchPlaceholder: string;
		/** Names the control a narrow screen opens the sidebar from. */
		openSidebar: string;
		/** Names the control the open sidebar sheet closes from. */
		closeSidebar: string;
		/** The skip link's text. */
		skip: string;
		/** Names the switch that draws the sidebar as a rail of icons. */
		collapse: string;
		settings: string;
		help: string;
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
		/** What the document links, which a page passes on from `ctx.assets`. */
		assets: DocumentAssets;
		/** Text for the `<title>` element. */
		documentTitle: string;
		/** The page's own name, which the header carries. */
		heading: string;
		/** Where that name leads, for a page whose subject has a home of its own. */
		headingLink?: HeadingLink;
		/** One line under the heading, saying what the page holds. */
		description?: RemixNode;
		/** The page this one sits under, linked above the heading. */
		parent?: PageHeader.Parent;
		/** A badge after the heading, such as a feed whose last checks failed. */
		status?: RemixNode;
		/** Views of the page, each one a URL, drawn as tabs under the heading. */
		tabs?: PageHeader.Tab[];
		/** Names the tabs for anyone listening. */
		tabsLabel?: string;
		/** The one action the page is for, drawn last in the header. */
		primaryAction?: RemixNode;
		/**
		 * Controls acting on what the header names, laid out in a row at the end of its line.
		 * Each one says in a mark what it says in words on a screen with the room for both.
		 */
		actions?: RemixNode;
		/**
		 * The path being read, which marks the one thing in the chrome the reader is standing
		 * on. A path naming none of them lights none of them.
		 */
		currentPath: string;
		/** The request's detected language, set as `<html lang>`. */
		locale?: string;
		nav: Nav;
		/**
		 * What the keyboard panel prints, which reaches the browser as a serialized prop: the
		 * island renders nothing on the server, so it has no dictionary of its own to read.
		 */
		shortcuts: Shortcuts.Copy;
		viewer: Viewer;
		/** Draws the sidebar as a rail of icons, as the reader last left it. */
		collapsed: boolean;
		/**
		 * Whether the page header is drawn. A page that sets its own `h1` in its content,
		 * as an article does in its reading column, turns it off.
		 * @default true
		 */
		header?: boolean;
		/**
		 * Where the sidebar's feeds are fetched from. The band is drawn by the server on its
		 * own, into a frame, so its counts can be redrawn without the page around it.
		 */
		sidebarFeedsSrc: string;
		/** What the reader last searched for, put back into the search box. */
		searchQuery: string;
		children: RemixNode;
	}
}

/**
 * The words beside an action's mark, carried wherever the header has the width for both. On
 * a narrower screen the mark stands alone, and the name the control holds is what a screen
 * reader announces.
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
		/** How many posts are waiting. */
		unreadCount: number;
		/** That count said in full for a screen reader, or `null` for a feed with nothing waiting. */
		unreadLabel: string | null;
	}

	/** A band of the rail that is a heading and the feeds under it, and leads nowhere. */
	export interface Group {
		label: string;
		feeds: Feed[];
		/** What the feeds beneath it add up to. */
		unreadCount: number;
		/** That sum said in full for a screen reader, or `null` for a band with nothing waiting. */
		unreadLabel: string | null;
	}

	/**
	 * One folder as the rail draws it: a row that is itself the way into the folder's own
	 * stream, and the feeds filed there beneath it.
	 */
	export interface Folder {
		id: string;
		title: string;
		href: string;
		feeds: Feed[];
		/** What the feeds beneath it add up to, which is the only place this number is from. */
		unreadCount: number;
		/** That sum said in full for a screen reader, or `null` for a folder with nothing waiting. */
		unreadLabel: string | null;
	}

	/**
	 * One kept query as the rail draws it: a name, and the queue's own address under the
	 * narrowing it holds. It carries no count, which would cost a scan per entry on every page.
	 */
	export interface Search {
		id: string;
		label: string;
		href: string;
	}

	export interface Props {
		searches: Search[];
		searchesLabel: string;
		/** The feeds the reader has filed nowhere, drawn below the folders. */
		feeds: Feed[];
		folders: Folder[];
		/** Names the band of folders. */
		foldersLabel: string;
		/**
		 * The feeds the reader pinned, drawn first under a heading of their own. A pin is their
		 * own answer about a subscription, so no derived grouping moves it.
		 */
		pinned: Group | null;
		/**
		 * The feeds nobody grouped and that publish almost nothing, drawn last, so a monthly
		 * newsletter is never buried by a feed that publishes hourly.
		 */
		quiet: Group | null;
		/** The word heading the reader's own subscriptions. */
		label: string;
		/** Names the list of feeds under that heading, for anyone listening to it. */
		listLabel: string;
		/** The page being read, which is what lights the feed a reader is standing in. */
		currentPath: string;
	}
}

/**
 * A feed's mark sized to the nav row's icon slot, drawn at full strength: it is the
 * publisher's own picture, which an eye finds a known publication by before reading the name.
 */
function feedIcon(feed: SidebarFeeds.Feed) {
	return (
		<Logo
			size="sm"
			mix={[
				raw({ inlineSize: "1rem", blockSize: "1rem", fontSize: "0.4375rem" }),
				when('&[data-slot="image-placeholder"]', raw({ fontSize: "0.4375rem" })),
			]}
		>
			{feed.imageUrl ? (
				<Logo.Image src={feed.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
			) : null}
			<Logo.Fallback>{initials(feed.title)}</Logo.Fallback>
		</Logo>
	);
}

/** Restores a publisher's mark to full strength inside the row's otherwise muted icon slot. */
function fullStrengthIcon() {
	return when('& > [data-slot="app-shell-icon"]', raw({ opacity: "1" }));
}

/**
 * One followed feed as a row of the rail, wherever it is drawn, with the count of posts waiting
 * beside its name. The count alone carries the news, so a rail of busy feeds stays quiet.
 */
function SidebarFeedRow(
	handle: Handle<{ feed: SidebarFeeds.Feed; isCurrent: boolean; nested?: boolean }>,
) {
	return () => {
		let { feed, isCurrent, nested = false } = handle.props;

		return (
			<AppShell.Item
				href={routes.feed.href({ feed: feed.id })}
				label={feed.title}
				icon={feedIcon(feed)}
				count={feed.unreadCount}
				countLabel={feed.unreadLabel ?? undefined}
				current={isCurrent}
				mix={[fullStrengthIcon(), nested ? raw({ paddingInlineStart: "1.75rem" }) : null]}
			/>
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
		let {
			currentPath,
			feeds,
			folders,
			foldersLabel,
			label,
			pinned,
			quiet,
			searches,
			searchesLabel,
		} = handle.props;

		/** Read from the path the band was asked for, since it is drawn apart from the page. */
		function isCurrent(href: string): boolean {
			return currentPath === href;
		}

		/** A feed's row, lit when the page is that feed's own. */
		function row(feed: SidebarFeeds.Feed, nested = false) {
			return (
				<SidebarFeedRow
					key={feed.id}
					feed={feed}
					nested={nested}
					isCurrent={isCurrent(routes.feed.href({ feed: feed.id }))}
				/>
			);
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
				 * queue under a narrowing they wrote, so it belongs beside the queue.
				 */}
				{searches.length > 0 && (
					<AppShell.Group title={searchesLabel}>
						{searches.map((search) => (
							<AppShell.Item
								key={search.id}
								href={search.href}
								label={search.label}
								icon={<SearchIcon size={ICON_SIZE} />}
								current={isCurrent(search.href)}
							/>
						))}
					</AppShell.Group>
				)}

				{/** What the reader said they never want to miss, first, because that is what saying it was for. */}
				{pinned && (
					<AppShell.Group title={pinned.label}>
						{pinned.feeds.map((feed) => row(feed))}
					</AppShell.Group>
				)}

				{/**
				 * Each folder is a row that leads to its own stream, with the feeds filed there
				 * indented beneath it, so the rail keeps its two levels and no more.
				 */}
				{folders.length > 0 && (
					<AppShell.Group title={foldersLabel}>
						{folders.flatMap((folder) => [
							<AppShell.Item
								key={folder.id}
								href={folder.href}
								label={folder.title}
								icon={<FolderIcon size={ICON_SIZE} />}
								count={folder.unreadCount}
								countLabel={folder.unreadLabel ?? undefined}
								current={isCurrent(folder.href)}
								mix={[weight("medium")]}
							/>,
							...folder.feeds.map((feed) => row(feed, true)),
						])}
					</AppShell.Group>
				)}

				{feeds.length > 0 && (
					<AppShell.Group title={label} aria-label={handle.props.listLabel}>
						{feeds.map((feed) => row(feed))}
					</AppShell.Group>
				)}

				{/**
				 * Last, holding the feeds nobody grouped and nothing published. No post moves with
				 * them: a quiet feed's posts sit in the queue where their date puts them.
				 */}
				{quiet && (
					<AppShell.Group title={quiet.label}>
						{quiet.feeds.map((feed) => row(feed))}
					</AppShell.Group>
				)}
			</>
		);
	};
}

/**
 * The app's name at the head of the sidebar, in the serif the product is set in, which a
 * rail keeps as the mark alone.
 */
function Brand(handle: Handle<{ label: string }>) {
	return () => (
		<a
			href={routes.reading.index.href()}
			mix={[
				raw({
					display: "flex",
					alignItems: "center",
					gap: "0.5rem",
					blockSize: "2rem",
					paddingInline: "0.375rem",
					fontFamily: "var(--ui-font-serif)",
					fontSize: "1.125rem",
					color: "var(--ui-neutral-fg-emphasis)",
					textDecoration: "none",
					whiteSpace: "nowrap",
				}),
			]}
		>
			<span
				aria-hidden="true"
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						flexShrink: "0",
						inlineSize: "1.5rem",
						blockSize: "1.5rem",
						borderRadius: "0.375rem",
						backgroundColor: "var(--ui-brand-bg-solid)",
						color: "var(--ui-brand-fg-on-solid)",
					}),
				]}
			>
				<RssIcon size={14} />
			</span>
			<span data-app-shell-label="">{handle.props.label}</span>
		</a>
	);
}

/** Renders the shell, the top bar and the page header around a signed-in page's content. */
export default function AppLayout(handle: Handle<AppLayout.Props>) {
	return () => {
		let {
			actions,
			assets,
			children,
			collapsed,
			currentPath,
			description,
			documentTitle,
			header = true,
			heading,
			headingLink,
			locale,
			nav,
			parent,
			primaryAction,
			searchQuery,
			shortcuts,
			status,
			sidebarFeedsSrc,
			tabs,
			tabsLabel,
			viewer,
		} = handle.props;

		/** One thing in the chrome is the place being read: the link leading exactly there. */
		function isCurrent(href: string): boolean {
			return currentPath === href;
		}

		let title = headingLink ? (
			/**
			 * The page's own name carries its subject off to the site behind it, so the obvious
			 * words are the ones worth clicking. It keeps the heading's colour.
			 */
			<a
				href={headingLink.href}
				target="_blank"
				rel="noopener noreferrer"
				title={headingLink.label}
				mix={[
					raw({ display: "inline-flex", alignItems: "center", gap: "0.5rem", minInlineSize: "0" }),
					raw({ color: "inherit" }),
					textDecoration("none"),
					when("&:hover", textDecoration("underline")),
				]}
			>
				<span>{heading}</span>
				<span mix={[visuallyHidden()]}>{headingLink.label}</span>
				<OutboundMark />
			</a>
		) : (
			heading
		);

		return (
			<DocumentLayout assets={assets} title={documentTitle} locale={locale}>
				<AppShell
					id={SHELL_ID}
					collapsed={collapsed}
					labels={{
						nav: nav.label,
						skip: nav.skip,
						menu: nav.openSidebar,
						close: nav.closeSidebar,
						collapse: nav.collapse,
					}}
					workspace={<Brand label="Reader" />}
					nav={
						<>
							<AppShell.Group>
								<AppShell.Item
									href={routes.reading.index.href()}
									label={nav.reading}
									icon={<InboxIcon size={ICON_SIZE} />}
									current={isCurrent(routes.reading.index.href())}
								/>
								{nav.saved && (
									<AppShell.Item
										href={routes.saved.href()}
										label={nav.saved}
										icon={<BookmarkIcon size={ICON_SIZE} />}
										current={isCurrent(routes.saved.href())}
									/>
								)}
							</AppShell.Group>

							{/**
							 * The feeds themselves, drawn by the server into this band and redrawn into it
							 * alone, since a post opened on the page moves a count here.
							 */}
							<div mix={[raw({ display: "contents" })]}>
								<Frame name={SIDEBAR_FEEDS_FRAME} src={sidebarFeedsSrc} />
							</div>
						</>
					}
					footer={
						<>
							<AppShell.Identity
								avatar={
									<Avatar size="sm">
										{viewer.avatar ? <Avatar.Image src={viewer.avatar} alt="" /> : null}
										<Avatar.Fallback>{initials(viewer.name)}</Avatar.Fallback>
									</Avatar>
								}
								name={viewer.name}
								detail={viewer.email}
								commandfor={USER_MENU_ID}
								command="toggle-popover"
								aria-label={nav.account}
							/>

							{/** Opening upward from the foot of the sidebar, so it lands over the page. */}
							<Menu id={USER_MENU_ID} placement="top-start" aria-label={nav.account}>
								<Menu.Item
									href={routes.settings.href()}
									aria-current={isCurrent(routes.settings.href()) ? "page" : undefined}
								>
									<SettingsIcon size={ICON_SIZE} />
									{nav.settings}
								</Menu.Item>
								<Menu.Item href={routes.docs.index.href()}>
									<LifeBuoyIcon size={ICON_SIZE} />
									{nav.help}
								</Menu.Item>
								<Menu.Separator />
								<Menu.Item href={routes.logout.index.href()}>
									<LogOutIcon size={ICON_SIZE} />
									{nav.logout}
								</Menu.Item>
							</Menu>
						</>
					}
					topbar={
						<>
							{/**
							 * Searching starts from the bar every page shares, so a reader can look for a
							 * post from wherever they are standing.
							 */}
							<form
								method="get"
								action={routes.reading.index.href()}
								mix={[raw({ flex: "1 1 auto", minInlineSize: "0", maxInlineSize: "28rem" })]}
							>
								<SearchField aria-label={nav.searchLabel}>
									<SearchField.Input
										/**
										 * Keyed by the page it was drawn for, so moving between pages replaces
										 * the field rather than patching it.
										 */
										data-rmx-key={`${SIDEBAR_SEARCH_FIELD_ID}:${currentPath}?${searchQuery}`}
										id={SIDEBAR_SEARCH_FIELD_ID}
										name={SEARCH_PARAM}
										placeholder={nav.searchPlaceholder}
										defaultValue={searchQuery}
										autoComplete="off"
										aria-keyshortcuts="/"
									/>
								</SearchField>
							</form>
							<span mix={[raw({ marginInlineStart: "auto" })]} />
							<ShortcutsIsland
								copy={shortcuts}
								searchFieldId={SIDEBAR_SEARCH_FIELD_ID}
								sidebarId={SIDEBAR_ID}
							/>
						</>
					}
				>
					<div mix={[raw({ display: "flex", flexDirection: "column", gap: "1.5rem" })]}>
						{header && (
							<PageHeader
								title={title}
								parent={parent}
								description={description}
								status={status}
								tabs={tabs}
								tabsLabel={tabsLabel}
								actions={actions}
								primaryAction={primaryAction}
							/>
						)}
						{children}
					</div>
				</AppShell>
			</DocumentLayout>
		);
	};
}
