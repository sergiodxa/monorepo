/**
 * Link-based ARIA tab bar. Unlike `remix/ui`'s built-in `Tabs` primitive (which
 * toggles pre-rendered panels client-side with no navigation), each `Tab` here is a
 * real link — active state and content come from the server, and `Tab.frameTarget`
 * lets a tab swap a named `Frame` instead of reloading the whole page. Exists so
 * every tabbed view in this app (currently just the dashboard) shares one ARIA-correct
 * tab bar instead of hand-rolling `role`/`aria-selected` per page.
 *
 * The active-tab indicator is one shared, absolutely-positioned bar rather than a
 * border on each `Tab`, so it can slide between tabs on `transform` alone — no client
 * JS, since every tab has the same fixed width and the indicator's `translateX` is a
 * plain `activeIndex * TAB_WIDTH` computed server-side. A named `Frame` reload
 * (`dashboard-panel`) diffs rather than replaces this markup, so the indicator persists
 * as the same DOM node across a tab switch and the `transition` actually animates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { clientEntry, css, link, on } from "remix/ui";

import { prefetchFrame } from "~/resources/frame-prefetch";
import { neutral, primary } from "~/resources/theme";

/** Every tab's fixed width, in px — must be wide enough for the longest label. */
const TAB_WIDTH = 110;

const tabList = css({
	position: "relative",
	display: "flex",
	marginBottom: 16,
	borderBottom: `1px solid ${neutral[200]}`,
	"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
});

const tab = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: TAB_WIDTH,
	padding: "0 0 12px",
	fontSize: "0.875rem",
	fontWeight: 500,
	color: neutral[500],
	textDecoration: "none",
	"&:hover": { color: neutral[900] },
	"@media (prefers-color-scheme: dark)": {
		"&:hover": { color: neutral[50] },
	},
});

const tabActive = css({
	color: primary[600],
	fontWeight: 600,
	"&:hover": { color: primary[600] },
	"@media (prefers-color-scheme: dark)": {
		color: primary[400],
		"&:hover": { color: primary[400] },
	},
});

const indicator = css({
	position: "absolute",
	bottom: -1,
	left: 0,
	width: TAB_WIDTH,
	height: 2,
	background: primary[600],
	transition: "transform 0.2s ease",
	"@media (prefers-color-scheme: dark)": { background: primary[400] },
});

namespace TabList {
	export interface Props {
		"aria-label": string;
		/** Index of the active `Tab` among its siblings, for the sliding indicator. */
		activeIndex: number;
		children: RemixNode;
	}
}

/** `role="tablist"` wrapper with a sliding active-tab indicator; place one `Tab` per child. */
export function TabList(handle: Handle<TabList.Props>) {
	return () => (
		<div role="tablist" aria-label={handle.props["aria-label"]} mix={[tabList]}>
			{handle.props.children}
			<div
				mix={[
					indicator,
					css({ transform: `translateX(${handle.props.activeIndex * TAB_WIDTH}px)` }),
				]}
			/>
		</div>
	);
}

namespace Tab {
	/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
	export type Props = {
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
	};
}

/**
 * A single `role="tab"` link. Navigates a named `Frame` when `frameTarget` is set.
 * Hovering or focusing a tab that targets a `Frame` starts fetching its content right
 * away, so the eventual click's `resolveFrame` call can reuse the already-in-flight
 * response instead of waiting for a fresh round-trip.
 */
export const Tab = clientEntry<Tab.Props>(
	"/resources/components/tabs.tsx#Tab",
	function Tab(handle: Handle<Tab.Props>) {
		return () => {
			let { href, active, controls, frameTarget, frameSrc, children } = handle.props;

			let prefetch = () => {
				if (frameTarget) prefetchFrame(frameSrc ?? href, frameTarget);
			};

			return (
				<a
					href={href}
					role="tab"
					aria-selected={active}
					aria-controls={controls}
					tabIndex={active ? 0 : -1}
					mix={[
						tab,
						active && tabActive,
						link(href, frameTarget ? { target: frameTarget, src: frameSrc } : {}),
						frameTarget && on("mouseenter", prefetch),
						frameTarget && on("focus", prefetch),
					]}
				>
					{children}
				</a>
			);
		};
	},
);

export default { TabList, Tab };
