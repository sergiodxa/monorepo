/**
 * What the blog's model callbacks and methods read besides the database: the rest of the
 * registry, bound to the same request or job, so a model reaching another one is type-checked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BoundModels } from "@sdxc/data-model";

import type { Articles } from "~/app/models/articles";
import type { Bookmarks } from "~/app/models/bookmarks";
import type { Glossary } from "~/app/models/glossary";
import type { Likes } from "~/app/models/likes";
import type { Posts } from "~/app/models/posts";
import type { Releases } from "~/app/models/releases";
import type { Topics } from "~/app/models/topics";
import type { Tutorials } from "~/app/models/tutorials";
import type { Users } from "~/app/models/users";
import type { WebmentionDomains } from "~/app/models/webmention-domains";
import type { WebmentionSends } from "~/app/models/webmention-sends";
import type { Webmentions } from "~/app/models/webmentions";

/**
 * The registry's entries by the name each is bound under; each resolves when read, so a
 * method calling a sibling leaves the rest of the registry's type alone.
 */
interface BlogModelEntries {
	users: typeof Users;
	webmentions: typeof Webmentions;
	webmentionDomains: typeof WebmentionDomains;
	webmentionSends: typeof WebmentionSends;
	bookmarks: typeof Bookmarks;
	posts: typeof Posts;
	articles: typeof Articles;
	tutorials: typeof Tutorials;
	likes: typeof Likes;
	glossary: typeof Glossary;
	releases: typeof Releases;
	topics: typeof Topics;
}

declare module "@sdxc/data-model" {
	interface ModelContext {
		/** Every model, bound to the same database and unit of work as the one calling. */
		models: BoundModels<BlogModelEntries>;
	}
}

export {};
