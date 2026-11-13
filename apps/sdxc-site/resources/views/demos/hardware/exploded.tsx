/**
 * The first scroll scene: Strata Two assembled, then pulled apart into its eight layers as
 * the reader scrolls, with a legend naming each one. The layers are flat drawings stacked
 * in CSS 3D, so the board comes apart along its own depth rather than as a canned picture.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { KEYBOARD_VIEW, KEYS } from "~/resources/views/demos/hardware/keyboard";
import { ScrollScene, sceneMotion } from "~/resources/views/demos/hardware/scroll-scene";
import { stage, STAGE_CLASS } from "~/resources/views/demos/hardware/stage";

/** The scene's timeline name. */
const TIMELINE = "strata-explode";

/** One layer of the board, top first: its name, what it is, and its drawing. */
interface Layer {
	name: string;
	detail: string;
	swatch: string;
	Drawing: () => () => RemixNode;
}

/** The plane every layer is drawn on: the board's footprint, so the layers register. */
function Plane(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<svg
			viewBox={`0 0 ${KEYBOARD_VIEW.width} ${KEYBOARD_VIEW.height}`}
			aria-hidden="true"
			mix={[raw({ display: "block", inlineSize: "100%", blockSize: "auto", overflow: "visible" })]}
		>
			{handle.props.children}
		</svg>
	);
}

/** Each keycap role's colour, in the chosen finish. */
const CAP_FILL: Record<string, string> = {
	accent: "var(--ui-color-brand-500)",
	mod: "var(--strata-mod-hi)",
	alpha: "var(--strata-cap-hi)",
};

/** Keycaps alone, in the chosen finish. */
function CapsLayer() {
	return () => (
		<Plane>
			{KEYS.filter((key) => key.role !== "knob").map((key) => (
				<rect
					key={`${key.x}-${key.y}`}
					x={key.x + 1}
					y={key.y + 1}
					width={key.width * 20 - 2}
					height="18"
					rx="2.2"
					mix={[
						raw({
							fill: CAP_FILL[key.role],
							stroke: "oklch(0 0 0 / 0.25)",
							strokeWidth: "0.4",
						}),
					]}
				/>
			))}
		</Plane>
	);
}

/** Switch housings: clear tops over dark bases, one per key, centred under each cap. */
function SwitchLayer() {
	return () => (
		<Plane>
			{KEYS.filter((key) => key.role !== "knob").map((key) => {
				let cx = key.x + key.width * 10;
				let cy = key.y + 10;
				return (
					<g key={`${key.x}-${key.y}`}>
						<rect
							x={cx - 7}
							y={cy - 7}
							width="14"
							height="14"
							rx="1.5"
							mix={[raw({ fill: "oklch(0.93 0.005 250 / 0.85)" })]}
						/>
						<rect
							x={cx - 2}
							y={cy - 2}
							width="4"
							height="4"
							mix={[raw({ fill: "var(--ui-color-brand-500)" })]}
						/>
					</g>
				);
			})}
		</Plane>
	);
}

/** The plate: brushed aluminium with a cut-out under every switch and two flex slots. */
function PlateLayer() {
	return () => (
		<Plane>
			<rect
				x="9"
				y="9"
				width={KEYBOARD_VIEW.width - 18}
				height={KEYBOARD_VIEW.height - 18}
				rx="3"
				mix={[raw({ fill: "oklch(0.8 0.006 250)", stroke: "white", strokeWidth: "0.5" })]}
			/>
			{KEYS.filter((key) => key.role !== "knob").map((key) => (
				<rect
					key={`${key.x}-${key.y}`}
					x={key.x + key.width * 10 - 7}
					y={key.y + 3}
					width="14"
					height="14"
					mix={[raw({ fill: "oklch(0.32 0.006 250)" })]}
				/>
			))}
			{[110, 230].map((x) => (
				<rect
					key={x}
					x={x}
					y="40"
					width="3"
					height="70"
					rx="1.5"
					mix={[raw({ fill: "oklch(0.32 0.006 250)" })]}
				/>
			))}
		</Plane>
	);
}

/** Eight gasket points around the plate's edge, the only contact between plate and case. */
function GasketLayer() {
	let points = [
		[30, 6],
		[150, 6],
		[270, 6],
		[30, KEYBOARD_VIEW.height - 10],
		[150, KEYBOARD_VIEW.height - 10],
		[270, KEYBOARD_VIEW.height - 10],
		[4, 70],
		[KEYBOARD_VIEW.width - 8, 70],
	];
	return () => (
		<Plane>
			<rect
				x="9"
				y="9"
				width={KEYBOARD_VIEW.width - 18}
				height={KEYBOARD_VIEW.height - 18}
				rx="3"
				mix={[
					raw({
						fill: "none",
						stroke: "oklch(0.8 0.006 250 / 0.35)",
						strokeWidth: "0.6",
						strokeDasharray: "3 3",
					}),
				]}
			/>
			{points.map(([x = 0, y = 0]) => (
				<rect
					key={`${x}-${y}`}
					x={x}
					y={y}
					width={y > 20 && y < 100 ? 4 : 44}
					height={y > 20 && y < 100 ? 22 : 4}
					rx="1.5"
					mix={[
						raw({
							fill: "oklch(0.3 0.01 250)",
							stroke: "oklch(0.55 0.01 250)",
							strokeWidth: "0.5",
						}),
					]}
				/>
			))}
		</Plane>
	);
}

/** The circuit board: dark solder mask, a hot-swap socket pair under every key, the controller. */
function PcbLayer() {
	return () => (
		<Plane>
			<rect
				x="10"
				y="10"
				width={KEYBOARD_VIEW.width - 20}
				height={KEYBOARD_VIEW.height - 20}
				rx="3"
				mix={[raw({ fill: "oklch(0.3 0.035 200)" })]}
			/>
			{KEYS.filter((key) => key.role !== "knob").map((key) => (
				<g key={`${key.x}-${key.y}`} mix={[raw({ fill: "oklch(0.78 0.11 85)" })]}>
					<circle cx={key.x + key.width * 10 - 3} cy={key.y + 8} r="1.3" />
					<circle cx={key.x + key.width * 10 + 3} cy={key.y + 11} r="1.3" />
				</g>
			))}
			<rect
				x="160"
				y="56"
				width="22"
				height="22"
				rx="1"
				mix={[raw({ fill: "oklch(0.18 0.01 250)" })]}
			/>
		</Plane>
	);
}

/** The foam that fills the case under the board, cut around the battery. */
function FoamLayer() {
	return () => (
		<Plane>
			<rect
				x="11"
				y="11"
				width={KEYBOARD_VIEW.width - 22}
				height={KEYBOARD_VIEW.height - 22}
				rx="3"
				mix={[raw({ fill: "oklch(0.42 0.01 250 / 0.85)" })]}
			/>
			<rect
				x="230"
				y="40"
				width="80"
				height="46"
				rx="3"
				mix={[raw({ fill: "oklch(0.2 0.006 250)" })]}
			/>
		</Plane>
	);
}

/** The brass weight that sits in the floor of the case, under the foam. */
function WeightLayer() {
	return () => (
		<Plane>
			<rect
				x="40"
				y="100"
				width={KEYBOARD_VIEW.width - 80}
				height="34"
				rx="4"
				mix={[
					raw({
						fill: "oklch(0.72 0.1 80)",
						stroke: "oklch(0.88 0.08 85)",
						strokeWidth: "0.6",
					}),
				]}
			/>
		</Plane>
	);
}

/** The case: one block, its floor and walls seen from above. */
function CaseLayer() {
	return () => (
		<Plane>
			<rect
				x="0"
				y="0"
				width={KEYBOARD_VIEW.width}
				height={KEYBOARD_VIEW.height}
				rx="9"
				mix={[
					raw({
						fill: "var(--strata-case-hi)",
						stroke: "var(--strata-chamfer)",
						strokeWidth: "0.6",
					}),
				]}
			/>
			<rect
				x="8"
				y="8"
				width={KEYBOARD_VIEW.width - 16}
				height={KEYBOARD_VIEW.height - 16}
				rx="4"
				mix={[raw({ fill: "var(--strata-case-lo)" })]}
			/>
		</Plane>
	);
}

/** The layers, top first, as the legend lists them. */
const LAYERS: Layer[] = [
	{
		name: "Keycaps",
		detail: "Double-shot PBT, 1.5 mm walls",
		swatch: "var(--strata-cap-hi)",
		Drawing: CapsLayer,
	},
	{
		name: "Switches",
		detail: "Silk linear or Notch tactile, hot-swap",
		swatch: "oklch(0.93 0.005 250)",
		Drawing: SwitchLayer,
	},
	{
		name: "Plate",
		detail: "1.5 mm aluminium, two flex cuts",
		swatch: "oklch(0.8 0.006 250)",
		Drawing: PlateLayer,
	},
	{
		name: "Gaskets",
		detail: "Eight Poron points, no screws through the plate",
		swatch: "oklch(0.3 0.01 250)",
		Drawing: GasketLayer,
	},
	{
		name: "Circuit board",
		detail: "4,000 Hz wired, south-facing sockets",
		swatch: "oklch(0.3 0.035 200)",
		Drawing: PcbLayer,
	},
	{
		name: "Case foam",
		detail: "Poron, cut around the 4,000 mAh cell",
		swatch: "oklch(0.42 0.01 250)",
		Drawing: FoamLayer,
	},
	{
		name: "Brass weight",
		detail: "380 g, machined and set in the floor",
		swatch: "oklch(0.72 0.1 80)",
		Drawing: WeightLayer,
	},
	{
		name: "Case",
		detail: "One block of 6063 aluminium, 3 h on the mill",
		swatch: "var(--strata-case-hi)",
		Drawing: CaseLayer,
	},
];

/**
 * Renders the band: the header in normal flow, then the scene. Each layer sits at its
 * exploded depth at rest, which is the static frame; the scroll timeline starts every
 * layer at depth zero, so the board reads assembled first and opens as the reader scrolls.
 *
 * @returns The render function producing the band.
 */
export default function ExplodedScene() {
	return () => (
		<LandingSection id="design" class={STAGE_CLASS} tone="plain" spacing="normal" mix={[stage()]}>
			<LandingHeader
				eyebrow="01 · Inside"
				description={
					<>
						Plate, board and foam float on eight gaskets inside a case cut from one block,{" "}
						<strong>so every key lands on the same soft stop</strong>, at the edges as in the
						middle.
					</>
				}
			>
				Eight layers, one block around them
			</LandingHeader>
			<ScrollScene timeline={TIMELINE} length={2.6}>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "1.5rem",
							alignItems: "center",
							paddingBlock: "1rem",
						}),
						at("lg", raw({ gridTemplateColumns: "minmax(14rem, 1fr) 2fr", gap: "3rem" })),
					]}
				>
					<ol
						aria-label="The layers of Strata Two, top to bottom"
						mix={[
							raw({
								listStyle: "none",
								margin: "0",
								padding: "0",
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: "0.75rem 1rem",
								order: "2",
							}),
							at("lg", raw({ gridTemplateColumns: "1fr", order: "0", gap: "1rem" })),
						]}
					>
						{LAYERS.map((layer, index) => (
							<li
								key={layer.name}
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "0.625rem 1fr",
										alignContent: "start",
										columnGap: "0.625rem",
										alignItems: "baseline",
									}),
									sceneMotion(
										TIMELINE,
										{ from: { opacity: "0.35" }, to: { opacity: "1" } },
										`contain ${8 + index * 7}% contain ${14 + index * 7}%`,
									),
								]}
							>
								<span
									aria-hidden="true"
									mix={[
										raw({
											inlineSize: "0.625rem",
											blockSize: "0.625rem",
											borderRadius: "2px",
											backgroundColor: layer.swatch,
											boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.25)",
										}),
									]}
								/>
								<span mix={[raw({ fontSize: "0.9375rem", fontWeight: "600" })]}>{layer.name}</span>
								<span
									mix={[
										raw({
											gridColumn: "2",
											fontSize: "0.8125rem",
											lineHeight: "1.35",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									{layer.detail}
								</span>
							</li>
						))}
					</ol>
					<div
						role="img"
						aria-label="Strata Two pulled apart into its eight layers, keycaps on top and the aluminium case at the bottom"
						mix={[
							raw({
								containerType: "inline-size",
								inlineSize: "min(100%, 40rem, (100svh - 7rem) * 1.11)",
								justifySelf: "center",
								aspectRatio: "10 / 9",
								display: "grid",
								placeItems: "center",
							}),
						]}
					>
						<div
							mix={[
								raw({
									position: "relative",
									inlineSize: "54cqi",
									aspectRatio: `${KEYBOARD_VIEW.width} / ${KEYBOARD_VIEW.height}`,
									transformStyle: "preserve-3d",
									transform: "translateY(30cqi) rotateX(60deg) rotateZ(-34deg)",
								}),
							]}
						>
							{[...LAYERS].reverse().map((layer, depth) => (
								<div
									key={layer.name}
									mix={[
										raw({
											position: "absolute",
											inset: "0",
											translate: `0 0 ${depth * 9}cqi`,
											filter: depth === 0 ? "drop-shadow(0 2cqi 3cqi oklch(0 0 0 / 0.6))" : "none",
										}),
										sceneMotion(
											TIMELINE,
											{
												from: { translate: `0 0 ${depth * 0.6}cqi` },
												to: { translate: `0 0 ${depth * 9}cqi` },
											},
											"contain 4% contain 72%",
										),
									]}
								>
									<layer.Drawing />
								</div>
							))}
						</div>
					</div>
				</div>
			</ScrollScene>
		</LandingSection>
	);
}
