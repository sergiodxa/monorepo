/**
 * A row of top-level navigation triggers, each either a plain link or a
 * button that opens a floating panel of related links. `NavigationMenu.Item`
 * hands its own stable id to whichever `NavigationMenu.Trigger` and
 * `NavigationMenu.Content` nest inside it through component context, so the
 * two pair up automatically — a consumer never wires a `commandfor`/`id`
 * pair by hand for the common case.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { bg, fg, outline } from "@pkg/u/color";
import { opacity, rounded, transition } from "@pkg/u/effects";
import { cursor, raw, userSelect } from "@pkg/u/general";
import {
	container,
	flex,
	flexCol,
	gap,
	grid,
	inlineFlex,
	items,
	justify,
	relative,
} from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { media } from "@pkg/u/responsive";
import { bs, is, maxIs, mbs, minIs, p, pb, pi } from "@pkg/u/size";
import { z } from "@pkg/u/stacking";
import { data, disabled, hover, when } from "@pkg/u/state";
import { leading, text, textDecoration, weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

import { durations, easings } from "../animations/tokens";
import { floatingSurface } from "../styles/floating-surface";
import { interactiveTransition } from "../styles/interactive-transition";

import { Popover } from "./popover";

/**
 * Named container {@link NavigationMenu.Content} declares on its own host, so
 * {@link NavigationMenu.ContentGrid} can adapt to the panel's own width
 * instead of the page's.
 */
const CONTAINER_NAME = "ui-navigation-menu-content";

/**
 * `role="list"` applied to {@link NavigationMenu.List} through {@link attrs}
 * unless a consumer supplies its own `role`. A plain `<ul>` already carries
 * this role implicitly, but restating it explicitly keeps the row reading as
 * a list to assistive technology that otherwise drops list semantics once an
 * author stylesheet clears `list-style`, the way this catalog's own reset
 * does for every list.
 */
const DEFAULT_LIST_ROLE = "list";

/**
 * Default {@link NavigationMenu.ListProps} orientation, applied when
 * `orientation` is omitted, laying triggers out in a single row.
 */
const DEFAULT_ORIENTATION: NavigationMenu.Orientation = "horizontal";

/**
 * `type` {@link NavigationMenu.TriggerProps.type} falls back to when a
 * consumer doesn't supply one, keeping a click on the trigger from
 * submitting a surrounding `<form>` the way a bare `<button>`'s default type
 * otherwise would.
 */
const DEFAULT_TRIGGER_TYPE: NonNullable<NavigationMenu.TriggerProps["type"]> = "button";

/**
 * Invoker Commands verb {@link NavigationMenu.TriggerProps.command} falls
 * back to when omitted, showing the paired {@link NavigationMenu.Content} if
 * it's hidden and hiding it again if it's already showing.
 */
const DEFAULT_TRIGGER_COMMAND = "toggle-popover";

/**
 * Side of the trigger {@link NavigationMenu.Content} renders against when
 * `placement` is left unset, matching a dropdown reading down and start-ward
 * from its trigger.
 */
const DEFAULT_CONTENT_PLACEMENT: NavigationMenu.ContentProps["placement"] = "bottom-start";

/**
 * {@link NavigationMenu.ContentProps.size} falls back to when omitted,
 * sizing the panel to its own content instead of a fixed wide measure.
 */
const DEFAULT_CONTENT_SIZE: NavigationMenu.ContentSize = "default";

/**
 * Prop types for {@link NavigationMenu} and its compound parts.
 */
export namespace NavigationMenu {
	/**
	 * Axis {@link NavigationMenu.List} lays its triggers out along: a single
	 * row, or a single column.
	 */
	export type Orientation = "horizontal" | "vertical";

	/**
	 * Panel width {@link NavigationMenu.Content} renders at: sized to its own
	 * content (`"default"`), or a fixed, generously wide measure that still
	 * clamps to the viewport on narrow screens (`"wide"`), for a panel holding
	 * a multi-column layout.
	 */
	export type ContentSize = "default" | "wide";

	/**
	 * Value {@link NavigationMenu.Item} stores in component context so the
	 * {@link NavigationMenu.Trigger} and {@link NavigationMenu.Content} nested
	 * inside it pair up automatically.
	 */
	export interface Context {
		/** Stable id the enclosing {@link NavigationMenu.Item} generated for its {@link NavigationMenu.Content}. */
		contentId: string;
	}

	/**
	 * Every native `<nav>` attribute, plus the `mix` passthrough.
	 */
	export interface Props extends TagProps<"nav"> {
		/** The menu's own {@link NavigationMenu.List}, and anything else rendered alongside it (a {@link NavigationMenu.Viewport}, for instance). */
		children?: RemixNode;
	}

	/**
	 * Every native `<ul>` attribute, plus the `mix` passthrough.
	 */
	export interface ListProps extends TagProps<"ul"> {
		/** Layout axis. Defaults to {@link DEFAULT_ORIENTATION}. */
		orientation?: Orientation;
		/** One or more {@link NavigationMenu.Item}s. */
		children?: RemixNode;
	}

	/**
	 * Every native `<li>` attribute, plus the `mix` passthrough.
	 */
	export interface ItemProps extends TagProps<"li"> {
		/**
		 * Either a standalone {@link NavigationMenu.Link}, or a
		 * {@link NavigationMenu.Trigger} followed by the
		 * {@link NavigationMenu.Content} it opens.
		 */
		children?: RemixNode;
	}

	/**
	 * Every native `<button>` attribute, plus the `mix` passthrough.
	 * `commandfor` and `command` both default from the enclosing
	 * {@link NavigationMenu.Item}'s context rather than requiring a consumer
	 * to repeat the panel's id.
	 */
	export interface TriggerProps extends TagProps<"button"> {}

	/**
	 * Every prop {@link Popover.Props} accepts except `id`, which becomes
	 * optional here since it defaults from the enclosing
	 * {@link NavigationMenu.Item}'s context, plus `size`.
	 */
	export interface ContentProps extends Omit<Popover.Props, "id" | "placement"> {
		/** Stable id matched against a {@link NavigationMenu.Trigger}'s `commandfor`. Defaults to the enclosing {@link NavigationMenu.Item}'s generated id. */
		id?: string;
		/** Side of the trigger to render against. Defaults to {@link DEFAULT_CONTENT_PLACEMENT}. */
		placement?: Popover.Placement;
		/** Panel width. Defaults to {@link DEFAULT_CONTENT_SIZE}. */
		size?: ContentSize;
	}

	/**
	 * Every native `<a>` attribute, plus the `mix` passthrough. Built as an
	 * intersection rather than an interface extension because the underlying
	 * anchor prop type is a union keyed on `href`, which an
	 * `interface … extends` clause cannot carry; `href` is narrowed to
	 * required here, since a link that goes nowhere isn't a link.
	 */
	export type LinkProps = TagProps<"a"> & {
		/** Destination the link navigates to. */
		href: string;
	};

	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough.
	 */
	export interface ViewportProps extends TagProps<"div"> {
		/** The currently active item's content, mirrored in from wherever it actually renders. */
		children?: RemixNode;
	}

	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough.
	 */
	export interface ContentListProps extends TagProps<"div"> {
		/** One or more {@link NavigationMenu.Link}s. */
		children?: RemixNode;
	}

	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough.
	 */
	export interface ContentGridProps extends TagProps<"div"> {
		/** Two or more {@link NavigationMenu.ContentColumn}s. */
		children?: RemixNode;
	}

	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough.
	 */
	export interface ContentColumnProps extends TagProps<"div"> {
		/** One or more {@link NavigationMenu.Link}s. */
		children?: RemixNode;
	}
}

/**
 * Renders the menu's root host: a native `<nav>` landmark establishing a
 * positioning context for whatever floating panels its
 * {@link NavigationMenu.Content} instances anchor against. Compose
 * {@link NavigationMenu.List} inside it for the row of triggers.
 *
 * @param handle Runtime handle carrying the host `<nav>`'s props.
 * @returns The render function producing the menu's markup.
 * @example
 * <NavigationMenu aria-label={t("nav.primary")}>
 * 	<NavigationMenu.List>
 * 		<NavigationMenu.Item>
 * 			<NavigationMenu.Link href="/">{t("nav.home")}</NavigationMenu.Link>
 * 		</NavigationMenu.Item>
 * 	</NavigationMenu.List>
 * </NavigationMenu>
 */
export function NavigationMenu(handle: Handle<NavigationMenu.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <nav {...rest} mix={[relative(), mix]} />;
	};
}

/**
 * Renders the row of top-level triggers: a native `<ul>` laying its
 * {@link NavigationMenu.Item}s out horizontally by default, switching to a
 * single start-aligned column when `orientation` is `"vertical"`. `role`
 * defaults to `"list"`, restoring list semantics that a stylesheet clearing
 * `list-style` — this catalog's own reset does, for every list — otherwise
 * drops in some assistive technology.
 *
 * @param handle Runtime handle carrying the host `<ul>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <NavigationMenu.List>
 * 	<NavigationMenu.Item>
 * 		<NavigationMenu.Link href="/pricing">{t("nav.pricing")}</NavigationMenu.Link>
 * 	</NavigationMenu.Item>
 * </NavigationMenu.List>
 * @example
 * <NavigationMenu.List orientation="vertical">
 * 	<NavigationMenu.Item>
 * 		<NavigationMenu.Link href="/settings/profile">{t("nav.profile")}</NavigationMenu.Link>
 * 	</NavigationMenu.Item>
 * </NavigationMenu.List>
 */
NavigationMenu.List = function NavigationMenuList(handle: Handle<NavigationMenu.ListProps>) {
	return () => {
		let { orientation, mix, ...rest } = handle.props;
		let resolvedOrientation = orientation ?? DEFAULT_ORIENTATION;

		return (
			<ul
				data-orientation={resolvedOrientation}
				{...rest}
				mix={[
					attrs({ role: DEFAULT_LIST_ROLE }),
					flex(),
					items("center"),
					gap(1),
					when('&[data-orientation="vertical"]', [flexCol(), items("start")]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a single top-level entry: a native `<li>` holding either a
 * standalone {@link NavigationMenu.Link} or a {@link NavigationMenu.Trigger}
 * paired with the {@link NavigationMenu.Content} it opens. The item generates
 * a stable id and provides it through component context, so whichever
 * {@link NavigationMenu.Trigger} and {@link NavigationMenu.Content} nest
 * inside pair up on their own.
 *
 * @param handle Runtime handle carrying the host `<li>`'s props and providing {@link NavigationMenu.Context}.
 * @returns The render function producing the item's markup.
 * @example
 * <NavigationMenu.Item>
 * 	<NavigationMenu.Trigger>{t("nav.products")}</NavigationMenu.Trigger>
 * 	<NavigationMenu.Content>
 * 		<NavigationMenu.ContentList>
 * 			<NavigationMenu.Link href="/products/one">{t("products.one")}</NavigationMenu.Link>
 * 			<NavigationMenu.Link href="/products/two">{t("products.two")}</NavigationMenu.Link>
 * 		</NavigationMenu.ContentList>
 * 	</NavigationMenu.Content>
 * </NavigationMenu.Item>
 */
NavigationMenu.Item = function NavigationMenuItem(
	handle: Handle<NavigationMenu.ItemProps, NavigationMenu.Context>,
) {
	return () => {
		let { mix, ...rest } = handle.props;

		handle.context.set({ contentId: handle.id });

		return <li {...rest} mix={[relative(), flex(), items("center"), mix]} />;
	};
};

/**
 * Renders a native `<button>` that opens the enclosing
 * {@link NavigationMenu.Item}'s {@link NavigationMenu.Content}: `commandfor`
 * defaults to that item's generated id and `command` defaults to
 * `"toggle-popover"`, so nesting a bare `<NavigationMenu.Trigger>` next to a
 * `<NavigationMenu.Content>` is enough to wire the two together. A supporting
 * browser computes `aria-expanded` on the trigger automatically from this
 * same invoker relationship, mirroring the panel's shown state with no
 * script of this library's own.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the trigger's markup.
 * @example
 * <NavigationMenu.Trigger>{t("nav.products")}</NavigationMenu.Trigger>
 * @example
 * <NavigationMenu.Trigger aria-disabled="true">{t("nav.archived")}</NavigationMenu.Trigger>
 */
NavigationMenu.Trigger = function NavigationMenuTrigger(
	handle: Handle<NavigationMenu.TriggerProps>,
) {
	return () => {
		let { type, commandfor, command, mix, ...rest } = handle.props;
		let context = handle.context.get(NavigationMenu.Item);
		let resolvedType = type ?? DEFAULT_TRIGGER_TYPE;
		let resolvedCommandfor = commandfor ?? context.contentId;
		let resolvedCommand = command ?? DEFAULT_TRIGGER_COMMAND;

		return (
			<button
				type={resolvedType}
				commandfor={resolvedCommandfor}
				command={resolvedCommand}
				{...rest}
				mix={[
					interactiveTransition(),
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					inlineFlex(),
					items("center"),
					gap(2),
					rounded("md"),
					pi(3),
					pb(2),
					weight("medium"),
					fg("neutral"),
					disabled(opacity(50)),
					hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
					when('&[aria-expanded="true"]', [bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
					disabled(cursor("not-allowed")),
					text("sm"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link NavigationMenu.Content}, the floating panel a
 * {@link NavigationMenu.Trigger} opens: a {@link Popover} whose `id` defaults
 * to the enclosing {@link NavigationMenu.Item}'s generated id and whose
 * `placement` defaults to reading down and start-ward from the trigger. The
 * panel sizes itself to its own content by default; set `size="wide"` for a
 * fixed, generously wide measure — still clamped to the viewport on narrow
 * screens — suited to a multi-column layout built from
 * {@link NavigationMenu.ContentGrid} and {@link NavigationMenu.ContentColumn}.
 * The panel declares the `ui-navigation-menu-content` named container so
 * {@link NavigationMenu.ContentGrid} can adapt to its own width rather than
 * the page's, and every {@link NavigationMenu.Link} nested directly inside
 * stretches to the panel's full width instead of the trigger row's
 * inline-sized look.
 *
 * The panel fades and scales in as it's shown and back out as it's hidden,
 * reading the platform's own `:popover-open` state — no script tracks the
 * transition.
 *
 * @param handle Runtime handle carrying the host's {@link Popover} props.
 * @returns The render function producing the panel's markup.
 * @example
 * <NavigationMenu.Content>
 * 	<NavigationMenu.ContentList>
 * 		<NavigationMenu.Link href="/products/one">{t("products.one")}</NavigationMenu.Link>
 * 	</NavigationMenu.ContentList>
 * </NavigationMenu.Content>
 * @example
 * <NavigationMenu.Content size="wide">
 * 	<NavigationMenu.ContentGrid>
 * 		<NavigationMenu.ContentColumn>
 * 			<NavigationMenu.Link href="/products/one">{t("products.one")}</NavigationMenu.Link>
 * 		</NavigationMenu.ContentColumn>
 * 		<NavigationMenu.ContentColumn>
 * 			<NavigationMenu.Link href="/products/two">{t("products.two")}</NavigationMenu.Link>
 * 		</NavigationMenu.ContentColumn>
 * 	</NavigationMenu.ContentGrid>
 * </NavigationMenu.Content>
 */
NavigationMenu.Content = function NavigationMenuContent(
	handle: Handle<NavigationMenu.ContentProps>,
) {
	return () => {
		let { id, placement, size, mix, ...rest } = handle.props;
		let context = handle.context.get(NavigationMenu.Item);
		let resolvedId = id ?? context.contentId;
		let resolvedPlacement = placement ?? DEFAULT_CONTENT_PLACEMENT;
		let resolvedSize = size ?? DEFAULT_CONTENT_SIZE;

		return (
			<Popover
				id={resolvedId}
				placement={resolvedPlacement}
				data-size={resolvedSize}
				{...rest}
				mix={[
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					is("max-content"),
					minIs("11rem"),
					p(2),
					z(50),
					opacity(0),
					when('& [data-slot="link"]', [is("full"), justify("start")]),
					when('&[data-size="wide"]', [is("28rem"), maxIs("calc(100vw - 2rem)")]),
					container(CONTAINER_NAME),
					transition("opacity, scale, display, overlay", {
						duration: durations.fast,
						easing: easings.standard,
					}),
					raw({
						outlineStyle: "none",
						scale: "0.95",
						transitionBehavior: "allow-discrete",
					}),
					when("&:popover-open", [opacity(100), raw({ scale: "none" })]),
					when("@starting-style", when("&:popover-open", [opacity(0), raw({ scale: "0.95" })])),
					media(
						"(prefers-reduced-motion: reduce)",
						raw({ scale: "none", transitionProperty: "opacity, display, overlay" }),
					),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link NavigationMenu.LinkProps.children} as a native `<a>`,
 * usable as a standalone {@link NavigationMenu.Item}'s entry or nested inside
 * {@link NavigationMenu.Content} as one of its panel's entries — the
 * enclosing panel stretches it to the panel's full width automatically. The
 * link's current-page state reads directly off `aria-current` — set
 * `aria-current="page"` (or any value other than `"false"`) on the host from
 * whatever routing layer determines the active path server-side. Setting
 * `aria-disabled="true"` mutes the link's color and swaps its cursor to
 * signal it shouldn't be followed, keeping in mind that only omitting or
 * neutralizing `href` actually stops the navigation, since a plain link has
 * no native disabled state.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the link's markup.
 * @example
 * <NavigationMenu.Link href="/pricing">{t("nav.pricing")}</NavigationMenu.Link>
 * @example
 * <NavigationMenu.Link href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined}>
 * 	{t("nav.dashboard")}
 * </NavigationMenu.Link>
 */
NavigationMenu.Link = function NavigationMenuLink(handle: Handle<NavigationMenu.LinkProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<a
				data-slot="link"
				{...rest}
				mix={[
					interactiveTransition(),
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					inlineFlex(),
					items("center"),
					gap(2),
					rounded("md"),
					pi(3),
					pb(2),
					leading(1),
					weight("medium"),
					fg("neutral"),
					hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
					when('&[aria-current]:not([aria-current="false"])', [
						bg("neutral.bg-tint-hover"),
						fg("neutral.emphasis"),
					]),
					when('&[aria-disabled="true"]', [opacity(50), cursor("not-allowed")]),
					userSelect(),
					textDecoration("none"),
					raw({ fontSize: "0.875rem" }),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a shared, independently animated surface for a multi-item menu
 * that swaps one active item's content into a single sized frame instead of
 * each {@link NavigationMenu.Content} floating on its own: a plain `<div>`
 * reading its own inline size and block size from the
 * `--ui-navigation-menu-viewport-inline-size` and
 * `--ui-navigation-menu-viewport-block-size` custom properties, transitioning
 * smoothly between values as they change. It carries no behavior of its
 * own — pair it with a mixin that measures the active item's panel, writes
 * those two custom properties, and toggles `data-visible` to fade and scale
 * the frame in and out as the menu opens and closes.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the shared frame's markup.
 * @example
 * <NavigationMenu.Viewport data-visible={isMenuOpen || undefined} />
 */
NavigationMenu.Viewport = function NavigationMenuViewport(
	handle: Handle<NavigationMenu.ViewportProps>,
) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					floatingSurface(),
					relative(),
					mbs(2),
					overflow(),
					is("var(--ui-navigation-menu-viewport-inline-size, auto)"),
					bs("var(--ui-navigation-menu-viewport-block-size, auto)"),
					opacity(0),
					transition("inline-size, block-size, opacity, scale", {
						duration: durations.normal,
						easing: easings.decelerate,
					}),
					raw({ scale: "0.95" }),
					data("visible", [opacity(100), raw({ scale: "none" })]),
					when("@starting-style", data("visible", [opacity(0), raw({ scale: "0.95" })])),
					media(
						"(prefers-reduced-motion: reduce)",
						raw({ scale: "none", transitionProperty: "inline-size, block-size, opacity" }),
					),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link NavigationMenu.ContentListProps.children} as a plain
 * vertical run of {@link NavigationMenu.Link}s inside
 * {@link NavigationMenu.Content} — the panel's simplest layout, for a
 * dropdown that's just a short list of destinations.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <NavigationMenu.ContentList>
 * 	<NavigationMenu.Link href="/products/one">{t("products.one")}</NavigationMenu.Link>
 * 	<NavigationMenu.Link href="/products/two">{t("products.two")}</NavigationMenu.Link>
 * </NavigationMenu.ContentList>
 */
NavigationMenu.ContentList = function NavigationMenuContentList(
	handle: Handle<NavigationMenu.ContentListProps>,
) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} mix={[grid(), gap(1), mix]} />;
	};
};

/**
 * Renders {@link NavigationMenu.ContentGridProps.children} as a
 * multi-column layout inside {@link NavigationMenu.Content}: a single column
 * while the panel's own `ui-navigation-menu-content` container is narrower
 * than `40rem`, switching to two side-by-side columns once it grows past
 * that width. Nest a {@link NavigationMenu.ContentColumn} per column.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the grid's markup.
 * @example
 * <NavigationMenu.Content size="wide">
 * 	<NavigationMenu.ContentGrid>
 * 		<NavigationMenu.ContentColumn>
 * 			<NavigationMenu.Link href="/products/one">{t("products.one")}</NavigationMenu.Link>
 * 		</NavigationMenu.ContentColumn>
 * 		<NavigationMenu.ContentColumn>
 * 			<NavigationMenu.Link href="/products/two">{t("products.two")}</NavigationMenu.Link>
 * 		</NavigationMenu.ContentColumn>
 * 	</NavigationMenu.ContentGrid>
 * </NavigationMenu.Content>
 */
NavigationMenu.ContentGrid = function NavigationMenuContentGrid(
	handle: Handle<NavigationMenu.ContentGridProps>,
) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					grid(),
					gap(4),
					raw({
						[`@container ${CONTAINER_NAME} (min-width: 40rem)`]: {
							gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
						},
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link NavigationMenu.ContentColumnProps.children} as one column of
 * stacked {@link NavigationMenu.Link}s inside a
 * {@link NavigationMenu.ContentGrid}.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the column's markup.
 * @example
 * <NavigationMenu.ContentColumn>
 * 	<NavigationMenu.Link href="/products/one">{t("products.one")}</NavigationMenu.Link>
 * </NavigationMenu.ContentColumn>
 */
NavigationMenu.ContentColumn = function NavigationMenuContentColumn(
	handle: Handle<NavigationMenu.ContentColumnProps>,
) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} mix={[grid(), gap(1), mix]} />;
	};
};
