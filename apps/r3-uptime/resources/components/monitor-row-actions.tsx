/**
 * A row's view/edit/delete actions menu, opened from a kebab-icon trigger — pure
 * SSR, no client JS. Uses the native Popover API (`commandfor`/`command`) exactly
 * like `~/resources/layouts/app-shell.tsx`'s team-picker/user-menu dropdowns, but
 * anchors the panel to its own trigger via CSS anchor positioning (`anchor-name` on
 * the trigger, `position-anchor`/`anchor()` on the panel) instead of a fixed
 * viewport offset — anchor positioning computes the panel's position per-instance
 * in the browser's own layout engine, so N independently-positioned triggers (one
 * per table row) each get a correctly-placed panel with zero JS, sidestepping the
 * exact problem a plain `position: absolute` panel has once a `[popover]` is
 * promoted to the top layer (its containing block becomes the viewport, not any
 * DOM ancestor, so every row's panel would otherwise resolve to the same spot).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { EllipsisVerticalIcon, EyeIcon, PencilIcon, TrashIcon } from "@pkg/lucide-remix";
import { css } from "remix/ui";

import { danger, neutral } from "~/resources/theme";

namespace MonitorRowActions {
	export interface Props {
		monitorName: string;
		viewHref: string;
		editHref: string;
		deleteDialogId: string;
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
	border: `1px solid ${neutral[300]}`,
	background: "#ffffff",
	color: "inherit",
	cursor: "pointer",
	"&:hover": { background: neutral[50] },
	"@media (prefers-color-scheme: dark)": {
		background: neutral[900],
		borderColor: neutral[700],
		"&:hover": { background: neutral[800] },
	},
});

/**
 * Panel anchored to its own trigger: below it, right edges aligned (so it never
 * overflows past the table's right edge, since the trigger sits in the last
 * column). Falls back to the UA's default centered-viewport popover position in
 * browsers without anchor positioning support — a graceful, if imperfect,
 * degradation rather than a broken popover.
 */
function panel(anchorName: string) {
	return css({
		position: "absolute",
		positionAnchor: anchorName,
		// `position-area` places the panel in a region relative to the anchor
		// (below it, right edges flush) without needing to hand-compute each
		// axis via `anchor()` — `bottom span-left` reads as "below the anchor,
		// spanning toward its left" (i.e. right-aligned to the anchor).
		positionArea: "bottom span-left",
		marginTop: 4,
		width: 160,
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

/** Single row inside the panel. */
const item = css({
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
	"@media (prefers-color-scheme: dark)": {
		color: neutral[50],
		"&:hover": { background: neutral[800] },
	},
});

/** Applied on top of {@link item} for the destructive "Delete" entry. */
const itemDanger = css({ color: danger[600] });

/** Renders a row's kebab-icon menu (view/edit/delete), CSS-anchored to its own trigger. */
export default function MonitorRowActions(handle: Handle<MonitorRowActions.Props>) {
	return () => {
		let { monitorName, viewHref, editHref, deleteDialogId } = handle.props;
		let menuId = `row-menu-${deleteDialogId}`;
		let anchorName = `--row-menu-${deleteDialogId}`;

		return (
			<>
				<button
					type="button"
					commandfor={menuId}
					command="toggle-popover"
					aria-label={`Actions for ${monitorName}`}
					mix={[trigger, css({ anchorName })]}
				>
					<EllipsisVerticalIcon size={16} strokeWidth={1.5} />
				</button>

				<div id={menuId} popover="auto" mix={[panel(anchorName)]}>
					<a href={viewHref} mix={[item]}>
						<EyeIcon size={16} strokeWidth={1.5} />
						<span>View</span>
					</a>
					<a href={editHref} mix={[item]}>
						<PencilIcon size={16} strokeWidth={1.5} />
						<span>Edit</span>
					</a>
					<button
						type="button"
						commandfor={deleteDialogId}
						command="show-modal"
						mix={[item, itemDanger]}
					>
						<TrashIcon size={16} strokeWidth={1.5} />
						<span>Delete</span>
					</button>
				</div>
			</>
		);
	};
}
