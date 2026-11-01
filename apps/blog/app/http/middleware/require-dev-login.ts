/**
 * Route guard for the development login. It answers 404 unless the login is enabled for
 * this request, so on a deployed Worker the route reads as one that does not exist, and the
 * controller behind it never loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { notFound } from "@sdxc/http/response/html";

import { isDevLoginEnabled } from "~/app/services/dev-login";

/**
 * Lets the request through only on a local run with `DEV_LOGIN=true`.
 *
 * @returns The downstream response, or a 404 when the development login is off.
 */
let requireDevLogin: Middleware = (ctx, next) => {
	if (!isDevLoginEnabled(ctx.url)) return notFound("Not Found");
	return next();
};

export default requireDevLogin;
