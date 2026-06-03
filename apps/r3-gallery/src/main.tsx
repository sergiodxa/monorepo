import { createController, createRouter } from "@pkg/r3-ui-router";

import { renderAlbum } from "./controllers/album";
import { renderHome } from "./controllers/home";
import { likePhoto } from "./controllers/like-photo";
import { renderNotFound } from "./controllers/not-found";
import { openAlbum } from "./controllers/open-album";
import { renderPhoto } from "./controllers/photo";
import { loadLikes } from "./middleware/likes";
import { routes } from "./routes";

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
