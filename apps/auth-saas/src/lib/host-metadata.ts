import * as s from "remix/data-schema";

/**
 * Custom hostname metadata attached to Cloudflare for SaaS hostnames.
 *
 * Single source of truth for the shape written by `HostnameService.createHostname`
 * (as `custom_metadata`) and read back by the worker entry from
 * `request.cf.hostMetadata`. Keys are snake_case because they round-trip through
 * the Cloudflare API verbatim.
 */
export const HostMetadataSchema = s.object({
	tenant_id: s.union([s.literal("platform"), s.string()]),
	region: s.defaulted(
		s.enum_(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"]),
		"wnam",
	),
});

/** Validated metadata identifying which tenant a custom hostname belongs to. */
export type HostMetadata = s.InferOutput<typeof HostMetadataSchema>;
