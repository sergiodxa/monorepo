/**
 * Diagram faces for `@sdxc/ui/behaviors` on the package landing: each behavior
 * is a small state machine or session graph, so a reader sees the states it
 * moves through before opening its reference page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { font, text, weight } from "@sdxc/u/typography";

import ExportFaceStage from "~/resources/components/ui-export-faces/stage";

namespace BehaviorFace {
	export interface Props {
		name: string;
	}
}

const INK = "color-mix(in oklch, CanvasText 16%, transparent)";
const INK_STRONG = "color-mix(in oklch, CanvasText 28%, transparent)";
const BRAND = "var(--ui-brand-fg, CanvasText)";

namespace FsmNode {
	export interface Props {
		label: string;
		active?: boolean;
		delay?: string;
	}
}

/** One node in a miniature state machine. */
function FsmNode(handle: Handle<FsmNode.Props>) {
	return () => {
		let { label, active, delay } = handle.props;

		return (
			<span
				mix={[
					font("mono"),
					text("xs"),
					weight("semibold"),
					active
						? [
								keyframes("ui-export-fsm-active", {
									"0%, 100%": {
										backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 14%, transparent)",
										boxShadow: `0 0 0 1px ${INK_STRONG}`,
									},
									"50%": {
										backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 28%, transparent)",
										boxShadow: `0 0 0 1px ${BRAND}`,
									},
								}),
								raw({
									animationName: "ui-export-fsm-active",
									animationDuration: "2s",
									animationDelay: delay ?? "0s",
									animationIterationCount: "infinite",
								}),
							]
						: null,
					raw({
						paddingInline: "0.45rem",
						paddingBlock: "0.28rem",
						borderRadius: "9999px",
						border: `1px solid ${INK_STRONG}`,
						backgroundColor: active
							? "color-mix(in oklch, var(--ui-brand-fg) 14%, transparent)"
							: INK,
						color: "var(--ui-neutral-emphasis, CanvasText)",
						whiteSpace: "nowrap",
					}),
				]}
			>
				{label}
			</span>
		);
	};
}

namespace FsmEdge {
	export interface Props {}
}

/** Arrow between two states. */
function FsmEdge(_handle: Handle<FsmEdge.Props>) {
	return () => (
		<span
			mix={[
				raw({
					inlineSize: "1.1rem",
					blockSize: "0.12rem",
					borderRadius: "9999px",
					backgroundColor: INK_STRONG,
					position: "relative",
					flexShrink: "0",
				}),
			]}
		>
			<span
				mix={[
					raw({
						position: "absolute",
						insetInlineEnd: "-0.1rem",
						insetBlockStart: "50%",
						translate: "0 -50%",
						borderStyle: "solid",
						borderWidth: "0.22rem 0 0.22rem 0.35rem",
						borderColor: `transparent transparent transparent ${INK_STRONG}`,
					}),
				]}
			/>
		</span>
	);
}

namespace FsmChain {
	export interface Props {
		states: string[];
		active?: number;
	}
}

/** Horizontal state chain. */
function FsmChain(handle: Handle<FsmChain.Props>) {
	return () => {
		let { states, active } = handle.props;

		return (
			<div
				mix={[
					hstack({ gap: 1, align: "center" }),
					raw({ flexWrap: "wrap", justifyContent: "center" }),
				]}
			>
				{states.flatMap((state, index) => {
					let isActive = active === undefined ? index === states.length - 2 : index === active;
					let node = (
						<FsmNode key={state} label={state} active={isActive} delay={`${index * 0.2}s`} />
					);
					return index === 0 ? [node] : [<FsmEdge key={`edge-${state}`} />, node];
				})}
			</div>
		);
	};
}

namespace AnnouncerFace {
	export interface Props {}
}

/** Announcer: idle → polite → assertive. */
function AnnouncerFace(_handle: Handle<AnnouncerFace.Props>) {
	return () => <FsmChain states={["idle", "polite", "assertive"]} active={1} />;
}

namespace CalendarFace {
	export interface Props {}
}

/** CalendarModel: browse ↔ select. */
function CalendarFace(_handle: Handle<CalendarFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "center" })]}>
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(7, 0.55rem)",
						gap: "0.18rem",
					}),
				]}
			>
				{Array.from({ length: 14 }, (_, index) => (
					<span
						key={index}
						mix={[
							raw({
								inlineSize: "0.55rem",
								blockSize: "0.55rem",
								borderRadius: "0.12rem",
								backgroundColor: index === 9 ? BRAND : INK,
							}),
						]}
					/>
				))}
			</div>
			<FsmChain states={["browse", "select"]} active={1} />
		</div>
	);
}

namespace DragSessionFace {
	export interface Props {}
}

/** DragSession: idle → dragging → drop. */
function DragSessionFace(_handle: Handle<DragSessionFace.Props>) {
	return () => <FsmChain states={["idle", "dragging", "drop"]} active={1} />;
}

namespace FilterModelFace {
	export interface Props {}
}

/** FilterModel: query → match → empty. */
function FilterModelFace(_handle: Handle<FilterModelFace.Props>) {
	return () => <FsmChain states={["query", "match", "empty"]} active={1} />;
}

namespace RefreshFace {
	export interface Props {}
}

/** RefreshSchedule: wait → tick → wait. */
function RefreshFace(_handle: Handle<RefreshFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "center" })]}>
			<span
				mix={[
					keyframes("ui-export-refresh", {
						from: { transform: "rotate(0deg)" },
						to: { transform: "rotate(360deg)" },
					}),
					raw({
						inlineSize: "1.4rem",
						blockSize: "1.4rem",
						borderRadius: "9999px",
						border: `2px solid ${INK}`,
						borderBlockStartColor: BRAND,
						animationName: "ui-export-refresh",
						animationDuration: "2.4s",
						animationTimingFunction: "linear",
						animationIterationCount: "infinite",
					}),
				]}
			/>
			<FsmChain states={["wait", "tick"]} active={1} />
		</div>
	);
}

namespace ResizeSessionFace {
	export interface Props {}
}

/** ResizeSession: idle → resizing → settle. */
function ResizeSessionFace(_handle: Handle<ResizeSessionFace.Props>) {
	return () => <FsmChain states={["idle", "resizing", "settle"]} active={1} />;
}

namespace ScrollFollowFace {
	export interface Props {}
}

/** ScrollFollowModel: detached ↔ following. */
function ScrollFollowFace(_handle: Handle<ScrollFollowFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "center" })]}>
			<div
				mix={[
					raw({
						position: "relative",
						inlineSize: "6.5rem",
						blockSize: "2.4rem",
						borderRadius: "0.45rem",
						border: `1px solid ${INK_STRONG}`,
						overflow: "hidden",
					}),
				]}
			>
				<span
					mix={[
						keyframes("ui-export-follow", {
							"0%, 100%": { insetBlockStart: "0.3rem" },
							"50%": { insetBlockStart: "1.2rem" },
						}),
						raw({
							position: "absolute",
							insetInline: "0.4rem",
							blockSize: "0.55rem",
							borderRadius: "9999px",
							backgroundColor: BRAND,
							animationName: "ui-export-follow",
							animationDuration: "2.2s",
							animationIterationCount: "infinite",
						}),
					]}
				/>
			</div>
			<FsmChain states={["detached", "following"]} active={1} />
		</div>
	);
}

namespace SelectionFace {
	export interface Props {}
}

/** SelectionModel: none → single → multi. */
function SelectionFace(_handle: Handle<SelectionFace.Props>) {
	return () => <FsmChain states={["none", "single", "multi"]} active={1} />;
}

namespace ShortcutFace {
	export interface Props {}
}

/** ShortcutRegistry: bind → match → fire. */
function ShortcutFace(_handle: Handle<ShortcutFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "center" })]}>
			<div mix={[hstack({ gap: 1, align: "center" })]}>
				{["⌘", "S"].map((key) => (
					<span
						key={key}
						mix={[
							font("mono"),
							text("xs"),
							raw({
								inlineSize: "1.45rem",
								blockSize: "1.45rem",
								display: "grid",
								placeItems: "center",
								borderRadius: "0.35rem",
								border: `1px solid ${INK_STRONG}`,
								backgroundColor: INK,
							}),
						]}
					>
						{key}
					</span>
				))}
			</div>
			<FsmChain states={["bind", "match", "fire"]} active={2} />
		</div>
	);
}

namespace ToasterFace {
	export interface Props {}
}

/** Toaster: enqueue → visible → dismiss. */
function ToasterFace(_handle: Handle<ToasterFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "center" })]}>
			<div mix={[raw({ position: "relative", inlineSize: "7rem", blockSize: "2.2rem" })]}>
				{[0, 1].map((index) => (
					<span
						key={index}
						mix={[
							keyframes("ui-export-toaster", {
								"0%, 100%": { opacity: index === 1 ? "1" : "0.45" },
								"50%": { opacity: index === 1 ? "0.7" : "0.8" },
							}),
							raw({
								position: "absolute",
								insetInline: `${index * 0.25}rem`,
								insetBlockStart: `${index * 0.4}rem`,
								blockSize: "1.25rem",
								borderRadius: "0.4rem",
								backgroundColor:
									index === 1 ? "color-mix(in oklch, var(--ui-brand-fg) 20%, Canvas)" : INK,
								boxShadow: `0 0 0 1px ${INK_STRONG}`,
								animationName: "ui-export-toaster",
								animationDuration: "2s",
								animationIterationCount: "infinite",
							}),
						]}
					/>
				))}
			</div>
			<FsmChain states={["enqueue", "visible", "dismiss"]} active={1} />
		</div>
	);
}

namespace BehaviorFallback {
	export interface Props {
		name: string;
	}
}

/** Named fallback when no diagram exists yet. */
function BehaviorFallback(handle: Handle<BehaviorFallback.Props>) {
	return () => (
		<span mix={[font("mono"), text("xs"), raw({ opacity: "0.5" })]}>{handle.props.name}</span>
	);
}

/** Renders the state-machine miniature for one behavior export. */
export default function BehaviorFace(handle: Handle<BehaviorFace.Props>) {
	return () => {
		let { name } = handle.props;
		let body;

		switch (name) {
			case "Announcer":
				body = <AnnouncerFace />;
				break;
			case "CalendarModel":
				body = <CalendarFace />;
				break;
			case "DragSession":
				body = <DragSessionFace />;
				break;
			case "FilterModel":
				body = <FilterModelFace />;
				break;
			case "RefreshSchedule":
				body = <RefreshFace />;
				break;
			case "ResizeSession":
				body = <ResizeSessionFace />;
				break;
			case "ScrollFollowModel":
				body = <ScrollFollowFace />;
				break;
			case "SelectionModel":
				body = <SelectionFace />;
				break;
			case "ShortcutRegistry":
				body = <ShortcutFace />;
				break;
			case "Toaster":
				body = <ToasterFace />;
				break;
			default:
				body = <BehaviorFallback name={name} />;
		}

		return <ExportFaceStage>{body}</ExportFaceStage>;
	};
}
