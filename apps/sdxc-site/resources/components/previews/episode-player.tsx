/**
 * Live preview for `EpisodePlayer`: one episode of a read-aloud letter with the browser's
 * own controls, four chapters and a short transcript. The audio is a placeholder that
 * chimes at each chapter, so pressing a chapter is audible.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { EpisodePlayer } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<EpisodePlayer
	src="/demos/newsletter/episode-63.mp3"
	type="audio/mpeg"
	captions={{ src: "/demos/newsletter/episode-63.vtt", srclang: "en", label: "English" }}
	title="The pressure at the top of the hill"
	meta="Episode 63 · 14:20"
	chapters={[
		{ start: 0, title: "The shower on the ninth floor" },
		{ start: 112, title: "What pressure means at a tap" },
		{ start: 270, title: "The tower on Linden Hill" },
		{ start: 785, title: "Credits" },
	]}
	transcript={[
		{ start: 0, speaker: "Tove", text: "This is Undercurrent. I'm Tove Adler." },
		{ start: 112, speaker: "Rafi", text: "Pressure is height you borrow from a tank." },
	]}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("36rem")]}>
			<EpisodePlayer
				src="/demos/newsletter/episode-63.mp3"
				type="audio/mpeg"
				captions={{ src: "/demos/newsletter/episode-63.vtt", srclang: "en", label: "English" }}
				title="The pressure at the top of the hill"
				meta="Episode 63 · 14:20"
				chapters={[
					{ start: 0, title: "The shower on the ninth floor" },
					{ start: 112, title: "What pressure means at a tap" },
					{ start: 270, title: "The tower on Linden Hill" },
					{ start: 785, title: "Credits" },
				]}
				transcript={[
					{ start: 0, speaker: "Tove", text: "This is Undercurrent. I'm Tove Adler." },
					{ start: 112, speaker: "Rafi", text: "Pressure is height you borrow from a tank." },
				]}
			/>
		</div>
	),
};
