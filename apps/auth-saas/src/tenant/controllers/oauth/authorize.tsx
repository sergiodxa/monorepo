import { ok } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { renderToString } from "remix/component/server";
import * as s from "remix/data-schema";

import form from "~/lib/form";
import { Layout } from "~/tenant/components/layout";
import routes from "~/tenant/routes";

export default form<"/authorize">({
	middleware: [],

	actions: {
		async index({ logger }) {
			let log = logger.loader("/authorize");
			log.info("Rendering authorization form");
			let body = await renderToString(<AuthorizeForm />);
			log.info("Rendered form", { bodyLength: body.length });
			return ok(body);
		},

		async action({ formData, logger }) {
			let log = logger.action("/authorize");

			log.info("Processing authorization form submission", {
				formDataKeys: Array.from(formData.keys()),
			});

			let result = await validate(formData, s.object({}));

			if (isFailure(result)) {
				log.error("Form validation failed", { issues: result.error.issues });
				let body = await renderToString(<AuthorizeForm />);
				return ok(body);
			}

			log.info("Form validated successfully");
			return ok("Authorized");
		},
	},
});

function AuthorizeForm() {
	return () => (
		<Layout>
			<h1>Authorize</h1>
			<form
				method={routes.oauth.authorize.action.method}
				action={routes.oauth.authorize.action.href()}
			>
				<button type="submit">Authorize</button>
			</form>
		</Layout>
	);
}
