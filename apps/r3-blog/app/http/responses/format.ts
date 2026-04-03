import * as ct from "@pkg/http/content-type";
import { accepts } from "@pkg/http/negotiate";

/**
 * Route-level content type hints supported by the blog responses.
 */
export type ContentTypeParam = "html" | "md";

/**
 * Response body formats this module can resolve.
 */
export type ResponseFormat = "html" | "md";

/**
 * Chooses the response format from an explicit route hint or request negotiation.
 * Returns Markdown only when the route asks for it or when Markdown is preferred.
 *
 * @param request Incoming request used for Accept header negotiation.
 * @param contentType Optional route hint for a specific format.
 * @returns The format to render for the response body.
 */
export function resolveResponseFormat(
	request: Request,
	contentType: ContentTypeParam | undefined,
): ResponseFormat {
	if (contentType === "md") return "md";

	let preferred = accepts(request).preferred(ct.HTML, ct.Markdown);
	if (preferred === ct.Markdown) return "md";

	return "html";
}
