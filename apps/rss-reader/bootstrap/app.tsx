import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";

import defaultHandler from "~/app/http/controllers/default-handler";
import database from "~/app/http/middleware/database";
import routes from "~/routes/web";

namespace application {
	export interface Options {
		database: Database;
	}
}

export default function application(options: application.Options) {
	let router = createRouter({
		middleware: [asyncContext(), formData(), methodOverride(), database(options.database)],
		defaultHandler,
	});

	router.map(routes, {
		middleware: [],
		actions: {},
	});

	return router;
}
