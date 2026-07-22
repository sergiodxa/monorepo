/**
 * A per-row kebab-icon actions menu, generic over its items — built on
 * `@pkg/r3-ui`'s `Menu`/`Popover` compound, anchored to its own kebab trigger
 * through the Popover API's implicit-anchor behavior (the `commandfor`
 * invoker relationship doubles as the CSS anchor, so N independently
 * positioned triggers — one per table row — each get a correctly placed
 * panel with no manual anchor-name wiring), plus the `menuKeys()` mixin for
 * the WAI-ARIA menu keyboard pattern (roving tabindex, arrow-key/Home/End
 * navigation, typeahead) over whatever `[role^="menuitem"]` descendants a
 * caller's own children happen to carry. Unlike `MonitorRowActions`, which
 * hardcodes a view/edit/delete set, this one takes arbitrary `children` — the
 * team settings page needs three different action sets (member rows,
 * pending-invite rows, domain rows) from a single row-menu shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { EllipsisVerticalIcon } from "@pkg/lucide-remix";
import { Menu } from "@pkg/r3-ui";
import { menuKeys } from "@pkg/r3-ui/mixins";
import { css } from "remix/ui";

import { danger, neutral } from "~/resources/theme";

namespace RowMenu {
	export interface Props {
		/** Unique DOM id for this row's `Menu` panel; also the trigger's `commandfor` target. */
		id: string;
		/** Accessible label for the kebab trigger and the menu panel, e.g. "Actions for Jane Doe". */
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

/** Fixed panel width, right-aligned to the trigger via `placement="bottom-end"` so it never overflows the table. */
const panel = css({
	inlineSize: 200,
	background: "#ffffff",
	"@media (prefers-color-scheme: dark)": {
		background: neutral[950],
	},
});

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

/** Renders a kebab-icon trigger and its `Menu`-based panel wrapping arbitrary `children`. */
export default function RowMenu(handle: Handle<RowMenu.Props>) {
	return () => {
		let { id, label, children } = handle.props;

		return (
			<>
				<button
					type="button"
					commandfor={id}
					command="toggle-popover"
					aria-label={label}
					mix={[trigger]}
				>
					<EllipsisVerticalIcon size={16} strokeWidth={1.5} />
				</button>

				<Menu id={id} placement="bottom-end" aria-label={label} mix={[menuKeys(), panel]}>
					{children}
				</Menu>
			</>
		);
	};
}
