/**
 * Cairn's frame: one sidebar with the person's own work, the workspace's projects, roadmap
 * and cycles, each team's issues, board and cycle, and the saved views; a top bar with Create
 * issue, the command menu and the keyboard help; and on a phone, a tab bar under the thumb.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	ChartGanttIcon,
	CircleUserRoundIcon,
	EyeIcon,
	InboxIcon,
	IterationCwIcon,
	KanbanIcon,
	KeyboardIcon,
	LayersIcon,
	ListTodoIcon,
	PlusIcon,
	RotateCwIcon,
	SquarePenIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { grow } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { text, truncate, weight } from "@sdxc/u/typography";
import { Button, Keyboard, Menu } from "@sdxc/ui";
import { AppShell } from "@sdxc/ui/app/app-shell";
import { CommandPalette } from "@sdxc/ui/app/command-palette";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import { TabBar } from "@sdxc/ui/app/tab-bar";

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import { UserMenu, WorkspaceMenu } from "../account-menus";

import type { VisitorState } from "./state";

import { CreateIssueDialog } from "./create";
import {
	NOTICES,
	PEOPLE,
	PROJECTS,
	TEAMS,
	VIEWS,
	actionHref,
	currentCycle,
	href,
	ME,
} from "./data";
import { CairnMark, PersonTile, ProjectGlyph, StatusIcon } from "./glyphs";
import { HELP_LABELS, PALETTE_LABELS, SHELL_LABELS } from "./labels";
import { allIssues } from "./state";

/** The cookie Cairn's collapsed sidebar is remembered in, apart from the other demos'. */
export const SHELL_COOKIE = "cairn-sidebar";

/** The command menu's id. */
const PALETTE_ID = "cairn-palette";

/** The keyboard help sheet's id. */
export const HELP_ID = "cairn-keys";

/** The create-issue dialog's id, which `c` and every Create button open. */
export const CREATE_ID = "cairn-create";

/** Which sidebar row a screen marks as the one shown. */
export type ShellSection =
	| "my"
	| "inbox"
	| "projects"
	| "roadmap"
	| "cycles"
	| `team:${string}`
	| `board:${string}`
	| `cycle:${string}`
	| `view:${string}`
	| "none";

/** The keys the help sheet lists beside the ones the page declares with `data-shortcut`. */
const HELP_GROUPS: KeyboardHelp.Group[] = [
	{
		title: "Issues",
		shortcuts: [
			{ keys: "c", label: "Create issue" },
			{ keys: ["j", "arrowdown"], label: "Next issue" },
			{ keys: ["k", "arrowup"], label: "Previous issue" },
			{ keys: "enter", label: "Open issue" },
			{ keys: "x", label: "Select issue" },
			{ keys: "s", label: "Change status" },
			{ keys: "p", label: "Change priority" },
			{ keys: "a", label: "Assign issue" },
			{ keys: "shift+arrowleft", label: "Move card to the previous column" },
			{ keys: "shift+arrowright", label: "Move card to the next column" },
		],
	},
	{
		title: "Navigation",
		shortcuts: [
			{ keys: "g m", label: "Go to My issues" },
			{ keys: "g i", label: "Go to Inbox" },
			{ keys: "g p", label: "Go to Projects" },
			{ keys: "g r", label: "Go to Roadmap" },
			{ keys: "g y", label: "Go to Cycles" },
		],
	},
	{
		title: "General",
		shortcuts: [
			{ keys: "mod+k", label: "Open command menu" },
			{ keys: "/", label: "Search issues" },
			{ keys: "?", label: "Show keyboard shortcuts" },
		],
	},
];

namespace CairnShell {
	export interface Props {
		current: ShellSection;
		/** The remembered collapsed sidebar, from {@link SHELL_COOKIE}. */
		collapsed: boolean;
		/** Where the person is, shown in the top bar. */
		crumb: string;
		state: VisitorState;
		/** The team a new issue starts in, from the screen the person is on. */
		team?: string;
		/** The page the create dialog returns to after a refused post. */
		from: string;
		/** Drops the content padding, for edge-to-edge panes. */
		flush?: boolean;
		/** Holds the screen to the window's height, for a board that scrolls inside itself. */
		fill?: boolean;
		children: RemixNode;
	}
}

/** The sidebar's rows: the person's work, the workspace, each team, then the saved views. */
function CairnNav(handle: Handle<{ current: ShellSection; unread: number }>) {
	return () => {
		let { current, unread } = handle.props;
		let row = (
			section: ShellSection,
			page: string,
			label: string,
			icon: RemixNode,
			shortcut?: string,
			extra: Partial<AppShell.ItemProps> = {},
		) => (
			<AppShell.Item
				data-rmx-prefetch="intent"
				href={href(page)}
				icon={icon}
				label={label}
				current={current === section}
				data-shortcut={shortcut}
				data-shortcut-label={shortcut ? `Go to ${label}` : undefined}
				data-shortcut-group={shortcut ? "Navigation" : undefined}
				{...extra}
			/>
		);

		return (
			<>
				<AppShell.Group>
					{row("my", "", "My issues", <CircleUserRoundIcon />, "g m")}
					{row("inbox", "inbox", "Inbox", <InboxIcon />, "g i", {
						count: unread,
						countTone: "brand",
						countLabel: `${unread} unread`,
						unread: unread > 0,
					})}
				</AppShell.Group>
				<AppShell.Group title="Workspace">
					{row("projects", "projects", "Projects", <LayersIcon />, "g p")}
					{row("roadmap", "roadmap", "Roadmap", <ChartGanttIcon />, "g r")}
					{row("cycles", "cycles", "Cycles", <IterationCwIcon />, "g y")}
				</AppShell.Group>
				{TEAMS.map((team) => {
					let cycle = currentCycle(team.id);
					return (
						<AppShell.Group title={team.name}>
							{row(`team:${team.id}`, `team/${team.id}`, "Issues", <ListTodoIcon />, undefined, {
								"aria-label": `${team.name} issues`,
							} as Partial<AppShell.ItemProps>)}
							{row(
								`board:${team.id}`,
								`team/${team.id}/board`,
								"Board",
								<KanbanIcon />,
								undefined,
								{
									"aria-label": `${team.name} board`,
								} as Partial<AppShell.ItemProps>,
							)}
							{cycle
								? row(
										`cycle:${cycle.id}`,
										`cycles/${cycle.id}`,
										`Cycle ${cycle.number}`,
										<IterationCwIcon />,
										undefined,
										{
											"aria-label": `${team.name} cycle ${cycle.number}`,
										} as Partial<AppShell.ItemProps>,
									)
								: null}
						</AppShell.Group>
					);
				})}
				<AppShell.Group title="Views">
					{VIEWS.map((view) => row(`view:${view.id}`, `views/${view.id}`, view.name, <EyeIcon />))}
				</AppShell.Group>
			</>
		);
	};
}

/**
 * The command menu: jump to any issue by id or title, any project, team or view, or create
 * an issue. Issues open beside their team's list, so the list stays in reach.
 */
function CairnPalette(handle: Handle<{ state: VisitorState }>) {
	return () => {
		let issues = allIssues(handle.props.state);
		return (
			<CommandPalette
				id={PALETTE_ID}
				labels={PALETTE_LABELS}
				recent={["create", "go-my"]}
				remember="cairn:palette"
			>
				<CommandPalette.Group heading="Commands">
					<CommandPalette.Item
						id="create"
						title="Create issue"
						icon={<SquarePenIcon />}
						href={href("new")}
					/>
					<CommandPalette.Item
						id="go-my"
						title="Go to My issues"
						icon={<CircleUserRoundIcon />}
						href={href()}
						shortcut="g m"
					/>
					<CommandPalette.Item
						id="go-inbox"
						title="Go to Inbox"
						icon={<InboxIcon />}
						href={href("inbox")}
						shortcut="g i"
					/>
					<CommandPalette.Item
						id="go-projects"
						title="Go to Projects"
						icon={<LayersIcon />}
						href={href("projects")}
						shortcut="g p"
					/>
					<CommandPalette.Item
						id="go-roadmap"
						title="Go to Roadmap"
						icon={<ChartGanttIcon />}
						href={href("roadmap")}
						shortcut="g r"
					/>
					<CommandPalette.Item
						id="go-cycles"
						title="Go to Cycles"
						icon={<IterationCwIcon />}
						href={href("cycles")}
						shortcut="g y"
					/>
					{TEAMS.map((team) => (
						<CommandPalette.Item
							id={`go-board-${team.id}`}
							title={`Open ${team.name} board`}
							icon={<KanbanIcon />}
							href={href(`team/${team.id}/board`)}
						/>
					))}
				</CommandPalette.Group>
				<CommandPalette.Group heading="Issues">
					{issues.map((issue) => (
						<CommandPalette.Item
							id={`issue-${issue.id}`}
							title={issue.title}
							description={issue.id}
							keywords={[issue.id, issue.id.replace("-", "")]}
							icon={<StatusIcon status={issue.status} />}
							href={href(`team/${issue.team}?issue=${issue.id}`)}
						/>
					))}
				</CommandPalette.Group>
				<CommandPalette.Group heading="Projects">
					{PROJECTS.map((project) => (
						<CommandPalette.Item
							id={`project-${project.id}`}
							title={project.name}
							description={project.summary}
							icon={<ProjectGlyph hue={project.hue} />}
							href={href(`projects/${project.id}`)}
						/>
					))}
				</CommandPalette.Group>
				<CommandPalette.Group heading="Views">
					{VIEWS.map((view) => (
						<CommandPalette.Item
							id={`view-${view.id}`}
							title={view.name}
							description={view.description}
							icon={<EyeIcon />}
							href={href(`views/${view.id}`)}
						/>
					))}
				</CommandPalette.Group>
			</CommandPalette>
		);
	};
}

/**
 * Renders a Cairn screen inside the shell, with the command menu, the keyboard help and the
 * create dialog on every page, so ⌘K, `?` and `c` answer wherever the person is.
 */
export function CairnShell(handle: Handle<CairnShell.Props>) {
	return () => {
		let { current, collapsed, crumb, flush, fill, children, state, team, from } = handle.props;
		let unread = NOTICES.filter((notice) => notice.unread).length;
		let me = PEOPLE.find((person) => person.id === ME);

		let shell = (
			<AppShell
				cookiePath={demoAppCookiePath("cairn")}
				id="cairn"
				labels={SHELL_LABELS}
				collapsed={collapsed}
				cookieName={SHELL_COOKIE}
				fill={fill}
				indicator="fill"
				sheetBelow="64rem"
				workspace={
					<>
						<AppShell.Identity
							avatar={<CairnMark />}
							name="Saltmarsh"
							detail="Cairn workspace"
							commandfor="cairn-workspace-menu"
							command="toggle-popover"
						/>
						<WorkspaceMenu
							id="cairn-workspace-menu"
							label="Switch workspace"
							current={{ name: "Saltmarsh", href: href() }}
							others={["Saltmarsh Labs", "Personal"]}
						/>
					</>
				}
				nav={<CairnNav current={current} unread={unread} />}
				footer={
					<>
						<AppShell.Identity
							avatar={<PersonTile person={me} size={24} decorative />}
							name="Ilse Varga"
							detail="ilse@saltmarsh.studio"
							commandfor="cairn-user-menu"
							command="toggle-popover"
						/>
						<UserMenu
							id="cairn-user-menu"
							label="Account"
							helpId={HELP_ID}
							extra={
								<Menu.Item type="submit" form="cairn-reset">
									<RotateCwIcon />
									Reset the demo
								</Menu.Item>
							}
						/>
						<form
							id="cairn-reset"
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
							mix={[
								grow(),
								truncate(),
								text("sm"),
								weight("medium"),
								fg("neutral.muted"),
								media("(max-width: 40rem)", raw({ visibility: "hidden" })),
							]}
						>
							{crumb}
						</span>
						<CommandPalette.Trigger for={PALETTE_ID}>Search or jump to…</CommandPalette.Trigger>
						<Button
							type="button"
							size="sm"
							color="brand"
							commandfor={CREATE_ID}
							command="show-modal"
							data-shortcut="c"
							data-shortcut-label="Create issue"
							data-shortcut-group="Issues"
						>
							<PlusIcon size={16} aria-hidden="true" />
							<span mix={[media("(max-width: 40rem)", visuallyHidden())]}>Create issue</span>
							<Keyboard mix={[media("(max-width: 64rem)", raw({ display: "none" }))]}>C</Keyboard>
						</Button>
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
				{children}
				<TabBar label="Primary" hideFrom="48rem">
					<TabBar.Item
						href={href()}
						icon={<CircleUserRoundIcon />}
						label="My issues"
						current={current === "my"}
					/>
					<TabBar.Item
						href={href("inbox")}
						icon={<InboxIcon />}
						label="Inbox"
						current={current === "inbox"}
						count={unread}
						countLabel={`${unread} unread`}
					/>
					<TabBar.Item
						href={href(`team/${team ?? "web"}/board`)}
						icon={<KanbanIcon />}
						label="Board"
						current={current.startsWith("board:")}
					/>
					<TabBar.Item
						href={href("projects")}
						icon={<LayersIcon />}
						label="Projects"
						current={current === "projects" || current === "roadmap"}
					/>
				</TabBar>
				<CairnPalette state={state} />
				<KeyboardHelp id={HELP_ID} labels={HELP_LABELS} groups={HELP_GROUPS} />
				<CreateIssueDialog id={CREATE_ID} team={team ?? "web"} from={from} />
			</AppShell>
		);

		return flush ? (
			<div mix={[raw({ display: "contents", "--ui-app-content-padding": "0px" })]}>{shell}</div>
		) : (
			shell
		);
	};
}
