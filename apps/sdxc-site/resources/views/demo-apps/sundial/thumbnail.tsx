/**
 * Sundial's gallery miniature: a week of five columns on chalk paper, blocks in calendar colours
 * with two sharing an hour side by side, an all-day bar across the top and the marigold now
 * line, so the card reads as a calendar before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { colorValue } from "./data";
import { SundialMark } from "./shell";

/** The miniature's blocks: column, start and end in hours from 8, colour, and its share of the column. */
const BLOCKS: Array<[number, number, number, string, number, number]> = [
	[0, 1.5, 2, "plum", 0, 1],
	[0, 3.5, 5, "dial", 0, 1],
	[1, 1, 2.5, "plum", 0, 0.5],
	[1, 1.5, 2.5, "dial", 0.5, 0.5],
	[1, 4, 5, "fern", 0, 1],
	[2, 0.5, 2.5, "dial", 0, 1],
	[2, 5, 6, "plum", 0, 1],
	[3, 0, 0.75, "fern", 0, 1],
	[3, 2.5, 3, "plum", 0, 1],
	[3, 6.5, 7.5, "plum", 0, 1],
	[4, 1, 1.5, "dial", 0, 1],
	[4, 8.5, 10, "fern", 0, 1],
];

/** Renders the miniature on its own light ground, whatever the gallery's scheme. */
export function SundialThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					gridTemplateRows: "auto auto 1fr",
					overflow: "clip",
					backgroundColor: "oklch(0.985 0.006 80)",
					color: "oklch(0.25 0.02 250)",
					fontFamily: "var(--ui-font-sans)",
				}),
			]}
		>
			<div
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.4rem",
						padding: "0.5rem 0.7rem",
						fontSize: "0.65rem",
						fontWeight: "650",
						borderBlockEnd: "1px solid oklch(0.9 0.01 80)",
					}),
				]}
			>
				<SundialMark />
				November
				<span mix={[raw({ marginInlineStart: "auto", display: "flex", gap: "0.25rem" })]}>
					{["Day", "Week", "Month"].map((label) => (
						<span
							mix={[
								raw({
									padding: "0.1rem 0.4rem",
									borderRadius: "0.3rem",
									fontSize: "0.55rem",
									fontWeight: "500",
									backgroundColor: label === "Week" ? "white" : "transparent",
									boxShadow: label === "Week" ? "0 0 0 1px oklch(0.88 0.01 80)" : "none",
								}),
							]}
						>
							{label}
						</span>
					))}
				</span>
			</div>
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "1.6rem repeat(5, 1fr)",
						padding: "0.3rem 0.4rem 0.25rem 0",
						fontSize: "0.5rem",
						textAlign: "center",
						color: "oklch(0.55 0.02 250)",
					}),
				]}
			>
				<span />
				{["Mon 16", "Tue 17", "Wed 18", "Thu 19", "Fri 20"].map((day) => (
					<span mix={[raw({ fontWeight: day.startsWith("Wed") ? "700" : "500" })]}>{day}</span>
				))}
				<span />
				<span
					style={`background-color: color-mix(in oklch, ${colorValue("lagoon")} 22%, white); grid-column: 2 / 6`}
					mix={[
						raw({
							marginBlockStart: "0.2rem",
							padding: "0.1rem 0.3rem",
							borderRadius: "0.2rem",
							textAlign: "start",
							fontWeight: "600",
							color: "oklch(0.35 0.06 200)",
						}),
					]}
				>
					Planning week
				</span>
			</div>
			<div
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gridTemplateColumns: "1.6rem repeat(5, 1fr)",
						borderBlockStart: "1px solid oklch(0.9 0.01 80)",
						backgroundImage:
							"repeating-linear-gradient(to bottom, oklch(0.92 0.008 80) 0 1px, transparent 1px 1.1rem)",
					}),
				]}
			>
				<span />
				{[0, 1, 2, 3, 4].map((column) => (
					<div
						mix={[
							raw({ position: "relative", borderInlineStart: "1px solid oklch(0.92 0.008 80)" }),
						]}
					>
						{BLOCKS.filter((block) => block[0] === column).map(
							([, start, end, color, left, width]) => (
								<span
									style={`top: ${start * 1.1}rem; height: ${(end - start) * 1.1}rem; left: calc(${left * 100}% + 1px); width: calc(${width * 100}% - 3px); background-color: color-mix(in oklch, ${colorValue(color)} 18%, white); box-shadow: inset 2px 0 0 ${colorValue(color)}`}
									mix={[raw({ position: "absolute", borderRadius: "0.2rem" })]}
								/>
							),
						)}
						{column === 2 ? (
							<span
								mix={[
									raw({
										position: "absolute",
										insetInline: "0",
										top: "3.3rem",
										blockSize: "2px",
										backgroundColor: "oklch(0.72 0.16 70)",
									}),
								]}
							/>
						) : null}
					</div>
				))}
			</div>
		</div>
	);
}
