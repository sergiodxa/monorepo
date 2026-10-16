/**
 * The API's 404: an unknown path under `/api` answers an RFC 9457 problem document, which a
 * client parses the same way as every other error the API returns.
 */

import { createAction } from "remix/router";

import api from "~/app/http/middleware/api";
import problems from "~/config/problems";
import routes from "~/routes/api";

export default createAction(routes.api.notFound, {
	middleware: api,
	/** Any method on an unknown `/api` path answers the `notFound` problem. */
	handler: () => problems.notFound(),
});
