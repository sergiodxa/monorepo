/**
 * Inkwell's gallery miniature: the editor at a glance. A paper frame with a slim nav, a
 * serif title over lines of prose in the writing column, and the properties column under a
 * quiet "Saved" and the one ink-blue Publish button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { mark } from "~/resources/views/demo-apps/inkwell/shell";

/** How far each line of the miniature's prose runs, as a share of the column. */
const PROSE = [100, 94, 98, 71, 0, 100, 88, 62];

/** The properties the miniature's sidebar lists, label and value width. */
const PROPERTIES: Array<[string, number]> = [
	["Status", 52],
	["Author", 70],
	["Tags", 44],
	["Schedule", 60],
];

/**
 * Draws the miniature with plain elements and theme variables, so it takes the app's
 * palette, faces and radii from the stage around it.
 *
 * @returns The scene.
 */
export function inkwellThumbnail() {
	let line = (width: number, tone = "var(--ui-neutral-border)") => (
		<span
			mix={[
				raw({
					display: "block",
					blockSize: width === 0 ? "0.25rem" : "0.3125rem",
					inlineSize: `${width}%`,
					borderRadius: "9999px",
					backgroundColor: width === 0 ? "transparent" : tone,
				}),
			]}
		/>
	);

	return (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					gridTemplateColumns: "2.25rem minmax(0, 1fr)",
					backgroundColor: "var(--ui-color-neutral-100)",
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
						paddingBlock: "0.625rem",
					}),
				]}
			>
				{mark(16)}
				{[0, 1, 2, 3].map((index) => (
					<span
						mix={[
							raw({
								inlineSize: "0.875rem",
								blockSize: "0.875rem",
								borderRadius: "0.25rem",
								backgroundColor:
									index === 1 ? "var(--ui-color-brand-200)" : "var(--ui-color-neutral-300)",
							}),
						]}
					/>
				))}
			</div>
			<div
				mix={[
					raw({
						margin: "0.375rem 0.375rem 0.375rem 0",
						borderRadius: "0.625rem",
						backgroundColor: "var(--ui-bg)",
						boxShadow: "0 0 0 1px var(--ui-neutral-border)",
						display: "grid",
						gridTemplateRows: "auto minmax(0, 1fr)",
						overflow: "hidden",
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							padding: "0.375rem 0.625rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>‹</span>
					<span mix={[raw({ flex: "1", color: "var(--ui-neutral-fg-muted)" })]}>Saved</span>
					<span
						mix={[
							raw({
								padding: "0.125rem 0.5rem",
								borderRadius: "var(--ui-radius-md, 0.375rem)",
								backgroundColor: "var(--ui-brand-bg-solid)",
								color: "var(--ui-color-brand-50)",
								fontWeight: "600",
							}),
						]}
					>
						Publish
					</span>
				</div>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr) 34%",
							minBlockSize: "0",
						}),
					]}
				>
					<div
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								gap: "0.3125rem",
								padding: "0.75rem 0.875rem",
							}),
						]}
					>
						<span
							mix={[
								raw({
									fontFamily: "var(--ui-font-serif)",
									fontSize: "1.0625rem",
									fontWeight: "600",
									lineHeight: "1.1",
									marginBlockEnd: "0.125rem",
								}),
							]}
						>
							On slow reading
						</span>
						<span
							mix={[
								raw({
									fontFamily: "var(--ui-font-serif)",
									fontStyle: "italic",
									color: "var(--ui-neutral-fg-muted)",
									marginBlockEnd: "0.25rem",
								}),
							]}
						>
							What a book asks of us.
						</span>
						{PROSE.map((width) => line(width))}
					</div>
					<div
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								gap: "0.5rem",
								padding: "0.75rem 0.625rem",
								borderInlineStart: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						{PROPERTIES.map(([label, width], index) => (
							<span mix={[raw({ display: "flex", flexDirection: "column", gap: "0.1875rem" })]}>
								<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", fontSize: "9px" })]}>
									{label}
								</span>
								{line(
									width,
									index === 0 ? "var(--ui-color-brand-300)" : "var(--ui-neutral-border)",
								)}
							</span>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
