/**
 * The frame every signed-in screen sits in: a tinted frame holding the sidebar and an inset
 * content card. The sidebar is one element that is a column, an icon rail when collapsed and a
 * sheet on phones, so the nav renders once and the server paints the width the person left.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronLeftIcon, ChevronsUpDownIcon, MenuIcon, XIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { hidden } from "@sdxc/u/layout";
import { media, supports } from "@sdxc/u/responsive";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { tabularNums, text, truncate, weight } from "@sdxc/u/typography";

import { Button } from "../components/button.js";

import { AppShellToggle } from "./app-shell-toggle.js";
import { APP_SHELL_COOKIE } from "./utils/app-shell-cookie.js";

export { APP_SHELL_COOKIE, readAppShellCookie } from "./utils/app-shell-cookie.js";

/** Width from which the sidebar docks beside the content; narrower, it is a sheet. */
const DOCKED = "(min-width: 48rem)";

/** Every width under {@link DOCKED}, where the sheet and its menu button take over. */
const SHEET = "(max-width: 47.9375rem)";

/** The shell while its collapse checkbox is checked, which is the server-rendered preference. */
const COLLAPSED = '[data-slot="app-shell"]:has([data-app-shell-collapse]:checked)';

/** The shell while its collapse checkbox is unchecked. */
const EXPANDED = '[data-slot="app-shell"]:not(:has([data-app-shell-collapse]:checked))';

/**
 * The collapsed sidebar's state while it stays a rail: always without peek, and otherwise until
 * a pointer rests on it or keyboard focus enters it.
 */
const RAIL_STATE = ':is([data-peek="false"], :not(:hover):not(:has(:focus-visible)))';

/** The collapsed sidebar's state while a resting pointer or keyboard focus opens it over the content. */
const PEEK_STATE = '[data-peek="true"]:is(:hover, :has(:focus-visible))';

/** The collapsed sidebar while it stays a rail, for rules on the parts inside it. */
const RAIL_SIDEBAR = `${COLLAPSED} [data-slot="app-shell-sidebar"]${RAIL_STATE}`;

/** The sidebar's width as a column, and as an overlay while it peeks. */
const SIDEBAR_WIDTH = "var(--ui-app-sidebar-width, 16rem)";

/** The collapsed rail's width. */
const RAIL_WIDTH = "var(--ui-app-rail-width, 3.25rem)";

/** Motion for width and fade changes; reduced motion drops it. */
const EASE = "200ms cubic-bezier(0.2, 0, 0, 1)";

/** Prop types for {@link AppShell} and its parts. */
export namespace AppShell {
	/** Every string the shell shows or announces. */
	export interface Labels {
		/** The nav landmark's name, such as "Main". */
		nav: string;
		/** The skip link's text, such as "Skip to content". */
		skip: string;
		/** The phone menu button's name, such as "Open navigation". */
		menu: string;
		/** The sheet's close button's name, such as "Close navigation". */
		close: string;
		/** The collapse toggle's name, such as "Collapse sidebar"; checked means collapsed. */
		collapse: string;
	}

	/** How the current row is marked: a soft fill, or a 2px pill on its leading edge. */
	export type Indicator = "fill" | "pill";

	/** The tone of a row's count; a solid tone reads as "needs you", `neutral` as a tally. */
	export type CountTone = "neutral" | "brand" | "success" | "warning" | "danger";

	/** Props accepted by {@link AppShell}. */
	export interface Props {
		labels: Labels;
		/** Draws the sidebar as the icon rail; read it with `readAppShellCookie`. @default false */
		collapsed?: boolean;
		/** The workspace switcher at the top of the sidebar, usually an `AppShell.Identity`. */
		workspace?: RemixNode;
		/** The sidebar's links: `AppShell.Group`s of `AppShell.Item`s, or a swapped panel. */
		nav: RemixNode;
		/** The foot of the sidebar, usually the user menu's `AppShell.Identity`. */
		footer?: RemixNode;
		/** The top bar's content: a breadcrumb, a search field, the one global action. */
		topbar?: RemixNode;
		/** A notice above the whole frame, such as a sandbox banner; it pushes the frame down. */
		banner?: RemixNode;
		/** The screen, rendered inside `<main>`. */
		children: RemixNode;
		/** Opens the rail over the content while the pointer rests on it. @default true */
		peek?: boolean;
		/** @default "fill" */
		indicator?: Indicator;
		/**
		 * Prefix for the sidebar's and main's ids (`<id>-sidebar`, `<id>-main`).
		 * @default "app-shell"
		 */
		id?: string;
		/** The collapse cookie's name, for an app with two shells. @default APP_SHELL_COOKIE */
		cookieName?: string;
	}

	/** Props accepted by {@link AppShell.Group}. */
	export interface GroupProps extends Omit<TagProps<"div">, "title"> {
		/** A plain sentence-case title; it turns into a hairline in the rail. */
		title?: string;
		children?: RemixNode;
	}

	/** Props accepted by {@link AppShell.Item}. */
	export type ItemProps = TagProps<"a"> & {
		href: string;
		/** A 16px icon; it stays visible in the rail. */
		icon?: RemixNode;
		/** The row's text, also its name and tooltip in the rail. */
		label: string;
		/** A count pill; zero or unset draws none. */
		count?: number;
		/** What the count means for a screen reader, such as "2 monitors down". */
		countLabel?: string;
		/** @default "neutral" */
		countTone?: CountTone;
		/** Sets the label bold: something new is behind it. */
		unread?: boolean;
		/** This row is the page shown; sets `aria-current="page"`. */
		current?: boolean;
		/** This row is a parent of the page shown, so it stays marked on child routes. */
		active?: boolean;
	};

	/** Props accepted by {@link AppShell.Back}. */
	export type BackProps = TagProps<"a"> & {
		href: string;
		/** The panel's name, such as "Settings". */
		label: string;
	};

	/** Props accepted by {@link AppShell.Identity}. */
	export interface IdentityProps extends Omit<TagProps<"button">, "children"> {
		/** A 24px avatar or logo; it stays visible in the rail. */
		avatar: RemixNode;
		name: string;
		/** A second line, such as a plan or an email. */
		detail?: string;
		/** Draws the up-down chevron of a switcher. @default true */
		chevron?: boolean;
	}
}

/**
 * Renders the shell. The sidebar is one `<aside popover="auto">`: a grid column from 48rem, the
 * icon rail while `collapsed`, and a sheet the top bar's menu button opens below 48rem. Load
 * `@sdxc/ui/app/app-shell-toggle` in the browser entry for the cookie, ⌘B and Esc-back.
 *
 * @param handle Runtime handle carrying the shell's props.
 * @returns The render function producing the shell's markup.
 * @example
 * <AppShell labels={labels} collapsed={readAppShellCookie(request.headers.get("Cookie"))} workspace={<AppShell.Identity … />} nav={<AppShell.Group title="Monitoring"><AppShell.Item href="/monitors" icon={<ActivityIcon />} label="Monitors" current /></AppShell.Group>}>
 * 	<PageHeader title="Monitors" />
 * </AppShell>
 */
export function AppShell(handle: Handle<AppShell.Props>) {
	return () => {
		let {
			labels,
			collapsed = false,
			workspace,
			nav,
			footer,
			topbar,
			banner,
			children,
			peek = true,
			indicator = "fill",
			id = "app-shell",
			cookieName = APP_SHELL_COOKIE,
		} = handle.props;
		let sidebarId = `${id}-sidebar`;
		let mainId = `${id}-main`;

		return (
			<div
				data-slot="app-shell"
				data-indicator={indicator}
				mix={[
					raw({ display: "flex", flexDirection: "column", minBlockSize: "100dvh" }),
					bg(),
					media(DOCKED, [
						raw({ blockSize: "100dvh", minBlockSize: "0", overflow: "hidden" }),
						bg("neutral.tint"),
					]),
				]}
			>
				<a
					href={`#${mainId}`}
					data-slot="app-shell-skip"
					mix={[
						when("&:not(:focus)", visuallyHidden()),
						when("&:focus", [
							raw({
								position: "fixed",
								insetBlockStart: "0.5rem",
								insetInlineStart: "0.5rem",
								zIndex: "10",
								paddingBlock: "0.5rem",
								paddingInline: "0.75rem",
								boxShadow: "var(--ui-shadow-surface)",
							}),
							rounded("md"),
							bg(),
							fg("neutral.emphasis"),
							text("sm"),
							weight("medium"),
							outline({ color: "brand.ring", offset: 2 }),
						]),
					]}
				>
					{labels.skip}
				</a>

				{banner ? <div data-slot="app-shell-banner">{banner}</div> : null}

				<div
					data-slot="app-shell-frame"
					mix={[
						raw({ display: "flex", flexDirection: "column", flex: "1 0 auto" }),
						media(DOCKED, [
							raw({
								display: "grid",
								flex: "1 1 0%",
								minBlockSize: "0",
								transition: `grid-template-columns ${EASE}`,
							}),
							when(
								`${EXPANDED} &`,
								raw({ gridTemplateColumns: `${SIDEBAR_WIDTH} minmax(0, 1fr)` }),
							),
							when(`${COLLAPSED} &`, raw({ gridTemplateColumns: `${RAIL_WIDTH} minmax(0, 1fr)` })),
						]),
						media("(prefers-reduced-motion: reduce)", raw({ transition: "none" })),
					]}
				>
					<aside
						id={sidebarId}
						popover="auto"
						aria-label={labels.nav}
						data-slot="app-shell-sidebar"
						data-peek={peek ? "true" : "false"}
						mix={[
							raw({ flexDirection: "column", boxSizing: "border-box", color: "inherit" }),
							media(SHEET, [
								raw({
									translate: "-100%",
									transition: `translate 250ms cubic-bezier(0.2, 0, 0, 1), display 250ms allow-discrete, overlay 250ms allow-discrete`,
								}),
								when("&:popover-open", [
									raw({
										display: "flex",
										position: "fixed",
										insetBlock: "0",
										insetInlineStart: "0",
										insetInlineEnd: "auto",
										margin: "0",
										padding: "0 0 env(safe-area-inset-bottom, 0px)",
										inlineSize: "min(var(--ui-app-sheet-width, 18rem), 85vw)",
										blockSize: "100dvh",
										maxBlockSize: "100dvh",
										border: "0",
										borderInlineEnd: "1px solid var(--ui-neutral-border)",
										boxShadow: "var(--ui-shadow-surface)",
										overflow: "hidden",
										translate: "0",
									}),
									bg("neutral.tint"),
								]),
								when("@starting-style", when("&:popover-open", raw({ translate: "-100%" }))),
								when(
									"&::backdrop",
									raw({
										backgroundColor:
											"color-mix(in oklab, var(--ui-neutral-fg-emphasis, CanvasText) 40%, transparent)",
									}),
								),
							]),
							media(DOCKED, [
								raw({
									display: "flex",
									position: "relative",
									inset: "auto",
									margin: "0",
									padding: "0",
									border: "0",
									blockSize: "auto",
									minBlockSize: "0",
									overflow: "hidden",
									zIndex: "2",
									backgroundColor: "transparent",
									transition: `inline-size ${EASE}, box-shadow ${EASE}, background-color ${EASE}`,
								}),
								when(`${EXPANDED} &`, raw({ inlineSize: SIDEBAR_WIDTH })),
								when(`${COLLAPSED} &${RAIL_STATE}`, [raw({ inlineSize: RAIL_WIDTH })]),
								when(`${COLLAPSED} &${PEEK_STATE}`, [
									raw({
										inlineSize: SIDEBAR_WIDTH,
										backgroundColor: "var(--ui-neutral-bg-tint)",
										boxShadow: "var(--ui-shadow-surface)",
										transitionDelay: "150ms",
									}),
								]),
								when(
									"& [data-app-shell-label]",
									raw({ transition: `opacity ${EASE}`, whiteSpace: "nowrap" }),
								),
								when(`${COLLAPSED} &${RAIL_STATE} [data-app-shell-label]`, raw({ opacity: "0" })),
							]),
							media("(prefers-reduced-motion: reduce)", [
								raw({ transition: "none", transitionDelay: "0s" }),
								when("& [data-app-shell-label]", raw({ transition: "none" })),
							]),
						]}
					>
						<div
							data-slot="app-shell-sidebar-header"
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "0.25rem",
									minBlockSize: "var(--ui-app-header-height, 3.5rem)",
									paddingInline: "0.5rem",
									paddingBlockStart: "env(safe-area-inset-top, 0px)",
									boxSizing: "border-box",
									flexShrink: "0",
								}),
								media(DOCKED, raw({ marginBlockStart: "var(--ui-app-inset-gap, 0.5rem)" })),
							]}
						>
							<div mix={[raw({ flex: "1 1 0%", minInlineSize: "0" })]}>{workspace}</div>
							<span
								data-slot="app-shell-close"
								mix={[
									when(
										'[data-slot="app-shell-sidebar"]:not(:popover-open) &',
										raw({ display: "none" }),
									),
									when(
										'[data-slot="app-shell-sidebar"]:popover-open &',
										raw({ display: "inline-flex" }),
									),
								]}
							>
								<Button
									type="button"
									variant="ghost"
									color="neutral"
									size="sm"
									popovertarget={sidebarId}
									popovertargetaction="hide"
									aria-label={labels.close}
								>
									<XIcon size={16} aria-hidden="true" />
								</Button>
							</span>
						</div>

						<nav
							aria-label={labels.nav}
							data-slot="app-shell-nav"
							mix={[
								raw({
									display: "flex",
									flexDirection: "column",
									gap: "1rem",
									flex: "1 1 auto",
									minBlockSize: "0",
									overflowX: "hidden",
									overflowY: "auto",
									overscrollBehavior: "contain",
									scrollbarWidth: "thin",
									padding: "0.5rem",
								}),
							]}
						>
							{nav}
						</nav>

						{footer ? (
							<div
								data-slot="app-shell-sidebar-footer"
								mix={[
									raw({
										flexShrink: "0",
										padding: "0.5rem",
										paddingBlockEnd: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
									}),
								]}
							>
								{footer}
							</div>
						) : null}
					</aside>

					<div
						data-slot="app-shell-content"
						mix={[
							raw({
								minInlineSize: "0",
								flex: "1 0 auto",
								containerType: "inline-size",
								containerName: "ui-app-content",
								"--ui-app-sticky-top": "var(--ui-app-header-height, 3.5rem)",
							}),
							bg(),
							media(DOCKED, [
								raw({
									marginBlock: "var(--ui-app-inset-gap, 0.5rem)",
									marginInlineEnd: "var(--ui-app-inset-gap, 0.5rem)",
									borderRadius: "var(--ui-app-inset-radius, 0.75rem)",
									border: "1px solid var(--ui-neutral-border)",
									boxShadow: "var(--ui-shadow-control)",
									overflowY: "auto",
									overflowX: "hidden",
									minBlockSize: "0",
									scrollbarWidth: "thin",
									position: "relative",
									zIndex: "1",
								}),
							]),
						]}
					>
						<header
							data-slot="app-shell-topbar"
							mix={[
								raw({
									position: "sticky",
									insetBlockStart: "0",
									zIndex: "3",
									display: "flex",
									alignItems: "center",
									gap: "0.5rem",
									blockSize: "var(--ui-app-header-height, 3.5rem)",
									boxSizing: "border-box",
									paddingInline: "0.75rem",
									borderBlockEnd: "1px solid var(--ui-neutral-border)",
								}),
								bg(),
								media(DOCKED, raw({ paddingInline: "1rem" })),
							]}
						>
							<span
								data-slot="app-shell-menu"
								mix={[
									media(SHEET, raw({ display: "inline-flex" })),
									media(DOCKED, raw({ display: "none" })),
								]}
							>
								<Button
									type="button"
									variant="ghost"
									color="neutral"
									size="sm"
									popovertarget={sidebarId}
									aria-label={labels.menu}
								>
									<MenuIcon size={16} aria-hidden="true" />
								</Button>
							</span>
							<AppShellToggle
								collapsed={collapsed}
								label={labels.collapse}
								cookieName={cookieName}
								sidebarId={sidebarId}
							/>
							<div
								data-slot="app-shell-topbar-content"
								mix={[
									raw({
										display: "flex",
										alignItems: "center",
										gap: "0.5rem",
										flex: "1 1 auto",
										minInlineSize: "0",
									}),
								]}
							>
								{topbar}
							</div>
						</header>

						<main
							id={mainId}
							tabIndex={-1}
							data-slot="app-shell-main"
							mix={[
								raw({
									"--ui-app-gutter": "var(--ui-app-content-padding, 1rem)",
									display: "block",
									minInlineSize: "0",
									padding: "var(--ui-app-gutter)",
									outline: "none",
								}),
								media(DOCKED, raw({ "--ui-app-gutter": "var(--ui-app-content-padding, 1.5rem)" })),
							]}
						>
							{children}
						</main>
					</div>
				</div>
			</div>
		);
	};
}

/**
 * Renders a titled group of rows. The title is a plain label, and in the rail it becomes a
 * hairline so groups stay apart while every icon keeps its place.
 *
 * @param handle Runtime handle carrying the group's props.
 * @returns The render function producing the group's markup.
 * @example
 * <AppShell.Group title="Settings"><AppShell.Item … /></AppShell.Group>
 */
AppShell.Group = function AppShellGroup(handle: Handle<AppShell.GroupProps>) {
	return () => {
		let { title, children, mix, ...rest } = handle.props;
		let titleId = `${handle.id}-title`;

		return (
			<div
				{...rest}
				role="group"
				aria-labelledby={title ? titleId : undefined}
				data-slot="app-shell-group"
				mix={mergeMix([raw({ display: "flex", flexDirection: "column", gap: "0.125rem" })], mix)}
			>
				{title ? (
					<span
						id={titleId}
						data-slot="app-shell-group-title"
						mix={[
							raw({
								position: "relative",
								display: "flex",
								alignItems: "center",
								blockSize: "1.75rem",
								paddingInline: "0.625rem",
								fontSize: "0.75rem",
								whiteSpace: "nowrap",
							}),
							fg("neutral.muted"),
							weight("medium"),
							media(DOCKED, [
								raw({ transition: `color ${EASE}` }),
								when(`${RAIL_SIDEBAR} &`, raw({ color: "transparent" })),
								when(
									"&::after",
									raw({
										content: '""',
										position: "absolute",
										insetInline: "0.625rem",
										insetBlockStart: "50%",
										borderBlockStart: "1px solid var(--ui-neutral-border)",
										opacity: "0",
										transition: `opacity ${EASE}`,
									}),
								),
								when(`${RAIL_SIDEBAR} &::after`, raw({ opacity: "1" })),
							]),
						]}
					>
						{title}
					</span>
				) : null}
				<ul
					mix={[
						raw({
							listStyle: "none",
							margin: "0",
							padding: "0",
							display: "flex",
							flexDirection: "column",
							gap: "0.125rem",
						}),
					]}
				>
					{children}
				</ul>
			</div>
		);
	};
};

/**
 * Renders one row: a 16px icon at reduced ink, the label, and an optional count pill. The
 * current page carries `aria-current="page"`; `active` marks a parent on its child routes. In the
 * rail the label fades out, the count becomes a dot on the icon and, without peek, a tooltip names it.
 *
 * @param handle Runtime handle carrying the row's props.
 * @returns The render function producing the row's markup.
 * @example
 * <AppShell.Item href="/monitors" icon={<ActivityIcon />} label="Monitors" count={2} countTone="danger" countLabel="2 down" active />
 */
AppShell.Item = function AppShellItem(handle: Handle<AppShell.ItemProps>) {
	return () => {
		let {
			href,
			icon,
			label,
			count,
			countLabel,
			countTone = "neutral",
			unread = false,
			current = false,
			active = false,
			children: _children,
			mix,
			...rest
		} = handle.props;
		let marked = current || active;
		let hasCount = count !== undefined && count > 0;

		return (
			<li data-slot="app-shell-item" mix={[raw({ display: "block" })]}>
				<a
					{...rest}
					href={href}
					aria-current={current ? "page" : rest["aria-current"]}
					data-current={marked ? "" : undefined}
					data-unread={unread ? "" : undefined}
					mix={mergeMix(
						[navRow(), raw({ anchorName: "--ui-app-nav-row", anchorScope: "--ui-app-nav-row" })],
						mix,
					)}
				>
					{icon ? (
						<span data-slot="app-shell-icon" aria-hidden="true" mix={[navIcon()]}>
							{icon}
						</span>
					) : null}
					<span
						data-app-shell-label
						mix={[truncate(), raw({ flex: "1 1 auto", minInlineSize: "0" })]}
					>
						{label}
					</span>
					{hasCount ? (
						<span
							data-slot="app-shell-count"
							data-tone={countTone}
							mix={[
								raw({
									flexShrink: "0",
									minInlineSize: "1.25rem",
									paddingInline: "0.375rem",
									borderRadius: "0.3125rem",
									fontSize: "0.75rem",
									lineHeight: "1.25rem",
									textAlign: "center",
									boxSizing: "border-box",
								}),
								weight("semibold"),
								tabularNums(),
								countToneMixins(),
								media(DOCKED, [
									when(
										`${RAIL_SIDEBAR} &`,
										raw({
											position: "absolute",
											insetBlockStart: "0.25rem",
											insetInlineStart: "1.375rem",
											minInlineSize: "0",
											inlineSize: "0.5rem",
											blockSize: "0.5rem",
											padding: "0",
											borderRadius: "999px",
											fontSize: "0",
											lineHeight: "0",
											boxShadow: "0 0 0 2px var(--ui-neutral-bg-tint)",
										}),
									),
								]),
							]}
						>
							{countLabel ? (
								<>
									<span aria-hidden="true">{count}</span>
									<span mix={[visuallyHidden()]}>{countLabel}</span>
								</>
							) : (
								count
							)}
						</span>
					) : null}
					<span
						data-slot="app-shell-tooltip"
						aria-hidden="true"
						mix={[
							hidden(),
							supports(
								"(anchor-name: --a)",
								media(DOCKED, [
									when(
										`${RAIL_SIDEBAR} a:is(:hover, :focus-visible) > &`,
										raw({
											display: "block",
											position: "fixed",
											positionAnchor: "--ui-app-nav-row",
											positionArea: "center right",
											marginInlineStart: "0.5rem",
											paddingBlock: "0.25rem",
											paddingInline: "0.5rem",
											borderRadius: "0.375rem",
											fontSize: "0.75rem",
											whiteSpace: "nowrap",
											pointerEvents: "none",
											zIndex: "20",
											backgroundColor: "var(--ui-neutral-fg-emphasis, CanvasText)",
											color: "var(--ui-bg, Canvas)",
										}),
									),
								]),
							),
						]}
					>
						{label}
					</span>
				</a>
			</li>
		);
	};
};

/**
 * Renders the back row of a swapped panel ("‹ Settings"), drawn by the server in place of the
 * app's nav. With the toggle island loaded, Esc follows it unless a field, menu or dialog owns Esc.
 *
 * @param handle Runtime handle carrying the row's props.
 * @returns The render function producing the row's markup.
 * @example
 * <AppShell.Back href="/monitors" label="Settings" />
 */
AppShell.Back = function AppShellBack(handle: Handle<AppShell.BackProps>) {
	return () => {
		let { href, label, children: _children, mix, ...rest } = handle.props;
		return (
			<a
				{...rest}
				href={href}
				data-app-shell-back
				aria-keyshortcuts="Escape"
				mix={mergeMix([navRow(), fg("neutral.emphasis"), weight("semibold")], mix)}
			>
				<span aria-hidden="true" mix={[navIcon(), raw({ opacity: "1" })]}>
					<ChevronLeftIcon size={16} />
				</span>
				<span data-app-shell-label mix={[truncate()]}>
					{label}
				</span>
			</a>
		);
	};
};

/**
 * Renders a switcher or account row: a 24px avatar, a name and an optional detail line, and an
 * up-down chevron. It is a `<button>`, so a `Menu` opens from it through `commandfor`; in the
 * rail only the avatar shows and the name stays its accessible name.
 *
 * @param handle Runtime handle carrying the button's props.
 * @returns The render function producing the row's markup.
 * @example
 * <AppShell.Identity avatar={<Avatar … />} name="Acme Ops" detail="Pro plan" commandfor="workspaces" command="toggle-popover" />
 */
AppShell.Identity = function AppShellIdentity(handle: Handle<AppShell.IdentityProps>) {
	return () => {
		let { avatar, name, detail, chevron = true, mix, ...rest } = handle.props;
		return (
			<button
				type="button"
				{...rest}
				data-slot="app-shell-identity"
				mix={mergeMix(
					[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							inlineSize: "100%",
							minBlockSize: "2.5rem",
							padding: "0.375rem",
							border: "0",
							borderRadius: "0.5rem",
							background: "transparent",
							color: "inherit",
							font: "inherit",
							textAlign: "start",
							cursor: "pointer",
							boxSizing: "border-box",
							overflow: "hidden",
						}),
						hover(bg("neutral.bg-tint-hover")),
						focusVisible(outline({ color: "brand.ring", offset: -2 })),
					],
					mix,
				)}
			>
				<span
					aria-hidden="true"
					mix={[
						raw({
							display: "inline-flex",
							flexShrink: "0",
							inlineSize: "1.5rem",
							blockSize: "1.5rem",
							alignItems: "center",
							justifyContent: "center",
							overflow: "hidden",
							borderRadius: "0.375rem",
						}),
					]}
				>
					{avatar}
				</span>
				<span
					data-app-shell-label
					mix={[
						raw({ display: "flex", flexDirection: "column", flex: "1 1 auto", minInlineSize: "0" }),
					]}
				>
					<span mix={[truncate(), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
						{name}
					</span>
					{detail ? (
						<span mix={[truncate(), raw({ fontSize: "0.75rem" }), fg("neutral.muted")]}>
							{detail}
						</span>
					) : null}
				</span>
				{chevron ? (
					<span
						data-app-shell-label
						aria-hidden="true"
						mix={[raw({ display: "inline-flex", flexShrink: "0" }), fg("neutral.muted")]}
					>
						<ChevronsUpDownIcon size={14} />
					</span>
				) : null}
			</button>
		);
	};
};

/**
 * A nav row's box: 32px, 14px text, quiet until hovered, and marked when current or active by a
 * soft fill or, under `indicator="pill"`, a 2px pill on the leading edge. The focus ring sits
 * inside the row so the nav's scroll box never clips it.
 */
function navRow() {
	return [
		raw({
			position: "relative",
			display: "flex",
			alignItems: "center",
			gap: "0.5rem",
			blockSize: "var(--ui-app-nav-row-size, 2rem)",
			paddingInline: "0.625rem",
			borderRadius: "0.375rem",
			textDecoration: "none",
			whiteSpace: "nowrap",
			boxSizing: "border-box",
			transition: "background-color 150ms ease-out, color 150ms ease-out",
		}),
		text("sm"),
		fg("neutral"),
		hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
		focusVisible(outline({ color: "brand.ring", offset: -2 })),
		when("&[data-unread]", [weight("semibold"), fg("neutral.emphasis")]),
		when('[data-indicator="fill"] &[data-current]', [
			bg("neutral.bg-tint-pressed"),
			fg("neutral.emphasis"),
			weight("medium"),
		]),
		when('[data-indicator="pill"] &[data-current]', [fg("neutral.emphasis"), weight("medium")]),
		when(
			'[data-indicator="pill"] &[data-current]::before',
			raw({
				content: '""',
				position: "absolute",
				insetInlineStart: "0",
				insetBlock: "0.375rem",
				inlineSize: "2px",
				borderRadius: "2px",
				backgroundColor: "var(--ui-brand-bg-solid)",
			}),
		),
		media("(prefers-reduced-motion: reduce)", raw({ transition: "none" })),
	];
}

/** A row's icon box: 16px at reduced ink, full ink on the current row, so labels carry meaning. */
function navIcon() {
	return [
		raw({
			display: "inline-flex",
			flexShrink: "0",
			inlineSize: "1rem",
			blockSize: "1rem",
			alignItems: "center",
			justifyContent: "center",
			opacity: "0.6",
		}),
		when("[data-current] > &, a:hover > &", raw({ opacity: "1" })),
		when("& > svg", raw({ inlineSize: "1rem", blockSize: "1rem" })),
	];
}

/** The count pill's colours: a soft tally for `neutral`, a solid pill for every other tone. */
function countToneMixins() {
	return [
		when('&[data-tone="neutral"]', [bg("neutral.bg-tint-pressed"), fg("neutral.emphasis")]),
		when('&[data-tone="brand"]', [bg("brand.solid"), fg("brand.onSolid")]),
		when('&[data-tone="success"]', [bg("success.solid"), fg("success.onSolid")]),
		when('&[data-tone="warning"]', [bg("warning.solid"), fg("warning.onSolid")]),
		when('&[data-tone="danger"]', [bg("danger.solid"), fg("danger.onSolid")]),
	];
}
