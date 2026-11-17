/**
 * Live preview for `VideoCard`: a landscape still part way watched with its episode in the
 * meta line, a portrait poster under a "New" badge, and a plain card, each one link named by
 * its title. The art is a drawn gradient standing in for a still or key art.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { VideoCard } from "@sdxc/ui/video";

/** The source the page shows, matching the markup below apart from the drawn art. */
const CODE = `<VideoCard
	href="/watch/tidewater/2-3"
	title="Tidewater"
	art={<img src="/stills/tidewater-203.jpg" alt="" />}
	meta="S2:E3 · Lee Shore"
	progress={0.42}
	progressLabel="42% watched"
/>

<VideoCard
	shape="poster"
	href="/title/signal-fire"
	title="Signal Fire"
	art={<img src="/posters/signal-fire.jpg" alt="" />}
	meta="2026 · Science fiction"
	badge="New"
/>`;

/** A gradient standing in for a picture, from a sky colour down to a horizon. */
function Art(handle: Handle<{ sky: string; ground: string }>) {
	return () => (
		<span
			mix={[
				raw({
					background: `radial-gradient(circle at 70% 62%, oklch(0.9 0.09 85) 0 7%, transparent 8%), linear-gradient(${handle.props.sky}, ${handle.props.ground})`,
				}),
			]}
		/>
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
					gridTemplateColumns: "minmax(0, 16rem) minmax(0, 9rem) minmax(0, 16rem)",
					alignItems: "start",
					gap: "1rem",
					maxInlineSize: "100%",
					overflowX: "auto",
				}),
			]}
		>
			<VideoCard
				href="#tidewater"
				title="Tidewater"
				art={<Art sky="oklch(0.28 0.06 235)" ground="oklch(0.5 0.09 205)" />}
				meta="S2:E3 · Lee Shore"
				progress={0.42}
				progressLabel="42% watched"
			/>
			<VideoCard
				shape="poster"
				href="#signal-fire"
				title="Signal Fire"
				art={<Art sky="oklch(0.2 0.06 255)" ground="oklch(0.45 0.13 30)" />}
				meta="2026 · Science fiction"
				badge="New"
			/>
			<VideoCard
				href="#low-country"
				title="Low Country"
				art={<Art sky="oklch(0.36 0.05 60)" ground="oklch(0.7 0.09 75)" />}
				meta="2025 · Documentary · 1h 28m"
			/>
		</div>
	),
};
