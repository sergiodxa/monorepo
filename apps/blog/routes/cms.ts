/**
 * Route definitions for the blog CMS: the dashboard endpoint plus RESTful
 * resource routes for articles, tutorials, bookmarks, glossary, and redirects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, resources, route } from "remix/routes";

/**
 * Typed CMS endpoint helpers; each resource is narrowed to the actions its
 * editorial flow exposes.
 */
export default route({
	dashboard: get("/"),
	articles: resources("/articles", { exclude: ["show"] }),
	tutorials: resources("/tutorials", { exclude: ["show"] }),
	bookmarks: resources("/bookmarks", { exclude: ["show"] }),
	glossary: resources("/glossary", { exclude: ["show"] }),
	redirects: resources("/redirects", { only: ["index", "new", "create", "destroy"] }),
});
