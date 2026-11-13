/**
 * A strip of blue tape pasted across the poster at a tilt, the day's numbers scrolling along
 * it. It is the page's one moving flourish, and it sits still in a wrapped row for readers who
 * ask for reduced motion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Marquee } from "@sdxc/ui/landing";
import { css } from "remix/component";

import { BLUE, DISPLAY, PAPER, PINK } from "~/resources/views/demos/conference/ink";

/** What the tape says, in the order it scrolls. */
const FACTS = [
	"15.04.2027",
	"Rotterdam",
	"12 talks",
	"2 stages",
	"780 seats",
	"1 party on the quay",
	"Captions on every talk",
	"Vegan lunch",
];

/**
 * Renders the tape: blue stock with paper-coloured type, each fact followed by a pink star.
 *
 * @returns The render function producing the strip.
 */
export default function ConferenceTicker() {
	return () => (
		<div
			aria-label="The day in numbers"
			role="region"
			mix={css({ overflow: "clip", paddingBlock: "2rem" })}
		>
			<div
				mix={css({
					transform: "rotate(-2deg)",
					marginInline: "-2rem",
					paddingBlock: "0.75rem",
					backgroundColor: BLUE,
					color: PAPER,
					fontFamily: DISPLAY,
					fontWeight: "900",
					fontSynthesis: "none",
					fontSize: "clamp(1.75rem, 1.2rem + 2vw, 3rem)",
					lineHeight: "1",
					textTransform: "uppercase",
				})}
			>
				<Marquee duration={36} gap="1.5rem" pauseLabel="Pause the scrolling tape">
					{FACTS.map((fact) => (
						<span
							key={fact}
							mix={css({
								display: "inline-flex",
								alignItems: "center",
								gap: "1.5rem",
								whiteSpace: "nowrap",
							})}
						>
							{fact}
							<span aria-hidden="true" mix={css({ color: PINK })}>
								✶
							</span>
						</span>
					))}
				</Marquee>
			</div>
		</div>
	);
}
