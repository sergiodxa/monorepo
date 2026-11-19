/**
 * The Foundations of `@sdxc/ui/map`: what its maps are for, the server-first rules they share,
 * and the data attributes and variables that link a list to its pins and move a marker.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const MAP: Foundations = {
	module: "map",
	slug: "map-foundations",
	title: "Map foundations",
	summary:
		"What @sdxc/ui/map is for, the server-first rules its maps share, and every variable it reads.",
	importPath: "@sdxc/ui/map",
	source: "ui/src/map/map-canvas.tsx",
	intro: [
		"Places on a map beside the list they belong to: price pins for stays, a courier riding a route, a pin that lights up while its row is hovered.",
		"A map renders on the server, so its pins are real links before any script loads; script only adds what a picture cannot do on its own.",
	],
	reachFor: [
		"Search results whose rows and pins should point at each other.",
		"A delivery or ride whose marker moves along a route as it streams.",
		"A listing's location, drawn in the page with no third-party map.",
	],
	ideas: [
		{
			title: "Pins are links",
			body: "A pin with `href` is an `<a>`, otherwise a button that can open a popover; both work without script.",
		},
		{
			title: "One coordinate space",
			body: "Art, routes, markers and pins share the stage's viewBox, so a crop moves all of them together.",
		},
		{
			title: "Linked by key",
			body: "Rows and pins sharing a `data-map-key` light each other through `mapLink` or one `MapCanvasSync`.",
		},
		{
			title: "Progress as a variable",
			body: "A route marker reads `--ui-map-progress`, so any island moves it by setting one property.",
		},
	],
	roles:
		"Reads the neutral role for pins, hairlines and surfaces, and brand for routes, markers and a brand-toned pin.",
	variables: [
		{
			title: "Stage and pins",
			lead: "Set on the map or an ancestor to restyle every part at once.",
			variables: [
				{ name: "--ui-map-radius", default: "0.75rem", controls: "The corner of the map's stage." },
				{
					name: "--ui-map-ground",
					default: "the neutral tint",
					controls: "The stage's fill behind the art.",
				},
			],
		},
		{
			title: "Routes and markers",
			variables: [
				{ name: "--ui-map-route-color", default: "the brand solid", controls: "A route's line." },
				{
					name: "--ui-map-route-width",
					default: "4",
					controls: "A route's line width, in viewBox units.",
				},
				{
					name: "--ui-map-marker-color",
					default: "the brand solid",
					controls: "The default marker's dot.",
				},
				{
					name: "--ui-map-progress",
					default: "the `progress` prop",
					controls: "How far along its route a marker sits, from 0 to 1.",
				},
			],
		},
	],
};

export default MAP;
