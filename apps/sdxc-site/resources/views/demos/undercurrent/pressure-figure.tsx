/**
 * The letter's one figure: the Linden Hill tower and a tall building beside it, with the
 * water level at night and the lower pressure line at seven in the morning, so the gap
 * the letter talks about is measured on the drawing rather than described.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";

/** The street the tower and the building stand on, in drawing units. */
const STREET = 250;

/** Drawing units per metre of height. */
const SCALE = 4.5;

/** Height above the street, in metres, as a drawing coordinate. */
function y(metres: number): number {
	return STREET - metres * SCALE;
}

/** The building's storeys, three metres each, the ninth holding the tap. */
const FLOORS = Array.from({ length: 10 }, (_, index) => index);

/**
 * Renders the drawing in the ink and muted tones of the page, with the essential reading
 * in the caption too, so a phone reader who cannot make out the labels still has it.
 *
 * @returns The render function producing the figure.
 */
export default function PressureFigure() {
	return () => (
		<figure mix={[m(0), raw({ marginBlock: "2.25rem" })]}>
			<svg
				viewBox="0 0 480 280"
				role="img"
				aria-label="The tower's water stands 40 metres above the street. A ninth-floor tap 27 metres up keeps 13 metres of head at night and about 6 at seven in the morning."
				mix={[raw({ display: "block", inlineSize: "100%", blockSize: "auto" })]}
			>
				<g fill="none" stroke="var(--ui-neutral-fg-emphasis)" stroke-width="1.5">
					<path d={`M8 ${STREET}H472`} />
					<path d={`M54 ${STREET}L66 ${y(31)}M126 ${STREET}L114 ${y(31)}M60 ${y(15)}H120`} />
					<rect x="52" y={y(40) - 6} width="76" height={y(31) - y(40) + 6} rx="3" />
				</g>
				<rect
					x="53"
					y={y(40)}
					width="74"
					height={y(31) - y(40) - 1}
					fill="var(--ui-brand-fg)"
					opacity="0.18"
				/>
				<g stroke="var(--ui-neutral-fg-emphasis)" stroke-width="1.5" fill="var(--ui-bg)">
					<rect x="300" y={y(30)} width="72" height={30 * SCALE} />
				</g>
				<g stroke="var(--ui-landing-hairline)" stroke-width="1">
					{FLOORS.slice(1).map((floor) => (
						<path key={floor} d={`M301 ${y(floor * 3)}H371`} />
					))}
				</g>
				<circle cx="336" cy={y(27)} r="4" fill="var(--ui-brand-fg)" />
				<g stroke-width="1.5" fill="none">
					<path d={`M128 ${y(40)}H400`} stroke="var(--ui-brand-fg)" />
					<path
						d={`M128 ${y(40)}L400 ${y(33)}`}
						stroke="var(--ui-neutral-fg-muted)"
						stroke-dasharray="5 4"
					/>
				</g>
				<g stroke="var(--ui-neutral-fg-muted)" stroke-width="1" fill="none">
					<path d={`M436 ${y(27)}H442V${y(40)}H436`} />
					<path d={`M404 ${y(27)}H410V${y(33)}H404`} />
				</g>
				<g fill="var(--ui-neutral-fg)" font-size="13" font-family="inherit">
					<text x="128" y={y(40) - 10}>
						Water level, night
					</text>
					<text x="200" y={y(36) + 22} fill="var(--ui-neutral-fg-muted)">
						At 7 a.m.
					</text>
					<text x="90" y={STREET + 20} text-anchor="middle">
						Tower
					</text>
					<text x="336" y={STREET + 20} text-anchor="middle">
						Ninth-floor tap
					</text>
					<text x="446" y={y(33.5) + 4}>
						13 m
					</text>
					<text x="414" y={y(30) + 4} fill="var(--ui-neutral-fg-muted)">
						6 m
					</text>
				</g>
			</svg>
			<figcaption mix={[text("sm"), fg("neutral.muted"), raw({ marginBlockStart: "0.75rem" })]}>
				The tower’s water stands 40 m above the street. A tap 27 m up keeps 13 m of head at night
				and about 6 m at seven in the morning, when the hill showers at once.
			</figcaption>
		</figure>
	);
}
