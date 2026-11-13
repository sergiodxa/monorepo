/**
 * Animated schematics for `@sdxc/ui/mixins` on the package landing: each face
 * is keyed off the export name so neighbouring tiles do not share a silhouette
 * that has nothing to do with what the mixin does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { bs, is, maxIs } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";

import ExportFaceStage from "~/resources/components/ui-export-faces/stage";

namespace MixinFace {
	export interface Props {
		name: string;
	}
}

const INK = "color-mix(in oklch, CanvasText 16%, transparent)";
const INK_STRONG = "color-mix(in oklch, CanvasText 30%, transparent)";
const BRAND = "var(--ui-brand-fg, CanvasText)";

namespace Keycaps {
	export interface Props {
		keys: string[];
	}
}

/** Flashing keycaps with the labels the mixin cares about. */
function Keycaps(handle: Handle<Keycaps.Props>) {
	return () => (
		<div mix={[hstack({ gap: 1, align: "center" })]}>
			{handle.props.keys.map((label, index) => (
				<span
					key={`${label}-${index}`}
					mix={[
						font("mono"),
						text("xs"),
						weight("semibold"),
						keyframes("ui-export-key-flash", {
							"0%, 100%": { backgroundColor: INK, transform: "translateY(0)" },
							"40%": {
								backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 22%, transparent)",
								transform: "translateY(1px)",
							},
						}),
						raw({
							minInlineSize: "1.55rem",
							paddingInline: "0.3rem",
							blockSize: "1.55rem",
							display: "grid",
							placeItems: "center",
							borderRadius: "0.4rem",
							border: `1px solid ${INK_STRONG}`,
							animationName: "ui-export-key-flash",
							animationDuration: "1.8s",
							animationDelay: `${index * 0.12}s`,
							animationIterationCount: "infinite",
						}),
					]}
				>
					{label}
				</span>
			))}
		</div>
	);
}

namespace OtpSlotsFace {
	export interface Props {}
}

/** Six digit cells — what `otpSlots` actually wires. */
function OtpSlotsFace(_handle: Handle<OtpSlotsFace.Props>) {
	return () => (
		<div mix={[hstack({ gap: 1, align: "center" })]}>
			{["1", "9", "4", "", "", ""].map((digit, index) => (
				<span
					key={index}
					mix={[
						font("mono"),
						weight("semibold"),
						raw({
							inlineSize: "1.35rem",
							blockSize: "1.7rem",
							display: "grid",
							placeItems: "center",
							borderRadius: "0.35rem",
							border: `1px solid ${index === 3 ? BRAND : INK_STRONG}`,
							backgroundColor:
								index === 3
									? "color-mix(in oklch, var(--ui-brand-fg) 12%, transparent)"
									: "color-mix(in oklch, Canvas 96%, CanvasText)",
							color: "var(--ui-neutral-emphasis, CanvasText)",
							fontSize: "0.85rem",
							boxShadow: index === 3 ? `0 0 0 1px ${BRAND}` : undefined,
						}),
						index === 3
							? [
									keyframes("ui-export-otp-caret", {
										"0%, 49%": { opacity: "1" },
										"50%, 100%": { opacity: "0.35" },
									}),
									raw({
										animationName: "ui-export-otp-caret",
										animationDuration: "1s",
										animationIterationCount: "infinite",
									}),
								]
							: null,
					]}
				>
					{digit || (index === 3 ? "|" : "")}
				</span>
			))}
		</div>
	);
}

namespace ValidateFace {
	export interface Props {}
}

/** Field that flashes valid. */
function ValidateFace(_handle: Handle<ValidateFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 1, align: "stretch" }), is("100%"), maxIs("10rem")]}>
			<div
				mix={[
					keyframes("ui-export-validate", {
						"0%, 55%": { borderColor: INK_STRONG },
						"65%, 100%": { borderColor: BRAND },
					}),
					raw({
						blockSize: "1.5rem",
						borderRadius: "0.45rem",
						border: `1px solid ${INK_STRONG}`,
						animationName: "ui-export-validate",
						animationDuration: "2.2s",
						animationIterationCount: "infinite",
					}),
				]}
			/>
			<span
				mix={[
					font("mono"),
					text("xs"),
					keyframes("ui-export-validate-label", {
						"0%, 55%": { opacity: "0" },
						"65%, 100%": { opacity: "0.7" },
					}),
					raw({
						color: BRAND,
						animationName: "ui-export-validate-label",
						animationDuration: "2.2s",
						animationIterationCount: "infinite",
					}),
				]}
			>
				Looks good
			</span>
		</div>
	);
}

namespace ClearFieldFace {
	export interface Props {}
}

/** Field with a clearing ×. */
function ClearFieldFace(_handle: Handle<ClearFieldFace.Props>) {
	return () => (
		<div
			mix={[
				hstack({ gap: 2, align: "center" }),
				is("100%"),
				maxIs("10rem"),
				raw({
					paddingInline: "0.55rem",
					paddingBlock: "0.4rem",
					borderRadius: "0.5rem",
					border: `1px solid ${INK_STRONG}`,
				}),
			]}
		>
			<span
				mix={[
					keyframes("ui-export-clear-text", {
						"0%, 45%": { opacity: "0.7", inlineSize: "4.5rem" },
						"55%, 100%": { opacity: "0", inlineSize: "0.5rem" },
					}),
					raw({
						blockSize: "0.45rem",
						borderRadius: "9999px",
						backgroundColor: INK_STRONG,
						animationName: "ui-export-clear-text",
						animationDuration: "2.4s",
						animationIterationCount: "infinite",
					}),
				]}
			/>
			<span
				mix={[
					font("mono"),
					raw({
						fontSize: "0.75rem",
						color: BRAND,
						marginInlineStart: "auto",
					}),
				]}
			>
				×
			</span>
		</div>
	);
}

namespace ConfirmPhraseFace {
	export interface Props {}
}

/** Typed confirmation phrase. */
function ConfirmPhraseFace(_handle: Handle<ConfirmPhraseFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 1, align: "stretch" }), is("100%"), maxIs("10rem")]}>
			<span mix={[font("mono"), text("xs"), raw({ opacity: "0.5" })]}>Type DELETE</span>
			<div
				mix={[
					font("mono"),
					text("xs"),
					raw({
						padding: "0.4rem 0.5rem",
						borderRadius: "0.4rem",
						border: `1px solid ${BRAND}`,
						color: "var(--ui-neutral-emphasis)",
					}),
				]}
			>
				DEL
				<span
					mix={[
						keyframes("ui-export-caret", {
							"0%, 49%": { opacity: "1" },
							"50%, 100%": { opacity: "0" },
						}),
						raw({
							display: "inline-block",
							inlineSize: "0.1rem",
							blockSize: "0.85em",
							backgroundColor: BRAND,
							verticalAlign: "text-bottom",
							marginInlineStart: "0.1rem",
							animationName: "ui-export-caret",
							animationDuration: "1s",
							animationIterationCount: "infinite",
						}),
					]}
				/>
			</div>
		</div>
	);
}

namespace FilterFace {
	export interface Props {
		label: string;
	}
}

/** Filter / combobox query field. */
function FilterFace(handle: Handle<FilterFace.Props>) {
	return () => (
		<div
			mix={[
				hstack({ gap: 2, align: "center" }),
				is("100%"),
				maxIs("10rem"),
				raw({
					paddingInline: "0.65rem",
					paddingBlock: "0.45rem",
					borderRadius: "0.55rem",
					border: `1px solid ${INK_STRONG}`,
					backgroundColor: "color-mix(in oklch, Canvas 94%, CanvasText)",
				}),
			]}
		>
			<span mix={[font("mono"), text("xs"), raw({ opacity: "0.55" })]}>{handle.props.label}</span>
			<span
				mix={[
					keyframes("ui-export-caret", {
						"0%, 49%": { opacity: "1" },
						"50%, 100%": { opacity: "0" },
					}),
					raw({
						inlineSize: "0.1rem",
						blockSize: "0.85rem",
						backgroundColor: BRAND,
						animationName: "ui-export-caret",
						animationDuration: "1s",
						animationIterationCount: "infinite",
					}),
				]}
			/>
		</div>
	);
}

namespace DragFace {
	export interface Props {
		kind: "reorder" | "drop";
	}
}

/** Drag reorder row or drop zone. */
function DragFace(handle: Handle<DragFace.Props>) {
	return () => {
		if (handle.props.kind === "drop") {
			return (
				<div
					mix={[
						keyframes("ui-export-drop", {
							"0%, 100%": { borderColor: INK_STRONG },
							"50%": { borderColor: BRAND },
						}),
						raw({
							inlineSize: "100%",
							maxInlineSize: "9rem",
							blockSize: "3.4rem",
							borderRadius: "0.55rem",
							border: `1.5px dashed ${INK_STRONG}`,
							display: "grid",
							placeItems: "center",
							animationName: "ui-export-drop",
							animationDuration: "2s",
							animationIterationCount: "infinite",
						}),
					]}
				>
					<span mix={[font("mono"), text("xs"), raw({ opacity: "0.55" })]}>Drop</span>
				</div>
			);
		}

		return (
			<div
				mix={[
					hstack({ gap: 2, align: "center" }),
					is("100%"),
					maxIs("10rem"),
					keyframes("ui-export-drag", {
						"0%, 100%": { translate: "0 0" },
						"50%": { translate: "0.35rem -0.25rem" },
					}),
					raw({
						padding: "0.45rem 0.55rem",
						borderRadius: "0.55rem",
						border: `1px solid ${INK_STRONG}`,
						backgroundColor: "color-mix(in oklch, Canvas 94%, CanvasText)",
						boxShadow: "0 6px 14px -10px rgb(0 0 0 / 0.4)",
						animationName: "ui-export-drag",
						animationDuration: "2s",
						animationIterationCount: "infinite",
					}),
				]}
			>
				<div mix={[vstack({ gap: 1, align: "stretch" })]}>
					{[0, 1, 2].map((dot) => (
						<span
							key={dot}
							mix={[
								raw({
									inlineSize: "0.9rem",
									blockSize: "0.12rem",
									borderRadius: "9999px",
									backgroundColor: INK_STRONG,
								}),
							]}
						/>
					))}
				</div>
				<div
					mix={[
						raw({
							flex: "1",
							blockSize: "0.55rem",
							borderRadius: "9999px",
							backgroundColor: INK,
						}),
					]}
				/>
			</div>
		);
	};
}

namespace SortableFace {
	export interface Props {}
}

/** Two lists, with a card lifting out of the first and settling at the top of the second. */
function SortableFace(_handle: Handle<SortableFace.Props>) {
	return () => (
		<div mix={[hstack({ gap: 2, align: "start" }), is("100%"), maxIs("10rem")]}>
			{[0, 1].map((column) => (
				<div
					key={column}
					mix={[
						vstack({ gap: 1, align: "stretch" }),
						raw({
							flex: "1",
							padding: "0.3rem",
							borderRadius: "0.45rem",
							backgroundColor: "color-mix(in oklch, CanvasText 6%, transparent)",
							position: "relative",
							minBlockSize: "3.2rem",
						}),
					]}
				>
					{(column === 0 ? [0, 1] : [0]).map((card) => (
						<span
							key={card}
							mix={[
								raw({
									blockSize: "0.7rem",
									borderRadius: "0.3rem",
									border: `1px solid ${INK_STRONG}`,
									backgroundColor: "Canvas",
								}),
							]}
						/>
					))}
					{column === 0 ? (
						<span
							mix={[
								keyframes("ui-export-sortable", {
									"0%, 15%": { translate: "0 0", rotate: "0deg" },
									"45%, 55%": { translate: "60% -0.5rem", rotate: "3deg" },
									"85%, 100%": { translate: "calc(100% + 0.5rem) -1.4rem", rotate: "0deg" },
								}),
								raw({
									position: "absolute",
									insetInline: "0.3rem",
									insetBlockEnd: "0.3rem",
									blockSize: "0.7rem",
									borderRadius: "0.3rem",
									border: `1px solid ${BRAND}`,
									backgroundColor: "Canvas",
									boxShadow: "0 6px 12px -8px rgb(0 0 0 / 0.45)",
									animationName: "ui-export-sortable",
									animationDuration: "2.6s",
									animationIterationCount: "infinite",
									animationDirection: "alternate",
								}),
							]}
						/>
					) : null}
				</div>
			))}
		</div>
	);
}

namespace InvokerFieldsFace {
	export interface Props {}
}

/** A button whose value lands in the field of the dialog it opens. */
function InvokerFieldsFace(_handle: Handle<InvokerFieldsFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("10rem")]}>
			<span
				mix={[
					font("mono"),
					text("xs"),
					raw({
						alignSelf: "start",
						paddingInline: "0.45rem",
						paddingBlock: "0.15rem",
						borderRadius: "0.35rem",
						border: `1px solid ${BRAND}`,
						color: BRAND,
					}),
				]}
			>
				+ Done
			</span>
			<div
				mix={[
					hstack({ gap: 2, align: "center" }),
					raw({
						paddingInline: "0.5rem",
						paddingBlock: "0.35rem",
						borderRadius: "0.45rem",
						border: `1px solid ${INK_STRONG}`,
					}),
				]}
			>
				<span
					mix={[
						font("mono"),
						text("xs"),
						keyframes("ui-export-invoker-value", {
							"0%, 35%": { opacity: "0.35", translate: "0 -0.3rem" },
							"55%, 100%": { opacity: "1", translate: "0 0", color: BRAND },
						}),
						raw({
							animationName: "ui-export-invoker-value",
							animationDuration: "2.4s",
							animationIterationCount: "infinite",
						}),
					]}
				>
					Done
				</span>
				<span mix={[font("mono"), text("xs"), raw({ marginInlineStart: "auto", opacity: "0.55" })]}>
					⌄
				</span>
			</div>
		</div>
	);
}

namespace GanttTodayFace {
	export interface Props {}
}

/** A timeline sliding sideways until today's line settles a third of the way across. */
function GanttTodayFace(_handle: Handle<GanttTodayFace.Props>) {
	return () => (
		<div
			mix={[
				is("100%"),
				maxIs("10rem"),
				raw({
					position: "relative",
					blockSize: "3.2rem",
					overflow: "hidden",
					borderRadius: "0.45rem",
					border: `1px solid ${INK}`,
				}),
			]}
		>
			<div
				mix={[
					keyframes("ui-export-gantt-today", {
						"0%, 20%": { translate: "0 0" },
						"70%, 100%": { translate: "-55% 0" },
					}),
					raw({
						position: "absolute",
						insetBlock: "0",
						insetInlineStart: "0",
						inlineSize: "220%",
						animationName: "ui-export-gantt-today",
						animationDuration: "3s",
						animationIterationCount: "infinite",
						animationDirection: "alternate",
						animationTimingFunction: "ease-in-out",
					}),
				]}
			>
				{[
					{ start: "6%", width: "28%", top: "0.55rem" },
					{ start: "40%", width: "34%", top: "1.45rem" },
					{ start: "78%", width: "18%", top: "2.3rem" },
				].map((bar) => (
					<span
						key={bar.start}
						mix={[
							raw({
								position: "absolute",
								insetInlineStart: bar.start,
								inlineSize: bar.width,
								insetBlockStart: bar.top,
								blockSize: "0.45rem",
								borderRadius: "9999px",
								backgroundColor: INK_STRONG,
							}),
						]}
					/>
				))}
				<span
					mix={[
						raw({
							position: "absolute",
							insetBlock: "0",
							insetInlineStart: "62%",
							inlineSize: "1.5px",
							backgroundColor: BRAND,
						}),
					]}
				/>
			</div>
		</div>
	);
}

namespace ResizeFace {
	export interface Props {}
}

/** Split pane with a moving sash. */
function ResizeFace(_handle: Handle<ResizeFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "1fr 0.2rem 1.2fr",
					inlineSize: "100%",
					maxInlineSize: "10rem",
					blockSize: "3.5rem",
					borderRadius: "0.55rem",
					overflow: "hidden",
					border: `1px solid ${INK_STRONG}`,
				}),
			]}
		>
			<div mix={[raw({ backgroundColor: INK })]} />
			<div
				mix={[
					keyframes("ui-export-sash", {
						"0%, 100%": { backgroundColor: BRAND },
						"50%": { backgroundColor: INK_STRONG },
					}),
					raw({
						backgroundColor: BRAND,
						animationName: "ui-export-sash",
						animationDuration: "1.6s",
						animationIterationCount: "infinite",
					}),
				]}
			/>
			<div mix={[raw({ backgroundColor: "color-mix(in oklch, CanvasText 8%, transparent)" })]} />
		</div>
	);
}

namespace CopyFace {
	export interface Props {}
}

/** Clipboard flash. */
function CopyFace(_handle: Handle<CopyFace.Props>) {
	return () => (
		<div mix={[raw({ position: "relative", inlineSize: "2.4rem", blockSize: "2.8rem" })]}>
			<div
				mix={[
					raw({
						position: "absolute",
						inset: "0.35rem 0 0 0.35rem",
						borderRadius: "0.35rem",
						border: `1px solid ${INK_STRONG}`,
						backgroundColor: "color-mix(in oklch, Canvas 94%, CanvasText)",
					}),
				]}
			/>
			<div
				mix={[
					keyframes("ui-export-copy", {
						"0%, 55%": { opacity: "0.35", scale: "0.92" },
						"65%, 100%": { opacity: "1", scale: "1" },
					}),
					raw({
						position: "absolute",
						inset: "0 0.35rem 0.35rem 0",
						borderRadius: "0.35rem",
						border: `1px solid ${INK_STRONG}`,
						backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 14%, Canvas)",
						animationName: "ui-export-copy",
						animationDuration: "2.2s",
						animationIterationCount: "infinite",
					}),
				]}
			/>
		</div>
	);
}

namespace StreamFace {
	export interface Props {}
}

/** A reply's lines filling in one after another, as a streamed answer arrives. */
function StreamFace(_handle: Handle<StreamFace.Props>) {
	return () => (
		<div mix={[raw({ display: "grid", gap: "0.35rem", inlineSize: "5.5rem" })]}>
			{[100, 86, 58].map((width, index) => (
				<span
					key={index}
					mix={[
						keyframes("ui-export-stream", {
							"0%": { clipPath: "inset(0 100% 0 0)" },
							"30%, 100%": { clipPath: "inset(0 0 0 0)" },
						}),
						raw({
							display: "block",
							blockSize: "0.4rem",
							inlineSize: `${width}%`,
							borderRadius: "999px",
							backgroundColor:
								index === 0 ? INK_STRONG : "color-mix(in oklch, var(--ui-brand-fg) 45%, Canvas)",
							animationName: "ui-export-stream",
							animationDuration: "2.4s",
							animationDelay: `${index * 0.6}s`,
							animationFillMode: "both",
							animationIterationCount: "infinite",
						}),
					]}
				/>
			))}
		</div>
	);
}

namespace ToastFace {
	export interface Props {
		kind: "stack" | "hold" | "close" | "action";
	}
}

/** Toast stack / hold / close / action variants. */
function ToastFace(handle: Handle<ToastFace.Props>) {
	return () => {
		let { kind } = handle.props;

		if (kind === "close") {
			return (
				<div
					mix={[
						hstack({ gap: 2, align: "center" }),
						raw({
							padding: "0.45rem 0.55rem",
							borderRadius: "0.5rem",
							backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 14%, Canvas)",
							boxShadow: `0 0 0 1px ${INK}`,
							inlineSize: "7.5rem",
						}),
					]}
				>
					<span
						mix={[
							raw({
								flex: "1",
								blockSize: "0.4rem",
								borderRadius: "9999px",
								backgroundColor: INK_STRONG,
							}),
						]}
					/>
					<span mix={[font("mono"), raw({ fontSize: "0.75rem", color: BRAND })]}>×</span>
				</div>
			);
		}

		if (kind === "action") {
			return (
				<div
					mix={[
						hstack({ gap: 2, align: "center" }),
						raw({
							padding: "0.45rem 0.55rem",
							borderRadius: "0.5rem",
							backgroundColor: "color-mix(in oklch, Canvas 94%, CanvasText)",
							boxShadow: `0 0 0 1px ${INK}`,
							inlineSize: "8rem",
						}),
					]}
				>
					<span
						mix={[
							raw({
								flex: "1",
								blockSize: "0.4rem",
								borderRadius: "9999px",
								backgroundColor: INK,
							}),
						]}
					/>
					<span
						mix={[
							font("mono"),
							text("xs"),
							raw({
								paddingInline: "0.35rem",
								paddingBlock: "0.15rem",
								borderRadius: "0.3rem",
								backgroundColor: BRAND,
								color: "Canvas",
								fontSize: "0.55rem",
							}),
						]}
					>
						Undo
					</span>
				</div>
			);
		}

		if (kind === "hold") {
			return (
				<div
					mix={[
						raw({
							position: "relative",
							inlineSize: "8rem",
							blockSize: "1.6rem",
							borderRadius: "0.5rem",
							backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 14%, Canvas)",
							boxShadow: `0 0 0 1px ${INK}`,
							overflow: "hidden",
						}),
					]}
				>
					<span
						mix={[
							keyframes("ui-export-hold", {
								from: { inlineSize: "100%" },
								to: { inlineSize: "0%" },
							}),
							raw({
								position: "absolute",
								insetBlockEnd: "0",
								insetInlineStart: "0",
								blockSize: "0.15rem",
								backgroundColor: BRAND,
								animationName: "ui-export-hold",
								animationDuration: "2.5s",
								animationTimingFunction: "linear",
								animationIterationCount: "infinite",
							}),
						]}
					/>
				</div>
			);
		}

		return (
			<div mix={[raw({ position: "relative", inlineSize: "8rem", blockSize: "3.2rem" })]}>
				{[0, 1].map((index) => (
					<div
						key={index}
						mix={[
							keyframes("ui-export-toast", {
								"0%, 100%": { translate: "0 0", opacity: "0.7" },
								"50%": { translate: "0 -0.2rem", opacity: "1" },
							}),
							raw({
								position: "absolute",
								insetInline: `${index * 0.3}rem`,
								insetBlockStart: `${index * 0.55}rem`,
								blockSize: "1.5rem",
								borderRadius: "0.5rem",
								backgroundColor:
									index === 1
										? "color-mix(in oklch, var(--ui-brand-fg) 18%, Canvas)"
										: "color-mix(in oklch, Canvas 92%, CanvasText)",
								boxShadow: `0 0 0 1px ${INK}`,
								animationName: "ui-export-toast",
								animationDuration: "2s",
								animationDelay: `${index * 0.2}s`,
								animationIterationCount: "infinite",
							}),
						]}
					/>
				))}
			</div>
		);
	};
}

namespace ColorFace {
	export interface Props {
		kind: "area" | "wheel" | "preview" | "channel" | "tooltip" | "palette";
	}
}

/** Color-related mixin schematics. */
function ColorFace(handle: Handle<ColorFace.Props>) {
	return () => {
		let { kind } = handle.props;

		if (kind === "preview") {
			return (
				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<span
						mix={[
							raw({
								inlineSize: "2rem",
								blockSize: "2rem",
								borderRadius: "0.45rem",
								backgroundColor: BRAND,
								boxShadow: `0 0 0 1px ${INK_STRONG}`,
							}),
						]}
					/>
					<span mix={[font("mono"), text("xs"), raw({ opacity: "0.6" })]}>#3B82F6</span>
				</div>
			);
		}

		if (kind === "channel" || kind === "palette") {
			let channels = [
				{ ch: "R", tone: "oklch(0.65 0.2 25)" },
				{ ch: "G", tone: "oklch(0.7 0.17 145)" },
				{ ch: "B", tone: "oklch(0.65 0.18 255)" },
			] as const;

			return (
				<div mix={[hstack({ gap: 1, align: "end" })]}>
					{channels.map((channel, index) => (
						<div key={channel.ch} mix={[vstack({ gap: 1, align: "center" })]}>
							<div
								mix={[
									raw({
										inlineSize: "0.85rem",
										blockSize: `${1.5 + index * 0.45}rem`,
										borderRadius: "0.25rem",
										backgroundColor: channel.tone,
									}),
								]}
							/>
							<span mix={[font("mono"), raw({ fontSize: "0.5rem", opacity: "0.55" })]}>
								{channel.ch}
							</span>
						</div>
					))}
				</div>
			);
		}

		if (kind === "tooltip") {
			return (
				<div mix={[vstack({ gap: 1, align: "center" })]}>
					<span
						mix={[
							raw({
								inlineSize: "1.2rem",
								blockSize: "1.2rem",
								borderRadius: "0.25rem",
								backgroundColor: BRAND,
							}),
						]}
					/>
					<span
						mix={[
							font("mono"),
							text("xs"),
							raw({
								paddingInline: "0.4rem",
								paddingBlock: "0.2rem",
								borderRadius: "0.3rem",
								backgroundColor: "color-mix(in oklch, Canvas 92%, CanvasText)",
								boxShadow: `0 0 0 1px ${INK_STRONG}`,
							}),
						]}
					>
						42%
					</span>
				</div>
			);
		}

		if (kind === "wheel") {
			return (
				<div
					mix={[
						raw({
							inlineSize: "3.4rem",
							blockSize: "3.4rem",
							borderRadius: "9999px",
							background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
							padding: "0.45rem",
						}),
					]}
				>
					<div
						mix={[
							raw({
								blockSize: "100%",
								borderRadius: "9999px",
								backgroundColor: "var(--ui-bg, Canvas)",
							}),
						]}
					/>
				</div>
			);
		}

		return (
			<div
				mix={[
					raw({
						position: "relative",
						inlineSize: "5.5rem",
						blockSize: "3.5rem",
						borderRadius: "0.55rem",
						backgroundImage:
							"linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, var(--ui-brand-fg, #3b82f6))",
						overflow: "hidden",
					}),
				]}
			>
				<span
					mix={[
						keyframes("ui-export-color-thumb", {
							"0%, 100%": { insetInlineStart: "55%", insetBlockStart: "40%" },
							"50%": { insetInlineStart: "70%", insetBlockStart: "28%" },
						}),
						raw({
							position: "absolute",
							inlineSize: "0.7rem",
							blockSize: "0.7rem",
							borderRadius: "9999px",
							border: "2px solid Canvas",
							boxShadow: "0 0 0 1px rgb(0 0 0 / 0.35)",
							translate: "-50% -50%",
							animationName: "ui-export-color-thumb",
							animationDuration: "2.4s",
							animationIterationCount: "infinite",
						}),
					]}
				/>
			</div>
		);
	};
}

namespace ToggleFace {
	export interface Props {
		kind: "switch" | "check" | "theme";
	}
}

/** Toggle / checked / theme schematics. */
function ToggleFace(handle: Handle<ToggleFace.Props>) {
	return () => {
		let { kind } = handle.props;

		if (kind === "check") {
			return (
				<span
					mix={[
						raw({
							inlineSize: "1.5rem",
							blockSize: "1.5rem",
							borderRadius: "0.35rem",
							border: `1px solid ${BRAND}`,
							backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 18%, transparent)",
							display: "grid",
							placeItems: "center",
							color: BRAND,
							fontSize: "0.85rem",
							fontWeight: "700",
						}),
					]}
				>
					✓
				</span>
			);
		}

		if (kind === "theme") {
			return (
				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<span
						mix={[
							raw({
								inlineSize: "1.4rem",
								blockSize: "1.4rem",
								borderRadius: "9999px",
								backgroundColor: "oklch(0.9 0.08 90)",
								boxShadow: `0 0 0 1px ${INK_STRONG}`,
							}),
						]}
					/>
					<span mix={[raw({ color: INK_STRONG })]}>→</span>
					<span
						mix={[
							raw({
								inlineSize: "1.4rem",
								blockSize: "1.4rem",
								borderRadius: "9999px",
								backgroundColor: "oklch(0.35 0.04 260)",
								boxShadow: `0 0 0 1px ${INK_STRONG}`,
							}),
						]}
					/>
				</div>
			);
		}

		return (
			<div
				mix={[
					raw({
						position: "relative",
						inlineSize: "2.8rem",
						blockSize: "1.55rem",
						borderRadius: "9999px",
						backgroundColor: INK,
						overflow: "hidden",
					}),
				]}
			>
				<span
					mix={[
						keyframes("ui-export-toggle", {
							"0%, 40%": {
								insetInlineStart: "0.15rem",
								backgroundColor: "color-mix(in oklch, Canvas 96%, CanvasText)",
							},
							"55%, 100%": {
								insetInlineStart: "1.35rem",
								backgroundColor: BRAND,
							},
						}),
						raw({
							position: "absolute",
							insetBlockStart: "0.15rem",
							inlineSize: "1.25rem",
							blockSize: "1.25rem",
							borderRadius: "9999px",
							animationName: "ui-export-toggle",
							animationDuration: "2.4s",
							animationIterationCount: "infinite",
							animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
						}),
					]}
				/>
			</div>
		);
	};
}

namespace SyncFace {
	export interface Props {
		kind: "pulse" | "clock" | "refresh" | "save" | "live" | "follow";
	}
}

/** Sync / persist / live / time schematics. */
function SyncFace(handle: Handle<SyncFace.Props>) {
	return () => {
		let { kind } = handle.props;

		if (kind === "clock") {
			return (
				<div
					mix={[
						raw({
							position: "relative",
							inlineSize: "2.4rem",
							blockSize: "2.4rem",
							borderRadius: "9999px",
							border: `2px solid ${INK_STRONG}`,
						}),
					]}
				>
					<span
						mix={[
							keyframes("ui-export-clock", {
								from: { transform: "rotate(0deg)" },
								to: { transform: "rotate(360deg)" },
							}),
							raw({
								position: "absolute",
								insetBlockStart: "50%",
								insetInlineStart: "50%",
								inlineSize: "0.12rem",
								blockSize: "0.7rem",
								backgroundColor: BRAND,
								transformOrigin: "bottom center",
								translate: "-50% -100%",
								animationName: "ui-export-clock",
								animationDuration: "4s",
								animationTimingFunction: "linear",
								animationIterationCount: "infinite",
							}),
						]}
					/>
				</div>
			);
		}

		if (kind === "refresh") {
			return (
				<span
					mix={[
						keyframes("ui-export-refresh-mix", {
							from: { transform: "rotate(0deg)" },
							to: { transform: "rotate(360deg)" },
						}),
						raw({
							inlineSize: "1.6rem",
							blockSize: "1.6rem",
							borderRadius: "9999px",
							border: `2px solid ${INK}`,
							borderBlockStartColor: BRAND,
							animationName: "ui-export-refresh-mix",
							animationDuration: "1.4s",
							animationTimingFunction: "linear",
							animationIterationCount: "infinite",
						}),
					]}
				/>
			);
		}

		if (kind === "save") {
			return (
				<div
					mix={[
						raw({
							inlineSize: "2.2rem",
							blockSize: "2.4rem",
							borderRadius: "0.35rem",
							border: `1px solid ${INK_STRONG}`,
							backgroundColor: "color-mix(in oklch, Canvas 94%, CanvasText)",
							display: "grid",
							gridTemplateRows: "0.7rem 1fr",
						}),
					]}
				>
					<div mix={[raw({ backgroundColor: INK, borderRadius: "0.3rem 0.3rem 0 0" })]} />
					<div
						mix={[
							raw({
								margin: "0.25rem",
								borderRadius: "0.2rem",
								backgroundColor: BRAND,
								opacity: "0.5",
							}),
						]}
					/>
				</div>
			);
		}

		if (kind === "follow") {
			return (
				<div
					mix={[
						raw({
							position: "relative",
							inlineSize: "6rem",
							blockSize: "2.2rem",
							borderRadius: "0.4rem",
							border: `1px solid ${INK_STRONG}`,
							overflow: "hidden",
						}),
					]}
				>
					<span
						mix={[
							keyframes("ui-export-msg-follow", {
								"0%, 100%": { insetBlockStart: "0.25rem" },
								"50%": { insetBlockStart: "1.1rem" },
							}),
							raw({
								position: "absolute",
								insetInline: "0.4rem",
								blockSize: "0.5rem",
								borderRadius: "9999px",
								backgroundColor: BRAND,
								animationName: "ui-export-msg-follow",
								animationDuration: "2s",
								animationIterationCount: "infinite",
							}),
						]}
					/>
				</div>
			);
		}

		if (kind === "live") {
			return (
				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<span
						mix={[
							keyframes("ui-export-live", {
								"0%, 100%": { opacity: "0.4", scale: "1" },
								"50%": { opacity: "1", scale: "1.15" },
							}),
							raw({
								inlineSize: "0.65rem",
								blockSize: "0.65rem",
								borderRadius: "9999px",
								backgroundColor: "oklch(0.65 0.2 25)",
								animationName: "ui-export-live",
								animationDuration: "1.2s",
								animationIterationCount: "infinite",
							}),
						]}
					/>
					<span mix={[font("mono"), text("xs"), raw({ opacity: "0.6" })]}>live</span>
				</div>
			);
		}

		return (
			<div mix={[hstack({ gap: 3, align: "center" }), raw({ position: "relative" })]}>
				<span
					mix={[
						keyframes("ui-export-sync-link", {
							"0%, 100%": { opacity: "0.25", scaleX: "0.7" },
							"50%": { opacity: "1", scaleX: "1" },
						}),
						raw({
							position: "absolute",
							insetInline: "1.4rem",
							blockSize: "0.12rem",
							borderRadius: "9999px",
							backgroundColor: BRAND,
							animationName: "ui-export-sync-link",
							animationDuration: "1.6s",
							animationIterationCount: "infinite",
						}),
					]}
				/>
				{[0, 1].map((index) => (
					<span
						key={index}
						mix={[
							keyframes("ui-export-sync-node", {
								"0%, 100%": { scale: "1", opacity: "0.7" },
								"50%": { scale: "1.08", opacity: "1" },
							}),
							raw({
								inlineSize: "1.15rem",
								blockSize: "1.15rem",
								borderRadius: "9999px",
								backgroundColor: index === 0 ? BRAND : INK_STRONG,
								animationName: "ui-export-sync-node",
								animationDuration: "1.6s",
								animationDelay: `${index * 0.3}s`,
								animationIterationCount: "infinite",
								zIndex: "1",
							}),
						]}
					/>
				))}
			</div>
		);
	};
}

namespace MenuFace {
	export interface Props {}
}

/** Nested menu layers. */
function MenuFace(_handle: Handle<MenuFace.Props>) {
	return () => (
		<div mix={[raw({ position: "relative", inlineSize: "7.5rem", blockSize: "3.8rem" })]}>
			<div
				mix={[
					raw({
						position: "absolute",
						insetInlineStart: "0",
						insetBlockStart: "0",
						inlineSize: "4.2rem",
						blockSize: "3.2rem",
						borderRadius: "0.45rem",
						border: `1px solid ${INK_STRONG}`,
						backgroundColor: "color-mix(in oklch, Canvas 94%, CanvasText)",
					}),
				]}
			/>
			<div
				mix={[
					keyframes("ui-export-menu", {
						"0%, 25%": { opacity: "0", scale: "0.96" },
						"40%, 100%": { opacity: "1", scale: "1" },
					}),
					raw({
						position: "absolute",
						insetInlineStart: "3.2rem",
						insetBlockStart: "0.7rem",
						inlineSize: "4rem",
						blockSize: "2.6rem",
						borderRadius: "0.45rem",
						border: `1px solid ${INK_STRONG}`,
						backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 10%, Canvas)",
						boxShadow: "0 8px 16px -12px rgb(0 0 0 / 0.45)",
						animationName: "ui-export-menu",
						animationDuration: "2.6s",
						animationIterationCount: "infinite",
					}),
				]}
			/>
		</div>
	);
}

namespace NavFace {
	export interface Props {
		kind: "tabs" | "toc" | "shell" | "list" | "tree" | "table";
	}
}

/** Navigation / selection schematics. */
function NavFace(handle: Handle<NavFace.Props>) {
	return () => {
		let { kind } = handle.props;

		if (kind === "toc" || kind === "list") {
			return (
				<div mix={[vstack({ gap: 1, align: "stretch" }), is("100%"), maxIs("8rem")]}>
					{[0, 1, 2, 3].map((index) => (
						<div
							key={index}
							mix={[
								raw({
									blockSize: "0.4rem",
									inlineSize: `${90 - index * 12}%`,
									borderRadius: "9999px",
									backgroundColor: index === 1 ? BRAND : INK,
									marginInlineStart: index > 0 ? "0.5rem" : "0",
								}),
							]}
						/>
					))}
				</div>
			);
		}

		if (kind === "shell") {
			return (
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "1.4rem 1fr",
							inlineSize: "100%",
							maxInlineSize: "9rem",
							blockSize: "3.4rem",
							borderRadius: "0.45rem",
							overflow: "hidden",
							border: `1px solid ${INK_STRONG}`,
						}),
					]}
				>
					<div mix={[raw({ backgroundColor: INK_STRONG })]} />
					<div mix={[raw({ backgroundColor: INK })]} />
				</div>
			);
		}

		if (kind === "tree") {
			return (
				<div mix={[vstack({ gap: 1, align: "start" })]}>
					<span mix={[font("mono"), text("xs")]}>▾ root</span>
					<span mix={[font("mono"), text("xs"), raw({ paddingInlineStart: "0.75rem" })]}>
						· child
					</span>
					<span
						mix={[font("mono"), text("xs"), raw({ paddingInlineStart: "0.75rem", color: BRAND })]}
					>
						· active
					</span>
				</div>
			);
		}

		if (kind === "table") {
			return (
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "auto 1fr 1fr",
							gap: "0.25rem",
							inlineSize: "100%",
							maxInlineSize: "9rem",
						}),
					]}
				>
					{[0, 1, 2].flatMap((row) => [
						<span
							key={`c-${row}`}
							mix={[
								raw({
									inlineSize: "0.7rem",
									blockSize: "0.7rem",
									borderRadius: "0.15rem",
									border: `1px solid ${INK_STRONG}`,
									backgroundColor: row === 1 ? BRAND : "transparent",
								}),
							]}
						/>,
						<span
							key={`a-${row}`}
							mix={[
								raw({
									blockSize: "0.7rem",
									borderRadius: "0.15rem",
									backgroundColor: INK,
								}),
							]}
						/>,
						<span
							key={`b-${row}`}
							mix={[
								raw({
									blockSize: "0.7rem",
									borderRadius: "0.15rem",
									backgroundColor: INK,
								}),
							]}
						/>,
					])}
				</div>
			);
		}

		return (
			<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("10rem")]}>
				<div mix={[hstack({ gap: 3, align: "end" }), raw({ position: "relative" })]}>
					{["One", "Two", "Three"].map((label) => (
						<span key={label} mix={[font("mono"), text("xs"), raw({ opacity: "0.55" })]}>
							{label}
						</span>
					))}
					<span
						mix={[
							keyframes("ui-export-tab", {
								"0%, 30%": { insetInlineStart: "0", inlineSize: "1.4rem" },
								"40%, 70%": { insetInlineStart: "2.4rem", inlineSize: "1.5rem" },
								"80%, 100%": { insetInlineStart: "4.9rem", inlineSize: "2rem" },
							}),
							raw({
								position: "absolute",
								insetBlockEnd: "-0.25rem",
								blockSize: "0.15rem",
								borderRadius: "9999px",
								backgroundColor: BRAND,
								animationName: "ui-export-tab",
								animationDuration: "3s",
								animationIterationCount: "infinite",
							}),
						]}
					/>
				</div>
				<div mix={[bs("2rem"), raw({ borderRadius: "0.45rem", backgroundColor: INK })]} />
			</div>
		);
	};
}

namespace PressFace {
	export interface Props {
		kind: "press" | "stepper" | "range" | "attach";
	}
}

/** Press / stepper / range / attachment. */
function PressFace(handle: Handle<PressFace.Props>) {
	return () => {
		let { kind } = handle.props;

		if (kind === "stepper") {
			return (
				<div
					mix={[
						hstack({ gap: 0, align: "stretch" }),
						raw({
							borderRadius: "0.45rem",
							overflow: "hidden",
							border: `1px solid ${INK_STRONG}`,
						}),
					]}
				>
					{["−", "3", "+"].map((label) => (
						<span
							key={label}
							mix={[
								font("mono"),
								text("xs"),
								raw({
									inlineSize: "1.6rem",
									blockSize: "1.6rem",
									display: "grid",
									placeItems: "center",
									backgroundColor: label === "3" ? "transparent" : INK,
									borderInline: label === "3" ? `1px solid ${INK_STRONG}` : undefined,
								}),
							]}
						>
							{label}
						</span>
					))}
				</div>
			);
		}

		if (kind === "range") {
			return (
				<div
					mix={[
						raw({
							position: "relative",
							inlineSize: "8rem",
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
								insetInlineStart: "20%",
								inlineSize: "45%",
								borderRadius: "inherit",
								backgroundColor: BRAND,
							}),
						]}
					/>
					{["20%", "65%"].map((pos) => (
						<span
							key={pos}
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "50%",
									insetInlineStart: pos,
									translate: "-50% -50%",
									inlineSize: "0.85rem",
									blockSize: "0.85rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-bg, Canvas)",
									boxShadow: `0 0 0 2px ${BRAND}`,
								}),
							]}
						/>
					))}
				</div>
			);
		}

		if (kind === "attach") {
			return (
				<div
					mix={[
						hstack({ gap: 2, align: "center" }),
						raw({
							padding: "0.4rem 0.55rem",
							borderRadius: "0.5rem",
							border: `1px dashed ${INK_STRONG}`,
						}),
					]}
				>
					<span
						mix={[
							raw({
								inlineSize: "0.85rem",
								blockSize: "1.05rem",
								borderRadius: "0.2rem",
								border: `1.5px solid ${BRAND}`,
								borderBlockStartWidth: "0.35rem",
							}),
						]}
					/>
					<span mix={[font("mono"), text("xs"), raw({ opacity: "0.55" })]}>Attach</span>
				</div>
			);
		}

		return (
			<div
				mix={[
					raw({
						position: "relative",
						inlineSize: "2.6rem",
						blockSize: "2.6rem",
						display: "grid",
						placeItems: "center",
					}),
				]}
			>
				<span
					mix={[
						keyframes("ui-export-press-ring", {
							"0%": { scale: "0.7", opacity: "0.8" },
							"100%": { scale: "1.35", opacity: "0" },
						}),
						raw({
							position: "absolute",
							inset: "0",
							borderRadius: "9999px",
							border: `2px solid ${BRAND}`,
							animationName: "ui-export-press-ring",
							animationDuration: "1.6s",
							animationIterationCount: "infinite",
						}),
					]}
				/>
				<span
					mix={[
						raw({
							inlineSize: "1.15rem",
							blockSize: "1.15rem",
							borderRadius: "9999px",
							backgroundColor: BRAND,
						}),
					]}
				/>
			</div>
		);
	};
}

namespace FrameFace {
	export interface Props {
		kind: "refresh" | "fallback" | "transition" | "submit";
	}
}

/** Frame / image / transition schematics. */
function FrameFace(handle: Handle<FrameFace.Props>) {
	return () => {
		let { kind } = handle.props;

		if (kind === "fallback") {
			return (
				<div
					mix={[
						raw({
							inlineSize: "5rem",
							blockSize: "3.4rem",
							borderRadius: "0.45rem",
							border: `1px solid ${INK_STRONG}`,
							display: "grid",
							placeItems: "center",
							backgroundColor: INK,
							color: "var(--ui-neutral-fg)",
							opacity: "0.7",
							fontFamily: "var(--font-mono, ui-monospace, monospace)",
							fontSize: "0.65rem",
						}),
					]}
				>
					broken
				</div>
			);
		}

		if (kind === "transition") {
			return (
				<div mix={[hstack({ gap: 1, align: "center" })]}>
					<div
						mix={[
							keyframes("ui-export-vt-out", {
								"0%, 40%": { opacity: "1", scale: "1" },
								"60%, 100%": { opacity: "0", scale: "0.92" },
							}),
							raw({
								inlineSize: "2.4rem",
								blockSize: "2.4rem",
								borderRadius: "0.4rem",
								backgroundColor: INK_STRONG,
								animationName: "ui-export-vt-out",
								animationDuration: "2.4s",
								animationIterationCount: "infinite",
							}),
						]}
					/>
					<div
						mix={[
							keyframes("ui-export-vt-in", {
								"0%, 40%": { opacity: "0", scale: "1.06" },
								"60%, 100%": { opacity: "1", scale: "1" },
							}),
							raw({
								inlineSize: "2.4rem",
								blockSize: "2.4rem",
								borderRadius: "0.4rem",
								backgroundColor: BRAND,
								animationName: "ui-export-vt-in",
								animationDuration: "2.4s",
								animationIterationCount: "infinite",
							}),
						]}
					/>
				</div>
			);
		}

		return (
			<div
				mix={[
					raw({
						position: "relative",
						inlineSize: "100%",
						maxInlineSize: "10rem",
						blockSize: "3.6rem",
						borderRadius: "0.55rem",
						border: `1px solid ${INK_STRONG}`,
						overflow: "hidden",
						backgroundColor: "color-mix(in oklch, Canvas 94%, CanvasText)",
					}),
				]}
			>
				<span
					mix={[
						keyframes("ui-export-frame", {
							from: { translate: "-100% 0" },
							to: { translate: "100% 0" },
						}),
						raw({
							position: "absolute",
							insetBlock: "0",
							inlineSize: "40%",
							backgroundImage:
								"linear-gradient(90deg, transparent, color-mix(in oklch, var(--ui-brand-fg) 22%, transparent), transparent)",
							animationName: "ui-export-frame",
							animationDuration: "2s",
							animationIterationCount: "infinite",
						}),
					]}
				/>
				{kind === "submit" ? (
					<span
						mix={[
							font("mono"),
							text("xs"),
							raw({
								position: "absolute",
								inset: "0",
								display: "grid",
								placeItems: "center",
								opacity: "0.55",
							}),
						]}
					>
						submit
					</span>
				) : null}
			</div>
		);
	};
}

namespace SubmitOnChangeFace {
	export interface Props {}
}

/** Field that auto-submits on change. */
function SubmitOnChangeFace(_handle: Handle<SubmitOnChangeFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 1, align: "stretch" }), is("100%"), maxIs("9rem")]}>
			<div
				mix={[
					raw({
						blockSize: "1.4rem",
						borderRadius: "0.4rem",
						border: `1px solid ${INK_STRONG}`,
					}),
				]}
			/>
			<span
				mix={[
					font("mono"),
					text("xs"),
					keyframes("ui-export-submit", {
						"0%, 40%": { opacity: "0" },
						"50%, 100%": { opacity: "0.7" },
					}),
					raw({
						color: BRAND,
						animationName: "ui-export-submit",
						animationDuration: "2.2s",
						animationIterationCount: "infinite",
					}),
				]}
			>
				→ submitted
			</span>
		</div>
	);
}

namespace GenericFace {
	export interface Props {
		name: string;
	}
}

/** Last-resort pulse when nothing more specific fits. */
function GenericFace(handle: Handle<GenericFace.Props>) {
	return () => (
		<div data-face="generic" mix={[vstack({ gap: 2, align: "center" })]}>
			<span
				mix={[
					keyframes("ui-export-generic", {
						"0%, 100%": { scale: "1", opacity: "0.65" },
						"50%": { scale: "1.06", opacity: "1" },
					}),
					raw({
						inlineSize: "2.2rem",
						blockSize: "2.2rem",
						borderRadius: "0.65rem",
						backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 16%, transparent)",
						border: `1px solid ${INK_STRONG}`,
						animationName: "ui-export-generic",
						animationDuration: "2s",
						animationIterationCount: "infinite",
					}),
				]}
			/>
			<span mix={[font("mono"), text("xs"), raw({ opacity: "0.45", maxInlineSize: "9rem" })]}>
				{handle.props.name}
			</span>
		</div>
	);
}

/** Renders the animated schematic for one mixin export. */
export default function MixinFace(handle: Handle<MixinFace.Props>) {
	// One flat case per export name keeps the catalogue honest; the branch count
	// is the catalogue size, not accidental nesting.
	// oxlint-disable-next-line complexity -- one case per @sdxc/ui/mixins export
	return () => {
		let { name } = handle.props;
		let body: RemixNode;

		switch (name) {
			case "otpSlots":
				body = <OtpSlotsFace />;
				break;
			case "validate":
				body = <ValidateFace />;
				break;
			case "clearField":
				body = <ClearFieldFace />;
				break;
			case "confirmPhrase":
				body = <ConfirmPhraseFace />;
				break;
			case "submitOnChange":
			case "submitOnClose":
				body = <SubmitOnChangeFace />;
				break;
			case "comboboxFilter":
				body = <FilterFace label="Filter…" />;
				break;
			case "commandFilter":
				body = <FilterFace label="Command…" />;
				break;
			case "treeFilter":
				body = <FilterFace label="Go to file…" />;
				break;
			case "hotkey":
				body = <Keycaps keys={["⌘", "K"]} />;
				break;
			case "keymap":
				body = <Keycaps keys={["map"]} />;
				break;
			case "keyboardHelp":
				body = <Keycaps keys={["?"]} />;
				break;
			case "escapeLink":
				body = <Keycaps keys={["Esc"]} />;
				break;
			case "activeDescendantKeys":
				body = <Keycaps keys={["↑", "↓"]} />;
				break;
			case "calendarKeys":
			case "rangePickerKeys":
			case "contributionGraphKeys":
				body = <Keycaps keys={["←", "→"]} />;
				break;
			case "tabKeys":
				body = <Keycaps keys={["Tab"]} />;
				break;
			case "commandKeys":
				body = <Keycaps keys={["⌘", "J"]} />;
				break;
			case "listboxKeys":
			case "gridListKeys":
			case "menuKeys":
			case "menubarKeys":
			case "treeKeys":
			case "rowNavigation":
			case "detailSheetKeys":
			case "splitViewKeys":
			case "statusStripKeys":
			case "filterMenuKeys":
				body = <Keycaps keys={["↑", "↓", "↵"]} />;
				break;
			case "ganttToday":
				body = <GanttTodayFace />;
				break;
			case "sortable":
				body = <SortableFace />;
				break;
			case "invokerFields":
				body = <InvokerFieldsFace />;
				break;
			case "dragReorder":
				body = <DragFace kind="reorder" />;
				break;
			case "dropZone":
				body = <DragFace kind="drop" />;
				break;
			case "resizeHandle":
			case "splitViewHandle":
				body = <ResizeFace />;
				break;
			case "copyToClipboard":
			case "copyFeedback":
			case "copyFromUrl":
			case "copyPermalink":
				body = <CopyFace />;
				break;
			case "toastStack":
				body = <ToastFace kind="stack" />;
				break;
			case "toastHold":
				body = <ToastFace kind="hold" />;
				break;
			case "toastClose":
				body = <ToastFace kind="close" />;
				break;
			case "toastAction":
				body = <ToastFace kind="action" />;
				break;
			case "colorAreaDrag":
				body = <ColorFace kind="area" />;
				break;
			case "colorWheelDrag":
				body = <ColorFace kind="wheel" />;
				break;
			case "colorPreview":
				body = <ColorFace kind="preview" />;
				break;
			case "channelSync":
				body = <ColorFace kind="channel" />;
				break;
			case "chartTooltip":
				body = <ColorFace kind="tooltip" />;
				break;
			case "paletteController":
				body = <ColorFace kind="palette" />;
				break;
			case "themeToggle":
				body = <ToggleFace kind="theme" />;
				break;
			case "ariaChecked":
				body = <ToggleFace kind="check" />;
				break;
			case "optimisticToggleSync":
			case "pressToggle":
			case "mirrorSelectedOption":
			case "splitViewToggle":
				body = <ToggleFace kind="switch" />;
				break;
			case "autoRefresh":
			case "frameRefresh":
				body = <SyncFace kind="refresh" />;
				break;
			case "viewerTime":
				body = <SyncFace kind="clock" />;
				break;
			case "whileLive":
				body = <SyncFace kind="live" />;
				break;
			case "messageFollow":
			case "logViewerController":
				body = <SyncFace kind="follow" />;
				break;
			case "composerSend":
				body = <Keycaps keys={["↵", "Esc"]} />;
				break;
			case "revealStream":
			case "streamTarget":
				body = <StreamFace />;
				break;
			case "persist":
			case "saveBarSync":
			case "saveStatusSync":
			case "saveShortcut":
				body = <SyncFace kind="save" />;
				break;
			case "selectionBarSync":
			case "codeTabsSync":
			case "trackHostNode":
				body = <SyncFace kind="pulse" />;
				break;
			case "contextMenu":
			case "dialogDismiss":
			case "dismiss":
				body = <MenuFace />;
				break;
			case "appShellControls":
				body = <NavFace kind="shell" />;
				break;
			case "docsNavTools":
			case "tocSpy":
				body = <NavFace kind="toc" />;
				break;
			case "carouselControls":
				body = <Keycaps keys={["‹", "›"]} />;
				break;
			case "mediaSync":
				body = <Keycaps keys={["▶", "0:42"]} />;
				break;
			case "videoPlayerSync":
				body = <Keycaps keys={["▶", "CC", "⚙"]} />;
				break;
			case "tableSelection":
				body = <NavFace kind="table" />;
				break;
			case "longPress":
				body = <PressFace kind="press" />;
				break;
			case "attachmentTrigger":
				body = <PressFace kind="attach" />;
				break;
			case "stepper":
				body = <PressFace kind="stepper" />;
				break;
			case "dualRange":
			case "rangePreview":
				body = <PressFace kind="range" />;
				break;
			case "imageFallback":
			case "headingLevelFallback":
				body = <FrameFace kind="fallback" />;
				break;
			case "viewTransition":
				body = <FrameFace kind="transition" />;
				break;
			case "liveFrame":
				body = <FrameFace kind="refresh" />;
				break;
			case "frameSubmit":
				body = <FrameFace kind="submit" />;
				break;
			default:
				body = <GenericFace name={name} />;
		}

		return <ExportFaceStage>{body}</ExportFaceStage>;
	};
}
