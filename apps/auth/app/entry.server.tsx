/**
 * Server rendering entry point for the auth app. Streams the React tree to an
 * HTML response with the i18next provider, waiting for full render for bots and
 * using chunked transfer otherwise, and downgrades the status to 500 on render
 * errors. This is how server-side responses are produced for each request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryContext } from "react-router";

import { HTML } from "@pkg/http/content-type";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { ServerRouter } from "react-router";

import { getI18nextInstance } from "~/middleware/i18next";

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
			onError(_error) {
				status = 500;
			},
		},
	);

	if (userAgent && isbot(userAgent)) await stream.allReady;
	else headers.set("Transfer-Encoding", "chunked");

	headers.set("Content-Type", HTML);

	return new Response(stream, { status, headers });
}
