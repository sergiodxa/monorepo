/**
 * The playable café from the "Make your first novel" guide, framed at the top of the guide so a
 * reader plays the story before building it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CafeNovel } from "~/resources/components/cafe-novel";

/** What the guide demo registry reads: the player, meeting its frame's edges. */
export default {
	flush: true,
	render: () => <CafeNovel />,
};
