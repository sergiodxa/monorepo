/**
 * Overprint's gallery miniature: the name in its two inks crossing each other on newsprint,
 * with the date and city as the poster's foot, so the card shows the loud print the page is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { css } from "remix/component";

import {
	BLEND,
	BLUE,
	DISPLAY,
	GRAIN,
	halftone,
	MONO,
	PINK,
} from "~/resources/views/demos/conference/ink";

/** Renders the miniature poster. */
export default function ConferenceThumbnail() {
	return () => (
		<div
			mix={css({
				position: "absolute",
				inset: "0",
				display: "grid",
				alignContent: "space-between",
				padding: "0.875rem 1rem",
				overflow: "clip",
				fontFamily: DISPLAY,
				fontWeight: "900",
				fontSynthesis: "none",
				textTransform: "uppercase",
				"--op-blend": "multiply",
				":is(.dark) &": { "--op-blend": "screen" },
				"@media (prefers-color-scheme: dark)": { ":is(.system) &": { "--op-blend": "screen" } },
				"&::after": {
					content: '""',
					position: "absolute",
					inset: "0",
					backgroundImage: GRAIN,
					opacity: "0.25",
					mixBlendMode: "multiply",
					pointerEvents: "none",
				},
			})}
		>
			<span
				mix={css({
					position: "absolute",
					insetBlockStart: "-2.5rem",
					insetInlineEnd: "-2rem",
					inlineSize: "9rem",
					aspectRatio: "1",
					borderRadius: "50%",
					background: halftone(PINK, "6px"),
				})}
			/>
			<span
				mix={css({ position: "relative", display: "grid", fontSize: "3.75rem", lineHeight: "0.8" })}
			>
				<span mix={css({ color: PINK })}>Over</span>
				<span
					mix={css({
						color: BLUE,
						marginInlineStart: "2.5rem",
						marginBlockStart: "-0.12em",
						mixBlendMode: BLEND,
					})}
				>
					print
				</span>
			</span>
			<span
				mix={css({
					position: "relative",
					display: "flex",
					justifyContent: "space-between",
					paddingBlockStart: "0.375rem",
					borderBlockStart: `2px solid ${BLUE}`,
					color: BLUE,
					fontFamily: MONO,
					fontSize: "0.6875rem",
					letterSpacing: "0.08em",
				})}
			>
				<span>15.04.2027</span>
				<span>Rotterdam</span>
			</span>
		</div>
	);
}
