/**
 * Normalizes CMS topic form submissions. The model canonicalizes the query and refuses what
 * a topic cannot hold, so this schema only shapes the fields a form sends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, object, string } from "remix/data-schema";

/**
 * A blank slug is derived from the title, and a kind's topic sends neither slug nor query,
 * since its form shows both read-only; every field defaults to empty for the model to judge.
 */
export const TopicSchema = object({
	title: defaulted(string(), ""),
	slug: defaulted(string(), ""),
	query: defaulted(string(), ""),
	description: defaulted(string(), ""),
});

/** The CMS's new-topic form's query string: the search "Save as topic" prefills. */
export const NewTopicQuerySchema = object({
	q: defaulted(string(), ""),
});
