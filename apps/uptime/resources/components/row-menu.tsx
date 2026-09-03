/**
 * A per-row kebab-icon actions menu, generic over its items, built on
 * `@sdxc/ui`'s `Menu`/`Popover` compound. Anchoring reuses the Popover API's
 * implicit-anchor behavior — the `commandfor` invoker relationship doubles as
 * the CSS anchor — so each row's independently positioned trigger gets a
 * correctly placed panel with no manual anchor-name wiring.
 *
 * The `menuKeys()` mixin adds the WAI-ARIA menu keyboard pattern over the
 * caller's own `[role^="menuitem"]` children, since each caller needs a
 * different action set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { EllipsisVerticalIcon } from "@sdxc/icons";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { flex, gap, inlineFlex, items, justify } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { height, is, m, p, width } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, fontSize, textAlign, textDecoration } from "@sdxc/u/typography";
import { Menu } from "@sdxc/ui";
import { menuKeys } from "@sdxc/ui/mixins";

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
 * Square, icon-only trigger; widens to the WCAG 2.5.5 minimum of 44px under
 * a coarse pointer, since a touch laptop needs the larger target even at
 * desktop widths. A full-weight stroke and the emphasis foreground keep the three-dot glyph visible against a dark background.
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

/**
 * Shared row styling for a menu entry; call sites compose their own
 * `<button>`/`<a>` with it. Text stays physically left-aligned to match this
 * row's fixed layout regardless of text direction.
 */
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
