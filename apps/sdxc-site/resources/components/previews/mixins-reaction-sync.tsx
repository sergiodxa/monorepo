/**
 * Live demo for `reactionSync()`: a row of reaction chips that flip and count the moment they
 * are pressed, while each chip's form posts in the background.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import preview from "~/resources/components/previews/reaction-bar";

/** What the preview registry reads: the component carrying the mixin, and its source. */
export default {
	code: `// One host anywhere on the page carries reactionSync(); every ReactionBar then answers at once.\n${preview.code}`,
	render: preview.render,
};
