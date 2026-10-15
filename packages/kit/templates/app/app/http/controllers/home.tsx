/**
 * The home page, the first thing a visitor sees. It renders through the document layout,
 * which links the stylesheets and client entry the request resolved.
 */

import { createAction } from "remix/router";

import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET / — the welcome page. */
export default createAction(routes.home, (ctx) =>
	ctx.render(
		<DocumentLayout assets={ctx.assets} title="Welcome">
			<h1>Welcome</h1>
			<p>
				Edit <code>app/http/controllers/home.tsx</code>, or add a page with{" "}
				<code>sdxc make controller &lt;name&gt;</code>.
			</p>
		</DocumentLayout>,
	),
);
