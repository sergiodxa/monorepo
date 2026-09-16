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

	/** The sidebar every signed-in page wears. */
	nav: {
		label: "Secciones",
		reading: "Lectura",
		saved: "Guardadas",
		feeds: "Feeds",
		subscriptions: "Feeds que sigues",
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

	/** Shared by both timelines, which offer the same way through a long list of posts. */
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
		openPost: "Abrir entrada",
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
				description: "Ninguna entrada de los feeds que sigues contiene esas palabras.",
			},
			unread: {
				title: "Nada sin leer coincide",
				description: "Ya has leído todas las entradas que contienen esas palabras. Prueba Todas.",
			},
			read: {
				title: "Nada leído coincide",
				description: "Ninguna entrada que hayas leído contiene esas palabras. Prueba Todas.",
			},
		},
		noFeeds: {
			title: "Todavía no hay nada que leer",
			description:
				"Pega en la caja de arriba la dirección de un feed, o la de un sitio que publique uno.",
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
			},
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
