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
	BellIcon,
	BookOpenIcon,
	BuildingIcon,
	CircleDotIcon,
	CirclePlayIcon,
	CodeIcon,
	GitCommitHorizontalIcon,
	GitPullRequestIcon,
	KeyboardIcon,
	LayoutDashboardIcon,
	RotateCwIcon,
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

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import { UserMenu, WorkspaceMenu } from "../account-menus";
import { MainFrameSync } from "../main-frame-sync";

import type { TreeNode } from "./data";

import { ORG, actionHref, commitsHref, fileHref, href, repoHref } from "./data";
import { FilesPane, PANE_ID } from "./files";
import { DeltaMark, InitialsTile } from "./glyphs";
import { COPY, HELP_LABELS, PALETTE_LABELS, SHELL_LABELS } from "./labels";

/** The cookie Delta's collapsed sidebar is remembered in, apart from the other demos'. */
export const SHELL_COOKIE = "delta-sidebar";

/** The command menu's id. */
const PALETTE_ID = "delta-palette";

/** The keyboard help sheet's id. */
export const HELP_ID = "delta-keys";

/** Which sidebar row a screen marks as the one shown. */
export type ShellSection = "dashboard" | "notifications" | "repo" | "org" | "none";

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
			{ keys: "g d", label: COPY.keys.goDashboard },
			{ keys: "g c", label: COPY.keys.goCode },
			{ keys: "g m", label: COPY.keys.goCommits },
			{ keys: "g i", label: COPY.keys.goIssues },
			{ keys: "g p", label: COPY.keys.goPulls },
			{ keys: "g a", label: COPY.keys.goActions },
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

/** One sidebar row. */
function NavRow(
	handle: Handle<{
		section: ShellSection;
		current: ShellSection;
		href: string;
		label: string;
		icon: RemixNode;
		shortcut?: string;
	}>,
) {
	return () => {
		let { current, href: to, icon, label, section, shortcut } = handle.props;
		return (
			<AppShell.Item
				data-rmx-prefetch="intent"
				href={to}
				icon={icon}
				label={label}
				current={current === section}
				data-main-nav={section}
				data-shortcut={shortcut}
				data-shortcut-label={shortcut ? `Go to ${label}` : undefined}
				data-shortcut-group={shortcut ? "Navigation" : undefined}
			/>
		);
	};
}

/** The sidebar's rows: the person's places, then the repository, then its org. */
function DeltaNav(handle: Handle<{ current: ShellSection }>) {
	return () => {
		let { current } = handle.props;
		return (
			<>
				<AppShell.Group>
					<NavRow
						section="dashboard"
						current={current}
						href={href()}
						label={COPY.nav.dashboard}
						icon={<LayoutDashboardIcon />}
						shortcut="g d"
					/>
					<NavRow
						section="notifications"
						current={current}
						href={href("notifications")}
						label={COPY.nav.notifications}
						icon={<BellIcon />}
						shortcut="g n"
					/>
				</AppShell.Group>
				<AppShell.Group title={COPY.nav.repositories}>
					<NavRow
						section="repo"
						current={current}
						href={repoHref()}
						label={`${COPY.org}/${COPY.repo}`}
						icon={<BookOpenIcon />}
					/>
				</AppShell.Group>
				<AppShell.Group title={COPY.nav.organization}>
					<NavRow
						section="org"
						current={current}
						href={href(ORG)}
						label={COPY.org}
						icon={<BuildingIcon />}
					/>
				</AppShell.Group>
			</>
		);
	};
}

/**
 * The command menu: every repository section by its `g` key, and the file finder on `t`,
 * which ranks every path as the visitor types and opens the file in `main`.
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
				<CommandPalette.Item
					id="go-code"
					title={COPY.keys.goCode}
					icon={<CodeIcon />}
					href={repoHref()}
					shortcut="g c"
				/>
				<CommandPalette.Item
					id="go-commits"
					title={COPY.keys.goCommits}
					icon={<GitCommitHorizontalIcon />}
					href={commitsHref()}
					shortcut="g m"
				/>
				<CommandPalette.Item
					id="go-issues"
					title={COPY.keys.goIssues}
					icon={<CircleDotIcon />}
					href={repoHref("issues")}
					shortcut="g i"
				/>
				<CommandPalette.Item
					id="go-pulls"
					title={COPY.keys.goPulls}
					icon={<GitPullRequestIcon />}
					href={repoHref("pulls")}
					shortcut="g p"
				/>
				<CommandPalette.Item
					id="go-actions"
					title={COPY.keys.goActions}
					icon={<CirclePlayIcon />}
					href={repoHref("actions")}
					shortcut="g a"
				/>
			</CommandPalette.Group>
			<CommandPalette.Group heading="Go to">
				<CommandPalette.Item
					id="go-dashboard"
					title={COPY.keys.goDashboard}
					icon={<LayoutDashboardIcon />}
					href={href()}
				/>
				<CommandPalette.Item
					id="go-notifications"
					title={`Go to ${COPY.nav.notifications}`}
					icon={<BellIcon />}
					href={href("notifications")}
				/>
			</CommandPalette.Group>
			<CommandPalette.Finder
				id="files"
				title={COPY.find.title}
				placeholder={COPY.find.placeholder}
				shortcut="t"
				paths={handle.props.paths}
				href={fileHref("{path}").replace("%7Bpath%7D", "{path}")}
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

/** The repository's sections, as its header's tabs. */
export type RepoTab = "code" | "commits" | "issues" | "pulls" | "actions" | "settings";

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
		let { actions, commits, description, parent, tab, title, trail = [] } = handle.props;
		let tabs: PageHeader.Tab[] = [
			{ href: repoHref(), label: COPY.tabs.code, current: tab === "code" },
			{
				href: commitsHref(),
				label: COPY.tabs.commits,
				count: commits > 0 ? commits : undefined,
				current: tab === "commits",
			},
			{ href: repoHref("issues"), label: COPY.tabs.issues, current: tab === "issues" },
			{ href: repoHref("pulls"), label: COPY.tabs.pulls, current: tab === "pulls" },
			{ href: repoHref("actions"), label: COPY.tabs.actions, current: tab === "actions" },
			{ href: repoHref("settings"), label: COPY.tabs.settings, current: tab === "settings" },
		];
		return (
			<PageHeader
				title={title}
				crumbsLabel={COPY.crumbs}
				crumbs={[
					{ label: COPY.org, href: href(ORG) },
					{ label: COPY.repo, href: trail.length === 0 ? undefined : repoHref() },
					...trail,
				]}
				parent={parent}
				description={description}
				actions={actions}
				tabs={tabs}
				tabsLabel={COPY.tabs.label}
				tabsMore={COPY.tabs.more}
				mix={[raw({ "& nav[aria-label] a, & h1": { overflowWrap: "anywhere" } })]}
			/>
		);
	};
}
