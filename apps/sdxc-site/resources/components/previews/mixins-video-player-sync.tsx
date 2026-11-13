/**
 * Live demo for `videoPlayerSync()`: the lesson player, whose island carries the mixin that
 * swaps the native controls for the bar, seeks from every time link and marks what plays.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import preview from "~/resources/components/previews/video-player";

/** What the preview registry reads: the component carrying the mixin, and its source. */
export default {
	code: `// VideoPlayer's island carries videoPlayerSync(), which runs the bar, the menu and the time links.\n${preview.code}`,
	render: preview.render,
};
