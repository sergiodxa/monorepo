/**
 * Everything a reader's plan or an operational switch decides they may do, named once so
 * the reader's own object, the pages it answers and the agent surface check the same
 * ability. Importing it costs nothing, so a page can read the claims an object returned.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { abilities, ability } from "@sdxc/authz";

/**
 * Every ability is a claim: each one is about the reader as a whole, so a check passes no
 * record and a page receives one boolean per ability.
 */
export default abilities({
	posts: {
		keep: ability({ description: "Keep a post on the saved shelf" }),
	},
	tags: {
		label: ability({ description: "Make, rename and apply labels on kept posts" }),
	},
	rules: {
		write: ability({ description: "Write and rewrite filter rules" }),
		apply: ability({ description: "Act on the posts a previewed candidate matched" }),
	},
	articles: {
		extract: ability({ description: "Fetch the full article behind a post" }),
	},
	digests: {
		email: ability({ description: "Receive notifications by email" }),
	},
	agent: {
		connect: ability({ description: "Mint agent tokens and answer an agent at all" }),
		write: ability({ description: "Answer an agent's writing tools" }),
	},
});
