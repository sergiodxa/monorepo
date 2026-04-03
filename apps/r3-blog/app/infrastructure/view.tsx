import type { RemixNode } from "remix/component";

import { html } from "@pkg/http/response";
import { renderToString } from "remix/component/server";

/**
 * Optional HTTP metadata for the rendered HTML response.
 */
export interface ViewOptions {
	status?: number;
	headers?: HeadersInit;
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
	let body = await renderToString(<ViewComponent model={viewModel} />);
	return html(body, { status: options?.status ?? 200, headers: options?.headers });
}
