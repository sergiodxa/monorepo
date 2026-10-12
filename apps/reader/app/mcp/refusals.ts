/**
 * The sentences a tool answers with when a reader holds nothing under the id it was given,
 * shared by every tool that takes one, each naming the tool that would find a real id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The sentence a tool answers with when the reader follows no such feed. */
export const NO_SUCH_FEED =
	"This reader follows no feed with that id. Call list_feeds to see them.";

/** The sentence a tool answers with when the reader holds no such post. */
export const NO_SUCH_POST =
	"This reader holds no post with that id. Call read_timeline or search_timeline to find one.";
