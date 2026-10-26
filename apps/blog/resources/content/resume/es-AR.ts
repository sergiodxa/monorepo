/**
 * El currículum en español rioplatense: experiencia, open source, charlas y habilidades, cada
 * punto empezando por lo que logró. La página, `/resume.md?lang=es-AR` y el PDF en español
 * leen este documento.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Resume } from "~/app/services/resume";

import {
	CONTACT_LINKS,
	EMPLOYERS,
	PROJECT_FIGURES,
	PROJECT_LINKS,
	TALKS,
	pdfFor,
} from "~/resources/content/resume/shared";

/** El currículum que lee un reclutador o una persona que contrata en español. */
const ES_AR: Resume = {
	locale: "es-AR",
	title: "Currículum",
	description:
		"El currículum de Sergio Xalambrí: desarrollador web en Daffy, mantenedor de Remix Auth y Remix Utils, con un PDF para descargar.",
	name: "Sergio Xalambrí",
	headline: "Desarrollador Web Full-Stack",
	location: "Lima, Perú (UTC−5) · Remoto",
	summary: `Desarrollador web full-stack desde 2013, con TypeScript, React, Remix y React Router. Construyo la aplicación web de Daffy y mantengo librerías open source con más de ${PROJECT_FIGURES.combinedMonthlyDownloads} de descargas mensuales en npm, usadas en todo el ecosistema de Remix y React Router. Me importan la Web Platform, la mejora progresiva y las APIs que a otros desarrolladores les resultan obvias.`,
	otherLanguage: { locale: "en", label: "English" },
	labels: {
		experience: "Experiencia",
		openSource: "Open source",
		speaking: "Charlas y escritura",
		skills: "Habilidades",
		education: "Educación",
		languages: "Idiomas",
		present: "Actualidad",
		downloadPdf: "Descargar PDF",
		viewMarkdown: "Ver como Markdown",
		contact: "Contacto",
		metricsNote: "Cifras de GitHub y npm, octubre de 2026.",
		latestVersion: "Versión más reciente:",
	},
	contact: [
		{ label: "Email", ...CONTACT_LINKS.email },
		{ label: "Sitio web", ...CONTACT_LINKS.website },
		{ label: "GitHub", ...CONTACT_LINKS.github },
		{ label: "LinkedIn", ...CONTACT_LINKS.linkedin },
	],
	experience: [
		{
			...EMPLOYERS.daffy,
			formerly: "antes Silverback Ventures",
			role: "Web Developer",
			highlights: [
				"Construyo la aplicación web de Daffy, un fondo de donaciones que llegó a estar entre los 10 más grandes de EE. UU., con más de 16.000 cuentas.",
				"Migré la aplicación de Next.js a Remix en nueve meses sin congelar funcionalidades, con ambos en un mismo servidor y sesiones compartidas mientras las rutas pasaban de a una.",
				"Diseñé un backend-for-frontend en Remix sobre la API de Rails, con un cliente validado por esquemas, reportes de donaciones en PDF e imágenes Open Graph generadas.",
				"Extraje los patrones a Remix Utils, estrategias de Remix Auth y remix-i18next, hoy librerías open source sobre las que construyen otros equipos.",
			],
		},
		{
			...EMPLOYERS.able,
			role: "Frontend Lead",
			highlights: [
				"Lideré la arquitectura frontend de un producto interno que se preparaba para lanzarse al público, con React sobre un backend en Rails.",
				"Escribí el primer programa de frontend de Codeable, el bootcamp full-stack de Able, y di su curso de React.",
			],
		},
		{
			...EMPLOYERS.zeit,
			formerly: "hoy Vercel",
			role: "Support Engineer",
			highlights: [
				"Ayudé a clientes a deployar en Now y adoptar Next.js, construyendo aplicaciones de ejemplo para sus casos de uso.",
				"Trabajé en la documentación de la API de ZEIT, para que los clientes aprendieran la plataforma sin abrir un ticket de soporte.",
			],
		},
		{
			...EMPLOYERS.platzi,
			role: "Frontend Developer",
			highlights: [
				"Construí el sistema de clases en vivo, las discusiones, el reproductor de video y el render en servidor de React sobre la plataforma Django de una escuela online respaldada por YC.",
				"Publiqué como open source Pulse Editor, el editor Markdown de Platzi, y Pulse, su aplicación de escritorio en Electron; di cursos de desarrollo web.",
			],
		},
	],
	openSource: [
		{
			name: "Remix Utils",
			href: PROJECT_LINKS.remixUtils,
			detail: "Utilidades para rutas, respuestas, server-sent events, CSRF y más.",
			metric: `${PROJECT_FIGURES.remixUtils.monthlyDownloads} de descargas al mes, ${PROJECT_FIGURES.remixUtils.stars} estrellas`,
		},
		{
			name: "Remix Auth",
			href: PROJECT_LINKS.remixAuth,
			detail:
				"Autenticación para aplicaciones de Remix y React Router, con decenas de estrategias.",
			metric: `${PROJECT_FIGURES.remixAuth.monthlyDownloads} descargas al mes, ${PROJECT_FIGURES.remixAuth.stars} estrellas`,
		},
		{
			name: "remix-i18next",
			href: PROJECT_LINKS.remixI18next,
			detail: "Traducciones para aplicaciones de Remix y React Router con i18next.",
			metric: `${PROJECT_FIGURES.remixI18next.monthlyDownloads} descargas al mes`,
		},
		{
			name: "Los paquetes @sdxc",
			href: PROJECT_LINKS.sdxc,
			detail: `${PROJECT_FIGURES.sdxcPackages} paquetes y una CLI para aplicaciones full-stack sobre las APIs de la Web Platform y Cloudflare Workers.`,
		},
		{
			name: "Contribuciones",
			href: "https://github.com/sergiodxa",
			detail: "Remix, React Router, Next.js, SWR y micro.",
		},
	],
	speaking: [
		{ ...TALKS.remixJam },
		{ ...TALKS.remixConfEurope },
		{
			title: "Cientos de artículos y tutoriales",
			event: "sergiodxa.com",
			date: "2013 – Actualidad",
			href: "https://sergiodxa.com",
		},
	],
	skills: [
		{
			label: "Lenguajes y frameworks",
			items: "TypeScript, JavaScript, React, Remix, React Router, Next.js, Node.js, Bun",
		},
		{
			label: "Plataforma",
			items: "Cloudflare Workers, D1, KV, Durable Objects, Express, APIs en Rails, SQL",
		},
		{
			label: "Prácticas",
			items:
				"Autenticación (OAuth 2.0, OpenID Connect, passkeys), testing con Vitest, accesibilidad, mejora progresiva, diseño de librerías y APIs, escritura técnica",
		},
	],
	education: [
		{
			title: "Autodidacta",
			detail: "Cursos de desarrollo web en Mejorando.la, hoy Platzi (2013 – 2015).",
		},
	],
	languages: [
		{ name: "Español", level: "nativo" },
		{ name: "Inglés", level: "fluido" },
	],
	pdf: pdfFor("es-AR"),
};

export default ES_AR;
