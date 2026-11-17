/**
 * Live preview for `EpisodeList`: three episodes of a season, the first watched, the second
 * part way and marked as the one the viewer is up to, each a link with its still, running time
 * and synopsis. Narrow, the synopsis wraps under the still; the stills are drawn gradients.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { EpisodeList } from "@sdxc/ui/video";

/** The source the page shows, matching the markup below apart from the drawn stills. */
const CODE = `<EpisodeList aria-label="Tidewater, season 1">
	<EpisodeList.Item
		href="/watch/tidewater/1-1"
		number={1}
		title="Last Ferry"
		still={<img src="/stills/tidewater-101.jpg" alt="" />}
		duration="52m"
		synopsis="The year's final crossing docks one passenger short."
		progress={1}
		progressLabel="Watched"
	/>
	<EpisodeList.Item
		href="/watch/tidewater/1-2"
		number={2}
		title="Slack Water"
		still={<img src="/stills/tidewater-102.jpg" alt="" />}
		duration="47m"
		synopsis="A diver finds a car where the old pier used to stand."
		progress={0.35}
		progressLabel="35% watched"
		current
	/>
</EpisodeList>`;

/** The season's episodes. */
const EPISODES = [
	{
		title: "Last Ferry",
		minutes: 52,
		synopsis:
			"The year's final crossing docks one passenger short, and Wren signs the manifest anyway.",
		progress: 1,
		hue: 215,
	},
	{
		title: "Slack Water",
		minutes: 47,
		synopsis: "A diver finds a car where the old pier used to stand.",
		progress: 0.35,
		hue: 200,
	},
	{
		title: "The Breakwater",
		minutes: 49,
		synopsis: "Wren's brother returns for the winter with a story that doesn't hold.",
		progress: undefined,
		hue: 230,
	},
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<EpisodeList aria-label="Tidewater, season 1" mix={[raw({ inlineSize: "100%" })]}>
			{EPISODES.map((episode, index) => (
				<EpisodeList.Item
					href={`#episode-${index + 1}`}
					number={index + 1}
					title={episode.title}
					still={
						<span
							mix={[
								raw({
									background: `radial-gradient(circle at 68% 60%, oklch(0.9 0.08 85) 0 8%, transparent 9%), linear-gradient(oklch(0.26 0.06 ${episode.hue}), oklch(0.5 0.09 ${episode.hue - 15}))`,
								}),
							]}
						/>
					}
					duration={`${episode.minutes}m`}
					synopsis={episode.synopsis}
					progress={episode.progress}
					progressLabel={episode.progress === 1 ? "Watched" : "35% watched"}
					current={index === 1}
				/>
			))}
		</EpisodeList>
	),
};
