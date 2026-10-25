/**
 * RFC 6570 URI Templates at all four levels: expand a template with values, parse it into
 * literal parts and expressions, and match a URI back to the variables that produced it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Scalar, VariableValue, Variables } from "./expand.js";
export type { MatchedValue } from "./match.js";
export type { Expression, Operator, TemplatePart, VariableSpec } from "./syntax.js";

export { UriTemplateError } from "./error.js";
export { expand, UriTemplate } from "./uri-template.js";
