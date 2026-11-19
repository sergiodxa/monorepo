/**
 * Live preview for `TrackList`: a playlist's first tracks with their album and date added,
 * the second row playing under its equalizer, an explicit track, and a heart at each row's
 * end. Hover a row for its play button; the table drops columns as its box narrows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HeartIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { TrackList } from "@sdxc/ui/audio";

/** The source the page shows. */
const CODE = `<TrackList labels={labels} columns={{ album: true, added: true }}>
	<TrackList.Row
		index={1}
		title="Last Train Bloom"
		artists={<a href="/artist/neon-orchard">Neon Orchard</a>}
		album={<a href="/album/midnight-citrus">Midnight Citrus</a>}
		added="Yesterday"
		duration={242}
		play={<TrackList.PlayButton aria-label="Play Last Train Bloom" />}
	/>
</TrackList>`;

/** The table's strings. */
const LABELS: TrackList.Labels = {
	index: "#",
	title: "Title",
	album: "Album",
	added: "Date added",
	duration: "Duration",
	playing: "Now playing",
};

/** The tracks the preview lists. */
const TRACKS = [
	{
		title: "Last Train Bloom",
		artist: "Neon Orchard",
		album: "Midnight Citrus",
		added: "Yesterday",
		duration: 242,
	},
	{
		title: "Contour Lines",
		artist: "Velvet Cartography",
		album: "Maps in the Dark",
		added: "Yesterday",
		duration: 227,
		current: true,
	},
	{
		title: "Last Crossing",
		artist: "Night Ferry",
		album: "Harbor Lights",
		added: "3 days ago",
		duration: 271,
	},
	{
		title: "Orange Streetlights",
		artist: "Neon Orchard",
		album: "Midnight Citrus",
		added: "6 days ago",
		duration: 194,
		explicit: true,
	},
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%" })]}>
			<TrackList labels={LABELS} columns={{ album: true, added: true }}>
				{TRACKS.map((track, index) => (
					<TrackList.Row
						index={index + 1}
						title={track.title}
						artists={<a href="#artist">{track.artist}</a>}
						album={<a href="#album">{track.album}</a>}
						added={track.added}
						duration={track.duration}
						explicit={track.explicit}
						current={track.current}
						play={<TrackList.PlayButton type="button" aria-label={`Play ${track.title}`} />}
						trailing={
							<HeartIcon
								size={16}
								aria-hidden="true"
								mix={[
									raw({ color: "var(--ui-brand-fg)", fill: index < 2 ? "currentColor" : "none" }),
								]}
							/>
						}
					/>
				))}
			</TrackList>
		</div>
	),
};
