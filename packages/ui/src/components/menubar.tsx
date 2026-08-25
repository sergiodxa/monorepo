/**
 * A horizontal row of top-level triggers modeled on a native application's
 * menu bar, where each trigger opens its own dropdown built from the
 * existing {@link Menu} component.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, border, fg, outline } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { cursor, userSelect } from "@pkg/u/general";
import { flex, gap, inlineFlex, items } from "@pkg/u/layout";
import { pb, pi } from "@pkg/u/size";
import { active, disabled, hover, when } from "@pkg/u/state";
import { text, weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

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
 * when omitted: toggles the paired {@link Menu} between shown and hidden,
 * the same default a standalone {@link Menu} trigger uses.
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
	 * `commandfor` narrowed to required so it always points at the `id` of
	 * the {@link Menu} this trigger opens.
	 */
	export interface TriggerProps extends Omit<TagProps<"button">, "commandfor"> {
		/** `id` of the {@link Menu} this trigger opens. */
		commandfor: string;
	}
}

/**
 * Renders the row's host: a native `<div>` carrying the `menubar` role for
 * {@link Menubar.Trigger}s. In dev mode, a root missing an `aria-label` or
 * `aria-labelledby` logs a `console.warn`.
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
					flex(),
					items("center"),
					gap("0.125rem"),
					rounded("md"),
					border({ color: "neutral", width: 1 }),
					bg("neutral.tint"),
					pb(1),
					pi(1),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders a single top-level trigger: a native `<button>` pointed at the
 * `id` of the {@link Menu} it opens through `commandfor`, with `command`
 * defaulting to `"toggle-popover"` and `role` to `"menuitem"`.
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
					inlineFlex(),
					items("center"),
					gap(2),
					rounded("sm"),
					pi(3),
					pb("0.375rem"),
					fg("neutral"),
					hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
					active(bg("neutral.bg-tint-pressed")),
					when('&[aria-expanded="true"]', [bg("brand.solid"), fg("brand.onSolid")]),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					disabled([opacity(50), cursor("not-allowed")]),
					cursor("default"),
					weight(500),
					userSelect(),
					text("sm"),
					mix,
				]}
			>
				{children}
			</button>
		);
	};
};
