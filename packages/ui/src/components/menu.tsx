/**
 * A menu surface anchored to whatever invoker opens it, riding the same
 * native Popover API {@link Popover} does, sized to its own content and
 * padded around a compact stack of {@link Menu.Item} rows, {@link
 * Menu.Separator} dividers, or a `Section`/`Header` pair grouping related
 * rows together. Every row lands in the page's native Tab order out of the
 * box, since each renders as a real `<a>` or `<button>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, Handle, MixinDescriptor, Props as TagProps, RemixNode } from "remix/ui";

import { bg, fg, outline } from "@sdxc/u/color";
import { rounded, opacity } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { flex, gap, items } from "@sdxc/u/layout";
import { is, minIs, mb, pb, pi, p } from "@sdxc/u/size";
import { active, disabled, focusVisible, hover, when } from "@sdxc/u/state";
import { text, textAlign, textDecoration, weight } from "@sdxc/u/typography";
import { attrs } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition";
import { warnIfNoAccessibleName } from "../utils/warn-if-no-accessible-name";

import { Popover } from "./popover";
import { Separator } from "./separator";

/**
 * Side of the invoker {@link Menu} renders against when `placement` is left
 * unset, reading down and start-ward the way a dropdown conventionally does.
 */
const DEFAULT_PLACEMENT: Popover.Placement = "bottom-start";

/**
 * `role` applied to {@link Menu}'s host through {@link attrs} unless a
 * consumer supplies its own, identifying the surface as an ARIA menu.
 */
const DEFAULT_ROLE = "menu";

/**
 * `role` applied to {@link Menu.Item} through {@link attrs} unless a
 * consumer supplies its own — `"menuitemcheckbox"` and `"menuitemradio"` are
 * valid overrides for a row that toggles or selects on activation.
 */
const DEFAULT_ITEM_ROLE = "menuitem";

/**
 * {@link Menu.ItemProps.type} applied to the `<button>` variant when a
 * consumer leaves it unset, keeping a click on the row from submitting a
 * surrounding `<form>` the way a bare `<button>` otherwise would.
 */
const DEFAULT_ITEM_TYPE: NonNullable<Menu.ItemProps["type"]> = "button";

/**
 * Prop types for {@link Menu} and its compound parts.
 */
export namespace Menu {
	/**
	 * Every prop {@link Popover.Props} accepts, since {@link Menu} renders one
	 * directly as its host.
	 */
	export interface Props extends Popover.Props {
		/**
		 * The menu's rows: {@link Menu.Item}, {@link Menu.Separator}, or a
		 * `Section`/`Header` pair grouping related items together.
		 */
		children: RemixNode;
	}

	/**
	 * Every native `<button>` attribute, plus `target`/`rel` for the anchor
	 * variant `href` enables. Nest a row in a `<form>` for a submit action, or
	 * compose a `mix`-applied event mixin for click handling.
	 */
	export interface ItemProps extends TagProps<"button"> {
		/** Destination the row navigates to. Renders the row as a native `<a>` instead of a `<button>` when set. */
		href?: string;
		/** `target` for the link variant, applied only once `href` is set. */
		target?: TagProps<"a">["target"];
		/** `rel` for the link variant, applied only once `href` is set. */
		rel?: TagProps<"a">["rel"];
		/**
		 * Styles the row in the semantic danger tone, for a destructive action
		 * like deleting a resource.
		 */
		danger?: boolean;
		/**
		 * Extra mixin(s) applied to the row's host element, whichever of
		 * `<a>`/`<button>` it renders as depending on {@link href}.
		 */
		mix?: MixinDescriptor<HTMLAnchorElement | HTMLButtonElement, any, ElementProps>[];
	}

	/**
	 * Every prop {@link Separator.Props} accepts, since {@link Menu.Separator}
	 * renders one directly as its host.
	 */
	export interface SeparatorProps extends Separator.Props {}
}

/**
 * Renders the menu's own host: a {@link Popover} defaulting to
 * `"bottom-start"` placement and `"menu"` role, sized to its content. Point a
 * row's `commandfor` at another `<Menu>`'s `id` to open it as a nested menu.
 *
 * @param handle Runtime handle carrying the host's {@link Popover} props.
 * @returns The render function producing the menu's markup.
 * @example
 * <Button commandfor="account-menu" command="toggle-popover">{t("nav.account")}</Button>
 * <Menu id="account-menu" aria-label={t("nav.accountMenu")}>
 * 	<Menu.Item href="/settings/profile">{t("nav.profile")}</Menu.Item>
 * 	<Menu.Item href="/settings/billing">{t("nav.billing")}</Menu.Item>
 * 	<Menu.Separator />
 * 	<Menu.Item danger>{t("actions.signOut")}</Menu.Item>
 * </Menu>
 * @example
 * <Menu id="row-menu" placement="left-start" aria-label={t("table.rowActions")}>
 * 	<Section aria-labelledby="row-menu-view-heading">
 * 		<Header id="row-menu-view-heading">{t("menu.view")}</Header>
 * 		<Menu.Item href={viewUrl}>{t("actions.view")}</Menu.Item>
 * 		<Menu.Item href={editUrl}>{t("actions.edit")}</Menu.Item>
 * 	</Section>
 * 	<Menu.Separator />
 * 	<Menu.Item danger commandfor="confirm-delete" command="show-modal">{t("actions.delete")}</Menu.Item>
 * </Menu>
 */
export function Menu(handle: Handle<Menu.Props>) {
	return () => {
		let { placement, children, mix, ...rest } = handle.props;
		let resolvedPlacement = placement ?? DEFAULT_PLACEMENT;

		return (
			<Popover
				{...rest}
				placement={resolvedPlacement}
				mix={[attrs({ role: DEFAULT_ROLE }), minIs("10rem"), p(1), outline("none"), mix]}
			>
				{children}
			</Popover>
		);
	};
}

/**
 * Renders a native `<a>` when `href` is set, else a `<button>`, defaulting
 * `role` to `"menuitem"`; only omitting or neutralizing `href` stops the
 * `<a>` variant's navigation, since `aria-disabled` mutes it visually only.
 *
 * @param handle Runtime handle carrying the host `<a>`/`<button>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Menu.Item href="/settings/profile">{t("nav.profile")}</Menu.Item>
 * @example
 * <Menu.Item danger disabled>{t("actions.delete")}</Menu.Item>
 * @example
 * <Menu.Item aria-selected={sort === "name" ? "true" : undefined}>{t("sort.name")}</Menu.Item>
 */
Menu.Item = function MenuItem(handle: Handle<Menu.ItemProps>) {
	return () => {
		let { href, target, rel, type, danger, children, mix, ...rest } = handle.props;

		warnIfNoAccessibleName(
			handle.props,
			children,
			"Menu.Item: a row with no visible text needs an `aria-label` describing it — assistive technology has no accessible name to announce otherwise.",
		);

		let itemMix = [
			interactiveTransition(),
			attrs({ role: DEFAULT_ITEM_ROLE }),
			flex(),
			is("full"),
			items("center"),
			gap(2),
			rounded("md"),
			pi(3),
			pb(2),
			fg("neutral.emphasis"),
			hover(bg("neutral.bg-tint-hover")),
			active(bg("neutral.bg-tint-pressed")),
			when("&:focus", bg("brand.tint")),
			when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
			when('&[aria-selected="true"]', [bg("brand.solid"), fg("brand.onSolid"), weight(500)]),
			disabled([opacity(50), cursor("not-allowed")]),
			when("&[data-danger]", [
				fg("danger"),
				hover(bg("danger.tint")),
				active(bg("danger.bg-tint-pressed")),
				when("&:focus", bg("danger.tint")),
				focusVisible(outline("danger.ring")),
			]),
			cursor("default"),
			textDecoration("none"),
			text("sm"),
			textAlign("start"),
			mix,
		];

		if (href) {
			/**
			 * `rest`'s fields (aria-*, data-*, id, event props, …) are all valid
			 * on an `<a>` too, so retargeting its type here is safe; `role` is
			 * left out since the anchor type narrows it conditionally on `href`.
			 */
			let anchorRest = rest as unknown as Omit<TagProps<"a">, "href" | "target" | "rel" | "role">;

			return (
				<a
					href={href}
					target={target}
					rel={rel}
					{...anchorRest}
					data-danger={danger || undefined}
					mix={itemMix}
				>
					{children}
				</a>
			);
		}

		return (
			<button
				type={type ?? DEFAULT_ITEM_TYPE}
				{...rest}
				data-danger={danger || undefined}
				mix={itemMix}
			>
				{children}
			</button>
		);
	};
};

/**
 * Renders a hairline divider between two runs of {@link Menu.Item}s: the
 * shared {@link Separator} component with the small block-axis margin a
 * menu's compact rows need on either side of it.
 *
 * @param handle Runtime handle carrying the host's {@link Separator} props.
 * @returns The render function producing the divider's markup.
 * @example
 * <Menu.Item href="/settings/profile">{t("nav.profile")}</Menu.Item>
 * <Menu.Separator />
 * <Menu.Item danger>{t("actions.signOut")}</Menu.Item>
 */
Menu.Separator = function MenuSeparator(handle: Handle<Menu.SeparatorProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <Separator {...rest} mix={[mb(1), mix]} />;
	};
};
