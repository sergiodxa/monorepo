/**
 * Link-based ARIA tab bar. Unlike `remix/ui`'s built-in `Tabs` primitive (which
 * toggles pre-rendered panels client-side with no navigation), each `Tab` here is a
 * real link — active state and content come from the server, and `Tab.frameTarget`
 * lets a tab swap a named `Frame` instead of reloading the whole page. Exists so
 * every tabbed view in this app (currently just the dashboard) shares one ARIA-correct
 * tab bar instead of hand-rolling `role`/`aria-selected` per page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css, link } from "remix/ui";

import { neutral, primary } from "~/resources/theme";

const tabList = css({
	display: "flex",
	alignItems: "center",
	gap: 24,
	marginBottom: 16,
	borderBottom: `1px solid ${neutral[200]}`,
	"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
});

const tab = css({
	display: "inline-flex",
	alignItems: "center",
	padding: "0 0 12px",
	marginBottom: -1,
	fontSize: "0.875rem",
	fontWeight: 500,
	color: neutral[500],
	textDecoration: "none",
	borderBottom: "2px solid transparent",
	"&:hover": { color: neutral[900] },
	"@media (prefers-color-scheme: dark)": {
		"&:hover": { color: neutral[50] },
	},
});

const tabActive = css({
	color: primary[600],
	fontWeight: 600,
	borderBottomColor: primary[600],
	"&:hover": { color: primary[600] },
	"@media (prefers-color-scheme: dark)": {
		color: primary[400],
		borderBottomColor: primary[400],
		"&:hover": { color: primary[400] },
	},
});

namespace TabList {
	export interface Props {
		"aria-label": string;
		children: RemixNode;
	}
}

/** `role="tablist"` wrapper; place one `Tab` per child. */
export function TabList(handle: Handle<TabList.Props>) {
	return () => (
		<div role="tablist" aria-label={handle.props["aria-label"]} mix={[tabList]}>
			{handle.props.children}
		</div>
	);
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

/** A single `role="tab"` link. Navigates a named `Frame` when `frameTarget` is set. */
export function Tab(handle: Handle<Tab.Props>) {
	return () => {
		let { href, active, controls, frameTarget, frameSrc, children } = handle.props;

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
				]}
			>
				{children}
			</a>
		);
	};
}

export default { TabList, Tab };
