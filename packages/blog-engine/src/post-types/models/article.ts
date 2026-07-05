/**
 * The built-in `article` post type: its typed metadata shape and the seeded field
 * definitions/definition constant. Used as the fallback when the DB row is
 * unavailable (e.g. tests) and asserted against the migration seed in a unit test.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { PostTypeDefinition, FieldDefinition } from "./post-type";

import { ARTICLE_TYPE_NAME } from "./post-type";

/**
 * Typed metadata for the built-in `article` post type. This is asserted against
 * {@link ARTICLE_FIELDS} in a unit test so the two never drift. Declared as a type
 * alias (not an interface) so it carries an implicit index signature and stays
 * assignable to the codec's `Partial<PostMetaValues>` input.
 */
export type ArticleMeta = {
	title: string;
	excerpt?: string;
	content: string;
};

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
