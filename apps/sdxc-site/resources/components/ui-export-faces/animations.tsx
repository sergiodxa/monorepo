/**
 * Live faces for every `@sdxc/ui/animations` export on the package landing: the
 * looping mixins run for real, enter/exit presets cycle on a CSS timer, and the
 * token catalogues draw their curves and durations so a reader sees motion
 * before opening a reference page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, m, maxIs, p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import {
	pulse,
	scrollFade,
	scrollProgress,
	scrollShadow,
	shimmer,
	spin,
	viewReveal,
} from "@sdxc/ui/animations";
import { entrance } from "@sdxc/ui/landing";

import ExportFaceStage from "~/resources/components/ui-export-faces/stage";

namespace AnimationFace {
	export interface Props {
		name: string;
	}
}

/** Quiet brand-tinted fill behind a motion host. */
const DEMO_SURFACE = raw({
	backgroundColor: "color-mix(in oklch, var(--ui-brand-fg, CanvasText) 12%, transparent)",
	color: "var(--ui-brand-fg, CanvasText)",
});

/**
 * Catalogue durations are the real token ratios (150 : 200 : 300) stretched so
 * the eye can tell them apart — every bar fills the same track.
 */
const DURATION_STEPS = [
	{ name: "fast", ms: "150ms", play: "0.75s" },
	{ name: "normal", ms: "200ms", play: "1s" },
	{ name: "slow", ms: "300ms", play: "1.5s" },
] as const;

namespace DurationsFace {
	export interface Props {}
}

/** Three full-width bars that fill at fast / normal / slow speeds. */
function DurationsFace(_handle: Handle<DurationsFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("11rem")]}>
			{DURATION_STEPS.map((step) => (
				<div key={step.name} mix={[vstack({ gap: 1, align: "stretch" })]}>
					<span
						mix={[
							font("mono"),
							text("xs"),
							raw({
								color: "var(--ui-neutral-fg)",
								opacity: "0.7",
								display: "flex",
								justifyContent: "space-between",
								gap: "0.5rem",
							}),
						]}
					>
						<span>{step.name}</span>
						<span>{step.ms}</span>
					</span>
					<div
						mix={[
							bs("0.45rem"),
							raw({
								borderRadius: "9999px",
								backgroundColor: "color-mix(in oklch, CanvasText 8%, transparent)",
								overflow: "hidden",
							}),
						]}
					>
						<div
							mix={[
								bs("100%"),
								keyframes("ui-export-duration-fill", {
									"0%": { inlineSize: "0%" },
									"100%": { inlineSize: "100%" },
								}),
								raw({
									inlineSize: "0%",
									borderRadius: "inherit",
									backgroundColor: "var(--ui-brand-fg, CanvasText)",
									animationName: "ui-export-duration-fill",
									animationDuration: step.play,
									animationTimingFunction: "linear",
									animationIterationCount: "infinite",
									animationDirection: "alternate",
								}),
							]}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

namespace EasingsFace {
	export interface Props {}
}

/** Four easing dots that travel the same track on different curves. */
function EasingsFace(_handle: Handle<EasingsFace.Props>) {
	return () => {
		let curves = [
			{ name: "standard", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
			{ name: "decelerate", easing: "cubic-bezier(0, 0, 0.2, 1)" },
			{ name: "accelerate", easing: "cubic-bezier(0.4, 0, 1, 1)" },
			{ name: "linear", easing: "linear" },
		] as const;

		return (
			<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("11rem")]}>
				{curves.map((curve) => (
					<div
						key={curve.name}
						mix={[hstack({ gap: 2, align: "center" }), raw({ minBlockSize: "0.85rem" })]}
					>
						<span
							mix={[
								font("mono"),
								raw({
									inlineSize: "4.6rem",
									flexShrink: "0",
									opacity: "0.7",
									fontSize: "0.55rem",
									lineHeight: "1",
									color: "var(--ui-neutral-emphasis, CanvasText)",
								}),
							]}
						>
							{curve.name}
						</span>
						<div
							mix={[
								raw({
									position: "relative",
									flex: "1",
									minInlineSize: "0",
									blockSize: "0.45rem",
									borderRadius: "9999px",
									backgroundColor: "color-mix(in oklch, CanvasText 8%, transparent)",
								}),
							]}
						>
							<span
								mix={[
									keyframes("ui-export-easing-travel", {
										from: { insetInlineStart: "0.05rem" },
										to: { insetInlineStart: "calc(100% - 0.5rem)" },
									}),
									raw({
										position: "absolute",
										insetBlockStart: "50%",
										insetInlineStart: "0.05rem",
										translate: "0 -50%",
										inlineSize: "0.45rem",
										blockSize: "0.45rem",
										borderRadius: "9999px",
										backgroundColor: "var(--ui-brand-fg, CanvasText)",
										animationName: "ui-export-easing-travel",
										animationDuration: "1.6s",
										animationTimingFunction: curve.easing,
										animationIterationCount: "infinite",
										animationDirection: "alternate",
									}),
								]}
							/>
						</div>
					</div>
				))}
			</div>
		);
	};
}

namespace MotionLoopFace {
	export interface Props {
		kind: "fade" | "zoom" | "slide" | "enterExit";
	}
}

/**
 * Enter/exit presets gate on platform open state a static tile cannot toggle,
 * so the face loops the same opacity/scale/translate the factory would produce.
 */
function MotionLoopFace(handle: Handle<MotionLoopFace.Props>) {
	return () => {
		let { kind } = handle.props;
		let frames: Record<string, Record<string, string>>;
		if (kind === "fade") {
			frames = {
				"0%, 15%": { opacity: "0" },
				"35%, 65%": { opacity: "1" },
				"85%, 100%": { opacity: "0" },
			};
		} else if (kind === "zoom") {
			frames = {
				"0%, 15%": { opacity: "0", scale: "0.92" },
				"35%, 65%": { opacity: "1", scale: "1" },
				"85%, 100%": { opacity: "0", scale: "0.96" },
			};
		} else if (kind === "slide") {
			frames = {
				"0%, 15%": { opacity: "0", translate: "0 0.6rem" },
				"35%, 65%": { opacity: "1", translate: "0 0" },
				"85%, 100%": { opacity: "0", translate: "0 0.3rem" },
			};
		} else {
			frames = {
				"0%, 15%": { opacity: "0", scale: "0.94", translate: "0 0.4rem" },
				"35%, 65%": { opacity: "1", scale: "1", translate: "0 0" },
				"85%, 100%": { opacity: "0", scale: "0.97", filter: "blur(2px)" },
			};
		}

		return (
			<div
				mix={[
					is("3.25rem"),
					bs("3.25rem"),
					DEMO_SURFACE,
					raw({ borderRadius: "0.85rem" }),
					keyframes(`ui-export-motion-${kind}`, frames),
					raw({
						animationName: `ui-export-motion-${kind}`,
						animationDuration: "2.4s",
						animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
						animationIterationCount: "infinite",
					}),
				]}
				aria-hidden="true"
			/>
		);
	};
}

namespace ScrollDemo {
	export interface Props {
		children: RemixNode;
		height?: string;
	}
}

/** A short scrollport that carries a real scroll-driven mixin. */
function ScrollDemo(handle: Handle<ScrollDemo.Props>) {
	return () => {
		let { children, height = "6.5rem" } = handle.props;

		return (
			<div
				mix={[
					is("100%"),
					maxIs("10rem"),
					bs(height),
					overflow("auto"),
					raw({
						borderRadius: "0.65rem",
						border: "1px solid var(--ui-neutral-border)",
						backgroundColor: "color-mix(in oklch, Canvas 92%, CanvasText)",
					}),
				]}
			>
				{children}
			</div>
		);
	};
}

namespace ScrollLines {
	export interface Props {
		count?: number;
	}
}

/** Lines of filler so a scroll demo has somewhere to travel. */
function ScrollLines(handle: Handle<ScrollLines.Props>) {
	return () => {
		let count = handle.props.count ?? 8;

		return (
			<div mix={[vstack({ gap: 2, align: "stretch" }), p(3)]}>
				{Array.from({ length: count }, (_, index) => (
					<div
						key={index}
						mix={[
							bs("0.55rem"),
							raw({
								inlineSize: index % 3 === 0 ? "70%" : "100%",
								borderRadius: "9999px",
								backgroundColor: "color-mix(in oklch, CanvasText 12%, transparent)",
							}),
						]}
					/>
				))}
			</div>
		);
	};
}

namespace TextShimmerFace {
	export interface Props {}
}

/**
 * Catalogue stand-in for `textShimmer`: the real mixin paints glyphs with a
 * translucent rest tone that reads as vanished on this stage, so the tile
 * keeps opaque type and sweeps a highlight across it instead.
 */
function TextShimmerFace(_handle: Handle<TextShimmerFace.Props>) {
	return () => (
		<span
			mix={[
				font("mono"),
				text("sm"),
				weight("semibold"),
				keyframes("ui-export-text-shimmer", {
					"0%": { backgroundPosition: "100% 0" },
					"100%": { backgroundPosition: "-100% 0" },
				}),
				raw({
					color: "transparent",
					backgroundImage:
						"linear-gradient(90deg, color-mix(in oklch, var(--ui-brand-fg, CanvasText) 55%, transparent) 0%, color-mix(in oklch, var(--ui-brand-fg, CanvasText) 55%, transparent) 35%, var(--ui-brand-fg, CanvasText) 50%, color-mix(in oklch, var(--ui-brand-fg, CanvasText) 55%, transparent) 65%, color-mix(in oklch, var(--ui-brand-fg, CanvasText) 55%, transparent) 100%)",
					backgroundSize: "200% 100%",
					backgroundClip: "text",
					WebkitBackgroundClip: "text",
					animationName: "ui-export-text-shimmer",
					animationDuration: "2s",
					animationTimingFunction: "linear",
					animationIterationCount: "infinite",
					whiteSpace: "nowrap",
				}),
			]}
		>
			Generating…
		</span>
	);
}

/** Renders the live miniature for one animation export. */
export default function AnimationFace(handle: Handle<AnimationFace.Props>) {
	return () => {
		let { name } = handle.props;
		let body: RemixNode;

		switch (name) {
			case "durations":
				body = <DurationsFace />;
				break;
			case "easings":
				body = <EasingsFace />;
				break;
			case "spin":
				body = (
					<div
						mix={[
							is("2.5rem"),
							bs("2.5rem"),
							raw({
								borderRadius: "9999px",
								border: "3px solid color-mix(in oklch, CanvasText 12%, transparent)",
								borderBlockStartColor: "var(--ui-brand-fg, CanvasText)",
							}),
							spin(),
						]}
						aria-hidden="true"
					/>
				);
				break;
			case "pulse":
				body = (
					<div mix={[vstack({ gap: 2, align: "stretch" }), is("8rem")]}>
						<div
							mix={[
								bs("0.7rem"),
								pulse(),
								raw({
									borderRadius: "9999px",
									backgroundColor: "color-mix(in oklch, CanvasText 18%, transparent)",
								}),
							]}
						/>
						<div
							mix={[
								bs("0.7rem"),
								is("70%"),
								pulse({ duration: "1.9s" }),
								raw({
									borderRadius: "9999px",
									backgroundColor: "color-mix(in oklch, CanvasText 14%, transparent)",
								}),
							]}
						/>
					</div>
				);
				break;
			case "shimmer":
				body = (
					<div
						mix={[
							is("9rem"),
							bs("0.7rem"),
							raw({
								borderRadius: "9999px",
								backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 35%, transparent)",
								color: "var(--ui-brand-fg)",
								overflow: "hidden",
							}),
						]}
					>
						<progress
							mix={[
								is("100%"),
								bs("100%"),
								shimmer(),
								raw({
									appearance: "none",
									border: "none",
									background: "transparent",
									color: "inherit",
								}),
							]}
						/>
					</div>
				);
				break;
			case "textShimmer":
				body = <TextShimmerFace />;
				break;
			case "entrance":
				body = (
					<div mix={[vstack({ gap: 2, align: "start" }), is("9rem")]}>
						<div
							mix={[
								bs("0.55rem"),
								is("55%"),
								entrance({ order: 0 }),
								raw({
									borderRadius: "9999px",
									backgroundColor: "color-mix(in oklch, CanvasText 20%, transparent)",
								}),
							]}
						/>
						<div
							mix={[
								bs("0.85rem"),
								is("90%"),
								entrance({ order: 1 }),
								raw({
									borderRadius: "0.4rem",
									backgroundColor: "color-mix(in oklch, CanvasText 14%, transparent)",
								}),
							]}
						/>
						<div
							mix={[
								bs("2.4rem"),
								is("100%"),
								entrance({ order: 2, kind: "media" }),
								raw({
									borderRadius: "0.55rem",
									backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 16%, transparent)",
								}),
							]}
						/>
					</div>
				);
				break;
			case "fade":
				body = <MotionLoopFace kind="fade" />;
				break;
			case "zoom":
				body = <MotionLoopFace kind="zoom" />;
				break;
			case "slide":
				body = <MotionLoopFace kind="slide" />;
				break;
			case "enterExit":
				body = <MotionLoopFace kind="enterExit" />;
				break;
			case "scrollShadow":
				body = (
					<ScrollDemo>
						<div
							mix={[
								scrollShadow({ distance: "40px" }),
								raw({
									position: "sticky",
									insetBlockStart: "0",
									blockSize: "1.6rem",
									backgroundColor: "var(--ui-bg, Canvas)",
									zIndex: "1",
									display: "grid",
									placeItems: "center",
									fontFamily: "var(--font-mono, ui-monospace, monospace)",
									fontSize: "0.65rem",
									color: "var(--ui-neutral-fg)",
								}),
							]}
						>
							header
						</div>
						<ScrollLines />
					</ScrollDemo>
				);
				break;
			case "scrollProgress":
				body = (
					<ScrollDemo>
						<div
							mix={[
								raw({
									position: "sticky",
									insetBlockStart: "0",
									blockSize: "0.25rem",
									backgroundColor: "color-mix(in oklch, CanvasText 8%, transparent)",
									zIndex: "1",
								}),
							]}
						>
							<div
								mix={[
									bs("100%"),
									scrollProgress(),
									raw({ backgroundColor: "var(--ui-brand-fg, CanvasText)" }),
								]}
							/>
						</div>
						<ScrollLines />
					</ScrollDemo>
				);
				break;
			case "scrollFade":
				body = (
					<div
						mix={[
							is("100%"),
							maxIs("10rem"),
							bs("6.5rem"),
							overflow("auto"),
							scrollFade({ size: "1.5rem" }),
							raw({
								borderRadius: "0.65rem",
								border: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						<ScrollLines count={10} />
					</div>
				);
				break;
			case "viewReveal":
				body = (
					<ScrollDemo height="6.5rem">
						<div mix={[bs("3rem")]} />
						<div
							mix={[
								m(3),
								bs("2.5rem"),
								viewReveal({ distance: "1rem" }),
								DEMO_SURFACE,
								raw({ borderRadius: "0.65rem" }),
							]}
						/>
						<ScrollLines count={4} />
					</ScrollDemo>
				);
				break;
			default:
				body = <span mix={[font("mono"), text("xs"), raw({ opacity: "0.5" })]}>{name}</span>;
		}

		return <ExportFaceStage>{body}</ExportFaceStage>;
	};
}
