import type { EntryContext, RouterContextProvider } from "react-router";

import { HTML } from "@pkg/http/content-type";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { ServerRouter } from "react-router";

import { i18next } from "~/middleware/i18next";
import { measure } from "~/middleware/server-timing";

export default async function handleRequest(
	request: Request,
	status: number,
	headers: Headers,
	entryContext: EntryContext,
	routerContext: RouterContextProvider,
) {
	let userAgent = request.headers.get("user-agent");

	let stream = await measure("entry.server#renderToReadableStream", () => {
		return renderToReadableStream(
			<I18nextProvider i18n={i18next(routerContext)}>
				<ServerRouter context={entryContext} url={request.url} />
			</I18nextProvider>,
			{
				signal: request.signal,
				onError(error) {
					console.error(error);
					status = 500;
				},
			},
		);
	});

	if (userAgent && isbot(userAgent)) {
		await measure("entry.server#stream.allReady", () => stream.allReady);
	} else headers.set("Transfer-Encoding", "chunked");

	headers.set("Content-Type", HTML);

	return new Response(stream, { status, headers });
}
