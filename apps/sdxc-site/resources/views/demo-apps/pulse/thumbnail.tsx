/**
 * Pulse's gallery miniature: a dark rail of nav ticks beside four stat tabs, a latency line
 * with the incident shaded red, and status strips with one red day, so the card reads as an
 * ops dashboard at a glance in Pulse's own palette.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

/** The four stat tabs' headline figures, the first one current. */
const STATS = ["99.82%", "212 ms", "0.42%", "3"] as const;

/** Each strip's day statuses, as the tint of one bar. */
const STRIPS = [
	"uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuud",
	"nnnnnnnnnnuuuuuuuuuuuuguuuuuuuuuuggg",
	"uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu",
] as const;

/** The colour a strip letter draws in. */
const STRIP_COLOR: Record<string, string> = {
	u: "var(--ui-success-bg-solid, oklch(0.62 0.15 150))",
	g: "var(--ui-warning-bg-solid, oklch(0.75 0.15 75))",
	d: "var(--ui-danger-bg-solid, oklch(0.6 0.2 25))",
	n: "var(--ui-neutral-border)",
};

/** The latency line's path, rising into the incident at its end. */
const LINE = "M0 46 L20 44 L40 47 L60 43 L80 45 L100 42 L120 44 L140 41 L160 43 L180 30 L200 12";

/** Draws Pulse's overview in miniature for its gallery card. */
export function thumbnail() {
	return (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					gridTemplateColumns: "2.25rem 1fr",
					backgroundColor: "var(--ui-color-neutral-950)",
				}),
			]}
		>
			<div
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: "0.5rem",
						paddingBlock: "0.75rem",
					}),
				]}
			>
				<span
					mix={[
						raw({
							inlineSize: "1.125rem",
							blockSize: "1.125rem",
							borderRadius: "var(--ui-radius-md)",
							backgroundColor: "var(--ui-color-brand-500)",
						}),
					]}
				/>
				{[0, 1, 2, 3].map((index) => (
					<span
						key={index}
						mix={[
							raw({
								inlineSize: "0.875rem",
								blockSize: "0.25rem",
								borderRadius: "1px",
								backgroundColor:
									index === 1 ? "var(--ui-color-brand-400)" : "var(--ui-color-neutral-700)",
							}),
						]}
					/>
				))}
			</div>
			<div
				mix={[
					raw({
						margin: "0.5rem 0.5rem 0.5rem 0",
						padding: "0.625rem",
						display: "flex",
						flexDirection: "column",
						gap: "0.5rem",
						borderRadius: "var(--ui-radius-lg)",
						backgroundColor: "var(--ui-color-neutral-900)",
						border: "1px solid var(--ui-color-neutral-800)",
						color: "var(--ui-color-neutral-100)",
						overflow: "hidden",
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(4, 1fr)",
							border: "1px solid var(--ui-color-neutral-800)",
							borderRadius: "var(--ui-radius-md)",
						}),
					]}
				>
					{STATS.map((stat, index) => (
						<span
							key={stat}
							mix={[
								raw({
									padding: "0.3125rem 0.375rem",
									fontFamily: "var(--ui-font-mono)",
									fontWeight: "600",
									fontSize: "0.6875rem",
									borderInlineStart: index === 0 ? "none" : "1px solid var(--ui-color-neutral-800)",
									boxShadow: index === 0 ? "inset 0 -2px 0 var(--ui-color-brand-400)" : "none",
									color: index === 0 ? "var(--ui-color-brand-300)" : "inherit",
								}),
							]}
						>
							{stat}
						</span>
					))}
				</div>
				<svg
					viewBox="0 0 200 52"
					preserveAspectRatio="none"
					mix={[raw({ inlineSize: "100%", blockSize: "2.75rem" })]}
				>
					<rect x="168" y="0" width="32" height="52" fill="oklch(0.6 0.2 25 / 0.22)" />
					<rect x="60" y="0" width="22" height="52" fill="var(--ui-color-neutral-800)" />
					<path
						d={LINE}
						fill="none"
						stroke="var(--ui-color-brand-400)"
						stroke-width="2"
						vector-effect="non-scaling-stroke"
					/>
				</svg>
				{STRIPS.map((strip) => (
					<div key={strip} mix={[raw({ display: "flex", gap: "1px", blockSize: "0.5rem" })]}>
						{strip.split("").map((day, index) => (
							<span
								key={index}
								mix={[raw({ flex: "1", borderRadius: "1px", backgroundColor: STRIP_COLOR[day] })]}
							/>
						))}
					</div>
				))}
			</div>
		</div>
	);
}
