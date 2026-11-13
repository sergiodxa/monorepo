/**
 * What comes in Strata Two's box, drawn as the open tray seen from above with every item in
 * its cut-out and a numbered marker beside it, next to the same numbers as a list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { Keyboard } from "~/resources/views/demos/hardware/keyboard";
import { renderNearView } from "~/resources/views/demos/near-view";

/** The box's contents, numbered as the tray's markers are, with where each one sits. */
const CONTENTS: Array<{ name: string; note: string; marker: [x: number, y: number] }> = [
	{ name: "Strata Two", note: "In the finish and layout you ordered", marker: [24, 24] },
	{ name: "Felt sleeve", note: "Wool, cut to the case", marker: [24, 214] },
	{ name: "USB-C cable", note: "Braided, 1.8 m, C to C", marker: [150, 214] },
	{ name: "2.4 GHz receiver", note: "Also stored in a bay under the case", marker: [252, 214] },
	{ name: "USB-A adapter", note: "For the receiver on older ports", marker: [252, 262] },
	{ name: "Puller", note: "Keycaps one end, switches the other", marker: [322, 214] },
	{ name: "Four spare switches", note: "Of the kind you chose", marker: [322, 262] },
	{ name: "Start card", note: "Shortcuts and your board's serial", marker: [150, 262] },
];

/** Shared fill for the tray's cut-outs, a step darker than the tray. */
const CUTOUT = "oklch(0.3 0.006 250)";

/**
 * The tray drawing: board at the top, the small parts in a row of cut-outs under it. The
 * board is the page's shared drawing, so it wears the chosen finish here too.
 *
 * @returns The render function producing the tray.
 */
function Tray() {
	return () => (
		<div
			role="img"
			aria-label="The open box from above: the keyboard on top, and below it the sleeve, cable, card, receiver, adapter, puller and spare switches"
			mix={[
				raw({
					position: "relative",
					aspectRatio: "400 / 300",
					borderRadius: "var(--ui-landing-card-radius-outer)",
					backgroundColor: "oklch(0.2 0.005 250)",
					boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.08), 0 30px 60px -30px oklch(0 0 0 / 0.5)",
					overflow: "clip",
				}),
			]}
		>
			<div
				mix={[
					raw({
						position: "absolute",
						insetBlockStart: "11%",
						insetInlineStart: "11%",
						inlineSize: "78%",
					}),
				]}
			>
				<Keyboard id="box" />
			</div>
			<svg
				viewBox="0 0 400 300"
				aria-hidden="true"
				mix={[raw({ position: "absolute", inset: "0", inlineSize: "100%", blockSize: "100%" })]}
			>
				<rect x="36" y="200" width="100" height="84" rx="6" fill={CUTOUT} />
				<rect x="42" y="206" width="88" height="72" rx="4" fill="oklch(0.42 0.006 250)" />
				<path
					d="M42 222 h88 M42 238 h88 M42 254 h88 M42 270 h88"
					stroke="oklch(0.48 0.006 250)"
					stroke-width="0.6"
				/>
				<rect x="142" y="200" width="98" height="40" rx="6" fill={CUTOUT} />
				<g fill="none" stroke="oklch(0.75 0.005 250)" stroke-width="3">
					<ellipse cx="191" cy="220" rx="30" ry="12" />
					<ellipse cx="191" cy="220" rx="22" ry="8" />
				</g>
				<rect x="142" y="246" width="98" height="38" rx="6" fill={CUTOUT} />
				<rect x="152" y="252" width="78" height="26" rx="2" fill="oklch(0.95 0.003 250)" />
				<rect x="160" y="258" width="34" height="3" fill="oklch(0.3 0.01 250)" />
				<rect x="160" y="265" width="52" height="2" fill="oklch(0.6 0.01 250)" />
				<rect x="160" y="270" width="44" height="2" fill="oklch(0.6 0.01 250)" />
				<rect x="246" y="200" width="66" height="40" rx="6" fill={CUTOUT} />
				<rect x="262" y="213" width="24" height="12" rx="2" fill="oklch(0.18 0.004 250)" />
				<rect x="286" y="215" width="10" height="8" fill="oklch(0.78 0.005 250)" />
				<rect x="246" y="246" width="66" height="38" rx="6" fill={CUTOUT} />
				<rect x="266" y="259" width="18" height="12" rx="3" fill="oklch(0.78 0.005 250)" />
				<rect x="284" y="261" width="8" height="8" fill="oklch(0.6 0.005 250)" />
				<rect x="318" y="200" width="56" height="40" rx="6" fill={CUTOUT} />
				<path
					d="M330 212 l14 10 l14 -10 M344 222 v10"
					stroke="oklch(0.78 0.005 250)"
					stroke-width="3"
					fill="none"
					stroke-linecap="round"
				/>
				<rect x="318" y="246" width="56" height="38" rx="6" fill={CUTOUT} />
				{[0, 1, 2, 3].map((index) => (
					<g key={index}>
						<rect
							x={326 + index * 11}
							y="258"
							width="9"
							height="9"
							rx="1.5"
							fill="oklch(0.93 0.004 250 / 0.9)"
						/>
						<rect
							x={329 + index * 11}
							y="261"
							width="3"
							height="3"
							fill="var(--ui-color-brand-500)"
						/>
					</g>
				))}
				{CONTENTS.map((item, index) => (
					<g key={item.name}>
						<circle
							cx={item.marker[0]}
							cy={item.marker[1]}
							r="7"
							fill="var(--ui-color-neutral-50)"
						/>
						<text
							x={item.marker[0]}
							y={item.marker[1] + 3}
							text-anchor="middle"
							mix={[
								raw({
									fill: "var(--ui-color-neutral-950)",
									fontSize: "8.5px",
									fontWeight: "700",
									fontFamily: "var(--ui-font-sans)",
								}),
							]}
						>
							{index + 1}
						</text>
					</g>
				))}
			</svg>
		</div>
	);
}

/**
 * Renders the band: the tray beside the numbered list from the `lg` container up, stacked
 * on a phone with the drawing first.
 *
 * @returns The render function producing the band.
 */
export default function InTheBox() {
	return () => (
		<LandingSection id="box" tone="tinted" spacing="normal" mix={[renderNearView(730, 1027)]}>
			<LandingHeader
				eyebrow="07 · In the box"
				description="Nothing to buy on the day it arrives: the cable, the receiver and the tools to change a switch are in the tray."
			>
				Eight things, each in its own cut-out
			</LandingHeader>
			<div
				mix={[
					raw({ display: "grid", gap: "2rem", alignItems: "center", paddingBlockStart: "1rem" }),
					at("lg", raw({ gridTemplateColumns: "3fr 2fr", gap: "4rem" })),
				]}
			>
				<Tray />
				<ol
					mix={[
						raw({
							margin: "0",
							padding: "0",
							listStyle: "none",
							display: "grid",
							gap: "1rem 1.5rem",
							counterReset: "box",
						}),
						at("md", raw({ gridTemplateColumns: "1fr 1fr" })),
						at("lg", raw({ gridTemplateColumns: "1fr" })),
					]}
				>
					{CONTENTS.map((item, index) => (
						<li
							key={item.name}
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "1.5rem 1fr",
									columnGap: "0.75rem",
									alignItems: "baseline",
								}),
							]}
						>
							<span
								aria-hidden="true"
								mix={[
									raw({
										display: "grid",
										placeItems: "center",
										inlineSize: "1.375rem",
										blockSize: "1.375rem",
										borderRadius: "9999px",
										fontSize: "0.75rem",
										fontWeight: "700",
										backgroundColor: "var(--ui-neutral-fg-emphasis)",
										color: "var(--ui-bg)",
										fontVariantNumeric: "tabular-nums",
									}),
								]}
							>
								{index + 1}
							</span>
							<span mix={[raw({ fontWeight: "600" })]}>{item.name}</span>
							<span
								mix={[
									raw({
										gridColumn: "2",
										fontSize: "0.875rem",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								{item.note}
							</span>
						</li>
					))}
				</ol>
			</div>
		</LandingSection>
	);
}
