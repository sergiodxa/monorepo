/**
 * Rooftree's gallery miniature: a phone rising out of a sunshine block, its shared list in the
 * rounded face with grape checkmarks, so the card shows the playful, store-polished register
 * the landing is set in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { dark } from "@sdxc/u/responsive";

/** The list on the phone's screen, and which items are done. */
const ITEMS = [
	{ label: "Oat milk", done: true },
	{ label: "Take out bins", done: false },
	{ label: "Taco night", done: false },
];

/** Renders the sunshine stage and the phone standing in it. */
export default function RooftreeThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "flex",
					justifyContent: "center",
					paddingBlockStart: "1.25rem",
					backgroundImage: "linear-gradient(170deg, oklch(0.94 0.1 98), oklch(0.86 0.15 82))",
				}),
				dark(
					raw({
						backgroundImage:
							"linear-gradient(170deg, var(--ui-color-brand-800), var(--ui-color-brand-950))",
					}),
				),
			]}
		>
			<div
				mix={[
					raw({
						inlineSize: "9.5rem",
						blockSize: "12rem",
						padding: "0.375rem",
						borderRadius: "1.5rem",
						backgroundColor: "var(--ui-color-neutral-950)",
						boxShadow: "0 18px 36px -14px var(--ui-color-brand-700)",
					}),
				]}
			>
				<div
					mix={[
						raw({
							blockSize: "100%",
							display: "flex",
							flexDirection: "column",
							gap: "0.375rem",
							padding: "0.875rem 0.625rem",
							borderRadius: "1.125rem",
							backgroundColor: "var(--ui-color-neutral-50)",
							color: "var(--ui-color-neutral-900)",
						}),
					]}
				>
					<span
						mix={[
							raw({
								fontFamily: "var(--ui-font-display)",
								fontSize: "0.875rem",
								fontWeight: "800",
								letterSpacing: "-0.02em",
							}),
						]}
					>
						Today
					</span>
					{ITEMS.map((item) => (
						<span
							key={item.label}
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "0.375rem",
									padding: "0.25rem 0.375rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-color-brand-50)",
									fontFamily: "var(--ui-font-display)",
									fontWeight: "650",
									textDecoration: item.done ? "line-through" : "none",
									color: item.done ? "var(--ui-color-neutral-500)" : "inherit",
								}),
							]}
						>
							<span
								mix={[
									raw({
										flexShrink: "0",
										inlineSize: "0.625rem",
										blockSize: "0.625rem",
										borderRadius: "9999px",
										border: "2px solid var(--ui-color-brand-500)",
										backgroundColor: item.done ? "var(--ui-color-brand-500)" : "transparent",
									}),
								]}
							/>
							{item.label}
						</span>
					))}
				</div>
			</div>
		</div>
	);
}
