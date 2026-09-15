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

	/** The toolbar every signed-in page wears. */
	nav: {
		label: "Secciones",
		reading: "Lectura",
		feeds: "Feeds",
		search: "Buscar",
		settings: "Preferencias",
		logout: "Cerrar sesión",
	},

	/** Searching the posts of every followed feed. */
	search: {
		title: "Buscar",
		heading: "Buscar",
		label: "Busca en tus entradas",
		placeholder: "¿Qué estás buscando?",
		submit: "Buscar",
		resultsFor: "Entradas que coinciden con «{{query}}».",
		results_one: "{{count}} entrada coincide con «{{query}}».",
		results_other: "{{count}} entradas coinciden con «{{query}}».",
		none: {
			title: "No hay coincidencias",
			description: "Ninguna entrada de los feeds que sigues contiene esas palabras.",
		},
		prompt: {
			title: "Busca en tus lecturas",
			description: "Escribe lo que recuerdes del título o del resumen de una entrada.",
		},
	},

	/** Shared by both timelines, which offer the same way through a long list of posts. */
	timeline: {
		newer: "Entradas más recientes",
		older: "Entradas más antiguas",
		markRead: "Marcar como leída",
		markUnread: "Marcar como no leída",
		read: "Leída",
		openPost: "Abrir entrada",
		publishedOn: "Publicada el {{date}}",
		byAuthor: "por {{author}}",
		badCursor: "Esa página de entradas ya no existe.",
		restart: "Volver a lo más reciente",
		/**
		 * Marking a whole queue read is one sweep with no undo, so the trigger opens a
		 * prompt carrying the warning rather than acting on the first click.
		 */
		markAllRead: {
			submit: "Marcar todo como leído",
			title: "Marcar todo como leído",
			confirm:
				"¿Marcar como leídas todas las entradas sin leer, de todos los feeds que sigues? Aquí no queda registro de cuáles estaban sin leer, así que no se puede deshacer.",
			cancel: "Cancelar",
		},
		markFeedRead: "Marcar este feed como leído",
		markedRead_one: "{{count}} entrada marcada como leída.",
		markedRead_other: "{{count}} entradas marcadas como leídas.",
		nothingToMark: "No había nada sin leer que marcar.",
	},

	reading: {
		title: "Lectura",
		heading: "Lectura",
		caughtUp: {
			title: "Estás al día",
			description: "Has leído todas las entradas de todos los feeds que sigues.",
		},
		noFeeds: {
			title: "Todavía no hay nada que leer",
			description: "Sigue un sitio que publique RSS o Atom y sus entradas aparecerán aquí.",
			cta: "Sigue tu primer feed",
		},
	},

	feeds: {
		index: {
			title: "Feeds",
			heading: "Feeds",
			empty: {
				title: "Todavía no sigues nada",
				description: "Pega aquí arriba la dirección de un feed, o la de un sitio que publique uno.",
			},
			unread_one: "{{count}} sin leer",
			unread_other: "{{count}} sin leer",
			allRead: "Todo leído",
			checked: "Revisado el {{date}}",
			neverChecked: "Aún sin revisar",
			failing_one: "La última revisión falló",
			failing_other: "Las últimas {{count}} revisiones fallaron",
			/** How many checks failed and what the last one recorded, read as one badge. */
			failingBecause: "{{failures}}: {{reason}}",
		},

		follow: {
			title: "Seguir un feed",
			label: "Dirección del feed o del sitio",
			description: "La dirección de un feed, o la de un sitio que anuncie uno.",
			placeholder: "https://ejemplo.com",
			submit: "Seguir",
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
			empty: {
				title: "Todavía no hay entradas",
				description: "Este feed no ha publicado nada desde que empezaste a seguirlo.",
			},
			notFound: {
				title: "Feed no encontrado",
				description: "No sigues ningún feed con esa dirección.",
				back: "Volver a tus feeds",
			},
		},

		/** Checking every followed feed at once, from the subscription list. */
		checkAll: {
			submit: "Revisar todos los feeds",
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

		/** Paging the subscription list, which is long once a reader follows enough. */
		paging: {
			newer: "Suscripciones más recientes",
			older: "Suscripciones más antiguas",
		},

		/** What asking for a feed to be checked on the spot reports back. */
		check: {
			submit: "Revisar ahora",
			new: "Llegaron entradas nuevas.",
			none: "Nada nuevo desde la última revisión.",
			failed:
				"No se pudo llegar a ese feed ahora mismo. La próxima revisión programada lo intentará de nuevo.",
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
	},

	settings: {
		title: "Preferencias",
		heading: "Preferencias",
		refresh: {
			legend: "Cada cuánto buscar entradas nuevas",
			description:
				"Todos los feeds que sigues se revisan con esta frecuencia. Revisarlos más a menudo encuentra las entradas antes y le cuesta un poco más a los sitios que lees.",
			submit: "Guardar",
			saved: "Guardado.",
			invalid: "Esa no es una de las frecuencias disponibles.",
		},
		interval_one: "Cada hora",
		interval_other: "Cada {{count}} horas",
		lastRefreshed: "Revisado por última vez el {{date}}",
		neverRefreshed: "Aún sin revisar",
	},

	notFound: {
		title: "Página no encontrada",
		description: "La página que buscas no existe.",
		goBackHome: "Volver al inicio",
	},
};
