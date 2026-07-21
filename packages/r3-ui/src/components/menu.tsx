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

import { attrs, css } from "remix/ui";

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
 * both valid overrides for a row that toggles or selects rather than acts
 * immediately.
 */
const DEFAULT_ITEM_ROLE = "menuitem";

/**
 * {@link Menu.ItemProps.type} applied to the `<button>` variant when a
 * consumer leaves it unset, keeping a click on the row from submitting a
 * surrounding `<form>` the way a bare `<button>`'s default type otherwise
 * would.
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
	 * Every native `<button>` attribute, plus the `mix` passthrough, plus the
	 * handful of anchor-only attributes (`target`, `rel`) that apply once
	 * `href` turns the row into a link. Setting `href` renders the row as a
	 * native `<a>` instead of a `<button>`; a row without `href` still needs
	 * its interactivity wired externally, since this module carries no
	 * behavior of its own — nest it inside a `<form>` for a submit action, or
	 * compose a `mix`-applied event mixin from a consuming island.
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
 * Renders the menu's own host: a {@link Popover} whose `placement` defaults
 * to reading down and start-ward from its invoker, sized to its content with
 * a small inset padding around whatever {@link Menu.Item} rows, {@link
 * Menu.Separator} dividers, or `Section`/`Header` groups it holds. `role`
 * defaults to `"menu"`.
 *
 * Opening and closing ride the Popover API exactly as {@link Popover}
 * documents — a plain invoker elsewhere on the page (a `<button
 * commandfor={id} command="toggle-popover">`) both shows the surface and, by
 * the same invoker relationship, becomes its implicit CSS anchor. Every row
 * inside is a real `<a>` or `<button>`, so the whole menu is reachable and
 * operable through the page's native Tab order with no script of this
 * module's own; pair the `menuKeys()` mixin from the behavior layer for the
 * full ARIA menu keyboard pattern — roving tabindex, arrow-key and Home/End
 * navigation, and typeahead — over this same markup.
 *
 * A row can open a nested menu with no dedicated submenu part: point its
 * `commandfor` at a second `<Menu>`'s `id` with `command="toggle-popover"`,
 * the same invoker relationship the top-level trigger uses.
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
				mix={[
					attrs({ role: DEFAULT_ROLE }),
					css({
						minInlineSize: "10rem",
						padding: "0.25rem",
						outline: "none",
					}),
					mix,
				]}
			>
				{children}
			</Popover>
		);
	};
}

/**
 * Renders a single row: a native `<a>` when `href` is set, pointed at that
 * destination for plain browser navigation, or a native `<button
 * type="button">` otherwise, ready for a consumer to wire up externally.
 * `role` defaults to `"menuitem"`, and both variants carry the same
 * `flex` layout, spacing, and color treatment, so swapping between a link and
 * an action row never shifts the row's look.
 *
 * Hover and pressed states ride the native `:hover`/`:active` pseudo-classes,
 * and focus reads through both `:focus` — tinting the row the moment
 * navigation lands on it by any means, keyboard or programmatic — and
 * `:focus-visible`, which layers on a keyboard focus ring. Set
 * `aria-selected="true"` directly to mark a row as the current or checked
 * entry — it renders with the primary solid fill and a heavier weight, so
 * the distinction never rides color alone. Setting `danger` recolors the row
 * for a destructive action.
 *
 * The native `disabled` attribute mutes the `<button>` variant; the `<a>`
 * variant has no native disabled state; set `aria-disabled="true"` to mute it
 * visually, keeping in mind that only omitting or neutralizing `href`
 * actually stops the navigation.
 *
 * In dev mode, a row whose content carries no plain text and no
 * `aria-label`/`aria-labelledby` logs a `console.warn`, since assistive
 * technology otherwise has no accessible name to announce for it.
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
			css({
				display: "flex",
				inlineSize: "100%",
				alignItems: "center",
				gap: "0.5rem",
				cursor: "default",
				textAlign: "start",
				textDecorationLine: "none",
				borderRadius: "var(--ui-radius-md, 0.375rem)",
				paddingInline: "0.75rem",
				paddingBlock: "0.5rem",
				fontSize: "0.875rem",
				lineHeight: "calc(1.25 / 0.875)",
				color: "var(--ui-neutral-fg-emphasis)",

				"&:hover": {
					backgroundColor: "var(--ui-neutral-bg-tint-hover)",
				},
				"&:active": {
					backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
				},
				"&:focus": {
					backgroundColor: "var(--ui-primary-bg-tint)",
				},
				"&:focus-visible": {
					outlineWidth: "2px",
					outlineStyle: "solid",
					outlineOffset: "2px",
					outlineColor: "var(--ui-primary-ring)",
				},
				'&[aria-selected="true"]': {
					backgroundColor: "var(--ui-primary-bg-solid)",
					color: "var(--ui-primary-fg-on-solid)",
					fontWeight: "500",
				},
				"&:disabled, &[aria-disabled='true']": {
					opacity: "0.5",
					cursor: "not-allowed",
				},

				"&[data-danger]": {
					color: "var(--ui-danger-fg)",
					"&:hover": { backgroundColor: "var(--ui-danger-bg-tint)" },
					"&:active": { backgroundColor: "var(--ui-danger-bg-tint-pressed)" },
					"&:focus": { backgroundColor: "var(--ui-danger-bg-tint)" },
					"&:focus-visible": { outlineColor: "var(--ui-danger-ring)" },
				},
			}),
			mix,
		];

		if (href) {
			// `rest` carries the shared `<button>`-flavored prop type this item
			// interface is built on; every field it holds (aria-*, data-*, id,
			// event props, …) is equally valid HTML on an `<a>`, so it's safe to
			// re-target it at the anchor variant's type. `role` is left out of
			// the retargeted shape only because the anchor prop type narrows its
			// allowed values conditionally on `href`, which a plain cast can't
			// re-derive; the `menuitem` default (or whatever explicit `role` a
			// consumer passed in `rest`) still spreads onto the element as-is.
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

		return <Separator {...rest} mix={[css({ marginBlock: "0.25rem" }), mix]} />;
	};
};
