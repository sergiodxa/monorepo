/**
 * The dashboard panel's toolbar: the monitor-type tabs and the auto-refresh control in one row.
 * The tabs scroll sideways inside their own box and the control follows them, wrapping onto its
 * own line when the row is too narrow, so the two never overlap on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { css } from "remix/component";

namespace PanelToolbar {
	export interface Props {
		/** The tab list. */
		tabs: RemixNode;
		/** The auto-refresh control, set at the row's trailing end. */
		refresh: RemixNode;
	}
}

/** Lays the tabs and the refresh control out side by side, wrapping before they collide. */
export default function PanelToolbar(handle: Handle<PanelToolbar.Props>) {
	return () => (
		<div
			data-slot="panel-toolbar"
			mix={css({
				display: "flex",
				flexWrap: "wrap",
				alignItems: "center",
				justifyContent: "space-between",
				columnGap: "1rem",
				rowGap: "0.5rem",
				marginBlockEnd: "1rem",
			})}
		>
			<div
				data-slot="panel-tabs"
				mix={css({ minInlineSize: 0, maxInlineSize: "100%", overflowX: "auto" })}
			>
				{handle.props.tabs}
			</div>
			<div data-slot="panel-refresh" mix={css({ flexShrink: 0, marginInlineStart: "auto" })}>
				{handle.props.refresh}
			</div>
		</div>
	);
}
