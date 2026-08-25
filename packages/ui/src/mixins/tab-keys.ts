/**
 * Delegated arrow-key activation for a Tabs list: a single `keydown`
 * listener on the tablist container reads the shared `remix/ui/tabs`
 * context to move the roving tab stop, instead of binding one listener
 * per tab. Needed because the WAI-ARIA tabs keyboard pattern has no
 * HTML/CSS equivalent; without JS every tab stays reachable through Tab.
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
 * Adds delegated arrow-key activation to a Tabs list, adapting the shared
 * `remix/ui/tabs` context instead of tracking tab order itself. Capturing
 * and stopping handled keys pre-empts a same-key `tab()` binding per tab.
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
