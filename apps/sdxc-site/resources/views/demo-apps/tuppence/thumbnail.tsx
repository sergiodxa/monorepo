/**
 * Tuppence's gallery miniature: an oat page with the total balance in serif, a clay card,
 * the month's spending curve over last month's, and three statement rows, so the card reads
 * as a calm money app before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { SERIF } from "./parts";
import { TuppenceMark } from "./shell";

/** Three invented statement rows: a mark's hue, a merchant and an amount. */
const ROWS = [
	{ hue: 55, name: "Café Lumen", amount: "€3.40" },
	{ hue: 140, name: "Pomar Market", amount: "€41.26" },
	{ hue: 150, name: "Atelier Norte", amount: "+€2,100.00" },
] as const;

/** Renders the miniature on its own oat ground. */
export function TuppenceThumbnail() {
	return () => (
		<div
			aria-hidden="true"
			mix={raw({
				position: "absolute",
				inset: "0",
				display: "grid",
				gridTemplateColumns: "1.15fr 1fr",
				gridTemplateRows: "auto auto 1fr",
				gap: "0.5rem 0.75rem",
				padding: "0.75rem 0.9rem",
				overflow: "clip",
				backgroundColor: "light-dark(oklch(0.962 0.01 78), oklch(0.19 0.008 56))",
				color: "light-dark(oklch(0.24 0.01 58), oklch(0.95 0.008 78))",
				fontFamily: "var(--ui-font-sans)",
			})}
		>
			<div
				mix={raw({
					gridColumn: "1 / -1",
					display: "flex",
					alignItems: "center",
					gap: "0.35rem",
					fontFamily: SERIF,
					fontWeight: "700",
					fontSize: "0.7rem",
				})}
			>
				<TuppenceMark size={14} />
				Tuppence
			</div>
			<div mix={raw({ display: "flex", flexDirection: "column", gap: "0.1rem" })}>
				<span
					mix={raw({
						fontSize: "0.42rem",
						letterSpacing: "0.06em",
						textTransform: "uppercase",
						opacity: "0.6",
					})}
				>
					Total balance
				</span>
				<span
					mix={raw({
						fontFamily: SERIF,
						fontSize: "1.35rem",
						fontWeight: "600",
						letterSpacing: "-0.02em",
						lineHeight: "1",
					})}
				>
					€12,840<span mix={raw({ fontSize: "0.62em" })}>.56</span>
				</span>
			</div>
			<div
				mix={raw({
					gridRow: "2 / span 2",
					gridColumn: "2",
					alignSelf: "start",
					aspectRatio: "85.6 / 53.98",
					borderRadius: "0.4rem",
					padding: "0.4rem 0.5rem",
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					color: "white",
					fontSize: "0.42rem",
					background: "linear-gradient(135deg, oklch(0.72 0.135 42), oklch(0.48 0.125 36))",
					boxShadow: "0 8px 16px -10px oklch(0.4 0.1 35 / 0.6)",
				})}
			>
				<span mix={raw({ fontWeight: "700" })}>Tuppence</span>
				<span
					mix={raw({
						display: "block",
						inlineSize: "0.85rem",
						blockSize: "0.62rem",
						borderRadius: "0.12rem",
						backgroundColor: "#e2c178",
					})}
				/>
				<span
					mix={raw({
						display: "flex",
						justifyContent: "space-between",
						fontFamily: "ui-monospace, monospace",
						letterSpacing: "0.06em",
					})}
				>
					<span>•••• 4821</span>
					<span mix={raw({ fontFamily: "inherit", fontStyle: "italic", fontWeight: "700" })}>
						debit
					</span>
				</span>
			</div>
			<div
				mix={raw({ display: "flex", flexDirection: "column", gap: "0.35rem", minInlineSize: "0" })}
			>
				<svg viewBox="0 0 120 34" mix={raw({ display: "block", inlineSize: "100%" })}>
					<path
						d="M0 32 C 20 28, 34 18, 52 15 S 90 8, 120 3"
						fill="none"
						stroke="oklch(0.6 0.016 66)"
						stroke-width="1.2"
						stroke-dasharray="3 3"
					/>
					<path
						d="M0 32 C 18 29, 30 22, 46 20 S 64 16, 72 14 L 72 34 L 0 34 Z"
						fill="oklch(0.6 0.12 148 / 0.18)"
					/>
					<path
						d="M0 32 C 18 29, 30 22, 46 20 S 64 16, 72 14"
						fill="none"
						stroke="oklch(0.6 0.12 148)"
						stroke-width="1.6"
					/>
				</svg>
				{ROWS.map((row) => (
					<div
						mix={raw({ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.45rem" })}
					>
						<span
							mix={raw({
								inlineSize: "0.7rem",
								blockSize: "0.7rem",
								borderRadius: "28%",
								flex: "none",
								backgroundColor: `light-dark(oklch(0.9 0.06 ${row.hue}), oklch(0.36 0.06 ${row.hue}))`,
							})}
						/>
						<span
							mix={raw({
								flex: "1",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							})}
						>
							{row.name}
						</span>
						<span
							mix={raw({
								fontVariantNumeric: "tabular-nums",
								color: row.amount.startsWith("+") ? "oklch(0.55 0.13 150)" : "inherit",
							})}
						>
							{row.amount}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
