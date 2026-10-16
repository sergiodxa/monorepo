/**
 * What the blog's models add to the contexts that read them: the rest of the registry for a
 * model's callbacks and methods, and `ctx.models` on every request context, including ones
 * typed before the router's chain runs (route-agnostic middleware, MCP handlers).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BoundModels } from "@sdxc/data-model";

import type { BlogModels } from "~/app/models";
import type { Articles } from "~/app/models/articles";
import type { Bookmarks } from "~/app/models/bookmarks";
import type { Glossary } from "~/app/models/glossary";
import type { Likes } from "~/app/models/likes";
import type { Notes } from "~/app/models/notes";
import type { Posts } from "~/app/models/posts";
import type { Releases } from "~/app/models/releases";
import type { Tils } from "~/app/models/tils";
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
	topics: typeof Topics;
	releases: typeof Releases;
	notes: typeof Notes;
	tils: typeof Tils;
}

declare module "@sdxc/data-model" {
	interface ModelContext {
		/** Every model, bound to the same database and unit of work as the one calling. */
		models: BoundModels<BlogModelEntries>;
	}
}

declare module "remix/router" {
	interface RequestContext {
		/** The blog's models, bound to `ctx.db` by the router's global `models()` middleware. */
		models: BlogModels;
	}
}

export {};
