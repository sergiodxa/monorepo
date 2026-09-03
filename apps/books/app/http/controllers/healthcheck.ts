/**
 * Health check controller. Answers plain-text `OK` without touching
 * Buttondown or Polar, so an external monitor measures this worker's own
 * uptime, independent of any third-party API's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text } from "@sdxc/http/response";
import { Ok } from "@sdxc/http/status-code";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/** GET /healthcheck — confirms the worker is serving. */
export default createAction(routes.healthcheck, () => text("OK", Ok));
