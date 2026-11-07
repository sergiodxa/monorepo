/**
 * The words Wakaba's privacy and support pages print, in English and Spanish, apart from the
 * policy itself, which lives in its own Markdown file per language. Topic and device values
 * stay the English ones the form posts; only their labels change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	WAKABA_SUPPORT_PLATFORMS,
	WAKABA_SUPPORT_TOPICS,
} from "~/app/http/validators/wakaba-support";
import type { PageLocale } from "~/app/services/page-locale";

/** Everything the privacy and support pages print around their content, in one language. */
export interface WakabaPagesCopy {
	privacy: { forLine: string; viewMarkdown: string };
	support: {
		title: string;
		description: string;
		intro: [string, string];
		formTitle: string;
		sent: string;
		sendAnother: string;
		failed: string;
		rateLimited: string;
		resubmit: string;
		invalid: string;
		name: string;
		email: string;
		topic: string;
		chooseTopic: string;
		device: string;
		chooseDevice: string;
		osVersion: string;
		osPlaceholder: string;
		appVersion: string;
		appPlaceholder: string;
		message: string;
		messagePlaceholder: string;
		notice: string;
		privacyLink: string;
		submit: string;
		pending: string;
		topics: Record<(typeof WAKABA_SUPPORT_TOPICS)[number], string>;
		platforms: Record<(typeof WAKABA_SUPPORT_PLATFORMS)[number], string>;
	};
}

/** The pages in English. */
const EN: WakabaPagesCopy = {
	privacy: { forLine: "For Wakaba on iPhone and iPad.", viewMarkdown: "View as Markdown" },
	support: {
		title: "Wakaba Support",
		description:
			"Get help with Wakaba, the Japanese vocabulary app for iPhone and iPad. Report a problem, ask a question, suggest a feature or correct a word.",
		intro: [
			"Found a bug, a word that looks wrong, or an idea for Wakaba? Write to me here and I’ll reply by email.",
			"If something isn’t working, tell me which device you’re using, what happened and what you expected. Your iOS or iPadOS version and the app version help too, if you know them.",
		],
		formTitle: "Send a request",
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
		device: "Device/platform",
		chooseDevice: "Choose a device",
		osVersion: "OS version (optional)",
		osPlaceholder: "e.g. iOS 26.1",
		appVersion: "App version (optional)",
		appPlaceholder: "e.g. 1.0",
		message: "Message",
		messagePlaceholder: "Describe your question, problem, or suggestion…",
		notice:
			"I’ll use the information you submit to respond to your request and investigate any reported issue. Please don’t include passwords, payment details, or other sensitive information. Read our",
		privacyLink: "Privacy Policy",
		submit: "Send support request",
		pending: "Sending…",
		topics: {
			"Bug report": "Bug report",
			Question: "Question",
			"Feature request": "Feature request",
			"Vocabulary correction": "Vocabulary correction",
			Other: "Other",
		},
		platforms: { iPhone: "iPhone", iPad: "iPad", Other: "Other" },
	},
};

/** The pages in Spanish. */
const ES: WakabaPagesCopy = {
	privacy: { forLine: "Para Wakaba en iPhone y iPad.", viewMarkdown: "Ver como Markdown" },
	support: {
		title: "Soporte de Wakaba",
		description:
			"Obtén ayuda con Wakaba, la app de vocabulario japonés para iPhone y iPad. Informa un problema, haz una pregunta, sugiere una función o corrige una palabra.",
		intro: [
			"¿Encontraste un error, una palabra que parece incorrecta o tienes una idea para Wakaba? Escríbeme aquí y te responderé por correo electrónico.",
			"Si algo no funciona, cuéntame qué dispositivo usas, qué pasó y qué esperabas. Tu versión de iOS o iPadOS y la versión de la app también ayudan, si las sabes.",
		],
		formTitle: "Envía una solicitud",
		sent: "Tu solicitud de soporte se envió. Te responderé a la dirección de correo que indicaste.",
		sendAnother: "Enviar otra solicitud",
		failed: "No pude enviar tu solicitud. Tu mensaje se conservó; vuelve a intentarlo.",
		rateLimited:
			"Enviaste varias solicitudes en poco tiempo. Tu mensaje se conservó; espera un minuto y vuelve a intentarlo.",
		resubmit:
			"Este formulario venció antes de enviarse. Tu mensaje se conservó; vuelve a enviarlo.",
		invalid: "Corrige los campos marcados y vuelve a enviar tu solicitud.",
		name: "Nombre (opcional)",
		email: "Correo electrónico",
		topic: "Tema",
		chooseTopic: "Elige un tema",
		device: "Dispositivo",
		chooseDevice: "Elige un dispositivo",
		osVersion: "Versión del sistema (opcional)",
		osPlaceholder: "p. ej., iOS 26.1",
		appVersion: "Versión de la app (opcional)",
		appPlaceholder: "p. ej., 1.0",
		message: "Mensaje",
		messagePlaceholder: "Describe tu pregunta, problema o sugerencia…",
		notice:
			"Usaré la información que envíes para responder tu solicitud e investigar los problemas que informes. Por favor, no incluyas contraseñas, datos de pago ni otra información sensible. Lee nuestra",
		privacyLink: "Política de privacidad",
		submit: "Enviar solicitud de soporte",
		pending: "Enviando…",
		topics: {
			"Bug report": "Informe de error",
			Question: "Pregunta",
			"Feature request": "Sugerencia de función",
			"Vocabulary correction": "Corrección de vocabulario",
			Other: "Otro",
		},
		platforms: { iPhone: "iPhone", iPad: "iPad", Other: "Otro" },
	},
};

/** The privacy and support pages in each language they are written in. */
export const WAKABA_PAGES_COPY: Record<PageLocale, WakabaPagesCopy> = { en: EN, "es-AR": ES };

/**
 * A Wakaba page's address in a language, keeping a Spanish reader on Spanish pages when they
 * chose it with `?lang=` rather than through their browser.
 *
 * @param href The page's path.
 * @param locale The language the reader is on.
 * @returns The path, with `?lang=` for any language but English.
 */
export function inLanguage(href: string, locale: PageLocale): string {
	return locale === "en" ? href : `${href}?lang=${locale}`;
}
