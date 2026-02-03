import { createRollingCookieMiddleware } from "remix-utils/middleware/rolling-cookie";

import { cookie } from "./session";

export const [rollingCookieMiddleware] = createRollingCookieMiddleware({ cookie });
