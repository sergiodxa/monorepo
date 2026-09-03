/**
 * Why JS: the WAI-ARIA menubar pattern requires roving tabindex across the
 * row's triggers, `ArrowLeft`/`ArrowRight` and Home/End navigation between
 * them, typeahead, and handing focus straight into whichever Menu a trigger
 * opens, none of which HTML or CSS express on their own.
 * No-JS baseline: every trigger still renders as its own `<button>`,
 * individually reachable in the page's Tab order, and still opens its paired
 * Menu through the same Popover API invoker relationship a standalone
 * trigger elsewhere on a page already uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/ui";

import { createMixin, ref } from "remix/ui";

import { DISABLED_SELECTOR } from "../utils/disabled-selector.js";
import {
	focusItem as focusTrigger,
	isPrintableKey,
	labelFor,
	queryItems as queryMenuItems,
	setRovingTabindex,
} from "../utils/keyboard-nav.js";

/**
 * Selector matching a top-level trigger's role, evaluated against the row's
 * direct children only.
 */
const DEFAULT_TRIGGER_SELECTOR = '[role="menuitem"]';

/**
 * Selector matching a menu row's role inside whichever Menu a trigger opens,
 * regardless of its checked state.
 */
const DEFAULT_ITEM_SELECTOR = '[role^="menuitem"]';

/** Idle time after the last keystroke before the typeahead buffer resets. */
const TYPEAHEAD_RESET_MS = 500;

/**
 * A trigger paired with the Menu it currently has open.
 */
interface OpenMenu {
	/** The trigger whose Menu is showing. */
	trigger: HTMLButtonElement;
	/** That trigger's paired Menu, already confirmed to be showing. */
	menu: HTMLElement;
}

/**
 * Types associated with {@link menubarKeys}.
 */
export namespace MenubarKeys {
	/**
	 * Configuration accepted by {@link menubarKeys}.
	 */
	export interface Options {
		/**
		 * Selector, evaluated against the row's direct children, that identifies
		 * its top-level triggers. Defaults to `[role="menuitem"]`; scoped to
		 * direct children so nested Menu rows are never mistaken for triggers.
		 */
		triggerSelector?: string;
		/**
		 * Selector, evaluated against whichever Menu a trigger opens, that
		 * identifies its rows. Defaults to `[role^="menuitem"]`; pass the same
		 * value here as the paired `menuKeys()` call's `itemSelector`.
		 */
		itemSelector?: string;
	}
}

/**
 * Collects the row's enabled top-level triggers, in document order, matching
 * `selector` among `host`'s direct children. Queried fresh on every
 * interaction so navigation stays correct as triggers change.
 */
function queryTriggers(host: HTMLElement, selector: string): HTMLButtonElement[] {
	let candidates = host.querySelectorAll<HTMLButtonElement>(`:scope > ${selector}`);
	return Array.from(candidates).filter((trigger) => !trigger.matches(DISABLED_SELECTOR));
}

/**
 * Resolves a trigger's paired Menu — the popover surface its `commandfor`
 * points at — preferring the live `commandForElement` reference and falling
 * back to an `id` lookup for runtimes that still treat `commandfor` as attribute-only.
 */
function menuFor(trigger: HTMLButtonElement): HTMLElement | undefined {
	if (trigger.commandForElement instanceof HTMLElement) return trigger.commandForElement;

	let commandForId = trigger.getAttribute("commandfor");
	if (!commandForId) return undefined;

	return trigger.ownerDocument.getElementById(commandForId) ?? undefined;
}

/**
 * Finds whichever one of `triggers`' paired Menus is currently showing — at
 * most one at a time, since the Popover API's `"auto"` mode already
 * dismisses any other `"auto"` surface when one opens.
 */
function findOpenMenu(triggers: readonly HTMLButtonElement[]): OpenMenu | undefined {
	for (let trigger of triggers) {
		let menu = menuFor(trigger);
		if (menu?.matches(":popover-open")) return { trigger, menu };
	}
	return undefined;
}

/**
 * Closes `menu` if it's currently showing.
 */
function closeMenu(menu: HTMLElement): void {
	if (menu.matches(":popover-open")) menu.hidePopover();
}

/**
 * Opens `trigger`'s paired Menu and moves focus onto its first or last
 * enabled row, handing off to that Menu's own `menuKeys()` roving tabindex;
 * also updates `trigger`'s own tabindex for when it later recloses.
 */
function openMenuAndFocus(
	triggers: readonly HTMLButtonElement[],
	trigger: HTMLButtonElement,
	edge: "first" | "last",
	itemSelector: string,
): void {
	setRovingTabindex(triggers, trigger);

	let menu = menuFor(trigger);
	if (!menu) return;
	if (!menu.matches(":popover-open")) menu.showPopover();

	let items = queryMenuItems(menu, itemSelector);
	if (items.length === 0) return;

	let target = edge === "first" ? items[0]! : items[items.length - 1]!;
	target.focus();
}

/**
 * Moves the row's open state onto `target`: closes whichever other
 * trigger's Menu `openEntry` names, then opens and focuses `target`'s Menu
 * via {@link openMenuAndFocus}, keeping one Menu open as focus moves.
 */
function switchTo(
	triggers: readonly HTMLButtonElement[],
	target: HTMLButtonElement,
	edge: "first" | "last",
	openEntry: OpenMenu | undefined,
	itemSelector: string,
): void {
	if (openEntry && openEntry.trigger !== target) closeMenu(openEntry.menu);
	openMenuAndFocus(triggers, target, edge, itemSelector);
}

/**
 * Adapts the WAI-ARIA menubar keyboard pattern onto a Menubar's row of
 * triggers, handing off to each opened Menu's own `menuKeys()` mixin once
 * focus moves inside it, so each mixin owns keys only within its own scope.
 *
 * @param options Selector overrides for non-standard markup.
 * @returns A mixin descriptor for the row's `mix` prop.
 * @example
 * <Menubar aria-label={t("app.menubar")} mix={menubarKeys()}>
 * 	<Menubar.Trigger commandfor="file-menu">{t("menubar.file")}</Menubar.Trigger>
 * 	<Menu id="file-menu" aria-label={t("menubar.fileMenu")} mix={menuKeys()}>
 * 		<Menu.Item>{t("actions.new")}</Menu.Item>
 * 		<Menu.Item>{t("actions.open")}</Menu.Item>
 * 	</Menu>
 *
 * 	<Menubar.Trigger commandfor="edit-menu">{t("menubar.edit")}</Menubar.Trigger>
 * 	<Menu id="edit-menu" aria-label={t("menubar.editMenu")} mix={menuKeys()}>
 * 		<Menu.Item>{t("actions.undo")}</Menu.Item>
 * 		<Menu.Item>{t("actions.redo")}</Menu.Item>
 * 	</Menu>
 * </Menubar>
 */
export const menubarKeys: MixinFactory<HTMLElement, [options?: MenubarKeys.Options], ElementProps> =
	createMixin<HTMLElement, [options?: MenubarKeys.Options], ElementProps>((_handle) => {
		let buffer = "";
		let resetBufferId: ReturnType<typeof setTimeout> | undefined;

		return (options = {}, props = options as ElementProps) => {
			if (props === options) options = {};

			let triggerSelector = options.triggerSelector ?? DEFAULT_TRIGGER_SELECTOR;
			let itemSelector = options.itemSelector ?? DEFAULT_ITEM_SELECTOR;

			return ref((host: HTMLElement, signal) => {
				let initialTriggers = queryTriggers(host, triggerSelector);
				if (initialTriggers.length > 0) setRovingTabindex(initialTriggers, initialTriggers[0]!);

				host.addEventListener(
					"focusin",
					(event) => {
						let target = event.target;
						if (!(target instanceof HTMLButtonElement)) return;

						let triggers = queryTriggers(host, triggerSelector);
						if (triggers.includes(target)) setRovingTabindex(triggers, target);
					},
					{ signal },
				);

				host.addEventListener(
					"keydown",
					(event) => {
						let triggers = queryTriggers(host, triggerSelector);
						if (triggers.length === 0) return;

						let openEntry = findOpenMenu(triggers);

						let target = event.target;
						let triggerTarget =
							target instanceof HTMLButtonElement && triggers.includes(target) ? target : undefined;
						let onTrigger = triggerTarget !== undefined;

						let current = triggerTarget ?? openEntry?.trigger;
						if (!current) return;

						let index = triggers.indexOf(current);

						switch (event.key) {
							case "ArrowRight": {
								event.preventDefault();
								let next = triggers[(index + 1) % triggers.length]!;
								if (openEntry) switchTo(triggers, next, "first", openEntry, itemSelector);
								else focusTrigger(triggers, next);
								return;
							}
							case "ArrowLeft": {
								event.preventDefault();
								let previous = triggers[(index - 1 + triggers.length) % triggers.length]!;
								if (openEntry) switchTo(triggers, previous, "first", openEntry, itemSelector);
								else focusTrigger(triggers, previous);
								return;
							}
							case "Home": {
								if (!onTrigger) return;
								event.preventDefault();
								let first = triggers[0]!;
								if (openEntry) switchTo(triggers, first, "first", openEntry, itemSelector);
								else focusTrigger(triggers, first);
								return;
							}
							case "End": {
								if (!onTrigger) return;
								event.preventDefault();
								let last = triggers[triggers.length - 1]!;
								if (openEntry) switchTo(triggers, last, "first", openEntry, itemSelector);
								else focusTrigger(triggers, last);
								return;
							}
							case "ArrowDown": {
								if (!onTrigger) return;
								event.preventDefault();
								switchTo(triggers, current, "first", openEntry, itemSelector);
								return;
							}
							case "ArrowUp": {
								if (!onTrigger) return;
								event.preventDefault();
								switchTo(triggers, current, "last", openEntry, itemSelector);
								return;
							}
							case "Backspace":
								if (!onTrigger) return;
								buffer = buffer.slice(0, -1);
								return;
						}

						if (!onTrigger || !isPrintableKey(event)) return;

						clearTimeout(resetBufferId);
						buffer += event.key.toLowerCase();
						resetBufferId = setTimeout(() => {
							buffer = "";
						}, TYPEAHEAD_RESET_MS);

						let start = index === -1 ? 0 : index + 1;
						let searchOrder = [...triggers.slice(start), ...triggers.slice(0, start)];
						let match = searchOrder.find((trigger) => labelFor(trigger).startsWith(buffer));
						if (match) focusTrigger(triggers, match);
					},
					{ signal },
				);

				signal.addEventListener("abort", () => clearTimeout(resetBufferId));
			});
		};
	});
