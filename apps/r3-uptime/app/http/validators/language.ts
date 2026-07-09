/**
 * Form validation schema for the `update-language` action. `"auto"` clears the
 * stored preference so the middleware falls back to the `Accept-Language` header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import { supportedLanguages } from "~/database/schema";

const LANGUAGE_OR_AUTO = [...supportedLanguages, "auto"] as const;

/** Validates the `update-language` action form body. */
export const UpdateLanguageSchema = f.object({
	language: f.field(
		s.enum_(LANGUAGE_OR_AUTO).transform((value) => (value === "auto" ? null : value)),
	),
});
