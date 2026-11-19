/**
 * Live preview for `MediaGrid`: a profile's grid of six tiles, one of several photos marked in
 * its corner and a video standing two rows tall, each showing its likes on hover or focus.
 * The pictures are drawn gradients.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FilmIcon, HeartIcon, LayersIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { MediaGrid } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from the drawn pictures. */
const CODE = `<MediaGrid label="Posts">
	{posts.map((post) => (
		<MediaGrid.Item
			href={post.href}
			label={post.alt}
			tall={post.video}
			badge={post.video ? <FilmIcon /> : post.many ? <LayersIcon /> : undefined}
			overlay={<span><HeartIcon fill="currentColor" /> {post.likes}</span>}
		>
			<img src={post.thumb} alt="" />
		</MediaGrid.Item>
	))}
</MediaGrid>`;

/** The tiles: a hue, a like count, and whether each is a video or holds several photos. */
const TILES = [
	{ hue: 40, likes: "3.1K", many: true, video: false },
	{ hue: 220, likes: "18.4K", many: false, video: true },
	{ hue: 140, likes: "812", many: false, video: false },
	{ hue: 260, likes: "1.5K", many: true, video: false },
	{ hue: 70, likes: "2.0K", many: false, video: false },
	{ hue: 20, likes: "640", many: false, video: false },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "24rem", marginInline: "auto" })]}>
			<MediaGrid label="Posts">
				{TILES.map((tile, index) => (
					<MediaGrid.Item
						href={`#post-${index + 1}`}
						label={`Post ${index + 1}`}
						tall={tile.video}
						badge={iconFor(tile)}
						overlay={
							<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}>
								<HeartIcon size={16} fill="currentColor" strokeWidth={0} /> {tile.likes}
							</span>
						}
					>
						<span
							mix={[
								raw({
									background: `linear-gradient(160deg, oklch(0.85 0.07 ${tile.hue}), oklch(0.5 0.11 ${tile.hue + 25}))`,
								}),
							]}
						/>
					</MediaGrid.Item>
				))}
			</MediaGrid>
		</div>
	),
};

/** The corner icon a tile carries: a film for a video, a stack for several photos. */
function iconFor(tile: { many: boolean; video: boolean }) {
	if (tile.video) return <FilmIcon />;
	return tile.many ? <LayersIcon /> : undefined;
}
