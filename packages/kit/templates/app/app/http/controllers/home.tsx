/**
 * The home page, the first thing a visitor sees. It renders through the document layout,
 * which links the stylesheets and client entry the page middleware resolved.
 */

import { createAction } from "remix/router";

import page from "~/app/http/middleware/page";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

export default createAction(routes.home, {
	middleware: page,
	/** GET / — the welcome page. */
	handler: (ctx) =>
		ctx.render(
			<DocumentLayout assets={ctx.assets} title="Welcome">
				<h1>Welcome</h1>
				<p>
					Edit <code>app/http/controllers/home.tsx</code>, or add a page with{" "}
					<code>sdxc make controller &lt;name&gt;</code>.
				</p>
			</DocumentLayout>,
		),
});
