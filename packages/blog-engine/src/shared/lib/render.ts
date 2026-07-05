import type { RemixNode } from "remix/ui";

import { renderToString } from "remix/ui/server";

/**
 * Renders a full-document `remix/ui` node to an HTML string with a leading
 * `<!doctype html>` (which `renderToString` does not emit), keeping pages in
 * standards mode.
 * @param node - The root `<html>` node to render.
 * @returns The serialized HTML document.
 */
export async function renderDocument(node: RemixNode): Promise<string> {
	return `<!doctype html>${await renderToString(node)}`;
}
