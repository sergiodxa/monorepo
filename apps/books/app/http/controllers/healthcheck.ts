/**
 * Health check controller. Answers plain-text `OK` without touching Buttondown or Polar,
 * so an external monitor is measuring whether this worker is serving rather than whether
 * a third-party API is up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text } from "@pkg/http/response";
import { Ok } from "@pkg/http/status-code";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/** GET /healthcheck — confirms the worker is serving. */
export default createAction(routes.healthcheck, () => text("OK", Ok));
