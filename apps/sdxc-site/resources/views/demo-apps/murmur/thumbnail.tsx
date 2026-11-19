/**
 * Murmur's gallery miniature: a sidebar of covers, a shelf of albums, and the player bar along
 * the foot with its progress, so the card reads as a music app before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { albumArt, playlistArt } from "./art";
import { ALBUMS, PLAYLISTS } from "./data";
import { MurmurMark } from "./shell";

/** The albums on the miniature's shelf. */
const SHELF = ["midnight-citrus", "tidelight", "harbor-lights", "maps-in-the-dark"];

/** Renders the miniature in the app's own scheme. */
export function MurmurThumbnail() {
	return () => {
		let albums = SHELF.map((id) => ALBUMS.find((album) => album.id === id)).filter(
			(album) => album !== undefined,
		);
		let playing = albums[0];
		return (
			<div
				mix={[
					raw({
						position: "absolute",
						inset: "0",
						display: "grid",
						gridTemplateColumns: "28% 1fr",
						gridTemplateRows: "1fr auto",
						gap: "4px",
						padding: "4px",
						overflow: "clip",
						fontFamily: "var(--ui-font-sans)",
						color: "var(--ui-neutral-fg)",
						backgroundColor:
							"color-mix(in oklch, var(--ui-bg, Canvas) 90%, var(--ui-color-neutral-950, black))",
						"& img": {
							display: "block",
							inlineSize: "100%",
							aspectRatio: "1",
							borderRadius: "4px",
						},
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "grid",
							alignContent: "start",
							gap: "6px",
							padding: "8px",
							borderRadius: "8px",
							backgroundColor: "var(--ui-bg, Canvas)",
						}),
					]}
				>
					<span
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "6px",
								fontSize: "11px",
								fontWeight: "850",
							}),
						]}
					>
						<MurmurMark size={16} />
						Murmur
					</span>
					{PLAYLISTS.slice(0, 4).map((playlist) => (
						<span
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "22px 1fr",
									alignItems: "center",
									gap: "6px",
									fontSize: "8px",
									fontWeight: "600",
								}),
							]}
						>
							<img src={playlistArt(playlist)} alt="" width="22" height="22" />
							<span
								mix={[raw({ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" })]}
							>
								{playlist.title}
							</span>
						</span>
					))}
				</div>
				<div
					mix={[
						raw({
							display: "grid",
							alignContent: "start",
							gap: "8px",
							padding: "10px",
							borderRadius: "8px",
							backgroundColor: "var(--ui-bg, Canvas)",
							backgroundImage:
								"linear-gradient(to bottom, color-mix(in oklch, var(--ui-brand-bg-solid) 28%, transparent), transparent 55%)",
						}),
					]}
				>
					<span
						mix={[
							raw({
								fontSize: "13px",
								fontWeight: "850",
								letterSpacing: "-0.02em",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						New releases
					</span>
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
								gap: "8px",
							}),
						]}
					>
						{albums.map((album) => (
							<span
								mix={[raw({ display: "grid", gap: "3px", fontSize: "7px", fontWeight: "700" })]}
							>
								<img src={albumArt(album)} alt="" width="60" height="60" />
								<span
									mix={[
										raw({ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }),
									]}
								>
									{album.title}
								</span>
							</span>
						))}
					</div>
				</div>
				<div
					mix={[
						raw({
							gridColumn: "1 / -1",
							display: "grid",
							gridTemplateColumns: "26px 1fr 40%",
							alignItems: "center",
							gap: "8px",
							padding: "4px 6px",
						}),
					]}
				>
					{playing === undefined ? null : (
						<img src={albumArt(playing)} alt="" width="26" height="26" />
					)}
					<span mix={[raw({ display: "grid", fontSize: "8px" })]}>
						<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
							Last Train Bloom
						</strong>
						<span>Neon Orchard</span>
					</span>
					<span mix={[raw({ display: "grid", justifyItems: "center", gap: "4px" })]}>
						<span
							mix={[
								raw({
									inlineSize: "14px",
									blockSize: "14px",
									borderRadius: "999px",
									backgroundColor: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						/>
						<span
							mix={[
								raw({
									inlineSize: "100%",
									blockSize: "3px",
									borderRadius: "999px",
									backgroundImage:
										"linear-gradient(to right, var(--ui-brand-bg-solid) 38%, color-mix(in oklch, currentColor 25%, transparent) 38%)",
								}),
							]}
						/>
					</span>
				</div>
			</div>
		);
	};
}
