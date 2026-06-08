import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import NotFoundViewModel from "~/app/http/view-models/not-found";
import { Counter } from "~/resources/components/timer";
import DocumentLayout from "~/resources/layouts/document";
import NotFoundView from "~/resources/views/not-found";

interface RenderContext {
	render: Renderer<RemixNode>;
}

/** Renders the fallback 404 document for unmatched routes. */
export default function defaultHandler(ctx: RenderContext) {
	let props = NotFoundViewModel.default({ title: "Page Not Found" });
	let renderDocument = DocumentLayout();

	return ctx.render(
		renderDocument({
			title: props.title,
			children: [<NotFoundView {...props} />, <Counter />],
		}),
		{ status: 404 },
	);
}
