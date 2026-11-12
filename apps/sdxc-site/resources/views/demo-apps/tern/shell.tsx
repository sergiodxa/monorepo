/**
 * Tern's frame: a sidebar holding New chat, search, pinned chats, projects and the history
 * grouped by age, and a top bar with the screen's own controls, the command menu and the
 * keyboard help, so every screen sits in the same shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	FolderIcon,
	KeyboardIcon,
	MessageSquareIcon,
	PinIcon,
	SearchIcon,
	SettingsIcon,
	SquarePenIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { grow } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { text, truncate, weight } from "@sdxc/u/typography";
import { Button } from "@sdxc/ui";
import { AppShell } from "@sdxc/ui/app/app-shell";
import { CommandPalette } from "@sdxc/ui/app/command-palette";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";

import { UserMenu, WorkspaceMenu } from "~/resources/views/demo-apps/account-menus";
import {
	CONVERSATIONS,
	PERSON,
	PROJECTS,
	historyGroups,
	href,
} from "~/resources/views/demo-apps/tern/data";
import { HELP_LABELS, PALETTE_LABELS, SHELL_LABELS } from "~/resources/views/demo-apps/tern/labels";

/** The cookie Tern's collapsed sidebar is remembered in. */
export const SHELL_COOKIE = "tern-sidebar";

/** The id of the command palette ⌘K opens. */
const PALETTE_ID = "tern-palette";

/** The id of the keyboard help sheet. */
export const HELP_ID = "tern-keys";

/** Which sidebar row a screen marks as the one shown. */
export type ShellSection =
	| "new"
	| "search"
	| "settings"
	| `chat:${string}`
	| `project:${string}`
	| "none";

/** The keys the help sheet lists beside the ones the page declares with `data-shortcut`. */
const HELP_GROUPS: KeyboardHelp.Group[] = [
	{
		title: "Chat",
		shortcuts: [
			{ keys: "enter", label: "Send message" },
			{ keys: "shift+enter", label: "New line" },
			{ keys: "escape", label: "Stop response" },
		],
	},
	{
		title: "General",
		shortcuts: [
			{ keys: "mod+k", label: "Search chats" },
			{ keys: "?", label: "Show keyboard shortcuts" },
		],
	},
];

/** Tern's mark: a tern's forked tail in flight on a violet tile. */
export function TernMark(handle: Handle<{ size?: number }>) {
	return () => {
		let size = handle.props.size ?? 24;
		return (
			<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
				<rect width="24" height="24" rx="7" fill="var(--ui-color-brand-600)" />
				<path
					d="M4.5 9.5c3.2.1 5.6 1.4 7.5 3.9 1.9-2.5 4.3-3.8 7.5-3.9-2.4 1.3-4.1 3.4-5 6.5L12 13.4 9.5 16c-.9-3.1-2.6-5.2-5-6.5z"
					fill="white"
				/>
			</svg>
		);
	};
}

/** A 24px initials tile for the signed-in person. */
function Initials() {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					inlineSize: "1.5rem",
					blockSize: "1.5rem",
					borderRadius: "999px",
					fontSize: "0.625rem",
					background: "var(--ui-brand-bg-tint-pressed)",
					color: "var(--ui-brand-fg-emphasis)",
				}),
				weight("semibold"),
			]}
		>
			{PERSON.initials}
		</span>
	);
}

/** The sidebar: actions, pinned chats, projects, then the history by age. */
function TernNav(handle: Handle<{ current: ShellSection }>) {
	return () => {
		let { current } = handle.props;
		let chat = (id: string, title: string, icon?: RemixNode) => (
			<AppShell.Item
				data-rmx-prefetch="intent"
				href={href(`c/${id}`)}
				label={title}
				icon={icon}
				current={current === `chat:${id}`}
			/>
		);

		return (
			<>
				<AppShell.Group>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href()}
						icon={<SquarePenIcon />}
						label="New chat"
						current={current === "new"}
						data-shortcut="g n"
						data-shortcut-label="New chat"
						data-shortcut-group="Navigation"
					/>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("search")}
						icon={<SearchIcon />}
						label="Search chats"
						current={current === "search"}
						data-shortcut="/"
						data-shortcut-label="Search chats"
						data-shortcut-group="Navigation"
					/>
				</AppShell.Group>
				<AppShell.Group title="Pinned">
					{CONVERSATIONS.filter((conversation) => conversation.pinned).map((conversation) =>
						chat(conversation.id, conversation.title, <PinIcon />),
					)}
				</AppShell.Group>
				<AppShell.Group title="Projects">
					{PROJECTS.map((project) => (
						<AppShell.Item
							data-rmx-prefetch="intent"
							href={href(`projects/${project.slug}`)}
							icon={<FolderIcon />}
							label={project.name}
							current={current === `project:${project.slug}`}
						/>
					))}
				</AppShell.Group>
				{historyGroups(CONVERSATIONS.filter((conversation) => !conversation.pinned)).map(
					(group) => (
						<AppShell.Group title={group.label}>
							{group.conversations.map((conversation) => chat(conversation.id, conversation.title))}
						</AppShell.Group>
					),
				)}
			</>
		);
	};
}

/** The command menu: start a chat, open any chat or project by name, or reach settings. */
function TernPalette() {
	return () => (
		<CommandPalette
			id={PALETTE_ID}
			labels={PALETTE_LABELS}
			recent={["new-chat", "go-settings"]}
			remember="tern:palette"
		>
			<CommandPalette.Group heading="Actions">
				<CommandPalette.Item
					id="new-chat"
					title="New chat"
					icon={<SquarePenIcon />}
					href={href()}
					shortcut="g n"
				/>
				<CommandPalette.Item
					id="go-settings"
					title="Open settings"
					icon={<SettingsIcon />}
					href={href("settings")}
				/>
			</CommandPalette.Group>
			<CommandPalette.Group heading="Chats">
				{CONVERSATIONS.map((conversation) => (
					<CommandPalette.Item
						id={`chat-${conversation.id}`}
						title={conversation.title}
						icon={<MessageSquareIcon />}
						href={href(`c/${conversation.id}`)}
					/>
				))}
			</CommandPalette.Group>
			<CommandPalette.Group heading="Projects">
				{PROJECTS.map((project) => (
					<CommandPalette.Item
						id={`project-${project.slug}`}
						title={project.name}
						description={project.description}
						icon={<FolderIcon />}
						href={href(`projects/${project.slug}`)}
					/>
				))}
			</CommandPalette.Group>
		</CommandPalette>
	);
}

namespace TernShell {
	export interface Props {
		current: ShellSection;
		/** The remembered collapsed sidebar, from {@link SHELL_COOKIE}. */
		collapsed: boolean;
		/** Where the person is, shown in the top bar. */
		crumb: string;
		/** The screen's own top-bar controls, such as the model picker. */
		actions?: RemixNode;
		/** Drops the content padding, for the chat's edge-to-edge column. */
		flush?: boolean;
		children: RemixNode;
	}
}

/** Renders a Tern screen inside the shell, with ⌘K and `?` answering on every page. */
export function TernShell(handle: Handle<TernShell.Props>) {
	return () => {
		let { current, collapsed, crumb, actions, flush, children } = handle.props;

		let shell = (
			<AppShell
				id="tern"
				labels={SHELL_LABELS}
				collapsed={collapsed}
				cookieName={SHELL_COOKIE}
				indicator="fill"
				sheetBelow="64rem"
				workspace={
					<>
						<AppShell.Identity
							avatar={<TernMark />}
							name="Tern"
							detail="Personal"
							commandfor="tern-workspace-menu"
							command="toggle-popover"
						/>
						<WorkspaceMenu
							id="tern-workspace-menu"
							label="Switch workspace"
							current={{ name: "Personal", href: href() }}
							others={["Harbor Studio"]}
						/>
					</>
				}
				nav={<TernNav current={current} />}
				footer={
					<>
						<AppShell.Identity
							avatar={<Initials />}
							name={PERSON.name}
							detail="Studio plan"
							commandfor="tern-user-menu"
							command="toggle-popover"
						/>
						<UserMenu
							id="tern-user-menu"
							label="Account"
							profileHref={href("settings/personalization")}
							settingsHref={href("settings")}
							helpId={HELP_ID}
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
								media("(max-width: 40rem)", raw({ display: "none" })),
							]}
						>
							{crumb}
						</span>
						<span mix={[grow(), media("(min-width: 40.0625rem)", raw({ display: "none" }))]} />
						{actions}
						<CommandPalette.Trigger
							for={PALETTE_ID}
							aria-label="Search chats"
							mix={[
								media(
									"(max-width: 40rem)",
									raw({
										inlineSize: "2rem",
										flexShrink: 0,
										paddingInline: 0,
										overflow: "hidden",
										justifyContent: "flex-start",
										paddingInlineStart: "0.5625rem",
									}),
								),
							]}
						>
							Search chats…
						</CommandPalette.Trigger>
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
				<TernPalette />
				<KeyboardHelp id={HELP_ID} labels={HELP_LABELS} groups={HELP_GROUPS} />
			</AppShell>
		);

		return flush ? (
			<div mix={[raw({ display: "contents", "--ui-app-content-padding": "0px" })]}>{shell}</div>
		) : (
			shell
		);
	};
}
