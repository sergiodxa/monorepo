/**
 * Every word Malfoid Stickers' landing and its shell print, one object per language, so the
 * English and Spanish pages render from the same components and a missing translation fails
 * the type check instead of reaching a reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PageLocale } from "~/app/services/page-locale";
import type { StickerCategory, StickerId } from "~/resources/content/malfoid/stickers";

/** A title and the sentence under it. */
export interface CopyItem {
	title: string;
	body: string;
}

/** A mood's name and its one-line introduction. */
export interface MoodCopy {
	name: string;
	body: string;
}

/** The landing and its shell in one language. */
export interface LandingCopy {
	locale: PageLocale;
	/** The page's title and description, and the alt text of each page's social card. */
	meta: {
		title: string;
		description: string;
		socialCardAlt: string;
		privacyCardAlt: string;
		supportCardAlt: string;
	};
	/** The shell's words: the header's links and the footer's columns. */
	chrome: {
		navLabel: string;
		support: string;
		privacy: string;
		download: string;
		moreFrom: string;
		elsewhere: string;
		blog: string;
		tagline: string;
		madeBy: string;
	};
	appStore: { available: string; soon: string };
	privacyLine: string;
	hero: {
		eyebrow: string;
		title: string;
		/** The title on a phone, where the full one would take four lines. */
		shortTitle: string;
		description: string;
		seeAll: string;
	};
	meet: {
		eyebrow: string;
		title: string;
		body: [string, string];
		conversation: [string, string];
		caption: string;
	};
	moods: { eyebrow: string; title: string; description: string; seeAll: string };
	moodNames: Record<StickerCategory, MoodCopy>;
	gallery: {
		eyebrow: string;
		title: string;
		description: string;
		/** The viewer's name, read when it opens. */
		viewer: string;
		/** A tile's label, naming what opens. */
		open: (alt: string) => string;
		/** A slide's description for a reader who cannot see the conversation. */
		reply: (prompt: string, alt: string) => string;
		labels: { close: string; previous: string; next: string };
	};
	details: [CopyItem, CopyItem, CopyItem];
	privacy: { eyebrow: string; title: string; extra: string; link: string; facts: string[] };
	install: {
		eyebrow: string;
		title: string;
		lead: string;
		helpLink: string;
		steps: [CopyItem, CopyItem, CopyItem, CopyItem];
	};
	faq: { eyebrow: string; title: string; questions: Array<[string, string]> };
	closing: { title: string; description: string; support: string };
}

/** The sticker that stands for each mood on its card. */
export const MOOD_COVERS: Record<StickerCategory, StickerId> = {
	"pride-and-sarcasm": "superior-look",
	"anger-and-frustration": "angry-pout",
	"tsundere-and-embarrassment": "pretending-not-to-care",
	"happiness-and-affection": "sparkling-eyes",
	"sadness-and-exhaustion": "dramatic-crying",
	"everyday-reactions": "eating-popcorn",
};

/** The landing in English. */
const EN: LandingCopy = {
	locale: "en",
	meta: {
		title: "Malfoid Stickers: Cute & Sassy Reactions for iMessage",
		description:
			"Meet Malfoid, your favorite grumpy blonde with an attitude: 60 free, textless iMessage stickers for iPhone and iPad. No ads, no subscriptions, no data collection.",
		socialCardAlt:
			"Malfoid Stickers, Cute & Sassy Reactions: three stickers of Malfoid smiling smugly, crying dramatically and hugging a pink heart.",
		privacyCardAlt:
			"Malfoid Stickers Privacy Policy: the app collects no data. Malfoid looks suspicious, covers her face and points at you.",
		supportCardAlt:
			"Malfoid Stickers Support, for questions, bugs and sticker ideas: Malfoid thinks it over, waves hello and gives a thumbs-up.",
	},
	chrome: {
		navLabel: "Malfoid Stickers",
		support: "Support",
		privacy: "Privacy",
		download: "Download",
		moreFrom: "More from Sergio",
		elsewhere: "Elsewhere",
		blog: "Blog",
		tagline: "Cute & sassy reactions for iMessage. Free, with no ads and no data collection.",
		madeBy: "Made by",
	},
	appStore: { available: "Download on the App Store", soon: "Coming soon to the" },
	privacyLine: "Completely free. No ads. No subscriptions. No data collection. Just Malfoid.",
	hero: {
		eyebrow: "iMessage stickers for iPhone and iPad",
		title: "A little cute. A little dramatic. A lot of attitude.",
		shortTitle: "Cute. Dramatic. All attitude.",
		description:
			"Meet Malfoid, your favorite grumpy blonde with an attitude. Express yourself with 60 adorable, sarcastic, dramatic, and unapologetically sassy stickers.",
		seeAll: "See all 60",
	},
	meet: {
		eyebrow: "Meet Malfoid",
		title: "Composed. Superior. Blushing anyway.",
		body: [
			"Platinum hair, silver eyes, snake hairpin. Proud, sarcastic and determined to look composed.",
			"Her feelings have other plans.",
		],
		conversation: ["I ate the last slice of your cake.", "…I’ll bake you a whole new one?"],
		caption: "An example conversation. Every reply is a Malfoid sticker.",
	},
	moods: {
		eyebrow: "Six moods, ten stickers each",
		title: "For every mood—even the ones you’re pretending not to have.",
		description: "Pride, rage, embarrassment, joy, despair and the everyday in between.",
		seeAll: "See all 10",
	},
	moodNames: {
		"pride-and-sarcasm": {
			name: "Pride & sarcasm",
			body: "Chin up, eyes rolled, applause entirely insincere. For when you’re right and everyone should know it.",
		},
		"anger-and-frustration": {
			name: "Anger & frustration",
			body: "Pouts, stomps, death stares and the occasional full tantrum. Cheaper than yelling.",
		},
		"tsundere-and-embarrassment": {
			name: "Embarrassment & tsundere",
			body: "Blushing, looking away and absolutely not caring. She’ll offer you a heart. Don’t make it weird.",
		},
		"happiness-and-affection": {
			name: "Happiness & affection",
			body: "Real smiles, sparkling eyes, hugs and blown kisses: proof the attitude is mostly for show.",
		},
		"sadness-and-exhaustion": {
			name: "Sadness & exhaustion",
			body: "Dramatic tears, a tiny pout, and hiding under the blanket until further notice.",
		},
		"everyday-reactions": {
			name: "Everyday reactions",
			body: "Hello, goodbye, hmm, popcorn, tea. The small replies that keep a conversation going.",
		},
	},
	gallery: {
		eyebrow: "The whole pack",
		title: "Every last one of her",
		description:
			"All 60 stickers, exactly as they appear in Messages. Tap one to see it up close, answering a friend.",
		viewer: "Malfoid stickers",
		open: (alt) => `Open sticker: ${alt}`,
		reply: (prompt, alt) => `A friend writes “${prompt}” and the reply is a sticker: ${alt}`,
		labels: { close: "Close", previous: "Previous sticker", next: "Next sticker" },
	},
	details: [
		{
			title: "Speaks every language",
			body: "No text on any sticker, so every reaction lands wherever your friends are.",
		},
		{
			title: "Works offline",
			body: "All the artwork ships inside the app. Nothing to download later.",
		},
		{
			title: "iPhone and iPad",
			body: "A native iMessage sticker pack that lives right inside Messages.",
		},
	],
	privacy: {
		eyebrow: "Privacy",
		title: "She isn’t interested in your data.",
		extra: "The app collects nothing at all.",
		link: "Read the privacy policy",
		facts: [
			"Completely free: no ads, subscriptions or in-app purchases.",
			"No account, no sign-in, nothing to set up.",
			"No analytics, no tracking and no data collection.",
			"No access to your conversations, contacts, photos, camera, microphone or location.",
			"All 60 stickers are bundled in the app and load offline.",
		],
	},
	install: {
		eyebrow: "Getting started",
		title: "From the App Store to the group chat",
		lead: "No setup, no account. Can’t find her?",
		helpLink: "The support page can help",
		steps: [
			{
				title: "Get the pack",
				body: "Install Malfoid Stickers from the App Store on your iPhone or iPad.",
			},
			{ title: "Open Messages", body: "Start or open any iMessage conversation." },
			{
				title: "Find her",
				body: "Tap + beside the text field, then Stickers, and choose Malfoid from the packs.",
			},
			{
				title: "React",
				body: "Tap a sticker to send it, or touch and hold it, then drag it onto a message bubble.",
			},
		],
	},
	faq: {
		eyebrow: "Questions",
		title: "Before you ask",
		questions: [
			[
				"How much does it cost?",
				"Nothing. Malfoid Stickers is completely free, with no ads, subscriptions or in-app purchases.",
			],
			[
				"Does it collect any data?",
				"No. The app has no account, analytics or tracking, collects no data, and never accesses your conversations, contacts, photos, camera, microphone or location.",
			],
			[
				"Does it work offline?",
				"Yes. Every sticker is bundled with the app, so the pack opens without a connection. Messages still needs one to deliver what you send.",
			],
			[
				"Which languages does it support?",
				"All of them. The stickers have no text, so a pout or an eye roll means the same thing in every language.",
			],
			[
				"Does it work on iPad?",
				"Yes. Malfoid Stickers is a native iMessage sticker pack for iPhone and iPad.",
			],
			[
				"I installed it, but I can’t find it.",
				"In Messages, tap + beside the text field, then Stickers, and look for Malfoid among your packs. The support page has more troubleshooting steps.",
			],
		],
	},
	closing: {
		title: "Let her into your group chat.",
		description: "Free on iPhone and iPad. She’ll pretend she doesn’t care.",
		support: "Need help? Visit support",
	},
};

/** The landing in Spanish. */
const ES: LandingCopy = {
	locale: "es-AR",
	meta: {
		title: "Malfoid Stickers: reacciones tiernas y atrevidas para iMessage",
		description:
			"Conoce a Malfoid, tu rubia gruñona favorita con mucha actitud: 60 stickers gratis y sin texto para iMessage en iPhone y iPad. Sin anuncios, sin suscripciones, sin recopilar datos.",
		socialCardAlt:
			"Malfoid Stickers, reacciones tiernas y atrevidas: tres stickers de Malfoid sonriendo con superioridad, llorando con drama y abrazando un corazón rosa.",
		privacyCardAlt:
			"Política de privacidad de Malfoid Stickers: la app no recopila datos. Malfoid mira con sospecha, se tapa la cara y te señala.",
		supportCardAlt:
			"Soporte de Malfoid Stickers, para dudas, errores e ideas de stickers: Malfoid se queda pensando, saluda y levanta el pulgar.",
	},
	chrome: {
		navLabel: "Malfoid Stickers",
		support: "Soporte",
		privacy: "Privacidad",
		download: "Descargar",
		moreFrom: "Más de Sergio",
		elsewhere: "En otros sitios",
		blog: "Blog",
		tagline:
			"Reacciones tiernas y atrevidas para iMessage. Gratis, sin anuncios y sin recopilar datos.",
		madeBy: "Hecho por",
	},
	appStore: { available: "Descárgala en la App Store", soon: "Muy pronto en la" },
	privacyLine:
		"Completamente gratis. Sin anuncios. Sin suscripciones. Sin recopilar datos. Solo Malfoid.",
	hero: {
		eyebrow: "Stickers de iMessage para iPhone y iPad",
		title: "Un poco tierna. Un poco dramática. Mucha actitud.",
		shortTitle: "Tierna. Dramática. Con actitud.",
		description:
			"Conoce a Malfoid, tu rubia gruñona favorita con mucha actitud. Exprésate con 60 stickers adorables, sarcásticos, dramáticos y descaradamente atrevidos.",
		seeAll: "Ver los 60",
	},
	meet: {
		eyebrow: "Conoce a Malfoid",
		title: "Serena. Superior. Sonrojada igual.",
		body: [
			"Pelo platinado, ojos plateados, horquilla de serpiente. Orgullosa, sarcástica y decidida a parecer serena.",
			"Sus sentimientos tienen otros planes.",
		],
		conversation: ["Me comí la última porción de tu torta.", "…¿Te hago una torta nueva entera?"],
		caption: "Una conversación de ejemplo. Cada respuesta es un sticker de Malfoid.",
	},
	moods: {
		eyebrow: "Seis estados de ánimo, diez stickers cada uno",
		title: "Para cada estado de ánimo, incluso los que finges no tener.",
		description: "Orgullo, furia, vergüenza, alegría, desánimo y todo lo cotidiano entre medio.",
		seeAll: "Ver los 10",
	},
	moodNames: {
		"pride-and-sarcasm": {
			name: "Orgullo y sarcasmo",
			body: "Mentón en alto, ojos en blanco, aplausos nada sinceros. Para cuando tienes razón y todos deben saberlo.",
		},
		"anger-and-frustration": {
			name: "Enojo y frustración",
			body: "Pucheros, pisotones, miradas asesinas y algún berrinche completo. Más barato que gritar.",
		},
		"tsundere-and-embarrassment": {
			name: "Vergüenza y tsundere",
			body: "Se sonroja, mira para otro lado y no le importa en absoluto. Te dará un corazón. No lo hagas raro.",
		},
		"happiness-and-affection": {
			name: "Alegría y cariño",
			body: "Sonrisas sinceras, ojos brillantes, abrazos y besos al aire: la prueba de que la actitud es casi pura pose.",
		},
		"sadness-and-exhaustion": {
			name: "Tristeza y cansancio",
			body: "Lágrimas dramáticas, un puchero chiquito y escondida bajo la manta hasta nuevo aviso.",
		},
		"everyday-reactions": {
			name: "Reacciones cotidianas",
			body: "Hola, chau, mmm, palomitas, té. Las pequeñas respuestas que mantienen viva una conversación.",
		},
	},
	gallery: {
		eyebrow: "El pack completo",
		title: "Todas y cada una de ella",
		description:
			"Los 60 stickers, tal como aparecen en Mensajes. Toca uno para verlo de cerca, respondiéndole a alguien.",
		viewer: "Stickers de Malfoid",
		open: (alt) => `Abrir sticker: ${alt}`,
		reply: (prompt, alt) => `Alguien escribe «${prompt}» y la respuesta es un sticker: ${alt}`,
		labels: { close: "Cerrar", previous: "Sticker anterior", next: "Sticker siguiente" },
	},
	details: [
		{
			title: "Habla todos los idiomas",
			body: "Ningún sticker tiene texto, así que cada reacción se entiende estén donde estén tus amigos.",
		},
		{
			title: "Funciona sin conexión",
			body: "Todas las ilustraciones vienen dentro de la app. No hay nada que descargar después.",
		},
		{
			title: "iPhone y iPad",
			body: "Un pack de stickers nativo de iMessage que vive dentro de Mensajes.",
		},
	],
	privacy: {
		eyebrow: "Privacidad",
		title: "Tus datos no le interesan.",
		extra: "La app no recopila absolutamente nada.",
		link: "Lee la política de privacidad",
		facts: [
			"Completamente gratis: sin anuncios, suscripciones ni compras dentro de la app.",
			"Sin cuenta, sin inicio de sesión, nada que configurar.",
			"Sin analíticas, sin rastreo y sin recopilar datos.",
			"Sin acceso a tus conversaciones, contactos, fotos, cámara, micrófono ni ubicación.",
			"Los 60 stickers vienen incluidos en la app y cargan sin conexión.",
		],
	},
	install: {
		eyebrow: "Primeros pasos",
		title: "De la App Store al chat del grupo",
		lead: "Sin configuración, sin cuenta. ¿No la encuentras?",
		helpLink: "La página de soporte puede ayudarte",
		steps: [
			{
				title: "Consigue el pack",
				body: "Instala Malfoid Stickers desde la App Store en tu iPhone o iPad.",
			},
			{ title: "Abre Mensajes", body: "Empieza o abre cualquier conversación de iMessage." },
			{
				title: "Encuéntrala",
				body: "Toca + junto al campo de texto, luego Stickers, y elige Malfoid entre los packs.",
			},
			{
				title: "Reacciona",
				body: "Toca un sticker para enviarlo, o mantenlo presionado y arrástralo sobre un mensaje.",
			},
		],
	},
	faq: {
		eyebrow: "Preguntas",
		title: "Antes de que preguntes",
		questions: [
			[
				"¿Cuánto cuesta?",
				"Nada. Malfoid Stickers es completamente gratis, sin anuncios, suscripciones ni compras dentro de la app.",
			],
			[
				"¿Recopila algún dato?",
				"No. La app no tiene cuenta, analíticas ni rastreo, no recopila datos y nunca accede a tus conversaciones, contactos, fotos, cámara, micrófono ni ubicación.",
			],
			[
				"¿Funciona sin conexión?",
				"Sí. Todos los stickers vienen con la app, así que el pack se abre sin conexión. Mensajes igual necesita una para enviar lo que mandes.",
			],
			[
				"¿Qué idiomas admite?",
				"Todos. Los stickers no tienen texto, así que un puchero o unos ojos en blanco significan lo mismo en cualquier idioma.",
			],
			[
				"¿Funciona en iPad?",
				"Sí. Malfoid Stickers es un pack de stickers nativo de iMessage para iPhone y iPad.",
			],
			[
				"La instalé, pero no la encuentro.",
				"En Mensajes, toca + junto al campo de texto, luego Stickers, y busca a Malfoid entre tus packs. La página de soporte tiene más soluciones.",
			],
		],
	},
	closing: {
		title: "Déjala entrar a tu chat del grupo.",
		description: "Gratis en iPhone y iPad. Ella fingirá que no le importa.",
		support: "¿Necesitas ayuda? Visita el soporte",
	},
};

/** The landing in each language it is written in. */
export const LANDING_COPY: Record<PageLocale, LandingCopy> = { en: EN, "es-AR": ES };
