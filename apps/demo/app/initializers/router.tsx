/**
 * The board's fetch-router: the global middleware stack, every route mapped onto its
 * controller, and the document assets and renderer controllers reach through `ctx`. The
 * worker builds it per request; the router tests build it over their own database and captcha.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Captcha } from "@sdxc/captcha";
import type { Database as DataTable } from "remix/data-table";
import type { Middleware, RouterContext } from "remix/router";

import { assets } from "@sdxc/assets-middleware";
import { captcha } from "@sdxc/captcha/middleware";
import { database } from "@sdxc/database-middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import i18n from "@sdxc/i18n/middleware";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import jobs from "~/app/http/middleware/jobs";
import models from "~/app/http/middleware/models";
import callerBudget from "~/app/http/middleware/rate-limit";
import { assetResolver } from "~/app/initializers/assets";
import { captchaProvider } from "~/app/initializers/captcha";
import { openDatabase } from "~/app/initializers/database";
import { FALLBACK_LANGUAGE, resources, SUPPORTED_LANGUAGES } from "~/app/initializers/i18n";
import { logger } from "~/app/initializers/logger";
import routes from "~/routes/web";

/** Submissions one caller may make per minute, comfortably above a person filling a form. */
const SUBMIT_LIMIT = 5;

/** Calls one agent may make to the MCP endpoint per minute. */
const MCP_LIMIT = 60;

/** The context a handler sees once the global middleware has run. */
export type AppContext = RouterContext<ReturnType<typeof createWebRouter>>;

declare module "remix/router" {
	/** Types route helpers such as `createAction` with the context the global chain builds. */
	interface RouterTypes {
		context: AppContext;
	}
}

/**
 * Builds the board's HTTP router. The middleware list is written inline, so the router's type
 * carries what each link publishes and {@link AppContext} reads it from there. Every route is
 * mapped through `lazy()`, so a request imports only the controller it reaches.
 *
 * @param openDb Opens the database every request and job reads through; a test hands in its
 * own, so what it drives is the router the worker builds.
 * @param guard The provider the submit form is verified against.
 * @returns The configured router the worker forwards requests to.
 */
export function createWebRouter(
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
			database(openDb()),
			models(),
			jobs(openDb),
			assets(assetResolver, {
				stylesheets: "resources/layouts/document.tsx",
				script: "bootstrap/browser.ts",
			}),
			render({ assets: assetResolver }),
		],
		defaultHandler,
	});

	router.map(routes.board, {
		actions: {
			index: lazy(() => import("~/app/http/controllers/board").then((it) => it.index)),
			action: lazy(
				() => import("~/app/http/controllers/board").then((it) => it.action),
				/**
				 * `captcha()` refuses a failed challenge itself and the action never reads the
				 * outcome it publishes, so it runs here as a plain guard, before the module loads.
				 */
				[callerBudget("submit", SUBMIT_LIMIT), captcha(guard) as Middleware],
			),
		},
	});

	router.map(
		routes.position,
		lazy(() => import("~/app/http/controllers/position")),
	);

	router.map(
		routes.outbox,
		lazy(() => import("~/app/http/controllers/outbox")),
	);

	router.map(
		routes.mcp,
		lazy(
			() =>
				import("~/app/initializers/mcp").then((it) => (ctx: AppContext) => it.default.fetch(ctx)),
			[callerBudget("mcp", MCP_LIMIT)],
		),
	);

	return router;
}
