/**
 * Inkwell's frame: the app shell with Lantern Review's masthead, a nav grouped by task with
 * the drafts and scheduled queues as saved views, and the pieces every screen shares (its
 * addresses, the ink-drop mark and an author's initials).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	CalendarClockIcon,
	FilesIcon,
	FileTextIcon,
	HouseIcon,
	ImageIcon,
	PenLineIcon,
	SettingsIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text, truncate, weight } from "@sdxc/u/typography";
import { AppShell } from "@sdxc/ui/app/app-shell";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";

import type { Author } from "~/resources/views/demo-apps/inkwell/data";

import {
	demoAppActionHref,
	demoAppFrameHref,
	demoAppHref,
	demoAppCookiePath,
} from "~/resources/views/demo-apps";
import { UserMenu, WorkspaceMenu } from "~/resources/views/demo-apps/account-menus";
import { AUTHORS, POSTS, PUBLICATION } from "~/resources/views/demo-apps/inkwell/data";
import { MainFrameSync } from "~/resources/views/demo-apps/main-frame-sync";

/** The demo's folder name, which every address and island id under it starts from. */
export const SLUG = "inkwell";

/** The address of one of Inkwell's screens, by its path under the app. */
export const href = demoAppHref(SLUG);

/** The address a form on one of Inkwell's screens posts to. */
export const action = demoAppActionHref(SLUG);

/** The address of one of Inkwell's frames, by its part path and the screen state it reads. */
export const frameHref = demoAppFrameHref(SLUG);

/** The keyboard help sheet's id, which the user menu's shortcuts item opens. */
const HELP_ID = "inkwell-keys";

/** The keyboard help sheet's strings. */
const HELP_LABELS: KeyboardHelp.Labels = {
	title: "Keyboard shortcuts",
	close: "Close",
	or: "or",
	open: "Show keyboard shortcuts",
	general: "General",
	other: "More",
};

/** The keys the editor and lists answer, beside the ones a page declares with `data-shortcut`. */
const HELP_GROUPS: KeyboardHelp.Group[] = [
	{
		title: "Editor",
		shortcuts: [{ keys: "mod+s", label: "Save post" }],
	},
	{ title: "General", shortcuts: [{ keys: "?", label: "Show keyboard shortcuts" }] },
];

/** The nav row a screen marks current; `null` for a screen outside the nav, such as the 404. */
export type NavKey = "home" | "posts" | "drafts" | "scheduled" | "pages" | "media" | "settings";

/** One screen inside the shell: its document title, the nav row it marks and the top bar's place. */
export interface ShellScreen {
	title: string;
	current: NavKey | null;
	place: string;
	body: RemixNode;
	/** `404` for the not-found screen, `400` for a form answered with its issues. */
	status?: number;
	/**
	 * The address the screen settles on when a form answers it from another one, such as a
	 * quick edit answered on its list; the request's own address otherwise.
	 */
	url?: URL;
}

/** Every string the shell shows or announces. */
const SHELL_LABELS: AppShell.Labels = {
	nav: "Inkwell",
	skip: "Skip to content",
	menu: "Open navigation",
	close: "Close navigation",
	collapse: "Collapse sidebar",
};

/**
 * The Inkwell mark: an ink drop over a nib's slit, in the brand ink.
 *
 * @param size The square's side in pixels.
 * @returns The mark's SVG.
 */
export function mark(size = 22) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
			<path
				d="M12 2.5c3.6 4.6 6.5 8.3 6.5 11.6A6.5 6.5 0 0 1 5.5 14.1C5.5 10.8 8.4 7.1 12 2.5Z"
				fill="var(--ui-color-brand-600)"
			/>
			<path
				d="M12 11.5v6.5"
				stroke="var(--ui-color-brand-50)"
				stroke-width="1.6"
				stroke-linecap="round"
			/>
			<circle cx="12" cy="11" r="1.4" fill="var(--ui-color-brand-50)" />
		</svg>
	);
}

/** Props accepted by {@link Initials}. */
interface InitialsProps {
	author: Pick<Author, "initials" | "name">;
	/** `"sm"` for table rows and timelines, `"md"` for the masthead. */
	size?: "sm" | "md";
}

/**
 * An author's initials on a round paper chip, standing in for a portrait; it is decorative,
 * since the author's name always sits beside it.
 */
export function Initials(handle: Handle<InitialsProps>) {
	return () => {
		let { author, size = "sm" } = handle.props;
		let side = size === "sm" ? "1.5rem" : "1.75rem";
		return (
			<span
				aria-hidden="true"
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: "0",
						inlineSize: side,
						blockSize: side,
						borderRadius: "9999px",
						fontSize: size === "sm" ? "0.625rem" : "0.6875rem",
						letterSpacing: "0.02em",
						backgroundColor: "var(--ui-brand-bg-tint)",
						color: "var(--ui-brand-fg)",
						boxShadow: "inset 0 0 0 1px var(--ui-brand-border)",
					}),
					weight("semibold"),
				]}
			>
				{author.initials}
			</span>
		);
	};
}

/** Props accepted by {@link Byline}. */
interface BylineProps {
	author: Pick<Author, "initials" | "name">;
}

/** An author as a row shows them: initials, then the name, truncated when the column is narrow. */
export function Byline(handle: Handle<BylineProps>) {
	return () => (
		<span mix={[hstack({ gap: 2, align: "center" }), raw({ minInlineSize: "0" })]}>
			<Initials author={handle.props.author} />
			<span mix={[truncate()]}>{handle.props.author.name}</span>
		</span>
	);
}

/** Props accepted by {@link SerifTitle}. */
interface SerifTitleProps {
	children: RemixNode;
}

/** A screen title set in the publication's serif, so headers read as a masthead. */
export function SerifTitle(handle: Handle<SerifTitleProps>) {
	return () => (
		<span mix={[font("serif"), raw({ fontWeight: "600", letterSpacing: "-0.01em" })]}>
			{handle.props.children}
		</span>
	);
}

/** Props accepted by {@link InkwellShell}. */
interface InkwellShellProps {
	/** The nav row to mark current. */
	current: NavKey | null;
	/** Whether the visitor left the sidebar collapsed, read from their cookie. */
	collapsed: boolean;
	/** Where the screen sits, shown in the top bar: "Posts", "Settings / Publishing". */
	place: string;
	children: RemixNode;
}

/** Counts of the posts the saved views hold, computed once for the nav. */
const DRAFT_COUNT = POSTS.filter((post) => post.status === "draft").length;

/** Posts queued for a date, for the Scheduled saved view's count. */
const SCHEDULED_COUNT = POSTS.filter((post) => post.status === "scheduled").length;

/**
 * Inkwell's whole frame around one screen's main area. Writing comes first in the nav, the two
 * queues an editor returns to are saved views, and Settings sits apart; every screen shares
 * this one shell, so moving between them swaps only the main area.
 */
export function InkwellShell(handle: Handle<InkwellShellProps>) {
	return () => {
		let { current, collapsed, place, children } = handle.props;
		let editor = AUTHORS[0]!;
		return (
			<AppShell
				cookiePath={demoAppCookiePath("inkwell")}
				id="inkwell-shell"
				labels={SHELL_LABELS}
				collapsed={collapsed}
				workspace={
					<>
						<AppShell.Identity
							avatar={mark(24)}
							name={PUBLICATION.name}
							detail="Inkwell · Quarterly"
							commandfor="inkwell-workspace-menu"
							command="toggle-popover"
						/>
						<WorkspaceMenu
							id="inkwell-workspace-menu"
							label="Switch publication"
							current={{ name: PUBLICATION.name, href: href() }}
							others={["Lantern Review Archive", "Field Notes Weekly"]}
						/>
					</>
				}
				nav={
					<>
						<AppShell.Group>
							<AppShell.Item
								data-rmx-prefetch="intent"
								href={href()}
								icon={<HouseIcon />}
								label="Home"
								data-main-nav="home"
								current={current === "home"}
							/>
							<AppShell.Item
								data-rmx-prefetch="intent"
								href={href("posts")}
								icon={<FileTextIcon />}
								label="Posts"
								data-main-nav="posts"
								current={current === "posts"}
							/>
							<AppShell.Item
								data-rmx-prefetch="intent"
								href={href("pages")}
								icon={<FilesIcon />}
								label="Pages"
								data-main-nav="pages"
								current={current === "pages"}
							/>
							<AppShell.Item
								data-rmx-prefetch="intent"
								href={href("media")}
								icon={<ImageIcon />}
								label="Media"
								data-main-nav="media"
								current={current === "media"}
							/>
						</AppShell.Group>
						<AppShell.Group title="Views">
							<AppShell.Item
								data-rmx-prefetch="intent"
								href={href("posts?status=draft")}
								icon={<PenLineIcon />}
								label="Drafts"
								count={DRAFT_COUNT}
								countTone="neutral"
								countLabel={`${DRAFT_COUNT} drafts`}
								data-main-nav="drafts"
								current={current === "drafts"}
							/>
							<AppShell.Item
								data-rmx-prefetch="intent"
								href={href("posts?status=scheduled")}
								icon={<CalendarClockIcon />}
								label="Scheduled"
								count={SCHEDULED_COUNT}
								countTone="brand"
								countLabel={`${SCHEDULED_COUNT} scheduled`}
								data-main-nav="scheduled"
								current={current === "scheduled"}
							/>
						</AppShell.Group>
						<AppShell.Group title="Publication">
							<AppShell.Item
								data-rmx-prefetch="intent"
								href={href("settings")}
								icon={<SettingsIcon />}
								label="Settings"
								data-main-nav="settings"
								current={current === "settings"}
							/>
						</AppShell.Group>
					</>
				}
				footer={
					<>
						<AppShell.Identity
							avatar={<Initials author={editor} size="md" />}
							name={editor.name}
							detail={editor.role}
							commandfor="inkwell-user-menu"
							command="toggle-popover"
						/>
						<UserMenu
							id="inkwell-user-menu"
							label="Account"
							profileHref={href("settings/team")}
							settingsHref={href("settings")}
							helpId={HELP_ID}
						/>
					</>
				}
				topbar={
					<>
						<p
							mix={[
								m(0),
								text("sm"),
								fg("neutral.muted"),
								truncate(),
								raw({ flex: "1 1 auto", minInlineSize: "0" }),
							]}
						>
							<span mix={[font("serif"), fg("neutral.emphasis"), weight("semibold")]}>
								{PUBLICATION.name}
							</span>
							{" / "}
							<span data-main-crumb="">{place}</span>
						</p>
					</>
				}
			>
				{children}
				<MainFrameSync root={href()} />
				<KeyboardHelp id={HELP_ID} labels={HELP_LABELS} groups={HELP_GROUPS} />
			</AppShell>
		);
	};
}
