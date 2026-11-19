/**
 * A music player's queue as headed lists of compact rows: "Now playing" with the track on,
 * then "Next up" in playing order. Each row is a cover, two lines and a length, with an
 * optional control that jumps to it, so a queue panel or a now-playing screen reads the same.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";

import { Equalizer } from "./equalizer.js";
import { formatTrackTime } from "./utils/track-time.js";

/** Prop types for {@link QueueList} and its parts. */
export namespace QueueList {
	/** Every native `<section>` attribute, plus the section's heading and rows. */
	export interface SectionProps extends Omit<TagProps<"section">, "title"> {
		/** Such as "Now playing" or "Next up". */
		title: RemixNode;
		/** A heading level for where the list sits. @default 3 */
		level?: 2 | 3 | 4;
		/** {@link QueueList.Item} elements; none draws the `empty` line. */
		children?: RemixNode;
		/** What shows when the section has no rows, such as "Nothing queued". */
		empty?: RemixNode;
	}

	/** Every native `<li>` attribute, plus one queued track. */
	export interface ItemProps extends Omit<TagProps<"li">, "title"> {
		art?: RemixNode;
		title: string;
		subtitle?: RemixNode;
		/** Length in seconds. */
		duration?: number;
		/** The track playing; its title takes the brand color and an {@link Equalizer}. */
		current?: boolean;
		/**
		 * A button covering the row that jumps to the track; its own `aria-label` names it.
		 * The row draws its hover wash around it.
		 */
		action?: RemixNode;
	}
}

/** One headed group of queued tracks. */
function QueueListSection(handle: Handle<QueueList.SectionProps>) {
	return () => {
		let { children, empty, level = 3, mix, title, ...rest } = handle.props;
		let Heading = `h${level}` as "h3";
		let hasRows = Array.isArray(children) ? children.length > 0 : children != null;
		return (
			<section
				{...rest}
				data-slot="queue-list"
				mix={mergeMix([raw({ display: "grid", gap: "0.375rem", minInlineSize: "0" })], mix)}
			>
				<Heading
					mix={[
						raw({
							margin: "0",
							fontSize: "0.9375rem",
							lineHeight: "1.375rem",
							fontWeight: "700",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{title}
				</Heading>
				{hasRows ? (
					<ol mix={[raw({ display: "grid", margin: "0", padding: "0", listStyle: "none" })]}>
						{children}
					</ol>
				) : (
					<p
						mix={[raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						{empty}
					</p>
				)}
			</section>
		);
	};
}

/** One queued track. */
function QueueListItem(handle: Handle<QueueList.ItemProps>) {
	return () => {
		let { action, art, current, duration, mix, subtitle, title, ...rest } = handle.props;
		return (
			<li
				{...rest}
				data-slot="queue-list-item"
				aria-current={current ? "true" : undefined}
				mix={mergeMix(
					[
						raw({
							position: "relative",
							display: "flex",
							alignItems: "center",
							gap: "0.75rem",
							padding: "0.375rem",
							borderRadius: "var(--ui-radius-md, 0.375rem)",
							minInlineSize: "0",
							"&:hover, &:focus-within": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
							"& [data-slot=queue-list-action] > *": {
								position: "absolute",
								inset: "0",
								margin: "0",
								padding: "0",
								border: "0",
								borderRadius: "inherit",
								background: "transparent",
								cursor: "pointer",
							},
							"& [data-slot=queue-list-action] > :focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "-2px",
							},
							"&[aria-current=true] [data-slot=queue-list-title]": { color: "var(--ui-brand-fg)" },
						}),
					],
					mix,
				)}
			>
				{art === undefined ? null : (
					<span
						mix={[
							raw({
								flex: "none",
								inlineSize: "2.5rem",
								blockSize: "2.5rem",
								overflow: "clip",
								borderRadius: "var(--ui-radius-sm, 0.25rem)",
								backgroundColor: "var(--ui-neutral-bg-tint)",
								"& > *": { display: "block", inlineSize: "100%", blockSize: "100%" },
							}),
						]}
					>
						{art}
					</span>
				)}
				<span mix={[raw({ display: "grid", flex: "1", minInlineSize: "0" })]}>
					<span
						data-slot="queue-list-title"
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.375rem",
								overflow: "hidden",
								whiteSpace: "nowrap",
								fontSize: "0.875rem",
								lineHeight: "1.25rem",
								fontWeight: "500",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{current ? <Equalizer mix={[raw({ flex: "none", fontSize: "0.75rem" })]} /> : null}
						<span mix={[raw({ overflow: "hidden", textOverflow: "ellipsis" })]}>{title}</span>
					</span>
					{subtitle === undefined ? null : (
						<span
							mix={[
								raw({
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									fontSize: "0.75rem",
									lineHeight: "1rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{subtitle}
						</span>
					)}
				</span>
				{duration === undefined ? null : (
					<span
						mix={[
							raw({
								flex: "none",
								fontSize: "0.75rem",
								fontVariantNumeric: "tabular-nums",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{formatTrackTime(duration)}
					</span>
				)}
				{action === undefined ? null : <span data-slot="queue-list-action">{action}</span>}
			</li>
		);
	};
}

/**
 * The queue's parts: {@link QueueList.Section} for a headed group, {@link QueueList.Item} for
 * one track. A panel stacks a "Now playing" section with one item over a "Next up" section.
 *
 * @example
 * <QueueList.Section title="Next up" empty="Nothing queued">
 * 	<QueueList.Item title="Low Tide" subtitle="Lumen Harbor" duration={187} />
 * </QueueList.Section>
 */
export const QueueList = { Section: QueueListSection, Item: QueueListItem };
