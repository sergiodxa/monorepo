/**
 * Wayfern's chrome: a quiet top bar with the mark, a slot for the screen's search, the trips
 * and wishlists links and the account menu; on a phone the destinations move to a tab bar under
 * the thumb. It renders inside the `main` frame, so a booking or a reset redraws it too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { CompassIcon, HeartIcon, LuggageIcon, MenuIcon, RotateCcwIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { Menu } from "@sdxc/ui";
import { TabBar } from "@sdxc/ui/app/tab-bar";

import routes from "~/routes/web";

import { WayfernMark } from "./art";
import { TRAVELLER, actionHref, href } from "./data";
import { GUTTER, MEASURE, TOP_BAR, WIDE } from "./layout";
import { HostFace } from "./parts";

/** Which destination a screen belongs to. */
export type Destination = "explore" | "wishlists" | "trips" | "none";

/** The destinations in tab order. */
const DESTINATIONS = [
	{ id: "explore", label: "Explore", page: "", icon: CompassIcon },
	{ id: "wishlists", label: "Wishlists", page: "wishlists", icon: HeartIcon },
	{ id: "trips", label: "Trips", page: "trips", icon: LuggageIcon },
] as const;

/** The account menu's id, which the account button toggles. */
const ACCOUNT_MENU = "wayfern-account-menu";

/** The wordmark: the arch mark beside the name set in the display serif. */
function Wordmark() {
	return () => (
		<a
			href={href()}
			aria-label="Wayfern home"
			data-rmx-prefetch="intent"
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.5rem",
					flexShrink: "0",
					color: "var(--ui-brand-fg-emphasis)",
					textDecoration: "none",
					fontFamily: "var(--ui-font-serif)",
					fontSize: "1.5rem",
					fontWeight: "600",
					letterSpacing: "-0.01em",
				}),
				when(
					"&:focus-visible",
					raw({
						outline: "2px solid var(--ui-brand-ring)",
						outlineOffset: "4px",
						borderRadius: "4px",
					}),
				),
			]}
		>
			<WayfernMark size={30} />
			<span
				aria-hidden="true"
				mix={[raw({ display: "none", "@media (min-width: 30rem)": { display: "inline" } })]}
			>
				wayfern
			</span>
		</a>
	);
}

/** A destination link in the wide top bar, underlined in the brand colour when current. */
function NavLink(handle: Handle<{ id: string; page: string; label: string; current: boolean }>) {
	return () => {
		let { current, id, label, page } = handle.props;
		return (
			<a
				href={href(page)}
				data-main-nav={id}
				data-rmx-prefetch="intent"
				aria-current={current ? "page" : undefined}
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						blockSize: "2.75rem",
						paddingInline: "0.875rem",
						borderRadius: "999px",
						fontSize: "0.9375rem",
						fontWeight: "550",
						color: "var(--ui-neutral-fg)",
						textDecoration: "none",
						transition: "background-color 140ms ease, color 140ms ease",
					}),
					when(
						"&:hover",
						raw({
							backgroundColor: "var(--ui-neutral-bg-tint)",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					),
					when(
						"&[aria-current='page']",
						raw({
							color: "var(--ui-brand-fg-emphasis)",
							backgroundColor: "var(--ui-brand-bg-tint)",
						}),
					),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "0" }),
					),
					motionReduce(raw({ transition: "none" })),
				]}
			>
				{label}
			</a>
		);
	};
}

/** The account menu: where the trips and lists are, putting the demo back, and leaving. */
function AccountMenu() {
	return () => (
		<>
			<button
				type="button"
				commandfor={ACCOUNT_MENU}
				command="toggle-popover"
				aria-label={`Account: ${TRAVELLER.name}`}
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						gap: "0.625rem",
						blockSize: "2.75rem",
						paddingInline: "0.75rem 0.3125rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "999px",
						background: "var(--ui-bg)",
						color: "var(--ui-neutral-fg)",
						cursor: "pointer",
						transition: "box-shadow 140ms ease",
					}),
					when("&:hover", raw({ boxShadow: "0 2px 8px rgb(0 0 0 / 0.12)" })),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
					),
					motionReduce(raw({ transition: "none" })),
				]}
			>
				<MenuIcon aria-hidden="true" size={18} />
				<HostFace name={TRAVELLER.name} hues={TRAVELLER.hues} size={2} />
			</button>
			<Menu id={ACCOUNT_MENU} placement="bottom-end" aria-label="Account">
				<Menu.Item href={href("trips")}>Trips</Menu.Item>
				<Menu.Item href={href("wishlists")}>Wishlists</Menu.Item>
				<Menu.Separator />
				<form
					method="post"
					action={actionHref("reset")}
					data-main-scroll-top=""
					mix={[raw({ display: "contents" })]}
				>
					<Menu.Item type="submit">
						<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.75rem" })]}>
							<RotateCcwIcon aria-hidden="true" size={18} />
							Reset the demo
						</span>
					</Menu.Item>
				</form>
				<Menu.Item href={routes.showcase.index.href(null, { searchParams: { kind: "demo" } })}>
					Sign out of Wayfern
				</Menu.Item>
			</Menu>
		</>
	);
}

namespace WayfernShell {
	export interface Props {
		/** The destination the bars mark as current. */
		current: Destination;
		/** The screen's search, shown in the middle of the top bar; nothing when omitted. */
		search?: RemixNode;
		/** A full-bleed screen, such as results beside their map, drops the footer. */
		bleed?: boolean;
		children: RemixNode;
	}
}

/**
 * Renders a screen in Wayfern's frame: the top bar, the screen, a short footer, and the phone's
 * tab bar. Every destination link names its nav key, so the browser marks the current one
 * after a swap.
 */
export default function WayfernShell(handle: Handle<WayfernShell.Props>) {
	return () => {
		let { bleed = false, children, current, search } = handle.props;
		return (
			<div
				data-wayfern-shell=""
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						minBlockSize: "100dvh",
						backgroundColor: "var(--ui-bg)",
						color: "var(--ui-neutral-fg)",
						paddingBlockEnd: "4.5rem",
						[`@media ${WIDE}`]: { paddingBlockEnd: "0" },
					}),
				]}
			>
				<a
					href="#wayfern-main"
					mix={[
						raw({
							position: "absolute",
							insetBlockStart: "-4rem",
							insetInlineStart: "1rem",
							zIndex: "40",
							padding: "0.5rem 0.75rem",
							borderRadius: "var(--ui-radius-md)",
							backgroundColor: "var(--ui-neutral-bg-solid)",
							color: "var(--ui-neutral-fg-on-solid)",
						}),
						when("&:focus", raw({ insetBlockStart: "1rem" })),
					]}
				>
					Skip to content
				</a>
				<header
					mix={[
						raw({
							position: "sticky",
							insetBlockStart: "0",
							zIndex: "30",
							display: "flex",
							alignItems: "center",
							gap: "1rem",
							minBlockSize: TOP_BAR,
							paddingInline: GUTTER,
							paddingBlock: "0.5rem",
							backgroundColor: "color-mix(in oklch, var(--ui-bg), transparent 4%)",
							backdropFilter: "blur(12px)",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<Wordmark />
					<div
						mix={[
							raw({
								flex: "1 1 auto",
								display: "flex",
								justifyContent: "center",
								minInlineSize: "0",
							}),
						]}
					>
						{search}
					</div>
					<nav
						aria-label="Primary"
						mix={[
							raw({ display: "none", [`@media ${WIDE}`]: { display: "flex", gap: "0.25rem" } }),
						]}
					>
						{DESTINATIONS.filter((destination) => destination.id !== "explore").map(
							(destination) => (
								<NavLink
									id={destination.id}
									page={destination.page}
									label={destination.label}
									current={destination.id === current}
								/>
							),
						)}
					</nav>
					<div mix={[raw({ display: "none", [`@media ${WIDE}`]: { display: "block" } })]}>
						<AccountMenu />
					</div>
				</header>
				<main id="wayfern-main" mix={[raw({ flex: "1 1 auto", minInlineSize: "0" })]}>
					{children}
				</main>
				{bleed ? null : (
					<footer
						mix={[
							raw({
								marginBlockStart: "3rem",
								paddingInline: GUTTER,
								paddingBlock: "2rem",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
								fontSize: "0.8125rem",
								lineHeight: "1.5",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						<div mix={[raw({ maxInlineSize: MEASURE, marginInline: "auto" })]}>
							Wayfern is an invented place to book stays, a demo of{" "}
							<a
								href={routes.showcase.index.href(null, { searchParams: { kind: "demo" } })}
								mix={[raw({ color: "inherit" })]}
							>
								sdxc.dev's components
							</a>
							. Every place, host and picture in it is made up, and no payment is ever taken.
						</div>
					</footer>
				)}
				<TabBar label="Primary" hideFrom="48rem">
					{DESTINATIONS.map((destination) => {
						let Icon = destination.icon;
						return (
							<TabBar.Item
								href={href(destination.page)}
								icon={<Icon />}
								label={destination.label}
								current={destination.id === current}
								data-main-nav={destination.id}
								data-rmx-prefetch="intent"
							/>
						);
					})}
				</TabBar>
			</div>
		);
	};
}

/**
 * A thin fern-green bar across the top of the window while a screen or post is loading in
 * `main`. It waits a beat before showing, so a fast swap never flashes it.
 */
export function LoadingBar() {
	return () => (
		<span
			aria-hidden="true"
			mix={[
				raw({
					position: "fixed",
					insetBlockStart: "0",
					insetInline: "0",
					zIndex: "60",
					blockSize: "3px",
					transformOrigin: "0 50%",
					backgroundColor: "var(--ui-color-brand-500)",
					opacity: "0",
					scale: "0 1",
					pointerEvents: "none",
					"@keyframes wayfern-loading": {
						"0%": { opacity: "0", scale: "0 1" },
						"10%": { opacity: "1", scale: "0.15 1" },
						"100%": { opacity: "1", scale: "0.9 1" },
					},
					":root[data-main-loading] &": {
						animation: "wayfern-loading 8s cubic-bezier(0.1, 0.6, 0.2, 1) 150ms both",
					},
				}),
				motionReduce(
					raw({
						":root[data-main-loading] &": { animation: "none", opacity: "1", scale: "1 1" },
					}),
				),
			]}
		/>
	);
}
