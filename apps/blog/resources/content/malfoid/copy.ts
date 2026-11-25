/**
 * The words Malfoid Stickers' support and privacy pages print in English and Spanish: the quick
 * fixes, the labels of the support form and the lines around the policy. The landing's words live in `landing.ts` and the privacy policy in its own Markdown file,
 * so the page and its Markdown twin read from one source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	MALFOID_SUPPORT_PLATFORMS,
	MALFOID_SUPPORT_TOPICS,
} from "~/app/http/validators/malfoid-support";
import type { PageLocale } from "~/app/services/page-locale";
import type { SupportForm } from "~/resources/views/app-pages/support-form";

/** Every label the support page and its form print, in one language. */
export interface SupportCopy extends SupportForm.Labels {
	title: string;
	description: string;
	intro: string;
	quickFixes: string;
	newToPack: string;
	installLink: string;
	/** Each problem people hit, with its fix, in the order the page lists them. */
	troubleshooting: ReadonlyArray<readonly [string, string]>;
	topics: Record<(typeof MALFOID_SUPPORT_TOPICS)[number], string>;
	platforms: Record<(typeof MALFOID_SUPPORT_PLATFORMS)[number], string>;
}

/** The lines the privacy page prints around the policy, in one language. */
export interface PrivacyCopy {
	forLine: string;
	viewMarkdown: string;
}

/** The support page in English. */
const SUPPORT_EN: SupportCopy = {
	title: "Malfoid Stickers Support",
	description:
		"Get help with Malfoid Stickers, the free iMessage sticker pack for iPhone and iPad: find the stickers in Messages, fix a missing pack, or send a question.",
	intro:
		"Malfoid acting up? Most problems have a quick fix below. If yours doesn’t, write to me and I’ll reply by email.",
	quickFixes: "Quick fixes",
	newToPack: "New to the pack?",
	installLink: "See how to send your first sticker",
	troubleshooting: [
		[
			"I can’t find the stickers in Messages",
			"Open a conversation, tap + beside the text field, then Stickers. Your sticker packs appear along the drawer; Malfoid is one of them. If you see an older layout, look for the App Store icon row above the keyboard instead.",
		],
		[
			"The pack isn’t in the list at all",
			"Make sure Malfoid Stickers is installed on this device: open the App Store, search for it and check that it shows Open rather than Get. A pack installed on your iPhone isn’t on your iPad until you install it there too.",
		],
		[
			"Stickers show a blank square or won’t load",
			"Close Messages and open it again. If that doesn’t help, restart your device. The artwork ships inside the app, so the stickers don’t need a connection to appear.",
		],
		[
			"A sticker won’t stick to a bubble",
			"Touch and hold the sticker until it lifts, then drag it onto the message and let go. A quick tap sends it as its own message instead.",
		],
		[
			"I want to remove the pack",
			"Delete Malfoid Stickers like any other app. It stores nothing about you, so there’s nothing else to clean up.",
		],
	],
	formTitle: "Still stuck? Write to me",
	sent: "Your support request has been sent. I’ll reply to the email address you provided.",
	sendAnother: "Send another request",
	failed: "I couldn’t send your request. Your message has been preserved—please try again.",
	rateLimited:
		"You’ve sent several requests in a short time. Your message has been preserved—please wait a minute and try again.",
	resubmit:
		"This form expired before it was sent. Your message has been preserved—please send it again.",
	invalid: "Please correct the highlighted fields and send your request again.",
	name: "Name (optional)",
	email: "Email",
	topic: "Topic",
	chooseTopic: "Choose a topic",
	device: "Device",
	chooseDevice: "Choose a device",
	osVersion: "iOS or iPadOS version (optional)",
	osPlaceholder: "e.g. iOS 26.1",
	appVersion: "App version (optional)",
	appPlaceholder: "e.g. 1.0",
	message: "Message",
	messagePlaceholder: "Describe your question, problem, or sticker idea…",
	notice:
		"This form is part of the website, not the app. I’ll use what you submit to reply, to investigate the problem you report and to improve the pack. Please don’t include passwords, payment details, or other sensitive information. Read the",
	privacyLink: "Privacy Policy",
	submit: "Send support request",
	pending: "Sending…",
	topics: {
		"Stickers not showing": "Stickers not showing",
		"Bug report": "Bug report",
		Question: "Question",
		"Sticker idea": "Sticker idea",
		Other: "Other",
	},
	platforms: { iPhone: "iPhone", iPad: "iPad", Other: "Other" },
};

/** The support page in Spanish; topic and device values stay the English ones the form posts. */
const SUPPORT_ES: SupportCopy = {
	title: "Soporte de Malfoid Stickers",
	description:
		"Ayuda con Malfoid Stickers, el pack gratis de stickers de iMessage para iPhone y iPad: encuentra los stickers en Mensajes, resuelve un pack que no aparece o envía una pregunta.",
	intro:
		"¿Malfoid se está portando mal? La mayoría de los problemas tienen una solución rápida aquí abajo. Si el tuyo no, escríbeme y te respondo por correo.",
	quickFixes: "Soluciones rápidas",
	newToPack: "¿Recién la instalas?",
	installLink: "Mira cómo enviar tu primer sticker",
	troubleshooting: [
		[
			"No encuentro los stickers en Mensajes",
			"Abre una conversación, toca + junto al campo de texto y luego Stickers. Tus packs de stickers aparecen en el panel; Malfoid es uno de ellos. Si ves un diseño anterior, busca la fila de íconos de la App Store sobre el teclado.",
		],
		[
			"El pack no aparece en la lista",
			"Asegúrate de que Malfoid Stickers esté instalada en este dispositivo: abre la App Store, búscala y comprueba que diga Abrir en lugar de Obtener. Un pack instalado en tu iPhone no está en tu iPad hasta que lo instales ahí también.",
		],
		[
			"Los stickers se ven como un cuadro en blanco o no cargan",
			"Cierra Mensajes y vuelve a abrirla. Si no se soluciona, reinicia tu dispositivo. Las ilustraciones vienen dentro de la app, así que los stickers no necesitan conexión para aparecer.",
		],
		[
			"Un sticker no se pega sobre un mensaje",
			"Mantén presionado el sticker hasta que se levante, arrástralo sobre el mensaje y suéltalo. Un toque rápido lo envía como un mensaje aparte.",
		],
		[
			"Quiero quitar el pack",
			"Elimina Malfoid Stickers como cualquier otra app. No guarda nada sobre ti, así que no queda nada más por borrar.",
		],
	],
	formTitle: "¿Sigues con problemas? Escríbeme",
	sent: "Tu solicitud de soporte se envió. Te responderé al correo electrónico que indicaste.",
	sendAnother: "Enviar otra solicitud",
	failed: "No pude enviar tu solicitud. Tu mensaje se conservó; por favor, inténtalo de nuevo.",
	rateLimited:
		"Enviaste varias solicitudes en poco tiempo. Tu mensaje se conservó; por favor, espera un minuto e inténtalo de nuevo.",
	resubmit:
		"Este formulario venció antes de enviarse. Tu mensaje se conservó; por favor, envíalo de nuevo.",
	invalid: "Por favor, corrige los campos marcados y vuelve a enviar tu solicitud.",
	name: "Nombre (opcional)",
	email: "Correo electrónico",
	topic: "Tema",
	chooseTopic: "Elige un tema",
	device: "Dispositivo",
	chooseDevice: "Elige un dispositivo",
	osVersion: "Versión de iOS o iPadOS (opcional)",
	osPlaceholder: "p. ej. iOS 26.1",
	appVersion: "Versión de la app (opcional)",
	appPlaceholder: "p. ej. 1.0",
	message: "Mensaje",
	messagePlaceholder: "Describe tu pregunta, problema o idea de sticker…",
	notice:
		"Este formulario es parte del sitio, no de la app. Usaré lo que envíes para responderte, investigar el problema que informes y mejorar el pack. Por favor, no incluyas contraseñas, datos de pago ni otra información sensible. Lee la",
	privacyLink: "Política de privacidad",
	submit: "Enviar solicitud de soporte",
	pending: "Enviando…",
	topics: {
		"Stickers not showing": "Los stickers no aparecen",
		"Bug report": "Reportar un error",
		Question: "Pregunta",
		"Sticker idea": "Idea de sticker",
		Other: "Otro",
	},
	platforms: { iPhone: "iPhone", iPad: "iPad", Other: "Otro" },
};

/** The support page in each language it is written in. */
export const SUPPORT_COPY: Record<PageLocale, SupportCopy> = {
	en: SUPPORT_EN,
	"es-AR": SUPPORT_ES,
};

/** The privacy page's surrounding lines in each language. */
export const PRIVACY_COPY: Record<PageLocale, PrivacyCopy> = {
	en: {
		forLine: "For the iMessage sticker pack on iPhone and iPad.",
		viewMarkdown: "View as Markdown",
	},
	"es-AR": {
		forLine: "Para el pack de stickers de iMessage en iPhone y iPad.",
		viewMarkdown: "Ver como Markdown",
	},
};
