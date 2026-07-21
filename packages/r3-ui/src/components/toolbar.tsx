/**
 * A bordered, tinted panel that groups a set of interactive controls —
 * buttons, toggles, menus — along a single axis. The host renders as a
 * `toolbar` landmark and lays its children out as a row by default,
 * switching to a column when its orientation flips to vertical.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { attrs, css } from "remix/ui";

/**
 * `role="toolbar"` applied through {@link attrs} unless a consumer supplies
 * its own `role`, announcing the host as a toolbar landmark for the controls
 * grouped inside it.
 */
const DEFAULT_ROLE = "toolbar";

/**
 * Default {@link Toolbar.Props} orientation, applied through {@link attrs}
 * unless a consumer sets `aria-orientation` directly. Keeping the
 * accessibility contract and the CSS variant selector on the same attribute
 * means a consumer only ever sets one thing to flip the panel's axis.
 */
const DEFAULT_ORIENTATION: Toolbar.Orientation = "horizontal";

/**
 * Prop types for {@link Toolbar}.
 */
export namespace Toolbar {
	/**
	 * Axis the toolbar's controls lay out along: a single row, or a single
	 * column.
	 */
	export type Orientation = "horizontal" | "vertical";

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * Setting `aria-orientation="vertical"` switches both the accessibility
	 * contract and the rendered layout to a column; leaving it unset (or set
	 * to `"horizontal"`) keeps the default row layout.
	 */
	export interface Props extends TagProps<"div"> {}
}

/**
 * Renders a bordered, tinted panel grouping a set of interactive controls
 * along one axis. The host carries the `toolbar` role and lays its children
 * out as a horizontally centered row by default; setting
 * `aria-orientation="vertical"` flips it to a left-aligned column instead.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the toolbar's markup.
 * @example
 * <Toolbar aria-label={t("editor.toolbar")}>
 * 	<Button variant="ghost"><ScissorsIcon /></Button>
 * 	<Button variant="ghost"><CopyIcon /></Button>
 * 	<Button variant="ghost"><ClipboardIcon /></Button>
 * </Toolbar>
 * @example
 * <Toolbar aria-label={t("editor.toolbar")} aria-orientation="vertical">
 * 	<Button variant="ghost"><BoldIcon /></Button>
 * 	<Button variant="ghost"><ItalicIcon /></Button>
 * </Toolbar>
 */
export function Toolbar(handle: Handle<Toolbar.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					attrs({ role: DEFAULT_ROLE, "aria-orientation": DEFAULT_ORIENTATION }),
					css({
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						borderRadius: "var(--ui-radius-lg, 0.5rem)",
						borderWidth: "1px",
						borderStyle: "solid",
						borderColor: "var(--ui-neutral-border)",
						backgroundColor: "var(--ui-neutral-bg-tint)",
						paddingBlock: "0.5rem",
						paddingInline: "0.5rem",

						'&[aria-orientation="vertical"]': {
							flexDirection: "column",
							alignItems: "flex-start",
						},
					}),
					mix,
				]}
			/>
		);
	};
}
