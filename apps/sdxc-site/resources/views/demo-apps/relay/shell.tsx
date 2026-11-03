/**
 * Relay's frame: one sidebar holding the mailboxes, the saved views and the other modes,
 * a top bar with the command menu and keyboard help, so every screen sits in the same shell
 * and the sidebar never changes shape between the inbox and contacts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	AlarmClockIcon,
	ArchiveIcon,
	BugIcon,
	BuildingComplexIcon,
	ChartLineIcon,
	CreditCardIcon,
	FlaskConicalIcon,
	InboxIcon,
	KeyboardIcon,
	MessageSquareIcon,
	SettingsIcon,
	StarIcon,
	UserRoundIcon,
	UserRoundXIcon,
	UsersIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { grow } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { text, truncate, weight } from "@sdxc/u/typography";
import { Button } from "@sdxc/ui";
import { AppShell } from "@sdxc/ui/app/app-shell";
import { CommandPalette } from "@sdxc/ui/app/command-palette";

import type { ViewIcon } from "~/resources/views/demo-apps/relay/views";

import { UserMenu, WorkspaceMenu } from "~/resources/views/demo-apps/account-menus";
import { CONTACTS, CONVERSATIONS, findContact } from "~/resources/views/demo-apps/relay/data";
import { HELP_ID, RelayKeyboardHelp } from "~/resources/views/demo-apps/relay/keyboard-help";
import {
	HELP_LABELS,
	PALETTE_LABELS,
	SHELL_LABELS,
} from "~/resources/views/demo-apps/relay/labels";
import {
	VIEWS,
	conversationPage,
	findView,
	href,
	viewCount,
	viewPage,
} from "~/resources/views/demo-apps/relay/views";

/** The cookie Relay's collapsed sidebar is remembered in, apart from the other demos'. */
export const SHELL_COOKIE = "relay-sidebar";

/** The id of the command palette every screen opens with ⌘K. */
const PALETTE_ID = "relay-palette";

/** Which sidebar row a screen marks as the one shown. */
export type ShellSection = `view:${string}` | "contacts" | "reports" | "settings" | "none";

namespace RelayShell {
	export interface Props {
		/** The sidebar row to mark current. */
		current: ShellSection;
		/** The remembered collapsed sidebar, from {@link SHELL_COOKIE}. */
		collapsed: boolean;
		/** Where the person is, shown in the top bar. */
		crumb: string;
		/** Drops the content padding, for the inbox's edge-to-edge panes. */
		flush?: boolean;
		children: RemixNode;
	}
}

/**
 * Draws a view's sidebar glyph.
 *
 * @param icon The view's icon name.
 * @returns A 16px icon.
 */
function viewIcon(icon: ViewIcon): RemixNode {
	switch (icon) {
		case "inbox":
			return <InboxIcon />;
		case "mine":
			return <UserRoundIcon />;
		case "unassigned":
			return <UserRoundXIcon />;
		case "starred":
			return <StarIcon />;
		case "snoozed":
			return <AlarmClockIcon />;
		case "archived":
			return <ArchiveIcon />;
		case "billing":
			return <CreditCardIcon />;
		case "bug":
			return <BugIcon />;
		case "enterprise":
			return <BuildingComplexIcon />;
	}
}

/** Relay's mark: a blue tile with two arrows passing a message along. */
export function RelayMark() {
	return () => (
		<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
			<rect width="24" height="24" rx="6" fill="var(--ui-color-brand-600)" />
			<path
				d="M6.5 8.5h7.5l3.5 3.5-3.5 3.5H6.5l3.5-3.5z"
				fill="none"
				stroke="white"
				stroke-width="1.75"
				stroke-linejoin="round"
			/>
		</svg>
	);
}

/** A 24px initials tile for the signed-in person in the sidebar's foot. */
function Initials(handle: Handle<{ letters: string }>) {
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
					background: "var(--ui-neutral-bg-tint-pressed)",
				}),
				weight("semibold"),
			]}
		>
			{handle.props.letters}
		</span>
	);
}

/** The sidebar's rows: mailboxes with unread pills, saved views, then the other modes. */
function RelayNav(handle: Handle<{ current: ShellSection }>) {
	return () => {
		let { current } = handle.props;
		let row = (slug: string) => {
			let view = findView(slug);
			if (view === undefined) return null;
			let count = viewCount(view);
			return (
				<AppShell.Item
					data-rmx-prefetch="intent"
					href={href(viewPage(view))}
					icon={viewIcon(view.icon)}
					label={view.label}
					count={count}
					countTone={view.counts === "unread" && view.slug === "inbox" ? "brand" : "neutral"}
					countLabel={view.counts === "all" ? `${count} conversations` : `${count} unread`}
					unread={view.counts === "unread" && count > 0}
					current={current === `view:${view.slug}`}
					data-shortcut={view.shortcut}
					data-shortcut-label={view.shortcut ? `Go to ${view.label}` : undefined}
					data-shortcut-group={view.shortcut ? "Navigation" : undefined}
				/>
			);
		};

		return (
			<>
				<AppShell.Group>
					{VIEWS.filter((view) => view.section === "mailboxes").map((view) => row(view.slug))}
				</AppShell.Group>
				<AppShell.Group title="Views">
					{VIEWS.filter((view) => view.section === "views").map((view) => row(view.slug))}
				</AppShell.Group>
				<AppShell.Group title="Customers">
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("contacts")}
						icon={<UsersIcon />}
						label="Contacts"
						current={current === "contacts"}
						data-shortcut="g c"
						data-shortcut-label="Go to Contacts"
						data-shortcut-group="Navigation"
					/>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("reports")}
						icon={<ChartLineIcon />}
						label="Reports"
						current={current === "reports"}
						data-shortcut="g r"
						data-shortcut-label="Go to Reports"
						data-shortcut-group="Navigation"
					/>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("settings")}
						icon={<SettingsIcon />}
						label="Settings"
						active={current === "settings"}
						data-shortcut="g s"
						data-shortcut-label="Go to Settings"
						data-shortcut-group="Navigation"
					/>
				</AppShell.Group>
				<AppShell.Group title="Demo states">
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("contacts?state=loading")}
						icon={<FlaskConicalIcon />}
						label="Contacts loading"
					/>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("contacts?state=first-run")}
						icon={<FlaskConicalIcon />}
						label="No contacts yet"
					/>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("reports?state=error")}
						icon={<FlaskConicalIcon />}
						label="Report failed"
					/>
				</AppShell.Group>
			</>
		);
	};
}

/**
 * The command menu: jump to any mailbox, conversation or contact by name. Conversations open
 * in the inbox so the list stays beside them.
 */
function RelayPalette() {
	return () => {
		let inbox = findView("inbox");
		return (
			<CommandPalette
				id={PALETTE_ID}
				labels={PALETTE_LABELS}
				recent={["go-inbox", "go-contacts"]}
				remember="relay:palette"
			>
				<CommandPalette.Group heading="Navigation">
					{VIEWS.map((view) => (
						<CommandPalette.Item
							id={`go-${view.slug}`}
							title={`Go to ${view.label}`}
							icon={viewIcon(view.icon)}
							href={href(viewPage(view))}
							shortcut={view.shortcut}
						/>
					))}
					<CommandPalette.Item
						id="go-contacts"
						title="Go to Contacts"
						icon={<UsersIcon />}
						href={href("contacts")}
						shortcut="g c"
					/>
					<CommandPalette.Item
						id="go-reports"
						title="Go to Reports"
						icon={<ChartLineIcon />}
						href={href("reports")}
						shortcut="g r"
					/>
					<CommandPalette.Item
						id="go-settings"
						title="Go to Settings"
						icon={<SettingsIcon />}
						href={href("settings")}
						shortcut="g s"
					/>
				</CommandPalette.Group>
				<CommandPalette.Group heading="Conversations">
					{CONVERSATIONS.filter((conversation) => conversation.status === "open").map(
						(conversation) => {
							let contact = findContact(conversation.contactId);
							return (
								<CommandPalette.Item
									id={`conversation-${conversation.id}`}
									title={conversation.subject}
									description={contact?.name}
									keywords={contact ? [contact.name, contact.email] : []}
									icon={<MessageSquareIcon />}
									href={inbox ? href(conversationPage(inbox, conversation.id)) : href()}
								/>
							);
						},
					)}
				</CommandPalette.Group>
				<CommandPalette.Group heading="Contacts">
					{CONTACTS.map((contact) => (
						<CommandPalette.Item
							id={`contact-${contact.id}`}
							title={contact.name}
							description={contact.email}
							keywords={[contact.email, contact.title]}
							icon={<UserRoundIcon />}
							href={href(`contacts/${contact.id}`)}
						/>
					))}
				</CommandPalette.Group>
			</CommandPalette>
		);
	};
}

/**
 * Renders a Relay screen inside the shell, with the command menu and the keyboard help on
 * every page so ⌘K and `?` answer wherever the person is.
 */
export function RelayShell(handle: Handle<RelayShell.Props>) {
	return () => {
		let { current, collapsed, crumb, flush, children } = handle.props;

		let shell = (
			<AppShell
				id="relay"
				labels={SHELL_LABELS}
				collapsed={collapsed}
				cookieName={SHELL_COOKIE}
				indicator="fill"
				sheetBelow="64rem"
				workspace={
					<>
						<AppShell.Identity
							avatar={<RelayMark />}
							name="Relay"
							detail="Fernway support"
							commandfor="relay-workspace-menu"
							command="toggle-popover"
						/>
						<WorkspaceMenu
							id="relay-workspace-menu"
							label="Switch workspace"
							current={{ name: "Fernway support", href: href() }}
							others={["Fernway sales", "Fernway partners"]}
						/>
					</>
				}
				nav={<RelayNav current={current} />}
				footer={
					<>
						<AppShell.Identity
							avatar={<Initials letters="NH" />}
							name="Noor Haddad"
							detail="noor@fernway.app"
							commandfor="relay-user-menu"
							command="toggle-popover"
						/>
						<UserMenu
							id="relay-user-menu"
							label="Account"
							profileHref={href("settings/signature")}
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
						>
							<KeyboardIcon size={16} aria-hidden="true" />
						</Button>
					</>
				}
			>
				{children}
				<RelayPalette />
				<RelayKeyboardHelp />
			</AppShell>
		);

		return flush ? (
			<div mix={[raw({ display: "contents", "--ui-app-content-padding": "0px" })]}>{shell}</div>
		) : (
			shell
		);
	};
}
