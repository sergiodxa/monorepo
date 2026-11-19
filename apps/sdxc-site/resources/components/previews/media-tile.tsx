/**
 * Live preview for `MediaTile`: an album and a playlist as square tiles and an artist as a
 * round one, each a link with its own play button rising over the art under the pointer.
 * The art is a drawn gradient standing in for a cover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { PlayIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { MediaTile } from "@sdxc/ui/audio";

/** The source the page shows, matching the markup below apart from the drawn art. */
const CODE = `<MediaTile
	href="/album/tidelight"
	title="Tidelight"
	subtitle="2025 · Lumen Harbor"
	art={<img src="/covers/tidelight.jpg" alt="" />}
	play={<button type="button" aria-label="Play Tidelight">…</button>}
/>

<MediaTile
	shape="round"
	href="/artist/night-ferry"
	title="Night Ferry"
	subtitle="Artist"
	art={<img src="/artists/night-ferry.jpg" alt="" />}
/>`;

/** A gradient standing in for a cover. */
function Art(handle: Handle<{ from: string; to: string }>) {
	return () => (
		<span
			mix={[
				raw({
					background: `radial-gradient(circle at 50% 58%, oklch(0.9 0.08 85) 0 18%, transparent 19%), linear-gradient(160deg, ${handle.props.from}, ${handle.props.to})`,
				}),
			]}
		/>
	);
}

/** The round play button over a tile's art. */
function Play(handle: Handle<{ name: string }>) {
	return () => (
		<button
			type="button"
			aria-label={`Play ${handle.props.name}`}
			mix={[
				raw({
					display: "inline-grid",
					placeItems: "center",
					inlineSize: "3rem",
					blockSize: "3rem",
					border: "0",
					borderRadius: "999px",
					color: "white",
					backgroundColor: "var(--ui-brand-bg-solid)",
					boxShadow: "0 8px 20px -8px rgb(0 0 0 / 0.5)",
					cursor: "pointer",
				}),
			]}
		>
			<PlayIcon size={20} fill="currentColor" aria-hidden="true" />
		</button>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "repeat(3, minmax(0, 10rem))",
					gap: "1rem",
					maxInlineSize: "100%",
					overflowX: "auto",
				}),
			]}
		>
			<MediaTile
				href="#tidelight"
				title="Tidelight"
				subtitle="2025 · Lumen Harbor"
				art={<Art from="oklch(0.32 0.08 240)" to="oklch(0.55 0.1 220)" />}
				play={<Play name="Tidelight" />}
			/>
			<MediaTile
				href="#night-drive"
				title="Night Drive"
				subtitle="Synths, streetlights and the long way home."
				art={<Art from="oklch(0.2 0.06 285)" to="oklch(0.5 0.18 330)" />}
				play={<Play name="Night Drive" />}
			/>
			<MediaTile
				shape="round"
				href="#night-ferry"
				title="Night Ferry"
				subtitle="Artist"
				art={<Art from="oklch(0.3 0.1 260)" to="oklch(0.6 0.14 200)" />}
				play={<Play name="Night Ferry" />}
			/>
		</div>
	),
};
