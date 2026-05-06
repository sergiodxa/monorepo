import type { RemixNode } from "remix/ui";

import { getContext } from "remix/async-context-middleware";
import { renderToStream } from "remix/ui/server";

/**
 * Optional HTTP metadata for the rendered HTML response.
 */
export interface ViewOptions {
	status?: number;
	headers?: HeadersInit;
}

/**
 * Resolves one server-side frame by fetching its HTML from the current app.
 *
 * Relative frame URLs are resolved against the current frame URL, while nested
 * requests forward the original top-level document URL so `handle.frames.top`
 * remains stable across recursive frame rendering.
 */
async function resolveSsrFrame(
	request: Request,
	src: string,
	context?: { currentFrameSrc: string; topFrameSrc: string },
) {
	let frameUrl = new URL(src, context?.currentFrameSrc ?? request.url);

	let headers = new Headers(request.headers);
	headers.set("accept", "text/html");

	let response = await fetch(frameUrl, { headers });

	if (response.ok) return response.body ?? (await response.text());
	return "";
}

/**
 * Renders a Remix view component to HTML and returns an HTTP response.
 *
 * @template ViewModel Shape of the model passed to the view component.
 * @param ViewComponent Factory returning a component that receives the view model.
 * @param viewModel Data passed to the rendered view component.
 * @param options Optional status and headers for the response.
 * @returns HTML response containing the rendered view output.
 */
export async function view<ViewModel>(
	ViewComponent: () => (props: { model: ViewModel }) => RemixNode,
	viewModel: ViewModel,
	options?: ViewOptions,
): Promise<Response> {
	let request = getContext().request;
	let stream = renderToStream(<ViewComponent model={viewModel} />, {
		frameSrc: request.url,
		resolveFrame(src, _, context) {
			return resolveSsrFrame(request, src, context);
		},
	});
	let headers = new Headers(options?.headers);
	headers.set("content-type", "text/html; charset=utf-8");

	return new Response(stream, {
		status: options?.status ?? 200,
		headers,
	});
}
