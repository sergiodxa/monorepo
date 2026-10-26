/**
 * The now page in Argentine Spanish: work, what the author is building and writing, and the
 * open source he keeps up, plus the copy around them. The page and `/now.md` both read this
 * document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { NowPage } from "~/app/services/now-page";

import { NOW_LINKS, NOW_UPDATED_AT } from "~/resources/content/now/shared";

/** The page a Spanish-speaking reader sees. */
const ES_AR: NowPage = {
	locale: "es-AR",
	title: "Ahora",
	description: "En qué está enfocado Sergio Xalambrí en este momento de su vida.",
	heading: "Qué estoy haciendo ahora",
	intro:
		"Esto es lo que tiene mi atención estos días, lo que le contaría a un amigo que no veo hace un año.",
	updatedAt: NOW_UPDATED_AT,
	location: "Lima, Perú",
	otherLanguage: { locale: "en", label: "English" },
	labels: { updated: "Actualizado el", location: "Vivo en", viewMarkdown: "Ver como Markdown" },
	sections: [
		{
			id: "work",
			title: "Trabajo",
			items: [
				{
					title: "Daffy",
					href: NOW_LINKS.daffy,
					text: "Soy desarrollador web en Daffy, un fondo de donaciones que ayuda a la gente a donar a las causas que le importan, y trabajo en la aplicación web que está en el centro del producto.",
				},
			],
		},
		{
			id: "building",
			title: "Construyendo",
			items: [
				{
					title: "Todo con Remix v3",
					href: NOW_LINKS.monorepo,
					text: "Estoy reconstruyendo las aplicaciones que mantengo con Remix v3, en un monorepo público: este blog, un monitor de uptime, un lector de feeds, un proveedor de identidad multi-tenant y el sitio de mi React Router OAuth2 Handbook.",
				},
				{
					title: "Los paquetes @sdxc",
					href: NOW_LINKS.packages,
					text: "Las librerías chicas que comparten esas aplicaciones, hechas sobre las APIs de la Web Platform: autenticación, jobs, mail, feeds y una lista creciente de estándares, con guías en sdxc.dev y una línea de comandos que crea y revisa aplicaciones hechas con ellas.",
				},
				{
					title: "Encore",
					href: NOW_LINKS.encore,
					text: "Un juego de cartas musical para fiestas, para iPhone, iPad, Apple Watch y Mac: juntás a tus amigos, das vuelta una carta y cantan una canción que cumpla el desafío.",
				},
			],
		},
		{
			id: "writing",
			title: "Escribiendo y hablando",
			items: [
				{
					title: "The Remix Way",
					href: NOW_LINKS.remixWay,
					text: "Mi charla en Remix Jam 2026, en Toronto, también escrita acá en inglés, sobre construir aplicaciones con paquetes chicos alrededor de contratos compartidos.",
				},
				{
					title: "Tutoriales",
					href: NOW_LINKS.tutorials,
					text: "Guías paso a paso de lo que permiten los paquetes, las últimas sobre una herramienta de línea de comandos con @sdxc/cli y un servidor MCP para una aplicación con Remix v3.",
				},
			],
		},
		{
			id: "open-source",
			title: "Open source",
			items: [
				{
					title: "Remix Auth y Remix Utils",
					href: NOW_LINKS.remixAuth,
					text: "Los mantengo funcionando para las aplicaciones de Remix y React Router que dependen de ellos.",
				},
				{
					title: "Remix",
					href: NOW_LINKS.remix,
					text: "Contribuyo al framework y sus paquetes mientras toma forma la v3.",
				},
			],
		},
	],
	explainer: {
		title: "¿Qué es esta página?",
		text: "Una página now cuenta en qué está enfocada una persona en este momento de su vida, en lugar de todo lo que hizo. Si tenés un sitio web, podés hacer la tuya; la idea, y un directorio de quienes ya tienen una, están en",
		linkLabel: "nownownow.com",
		href: NOW_LINKS.nownownow,
	},
};

export default ES_AR;
