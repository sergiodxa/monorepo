/**
 * Link-based ARIA tab bar. Unlike `remix/ui`'s built-in `Tabs` primitive (which
 * toggles pre-rendered panels client-side with no navigation), each `Tab` here is a
 * real link — active state and content come from the server, and `Tab.frameTarget`
 * lets a tab swap a named `Frame` instead of reloading the whole page. Exists so
 * every tabbed view in this app (currently just the dashboard) shares one ARIA-correct
 * tab bar instead of hand-rolling `role`/`aria-selected` per page.
 *
 * Composes `@pkg/r3-ui`'s compound `Tabs`/`Tabs.List`/`Tabs.Tab` internally —
 * `TabList` wraps a `Tabs` root around `Tabs.List` so call sites keep using it
 * standalone (no enclosing `<Tabs>` of their own), and `Tab` renders a
 * `Tabs.Tab`, which is already the same "real `<a>` with a manually-set
 * `aria-selected`" shape this app needs, plus the `link()`/`frameTarget`
 * wiring layered on top through `mix`.
 *
 * The active-tab indicator reuses `Tabs.List`'s own sliding indicator — a
 * `::after` pseudo-element positioned entirely from the
 * `--ui-tab-indicator-inline-start`/`-inline-size`/`-opacity` custom properties
 * — by setting those three properties from `activeIndex * TAB_WIDTH`, computed
 * server-side with no client JS, the same way the original bespoke indicator
 * `<div>` did. A named `Frame` reload (`dashboard-panel`) diffs rather than
 * replaces this markup, so the indicator persists as the same DOM node across
 * a tab switch and its `transition` actually animates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Tabs } from "@pkg/r3-ui";
import { css, link } from "remix/ui";

/** Every tab's fixed width, in px — must be wide enough for the longest label. */
const TAB_WIDTH = 110;

namespace TabList {
	export interface Props {
		"aria-label": string;
		/** Index of the active `Tab` among its siblings, for the sliding indicator. */
		activeIndex: number;
		children: RemixNode;
	}
}

/** `role="tablist"` wrapper (via `Tabs`/`Tabs.List`) with a sliding active-tab indicator; place one `Tab` per child. */
export function TabList(handle: Handle<TabList.Props>) {
	return () => {
		let { "aria-label": ariaLabel, activeIndex, children } = handle.props;

		return (
			<Tabs mix={[css({ marginBottom: 16 })]}>
				<Tabs.List
					aria-label={ariaLabel}
					mix={[
						css({
							"--ui-tab-indicator-inline-start": `${activeIndex * TAB_WIDTH}px`,
							"--ui-tab-indicator-inline-size": `${TAB_WIDTH}px`,
							"--ui-tab-indicator-opacity": "1",
						}),
					]}
				>
					{children}
				</Tabs.List>
			</Tabs>
		);
	};
}

namespace Tab {
	export interface Props {
		/**
		 * The real, bookmarkable page URL — becomes both the rendered `href` and the
		 * browser's visible location after a click, so a hard reload or a link opened
		 * in a new tab still lands on a full page (not the bare `frameSrc` fragment).
		 */
		href: string;
		active: boolean;
		/** `id` of the `tabpanel` (or `Frame`) this tab controls. */
		controls: string;
		/** Named `Frame` to swap instead of a full page navigation, if any. */
		frameTarget?: string;
		/** Fragment-only URL the named `Frame` actually fetches; defaults to `href`. */
		frameSrc?: string;
		children: RemixNode;
	}
}

/** A single `role="tab"` link (via `Tabs.Tab`), fixed to {@link TAB_WIDTH}. Navigates a named `Frame` when `frameTarget` is set. */
export function Tab(handle: Handle<Tab.Props>) {
	return () => {
		let { href, active, controls, frameTarget, frameSrc, children } = handle.props;

		return (
			<Tabs.Tab
				href={href}
				aria-selected={active}
				aria-controls={controls}
				tabIndex={active ? 0 : -1}
				mix={[
					css({ width: TAB_WIDTH, justifyContent: "center" }),
					link(href, frameTarget ? { target: frameTarget, src: frameSrc } : {}),
				]}
			>
				{children}
			</Tabs.Tab>
		);
	};
}

export default { TabList, Tab };
