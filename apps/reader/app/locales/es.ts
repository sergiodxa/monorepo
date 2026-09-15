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
		settings: "Preferencias",
		logout: "Cerrar sesión",
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
				description: "Pega aquí abajo la dirección de un feed, o la de un sitio que publique uno.",
			},
			unread_one: "{{count}} sin leer",
			unread_other: "{{count}} sin leer",
			allRead: "Todo leído",
			checked: "Revisado el {{date}}",
			neverChecked: "Aún sin revisar",
			failing_one: "La última revisión falló",
			failing_other: "Las últimas {{count}} revisiones fallaron",
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

		unfollow: {
			title: "Dejar de seguir un feed",
			submit: "Dejar de seguir",
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
