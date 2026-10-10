/**
 * Application bootstrap that assembles the board's fetch-router. It registers the global
 * middleware stack, maps the routes onto their controllers, and wires the
 * request-scoped renderer. It is the composition root the worker and the tests share.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Captcha } from "@sdxc/captcha";
import type { RemixNode } from "remix/component";
import type { Database as DataTable } from "remix/data-table";
import type { Middleware, RequestContext } from "remix/router";

import { captcha } from "@sdxc/captcha/middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import i18n from "@sdxc/i18n/middleware";
import { log } from "@sdxc/logger/middleware";
import { renderToStream } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import { createRouter } from "remix/router";

import * as board from "~/app/http/controllers/board";
import defaultHandler from "~/app/http/controllers/default-handler";
import outbox from "~/app/http/controllers/outbox";
import position from "~/app/http/controllers/position";
import database from "~/app/http/middleware/database";
import jobs from "~/app/http/middleware/jobs";
import models from "~/app/http/middleware/models";
import callerBudget from "~/app/http/middleware/rate-limit";
import { documentAssets } from "~/app/lib/assets";
import { captchaProvider } from "~/app/lib/captcha";
import { openDatabase } from "~/app/lib/database";
import { FALLBACK_LANGUAGE, resources, SUPPORTED_LANGUAGES } from "~/app/lib/i18n";
import { DocumentAssets } from "~/resources/layouts/document";
import { isFrameRequest } from "~/routes/frames";
import routes from "~/routes/web";

import { logger } from "./logger";
import mcp from "./mcp";

/** Submissions one caller may make per minute, comfortably above a person filling a form. */
const SUBMIT_LIMIT = 5;

/** Calls one agent may make to the MCP endpoint per minute. */
const MCP_LIMIT = 60;

/**
 * Builds the board's HTTP router.
 *
 * @param openDb Opens the database every request and job reads through; a test hands in its
 * own, so what it drives is the router the worker builds.
 * @param guard The provider the submit form is verified against.
 * @returns The configured router the worker forwards requests to.
 */
export default function application(
	openDb: () => DataTable = openDatabase,
	guard: Captcha = captchaProvider(),
) {
	let globalMiddleware: Middleware[] = [
		asyncContext(),
		log(logger) as Middleware,
		getClientIP(),
		formData() as Middleware,
		cop(),
		i18n({
			detection: { supportedLanguages: SUPPORTED_LANGUAGES, fallbackLanguage: FALLBACK_LANGUAGE },
			resources,
		}) as Middleware,
		database(openDb),
		models(),
		jobs(openDb),
		renderWith(createHtmlRenderer) as Middleware,
	];

	let router = createRouter({ middleware: globalMiddleware, defaultHandler });

	router.map(routes.board, {
		actions: {
			index: board.index,
			action: {
				middleware: [callerBudget("submit", SUBMIT_LIMIT), captcha(guard)],
				handler: board.action,
			},
		},
	});

	router.map(routes.position, position);

	router.map(routes.outbox, outbox);

	router.map(routes.mcp, {
		middleware: [callerBudget("mcp", MCP_LIMIT)],
		handler: (ctx) => mcp.fetch(ctx),
	});

	return router;
}

/**
 * Creates the request-scoped renderer reached through `ctx.render`. `createHtmlResponse`
 * prepends `<!DOCTYPE html>` to the stream's first chunk, the only point JSX rendering
 * leaves to add it, without which every page parses in quirks mode.
 *
 * A frame's answer is written into a document that already declared one, so it is sent as
 * the markup it is and the doctype belongs to whichever response opened the document.
 */
function createHtmlRenderer(ctx: RequestContext) {
	return async function render(node: RemixNode, init?: ResponseInit) {
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		let assets = await documentAssets();
		let stream = renderToStream(<DocumentAssets value={assets}>{node}</DocumentAssets>);

		if (isFrameRequest(ctx.request)) return new Response(stream, { ...init, headers });

		return createHtmlResponse(stream, { ...init, headers });
	};
}
