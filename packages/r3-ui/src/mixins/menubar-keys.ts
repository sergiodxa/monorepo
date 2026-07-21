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

import { DISABLED_SELECTOR } from "../utils/disabled-selector";
import {
	focusItem as focusTrigger,
	isPrintableKey,
	labelFor,
	queryItems as queryMenuItems,
	setRovingTabindex,
} from "../utils/keyboard-nav";

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
		 * Selector, evaluated against the row's direct children, that
		 * identifies its top-level triggers. Defaults to `[role="menuitem"]`,
		 * matching `Menubar.Trigger`'s own default role. Scoped to direct
		 * children only, so a `menuitem`-role row nested inside one of the
		 * row's own opened Menus is never mistaken for one of the row's own
		 * triggers.
		 */
		triggerSelector?: string;
		/**
		 * Selector, evaluated against whichever Menu a trigger opens, that
		 * identifies its rows. Defaults to `[role^="menuitem"]`, matching the
		 * `menuitem`, `menuitemcheckbox`, and `menuitemradio` roles a
		 * `Menu.Item` carries. Pass the same value here as whatever
		 * `itemSelector` a paired `menuKeys()` call on that Menu uses, for
		 * non-standard markup.
		 */
		itemSelector?: string;
	}
}

/**
 * Collects the row's enabled top-level triggers, in document order, matching
 * `selector` among `host`'s direct children only. Queried fresh on every
 * keystroke and focus change so navigation stays correct as triggers are
 * added, removed, or toggled disabled.
 */
function queryTriggers(host: HTMLElement, selector: string): HTMLButtonElement[] {
	let candidates = host.querySelectorAll<HTMLButtonElement>(`:scope > ${selector}`);
	return Array.from(candidates).filter((trigger) => !trigger.matches(DISABLED_SELECTOR));
}

/**
 * Resolves a trigger's paired Menu — the popover surface its `commandfor`
 * points at — preferring the live `commandForElement` reference and falling
 * back to an `id` lookup for runtimes that parse `commandfor` without yet
 * reflecting the IDL property.
 */
function menuFor(trigger: HTMLButtonElement): HTMLElement | undefined {
	if (trigger.commandForElement instanceof HTMLElement) return trigger.commandForElement;

	let commandForId = trigger.getAttribute("commandfor");
	if (!commandForId) return undefined;

	return trigger.ownerDocument.getElementById(commandForId) ?? undefined;
}

/**
 * Finds whichever one of `triggers`' paired Menus is currently showing — at
 * most one at a time, since a shown Menu rides the Popover API's `"auto"`
 * mode, and showing one already dismisses any other `"auto"` surface open
 * alongside it.
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
 * Opens `trigger`'s paired Menu — if it isn't already showing — and moves
 * focus onto its first or last enabled row, handing focus off into whatever
 * roving tabindex that Menu's own `menuKeys()` mixin already drives from
 * there. Also assigns roving tabindex onto `trigger` itself, so Tab order
 * stays correct for whenever the Menu later closes. Does nothing beyond
 * opening when the Menu has no enabled rows of its own, or doesn't resolve
 * to an element at all.
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
 * trigger's Menu `openEntry` names — if any, and if it isn't `target`'s own
 * — then opens and hands focus into `target`'s Menu the same way
 * {@link openMenuAndFocus} always does. Used everywhere a key both moves
 * along the row and keeps a Menu open across that move, mirroring how a
 * native application's own menu bar swaps which menu shows as focus crosses
 * from one top-level trigger to the next.
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
 * triggers: roving tabindex, `ArrowLeft`/`ArrowRight` and Home/End
 * navigation between them, and typeahead — the identical shape `menuKeys()`
 * gives a Menu's own rows, one level up. Apply it to the Menubar root
 * through its `mix` prop, alongside each Menu it opens rendered as a direct
 * child of that same root — the shape the compound component already
 * composes in — so a keystroke bubbling up from inside an open Menu still
 * reaches this mixin's own listener.
 *
 * `ArrowDown` opens the focused trigger's paired Menu and moves focus onto
 * its first enabled row; `ArrowUp` does the same onto its last row. From
 * there, that Menu's own `menuKeys()` mixin — paired on the Menu itself —
 * owns every further keystroke, since focus and roving tabindex both now sit
 * inside its rows; this mixin leaves `ArrowUp`/`ArrowDown`/`Home`/`End` and
 * typeahead alone whenever focus already sits inside an open Menu rather
 * than on one of the row's own triggers, precisely so it never fights that
 * handed-off keyboard pattern for the same keys.
 *
 * `ArrowLeft`/`ArrowRight` behave the same way whether focus currently sits
 * on a trigger or deep inside its open Menu: when a Menu is showing
 * anywhere in the row, they close it, move to the adjacent trigger, and
 * open and hand off into that trigger's own Menu the same way `ArrowDown`
 * does; when no Menu is open, they just move roving tabindex and focus
 * along the row. `Home`/`End` mirror that same open-aware handoff, but only
 * once focus is back on a trigger, leaving a Home/End struck from inside an
 * open Menu to that Menu's own `menuKeys()` instead.
 *
 * Dismissing an open Menu — Escape, or an outside click, both already
 * native to its `"auto"` popover mode — returns focus to its trigger on its
 * own, through the platform's own popover focus-return behavior, so this
 * mixin never has to handle Escape itself.
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
			// `options` is optional, so a call site that omits it
			// (`menubarKeys()`) gets the runtime's trailing current-props
			// argument in its place — reset it back to an empty options
			// object when that happens.
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
