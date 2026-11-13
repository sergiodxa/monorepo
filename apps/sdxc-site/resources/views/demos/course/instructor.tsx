/**
 * The instructor band: a drawn portrait of Ines at her wheel, why she teaches the way the
 * course does, and three facts about her that a student can check against the lessons.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { AuthorBand } from "@sdxc/ui/landing";

import { renderNearView } from "~/resources/views/demos/near-view";

/** What Ines has done, in her own order. */
const CREDENTIALS = [
	"Throws production ware for four restaurants in Porto",
	"Has taught the Tuesday beginners' class for eleven years",
	"Filmed every lesson twice: over the wheel and from the side",
] as const;

/**
 * Ines at the wheel, drawn flat in the page's own colours: lamp, head and shoulders,
 * forearms down to a dome of clay.
 *
 * @returns The render function producing the portrait.
 */
function Portrait() {
	return () => (
		<svg
			viewBox="0 0 300 400"
			role="img"
			aria-label="An illustration of Ines Duarte at her potter's wheel under a lamp"
			mix={[raw({ display: "block", inlineSize: "100%", blockSize: "100%" })]}
		>
			<rect width="300" height="400" fill="var(--ui-brand-bg-tint)" />
			<circle cx="230" cy="70" r="120" fill="var(--ui-color-brand-200)" opacity="0.6" />
			<path d="M206 0v40" stroke="var(--ui-neutral-fg-emphasis)" stroke-width="2" />
			<path d="M186 40h40l12 26h-64Z" fill="var(--ui-neutral-fg-emphasis)" />
			<path d="M60 400c4-96 44-150 90-150s86 54 90 150Z" fill="var(--ui-color-brand-700)" />
			<path
				d="M92 300c-14 34-12 62 30 70l26-20"
				fill="none"
				stroke="oklch(0.74 0.06 50)"
				stroke-width="18"
				stroke-linecap="round"
			/>
			<path
				d="M208 300c14 34 12 62-30 70l-26-20"
				fill="none"
				stroke="oklch(0.74 0.06 50)"
				stroke-width="18"
				stroke-linecap="round"
			/>
			<rect x="137" y="214" width="26" height="42" fill="oklch(0.66 0.07 50)" />
			<ellipse cx="150" cy="176" rx="40" ry="48" fill="oklch(0.74 0.06 50)" />
			<circle cx="150" cy="114" r="17" fill="oklch(0.28 0.03 40)" />
			<path
				d="M110 172c-5-36 15-54 40-54s45 18 40 54c-6-20-22-32-40-32s-34 12-40 32Z"
				fill="oklch(0.28 0.03 40)"
			/>
			<g fill="none" stroke="oklch(0.28 0.03 40)" stroke-width="3" stroke-linecap="round">
				<path d="M131 180q6 4 12 0" />
				<path d="M157 180q6 4 12 0" />
				<path d="M142 202q8 5 16 0" />
			</g>
			<ellipse cx="150" cy="384" rx="70" ry="10" fill="oklch(0.36 0.008 60)" />
			<path d="M118 382c0-22 14-32 32-32s32 10 32 32Z" fill="oklch(0.56 0.12 42)" />
		</svg>
	);
}

/**
 * Renders the band from {@link AuthorBand}, with Ines's facts as a ruled list.
 *
 * @returns The render function producing the band.
 */
export function CourseInstructor() {
	return () => (
		<AuthorBand
			id="instructor"
			tone="tinted"
			mix={[renderNearView(605, 1065)]}
			portrait={<Portrait />}
			eyebrow="Your instructor"
			title="Taught by a potter who still throws every day"
			description={
				<>
					Ines Duarte has run a production studio for fifteen years. She teaches the way she
					learned: <strong>slowly, in order, and with the mistakes left in</strong>, so you see what
					a wobble looks like before you meet your own.
				</>
			}
			credentials={
				<ul
					mix={[
						raw({
							margin: "0",
							padding: "0",
							listStyle: "none",
							borderBlockStart: "1px solid var(--ui-landing-hairline)",
							color: "var(--ui-neutral-fg)",
						}),
						when(
							"& > li",
							raw({
								paddingBlock: "0.75rem",
								borderBlockEnd: "1px solid var(--ui-landing-hairline)",
							}),
						),
					]}
				>
					{CREDENTIALS.map((line) => (
						<li key={line}>{line}</li>
					))}
				</ul>
			}
			name="Ines Duarte"
			jobTitle="Potter, Porto"
		/>
	);
}
