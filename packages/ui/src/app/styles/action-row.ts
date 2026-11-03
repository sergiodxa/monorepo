/**
 * The placement every settings-style action row shares: a button that acts at once sits at
 * the row's end centred on the title's first line, or under the text at its start, and a
 * narrow container always stacks it under the text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UtilityMixin } from "@sdxc/u";
import type { ElementProps, MixinDescriptor } from "remix/component";

import { raw } from "@sdxc/u/general";
import { text } from "@sdxc/u/typography";

import type { CSSStyles } from "../../utils/css-styles.js";

/** Container width from which an end-placed action leaves the stack for the row's end. */
const ACTION_ROW_MIN = "32rem";

/**
 * Where an action row's button sits on a wide container: `"end"` beside the title's first
 * line, for a description of a line or two; `"below"` under the text, for a longer one or
 * one holding a list or warning.
 */
export type ActionPlacement = "end" | "below";

/**
 * Lays out an action row as a grid of its text block and its control: one column with the
 * control under the text at its start, and for `"end"` on a container at least 32rem wide,
 * the text taking the flexible width and the control its own at the end.
 *
 * @param containerName The container query name the row measures.
 * @param placement Where the control sits on a wide container.
 * @param gap The grid's row and column gap.
 * @returns A mixin for the row's grid element.
 * @example
 * <div mix={[actionRowGrid("ui-settings-card", "end", "0.5rem 1.5rem")]}>{text}{control}</div>
 */
export function actionRowGrid<Node extends Element = Element>(
	containerName: string,
	placement: ActionPlacement,
	gap: string,
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	return raw<Node>({
		display: "grid",
		gap,
		alignItems: "start",
		justifyItems: "start",
		gridTemplateColumns: "minmax(0, 1fr)",
		...(placement === "end"
			? {
					[`@container ${containerName} (min-width: ${ACTION_ROW_MIN})`]: {
						gridTemplateColumns: "minmax(0, 1fr) auto",
					},
				}
			: {}),
	});
}

/**
 * Centres an end-placed control on the title's first line: on a wide container the
 * control's box is one small-text line tall and the button overflows it evenly into the
 * row's padding. Below 32rem the box wraps the control as stacked content.
 *
 * @param containerName The container query name the row measures.
 * @returns The mixins for the element wrapping the row's control.
 * @example
 * <div mix={[onTitleLine("ui-settings-card")]}><Button>Open billing portal</Button></div>
 */
export function onTitleLine(containerName: string): UtilityMixin[] {
	let styles: CSSStyles = {};
	styles[`@container ${containerName} (min-width: ${ACTION_ROW_MIN})`] = {
		display: "flex",
		alignItems: "center",
		blockSize: "1lh",
	};
	return [text("sm"), raw(styles)];
}
