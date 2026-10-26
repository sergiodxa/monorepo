/**
 * The `/uses` page in Spanish: the hardware, editor, stack, apps and services the author works
 * with, each with a line on why. The page and `/uses.md` both read this document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UsesPage } from "~/app/services/uses";

import { ITEMS } from "~/resources/content/uses/shared";

/** The page a Spanish-speaking reader sees. */
const ES_AR: UsesPage = {
	locale: "es-AR",
	title: "Lo que uso",
	description:
		"El hardware, editor, stack, apps y servicios con los que Sergio Xalambrí construye para la web.",
	intro:
		"Con qué trabajo día a día: el escritorio, el editor, el stack detrás de este sitio y los servicios donde corre. Cambia a medida que cambia mi trabajo, así que es una foto del momento más que una recomendación.",
	updated: "octubre de 2026",
	otherLanguage: { locale: "en", label: "English" },
	labels: {
		updated: "Última actualización",
		viewMarkdown: "Ver como Markdown",
		contents: "En esta página",
	},
	sections: [
		{
			id: "desk",
			title: "Hardware",
			items: [
				{ ...ITEMS.macbookPro, note: "La computadora en la que escribo, construyo y grabo todo." },
				{ ...ITEMS.mv7, note: "Mi micrófono para llamadas, podcasts y charlas." },
			],
		},
		{
			id: "editor",
			title: "Editor y terminal",
			items: [
				{
					...ITEMS.vscode,
					note: "Mi único editor, para código y para escribir, con las extensiones que recomienda el repositorio.",
				},
				{
					...ITEMS.githubTheme,
					note: "Cambia entre su versión clara y oscura junto con la apariencia del sistema.",
				},
				{
					...ITEMS.oxc,
					note: "Formatea y revisa al guardar con el mismo oxfmt y oxlint que usa el repositorio.",
				},
				{ ...ITEMS.terminal, note: "La terminal que viene con macOS, donde corre mi shell." },
				{
					...ITEMS.zsh,
					note: "Mi shell, configurada para elegir la versión de Node.js de cada proyecto.",
				},
				{
					...ITEMS.claudeCode,
					note: "Trabaja en mi monorepo con las reglas de su AGENTS.md, mientras yo reviso y dirijo.",
				},
			],
		},
		{
			id: "stack",
			title: "Stack",
			note: "Con qué están hechos este sitio y los paquetes @sdxc.",
			items: [
				{ ...ITEMS.typescript, note: "El lenguaje en el que escribo todo, frontend y backend." },
				{
					...ITEMS.remix,
					note: "Remix v3 renderiza este sitio: su router, middleware y componentes, sobre Web APIs.",
				},
				{ ...ITEMS.bun, note: "Instala dependencias y corre cada script del monorepo." },
				{
					...ITEMS.vitePlus,
					note: "Formatea, revisa y chequea tipos de todo el repositorio en una pasada con caché.",
				},
				{
					...ITEMS.vitest,
					note: "Corre los tests, en Node, en un navegador real y dentro de workerd con bindings reales.",
				},
				{ ...ITEMS.msw, note: "Simula el HTTP saliente en los tests, así nada reemplaza fetch." },
				{
					...ITEMS.sdxc,
					note: "Mis propias librerías de auth, jobs, mail, caché y UI, que usan todas mis apps.",
				},
			],
		},
		{
			id: "services",
			title: "Hosting y servicios",
			items: [
				{
					...ITEMS.workers,
					note: "Donde corren este sitio y mis otras apps, cerca de cada lector.",
				},
				{ ...ITEMS.d1, note: "La base de datos, cachés y backups del sitio, junto al Worker." },
				{ ...ITEMS.github, note: "Donde vive todo mi código, del monorepo a Remix Auth." },
				{
					...ITEMS.actions,
					note: "Chequea cada push y publica los paquetes @sdxc en un release diario.",
				},
				{ ...ITEMS.npm, note: "Donde se publican los paquetes @sdxc." },
			],
		},
		{
			id: "apps",
			title: "Apps",
			items: [
				{ ...ITEMS.safari, note: "Mi navegador principal." },
				{ ...ITEMS.mail, note: "El correo, con la app que viene con macOS." },
				{ ...ITEMS.calendar, note: "Reuniones y planes, también incluida en macOS." },
				{ ...ITEMS.cursor, note: "Un editor pensado para IA que tengo junto a VS Code." },
				{ ...ITEMS.xcode, note: "Para construir y correr apps para las plataformas de Apple." },
				{ ...ITEMS.figma, note: "Para diseñar y bocetar interfaces antes de construirlas." },
				{ ...ITEMS.chatgpt, note: "Un asistente de IA en el escritorio." },
				{
					...ITEMS.claude,
					note: "La app de escritorio de Claude, para chats y sesiones de trabajo largas.",
				},
				{
					...ITEMS.githubDesktop,
					note: "Para revisar y preparar cambios de forma visual antes de un commit.",
				},
				{ ...ITEMS.docker, note: "Corre contenedores localmente cuando un proyecto lo necesita." },
			],
		},
	],
};

export default ES_AR;
