/**
 * Build OpenAPI 3.1 documents from typed operations: routes from a route map with their
 * schemas, problems and security, assembled into a document, and read or written as
 * JSON or YAML. Security schemes, the serving handler and test helpers are subpaths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { DocumentBuilder, DocumentOptions } from "./document.js";
export type { Operation, OperationSpec, PathParams, ResponseSpec } from "./operation.js";
export type { StringifyOptions } from "./serialize.js";
export type { OpenAPI } from "./types.js";

export { createDocument, JSON_SCHEMA_DIALECT, OPENAPI_VERSION } from "./document.js";
export {
	OpenAPIBuildError,
	OpenAPIParseError,
	OpenAPIStringifyError,
	OperationInputError,
} from "./errors.js";
export { defineOperation } from "./operation.js";
export { MEDIA_TYPE_JSON, MEDIA_TYPE_YAML, parse, stringify } from "./serialize.js";
