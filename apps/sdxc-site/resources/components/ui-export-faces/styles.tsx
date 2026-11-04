/**
 * Visual faces for every `@sdxc/ui/styles` export: wireframe layouts, type
 * samples, surface chrome and palette strips so a style recipe reads as a
 * picture on the package landing instead of a bare name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { bs, is, maxIs } from "@sdxc/u/size";
import { font, text, tracking, weight } from "@sdxc/u/typography";

import ExportFaceStage from "~/resources/components/ui-export-faces/stage";

namespace StyleFace {
	export interface Props {
		name: string;
	}
}

/** Ink used for wireframe strokes inside the stage. */
const INK = "color-mix(in oklch, CanvasText 18%, transparent)";
const INK_STRONG = "color-mix(in oklch, CanvasText 32%, transparent)";
const BRAND = "color-mix(in oklch, var(--ui-brand-fg, CanvasText) 45%, transparent)";

namespace WireBox {
	export interface Props {
		width?: string;
		height?: string;
		radius?: string;
		fill?: string;
		border?: string;
	}
}

/** A ruled box that stands in for a layout region. */
function WireBox(handle: Handle<WireBox.Props>) {
	return () => {
		let { width, height, radius, fill, border } = handle.props;

		return (
			<div
				mix={[
					raw({
						inlineSize: width ?? "100%",
						blockSize: height ?? "1rem",
						borderRadius: radius ?? "0.35rem",
						backgroundColor: fill ?? INK,
						border,
						flexShrink: "0",
					}),
				]}
			/>
		);
	};
}

namespace CardGridFace {
	export interface Props {}
}

/** Three-column card mosaic for the card-grid family. */
function CardGridFace(_handle: Handle<CardGridFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "1fr 1fr 1fr",
					gap: "0.35rem",
					inlineSize: "100%",
					maxInlineSize: "11rem",
				}),
			]}
		>
			{[0, 1, 2, 3, 4].map((index) => (
				<div
					key={index}
					mix={[
						raw({
							blockSize: index === 4 ? "2.4rem" : "2.1rem",
							gridColumn: index === 4 ? "span 2" : undefined,
							borderRadius: index === 0 ? "0.85rem 0.35rem 0.35rem 0.35rem" : "0.35rem",
							backgroundColor: index === 0 ? BRAND : INK,
							border: `1px solid ${INK_STRONG}`,
						}),
					]}
				/>
			))}
		</div>
	);
}

namespace ColumnsFace {
	export interface Props {}
}

/** Two balanced columns of uneven rows. */
function ColumnsFace(_handle: Handle<ColumnsFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: "0.4rem",
					inlineSize: "100%",
					maxInlineSize: "10rem",
				}),
			]}
		>
			<div mix={[vstack({ gap: 1, align: "stretch" })]}>
				<WireBox height="2.2rem" fill={BRAND} />
				<WireBox height="1.2rem" />
			</div>
			<div mix={[vstack({ gap: 1, align: "stretch" })]}>
				<WireBox height="1.2rem" />
				<WireBox height="2.2rem" />
			</div>
		</div>
	);
}

namespace SurfaceFace {
	export interface Props {}
}

/** Raised panel with a hairline and inset body. */
function SurfaceFace(_handle: Handle<SurfaceFace.Props>) {
	return () => (
		<div
			mix={[
				vstack({ gap: 2, align: "stretch" }),
				is("100%"),
				maxIs("10rem"),
				raw({
					padding: "0.55rem",
					borderRadius: "0.75rem",
					backgroundColor: "color-mix(in oklch, Canvas 94%, CanvasText)",
					boxShadow: `0 0 0 1px ${INK}, 0 8px 18px -12px rgb(0 0 0 / 0.35)`,
				}),
			]}
		>
			<WireBox height="0.45rem" width="40%" fill={INK_STRONG} />
			<WireBox height="2.4rem" fill={INK} radius="0.45rem" />
		</div>
	);
}

namespace TypeFace {
	export interface Props {
		kind: "display" | "eyebrow" | "lead" | "caption";
	}
}

/** Display / lead type sample. */
function TypeFace(handle: Handle<TypeFace.Props>) {
	return () => {
		let { kind } = handle.props;

		if (kind === "eyebrow") {
			return (
				<span
					mix={[
						font("mono"),
						text("xs"),
						tracking("widest"),
						weight("semibold"),
						raw({
							textTransform: "uppercase",
							color: "var(--ui-brand-fg, CanvasText)",
							opacity: "0.75",
						}),
					]}
				>
					Release
				</span>
			);
		}

		if (kind === "lead") {
			return (
				<p
					mix={[
						text("sm"),
						raw({
							margin: "0",
							maxInlineSize: "11rem",
							lineHeight: "1.45",
							color: "var(--ui-neutral-fg)",
							opacity: "0.8",
							textWrap: "pretty",
						}),
					]}
				>
					A short lead that settles under the headline.
				</p>
			);
		}

		if (kind === "caption") {
			return <span mix={[font("mono"), text("xs"), raw({ opacity: "0.55" })]}>output · 24ms</span>;
		}

		return (
			<span
				mix={[
					weight("medium"),
					raw({
						fontSize: "1.55rem",
						letterSpacing: "-0.035em",
						lineHeight: "1",
						color: "var(--ui-neutral-emphasis, CanvasText)",
					}),
				]}
			>
				Display
			</span>
		);
	};
}

namespace PaletteFace {
	export interface Props {}
}

/** Palette swatches for chart / semantic color. */
function PaletteFace(_handle: Handle<PaletteFace.Props>) {
	return () => {
		let tones = [
			"oklch(0.72 0.14 250)",
			"oklch(0.7 0.15 160)",
			"oklch(0.75 0.14 70)",
			"oklch(0.68 0.16 20)",
			"oklch(0.65 0.12 300)",
		];

		return (
			<div mix={[hstack({ gap: 1, align: "end" })]}>
				{tones.map((tone, index) => (
					<div
						key={tone}
						mix={[
							raw({
								inlineSize: "1.1rem",
								blockSize: `${1.4 + index * 0.35}rem`,
								borderRadius: "0.3rem 0.3rem 0.15rem 0.15rem",
								backgroundColor: tone,
							}),
						]}
					/>
				))}
			</div>
		);
	};
}

namespace SegmentedFace {
	export interface Props {}
}

/** Segmented control track with one selected item. */
function SegmentedFace(_handle: Handle<SegmentedFace.Props>) {
	return () => (
		<div
			mix={[
				hstack({ gap: 0, align: "stretch" }),
				raw({
					padding: "0.2rem",
					borderRadius: "0.65rem",
					backgroundColor: INK,
					border: `1px solid ${INK_STRONG}`,
				}),
			]}
		>
			{["Day", "Week", "Month"].map((label, index) => (
				<span
					key={label}
					mix={[
						font("mono"),
						text("xs"),
						raw({
							paddingInline: "0.55rem",
							paddingBlock: "0.3rem",
							borderRadius: "0.5rem",
							backgroundColor: index === 1 ? "var(--ui-bg, Canvas)" : "transparent",
							boxShadow: index === 1 ? `0 0 0 1px ${INK_STRONG}` : undefined,
							color: "var(--ui-neutral-emphasis, CanvasText)",
						}),
					]}
				>
					{label}
				</span>
			))}
		</div>
	);
}

namespace HitAreaFace {
	export interface Props {}
}

/** Hit-area ring around a compact control. */
function HitAreaFace(_handle: Handle<HitAreaFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					position: "relative",
					inlineSize: "2.75rem",
					blockSize: "2.75rem",
					display: "grid",
					placeItems: "center",
				}),
			]}
		>
			<div
				mix={[
					raw({
						position: "absolute",
						inset: "0",
						borderRadius: "0.55rem",
						border: `1px dashed ${INK_STRONG}`,
					}),
				]}
			/>
			<div
				mix={[
					raw({
						inlineSize: "1.15rem",
						blockSize: "1.15rem",
						borderRadius: "0.3rem",
						backgroundColor: BRAND,
					}),
				]}
			/>
		</div>
	);
}

namespace RangeFace {
	export interface Props {}
}

/** Range thumb on a track. */
function RangeFace(_handle: Handle<RangeFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					position: "relative",
					inlineSize: "9rem",
					blockSize: "0.35rem",
					borderRadius: "9999px",
					backgroundColor: INK,
				}),
			]}
		>
			<div
				mix={[
					raw({
						position: "absolute",
						insetBlock: "0",
						insetInlineStart: "0",
						inlineSize: "55%",
						borderRadius: "inherit",
						backgroundColor: BRAND,
					}),
				]}
			/>
			<div
				mix={[
					raw({
						position: "absolute",
						insetBlockStart: "50%",
						insetInlineStart: "55%",
						translate: "-50% -50%",
						inlineSize: "1rem",
						blockSize: "1rem",
						borderRadius: "9999px",
						backgroundColor: "var(--ui-bg, Canvas)",
						boxShadow: `0 0 0 2px var(--ui-brand-fg, CanvasText)`,
					}),
				]}
			/>
		</div>
	);
}

namespace SlowSpinFace {
	export interface Props {}
}

/** Slowly spinning mark for landingSlowSpin. */
function SlowSpinFace(_handle: Handle<SlowSpinFace.Props>) {
	return () => (
		<div
			mix={[
				is("2.5rem"),
				bs("2.5rem"),
				keyframes("ui-export-slow-spin", {
					from: { transform: "rotate(0deg)" },
					to: { transform: "rotate(360deg)" },
				}),
				raw({
					borderRadius: "9999px",
					border: `2px solid ${INK}`,
					borderBlockStartColor: "var(--ui-brand-fg, CanvasText)",
					animationName: "ui-export-slow-spin",
					animationDuration: "8s",
					animationTimingFunction: "linear",
					animationIterationCount: "infinite",
				}),
			]}
		/>
	);
}

namespace ToastStackFace {
	export interface Props {}
}

/** Toast stack of overlapping chips. */
function ToastStackFace(_handle: Handle<ToastStackFace.Props>) {
	return () => (
		<div mix={[raw({ position: "relative", inlineSize: "8rem", blockSize: "3.5rem" })]}>
			{[0, 1, 2].map((index) => (
				<div
					key={index}
					mix={[
						raw({
							position: "absolute",
							insetInline: `${index * 0.35}rem`,
							insetBlockStart: `${index * 0.45}rem`,
							blockSize: "1.6rem",
							borderRadius: "0.55rem",
							backgroundColor: index === 2 ? BRAND : "color-mix(in oklch, Canvas 92%, CanvasText)",
							boxShadow: `0 0 0 1px ${INK}`,
							opacity: String(0.55 + index * 0.2),
						}),
					]}
				/>
			))}
		</div>
	);
}

namespace FieldStackFace {
	export interface Props {}
}

/** Field stack of label + control rows. */
function FieldStackFace(_handle: Handle<FieldStackFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("10rem")]}>
			{[0, 1].map((index) => (
				<div key={index} mix={[vstack({ gap: 1, align: "stretch" })]}>
					<WireBox height="0.35rem" width="30%" fill={INK_STRONG} />
					<WireBox
						height="1.35rem"
						fill="transparent"
						border={`1px solid ${INK_STRONG}`}
						radius="0.45rem"
					/>
				</div>
			))}
		</div>
	);
}

namespace GradientFace {
	export interface Props {}
}

/** Gradient strip that flips direction for RTL-aware demos. */
function GradientFace(_handle: Handle<GradientFace.Props>) {
	return () => (
		<div
			mix={[
				is("100%"),
				maxIs("10rem"),
				bs("2.5rem"),
				raw({
					borderRadius: "0.65rem",
					backgroundImage:
						"linear-gradient(to right, transparent, color-mix(in oklch, var(--ui-brand-fg) 40%, transparent))",
				}),
			]}
		/>
	);
}

namespace StyleFallback {
	export interface Props {
		name: string;
	}
}

/** Named fallback when no dedicated wireframe exists yet. */
function StyleFallback(handle: Handle<StyleFallback.Props>) {
	return () => (
		<span mix={[font("mono"), text("xs"), raw({ opacity: "0.5" })]}>{handle.props.name}</span>
	);
}

/** Renders the visual miniature for one style export. */
export default function StyleFace(handle: Handle<StyleFace.Props>) {
	return () => {
		let { name } = handle.props;
		let body;

		switch (name) {
			case "balancedColumns":
			case "balancedGrid":
			case "byChildCount":
				body = <ColumnsFace />;
				break;
			case "cardGrid":
			case "cardMedia":
			case "cardPadding":
			case "iconTile":
				body = <CardGridFace />;
				break;
			case "chartPalette":
			case "semanticColorPanel":
				body = <PaletteFace />;
				break;
			case "displayHeading":
				body = <TypeFace kind="display" />;
				break;
			case "eyebrow":
				body = <TypeFace kind="eyebrow" />;
				break;
			case "landingLead":
			case "landingEmphasis":
				body = <TypeFace kind="lead" />;
				break;
			case "outputCaptionText":
				body = <TypeFace kind="caption" />;
				break;
			case "floatingSurface":
			case "landingSurface":
			case "panelChrome":
			case "surfaceControl":
			case "surfaceInset":
			case "surfacePadding":
			case "concentricRadius":
			case "landingHairline":
			case "landingBandTone":
			case "landingContainer":
			case "landingSectionSpace":
			case "landingCtaChrome":
			case "logoCloudMark":
			case "themeScope":
			case "graphicHostStyle":
				body = <SurfaceFace />;
				break;
			case "segmentedItem":
			case "segmentedTrack":
			case "legendToggle":
				body = <SegmentedFace />;
				break;
			case "hitArea":
				body = <HitAreaFace />;
				break;
			case "rangeThumbAppearance":
				body = <RangeFace />;
				break;
			case "landingSlowSpin":
			case "interactiveTransition":
				body = <SlowSpinFace />;
				break;
			case "toastStackStyle":
				body = <ToastStackFace />;
				break;
			case "fieldStackLayout":
				body = <FieldStackFace />;
				break;
			case "rtlAwareGradientDirection":
				body = <GradientFace />;
				break;
			default:
				body = <StyleFallback name={name} />;
		}

		return <ExportFaceStage>{body}</ExportFaceStage>;
	};
}
