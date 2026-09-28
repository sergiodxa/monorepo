/**
 * Application bootstrap that assembles the board's fetch-router. It registers the global
 * middleware stack, maps the three routes onto their controllers, and wires the
 * request-scoped renderer. It is the composition root the worker and the tests share.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Captcha } from "@sdxc/captcha";
import type { Database as DataTable } from "remix/data-table";
import type { Middleware, RequestContext } from "remix/router";
import type { RemixNode } from "remix/ui";

import { captcha } from "@sdxc/captcha/middleware";
import i18n from "@sdxc/i18n/middleware";
import { log } from "@sdxc/logger/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";

import * as board from "~/app/http/controllers/board";
import defaultHandler from "~/app/http/controllers/default-handler";
import outbox from "~/app/http/controllers/outbox";
import database from "~/app/http/middleware/database";
import jobs from "~/app/http/middleware/jobs";
import callerBudget from "~/app/http/middleware/rate-limit";
import { captchaProvider } from "~/app/lib/captcha";
import { openDatabase } from "~/app/lib/database";
import { FALLBACK_LANGUAGE, resources, SUPPORTED_LANGUAGES } from "~/app/lib/i18n";
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
		formData() as Middleware,
		cop(),
		i18n({
			detection: { supportedLanguages: SUPPORTED_LANGUAGES, fallbackLanguage: FALLBACK_LANGUAGE },
			resources,
		}) as Middleware,
		database(openDb),
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
 */
function createHtmlRenderer(_ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return createHtmlResponse(renderToStream(node), { ...init, headers });
	};
}
