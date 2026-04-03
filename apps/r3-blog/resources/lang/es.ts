import type en from "./en";

export default {
	header: { title: "Sergio Xalambrí" },

	nav: {
		home: "Inicio",
		articles: "Artículos",
		bookmarks: "Bookmarks",
		tutorials: "Tutoriales",
		glossary: "Glosario",
		cms: "Dashboard",
		sponsor: "Apoyame en GitHub",
		login: "Acceso",
		logout: "Cerrar sesión",
	},

	home: {
		meta: {
			title: {
				default: "Sergio Xalambrí",
				search: "Resultados de búsqueda para {{query}} por Sergio Xalambrí",
			},
		},

		header: {
			title: "Sergio Xalambrí",
			description:
				"Web Developer de Buenos Aires con más de 10 años de experiencia. Trabajo en <strong>Daffy</strong> y mantengo varias librerías open source relacionadas con React Router y OAuth2.",
		},

		subscribe: {
			cta: "Suscribite a mi contenido usando <rss>RSS</rss>.",
		},

		search: {
			label: "Buscar",
			placeholder: "Remix, SWR, Next, Rails…",
			button: {
				progress: "Buscando…",
				default: "Buscar",
			},
		},

		feed: {
			title: "Actividad",
			description: "La última actividad en mi sitio",

			article: "Escribí sobre <articleLink>{{title}}</articleLink>",

			tutorial: "Publiqué cómo <tutorialLink>{{title}}</tutorialLink>",

			bookmark: "Leí <bookmarkLink>{{title}}</bookmarkLink> y lo guardé como bookmark",

			glossary: "Agregué la definición de <glossaryLink>{{title}}</glossaryLink> al glosario",

			preview: "Vista previa",
		},
	},

	articles: {
		title: "Artículos",

		meta: {
			title: "Artículos de sergiodxa",
		},

		header: {
			title: "Artículos",
			description: "Estos son mis artículos.",
		},

		subscribe: {
			cta: "Suscribite a mis artículos usando <rss>RSS</rss>.",
		},

		description: {
			search: "Mostrando {{count}} artículos para la búsqueda <highlight>{{term}}</highlight>",
			default: "Estos son mis artículos.",
		},

		search: {
			label: "Buscar",
			placeholder: "Remix, SWR, Next, Rails…",
			button: {
				progress: "Buscando…",
				default: "Buscar",
			},
		},

		nav: {
			prev: "Artículos anteriores",
			next: "Siguientes artículos",
		},

		list: {
			preview: "Vista previa",
		},
	},

	article: {
		meta: { title: "{{note}} por sergiodxa" },
		preview: {
			badge: "Vista previa hasta {{date}}",
			badgeRelative: "Se publica {{relativeTime}}",
		},
	},

	bookmarks: {
		meta: { title: "Bookmarks of sergiodxa" },

		header: {
			title: "Bookmarks",
			description: "Links que leí y me gustaron.",
		},

		subscribe: {
			cta: "Suscribite a mis bookmarks usando <rss>RSS</rss>.",
		},
	},

	login: {
		title: "Accedé a tu cuenta",
		github: "Continuar",
		error: {
			title: "Hubo un problema",
			description: "Ocurrió un error al intentar acceder (código: {{code}})",
		},
	},

	logout: {
		title: "¿Estás seguro?",
		cta: "Cerrar sesión",
	},

	tutorials: {
		meta: {
			title: {
				default: "Tutoriales de sergiodxa",
				search: "Tutorialess sobre {{query}} de sergiodxa",
			},
		},

		header: {
			title: "Tutoriales",
			description: "Aprendé sobre Remix, React, y más.",
		},

		search: {
			label: "Buscar tutoriales",
			placeholder: "Remix, React, Next…",
			button: {
				progress: "Buscando…",
				default: "Buscar",
			},
		},

		subscribe: {
			cta: "Suscribite a mis tutoriales usando <rss>RSS</rss>.",
		},

		pagination: {
			first: "Más nuevos",
			prev: "Siguientes",
			next: "Anteriores",
			last: "Más viejos",
		},

		list: {
			preview: "Vista previa",
		},
	},

	tutorial: {
		document: {
			title: "Cómo {{title}} por sergiodxa",
		},
		header: {
			eyebrown: "Cómo",
			edit: "Editar en GitHub",
			markdown: "Ver Markdown",
		},
		tags: "Usé",
		preview: {
			badge: "Vista previa hasta {{date}}",
			badgeRelative: "Se publica {{relativeTime}}",
		},
		related: {
			title: "Relacionados",
			reason: "Porque ambos usan {{tag}}",
		},
	},

	error: {
		NOT_FOUND: "404 No encontrado",
		NOTE_NOT_FOUND: "El artículo {{path}} no se pudo encontrar",
	},

	write: {
		title: "Escribí algo nuevo",
	},

	editor: {
		button: {
			bold: "Negrita",
			italic: "Italica",
			link: "Enlace",
			code: "Código",
			quote: "Cita",
			image: "Imágen",
			heading: "Encabezado",
		},
	},

	glossary: {
		title: "Glosario",

		header: {
			title: "Glosario",
			description: "Mi definición de algunos términos.",
		},
	},

	support: {
		title: "¿Te gusta mi contenido?",
		description: "Tu apoyo me ayuda a crear más tutoriales, artículos y herramientas open-source.",
		cta: "Patrocíname en GitHub",
	},

	notFound: {
		title: "404 No Encontrado",
	},

	forbidden: {
		title: "Contenido No Disponible",
		description: "Este contenido aún no está publicado, vuelve el {{date}}.",
		descriptionRelative:
			"Este contenido aún no está publicado, estará disponible {{relativeTime}}.",
		descriptionNoDate: "Este contenido aún no está publicado.",
		backHome: "Volver al Inicio",
	},

	cms: {
		layout: {
			nav: {
				label: "Dashboard",
				items: {
					dashboard: "Dashboard",
					articles: "Artículos",
					likes: "Links",
					tutorials: "Tutoriales",
					glossary: "Glosario",
					cache: "Claves de caché",
					redirects: "Redirecciones",
					logout: "Cerrar sesión",
				},
			},
		},

		_index: {
			stats: {
				title: "Estadísticas",
				total: {
					articles: "Total Artículos",
					likes: "Total Links",
					tutorials: "Total Tutoriales",
					glossary: "Total Glosario",
				},
				viewAll: "Ver todo",
			},

			quickAction: {
				like: {
					title: "Agregar un nuevo link",
					label: "URL",
					cta: "Crear Link",
				},
			},

			lastDaySearch: {
				title: "Búsquedas: Últimas 24hs",
			},
		},

		users: {
			search: { label: "¿Qué estás buscando?", cta: "Buscar" },
			table: {
				header: {
					name: "Nombre",
					role: "Rol",
					email: "Correo Electrónico",
					createdAt: "Fecha de Creación",
					updatedAt: "Última Actualización",
				},
			},
		},

		likes: {
			search: { label: "¿Qué estás buscando?", cta: "Buscar" },
			import: { cta: "Importar Marcadores" },
			list: {
				item: {
					publishedOn: "Publicado el {{date}}",
					edit: "Editar Like",
					delete: { cta: "Eliminar", pending: "Eliminando" },
				},
			},
		},

		articles: {
			search: { label: "¿Qué estás buscando?", cta: "Buscar" },
			import: { cta: "Importar Artículos" },
			reset: { cta: "Restablecer Artículos" },
			list: {
				scheduled: "Programado",
				item: {
					publishedOn: "Publicado el {{date}}",
					edit: "Editar Artículo",
					moveToTutorial: "Mover a Tutorial",
				},
			},
		},

		tutorials: {
			search: { label: "¿Qué estás buscando?", cta: "Buscar" },
			import: { cta: "Importar Tutoriales" },
			reset: { cta: "Restablecer Tutoriales" },
			list: {
				scheduled: "Programado",
				item: {
					publishedOn: "Publicado el {{date}}",
					edit: "Editar Tutorial",
					delete: { cta: "Eliminar", pending: "Eliminando" },
				},
			},
		},
	},

	rss: {
		title: "Sergio Xalambrí",
		description:
			"La lista completa de artículos, bookmarks, tutoriales y términos del glosario de @sergiodxa.",
		cta: "Leer en la web",

		tutorials: {
			title: "Tutoriales por Sergio Xalambrí",
			description: "La lista completa de tutoriales escritos por @sergiodxa.",
			cta: "Leer en la web",
		},

		articles: {
			title: "Artículos por Sergio Xalambrí",
			description: "La lista completa de artículos escritos por @sergiodxa.",
			cta: "Leer en la web",
		},

		bookmarks: {
			title: "Bookmarks por Sergio Xalambrí",
			description: "La lista completa de bookmarks guardados por @sergiodxa.",
			cta: "Leer en la web",
		},
	},
} satisfies typeof en;
