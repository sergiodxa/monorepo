/**
 * Visual faces for every `@sdxc/ui/styles` export: each recipe gets its own
 * wireframe so neighbouring tiles in the catalogue do not share a silhouette.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

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

const INK = "color-mix(in oklch, CanvasText 18%, transparent)";
const INK_STRONG = "color-mix(in oklch, CanvasText 32%, transparent)";
const BRAND = "color-mix(in oklch, var(--ui-brand-fg, CanvasText) 45%, transparent)";

namespace BalancedColumnsFace {
	export interface Props {}
}

/** Two uneven columns — the orphan-balance recipe. */
function BalancedColumnsFace(_handle: Handle<BalancedColumnsFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: "0.4rem",
					inlineSize: "100%",
					maxInlineSize: "9.5rem",
				}),
			]}
		>
			<div mix={[vstack({ gap: 1, align: "stretch" })]}>
				<div
					mix={[
						raw({
							blockSize: "2.4rem",
							borderRadius: "0.4rem",
							backgroundColor: BRAND,
						}),
					]}
				/>
				<div
					mix={[
						raw({
							blockSize: "1rem",
							borderRadius: "0.4rem",
							backgroundColor: INK,
						}),
					]}
				/>
			</div>
			<div mix={[vstack({ gap: 1, align: "stretch" })]}>
				<div
					mix={[
						raw({
							blockSize: "1rem",
							borderRadius: "0.4rem",
							backgroundColor: INK,
						}),
					]}
				/>
				<div
					mix={[
						raw({
							blockSize: "2.4rem",
							borderRadius: "0.4rem",
							backgroundColor: INK_STRONG,
						}),
					]}
				/>
			</div>
		</div>
	);
}

namespace BalancedGridFace {
	export interface Props {}
}

/** Three-column mosaic with a spanning orphan cell. */
function BalancedGridFace(_handle: Handle<BalancedGridFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "1fr 1fr 1fr",
					gap: "0.3rem",
					inlineSize: "100%",
					maxInlineSize: "10rem",
				}),
			]}
		>
			{[0, 1, 2, 3].map((index) => (
				<div
					key={index}
					mix={[
						raw({
							blockSize: "1.7rem",
							gridColumn: index === 3 ? "span 2" : undefined,
							borderRadius: "0.35rem",
							backgroundColor: index === 0 ? BRAND : INK,
							border: `1px solid ${INK_STRONG}`,
						}),
					]}
				/>
			))}
		</div>
	);
}

namespace ByChildCountFace {
	export interface Props {}
}

/** Quantity cue: N children → N tracks. */
function ByChildCountFace(_handle: Handle<ByChildCountFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "center" })]}>
			<span mix={[font("mono"), text("xs"), raw({ opacity: "0.55" })]}>3 children</span>
			<div mix={[hstack({ gap: 1, align: "stretch" })]}>
				{[0, 1, 2].map((index) => (
					<div
						key={index}
						mix={[
							raw({
								inlineSize: "1.8rem",
								blockSize: "2.2rem",
								borderRadius: "0.35rem",
								backgroundColor: index === 1 ? BRAND : INK,
								border: `1px solid ${INK_STRONG}`,
							}),
						]}
					/>
				))}
			</div>
			<span mix={[font("mono"), text("xs"), raw({ opacity: "0.55" })]}>→ 3 columns</span>
		</div>
	);
}

namespace CardGridFace {
	export interface Props {}
}

/** Raised card mosaic with concentric outer corner. */
function CardGridFace(_handle: Handle<CardGridFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: "0.35rem",
					inlineSize: "100%",
					maxInlineSize: "9rem",
				}),
			]}
		>
			{[0, 1, 2, 3].map((index) => {
				let radius = "0.3rem";
				if (index === 0) radius = "0.85rem 0.3rem 0.3rem 0.3rem";
				else if (index === 1) radius = "0.3rem 0.85rem 0.3rem 0.3rem";

				return (
					<div
						key={index}
						mix={[
							raw({
								blockSize: "1.85rem",
								borderRadius: radius,
								backgroundColor:
									index === 0 ? BRAND : "color-mix(in oklch, Canvas 94%, CanvasText)",
								boxShadow: `0 0 0 1px ${INK_STRONG}`,
							}),
						]}
					/>
				);
			})}
		</div>
	);
}

namespace CardMediaFace {
	export interface Props {}
}

/** Card with a media band on top. */
function CardMediaFace(_handle: Handle<CardMediaFace.Props>) {
	return () => (
		<div
			mix={[
				vstack({ gap: 0, align: "stretch" }),
				is("100%"),
				maxIs("8rem"),
				raw({
					borderRadius: "0.65rem",
					overflow: "hidden",
					boxShadow: `0 0 0 1px ${INK_STRONG}`,
					backgroundColor: "color-mix(in oklch, Canvas 94%, CanvasText)",
				}),
			]}
		>
			<div mix={[raw({ blockSize: "2.1rem", backgroundColor: BRAND })]} />
			<div mix={[vstack({ gap: 1, align: "stretch" }), raw({ padding: "0.45rem" })]}>
				<div
					mix={[
						raw({
							blockSize: "0.4rem",
							inlineSize: "55%",
							borderRadius: "9999px",
							backgroundColor: INK_STRONG,
						}),
					]}
				/>
				<div
					mix={[
						raw({
							blockSize: "0.35rem",
							inlineSize: "80%",
							borderRadius: "9999px",
							backgroundColor: INK,
						}),
					]}
				/>
			</div>
		</div>
	);
}

namespace CardPaddingFace {
	export interface Props {}
}

/** Card outline with padding guides. */
function CardPaddingFace(_handle: Handle<CardPaddingFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					position: "relative",
					inlineSize: "7.5rem",
					blockSize: "4.2rem",
					borderRadius: "0.65rem",
					border: `1px dashed ${INK_STRONG}`,
					padding: "0.65rem",
				}),
			]}
		>
			<div
				mix={[
					raw({
						blockSize: "100%",
						borderRadius: "0.4rem",
						backgroundColor: BRAND,
						border: `1px solid ${INK_STRONG}`,
					}),
				]}
			/>
			<span
				mix={[
					font("mono"),
					raw({
						position: "absolute",
						insetBlockStart: "0.1rem",
						insetInlineEnd: "0.25rem",
						fontSize: "0.5rem",
						opacity: "0.55",
					}),
				]}
			>
				pad
			</span>
		</div>
	);
}

namespace ConcentricRadiusFace {
	export interface Props {}
}

/** Outer radius = inner radius + padding — concentric corners. */
function ConcentricRadiusFace(_handle: Handle<ConcentricRadiusFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "center" })]}>
			<div
				mix={[
					raw({
						inlineSize: "6.75rem",
						blockSize: "2.85rem",
						borderRadius: "1.1rem",
						backgroundColor: "color-mix(in oklch, Canvas 92%, CanvasText)",
						boxShadow: `0 0 0 1px ${INK_STRONG}`,
						padding: "0.55rem",
					}),
				]}
			>
				<div
					mix={[
						raw({
							blockSize: "100%",
							borderRadius: "0.55rem",
							backgroundColor: BRAND,
							boxShadow: `inset 0 0 0 1px ${INK_STRONG}`,
						}),
					]}
				/>
			</div>
			<span
				mix={[
					font("mono"),
					raw({
						fontSize: "0.6rem",
						lineHeight: "1",
						letterSpacing: "0.02em",
						color: "var(--ui-neutral-fg, CanvasText)",
						opacity: "0.85",
						whiteSpace: "nowrap",
						backgroundColor: "color-mix(in oklch, Canvas 92%, transparent)",
						paddingInline: "0.35rem",
						paddingBlock: "0.15rem",
						borderRadius: "0.25rem",
					}),
				]}
			>
				rₒ = rᵢ + pad
			</span>
		</div>
	);
}

namespace FloatingSurfaceFace {
	export interface Props {}
}

/** Raised panel with a drop shadow. */
function FloatingSurfaceFace(_handle: Handle<FloatingSurfaceFace.Props>) {
	return () => (
		<div
			mix={[
				vstack({ gap: 2, align: "stretch" }),
				is("100%"),
				maxIs("9rem"),
				raw({
					padding: "0.55rem",
					borderRadius: "0.75rem",
					backgroundColor: "color-mix(in oklch, Canvas 96%, CanvasText)",
					boxShadow: `0 0 0 1px ${INK}, 0 10px 22px -12px rgb(0 0 0 / 0.4)`,
				}),
			]}
		>
			<div
				mix={[
					raw({
						blockSize: "0.4rem",
						inlineSize: "40%",
						borderRadius: "9999px",
						backgroundColor: INK_STRONG,
					}),
				]}
			/>
			<div
				mix={[
					raw({
						blockSize: "2rem",
						borderRadius: "0.4rem",
						backgroundColor: INK,
					}),
				]}
			/>
		</div>
	);
}

namespace PanelChromeFace {
	export interface Props {}
}

/** Window chrome with traffic lights. */
function PanelChromeFace(_handle: Handle<PanelChromeFace.Props>) {
	return () => (
		<div
			mix={[
				vstack({ gap: 0, align: "stretch" }),
				is("100%"),
				maxIs("9rem"),
				raw({
					borderRadius: "0.55rem",
					overflow: "hidden",
					boxShadow: `0 0 0 1px ${INK_STRONG}`,
					backgroundColor: "color-mix(in oklch, Canvas 94%, CanvasText)",
				}),
			]}
		>
			<div
				mix={[
					hstack({ gap: 1, align: "center" }),
					raw({
						paddingInline: "0.45rem",
						blockSize: "1.1rem",
						borderBlockEnd: `1px solid ${INK}`,
						backgroundColor: "color-mix(in oklch, CanvasText 4%, transparent)",
					}),
				]}
			>
				{[0, 1, 2].map((dot) => (
					<span
						key={dot}
						mix={[
							raw({
								inlineSize: "0.35rem",
								blockSize: "0.35rem",
								borderRadius: "9999px",
								backgroundColor: INK_STRONG,
							}),
						]}
					/>
				))}
			</div>
			<div mix={[raw({ blockSize: "2.4rem", backgroundColor: INK })]} />
		</div>
	);
}

namespace TypeFace {
	export interface Props {
		kind: "display" | "eyebrow" | "lead" | "emphasis" | "caption";
	}
}

/** Type sample for display / eyebrow / lead / caption. */
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

		if (kind === "emphasis") {
			return (
				<p
					mix={[
						text("sm"),
						weight("semibold"),
						raw({
							margin: "0",
							maxInlineSize: "10rem",
							lineHeight: "1.35",
							color: "var(--ui-neutral-emphasis, CanvasText)",
							textWrap: "pretty",
						}),
					]}
				>
					Emphasised line in the band.
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

/** Chart / semantic color bars. */
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

/** Segmented control track. */
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
	export interface Props {
		/** Landing mark spins slower than interactive transitions. */
		pace?: "slow" | "interactive";
	}
}

/** Spinning ring — slow for landing, quicker for interactive. */
function SlowSpinFace(handle: Handle<SlowSpinFace.Props>) {
	return () => {
		let pace = handle.props.pace ?? "slow";

		return (
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
						animationDuration: pace === "slow" ? "8s" : "1.6s",
						animationTimingFunction: "linear",
						animationIterationCount: "infinite",
					}),
				]}
			/>
		);
	};
}

namespace ToastStackFace {
	export interface Props {}
}

/** Stacked toast chips. */
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

/** Label + control rows. */
function FieldStackFace(_handle: Handle<FieldStackFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("10rem")]}>
			{[0, 1].map((index) => (
				<div key={index} mix={[vstack({ gap: 1, align: "stretch" })]}>
					<div
						mix={[
							raw({
								blockSize: "0.35rem",
								inlineSize: "30%",
								borderRadius: "9999px",
								backgroundColor: INK_STRONG,
							}),
						]}
					/>
					<div
						mix={[
							raw({
								blockSize: "1.35rem",
								borderRadius: "0.45rem",
								border: `1px solid ${INK_STRONG}`,
							}),
						]}
					/>
				</div>
			))}
		</div>
	);
}

namespace GradientFace {
	export interface Props {}
}

/** RTL-aware gradient strip. */
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

namespace IconTileFace {
	export interface Props {}
}

/** Quiet icon tile. */
function IconTileFace(_handle: Handle<IconTileFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					inlineSize: "2.75rem",
					blockSize: "2.75rem",
					borderRadius: "0.75rem",
					display: "grid",
					placeItems: "center",
					backgroundColor: INK,
					border: `1px solid ${INK_STRONG}`,
				}),
			]}
		>
			<span
				mix={[
					raw({
						inlineSize: "1rem",
						blockSize: "1rem",
						borderRadius: "0.25rem",
						backgroundColor: BRAND,
					}),
				]}
			/>
		</div>
	);
}

namespace LandingBandFace {
	export interface Props {
		tone?: boolean;
	}
}

/** Landing band / container strip. */
function LandingBandFace(handle: Handle<LandingBandFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: "10rem",
					blockSize: "3.5rem",
					borderRadius: "0.45rem",
					padding: "0.55rem",
					backgroundColor: handle.props.tone
						? "color-mix(in oklch, var(--ui-brand-fg) 10%, Canvas)"
						: INK,
					border: `1px solid ${INK_STRONG}`,
				}),
			]}
		>
			<div
				mix={[
					raw({
						blockSize: "0.45rem",
						inlineSize: "45%",
						borderRadius: "9999px",
						backgroundColor: INK_STRONG,
						marginBlockEnd: "0.4rem",
					}),
				]}
			/>
			<div
				mix={[
					raw({
						blockSize: "0.35rem",
						inlineSize: "70%",
						borderRadius: "9999px",
						backgroundColor: "color-mix(in oklch, CanvasText 12%, transparent)",
					}),
				]}
			/>
		</div>
	);
}

namespace HairlineFace {
	export interface Props {}
}

/** Thin hairline rule. */
function HairlineFace(_handle: Handle<HairlineFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("9rem")]}>
			<div mix={[raw({ blockSize: "0.55rem", borderRadius: "9999px", backgroundColor: INK })]} />
			<div mix={[raw({ blockSize: "1px", backgroundColor: INK_STRONG })]} />
			<div mix={[raw({ blockSize: "0.55rem", borderRadius: "9999px", backgroundColor: INK })]} />
		</div>
	);
}

namespace SurfaceInsetFace {
	export interface Props {}
}

/** Inset well inside a surface. */
function SurfaceInsetFace(_handle: Handle<SurfaceInsetFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					inlineSize: "8rem",
					blockSize: "3.6rem",
					borderRadius: "0.65rem",
					padding: "0.45rem",
					backgroundColor: "color-mix(in oklch, Canvas 94%, CanvasText)",
					boxShadow: `0 0 0 1px ${INK}`,
				}),
			]}
		>
			<div
				mix={[
					raw({
						blockSize: "100%",
						borderRadius: "0.4rem",
						backgroundColor: "color-mix(in oklch, CanvasText 6%, transparent)",
						boxShadow: `inset 0 1px 2px rgb(0 0 0 / 0.08)`,
					}),
				]}
			/>
		</div>
	);
}

namespace LandingContainerFace {
	export interface Props {}
}

/** Max-width landing measure with side gutters. */
function LandingContainerFace(_handle: Handle<LandingContainerFace.Props>) {
	return () => (
		<div
			mix={[
				hstack({ gap: 1, align: "stretch" }),
				is("100%"),
				maxIs("10rem"),
				raw({ blockSize: "3.2rem" }),
			]}
		>
			<div mix={[raw({ inlineSize: "0.7rem", backgroundColor: INK, borderRadius: "0.2rem" })]} />
			<div
				mix={[
					raw({
						flex: "1",
						borderRadius: "0.35rem",
						border: `1px dashed ${INK_STRONG}`,
						backgroundColor: "color-mix(in oklch, Canvas 96%, CanvasText)",
					}),
				]}
			/>
			<div mix={[raw({ inlineSize: "0.7rem", backgroundColor: INK, borderRadius: "0.2rem" })]} />
		</div>
	);
}

namespace LandingSectionSpaceFace {
	export interface Props {}
}

/** Vertical section rhythm marks. */
function LandingSectionSpaceFace(_handle: Handle<LandingSectionSpaceFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 0, align: "stretch" }), is("100%"), maxIs("6rem")]}>
			<div mix={[raw({ blockSize: "1.1rem", borderRadius: "0.3rem", backgroundColor: INK })]} />
			<span
				mix={[
					font("mono"),
					raw({
						fontSize: "0.5rem",
						opacity: "0.55",
						textAlign: "center",
						paddingBlock: "0.35rem",
					}),
				]}
			>
				↕ space
			</span>
			<div mix={[raw({ blockSize: "1.1rem", borderRadius: "0.3rem", backgroundColor: BRAND })]} />
		</div>
	);
}

namespace LandingCtaChromeFace {
	export interface Props {}
}

/** Primary + ghost CTA pair. */
function LandingCtaChromeFace(_handle: Handle<LandingCtaChromeFace.Props>) {
	return () => (
		<div mix={[hstack({ gap: 2, align: "center" })]}>
			<span
				mix={[
					raw({
						paddingInline: "0.85rem",
						paddingBlock: "0.4rem",
						borderRadius: "9999px",
						backgroundColor: BRAND,
						color: "Canvas",
						fontSize: "0.65rem",
						fontWeight: "600",
					}),
				]}
			>
				Start
			</span>
			<span
				mix={[
					raw({
						paddingInline: "0.75rem",
						paddingBlock: "0.4rem",
						borderRadius: "9999px",
						border: `1px solid ${INK_STRONG}`,
						fontSize: "0.65rem",
						opacity: "0.7",
					}),
				]}
			>
				Docs
			</span>
		</div>
	);
}

namespace LogoCloudMarkFace {
	export interface Props {}
}

/** Three quiet logo marks in a row. */
function LogoCloudMarkFace(_handle: Handle<LogoCloudMarkFace.Props>) {
	return () => (
		<div mix={[hstack({ gap: 2, align: "center" })]}>
			{[0, 1, 2].map((index) => (
				<span
					key={index}
					mix={[
						raw({
							inlineSize: index === 1 ? "1.6rem" : "1.25rem",
							blockSize: index === 1 ? "1.6rem" : "1.25rem",
							borderRadius: index === 1 ? "0.35rem" : "9999px",
							backgroundColor: index === 1 ? BRAND : INK,
							border: `1px solid ${INK_STRONG}`,
							opacity: index === 1 ? "1" : "0.55",
						}),
					]}
				/>
			))}
		</div>
	);
}

namespace ThemeScopeFace {
	export interface Props {}
}

/** Nested theme scopes — outer light, inner tinted. */
function ThemeScopeFace(_handle: Handle<ThemeScopeFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					inlineSize: "7.5rem",
					blockSize: "3.6rem",
					borderRadius: "0.55rem",
					padding: "0.4rem",
					backgroundColor: "color-mix(in oklch, Canvas 96%, CanvasText)",
					border: `1px solid ${INK_STRONG}`,
				}),
			]}
		>
			<div
				mix={[
					raw({
						blockSize: "100%",
						borderRadius: "0.4rem",
						padding: "0.35rem",
						backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 14%, Canvas)",
						border: `1px solid ${INK}`,
					}),
				]}
			>
				<span mix={[font("mono"), raw({ fontSize: "0.5rem", opacity: "0.65" })]}>theme</span>
			</div>
		</div>
	);
}

namespace GraphicHostFace {
	export interface Props {}
}

/** Host frame for a decorative graphic. */
function GraphicHostFace(_handle: Handle<GraphicHostFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					inlineSize: "7rem",
					blockSize: "3.8rem",
					borderRadius: "0.65rem",
					display: "grid",
					placeItems: "center",
					backgroundColor: INK,
					border: `1px dashed ${INK_STRONG}`,
				}),
			]}
		>
			<span
				mix={[
					raw({
						inlineSize: "2.2rem",
						blockSize: "2.2rem",
						borderRadius: "0.45rem",
						backgroundColor: BRAND,
						transform: "rotate(12deg)",
					}),
				]}
			/>
		</div>
	);
}

namespace SurfacePaddingFace {
	export interface Props {}
}

/** Surface with equal inset guides on every edge. */
function SurfacePaddingFace(_handle: Handle<SurfacePaddingFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					position: "relative",
					inlineSize: "7rem",
					blockSize: "3.8rem",
					borderRadius: "0.55rem",
					border: `1px solid ${INK_STRONG}`,
					backgroundColor: "color-mix(in oklch, Canvas 96%, CanvasText)",
				}),
			]}
		>
			<div
				mix={[
					raw({
						position: "absolute",
						inset: "0.55rem",
						borderRadius: "0.35rem",
						backgroundColor: BRAND,
					}),
				]}
			/>
			{(
				[
					{
						mark: "↑",
						place: {
							insetBlockStart: "0.05rem",
							insetInlineStart: "50%",
							translate: "-50% 0",
						},
					},
					{
						mark: "→",
						place: { insetInlineEnd: "0.1rem", insetBlockStart: "50%", translate: "0 -50%" },
					},
					{
						mark: "↓",
						place: { insetBlockEnd: "0.05rem", insetInlineStart: "50%", translate: "-50% 0" },
					},
					{
						mark: "←",
						place: {
							insetInlineStart: "0.1rem",
							insetBlockStart: "50%",
							translate: "0 -50%",
						},
					},
				] as const
			).map((edge) => (
				<span
					key={edge.mark}
					mix={[
						font("mono"),
						raw({
							position: "absolute",
							fontSize: "0.45rem",
							opacity: "0.55",
							...edge.place,
						}),
					]}
				>
					{edge.mark}
				</span>
			))}
		</div>
	);
}

namespace SemanticPaletteFace {
	export interface Props {}
}

/** Success / warning / danger / info chips. */
function SemanticPaletteFace(_handle: Handle<SemanticPaletteFace.Props>) {
	return () => {
		let tones = [
			"oklch(0.7 0.15 145)",
			"oklch(0.75 0.14 80)",
			"oklch(0.65 0.18 25)",
			"oklch(0.68 0.14 250)",
		];

		return (
			<div mix={[hstack({ gap: 1, align: "center" })]}>
				{tones.map((tone) => (
					<span
						key={tone}
						mix={[
							raw({
								inlineSize: "1.35rem",
								blockSize: "1.35rem",
								borderRadius: "9999px",
								backgroundColor: tone,
							}),
						]}
					/>
				))}
			</div>
		);
	};
}

namespace SegmentedTrackFace {
	export interface Props {}
}

/** Empty segmented track shell. */
function SegmentedTrackFace(_handle: Handle<SegmentedTrackFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					inlineSize: "9rem",
					blockSize: "1.7rem",
					borderRadius: "9999px",
					padding: "0.2rem",
					backgroundColor: INK,
					border: `1px solid ${INK_STRONG}`,
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

/** Named fallback. */
function StyleFallback(handle: Handle<StyleFallback.Props>) {
	return () => (
		<span mix={[font("mono"), text("xs"), raw({ opacity: "0.5" })]}>{handle.props.name}</span>
	);
}

/** Renders the visual miniature for one style export. */
export default function StyleFace(handle: Handle<StyleFace.Props>) {
	return () => {
		let { name } = handle.props;
		let body: RemixNode;

		switch (name) {
			case "balancedColumns":
				body = <BalancedColumnsFace />;
				break;
			case "balancedGrid":
				body = <BalancedGridFace />;
				break;
			case "byChildCount":
				body = <ByChildCountFace />;
				break;
			case "cardGrid":
				body = <CardGridFace />;
				break;
			case "cardMedia":
				body = <CardMediaFace />;
				break;
			case "cardPadding":
				body = <CardPaddingFace />;
				break;
			case "iconTile":
				body = <IconTileFace />;
				break;
			case "concentricRadius":
				body = <ConcentricRadiusFace />;
				break;
			case "floatingSurface":
				body = <FloatingSurfaceFace />;
				break;
			case "panelChrome":
				body = <PanelChromeFace />;
				break;
			case "surfaceInset":
				body = <SurfaceInsetFace />;
				break;
			case "surfaceControl":
				body = <HitAreaFace />;
				break;
			case "surfacePadding":
				body = <SurfacePaddingFace />;
				break;
			case "landingSurface":
				body = <LandingBandFace />;
				break;
			case "chartPalette":
				body = <PaletteFace />;
				break;
			case "semanticColorPanel":
				body = <SemanticPaletteFace />;
				break;
			case "displayHeading":
				body = <TypeFace kind="display" />;
				break;
			case "eyebrow":
				body = <TypeFace kind="eyebrow" />;
				break;
			case "landingLead":
				body = <TypeFace kind="lead" />;
				break;
			case "landingEmphasis":
				body = <TypeFace kind="emphasis" />;
				break;
			case "outputCaptionText":
				body = <TypeFace kind="caption" />;
				break;
			case "segmentedItem":
			case "legendToggle":
				body = <SegmentedFace />;
				break;
			case "segmentedTrack":
				body = <SegmentedTrackFace />;
				break;
			case "hitArea":
				body = <HitAreaFace />;
				break;
			case "rangeThumbAppearance":
				body = <RangeFace />;
				break;
			case "landingSlowSpin":
				body = <SlowSpinFace pace="slow" />;
				break;
			case "interactiveTransition":
				body = <SlowSpinFace pace="interactive" />;
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
			case "landingHairline":
				body = <HairlineFace />;
				break;
			case "landingBandTone":
				body = <LandingBandFace tone />;
				break;
			case "landingContainer":
				body = <LandingContainerFace />;
				break;
			case "landingSectionSpace":
				body = <LandingSectionSpaceFace />;
				break;
			case "landingCtaChrome":
				body = <LandingCtaChromeFace />;
				break;
			case "logoCloudMark":
				body = <LogoCloudMarkFace />;
				break;
			case "themeScope":
				body = <ThemeScopeFace />;
				break;
			case "graphicHostStyle":
				body = <GraphicHostFace />;
				break;
			default:
				body = <StyleFallback name={name} />;
		}

		return <ExportFaceStage>{body}</ExportFaceStage>;
	};
}
