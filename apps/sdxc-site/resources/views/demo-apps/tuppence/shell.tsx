/**
 * Tuppence's frame: on a desktop an `AppShell` whose sidebar names money tasks and lists the
 * currency accounts, on a phone a bottom tab bar under the thumb. "Send money" stays in the
 * top bar at every width, and the user menu resets the demo.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppShell as AppShellTypes } from "@sdxc/ui/app/app-shell";
import type { Handle, RemixNode } from "remix/component";

import {
	ChartPieIcon,
	CreditCardIcon,
	HouseIcon,
	ListIcon,
	PiggyBankIcon,
	RepeatIcon,
	RotateCwIcon,
	SendIcon,
	TargetIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { media } from "@sdxc/u/responsive";
import { LinkButton, Menu } from "@sdxc/ui";
import { AppShell } from "@sdxc/ui/app/app-shell";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import { TabBar } from "@sdxc/ui/app/tab-bar";

import { demoAppCookiePath } from "~/resources/views/demo-apps";
import { UserMenu } from "~/resources/views/demo-apps/account-menus";
import { MainFrameSync } from "~/resources/views/demo-apps/main-frame-sync";

import { ACCOUNTS, HOLDER, SLUG, actionHref, href } from "./data";
import { SERIF } from "./parts";

/** The destinations the nav marks; `accounts/<id>` marks its account row. */
export type Destination =
	| "home"
	| "transactions"
	| "spending"
	| "budgets"
	| "pots"
	| "recurring"
	| "cards"
	| "transfer"
	| `account-${string}`
	| "none";

/** The shell's strings. */
const LABELS: AppShellTypes.Labels = {
	nav: "Main",
	skip: "Skip to content",
	menu: "Open navigation",
	close: "Close navigation",
	collapse: "Collapse sidebar",
};

/** The keyboard help sheet's id, which the user menu's shortcuts item opens. */
const HELP_ID = "tuppence-keys";

/** The keyboard help sheet's strings. */
const HELP_LABELS: KeyboardHelp.Labels = {
	title: "Keyboard shortcuts",
	close: "Close",
	or: "or",
	open: "Show keyboard shortcuts",
	general: "General",
	other: "More",
};

/** The keys every screen answers, beside the ones a page declares with `data-shortcut`. */
const HELP_GROUPS: KeyboardHelp.Group[] = [
	{ title: "General", shortcuts: [{ keys: "?", label: "Show keyboard shortcuts" }] },
];

/** The id of the hidden form the user menu's reset item submits. */
const RESET_FORM = "tuppence-reset";

/**
 * Tuppence's mark: two overlapping coins, the larger in the brand's clay and the smaller
 * stamped over it, drawn rather than borrowed from any bank.
 */
export function TuppenceMark(handle: Handle<{ size?: number }>) {
	return () => {
		let size = handle.props.size ?? 24;
		return (
			<svg
				viewBox="0 0 32 32"
				width={size}
				height={size}
				aria-hidden="true"
				data-slot="tuppence-mark"
				mix={raw({ display: "block", flex: "none" })}
			>
				<rect width="32" height="32" rx="9" fill="var(--ui-brand-bg-solid)" />
				<circle
					cx="13"
					cy="16"
					r="7.5"
					fill="none"
					stroke="var(--ui-brand-fg-on-solid, white)"
					stroke-width="2.2"
				/>
				<circle
					cx="19.5"
					cy="16"
					r="7.5"
					fill="var(--ui-brand-fg-on-solid, white)"
					opacity="0.92"
				/>
				<path
					d="M19.5 12.2v7.6M17 14.2h5"
					stroke="var(--ui-brand-bg-solid)"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			</svg>
		);
	};
}

/** A 24px avatar of the holder's initials. */
function HolderAvatar() {
	return () => (
		<span
			aria-hidden="true"
			mix={raw({
				display: "grid",
				placeItems: "center",
				inlineSize: "1.5rem",
				blockSize: "1.5rem",
				borderRadius: "999px",
				fontSize: "0.625rem",
				fontWeight: "650",
				backgroundColor: "oklch(0.86 0.06 160)",
				color: "oklch(0.32 0.07 160)",
			})}
		>
			{HOLDER.initials}
		</span>
	);
}

namespace NavItem {
	export interface Props {
		current: Destination;
		id: Destination;
		/** The page path under the app. */
		page: string;
		label: string;
		icon: RemixNode;
	}
}

/** One sidebar row, marked current when its destination is the screen's. */
function NavItem(handle: Handle<NavItem.Props>) {
	return () => {
		let { current, id, page, label, icon } = handle.props;
		return (
			<AppShell.Item
				data-rmx-prefetch="intent"
				href={href(page)}
				icon={icon}
				label={label}
				data-main-nav={id}
				current={current === id}
			/>
		);
	};
}

/** The main nav: money tasks, then the currency accounts. */
function MainNav(handle: Handle<{ current: Destination }>) {
	return () => {
		let { current } = handle.props;
		return (
			<>
				<AppShell.Group>
					<NavItem current={current} id="home" page="" label="Home" icon={<HouseIcon />} />
					<NavItem
						current={current}
						id="transactions"
						page="transactions"
						label="Transactions"
						icon={<ListIcon />}
					/>
					<NavItem
						current={current}
						id="spending"
						page="spending"
						label="Spending"
						icon={<ChartPieIcon />}
					/>
					<NavItem
						current={current}
						id="budgets"
						page="budgets"
						label="Budgets"
						icon={<TargetIcon />}
					/>
					<NavItem current={current} id="pots" page="pots" label="Pots" icon={<PiggyBankIcon />} />
					<NavItem
						current={current}
						id="recurring"
						page="recurring"
						label="Bills & subscriptions"
						icon={<RepeatIcon />}
					/>
					<NavItem
						current={current}
						id="cards"
						page="cards"
						label="Cards"
						icon={<CreditCardIcon />}
					/>
				</AppShell.Group>
				<AppShell.Group title="Accounts">
					{ACCOUNTS.map((account) => (
						<NavItem
							current={current}
							id={`account-${account.id}`}
							page={`accounts/${account.id}`}
							label={`${account.name} · ${account.currency}`}
							icon={
								<span
									aria-hidden="true"
									mix={raw({
										display: "inline-grid",
										placeItems: "center",
										inlineSize: "1rem",
										fontFamily: SERIF,
										fontWeight: "700",
										fontSize: "0.9375rem",
									})}
								>
									{account.symbol}
								</span>
							}
						/>
					))}
				</AppShell.Group>
			</>
		);
	};
}

namespace TuppenceShell {
	export interface Props {
		/** The destination the nav marks on first paint; the sync island keeps it current after. */
		current: Destination;
		/** The sidebar's collapse state, from the visitor's cookie. */
		collapsed: boolean;
		/** The `main` frame. */
		children: RemixNode;
	}
}

/**
 * Renders the frame around every screen. The tab bar's items carry `data-main-nav` like the
 * sidebar's, so after a swap the sync island marks the same destination in both.
 */
export default function TuppenceShell(handle: Handle<TuppenceShell.Props>) {
	return () => {
		let { current, collapsed, children } = handle.props;
		return (
			<AppShell
				cookiePath={demoAppCookiePath(SLUG)}
				id="tuppence"
				labels={LABELS}
				collapsed={collapsed}
				indicator="fill"
				workspace={
					<a
						href={href()}
						aria-label="Tuppence home"
						mix={raw({
							display: "flex",
							alignItems: "center",
							gap: "0.625rem",
							padding: "0.375rem 0.5rem",
							color: "inherit",
							textDecoration: "none",
							fontFamily: SERIF,
							fontSize: "1.125rem",
							fontWeight: "700",
							letterSpacing: "-0.01em",
						})}
					>
						<TuppenceMark size={28} />
						<span data-slot="tuppence-wordmark">Tuppence</span>
					</a>
				}
				nav={<MainNav current={current} />}
				footer={
					<>
						<AppShell.Identity
							avatar={<HolderAvatar />}
							name={HOLDER.name}
							detail={HOLDER.email}
							commandfor="tuppence-user-menu"
							command="toggle-popover"
						/>
						<UserMenu
							id="tuppence-user-menu"
							label="Account"
							helpId={HELP_ID}
							extra={
								<Menu.Item type="submit" form={RESET_FORM}>
									<RotateCwIcon />
									Reset the demo
								</Menu.Item>
							}
						/>
						<form
							id={RESET_FORM}
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
							mix={raw({
								flex: "1",
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								fontWeight: "600",
							})}
						>
							<span mix={media("(min-width: 48rem)", visuallyHidden())}>Tuppence</span>
						</span>
						<LinkButton
							href={href("transfer")}
							size="sm"
							color="brand"
							data-rmx-prefetch="intent"
							data-shortcut="s"
							data-shortcut-label="Send money"
							data-shortcut-group="Money"
						>
							<SendIcon size={16} aria-hidden="true" />
							Send money
						</LinkButton>
					</>
				}
			>
				{children}
				<TabBar label="Primary" hideFrom="48rem">
					<TabBar.Item
						href={href()}
						icon={<HouseIcon />}
						label="Home"
						data-main-nav="home"
						current={current === "home"}
						data-rmx-prefetch="intent"
					/>
					<TabBar.Item
						href={href("transactions")}
						icon={<ListIcon />}
						label="Activity"
						data-main-nav="transactions"
						current={current === "transactions"}
						data-rmx-prefetch="intent"
					/>
					<TabBar.Item
						href={href("spending")}
						icon={<ChartPieIcon />}
						label="Spending"
						data-main-nav="spending"
						current={current === "spending"}
						data-rmx-prefetch="intent"
					/>
					<TabBar.Item
						href={href("pots")}
						icon={<PiggyBankIcon />}
						label="Pots"
						data-main-nav="pots"
						current={current === "pots"}
						data-rmx-prefetch="intent"
					/>
					<TabBar.Item
						href={href("cards")}
						icon={<CreditCardIcon />}
						label="Cards"
						data-main-nav="cards"
						current={current === "cards"}
						data-rmx-prefetch="intent"
					/>
				</TabBar>
				<MainFrameSync root={href()} />
				<KeyboardHelp id={HELP_ID} labels={HELP_LABELS} groups={HELP_GROUPS} />
			</AppShell>
		);
	};
}
