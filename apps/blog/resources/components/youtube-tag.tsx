/**
 * The component `toRemix` draws a walked `youtube` tag with, so a YouTube URL pasted on a
 * line of its own in a post plays in place. The blog's pages are English, so it names the
 * player in English.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { YouTubeEmbed } from "@sdxc/ui";

/**
 * Takes the walked tag's attributes as props: `id` and `start` (in seconds) as the embeds
 * plugin read them out of the pasted `url`.
 *
 * @example toRemix(document, { components: { youtube: YouTubeTag } })
 */
export function YouTubeTag(
	handle: Handle<{ id: string; start?: number; url: string; children: RemixNode }>,
) {
	return () => (
		<YouTubeEmbed
			videoId={handle.props.id}
			start={handle.props.start}
			title="YouTube video player"
		/>
	);
}
