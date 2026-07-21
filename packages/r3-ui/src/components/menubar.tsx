/**
 * A horizontal row of top-level triggers modeled on a native application's
 * own menu bar — File, Edit, View — where every trigger opens its own
 * dropdown built from the existing {@link Menu} component, unchanged. The
 * host carries the `menubar` role over a `<div>`, and each
 * {@link Menubar.Trigger} inside renders as a real `<button>`, already
 * reachable in the page's Tab order on its own account: pressing Tab moves
 * from one top-level trigger straight to the next, and opening the trigger's
 * paired {@link Menu} rides the identical Popover API invoker relationship a
 * standalone {@link Menu} trigger elsewhere on a page already uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { attrs, css } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition";
import {
	warnIfNoAccessibleLabel,
	warnIfNoAccessibleName,
} from "../utils/warn-if-no-accessible-name";

/**
 * `role="menubar"` applied to {@link Menubar}'s host through {@link attrs}
 * unless a consumer supplies its own `role`, identifying the row as an ARIA
 * menubar.
 */
const DEFAULT_ROLE = "menubar";

/**
 * `role` applied to {@link Menubar.Trigger} through {@link attrs} unless a
 * consumer supplies its own, identifying each top-level trigger as an ARIA
 * menu-bar item that owns a submenu.
 */
const DEFAULT_TRIGGER_ROLE = "menuitem";

/**
 * `type` {@link Menubar.TriggerProps} falls back to when a consumer doesn't
 * supply one, keeping a click on the trigger from submitting a surrounding
 * `<form>` the way a bare `<button>`'s default type otherwise would.
 */
const DEFAULT_TRIGGER_TYPE: NonNullable<Menubar.TriggerProps["type"]> = "button";

/**
 * Invoker Commands verb {@link Menubar.TriggerProps.command} falls back to
 * when omitted, showing the paired {@link Menu} if it's hidden and hiding it
 * again if it's already showing — the identical default a standalone
 * {@link Menu} trigger uses.
 */
const DEFAULT_TRIGGER_COMMAND: NonNullable<Menubar.TriggerProps["command"]> = "toggle-popover";

/**
 * Prop types for {@link Menubar} and its compound parts.
 */
export namespace Menubar {
	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough.
	 */
	export interface Props extends TagProps<"div"> {}

	/**
	 * Every native `<button>` attribute, plus the `mix` passthrough, with
	 * `commandfor` narrowed to required — a trigger with no dropdown to open
	 * isn't a menu-bar trigger — pointed at the `id` of the {@link Menu} this
	 * trigger opens.
	 */
	export interface TriggerProps extends Omit<TagProps<"button">, "commandfor"> {
		/** `id` of the {@link Menu} this trigger opens. */
		commandfor: string;
	}
}

/**
 * Renders the row's host: a native `<div>` carrying the `menubar` role, laying
 * {@link Menubar.Trigger}s out in a single horizontal row over a thin border
 * and a subtly tinted background, echoing a native application's own
 * top-level menu bar. Each trigger inside is a real `<button>`, already
 * reachable in the page's Tab order on its own — moving focus across the row
 * needs no roving-tabindex logic from this module.
 *
 * In dev mode, a root rendered without an `aria-label` or `aria-labelledby`
 * logs a `console.warn`, since assistive technology otherwise has no
 * accessible name to announce for this menu bar.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Menubar aria-label={t("app.menubar")}>
 * 	<Menubar.Trigger commandfor="file-menu">{t("menubar.file")}</Menubar.Trigger>
 * 	<Menu id="file-menu" aria-label={t("menubar.fileMenu")}>
 * 		<Menu.Item>{t("actions.new")}</Menu.Item>
 * 		<Menu.Item>{t("actions.open")}</Menu.Item>
 * 	</Menu>
 *
 * 	<Menubar.Trigger commandfor="edit-menu">{t("menubar.edit")}</Menubar.Trigger>
 * 	<Menu id="edit-menu" aria-label={t("menubar.editMenu")}>
 * 		<Menu.Item>{t("actions.undo")}</Menu.Item>
 * 		<Menu.Item>{t("actions.redo")}</Menu.Item>
 * 	</Menu>
 * </Menubar>
 */
export function Menubar(handle: Handle<Menubar.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		warnIfNoAccessibleLabel(
			handle.props,
			'Menubar: needs an "aria-label" or "aria-labelledby" identifying this menu bar for assistive technology.',
		);

		return (
			<div
				{...rest}
				mix={[
					attrs({ role: DEFAULT_ROLE }),
					css({
						display: "flex",
						alignItems: "center",
						gap: "0.125rem",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						borderWidth: "1px",
						borderStyle: "solid",
						borderColor: "var(--ui-neutral-border)",
						backgroundColor: "var(--ui-neutral-bg-tint)",
						paddingBlock: "0.25rem",
						paddingInline: "0.25rem",
					}),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders a single top-level trigger: a native `<button>` pointed at the
 * `id` of the {@link Menu} it opens through `commandfor`, with `command`
 * defaulting to `"toggle-popover"` — the identical invoker relationship a
 * standalone {@link Menu} trigger elsewhere on a page already uses, so the
 * same {@link Menu} component composes here entirely unchanged. `role`
 * defaults to `"menuitem"` and `aria-haspopup="menu"` is applied
 * automatically, identifying the trigger as a menu-bar item that owns a
 * submenu. A supporting browser computes `aria-expanded` on the trigger on
 * its own from this same invoker relationship, mirroring the paired
 * {@link Menu}'s shown state with no script of this module's own.
 *
 * Hover and pressed states ride the native `:hover`/`:active` pseudo-classes,
 * a keyboard focus-visible ring reads in the primary color, and the trigger
 * takes on a solid fill for as long as its paired {@link Menu} stays open,
 * reading straight off the same browser-computed `aria-expanded`.
 *
 * In dev mode, a trigger whose content carries no plain text and no
 * `aria-label`/`aria-labelledby` logs a `console.warn`, since assistive
 * technology otherwise has no accessible name to announce for it.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the trigger's markup.
 * @example
 * <Menubar.Trigger commandfor="file-menu">{t("menubar.file")}</Menubar.Trigger>
 * @example
 * <Menubar.Trigger commandfor="archived-menu" aria-disabled="true">
 * 	{t("menubar.archived")}
 * </Menubar.Trigger>
 */
Menubar.Trigger = function MenubarTrigger(handle: Handle<Menubar.TriggerProps>) {
	return () => {
		let { type, command, children, mix, ...rest } = handle.props;
		let resolvedType = type ?? DEFAULT_TRIGGER_TYPE;
		let resolvedCommand = command ?? DEFAULT_TRIGGER_COMMAND;

		warnIfNoAccessibleName(
			handle.props,
			children,
			"Menubar.Trigger: a trigger with no visible text needs an `aria-label` describing it — assistive technology has no accessible name to announce otherwise.",
		);

		return (
			<button
				type={resolvedType}
				command={resolvedCommand}
				{...rest}
				mix={[
					interactiveTransition(),
					attrs({ role: DEFAULT_TRIGGER_ROLE, "aria-haspopup": "menu" }),
					css({
						display: "inline-flex",
						alignItems: "center",
						gap: "0.5rem",
						borderRadius: "var(--ui-radius-sm, 0.25rem)",
						cursor: "default",
						userSelect: "none",
						paddingInline: "0.75rem",
						paddingBlock: "0.375rem",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						fontWeight: "500",
						color: "var(--ui-neutral-fg)",

						"&:hover": {
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
							color: "var(--ui-neutral-fg-emphasis)",
						},
						"&:active": {
							backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
						},
						'&[aria-expanded="true"]': {
							backgroundColor: "var(--ui-primary-bg-solid)",
							color: "var(--ui-primary-fg-on-solid)",
						},
						"&:focus-visible": {
							outlineWidth: "2px",
							outlineStyle: "solid",
							outlineOffset: "2px",
							outlineColor: "var(--ui-primary-ring)",
						},
						"&:disabled, &[aria-disabled='true']": {
							cursor: "not-allowed",
							opacity: "0.5",
						},
					}),
					mix,
				]}
			>
				{children}
			</button>
		);
	};
};
