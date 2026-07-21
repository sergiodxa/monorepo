/**
 * Delegated arrow-key activation for a Tabs list: reads the shared
 * `remix/ui/tabs` context so a single `keydown` listener on the tablist
 * container, rather than one per tab, moves the roving tab stop and
 * activates whichever tab focus lands on.
 *
 * Why JS: the WAI-ARIA tabs pattern requires ArrowLeft/ArrowRight/ArrowUp/
 * ArrowDown to move a single roving tab stop between tabs — activating each
 * tab as focus reaches it — plus Home/End to jump to the first or last
 * enabled tab, a keyboard model no combination of HTML and CSS expresses on
 * its own.
 * No-JS baseline: every tab still renders as its own focusable control,
 * individually reachable through Tab, and whichever tab and panel were
 * active at render time stay exactly as rendered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";
import * as tabs from "remix/ui/tabs/primitives";

/**
 * Options accepted by {@link tabKeys}. Reserved for future configuration;
 * the mixin needs no per-call arguments today.
 */
export interface TabKeysOptions {}

/**
 * Adds delegated arrow-key activation to a Tabs list, adapting the
 * `remix/ui/tabs` context instead of tracking tab order or the active tab
 * itself.
 *
 * A single `keydown` listener on the list catches key presses on their way
 * down to whichever tab currently holds focus. Because the shared context
 * only ever gives DOM focus to the active tab, `context.activeTab` always
 * names the tab a key press is coming from, so the mixin never inspects the
 * event target to know which tab moved. `ArrowRight`/`ArrowDown` move
 * activation to the next enabled tab, `ArrowLeft`/`ArrowUp` to the previous
 * one, and `Home`/`End` jump to the first or last enabled tab, wrapping
 * around the ends — each move both refocuses and activates the target tab,
 * matching the automatic-activation tabs pattern.
 *
 * The listener runs in the capture phase and stops the keys it handles from
 * propagating further, so it pre-empts — rather than double-fires
 * alongside — a per-tab primitive such as `remix/ui/tabs`'s own `tab()`
 * that binds the same arrow keys directly on each tab.
 *
 * @example
 * <tabs.Context defaultActiveTab="overview">
 *   <div role="tablist" mix={tabKeys()}>
 *     <button mix={tabs.tab({ name: "overview" })}>Overview</button>
 *     <button mix={tabs.tab({ name: "activity" })}>Activity</button>
 *   </div>
 * </tabs.Context>
 */
export const tabKeys = createMixin<HTMLElement, [options?: TabKeysOptions]>((handle) => {
	let context = handle.context.get(tabs.Context);

	return () =>
		createElement(handle.element, {
			mix: [
				on<HTMLElement, "keydown">(
					"keydown",
					(event) => {
						if (context.disabled) return;

						let activeTab = context.activeTab;
						if (activeTab === null) return;

						switch (event.key) {
							case "ArrowRight":
							case "ArrowDown":
								event.preventDefault();
								event.stopPropagation();
								context.activateTabInDirection(activeTab, "next");
								break;
							case "ArrowLeft":
							case "ArrowUp":
								event.preventDefault();
								event.stopPropagation();
								context.activateTabInDirection(activeTab, "previous");
								break;
							case "Home":
								event.preventDefault();
								event.stopPropagation();
								context.activateTabInDirection(activeTab, "first");
								break;
							case "End":
								event.preventDefault();
								event.stopPropagation();
								context.activateTabInDirection(activeTab, "last");
								break;
						}
					},
					true,
				),
			],
		});
});
