/**
 * An application shell's primary navigation rail, composed from a layout
 * root, the collapsible rail itself, a main-content inset, and a family of
 * group/menu/item parts for organizing links. Collapsing rides a single
 * checkbox's native `:checked` state instead of tracked JavaScript state, a
 * mobile-width drawer variant rides {@link Dialog}, and the scrollable
 * regions ride {@link ScrollArea}'s viewport — so the whole shell works with
 * zero library JavaScript, and an app only adds behavior (for instance,
 * mirroring the collapse state into a cookie so the next page loads already
 * collapsed) by attaching its own mixin to the pieces below.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { PanelLeftIcon } from "@pkg/lucide-remix";
import { visuallyHidden } from "@pkg/u/a11y";
import { bg, border, borderEdge, colorMix, fg, outline, outlineStyle } from "@pkg/u/color";
import {
	backdropBlur,
	backdropSaturate,
	opacity,
	rounded,
	shadow,
	transition,
} from "@pkg/u/effects";
import { cursor, raw, userSelect, willChange } from "@pkg/u/general";
import { var as varUtility } from "@pkg/u/general/var";
import {
	absolute,
	container,
	fixed,
	flex,
	flexCol,
	gap,
	grow,
	hidden,
	inlineFlex,
	insBe,
	insBs,
	insIe,
	insIs,
	items,
	justify,
	relative,
	shrink,
	vstack,
} from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { media, supports } from "@pkg/u/responsive";
import {
	bs,
	is,
	m,
	maxBs,
	maxIs,
	mbe,
	mbs,
	minBs,
	minIs,
	mis,
	p,
	pb,
	pbe,
	pbs,
	pi,
	pis,
	safeAreaPadding,
} from "@pkg/u/size";
import { z } from "@pkg/u/stacking";
import { after, data, focusVisible, hover, when } from "@pkg/u/state";
import { scaleProperty, translateProperty, translateX } from "@pkg/u/transform";
import {
	fontSize,
	tabularNums,
	textAlign,
	textDecoration,
	textTransform,
	tracking,
	truncate,
	weight,
} from "@pkg/u/typography";
import { attrs } from "remix/ui";

import { durations, easings } from "../animations/tokens";
import { warnIfNoAccessibleName } from "../utils/warn-if-no-accessible-name";

import { Dialog } from "./dialog";
import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";

/** Visual treatment {@link Sidebar} falls back to when `variant` is omitted. */
const DEFAULT_VARIANT: Sidebar.Variant = "sidebar";

/** Collapse behavior {@link Sidebar} falls back to when `collapsible` is omitted. */
const DEFAULT_COLLAPSIBLE: Sidebar.Collapsible = "offcanvas";

/**
 * Physical edge {@link Sidebar} docks against, and the edge
 * {@link Sidebar.MobileNav} slides in from, when `side` is omitted.
 */
const DEFAULT_SIDE: Sidebar.Side = "left";

/** Semantic color role {@link Sidebar.Item} falls back to when `color` is omitted. */
const DEFAULT_ITEM_COLOR: Sidebar.Color = "neutral";

/** Size variant {@link Sidebar.MenuButton} and {@link Sidebar.MenuLink} fall back to when `size` is omitted. */
const DEFAULT_MENU_BUTTON_SIZE: Sidebar.MenuButtonSize = "md";

/** Whether {@link Sidebar.MenuAction} stays hidden until its row is hovered or focused, when `showOnHover` is omitted. */
const DEFAULT_SHOW_ON_HOVER = true;

/** Whether {@link Sidebar.MenuSkeleton} renders a leading icon placeholder, when `showIcon` is omitted. */
const DEFAULT_SHOW_ICON = false;

/**
 * Named container {@link Sidebar.Provider} declares on its own host, so
 * {@link Sidebar} and {@link Sidebar.Rail} can query the shell's own overall
 * width to decide whether there's room for a persistent rail, regardless of
 * how deep inside the page the shell happens to sit.
 */
const PROVIDER_CONTAINER_NAME = "ui-sidebar-provider";

/**
 * Named container {@link Sidebar.Inset} declares on its own host, so content
 * rendered inside it — a Card, a Table, anything sized by its surroundings —
 * responds to the inset's own available width (which grows and shrinks as
 * the rail expands, collapses, or slides away) instead of the page's.
 */
const INSET_CONTAINER_NAME = "ui-sidebar-inset";

/**
 * Container query matching a shell wide enough to host the persistent rail
 * alongside its inset. Below this width, {@link Sidebar}'s `"icon"` and
 * `"offcanvas"` collapse modes step aside entirely in favor of
 * {@link Sidebar.MobileNav}.
 */
const WIDE_SHELL_QUERY = `@container ${PROVIDER_CONTAINER_NAME} (min-width: 48rem)`;

/**
 * Selector matching {@link Sidebar.Trigger}'s own checkbox input once it
 * carries the platform's native `:checked` state — the single source of
 * truth every collapse-driven rule in {@link Sidebar.Provider} reads from.
 */
const TOGGLE_CHECKED_SELECTOR = '[data-slot="toggle"]:checked';

/**
 * Resolves the `aria-current` value an anchor-based nav part renders with:
 * an explicit `aria-current` always wins, and a `current`/`active` shorthand
 * of `true` falls back to `"page"` — the value assistive technology treats
 * as "the page currently open" — when nothing more specific was supplied.
 */
function resolveAriaCurrent(
	current: boolean | undefined,
	ariaCurrent: TagProps<"a">["aria-current"],
): TagProps<"a">["aria-current"] {
	return ariaCurrent ?? (current ? "page" : undefined);
}

/**
 * Prop types for {@link Sidebar} and its compound parts.
 */
export namespace Sidebar {
	/**
	 * Visual treatment the rail renders with: `"sidebar"` sits flush against
	 * its edge of the shell, `"floating"` insets itself with a margin, a
	 * rounded, shadowed panel look, and — where the platform supports it and
	 * the user hasn't asked for reduced transparency — a blurred backdrop,
	 * and `"inset"` renders that same rounded, shadowed panel look without
	 * the transparency.
	 */
	export type Variant = "sidebar" | "floating" | "inset";

	/**
	 * How the rail collapses: `"none"` never collapses and always renders at
	 * full width regardless of the shell's own size, `"icon"` narrows to an
	 * icon-only rail, and `"offcanvas"` narrows all the way to nothing. Every
	 * mode but `"none"` steps aside for {@link Sidebar.MobileNav} once the
	 * shell narrows past {@link WIDE_SHELL_QUERY}.
	 */
	export type Collapsible = "none" | "offcanvas" | "icon";

	/**
	 * Physical edge of the shell the rail docks against and, for
	 * {@link Sidebar.MobileNav}, slides in from. `"left"` and `"right"` name
	 * that edge regardless of `dir` — the same fixed side a docked panel
	 * keeps attaching to under any reading direction, matching how an
	 * edge-docked drawer stays pinned to one physical side of the viewport
	 * rather than mirroring for reading direction.
	 */
	export type Side = "left" | "right";

	/**
	 * Semantic color role {@link Sidebar.Item} renders its current-page
	 * treatment in, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = "primary" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Size variant controlling {@link Sidebar.MenuButton}'s and
	 * {@link Sidebar.MenuLink}'s padding, font size, and icon size.
	 */
	export type MenuButtonSize = "sm" | "md" | "lg";

	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough. Establishes
	 * the shell's row layout — {@link Sidebar} beside {@link Sidebar.Inset} —
	 * the {@link PROVIDER_CONTAINER_NAME} named container both of them and
	 * {@link Sidebar.Rail} query, and every collapse-driven rule keyed off
	 * {@link Sidebar.Trigger}'s checkbox reaching `:checked` anywhere in this
	 * subtree.
	 */
	export interface ProviderProps extends TagProps<"div"> {
		/** {@link Sidebar} and {@link Sidebar.Inset}, in either order. */
		children: RemixNode;
	}

	/**
	 * Every native `<aside>` attribute, plus the `mix` passthrough.
	 */
	export interface Props extends TagProps<"aside"> {
		/** Visual treatment. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Collapse behavior. Defaults to {@link DEFAULT_COLLAPSIBLE}. */
		collapsible?: Collapsible;
		/** Physical docking edge. Defaults to {@link DEFAULT_SIDE}. */
		side?: Side;
	}

	/**
	 * Every prop {@link Dialog.Props} accepts, plus `side`. `id` stays the id
	 * a trigger elsewhere on the page opens this drawer with — see
	 * {@link Dialog.Props} for the full Invoker Commands contract.
	 */
	export interface MobileNavProps extends Dialog.Props {
		/** Physical edge to dock against and slide in from. Defaults to {@link DEFAULT_SIDE}. */
		side?: Side;
	}

	/**
	 * Every native `<header>` attribute, plus the `mix` passthrough.
	 */
	export interface HeaderProps extends TagProps<"header"> {}

	/**
	 * Every prop {@link ScrollArea.ViewportProps} accepts, unchanged.
	 */
	export interface ContentProps extends ScrollArea.ViewportProps {}

	/**
	 * Every native `<footer>` attribute, plus the `mix` passthrough.
	 */
	export interface FooterProps extends TagProps<"footer"> {}

	/**
	 * Every native `<nav>` attribute, plus the `mix` passthrough.
	 */
	export interface NavProps extends TagProps<"nav"> {}

	/**
	 * Props accepted by {@link Sidebar.Item}. Built as an intersection rather
	 * than an interface extension because the underlying anchor prop type is
	 * a union keyed on `href` (the accessible-anchor contract restricts
	 * `role` once `href` is present), which an `interface … extends` clause
	 * cannot carry.
	 */
	export type ItemProps = TagProps<"a"> & {
		/** Destination the item navigates to. */
		href: string;
		/** Semantic color role applied once the item is current. Defaults to {@link DEFAULT_ITEM_COLOR}. */
		color?: Color;
		/** Shorthand setting `aria-current="page"` when true and `aria-current` is otherwise unset. */
		current?: boolean;
	};

	/**
	 * Every native `<section>` attribute, plus the `mix` passthrough.
	 */
	export interface GroupProps extends TagProps<"section"> {}

	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough.
	 */
	export interface GroupLabelProps extends TagProps<"div"> {}

	/**
	 * Every native `<button>` attribute, plus the `mix` passthrough.
	 */
	export interface GroupActionProps extends TagProps<"button"> {}

	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough.
	 */
	export interface GroupContentProps extends TagProps<"div"> {}

	/**
	 * Every native `<ul>` attribute, plus the `mix` passthrough.
	 */
	export interface MenuProps extends TagProps<"ul"> {}

	/**
	 * Every native `<li>` attribute, plus the `mix` passthrough. Its own
	 * `:hover`/`:focus-within` state reveals a nested {@link Sidebar.MenuAction}
	 * that would otherwise stay hidden.
	 */
	export interface MenuItemProps extends TagProps<"li"> {}

	/**
	 * Props accepted by {@link Sidebar.MenuButton}.
	 */
	export interface MenuButtonProps extends TagProps<"button"> {
		/** Size variant. Defaults to {@link DEFAULT_MENU_BUTTON_SIZE}. */
		size?: MenuButtonSize;
		/** Marks the row as the current selection, independent of navigation. */
		active?: boolean;
	}

	/**
	 * Props accepted by {@link Sidebar.MenuLink}. Built as an intersection for
	 * the same reason as {@link Sidebar.ItemProps}.
	 */
	export type MenuLinkProps = TagProps<"a"> & {
		/** Destination the link navigates to. */
		href: string;
		/** Size variant. Defaults to {@link DEFAULT_MENU_BUTTON_SIZE}. */
		size?: MenuButtonSize;
		/** Shorthand setting `aria-current="page"` when true and `aria-current` is otherwise unset. */
		active?: boolean;
	};

	/**
	 * Props accepted by {@link Sidebar.MenuAction}.
	 */
	export interface MenuActionProps extends TagProps<"button"> {
		/**
		 * Whether the control stays invisible until its ancestor
		 * {@link Sidebar.MenuItem} is hovered or contains focus. Defaults to
		 * {@link DEFAULT_SHOW_ON_HOVER}; set to `false` to keep it always
		 * visible, for an action important enough to show at rest.
		 */
		showOnHover?: boolean;
	}

	/**
	 * Every native `<span>` attribute, plus the `mix` passthrough.
	 */
	export interface MenuBadgeProps extends TagProps<"span"> {}

	/**
	 * Props accepted by {@link Sidebar.MenuSkeleton}.
	 */
	export interface MenuSkeletonProps extends TagProps<"div"> {
		/** Whether to render a leading icon-shaped placeholder. Defaults to {@link DEFAULT_SHOW_ICON}. */
		showIcon?: boolean;
	}

	/**
	 * Every native `<ul>` attribute, plus the `mix` passthrough.
	 */
	export interface MenuSubProps extends TagProps<"ul"> {}

	/**
	 * Every native `<li>` attribute, plus the `mix` passthrough.
	 */
	export interface MenuSubItemProps extends TagProps<"li"> {}

	/**
	 * Props accepted by {@link Sidebar.MenuSubButton}.
	 */
	export interface MenuSubButtonProps extends TagProps<"button"> {
		/** Marks the row as the current selection, independent of navigation. */
		active?: boolean;
	}

	/**
	 * Props accepted by {@link Sidebar.MenuSubLink}. Built as an intersection
	 * for the same reason as {@link Sidebar.ItemProps}.
	 */
	export type MenuSubLinkProps = TagProps<"a"> & {
		/** Destination the link navigates to. */
		href: string;
		/** Shorthand setting `aria-current="page"` when true and `aria-current` is otherwise unset. */
		active?: boolean;
	};

	/**
	 * Props accepted by {@link Sidebar.Rail}. Every native `<label>` attribute
	 * except `htmlFor`, which this component narrows to required — it's the
	 * id of {@link Sidebar.Trigger}'s own checkbox, the control this rail
	 * mirrors.
	 */
	export interface RailProps extends Omit<TagProps<"label">, "htmlFor"> {
		/** Id of the {@link Sidebar.Trigger} checkbox this rail toggles. */
		htmlFor: string;
	}

	/**
	 * Props accepted by {@link Sidebar.Trigger}. Every native `<input>`
	 * attribute except `type` and `role`, which the platform's checkbox
	 * semantics already fix, so `id`, `checked`, `defaultChecked`, and
	 * `disabled` all work exactly as they would on a bare checkbox.
	 */
	export interface TriggerProps extends Omit<TagProps<"input">, "type" | "role"> {
		/**
		 * Accessible label for the icon-only control — required, since the
		 * control carries no visible text for assistive technology to read.
		 */
		"aria-label": string;
	}

	/**
	 * Every prop {@link ScrollArea.ViewportProps} accepts, unchanged.
	 */
	export interface InsetProps extends ScrollArea.ViewportProps {}

	/**
	 * Every prop {@link Separator.Props} accepts, unchanged.
	 */
	export interface SeparatorProps extends Separator.Props {}
}

/**
 * Renders the rail itself: a native `<aside>` filling the shell's block size,
 * sized through the `data-variant`, `data-collapsible`, and `data-side`
 * attribute contract. `"sidebar"` sits flush with a single divider border on
 * the edge facing {@link Sidebar.Inset}; `"floating"` and `"inset"` both
 * render a rounded, shadowed panel look, with `"floating"` additionally
 * insetting itself by a margin and, where the platform supports it and the
 * user hasn't asked for reduced transparency, blurring what's behind it.
 * `side` picks which physical edge the divider border renders against —
 * mirrored by {@link Sidebar.Rail} — padded on that same physical edge with
 * `env(safe-area-inset-*)` so the rail clears a device's notch or rounded
 * corner when the shell spans the full display.
 *
 * Every collapse-driven layout change — narrowing to an icon-only rail,
 * sliding fully off its edge, hiding in favor of {@link Sidebar.MobileNav}
 * once {@link WIDE_SHELL_QUERY} no longer matches — is declared here as
 * rules keyed off the ancestor {@link Sidebar.Provider}'s own `:has()` state
 * and the {@link PROVIDER_CONTAINER_NAME} container it establishes, since
 * this host's `data-collapsible` and `data-side` attributes are what those
 * rules match against. The `"none"` mode matches neither rule set, so it
 * renders at a permanent full width regardless of the shell's own size.
 *
 * @param handle Runtime handle carrying the host `<aside>`'s props.
 * @returns The render function producing the rail's markup.
 * @example
 * <Sidebar.Provider>
 * 	<Sidebar variant="floating" collapsible="icon" side="right">
 * 		<Sidebar.Header>{logo}</Sidebar.Header>
 * 		<Sidebar.Content>{nav}</Sidebar.Content>
 * 	</Sidebar>
 * 	<Sidebar.Inset>{children}</Sidebar.Inset>
 * </Sidebar.Provider>
 */
export function Sidebar(handle: Handle<Sidebar.Props>) {
	return () => {
		let { variant, collapsible, side, mix, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let resolvedCollapsible = collapsible ?? DEFAULT_COLLAPSIBLE;
		let resolvedSide = side ?? DEFAULT_SIDE;

		return (
			<aside
				{...rest}
				data-slot="sidebar"
				data-variant={resolvedVariant}
				data-collapsible={resolvedCollapsible}
				data-side={resolvedSide}
				mix={[
					relative(),
					flex(),
					flexCol(),
					shrink(),
					bs("full"),
					is(varUtility("sidebar-width", "16rem")),
					willChange("transform"),
					data("side", "left", [
						borderEdge("right", { width: 1, style: "solid", color: "neutral" }),
						safeAreaPadding("left"),
					]),
					data("side", "right", [
						borderEdge("left", { width: 1, style: "solid", color: "neutral" }),
						safeAreaPadding("right"),
					]),
					data("variant", "floating", [
						m("0.5rem"),
						shadow("lg"),
						supports(
							"(backdrop-filter: blur(0))",
							media("(prefers-reduced-transparency: no-preference)", [
								border(
									colorMix(
										"oklab",
										{ color: "var(--ui-neutral-border)", weight: 80 },
										"transparent",
									),
								),
								bg(
									colorMix(
										"oklab",
										{ color: "var(--ui-neutral-bg-tint)", weight: 95 },
										"transparent",
									),
								),
								backdropBlur("md"),
								backdropSaturate(1.4),
							]),
						),
					]),
					data("variant", "inset", shadow("base")),
					when(
						`@container ${PROVIDER_CONTAINER_NAME} (max-width: 47.9375rem)`,
						when('&[data-collapsible="icon"], &[data-collapsible="offcanvas"]', hidden()),
					),
					media("(prefers-reduced-motion: reduce)", raw({ transitionProperty: "none" })),
					bg("neutral.tint"),
					fg("neutral.emphasis"),
					transition("inline-size, transform", {
						duration: durations.normal,
						easing: easings.standard,
					}),
					data("variant", "floating", [rounded("xl"), border({ color: "neutral", width: 1 })]),
					data("variant", "inset", [rounded("xl"), border({ color: "neutral", width: 1 })]),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders the shell's layout root: a flex row placing {@link Sidebar} beside
 * {@link Sidebar.Inset}, filling at least the full dynamic viewport block
 * size. Declares the {@link PROVIDER_CONTAINER_NAME} named container both of
 * those parts and {@link Sidebar.Rail} query to find out how much room the
 * shell has, and hosts every rule driving the collapse itself: wherever
 * {@link Sidebar.Trigger}'s checkbox reaches `:checked` anywhere in this
 * subtree — inside {@link Sidebar} itself, inside {@link Sidebar.Inset}, or
 * anywhere else a consumer places it — the matching descendant rules apply,
 * regardless of how deep the checkbox sits. No JavaScript observes or
 * mirrors that state anywhere in this module; a consumer wanting it to
 * survive a reload attaches its own mixin to {@link Sidebar.Trigger} that
 * writes the checkbox's `checked` value into a cookie the next page's markup
 * already reflects.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the shell's markup.
 * @example
 * <Sidebar.Provider>
 * 	<Sidebar collapsible="icon">
 * 		<Sidebar.Header>
 * 			<Sidebar.Trigger id="app-sidebar-toggle" aria-label={t("nav.toggleSidebar")} />
 * 		</Sidebar.Header>
 * 		<Sidebar.Content>
 * 			<Sidebar.Menu>
 * 				<Sidebar.MenuItem>
 * 					<Sidebar.MenuLink href="/dashboard" active>
 * 						<HomeIcon aria-hidden />
 * 						<span data-sidebar-collapsed-hide>{t("nav.dashboard")}</span>
 * 					</Sidebar.MenuLink>
 * 				</Sidebar.MenuItem>
 * 			</Sidebar.Menu>
 * 		</Sidebar.Content>
 * 		<Sidebar.Rail htmlFor="app-sidebar-toggle" />
 * 	</Sidebar>
 * 	<Sidebar.Inset>{children}</Sidebar.Inset>
 * </Sidebar.Provider>
 */
Sidebar.Provider = function SidebarProvider(handle: Handle<Sidebar.ProviderProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="provider"
				mix={[
					flex(),
					items("stretch"),
					minBs("100dvh"),
					is("full"),
					when(`&:has(${TOGGLE_CHECKED_SELECTOR})`, [
						when('[data-slot="sidebar"][data-collapsible="icon"]', [
							is(varUtility("sidebar-width-icon", "3rem")),
							when("[data-sidebar-collapsed-hide]", visuallyHidden()),
							when('[data-slot="group-label"]', visuallyHidden()),
							when('[data-slot="menu-badge"]', hidden()),
							when('[data-slot="menu-sub"]', hidden()),
							when('[data-slot="menu-button"], [data-slot="menu-link"]', [
								justify("center"),
								pi("0"),
							]),
						]),
						when('[data-slot="sidebar"][data-collapsible="offcanvas"][data-side="left"]', [
							translateX("-100%"),
							is("0"),
							overflow("hidden"),
							border({ width: "0", noStyleDefault: true }),
						]),
						when('[data-slot="sidebar"][data-collapsible="offcanvas"][data-side="right"]', [
							translateX("100%"),
							is("0"),
							overflow("hidden"),
							border({ width: "0", noStyleDefault: true }),
						]),
					]),
					container(PROVIDER_CONTAINER_NAME),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the docked, edge-to-edge mobile substitute for {@link Sidebar}: the
 * same nav content re-composed inside {@link Dialog}, docked to `side` and
 * sliding in from it, sized to {@link Sidebar}'s own mobile width and padded
 * on every edge with `env(safe-area-inset-*)` since a drawer this size
 * commonly spans a device's full display. A consumer opens it the same way
 * any {@link Dialog} opens — a `<button commandfor={id} command="show-modal">`
 * elsewhere on the page — since Invoker Commands, not a viewport check, are
 * what decide when the mobile nav is showing; a container query only ever
 * governs {@link Sidebar}'s own persistent rendering, never this drawer's.
 *
 * @param handle Runtime handle carrying the host `<dialog>`'s props, plus `side`.
 * @returns The render function producing the drawer's markup.
 * @example
 * <button commandfor="mobile-nav" command="show-modal" aria-label={t("nav.openMenu")}>
 * 	<MenuIcon aria-hidden />
 * </button>
 * <Sidebar.MobileNav id="mobile-nav" aria-label={t("nav.mainNavigation")}>
 * 	<Sidebar.Header>{logo}</Sidebar.Header>
 * 	<Sidebar.Content>{nav}</Sidebar.Content>
 * </Sidebar.MobileNav>
 */
Sidebar.MobileNav = function SidebarMobileNav(handle: Handle<Sidebar.MobileNavProps>) {
	return () => {
		let { side, mix, ...rest } = handle.props;
		let resolvedSide = side ?? DEFAULT_SIDE;

		return (
			<Dialog
				{...rest}
				data-slot="mobile-nav"
				data-side={resolvedSide}
				mix={[
					fixed(),
					insBs("0"),
					insBe("0"),
					m("0"),
					rounded("none"),
					p("0"),
					maxBs("none"),
					bs("full"),
					is(varUtility("sidebar-width-mobile", "18rem")),
					maxIs("90vw"),
					flex(),
					flexCol(),
					overflow("hidden"),
					willChange("transform"),
					raw({ transitionBehavior: "allow-discrete" }),
					data("side", "left", [raw({ left: "0" }), safeAreaPadding("left"), translateX("-100%")]),
					when('&[data-side="left"][open]', translateX("0")),
					data("side", "right", [
						raw({ right: "0" }),
						safeAreaPadding("right"),
						translateX("100%"),
					]),
					when('&[data-side="right"][open]', translateX("0")),
					when("@starting-style", [
						when('&[data-side="left"][open]', translateX("-100%")),
						when('&[data-side="right"][open]', translateX("100%")),
					]),
					media("(prefers-reduced-motion: reduce)", raw({ transitionProperty: "none" })),
					pbs("env(safe-area-inset-top, 0px)"),
					pbe("env(safe-area-inset-bottom, 0px)"),
					transition("transform, display, overlay", {
						duration: durations.slow,
						easing: easings.decelerate,
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the rail's header slot: a `<header>` laying out its children in a
 * centered row, block-sized to a fixed height with a divider border below
 * it, padded on its block-start edge with `env(safe-area-inset-top)` in
 * addition to its own padding for when the rail spans a device's full
 * display. Compose {@link Sidebar.Trigger}, a logo, or a workspace switcher
 * as its children.
 *
 * @param handle Runtime handle carrying the host `<header>`'s props.
 * @returns The render function producing the header slot's markup.
 * @example
 * <Sidebar.Header>
 * 	<Sidebar.Trigger id="app-sidebar-toggle" aria-label={t("nav.toggleSidebar")} />
 * </Sidebar.Header>
 */
Sidebar.Header = function SidebarHeader(handle: Handle<Sidebar.HeaderProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<header
				{...rest}
				data-slot="header"
				mix={[
					flex(),
					bs("4rem"),
					shrink(),
					items("center"),
					borderEdge("block-end", {
						width: 1,
						style: "solid",
						color: colorMix(
							"oklab",
							{ color: "var(--ui-neutral-border)", weight: 80 },
							"transparent",
						),
					}),
					gap("0.5rem"),
					pi("1rem"),
					pbs("calc(0.5rem + env(safe-area-inset-top, 0px))"),
					pbe("0.5rem"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the rail's own scrollable nav region: {@link ScrollArea.Viewport}
 * laid out as a padded, gap-separated column, so its content — typically one
 * or more {@link Sidebar.Group}s — scrolls independently of
 * {@link Sidebar.Header} and {@link Sidebar.Footer} once it overflows the
 * rail's own block size.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the content region's markup.
 * @example
 * <Sidebar.Content>
 * 	<Sidebar.Group>
 * 		<Sidebar.GroupLabel>{t("nav.workspace")}</Sidebar.GroupLabel>
 * 		<Sidebar.Menu>...</Sidebar.Menu>
 * 	</Sidebar.Group>
 * </Sidebar.Content>
 */
Sidebar.Content = function SidebarContent(handle: Handle<Sidebar.ContentProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<ScrollArea.Viewport
				{...rest}
				data-slot="content"
				mix={[
					flex(),
					flexCol(),
					grow(),
					minBs("0"),
					bs("auto"),
					gap("1rem"),
					pi("0.75rem"),
					pb("1rem"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the rail's footer slot: a `<footer>` laying out its children in a
 * centered row with a divider border above it, padded on its block-end edge
 * with `env(safe-area-inset-bottom)` in addition to its own padding for when
 * the rail spans a device's full display. Compose an account switcher or a
 * settings link as its children.
 *
 * @param handle Runtime handle carrying the host `<footer>`'s props.
 * @returns The render function producing the footer slot's markup.
 * @example
 * <Sidebar.Footer>
 * 	<Sidebar.MenuButton>{t("nav.account")}</Sidebar.MenuButton>
 * </Sidebar.Footer>
 */
Sidebar.Footer = function SidebarFooter(handle: Handle<Sidebar.FooterProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<footer
				{...rest}
				data-slot="footer"
				mix={[
					flex(),
					shrink(),
					items("center"),
					borderEdge("block-start", {
						width: 1,
						style: "solid",
						color: colorMix(
							"oklab",
							{ color: "var(--ui-neutral-border)", weight: 80 },
							"transparent",
						),
					}),
					gap("0.5rem"),
					pi("1rem"),
					pbs("1rem"),
					pbe("calc(1rem + env(safe-area-inset-bottom, 0px))"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a flat navigation list: a `<nav>` stacking its {@link Sidebar.Item}
 * children in a column with a small gap, an alternative to
 * {@link Sidebar.Menu}'s group-oriented structure for a rail that just needs
 * a simple, ungrouped set of links.
 *
 * @param handle Runtime handle carrying the host `<nav>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <Sidebar.Nav aria-label={t("nav.mainNavigation")}>
 * 	<Sidebar.Item href="/dashboard" current>{t("nav.dashboard")}</Sidebar.Item>
 * 	<Sidebar.Item href="/settings">{t("nav.settings")}</Sidebar.Item>
 * </Sidebar.Nav>
 */
Sidebar.Nav = function SidebarNav(handle: Handle<Sidebar.NavProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <nav {...rest} data-slot="nav" mix={[vstack({ gap: "0.25rem" }), mix]} />;
	};
};

/**
 * Renders a single row inside {@link Sidebar.Nav}: a native `<a>` colored
 * through the `data-color` attribute contract, filled and tinted only once
 * it's current — reading `aria-current` directly, the same way
 * {@link Sidebar.MenuLink} does — rather than at rest, where every item
 * renders in the same neutral tone regardless of `color`. A keyboard
 * focus-visible ring always reads in the item's own semantic color, current
 * or not.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Sidebar.Item href="/dashboard" current>
 * 	<HomeIcon aria-hidden />
 * 	{t("nav.dashboard")}
 * </Sidebar.Item>
 * @example
 * <Sidebar.Item href="/billing/cancel" color="danger" aria-current={pathname === "/billing/cancel" ? "page" : undefined}>
 * 	<XCircleIcon aria-hidden />
 * 	{t("nav.cancelPlan")}
 * </Sidebar.Item>
 */
Sidebar.Item = function SidebarItem(handle: Handle<Sidebar.ItemProps>) {
	return () => {
		let { color, current, "aria-current": ariaCurrent, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_ITEM_COLOR;
		let resolvedAriaCurrent = resolveAriaCurrent(current, ariaCurrent);

		return (
			<a
				{...rest}
				aria-current={resolvedAriaCurrent}
				data-slot="item"
				data-color={resolvedColor}
				mix={[
					when("&:focus-visible", [
						outline({ color: "primary.ring", offset: 2 }),
						data("color", "neutral", outline("neutral.ring")),
						data("color", "success", outline("success.ring")),
						data("color", "warning", outline("warning.ring")),
						data("color", "danger", outline("danger.ring")),
					]),
					flex(),
					minBs("2.25rem"),
					items("center"),
					fontSize("sm"),
					weight(500),
					textDecoration("none"),
					when("& > svg, & > [data-slot='icon']", [is("1rem"), bs("1rem"), shrink()]),
					when("&:active", scaleProperty(0.98)),
					when('&[aria-disabled="true"]', [cursor("not-allowed"), opacity(50)]),
					gap("0.75rem"),
					rounded("lg"),
					pi("0.75rem"),
					pb("0.5rem"),
					fg("neutral"),
					transition(
						"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
					),
					when("&:hover", [bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
					when("& > svg, & > [data-slot='icon']", fg("neutral.muted")),
					when('&[aria-current]:not([aria-current="false"])', [
						bg("neutral.bg-tint-hover"),
						fg("neutral.emphasis"),
						when("& > svg, & > [data-slot='icon']", fg("neutral.emphasis")),
					]),
					data(
						"color",
						"primary",
						when('&[aria-current]:not([aria-current="false"])', [
							bg("primary.tint"),
							fg("primary"),
							when("& > svg, & > [data-slot='icon']", fg("primary")),
						]),
					),
					data(
						"color",
						"success",
						when('&[aria-current]:not([aria-current="false"])', [
							bg("success.tint"),
							fg("success"),
							when("& > svg, & > [data-slot='icon']", fg("success")),
						]),
					),
					data(
						"color",
						"warning",
						when('&[aria-current]:not([aria-current="false"])', [
							bg("warning.tint"),
							fg("warning"),
							when("& > svg, & > [data-slot='icon']", fg("warning")),
						]),
					),
					data(
						"color",
						"danger",
						when('&[aria-current]:not([aria-current="false"])', [
							bg("danger.tint"),
							fg("danger"),
							when("& > svg, & > [data-slot='icon']", fg("danger")),
						]),
					),
					when("&:active", bg("neutral.bg-tint-pressed")),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a related cluster of {@link Sidebar.Menu} items: a `<section>`
 * stacking its children in a column, gaining a divider border and extra
 * space above itself once it follows another {@link Sidebar.Group} sibling,
 * so groups read as visually separated without either one needing to know
 * about the other.
 *
 * @param handle Runtime handle carrying the host `<section>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <Sidebar.Group>
 * 	<Sidebar.GroupLabel>{t("nav.workspace")}</Sidebar.GroupLabel>
 * 	<Sidebar.GroupContent>
 * 		<Sidebar.Menu>...</Sidebar.Menu>
 * 	</Sidebar.GroupContent>
 * </Sidebar.Group>
 */
Sidebar.Group = function SidebarGroup(handle: Handle<Sidebar.GroupProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<section
				{...rest}
				data-slot="group"
				mix={[
					flex(),
					flexCol(),
					when("& + &", [
						mbs("0.5rem"),
						borderEdge("block-start", {
							width: 1,
							style: "solid",
							color: colorMix(
								"oklab",
								{ color: "var(--ui-neutral-border)", weight: 60 },
								"transparent",
							),
						}),
					]),
					gap("0.25rem"),
					when("& + &", pbs("1rem")),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link Sidebar.Group}'s label: a small, muted, uppercase heading
 * row. Once the ancestor {@link Sidebar} collapses to its icon-only rail,
 * {@link Sidebar.Provider} clips this label down to nothing visually while
 * keeping it in the accessibility tree, so the group it names stays
 * announced even though its text disappears from view. Compose
 * {@link Sidebar.GroupAction} as a trailing child for a label row that also
 * carries an action.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the label's markup.
 * @example
 * <Sidebar.GroupLabel>{t("nav.workspace")}</Sidebar.GroupLabel>
 */
Sidebar.GroupLabel = function SidebarGroupLabel(handle: Handle<Sidebar.GroupLabelProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="group-label"
				mix={[
					flex(),
					items("center"),
					justify("between"),
					mbe("0.25rem"),
					weight(600),
					fontSize("xs"),
					textTransform("uppercase"),
					tracking("wider"),
					userSelect(),
					pi("0.5rem"),
					pb("0.375rem"),
					fg("neutral.muted"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a small icon-only action button anchored to {@link Sidebar.GroupLabel}'s
 * trailing edge — adding a new item to the group, for instance. In dev mode,
 * an action whose content carries no plain text and no
 * `aria-label`/`aria-labelledby` logs a `console.warn`, since assistive
 * technology otherwise has no accessible name to announce for it.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the action's markup.
 * @example
 * <Sidebar.GroupLabel>
 * 	{t("nav.workspace")}
 * 	<Sidebar.GroupAction aria-label={t("nav.addWorkspace")}>
 * 		<PlusIcon aria-hidden />
 * 	</Sidebar.GroupAction>
 * </Sidebar.GroupLabel>
 */
Sidebar.GroupAction = function SidebarGroupAction(handle: Handle<Sidebar.GroupActionProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		warnIfNoAccessibleName(
			handle.props,
			children,
			"Sidebar.GroupAction: an icon-only action needs an `aria-label` describing what it does — assistive technology has no accessible text to announce otherwise.",
		);

		return (
			<button
				type="button"
				{...rest}
				data-slot="group-action"
				mix={[
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					inlineFlex(),
					is("1.25rem"),
					bs("1.25rem"),
					items("center"),
					justify("center"),
					when("&:disabled", [cursor("not-allowed"), opacity(50)]),
					rounded("sm"),
					fg("neutral.muted"),
					transition(
						"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
					),
					hover([bg("neutral.bg-tint-hover"), fg("neutral")]),
					mix,
				]}
			>
				{children}
			</button>
		);
	};
};

/**
 * Renders {@link Sidebar.Group}'s body slot: a `<div>` stacking its children
 * — typically a {@link Sidebar.Menu} — in a column with a small gap.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the body slot's markup.
 * @example
 * <Sidebar.GroupContent>
 * 	<Sidebar.Menu>...</Sidebar.Menu>
 * </Sidebar.GroupContent>
 */
Sidebar.GroupContent = function SidebarGroupContent(handle: Handle<Sidebar.GroupContentProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} data-slot="group-content" mix={[vstack({ gap: "0.125rem" }), mix]} />;
	};
};

/**
 * Renders a list of nav rows: a native `<ul>` stacking {@link Sidebar.MenuItem}
 * children in a column with a small gap.
 *
 * @param handle Runtime handle carrying the host `<ul>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <Sidebar.Menu>
 * 	<Sidebar.MenuItem>
 * 		<Sidebar.MenuLink href="/dashboard">{t("nav.dashboard")}</Sidebar.MenuLink>
 * 	</Sidebar.MenuItem>
 * </Sidebar.Menu>
 */
Sidebar.Menu = function SidebarMenu(handle: Handle<Sidebar.MenuProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<ul
				{...rest}
				data-slot="menu"
				mix={[is("full"), minIs("0"), vstack({ gap: "0.125rem" }), mix]}
			/>
		);
	};
};

/**
 * Renders a single row inside {@link Sidebar.Menu}: a relatively positioned
 * `<li>` whose own `:hover`/`:focus-within` state reveals a nested
 * {@link Sidebar.MenuAction} that stays invisible at rest.
 *
 * @param handle Runtime handle carrying the host `<li>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Sidebar.MenuItem>
 * 	<Sidebar.MenuLink href="/inbox">{t("nav.inbox")}</Sidebar.MenuLink>
 * 	<Sidebar.MenuAction aria-label={t("nav.inboxSettings")}>
 * 		<SettingsIcon aria-hidden />
 * 	</Sidebar.MenuAction>
 * </Sidebar.MenuItem>
 */
Sidebar.MenuItem = function SidebarMenuItem(handle: Handle<Sidebar.MenuItemProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<li
				{...rest}
				data-slot="menu-item"
				mix={[
					relative(),
					flex(),
					items("center"),
					when(
						"&:hover [data-slot='menu-action'], &:focus-within [data-slot='menu-action']",
						opacity(100),
					),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a native `<button>` row for an in-page action inside
 * {@link Sidebar.Menu} — one that doesn't navigate, unlike
 * {@link Sidebar.MenuLink}. Sized through `data-size`, and marked as the
 * current selection through `active`, independent of any navigation state.
 * The row's first direct `<svg>` (or `[data-slot="icon"]`) child is sized and
 * muted as a leading icon; a following `<span>` truncates instead of
 * wrapping, so a long label never grows the rail.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Sidebar.MenuButton onClick={openCommandPalette}>
 * 	<SearchIcon aria-hidden />
 * 	<span data-sidebar-collapsed-hide>{t("nav.search")}</span>
 * </Sidebar.MenuButton>
 */
Sidebar.MenuButton = function SidebarMenuButton(handle: Handle<Sidebar.MenuButtonProps>) {
	return () => {
		let { size, active, mix, ...rest } = handle.props;
		let resolvedSize = size ?? DEFAULT_MENU_BUTTON_SIZE;

		return (
			<button
				type="button"
				{...rest}
				data-slot="menu-button"
				data-size={resolvedSize}
				data-active={active || undefined}
				mix={[
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					...menuRowMixins(),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a native `<a>` row for navigation inside {@link Sidebar.Menu},
 * visually identical to {@link Sidebar.MenuButton}. `active` sets
 * `aria-current="page"` when `aria-current` is otherwise unset, and the
 * row's current-page treatment reads `aria-current` directly rather than a
 * separate tracked flag, matching {@link Sidebar.Item}.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Sidebar.MenuLink href="/dashboard" active>
 * 	<HomeIcon aria-hidden />
 * 	<span data-sidebar-collapsed-hide>{t("nav.dashboard")}</span>
 * </Sidebar.MenuLink>
 */
Sidebar.MenuLink = function SidebarMenuLink(handle: Handle<Sidebar.MenuLinkProps>) {
	return () => {
		let { size, active, "aria-current": ariaCurrent, mix, ...rest } = handle.props;
		let resolvedSize = size ?? DEFAULT_MENU_BUTTON_SIZE;
		let resolvedAriaCurrent = resolveAriaCurrent(active, ariaCurrent);

		return (
			<a
				{...rest}
				aria-current={resolvedAriaCurrent}
				data-slot="menu-link"
				data-size={resolvedSize}
				data-active={active || undefined}
				mix={[
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					...menuRowMixins(),
					mix,
				]}
			/>
		);
	};
};

/**
 * Shared `@pkg/u` mixins for {@link Sidebar.MenuButton} and
 * {@link Sidebar.MenuLink}, factored out since the two differ only in host
 * element and how their current/active state is expressed.
 */
function menuRowMixins() {
	return [
		flex(),
		is("full"),
		minIs("0"),
		items("center"),
		overflow("hidden"),
		textAlign("start"),
		weight(500),
		textDecoration("none"),
		fontSize("sm"),
		outlineStyle("none"),
		when("& > svg:first-child, & > [data-slot='icon']:first-child", [
			is("1rem"),
			bs("1rem"),
			shrink(),
		]),
		when("& > span", truncate()),
		data("size", "sm", [
			minBs("1.75rem"),
			pi("0.625rem"),
			pb("0.375rem"),
			fontSize("xs"),
			when("& > svg:first-child, & > [data-slot='icon']:first-child", [
				is("0.875rem"),
				bs("0.875rem"),
			]),
		]),
		data("size", "md", minBs("2.25rem")),
		data("size", "lg", [
			minBs("2.75rem"),
			pi("1rem"),
			pb("0.625rem"),
			fontSize("base"),
			when("& > svg:first-child, & > [data-slot='icon']:first-child", [
				is("1.25rem"),
				bs("1.25rem"),
			]),
		]),
		when("&:active", scaleProperty(0.98)),
		when("&:disabled", [cursor("not-allowed"), opacity(50)]),
		when('&[aria-disabled="true"]', [cursor("not-allowed"), opacity(50)]),
		gap("0.75rem"),
		rounded("lg"),
		pi("0.75rem"),
		pb("0.5rem"),
		fg("neutral"),
		transition(
			"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
		),
		hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
		when("& > svg:first-child, & > [data-slot='icon']:first-child", fg("neutral.muted")),
		when('&[data-active], &[aria-current]:not([aria-current="false"])', [
			bg("neutral.bg-tint-hover"),
			fg("neutral.emphasis"),
			when("& > svg:first-child, & > [data-slot='icon']:first-child", fg("neutral.emphasis")),
		]),
		when("&:active", bg("neutral.bg-tint-pressed")),
	];
}

/**
 * Renders a small icon-only action anchored to {@link Sidebar.MenuItem}'s
 * trailing edge, invisible until `showOnHover` reveals it on hover or focus
 * within the row. In dev mode, an action whose content carries no plain text
 * and no `aria-label`/`aria-labelledby` logs a `console.warn`, since
 * assistive technology otherwise has no accessible name to announce for it.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the action's markup.
 * @example
 * <Sidebar.MenuAction aria-label={t("nav.inboxSettings")}>
 * 	<SettingsIcon aria-hidden />
 * </Sidebar.MenuAction>
 * @example
 * <Sidebar.MenuAction showOnHover={false} aria-label={t("nav.starred")}>
 * 	<StarIcon aria-hidden />
 * </Sidebar.MenuAction>
 */
Sidebar.MenuAction = function SidebarMenuAction(handle: Handle<Sidebar.MenuActionProps>) {
	return () => {
		let { showOnHover, children, mix, ...rest } = handle.props;
		let resolvedShowOnHover = showOnHover ?? DEFAULT_SHOW_ON_HOVER;

		warnIfNoAccessibleName(
			handle.props,
			children,
			"Sidebar.MenuAction: an icon-only action needs an `aria-label` describing what it does — assistive technology has no accessible text to announce otherwise.",
		);

		return (
			<button
				type="button"
				{...rest}
				data-slot="menu-action"
				data-show-on-hover={resolvedShowOnHover ? undefined : "false"}
				mix={[
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					absolute(),
					insIe("0.375rem"),
					insBs("50%"),
					translateProperty("0 -50%"),
					inlineFlex(),
					is("1.5rem"),
					bs("1.5rem"),
					items("center"),
					justify("center"),
					opacity(0),
					focusVisible(opacity(100)),
					when("&:disabled", [cursor("not-allowed"), opacity(50)]),
					data("show-on-hover", "false", opacity(100)),
					rounded("md"),
					fg("neutral.muted"),
					transition(
						"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
					),
					hover([bg("neutral.bg-tint-pressed"), fg("neutral")]),
					mix,
				]}
			>
				{children}
			</button>
		);
	};
};

/**
 * Renders a small count or status pill pinned to the trailing edge of a
 * {@link Sidebar.MenuButton} or {@link Sidebar.MenuLink} row. Hidden entirely
 * once the ancestor {@link Sidebar} collapses to its icon-only rail, since
 * there's no room left to show it.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the pill's markup.
 * @example
 * <Sidebar.MenuLink href="/inbox">
 * 	{t("nav.inbox")}
 * 	<Sidebar.MenuBadge>24</Sidebar.MenuBadge>
 * </Sidebar.MenuLink>
 */
Sidebar.MenuBadge = function SidebarMenuBadge(handle: Handle<Sidebar.MenuBadgeProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<span
				{...rest}
				data-slot="menu-badge"
				mix={[
					mis("auto"),
					shrink(),
					fontSize("xs"),
					weight(600),
					tabularNums(),
					rounded("md"),
					pi("0.375rem"),
					pb("0.125rem"),
					bg("neutral.bg-tint-hover"),
					fg("neutral"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a static loading placeholder shaped like {@link Sidebar.MenuButton}:
 * an optional icon-shaped {@link Skeleton} block followed by a text-shaped
 * one. Neither block animates on its own — compose the `pulse()` or
 * `shimmer()` factory from the animation layer through `mix` (or the
 * `parts`-equivalent `style` override below) for a breathing or sweeping
 * loading cue. Vary the text block's `inlineSize` per row via `style` for a
 * staggered, more natural-looking loading list.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the placeholder's markup.
 * @example
 * <Sidebar.MenuSkeleton showIcon />
 * @example
 * <Sidebar.MenuSkeleton style={{ inlineSize: "70%" }} />
 */
Sidebar.MenuSkeleton = function SidebarMenuSkeleton(handle: Handle<Sidebar.MenuSkeletonProps>) {
	return () => {
		let { showIcon, mix, ...rest } = handle.props;
		let resolvedShowIcon = showIcon ?? DEFAULT_SHOW_ICON;

		return (
			<div
				{...rest}
				data-slot="menu-skeleton"
				mix={[
					flex(),
					items("center"),
					bs("2.25rem"),
					gap("0.75rem"),
					pi("0.75rem"),
					rounded("lg"),
					mix,
				]}
			>
				{resolvedShowIcon && (
					<span
						aria-hidden="true"
						data-slot="menu-skeleton-icon"
						mix={[is("1rem"), bs("1rem"), shrink(), rounded("sm"), bg("neutral.border")]}
					/>
				)}
				<span
					aria-hidden="true"
					data-slot="menu-skeleton-text"
					mix={[bs("1rem"), grow(), is("60%"), rounded("md"), bg("neutral.border")]}
				/>
			</div>
		);
	};
};

/**
 * Renders a nested list of sub-rows beneath a {@link Sidebar.MenuItem}: a
 * `<ul>` indented from and bordered against the rail's inline-start edge.
 * Hidden entirely once the ancestor {@link Sidebar} collapses to its
 * icon-only rail, since a nested list has nowhere legible left to render.
 *
 * @param handle Runtime handle carrying the host `<ul>`'s props.
 * @returns The render function producing the nested list's markup.
 * @example
 * <Sidebar.MenuSub>
 * 	<Sidebar.MenuSubItem>
 * 		<Sidebar.MenuSubLink href="/settings/profile">{t("nav.profile")}</Sidebar.MenuSubLink>
 * 	</Sidebar.MenuSubItem>
 * </Sidebar.MenuSub>
 */
Sidebar.MenuSub = function SidebarMenuSub(handle: Handle<Sidebar.MenuSubProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<ul
				{...rest}
				data-slot="menu-sub"
				mix={[
					relative(),
					mis("0.875rem"),
					flex(),
					flexCol(),
					borderEdge("inline-start", { width: 1, style: "solid" }),
					pis("0.875rem"),
					gap("0.125rem"),
					border("neutral"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a single row inside {@link Sidebar.MenuSub}: a plain `<li>`.
 *
 * @param handle Runtime handle carrying the host `<li>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Sidebar.MenuSubItem>
 * 	<Sidebar.MenuSubLink href="/settings/profile">{t("nav.profile")}</Sidebar.MenuSubLink>
 * </Sidebar.MenuSubItem>
 */
Sidebar.MenuSubItem = function SidebarMenuSubItem(handle: Handle<Sidebar.MenuSubItemProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <li {...rest} data-slot="menu-sub-item" mix={[flex(), items("center"), mix]} />;
	};
};

/**
 * Renders a native `<button>` row for an in-page action inside
 * {@link Sidebar.MenuSub}, smaller and more muted than
 * {@link Sidebar.MenuButton}. Marked as the current selection through
 * `active`, independent of any navigation state.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Sidebar.MenuSubButton onClick={runQuickAction}>{t("nav.markAllRead")}</Sidebar.MenuSubButton>
 */
Sidebar.MenuSubButton = function SidebarMenuSubButton(handle: Handle<Sidebar.MenuSubButtonProps>) {
	return () => {
		let { active, mix, ...rest } = handle.props;

		return (
			<button
				type="button"
				{...rest}
				data-slot="menu-sub-button"
				data-active={active || undefined}
				mix={[
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					...menuSubRowMixins(),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a native `<a>` row for navigation inside {@link Sidebar.MenuSub},
 * visually identical to {@link Sidebar.MenuSubButton}. `active` sets
 * `aria-current="page"` when `aria-current` is otherwise unset.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Sidebar.MenuSubLink href="/settings/profile" active>{t("nav.profile")}</Sidebar.MenuSubLink>
 */
Sidebar.MenuSubLink = function SidebarMenuSubLink(handle: Handle<Sidebar.MenuSubLinkProps>) {
	return () => {
		let { active, "aria-current": ariaCurrent, mix, ...rest } = handle.props;
		let resolvedAriaCurrent = resolveAriaCurrent(active, ariaCurrent);

		return (
			<a
				{...rest}
				aria-current={resolvedAriaCurrent}
				data-slot="menu-sub-link"
				data-active={active || undefined}
				mix={[
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					...menuSubRowMixins(),
					mix,
				]}
			/>
		);
	};
};

/**
 * Shared `@pkg/u` mixins for {@link Sidebar.MenuSubButton} and
 * {@link Sidebar.MenuSubLink}.
 */
function menuSubRowMixins() {
	return [
		flex(),
		minBs("2rem"),
		is("full"),
		items("center"),
		textAlign("start"),
		textDecoration("none"),
		fontSize("sm"),
		when('&[data-active], &[aria-current]:not([aria-current="false"])', weight(500)),
		when("&:active", scaleProperty(0.98)),
		when("&:disabled", [cursor("not-allowed"), opacity(50)]),
		when('&[aria-disabled="true"]', [cursor("not-allowed"), opacity(50)]),
		gap("0.5rem"),
		rounded("lg"),
		pi("0.625rem"),
		pb("0.375rem"),
		fg("neutral.muted"),
		transition(
			"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
		),
		hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
		when('&[data-active], &[aria-current]:not([aria-current="false"])', [
			bg("neutral.bg-tint-hover"),
			fg("neutral.emphasis"),
		]),
		when("&:active", bg("neutral.bg-tint-pressed")),
	];
}

/**
 * Renders a thin drag-styled affordance running along {@link Sidebar}'s own
 * edge, mirroring {@link Sidebar.Trigger}'s checkbox through `htmlFor` — a
 * click anywhere along it toggles the same collapse state, the platform's
 * ordinary `<label>`/form-control association rather than anything tracked
 * here. Positioned against the physical edge matching the ancestor rail's
 * own `data-side`, and hidden below {@link WIDE_SHELL_QUERY}, since the rail
 * itself is already hidden there in favor of {@link Sidebar.MobileNav}.
 * Marked `aria-hidden`, since {@link Sidebar.Trigger}'s own checkbox is
 * already the control assistive technology and the keyboard reach — this
 * rail is a pointer-only convenience layered alongside it.
 *
 * @param handle Runtime handle carrying the host `<label>`'s props.
 * @returns The render function producing the rail's markup.
 * @example
 * <Sidebar>
 * 	<Sidebar.Header>...</Sidebar.Header>
 * 	<Sidebar.Rail htmlFor="app-sidebar-toggle" />
 * </Sidebar>
 */
Sidebar.Rail = function SidebarRail(handle: Handle<Sidebar.RailProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<label
				{...rest}
				data-slot="rail"
				mix={[
					attrs({ "aria-hidden": true }),
					absolute(),
					insBs("0"),
					insBe("0"),
					is("1rem"),
					z(20),
					hidden(),
					cursor("col-resize"),
					when('[data-side="left"] &', raw({ right: "-1rem" })),
					when('[data-side="right"] &', raw({ left: "-1rem" })),
					after([
						absolute(),
						is("2px"),
						bg("transparent"),
						insBs("0"),
						insBe("0"),
						insIs("50%"),
						translateProperty("-50% 0"),
						raw({
							content: '""',
							transitionProperty: "background-color",
							transitionDuration: "150ms",
						}),
					]),
					when(WIDE_SHELL_QUERY, [flex(), items("center"), justify("center")]),
					hover(after(bg("neutral.border"))),
					when("&:active", after(bg("primary.ring"))),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the collapse toggle: a native `<input type="checkbox">`, visually
 * hidden but focusable, wrapped in a `<label>` styled as an icon-only
 * button. Its `:checked` state is what every collapse rule in
 * {@link Sidebar.Provider} reads — checked means the rail is collapsed
 * (icon-only, or fully off its edge), unchecked is the default, fully
 * expanded rail. Since it's a real checkbox, it's reachable in Tab order and
 * toggles on Space with no script anywhere in the path; the visible button
 * shape reads its focus-visible and disabled state straight off that same
 * input through `:has()`.
 *
 * @param handle Runtime handle carrying the host checkbox's props.
 * @returns The render function producing the toggle's markup.
 * @example
 * <Sidebar.Trigger id="app-sidebar-toggle" aria-label={t("nav.toggleSidebar")} />
 * @example
 * <Sidebar.Trigger id="app-sidebar-toggle" defaultChecked aria-label={t("nav.toggleSidebar")} />
 */
Sidebar.Trigger = function SidebarTrigger(handle: Handle<Sidebar.TriggerProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<label
				data-slot="trigger"
				mix={[
					when("&:has(input:focus-visible)", outline({ color: "primary.ring", offset: 2 })),
					relative(),
					inlineFlex(),
					is("2rem"),
					bs("2rem"),
					items("center"),
					justify("center"),
					cursor("pointer"),
					when("& > svg", [is("1rem"), bs("1rem")]),
					when("&:has(input:disabled)", [cursor("not-allowed"), opacity(50)]),
					rounded("md"),
					fg("neutral.muted"),
					transition(
						"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
					),
					hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
				]}
			>
				<PanelLeftIcon aria-hidden />
				<input type="checkbox" {...rest} data-slot="toggle" mix={[visuallyHidden(), mix]} />
			</label>
		);
	};
};

/**
 * Renders the shell's main content region: {@link ScrollArea.Viewport} laid
 * out as a growing flex column, filling the space {@link Sidebar} doesn't
 * occupy inside {@link Sidebar.Provider}'s row and shrinking or growing
 * automatically as the rail collapses, slides away, or expands — no explicit
 * margin coordination is needed, since both sit in the same flex row.
 * Declares the {@link INSET_CONTAINER_NAME} named container, so page content
 * rendered inside it (a Card, a Table, a dashboard grid) sizes itself
 * against the inset's own available width instead of the page's.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the inset's markup.
 * @example
 * <Sidebar.Inset>
 * 	<Sidebar.Trigger id="app-sidebar-toggle" aria-label={t("nav.toggleSidebar")} />
 * 	<main>{children}</main>
 * </Sidebar.Inset>
 */
Sidebar.Inset = function SidebarInset(handle: Handle<Sidebar.InsetProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<ScrollArea.Viewport
				{...rest}
				data-slot="inset"
				mix={[
					flex(),
					flexCol(),
					grow(),
					minIs("0"),
					minBs("0"),
					bs("auto"),
					container(INSET_CONTAINER_NAME),
					bg("neutral.tint"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a hairline divider between two stretches of rail content:
 * identical to {@link Separator}, with the small block-axis and inline-axis
 * margins {@link Sidebar}'s own content regions expect around one.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the divider's markup.
 * @example
 * <Sidebar.Group>...</Sidebar.Group>
 * <Sidebar.Separator />
 * <Sidebar.Group>...</Sidebar.Group>
 */
Sidebar.Separator = function SidebarSeparator(handle: Handle<Sidebar.SeparatorProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <Separator {...rest} data-slot="separator" mix={[m("0.5rem"), mix]} />;
	};
};
