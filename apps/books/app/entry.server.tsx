import type { EntryContext, RouterContextProvider } from "react-router";

import { HTML } from "@pkg/http/content-type";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { ServerRouter } from "react-router";

import { logger } from "./middleware/logger";

export default async function handleRequest(
	request: Request,
	status: number,
	headers: Headers,
	entryContext: EntryContext,
	_routerContext: RouterContextProvider,
) {
	let log = logger().render;

	log.info("render.start");

	let stream = await renderToReadableStream(
		<ServerRouter context={entryContext} url={request.url} />,
		{
			signal: request.signal,
			onError(error) {
				log.error("render.error", {
					error: error instanceof Error ? error.message : String(error),
				});
				status = 500;
			},
		},
	);

	if (isbot(request.headers.get("user-agent"))) await stream.allReady;
	else headers.set("Transfer-Encoding", "chunked");

	headers.set("Content-Type", HTML);

	log.info("render.complete", { status });

	return new Response(stream, { status, headers });
}
