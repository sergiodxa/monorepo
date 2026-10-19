/**
 * Everything a reader or the author can do on the blog, named once so the CMS guard, the post
 * page and the search page check the same ability. Importing the catalog does no work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { abilities, ability, context } from "@sdxc/authz";

/** What the read check knows about a post: whether its publish date has passed. */
export interface PostVisibility {
	published: boolean;
}

/**
 * The CMS and search extras are claims about the author; reading a post is checked against the
 * post, so a draft answers 403 to everyone but the author.
 */
export default abilities({
	cms: {
		open: ability({ description: "Open the CMS and write every kind of post in it" }),
	},
	posts: {
		read: ability({ context: context<{ post: PostVisibility }>("post") }),
	},
	search: {
		linkTopics: ability({ description: "Link a search to a topic from the results page" }),
	},
});
