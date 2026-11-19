/**
 * Wayfern's gallery miniature: the bar with its search pill, a grid of stay photos with their
 * prices, and the drawn map beside them with price pins, so the card reads as a place to book
 * stays before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { MAP_COLORS, RegionArt, WayfernMark, photoSrc } from "./art";
import { STAYS } from "./data";
import { money } from "./pricing";

/** The stays the miniature shows, one per place, in the order their cards sit. */
const SHOWN = ["the-canopy", "stillwater-boathouse", "gullwing-cottage", "dune-hollow"];

/** Renders the miniature on its own light ground, whatever the gallery's scheme. */
export function WayfernThumbnail() {
	return () => {
		let stays = SHOWN.map((id) => STAYS.find((stay) => stay.id === id)!);
		return (
			<div
				mix={[
					raw({
						position: "absolute",
						inset: "0",
						display: "grid",
						gridTemplateRows: "auto 1fr",
						overflow: "clip",
						backgroundColor: "var(--ui-bg)",
						color: "var(--ui-neutral-fg)",
						fontFamily: "var(--ui-font-sans)",
						...MAP_COLORS,
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							padding: "0.5rem 0.75rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<WayfernMark size={18} />
					<span
						mix={[
							raw({
								fontFamily: "var(--ui-font-serif)",
								fontWeight: "600",
								fontSize: "0.8125rem",
								color: "var(--ui-brand-fg-emphasis)",
							}),
						]}
					>
						wayfern
					</span>
					<span
						mix={[
							raw({
								marginInline: "auto",
								display: "flex",
								alignItems: "center",
								gap: "0.375rem",
								paddingInline: "0.625rem 0.25rem",
								blockSize: "1.5rem",
								borderRadius: "999px",
								boxShadow: "0 0 0 1px var(--ui-neutral-border), 0 2px 6px -2px rgb(0 0 0 / 0.2)",
								fontSize: "0.5625rem",
								fontWeight: "600",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						Furnas · Dec 4 – 9
						<span
							mix={[
								raw({
									inlineSize: "1rem",
									blockSize: "1rem",
									borderRadius: "999px",
									backgroundColor: "var(--ui-brand-bg-solid)",
								}),
							]}
						/>
					</span>
				</div>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "1.2fr 1fr",
							gap: "0.625rem",
							padding: "0.625rem",
							minBlockSize: "0",
						}),
					]}
				>
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: "0.5rem",
								alignContent: "start",
							}),
						]}
					>
						{stays.map((stay) => (
							<div mix={[raw({ display: "grid", gap: "0.1875rem", minInlineSize: "0" })]}>
								<img
									src={photoSrc(stay, "outside")}
									alt=""
									mix={[
										raw({
											display: "block",
											inlineSize: "100%",
											aspectRatio: "20 / 17",
											objectFit: "cover",
											borderRadius: "0.375rem",
											backgroundColor: stay.palette.sky,
										}),
									]}
								/>
								<span
									mix={[
										raw({
											fontSize: "0.5rem",
											fontWeight: "650",
											color: "var(--ui-neutral-fg-emphasis)",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}),
									]}
								>
									{stay.name}
								</span>
								<span mix={[raw({ fontSize: "0.5rem", color: "var(--ui-neutral-fg-muted)" })]}>
									{money(stay.nightly)} night
								</span>
							</div>
						))}
					</div>
					<div
						mix={[
							raw({
								position: "relative",
								overflow: "clip",
								borderRadius: "0.5rem",
								backgroundColor: "var(--wf-map-sea)",
							}),
						]}
					>
						<svg
							viewBox="40 30 320 260"
							preserveAspectRatio="xMidYMid slice"
							aria-hidden="true"
							mix={[
								raw({ position: "absolute", inset: "0", inlineSize: "100%", blockSize: "100%" }),
							]}
						>
							<RegionArt />
							{stays.map((stay, index) => (
								<g transform={`translate(${stay.x} ${stay.y})`}>
									<rect
										x="-19"
										y="-12"
										width="38"
										height="16"
										rx="8"
										fill={index === 0 ? "var(--ui-neutral-fg-emphasis)" : "var(--ui-bg)"}
										stroke="var(--ui-neutral-border)"
									/>
									<text
										y="0"
										text-anchor="middle"
										font-size="9"
										font-weight="700"
										fill={index === 0 ? "var(--ui-bg)" : "var(--ui-neutral-fg-emphasis)"}
									>
										{money(stay.nightly)}
									</text>
								</g>
							))}
						</svg>
					</div>
				</div>
			</div>
		);
	};
}
