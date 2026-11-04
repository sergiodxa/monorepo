/**
 * Diagram faces for `@sdxc/ui/behaviors` on the package landing: each behavior
 * is drawn as the state machine it actually is — forks, cycles and returns —
 * not a flat badge strip.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

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
	}
}

/** One node in a miniature state machine. */
function FsmNode(handle: Handle<FsmNode.Props>) {
	return () => {
		let { label, active } = handle.props;

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

namespace ArrowRight {
	export interface Props {
		label?: string;
	}
}

/** Rightward transition arrow, optionally labeled. */
function ArrowRight(handle: Handle<ArrowRight.Props>) {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					flexDirection: "column",
					alignItems: "center",
					gap: "0.1rem",
					flexShrink: "0",
				}),
			]}
		>
			{handle.props.label ? (
				<span mix={[font("mono"), raw({ fontSize: "0.5rem", opacity: "0.5" })]}>
					{handle.props.label}
				</span>
			) : null}
			<span
				mix={[
					raw({
						inlineSize: "1rem",
						blockSize: "0.12rem",
						borderRadius: "9999px",
						backgroundColor: INK_STRONG,
						position: "relative",
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
							borderWidth: "0.2rem 0 0.2rem 0.32rem",
							borderColor: `transparent transparent transparent ${INK_STRONG}`,
						}),
					]}
				/>
			</span>
		</span>
	);
}

namespace ArrowDown {
	export interface Props {}
}

/** Downward transition used in forks. */
function ArrowDown(_handle: Handle<ArrowDown.Props>) {
	return () => (
		<span
			mix={[
				raw({
					display: "block",
					inlineSize: "0.12rem",
					blockSize: "0.7rem",
					borderRadius: "9999px",
					backgroundColor: INK_STRONG,
					marginInline: "auto",
					position: "relative",
				}),
			]}
		>
			<span
				mix={[
					raw({
						position: "absolute",
						insetBlockEnd: "-0.1rem",
						insetInlineStart: "50%",
						translate: "-50% 0",
						borderStyle: "solid",
						borderWidth: "0.32rem 0.2rem 0 0.2rem",
						borderColor: `${INK_STRONG} transparent transparent transparent`,
					}),
				]}
			/>
		</span>
	);
}

namespace Bidirectional {
	export interface Props {
		left: string;
		right: string;
		active?: "left" | "right";
	}
}

/** Two states with arrows both ways. */
function Bidirectional(handle: Handle<Bidirectional.Props>) {
	return () => {
		let { left, right, active = "right" } = handle.props;

		return (
			<div mix={[hstack({ gap: 2, align: "center" })]}>
				<FsmNode label={left} active={active === "left"} />
				<span mix={[vstack({ gap: 1, align: "center" })]}>
					<span
						mix={[
							raw({
								fontSize: "0.65rem",
								lineHeight: "1",
								color: INK_STRONG,
								letterSpacing: "-0.05em",
							}),
						]}
					>
						⇄
					</span>
				</span>
				<FsmNode label={right} active={active === "right"} />
			</div>
		);
	};
}

namespace ForkFromIdle {
	export interface Props {
		idle: string;
		a: string;
		b: string;
		active?: "a" | "b" | "idle";
	}
}

/** One idle state forking to two alternatives (Announcer, FilterModel). */
function ForkFromIdle(handle: Handle<ForkFromIdle.Props>) {
	return () => {
		let { idle, a, b, active = "a" } = handle.props;

		return (
			<div mix={[vstack({ gap: 1, align: "center" })]}>
				<FsmNode label={idle} active={active === "idle"} />
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "1fr 1fr",
							gap: "0.35rem 1rem",
							alignItems: "start",
							justifyItems: "center",
						}),
					]}
				>
					<ArrowDown />
					<ArrowDown />
					<FsmNode label={a} active={active === "a"} />
					<FsmNode label={b} active={active === "b"} />
				</div>
			</div>
		);
	};
}

namespace CycleThree {
	export interface Props {
		a: string;
		b: string;
		c: string;
		active?: "a" | "b" | "c";
	}
}

/** Three-state cycle that returns to the start (sessions that settle back). */
function CycleThree(handle: Handle<CycleThree.Props>) {
	return () => {
		let { a, b, c, active = "b" } = handle.props;

		return (
			<div mix={[vstack({ gap: 1, align: "center" })]}>
				<div mix={[hstack({ gap: 1, align: "center" })]}>
					<FsmNode label={a} active={active === "a"} />
					<ArrowRight />
					<FsmNode label={b} active={active === "b"} />
					<ArrowRight />
					<FsmNode label={c} active={active === "c"} />
				</div>
				<span
					mix={[
						font("mono"),
						raw({
							fontSize: "0.55rem",
							opacity: "0.55",
							color: "var(--ui-neutral-fg)",
						}),
					]}
				>
					↩ back to {a}
				</span>
			</div>
		);
	};
}

namespace AnnouncerFace {
	export interface Props {}
}

/** Announcer queues polite or assertive from idle — a fork, not a chain. */
function AnnouncerFace(_handle: Handle<AnnouncerFace.Props>) {
	return () => <ForkFromIdle idle="idle" a="polite" b="assertive" active="a" />;
}

namespace CalendarFace {
	export interface Props {}
}

/** CalendarModel browses and selects interchangeably. */
function CalendarFace(_handle: Handle<CalendarFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "center" })]}>
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(7, 0.5rem)",
						gap: "0.15rem",
					}),
				]}
			>
				{Array.from({ length: 14 }, (_, index) => (
					<span
						key={index}
						mix={[
							raw({
								inlineSize: "0.5rem",
								blockSize: "0.5rem",
								borderRadius: "0.1rem",
								backgroundColor: index === 9 ? BRAND : INK,
							}),
						]}
					/>
				))}
			</div>
			<Bidirectional left="browse" right="select" active="right" />
		</div>
	);
}

namespace DragSessionFace {
	export interface Props {}
}

/** DragSession: idle → dragging → drop → idle. */
function DragSessionFace(_handle: Handle<DragSessionFace.Props>) {
	return () => <CycleThree a="idle" b="dragging" c="drop" active="b" />;
}

namespace FilterModelFace {
	export interface Props {}
}

/** FilterModel: a query yields match or empty. */
function FilterModelFace(_handle: Handle<FilterModelFace.Props>) {
	return () => <ForkFromIdle idle="query" a="match" b="empty" active="a" />;
}

namespace RefreshFace {
	export interface Props {}
}

/** RefreshSchedule oscillates wait ⇄ tick. */
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
						inlineSize: "1.3rem",
						blockSize: "1.3rem",
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
			<Bidirectional left="wait" right="tick" active="right" />
		</div>
	);
}

namespace ResizeSessionFace {
	export interface Props {}
}

/** ResizeSession: idle → resizing → settle → idle. */
function ResizeSessionFace(_handle: Handle<ResizeSessionFace.Props>) {
	return () => <CycleThree a="idle" b="resizing" c="settle" active="b" />;
}

namespace ScrollFollowFace {
	export interface Props {}
}

/** ScrollFollowModel toggles detached ⇄ following. */
function ScrollFollowFace(_handle: Handle<ScrollFollowFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "center" })]}>
			<div
				mix={[
					raw({
						position: "relative",
						inlineSize: "6rem",
						blockSize: "2.1rem",
						borderRadius: "0.4rem",
						border: `1px solid ${INK_STRONG}`,
						overflow: "hidden",
					}),
				]}
			>
				<span
					mix={[
						keyframes("ui-export-follow", {
							"0%, 100%": { insetBlockStart: "0.25rem" },
							"50%": { insetBlockStart: "1.05rem" },
						}),
						raw({
							position: "absolute",
							insetInline: "0.35rem",
							blockSize: "0.5rem",
							borderRadius: "9999px",
							backgroundColor: BRAND,
							animationName: "ui-export-follow",
							animationDuration: "2.2s",
							animationIterationCount: "infinite",
						}),
					]}
				/>
			</div>
			<Bidirectional left="detached" right="following" active="right" />
		</div>
	);
}

namespace SelectionFace {
	export interface Props {}
}

/** SelectionModel escalates none → single → multi, and can clear back. */
function SelectionFace(_handle: Handle<SelectionFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 1, align: "center" })]}>
			<div mix={[hstack({ gap: 1, align: "center" })]}>
				<FsmNode label="none" />
				<ArrowRight />
				<FsmNode label="single" active />
				<ArrowRight />
				<FsmNode label="multi" />
			</div>
			<span mix={[font("mono"), raw({ fontSize: "0.55rem", opacity: "0.55" })]}>clear → none</span>
		</div>
	);
}

namespace ShortcutFace {
	export interface Props {}
}

/** ShortcutRegistry: bind, then match fires (and returns to listening). */
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
								inlineSize: "1.4rem",
								blockSize: "1.4rem",
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
			<div mix={[hstack({ gap: 1, align: "center" })]}>
				<FsmNode label="bind" />
				<ArrowRight />
				<FsmNode label="match" active />
				<ArrowRight label="fire" />
				<FsmNode label="bind" />
			</div>
		</div>
	);
}

namespace ToasterFace {
	export interface Props {}
}

/** Toaster: enqueue → visible → dismiss → (next). */
function ToasterFace(_handle: Handle<ToasterFace.Props>) {
	return () => (
		<div mix={[vstack({ gap: 2, align: "center" })]}>
			<div mix={[raw({ position: "relative", inlineSize: "6.5rem", blockSize: "2rem" })]}>
				{[0, 1].map((index) => (
					<span
						key={index}
						mix={[
							raw({
								position: "absolute",
								insetInline: `${index * 0.25}rem`,
								insetBlockStart: `${index * 0.35}rem`,
								blockSize: "1.15rem",
								borderRadius: "0.4rem",
								backgroundColor:
									index === 1 ? "color-mix(in oklch, var(--ui-brand-fg) 20%, Canvas)" : INK,
								boxShadow: `0 0 0 1px ${INK_STRONG}`,
							}),
						]}
					/>
				))}
			</div>
			<CycleThree a="enqueue" b="visible" c="dismiss" active="b" />
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
		let body: RemixNode;

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
