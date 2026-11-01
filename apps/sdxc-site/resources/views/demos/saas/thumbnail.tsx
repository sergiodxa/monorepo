/**
 * Keel's gallery miniature: its product frame, cropped off the stage's right edge, with the
 * revenue figure in mono and the month's usage as sea-green bars, so the card shows the
 * precise, technical register the landing is set in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

/** The month's usage, one bar a day, as a share of the tallest. */
const USAGE = [38, 44, 41, 52, 49, 58, 55, 63, 60, 71, 68, 77, 74, 86, 82, 94];

/** Renders the product frame: chrome, a rail of nav lines, the figure and the bars. */
export default function KeelThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					insetBlockStart: "1.25rem",
					insetInlineStart: "1.25rem",
					insetInlineEnd: "-2rem",
					insetBlockEnd: "-1rem",
					display: "grid",
					gridTemplateColumns: "5.5rem 1fr",
					gridTemplateRows: "1.5rem 1fr",
					borderRadius: "var(--ui-landing-radius-frame, 8px)",
					backgroundColor: "var(--ui-surface-raised)",
					boxShadow: "0 0 0 1px var(--ui-neutral-border), 0 12px 32px -12px rgb(0 0 0 / 0.25)",
				}),
			]}
		>
			<div
				mix={[
					raw({
						gridColumn: "1 / -1",
						display: "flex",
						alignItems: "center",
						gap: "0.25rem",
						paddingInline: "0.625rem",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				{[0, 1, 2].map((dot) => (
					<span
						key={dot}
						mix={[
							raw({
								inlineSize: "0.375rem",
								blockSize: "0.375rem",
								borderRadius: "9999px",
								backgroundColor: "var(--ui-neutral-border)",
							}),
						]}
					/>
				))}
			</div>
			<div
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						gap: "0.5rem",
						padding: "0.75rem 0.625rem",
						borderInlineEnd: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				{[70, 55, 80, 45].map((width, index) => (
					<span
						key={width}
						mix={[
							raw({
								blockSize: "0.3125rem",
								inlineSize: `${width}%`,
								borderRadius: "2px",
								backgroundColor:
									index === 0 ? "var(--ui-color-brand-500)" : "var(--ui-neutral-border)",
							}),
						]}
					/>
				))}
			</div>
			<div
				mix={[raw({ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.75rem" })]}
			>
				<span
					mix={[
						raw({
							fontFamily: "var(--ui-font-mono)",
							color: "var(--ui-neutral-fg-muted)",
							textTransform: "uppercase",
							letterSpacing: "0.08em",
						}),
					]}
				>
					MRR
				</span>
				<span
					mix={[
						raw({
							fontFamily: "var(--ui-font-mono)",
							fontSize: "1.25rem",
							fontWeight: "600",
							letterSpacing: "-0.03em",
							fontVariantNumeric: "tabular-nums",
						}),
					]}
				>
					$48,210
				</span>
				<div
					mix={[
						raw({
							flex: "1",
							display: "flex",
							alignItems: "flex-end",
							gap: "3px",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					{USAGE.map((height, index) => (
						<span
							key={index}
							mix={[
								raw({
									flex: "1",
									blockSize: `${height}%`,
									borderRadius: "2px 2px 0 0",
									backgroundColor:
										index === USAGE.length - 1
											? "var(--ui-color-brand-500)"
											: "color-mix(in oklch, var(--ui-color-brand-500) 35%, transparent)",
								}),
							]}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
