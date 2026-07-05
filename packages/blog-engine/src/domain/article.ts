import type { PostTypeDefinition, FieldDefinition } from "./post-type";

import { ARTICLE_TYPE_NAME } from "./post-type";

/**
 * Typed metadata for the built-in `article` post type. This interface is asserted
 * against {@link ARTICLE_FIELDS} in a unit test so the two never drift.
 */
export interface ArticleMeta {
	title: string;
	excerpt?: string;
	content: string;
}

/** The seeded field definitions for the built-in article type (see migrations). */
export const ARTICLE_FIELDS: FieldDefinition[] = [
	{ key: "excerpt", label: "Excerpt", kind: "textarea", required: false },
	{ key: "content", label: "Content", kind: "markdown", required: true },
];

/**
 * The built-in article definition used when the DB row is unavailable (e.g. tests)
 * or to seed. In normal operation the definition is read from `post_types`.
 */
export const ARTICLE_DEFINITION: PostTypeDefinition = {
	id: "pt_article",
	name: ARTICLE_TYPE_NAME,
	path: "articles",
	label: "Articles",
	description: "Long-form posts.",
	fields: ARTICLE_FIELDS,
	builtin: true,
	visible: true,
};
