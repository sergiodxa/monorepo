/**
 * Animated schematics for `@sdxc/ui/mixins` on the package landing: each mixin
 * is a behaviour you compose onto a host, so the face shows a looping cue of
 * what it does — a key flash, a drag handle, a copy pulse — rather than a bare
 * identifier.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

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

/** Visual kind a mixin name collapses into for its schematic. */
type MixinKind =
	| "keys"
	| "filter"
	| "drag"
	| "copy"
	| "toast"
	| "color"
	| "toggle"
	| "sync"
	| "form"
	| "nav"
	| "menu"
	| "resize"
	| "press"
	| "frame"
	| "generic";

/** Maps an export name to the schematic family that illustrates it. */
function kindOf(name: string): MixinKind {
	if (/Keys$|keymap|hotkey|keyboardHelp|rowNavigation|escapeLink|activeDescendant/i.test(name)) {
		return "keys";
	}
	if (/Filter|comboboxFilter|commandFilter/i.test(name)) return "filter";
	if (/confirmPhrase|validate|otpSlots|clearField|submitOnChange/i.test(name)) return "form";
	if (/[Dd]rag|dropZone|reorder/i.test(name)) return "drag";
	if (/[Rr]esize|splitViewHandle/i.test(name)) return "resize";
	if (/[Cc]opy/i.test(name)) return "copy";
	if (/[Tt]oast/i.test(name)) return "toast";
	if (/[Cc]olor|channelSync|palette|chartTooltip/i.test(name)) return "color";
	if (/[Tt]oggle|theme|pressToggle|ariaChecked|optimistic/i.test(name)) return "toggle";
	if (/[Ss]ync|persist|autoRefresh|whileLive|messageFollow|trackHost|viewerTime/i.test(name)) {
		return "sync";
	}
	if (/[Mm]enu|contextMenu|menubar|dialogDismiss|dismiss|detailSheet/i.test(name)) return "menu";
	if (/[Ff]rame|liveFrame|viewTransition|imageFallback|headingLevel/i.test(name)) return "frame";
	if (/longPress|attachmentTrigger|stepper|dualRange|range/i.test(name)) return "press";
	if (
		/[Tt]ab|toc|docsNav|appShell|statusStrip|selectionBar|saveBar|saveStatus|saveShortcut/i.test(
			name,
		)
	) {
		return "nav";
	}
	if (/mirrorSelected|combobox|command|listbox|gridList|tableSelection|tree/i.test(name)) {
		return "nav";
	}
	return "generic";
}

namespace KeysFace {
	export interface Props {}
}

/** Flashing keycaps for keyboard / focus mixins. */
function KeysFace(_handle: Handle<KeysFace.Props>) {
	return () => (
		<div mix={[hstack({ gap: 1, align: "center" })]}>
			{["⌘", "K"].map((label, index) => (
				<span
					key={label}
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
							inlineSize: "1.6rem",
							blockSize: "1.6rem",
							display: "grid",
							placeItems: "center",
							borderRadius: "0.4rem",
							border: `1px solid ${INK_STRONG}`,
							animationName: "ui-export-key-flash",
							animationDuration: "1.8s",
							animationDelay: `${index * 0.15}s`,
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

namespace FilterFace {
	export interface Props {}
}

/** Filter chip with a typing caret. */
function FilterFace(_handle: Handle<FilterFace.Props>) {
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
			<span mix={[font("mono"), text("xs"), raw({ opacity: "0.55" })]}>Filter…</span>
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
	export interface Props {}
}

/** Card row with a dragging handle. */
function DragFace(_handle: Handle<DragFace.Props>) {
	return () => (
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

/** Clipboard with a check flash. */
function CopyFace(_handle: Handle<CopyFace.Props>) {
	return () => (
		<div
			mix={[
				raw({
					position: "relative",
					inlineSize: "2.4rem",
					blockSize: "2.8rem",
				}),
			]}
		>
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

namespace ToastFace {
	export interface Props {}
}

/** Stacking toast chips. */
function ToastFace(_handle: Handle<ToastFace.Props>) {
	return () => (
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
}

namespace ColorFace {
	export interface Props {}
}

/** Color area with a moving thumb. */
function ColorFace(_handle: Handle<ColorFace.Props>) {
	return () => (
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
}

namespace ToggleFace {
	export interface Props {}
}

/** Toggle switch that slides on and off. */
function ToggleFace(_handle: Handle<ToggleFace.Props>) {
	return () => (
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
}

namespace SyncFace {
	export interface Props {}
}

/** Sync pulse between two nodes. */
function SyncFace(_handle: Handle<SyncFace.Props>) {
	return () => (
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
}

namespace MenuFace {
	export interface Props {}
}

/** Nested menu / popover layers. */
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
	export interface Props {}
}

/** Tab strip with a sliding indicator. */
function NavFace(_handle: Handle<NavFace.Props>) {
	return () => (
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
			<div
				mix={[
					bs("2rem"),
					raw({
						borderRadius: "0.45rem",
						backgroundColor: INK,
					}),
				]}
			/>
		</div>
	);
}

namespace FormFace {
	export interface Props {}
}

/** Form field with a validating flash. */
function FormFace(_handle: Handle<FormFace.Props>) {
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

namespace PressFace {
	export interface Props {}
}

/** Press / hold ring. */
function PressFace(_handle: Handle<PressFace.Props>) {
	return () => (
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
}

namespace FrameFace {
	export interface Props {}
}

/** Framed viewport with a refresh sweep. */
function FrameFace(_handle: Handle<FrameFace.Props>) {
	return () => (
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
		</div>
	);
}

namespace GenericFace {
	export interface Props {
		name: string;
	}
}

/** Generic pulsing node for mixins without a tighter schematic. */
function GenericFace(handle: Handle<GenericFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "center" })]}>
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
	return () => {
		let { name } = handle.props;
		let body;

		switch (kindOf(name)) {
			case "keys":
				body = <KeysFace />;
				break;
			case "filter":
				body = <FilterFace />;
				break;
			case "drag":
				body = <DragFace />;
				break;
			case "resize":
				body = <ResizeFace />;
				break;
			case "copy":
				body = <CopyFace />;
				break;
			case "toast":
				body = <ToastFace />;
				break;
			case "color":
				body = <ColorFace />;
				break;
			case "toggle":
				body = <ToggleFace />;
				break;
			case "sync":
				body = <SyncFace />;
				break;
			case "menu":
				body = <MenuFace />;
				break;
			case "nav":
				body = <NavFace />;
				break;
			case "form":
				body = <FormFace />;
				break;
			case "press":
				body = <PressFace />;
				break;
			case "frame":
				body = <FrameFace />;
				break;
			default:
				body = <GenericFace name={name} />;
		}

		return <ExportFaceStage>{body}</ExportFaceStage>;
	};
}
