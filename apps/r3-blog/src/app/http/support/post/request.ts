import * as ct from "@pkg/http/content-type";
import { accepts } from "@pkg/http/negotiate";

export type PostType = "articles" | "tutorials";
export type ContentTypeParam = "html" | "md";
export type ResponseFormat = "html" | "md";

export interface ValidPostRequestParams {
	postType: PostType;
	postSlug: string;
	contentType: ContentTypeParam | undefined;
}

export type ValidatePostRequestParamsResult =
	| { kind: "valid"; params: ValidPostRequestParams }
	| { kind: "invalid-route" }
	| { kind: "unsupported-content-type"; contentType: string }
	| { kind: "unsupported-post-type" };

const SUPPORTED_POST_TYPES = new Set<string>(["articles", "tutorials"]);
const SUPPORTED_CONTENT_TYPES = new Set<string>(["html", "md"]);

export function validatePostRequestParams(params: {
	postType: string | undefined;
	postSlug: string | undefined;
	ext: string | undefined;
}): ValidatePostRequestParamsResult {
	let postType = params.postType;
	let postSlug = params.postSlug;
	let contentType = params.ext;

	if (!postType || !postSlug) return { kind: "invalid-route" };
	if (contentType && !SUPPORTED_CONTENT_TYPES.has(contentType)) {
		return { kind: "unsupported-content-type", contentType };
	}
	if (!SUPPORTED_POST_TYPES.has(postType)) return { kind: "unsupported-post-type" };

	return {
		kind: "valid",
		params: {
			postType: postType as PostType,
			postSlug,
			contentType: contentType as ContentTypeParam | undefined,
		},
	};
}

export function resolveResponseFormat(
	request: Request,
	contentType: ContentTypeParam | undefined,
): ResponseFormat {
	if (contentType === "md") return "md";

	let preferred = accepts(request).preferred(ct.HTML, ct.Markdown);
	if (preferred === ct.Markdown) return "md";

	return "html";
}
