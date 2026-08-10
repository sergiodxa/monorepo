/**
 * A per-row kebab-icon actions menu, generic over its items — built on
 * `@pkg/ui`'s `Menu`/`Popover` compound, anchored to its own kebab trigger
 * through the Popover API's implicit-anchor behavior (the `commandfor`
 * invoker relationship doubles as the CSS anchor, so N independently
 * positioned triggers — one per table row — each get a correctly placed
 * panel with no manual anchor-name wiring), plus the `menuKeys()` mixin for
 * the WAI-ARIA menu keyboard pattern (roving tabindex, arrow-key/Home/End
 * navigation, typeahead) over whatever `[role^="menuitem"]` descendants a
 * caller's own children happen to carry. It takes arbitrary `children` because
 * no two callers want the same action set: the team settings page alone needs
 * three (member rows, pending-invite rows, domain rows), and the monitor tables
 * want view/edit/delete, all from a single row-menu shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { EllipsisVerticalIcon } from "@pkg/lucide-remix";
import { bg, border, borderEdge, fg } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { cursor, raw } from "@pkg/u/general";
import { flex, gap, inlineFlex, items, justify } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { height, is, m, p, width } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { font, fontSize, textAlign, textDecoration } from "@pkg/u/typography";
import { Menu } from "@pkg/ui";
import { menuKeys } from "@pkg/ui/mixins";

namespace RowMenu {
	export interface Props {
		/** Unique DOM id for this row's `Menu` panel; also the trigger's `commandfor` target. */
		id: string;
		/** Accessible label for the kebab trigger and the menu panel, e.g. "Actions for Jane Doe". */
		label: string;
		children: RemixNode;
	}
}

/**
 * Square, icon-only trigger.
 *
 * 40px with a 20px glyph, widening to 44px wherever the pointer is coarse: a finger
 * cannot aim at the 32px box a mouse manages fine, and 44px is the smallest target
 * WCAG 2.5.5 accepts. The media query keys on pointer type rather than viewport width
 * because it is the input device, not the screen size, that decides how big the target
 * has to be — a touch laptop needs the larger box at desktop widths.
 *
 * The glyph is three small dots, so it reads far lighter than its nominal size and
 * needs a full-weight stroke and the emphasis foreground to stay visible. Inheriting
 * the cell's color left it at the muted body tone, which all but disappeared against a
 * dark background.
 */
const trigger = [
	inlineFlex(),
	items("center"),
	justify("center"),
	width("40px"),
	height("40px"),
	media("(pointer: coarse)", [width("44px"), height("44px")]),
	p(0),
	rounded("md"),
	border({ color: "transparent", width: 1 }),
	bg("transparent"),
	fg("neutral.emphasis"),
	cursor("pointer"),
	when("&:hover", bg("neutral.bg-tint-hover")),
];

/** Fixed panel width, right-aligned to the trigger via `placement="bottom-end"` so it never overflows the table. */
const panel = [
	is("200px"),
	raw({ background: "#ffffff" }),
	media("(prefers-color-scheme: dark)", bg("neutral.bg-tint")),
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
	fg("neutral.emphasis"),
	font("inherit"),
	fontSize("sm"),
	// Deliberately physical `"left"`, not the logical start/end, per this row's layout.
	textAlign("left"),
	textDecoration("none"),
	cursor("pointer"),
	when("&:hover", bg("neutral.bg-tint-hover")),
	when("&:disabled", [cursor("not-allowed"), opacity(50)]),
];

/** Applied on top of {@link menuItem} for destructive entries. */
export const menuItemDanger = fg("danger");

/** Thin rule separating groups of items inside the panel. */
export const menuSeparator = [
	m("6px", 0),
	border("none"),
	borderEdge("top", { width: 1, color: "neutral" }),
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
					<EllipsisVerticalIcon size={20} strokeWidth={2} />
				</button>

				<Menu id={id} placement="bottom-end" aria-label={label} mix={[menuKeys(), panel]}>
					{children}
				</Menu>
			</>
		);
	};
}
