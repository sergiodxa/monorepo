/**
 * Parley's frame: the sidebar with Home, search, the channels and the direct messages (each
 * with its unread count, bold while unread, a solid badge where someone named you), the quick
 * switcher on ⌘K and the keyboard help, around the main frame that holds each screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	ArrowLeftIcon,
	AtSignIcon,
	HashIcon,
	HouseIcon,
	KeyboardIcon,
	LockIcon,
	SearchIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { grow } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { text, truncate, weight } from "@sdxc/u/typography";
import { Button, HeadingScope, LinkButton } from "@sdxc/ui";
import { AppShell } from "@sdxc/ui/app/app-shell";
import { CommandPalette } from "@sdxc/ui/app/command-palette";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";

import type { Unread } from "~/resources/views/demo-apps/parley/model";

import { demoAppCookiePath } from "~/resources/views/demo-apps";
import { UserMenu, WorkspaceMenu } from "~/resources/views/demo-apps/account-menus";
import { MAIN_FRAME, MainFrame } from "~/resources/views/demo-apps/main-frame";
import { MainFrameSync } from "~/resources/views/demo-apps/main-frame-sync";
import {
	CHANNELS,
	DIRECT,
	ME,
	PEOPLE,
	SLUG,
	actionHref,
	conversationPage,
	findPerson,
	href,
} from "~/resources/views/demo-apps/parley/data";
import { ParleyEmoji } from "~/resources/views/demo-apps/parley/emoji-panel";
import {
	HELP_LABELS,
	PALETTE_LABELS,
	SHELL_LABELS,
} from "~/resources/views/demo-apps/parley/labels";
import { Face } from "~/resources/views/demo-apps/parley/parts";

/** The cookie Parley's collapsed sidebar is remembered in. */
export const SHELL_COOKIE = "parley-sidebar";

/** The attributes that aim a link or form at the main frame, before the page's script loads too. */
export const TO_MAIN = { "data-rmx-target": MAIN_FRAME } as const;

/** The id of the quick switcher. */
const PALETTE_ID = "parley-switcher";

/** The id of the keyboard help sheet. */
export const HELP_ID = "parley-keys";

/** The width under which the sidebar is a sheet and screens stack. */
export const PHONE = "(max-width: 47.99rem)";

/** The keys the help sheet lists beside the ones the page declares with `data-shortcut`. */
const HELP_GROUPS: KeyboardHelp.Group[] = [
	{
		title: "Messages",
		shortcuts: [
			{ keys: "enter", label: "Send message" },
			{ keys: "shift+enter", label: "New line" },
			{ keys: "@", label: "Mention someone" },
			{ keys: "mod+b", label: "Bold" },
			{ keys: "mod+i", label: "Italic" },
			{ keys: "mod+e", label: "Code" },
		],
	},
	{
		title: "General",
		shortcuts: [
			{ keys: "mod+k", label: "Jump to a conversation" },
			{ keys: "?", label: "Show keyboard shortcuts" },
		],
	},
];

/** Parley's mark: two overlapping speech tiles in raspberry. */
export function ParleyMark(handle: Handle<{ size?: number }>) {
	return () => {
		let size = handle.props.size ?? 24;
		return (
			<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
				<rect width="24" height="24" rx="6" fill="var(--ui-color-brand-600)" />
				<path
					d="M5 6.5h9.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9.5L6.5 18v-2.5H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z"
					fill="white"
					opacity="0.55"
					transform="translate(1 0)"
				/>
				<path
					d="M10 9h8a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2h-.5V20l-3-2.5H10a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z"
					fill="white"
				/>
			</svg>
		);
	};
}

/** Which sidebar row a screen marks as the one shown. */
export type Section = "home" | "search" | `c:${string}` | `d:${string}` | "none";

/** The words a screen reader hears for a row's count. */
function countLabel(unread: Unread): string {
	if (unread.mentions > 0 && unread.mentions === unread.count) {
		return unread.count === 1 ? "1 mention" : `${unread.count} mentions`;
	}
	let base = unread.count === 1 ? "1 unread message" : `${unread.count} unread messages`;
	return unread.mentions > 0 ? `${base}, ${unread.mentions} mentioning you` : base;
}

namespace ParleyNav {
	export interface Props {
		current: Section;
		unread: Record<string, Unread>;
	}
}

/**
 * The sidebar's rows: Home and Search, then every channel and direct message. A row with
 * unread lines is bold with its count; where someone named the visitor, or in a DM, the
 * count is a solid badge. Each row carries its key so the live island can clear it on read.
 */
function ParleyNav(handle: Handle<ParleyNav.Props>) {
	return () => {
		let { current, unread } = handle.props;
		let mentions = Object.values(unread).reduce((sum, entry) => sum + entry.mentions, 0);
		return (
			<>
				<AppShell.Group>
					<AppShell.Item
						{...TO_MAIN}
						data-main-nav="home"
						data-rmx-prefetch="intent"
						href={href()}
						icon={<HouseIcon />}
						label="Home"
						current={current === "home"}
						count={mentions}
						countTone="brand"
						countLabel={mentions === 1 ? "1 mention" : `${mentions} mentions`}
						data-shortcut="g h"
						data-shortcut-label="Go home"
						data-shortcut-group="Navigation"
					/>
					<AppShell.Item
						{...TO_MAIN}
						data-main-nav="search"
						data-rmx-prefetch="intent"
						href={href("search")}
						icon={<SearchIcon />}
						label="Search"
						current={current === "search"}
						data-shortcut="/"
						data-shortcut-label="Search messages"
						data-shortcut-group="Navigation"
					/>
				</AppShell.Group>
				<AppShell.Group title="Channels">
					{CHANNELS.map((channel) => {
						let counts = unread[channel.key] ?? { count: 0, mentions: 0 };
						return (
							<AppShell.Item
								{...TO_MAIN}
								data-main-nav={channel.key}
								data-conversation={channel.key}
								data-rmx-prefetch="intent"
								href={href(conversationPage(channel.key))}
								icon={channel.private ? <LockIcon /> : <HashIcon />}
								label={channel.name}
								unread={counts.count > 0}
								count={counts.mentions > 0 ? counts.mentions : undefined}
								countTone="brand"
								countLabel={countLabel(counts)}
								current={current === channel.key}
							/>
						);
					})}
				</AppShell.Group>
				<AppShell.Group title="Direct messages">
					{DIRECT.map((conversation) => {
						let person = findPerson(conversation.name);
						if (person === undefined) return null;
						let counts = unread[conversation.key] ?? { count: 0, mentions: 0 };
						return (
							<AppShell.Item
								{...TO_MAIN}
								data-main-nav={conversation.key}
								data-conversation={conversation.key}
								data-rmx-prefetch="intent"
								href={href(conversationPage(conversation.key))}
								icon={<Face person={person} size="xs" presence />}
								label={person.name}
								unread={counts.count > 0}
								count={counts.count}
								countTone="brand"
								countLabel={countLabel(counts)}
								current={current === conversation.key}
							/>
						);
					})}
				</AppShell.Group>
			</>
		);
	};
}

/** The quick switcher: every channel, every person, and the app's own places. */
function ParleySwitcher() {
	return () => (
		<CommandPalette
			id={PALETTE_ID}
			labels={PALETTE_LABELS}
			recent={["go-home", "c:launch-v3"]}
			remember="parley:switcher"
		>
			<CommandPalette.Group heading="Channels">
				{CHANNELS.map((channel) => (
					<CommandPalette.Item
						id={channel.key}
						title={`#${channel.name}`}
						description={channel.topic}
						keywords={[channel.name]}
						icon={channel.private ? <LockIcon /> : <HashIcon />}
						href={href(conversationPage(channel.key))}
					/>
				))}
			</CommandPalette.Group>
			<CommandPalette.Group heading="People">
				{PEOPLE.filter((person) => person.handle !== ME.handle && !person.bot).map((person) => (
					<CommandPalette.Item
						id={`d:${person.handle}`}
						title={person.name}
						description={person.title}
						keywords={[person.handle]}
						icon={<AtSignIcon />}
						href={href(`d/${person.handle}`)}
					/>
				))}
			</CommandPalette.Group>
			<CommandPalette.Group heading="Go to">
				<CommandPalette.Item
					id="go-home"
					title="Home"
					description="Unread messages and mentions"
					icon={<HouseIcon />}
					href={href()}
					shortcut="g h"
				/>
				<CommandPalette.Item
					id="go-search"
					title="Search messages"
					icon={<SearchIcon />}
					href={href("search")}
					shortcut="/"
				/>
			</CommandPalette.Group>
		</CommandPalette>
	);
}

/** The labels, ids and cookie the shell and its pane share, so the toggle and skip link agree. */
const SHELL = {
	id: "parley",
	labels: SHELL_LABELS,
	cookieName: SHELL_COOKIE,
	cookiePath: demoAppCookiePath(SLUG),
} as const;

namespace ParleyApp {
	export interface Props {
		current: Section;
		collapsed: boolean;
		unread: Record<string, Unread>;
		/** The screen's address, which the main frame loads. */
		src: string;
		/** The pane drawn in place of the frame, for a post answered as a whole page. */
		pane?: RemixNode;
	}
}

/**
 * Renders Parley's document: the sidebar, the switcher and the keyboard help around the main
 * frame, and the island that keeps the shell in step as that frame swaps.
 */
export function ParleyApp(handle: Handle<ParleyApp.Props>) {
	return () => {
		let { current, collapsed, unread, src, pane } = handle.props;
		return (
			<>
				<AppShell
					{...SHELL}
					collapsed={collapsed}
					indicator="fill"
					workspace={
						<>
							<AppShell.Identity
								avatar={<ParleyMark />}
								name="Fernhill"
								detail="Parley · 9 members"
								commandfor="parley-workspace-menu"
								command="toggle-popover"
							/>
							<WorkspaceMenu
								id="parley-workspace-menu"
								label="Switch workspace"
								current={{ name: "Fernhill", href: href() }}
								others={["Sprout beta testers"]}
							/>
						</>
					}
					nav={<ParleyNav current={current} unread={unread} />}
					footer={
						<>
							<AppShell.Identity
								avatar={<Face person={ME} size="sm" presence />}
								name={ME.name}
								detail="Active"
								commandfor="parley-user-menu"
								command="toggle-popover"
							/>
							<UserMenu
								id="parley-user-menu"
								label="Account"
								helpId={HELP_ID}
								extra={
									<form
										method="post"
										action={actionHref("reset")}
										data-rmx-document=""
										mix={[raw({ display: "contents" })]}
									>
										<button
											type="submit"
											role="menuitem"
											mix={[
												raw({
													all: "unset",
													boxSizing: "border-box",
													display: "flex",
													inlineSize: "100%",
													paddingInline: "0.5rem",
													paddingBlock: "0.375rem",
													borderRadius: "var(--ui-radius-sm)",
													fontSize: "0.875rem",
													cursor: "pointer",
													"&:hover, &:focus-visible": {
														backgroundColor: "var(--ui-neutral-bg-tint-hover)",
													},
												}),
											]}
										>
											Reset the demo
										</button>
									</form>
								}
							/>
						</>
					}
					pane={pane ?? <MainFrame src={src} />}
				/>
				<MainFrameSync root={href()} />
				<ParleyEmoji />
				<ParleySwitcher />
				<KeyboardHelp id={HELP_ID} labels={HELP_LABELS} groups={HELP_GROUPS} />
			</>
		);
	};
}

namespace ParleyPane {
	export interface Props {
		collapsed: boolean;
		/** What the top bar names, such as "#launch-v3"; it stands in for a crumb. */
		title: RemixNode;
		/** A second line under the title on wide screens, such as the channel's topic. */
		detail?: RemixNode;
		/** On a phone, the screen this one stacks on, which the top bar links back to. */
		back?: string;
		/** The screen's own controls at the top bar's end. */
		actions?: RemixNode;
		/** Drops the content padding, for a conversation drawn edge to edge. */
		flush?: boolean;
		children: RemixNode;
	}
}

/**
 * Renders a screen inside the main frame: the top bar with its title, its phone back link
 * and its controls, the switcher's trigger and the keyboard help, over the screen.
 */
export function ParleyPane(handle: Handle<ParleyPane.Props>) {
	return () => {
		let { collapsed, title, detail, back, actions, flush, children } = handle.props;
		let pane = (
			<AppShell.Pane
				{...SHELL}
				collapsed={collapsed}
				topbar={
					<>
						{back === undefined ? null : (
							<span
								mix={[
									raw({ display: "contents" }),
									media("(min-width: 48rem)", raw({ display: "none" })),
								]}
							>
								<LinkButton
									href={back}
									{...TO_MAIN}
									variant="ghost"
									color="neutral"
									size="sm"
									aria-label="Back to conversations"
									mix={[raw({ inlineSize: "2rem", paddingInline: "0" })]}
								>
									<ArrowLeftIcon size={18} aria-hidden="true" />
								</LinkButton>
							</span>
						)}
						<span mix={[grow(), raw({ display: "grid", minInlineSize: "0" })]}>
							<h1 mix={[truncate(), text("sm"), weight("semibold"), raw({ margin: "0" })]}>
								{title}
							</h1>
							{detail === undefined ? null : (
								<span
									mix={[
										truncate(),
										text("xs"),
										fg("neutral.muted"),
										media("(max-width: 40rem)", raw({ display: "none" })),
									]}
								>
									{detail}
								</span>
							)}
						</span>
						{actions}
						<CommandPalette.Trigger
							for={PALETTE_ID}
							aria-label="Jump to a conversation"
							mix={[
								media(
									"(max-width: 64rem)",
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
							Jump to…
						</CommandPalette.Trigger>
						<span
							mix={[
								raw({ display: "contents" }),
								media("(max-width: 40rem)", raw({ display: "none" })),
							]}
						>
							<Button
								type="button"
								variant="ghost"
								color="neutral"
								size="sm"
								commandfor={HELP_ID}
								command="show-modal"
								aria-label={HELP_LABELS.open}
								title={HELP_LABELS.open}
								mix={[raw({ inlineSize: "2rem", paddingInline: "0" })]}
							>
								<KeyboardIcon size={16} aria-hidden="true" />
							</Button>
						</span>
					</>
				}
			>
				<HeadingScope level={2}>{children}</HeadingScope>
			</AppShell.Pane>
		);
		return flush ? (
			<div mix={[raw({ display: "contents", "--ui-app-content-padding": "0px" })]}>{pane}</div>
		) : (
			pane
		);
	};
}
