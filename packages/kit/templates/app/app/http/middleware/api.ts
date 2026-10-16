/**
 * The middleware every API endpoint declares: CORS, so a browser on another origin can call
 * it. An endpoint reads its own body, as JSON or a form, so it is left unparsed here.
 */

import { cors } from "remix/middleware/cors";
import { createMiddleware } from "remix/router";

/** Answers CORS preflights and adds the CORS headers to every endpoint's response. */
export default createMiddleware(cors());
