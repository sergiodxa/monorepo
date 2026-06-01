import { createRouter } from "@pkg/r3-ui-router";

import { renderAlbum } from "./controllers/album";
import { renderHome } from "./controllers/home";
import { renderNotFound } from "./controllers/not-found";
import { renderPhoto } from "./controllers/photo";
import { routes } from "./routes";

let router = createRouter({
	defaultElement: renderNotFound,
});

router.map(routes.home, renderHome);
router.map(routes.album, renderAlbum);
router.map(routes.photo, renderPhoto);

let rootElement = document.getElementById("app");

if (rootElement) router.mount(rootElement);
