/**
 * The about page in Argentine Spanish: who Sergio is, what he works on today, how he learned
 * to build for the web, what he cares about and how to work with him. The page and
 * `/about.md?lang=es` read this document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AboutPage } from "~/app/services/about-page";

import {
	CONTACT,
	FIGURES,
	PHOTOS,
	PROFILE_LINKS,
	PROJECTS,
} from "~/resources/content/about/shared";
import routes from "~/routes/web";

/** The page a Spanish-speaking reader gets. */
const ES_AR: AboutPage = {
	locale: "es-AR",
	title: "Sobre mí",
	description:
		"Sergio Xalambrí es un desarrollador web argentino que vive en Lima, trabaja en Daffy y mantiene Remix Auth y Remix Utils.",
	tagline: "Desarrollador web en Daffy, mantenedor de open source y colaborador de Remix.",
	intro: [
		"Hola, soy Sergio. Vivo de construir aplicaciones web, mantengo librerías open source que usan miles de aplicaciones de Remix y React Router, y en este sitio escribo lo que voy aprendiendo.",
		"Soy argentino y vivo en Lima, Perú. Hago páginas web desde los diez años y trabajo como desarrollador web hace más de una década.",
	],
	otherLanguage: { locale: "en", label: "English" },
	labels: {
		now: "A qué me dedico",
		story: "Cómo llegué hasta acá",
		timeline: "Hitos",
		values: "Lo que me importa",
		projects: "Open source",
		connect: "Trabajemos juntos",
		connectNote: "Leo todo lo que me llega, en español o en inglés.",
		links: "En otros sitios",
		viewMarkdown: "Ver como Markdown",
		readPosts: "Leer mis artículos",
		pressKit: "Kit de prensa",
	},
	portrait: { ...PHOTOS.avatar, alt: "El avatar de Sergio Xalambrí" },
	feature: {
		...PHOTOS.helmet,
		alt: "Un retrato animado de Sergio Xalambrí con un casco de carreras amarillo",
		caption:
			"La foto de portada de mi kit de prensa, que eventos y podcasts pueden usar libremente.",
	},
	facts: [
		{ label: "Se pronuncia", value: "Sergio Salambrí (la X suena como una S)" },
		{ label: "Vive en", value: "Lima, Perú" },
		{ label: "Habla", value: "Español e inglés" },
		{ label: "Usuario", value: "@sergiodxa" },
	],
	stats: [
		{ value: FIGURES.firstPage, label: "el año en que hice mi primera página web" },
		{ value: FIGURES.years, label: "años trabajando como desarrollador web" },
		{ value: FIGURES.posts, label: "artículos y tutoriales en este sitio" },
		{ value: FIGURES.downloads, label: "descargas mensuales de Remix Utils y Remix Auth" },
	],
	now: [
		{
			title: "Daffy",
			detail:
				"Construyo la aplicación web en el centro de Daffy, un fondo de donaciones que ayuda a las personas a donar a las causas que les importan.",
			href: "https://www.daffy.org",
		},
		{
			title: "Open source",
			detail:
				"Mantengo Remix Auth, Remix Utils y remix-i18next, y colaboro con Remix y React Router.",
			href: PROFILE_LINKS.github,
		},
		{
			title: "Los paquetes @sdxc",
			detail:
				"Librerías para construir aplicaciones full-stack sobre las APIs de la Web Platform. Este sitio corre sobre ellas.",
			href: PROJECTS.packages,
		},
		{
			title: "Escribir",
			detail:
				"Artículos, tutoriales, notas y TILs sobre desarrollo web, con patrones que uso en el trabajo.",
			href: routes.articles.href(),
		},
	],
	story: [
		"En 2002, cuando tenía unos diez años, me pregunté cómo se hacían las páginas web. Una conocida que estudiaba ingeniería en sistemas me respondió el mail con unos links sobre HTML. Armé mi primer sitio en Microsoft Word, lleno de gifs y tablas sin bordes, y lo subí a GeoCities de a cinco archivos por vez.",
		"Aprender a programar me llevó once años más. En 2013 convencí a mi mamá de que me prestara su tarjeta de crédito para un curso online de dos semanas en Mejorando.la, y por fin aprendí JavaScript. (Nunca le devolví la plata.) Publiqué mi primer proyecto open source, una calculadora de cálculos eléctricos, y conseguí mi primer trabajo buscando en Google Maps estudios de diseño web de Buenos Aires a los que pudiera ir caminando.",
		"En 2015 dejé Angular por React y me fui a Colombia a trabajar en Platzi, la misma escuela cuyo curso me había hecho empezar. Ahí liberamos Pulse, un editor de Markdown. En 2017 entré a ZEIT, hoy Vercel, para ayudar a la gente a deployar sus aplicaciones, y empecé a escribir en inglés. En Able lideré el frontend de un producto interno y escribí el primer temario de frontend de Codeable, su bootcamp. Hasta la pandemia también organicé las meetups de Tech Talks Peru en Lima.",
		"Compré una de las primeras licencias de Remix, construí Remix Utils y Remix Auth sobre él en 2021, y colaboro con Remix desde que es open source. En 2021 entré a Daffy, antes Silverback Ventures, donde sigo construyendo la aplicación web, y dedico mi tiempo libre a los paquetes @sdxc y a este sitio.",
	],
	timeline: [
		{
			year: "2002",
			title: "Primera página web",
			detail: "Hecha en Microsoft Word y alojada en GeoCities.",
		},
		{
			year: "2013",
			title: "Primer trabajo",
			detail: "Aprendí JavaScript y entré a un estudio de diseño web en Buenos Aires.",
		},
		{
			year: "2015",
			title: "Platzi",
			detail: "Me mudé a Colombia como desarrollador frontend y me pasé a React.",
		},
		{
			year: "2017",
			title: "ZEIT, hoy Vercel",
			detail: "Support engineer, colaborador temprano de Next.js y mis primeros posts en inglés.",
		},
		{
			year: "2018",
			title: "Able y Codeable",
			detail: "Frontend lead, y profesor en el bootcamp cuyo temario de frontend escribí.",
		},
		{
			year: "2021",
			title: "Daffy",
			detail: "Entré a Daffy, antes Silverback Ventures, para construir su aplicación web.",
		},
		{
			year: "2021",
			title: "Remix Utils y Remix Auth",
			detail: "Dos librerías que se volvieron de las más usadas del ecosistema de Remix.",
		},
		{
			year: "2022",
			title: "Remix Conf Europe",
			detail: "“Remixing How We Give”, mi charla en la conferencia europea de Remix.",
		},
		{
			year: "2026",
			title: "Remix Jam",
			detail: "“The Remix Way”, una charla en la conferencia de Remix en Toronto.",
		},
	],
	values: [
		{
			title: "Compartir lo que aprendo",
			detail:
				"Aprendí con libros gratis y sitios de la comunidad, así que escribo lo que voy descubriendo. Durante años escribí solo en español, para devolverle algo a la comunidad que me enseñó.",
		},
		{
			title: "APIs que resulten obvias",
			detail:
				"Disfruto diseñar librerías que a otros desarrolladores les resulten obvias, para que el código que escriben en el primer intento sea el que funciona.",
		},
		{
			title: "Construir sobre la plataforma",
			detail:
				"Me gusta explorar lo que la Web Platform puede hacer sin un framework en el medio, y construir páginas que funcionen antes de que cargue su JavaScript.",
		},
	],
	projects: [
		{
			name: "Remix Auth",
			href: PROJECTS.remixAuth,
			since: "2021",
			description:
				"Autenticación para aplicaciones de Remix y React Router, con decenas de estrategias.",
		},
		{
			name: "Remix Utils",
			href: PROJECTS.remixUtils,
			since: "2021",
			description: "Utilidades para rutas, respuestas, server-sent events, CSRF y más.",
		},
		{
			name: "remix-i18next",
			href: PROJECTS.remixI18next,
			since: "2021",
			description: "La forma más fácil de traducir aplicaciones de React Router en framework mode.",
		},
		{
			name: "remix-hono",
			href: PROJECTS.remixHono,
			since: "2023",
			description: "Middleware de Hono para aplicaciones de Remix y React Router.",
		},
		{
			name: "Los paquetes @sdxc",
			href: PROJECTS.monorepo,
			since: "2026",
			description:
				"Un monorepo de paquetes y aplicaciones construidos sobre la Web Platform, en sdxc.dev.",
		},
	],
	connect: [
		{
			title: "Invitame a dar una charla",
			detail: "Conferencias, meetups, podcasts y talleres, en español o en inglés.",
			action: "Abrir el kit de prensa",
			href: routes.press.index.href() + "?lang=es-AR",
		},
		{
			title: "Patrociná mi open source",
			detail: "Los patrocinios pagan el tiempo que dedico a mantener las librerías que usás.",
			action: "Patrocinar en GitHub",
			href: CONTACT.sponsor,
		},
		{
			title: "Escribime",
			detail: "Preguntas sobre un post, una librería o cualquier otra cosa.",
			action: "Mandarme un email",
			href: CONTACT.email,
		},
	],
	links: [
		{ label: "GitHub", href: PROFILE_LINKS.github },
		{ label: "X", href: PROFILE_LINKS.x },
		{ label: "YouTube", href: PROFILE_LINKS.youtube },
		{ label: "Paquetes", href: PROFILE_LINKS.packages },
	],
};

export default ES_AR;
