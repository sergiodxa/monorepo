import { belongsTo, hasMany } from "remix/data-table";

import { postMeta } from "./post-meta";
import { posts } from "./posts";
import { users } from "./users";

export const userRelations = {
	posts: hasMany(users, posts, {
		foreignKey: "author_id",
		targetKey: "id",
	}),
};

export const postRelations = {
	author: belongsTo(posts, users, {
		foreignKey: "author_id",
		targetKey: "id",
	}),
	meta: hasMany(posts, postMeta, {
		foreignKey: "post_id",
		targetKey: "id",
	}),
};

export const postMetaRelations = {
	post: belongsTo(postMeta, posts, {
		foreignKey: "post_id",
		targetKey: "id",
	}),
};
