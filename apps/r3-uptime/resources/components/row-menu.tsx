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
import { bg, border, borderEdge, fg } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { cursor, raw } from "@pkg/u/general";
import { flex, gap, inlineFlex, items, justify } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { height, is, m, p, width } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { fontSize, textDecoration } from "@pkg/u/typography";

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
const trigger = [
	inlineFlex(),
	items("center"),
	justify("center"),
	width("32px"),
	height("32px"),
	p(0),
	rounded("md"),
	border({ color: "transparent", width: 1 }),
	bg("transparent"),
	fg("inherit"),
	cursor("pointer"),
	when("&:hover", bg(neutral[100])),
	media("(prefers-color-scheme: dark)", when("&:hover", bg(neutral[800]))),
];

/** Fixed panel width, right-aligned to the trigger via `placement="bottom-end"` so it never overflows the table. */
const panel = [
	is("200px"),
	raw({ background: "#ffffff" }),
	media("(prefers-color-scheme: dark)", bg(neutral[950])),
];

/** Shared row styling for a menu entry; call sites compose their own `<button>`/`<a>` with it. */
export const menuItem = [
	flex(),
	items("center"),
	gap("8px"),
	width("100%"),
	p("6px", "8px"),
	border("none"),
	rounded("md"),
	bg("transparent"),
	fg(neutral[900]),
	raw({ fontFamily: "inherit" }),
	fontSize("sm"),
	// `@pkg/u`'s `textAlign()` only exposes the logical start/end/center/justify
	// keywords, not the physical `"left"` this row deliberately uses.
	raw({ textAlign: "left" }),
	textDecoration("none"),
	cursor("pointer"),
	when("&:hover", bg(neutral[100])),
	when("&:disabled", [cursor("not-allowed"), opacity(50)]),
	media("(prefers-color-scheme: dark)", [fg(neutral[50]), when("&:hover", bg(neutral[800]))]),
];

/** Applied on top of {@link menuItem} for destructive entries. */
export const menuItemDanger = fg(danger[600]);

/** Thin rule separating groups of items inside the panel. */
export const menuSeparator = [
	m("6px", 0),
	border("none"),
	borderEdge("top", { width: 1, color: neutral[200] }),
	media("(prefers-color-scheme: dark)", border(neutral[800])),
];

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
