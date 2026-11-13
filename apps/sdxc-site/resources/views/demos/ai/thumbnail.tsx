/**
 * Margin's gallery miniature: a ruled notebook sheet with its red margin line, one line run
 * over with the highlighter and ending in a timestamp, so the card shows the page's paper,
 * ink and marker at a glance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { HAND, MONO, RULED_PAPER } from "~/resources/views/demos/ai/type";

/** How far each typed line runs, as a share of the column; `null` marks the highlighted one. */
const LINES = [92, 70, null, 84, 58];

/** Renders the sheet filling the card, tilted a degree like a page set on a desk. */
export default function MarginThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					"--margin-highlighter": "oklch(0.93 0.15 102)",
					"--margin-red-pen": "oklch(0.55 0.17 27)",
					"--margin-rule": "color-mix(in oklch, var(--ui-color-brand-500) 18%, transparent)",
					position: "absolute",
					inset: "1rem 1.25rem -1.5rem",
					rotate: "-1deg",
					display: "flex",
					flexDirection: "column",
					paddingBlock: "1.75rem",
					paddingInline: "4.25rem 1.25rem",
					backgroundColor: "var(--ui-color-neutral-50)",
					backgroundImage: `linear-gradient(to right, transparent 3.5rem, oklch(0.55 0.17 27 / 0.5) 3.5rem calc(3.5rem + 1px), transparent calc(3.5rem + 1px)), ${RULED_PAPER}`,
					boxShadow:
						"0 0 0 1px var(--ui-neutral-border), 0 12px 24px -16px oklch(0.4 0.05 70 / 0.4)",
					color: "oklch(0.22 0.02 75)",
				}),
			]}
		>
			<span
				mix={[
					raw({
						position: "absolute",
						insetBlockStart: "1.75rem",
						insetInlineStart: "0.375rem",
						fontFamily: HAND,
						fontSize: "0.8125rem",
						lineHeight: "1.75rem",
						color: "var(--ui-color-brand-600)",
					}),
				]}
			>
				Decided
			</span>
			{LINES.map((width) =>
				width === null ? (
					<span
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.375rem",
								blockSize: "1.75rem",
								fontSize: "0.8125rem",
								fontWeight: "600",
							}),
						]}
					>
						<span
							mix={[
								raw({
									paddingInline: "0.25rem",
									whiteSpace: "nowrap",
									backgroundColor: "oklch(0.93 0.15 102)",
								}),
							]}
						>
							Refunds: 14 days
						</span>
						<span
							mix={[
								raw({
									paddingInline: "0.25rem",
									fontFamily: MONO,
									fontSize: "0.6875rem",
									color: "var(--ui-color-brand-600)",
									boxShadow: "inset 0 0 0 1px var(--ui-color-brand-300)",
									borderRadius: "0.25rem",
								}),
							]}
						>
							02:18
						</span>
					</span>
				) : (
					<span mix={[raw({ display: "flex", alignItems: "center", blockSize: "1.75rem" })]}>
						<span
							mix={[
								raw({
									blockSize: "0.375rem",
									inlineSize: `${width}%`,
									borderRadius: "999px",
									backgroundColor: "var(--ui-color-neutral-300)",
								}),
							]}
						/>
					</span>
				),
			)}
		</div>
	);
}
