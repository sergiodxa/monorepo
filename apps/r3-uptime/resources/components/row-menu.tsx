/**
 * A per-row kebab-icon actions menu, generic over its items — pure SSR, no client JS.
 * Uses the native Popover API (`commandfor`/`command`) exactly like
 * `~/resources/components/monitor-row-actions`, anchoring the panel to its own trigger
 * via CSS anchor positioning so N independently-positioned triggers (one per table row)
 * each get a correctly-placed panel with zero JS. Unlike `MonitorRowActions`, which
 * hardcodes a view/edit/delete set, this one takes arbitrary `children` — the team
 * settings page needs three different action sets (member rows, pending-invite rows,
 * domain rows) from a single row-menu shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { EllipsisVerticalIcon } from "@pkg/lucide-remix";
import { css } from "remix/ui";

import { danger, neutral } from "~/resources/theme";

namespace RowMenu {
	export interface Props {
		/** Unique DOM id for this row's popover panel; also seeds its anchor name. */
		id: string;
		/** Accessible label for the kebab trigger, e.g. "Actions for Jane Doe". */
		label: string;
		children: RemixNode;
	}
}

/** Square, icon-only trigger. */
const trigger = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: 32,
	height: 32,
	padding: 0,
	borderRadius: 6,
	border: "1px solid transparent",
	background: "transparent",
	color: "inherit",
	cursor: "pointer",
	"&:hover": { background: neutral[100] },
	"@media (prefers-color-scheme: dark)": {
		"&:hover": { background: neutral[800] },
	},
});

/** Panel anchored below its trigger, right edges aligned so it never overflows the table. */
function panel(anchorName: string) {
	return css({
		position: "absolute",
		positionAnchor: anchorName,
		positionArea: "bottom span-left",
		marginTop: 4,
		width: 200,
		margin: 0,
		padding: 6,
		borderRadius: 8,
		border: `1px solid ${neutral[200]}`,
		background: "#ffffff",
		boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
		"&::backdrop": { background: "rgba(0, 0, 0, 0.2)" },
		"@media (prefers-color-scheme: dark)": {
			background: neutral[950],
			borderColor: neutral[800],
		},
	});
}

/** Shared row styling for a menu entry; call sites compose their own `<button>`/`<a>` with it. */
export const menuItem = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	width: "100%",
	padding: "6px 8px",
	border: "none",
	borderRadius: 6,
	background: "transparent",
	color: neutral[900],
	fontFamily: "inherit",
	fontSize: "0.875rem",
	textAlign: "left",
	textDecoration: "none",
	cursor: "pointer",
	"&:hover": { background: neutral[100] },
	"&:disabled": { cursor: "not-allowed", opacity: 0.5 },
	"@media (prefers-color-scheme: dark)": {
		color: neutral[50],
		"&:hover": { background: neutral[800] },
	},
});

/** Applied on top of {@link menuItem} for destructive entries. */
export const menuItemDanger = css({ color: danger[600] });

/** Thin rule separating groups of items inside the panel. */
export const menuSeparator = css({
	margin: "6px 0",
	border: "none",
	borderTop: `1px solid ${neutral[200]}`,
	"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
});

/** Renders a kebab-icon trigger and its CSS-anchored popover panel wrapping arbitrary `children`. */
export default function RowMenu(handle: Handle<RowMenu.Props>) {
	return () => {
		let { id, label, children } = handle.props;
		let anchorName = `--row-menu-${id}`;

		return (
			<>
				<button
					type="button"
					commandfor={id}
					command="toggle-popover"
					aria-label={label}
					mix={[trigger, css({ anchorName })]}
				>
					<EllipsisVerticalIcon size={16} strokeWidth={1.5} />
				</button>

				<div id={id} popover="auto" mix={[panel(anchorName)]}>
					{children}
				</div>
			</>
		);
	};
}
