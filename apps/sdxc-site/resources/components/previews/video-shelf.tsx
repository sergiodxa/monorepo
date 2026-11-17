/**
 * Live preview for `VideoShelf`: a "Continue watching" row of cards wider than its box, so it
 * scrolls sideways and snaps to each card; with script, paging buttons at its edges step a
 * screenful and disable at either end. The art is a drawn gradient per title.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { VideoCard, VideoShelf } from "@sdxc/ui/video";

/** The source the page shows, matching the markup below apart from the drawn art. */
const CODE = `<VideoShelf
	id="continue"
	title="Continue watching"
	action={<a href="/my-list">See all</a>}
	labels={{ previous: "Previous titles", next: "More titles" }}
>
	{titles.map((title) => (
		<VideoShelf.Item>
			<VideoCard
				href={title.href}
				title={title.name}
				art={<img src={title.still} alt="" />}
				meta={title.episode}
				progress={title.watched}
				progressLabel={\`\${Math.round(title.watched * 100)}% watched\`}
			/>
		</VideoShelf.Item>
	))}
</VideoShelf>`;

/** The titles on the shelf: a name, the episode the viewer is on, a share watched and a hue. */
const TITLES = [
	{ name: "Tidewater", episode: "S2:E3 · Lee Shore", watched: 0.42, hue: 220 },
	{ name: "Halcyon Station", episode: "S1:E5 · Signal", watched: 0.18, hue: 290 },
	{ name: "The Quiet Hours", episode: "1h 44m", watched: 0.71, hue: 265 },
	{ name: "Kitchen Table", episode: "S1:E4 · Housewarming", watched: 0.55, hue: 55 },
	{ name: "Moss & Stone", episode: "S1:E2 · Understorey", watched: 0.3, hue: 145 },
	{ name: "Ember Line", episode: "S1:E2 · Couchette 9", watched: 0.64, hue: 35 },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", minInlineSize: "0", "--ui-video-shelf-inset": "0px" })]}>
			<VideoShelf
				id="video-shelf-preview"
				title="Continue watching"
				action={<a href="#my-list">See all</a>}
				labels={{ previous: "Previous titles", next: "More titles" }}
			>
				{TITLES.map((title) => (
					<VideoShelf.Item>
						<VideoCard
							href={`#${title.name.toLowerCase().replaceAll(" ", "-")}`}
							title={title.name}
							art={
								<span
									mix={[
										raw({
											background: `linear-gradient(oklch(0.24 0.06 ${title.hue}), oklch(0.55 0.11 ${title.hue + 20}))`,
										}),
									]}
								/>
							}
							meta={title.episode}
							progress={title.watched}
							progressLabel={`${Math.round(title.watched * 100)}% watched`}
						/>
					</VideoShelf.Item>
				))}
			</VideoShelf>
		</div>
	),
};
