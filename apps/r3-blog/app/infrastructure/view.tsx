import type { RemixNode } from "remix/component";

import { html } from "@pkg/http/response";
import { renderToString } from "remix/component/server";

export interface ViewOptions {
	status?: number;
	headers?: HeadersInit;
}

export async function view<ViewModel>(
	ViewComponent: () => (props: { model: ViewModel }) => RemixNode,
	viewModel: ViewModel,
	options?: ViewOptions,
): Promise<Response> {
	let body = await renderToString(<ViewComponent model={viewModel} />);
	return html(body, { status: options?.status ?? 200, headers: options?.headers });
}
