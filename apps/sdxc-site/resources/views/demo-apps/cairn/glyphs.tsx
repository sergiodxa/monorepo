/**
 * Cairn's small drawings: the mark, a glyph per workflow state that fills as work advances,
 * priority bars and square initials tiles, so a row's state reads at a glance
 * in the same shapes on the list, the board, the menus and the roadmap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { iife } from "@sdxc/iife";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";

import type { Person, PriorityId, StatusId } from "./data";

import { PRIORITY_NAMES, STATUS_NAMES } from "./data";

/** Each state's colour: quiet until work starts, amber in progress, the brand once done. */
const STATUS_COLOR: Record<StatusId, string> = {
	backlog: "var(--ui-neutral-fg-muted)",
	todo: "var(--ui-neutral-fg)",
	started: "oklch(0.72 0.15 75)",
	review: "oklch(0.6 0.13 245)",
	done: "var(--ui-brand-fg)",
	canceled: "var(--ui-neutral-fg-muted)",
};

/** Cairn's mark: three stacked stones on a lichen tile. */
export function CairnMark(handle: Handle<{ size?: number }>) {
	return () => {
		let size = handle.props.size ?? 24;
		return (
			<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
				<rect width="24" height="24" rx="5" fill="var(--ui-color-brand-600)" />
				<ellipse cx="12" cy="17.25" rx="6.25" ry="2.4" fill="white" />
				<ellipse cx="12" cy="12.4" rx="4.4" ry="1.9" fill="white" opacity="0.85" />
				<ellipse cx="12.4" cy="8.2" rx="2.6" ry="1.5" fill="white" opacity="0.7" />
			</svg>
		);
	};
}

/**
 * A 14px state glyph: a dashed ring for backlog, an empty ring for todo, a ring filling as
 * work moves through progress and review, a filled tick for done and a cross for canceled.
 * `label` writes the state's name for a screen reader.
 */
export function StatusIcon(handle: Handle<{ status: StatusId; label?: boolean; size?: number }>) {
	return () => {
		let { status, label = false } = handle.props;
		let size = handle.props.size ?? 14;
		let color = STATUS_COLOR[status];
		let fill = { started: 0.5, review: 0.75 }[status as "started" | "review"];
		return (
			<span data-status={status} mix={[raw({ display: "inline-flex", flexShrink: "0", color })]}>
				<svg viewBox="0 0 14 14" width={size} height={size} aria-hidden="true">
					{iife(() => {
						if (status === "done") {
							return (
								<>
									<circle cx="7" cy="7" r="6.5" fill="currentColor" />
									<path
										d="M4.2 7.2l1.9 1.9 3.8-4"
										fill="none"
										stroke="var(--ui-bg, white)"
										stroke-width="1.6"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</>
							);
						}
						if (status === "canceled") {
							return (
								<>
									<circle cx="7" cy="7" r="6.5" fill="currentColor" />
									<path
										d="M4.8 4.8l4.4 4.4M9.2 4.8l-4.4 4.4"
										stroke="var(--ui-bg, white)"
										stroke-width="1.5"
										stroke-linecap="round"
									/>
								</>
							);
						}
						return (
							<>
								<circle
									cx="7"
									cy="7"
									r="5.75"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-dasharray={status === "backlog" ? "1.6 1.8" : undefined}
								/>
								{fill === undefined ? null : <path d={arc(fill)} fill="currentColor" />}
							</>
						);
					})}
				</svg>
				{label ? <span mix={[visuallyHidden()]}>{STATUS_NAMES[status]}</span> : null}
			</span>
		);
	};
}

/** A pie slice from twelve o'clock covering `share` of a 3px-radius disc at the glyph's centre. */
function arc(share: number): string {
	let angle = share * 2 * Math.PI;
	let x = 7 + 3 * Math.sin(angle);
	let y = 7 - 3 * Math.cos(angle);
	let large = share > 0.5 ? 1 : 0;
	return `M7 7V4A3 3 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`;
}

/**
 * A 14px priority glyph: three bars filled to the priority for high, medium and low, an
 * exclamation tile for urgent, and a dotted line for none.
 */
export function PriorityIcon(
	handle: Handle<{ priority: PriorityId; label?: boolean; size?: number }>,
) {
	return () => {
		let { priority, label = false } = handle.props;
		let size = handle.props.size ?? 14;
		let lit = { 2: 3, 3: 2, 4: 1 }[priority as 2 | 3 | 4] ?? 0;
		return (
			<span
				data-priority={priority}
				mix={[
					raw({
						display: "inline-flex",
						flexShrink: "0",
						color: priority === 1 ? "oklch(0.64 0.19 35)" : "var(--ui-neutral-fg)",
					}),
				]}
			>
				<svg viewBox="0 0 14 14" width={size} height={size} aria-hidden="true">
					{iife(() => {
						if (priority === 1) {
							return (
								<>
									<rect x="1" y="1" width="12" height="12" rx="3" fill="currentColor" />
									<path d="M7 3.8v4" stroke="white" stroke-width="1.7" stroke-linecap="round" />
									<circle cx="7" cy="10.1" r="0.95" fill="white" />
								</>
							);
						}
						if (priority === 0) {
							return (
								<path
									d="M2 7h10"
									stroke="var(--ui-neutral-fg-muted)"
									stroke-width="1.5"
									stroke-dasharray="1.5 1.75"
									stroke-linecap="round"
								/>
							);
						}
						return [0, 1, 2].map((bar) => (
							<rect
								x={1.5 + bar * 4}
								y={9 - bar * 3}
								width="3"
								height={4 + bar * 3}
								rx="0.75"
								fill="currentColor"
								opacity={bar < lit ? "1" : "0.25"}
							/>
						));
					})}
				</svg>
				{label ? <span mix={[visuallyHidden()]}>{PRIORITY_NAMES[priority]} priority</span> : null}
			</span>
		);
	};
}

/**
 * A square initials tile tinted by the person's hue, or a dashed outline for no one. `size`
 * is in pixels; the person's name is the tile's accessible name unless `decorative`.
 */
export function PersonTile(
	handle: Handle<{ person: Person | undefined; size?: number; decorative?: boolean }>,
) {
	return () => {
		let { person, decorative = false } = handle.props;
		let size = handle.props.size ?? 20;
		let shared = {
			display: "inline-grid",
			placeItems: "center",
			flexShrink: "0",
			inlineSize: `${size}px`,
			blockSize: `${size}px`,
			boxSizing: "border-box",
			borderRadius: `${Math.round(size / 5)}px`,
			fontSize: `${Math.max(8, Math.round(size * 0.42))}px`,
			fontWeight: "600",
			lineHeight: "1",
			letterSpacing: "0.02em",
		} as const;
		if (!person) {
			return (
				<span
					role={decorative ? undefined : "img"}
					aria-label={decorative ? undefined : "Unassigned"}
					aria-hidden={decorative ? "true" : undefined}
					mix={[
						raw({
							...shared,
							border: "1.5px dashed var(--ui-neutral-border-emphasis, var(--ui-neutral-fg-muted))",
						}),
					]}
				/>
			);
		}
		return (
			<span
				role={decorative ? undefined : "img"}
				aria-label={decorative ? undefined : person.name}
				aria-hidden={decorative ? "true" : undefined}
				title={person.name}
				mix={[
					raw({
						...shared,
						color: `color-mix(in oklch, oklch(0.55 0.13 ${person.hue}) 55%, var(--ui-neutral-fg-emphasis))`,
						backgroundColor: `color-mix(in oklch, oklch(0.72 0.12 ${person.hue}) 30%, var(--ui-bg, Canvas))`,
					}),
				]}
			>
				<span aria-hidden="true">{person.initials}</span>
			</span>
		);
	};
}

/** A project's glyph: a small stone tinted by the project's hue. */
export function ProjectGlyph(handle: Handle<{ hue: number; size?: number }>) {
	return () => {
		let size = handle.props.size ?? 16;
		return (
			<svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
				<path
					d="M2.5 10.5c0-3.3 2.6-6.5 5.8-6.5 3 0 5.2 2.4 5.2 5.2 0 2.4-2 3.8-5.6 3.8-3.4 0-5.4-.8-5.4-2.5Z"
					fill={`oklch(0.66 0.13 ${handle.props.hue})`}
				/>
			</svg>
		);
	};
}
