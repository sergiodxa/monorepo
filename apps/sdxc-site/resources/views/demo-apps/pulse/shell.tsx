/**
 * Pulse's frame: one `AppShell` whose sidebar names destinations by task, carries the down
 * count on Services, and swaps to the settings sections behind a "‹ Settings" row, with the
 * billing banner above it until the invoice is paid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	BellIcon,
	CreditCardIcon,
	GlobeIcon,
	LayoutDashboardIcon,
	RocketIcon,
	ServerIcon,
	SettingsIcon,
	SirenIcon,
	TriangleAlertIcon,
} from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, text, weight } from "@sdxc/u/typography";
import { Banner, LinkButton } from "@sdxc/ui";
import { AppShell, readAppShellCookie } from "@sdxc/ui/app/app-shell";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";

import type { DemoAppRequest } from "~/resources/views/demo-apps";

import { demoAppCookiePath } from "~/resources/views/demo-apps";
import { UserMenu, WorkspaceMenu } from "~/resources/views/demo-apps/account-menus";

import { href, INCIDENTS, SERVICES } from "./data";
import { COPY, SHELL } from "./labels";

/** The keyboard help sheet's id, which the user menu's shortcuts item opens. */
const HELP_ID = "pulse-keys";

/** The keyboard help sheet's strings. */
const HELP_LABELS: KeyboardHelp.Labels = {
	title: "Keyboard shortcuts",
	close: "Close",
	or: "or",
	open: "Show keyboard shortcuts",
	general: "General",
	other: "More",
};

/** The keys the services list answers, beside the ones a page declares with `data-shortcut`. */
const HELP_GROUPS: KeyboardHelp.Group[] = [
	{
		title: "Services",
		shortcuts: [
			{ keys: ["j", "arrowdown"], label: "Next service" },
			{ keys: ["k", "arrowup"], label: "Previous service" },
			{ keys: "enter", label: "Open service" },
			{ keys: "space", label: "Peek at service" },
			{ keys: "x", label: "Select service" },
			{ keys: "/", label: "Search services" },
		],
	},
	{ title: "General", shortcuts: [{ keys: "?", label: "Show keyboard shortcuts" }] },
];

/** The destinations the main nav names; `null` on a screen none of them owns. */
export type PulseSection = "overview" | "services" | "deployments" | "incidents" | "status-pages";

/** The settings sections the swapped panel names. */
export type PulseSettingsSection = "general" | "notifications" | "billing";

namespace PulseShell {
	export interface Props {
		request: DemoAppRequest;
		/** The main nav entry to mark current. */
		section?: PulseSection | null;
		/** Swaps the nav for the settings panel, with this section current. */
		settings?: PulseSettingsSection;
		children: RemixNode;
	}
}

/** A 24px square of initials, standing in for the workspace logo or a person's avatar. */
function Initials(handle: Handle<{ letters: string; tone: "brand" | "neutral" }>) {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					inlineSize: "1.5rem",
					blockSize: "1.5rem",
					borderRadius: "var(--ui-radius-md)",
					fontSize: "0.6875rem",
					letterSpacing: "0.02em",
				}),
				font("mono"),
				weight("semibold"),
				handle.props.tone === "brand"
					? [bg("brand.solid"), fg("brand.onSolid")]
					: bg("neutral.bg-tint-pressed"),
			]}
		>
			{handle.props.letters}
		</span>
	);
}

/** The main nav, with the down count on Services and the open count on Incidents. */
function MainNav(handle: Handle<{ section: PulseSection | null }>) {
	return () => {
		let { section } = handle.props;
		let down = SERVICES.filter((service) => service.status === "down").length;
		let open = INCIDENTS.filter((incident) => incident.status !== "resolved").length;
		return (
			<>
				<AppShell.Group>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href()}
						icon={<LayoutDashboardIcon />}
						label={COPY.nav.overview}
						current={section === "overview"}
					/>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("services")}
						icon={<ServerIcon />}
						label={COPY.nav.services}
						count={down}
						countTone="danger"
						countLabel={COPY.nav.servicesDown(down)}
						current={section === "services"}
					/>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("deployments")}
						icon={<RocketIcon />}
						label={COPY.nav.deployments}
						current={section === "deployments"}
					/>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("incidents")}
						icon={<SirenIcon />}
						label={COPY.nav.incidents}
						count={open}
						countTone="warning"
						countLabel={COPY.nav.incidentsOpen(open)}
						current={section === "incidents"}
					/>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("status-pages")}
						icon={<GlobeIcon />}
						label={COPY.nav.statusPages}
						current={section === "status-pages"}
					/>
				</AppShell.Group>
				<AppShell.Group title={COPY.nav.workspace}>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("settings")}
						icon={<SettingsIcon />}
						label={COPY.nav.settings}
					/>
				</AppShell.Group>
			</>
		);
	};
}

/** The settings panel that replaces the main nav, so the sidebar never stacks two scopes. */
function SettingsNav(handle: Handle<{ section: PulseSettingsSection }>) {
	return () => {
		let { section } = handle.props;
		return (
			<>
				<AppShell.Back href={href()} label={COPY.nav.settings} />
				<AppShell.Group title={COPY.nav.workspace}>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("settings")}
						icon={<SettingsIcon />}
						label={COPY.nav.general}
						current={section === "general"}
					/>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("settings/notifications")}
						icon={<BellIcon />}
						label={COPY.nav.notifications}
						current={section === "notifications"}
					/>
					<AppShell.Item
						data-rmx-prefetch="intent"
						href={href("settings/billing")}
						icon={<CreditCardIcon />}
						label={COPY.nav.billing}
						current={section === "billing"}
					/>
				</AppShell.Group>
			</>
		);
	};
}

/**
 * Renders a Pulse screen inside its frame. The sidebar's collapsed state comes from the
 * visitor's cookie, so a reload paints the rail at the width they left it.
 */
export default function PulseShell(handle: Handle<PulseShell.Props>) {
	return () => {
		let { request, section = null, settings, children } = handle.props;
		return (
			<AppShell
				cookiePath={demoAppCookiePath("pulse")}
				id="pulse-shell"
				labels={SHELL}
				collapsed={readAppShellCookie(request.cookie)}
				workspace={
					<>
						<AppShell.Identity
							avatar={<Initials letters="NW" tone="brand" />}
							name={COPY.workspace}
							detail={COPY.plan}
							commandfor="pulse-workspace-menu"
							command="toggle-popover"
						/>
						<WorkspaceMenu
							id="pulse-workspace-menu"
							label="Switch workspace"
							current={{ name: COPY.workspace, href: href() }}
							others={["Northwind staging", "Harbor Labs"]}
						/>
					</>
				}
				nav={
					settings === undefined ? (
						<MainNav section={section} />
					) : (
						<SettingsNav section={settings} />
					)
				}
				footer={
					<>
						<AppShell.Identity
							avatar={<Initials letters="PR" tone="neutral" />}
							name={COPY.user}
							detail={COPY.email}
							commandfor="pulse-user-menu"
							command="toggle-popover"
						/>
						<UserMenu
							id="pulse-user-menu"
							label="Account"
							profileHref={href("settings/notifications")}
							settingsHref={href("settings")}
							helpId={HELP_ID}
						/>
					</>
				}
				topbar={
					<span mix={[text("sm"), weight("semibold"), font("mono"), fg("neutral.emphasis")]}>
						{COPY.app}
					</span>
				}
				banner={
					<Banner
						label={COPY.banner.label}
						color="danger"
						icon={<TriangleAlertIcon />}
						action={
							<LinkButton
								href={href("settings/billing")}
								size="sm"
								color="danger"
								variant="outline"
							>
								{COPY.banner.action}
							</LinkButton>
						}
					>
						{COPY.banner.text}
					</Banner>
				}
			>
				{children}
				<KeyboardHelp id={HELP_ID} labels={HELP_LABELS} groups={HELP_GROUPS} />
			</AppShell>
		);
	};
}
