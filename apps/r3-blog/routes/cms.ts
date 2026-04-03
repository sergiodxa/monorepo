import { get, resources, route } from "remix/fetch-router/routes";

/**
 * Maps CMS endpoints for dashboard metrics and editorial resource CRUD routes.
 */
export default route({
	dashboard: get("/"),
	articles: resources("/articles", { exclude: ["show"] }),
	tutorials: resources("/tutorials", { exclude: ["show"] }),
	bookmarks: resources("/bookmarks", { exclude: ["show"] }),
	glossary: resources("/glossary", { exclude: ["show"] }),
	redirects: resources("/redirects", { only: ["index", "new", "create", "destroy"] }),
});
