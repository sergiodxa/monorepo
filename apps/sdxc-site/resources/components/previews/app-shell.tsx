/**
 * Live preview for `AppShell`: an uptime monitoring app with a workspace switcher menu, its nav
 * grouped by task with two monitors down, a settings group and the account menu at the foot. On a
 * phone frame the same sidebar opens as a sheet from the top bar's menu button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	ActivityIcon,
	BellIcon,
	CreditCardIcon,
	GlobeIcon,
	KeyIcon,
	LayoutDashboardIcon,
	SirenIcon,
	UsersIcon,
} from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { text, weight } from "@sdxc/u/typography";
import { Badge, Button, Menu } from "@sdxc/ui";
import { AppShell } from "@sdxc/ui/app/app-shell";
import { PageHeader } from "@sdxc/ui/app/page-header";

/** Every string the preview shells show or announce. */
export const OPS_LABELS: AppShell.Labels = {
	nav: "Main",
	skip: "Skip to content",
	menu: "Open navigation",
	close: "Close navigation",
	collapse: "Collapse sidebar",
};

/** Props accepted by {@link Initials}. */
interface InitialsProps {
	letters: string;
	tone: "brand" | "neutral";
}

/** A 24px square of initials standing in for a workspace logo or a person's avatar. */
export function Initials(handle: Handle<InitialsProps>) {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					inlineSize: "1.5rem",
					blockSize: "1.5rem",
					borderRadius: "0.375rem",
					fontSize: "0.6875rem",
				}),
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

/** The ops app's main nav, with Monitors current and two of them down. */
export function OpsNav() {
	return () => (
		<>
			<AppShell.Group>
				<AppShell.Item href="#overview" icon={<LayoutDashboardIcon />} label="Overview" />
				<AppShell.Item
					href="#monitors"
					icon={<ActivityIcon />}
					label="Monitors"
					count={2}
					countTone="danger"
					countLabel="2 monitors down"
					current
				/>
				<AppShell.Item href="#incidents" icon={<SirenIcon />} label="Incidents" unread />
				<AppShell.Item href="#status-pages" icon={<GlobeIcon />} label="Status pages" />
			</AppShell.Group>
			<AppShell.Group title="Settings">
				<AppShell.Item href="#alerts" icon={<BellIcon />} label="Alert channels" />
				<AppShell.Item href="#team" icon={<UsersIcon />} label="Team" />
				<AppShell.Item href="#api-keys" icon={<KeyIcon />} label="API keys" />
				<AppShell.Item href="#billing" icon={<CreditCardIcon />} label="Billing" />
			</AppShell.Group>
		</>
	);
}

/** Props accepted by {@link OpsShell}. */
interface OpsShellProps {
	id: string;
	collapsed?: boolean;
	peek?: boolean;
	nav?: RemixNode;
	children?: RemixNode;
}

/** The ops app's whole frame, shared by the preview and its examples. */
export function OpsShell(handle: Handle<OpsShellProps>) {
	return () => {
		let { id, collapsed = false, peek = true, nav, children } = handle.props;
		return (
			<AppShell
				id={id}
				labels={OPS_LABELS}
				collapsed={collapsed}
				peek={peek}
				workspace={
					<>
						<AppShell.Identity
							avatar={<Initials letters="AO" tone="brand" />}
							name="Acme Ops"
							detail="Pro plan"
							commandfor={`${id}-workspace`}
							command="toggle-popover"
						/>
						<Menu id={`${id}-workspace`} aria-label="Workspace">
							<Menu.Item href="#workspaces">Switch workspace</Menu.Item>
							<Menu.Item href="#workspace-settings">Workspace settings</Menu.Item>
						</Menu>
					</>
				}
				nav={nav ?? <OpsNav />}
				footer={
					<>
						<AppShell.Identity
							avatar={<Initials letters="AL" tone="neutral" />}
							name="Ada Lovelace"
							detail="ada@acme.dev"
							commandfor={`${id}-account`}
							command="toggle-popover"
						/>
						<Menu id={`${id}-account`} placement="top-start" aria-label="Account">
							<Menu.Item href="#profile">Account settings</Menu.Item>
							<Menu.Separator />
							<Menu.Item danger>Sign out</Menu.Item>
						</Menu>
					</>
				}
				topbar={<span mix={[text("sm"), fg("neutral.muted")]}>Acme Ops / Monitors</span>}
			>
				{children ?? (
					<>
						<PageHeader
							title="Monitors"
							description="48 checks across 6 regions. Two are failing right now."
							status={
								<Badge color="danger" variant="secondary">
									2 down
								</Badge>
							}
							actions={
								<Button variant="outline" color="neutral" size="sm">
									Pause all
								</Button>
							}
							primaryAction={<Button size="sm">New monitor</Button>}
						/>
						<p mix={[text("sm"), fg("neutral.muted")]}>
							checkout-api and eu-west webhooks have failed their last 3 checks.
						</p>
					</>
				)}
			</AppShell>
		);
	};
}

/** The source the page shows, matching the markup below. */
const CODE = `<AppShell
	labels={labels}
	collapsed={readAppShellCookie(request.headers.get("Cookie"))}
	workspace={
		<>
			<AppShell.Identity avatar={<Logo />} name="Acme Ops" detail="Pro plan"
				commandfor="workspace-menu" command="toggle-popover" />
			<Menu id="workspace-menu" aria-label="Workspace">
				<Menu.Item href="/workspaces">Switch workspace</Menu.Item>
				<Menu.Item href="/settings">Workspace settings</Menu.Item>
			</Menu>
		</>
	}
	nav={
		<>
			<AppShell.Group>
				<AppShell.Item href="/overview" icon={<LayoutDashboardIcon />} label="Overview" />
				<AppShell.Item href="/monitors" icon={<ActivityIcon />} label="Monitors"
					count={2} countTone="danger" countLabel="2 monitors down" current />
				<AppShell.Item href="/incidents" icon={<SirenIcon />} label="Incidents" unread />
				<AppShell.Item href="/status-pages" icon={<GlobeIcon />} label="Status pages" />
			</AppShell.Group>
			<AppShell.Group title="Settings">
				<AppShell.Item href="/settings/team" icon={<UsersIcon />} label="Team" />
			</AppShell.Group>
		</>
	}
	footer={
		<>
			<AppShell.Identity avatar={<Avatar />} name="Ada Lovelace" detail="ada@acme.dev"
				commandfor="account-menu" command="toggle-popover" />
			<Menu id="account-menu" placement="top-start" aria-label="Account">
				<Menu.Item href="/settings/profile">Account settings</Menu.Item>
				<Menu.Separator />
				<Menu.Item danger>Sign out</Menu.Item>
			</Menu>
		</>
	}
	topbar={<Breadcrumbs>…</Breadcrumbs>}
>
	<PageHeader title="Monitors" primaryAction={<Button>New monitor</Button>} />
</AppShell>`;

/** What the preview registry reads: the source to show, and the shell to draw. */
export default {
	code: CODE,
	flush: true,
	viewports: true,
	render: () => <OpsShell id="preview-app-shell" />,
};
