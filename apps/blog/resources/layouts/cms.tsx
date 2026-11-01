/**
 * The CMS frame: the app shell's sidebar (the site, the CMS's screens grouped by task with the
 * moderation queues counted, the author at the foot), a top bar with the command palette and
 * keyboard help, and the one toast stack every screen's writes report through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import {
	BookAIcon,
	BookmarkIcon,
	ExternalLinkIcon,
	FileTextIcon,
	GraduationCapIcon,
	HashIcon,
	KeyboardIcon,
	LayoutDashboardIcon,
	LightbulbIcon,
	MessagesSquareIcon,
	PackageIcon,
	PlusIcon,
	SignpostIcon,
	StickyNoteIcon,
} from "@sdxc/icons";
import { grow, hstack, justify } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import { Avatar, Button, Menu } from "@sdxc/ui";
import { AppShell, readAppShellCookie } from "@sdxc/ui/app/app-shell";
import { CommandPalette } from "@sdxc/ui/app/command-palette";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import { Toasts } from "@sdxc/ui/app/toasts";
import { menuKeys } from "@sdxc/ui/mixins";
import { generateUUID } from "@sdxc/uuid/v4";
import { Auth } from "remix/middleware/auth";

import type { CMSToast } from "~/app/http/toast";

import { currentRequest } from "~/app/http/current-request";
import { getAuthUser } from "~/app/http/middleware/auth";
import { readCMSShell } from "~/app/http/middleware/cms-shell";
import { readToast } from "~/app/http/toast";
import { PROFILE } from "~/config/profile";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Shared types used by the CMS page layout.
 */
export namespace CMSLayout {
	/**
	 * Inputs for rendering a CMS page inside the shell.
	 */
	export interface Props {
		title: string;
		/** The screen's list address, which marks its sidebar row on that list and every page under it. */
		activePath?: string;
		children: RemixNode;
		/** The request's document assets, which the renderer hands every view. */
		assets: DocumentAssets;
		/** A toast this render reports itself, shown after the one the last write flashed. */
		toast?: CMSToast;
	}
}

/** One sidebar destination, which the command palette also lists. */
interface Destination {
	href: string;
	label: string;
	icon: RemixNode;
	/** The `g`+letter sequence that jumps here. */
	shortcut: string;
	/** Items waiting in this screen's queue, drawn as a count. */
	count?: number;
	countLabel?: string;
}

/** The command palette's dialog id, which the top bar's trigger names. */
const PALETTE_ID = "cms-palette";

/** The keyboard help sheet's dialog id, which the top bar's button names. */
const HELP_ID = "cms-keys";

/** Every string the shell shows or announces. */
const SHELL_LABELS: AppShell.Labels = {
	nav: "CMS",
	skip: "Skip to content",
	menu: "Open navigation",
	close: "Close navigation",
	collapse: "Collapse sidebar",
};

/** The writing screens, in the order the author reaches for them. */
const WRITE: Destination[] = [
	{
		href: routes.cms.articles.index.href(),
		label: "Articles",
		icon: <FileTextIcon />,
		shortcut: "g a",
	},
	{
		href: routes.cms.tutorials.index.href(),
		label: "Tutorials",
		icon: <GraduationCapIcon />,
		shortcut: "g t",
	},
	{
		href: routes.cms.notes.index.href(),
		label: "Notes",
		icon: <StickyNoteIcon />,
		shortcut: "g n",
	},
	{ href: routes.cms.tils.index.href(), label: "TILs", icon: <LightbulbIcon />, shortcut: "g l" },
];

/** What a "New …" command in the palette creates, beside the list it lands on. */
const CREATE = [
	{ href: routes.cms.articles.new.href(), label: "New article" },
	{ href: routes.cms.tutorials.new.href(), label: "New tutorial" },
	{ href: routes.cms.notes.new.href(), label: "New note" },
	{ href: routes.cms.tils.new.href(), label: "New TIL" },
	{ href: routes.cms.bookmarks.new.href(), label: "New bookmark" },
	{ href: routes.cms.glossary.new.href(), label: "New glossary term" },
	{ href: routes.cms.topics.new.href(), label: "New topic" },
	{ href: routes.cms.redirects.new.href(), label: "New redirect" },
] as const;

/**
 * The screens that keep the library and the site in order, with the two moderation queues
 * counted from `cms-shell`.
 */
function libraryAndSite(): { library: Destination[]; site: Destination[] } {
	let shell = readCMSShell();
	let flags = shell?.openBookmarkFlags ?? 0;
	let mentions = shell?.pendingWebmentions ?? 0;

	return {
		library: [
			{
				href: routes.cms.bookmarks.index.href(),
				label: "Bookmarks",
				icon: <BookmarkIcon />,
				shortcut: "g b",
				count: flags || undefined,
				countLabel: `${flags} to review`,
			},
			{
				href: routes.cms.glossary.index.href(),
				label: "Glossary",
				icon: <BookAIcon />,
				shortcut: "g y",
			},
			{
				href: routes.cms.releases.index.href(),
				label: "Releases",
				icon: <PackageIcon />,
				shortcut: "g e",
			},
			{
				href: routes.cms.topics.index.href(),
				label: "Topics",
				icon: <HashIcon />,
				shortcut: "g o",
			},
		],
		site: [
			{
				href: routes.cms.webmentions.index.href(),
				label: "Webmentions",
				icon: <MessagesSquareIcon />,
				shortcut: "g w",
				count: mentions || undefined,
				countLabel: `${mentions} waiting`,
			},
			{
				href: routes.cms.redirects.index.href(),
				label: "Redirects",
				icon: <SignpostIcon />,
				shortcut: "g r",
			},
		],
	};
}

/**
 * Wraps a CMS screen in the app shell. The sidebar's collapsed state comes from its cookie, so
 * the first paint is the width the author left it; the toast stack shows the flash the last
 * write left, then any toast the screen reports itself.
 *
 * @returns A renderer that wraps page content in the CMS shell.
 */
export function CMSLayout(handle: Handle<CMSLayout.Props>) {
	return () => {
		let { activePath, assets, children, title, toast } = handle.props;
		let context = currentRequest();
		let collapsed = readAppShellCookie(context?.request.headers.get("Cookie") ?? null);
		let user = context?.has(Auth) ? getAuthUser() : null;
		let dashboard: Destination = {
			href: routes.cms.dashboard.href(),
			label: "Dashboard",
			icon: <LayoutDashboardIcon />,
			shortcut: "g d",
		};
		let { library, site } = libraryAndSite();

		/** A row is current on its own list and on the forms under it. */
		let isCurrent = (href: string) =>
			activePath !== undefined &&
			(activePath === href || (href !== dashboard.href && activePath.startsWith(`${href}/`)));

		let items = (list: Destination[]) =>
			list.map((item) => (
				<AppShell.Item
					key={item.href}
					href={item.href}
					label={item.label}
					icon={item.icon}
					current={isCurrent(item.href)}
					count={item.count}
					countTone="brand"
					countLabel={item.count === undefined ? undefined : item.countLabel}
				/>
			));

		let toasts = [readToast(), toast]
			.filter((entry): entry is CMSToast => entry != null)
			.map((entry) => ({ id: generateUUID(), color: entry.color, title: entry.message }));

		return (
			<DocumentLayout assets={assets} title={`${title} · CMS`} bodyMix={[m(0), font("sans")]}>
				<AppShell
					id="cms-shell"
					labels={SHELL_LABELS}
					collapsed={collapsed}
					workspace={
						<AppShell.Identity
							avatar={
								<Avatar>
									<Avatar.Image src={routes.wellKnown.avatar.href()} alt="" />
									<Avatar.Fallback>SX</Avatar.Fallback>
								</Avatar>
							}
							name={new URL(PROFILE.canonical.origin).host}
							detail="CMS"
							chevron={false}
							disabled
						/>
					}
					nav={
						<>
							<AppShell.Group>{items([dashboard])}</AppShell.Group>
							<AppShell.Group title="Write">{items(WRITE)}</AppShell.Group>
							<AppShell.Group title="Library">{items(library)}</AppShell.Group>
							<AppShell.Group title="Site">{items(site)}</AppShell.Group>
						</>
					}
					footer={
						user === null ? undefined : (
							<>
								<AppShell.Identity
									avatar={
										<Avatar>
											<Avatar.Image src={user.avatar} alt="" />
											<Avatar.Fallback>{user.display_name.slice(0, 2)}</Avatar.Fallback>
										</Avatar>
									}
									name={user.display_name}
									detail={user.email}
									commandfor="cms-user-menu"
									command="toggle-popover"
									aria-label="Account"
								/>
								<Menu
									id="cms-user-menu"
									placement="top-start"
									aria-label="Account"
									mix={[menuKeys()]}
								>
									<Menu.Item href={routes.feed.href()}>View the site</Menu.Item>
									<Menu.Item href={routes.auth.logout.index.href()}>Sign out</Menu.Item>
								</Menu>
							</>
						)
					}
					topbar={
						<div mix={[hstack({ gap: 2 }), grow(), justify("end")]}>
							<CommandPalette.Trigger for={PALETTE_ID}>Search or jump to…</CommandPalette.Trigger>
							<Button
								variant="ghost"
								color="neutral"
								size="sm"
								commandfor={HELP_ID}
								command="show-modal"
								aria-label="Keyboard shortcuts"
							>
								<KeyboardIcon size={16} aria-hidden="true" />
							</Button>
						</div>
					}
				>
					{children}
					<Toasts labels={{ region: "Notifications", dismiss: "Dismiss" }} initial={toasts} />
					<CommandPalette
						id={PALETTE_ID}
						remember="blog-cms:palette"
						labels={{
							title: "Command palette",
							open: "Open command palette",
							placeholder: "Search screens and commands…",
							recent: "Recent",
							noResults: "No matches",
							noResultsHint: "Try a screen's name, such as Articles or Redirects.",
							results: "Results",
							back: "Back",
							close: "Close",
						}}
					>
						<CommandPalette.Group heading="Go to">
							{[dashboard, ...WRITE, ...library, ...site].map((item) => (
								<CommandPalette.Item
									key={item.href}
									id={`go:${item.href}`}
									title={item.label}
									href={item.href}
									icon={item.icon}
									shortcut={item.shortcut}
								/>
							))}
							<CommandPalette.Item
								id="go:site"
								title="View the site"
								href={routes.feed.href()}
								icon={<ExternalLinkIcon />}
							/>
						</CommandPalette.Group>
						<CommandPalette.Group heading="Create">
							{CREATE.map((item) => (
								<CommandPalette.Item
									key={item.href}
									id={`create:${item.href}`}
									title={item.label}
									href={item.href}
									icon={<PlusIcon />}
								/>
							))}
						</CommandPalette.Group>
					</CommandPalette>
					<KeyboardHelp
						id={HELP_ID}
						labels={{
							title: "Keyboard shortcuts",
							description: "Every key this screen answers.",
							close: "Close",
							or: "or",
							open: "Show keyboard shortcuts",
							general: "General",
							other: "Other",
						}}
					/>
				</AppShell>
			</DocumentLayout>
		);
	};
}
