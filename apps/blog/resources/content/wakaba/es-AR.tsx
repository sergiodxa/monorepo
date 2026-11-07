/**
 * Wakaba's landing in Spanish, the language the app itself ships in beside English: every
 * heading, sentence and alt text, describing the Spanish captures the page shows. The app's
 * own tagline leads, "Crece con cada práctica."
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AccentText } from "@sdxc/ui/landing";

import type { WakabaCopy } from "~/resources/content/wakaba/copy";

/** The Spanish page. */
export const ES: WakabaCopy = {
	locale: "es-AR",
	captures: "es",
	meta: {
		title: "Wakaba: vocabulario japonés para iPhone y iPad",
		description:
			"Practica vocabulario japonés unos minutos al día con tarjetas, un camino de diez niveles y cuatro compañeros, mientras un bonsái crece con cada día que practicas. Gratis, sin anuncios, suscripciones ni compras dentro de la app.",
		socialCard: "branding/social-card-es.png",
		socialCardAlt: "Wakaba: Crece con cada práctica. Un bonsái bermellón junto al logo 学.",
	},
	switchLanguage: { label: "English", locale: "en" },
	header: { support: "Soporte", privacy: "Privacidad", navLabel: "Wakaba" },
	footer: {
		tagline: "Crece con cada práctica. Práctica de vocabulario japonés para iPhone y iPad, gratis.",
		columns: { wakaba: "Wakaba", more: "Más de Sergio", elsewhere: "En otros sitios" },
		download: "Descargar",
		blog: "Blog",
		madeBy: "Hecho por",
	},
	appStore: { soon: "Muy pronto en la", available: "Descárgala en la" },
	hero: {
		eyebrow: "Vocabulario japonés para iPhone y iPad",
		title: (
			<>
				Crece con cada <AccentText variant="color">práctica</AccentText>.
			</>
		),
		description: (
			<>
				Para quien ya sabe algo de gramática y quiere que las palabras se queden: más de{" "}
				<strong>1190 palabras y 2100 frases</strong> para leer, escuchar, escribir y decir, unos
				minutos por vez.
			</>
		),
		watch: "Mira crecer el árbol",
		note: "Gratis. Sin anuncios, suscripciones ni compras dentro de la app. En español e inglés.",
		pause: "Pausar las tarjetas flotantes",
		streak: { title: "Racha de 23 días", detail: "Practicaste hoy · 36 palabras" },
		word: { label: "Palabra del día", reading: "ki · máquina" },
	},
	path: {
		eyebrow: "El camino de aprendizaje",
		title: "Diez niveles, unos minutos por vez",
		description: (
			<>
				Cada sesión es corta y el camino siempre muestra la siguiente.{" "}
				<strong>Los kanji y el katakana llegan de a poco</strong>, cuando estás listo.
			</>
		),
		stageLabel: "Cómo avanza una palabra por el camino de aprendizaje",
		steps: [
			{
				title: "Conoce la palabra",
				body: "Cada palabra nueva se presenta, se lee en voz alta y se muestra en todas sus escrituras antes de que nada te la pregunte.",
			},
			{
				title: "Practícala en sesiones cortas",
				body: "Significado, lectura, escritura y comprensión auditiva, y también pronunciación si la activas.",
			},
			{
				title: "Aprueba el examen del nivel",
				body: "Cada uno de los diez niveles termina con un examen antes de que se abra el siguiente.",
			},
			{
				title: "Repasa lo que se escapó",
				body: "La repetición espaciada trae las palabras de vuelta, y Aka Oni te ofrece repasar los errores anteriores.",
			},
		],
	},
	companions: {
		eyebrow: "Compañeros",
		title: "Cuatro amigos, un papel cada uno",
		description:
			"Cuatro personajes del folclore japonés te acompañan, y cada uno aparece por una razón.",
		roles: {
			kitsune: {
				title: "El guía",
				body: "Te señala la sesión recomendada en el camino, estudia contigo y festeja cada acierto.",
				alt: "Kitsune, un zorro con pañuelo rojo, señalando el camino.",
			},
			oni: {
				title: "El que corrige",
				body: "Aparece después de una respuesta incorrecta para explicar la correcta, y te ofrece repasar errores anteriores.",
				alt: "Aka Oni, un oni rojo, sosteniendo una tarjeta con una cruz.",
			},
			tanuki: {
				title: "El que alienta",
				body: "Aplaude el esfuerzo, celebra cada sesión terminada y te ofrece escuchar palabras que ya conoces.",
				alt: "Tanuki con sombrero de paja, aplaudiendo.",
			},
			tengu: {
				title: "El maestro",
				body: "Presenta las actividades nuevas y te ofrece practicar kana desde el camino, leyendo y trazando.",
				alt: "Tengu, un maestro de cara roja con túnica, sosteniendo una hoja.",
			},
		},
	},
	flashcards: {
		eyebrow: "Tarjetas",
		title: "Todas las formas de escribir una palabra, en una tarjeta",
		description: (
			<>
				Recorre el mazo a tu ritmo. <strong>Da vuelta una tarjeta</strong> para ver sus detalles y,
				si es un verbo, sus conjugaciones.
			</>
		),
		items: [
			"Kanji con furigana, hiragana, katakana y romaji",
			"El significado en español o en inglés",
			"Pronunciadas por las voces japonesas de tu dispositivo",
		],
	},
	exercises: {
		eyebrow: "Práctica",
		title: "Una palabra, cinco preguntas",
		description: (
			<>
				Cada sesión mezcla las preguntas, así reconoces una palabra, la recuerdas, la escuchas y la
				usas en una frase. <strong>Los errores vuelven</strong> hasta que dejan de serlo.
			</>
		),
		listLabel: "Los ejercicios de Wakaba",
		items: [
			{
				title: "Escucha y elige",
				body: "Oye la palabra en una voz japonesa y elige su significado.",
			},
			{ title: "Dilo en voz alta", body: "Opcional, y reconocido en tu propio dispositivo." },
			{ title: "Arma la frase", body: "Vuelve a armar una frase real con sus palabras." },
			{ title: "Conjuga el verbo", body: "Lleva たべる a la forma que pide la pregunta." },
			{
				title: "Aprende del error",
				body: "Aka Oni te muestra la respuesta correcta y en qué se diferencia.",
			},
		],
	},
	writing: {
		eyebrow: "Escritura",
		title: "Traza kana con el Apple Pencil",
		description: (
			<>
				Escribe hiragana y katakana con el dedo en el iPhone o con el Apple Pencil en el iPad.{" "}
				<strong>Cada trazo se compara con su orden</strong> mientras dibujas.
			</>
		),
		items: [
			"Orden de trazos animado para cada kana y kanji",
			"Tablas de hiragana y katakana para consultar",
		],
	},
	details: {
		eyebrow: "Los detalles",
		title: "Todo lo demás, en tu bolsillo",
		description: "Las referencias y los detalles a los que vuelves entre sesiones.",
		items: {
			"kanji-index": {
				title: "Kanji por número de trazos",
				body: "Cada kanji de la referencia, agrupado por sus trazos, con las palabras que lo usan.",
				alt: "La referencia de kanji agrupada por número de trazos: 一, 丁, 七 y las palabras que usa cada uno.",
			},
			particle: {
				title: "Partículas, explicadas",
				body: "は, が, を y las demás: qué hace cada una, con frases de ejemplo.",
				alt: "La partícula は, marcador de tema, explicada con dos frases de ejemplo.",
			},
			phrases: {
				title: "Más de 2100 frases",
				body: "Frases reales para las palabras que aprendes, con la traducción en tu idioma.",
				alt: "La biblioteca de frases: 2134 frases como 水を下さい。, Agua, por favor.",
			},
			"practice-reminder": {
				title: "Un recordatorio tranquilo",
				body: "Una vez al día, a la hora que elijas: mañana, mediodía, tarde o noche. O nunca.",
				alt: "Una notificación en la pantalla bloqueada que invita a practicar un poco de japonés hoy.",
			},
			languages: {
				title: "En español o en inglés",
				body: "Los significados y todas las pantallas en cualquiera de los dos idiomas, y cada idioma guarda su propio progreso.",
				alt: "La tarjeta de 水 en inglés: water, mizu.",
			},
			"add-word": {
				title: "Tus propias palabras",
				body: "Agrega una palabra que encontraste en otro lado y elige el nivel en el que la práctica la presenta.",
				alt: "El formulario para agregar una palabra: significado en inglés y en español, escrituras japonesas y nivel de aprendizaje.",
			},
		},
	},
	bonsai: {
		eyebrow: "El bonsái",
		title: "Un árbol que solo crece",
		description: (
			<>
				Crece con los días que practicas, no con tu racha, en diez etapas desde la primera sesión
				hasta un año. <strong>Saltear un día nunca achica el árbol.</strong>
			</>
		),
		pause: "Pausar el bonsái que crece",
		grownAlt:
			"El bonsái de Wakaba después de un año de práctica, ya crecido, en la misma maceta del comienzo.",
		timeline:
			"Días practicados, desde la primera sesión hasta un año. Varias sesiones en un mismo día cuentan una vez.",
		weekend: {
			title: "Saltea el fin de semana, conserva el árbol.",
			body: "La racha cuenta días seguidos y vuelve a empezar después de un hueco. El bonsái cuenta cada día que practicaste, así que un fin de semana ocupado te cuesta la racha y nada más.",
			days: ["Viernes", "Lunes"],
			rows: { day: "Día", streak: "Racha", practised: "Días practicados", bonsai: "Bonsái" },
			streaks: ["23 días", "1 día"],
			stage: "árbol de 30 días",
		},
	},
	widgets: {
		eyebrow: "Widgets",
		title: "La práctica, a un vistazo",
		description:
			"Pon el bonsái y una palabra en tu pantalla de inicio. Toca la palabra para abrir su tarjeta.",
		progress: {
			title: "Bonsái de práctica",
			sizes: "Pequeño y mediano",
			body: "Tu árbol, la racha, si practicaste hoy y las palabras que aprendiste.",
		},
		word: {
			title: "Palabra del día",
			sizes: "Pequeño, mediano y grande",
			body: "Su escritura japonesa, su lectura, el significado y el romaji. Tócala para ver la tarjeta.",
		},
	},
	privacy: {
		eyebrow: "Privacidad",
		title: "Tu práctica es tuya",
		description:
			"Sin cuenta y sin nada que iniciar. Wakaba guarda tu práctica en tu dispositivo y tu progreso en tu propio iCloud.",
		checks: [
			"Sin anuncios, analíticas ni rastreo",
			"La práctica funciona en tu iPhone o iPad",
			"El progreso se sincroniza con tu iCloud privado",
			"La pronunciación se reconoce en el dispositivo",
		],
	},
	faq: {
		eyebrow: "Preguntas",
		title: "Antes de descargarla",
		columns: [
			[
				[
					"¿Para quién es Wakaba?",
					"Para quien ya sabe algo de gramática japonesa y quiere recordar palabras, reconocerlas al oírlas y usarlas en contexto. No enseña el idioma entero desde cero.",
				],
				[
					"¿Cuánto cuesta?",
					"Nada. Wakaba es gratis, sin anuncios, suscripciones ni compras dentro de la app.",
				],
				[
					"¿En qué dispositivos funciona?",
					"En iPhone y iPad con iOS o iPadOS 17 o posterior. Tu progreso te sigue entre ellos a través de iCloud.",
				],
			],
			[
				["¿En qué idiomas está?", "La app y todas las traducciones están en español y en inglés."],
				[
					"¿Qué pasa si salteo un día?",
					"Tu racha vuelve a empezar la próxima vez que practiques. El bonsái cuenta cada día que practicaste, así que queda exactamente igual.",
				],
				[
					"¿Puedo agregar mis propias palabras?",
					"Sí. Agrega palabras a tu biblioteca, edita cualquier entrada y elige el nivel en el que la práctica las presenta.",
				],
			],
		],
	},
	closing: {
		title: "Planta el árbol con una sesión",
		description: "Wakaba es gratis en iPhone y iPad, en español y en inglés.",
		support: "¿Preguntas? Escribe a soporte",
	},
	screens: {
		"path-kitsune":
			"El camino de aprendizaje en el nivel 1: piedras numeradas de sesiones, con Kitsune señalando la siguiente.",
		"flashcards-fish":
			"Una tarjeta de 魚, pez: el furigana さかな sobre el kanji y el romaji sakana debajo.",
		practice:
			"Una pregunta de práctica sobre el significado de みず, con Aka Oni junto a la palabra y tres respuestas debajo.",
		"flashcards-water":
			"Una tarjeta de 水, agua: el furigana みず sobre el kanji, el significado y el romaji mizu.",
		conjugations:
			"Los detalles de 食べる, comer: su forma de diccionario y conjugaciones como 食べます y 食べません.",
		"level-exam-path":
			"El camino de aprendizaje llegando al examen del nivel 2, con Kitsune junto a las próximas sesiones.",
		listening:
			"Una pregunta de comprensión auditiva: un botón reproduce la palabra y debajo esperan tres significados.",
		speaking:
			"La práctica de pronunciación pide decir みず en voz alta, con un botón de micrófono.",
		"build-sentence": "Una frase para armar en japonés con fichas de palabras.",
		"conjugation-practice":
			"Una pregunta de conjugación: escribir たべる, comer, en su forma cortés no pasada.",
		"oni-correction":
			"Aka Oni después de una respuesta incorrecta: la palabra correcta みず, agua, y una nota sobre la diferencia.",
		"kana-tracing":
			"Práctica de trazado de katakana: un trazo dibujado sobre la guía, numerado según su orden.",
		"stroke-guide": "La guía del orden de trazos de 水, con el segundo trazo resaltado y numerado.",
		"new-word":
			"Una palabra nueva presentada antes de cualquier pregunta: みず, agua, mizu, con Tengu y un botón para empezar el ejercicio.",
		"practice-feedback":
			"Una respuesta correcta sobre みず, agua, mizu, con un botón para la siguiente palabra.",
		"oni-mistakes":
			"Un repaso de errores anteriores con Aka Oni, que pide la lectura de みず en romaji.",
		"widget-progress":
			"El widget Bonsái de práctica en la galería de widgets de iOS: un bonsái, una racha de 23 días y 36 palabras aprendidas.",
		"widget-word": "El widget Palabra del día en la galería de widgets de iOS: 機, ki.",
	},
};
