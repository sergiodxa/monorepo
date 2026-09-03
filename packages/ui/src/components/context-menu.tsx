/**
 * A menu surface that opens at a right-click's pointer position, composing
 * {@link Menu}'s popover styling and `role="menu"` wiring directly so its
 * rows read and behave exactly like a standard menu's. Adds the
 * {@link ContextMenu.Trigger} wrapper a pointer gesture opens the surface
 * against, plus the grouped-row parts — {@link ContextMenu.Group},
 * {@link ContextMenu.Label}, and {@link ContextMenu.Shortcut} — a context
 * menu's denser row layout tends to need.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { borderEdge, fg, outline } from "@sdxc/u/color";
import { mis, pb, pi, pie } from "@sdxc/u/size";
import { not } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import { Menu } from "./menu.js";
import { Section } from "./section.js";

/**
 * Side {@link ContextMenu.SubContent} renders against relative to its
 * {@link ContextMenu.SubTrigger} row when a consumer leaves `placement`
 * unset — the direction a nested row conventionally flies outward toward.
 */
const DEFAULT_SUB_PLACEMENT: NonNullable<Menu.Props["placement"]> = "right-start";

/**
 * Prop types for {@link ContextMenu} and its compound parts.
 */
export namespace ContextMenu {
	/**
	 * Every prop {@link Menu.Props} accepts, unchanged, since {@link
	 * ContextMenu} renders one directly as its host.
	 */
	export interface Props extends Menu.Props {}

	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough. The area a
	 * consumer wraps around content that should open {@link ContextMenu} at the
	 * pointer's position — a table row, a card, a canvas region.
	 */
	export interface TriggerProps extends TagProps<"div"> {
		/** The content the pointer gesture opens {@link ContextMenu} against. */
		children: RemixNode;
	}

	/**
	 * Every prop {@link Menu.ItemProps} accepts, unchanged, since {@link
	 * ContextMenu.Item} renders one directly.
	 */
	export interface ItemProps extends Menu.ItemProps {}

	/**
	 * Every prop {@link Section.Props} accepts, since {@link
	 * ContextMenu.Group} renders one directly as its host.
	 */
	export interface GroupProps extends Section.Props {
		/** The group's rows, typically a {@link ContextMenu.Label} followed by a run of {@link ContextMenu.Item}s. */
		children: RemixNode;
	}

	/**
	 * Every native `<header>` attribute, plus the `mix` passthrough.
	 */
	export interface LabelProps extends TagProps<"header"> {
		/** The group's visible label text. */
		children: RemixNode;
	}

	/**
	 * Every prop {@link Menu.SeparatorProps} accepts, unchanged, since {@link
	 * ContextMenu.Separator} renders one directly.
	 */
	export interface SeparatorProps extends Menu.SeparatorProps {}

	/**
	 * Every prop {@link ContextMenu.Props} accepts, unchanged, since {@link
	 * ContextMenu.SubContent} renders {@link ContextMenu} directly with a
	 * different default `placement`.
	 */
	export interface SubContentProps extends Props {}

	/**
	 * Every native `<span>` attribute, plus the `mix` passthrough.
	 */
	export interface ShortcutProps extends TagProps<"span"> {
		/** The shortcut hint text, typically a key combination like "⌘⇧D". */
		children: RemixNode;
	}
}

/**
 * Renders {@link Menu} unchanged; positioning against the pointer is handled
 * entirely by the `contextMenu()` mixin a consuming island applies to
 * {@link ContextMenu.Trigger}, while every nested row stays a real, tab-reachable `<a>` or `<button>`.
 *
 * @param handle Runtime handle carrying the host's {@link Menu} props.
 * @returns The render function producing the surface's markup.
 * @example
 * <ContextMenu.Trigger mix={[contextMenu("row-menu")]}>
 * 	<TableRow />
 * </ContextMenu.Trigger>
 * <ContextMenu id="row-menu" aria-label={t("table.rowActions")}>
 * 	<ContextMenu.Item href={viewUrl}>{t("actions.view")}</ContextMenu.Item>
 * 	<ContextMenu.Item href={editUrl}>{t("actions.edit")}</ContextMenu.Item>
 * 	<ContextMenu.Separator />
 * 	<ContextMenu.Item danger commandfor="confirm-delete" command="show-modal">{t("actions.delete")}</ContextMenu.Item>
 * </ContextMenu>
 */
export function ContextMenu(handle: Handle<ContextMenu.Props>) {
	return () => <Menu {...handle.props} />;
}

/**
 * Renders {@link ContextMenu.TriggerProps.children} inside a plain `<div>`,
 * the area a pointer gesture opens the paired {@link ContextMenu} against.
 * Pair it with the `contextMenu()` mixin via `mix`; outline is suppressed since that mixin's own focus handling takes over once the surface opens.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the trigger area's markup.
 * @example
 * <ContextMenu.Trigger mix={[contextMenu("row-menu")]}>
 * 	<TableRow />
 * </ContextMenu.Trigger>
 */
ContextMenu.Trigger = function ContextMenuTrigger(handle: Handle<ContextMenu.TriggerProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div {...rest} mix={[outline("none"), mix]}>
				{children}
			</div>
		);
	};
};

/**
 * Renders a single row: {@link Menu.Item} unchanged, since a context menu's
 * row shares every look and state — hover, pressed, focus-visible,
 * `aria-selected`, `danger` — with a standard menu's row.
 *
 * @example
 * <ContextMenu.Item href="/settings/profile">{t("nav.profile")}</ContextMenu.Item>
 * @example
 * <ContextMenu.Item danger>{t("actions.delete")}</ContextMenu.Item>
 */
ContextMenu.Item = Menu.Item;

/**
 * Renders {@link ContextMenu.GroupProps.children} as one labeled run of rows:
 * {@link Section} restyled with a divider above every group but the first.
 * Pair a {@link ContextMenu.Label} first child with `aria-labelledby` pointing at its `id` for assistive technology.
 *
 * @param handle Runtime handle carrying the host `<section>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <ContextMenu.Group aria-labelledby="row-menu-view-heading">
 * 	<ContextMenu.Label id="row-menu-view-heading">{t("menu.view")}</ContextMenu.Label>
 * 	<ContextMenu.Item href={viewUrl}>{t("actions.view")}</ContextMenu.Item>
 * 	<ContextMenu.Item href={editUrl}>{t("actions.edit")}</ContextMenu.Item>
 * </ContextMenu.Group>
 */
ContextMenu.Group = function ContextMenuGroup(handle: Handle<ContextMenu.GroupProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<Section
				{...rest}
				mix={[not(":first-child", borderEdge("block-start", { color: "neutral", width: 1 })), mix]}
			/>
		);
	};
};

/**
 * Renders {@link ContextMenu.LabelProps.children} as a
 * {@link ContextMenu.Group}'s small, muted heading, sized and spaced to sit
 * directly above the group's first row for a dense row of actions.
 *
 * @param handle Runtime handle carrying the host `<header>`'s props.
 * @returns The render function producing the label's markup.
 * @example
 * <ContextMenu.Label id="row-menu-view-heading">{t("menu.view")}</ContextMenu.Label>
 */
ContextMenu.Label = function ContextMenuLabel(handle: Handle<ContextMenu.LabelProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<header
				{...rest}
				mix={[pi(2), pb(1), weight("semibold"), fg("neutral.muted"), text("xs"), mix]}
			>
				{children}
			</header>
		);
	};
};

/**
 * Renders a hairline divider between two runs of {@link ContextMenu.Item}s:
 * {@link Menu.Separator} unchanged.
 *
 * @example
 * <ContextMenu.Item href="/settings/profile">{t("nav.profile")}</ContextMenu.Item>
 * <ContextMenu.Separator />
 * <ContextMenu.Item danger>{t("actions.signOut")}</ContextMenu.Item>
 */
ContextMenu.Separator = Menu.Separator;

/**
 * Renders a row that opens a nested {@link ContextMenu.SubContent} surface:
 * {@link Menu.Item} restyled with inline-end padding for a trailing chevron
 * icon; point `commandfor` at the nested surface's `id` with `command="toggle-popover"`.
 *
 * @param handle Runtime handle carrying the host row's props.
 * @returns The render function producing the row's markup.
 * @example
 * <ContextMenu.SubTrigger commandfor="row-menu-share" command="toggle-popover">
 * 	{t("actions.share")}
 * 	<ChevronRightIcon data-slot="icon" aria-hidden />
 * </ContextMenu.SubTrigger>
 * <ContextMenu.SubContent id="row-menu-share" aria-label={t("actions.share")}>
 * 	<ContextMenu.Item>{t("share.email")}</ContextMenu.Item>
 * 	<ContextMenu.Item>{t("share.link")}</ContextMenu.Item>
 * </ContextMenu.SubContent>
 */
ContextMenu.SubTrigger = function ContextMenuSubTrigger(handle: Handle<ContextMenu.ItemProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <Menu.Item {...rest} mix={[pie(8), mix]} />;
	};
};

/**
 * Renders a nested surface opened by a {@link ContextMenu.SubTrigger} row:
 * {@link ContextMenu} itself, defaulting `placement` to
 * {@link DEFAULT_SUB_PLACEMENT} since a nested row conventionally opens beside itself.
 *
 * @param handle Runtime handle carrying the host's {@link Menu} props.
 * @returns The render function producing the nested surface's markup.
 * @example
 * <ContextMenu.SubContent id="row-menu-share" aria-label={t("actions.share")}>
 * 	<ContextMenu.Item>{t("share.email")}</ContextMenu.Item>
 * 	<ContextMenu.Item>{t("share.link")}</ContextMenu.Item>
 * </ContextMenu.SubContent>
 */
ContextMenu.SubContent = function ContextMenuSubContent(
	handle: Handle<ContextMenu.SubContentProps>,
) {
	return () => {
		let { placement, ...rest } = handle.props;

		return <ContextMenu {...rest} placement={placement ?? DEFAULT_SUB_PLACEMENT} />;
	};
};

/**
 * Renders a row that toggles a checked state: {@link ContextMenu.Item}
 * unchanged — set `aria-selected="true"` directly to mark it checked, the
 * same contract {@link Menu.Item} documents.
 *
 * @example
 * <ContextMenu.CheckboxItem aria-selected={showHidden ? "true" : undefined}>{t("view.showHidden")}</ContextMenu.CheckboxItem>
 */
ContextMenu.CheckboxItem = ContextMenu.Item;

/**
 * Renders a row belonging to a mutually exclusive set: {@link
 * ContextMenu.Item} unchanged — set `aria-selected="true"` directly on
 * whichever row is the current pick.
 *
 * @example
 * <ContextMenu.RadioItem aria-selected={sort === "name" ? "true" : undefined}>{t("sort.name")}</ContextMenu.RadioItem>
 */
ContextMenu.RadioItem = ContextMenu.Item;

/**
 * Renders a mutually exclusive set of {@link ContextMenu.RadioItem} rows:
 * {@link ContextMenu.Group} unchanged.
 *
 * @example
 * <ContextMenu.RadioGroup aria-labelledby="row-menu-sort-heading">
 * 	<ContextMenu.Label id="row-menu-sort-heading">{t("menu.sortBy")}</ContextMenu.Label>
 * 	<ContextMenu.RadioItem aria-selected="true">{t("sort.name")}</ContextMenu.RadioItem>
 * 	<ContextMenu.RadioItem>{t("sort.date")}</ContextMenu.RadioItem>
 * </ContextMenu.RadioGroup>
 */
ContextMenu.RadioGroup = ContextMenu.Group;

/**
 * Renders {@link ContextMenu.ShortcutProps.children} as a row's trailing
 * keyboard-shortcut hint: pushed to the row's inline end and muted, reading
 * as supplementary detail alongside the row's primary label.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the shortcut hint's markup.
 * @example
 * <ContextMenu.Item>
 * 	{t("actions.duplicate")}
 * 	<ContextMenu.Shortcut>⌘D</ContextMenu.Shortcut>
 * </ContextMenu.Item>
 */
ContextMenu.Shortcut = function ContextMenuShortcut(handle: Handle<ContextMenu.ShortcutProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<span {...rest} mix={[mis("auto"), fg("neutral.muted"), text("xs"), mix]}>
				{children}
			</span>
		);
	};
};
