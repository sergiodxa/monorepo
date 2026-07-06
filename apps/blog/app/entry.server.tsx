/**
 * Server-side rendering entry point for the blog app. Streams the React tree to
 * HTML with renderToReadableStream inside an i18next provider, waits for full
 * render before responding to bots (and uses chunked transfer otherwise), logs
 * render errors, and returns the streamed response with the correct status and
 * content type. This is how each SSR request is turned into an HTML response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryContext } from "react-router";

import { HTML } from "@pkg/http/content-type";
import { logger } from "@pkg/logger";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { ServerRouter } from "react-router";

import { getI18nextInstance } from "./middleware/i18next";
import { measure } from "./middleware/server-timing";

export default async function handleRequest(
	request: Request,
	status: number,
	headers: Headers,
	entryContext: EntryContext,
) {
	let userAgent = request.headers.get("user-agent");

	let stream = await renderToReadableStream(
		<I18nextProvider i18n={getI18nextInstance()}>
			<ServerRouter context={entryContext} url={request.url} />
		</I18nextProvider>,
		{
			signal: request.signal,
			onError(error) {
				logger.error("render-error", {
					error: error instanceof Error ? error.message : String(error),
				});
				status = 500;
			},
		},
	);

	if (userAgent && isbot(userAgent)) {
		await measure("entry.server#stream.allReady", () => stream.allReady);
	} else headers.set("Transfer-Encoding", "chunked");

	headers.set("Content-Type", HTML);

	return new Response(stream, { status, headers });
}
