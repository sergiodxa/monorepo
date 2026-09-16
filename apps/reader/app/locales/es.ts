/**
 * Spanish translation dictionary, mirroring the English one key for key: the landing page,
 * the sign-in and sign-out flows, each reading surface, and the error copy. A key missing
 * here renders as the key itself, so the two files stay the same shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export default {
	app: {
		name: "Reader",
	},

	landing: {
		meta: {
			title: "Reader",
			description:
				"Sigue cualquier sitio que publique RSS o Atom y lee todo lo que escribe en un solo lugar, de lo más reciente a lo más antiguo.",
		},

		hero: {
			title: "Lee la web en tus propios términos",
			description:
				"Sigue cualquier sitio que publique RSS o Atom y lee todo lo que escribe en una sola cola. Ningún algoritmo decide el orden, y nada de lo que lees se vende.",
			cta: "Inicia sesión para empezar a leer",
		},

		features: {
			queue: {
				title: "Una cola, en orden",
				description:
					"Todas las entradas de todos los feeds que sigues, de la más reciente a la más antigua. Ningún algoritmo las reordena ni cuela nada entre ellas.",
			},
			private: {
				title: "Nadie mira lo que lees",
				description:
					"Lo que sigues y lo que has leído es tuyo. No hay rastreo, no hay publicidad y no hay nada que vender.",
			},
			openWeb: {
				title: "Construido sobre la web abierta",
				description:
					"Funciona con cualquier URL que publique RSS o Atom. Ninguna plataforma tiene que dar permiso, y nada queda detrás de una clave de API.",
			},
		},
	},

	auth: {
		error: {
			title: "No se pudo iniciar sesión",
			missingIdToken:
				"El proveedor de identidad respondió sin un ID token, así que nadie inició sesión.",
			generic: "Algo salió mal al iniciar tu sesión. Inténtalo de nuevo.",
		},
	},

	logout: {
		title: "Cerrar sesión",
		cta: "Cerrar sesión",
	},

	/**
	 * Notifications: what a scheduled check says when it finds something, how the reader is
	 * reached, and the two places they decide any of it.
	 */
	notifications: {
		/** The line a lock screen and an inbox both lead with, which is a count and nothing else. */
		title_one: "Una publicación nueva",
		title_other: "{{count}} publicaciones nuevas",
		/** Up to three publishers by name, which is what makes the count worth tapping. */
		body_one: "De {{feeds}}.",
		body_other: "De {{feeds}}.",

		email: {
			footer:
				"Recibís esto porque pediste enterarte de algunas de las fuentes que seguís. Podés cambiarlo en Ajustes.",
		},

		legend: "Notificaciones",
		description:
			"Cuando una revisión encuentra publicaciones en una fuente que elegiste, recibís una sola notificación por todas. Nunca se envía nada de una fuente que no elegiste.",
		noFeeds: "Todavía no elegiste ninguna fuente. Abrí una fuente y activá las notificaciones ahí.",
		noChannel: "Elegiste fuentes y no hay por dónde avisarte. Activá una opción abajo.",

		channels: {
			legend: "Por dónde te avisamos",
			push: "En los navegadores que permitas",
			pushHint: "Tu navegador te lo va a preguntar una vez. No se envía nada hasta que aceptes.",
			email: "Por correo",
			emailHint: "Como mucho una vez cada cuatro horas, a {{address}}.",
			emailUnknown: "Como mucho una vez cada cuatro horas.",
			emailLocked: "El correo viene con el plan Premium.",
			save: "Guardar",
			saved: "Guardado.",
			notEntitled: "El correo viene con el plan Premium, así que no cambió nada.",
		},

		quiet: {
			legend: "Horas de silencio",
			description:
				"No llega nada entre estas horas. Una notificación retenida no se pierde: la próxima revisión fuera de la ventana la lleva.",
			enabled: "No me avises entre estas horas",
			from: "Desde",
			to: "Hasta",
			hour: "{{hour}}:00",
			zone: "Se leen en {{zone}}, según lo informó tu navegador.",
			save: "Guardar",
			saved: "Guardado.",
		},

		devices: {
			legend: "Navegadores",
			description: "Cada navegador que permitiste. Olvidar uno deja de notificarlo.",
			none: "Todavía no hay ningún navegador registrado.",
			added: "Agregado el {{date}}",
			never: "Todavía no se entregó nada",
			delivered: "Última entrega el {{date}}",
			forget: "Olvidar",
			forgotten: "Ese navegador no va a recibir más notificaciones.",
			missing: "Ese navegador ya estaba olvidado.",
		},

		feed: {
			legend: "Notificaciones",
			description:
				"Enterate de esta fuente cuando una revisión encuentre algo. Por dónde te avisamos se configura una sola vez, en Ajustes.",
			on: "Avisarme de esta fuente",
			off: "Dejar de avisarme de esta fuente",
			turnedOn: "Te vamos a avisar de esta fuente.",
			turnedOff: "No te vamos a avisar de esta fuente.",
			missing: "No se encontró esa fuente.",
		},
	},

	/** The sidebar every signed-in page wears. */
	nav: {
		label: "Secciones",
		reading: "Lectura",
		saved: "Guardadas",
		feeds: "Feeds",
		subscriptions: "Feeds que sigues",
		/** The feeds a reader pinned, drawn first because that is what pinning was for. */
		pinned: "Fijados",
		/** The feeds nobody grouped and that publish almost nothing, drawn last. */
		quiet: "Tranquilos",
		openSidebar: "Mostrar feeds y búsqueda",
		settings: "Preferencias",
		account: "Tu cuenta",
		logout: "Cerrar sesión",
	},

	/** The box the sidebar searches every followed feed's posts from. */
	search: {
		label: "Busca en tus entradas",
		placeholder: "¿Qué estás buscando?",
	},

	/** The keys the reading surfaces are worked with, and the panel that lists them. */
	shortcuts: {
		open: "Atajos de teclado",
		description: "Presioná una tecla mientras leés. Mientras escribís en un campo, no hacen nada.",
		close: "Cerrar",
		keys: {
			nextPost: "Entrada siguiente",
			previousPost: "Entrada anterior",
			openPost: "Abrir la entrada",
			markRead: "Marcar como leída o no leída",
			savePost: "Guardar la entrada, o dejar de guardarla",
			checkFeeds: "Revisar todas las fuentes",
			nextFeed: "Fuente siguiente",
			previousFeed: "Fuente anterior",
			search: "Busca en tus entradas",
			help: "Mostrar estos atajos",
		},
	},

	/** Shared by both timelines, which offer the same way through a long list of posts. */
	/**
	 * Leer una entrada en su propia página: lo que dio el feed, y el artículo detrás del
	 * enlace cuando el plan del lector incluye ir a buscarlo.
	 */
	post: {
		notFound: {
			title: "Esa entrada no está aquí",
			description: "Puede haber caducado en tu cronología, o nunca fue tuya.",
			back: "Volver a tu cola",
		},
		/** De dónde vino la entrada, dicho sobre el artículo como enlace al original. */
		source: "De {{feed}}",
		original: "Abrir el original",
		back: "Volver a {{feed}}",
		/** Lo que guardar conserva de verdad, dicho en el control y no descubierto años después. */
		saveKeeps:
			"Guardar conserva el título, el extracto y el enlace. Cuando el sitio desaparezca, el enlace también.",
		article: {
			heading: "El artículo",
			pending: "Buscando el artículo\u2026",
			/** Cada uno de estos deja el extracto y el enlace exactamente donde estaban. */
			refused: "Este sitio no permite leerlo aquí.",
			timeout: "Esta página tardó demasiado en leerse.",
			empty: "No hay nada que leer aquí.",
			/** Dicho a quien tiene un plan que no incluye ir a buscar el artículo. */
			upgrade: "Leer artículos aquí mismo forma parte del plan de pago.",
			/** De quién es el artículo, impreso bajo su propio título. */
			byline: "Por {{byline}}",
		},

		/** The episode or the clip the post came with, played by the browser's own element. */
		media: {
			label: "Reproducir el audio o el video de esta entrada",
			unsupported: "Tu navegador no puede reproducir este archivo.",
			download: "Abrilo directamente.",
		},
	},

	timeline: {
		newer: "Entradas más recientes",
		older: "Entradas más antiguas",
		markRead: "Marcar como leída",
		markUnread: "Marcar como no leída",
		markFailed: "No se pudo marcar; inténtalo de nuevo",
		read: "Leída",
		/** Keeping a post, which is the one thing here no rule that deletes a post reaches. */
		save: "Guardar",
		unsave: "Quitar de guardadas",
		saveFailed: "No se pudo guardar; inténtalo de nuevo",
		/** Said where a save was refused outright, which is a shelf with no room left on it. */
		saveFull: "Tus entradas guardadas están llenas; quita una para hacer sitio",
		/** That a post is being kept, for a reader who cannot see the mark it is kept with. */
		saved: "Guardada",
		/** Que uno de los filtros de la lectora eligió esta entrada al llegar. */
		flagged: "Destacada",
		openPost: "Abrir entrada",
		readHere: "Leer aquí",
		publishedOn: "Publicada el {{date}}",
		byAuthor: "por {{author}}",
		badCursor: "Esa página ya no existe.",
		restart: "Volver a lo más reciente",
		/**
		 * Marking a whole queue read is one sweep with no undo, so the trigger opens a
		 * prompt carrying the warning rather than acting on the first click.
		 */
		markAllRead: {
			/** Short enough for a row of controls, and still saying how far the sweep reaches. */
			submit: "Marcar todo leído",
			title: "Marcar todo como leído",
			confirm:
				"¿Marcar como leídas todas las entradas sin leer, de todos los feeds que sigues? Aquí no queda registro de cuáles estaban sin leer, así que no se puede deshacer.",
			cancel: "Cancelar",
		},
		markFeedRead: "Marcar feed leído",
		/** Said where the list stops, so it is known to have an end rather than to go on. */
		end: "Has llegado al final.",
		markedRead_one: "{{count}} entrada marcada como leída.",
		markedRead_other: "{{count}} entradas marcadas como leídas.",
		nothingToMark: "No había nada sin leer que marcar.",
	},

	reading: {
		heading: "Lectura",
		/** The same queue, narrowed to words somebody typed, which the heading says back. */
		headingFor: "Leyendo sobre «{{query}}»",
		/**
		 * What the queue knows is missing from it, which is the question a reader opening it
		 * has and the one nothing here could answer before. The posts are being fetched behind
		 * the page, so the sentence says that rather than offering a button that waits for them.
		 */
		waiting_one: "Un feed tiene entradas que todavía no tienes. Están llegando ahora.",
		waiting_other: "{{count}} feeds tienen entradas que todavía no tienes. Están llegando ahora.",
		/** Which of the queue's posts the page holds, named beside the heading. */
		filter: {
			label: "Mostrar",
			all: "Todas",
			unread: "Sin leer",
			read: "Leídas",
		},
		/**
		 * An empty queue reads differently under each filter: nothing published, nothing left
		 * to read, and nothing read so far are three different pieces of news.
		 */
		empty: {
			all: {
				title: "Todavía no hay nada aquí",
				description: "Los feeds que sigues no han publicado nada por ahora.",
			},
			unread: {
				title: "Estás al día",
				description: "Has leído todas las entradas de todos los feeds que sigues.",
			},
			read: {
				title: "Todavía no has leído nada",
				description: "Las entradas se acumulan aquí según las abres o las marcas como leídas.",
			},
		},
		/**
		 * A search that found nothing says so about the words rather than about the queue,
		 * and under a filter it says which of the two came up empty, since widening the
		 * filter is what a reader does next.
		 */
		found: {
			all: {
				title: "No hay coincidencias",
				description:
					"La búsqueda lee el título, el resumen y el autor de cada entrada, no el artículo que hay detrás.",
			},
			unread: {
				title: "Nada sin leer coincide",
				description:
					"La búsqueda lee el título, el resumen y el autor de cada entrada sin leer. Prueba Todas.",
			},
			read: {
				title: "Nada leído coincide",
				description:
					"La búsqueda lee el título, el resumen y el autor de cada entrada que has leído. Prueba Todas.",
			},
		},
		/**
		 * What a search page looked at, said under the list. A search that shows nothing has
		 * to name the span it covered, because the confusing failure is the one where the
		 * post exists and the search was never allowed to reach it.
		 */
		searched: {
			/** Stopped at a step, which the reader carries on from with the same link. */
			step: "Se buscó hasta el {{date}}.",
			continue: "Seguir buscando",
			/** Stopped at the oldest post the tier lets a search reach. */
			window:
				"Se buscó hasta el {{date}}. El plan gratuito busca en los últimos {{days}} días. Con el plan de pago se busca en todo lo que has guardado.",
			/** Stopped at the oldest post stored, so there is nothing further to search. */
			archive: "Se buscó en todo lo que has guardado, hasta el {{date}}.",
		},
		noFeeds: {
			title: "Todavía no hay nada que leer",
			description:
				"Pega en la caja de arriba la dirección de un feed, o la de un sitio que publique uno.",
		},
	},

	/** The queries a reader kept, which the rail draws as addresses of the queue itself. */
	searches: {
		/** Names the rail's band of kept queries. */
		label: "Búsquedas guardadas",
		save: "Guardar esta búsqueda",
		nameLabel: "Ponle nombre a la búsqueda",
		namePlaceholder: "Cómo llamarla",
		saved: "Búsqueda guardada.",
		forget: "Olvidar esta búsqueda",
		forgotten: "Búsqueda olvidada.",
		error: {
			invalidName: "Ponle a la búsqueda un nombre de hasta {{length}} caracteres.",
			invalidQuery: "Escribe algo que buscar antes de guardarlo.",
			duplicateName: "Ya tienes una búsqueda guardada con ese nombre.",
			notFound: "Esa búsqueda guardada ya no está ahí.",
			full: "Tienes {{limit}} búsquedas guardadas: olvida una para hacer sitio.",
		},
	},

	/** The posts a reader asked to keep, which is the one list here nothing prunes. */
	saved: {
		title: "Guardadas",
		heading: "Guardadas",
		empty: {
			title: "Todavía no has guardado nada",
			description:
				"Guarda una entrada desde cualquier lista y se queda aquí, por vieja que se haga y haga lo que haga el feed del que vino.",
		},
	},

	feeds: {
		/** How many of a feed's posts are waiting, said beside its name in the sidebar. */
		unread_one: "{{count}} sin leer",
		unread_other: "{{count}} sin leer",

		follow: {
			label: "Dirección del feed o del sitio",
			placeholder: "Sigue un feed o un sitio…",
			error: {
				invalidUrl:
					"Esa no es una dirección que esta aplicación pueda pedir. Usa una que empiece por http o https.",
				notFound: "En esa dirección no hay ningún feed RSS ni Atom.",
				unreachable: "No se pudo llegar a esa dirección. Inténtalo de nuevo en un momento.",
				alreadyFollowing: "Ya sigues ese feed.",
				/**
				 * The one refusal here whose sentence carries a number, because the way out is the
				 * reader's and it is a count. It names both ways out and puts neither first.
				 */
				overLimit_one:
					"Tu plan sigue {{count}} feed. Deja de seguir uno, o cambia de plan, para seguir otro.",
				overLimit_other:
					"Tu plan sigue {{count}} feeds. Deja de seguir uno, o cambia de plan, para seguir otro.",
			},
		},

		/** Pinning a feed above the queue, from that feed's own page. */
		pin: {
			label: "Feeds fijados",
			submit: "Fijar",
			remove: "Dejar de fijar",
			pinned: "Fijado encima de tu lectura.",
			unpinned: "Quitado de la franja de fijados.",
			full: "Ya tienes fijados tantos feeds como caben en la franja. Quita uno para fijar otro.",
			/** Said on a pinned feed with nothing waiting, which is the point of pinning it. */
			caughtUp: "Nada nuevo.",
		},

		show: {
			title: "Feed",
			visitSite: "Ir al sitio",
			checked: "Revisado el {{date}}",
			neverChecked: "Aún sin revisar",
			failing_one: "La última revisión falló",
			failing_other: "Las últimas {{count}} revisiones fallaron",
			/** How many checks failed and what the last one recorded, read as one badge. */
			failingBecause: "{{failures}}: {{reason}}",
			empty: {
				title: "Todavía no hay entradas",
				description: "Este feed no ha publicado nada desde que empezaste a seguirlo.",
			},
			notFound: {
				title: "Feed no encontrado",
				description: "No sigues ningún feed con esa dirección.",
				back: "Volver a tu lectura",
			},
		},

		/** Checking every followed feed at once, from the reading queue. */
		checkAll: {
			/** Said against the feed page's own "Revisar feed", so the reach of each is plain. */
			submit: "Revisar todos",
			done_one: "Se revisó {{count}} feed.",
			done_other: "Se revisaron {{count}} feeds.",
			newPosts_one: "{{count}} feed tenía entradas nuevas.",
			newPosts_other: "{{count}} feeds tenían entradas nuevas.",
			nothingNew: "Ningún feed tenía nada nuevo.",
			failed_one: "No se pudo llegar a {{count}} feed.",
			failed_other: "No se pudo llegar a {{count}} feeds.",
		},

		/** Carrying subscriptions to and from another reader. */
		transfer: {
			/** Names the section on the settings page that carries subscriptions in and out. */
			legend: "Llevarte tus suscripciones",
			export: "Descargar como OPML",
			/** The exported document's own title, which the receiving reader shows. */
			documentTitle: "Suscripciones de Reader",
			import: {
				label: "Archivo OPML",
				description: "Una lista de suscripciones exportada de otro lector.",
				submit: "Importar",
				added_one: "Ahora sigues {{count}} feed nuevo.",
				added_other: "Ahora sigues {{count}} feeds nuevos.",
				alreadyFollowing_one: "Ya seguías {{count}}.",
				alreadyFollowing_other: "Ya seguías {{count}}.",
				failed_one: "No se pudo obtener {{count}}.",
				failed_other: "No se pudieron obtener {{count}}.",
				empty: "Ese archivo no lista ningún feed.",
				unreadable: "No se pudo leer ese archivo como OPML.",
				tooLarge:
					"Ese archivo es más grande de lo que esta aplicación lee. Una lista de suscripciones ocupa unos cientos de kilobytes como mucho.",
				missing: "Elige un archivo OPML para importar.",
			},
		},

		/**
		 * The menu holding every action on a feed that is not one of the two a reader
		 * reaches for while reading it.
		 */
		more: {
			legend: "Más acciones",
		},

		/** What asking for a feed to be checked on the spot reports back. */
		check: {
			submit: "Revisar feed",
			new: "Llegaron entradas nuevas.",
			none: "Nada nuevo desde la última revisión.",
			failed:
				"No se pudo llegar a ese feed ahora mismo. La próxima revisión programada lo intentará de nuevo.",
		},

		/**
		 * How long this feed's posts stay in the reader's own timeline. Each span says what it
		 * is for as well as how long it holds, since the name alone is a category and the hours
		 * alone are a number: a reader choosing between them is matching the two.
		 */
		/**
		 * The one preference about privacy a reader is offered, and it exists because two
		 * readers can correctly want different answers: almost every publisher's server is
		 * indifferent to a campaign parameter, and the rare one that routes on it answers a
		 * broken address without it.
		 */
		linkParameters: {
			keep: "Conservar los parámetros del enlace",
			strip: "Quitar los parámetros del enlace",
			kept: "Los enlaces de este feed ahora se abren tal como se publicaron.",
			stripped: "Se vuelven a quitar los parámetros de seguimiento de los enlaces de este feed.",
		},

		velocity: {
			legend: "Cuánto tiempo se quedan estas entradas",
			description:
				"Las entradas más viejas salen de tu lectura, las hayas leído o no. Las guardadas se quedan siempre.",
			saved: "Guardado.",
			invalid: "Ese no es uno de los plazos disponibles.",
			name: {
				breaking: "De última hora",
				news: "Noticias",
				article: "Artículos",
				essay: "Ensayos",
				evergreen: "Siempre",
			},
			window: {
				breaking: "3 horas",
				news: "18 horas",
				article: "3 días",
				essay: "2 semanas",
				evergreen: "No se va nunca",
			},
			/**
			 * Offered beside the control rather than acted on: a measurement is a good reason to
			 * ask a reader a question and a bad reason to delete their posts, so this says what
			 * the feed does and leaves the answer where it was.
			 */
			suggestion_one:
				"Este feed publica alrededor de {{count}} entrada al día y aquí no se va nunca ninguna. Un plazo más corto evita que se te acumulen.",
			suggestion_other:
				"Este feed publica alrededor de {{count}} entradas al día y aquí no se va nunca ninguna. Un plazo más corto evita que se te acumulen.",
		},

		unfollow: {
			title: "Dejar de seguir un feed",
			submit: "Dejar de seguir",
			/** Backs out of the prompt, leaving the feed followed. */
			cancel: "Cancelar",
			confirm:
				"¿Dejar de seguir {{title}}? Sus entradas, y lo que hayas leído de ellas, se van con él.",
		},

		/** What the last refresh of a feed recorded, shown beside a feed that is struggling. */
		status: {
			http_error: "El sitio respondió con un error",
			network_error: "No se pudo llegar al sitio",
			parse_error: "No se pudo leer el feed",
		},
	},

	/**
	 * Named groups of subscriptions, each read as one stream. A folder is somewhere a
	 * reader goes rather than a place posts are kept, which is why nothing here talks about
	 * losing any.
	 */
	folders: {
		created: "Carpeta creada.",
		renamed: "Carpeta renombrada.",
		duplicate: "Ya tienes una carpeta con ese nombre.",
		invalid: "Una carpeta necesita un nombre.",

		/** The field both the naming forms type into. */
		name: {
			label: "Nombre de la carpeta",
			placeholder: "Nombra esta carpeta…",
		},

		create: {
			legend: "Crear una carpeta",
			submit: "Nueva carpeta",
		},

		rename: {
			legend: "Renombrar esta carpeta",
			submit: "Renombrar",
		},

		delete: {
			title: "Eliminar una carpeta",
			submit: "Eliminar carpeta",
			/** Backs out of the prompt, leaving the folder as it is. */
			cancel: "Cancelar",
			/** Says what is lost, which is the filing and nothing else. */
			confirm:
				"¿Eliminar {{title}}? Sus feeds vuelven con los que no están en ninguna carpeta y conservan todas sus entradas.",
		},

		/** Putting one feed into a folder, from that feed's own page. */
		file: {
			legend: "En qué carpeta se lee este feed",
			description: "Elige una carpeta o nombra una nueva.",
			/** What the control says for a feed the reader has filed nowhere. */
			none: "Sin carpeta",
			remove: "Sacar de esta carpeta",
			submit: "Guardar",
			filed: "Guardado en la carpeta.",
			unfiled: "Sacado de su carpeta.",
			gone: "Esa carpeta ya no es una de las tuyas.",
		},

		empty: {
			title: "Aquí todavía no hay nada",
			description:
				"Guarda un feed en esta carpeta desde la página de ese feed y sus entradas aparecen aquí.",
		},

		notFound: {
			title: "Carpeta no encontrada",
			description: "No tienes una carpeta con esa dirección.",
			back: "Volver a tu lectura",
		},
	},

	/**
	 * The labels a reader puts on the posts they kept. A label answers why something was
	 * kept, where a folder answers where a publication belongs, so nothing here talks about
	 * subscriptions and nothing here deletes a post.
	 */
	/**
	 * Las reglas que una lectora escribe sobre lo que dice una entrada, aplicadas cuando
	 * llegan. Cada frase está escrita para que una regla se lea como una: cuando el <campo>
	 * de una entrada contiene <texto>, <acción>.
	 */
	rules: {
		title: "Filtros",
		heading: "Filtros",
		description:
			"Un filtro lee una parte de la entrada, busca un texto en ella y decide qué pasa con esa entrada al llegar. Los filtros actúan sobre lo que llegue de ahora en adelante y dejan intacto todo lo que ya está aquí.",
		/** La única sorpresa del lenguaje, dicha donde se elige el campo y no después. */
		summaryCaveat:
			"Un filtro sobre el resumen lee los primeros 280 caracteres, que son la línea bajo el título, no el artículo.",
		/** Dicho a quien tiene un plan que no ejecuta filtros, y que no borra ninguno suyo. */
		notEntitled:
			"Los filtros forman parte de un plan de pago. Nada de lo que sigues o has leído cambia.",
		empty: "Todavía no tienes filtros.",
		/** Una regla, leída como la frase que es. */
		sentence: "Cuando el {{field}} de una entrada contiene «{{value}}», {{action}}.",
		scope: {
			all: "Todos los feeds que sigues",
			feed: "Solo {{feed}}",
		},
		fields: {
			legend: "Parte de la entrada",
			title: "título",
			url: "enlace",
			summary: "resumen",
			author: "autoría",
		},
		actions: {
			legend: "Qué le pasa",
			drop: "descártala",
			mark_read: "márcala como leída",
			flag: "destácala",
		},
		/** Lo que dicen los contadores de una regla, el número que dice que funciona. */
		matched_one: "Ha decidido {{count}} entrada.",
		matched_other: "Ha decidido {{count}} entradas.",
		neverMatched: "Este filtro no ha coincidido con ninguna entrada.",
		lastMatched: "Última coincidencia: {{date}}.",
		form: {
			legend: "Añadir un filtro",
			value: "Texto a buscar",
			valuePlaceholder: "Patrocinado…",
			feed: "Dónde se aplica",
			allFeeds: "Todos los feeds que sigues",
			submit: "Añadir filtro",
			update: "Guardar cambios",
			delete: "Eliminar filtro",
		},
		/** La vista previa, lo único que mira hacia atrás y no escribe nada. */
		preview: {
			legend: "Qué habría capturado",
			submit: "Vista previa",
			result_one: "{{count}} de tus {{scanned}} entradas más recientes coincide.",
			result_other: "{{count}} de tus {{scanned}} entradas más recientes coinciden.",
			none: "Ninguna de tus {{scanned}} entradas más recientes coincide. Revisa la parte de la entrada que elegiste y cómo escribiste el texto.",
			/** La única forma que merece un aviso: un texto que todas llevan vacía la lista. */
			everything:
				"Esto coincide con todas tus entradas más recientes. Un filtro que las descarte todas deja un feed sincronizando hacia una lista vacía.",
			apply_one: "Aplicar a la {{count}} entrada de arriba",
			apply_other: "Aplicar a las {{count}} entradas de arriba",
			applied_one: "Se actuó sobre {{count}} entrada.",
			applied_other: "Se actuó sobre {{count}} entradas.",
		},
		notice: {
			created: "Filtro añadido. Actúa sobre lo que llegue de ahora en adelante.",
			updated: "Filtro guardado.",
			deleted: "Filtro eliminado. No se quitó ninguna entrada.",
			limit: "Tienes tantos filtros como permite tu plan. Elimina uno para añadir otro.",
			invalidValue: "Un filtro necesita un texto de hasta 100 caracteres para buscar.",
			invalidField: "Esa no es una de las partes de una entrada que un filtro puede leer.",
			invalidAction: "Eso no es una de las cosas que un filtro puede hacer.",
			notFollowing: "Ese no es un feed que sigas.",
			missing: "Ese filtro ya no es tuyo.",
		},
	},

	tags: {
		created: "Etiqueta creada.",
		renamed: "Etiqueta renombrada.",
		duplicate: "Ya tienes una etiqueta con ese nombre.",
		invalid: "Una etiqueta necesita un nombre de hasta 32 caracteres.",
		full: "Ya tienes tantas etiquetas como caben. Borra una para crear otra.",
		/** A post carrying ten reasons to have been kept has none, which is what this says. */
		postFull: "Esa entrada ya lleva tantas etiquetas como puede llevar una entrada.",
		/** Labelling keeps the post, so a full shelf refuses the label for the same reason. */
		savedFull:
			"Tus entradas guardadas están llenas, así que no se etiquetó nada. Quita una para hacer sitio.",
		notEntitled:
			"Las etiquetas son parte de un plan de pago. Todo lo que has guardado sigue donde está.",
		missing: "Esa etiqueta ya no es tuya.",

		/** The field both the naming forms type into. */
		name: {
			label: "Nombre de la etiqueta",
			placeholder: "Nombra esta etiqueta…",
		},

		/** The strip of labels under a kept post, and the field that adds another. */
		strip: {
			legend: "Etiquetas de esta entrada",
			add: "Añadir una etiqueta",
			placeholder: "Etiqueta…",
			remove: "Quitar",
		},

		rename: {
			legend: "Renombrar esta etiqueta",
			submit: "Renombrar",
		},

		delete: {
			title: "Borrar una etiqueta",
			submit: "Borrar etiqueta",
			/** Backs out of the prompt, leaving the label as it is. */
			cancel: "Cancelar",
			/** Says what is lost, which is the label and nothing else. */
			confirm_one: "¿Borrar {{name}}? {{count}} entrada deja de llevarla y sigue guardada.",
			confirm_other: "¿Borrar {{name}}? {{count}} entradas dejan de llevarla y siguen guardadas.",
		},

		empty: {
			title: "Aún no hay nada con esta etiqueta",
			description: "Pon esta etiqueta en una entrada desde tus guardadas y aparecerá aquí.",
		},

		notFound: {
			title: "Etiqueta no encontrada",
			description: "No tienes una etiqueta con esa dirección.",
			back: "Volver a tus entradas guardadas",
		},
	},

	items: {
		read: {
			title: "Marcar como leído",
			notFound: "Esa entrada no está en tu cola de lectura.",
		},
		save: {
			title: "Guardar una entrada",
			notFound: "Esa entrada no está en tu cola de lectura.",
			/**
			 * A full shelf is told to the reader rather than made room on, since making room
			 * would delete a post they asked to keep. The way out is theirs to choose.
			 */
			full: "Has guardado tantas entradas como caben aquí. Quita una de Guardadas para hacer sitio a otra.",
		},
	},

	settings: {
		title: "Preferencias",
		heading: "Preferencias",
		/**
		 * What the schedule is, rather than a choice of one. Checking a feed more often spends
		 * the bandwidth of the site publishing it, and a reader who wants a feed sooner has the
		 * check they can ask for on the feed's own page, which is what this points them at.
		 */
		cadence: {
			legend: "Cómo se revisan tus feeds",
			description:
				"Cada feed se revisa una vez al día. Para ver uno antes, ábrelo y usa Revisar feed.",
		},
		lastRefreshed: "Revisado por última vez el {{date}}",
		neverRefreshed: "Aún sin revisar",

		/**
		 * What the reader may change about how their pages look, which is everything this app
		 * offers on the subject: a scheme and a reading face.
		 */
		appearance: {
			legend: "Cómo se ven tus páginas",
			description:
				"Las dos te siguen a cualquier navegador donde inicies sesión, y se aplican en la próxima página.",
			theme: {
				label: "Colores",
				names: {
					system: "Seguir a mi sistema",
					light: "Claro",
					dark: "Oscuro",
				},
			},
			face: {
				label: "Tipografía de lectura",
				names: {
					sans: "Sin serifa",
					serif: "Con serifa",
				},
				hint: "La tipografía se usa en las entradas y los artículos. Los menús y los controles no cambian.",
			},
			save: "Guardar",
			saved: "Guardado.",
		},

		/**
		 * What the reader is on and what it allows, said in numbers. Nothing here counts down,
		 * because nothing expires and nothing is deleted: a countdown on a page where nothing
		 * is going to happen is urgency invented to sell.
		 */
		plan: {
			legend: "Tu plan",
			current: "Estás en {{plan}}.",
			names: {
				free: "Gratis",
				paid: "De pago",
				premium: "Premium",
			},
			/** What each plan allows, as the numbers the reader is measured against. */
			allowance: "{{feeds}} feeds, {{saved}} entradas guardadas, {{posts}} entradas en total.",
			history: "No se borra nada mientras estés dentro de estos números.",
			/**
			 * Lo que añade el plan De pago más allá de los números, dicho donde se decide si
			 * pagarlo. Los agentes se nombran aquí porque son lo único de este plan por lo que
			 * alguien puede estar pagando por sí solo.
			 */
			includes:
				"De pago además lee los artículos en el sitio, ejecuta tus filtros, crea carpetas y etiquetas, y responde a un agente por el Model Context Protocol.",
			usage: "Sigues {{feeds}} feeds y tienes {{saved}} entradas guardadas.",
			upgrade: "Cambiar a {{plan}}",
			manage: "Gestionar la facturación",
			/**
			 * A failed card is not a data event on the day it fails. The sentence says what is
			 * true — nothing has changed — and points at the page where a card is replaced.
			 */
			lapsed:
				"Tu pago no se completó. Nada ha cambiado y todo lo que sigues está aquí. Actualiza tu tarjeta para que siga así.",
			/**
			 * Over a limit, stated as the two ways out and no third. Both belong to the reader,
			 * and nothing of theirs is deleted while they decide.
			 */
			over: {
				legend: "Por encima de tu plan",
				description:
					"No se ha borrado nada, y no se borrará. Las altas nuevas están en pausa hasta que vuelvas dentro de estos números o pases a un plan mayor.",
				feeds_one: "Deja de seguir {{count}} feed, o cambia de plan.",
				feeds_other: "Deja de seguir {{count}} feeds, o cambia de plan.",
				saved_one: "Quita {{count}} entrada guardada, o cambia de plan.",
				saved_other: "Quita {{count}} entradas guardadas, o cambia de plan.",
				posts_one: "{{count}} entrada por encima de lo que guarda este plan.",
				posts_other: "{{count}} entradas por encima de lo que guarda este plan.",
				rules_one: "{{count}} regla por encima de las que ejecuta este plan.",
				rules_other: "{{count}} reglas por encima de las que ejecuta este plan.",
			},
		},
	},

	/**
	 * Lo que se le dice a quien lee sobre la superficie para agentes: la dirección, los
	 * tokens que emite para ella y los rechazos que un cliente recibe de vuelta.
	 */
	agent: {
		legend: "Agentes",
		description:
			"Apunta un asistente a tus fuentes y léelas sin abrir esta aplicación. Puede listar lo que sigues, leer tu cola, buscarla y, si se lo permites, marcar entradas como leídas, guardarlas y seguir o dejar de seguir una fuente.",
		endpoint: "La dirección que le darás a un cliente es {{url}}.",
		locked:
			"Los agentes vienen con el plan De pago. Nada de lo que tienes cambia hasta que mejores el plan.",

		scopes: {
			read: "Solo lectura",
			write: "Lectura y escritura",
		},

		mint: {
			name: "¿Para qué es?",
			placeholder: "Asistente del portátil",
			scope: "Qué puede hacer",
			scopeHint:
				"Un token de lectura nunca puede marcar, guardar, seguir ni dejar de seguir nada. Elígelo salvo que el asistente necesite actuar.",
			submit: "Emitir un token",
		},

		minted: {
			title: "Tu nuevo token",
			heading: "Tu nuevo token",
			description: "Pégalo en la configuración de tu cliente como token de portador.",
			once: "Esta es la única vez que se muestra. Emite otro si lo pierdes.",
			back: "Volver a ajustes",
		},

		tokens: {
			none: "Todavía no has emitido ningún token.",
			revoke: "Revocar",
			revoked: "Ese token no volverá a responder.",
			missing: "Ese token ya estaba revocado.",
			expires: "Caduca el {{date}}",

			state: {
				never: "Nunca usado",
				used: "Usado por última vez {{date}}",
				revoked: "Revocado {{date}}",
				expired: "Caducó {{date}}",
			},

			refused: {
				"invalid-name": "Dale un nombre al token para que puedas reconocerlo después.",
				"invalid-scope": "Elige qué puede hacer el token.",
				"token-limit": "Ya tienes tantos tokens como se guardan aquí. Revoca uno primero.",
				"not-entitled": "Los agentes vienen con el plan De pago, así que no se emitió nada.",
			},
		},

		page: {
			title: "Agentes",
			heading: "Agentes",
			description:
				"Esta dirección responde al Model Context Protocol. Un asistente apuntado a ella puede leer tus fuentes, buscarlas y actuar sobre ellas dentro de lo que permita un token.",

			steps: {
				mint: "Emite un token en Ajustes y elige si puede escribir.",
				configure: "Dale a tu cliente esta dirección y el token, como credencial de portador.",
				ask: "Pregúntale a tu asistente qué hay nuevo y leerá tu cola en lugar de un navegador.",
			},

			clients: {
				legend: "Qué clientes funcionan",
				description:
					"Cualquiera que te deje poner un token de portador en su configuración. Un cliente que solo sabe iniciar sesión con un flujo de autorización no tiene aquí contra qué iniciarla.",
				tokens: "Emitir un token",
			},
		},

		refused: {
			missing: "Esta dirección necesita un token de portador. Emite uno en los ajustes del lector.",
			signature: "Ese token no lo emitió este lector.",
			"unknown-token": "Ese token no es uno de los que tiene este lector.",
			revoked: "Ese token fue revocado.",
			expired: "Ese token caducó. Emite otro en los ajustes del lector.",
			tier: "Los agentes vienen con el plan De pago. Mejóralo en {{url}}.",
			budget: "Este token ha gastado sus llamadas de hoy. Inténtalo mañana.",
		},
	},

	/** What stands in for a part of a page that did not load. */
	frame: {
		failed: "Esta parte de la página no se cargó.",
		retry: "Recargar",
	},

	notFound: {
		title: "Página no encontrada",
		description: "La página que buscas no existe.",
		goBackHome: "Volver al inicio",
	},
};
