/**
 * Vesper's gallery miniature: the dark bar, a billboard with its title and Play pill, and a
 * shelf of key art running off the edge, so the card reads as a streaming service before
 * its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { KeyArt } from "./art";
import { TITLES } from "./data";
import { VesperMark } from "./shell";

/** The shelf's titles, after the featured one. */
const SHELF = ["halcyon-station", "ember-line", "the-lantern-year", "glasshouse", "signal-fire"];

/** Renders the miniature on its own night ground, whatever the gallery's scheme. */
export function VesperThumbnail() {
	return () => {
		let featured = TITLES[0]!;
		return (
			<div
				class="dark"
				mix={[
					raw({
						position: "absolute",
						inset: "0",
						display: "grid",
						gridTemplateRows: "auto 1fr auto",
						overflow: "clip",
						backgroundColor: "oklch(0.125 0.012 295)",
						color: "oklch(0.95 0.007 300)",
						fontFamily: "var(--ui-font-sans)",
					}),
				]}
			>
				<div
					mix={[
						raw({
							position: "absolute",
							inset: "0 0 35% 0",
							"& > [data-key-art]": { position: "absolute", inset: "0" },
							"&::after": {
								content: '""',
								position: "absolute",
								inset: "0",
								background:
									"linear-gradient(to top, oklch(0.125 0.012 295), transparent 60%), linear-gradient(to right, oklch(0.125 0.012 295 / 0.8), transparent 70%)",
							},
						}),
					]}
				>
					<KeyArt title={featured} named={false} />
				</div>
				<div
					mix={[
						raw({
							position: "relative",
							display: "flex",
							alignItems: "center",
							gap: "0.35rem",
							padding: "0.55rem 0.75rem",
							fontSize: "0.6rem",
							fontWeight: "700",
							letterSpacing: "0.18em",
						}),
					]}
				>
					<VesperMark size={14} />
					VESPER
					<span
						mix={[
							raw({
								marginInlineStart: "0.6rem",
								fontWeight: "500",
								letterSpacing: "0",
								opacity: "0.7",
								display: "flex",
								gap: "0.6rem",
							}),
						]}
					>
						<span>Home</span>
						<span>Series</span>
						<span>Films</span>
					</span>
				</div>
				<div
					mix={[
						raw({
							position: "relative",
							alignSelf: "end",
							display: "grid",
							gap: "0.3rem",
							padding: "0 0.75rem 0.6rem",
						}),
					]}
				>
					<span
						mix={[
							raw({
								fontFamily: "Didot, 'Bodoni 72', Georgia, serif",
								fontSize: "1.35rem",
								letterSpacing: "0.1em",
								lineHeight: "1",
							}),
						]}
					>
						TIDEWATER
					</span>
					<span mix={[raw({ display: "flex", gap: "0.3rem" })]}>
						<span
							mix={[
								raw({
									padding: "0.15rem 0.55rem",
									borderRadius: "999px",
									fontSize: "0.55rem",
									fontWeight: "700",
									backgroundColor: "oklch(0.68 0.18 45)",
									color: "oklch(0.15 0.02 40)",
								}),
							]}
						>
							▶ Play
						</span>
						<span
							mix={[
								raw({
									padding: "0.15rem 0.55rem",
									borderRadius: "999px",
									fontSize: "0.55rem",
									fontWeight: "600",
									backgroundColor: "rgb(255 255 255 / 0.16)",
								}),
							]}
						>
							More info
						</span>
					</span>
				</div>
				<div
					mix={[
						raw({
							position: "relative",
							display: "flex",
							gap: "0.35rem",
							padding: "0 0 0.7rem 0.75rem",
						}),
					]}
				>
					{SHELF.map((id) => {
						let title = TITLES.find((entry) => entry.id === id)!;
						return (
							<span
								mix={[
									raw({
										flex: "0 0 26%",
										position: "relative",
										aspectRatio: "16 / 9",
										overflow: "clip",
										borderRadius: "0.25rem",
										"& > *": { position: "absolute", inset: "0" },
									}),
								]}
							>
								<KeyArt title={title} />
							</span>
						);
					})}
				</div>
			</div>
		);
	};
}
