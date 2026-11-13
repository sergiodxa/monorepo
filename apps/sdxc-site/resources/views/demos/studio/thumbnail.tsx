/**
 * Quoin's gallery miniature: the studio's claim in its oversized Didone on faint column
 * guides, over the edge of the navy Harbour Line plate, so the card shows the printed
 * portfolio the landing is set as.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { DIDONE, MONO } from "~/resources/views/demos/studio/type";

/**
 * Renders the guides, the running head, the claim and the plate's top edge.
 *
 * @returns The render function producing the scene.
 */
export default function StudioThumbnail() {
	return () => (
		<>
			<div
				mix={[
					raw({
						position: "absolute",
						inset: "0 1.25rem",
						display: "grid",
						gridTemplateColumns: "repeat(6, 1fr)",
						columnGap: "0.5rem",
					}),
				]}
			>
				{Array.from({ length: 6 }, (_, index) => (
					<span
						key={index}
						mix={[
							raw({
								backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 4%, transparent)",
								borderInline: "1px solid color-mix(in oklch, var(--ui-brand-fg) 10%, transparent)",
							}),
						]}
					/>
				))}
			</div>
			<div
				mix={[
					raw({
						position: "absolute",
						insetBlockStart: "1rem",
						insetInline: "1.25rem",
						display: "grid",
						gap: "0.5rem",
					}),
				]}
			>
				<span
					mix={[
						raw({
							display: "flex",
							justifyContent: "space-between",
							paddingBlockEnd: "0.25rem",
							borderBlockEnd: "1px solid var(--ui-landing-hairline)",
							fontFamily: MONO,
							fontSize: "8px",
							letterSpacing: "0.1em",
							textTransform: "uppercase",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					<span>Quoin · Antwerp</span>
					<span mix={[raw({ color: "var(--ui-brand-fg)" })]}>Booking from March</span>
				</span>
				<span
					mix={[
						raw({
							fontFamily: DIDONE,
							fontSize: "2.25rem",
							lineHeight: "0.92",
							letterSpacing: "-0.03em",
							maxInlineSize: "11ch",
						}),
					]}
				>
					Designed and built <i>in one room</i>
				</span>
			</div>
			<div
				mix={[
					raw({
						position: "absolute",
						insetInline: "0",
						insetBlockEnd: "0",
						blockSize: "1.75rem",
						backgroundColor: "#0d1b2e",
						backgroundImage:
							"linear-gradient(to right, transparent 38%, #08121f 38% 62%, transparent 62%)",
					}),
				]}
			/>
		</>
	);
}
