/**
 * The apps showcase in Argentine Spanish: each product the author ships, with a short pitch
 * and where to open it. The page and `/apps.md` both read this document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppsPage } from "~/app/services/apps-page";

import { APP_LINKS } from "~/resources/content/apps/shared";

/** The page a Spanish-speaking reader sees. */
const ES_AR: AppsPage = {
	locale: "es-AR",
	title: "Apps",
	description:
		"Apps que construyó Sergio Xalambrí: vocabulario japonés, un juego de música, monitoreo de uptime y un lector de feeds.",
	heading: "Apps que construí",
	intro:
		"Productos que publico yo — en el App Store y en la web —, cada uno con su propio hogar para probar o descargar.",
	otherLanguage: { locale: "en", label: "English" },
	labels: { viewMarkdown: "Ver como Markdown" },
	apps: [
		{
			id: "wakaba",
			name: "Wakaba",
			href: APP_LINKS.wakaba,
			platform: "App Store",
			blurb:
				"Práctica de vocabulario japonés unos minutos al día en iPhone e iPad: flashcards, un camino de diez niveles y cuatro compañeros, mientras un bonsái crece con cada sesión. Gratis, sin anuncios ni compras dentro de la app.",
		},
		{
			id: "encore",
			name: "Encore",
			href: APP_LINKS.encore,
			platform: "App Store",
			blurb:
				"Un juego de cartas de música para iPhone, iPad, Apple Watch y Mac: revelá una carta, elegí una canción que encaje con el desafío y cantá. Ya está en el App Store.",
		},
		{
			id: "uptime",
			name: "Uptime",
			href: APP_LINKS.uptime,
			platform: "Web",
			blurb:
				"Monitoreo de uptime simple y confiable para desarrolladores: sitios, APIs, DNS, certificados SSL y cron jobs, con alertas y páginas de estado públicas.",
		},
		{
			id: "reader",
			name: "Reader",
			href: APP_LINKS.reader,
			platform: "Web",
			blurb:
				"Seguí cualquier sitio que publique RSS o Atom y leé todo lo que escribe en un solo lugar: tu propia biblioteca de feeds, carpetas y posts guardados.",
		},
	],
};

export default ES_AR;
