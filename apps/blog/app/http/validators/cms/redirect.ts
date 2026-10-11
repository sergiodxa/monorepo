/**
 * Validates CMS redirect form submissions so every persisted redirect resolves
 * to a usable HTTP redirect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, enum_, object, string } from "remix/data-schema";

/**
 * Both paths are required and the status is restricted to 301, 302, 307, and
 * 308, defaulting to a temporary 302.
 */
export const RedirectSchema = object({
	from: string(),
	to: string(),
	status: defaulted(enum_(["301", "302", "307", "308"]), "302"),
});
