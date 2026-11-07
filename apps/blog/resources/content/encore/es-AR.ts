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
		eyebrow: "El juego de fiesta donde cada carta es una canción",
		title: "Tu próxima noche empieza con una canción.",
		description:
			"Das vuelta una carta, leés el desafío y cantás a los gritos una canción que encaje. 108 desafíos escritos a mano, de placeres culposos a un dúo con un completo desconocido. Desafinados más que bienvenidos.",
		tour: "Cómo se juega",
		note: "US$4,99, un solo pago. Sin suscripciones, sin publicidad, sin juicios.",
	},
	play: {
		eyebrow: "Te toca",
		title: "Elegí una carta, cualquier carta",
		description:
			"Este es el mazo de verdad: los 108 desafíos escritos a mano. Tocá la carta, leela en voz alta y cantá. Nadie está grabando.",
		draw: "Sacar otra",
		shuffle: "Mezclar",
		sound: "Efectos de sonido",
		left: "Carta {count} de {total}",
	},
	tour: {
		eyebrow: "Cómo se juega",
		title: "Dala vuelta. Cantá. Deslizá. Hasta quedarte sin voz.",
		description:
			"La carta es todo el juego. Sin menús, sin equipos que armar, sin tabla de puntos por la que pelearse.",
		stageLabel: "Los cuatro movimientos de una ronda",
		steps: [
			{
				title: "Tocá para revelar",
				body: "Una carta espera boca abajo, puro misterio. Tocala y se da vuelta.",
			},
			{
				title: "Cantala",
				body: "Leé el desafío en voz alta. El primero que tenga una canción agarra el micrófono (o el cepillo).",
			},
			{
				title: "Deslizá para la siguiente",
				body: "Sacá la carta de un toque cuando termine la canción. El próximo desafío ya está boca arriba.",
			},
			{
				title: "Sacudí todo",
				body: "Agitá el teléfono para un mazo nuevo. Con un teclado, Comando-R también lo hace.",
			},
		],
	},
	deck: {
		eyebrow: "El mazo",
		title: "108 desafíos, cada uno un pequeño lío",
		description:
			"Algunos son sobre vos, otros sobre la gente que te rodea, otros sobre el título de la canción. Encore los reparte para que el mismo clima nunca se repita dos veces seguidas. Dale, tocá una.",
		listLabel: "Cartas del mazo",
		generated: "Desafío combinado",
		reveal: "Tocá para revelar",
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
		a011: {
			title: "ESTA LA SABE TODOS",
			prompt:
				"Elegí una canción que creas que absolutamente todos aquí conocen. Todos se unen en el estribillo.",
		},
		a033: {
			title: "VIAJE EN CARRETERA",
			prompt: "Cantá una canción que ponés a todo volumen en el auto con las ventanas bajadas.",
		},
		a045: {
			title: "NOCHEVIEJA",
			prompt:
				"Cantá una canción que pertenece a la medianoche de Año Nuevo—del tipo que hace sentir algo a la gente.",
		},
		a015: {
			title: "CAMPEÓN DEL KARAOKE",
			prompt: "Cantá lo que elegirías para destrozarlo totalmente en el karaoke. Sin reservas.",
		},
		a080: {
			title: "CLÁSICO FESTIVO",
			prompt:
				"Cantá una canción de temporada—la que hace que la sala se sienta festiva al instante.",
		},
		a104: { title: "FAVORITA EXTRANJERA", prompt: "Cantá un éxito de un país que no es el tuyo." },
		generated: { prompt: "Cantá una canción nostálgica de los años 90." },
	},
	watch: {
		eyebrow: "Apple Watch",
		title: "Dirigí el caos desde la muñeca",
		description:
			"Dejá el teléfono en la mesa, donde todos lo puedan leer. Tu Apple Watch da vuelta, reparte y mezcla desde la otra punta del living.",
		items: [
			"“Carta lista” en tu muñeca, y después el desafío",
			"Revelar, Siguiente y Mezclar, con un toquecito que se siente",
			"Se conecta solo con tu iPhone: no hay que iniciar sesión en nada",
			"Funciona mientras Encore está abierto en el iPhone cerca",
		],
	},
	details: {
		eyebrow: "Noche de juegos, en cualquier lado",
		title: "Una carta para cada noche",
		description: "Un bar de karaoke, un viaje en auto o Año Nuevo: hay una carta para eso.",
		items: {
			karaoke: {
				title: "Noche de karaoke",
				body: "¿Sin máquina? No pasa nada. Cualquier parlante, cualquier lugar, cualquier nivel de talento.",
			},
			road: {
				title: "Viaje en auto",
				body: "Todas las cartas viven en la app, así que el juego sigue aunque no haya señal.",
			},
			holiday: {
				title: "Fiesta en casa",
				body: "Apoyá un iPad en el medio de la mesa, o jugá en una Mac cuando están todos en el sillón.",
			},
			abroad: {
				title: "Amigos de otros países",
				body: "Cartas en español, inglés y japonés, en el idioma de tu teléfono.",
			},
			newYear: {
				title: "Año Nuevo",
				body: "Agitá para un mazo nuevo cuando la noche lo pida. Sin preparación, sin puntajes.",
			},
			everyone: {
				title: "Todos cantan",
				body: "Sin turnos ni equipos: el que sabe una canción agarra el micrófono. VoiceOver lee cada carta en voz alta.",
			},
		},
	},
	privacy: {
		eyebrow: "Privacidad",
		title: "Lo que pasa en el karaoke queda en el karaoke",
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
					"¿Hay que cantar bien?",
					"Para nada. Algunas cartas casi te piden que lo hagas mal: SOBREACTÚALO quiere un compromiso dramático y teatral con cada palabra.",
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
		description: "Juntá a tu gente, adueñate de un rincón y da vuelta la primera carta.",
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
