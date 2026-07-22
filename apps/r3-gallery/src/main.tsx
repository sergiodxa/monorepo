/**
 * Client entry point for the gallery app. It builds the UI router, wires every route
 * to its controller action, installs the likes middleware, and mounts the router onto
 * the `#app` element so the single-page gallery boots in the browser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createController, createRouter } from "@pkg/r3-ui-router";

import { renderAlbum } from "./controllers/album";
import { renderHome } from "./controllers/home";
import { likePhoto } from "./controllers/like-photo";
import { renderNotFound } from "./controllers/not-found";
import { openAlbum } from "./controllers/open-album";
import { renderPhoto } from "./controllers/photo";
import { loadLikes } from "./middleware/likes";
import { routes } from "./routes";

import "./theme.css";

let router = createRouter({
	defaultElement: renderNotFound,
	middleware: [loadLikes],
});

router.map(
	routes,
	createController(routes, {
		actions: {
			home: renderHome,
			openAlbum,
			album: renderAlbum,
			likePhoto,
			photo: renderPhoto,
		},
	}),
);

let rootElement = document.getElementById("app");

if (rootElement) router.mount(rootElement);
