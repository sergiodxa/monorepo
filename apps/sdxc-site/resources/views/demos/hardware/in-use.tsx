/**
 * The third scroll scene: Strata Two at work on a desk, seen close and tilted back, typing a
 * commit message one key at a time as the reader scrolls, under the screen line that fills
 * in with it. At rest the line is complete and every key is up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animationHost, keyframes } from "@sdxc/u/animation";
import { combine, raw } from "@sdxc/u/general";
import { at, media, supports } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { LandingHeader, LandingSection, ScrollScene, sceneMotion } from "@sdxc/ui/landing";

import { Keyboard } from "~/resources/views/demos/hardware/keyboard";
import { stage, STAGE_CLASS } from "~/resources/views/demos/hardware/stage";

/** The scene's timeline name. */
const TIMELINE = "strata-in-use";

/** The line the board types. */
const LINE = "ship it";

/** The board key each character of {@link LINE} presses. */
const STROKES = LINE.split("").map((character) => (character === " " ? "space" : character));

/** Where the typing starts and how much of the scene each stroke takes, in percent. */
const TYPE_START = 10;
const STROKE = 9;

/**
 * The stretch of the scene the screen line types over: from the first key's press to the
 * last's. The text is revealed by clipping and the caret moves by translation, so typing
 * never changes the stage's layout while the reader scrolls it.
 */
const TYPED_RANGE = `contain ${TYPE_START + STROKE * 0.4}% contain ${TYPE_START + STROKES.length * STROKE - STROKE * 0.6}%`;

/** The one dip every key in the scene runs through: down at the middle, up at the end. */
const PRESS = "strata-in-use-press";

/**
 * Presses each key of {@link LINE} in turn along the scene's timeline. The rules sit on the
 * board's wrapper and reach into the drawing by `data-key`, so the drawing stays shared.
 */
function typing() {
	return combine([
		keyframes(PRESS, {
			"0%": { translate: "0 0" },
			"40%": { translate: "0 1.1px" },
			"100%": { translate: "0 0" },
		}),
		supports(
			"(animation-timeline: view())",
			media(
				"(prefers-reduced-motion: no-preference)",
				STROKES.map((key, index) => {
					let start = TYPE_START + index * STROKE;
					return when(
						`& [data-key="${key}"] [data-p=cap-top]`,
						animationHost(PRESS, {
							duration: "auto",
							easing: "linear",
							fillMode: "none",
							timeline: `--${TIMELINE}`,
							range: `contain ${start}% contain ${start + STROKE}%`,
						}),
					);
				}),
			),
		),
	]);
}

/**
 * The window the board is seen through: a close crop of its middle, where every key of
 * {@link LINE} sits down to the space bar, fading out at every edge, so the scene reads as the
 * board on a desk and leaves the whole flat board to the band where the reader plays it.
 */
function deskCrop() {
	return raw({
		inlineSize: "100%",
		aspectRatio: "2.5 / 1",
		position: "relative",
		overflow: "hidden",
		maskImage:
			"linear-gradient(to right, transparent, black 14%, black 86%, transparent), linear-gradient(to top, transparent, black 8%, black 72%, transparent)",
		maskComposite: "intersect",
	});
}

/**
 * The board tilted back as if it lay on the desk and drawn half again as wide, so the crop
 * lands on the letter rows; the typing rules on this wrapper still reach every key.
 */
function deskTilt() {
	return raw({
		position: "absolute",
		insetInlineStart: "50%",
		insetBlockEnd: "-6%",
		inlineSize: "150%",
		translate: "-50% 0",
		transform: "perspective(1400px) rotateX(30deg)",
		transformOrigin: "50% 100%",
	});
}

/** A status reading on the desk beside the board. */
const READINGS = [
	{ label: "Link", value: "2.4 GHz · 1,000 Hz" },
	{ label: "Battery", value: "94% · about 130 h left" },
	{ label: "Layer", value: "Base · macOS" },
];

/**
 * Renders the band on the stage: the screen line, the board under it, and the readings.
 *
 * @returns The render function producing the band.
 */
export default function InUseScene() {
	return () => (
		<LandingSection id="in-use" class={STAGE_CLASS} tone="plain" spacing="normal" mix={[stage()]}>
			<LandingHeader
				eyebrow="03 · In use"
				description={
					<>
						Wired at 4,000 Hz for a match, on the 2.4 GHz receiver for the desk, on Bluetooth for
						the tablet, <strong>switched with Fn and 1, 2 or 3</strong>.
					</>
				}
			>
				Quiet enough for a call, quick enough for a match
			</LandingHeader>
			<ScrollScene timeline={TIMELINE} length={2.2}>
				<div
					role="img"
					aria-label={`Strata Two typing “${LINE}” into a terminal, connected over 2.4 GHz`}
					mix={[
						raw({
							display: "grid",
							gap: "1.5rem",
							justifyItems: "center",
							paddingBlock: "1rem",
							inlineSize: "min(100%, 60rem, (100svh - 12rem) * 2.2)",
							marginInline: "auto",
						}),
					]}
				>
					<div
						aria-hidden="true"
						mix={[
							raw({
								inlineSize: "min(100%, 30rem)",
								paddingBlock: "0.75rem",
								paddingInline: "1rem",
								borderRadius: "10px",
								backgroundColor: "oklch(0.2 0.006 250)",
								boxShadow: "inset 0 0 0 1px var(--ui-landing-hairline)",
								fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
								fontSize: "0.9375rem",
								color: "var(--ui-color-neutral-200)",
								whiteSpace: "nowrap",
								overflow: "hidden",
							}),
						]}
					>
						<span mix={[raw({ color: "var(--ui-color-neutral-500)" })]}>
							~/strata $ git commit -m "
						</span>
						<span
							mix={[
								raw({ display: "inline-block", clipPath: "inset(0 0 0 0)" }),
								sceneMotion(
									TIMELINE,
									{ from: { clipPath: "inset(0 100% 0 0)" }, to: { clipPath: "inset(0 0 0 0)" } },
									TYPED_RANGE,
									`steps(${LINE.length}, end)`,
								),
							]}
						>
							{LINE}
						</span>
						<span
							mix={[
								raw({ display: "inline-block", translate: "0 0" }),
								sceneMotion(
									TIMELINE,
									{ from: { translate: `-${LINE.length}ch 0` }, to: { translate: "0 0" } },
									TYPED_RANGE,
									`steps(${LINE.length}, end)`,
								),
							]}
						>
							"
							<span
								mix={[
									raw({
										display: "inline-block",
										inlineSize: "0.5ch",
										blockSize: "1.1em",
										marginInlineStart: "1px",
										verticalAlign: "text-bottom",
										backgroundColor: "var(--ui-color-brand-500)",
									}),
								]}
							/>
						</span>
					</div>
					<div mix={[deskCrop()]}>
						<div mix={[typing(), deskTilt()]}>
							<Keyboard id="in-use" pressable />
						</div>
					</div>
					<dl
						aria-hidden="true"
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								justifyContent: "center",
								gap: "0.5rem 1.75rem",
								margin: "0",
								fontSize: "0.8125rem",
								fontVariantNumeric: "tabular-nums",
							}),
							at("md", raw({ fontSize: "0.875rem" })),
						]}
					>
						{READINGS.map((reading) => (
							<div key={reading.label} mix={[raw({ display: "flex", gap: "0.5rem" })]}>
								<dt mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>{reading.label}</dt>
								<dd mix={[raw({ margin: "0" })]}>{reading.value}</dd>
							</div>
						))}
					</dl>
				</div>
			</ScrollScene>
		</LandingSection>
	);
}
