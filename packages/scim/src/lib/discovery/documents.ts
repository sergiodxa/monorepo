/**
 * The three RFC 7644 §4 discovery documents a client reads before provisioning:
 * `ServiceProviderConfig`, `ResourceTypes` and `Schemas`, built as plain objects so the app
 * chooses its own response and caching.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Discovery } from "../../discovery.js";

import {
	RESOURCE_TYPE_SCHEMA,
	SCHEMA_SCHEMA,
	SERVICE_PROVIDER_CONFIG_SCHEMA,
} from "../constants.js";
import { listEnvelope } from "../envelope.js";

/**
 * The same definition narrowed to the named attributes, in the definition's own order. A
 * name may be `attribute.subAttribute` to narrow a complex attribute's sub-attributes too;
 * names match case-insensitively, and a name the definition lacks is skipped.
 *
 * @param definition - The full definition, such as `USER_DEFINITION`
 * @param names - The attributes the app maps
 * @returns The narrowed definition
 */
export function pickAttributes(
	definition: Discovery.SchemaDefinition,
	names: string[],
): Discovery.SchemaDefinition {
	let wanted = new Map<string, Set<string> | null>();
	for (let name of names) {
		let [attribute = "", sub] = name.toLowerCase().split(".");
		let current = wanted.get(attribute);
		if (sub === undefined) wanted.set(attribute, null);
		else if (current !== null) wanted.set(attribute, (current ?? new Set()).add(sub));
	}

	let attributes: Discovery.Attribute[] = [];
	for (let attribute of definition.attributes) {
		let subs = wanted.get(attribute.name.toLowerCase());
		if (subs === undefined) continue;
		if (subs === null || !attribute.subAttributes) {
			attributes.push(attribute);
			continue;
		}
		attributes.push({
			...attribute,
			subAttributes: attribute.subAttributes.filter((sub) => subs.has(sub.name.toLowerCase())),
		});
	}

	return { ...definition, attributes };
}

/**
 * The `/ServiceProviderConfig` document (RFC 7643 §5). Bulk is advertised as supported only
 * when its limits are given, and `changePassword` only when enabled, so the document
 * advertises exactly the features the app opted into.
 *
 * @param options - What the service provider supports
 * @returns The document
 */
export function serviceProviderConfig(
	options: Discovery.ServiceProviderConfigOptions,
): Record<string, unknown> {
	return {
		schemas: [SERVICE_PROVIDER_CONFIG_SCHEMA],
		...(options.documentationUri ? { documentationUri: options.documentationUri } : {}),
		patch: { supported: options.patch },
		bulk: {
			supported: options.bulk !== undefined,
			maxOperations: options.bulk?.maxOperations ?? 0,
			maxPayloadSize: options.bulk?.maxPayloadSize ?? 0,
		},
		filter: { supported: options.filter.supported, maxResults: options.filter.maxResults },
		changePassword: { supported: options.changePassword ?? false },
		sort: { supported: options.sort },
		etag: { supported: options.etag },
		authenticationSchemes: options.authenticationSchemes.map((scheme) => ({ ...scheme })),
	};
}

/**
 * The `/ResourceTypes` list (RFC 7643 §6), one entry per endpoint, named after its id.
 *
 * @param types - The resource types the service provider serves
 * @returns The `ListResponse` of `ResourceType` documents
 */
export function resourceTypes(types: Discovery.ResourceType[]): Record<string, unknown> {
	let resources = types.map((type) => ({
		schemas: [RESOURCE_TYPE_SCHEMA],
		id: type.id,
		name: type.id,
		endpoint: type.endpoint,
		schema: type.schema,
		...(type.extensions?.length
			? {
					schemaExtensions: type.extensions.map((extension) => ({
						schema: extension.schema,
						required: extension.required,
					})),
				}
			: {}),
	}));
	return listEnvelope(resources, resources.length, 1);
}

/**
 * The `/Schemas` list (RFC 7643 §7). Pass the same definitions filters, PATCH and projection
 * evaluate against, so the advertised surface is the evaluated one.
 *
 * @param definitions - The schema definitions served
 * @returns The `ListResponse` of `Schema` documents
 */
export function schemas(definitions: Discovery.SchemaDefinition[]): Record<string, unknown> {
	let resources = definitions.map((definition) => ({ schemas: [SCHEMA_SCHEMA], ...definition }));
	return listEnvelope(resources, resources.length, 1);
}
