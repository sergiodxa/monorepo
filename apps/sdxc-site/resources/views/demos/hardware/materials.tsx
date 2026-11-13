/**
 * The second scroll scene: the three materials Strata Two is made of, each a swatch of the
 * real surface with its one figure, lit in turn by a light that rakes across it as the
 * reader scrolls. At rest every swatch is lit and in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { ScrollScene, sceneMotion } from "~/resources/views/demos/hardware/scroll-scene";

/** The scene's timeline name. */
const TIMELINE = "strata-materials";

/** One material: its name, its figure, why it was chosen, and the surface that shows it. */
interface Material {
	name: string;
	figure: string;
	unit: string;
	why: string;
	Surface: () => () => RemixNode;
}

/**
 * Bead-blasted aluminium in the chosen finish: a fine stipple over the case colour, which
 * is what the blasting leaves before the anodising seals it.
 */
function AluminiumSurface() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					background:
						"radial-gradient(circle at 30% 20%, oklch(1 0 0 / 0.08) 0.5px, transparent 1px) 0 0 / 3px 3px, radial-gradient(circle at 70% 60%, oklch(0 0 0 / 0.1) 0.5px, transparent 1px) 0 0 / 4px 4px, linear-gradient(160deg, var(--strata-case-hi), var(--strata-case-lo))",
				}),
			]}
		/>
	);
}

/** One keycap in close-up: the skirt, the dish, and the double-shot legend through the wall. */
function KeycapSurface() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					placeItems: "center",
					background: "linear-gradient(160deg, var(--strata-case-hi), var(--strata-case-lo))",
				}),
			]}
		>
			<svg viewBox="0 0 100 100" aria-hidden="true" mix={[raw({ inlineSize: "58%" })]}>
				<rect
					x="6"
					y="10"
					width="88"
					height="84"
					rx="12"
					mix={[raw({ fill: "var(--strata-cap-lo)" })]}
				/>
				<rect
					x="16"
					y="14"
					width="68"
					height="62"
					rx="10"
					mix={[raw({ fill: "var(--strata-cap-hi)" })]}
				/>
				<text
					x="26"
					y="48"
					mix={[
						raw({
							fill: "var(--strata-legend)",
							fontFamily: "var(--ui-font-sans)",
							fontSize: "26px",
							fontWeight: "500",
						}),
					]}
				>
					S
				</text>
			</svg>
		</div>
	);
}

/** Machined brass with the serial engraved on it, as it sits in the floor of the case. */
function BrassSurface() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					placeItems: "end start",
					padding: "1rem",
					background:
						"repeating-linear-gradient(90deg, oklch(1 0 0 / 0.05) 0 1px, transparent 1px 3px), linear-gradient(150deg, oklch(0.82 0.1 85), oklch(0.6 0.1 70) 55%, oklch(0.5 0.085 60))",
				}),
			]}
		>
			<span
				mix={[
					raw({
						fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
						fontSize: "0.75rem",
						letterSpacing: "0.2em",
						color: "oklch(0.38 0.07 60)",
						textShadow: "0 1px 0 oklch(0.9 0.08 85 / 0.6)",
					}),
				]}
			>
				STRATA · 03 · 0847
			</span>
		</div>
	);
}

/** The materials, in the order the light reaches them. */
const MATERIALS: Material[] = [
	{
		name: "6063 aluminium",
		figure: "1.28",
		unit: "kg",
		why: "Bead-blasted to an even matte, then anodised 15 µm deep so the finish wears with the metal.",
		Surface: AluminiumSurface,
	},
	{
		name: "Double-shot PBT",
		figure: "1.5",
		unit: "mm walls",
		why: "The legend is a second plastic moulded through the cap, so it cannot rub off or shine.",
		Surface: KeycapSurface,
	},
	{
		name: "Brass weight",
		figure: "380",
		unit: "g",
		why: "Set low in the case, it keeps the board planted and takes the hollow ring out of every stroke.",
		Surface: BrassSurface,
	},
];

namespace Swatch {
	export interface Props {
		material: Material;
		index: number;
	}
}

/**
 * One material: its surface under a light band that sweeps across it as the scene reaches
 * it, and its figure and reason beneath.
 *
 * @param handle Runtime handle carrying the material and its order.
 * @returns The render function producing the swatch.
 */
function Swatch(handle: Handle<Swatch.Props>) {
	return () => {
		let { material, index } = handle.props;
		let start = 6 + index * 22;
		return (
			<figure
				mix={[
					raw({
						margin: "0",
						display: "grid",
						gridTemplateColumns: "6.5rem minmax(0, 1fr)",
						gap: "1rem",
						alignItems: "center",
					}),
					at("md", raw({ gridTemplateColumns: "minmax(0, 1fr)", alignItems: "start" })),
					sceneMotion(
						TIMELINE,
						{
							from: { opacity: "0.25", translate: "0 2rem" },
							to: { opacity: "1", translate: "0 0" },
						},
						`contain ${start}% contain ${start + 16}%`,
					),
				]}
			>
				<div
					aria-hidden="true"
					mix={[
						raw({
							position: "relative",
							aspectRatio: "1",
							overflow: "clip",
							borderRadius: "var(--ui-landing-card-radius-outer)",
							boxShadow:
								"inset 0 0 0 1px var(--ui-landing-hairline), 0 20px 40px -24px oklch(0 0 0 / 0.5)",
						}),
					]}
				>
					<material.Surface />
					<span
						mix={[
							raw({
								position: "absolute",
								inset: "0",
								background:
									"linear-gradient(110deg, transparent 30%, oklch(1 0 0 / 0.32) 50%, transparent 70%)",
								translate: "0 0",
								opacity: "0.6",
							}),
							sceneMotion(
								TIMELINE,
								{
									from: { translate: "-110% 0", opacity: "1" },
									to: { translate: "0 0", opacity: "0.6" },
								},
								`contain ${start}% contain ${start + 26}%`,
							),
						]}
					/>
				</div>
				<figcaption mix={[raw({ display: "grid", gap: "0.375rem" })]}>
					<span
						mix={[
							raw({
								fontSize: "0.75rem",
								fontWeight: "600",
								letterSpacing: "0.14em",
								textTransform: "uppercase",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{material.name}
					</span>
					<span
						mix={[
							raw({
								fontFamily: "var(--ui-font-display)",
								fontSize: "clamp(1.75rem, 4cqi, 3rem)",
								fontWeight: "600",
								letterSpacing: "-0.04em",
								lineHeight: "1",
								fontVariantNumeric: "tabular-nums",
							}),
						]}
					>
						{material.figure}{" "}
						<span mix={[raw({ fontSize: "0.45em", letterSpacing: "0", fontWeight: "500" })]}>
							{material.unit}
						</span>
					</span>
					<span
						mix={[
							raw({
								fontSize: "0.875rem",
								lineHeight: "1.45",
								color: "var(--ui-neutral-fg)",
								textWrap: "pretty",
							}),
						]}
					>
						{material.why}
					</span>
				</figcaption>
			</figure>
		);
	};
}

/**
 * Renders the band on the page's own ground, so the metal reads against aluminium in light
 * and against the stage in dark.
 *
 * @returns The render function producing the band.
 */
export default function MaterialsScene() {
	return () => (
		<LandingSection id="materials" tone="tinted" spacing="normal">
			<LandingHeader
				eyebrow="02 · Materials"
				description={
					<>
						Each one was picked for how it sounds as much as how it looks:{" "}
						<strong>dense metal, thick plastic, and weight where the hollow used to be</strong>.
					</>
				}
			>
				Three materials, chosen by ear
			</LandingHeader>
			<ScrollScene timeline={TIMELINE} length={2}>
				<div
					mix={[
						raw({
							containerType: "inline-size",
							display: "grid",
							gap: "1.25rem",
							paddingBlock: "1rem",
						}),
						at("md", raw({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "2rem" })),
					]}
				>
					{MATERIALS.map((material, index) => (
						<Swatch key={material.name} material={material} index={index} />
					))}
				</div>
			</ScrollScene>
		</LandingSection>
	);
}
