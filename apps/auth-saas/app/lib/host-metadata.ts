/**
 * Defines and validates the custom-metadata shape attached to Cloudflare for SaaS
 * hostnames, which maps an incoming hostname to its owning tenant and region. Shared
 * by the hostname service (writer) and the worker entry (reader) as the single source
 * of truth for `request.cf.hostMetadata`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

/**
 * Single source of truth for the metadata shape `HostnameService.createHostname`
 * writes and the worker entry reads from `request.cf.hostMetadata`. Keys stay
 * snake_case to round-trip through the Cloudflare API verbatim.
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
