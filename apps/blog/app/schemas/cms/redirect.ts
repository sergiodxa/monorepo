/**
 * Data-schema for validating CMS redirect form submissions. `RedirectSchema`
 * requires from and to paths and constrains the status code to the supported
 * redirect codes (301/302/307/308), defaulting to 302. Exists to validate
 * redirect input before it is persisted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, enum_, object, string } from "remix/data-schema";

/**
 * Validates redirect form payloads and constrains status codes to supported redirects.
 */
export const RedirectSchema = object({
	from: string(),
	to: string(),
	status: defaulted(enum_(["301", "302", "307", "308"]), "302"),
});
