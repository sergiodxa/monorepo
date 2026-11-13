/**
 * The band where the reader plays Strata Two: the board at the full width of the stage,
 * with a switch toggle above it, sounding every press. The keys still dip under a held
 * pointer before the island loads; the sound arrives with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { SoundBoard } from "~/resources/views/demos/hardware/sound-board";
import { stage, STAGE_CLASS } from "~/resources/views/demos/hardware/stage";

/**
 * Renders the band. The board is the band's whole width, as large as the stage allows, so a
 * key is big enough to hit on a phone held sideways and comfortable with a mouse.
 *
 * @returns The render function producing the band.
 */
export default function PlayBand() {
	return () => (
		<LandingSection
			id="play"
			class={STAGE_CLASS}
			tone="plain"
			spacing="normal"
			align="center"
			mix={[stage()]}
		>
			<LandingHeader
				eyebrow="04 · Hear it"
				align="center"
				description={
					<>
						Click any key, or tap the board and type on your own keyboard.{" "}
						<strong>Pick a switch and hear the difference</strong>: Silk bottoms out round and low,
						Notch ticks at the bump first.
					</>
				}
			>
				Press a key, hear the case
			</LandingHeader>
			<div
				mix={[
					raw({ inlineSize: "min(100%, 76rem)", marginInline: "auto", paddingBlockStart: "1rem" }),
				]}
			>
				<SoundBoard start="silk" />
			</div>
			<p
				mix={[
					raw({
						margin: "1.5rem auto 0",
						maxInlineSize: "40rem",
						textAlign: "center",
						fontSize: "0.8125rem",
						lineHeight: "1.5",
						color: "var(--ui-neutral-fg-muted)",
						textWrap: "pretty",
					}),
				]}
			>
				Sounds are synthesised in your browser to show how the two switches differ, not recorded
				from a board. Turn your volume down before the first press.
			</p>
		</LandingSection>
	);
}
