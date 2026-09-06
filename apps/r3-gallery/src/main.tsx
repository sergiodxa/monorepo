/**
 * Client entry point for the gallery app. It maps every route to its controller
 * action and starts the SPA runtime, which dispatches the current URL and each
 * later navigation through the router and renders the answering node.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Text } from "@sdxc/ui";
import { run } from "remix/spa";

import { Shell } from "./components/shell";
import { renderAlbum } from "./controllers/album";
import { renderHome } from "./controllers/home";
import { likePhoto } from "./controllers/like-photo";
import { openAlbum } from "./controllers/open-album";
import { renderPhoto } from "./controllers/photo";
import { router } from "./router";
import { routes } from "./routes";

import "./theme.css";

router.map(routes, {
	actions: {
		home: renderHome,
		openAlbum,
		album: renderAlbum,
		likePhoto,
		photo: renderPhoto,
	},
});

let app = run(router, {
	fallback: (
		<Shell
			eyebrow="JSONPlaceholder albums"
			title="Loading the gallery"
			intro="A client-only Remix SPA demo. The first route is on its way."
		>
			<Text>Loading...</Text>
		</Shell>
	),
});

await app.ready();
