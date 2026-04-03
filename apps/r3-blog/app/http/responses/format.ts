import * as ct from "@pkg/http/content-type";
import { accepts } from "@pkg/http/negotiate";

export type ContentTypeParam = "html" | "md";

export type ResponseFormat = "html" | "md";

export function resolveResponseFormat(
	request: Request,
	contentType: ContentTypeParam | undefined,
): ResponseFormat {
	if (contentType === "md") return "md";

	let preferred = accepts(request).preferred(ct.HTML, ct.Markdown);
	if (preferred === ct.Markdown) return "md";

	return "html";
}
