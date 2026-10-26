/**
 * The press kit in Argentine Spanish: the bios, photos, topics and appearances an event or
 * podcast needs, plus the copy around them. The page and `/press.md?lang=es` read it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PressKit } from "~/app/services/press-kit";

import {
	APPEARANCES,
	monthName,
	PHOTOS,
	PROFILE_LINKS,
	PROJECT_LINKS,
} from "~/resources/content/press/shared";

/** The kit a Spanish-speaking organizer reads. */
const ES_AR: PressKit = {
	locale: "es-AR",
	title: "Kit de prensa",
	description:
		"Biografías, fotos, temas de charlas y apariciones anteriores para eventos, podcasts y cualquiera que presente a Sergio Xalambrí.",
	tagline: "Desarrollador web, mantenedor de open source y colaborador de Remix.",
	intro:
		"Todo lo que un evento, podcast o publicación necesita para presentarme, libre para usar tal cual. Si necesitás algo que no está acá, escribime con el formulario al final de esta página.",
	otherLanguage: { locale: "en", label: "English" },
	labels: {
		facts: "Datos rápidos",
		bios: "Biografías",
		biosNote: "Escritas en tercera persona. Elegí el largo que pida tu programa o formulario.",
		photos: "Fotos",
		photosNote: "Autorizadas para difusión de eventos y uso editorial. No hace falta dar crédito.",
		download: "Descargar",
		topics: "Temas",
		openSource: "Open source",
		appearances: "Charlas y apariciones",
		formats: "Formatos",
		links: "En otros sitios",
		contact: "Invitame",
		viewMarkdown: "Ver como Markdown",
		copy: "Copiar",
		copied: "Copiado",
		words: "palabras",
	},
	facts: [
		{ label: "Nombre", value: "Sergio Xalambrí" },
		{ label: "Pronunciación", value: "Sergio Salambrí (la X suena como una S)" },
		{ label: "Pronombre", value: "Él" },
		{ label: "Rol", value: "Web Developer en Daffy" },
		{ label: "Vive en", value: "Lima, Perú (PET, UTC−5)" },
		{ label: "De", value: "Argentina" },
		{ label: "Idiomas", value: "Español, inglés" },
		{ label: "Usuario", value: "@sergiodxa" },
	],
	bios: [
		{
			id: "one-line",
			label: "Una línea",
			use: "Notas de episodios y redes sociales",
			text: "Sergio Xalambrí es un desarrollador web argentino en Daffy y el mantenedor de Remix Auth y Remix Utils.",
		},
		{
			id: "short",
			label: "Corta",
			use: "Apps de eventos y programas impresos",
			text: "Sergio Xalambrí es un desarrollador web argentino con más de una década de experiencia. Trabaja en Daffy y mantiene librerías open source alrededor de React Router, Remix y OAuth 2.0. Disfruta construir aplicaciones full-stack, diseñar librerías y explorar la Web Platform.",
		},
		{
			id: "medium",
			label: "Media",
			use: "Sitios de conferencias y páginas de oradores",
			text: "Sergio Xalambrí es un desarrollador web argentino con más de una década de experiencia, radicado en Lima, Perú. Trabaja en Daffy, donde construye la aplicación web que ayuda a las personas a donar a las causas que les importan. Mantiene Remix Auth y Remix Utils, dos de las librerías más usadas del ecosistema de Remix y React Router, colabora con Remix y React Router, y publica los paquetes @sdxc para construir aplicaciones sobre la Web Platform. Escribe artículos y tutoriales sobre desarrollo web en sergiodxa.com.",
		},
		{
			id: "long",
			label: "Larga",
			use: "Folletos y perfiles detallados",
			text: "Sergio Xalambrí es un desarrollador web argentino con más de una década de experiencia construyendo para la web, hoy radicado en Lima, Perú. Trabaja en Daffy, un fondo de donaciones que ayuda a las personas a donar a las causas que les importan, donde construye la aplicación web en el centro del producto.\n\nEn la comunidad de Remix se lo conoce sobre todo por Remix Auth, la librería con la que muchas aplicaciones de Remix y React Router autentican a sus usuarios, y por Remix Utils, una colección de utilidades para rutas, respuestas y el servidor. Colabora con Remix y React Router, y mantiene los paquetes @sdxc, un conjunto de librerías para construir aplicaciones full-stack sobre las APIs de la Web Platform, documentadas en sdxc.dev.\n\nSergio dio charlas en Remix Conf Europe y Remix Jam, y participó en podcasts y meetups de toda Latinoamérica, en español e inglés. Escribió cientos de artículos y tutoriales en sergiodxa.com, enfocados en patrones prácticos de autenticación, carga de datos y diseño de librerías. Disfruta construir aplicaciones full-stack, diseñar APIs que a otros desarrolladores les resulten obvias y explorar lo que la Web Platform puede hacer sin un framework en el medio.",
		},
		{
			id: "introduction",
			label: "Presentación para el anfitrión",
			use: "Para leer en voz alta en el escenario o al empezar un episodio",
			text: "Nuestro próximo orador es Sergio Xalambrí. Sergio es desarrollador web en Daffy y está detrás de Remix Auth y Remix Utils, dos librerías que seguramente usaste si construiste algo con Remix o React Router. Nos acompaña desde Lima, Perú. ¡Démosle la bienvenida a Sergio!",
		},
	],
	photos: [
		{ ...PHOTOS.avatar, label: "Avatar", alt: "El avatar de Sergio Xalambrí" },
		{
			...PHOTOS.helmet,
			label: "Foto de portada",
			alt: "Un retrato animado de Sergio Xalambrí con un casco de carreras amarillo",
		},
	],
	topics: [
		{
			name: "Remix",
			detail: "Aplicaciones full-stack con Remix v3, su router, middleware y componentes.",
		},
		{
			name: "React Router",
			detail: "Framework mode, carga de datos, actions, autenticación y patrones que escalan.",
		},
		{
			name: "Los paquetes @sdxc",
			detail:
				"Librerías de autenticación, jobs, mail, caché y más sobre las APIs de la Web Platform.",
		},
		{
			name: "Autenticación y OAuth 2.0",
			detail: "Iniciar sesión de forma segura: sesiones, OAuth 2.0, OpenID Connect y passkeys.",
		},
		{
			name: "Mantener open source",
			detail:
				"Diseñar APIs, versionar y dar soporte a librerías de las que dependen miles de apps.",
		},
		{
			name: "Desarrollo web",
			detail: "La Web Platform, progressive enhancement y diseñar librerías que dé gusto usar.",
		},
	],
	openSource: [
		{
			name: "Remix Auth",
			href: PROJECT_LINKS.remixAuth,
			description:
				"Autenticación para aplicaciones de Remix y React Router, con decenas de estrategias.",
		},
		{
			name: "Remix Utils",
			href: PROJECT_LINKS.remixUtils,
			description: "Utilidades para rutas, respuestas, server-sent events, CSRF y más.",
		},
		{
			name: "Los paquetes @sdxc",
			href: PROJECT_LINKS.monorepo,
			description:
				"Un monorepo de paquetes y aplicaciones sobre las APIs de la Web Platform, en sdxc.dev.",
		},
		{
			name: "Remix",
			href: PROJECT_LINKS.remix,
			description: "Colaborador del framework y sus paquetes.",
		},
		{
			name: "React Router",
			href: PROJECT_LINKS.reactRouter,
			description: "Colaborador del router y su framework mode.",
		},
	],
	appearances: APPEARANCES.map((item) => ({
		...item,
		date: monthName(item.date, "es-AR"),
		language: item.language === "en" ? "Inglés" : "Español",
	})),
	formats: [
		{ name: "Lightning talks", detail: "De cinco a diez minutos sobre una idea." },
		{ name: "Charlas", detail: "Alrededor de treinta minutos, con o sin live coding." },
		{ name: "Keynotes", detail: "Para abrir o cerrar una conferencia." },
		{ name: "Workshops", detail: "Prácticos y pagos, de medio día a un día completo." },
		{ name: "Grabación", detail: "Las charlas se pueden grabar y publicar." },
		{ name: "Viajes", detail: "Los eventos presenciales necesitan cubrir viaje y alojamiento." },
	],
	links: [
		{ label: "Sitio web", href: PROFILE_LINKS.website },
		{ label: "GitHub", href: PROFILE_LINKS.github },
		{ label: "X", href: PROFILE_LINKS.x },
		{ label: "YouTube", href: PROFILE_LINKS.youtube },
		{ label: "Paquetes", href: PROFILE_LINKS.packages },
	],
	contact: {
		intro:
			"¿Organizás una conferencia, meetup, podcast o workshop? Contame y te respondo por email.",
		fields: {
			name: "Tu nombre",
			email: "Email",
			kind: "¿Qué es?",
			kindPlaceholder: "Elegí una opción",
			event: "Evento o programa (opcional)",
			eventPlaceholder: "p. ej. Remix Jam 2027",
			message: "Mensaje",
			messagePlaceholder: "Fechas, formato, audiencia y cualquier otra cosa que deba saber…",
		},
		kinds: {
			conference: "Conferencia",
			meetup: "Meetup",
			podcast: "Podcast o entrevista",
			workshop: "Workshop",
			other: "Otra cosa",
		},
		errors: {
			name: "Escribí tu nombre.",
			email: "Escribí un email válido, como nombre@ejemplo.com.",
			kind: "Elegí qué estás organizando.",
			event: "El nombre del evento tiene que tener menos de 150 caracteres, en una línea.",
			message: "Escribí un mensaje de al menos 10 caracteres.",
		},
		submit: "Enviar invitación",
		sending: "Enviando…",
		sent: "¡Gracias! Tu mensaje está en camino y te voy a responder al email que dejaste.",
		sendAnother: "Enviar otro mensaje",
		invalid: "Corregí los campos marcados y volvé a enviar tu mensaje.",
		failed: "No se pudo enviar tu mensaje. Sigue acá, así que probá de nuevo.",
		rateLimited:
			"Enviaste varios mensajes en poco tiempo. Tu mensaje sigue acá; esperá un minuto y probá de nuevo.",
		resubmit: "El formulario venció antes de enviarse. Tu mensaje sigue acá; envialo de nuevo.",
		privacy:
			"Tu nombre y email se usan solo para responderte. No incluyas contraseñas ni datos de pago.",
	},
};

export default ES_AR;
