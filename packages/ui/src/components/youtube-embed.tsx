/**
 * A YouTube player sized to its container: a 16:9 `<iframe>` served from YouTube's
 * privacy-enhanced host, so a visitor receives no YouTube cookies until they press play,
 * and lazy-loaded so a video below the fold costs nothing until it scrolls into view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { block } from "@sdxc/u/layout";
import { aspect, is } from "@sdxc/u/size";

/** The host every player loads from; a page's `frame-src` has to allow it. */
const EMBED_ORIGIN = "https://www.youtube-nocookie.com";

/** Loading strategy {@link YouTubeEmbed} falls back to when `loading` is omitted. */
const DEFAULT_LOADING: YouTubeEmbed.Props["loading"] = "lazy";

/** The player features YouTube asks an embedding page to delegate. */
const ALLOWED_FEATURES =
	"accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

/**
 * Prop types for {@link YouTubeEmbed}.
 */
export namespace YouTubeEmbed {
	/**
	 * Props accepted by {@link YouTubeEmbed}.
	 */
	export interface Props extends Omit<
		TagProps<"iframe">,
		"src" | "title" | "allow" | "referrerpolicy" | "referrerPolicy"
	> {
		/** The eleven-character id from the video's `watch?v=` or `youtu.be/` URL. */
		videoId: string;
		/** Seconds into the video the player starts at; zero or less starts at the beginning. */
		start?: number;
		/** The frame's accessible name, announced before a reader enters the player. */
		title: string;
	}
}

/**
 * Renders the player filling its container's inline axis at 16:9. The frame always sends
 * the embedding page's origin as referrer, without which YouTube refuses to play.
 *
 * @param handle Runtime handle carrying the host `<iframe>`'s props.
 * @returns The render function producing the player's markup.
 * @example <YouTubeEmbed videoId="dQw4w9WgXcQ" title={t("video.title")} />
 * @example <YouTubeEmbed videoId="dQw4w9WgXcQ" start={90} title={t("video.title")} />
 */
export function YouTubeEmbed(handle: Handle<YouTubeEmbed.Props>) {
	return () => {
		let { videoId, start, title, loading, mix, ...rest } = handle.props;
		let src = new URL(`/embed/${encodeURIComponent(videoId)}`, EMBED_ORIGIN);
		if (start !== undefined && start >= 1) src.searchParams.set("start", String(Math.floor(start)));

		return (
			<iframe
				{...rest}
				data-slot="youtube-embed"
				src={src.href}
				title={title}
				loading={loading ?? DEFAULT_LOADING}
				referrerpolicy="strict-origin-when-cross-origin"
				allow={ALLOWED_FEATURES}
				allowFullScreen
				mix={[block(), is("full"), aspect("video"), border("none"), rounded("lg"), mix]}
			/>
		);
	};
}
