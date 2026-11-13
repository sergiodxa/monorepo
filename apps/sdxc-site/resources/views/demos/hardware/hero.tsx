/**
 * Strata Two's opening on the dark stage: the claim, the preorder with its price and batch,
 * and the board itself at full width under a single raking light, which sweeps across the
 * case once on load for a reader who allows motion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { media } from "@sdxc/u/responsive";
import { Link, LinkButton } from "@sdxc/ui";
import { LandingHero } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import { Keyboard } from "~/resources/views/demos/hardware/keyboard";
import { PREORDER } from "~/resources/views/demos/hardware/preorder-data";
import { stage, STAGE_CLASS } from "~/resources/views/demos/hardware/stage";

/**
 * Renders the hero. The stage is dark in both colour schemes, as a product photographed on
 * black would be; the light is a soft ellipse behind the board and a highlight on its
 * chamfer, so the case reads as metal without a photograph.
 *
 * @returns The render function producing the hero band.
 */
export default function Hero() {
	return () => (
		<div class={STAGE_CLASS} mix={[stage()]}>
			<LandingHero
				id="top"
				tone="plain"
				align="center"
				mediaPlacement="below"
				entrance
				eyebrow={`Strata Two · Batch ${PREORDER.batch} open`}
				title="Milled from one block, tuned to every key"
				description={
					<>
						A 75% keyboard in a case cut from a single block of aluminium, its plate floating on
						eight gaskets, <strong>so the corner keys sound and feel like the middle ones</strong>.
					</>
				}
				actions={
					<>
						<LinkButton href="#preorder" color="brand" mix={[landingCtaChrome()]}>
							Preorder — {PREORDER.price}
						</LinkButton>
						<Link href="#design" color="neutral" mix={[raw({ fontWeight: "500" })]}>
							See it come apart
						</Link>
					</>
				}
				note={`${PREORDER.deposit} deposit, refundable until it ships. Batch ${PREORDER.batch} ships ${PREORDER.ships}.`}
				media={<HeroStage />}
			/>
		</div>
	);
}

/**
 * The board under its light: a radial glow on the stage floor, the board, and a reflection
 * fading below it. The glow and a sheen across the case play once on load.
 *
 * @returns The render function producing the stage.
 */
function HeroStage() {
	return () => (
		<div
			mix={[
				raw({
					position: "relative",
					inlineSize: "min(100%, 68rem)",
					marginInline: "auto",
					paddingBlock: "2rem 3rem",
					isolation: "isolate",
				}),
			]}
		>
			<div
				aria-hidden="true"
				mix={[
					raw({
						position: "absolute",
						inset: "-10% -15% -20%",
						zIndex: "-1",
						background:
							"radial-gradient(50% 45% at 50% 45%, oklch(0.5 0.004 250 / 0.55), oklch(0.3 0.004 250 / 0.2) 55%, transparent 75%)",
					}),
					media(
						"(prefers-reduced-motion: no-preference)",
						animation({
							keyframes: { from: { opacity: "0" }, to: { opacity: "1" } },
							duration: "1.6s",
							easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
							fillMode: "both",
						}),
					),
				]}
			/>
			<div
				mix={[
					raw({
						position: "relative",
						filter: "drop-shadow(0 2.5rem 2.5rem oklch(0 0 0 / 0.55))",
						overflow: "clip",
						borderRadius: "2.6%/5.8%",
					}),
				]}
			>
				<Keyboard id="hero" label="Strata Two seen from above, in the finish you have chosen" />
				<span
					aria-hidden="true"
					mix={[
						raw({
							position: "absolute",
							inset: "0",
							pointerEvents: "none",
							background:
								"linear-gradient(105deg, transparent 35%, oklch(1 0 0 / 0.2) 48%, transparent 60%)",
							translate: "120% 0",
						}),
						media(
							"(prefers-reduced-motion: no-preference)",
							animation({
								keyframes: { from: { translate: "-120% 0" }, to: { translate: "120% 0" } },
								duration: "2.2s",
								delay: "0.4s",
								easing: "cubic-bezier(0.45, 0, 0.2, 1)",
								fillMode: "both",
							}),
						),
					]}
				/>
			</div>
		</div>
	);
}
