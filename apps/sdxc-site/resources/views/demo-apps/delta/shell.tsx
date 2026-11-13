/**
 * Delta's frame: a sidebar with the dashboard, the inbox, the one repository and its org; a
 * top bar with the command menu and the keyboard help; the file tree beside `main` on code
 * screens; and the repository header every repository screen opens with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	BookOpenIcon,
	BuildingIcon,
	CircleDotIcon,
	CirclePlayIcon,
	CodeIcon,
	GitCommitHorizontalIcon,
	GitPullRequestIcon,
	InboxIcon,
	KeyboardIcon,
	LayoutDashboardIcon,
	RotateCwIcon,
	SettingsIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { grow } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { font, text, truncate, weight } from "@sdxc/u/typography";
import { Button, Menu } from "@sdxc/ui";
import { AppShell } from "@sdxc/ui/app/app-shell";
import { CommandPalette } from "@sdxc/ui/app/command-palette";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import { PageHeader } from "@sdxc/ui/app/page-header";

import { DELTA_BRANCH } from "~/config/delta";
import { demoAppCookiePath } from "~/resources/views/demo-apps";

import { UserMenu, WorkspaceMenu } from "../account-menus";
import { MainFrameSync } from "../main-frame-sync";

import type { TreeNode } from "./data";

import { ORG, REPO, actionHref, fileHref, href, repoHref } from "./data";
import { FilesPane, PANE_ID } from "./files";
import { DeltaMark, InitialsTile } from "./glyphs";
import { COPY, HELP_LABELS, PALETTE_LABELS, SHELL_LABELS } from "./labels";

/** The cookie Delta's collapsed sidebar is remembered in, apart from the other demos'. */
export const SHELL_COOKIE = "delta-sidebar";

/** The command menu's id. */
const PALETTE_ID = "delta-palette";

/**
 * Stands in for the finder's `{path}` while the address is built, since the router would
 * encode the braces; it is swapped for `{path}` once the address is whole.
 */
const FINDER_SLOT = "delta-finder-path";

/** The keyboard help sheet's id. */
export const HELP_ID = "delta-keys";

/** One sidebar row: the section it marks, where it goes, and its `g` key when it has one. */
interface NavEntry {
	section: string;
	/** A page path under the app; `""` is the dashboard. */
	page: string;
	label: string;
	icon: RemixNode;
	shortcut?: string;
}

/**
 * The sidebar, group by group. A finished screen joins it with one line here, in the commit
 * that ships the screen; nothing links to a screen before it exists.
 */
const NAV: Array<{ title?: string; rows: NavEntry[] }> = [
	{
		rows: [
			{
				section: "dashboard",
				page: "",
				label: COPY.nav.dashboard,
				icon: <LayoutDashboardIcon />,
				shortcut: "g d",
			},
			{
				section: "notifications",
				page: "notifications",
				label: COPY.nav.notifications,
				icon: <InboxIcon />,
				shortcut: "g n",
			},
		],
	},
	{
		title: COPY.nav.organization,
		rows: [
			{
				section: "org",
				page: ORG,
				label: COPY.org,
				icon: <BuildingIcon />,
				shortcut: "g o",
			},
		],
	},
	{
		title: COPY.nav.repositories,
		rows: [
			{
				section: "repo",
				page: REPO,
				label: `${COPY.org}/${COPY.repo}`,
				icon: <BookOpenIcon />,
			},
		],
	},
];

/** Which sidebar row a screen marks as the one shown; `"none"` marks none. */
export type ShellSection = string;

/** One repository tab: where it goes, and its `g` key in the command menu. */
interface RepoTabEntry {
	tab: string;
	/** A page path under the repository; `""` is its home. */
	page: string;
	label: string;
	icon: RemixNode;
	shortcut: string;
}

/**
 * The repository's tabs, in order. A finished screen joins them with one line here, in the
 * commit that ships it; the command menu and the help sheet list the same entries.
 */
const REPO_TABS: RepoTabEntry[] = [
	{ tab: "code", page: "", label: COPY.tabs.code, icon: <CodeIcon />, shortcut: "g c" },
	{
		tab: "issues",
		page: "issues",
		label: COPY.tabs.issues,
		icon: <CircleDotIcon />,
		shortcut: "g i",
	},
	{
		tab: "pulls",
		page: "pulls",
		label: COPY.tabs.pulls,
		icon: <GitPullRequestIcon />,
		shortcut: "g p",
	},
	{
		tab: "commits",
		page: `commits/${DELTA_BRANCH}`,
		label: COPY.tabs.commits,
		icon: <GitCommitHorizontalIcon />,
		shortcut: "g m",
	},
	{
		tab: "actions",
		page: "actions",
		label: COPY.tabs.actions,
		icon: <CirclePlayIcon />,
		shortcut: "g a",
	},
	{
		tab: "settings",
		page: "settings",
		label: COPY.tabs.settings,
		icon: <SettingsIcon />,
		shortcut: "g s",
	},
];

/** The keys the help sheet lists beside the ones the page declares with `data-shortcut`. */
const HELP_GROUPS: KeyboardHelp.Group[] = [
	{
		title: "Repository",
		shortcuts: [
			{ keys: "t", label: COPY.keys.goToFile },
			{ keys: "y", label: "Expand URL to its permalink" },
			{ keys: "b", label: COPY.keys.blame },
		],
	},
	{
		title: "Navigation",
		shortcuts: [
			...NAV.flatMap((group) => group.rows).flatMap((row) =>
				row.shortcut === undefined ? [] : [{ keys: row.shortcut, label: `Go to ${row.label}` }],
			),
			...REPO_TABS.map((entry) => ({ keys: entry.shortcut, label: `Go to ${entry.label}` })),
		],
	},
	{
		title: "General",
		shortcuts: [
			{ keys: "mod+k", label: "Open command menu" },
			{ keys: "?", label: "Show keyboard shortcuts" },
		],
	},
];

/** The sidebar's rows, from {@link NAV}. */
function DeltaNav(handle: Handle<{ current: ShellSection }>) {
	return () => {
		let { current } = handle.props;
		return (
			<>
				{NAV.map((group) => (
					<AppShell.Group title={group.title}>
						{group.rows.map((row) => (
							<AppShell.Item
								data-rmx-prefetch="intent"
								href={href(row.page)}
								icon={row.icon}
								label={row.label}
								current={current === row.section}
								data-main-nav={row.section}
								data-shortcut={row.shortcut}
								data-shortcut-label={row.shortcut ? `Go to ${row.label}` : undefined}
								data-shortcut-group={row.shortcut ? "Navigation" : undefined}
							/>
						))}
					</AppShell.Group>
				))}
			</>
		);
	};
}

/**
 * The command menu: the file finder on `t`, which ranks every path as the visitor types and
 * opens the file in `main`, then every repository tab and sidebar row by its `g` key.
 */
function DeltaPalette(handle: Handle<{ paths: readonly string[] }>) {
	return () => (
		<CommandPalette
			id={PALETTE_ID}
			labels={PALETTE_LABELS}
			recent={["go-to-file", "go-code"]}
			remember="delta:palette"
		>
			<CommandPalette.Group heading="Repository">
				<CommandPalette.Item
					id="go-to-file"
					title={COPY.keys.goToFile}
					icon={<CodeIcon />}
					page="files"
					shortcut="t"
				/>
				{REPO_TABS.map((entry) => (
					<CommandPalette.Item
						id={`go-${entry.tab}`}
						title={`Go to ${entry.label}`}
						icon={entry.icon}
						href={repoHref(entry.page)}
						shortcut={entry.shortcut}
					/>
				))}
			</CommandPalette.Group>
			<CommandPalette.Group heading="Go to">
				{NAV.flatMap((group) => group.rows).map((row) => (
					<CommandPalette.Item
						id={`nav-${row.section}`}
						title={`Go to ${row.label}`}
						icon={row.icon}
						href={href(row.page)}
					/>
				))}
			</CommandPalette.Group>
			<CommandPalette.Finder
				id="files"
				title={COPY.find.title}
				placeholder={COPY.find.placeholder}
				shortcut="t"
				paths={handle.props.paths}
				href={fileHref(FINDER_SLOT).replace(FINDER_SLOT, "{path}")}
			/>
		</CommandPalette>
	);
}

namespace DeltaFrame {
	export interface Props {
		/** The nav item the first screen marks current; later screens mark their own. */
		current: ShellSection;
		/** The remembered collapsed sidebar, from {@link SHELL_COOKIE}. */
		collapsed: boolean;
		/** Where the person is on the first screen, shown in the top bar. */
		crumb: string;
		/** The repository's files as a tree, for the pane beside code screens. */
		tree: readonly TreeNode[];
		/** Every file's path, for the finder. */
		paths: readonly string[];
		/** The file open on the first screen, which the tree marks and opens to. */
		file?: string;
		/** The `main` frame every screen swaps into. */
		children: RemixNode;
	}
}

/** Where the file pane shows: beside a code screen on a screen wide enough for both. */
const WITH_PANE = "(min-width: 64rem)";

/**
 * Renders Delta's shell once around the `main` frame: the sidebar, the top bar, the file pane,
 * the command menu and the keyboard help stay mounted while screens swap beneath them. The
 * pane shows only while `main` holds a code screen, read through `:has()`, so a swap between
 * code and any other screen needs nothing from the shell.
 */
export function DeltaFrame(handle: Handle<DeltaFrame.Props>) {
	return () => {
		let { children, collapsed, crumb, current, file, paths, tree } = handle.props;

		return (
			<AppShell
				cookiePath={demoAppCookiePath("delta")}
				id="delta"
				labels={SHELL_LABELS}
				collapsed={collapsed}
				cookieName={SHELL_COOKIE}
				indicator="pill"
				workspace={
					<>
						<AppShell.Identity
							avatar={<DeltaMark />}
							name={COPY.org}
							detail="Delta organization"
							commandfor="delta-workspace-menu"
							command="toggle-popover"
						/>
						<WorkspaceMenu
							id="delta-workspace-menu"
							label="Switch organization"
							current={{ name: COPY.org, href: href() }}
							others={["Personal account"]}
						/>
					</>
				}
				nav={<DeltaNav current={current} />}
				footer={
					<>
						<AppShell.Identity
							avatar={<InitialsTile name={COPY.user} size={24} />}
							name={COPY.user}
							detail={`@${COPY.handle}`}
							commandfor="delta-user-menu"
							command="toggle-popover"
						/>
						<UserMenu
							id="delta-user-menu"
							label="Account"
							helpId={HELP_ID}
							profileHref={href(`u/${COPY.handle}`)}
							extra={
								<Menu.Item type="submit" form="delta-reset">
									<RotateCwIcon />
									{COPY.reset}
								</Menu.Item>
							}
						/>
						<form
							id="delta-reset"
							method="post"
							action={actionHref("reset")}
							data-rmx-document
							hidden
						/>
					</>
				}
				topbar={
					<>
						<span
							data-main-crumb=""
							mix={[
								grow(),
								truncate(),
								text("sm"),
								weight("medium"),
								fg("neutral.muted"),
								font("mono"),
								media("(max-width: 40rem)", raw({ visibility: "hidden" })),
							]}
						>
							{crumb}
						</span>
						<CommandPalette.Trigger for={PALETTE_ID}>Search or jump to…</CommandPalette.Trigger>
						<Button
							type="button"
							variant="ghost"
							color="neutral"
							size="sm"
							commandfor={HELP_ID}
							command="show-modal"
							aria-label={HELP_LABELS.open}
							title={HELP_LABELS.open}
							mix={[media("(max-width: 40rem)", raw({ display: "none" }))]}
						>
							<KeyboardIcon size={16} aria-hidden="true" />
						</Button>
					</>
				}
			>
				<div
					data-delta-workspace=""
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							gap: "1.5rem",
							alignItems: "start",
							[`@media ${WITH_PANE}`]: {
								"&:has([data-main-region] [data-delta-path])": {
									gridTemplateColumns: "16.5rem minmax(0, 1fr)",
								},
							},
						}),
					]}
				>
					<aside
						id={PANE_ID}
						aria-label={COPY.files.title}
						data-delta-pane=""
						mix={[
							raw({
								display: "none",
								flexDirection: "column",
								gap: "0.5rem",
								position: "sticky",
								insetBlockStart: "calc(var(--ui-app-sticky-top, 3.5rem) + 0.5rem)",
								maxBlockSize: "calc(100dvh - var(--ui-app-sticky-top, 3.5rem) - 3rem)",
								overflowY: "auto",
								overscrollBehavior: "contain",
								scrollbarWidth: "thin",
								[`@media ${WITH_PANE}`]: {
									"[data-delta-workspace]:has([data-main-region] [data-delta-path]) > &": {
										display: "flex",
									},
								},
							}),
						]}
					>
						<FilesPane nodes={tree} current={file} />
					</aside>
					<div mix={[raw({ minInlineSize: 0 })]}>{children}</div>
				</div>
				<MainFrameSync root={href()} />
				<DeltaPalette paths={paths} />
				<KeyboardHelp id={HELP_ID} labels={HELP_LABELS} groups={HELP_GROUPS} />
			</AppShell>
		);
	};
}

/** A repository tab's key, as {@link REPO_TABS} names it. */
export type RepoTab = string;

namespace RepoCounts {
	export interface Props {
		/** Open records by the tab that counts them, such as `{ issues: 9, pulls: 3 }`. */
		counts: Record<string, number>;
		/** Tabs whose feature the visitor switched off in Settings, such as `["issues"]`. */
		hidden?: readonly RepoTab[];
		children: RemixNode;
	}

	/** What a repository header reads from the nearest provider. */
	export interface Context {
		counts: Record<string, number>;
		hidden: readonly RepoTab[];
	}
}

/**
 * Hands every repository header under it the counts its tabs show and the tabs it leaves
 * out, which the visitor's own work changes: a merge redrawing `main` also redraws "Pull
 * requests 3" as 2, and switching Issues off in Settings drops the Issues tab.
 */
export function RepoCounts(handle: Handle<RepoCounts.Props, RepoCounts.Context>) {
	return () => {
		handle.context.set({ counts: handle.props.counts, hidden: handle.props.hidden ?? [] });
		return handle.props.children;
	};
}

namespace RepoHeader {
	export interface Props {
		/** The screen's own title, the page's one `h1`. */
		title: RemixNode;
		/** The trail after `sdxc / delta`, such as a file's folders; the last step is this screen. */
		trail?: Array<{ label: string; href?: string }>;
		/** The screen above this one on a phone, where the trail folds away. */
		parent?: { href: string; label: string };
		description?: RemixNode;
		actions?: RemixNode;
		/** A badge after the title, such as an issue's state pill. */
		status?: RemixNode;
		/** Sticks the header under the top bar and compacts it once the page scrolls under it. */
		sticky?: boolean;
		/** Tabs in place of the repository's own, such as a pull request's Conversation and Files. */
		tabs?: PageHeader.Tab[];
		/** The tab this screen belongs to. */
		tab: RepoTab;
		/** The commits on the branch, which the Commits tab counts. */
		commits: number;
	}
}

/**
 * Renders a repository screen's header: `sdxc / delta` and the trail to this screen, the
 * screen's title, and the repository's tabs, each a link and the current one marked. The
 * tabs fold into "More" on a narrow pane, keeping the current one in the row.
 */
export function RepoHeader(handle: Handle<RepoHeader.Props>) {
	return () => {
		let {
			actions,
			commits,
			description,
			parent,
			status,
			sticky,
			tab,
			title,
			trail = [],
		} = handle.props;
		let provided = handle.context.get(RepoCounts);
		let counts: Record<string, number> = { ...provided?.counts, commits };
		let hidden = provided?.hidden ?? [];
		let tabs: PageHeader.Tab[] =
			handle.props.tabs ??
			REPO_TABS.filter((entry) => entry.tab === tab || !hidden.includes(entry.tab)).map(
				(entry) => ({
					href: repoHref(entry.page),
					label: entry.label,
					count: counts[entry.tab] || undefined,
					current: entry.tab === tab,
				}),
			);
		return (
			<PageHeader
				title={title}
				crumbsLabel={COPY.crumbs}
				crumbs={[
					{ label: COPY.org },
					{ label: COPY.repo, href: trail.length === 0 ? undefined : repoHref() },
					...trail,
				]}
				parent={parent}
				description={description}
				status={status}
				sticky={sticky}
				actions={actions}
				tabs={tabs}
				tabsLabel={COPY.tabs.label}
				tabsMore={COPY.tabs.more}
				mix={[
					raw({ "& nav[aria-label] a, & h1": { overflowWrap: "anywhere" } }),
					sticky ? raw({ zIndex: 5 }) : null,
				]}
			/>
		);
	};
}
