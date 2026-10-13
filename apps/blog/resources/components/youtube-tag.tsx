/**
 * The player `toRemix` draws a walked `youtube` tag with: a YouTube URL pasted on a line
 * of its own in a post becomes a 16:9 player instead of a bare link, served from the
 * privacy-enhanced host so a visitor gets no YouTube cookies until they press play.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { block } from "@sdxc/u/layout";
import { aspect, is } from "@sdxc/u/size";

/**
 * Takes the walked tag's attributes as props: `id` and `start` (in seconds) as the embeds
 * plugin read them out of the pasted `url`. Lazy-loads the player so a video below the fold
 * costs nothing until it scrolls into view.
 *
 * @example toRemix(document, { components: { youtube: YouTubeEmbed } })
 */
export function YouTubeEmbed(
	handle: Handle<{ id: string; start?: number; url: string; children: RemixNode }>,
) {
	return () => {
		let { id, start } = handle.props;
		let src = new URL(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`);
		if (start) src.searchParams.set("start", String(start));

		return (
			<iframe
				src={src.href}
				title="YouTube video player"
				loading="lazy"
				referrerpolicy="strict-origin-when-cross-origin"
				allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
				allowFullScreen
				mix={[block(), is("full"), aspect("video"), border("none"), rounded("lg")]}
			/>
		);
	};
}
