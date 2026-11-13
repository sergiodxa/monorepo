/**
 * Plumb's gallery miniature: a near-black terminal cropped off the stage's edge, its
 * install line and a check in mono, and the benchmark's bars beside it with the compiled
 * bar in lime, so the card shows the dark, mono, single-accent register of the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { BENCHMARK } from "~/resources/views/demos/library/data";

/** The terminal's lines: the text, and whether it is the lime success line. */
const LINES = [
	["$ bun add plumb", false],
	["+ plumb@4.2.0  0 deps", false],
	["$ bunx plumb check", false],
	["✓ User  compiled 0.4 ms", true],
] as const;

/** Renders the terminal and the bars. */
export default function PlumbThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "1.25rem -1.5rem -1rem 1.25rem",
					display: "grid",
					gridTemplateColumns: "1.25fr 1fr",
					gap: "0.75rem",
					fontFamily: "var(--ui-font-mono)",
				}),
			]}
		>
			<div
				mix={[
					raw({
						display: "grid",
						alignContent: "start",
						gap: "0.375rem",
						padding: "0.75rem",
						borderRadius: "6px",
						backgroundColor: "var(--ui-surface-raised)",
						boxShadow:
							"0 0 0 1px var(--ui-landing-hairline), 0 0 48px -12px color-mix(in oklch, var(--ui-brand-bg-solid) 35%, transparent)",
						color: "var(--ui-neutral-fg)",
						whiteSpace: "nowrap",
						overflow: "hidden",
					}),
				]}
			>
				{LINES.map(([line, ok]) => (
					<span key={line} mix={[raw({ color: ok ? "var(--ui-brand-fg)" : "inherit" })]}>
						{line}
					</span>
				))}
			</div>
			<div
				mix={[
					raw({
						display: "grid",
						alignContent: "start",
						gap: "0.5rem",
						paddingBlockStart: "0.5rem",
					}),
				]}
			>
				<span mix={[raw({ fontSize: "1.375rem", fontWeight: "700", letterSpacing: "-0.04em" })]}>
					39.6M
				</span>
				{BENCHMARK.map((row, index) => (
					<span
						key={row.label}
						mix={[
							raw({
								display: "block",
								blockSize: "0.375rem",
								inlineSize: `${(row.value / BENCHMARK[0].value) * 100}%`,
								borderRadius: "9999px",
								backgroundColor:
									index === 1 ? "var(--ui-brand-bg-solid)" : "var(--ui-neutral-fg-muted)",
							}),
						]}
					/>
				))}
			</div>
		</div>
	);
}
