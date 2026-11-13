/**
 * Live demo for `mediaSync()`: the lesson player, whose chapter links and transcript lines
 * seek the video in place and carry `aria-current` on what plays.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import preview from "~/resources/components/previews/video-player";

/** What the preview registry reads: the component carrying the mixin, and its source. */
export default {
	code: `// VideoPlayer's island runs mediaSync's seeking and marks on its chapters and transcript.\n${preview.code}`,
	render: preview.render,
};
