/**
 * Spanish copy for the public pages: the home, each feature, each way of reading and each
 * comparison, with the header and footer they share. Figures arrive as variables read from
 * the limits the app enforces, so no sentence here states a number of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export default {
	meta: {
		title: "Reader — todos los feeds que sigues, en una cola tranquila",
		description:
			"Sigue cualquier sitio que publique RSS o Atom. Reader revisa cada feed tan seguido como publica y pone cada entrada nueva en una sola cola, de la más reciente a la más antigua, sin nada promocionado.",
	},

	nav: {
		descriptions: {
			freshness: "Cada feed, tan seguido como publica",
			filters: "Descarta, marca leída o destaca al llegar",
			articles: "La pieza completa, sin salir",
			search: "Frases, OR y menos, guardadas en la barra",
			notifications: "Un aviso por revisión, silencio de noche",
			organize: "Carpetas, fijados y etiquetas",
			yourData: "OPML de ida y vuelta, y un ZIP con todo",
			agents: "Tu asistente lee tu cola por MCP",
			news: "Feeds activos, plazos cortos, sin ruido",
			developers: "Destaca versiones, entérate de arreglos",
			research: "Busca y etiqueta lo que guardas",
			podcasts: "Episodios junto a los ensayos",
		},
		label: "Principal",
		menu: "Abrir menú",
		close: "Cerrar menú",
		signIn: "Iniciar sesión",
		open: "Abrir tu lectura",
		plans: "Planes",
		help: "Ayuda",
		features: {
			label: "Funciones",
			reading: "Lectura",
			keeping: "Guardar y conectar",
			freshness: "Feeds al día",
			filters: "Filtros",
			articles: "Artículos aquí mismo",
			search: "Búsqueda",
			notifications: "Notificaciones",
			organize: "Carpetas y etiquetas",
			yourData: "Tus datos",
			agents: "Agentes",
		},
		useCases: {
			label: "Formas de leer",
			news: "Noticias locales y del mundo",
			developers: "Notas de versión",
			research: "Investigación y lecturas largas",
			podcasts: "Podcasts",
		},
		compare: {
			label: "Comparar",
			feedly: "Feedly",
			inoreader: "Inoreader",
			feedbin: "Feedbin",
			newsblur: "NewsBlur",
		},
	},

	footer: {
		label: "Sitio",
		tagline: "Un lector de RSS y Atom con una sola cola, lo más reciente primero.",
		copyright: "© {$year}",
		publisher: "Sergio Xalambrí",
	},

	hero: {
		eyebrow: "Lector de RSS y Atom",
		title: "Las entradas que elegiste, {#strong}en el orden en que se escribieron{/strong}",
		description:
			"Sigue cualquier sitio que publique un feed. Reader revisa cada uno tan seguido como realmente publica y pone cada entrada nueva en una sola cola, lo más reciente primero, sin nada promocionado.",
		cta: "Inicia sesión para empezar a leer",
		secondary: "Mira cómo funciona",
		checks: {
			anyFeed: "Cualquier feed RSS o Atom",
			opml: "Trae tu OPML",
			free: "{$freeFeeds} feeds gratis",
		},
		views: {
			label: "Pantallas de Reader",
			queue: "Cola",
			article: "Artículo",
			feed: "Feed",
			queueAlt:
				"La cola de lectura: ocho entradas de seis feeds, cinco sin leer, una destacada por un filtro y una guardada, bajo un aviso de que llegan entradas de dos feeds.",
			articleAlt:
				"Una entrada guardada de Field Notes leída aquí mismo, con su firma y los primeros párrafos del artículo.",
			feedAlt:
				"La página de Harbor Daily: revisado hace seis minutos, el plazo durante el que se quedan sus entradas y la app sugiriendo un plazo más corto para un feed que publica catorce entradas al día.",
		},
	},

	figures: {
		feeds: "feeds en el plan Free",
		posts: "entradas guardadas en Free",
		interval: "entre revisiones de un feed activo",
		history: "entradas anteriores traídas al seguir",
	},

	scenes: {
		cadence: {
			rate: "Entradas al día",
			every: "Revisado cada",
			silent: "Nada en un mes",
		},
		agents: {
			timeline:
				".input {$count :number}\n.match $count\none {{{$count} entrada}}\n* {{{$count} entradas}}",
		},
		syntax: {
			phrase: "Las palabras, tal cual",
			either: "Entradas con cualquiera de las dos",
			exclude: "Deja fuera las entradas que la tienen",
		},
	},

	freshness: {
		eyebrow: "01 / Feeds al día",
		title: "Cada feed se revisa tan seguido como publica",
		description:
			"Reader mide cada cuánto publica un sitio y lo busca a ese ritmo, {#strong}una sola vez para todos los que lo siguen{/strong}. Tu cola se pone al día en cuanto la abres.",
		more: "Cómo se mantienen al día los feeds",
		checks: {
			rate: "Un feed que publica diez veces al día se revisa cada {$pollFloor}; uno tranquilo, una vez al día",
			push: "Los sitios con un hub WebSub envían las entradas nuevas en cuanto las publican",
			history: "Seguir un feed trae hasta {$historyPosts} de sus entradas anteriores",
		},
		diagram: {
			label: "Una revisión de Harbor Daily llega a cada lector que lo sigue",
			pause: "Pausar",
			queue: "La cola de {$name}",
			added: "+3 entradas",
			outcome: "Tres entradas nuevas en cada cola",
			footnote: "Una revisión cada {$pollFloor}, la siga quien la siga",
		},
		chart: {
			label: "Cuántas veces al día se revisa un feed, según cuánto publica",
			pause: "Pausar",
			rate: "{$rate :number}+ entradas al día",
			below: "Menos de {$rate :number} entradas al día",
			metric: "revisiones al día para un feed tan activo como Harbor Daily",
			footnote: "Un feed que dejó de publicar espera {$dormant} entre revisiones",
		},
	},

	filters: {
		eyebrow: "02 / Filtros",
		title: "Decide una vez qué pasa con cada entrada",
		description:
			"Un filtro es una frase: cuando el título de una entrada contiene una palabra, descártala, márcala como leída o destácala. {#strong}Actúa cuando llegan las entradas{/strong}, así que la cola que abres ya está ordenada.",
		more: "Cómo funcionan los filtros",
		checks: {
			actions: "Descartar, marcar como leída o destacar, por título, enlace, resumen o autor",
			preview: "Mira qué habría atrapado un filtro antes de guardarlo",
			forward: "Los filtros actúan sobre lo que llega y dejan intacto todo lo que ya está aquí",
		},
	},

	features: {
		eyebrow: "Funciones",
		title: "Para una lista de lectura que conservas durante años",
		description:
			"Lee el artículo completo sin salir, encuentra una entrada de hace dos años, entérate de los feeds que te importan y llévate todo cuando quieras.",
		more: "Más información",
		plansLink: "Comparar planes",
		factsEyebrow: "Lo que obtienes",
		stepsEyebrow: "Cómo funciona",
		relatedTitle: "Más de lo que hace Reader",
		cards: {
			freshness: {
				title: "Feeds revisados a su propio ritmo",
				description:
					"Desde cada {$pollFloor} para un feed activo hasta una vez por semana para uno que se quedó callado.",
			},
			filters: {
				title: "Filtros que se leen como frases",
				description:
					"Descarta las entradas patrocinadas, destaca las versiones, marca como leídos los comunicados de prensa.",
			},
			articles: {
				title: "El artículo completo, aquí mismo",
				description:
					"Abre una entrada y lee el artículo que hay detrás, con el medio nombrado y el original a un clic.",
			},
			search: {
				title: "Busca con comillas, OR y menos",
				description:
					"Encuentra una frase tal cual, cualquiera de dos palabras, o deja una palabra fuera.",
			},
			notifications: {
				title: "Una notificación, no doce",
				description:
					"Elige los feeds de los que vale la pena enterarse. Cada revisión envía un solo mensaje por todos, fuera de tus horas de silencio.",
			},
			organize: {
				title: "Carpetas, fijados y etiquetas",
				description:
					"Lee una carpeta como un solo flujo, fija los feeds que nunca te pierdes, etiqueta lo que guardas.",
			},
			yourData: {
				title: "Llévate todo",
				description:
					"OPML de entrada y de salida, con carpetas incluidas, y un ZIP de cada entrada que guardaste.",
			},
			agents: {
				title: "Tu asistente lee tu cola",
				description:
					"Conecta cualquier cliente MCP a tus feeds con un token que puede leer, o leer y actuar.",
			},
		},
		pages: {
			freshness: {
				meta: {
					title: "Feeds al día — Reader",
					description:
						"Reader revisa cada feed al ritmo en que publica, desde cada {$pollFloor} hasta una vez por semana, una sola vez para todos los que lo siguen.",
				},
				title: "Un feed se revisa tan seguido como {#strong}realmente publica{/strong}",
				description:
					"Reader mide el ritmo de cada feed y lo revisa a ese ritmo. Un sitio de noticias que publica todo el día se revisa cada {$pollFloor}; un blog que publica una vez al mes queda tranquilo hasta que pueda tener algo.",
				plan: "El mismo horario en todos los planes.",
				heroAlt:
					"La página de Harbor Daily, revisado hace seis minutos, con el plazo durante el que se quedan sus entradas y una sugerencia para acortarlo.",
				factsTitle: "Al día sin saturar el servidor de nadie",
				facts: {
					one: {
						title: "Una revisión por feed",
						description:
							"Un feed se revisa una sola vez sin importar cuántas personas lo sigan, así que diez mil lectores de un sitio le cuestan a ese sitio una sola petición.",
					},
					two: {
						title: "Solo lo que cambió",
						description:
							"Cada revisión devuelve los validadores que el sitio dio la última vez, así que un feed sin cambios responde sin nada que descargar.",
					},
					three: {
						title: "Enviado cuando el sitio lo ofrece",
						description:
							"Un sitio con un hub WebSub le avisa a Reader en cuanto publica; el horario sigue activo por si un aviso se pierde.",
					},
				},
				stepsTitle: "De seguir un feed a un ritmo estable",
				steps: {
					one: {
						title: "Sigue un feed o un sitio",
						description:
							"Pega la dirección del feed, o la del sitio, y Reader encuentra el feed que anuncia.",
					},
					two: {
						title: "Llega su historial",
						description:
							"Si el feed publica archivos o páginas, hasta {$historyPosts} entradas anteriores llegan detrás.",
					},
					three: {
						title: "Toma su ritmo",
						description:
							"Tras un día de revisiones cada hora, el feed se revisa al intervalo que se gana con su propio ritmo de publicación.",
					},
				},
				faqTitle: "Preguntas sobre feeds al día",
				faq: {
					one: {
						q: "¿Puedo revisar un feed ahora mismo?",
						a: "Sí. La página de cada feed tiene Revisar feed, y la cola tiene Revisar todos, además del horario.",
					},
					two: {
						q: "¿Qué pasa con un feed que deja de publicar?",
						a: "Tras un mes sin nada nuevo se revisa una vez por semana, y pasa al grupo Tranquilos al final de tu barra lateral.",
					},
					three: {
						q: "¿Y si un sitio está caído?",
						a: "Reader espera y lo intenta más tarde, y la página del feed te dice qué encontró la última revisión.",
					},
				},
				closing: "Sigue un feed y míralo llegar",
			},
			filters: {
				meta: {
					title: "Filtros — Reader",
					description:
						"Los filtros descartan, marcan como leídas o destacan entradas al llegar, por título, enlace, resumen o autor. Mira qué atraparía uno antes de guardarlo.",
				},
				title: "Filtros que {#strong}se leen como frases{/strong}",
				description:
					"Cuando el título de una entrada contiene “Patrocinado”, descártala. Cada filtro lee una parte de la entrada, busca un texto y decide qué pasa cuando la entrada llega.",
				plan: "Los filtros vienen con los planes Paid y Premium.",
				heroAlt:
					"La página de Filtros: tres filtros escritos como frases, cada uno con el número de entradas que decidió, y una vista previa que coincide con 12 de las 500 entradas más recientes.",
				stepsAlt: "La cola de lectura con una versión de Kettle destacada por un filtro arriba.",
				factsTitle: "Tres cosas que puede hacer un filtro",
				facts: {
					one: {
						title: "Descartar",
						description:
							"La entrada nunca llega a tu cola. Úsalo para las entradas patrocinadas y las categorías que nunca lees.",
					},
					two: {
						title: "Marcar como leída",
						description: "La entrada está ahí si la buscas, y fuera de tu cuenta de no leídas.",
					},
					three: {
						title: "Destacar",
						description:
							"La entrada llega con una marca de Destacada al inicio de su título, así una nota de versión resalta.",
					},
				},
				stepsTitle: "Escríbelo, pruébalo, déjalo correr",
				steps: {
					one: {
						title: "Escribe la frase",
						description:
							"Elige la parte de la entrada, el texto a buscar y qué pasa, para todos los feeds o solo uno.",
					},
					two: {
						title: "Pruébalo",
						description:
							"Mira cuántas de tus entradas más recientes habría atrapado, y aplícalo a esas si quieres.",
					},
					three: {
						title: "Déjalo correr",
						description: "Cada filtro cuenta las entradas que decidió, así sabes que funciona.",
					},
				},
				faqTitle: "Preguntas sobre filtros",
				faq: {
					one: {
						q: "¿Un filtro cambia las entradas que ya tengo?",
						a: "No. Los filtros actúan sobre lo que llegue de ahora en adelante. La vista previa puede aplicar uno a entradas recientes si se lo pides.",
					},
					two: {
						q: "¿Un filtro sobre el resumen lee el artículo?",
						a: "Lee los primeros {$summaryChars} caracteres del resumen que dio el feed, que es la línea bajo el título.",
					},
					three: {
						q: "¿Qué pasa con mis filtros si paso a Free?",
						a: "Se quedan donde están y dejan de ejecutarse. Nada de lo que sigues o has leído cambia.",
					},
				},
				closing: "Abre una cola que se ordena sola",
			},
			articles: {
				meta: {
					title: "Artículos aquí mismo — Reader",
					description:
						"Abre una entrada y lee el artículo detrás de su enlace dentro de Reader, con tu tipografía de lectura y el original a un clic.",
				},
				title: "El artículo completo, {#strong}sin salir de la cola{/strong}",
				description:
					"Muchos feeds traen un título y una línea. Abre la entrada y Reader trae el artículo detrás de su enlace, lo muestra con tu tipografía de lectura, nombra al medio y deja el original a un clic.",
				plan: "Leer artículos aquí mismo viene con los planes Paid y Premium.",
				heroAlt:
					"Un ensayo de Field Notes leído aquí mismo, en una tipografía serif, con su firma y el enlace al original.",
				stepsAlt: "La cola de lectura, donde se abre una entrada.",
				factsTitle: "Se lee aquí, el crédito es suyo",
				facts: {
					one: {
						title: "Se trae cuando lo abres",
						description:
							"El artículo se lee del medio en el momento en que abres la entrada, y se guarda para todos los que abran la misma.",
					},
					two: {
						title: "Serif o sans",
						description:
							"Las entradas y los artículos usan la tipografía de lectura que elegiste; los menús quedan como están.",
					},
					three: {
						title: "El original, a un clic",
						description: "Cada artículo nombra a su medio y enlaza a la página de donde vino.",
					},
				},
				stepsTitle: "De una línea en un feed a la pieza completa",
				steps: {
					one: {
						title: "Abre una entrada",
						description: "Desde la cola, una carpeta o la página de un feed.",
					},
					two: {
						title: "Llega el artículo",
						description:
							"Reader lee la página detrás del enlace de la entrada y conserva el texto propio del artículo.",
					},
					three: {
						title: "O te dice por qué no",
						description:
							"Un sitio que se niega, tarda demasiado o no tiene nada que leer se indica como tal, y el extracto y el enlace se quedan.",
					},
				},
				faqTitle: "Preguntas sobre artículos",
				faq: {
					one: {
						q: "¿Funciona con todos los sitios?",
						a: "Con la mayoría. Un sitio que no lo permite se distingue de uno que tardó demasiado, y el extracto y el enlace de la entrada siempre están ahí.",
					},
					two: {
						q: "¿Guardar una entrada conserva el artículo?",
						a: "Guardar conserva el título, el extracto y el enlace. Cuando el sitio desaparece, el enlace también.",
					},
					three: {
						q: "¿También se pueden reproducir podcasts y videos aquí?",
						a: "Sí. Un adjunto de audio o video se reproduce en la página de la entrada, con el reproductor de tu navegador.",
					},
				},
				closing: "Lee la pieza completa donde la encontraste",
			},
			search: {
				meta: {
					title: "Búsqueda — Reader",
					description:
						"Busca en cada entrada que guardaste por título, resumen y autor, con frases entre comillas, OR, y menos o NOT para dejar palabras fuera. Guarda una búsqueda en la barra lateral.",
				},
				title: "Encuentra la entrada {#strong}que recuerdas a medias{/strong}",
				description:
					"La búsqueda lee el título, el resumen y el autor de cada entrada que guardaste. Pon una frase entre comillas, OR entre dos palabras, un menos delante de una palabra, y guarda las búsquedas que haces cada semana.",
				plan: "Free busca en los últimos {$freeSearchDays} días; Paid y Premium buscan en todo lo que guardaste.",
				heroAlt:
					"La cola filtrada por una búsqueda de harbour OR ferry menos sponsored, con tres entradas que coinciden y la línea que dice hasta dónde buscó.",
				factsTitle: "Una búsqueda que dice dónde miró",
				facts: {
					one: {
						title: "Todas las palabras, o las que digas",
						description:
							"Una búsqueda encuentra entradas con todas las palabras, salvo que unas dos con OR o dejes una fuera con un menos.",
					},
					two: {
						title: "Dentro de un filtro",
						description:
							"La búsqueda se combina con Todas, Sin leer y Leídas, así que “entradas sin leer sobre el puente peatonal” es una sola dirección.",
					},
					three: {
						title: "Guardada en la barra lateral",
						description:
							"Guarda hasta {$savedSearchLimit} búsquedas con nombre, {$freeSavedSearches} en Free, y ábrelas como una carpeta.",
					},
				},
				stepsTitle: "Cuatro formas de decir lo que quieres",
				steps: {
					one: {
						title: "Escribe las palabras",
						description: "Cada palabra tiene que aparecer en el título, el resumen o el autor.",
					},
					two: {
						title: "Dale forma",
						description:
							"Pon una frase entre comillas, OR entre dos palabras, - o NOT delante de una palabra.",
					},
					three: {
						title: "Guárdala",
						description:
							"Guarda la búsqueda y queda en la barra lateral, respondiendo con lo nuevo cada vez.",
					},
				},
				faqTitle: "Preguntas sobre la búsqueda",
				faq: {
					one: {
						q: "¿La búsqueda lee el artículo?",
						a: "Lee el título, el resumen y el autor de cada entrada, que es lo que dio el feed.",
					},
					two: {
						q: "¿Hasta cuándo busca?",
						a: "En Free, los últimos {$freeSearchDays} días. En Paid y Premium, todo lo que guardaste. La página siempre dice dónde se detuvo.",
					},
					three: {
						q: "¿Puedo buscar la palabra OR?",
						a: "Sí. Ponla entre comillas y se busca como palabra.",
					},
				},
				closing: "Encuéntrala de nuevo en un segundo",
			},
			notifications: {
				meta: {
					title: "Notificaciones — Reader",
					description:
						"Entérate de los feeds que elijas, en tu navegador o por correo, con una notificación por revisión y horas de silencio que las retienen por la noche.",
				},
				title: "Entérate de los feeds {#strong}que elegiste{/strong}, y solo de esos",
				description:
					"Activa las notificaciones en los feeds que valen la pena. Cuando una revisión encuentra algo, recibes una notificación que los nombra, nunca una por entrada, y nada durante tus horas de silencio.",
				plan: "Paid revisa cada {$paidCheck} y Premium cada {$premiumCheck}; el correo viene con Premium.",
				heroAlt:
					"Los ajustes de notificaciones: una notificación por tres entradas nuevas de tres feeds, y horas de silencio de 22:00 a 07:00.",
				factsTitle: "Notificaciones que respetan tus noches",
				facts: {
					one: {
						title: "Un mensaje por revisión",
						description:
							"Tres feeds con novedades son una notificación que nombra hasta tres medios.",
					},
					two: {
						title: "Retenidas, no perdidas",
						description:
							"Una notificación durante las horas de silencio espera, y la próxima revisión fuera de ellas la lleva.",
					},
					three: {
						title: "Tus navegadores, tu correo",
						description:
							"Push a los navegadores que permitas, y correo como mucho una vez cada {$emailGapHours} horas en Premium.",
					},
				},
				stepsTitle: "Elige los feeds y luego cómo avisarte",
				steps: {
					one: {
						title: "Elige un feed",
						description: "Activa las notificaciones desde la página de ese feed.",
					},
					two: {
						title: "Elige un canal",
						description: "Permite este navegador, agrega otro o activa el correo.",
					},
					three: {
						title: "Define tus horas de silencio",
						description: "Se leen en tu propia zona horaria, según la informa tu navegador.",
					},
				},
				faqTitle: "Preguntas sobre notificaciones",
				faq: {
					one: {
						q: "¿Se envía algo sobre feeds que no elegí?",
						a: "No. Nunca se envía nada sobre un feed que no elegiste.",
					},
					two: {
						q: "¿Funciona en mi teléfono?",
						a: "Sí, en un navegador compatible con web push, incluido un iPhone con Reader agregado a la pantalla de inicio.",
					},
					three: {
						q: "¿Cómo dejo de recibir los correos?",
						a: "Cada correo tiene un enlace que los detiene, y en Ajustes los vuelves a activar.",
					},
				},
				closing: "Entérate de lo que importa, cuando te convenga",
			},
			organize: {
				meta: {
					title: "Carpetas y etiquetas — Reader",
					description:
						"Agrupa feeds en carpetas y lee cada una como un solo flujo, fija los feeds que nunca te pierdes, guarda entradas y etiqueta por qué las guardaste.",
				},
				title: "Agrupa los feeds, {#strong}etiqueta lo que guardas{/strong}",
				description:
					"Una carpeta lee sus feeds como un solo flujo. Un feed fijado queda arriba en la barra lateral. Una entrada guardada se queda pase lo que pase con su feed, y una etiqueta dice por qué la guardaste.",
				plan: "Las carpetas y etiquetas vienen con los planes Paid y Premium; los fijados, con todos.",
				heroAlt:
					"La página de Guardadas: dos entradas guardadas, el feed fijado de la barra lateral y carpetas con sus entradas sin leer, y tres etiquetas.",
				stepsAlt: "La página de Harbor Daily, donde un feed se guarda en una carpeta.",
				factsTitle: "Tres formas de mantener legible una lista grande",
				facts: {
					one: {
						title: "Carpetas como flujos",
						description:
							"Abre Noticias y lee cada feed de noticias, lo más reciente primero, como una sola lista.",
					},
					two: {
						title: "Fijados y feeds tranquilos",
						description:
							"Fija hasta {$pinLimit} feeds sobre todo lo demás, {$freePins} en Free; los que casi no publican bajan a Tranquilos.",
					},
					three: {
						title: "Guardada significa conservada",
						description:
							"Ninguna regla de retención alcanza a una entrada guardada, y hasta {$tagLimit} etiquetas dicen por qué la guardaste.",
					},
				},
				stepsTitle: "Guarda un feed en una carpeta en dos clics",
				steps: {
					one: {
						title: "Abre el feed",
						description: "Su página tiene todas las acciones sobre él.",
					},
					two: {
						title: "Elige o nombra una carpeta",
						description: "Elige una que tengas, o escribe un nombre y la carpeta se crea.",
					},
					three: {
						title: "Lee la carpeta",
						description: "Aparece en la barra lateral con sus entradas sin leer.",
					},
				},
				faqTitle: "Preguntas sobre organización",
				faq: {
					one: {
						q: "¿Qué pasa con las entradas si elimino una carpeta?",
						a: "Nada. Sus feeds vuelven con los que no están en ninguna carpeta y conservan todas sus entradas.",
					},
					two: {
						q: "¿Cuánto tiempo se quedan las entradas?",
						a: "Lo que quieras. Cada feed puede conservar sus entradas desde tres horas hasta para siempre; las guardadas se quedan siempre.",
					},
					three: {
						q: "¿Las carpetas vienen con el OPML?",
						a: "Sí. La importación y la exportación llevan tus carpetas junto con tus feeds.",
					},
				},
				closing: "Dale un lugar a cada feed",
			},
			yourData: {
				meta: {
					title: "Tus datos — Reader",
					description:
						"Importa un archivo OPML, con carpetas incluidas, y exporta tus suscripciones o un ZIP de todo lo que guardaste, cuando quieras.",
				},
				title: "Llega con tu lista, {#strong}llévate todo{/strong}",
				description:
					"Importa el archivo OPML de tu lector anterior, con carpetas incluidas. Expórtalo de nuevo cuando quieras, o descarga un ZIP con tus suscripciones y cada entrada que guardaste.",
				plan: "Importar y exportar en todos los planes.",
				heroAlt:
					"Una importación OPML que informa 142 feeds nuevos, 3 que ya seguías y 1 que no se pudo obtener, sobre los archivos que contiene una exportación completa.",
				factsTitle: "Nada queda secuestrado",
				facts: {
					one: {
						title: "OPML en ambos sentidos",
						description: "El archivo estándar que lee todo lector, con tus carpetas como esquemas.",
					},
					two: {
						title: "Un ZIP con todo",
						description:
							"Suscripciones en OPML, entradas guardadas con sus etiquetas en CSV, y ambas en JSON.",
					},
					three: {
						title: "Cambiar de plan no borra nada",
						description:
							"Si superas tu plan, lo nuevo se pausa y todo lo que tienes se queda donde está.",
					},
				},
				stepsTitle: "Mudarte lleva un solo archivo",
				steps: {
					one: {
						title: "Exporta desde tu lector anterior",
						description: "Todo lector que valga la pena dejar tiene una exportación OPML.",
					},
					two: {
						title: "Impórtalo en Ajustes",
						description:
							"Reader sigue cada feed y te dice cuáles ya tenía y a cuáles no pudo llegar.",
					},
					three: {
						title: "Lee",
						description:
							"Las entradas anteriores llegan detrás en los feeds que publican sus archivos.",
					},
				},
				faqTitle: "Preguntas sobre tus datos",
				faq: {
					one: {
						q: "¿Y si falla un pago?",
						a: "Todo se queda durante {$graceDays} días. Actualiza la tarjeta y nada habrá cambiado.",
					},
					two: {
						q: "¿Hay un límite de tamaño para importar?",
						a: "Una lista de suscripciones pesa unos cientos de kilobytes como mucho, y Reader lee archivos de ese tamaño.",
					},
					three: {
						q: "¿La exportación incluye los artículos?",
						a: "Incluye el título, el enlace, el extracto y las etiquetas de cada entrada guardada.",
					},
				},
				closing: "Trae tu OPML y empieza a leer",
			},
			agents: {
				meta: {
					title: "Agentes — Reader",
					description:
						"Reader responde al Model Context Protocol, así un asistente puede leer, buscar y actuar sobre tus feeds con un token que creas y puedes revocar.",
				},
				title: "Pregúntale a tu asistente {#strong}qué hay de nuevo{/strong}",
				description:
					"Reader responde al Model Context Protocol. Crea un token en Ajustes, dale la dirección a tu cliente, y tu asistente puede leer tu cola, buscar en ella y —si se lo permites— marcar, guardar, seguir y dejar de seguir.",
				plan: "Los agentes vienen con los planes Paid y Premium.",
				heroAlt:
					"Los ajustes de Agentes: un token de lectura y escritura llamado Asistente del portátil, sobre las herramientas que usó esta mañana.",
				factsTitle: "Un asistente con la correa corta",
				facts: {
					one: {
						title: "Lectura o escritura, tú eliges",
						description:
							"Un token de lectura nunca puede marcar, guardar, seguir ni dejar de seguir nada.",
					},
					two: {
						title: "{$toolCount} herramientas",
						description:
							"Leer la cronología, buscar en ella, leer un feed o las entradas guardadas, listar feeds y actuar sobre entradas cuando se permite.",
					},
					three: {
						title: "Revócalo cuando quieras",
						description:
							"Cada token muestra cuándo se usó por última vez, y un clic hace que deje de responder.",
					},
				},
				stepsTitle: "Tres pasos hacia un asistente de lectura",
				steps: {
					one: {
						title: "Crea un token",
						description:
							"En Ajustes, ponle nombre y elige si puede escribir. Se muestra una sola vez.",
					},
					two: {
						title: "Configura el cliente",
						description: "Dale la dirección y el token como credencial bearer.",
					},
					three: {
						title: "Pregunta",
						description:
							"“¿Qué llegó de Harbor Daily esta mañana?” se responde desde tu cola, no desde un navegador.",
					},
				},
				faqTitle: "Preguntas sobre agentes",
				faq: {
					one: {
						q: "¿Qué clientes funcionan?",
						a: "Cualquier cliente que te deje configurar un token bearer.",
					},
					two: {
						q: "¿Un agente puede seguir feeds por mí?",
						a: "Con un token de escritura, sí. Con un token de lectura solo puede leer y buscar.",
					},
					three: {
						q: "¿Hay un límite?",
						a: "Cada token tiene un presupuesto diario de llamadas, y lo avisa cuando se agota.",
					},
				},
				closing: "Deja que tu asistente lea por encima",
			},
		},
	},

	privacy: {
		eyebrow: "Privacidad",
		title: "Lo que lees queda entre tú y la página",
		description:
			"Reader no vende nada, no muestra anuncios, y sus propios registros están escritos para que no puedan decir quién leyó qué.",
		facts: {
			logs: {
				title: "Registros que nunca te nombran",
				description:
					"Un evento puede llevar una cuenta, una duración, un estado o un host — nunca el título ni la dirección de una entrada, y nunca quién eres.",
			},
			links: {
				title: "Enlaces sin rastreo",
				description:
					"Los parámetros de campaña se quitan de los enlaces de un feed salvo que pidas conservarlos para ese feed.",
			},
			retention: {
				title: "Se guardan 30 días",
				description:
					"La telemetría operativa se borra al mes, y el servidor de un medio solo sabe que un lector lo visitó.",
			},
		},
	},

	plans: {
		eyebrow: "Planes",
		title: "Según lo que guardas, no lo que lees",
		description:
			"Todos los planes leen cada feed de la misma forma. Se diferencian en cuánto guardan y en qué funciona por ti mientras no estás.",
		label: "Qué incluye cada plan",
		column: "Incluido",
		included: "Incluido",
		notIncluded: "No incluido",
		everything: "Todo lo guardado",
		days: "Últimos {$days} días",
		rows: {
			feeds: "Feeds que sigues",
			posts: "Entradas conservadas",
			saved: "Entradas guardadas",
			pins: "Feeds fijados",
			savedSearches: "Búsquedas guardadas",
			search: "La búsqueda alcanza",
			filters: "Filtros",
			checks: "Revisiones para notificaciones",
			articles: "Artículos aquí mismo",
			folders: "Carpetas",
			labels: "Etiquetas",
			agents: "Agentes (MCP)",
			email: "Notificaciones por correo",
		},
		notes: {
			grace: "Un pago fallido conserva todo durante {$graceDays} días",
			nothingDeleted: "Cambiar de plan nunca borra nada",
			more: "Cada límite, explicado",
		},
	},

	useCases: {
		eyebrow: "Formas de leer",
		title: "Una cola, cuatro formas de leer",
		description:
			"El mismo lector, mañanas distintas: lo que cambia es qué funciones llevan el peso.",
		compare: "¿Vienes de otro lector?",
		capabilitiesEyebrow: "Lo que lo hace posible",
		cards: {
			news: {
				title: "Mantente al día sin el ruido",
				description:
					"Feeds activos revisados cada {$pollFloor}, entradas que caducan en horas y un filtro para lo que nunca lees.",
			},
			developers: {
				title: "No te pierdas ninguna versión",
				description:
					"Destaca las notas de versión, entérate de los proyectos de los que dependes y deja que tu asistente resuma el resto.",
			},
			research: {
				title: "Encuéntralo dentro de dos años",
				description: "Busca con frases y OR, etiquetas en lo que guardas y un ZIP con todo.",
			},
			podcasts: {
				title: "Episodios junto a los ensayos",
				description:
					"Los episodios nuevos en la misma cola, reproducidos en la página de la entrada.",
			},
		},
		pages: {
			news: {
				meta: {
					title: "Reader para noticias",
					description:
						"Sigue noticias locales y del mundo por RSS: feeds activos revisados cada {$pollFloor}, plazos cortos para que las noticias viejas se vayan y filtros para el resto.",
				},
				title: "Las noticias, {#strong}sin que el feed decida por ti{/strong}",
				description:
					"Sigue los diarios y las redacciones locales que publican feeds. Los activos se revisan cada {$pollFloor}, las noticias viejas se van en el plazo que elijas y un filtro mantiene fuera de la vista las secciones que te saltas.",
				heroAlt:
					"Una cola de noticias: tres noticias sin leer de Harbor Daily y City Desk, y dos leídas atenuadas abajo.",
				capabilitiesTitle: "Hecho para feeds que nunca paran",
				spotlight: {
					eyebrow: "Plazos",
					title: "Las noticias de ayer se van solas",
					description:
						"Dale a un feed de noticias un plazo de 18 horas, o de 3 para noticias de última hora, y las entradas más viejas salen de tu cronología, las hayas leído o no. Las guardadas se quedan siempre.",
					checks: {
						one: "Cinco plazos, de 3 horas a para siempre",
						two: "Reader sugiere un plazo más corto para un feed activo que lo conserva todo",
						three: "Ningún plazo alcanza a las entradas guardadas",
					},
				},
				spotlightAlt:
					"La página de Harbor Daily con sus cinco plazos y la sugerencia de acortarlo para un feed que publica catorce veces al día.",
				faqTitle: "Preguntas de lectores de noticias",
				faq: {
					one: {
						q: "¿Qué tan rápido llega una noticia?",
						a: "Un feed que publica diez o más veces al día se revisa cada {$pollFloor}, y un sitio con un hub WebSub avisa en cuanto publica.",
					},
					two: {
						q: "¿Puedo ocultar una sección de un diario?",
						a: "Sí, con un filtro sobre el enlace o el título, en Paid y Premium.",
					},
				},
				closing: "Lee las noticias a tu propio ritmo",
			},
			developers: {
				meta: {
					title: "Reader para desarrolladores",
					description:
						"Sigue notas de versión, changelogs y blogs de ingeniería por RSS, destaca las versiones que importan y deja que un cliente MCP lea tu cola.",
				},
				title: "Notas de versión {#strong}que de verdad vas a ver{/strong}",
				description:
					"Sigue los changelogs y blogs de ingeniería de todo aquello de lo que dependes. Destaca las versiones, entérate de los parches de seguridad de los proyectos que importan y pregúntale a tu asistente qué cambió esta semana.",
				heroAlt:
					"La cola de un desarrollador: dos versiones de Kettle destacadas, una entrada de ingeniería y un postmortem guardado.",
				capabilitiesTitle: "Para los proyectos de los que dependes",
				spotlight: {
					eyebrow: "Agentes",
					title: "Pregunta qué salió esta semana",
					description:
						"Reader responde al Model Context Protocol, así el asistente de tu editor o tu terminal puede leer y buscar en tus feeds con un token que puedes revocar.",
					checks: {
						one: "Tokens de solo lectura para asistentes que solo resumen",
						two: "Busca con la misma sintaxis que la app",
						three: "Cada token muestra cuándo se usó por última vez",
					},
				},
				faqTitle: "Preguntas de desarrolladores",
				faq: {
					one: {
						q: "¿Puedo seguir versiones de GitHub?",
						a: "Funciona cualquier página de proyecto que publique un feed Atom o RSS, incluido el feed de versiones de un repositorio.",
					},
					two: {
						q: "¿Hay una API?",
						a: "El endpoint de agentes habla el Model Context Protocol sobre HTTP, con tokens bearer creados en Ajustes.",
					},
				},
				closing: "Sigue los proyectos de los que dependes",
			},
			research: {
				meta: {
					title: "Reader para investigación",
					description:
						"Sigue revistas, servidores de preprints y blogs de laboratorios por RSS, busca en todo lo que guardaste, etiqueta lo importante y expórtalo todo.",
				},
				title: "Una lista de lectura {#strong}que sigue ahí dentro de dos años{/strong}",
				description:
					"Sigue las revistas, los feeds de preprints y los blogs de laboratorios de tu campo. Busca en todo lo que guardaste con frases y OR, etiqueta las entradas que piensas citar y llévate un ZIP con todo cuando lo necesites.",
				heroAlt:
					"Una cola de investigación: los resultados de una encuesta de un laboratorio, dos preprints y una lista de lectura guardada.",
				capabilitiesTitle: "Para lecturas que se acumulan",
				spotlight: {
					eyebrow: "Búsqueda",
					title: "Busca en todo lo que guardaste",
					description:
						"La búsqueda lee el título, el resumen y el autor de cada entrada, y dice exactamente hasta dónde miró.",
					checks: {
						one: "Frases, OR, y menos o NOT",
						two: "Guarda hasta {$savedSearchLimit} búsquedas en la barra lateral",
						three: "En Paid y Premium, la búsqueda alcanza todo lo que guardaste",
					},
				},
				faqTitle: "Preguntas de investigadores",
				faq: {
					one: {
						q: "¿Cuántas entradas puedo guardar?",
						a: "Desde {$freePosts} en Free hasta {$premiumPosts} en Premium, y no se borra nada mientras estés dentro de esos números.",
					},
					two: {
						q: "¿Puedo exportar lo que guardé?",
						a: "Sí. El ZIP tiene cada entrada guardada con sus etiquetas en CSV y JSON.",
					},
				},
				closing: "Empieza la lista que vas a seguir usando",
			},
			podcasts: {
				meta: {
					title: "Reader para podcasts",
					description:
						"Sigue podcasts por su feed RSS y reproduce cada episodio en la página de la entrada, junto a los blogs y las noticias que lees.",
				},
				title: "Episodios en la misma cola {#strong}que todo lo demás{/strong}",
				description:
					"Un podcast es un feed. Síguelo como cualquier otro, y cada episodio nuevo llega a tu cola y se reproduce en la página de la entrada, con el reproductor de tu navegador.",
				heroAlt: "Una cola de podcasts: episodios nuevos de The Long Simmer y otros dos programas.",
				capabilitiesTitle: "Podcasts sin otra app",
				spotlight: {
					eyebrow: "Reproducción",
					title: "Escúchalo donde lo encontraste",
					description:
						"El audio o el video de un episodio se reproduce en la página de la entrada con los controles del navegador, y el archivo está a un enlace si prefieres descargarlo.",
					checks: {
						one: "Adjuntos de audio y video",
						two: "El reproductor de tu navegador",
						three: "Notificaciones de los programas que nunca te pierdes",
					},
				},
				faqTitle: "Preguntas de oyentes",
				faq: {
					one: {
						q: "¿Descarga los episodios?",
						a: "Los reproduce desde el servidor del programa. El archivo está enlazado si quieres conservarlo.",
					},
					two: {
						q: "¿Puedo enterarme cuando sale un episodio nuevo?",
						a: "Sí. Activa las notificaciones de ese programa, en Paid y Premium.",
					},
				},
				closing: "Sigue tus programas junto a tus lecturas",
			},
		},
	},

	compare: {
		eyebrow: "Reader vs {$competitor}",
		cta: "Inicia sesión para cambiarte",
		tableLink: "Ver la comparación",
		tableEyebrow: "Lado a lado",
		tableLabel: "Reader comparado con {$competitor}",
		column: "Comparado",
		checked:
			"Tomado de las páginas de cada producto el 31 de octubre de 2026. Las filas que no pudimos confirmar quedan fuera.",
		reasonsEyebrow: "Por qué cambiarte",
		winsEyebrow: "Con honestidad",
		winsTitle: "Cuándo {$competitor} puede ser mejor",
		switchEyebrow: "Cambiarte",
		switchTitle: "Múdate desde {$competitor} con un solo archivo",
		faqTitle: "Preguntas sobre dejar {$competitor}",
		others: "Otras comparaciones",
		closing: "Trae tus feeds de {$competitor}",
		switch: {
			export: {
				title: "Exporta desde {$competitor}",
				description: "Descarga tus suscripciones como un archivo OPML.",
			},
			import: {
				title: "Impórtalo en Reader",
				description: "Ajustes lee el archivo, sigue cada feed e informa a cuáles no pudo llegar.",
			},
			read: {
				title: "Lee",
				description: "Tus carpetas llegan con tus feeds, y las entradas anteriores llegan detrás.",
			},
		},
		rows: {
			freePlan: "Plan Free",
			history: "Entradas guardadas",
			filters: "Filtros por palabra clave",
			fullText: "Artículo completo en el lector",
			search: "Búsqueda",
			agents: "Agentes y API",
			export: "Exportación",
			apps: "Apps",
			newsletters: "Newsletters por correo",
			ai: "Funciones de IA",
			hosting: "Alojamiento",
		},
		reader: {
			freePlan: "{$freeFeeds} feeds, sin anuncios",
			history: "Hasta {$freePosts} entradas en Free; tú eliges cuánto se quedan las de cada feed",
			filters: "Descartar, marcar como leída o destacar; {$paidRules} filtros en Paid",
			fullText: "En Paid y Premium",
			search: "Últimos {$freeSearchDays} días en Free; todo lo guardado en Paid",
			agents: "Endpoint MCP en Paid, con tokens de lectura o escritura",
			export: "OPML con carpetas, y un ZIP con todo",
			apps: "App web, instalable, con notificaciones push",
			newsletters: "No disponible",
			ai: "Ninguna",
			hosting: "Alojado por nosotros",
		},
		pages: {
			feedly: {
				meta: {
					title: "Reader vs Feedly",
					description:
						"Una comparación honesta de Reader y Feedly: planes gratuitos, filtros, exportación, agentes, apps e IA.",
				},
				title: "Una cola, lo más reciente primero, {#strong}sin entradas patrocinadas{/strong}",
				description:
					"Feedly es una plataforma grande con feeds de IA y funciones para equipos. Reader es un lector de RSS tranquilo: una cola, sin anuncios, filtros que se leen como frases y todo exportable.",
				tableTitle: "Reader y Feedly, fila por fila",
				rows: {
					freePlan: "100 feeds en 3 carpetas, con anuncios patrocinados",
					filters: "Filtros para silenciar en Pro+",
					agents: "API en Enterprise; servidores MCP de la comunidad",
					export: "OPML de feeds RSS públicos",
					apps: "iOS y Android",
					newsletters: "En Pro+",
					ai: "AI Feeds, silenciar y deduplicar",
				},
				reasonsTitle: "Lo que ganas al dejar Feedly",
				reasons: {
					one: {
						title: "Sin anuncios, en ningún plan",
						description: "La cola del plan Free tiene solo lo que sigues.",
					},
					two: {
						title: "Filtros antes de Pro+",
						description: "Descartar, marcar como leída o destacar desde el plan Paid.",
					},
					three: {
						title: "Todo se va contigo",
						description: "OPML con carpetas y un ZIP de cada entrada que guardaste.",
					},
				},
				wins: {
					one: {
						title: "IA que sigue temas",
						description:
							"Los AI Feeds de Feedly siguen temas más allá de tus suscripciones. Reader lee solo lo que sigues.",
					},
					two: {
						title: "Apps móviles nativas",
						description:
							"Feedly tiene apps para iOS y Android. Reader es una app web que puedes agregar a tu pantalla de inicio.",
					},
					three: {
						title: "Equipos",
						description:
							"Feedly ofrece funciones para equipos y empresas. Reader es para la lectura de una persona.",
					},
				},
				faq: {
					one: {
						q: "¿Mis carpetas de Feedly vienen conmigo?",
						a: "Sí. La exportación OPML de Feedly lista los feeds bajo sus carpetas, y Reader los importa como carpetas.",
					},
					two: {
						q: "¿Reader tiene resúmenes con IA?",
						a: "No. Un cliente MCP que tú elijas puede leer tu cola si quieres que un asistente la resuma.",
					},
				},
			},
			inoreader: {
				meta: {
					title: "Reader vs Inoreader",
					description:
						"Una comparación honesta de Reader e Inoreader: planes gratuitos, reglas y filtros, artículos completos, búsqueda, agentes y apps.",
				},
				title: "Menos perillas, {#strong}una cola tranquila{/strong}",
				description:
					"Inoreader es un lector para usuarios avanzados con reglas, monitoreo y muchos tipos de fuente. Reader hace menos a propósito: una cola, lo más reciente primero, filtros como frases y un endpoint MCP para tu asistente.",
				tableTitle: "Reader e Inoreader, fila por fila",
				rows: {
					freePlan: "150 feeds",
					filters: "30 reglas y 50 filtros en Pro",
					fullText: "Incluido en Free",
					search: "Incluida en Free",
					agents: "API en Pro; servidores MCP de la comunidad",
					apps: "iOS y Android",
					newsletters: "20 newsletters en Pro",
					ai: "Resúmenes con IA en Pro",
				},
				reasonsTitle: "Lo que ganas al dejar Inoreader",
				reasons: {
					one: {
						title: "Una lista en lugar de un panel",
						description: "Cada entrada, lo más reciente primero, sin nada promocionado.",
					},
					two: {
						title: "Un endpoint para tu asistente",
						description:
							"Reader responde directamente al Model Context Protocol, con tokens que creas y revocas.",
					},
					three: {
						title: "Registros que nunca te nombran",
						description:
							"La telemetría de Reader puede decir qué host fue lento, nunca qué leíste.",
					},
				},
				wins: {
					one: {
						title: "Un plan gratuito más generoso",
						description:
							"El plan Free de Inoreader sigue 150 feeds y carga artículos completos; Reader deja los artículos completos para Paid.",
					},
					two: {
						title: "Más tipos de fuente",
						description:
							"Inoreader sigue cuentas sociales, páginas sin feed y newsletters. Reader sigue RSS y Atom.",
					},
					three: {
						title: "Apps con lectura sin conexión",
						description:
							"Las apps de Inoreader leen sin conexión y en voz alta. Reader es una app web.",
					},
				},
				faq: {
					one: {
						q: "¿Mis reglas de Inoreader vienen conmigo?",
						a: "No. El OPML lleva feeds y carpetas, no reglas. Volver a escribir cada filtro de Reader toma un minuto.",
					},
					two: {
						q: "¿Reader sigue newsletters?",
						a: "Solo las que publican un feed. Reader no te da una dirección de correo para suscribirte.",
					},
				},
			},
			feedbin: {
				meta: {
					title: "Reader vs Feedbin",
					description:
						"Una comparación honesta de Reader y Feedbin: planes gratuitos, historial, agentes, apps y newsletters.",
				},
				title: "Guarda años de entradas, {#strong}empieza con un plan gratuito{/strong}",
				description:
					"Feedbin es un lector respetado, solo de pago, con newsletters y un gran ecosistema de apps. Reader empieza gratis, guarda mucho más historial y responde a tu asistente por MCP.",
				tableTitle: "Reader y Feedbin, fila por fila",
				rows: {
					freePlan: "Ninguno; una prueba de 30 días y luego 7 USD al mes",
					history: "Los 400 artículos más recientes por feed",
					agents: "API REST; servidores MCP de la comunidad",
					apps: "App para iOS, y apps de terceros en otras plataformas",
					newsletters: "Incluido",
					ai: "Ninguna",
					hosting: "Alojado; código abierto bajo MIT",
				},
				reasonsTitle: "Lo que ganas al dejar Feedbin",
				reasons: {
					one: {
						title: "Un plan gratuito que dura",
						description: "Sigue tus primeros feeds sin el reloj de una prueba.",
					},
					two: {
						title: "El historial que tú eliges",
						description:
							"Cada feed conserva sus entradas desde tres horas hasta para siempre, dentro de lo que permite tu plan.",
					},
					three: {
						title: "Filtros como frases",
						description: "Descarta, marca como leídas o destaca entradas al llegar.",
					},
				},
				wins: {
					one: {
						title: "Newsletters y más",
						description:
							"Feedbin convierte newsletters, podcasts, YouTube y Mastodon en una sola lista. Reader lee feeds.",
					},
					two: {
						title: "Apps que se sincronizan",
						description:
							"Muchos lectores de terceros se sincronizan con Feedbin. Reader es su propia app web.",
					},
					three: {
						title: "Código abierto",
						description: "El código de Feedbin se publica bajo la licencia MIT.",
					},
				},
				faq: {
					one: {
						q: "¿Mis elementos destacados vienen conmigo?",
						a: "El OPML lleva tus feeds y carpetas. Las entradas guardadas empiezan de cero en Reader.",
					},
					two: {
						q: "¿Reader tiene una API para apps de terceros?",
						a: "El endpoint de agentes de Reader habla el Model Context Protocol; no hay una API de sincronización para otras apps de lectura.",
					},
				},
			},
			newsblur: {
				meta: {
					title: "Reader vs NewsBlur",
					description:
						"Una comparación honesta de Reader y NewsBlur: planes gratuitos, historias completas, búsqueda, agentes, apps y autoalojamiento.",
				},
				title: "Búsqueda y agentes {#strong}en el primer plan de pago{/strong}",
				description:
					"NewsBlur es un lector de código abierto con entrenamiento y un archivo permanente. Reader pone la búsqueda en todo lo que guardaste y un endpoint MCP en su primer plan de pago.",
				tableTitle: "Reader y NewsBlur, fila por fila",
				rows: {
					freePlan: "64 sitios",
					fullText: "En Premium",
					search: "En Premium",
					agents: "Servidor MCP oficial en Archive o Pro",
					apps: "iOS, Android y macOS, de código abierto",
					ai: "En Archive",
					hosting: "Alojado, o autoalojado gratis",
				},
				reasonsTitle: "Lo que ganas al dejar NewsBlur",
				reasons: {
					one: {
						title: "Más feeds gratis",
						description: "Sigue hasta {$freeFeeds} feeds sin pagar, lo más reciente primero.",
					},
					two: {
						title: "Agentes sin el nivel Archive",
						description: "El endpoint MCP de Reader viene con su primer plan de pago.",
					},
					three: {
						title: "Una pantalla más tranquila",
						description:
							"Una lista, sin entrenamiento que configurar, filtros que escribes como frases.",
					},
				},
				wins: {
					one: {
						title: "Entrenamiento",
						description:
							"NewsBlur aprende de los autores, etiquetas y títulos que te gustan o no. Reader solo hace lo que dicen tus filtros.",
					},
					two: {
						title: "Autoalojamiento",
						description:
							"El servidor y las apps de NewsBlur son de código abierto y funcionan en tu propia máquina.",
					},
					three: {
						title: "Apps nativas",
						description: "NewsBlur tiene apps para iOS, Android y macOS. Reader es una app web.",
					},
				},
				faq: {
					one: {
						q: "¿Mis carpetas de NewsBlur vienen conmigo?",
						a: "Sí, si la exportación lista los feeds bajo carpetas; Reader importa los esquemas del OPML como carpetas.",
					},
					two: {
						q: "¿Reader aprende lo que me gusta?",
						a: "No. La cola sigue el orden en que se escribieron las entradas; los filtros son lo único que la cambia, y los escribes tú.",
					},
				},
			},
		},
	},

	faq: {
		eyebrow: "Preguntas frecuentes",
		title: "Antes de iniciar sesión",
		more: "Más respuestas en {#link}la ayuda de Reader{/link}.",
		anyFeed: {
			q: "¿Funciona con cualquier sitio?",
			a: "Con cualquier sitio que publique RSS o Atom. Pega la dirección del sitio y Reader encuentra el feed que anuncia.",
		},
		free: {
			q: "¿Qué es gratis?",
			a: "Seguir {$freeFeeds} feeds, la cola, la búsqueda de los últimos {$freeSearchDays} días, las entradas guardadas y la importación y exportación OPML.",
		},
		over: {
			q: "¿Qué pasa si supero mi plan?",
			a: "No se borra nada. Lo nuevo se pausa hasta que vuelvas a estar dentro de los números o en un plan más grande.",
		},
		apps: {
			q: "¿Hay una app para el teléfono?",
			a: "Reader es una app web hecha también para teléfonos: agrégala a tu pantalla de inicio, desliza una fila para marcarla como leída y permite las notificaciones.",
		},
		move: {
			q: "¿Puedo traer mis feeds de otro lector?",
			a: "Sí. Importa su archivo OPML en Ajustes, con carpetas incluidas.",
		},
		privacy: {
			q: "¿Quién ve lo que leo?",
			a: "Nadie. No hay anuncios ni rastreo, y los registros de la app están escritos para que no puedan nombrar a un lector ni una entrada.",
		},
	},

	closing: {
		title: "Trae tu OPML y empieza a leer",
		description: "Inicia sesión, importa tu lista o sigue un feed, y lee lo más reciente primero.",
	},
};
