/**
 * The Measure's gallery miniature: the book's red cover standing on a ruled page of its own
 * text, square-cornered and set in its serif, so the card shows the printed register the
 * landing is set in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

/** How far each ruled line of the sample page runs, as a share of the column. */
const LINES = [100, 96, 100, 88, 100, 93, 62];

/** Renders the cover over the page it opens to. */
export default function BookThumbnail() {
	return () => (
		<>
			<div
				mix={[
					raw({
						position: "absolute",
						insetBlock: "1.25rem -1rem",
						insetInlineStart: "42%",
						insetInlineEnd: "1.25rem",
						display: "flex",
						flexDirection: "column",
						gap: "0.5rem",
						padding: "1rem",
						backgroundColor: "var(--ui-color-neutral-50)",
						boxShadow: "0 0 0 1px var(--ui-neutral-border)",
					}),
				]}
			>
				<span mix={[raw({ fontStyle: "italic", color: "var(--ui-neutral-fg-muted)" })]}>
					Chapter 3 — Measure
				</span>
				{LINES.map((width, index) => (
					<span
						key={index}
						mix={[
							raw({
								blockSize: "1px",
								inlineSize: `${width}%`,
								backgroundColor: "var(--ui-neutral-border-strong)",
								opacity: "0.45",
							}),
						]}
					/>
				))}
			</div>
			<div
				mix={[
					raw({
						position: "absolute",
						insetBlockStart: "1.25rem",
						insetInlineStart: "1.25rem",
						inlineSize: "34%",
						maxInlineSize: "8rem",
						aspectRatio: "2 / 3",
						display: "flex",
						flexDirection: "column",
						justifyContent: "space-between",
						padding: "0.75rem",
						backgroundColor: "var(--ui-color-brand-600)",
						color: "var(--ui-color-neutral-50)",
						boxShadow: "6px 6px 0 var(--ui-color-neutral-900)",
					}),
				]}
			>
				<span
					mix={[
						raw({
							fontFamily: "var(--ui-font-display)",
							fontSize: "1.0625rem",
							lineHeight: "1.05",
							letterSpacing: "-0.01em",
						}),
					]}
				>
					The Measure
				</span>
				<span
					mix={[
						raw({
							borderBlockStart: "1px solid currentColor",
							paddingBlockStart: "0.25rem",
							opacity: "0.85",
						}),
					]}
				>
					Web typography
				</span>
			</div>
		</>
	);
}
