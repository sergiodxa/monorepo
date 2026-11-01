/**
 * The peek stack a toast region draws: older toasts fold behind the newest,
 * scaled to 0.95 and 0.9 and nudged out by `--ui-toast-peek`, then fan out
 * into a list while the pointer or focus rests on the region.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/component";

import { combine, raw } from "@sdxc/u/general";
import { media } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import type { CSSStyles } from "../../utils/css-styles.js";

/** Selector for a peek region at rest; hover or focus inside fans it out. */
const COLLAPSED = '&[data-stack="peek"]:not(:hover, :focus-within)';

/** Distance each folded toast peeks past the one in front of it. */
const PEEK = "var(--ui-toast-peek, 0.625rem)";

/**
 * Styles a toast region's children as a capped peek stack. The newest toast
 * is the last child; children past `max` from the end take no space, and
 * folded toasts match the front one's height through `--ui-toast-front-size`.
 *
 * @param max Most toasts shown at once.
 * @returns A mixin ready for the region element's `mix` prop.
 * @example
 * <div data-stack="peek" data-placement="bottom-end" mix={[toastStackStyle(3)]}>{toasts}</div>
 */
export function toastStackStyle<Node extends Element = Element>(
	max: number,
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	let cap = Math.max(1, Math.floor(max));
	let folded = `${COLLAPSED} > :not(:last-child)`;

	return combine<Node>([
		raw<Node>({
			"--ui-toast-peek-direction": "-1",
			"--ui-toast-peek-origin": "center top",
		}),
		when<Node>(
			'&[data-placement^="top"]',
			raw<Node>({
				"--ui-toast-peek-direction": "1",
				"--ui-toast-peek-origin": "center bottom",
				flexDirection: "column-reverse",
			}),
		),
		when<Node>("&:hover, &:focus-within", raw<Node>({ pointerEvents: "auto" })),
		when<Node>(`& > :nth-last-child(n + ${cap + 1})`, raw<Node>({ display: "none" })),
		when<Node>(COLLAPSED, raw<Node>({ display: "grid" })),
		when<Node>(`${COLLAPSED} > *`, raw<Node>({ gridArea: "1 / 1", alignSelf: "end" })),
		when<Node>(`${COLLAPSED}[data-placement^="top"] > *`, raw<Node>({ alignSelf: "start" })),
		when<Node>(
			folded,
			raw<Node>({
				blockSize: "var(--ui-toast-front-size, auto)",
				overflow: "hidden",
				transformOrigin: "var(--ui-toast-peek-origin)",
			}),
		),
		when<Node>(`${folded} > [data-slot="toast"]`, raw<Node>({ blockSize: "100%" })),
		when<Node>(
			`${folded}[data-slot="toast"] > *, ${folded} [data-slot="toast"] > *`,
			raw<Node>({ opacity: "0" }),
		),
		when<Node>(
			`${COLLAPSED} > :nth-last-child(2)`,
			raw<Node>({
				transform: `translateY(calc(${PEEK} * var(--ui-toast-peek-direction))) scale(0.95)`,
			}),
		),
		when<Node>(
			`${COLLAPSED} > :nth-last-child(n + 3)`,
			raw<Node>({
				transform: `translateY(calc(${PEEK} * 2 * var(--ui-toast-peek-direction))) scale(0.9)`,
			}),
		),
		media<Node>(
			"(prefers-reduced-motion: no-preference)",
			combine<Node>([
				when<Node>("& > *", raw<Node>({ transition: "transform 200ms ease-out" })),
				when<Node>(
					'& [data-slot="toast"] > *',
					raw<Node>({ transition: "opacity 200ms ease-out" }),
				),
			]),
		),
	]);
}
