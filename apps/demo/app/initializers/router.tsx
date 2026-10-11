/**
 * The board's fetch-router: the global middleware stack, every route mapped onto its
 * controller, and the renderer controllers reach through `ctx.render`. The worker builds it
 * per request and the router tests build the same one over their own database and captcha.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Captcha } from "@sdxc/captcha";
import type { Database as DataTable } from "remix/data-table";
import type { RouterContext } from "remix/router";

import { captcha } from "@sdxc/captcha/middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import i18n from "@sdxc/i18n/middleware";
import { log } from "@sdxc/logger/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { render, renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";

import * as board from "~/app/http/controllers/board";
import defaultHandler from "~/app/http/controllers/default-handler";
import outbox from "~/app/http/controllers/outbox";
import position from "~/app/http/controllers/position";
import database from "~/app/http/middleware/database";
import jobs from "~/app/http/middleware/jobs";
import models from "~/app/http/middleware/models";
import callerBudget from "~/app/http/middleware/rate-limit";
import { withDocumentAssets } from "~/app/http/render";
import { assets } from "~/app/initializers/assets";
import { captchaProvider } from "~/app/initializers/captcha";
import { openDatabase } from "~/app/initializers/database";
import { FALLBACK_LANGUAGE, resources, SUPPORTED_LANGUAGES } from "~/app/initializers/i18n";
import { logger } from "~/app/initializers/logger";
import mcp from "~/app/initializers/mcp";
import routes from "~/routes/web";

/** Submissions one caller may make per minute, comfortably above a person filling a form. */
const SUBMIT_LIMIT = 5;

/** Calls one agent may make to the MCP endpoint per minute. */
const MCP_LIMIT = 60;

/** The context a handler sees once the global middleware has run. */
export type AppContext = RouterContext<ReturnType<typeof application>>;

declare module "remix/router" {
	/** Types route helpers such as `createAction` with the context the global chain builds. */
	interface RouterTypes {
		context: AppContext;
	}
}

/**
 * Builds the board's HTTP router. The middleware list is written inline, so the router's type
 * carries what each link publishes and {@link AppContext} reads it from there.
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
	let router = createRouter({
		middleware: [
			asyncContext(),
			log(logger),
			getClientIP(),
			formData(),
			cop(),
			i18n({
				detection: { supportedLanguages: SUPPORTED_LANGUAGES, fallbackLanguage: FALLBACK_LANGUAGE },
				resources,
			}),
			database(openDb),
			models(),
			jobs(openDb),
			render({ assets }),
			renderWith(withDocumentAssets),
		],
		defaultHandler,
	});

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
