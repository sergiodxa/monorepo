/**
 * The health report schema as a standalone JSON Schema document under its public `$id`, the
 * content of the package's `schema.json`. One builder serves the generator that writes the
 * file and the test that fails when the file and the validator disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONSchema } from "@sdxc/json-schema";
import type { Result } from "@sdxc/result";

import { toJSONSchema } from "@sdxc/json-schema";
import { isFailure, success } from "@sdxc/result";

import HEALTH_REPORT from "./schema.js";

/** The URL the document is published at, so a tool outside JavaScript can reference it. */
export const SCHEMA_ID = "https://sdxc.dev/schemas/health.json";

/**
 * The document describing what a report may contain as sent, before statuses are normalized.
 * `$id` follows `$schema`, so the file reads as the dialect, then the identity.
 */
export function schemaDocument(): Result<JSONSchema, Error> {
	let converted = toJSONSchema(HEALTH_REPORT);
	if (isFailure(converted)) return converted;
	let { $schema, ...rest } = converted.data;
	return success({ $schema, $id: SCHEMA_ID, ...rest });
}
