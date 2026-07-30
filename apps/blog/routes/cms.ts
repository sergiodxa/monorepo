/**
 * Route definitions for the blog CMS. Declares the dashboard endpoint plus
 * RESTful resource routes for articles, tutorials, bookmarks, glossary, and
 * redirects, tuning each with include/exclude sets to match its editorial CRUD.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
