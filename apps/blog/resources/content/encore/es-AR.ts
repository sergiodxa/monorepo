/**
 * Encore's pages in Argentine Spanish, with voseo as the app speaks it. Card titles and
 * prompts, hints and labels are the app's own es-AR strings, so the page shows exactly what a
 * player reads on the card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EncoreCopy, EncorePagesCopy } from "~/resources/content/encore/copy";

/** The landing, header and footer in Argentine Spanish. */
export const ES: EncoreCopy = {
	locale: "es-AR",
	badge: "es-mx",
	languageName: "Español",
	meta: {
		title: "Encore: un juego musical para fiestas en iPhone, iPad, Apple Watch y Mac",
		description:
			"Sacá una carta, revelá un desafío y cantá una canción que encaje. 108 desafíos escritos a mano, en español, inglés y japonés, por un único pago de US$4,99.",
	},
	header: { support: "Soporte", privacy: "Privacidad", navLabel: "Encore" },
	footer: {
		tagline: "Una canción conocida. Un momento compartido.",
		columns: { encore: "Encore", more: "Más de Sergio", elsewhere: "En otros lados" },
		download: "Descargar",
		blog: "Blog",
		madeBy: "Hecho por",
		languages: "Idioma",
	},
	appStore: "Descargalo en el App Store",
	hero: {
		eyebrow: "Un juego musical para fiestas en iPhone, iPad, Apple Watch y Mac",
		title: "Tu próxima noche empieza con una canción.",
		description:
			"Sacá una carta, revelá el desafío y cantá una canción que encaje. Encore reparte 108 desafíos escritos a mano, de placeres culposos a dúos con un desconocido, y evita repetir lo que acaban de cantar.",
		tour: "Cómo se juega una ronda",
		note: "US$4,99, un solo pago. Sin suscripción, sin publicidad, con todas las cartas.",
	},
	tour: {
		eyebrow: "Cómo se juega una ronda",
		title: "Sacá una carta. Que se convierta en un karaoke.",
		description:
			"La carta es todo el juego: sin menús, sin jugadores que cargar, sin puntajes. Tocá, cantá, deslizá.",
		stageLabel: "Los cuatro movimientos de una ronda",
		steps: [
			{
				title: "Tocá para revelar",
				body: "Una carta boca abajo espera en el medio de la mesa. Tocala y se da vuelta.",
			},
			{
				title: "Cantá el desafío",
				body: "Leelo en voz alta y elegí una canción que encaje. El primero que tenga una agarra el micrófono.",
			},
			{
				title: "Deslizá cuando terminen",
				body: "Sacá la carta de un toque y el siguiente desafío ya está boca arriba detrás.",
			},
			{
				title: "Agitá para mezclar",
				body: "Agitá el teléfono para un mazo nuevo, otra vez boca abajo. Con un teclado, apretá Comando-R.",
			},
		],
	},
	deck: {
		eyebrow: "El mazo",
		title: "108 desafíos escritos a mano",
		description:
			"Cada carta pide una canción que solo tu grupo puede elegir: una sobre vos, una sobre la gente que te rodea, una sobre el título. Encore las mezcla para que el mismo clima no se repita dos veces seguidas, y agitando el teléfono repartís un mazo nuevo cuando quieras.",
		listLabel: "Cartas del mazo",
		generated: "Desafío combinado",
	},
	cards: {
		a001: {
			title: "PLACER CULPOSO",
			prompt: "Cantá una canción que te da un poco de vergüenza admitir que te encanta.",
		},
		a002: {
			title: "PERSONAJE PRINCIPAL",
			prompt: "Cantá la canción que sonaría en tu gran escena si tu vida fuera una película.",
		},
		a060: {
			title: "DÚO CON UN DESCONOCIDO",
			prompt: "Elegí a alguien con quien nunca hayas cantado antes. Canten un dúo—ahora mismo.",
		},
		a100: {
			title: "ENCORE",
			prompt: "Te lo ganaste. Cantá lo que quieras. Sin reglas, sin restricciones.",
		},
		generated: { prompt: "Cantá una canción nostálgica de los años 90." },
	},
	watch: {
		eyebrow: "Apple Watch",
		title: "Llevá la noche desde la muñeca",
		description:
			"Dejá el teléfono en la mesa, donde todos lo puedan leer. El Watch muestra la carta y la revela, reparte o mezcla en el iPhone.",
		items: [
			"“Carta lista” y después el desafío, en tu muñeca",
			"Revelar, Siguiente y Mezclar, con un toque que se siente",
			"Se conecta solo con tu iPhone: no hay que iniciar sesión en nada",
			"Es un control remoto del juego en tu iPhone, que sigue abierto cerca",
		],
	},
	details: {
		eyebrow: "Los detalles",
		title: "Hecho para el lugar donde estás",
		description:
			"Encore se adapta a la pantalla que tengas, habla tu idioma y no hace ruido hasta que se lo pidas.",
		items: {
			mac: {
				title: "En una Mac",
				body: "La app de iPad también funciona en las Mac con Apple silicon, y con un teclado Comando-R mezcla el mazo.",
			},
			ipad: {
				title: "En un iPad",
				body: "En cualquier orientación, para que el iPad quede parado en el medio de la mesa.",
			},
			languages: {
				title: "En tu idioma",
				body: "Cada carta, escrita en inglés, español, español rioplatense y japonés.",
			},
			undo: {
				title: "¿Deslizaste antes de tiempo?",
				body: "Deshacer trae de vuelta la última carta, hasta la próxima mezcla.",
			},
			feedback: {
				title: "Sonido y vibración",
				body: "Apagados hasta que los actives en Ajustes. Los sonidos callan cuando tu teléfono está en silencio.",
			},
			access: {
				title: "Para todos en la mesa",
				body: "VoiceOver lee cada carta en voz alta, y con Reducir movimiento la carta aparece en vez de darse vuelta.",
			},
		},
		app: {
			game: "Juego",
			shuffleDeck: "Mezclar mazo",
			previousCard: "Carta anterior",
			feedback: "Respuesta táctil y sonido",
			haptics: "Vibración",
			sounds: "Efectos de sonido",
			faceDown: "Carta boca abajo. Toca para revelar.",
		},
	},
	privacy: {
		eyebrow: "Privacidad",
		title: "Nadie está escuchando",
		description:
			"Encore nunca abre el micrófono. Lo que cantás queda en la sala, y el juego no guarda nada de eso.",
		checks: [
			"Sin cuenta ni inicio de sesión",
			"Sin micrófono, grabación ni reconocimiento de voz",
			"Sin publicidad, analíticas ni rastreo",
			"Todas las cartas están en la app y funcionan sin conexión",
			"Tu iPhone y tu Apple Watch hablan entre ellos, y con nadie más",
		],
		policy: "Leé la política de privacidad",
	},
	faq: {
		eyebrow: "Preguntas",
		title: "Antes de la primera canción",
		columns: [
			[
				[
					"¿Encore pone la música?",
					"No. Encore reparte el desafío y ustedes ponen la canción: una pista de karaoke, un parlante, una guitarra o nada más que la voz.",
				],
				[
					"¿Cuántas personas pueden jugar?",
					"Todas las que puedan leer una pantalla. No hay jugadores que cargar, ni turnos ni puntaje, así que cualquiera puede agarrar una carta.",
				],
				[
					"¿Necesito conexión a internet?",
					"No. Todas las cartas vienen en la app, así que funciona igual en un tren, en una cabaña o en un sótano.",
				],
				[
					"¿Es apta para chicos?",
					"Sí. Tiene clasificación 4+ en el App Store, y cada carta solo pide una canción.",
				],
				[
					"¿Vamos a ver las mismas cartas otra vez?",
					"No hasta que salgan las 108 cartas escritas a mano. Después, unos pocos desafíos combinados llevan a una vuelta nueva, y agitando el teléfono mezclás un mazo nuevo cuando quieras.",
				],
			],
			[
				[
					"¿En qué idiomas está?",
					"Inglés, español, español rioplatense y japonés. Encore sigue el idioma de tu dispositivo.",
				],
				[
					"¿El Apple Watch funciona solo?",
					"Es un control remoto del juego en tu iPhone: muestra la carta y la revela, reparte y mezcla mientras Encore está abierto en el iPhone cerca.",
				],
				[
					"¿Cuánto cuesta?",
					"US$4,99 un solo pago en el App Store, o el equivalente en tu país. Sin suscripción, sin compras dentro de la app y sin publicidad.",
				],
				[
					"¿Se puede compartir con la familia?",
					"Sí. Encore es compatible con En familia, así que todos en tu grupo familiar la pueden descargar con una sola compra.",
				],
				[
					"¿Puedo activar sonidos o vibración?",
					"Sí. Los dos empiezan apagados; activalos en la app Ajustes, en Encore.",
				],
			],
		],
	},
	closing: {
		title: "Que sigan las canciones.",
		description: "Juntá a todos: una canción conocida, un momento compartido.",
		support: "¿Necesitás ayuda? Visitá soporte",
	},
	screens: {
		"card-back": "Una carta boca abajo con la pista “Toca para revelar”",
		challenge: "Una carta revelada con un desafío escrito a mano",
		swipe: "Una carta deslizada a un costado, con el siguiente desafío detrás",
		shuffle: "Una carta nueva boca abajo después de agitar, con el mazo abierto",
		generated: "Un desafío combinado, sin título",
		"watch-ready": "Apple Watch con “Carta lista”, Revelar y Mezclar",
		"watch-challenge": "Apple Watch con un desafío, Siguiente y Mezclar",
	},
	placeholder: "Captura pendiente",
};

/** The privacy and support pages in Argentine Spanish. */
export const ES_PAGES: EncorePagesCopy = {
	privacy: {
		forLine: "Para Encore en iPhone, iPad, Apple Watch y Mac.",
		viewMarkdown: "Ver como Markdown",
	},
	support: {
		title: "Soporte de Encore",
		description:
			"Conseguí ayuda con Encore: Music Party Game para iPhone, iPad, Apple Watch y Mac. Reportá un problema, hacé una pregunta o sugerí una función.",
		intro: [
			"¿Tenés una pregunta, encontraste un error o tenés una idea para Encore? Escribinos con el formulario de abajo.",
			"Si algo no funciona, contanos qué dispositivo usás, qué pasó y qué esperabas. Sumá los pasos para reproducir el problema y las versiones del sistema y de la app, si las sabés.",
		],
		formTitle: "Formulario de soporte",
		sent: "Tu solicitud de soporte se envió. Te vamos a responder al correo que nos dejaste.",
		sendAnother: "Enviar otra solicitud",
		failed: "No pudimos enviar tu solicitud. Tu mensaje quedó guardado—probá de nuevo.",
		rateLimited:
			"Enviaste varias solicitudes en poco tiempo. Tu mensaje quedó guardado—esperá un minuto y probá de nuevo.",
		resubmit:
			"Este formulario venció antes de enviarse. Tu mensaje quedó guardado—envialo de nuevo.",
		invalid: "Corregí los campos marcados y enviá tu solicitud de nuevo.",
		name: "Nombre (opcional)",
		email: "Correo electrónico",
		topic: "Tema",
		chooseTopic: "Elegí un tema",
		device: "Dispositivo",
		chooseDevice: "Elegí un dispositivo",
		osVersion: "Versión del sistema (opcional)",
		osPlaceholder: "p. ej., iOS 26.1",
		appVersion: "Versión de la app (opcional)",
		appPlaceholder: "p. ej., 1.2",
		message: "Mensaje",
		messagePlaceholder: "Contanos tu pregunta, problema o sugerencia…",
		notice:
			"Vamos a usar la información que envíes para responder tu solicitud e investigar los problemas que nos cuentes. No incluyas contraseñas, datos de pago ni otra información sensible. Leé nuestra",
		privacyLink: "Política de privacidad",
		submit: "Enviar solicitud de soporte",
		pending: "Enviando…",
		topics: {
			"Bug report": "Reporte de error",
			Question: "Pregunta",
			"Feature request": "Sugerencia de función",
			Other: "Otro",
		},
		platforms: {
			iPhone: "iPhone",
			iPad: "iPad",
			"Apple Watch": "Apple Watch",
			Mac: "Mac",
			Other: "Otro",
		},
	},
};
