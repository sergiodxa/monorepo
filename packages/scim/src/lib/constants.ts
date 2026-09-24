/**
 * The media type and schema URNs RFC 7643 and RFC 7644 assign, kept in one module so the
 * resource, filter, PATCH and discovery subpaths all name a document by the same string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The content type of every SCIM request and response body (RFC 7644 §8.1). */
export const MEDIA_TYPE = "application/scim+json";

/** The core User resource schema (RFC 7643 §4.1). */
export const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";

/** The core Group resource schema (RFC 7643 §4.2). */
export const GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";

/** The Enterprise User extension (RFC 7643 §4.3), written as a URN-keyed member of a User. */
export const ENTERPRISE_USER_SCHEMA = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";

/** The envelope around a page of resources (RFC 7644 §3.4.2). */
export const LIST_RESPONSE_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";

/** The PATCH request body (RFC 7644 §3.5.2). */
export const PATCH_OP_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:PatchOp";

/** The `POST /.search` request body (RFC 7644 §3.4.3). */
export const SEARCH_REQUEST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:SearchRequest";

/** The error document (RFC 7644 §3.12). */
export const ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";

/** The `/ServiceProviderConfig` document (RFC 7643 §5). */
export const SERVICE_PROVIDER_CONFIG_SCHEMA =
	"urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig";

/** Each entry of the `/ResourceTypes` document (RFC 7643 §6). */
export const RESOURCE_TYPE_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:ResourceType";

/** Each entry of the `/Schemas` document (RFC 7643 §7). */
export const SCHEMA_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Schema";
