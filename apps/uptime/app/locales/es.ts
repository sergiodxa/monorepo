/**
 * Spanish (es) translation dictionary for the Uptime app. It maps every UI copy key
 * to its Spanish string across the landing page, dashboard, monitors, alerts, teams,
 * domains, status pages, and toast/error messages. It exists so the interface can be
 * rendered in Spanish, mirroring the shape of the English base dictionary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ApiKeyScope } from "~/database/schema";

export default {
	landing: {
		meta: {
			title: "Uptime por Sergio Xalambrí",
			description: "Monitoreo de uptime simple y confiable para desarrolladores",
		},

		header: {
			title: "Uptime",

			nav: {
				pricing: "Precios",
				features: "Funciones",
				compare: "Comparar",
				docs: "Documentación",

				cta: {
					in: "Abrir Panel de control",
					out: "Comenzar a monitorear",
				},
			},
		},

		try: {
			title: "Comprueba cualquier URL, gratis",
			description:
				"Sin cuenta. Ejecutamos una comprobación y te mostramos exactamente lo que informaría un monitor.",
			label: "Comprueba una URL",
			placeholder: "https://ejemplo.com",
			submit: "Ejecutar comprobación",
		},

		hero: {
			pill: "Monitoreo de Uptime",
			title: "Monitoree sus servicios <strong>con confianza</strong>",
			description:
				"Reciba alertas instantáneas cuando sus sitios web y APIs dejen de funcionar. Monitoree sus sitios web y APIs con facilidad.",

			cta: {
				in: "Abrir Panel de control",
				out: "Comenzar a monitorear",
				pricing: "Ver precios",
				try: "Monitorea un sitio gratis {{days}} días",
			},

			try: {
				label: "Comprueba una URL",
				placeholder: "https://ejemplo.com",
				submit: "Ejecutar comprobación",
			},
			screenshot: {
				alt: "Captura de pantalla del panel de Uptime: una barra lateral con monitores HTTP, DNS y TCP, cron jobs, alertas, mantenimiento y páginas de estado; tarjetas de resumen con el uso mensual de pings, el porcentaje de uptime general y el endpoint más lento; conteos por tipo de monitores activos y caídos; y una tabla de monitores HTTP con gráficos de tendencia de latencia y etiquetas de estado",
			},

			trustIndicators: {
				freeToStart: "Gratis para empezar",
				payForAutomation: "Pague por automatización",
				cancelAnytime: "Cancele cuando quiera",
			},
		},

		trustIndicators: {
			monitorTypes: "Tipos de Monitor",
			globalRegions: "Regiones Globales",
			daysDataRetention: "Días de Retención",
			minCheckInterval: "Intervalo Mínimo",
		},

		/**
		 * Las tres cosas que siguen siendo ciertas sin importar cuánto acabe monitoreando
		 * alguien. El precio y la cuota se interpolan desde `~/app/lib/pricing.ts`, así que
		 * un literal obsoleto aquí haría fallar el build de `app/lib/public-claims.ts`.
		 */
		benefits: {
			badge: "Por qué Uptime",
			title: "Un solo plan, todas las comprobaciones, sin contar nada",
			description: "Tres cosas que siguen siendo ciertas por mucho que acabe monitoreando.",

			list: {
				everythingIncluded: {
					title: "Todo incluido",
					description:
						"Comprobaciones HTTP, DNS, TCP y SSL, latidos de cron jobs, alertas y páginas de estado. Un solo plan, nada se vende aparte.",
				},
				noMonitorMath: {
					title: "Sin cuentas de monitores",
					description:
						"Monitores ilimitados y miembros de equipo ilimitados. Añada todo lo que quiera vigilar, y a todos los que necesiten verlo.",
				},
				payForUsage: {
					title: "Pague por el uso real",
					description:
						"{{price}} al mes incluye {{included}} comprobaciones. A partir de ahí paga las comprobaciones que realmente ejecuta, y nada más.",
				},
			},
		},

		features: {
			title: "Monitoreo potente simplificado",
			description:
				"Todo lo que necesita para mantener sus servicios funcionando sin problemas, sin complejidad innecesaria.",
			badge: "Funciones",
			learnMore: "Más información",

			list: {
				first: {
					title: "Monitoree su uptime",
					description:
						"Rastree sus servicios a toda hora, desde nueve regiones y con intervalos desde un minuto. Obtenga métricas detalladas e información de rendimiento de un vistazo.",
				},
				second: {
					title: "Reciba alertas en cualquier lugar",
					description:
						"Reciba notificaciones instantáneas por correo electrónico, Slack, Discord o webhooks cuando sus servicios experimenten tiempo de inactividad o problemas de rendimiento.",
				},
				third: {
					title: "Pague por lo que usa",
					description:
						"Precios transparentes sin tarifas ocultas. Escale hacia arriba o hacia abajo según sea necesario, con planes que crecen con sus necesidades de monitoreo.",
				},
				fourth: {
					title: "Páginas de Estado",
					description:
						"Cree hermosas páginas de estado públicas para mantener a sus usuarios informados sobre la disponibilidad del servicio e incidentes.",
				},
				fifth: {
					title: "Monitoreo SSL",
					description:
						"Rastree las fechas de vencimiento de certificados y reciba alertas antes de que sus certificados SSL expiren para prevenir advertencias de seguridad.",
				},
				sixth: {
					title: "Monitoreo DNS",
					description:
						"Detecte cambios en registros DNS y problemas de propagación antes de que afecten a sus usuarios o sean secuestrados.",
				},
				seventh: {
					title: "Integraciones Nativas",
					description:
						"Integraciones directas con Slack y Discord con notificaciones enriquecidas, no solo webhooks básicos.",
				},
				eighth: {
					title: "Monitoree flujos completos",
					description:
						"Ejecute varias solicitudes en orden y compruebe lo que devuelven: inicie sesión, lea el token y llame al endpoint que ese token autoriza. La pregunta que una sola comprobación no puede hacer.",
				},
			},
		},

		completeFeatureSet: {
			badge: "Conjunto Completo de Funciones",
			title: "Todo lo que necesita para un monitoreo confiable",
			description: "Capacidades avanzadas que hacen el monitoreo fácil y completo.",

			list: {
				maintenanceWindows: {
					title: "Ventanas de Mantenimiento",
					description:
						"Programe tiempo de inactividad y suprima alertas durante mantenimiento planificado",
				},
				contentMonitoring: {
					title: "Monitoreo de Contenido",
					description:
						"Verifique que palabras clave o contenido específico aparezcan en sus páginas",
				},
				recoveryAlerts: {
					title: "Alertas de Recuperación",
					description:
						"Reciba notificaciones cuando los servicios vuelvan a funcionar después de un incidente",
				},
				apiAccess: {
					title: "Acceso API",
					description: "API REST completa con gestión de claves para automatización",
				},
				alertCooldowns: {
					title: "Tiempos de Espera de Alertas",
					description: "Prevenga la fatiga de alertas con períodos de espera configurables",
				},
				customHeaders: {
					title: "Encabezados Personalizados",
					description:
						"Agregue encabezados de autenticación y parámetros de solicitud personalizados",
				},
				cronMonitoring: {
					title: "Monitoreo de Tareas Cron",
					description:
						"Monitoree trabajos programados y tareas en segundo plano con verificaciones de heartbeat",
				},
			},
		},

		useCases: {
			badge: "Casos de Uso",
			title: "Diseñado para cada necesidad de monitoreo",
			description:
				"Desde verificaciones de salud simples hasta sistemas distribuidos complejos, lo tenemos cubierto.",
			learnMore: "Más información",
			tailoredFor: "Soluciones personalizadas para:",

			list: {
				websiteMonitoring: {
					title: "Monitoreo de Sitios Web",
					description:
						"Rastree el uptime y rendimiento de páginas de inicio, blogs y aplicaciones web.",
				},
				apiMonitoring: {
					title: "Monitoreo de APIs",
					description: "Monitoree APIs REST, endpoints GraphQL y webhooks por disponibilidad.",
				},
				saas: {
					title: "Aplicaciones SaaS",
					description:
						"Mantenga su producto SaaS confiable con monitoreo proactivo y alertas instantáneas.",
				},
				microservices: {
					title: "Microservicios",
					description:
						"Monitoree sistemas distribuidos y detecte fallas antes de que se propaguen.",
				},
				healthChecks: {
					title: "Verificaciones de Salud",
					description:
						"Verifique la salud del servicio y conexiones de base de datos con pings programados.",
				},
				ecommerce: {
					title: "E-commerce",
					description:
						"Monitoree flujos de pago, APIs de pagos y páginas de productos para proteger ingresos.",
				},
			},

			audiences: {
				indieHackers: "Indie Hackers",
				soloDevelopers: "Desarrolladores Independientes",
				startups: "Startups",
				agencies: "Agencias",
				enterprises: "Empresas",
				devops: "DevOps",
			},
		},

		pricing: {
			badge: "Precios",
			title: "Precios simples y transparentes",
			description:
				"Una suscripción, sin niveles. Pague solo por lo que usa con nuestro modelo de precios directo",

			howItWorks: {
				title: "Cómo funcionan los precios",

				list: {
					first: {
						title: "Suscripción base",
						description: "{{price}}/mes incluye tus primeros {{included}} pings",
					},

					second: {
						title: "Pings adicionales",
						description:
							"{{blockPrice}} por cada {{blockSize}} pings adicionales, facturados en bloques completos",
					},

					third: {
						title: "Sin tarifas ocultas",
						description:
							"Sin cargos adicionales por funciones o integraciones. Pague por los pings que use.",
					},
				},
			},

			calculator: {
				title: "Calculadora de precios",
				description: "Calcule su costo mensual según sus necesidades de monitoreo",

				add: "Agregar Monitor",

				monitor: {
					label: "Frecuencia del monitor",
					delete: "Eliminar",
					frequency: {
						lower: "1m",
						upper: "60m",
					},
				},

				stats: {
					pingsPerMonth: "Pings por mes:",
					baseSubscription: "Suscripción base",
					includes: "Incluye los primeros {{amount}} pings",
					additionalPings: "Pings adicionales:",
					additionalPingsCost:
						"{{blocks}} × {{blockPrice}} por {{blockSize}} pings ({{pings}} de más)",
					totalCost: "Costo mensual total:",
				},
			},
		},

		faq: {
			badge: "FAQ",
			title: "Preguntas frecuentes",
			description: "Encuentre respuestas a preguntas comunes sobre Uptime",

			list: {
				first: {
					q: "¿Cómo monitorea Uptime mis servicios?",
					a: "Uptime envía solicitudes HTTP o HTTPS regulares a sus endpoints. Verificamos los códigos de respuesta y los tiempos de respuesta para determinar si su servicio está disponible y responde.",
				},

				second: {
					q: "¿Qué sucede cuando se detecta una interrupción?",
					a: "Cuando Uptime detecta una interrupción, envía inmediatamente una alerta a través de sus canales configurados.",
				},

				third: {
					q: "¿Puedo monitorear servicios internos?",
					a: "Sí, siempre que sus servicios internos sean accesibles desde internet. También puede configurar encabezados personalizados para autenticar las solicitudes.",
				},

				fourth: {
					q: "¿Cómo empiezo?",
					a: "Solo regístrese, cree su primer monitor y configure sus preferencias de alerta. Estará funcionando en menos de un minuto.",
				},

				fifth: {
					q: "¿Hay un nivel gratuito?",
					a: "¡Sí! Puede crear monitores ilimitados y activar pings manualmente de forma gratuita, para siempre. El monitoreo automático programado requiere una suscripción.",
				},

				sixth: {
					q: "¿Cuánto tiempo se almacenan los datos de ping?",
					a: "Almacenamos los resultados de sus pings durante 365 días. Después de eso, se eliminan automáticamente.",
				},

				seventh: {
					q: "¿Puedo monitorear servicios que requieren autenticación?",
					a: "Sí. Puede configurar encabezados personalizados con tokens o credenciales para autenticar sus solicitudes.",
				},

				eighth: {
					q: "¿Puedo monitorear múltiples URLs?",
					a: "Sí. Solo cree un monitor separado para cada URL. Cada monitor puede tener su propia frecuencia de verificación, método HTTP, código de estado esperado y más.",
				},

				ninth: {
					q: "¿Puedo monitorear APIs?",
					a: "Absolutamente. Uptime está diseñado para monitorear tanto sitios web como APIs. Puede configurar el endpoint, método, encabezados y respuestas esperadas para monitorear su API de manera efectiva.",
				},

				tenth: {
					q: "¿Puedo establecer un tiempo de espera para cada ping?",
					a: "Sí. Puede configurar un tiempo de espera para cada monitor. Si la respuesta tarda más de lo esperado, se considera una falla. Esto ayuda a detectar servicios lentos.",
				},

				eleventh: {
					q: "¿Puedo pausar o deshabilitar un monitor temporalmente?",
					a: "Sí. Puede pausar cualquier monitor en cualquier momento, individualmente.",
				},

				twelfth: {
					q: "¿Puedo probar un monitor inmediatamente después de crearlo?",
					a: "Sí. Un ping se activa automáticamente justo después de crear un monitor.",
				},

				thirteenth: {
					q: "¿Soportan páginas de estado?",
					a: "¡Sí! Cree páginas de estado públicas personalizables para compartir la salud de su servicio con los usuarios. Incluya los monitores que desee y agregue su marca.",
				},

				fourteenth: {
					q: "¿Puedo ver tendencias de rendimiento histórico?",
					a: "Almacenamos todos los resultados anteriores para que tenga un historial completo. Los gráficos de tendencias de rendimiento están planificados para una versión futura.",
				},

				fifteenth: {
					q: "¿Qué canales de alerta se admiten?",
					a: "Correo electrónico, Slack, Discord y webhooks. Las integraciones nativas facilitan recibir alertas donde su equipo ya trabaja. Los webhooks le permiten conectarse a cualquier otro servicio.",
				},

				sixteenth: {
					q: "¿Soportan equipos o monitores compartidos?",
					a: "¡Sí! Cada usuario comienza con un equipo. Invite a miembros del equipo con diferentes roles (Propietario, Administrador, Miembro). El aprovisionamiento automático de dominio agrega automáticamente usuarios con dominios de correo electrónico de empresa verificados.",
				},

				seventeenth: {
					q: "¿Qué sucede si excedo los límites de mi plan?",
					a: "El uso por encima de los {{included}} pings incluidos en tu suscripción se factura en bloques completos de {{blockSize}} a {{blockPrice}} cada uno: un solo ping de más inicia un bloque nuevo.",
				},

				eighteenth: {
					q: "¿Almacenan cuerpos de solicitud o respuesta?",
					a: "No. Nunca almacenamos datos del cuerpo. Para mayor privacidad y eficiencia, recomendamos usar el método `HEAD`.",
				},

				nineteenth: {
					q: "¿Desde qué regiones puedo monitorear mis servicios?",
					a: "Uptime admite monitoreo desde múltiples regiones: África, Asia-Pacífico, Europa Oriental y Occidental, Norteamérica Oriental y Occidental, Medio Oriente, Oceanía y Sudamérica.\n\nPuede elegir una región por monitor. La región se trata como una sugerencia, el ping real se originará desde un servidor en o cerca de esa región.",
				},

				twentieth: {
					q: "¿Puedo monitorear un flujo de inicio de sesión o de compra?",
					a: "Sí. Un monitor de flujo ejecuta varias solicitudes en orden con aserciones entre ellas, de modo que puede iniciar sesión, leer el token devuelto y llamar al endpoint que ese token autoriza. Un flujo se ejecuta a nivel HTTP y no en un navegador, y solo contra dominios que su equipo haya verificado.",
				},
			},
		},

		footer: {
			name: "Uptime",
			description: "Monitoreo simple y confiable para sus sitios web y APIs.",
			copyright: "© {{year}} Uptime por Sergio Xalambrí. Todos los derechos reservados.",
			sections: {
				product: {
					title: "Producto",
					features: "Características",
					pricing: "Precios",
					faq: "Preguntas frecuentes",
				},
				features: {
					title: "Características",
					monitors: "Monitores",
					alerts: "Alertas",
					statusPages: "Páginas de estado",
					ssl: "Monitoreo SSL",
					dns: "Monitoreo DNS",
					cronJobs: "Monitoreo de Cron Jobs",
					contentMonitoring: "Monitoreo de contenido",
					maintenance: "Ventanas de mantenimiento",
					integrations: "Integraciones",
					teams: "Equipos",
					analytics: "Analíticas",
					api: "Acceso API",
					flowMonitors: "Monitores de flujo",
				},
				useCases: {
					title: "Casos de uso",
					websiteMonitoring: "Monitoreo de sitios web",
					apiMonitoring: "Monitoreo de APIs",
					saas: "Aplicaciones SaaS",
					ecommerce: "E-commerce",
					cronJobs: "Monitoreo de Cron Jobs",
					microservices: "Microservicios",
					healthChecks: "Health checks",
					loginFlows: "Monitoreo de flujos de inicio de sesión",
				},
				solutions: {
					title: "Soluciones",
					indieHackers: "Para Indie Hackers",
					soloDevs: "Para desarrolladores independientes",
					startups: "Para startups",
					agencies: "Para agencias",
					enterprises: "Para empresas",
					devops: "Para DevOps",
				},
				compare: {
					title: "Comparar",
					uptimerobot: "vs UptimeRobot",
					pingdom: "vs Pingdom",
					betterUptime: "vs Better Uptime",
					healthchecks: "vs Healthchecks.io",
					cronitor: "vs Cronitor",
					checkly: "vs Checkly",
					statuscake: "vs StatusCake",
					datadog: "vs Datadog",
					site24x7: "vs Site24x7",
					ohdear: "vs Oh Dear",
				},
				docs: {
					title: "Documentación",
					overview: "Introducción",
					quickstart: "Inicio rápido",
					apiReference: "Referencia de API",
				},
				legal: {
					title: "Legal",
					terms: "Términos de servicio",
					privacy: "Política de privacidad",
				},
			},
		},

		comparison: {
			tableLabel: "Uptime vs {{competitor}}",
			tableCategoryHeader: "Categoría",
			tableProductHeader: "Uptime",
			whyTeamsSwitchTitle: "Por qué los equipos cambian a Uptime",
			gettingStartedTitle: "Primeros pasos",
			finalCtaTitle: "Cambie a Uptime",

			honestTake: {
				badge: "Opinión honesta",
				title: "Cuándo {{competitor}} puede ser mejor",
				description:
					"Creemos en la transparencia. Estos son los casos en los que {{competitor}} podría ser la opción correcta.",
			},

			pricing: {
				badge: "Precios",
				title: "Comparación de costos real",
				description: "Vea cuánto podría ahorrar en una configuración de monitoreo típica.",
				tableLabel: "Comparación de costos: Uptime vs {{competitor}}",
				scenarioHeader: "Caso de uso",
				savingsHeader: "Ahorro",
				savingsPerYear: "~{{amount}}/año",
				footnote:
					"Estimaciones basadas en patrones de uso típicos. Los precios de {{competitor}} pueden cambiar y su costo real depende de su configuración.",
			},
		},

		finalCta: {
			body: "Cree su primer monitor en menos de 2 minutos. No necesita tarjeta de crédito para empezar.",
		},

		marketingPage: {
			everythingBadge: "En detalle",
			everythingTitle: "Todo lo que necesita",
			everythingDescription:
				"Un repaso a fondo de lo que obtiene, desde la primera comprobación hasta la alerta que le llega.",
			howItWorksBadge: "Primeros pasos",
			howItWorksTitle: "Cómo funciona",
			howItWorksDescription:
				"Tres pasos para pasar de un panel vacío a comprobaciones que se ejecutan solas.",
			faqBadge: "FAQ",
			faqTitle: "Preguntas frecuentes",
			faqDescription: "Las dudas más habituales antes de empezar a monitorear.",
			finalCtaTitle: "Comience a monitorear sus servicios",
		},
	},

	/**
	 * `/trust` — cómo funciona el monitoreo y quién lo opera.
	 */
	trust: {
		meta: {
			title: "Confianza | Uptime",
			description:
				"Cómo funciona Uptime: quién lo opera, desde dónde se ejecutan las comprobaciones, cómo se confirma un incidente y qué se guarda y qué no.",
		},
		footerLink: "Confianza",
		heading: "Confianza",
		intro:
			"Un monitor vale lo que usted le crea. Esta página describe cómo funciona el servicio en realidad —quién lo opera, de dónde salen sus comprobaciones, cómo un fallo se convierte en una notificación y qué guardamos— con suficiente detalle para que decida si confiar en él. Todo lo que se dice aquí describe el sistema tal y como está construido hoy, no como está planeado.",
		regions: {
			afr: "África",
			apac: "Asia-Pacífico",
			eeur: "Europa del Este",
			enam: "América del Norte oriental",
			me: "Oriente Medio",
			oc: "Oceanía",
			sam: "América del Sur",
			weur: "Europa Occidental",
			wnam: "América del Norte occidental",
		},
		sections: {
			whoRuns: {
				title: "Quién lo opera",
				bodyPrefix: "Uptime está construido y operado por ",
				founderName: "Sergio Xalambrí",
				bodySuffix:
					", de forma independiente. Detrás de ese nombre no hay turnos de soporte ni un equipo de guardia: una sola persona escribe el código, lo despliega y contesta el correo.",
				second:
					"Conviene saberlo en los dos sentidos. Una pregunta sobre cómo se comporta una comprobación llega a la persona que la escribió. Un problema que empieza mientras esa persona duerme espera a que despierte.",
			},

			/**
			 * Code-available, not open source: the repository carries its own license with
			 * conditions, so the claim is only that a reader can check the code.
			 */
			source: {
				title: "Puede leer el código",
				bodyPrefix:
					"El código que hace funcionar este servicio es público, así que las afirmaciones de esta página se pueden comprobar en lugar de aceptarse por fe: cómo se clasifica una comprobación, qué contiene un resultado almacenado, cuándo sale una notificación: ",
				linkText: "apps/uptime en GitHub",
				bodySuffix: ".",
				caveat:
					"Eso le muestra el código, no el despliegue que está corriendo ahora mismo. Es una cosa más que puede verificar por su cuenta, no una garantía por sí sola.",
			},
			ownStatus: {
				title: "Nuestra propia página de estado",
				bodyPrefix:
					"El servicio publica una página de estado sobre sí mismo, construida con el mismo monitoreo de cron jobs que ofrece el producto: ",
				linkText: "uptime.sergiodxa.com/status/uptime",
				bodySuffix: ".",
				scope:
					"Lo que cubre esa página es más estrecho de lo que podría parecer, así que aquí va la afirmación precisa. Cada uno de los trabajos internos programados del servicio —los barridos de monitores, la consolidación nocturna de estadísticas diarias, las limpiezas de retención— avisa cuando termina, así que la página muestra si ese trabajo programado se está ejecutando a tiempo. No es una sonda independiente de todo el servicio, y se ejecuta en la misma plataforma que la propia aplicación, así que un problema lo bastante amplio para detener la aplicación puede detener también los avisos de la página.",
			},
			whereChecksRun: {
				title: "Desde dónde se ejecutan las comprobaciones",
				intro: "Cada monitor se comprueba desde una región que usted elige. Hay nueve disponibles:",
				hint: "Una región es una indicación, no una promesa. La comprobación se ejecuta en infraestructura situada cerca de la región que eligió, y la plataforma puede ubicarla en otro sitio cuando le hace falta. Las dos regiones europeas son la excepción: están fijadas a la UE, lo que es una restricción firme y no una preferencia.",
				timing:
					"El tiempo de respuesta que se registra en una comprobación mide solo la petición a su endpoint, no nuestro propio trabajo alrededor, así que el número sigue siendo comparable a lo que experimentaría alguien en esa región.",
			},
			incidents: {
				title: "Cómo se confirma un incidente",
				classification:
					"Cada comprobación termina en uno de tres resultados. Caído significa que no se pudo alcanzar el endpoint en absoluto, que respondió con un estado distinto del que usted espera, o que no pasó una comprobación de contenido que configuró. Degradado significa que respondió correctamente pero más lento que el umbral que fijó. Activo significa que todo coincidió.",
				noConfirmation:
					"No hay una segunda comprobación de confirmación antes de la primera notificación: una sola comprobación fallida basta para marcar un monitor como caído y enviar la alerta. Es un compromiso deliberado —una pasada de confirmación retrasaría cada alerta real un intervalo completo— pero sí significa que un único momento desafortunado de red puede llegar a su bandeja de entrada.",
				falsePositivesIntro: "Lo que sí mantiene el ruido bajo:",
				infraFault: {
					label: "Nuestros fallos no son los suyos.",
					body: "Cuando falla nuestra propia infraestructura de sondeo, la comprobación se reintenta en lugar de registrarse. Un fallo de nuestro lado nunca se convierte en un resultado de caída en su histórico ni en una alerta en su bandeja.",
				},
				yourThresholds: {
					label: "Su timeout, sus umbrales.",
					body: "El timeout, el estado esperado y el umbral de degradado los fija usted, así que una comprobación solo es lenta o fallida según la definición que usted le dio.",
				},
				cooldown: {
					label: "Las repeticiones se espacian, y la recuperación llega siempre.",
					body: "La primera alerta de un incidente sale de inmediato. Mientras un monitor sigue caído, las repeticiones se espacian según el tiempo de espera de esa alerta — una hora por defecto — así que una caída prolongada sigue avisándole en lugar de quedarse en silencio. Cuando se recupera, recibe un mensaje más diciéndolo.",
				},
				recovery: {
					label: "Avisos de recuperación solo después de un fallo real.",
					body: "Un mensaje de recuperación solo se envía cuando el monitor estaba antes en estado de fallo. La primera comprobación de un monitor nunca se anuncia como recuperada.",
				},
				maintenance: {
					label: "Las ventanas de mantenimiento silencian las alertas.",
					body: "Mientras una ventana de mantenimiento cubre un monitor, sus notificaciones se omiten por completo, así que el trabajo planificado no despierta a nadie.",
				},
				accounting: {
					label: "Las notificaciones retenidas se contabilizan.",
					body: "Cuando termina un incidente, el mensaje de recuperación informa de cuántas notificaciones salieron y cuántas se retuvieron, así que un incidente silencioso se puede distinguir de unas alertas perdidas.",
				},
			},
			storage: {
				title: "Qué se guarda y qué no",
				noBodies:
					"Los cuerpos de las respuestas nunca se guardan. Ni truncados, ni hasheados, ni muestreados: no existe una columna para ello en ninguna parte de la base de datos.",
				contentChecks:
					"El cuerpo de una respuesta solo se descarga cuando usted configura una comprobación de contenido para ese monitor. Cuando lo hace, se compara con sus reglas en memoria durante la comprobación y luego se descarta junto con el resto de la petición. Un monitor sin comprobaciones de contenido nunca lee un cuerpo.",
				storedIntro: "Qué se conserva, y durante cuánto tiempo:",
				httpResults: {
					label: "Registros individuales de comprobaciones HTTP:",
					body: "el código de estado devuelto, cuánto tardó la petición y cuándo terminó. Se conservan una semana, que es todo lo que leen las vistas recientes y el conteo de uso.",
				},
				dailyStats: {
					label: "Estadísticas diarias:",
					body: "cada noche las comprobaciones del día anterior se consolidan en una fila por monitor. Esa consolidación es el histórico a largo plazo detrás de cada gráfico de uptime de la aplicación, y se retiene 365 días.",
				},
				otherResults: {
					label: "Registros de comprobaciones DNS y TCP:",
					body: "se conservan 90 días, porque ese es el histórico que leen directamente la página de detalle de un monitor y un análisis posterior.",
				},
				alertHistory: {
					label: "Histórico de alertas:",
					body: "cada notificación que enviamos, que no pudimos enviar o que retuvimos a propósito, conservada 90 días, para que pueda auditar qué se le dijo y qué no.",
				},
				cronPings: {
					label: "Avisos de cron jobs:",
					body: "se conservan 365 días. La dirección y el agente de usuario que se registran junto a uno se borran a los 30 días; el aviso en sí se queda.",
				},
			},
			customerData: {
				title: "Los datos de su cuenta",
				bodyPrefix:
					"Los datos de la cuenta, la gestión de los pagos, las cookies y sus derechos sobre todo ello se cubren en la ",
				privacyLinkText: "Política de privacidad",
				bodySuffix:
					", que es el documento autoritativo y no un resumen escrito dos veces. La versión corta: sus datos no se venden, y sus datos de monitoreo pertenecen a su equipo.",
			},
			ourIncidents: {
				title: "Cuando Uptime mismo tiene un incidente",
				retries:
					"Las comprobaciones se encolan en lugar de ejecutarse en línea, y una comprobación que no pudo terminar por un fallo de nuestro lado se reintenta en lugar de registrarse. Ninguno de nuestros problemas se escribe en el histórico de su monitor como un fallo de su servicio.",
				gaps: "Si el problema dura, las comprobaciones se retrasan o se omiten. Una comprobación omitida no escribe nada, así que ese periodo aparece en su histórico como un hueco sin datos y no como una caída que nunca tuvo, y sus cifras se calculan a partir de las comprobaciones que realmente se ejecutaron.",
				missedAlerts:
					"El modo de fallo que conviene entender es el que viene después: si su endpoint se cae durante nuestra caída, su alerta puede llegar tarde o no llegar. Un servicio de monitoreo no puede avisarle mientras está caído, y este no es una excepción.",
				noSlaPrefix:
					"No ofrecemos un acuerdo de nivel de servicio, y no publicamos ninguna cifra de disponibilidad a la que atenernos. Los ",
				termsLinkText: "Términos de servicio",
				noSlaSuffix:
					" lo dicen así, y esta página no va a decir lo contrario por lo bajo. Lo que hay en su lugar: la página de estado de arriba, y una persona que contesta el correo.",
			},
		},
	},

	legal: {
		terms: {
			meta: {
				title: "Términos de servicio | Uptime",
				description:
					"Términos de servicio de Uptime, el servicio de monitoreo de uptime de Sergio Xalambrí.",
			},

			lastUpdated: "Última actualización: 11 de febrero de 2026",
			title: "Términos de servicio",

			sections: {
				introduction: {
					title: "1. Introducción",
					body: "Te damos la bienvenida a Uptime. Estos Términos de servicio rigen el uso de nuestro servicio de monitoreo de uptime, operado por Sergio Xalambrí. Al acceder a Uptime o usarlo, aceptas quedar sujeto a estos términos.",
				},
				serviceDescription: {
					title: "2. Descripción del servicio",
					body: "Uptime ofrece servicios de monitoreo de uptime y de tareas programadas, que incluyen monitoreo de endpoints HTTP, monitoreo de DNS, monitoreo de puertos TCP, monitoreo de certificados SSL y monitoreo de cron jobs. Estos servicios te ayudan a seguir el estado de tus servicios y de tus tareas programadas. Monitoreamos tus endpoints desde varias regiones del mundo y te avisamos cuando detectamos un problema.",
				},
				accountTerms: {
					title: "3. Condiciones de la cuenta",
					first: "Debes dar información exacta y completa al crear una cuenta.",
					second:
						"Eres responsable de mantener seguras las credenciales de tu cuenta y de toda la actividad que ocurra en ella.",
					third:
						"Debes tener al menos 18 años o contar con la autoridad legal para aceptar este acuerdo en nombre de una organización.",
					fourth: "Debes avisarnos de inmediato si detectas un uso no autorizado de tu cuenta.",
				},
				acceptableUse: {
					title: "4. Uso aceptable",
					intro: "Al usar Uptime, aceptas no:",
					first:
						"Abusar de nuestro servicio, sobrecargarlo o interferir con él, ni intentar sortear los límites de uso.",
					second:
						"Monitorear URL o endpoints que no te pertenezcan o que no tengas autorización para monitorear.",
					third:
						"Monitorear cron jobs o tareas programadas que no te pertenezcan o que no tengas autorización para monitorear.",
					fourth:
						"Usar los endpoints de ping de cron jobs para algo que no sea el monitoreo legítimo de tareas programadas.",
					fifth: "Usar el servicio con fines ilegales o no autorizados.",
					sixth:
						"Intentar acceder sin autorización a nuestros sistemas o a las cuentas de otras personas.",
					seventh: "Revender o redistribuir el servicio sin nuestro consentimiento por escrito.",
				},
				paymentTerms: {
					title: "5. Condiciones de pago",
					first:
						"Uptime funciona con un modelo de facturación por uso. Pagas según la cantidad de monitores y la frecuencia de comprobación que configures.",
					second: "Las suscripciones se gestionan y se cobran a través de Polar.",
					third:
						"Si cancelas, te devolvemos la parte proporcional de la suscripción que no llegaste a usar.",
					fourth:
						"Podemos cambiar los precios avisando con 30 días de antelación. Seguir usando el servicio después de un cambio de precio significa que lo aceptas.",
				},
				dataAndPrivacy: {
					title: "6. Datos y privacidad",
					firstPrefix: "El uso que haces de Uptime también se rige por nuestra ",
					firstLinkText: "Política de privacidad",
					firstSuffix: ", que explica cómo recopilamos, usamos y protegemos tus datos.",
					second:
						"Los datos de monitoreo se conservan durante 365 días. Pasado ese plazo, el historial se borra automáticamente.",
					third:
						"Puedes pedirnos que borremos tus datos en cualquier momento. Si cierras tu cuenta, borramos tus datos en un plazo de 30 días.",
				},
				serviceAvailability: {
					title: "7. Disponibilidad del servicio",
					first:
						"Aspiramos a un 99.9% de disponibilidad, pero es un objetivo, no una garantía. No ofrecemos acuerdos de nivel de servicio (SLA) con compensaciones económicas.",
					second:
						"Podemos hacer mantenimiento programado avisando con antelación razonable siempre que se pueda. El mantenimiento de emergencia puede ocurrir sin aviso.",
					third:
						"No nos hacemos responsables de caídas, pérdida de datos ni daños derivados de interrupciones del servicio, estén previstas o no.",
				},
				limitationOfLiability: {
					title: "8. Limitación de responsabilidad",
					first:
						'Uptime se ofrece "tal cual" y "según disponibilidad", sin garantías de ningún tipo, ni expresas ni implícitas.',
					second:
						"No garantizamos que nuestro servicio detecte todas las caídas que afecten a los endpoints que monitoreas. El monitoreo depende de las condiciones de la red y de otros factores fuera de nuestro control.",
					third:
						"Nuestra responsabilidad total ante cualquier reclamación derivada de tu uso del servicio se limita a lo que nos hayas pagado en los 12 meses anteriores a la reclamación.",
					fourth:
						"No nos hacemos responsables de daños indirectos, incidentales, especiales, derivados ni punitivos.",
				},
				termination: {
					title: "9. Cancelación",
					first:
						"Puedes cerrar tu cuenta cuando quieras desde la configuración de tu cuenta o escribiéndonos.",
					second:
						"Podemos suspender o cerrar tu cuenta si incumples estos términos, o por cualquier otro motivo avisándote con antelación razonable.",
					third:
						"Al cerrarse la cuenta, dejas de tener acceso al servicio y borramos tus datos en un plazo de 30 días.",
				},
				changesToTerms: {
					title: "10. Cambios en los términos",
					body: "Podemos actualizar estos Términos de servicio de vez en cuando. Te avisaremos de los cambios importantes por correo electrónico o desde el propio servicio. Seguir usando Uptime después de que los cambios entren en vigor significa que aceptas los términos revisados.",
				},
				contact: {
					title: "11. Contacto",
					prefix: "Si tienes preguntas sobre estos Términos de servicio, escríbenos a ",
					email: "hello@sergiodxa.com",
				},
			},
		},
		privacy: {
			meta: {
				title: "Política de privacidad | Uptime",
				description:
					"Política de privacidad de Uptime. Descubre cómo recopilamos, usamos y protegemos tus datos cuando usas nuestro servicio de monitoreo de uptime.",
			},

			lastUpdated: "Última actualización: 2 de agosto de 2026",
			title: "Política de privacidad",

			sections: {
				introduction: {
					title: "1. Introducción",
					first:
						'Esta Política de privacidad describe cómo Uptime, operado por Sergio Xalambrí ("nosotros" o "nuestro"), recopila, usa y protege tu información personal cuando usas nuestro servicio de monitoreo de uptime.',
					second:
						"Esta política se aplica a todas las personas que usan nuestro servicio y cubre los datos que recopilamos a través de nuestro sitio web y de la plataforma de monitoreo.",
				},
				dataCollected: {
					title: "2. Datos que recopilamos",
					accountData: {
						title: "Datos de la cuenta",
						body: "Cuando te registras con la autenticación de GitHub, recopilamos tu dirección de correo electrónico y el nombre que muestras en tu perfil de GitHub.",
					},
					monitoringData: {
						title: "Datos de monitoreo",
						body: "Recopilamos datos relacionados con los monitores que creas, incluidas las URL que eliges monitorear, los tiempos de respuesta, los códigos de estado HTTP y los eventos de caída y recuperación.",
					},
					cronJobData: {
						title: "Datos de monitoreo de cron jobs",
						intro: "Para el monitoreo de cron jobs (tareas programadas), recopilamos:",
						first:
							"Marcas de tiempo de los pings (cuándo tus tareas programadas informan de que terminaron)",
						second: "Direcciones IP de origen de las solicitudes de ping",
						third: "Cadenas de user agent de las solicitudes de ping",
						fourth:
							"Configuración de la programación (expresiones cron, zonas horarias, periodos de gracia)",
						outro:
							"Estos datos te ayudan a saber si tus tareas programadas se ejecutan a tiempo y nos permiten avisarte cuando falta un ping que esperábamos.",
					},
					usageData: {
						title: "Datos de uso",
						body: "Recopilamos analíticas y registros sobre cómo interactúas con nuestro servicio, incluidas las páginas vistas, el uso de las funciones y los registros de error.",
					},
					paymentData: {
						title: "Datos de pago",
						body: "Polar se encarga de procesar los pagos. No guardamos los datos de tu tarjeta. De Polar solo recibimos la confirmación del estado de tu suscripción y el historial de facturación.",
					},
				},
				dataUsage: {
					title: "3. Cómo usamos tus datos",
					first: {
						label: "Para prestar el servicio de monitoreo:",
						body: "Usamos tus datos para monitorear las URL que indiques y seguir su disponibilidad.",
					},
					second: {
						label: "Para enviarte alertas y notificaciones:",
						body: "Usamos tu correo electrónico para enviarte alertas de caídas y avisos de estado.",
					},
					third: {
						label: "Para mejorar el servicio:",
						body: "Analizamos los patrones de uso para mejorar las funciones y corregir problemas.",
					},
					fourth: {
						label: "Para comunicarnos contigo:",
						body: "Podemos enviarte novedades del servicio, avisos de seguridad y mensajes de soporte.",
					},
				},
				dataSharing: {
					title: "4. Con quién compartimos los datos",
					noSell: "No vendemos tus datos personales.",
					intro:
						"Compartimos datos con los siguientes servicios de terceros que nos ayudan a operar Uptime:",
					first: {
						label: "Cloudflare:",
						body: "Infraestructura, alojamiento y entrega de contenido",
					},
					second: { label: "Polar:", body: "Procesamiento de pagos y gestión de suscripciones" },
					third: { label: "GitHub:", body: "Servicios de autenticación" },
					outro:
						"También podemos revelar tus datos si la ley lo exige o para proteger nuestros derechos y la seguridad de quienes usan el servicio.",
				},
				dataRetention: {
					title: "5. Conservación de datos",
					first: {
						label: "Datos de monitoreo:",
						body: "Se conservan 365 días desde que se recopilan",
					},
					second: { label: "Datos de la cuenta:", body: "Se conservan hasta que borras tu cuenta" },
					third: { label: "Registros:", body: "Se conservan 30 días" },
				},
				rights: {
					title: "6. Tus derechos (RGPD)",
					intro:
						"Según el Reglamento General de Protección de Datos (RGPD), tienes derecho a lo siguiente:",
					first: {
						label: "Acceder a tus datos:",
						body: "Pedir una copia de los datos personales que tenemos sobre ti",
					},
					second: {
						label: "Corregir tus datos:",
						body: "Pedir que corrijamos datos personales inexactos",
					},
					third: { label: "Borrar tus datos:", body: "Pedir que borremos tus datos personales" },
					fourth: {
						label: "Exportar tus datos:",
						body: "Recibir tus datos en un formato portable",
					},
					fifth: {
						label: "Oponerte al tratamiento:",
						body: "Oponerte a ciertos tipos de tratamiento de datos",
					},
					outro:
						"Para ejercer cualquiera de estos derechos, escríbenos a la dirección de correo que aparece más abajo.",
				},
				security: {
					title: "7. Seguridad",
					intro: "Aplicamos medidas de seguridad adecuadas para proteger tus datos:",
					first: {
						label: "Cifrado en tránsito:",
						body: "Todos los datos se transmiten por HTTPS/TLS",
					},
					second: { label: "Cifrado en reposo:", body: "Los datos almacenados están cifrados" },
					third: {
						label: "Controles de acceso:",
						body: "Controles estrictos limitan quién puede acceder a tus datos",
					},
					fourth: {
						label: "Revisiones de seguridad periódicas:",
						body: "Revisamos nuestras prácticas de seguridad con regularidad",
					},
				},
				cookies: {
					title: "8. Cookies",
					intro: "Usamos las cookies mínimas necesarias para que el servicio funcione:",
					first: {
						label: "Cookies de sesión:",
						body: "Se usan para la autenticación y para mantener tu sesión iniciada",
					},
					outro:
						"No usamos cookies de rastreo, cookies publicitarias de terceros ni cookies con fines de marketing.",
				},
				turnstile: {
					title: "9. Protección contra bots",
					first:
						"La página pública donde cualquiera puede comprobar una URL sin tener cuenta está protegida por Cloudflare Turnstile. Está ahí para distinguir a una persona de un bot, de modo que el comprobador gratuito no se agote con tráfico automatizado.",
					second:
						"Para hacerlo, Cloudflare recibe tu dirección IP e información sobre tu navegador, y puede guardar un token en tu navegador para recordar que la comprobación se superó.",
					third:
						"Turnstile solo se ejecuta en esa página pública. No se usa en ninguna parte de la aplicación con la sesión iniciada.",
					referencePrefix: "Para saber qué hace Cloudflare con esos datos, consulta su ",
					referenceLinkText: "Anexo de privacidad de Turnstile",
					referenceSuffix: ".",
				},
				childrensPrivacy: {
					title: "10. Privacidad de los menores",
					body: "Uptime no está pensado para personas menores de 18 años. No recopilamos a sabiendas información personal de menores de 18 años.",
				},
				internationalTransfers: {
					title: "11. Transferencias internacionales de datos",
					first:
						"Tus datos pueden procesarse a través de la red global de Cloudflare. Si estás en la Unión Europea, tus datos pueden transferirse a Estados Unidos y procesarse allí.",
					second:
						"Nos apoyamos en las Cláusulas Contractuales Tipo de Cloudflare y en otras salvaguardas adecuadas para asegurar que tus datos estén protegidos conforme a lo que exige el RGPD.",
				},
				changesToPolicy: {
					title: "12. Cambios en esta política",
					first:
						'Podemos actualizar esta Política de privacidad de vez en cuando. Te avisaremos de cualquier cambio importante publicando la nueva política en esta página y actualizando la fecha de "Última actualización".',
					second:
						"Si los cambios son significativos y tienes una cuenta con nosotros, además te enviaremos un aviso por correo electrónico.",
				},
				contact: {
					title: "13. Contacto",
					body: "Si tienes alguna pregunta sobre esta Política de privacidad o quieres ejercer tus derechos sobre tus datos, escríbenos a:",
					email: "hello+privacy@sergiodxa.com",
				},
			},
		},
	},

	notFound: {
		title: "Página no encontrada",
		description: "La página que busca no existe o puede haberse movido.",
		goBackHome: "Volver al inicio",
	},

	errors: {
		backHome: "Volver al inicio",
	},

	app: {
		meta: {
			title: "Uptime por Sergio Xalambrí",
			description: "Monitoreo de uptime simple y confiable para desarrolladores",
		},

		layout: {
			sidebar: {
				teamPicker: { label: "Seleccionar Equipo" },
				userMenu: { label: "Menú de usuario" },
				toggle: "Mostrar u ocultar la navegación",

				navigation: {
					items: {
						dashboard: "Panel de control",
						alerts: "Alertas",
						maintenance: "Mantenimiento",
						monitors: "Monitores",
						httpMonitors: "Monitores HTTP",
						statusPages: "Páginas de estado",
						tcpMonitors: "Monitores TCP",
						dnsMonitors: "Monitores DNS",
						flowMonitors: "Monitores de flujo",
						cronJobs: "Cron Jobs",
						settings: "Configuración",
						billing: "Facturación",
						domains: "Dominios",
						members: "Miembros",
						team: "Equipo",
						docs: "Documentación",
						apiKeys: "Claves API",
					},
				},

				account: {
					title: "Cuenta",
					overview: "Resumen",
					teams: "Sus Equipos",
					signOut: "Cerrar sesión",
				},
			},
			breadcrumbs: { label: "Ruta de navegación" },
			toasts: {
				region: "Notificaciones",
				dismiss: "Descartar",
			},
		},

		errors: {
			notFound: {
				title: "404 No encontrado",
				description: "El equipo que está buscando no existe.",
			},
		},
	},

	monitorDetail: {
		header: {
			region: "{{emoji}} {{code}}",
		},
		stats: {
			title: "Estadísticas",
			uptime: "Uptime",
			totalChecks: "Verificaciones totales",
			lastCheck: "Última verificación",
			neverRan: "N/D",
		},

		actions: {
			refresh: "Actualizar",
			delete: {
				confirm: "¿Está seguro de que desea eliminar este monitor?",
				cta: "Eliminar Monitor",
			},
		},
	},

	monitorList: {
		header: {
			title: "Monitores de Uptime",
			cta: "Crear Monitor",
			subscribe: "Sus monitores están pausados. Suscríbase para continuar monitoreando",
		},
	},

	statusPage: {
		banner: {
			operational: "Todos los sistemas operativos",
			degraded: "Interrupción parcial del sistema",
			down: "Interrupción grave del sistema",
		},
		status: {
			operational: "Operativo",
			degraded: "Degradado",
			down: "Caído",
			unknown: "Desconocido",
		},
		uptimeBar: {
			daysAgo: "Hace 90 días",
			today: "Hoy",
			legend: {
				full: "100%",
				partial: "Parcial",
				down: "Caído",
				noData: "Sin datos",
			},
			tooltip: {
				uptime: "{{percentage}}% de uptime",
				noData: "Sin datos",
			},
		},
		cronJobs: {
			title: "Tareas Programadas",
			lastPing: "Último ping",
			never: "Nunca",
			schedule: "Programación",
		},
		empty: {
			description: "No hay servicios configurados para esta página de estado.",
		},
		footer: {
			lastUpdated: "Última actualización {{date}}",
			poweredBy: "Desarrollado por Uptime",
		},
		error: {
			title: "Página de Estado No Encontrada",
			description: "La página de estado que busca no existe o no es pública.",
			goHome: "Ir al inicio",
		},
		dns: {
			coverage: "Todos los registros DNS con seguimiento de este dominio",
		},
	},

	contentMonitoring: {
		title: "Monitoreo de Contenido",
		description:
			"Verifique el contenido de la respuesta para palabras clave o patrones específicos. El monitor fallará si alguna verificación no pasa.",
		empty:
			"No hay verificaciones de contenido configuradas. Agregue una verificación para monitorear palabras clave o patrones específicos en la respuesta.",
		addButton: "Agregar Verificación de Contenido",

		form: {
			title: "Añadir una comprobación",
			description: "Cada comprobación se aplica al cuerpo de la respuesta en cada ping.",
			checkType: {
				label: "Tipo de Verificación",
				description: "Elija cómo coincidir con el contenido de la respuesta",
				options: {
					contains: "Contiene",
					notContains: "No Contiene",
					regex: "Patrón Regex",
				},
			},
			value: {
				label: "Valor",
				placeholder: "Ingrese palabra clave o patrón",
				description: "El texto o patrón regex a buscar",
			},
			caseSensitive: "Coincidencia sensible a mayúsculas",
			cancel: "Cancelar",
			add: "Agregar Verificación",
		},

		item: {
			type: "Tipo",
			status: "Estado",
			caseSensitive: "Sensible a mayúsculas",
			enabled: "Habilitado",
			disabled: "Deshabilitado",
			yes: "Sí",
			no: "No",
			delete: "Eliminar",
			deleteConfirmTitle: "¿Eliminar esta verificación de contenido?",
		},

		types: {
			contains: "Contiene",
			notContains: "No Contiene",
			regex: "Regex",
		},
	},

	auth: {
		error: {
			title: "Error de Autenticación",
			errorCode: "Código de Error: {{code}}",
			description: "Descripción: {{description}}",
			uri: "URI:",
			tryAgain: "Por favor intente de nuevo o contacte a soporte si el problema persiste.",

			signInFailedTitle: "Error al iniciar sesión",
			signInFailedGeneric:
				"No se pudo completar el intento de inicio de sesión. Inténtalo de nuevo.",
			missingIdToken: "El proveedor de identidad no devolvió un token de ID.",
		},
	},

	dashboard: {
		header: {
			title: "Monitores de Uptime",
			cta: "Crear Monitor",
			subscribe: "Sus monitores están pausados. Suscríbase para continuar monitoreando",
		},

		monitor: {
			stats: {
				title: "Estadísticas",
				uptime: "Uptime",
				totalChecks: "Verificaciones totales",
				lastCheck: "Última verificación",
				neverRan: "N/D",
			},

			actions: {
				refresh: "Actualizar",
				delete: {
					confirm: "¿Está seguro de que desea eliminar este monitor?",
					cta: "Eliminar Monitor",
				},
			},
		},
	},

	createMonitor: {
		title: "Crear un nuevo Monitor",
		fields: {
			name: {
				label: "Nombre del Monitor",
				placeholder: "Página de inicio",
				description: "Un nombre descriptivo para su monitor.",
			},
			url: {
				label: "URL a monitorear",
				placeholder: "https://example.com/healthcheck",
				description: "La URL del servicio que desea monitorear.",
			},
			method: {
				label: "Método de solicitud",
				placeholder: "HEAD",
				description: "El método HTTP a usar para la solicitud.",
			},
			status: {
				label: "Código de estado esperado",
				placeholder: "200",
				description: "El código de estado HTTP que espera recibir.",
			},
			interval: {
				label: "Intervalo de verificación",
				placeholder: "60",
				description: "Intervalo en segundos. El mínimo es 60 segundos.",
			},
			visibility: {
				label: "Visibilidad",
				description: "Los monitores públicos se pueden compartir con cualquiera.",
				options: { public: "Público", private: "Privado" },
			},
			region: {
				label: "Región",
				description: "La región desde la cual se ejecutará el ping.",
				placeholder: "wnam",
				options: {
					afr: "{{emoji}} África",
					apac: "{{emoji}} Asia-Pacífico",
					eeur: "{{emoji}} Europa Oriental",
					enam: "{{emoji}} Norteamérica Oriental",
					me: "{{emoji}} Medio Oriente",
					oc: "{{emoji}} Oceanía",
					sam: "{{emoji}} Sudamérica",
					weur: "{{emoji}} Europa Occidental",
					wnam: "{{emoji}} Norteamérica Occidental",
				},
			},
		},
		cta: "Crear Monitor",
	},

	emails: {
		accountDeleted: {
			subject: "Su cuenta de Uptime ha sido eliminada",
			preview: "Su cuenta y sus datos han sido eliminados.",
			heading: "Su cuenta ha sido eliminada",
			body: "Nos pidió eliminar su cuenta de Uptime y ya lo hicimos. Sus equipos, monitores, alertas, páginas de estado y preferencias ya no existen, todo equipo del que era propietario fue eliminado junto con ellos, y su suscripción fue cancelada.",
			retained: {
				intro:
					"Hay algunas cosas que no pudimos eliminar, para que sepa exactamente cómo queda todo:",
				billing:
					"Las facturas y los registros de pago que guarda nuestro proveedor de facturación. La ley fiscal nos obliga a conservarlos, y la ley de protección de datos lo permite por esa razón.",
				analytics:
					"Los resultados de las comprobaciones de monitoreo en nuestro almacén de analítica. Solo admite agregar datos: no hay forma de eliminar un registro de ahí, únicamente dejar que expire según su calendario de retención.",
				logs: "Los registros de peticiones del servidor, por la misma razón: expiran según un calendario de retención y no se pueden eliminar antes.",
				identity:
					"Su propia identidad de inicio de sesión, que está en manos del proveedor de identidad con el que inició sesión y no en las nuestras.",
			},
			address:
				"Esta dirección de correo se guardó únicamente para poder enviarle este mensaje. Ya ha sido eliminada también.",
			footer:
				"Ha recibido este correo porque nos pidió eliminar su cuenta de Uptime. No se enviará ningún otro correo a esta dirección.",
		},

		teamDeleted: {
			subject: "{{team}} ha sido eliminado en Uptime",
			preview: "{{team}} y todo lo que monitoreaba ya no existen.",
			heading: "{{team}} ha sido eliminado",
			body: "El propietario de {{team}} eliminó su cuenta de Uptime, y el equipo fue eliminado junto con ella. Usted ya no tiene acceso a él.",
			lost: "Todo lo que pertenecía al equipo ya no existe: sus monitores, alertas y páginas de estado desaparecieron, y nada de eso se puede recuperar.",
			next: "Si todavía necesita este monitoreo, puede crear su propio equipo en Uptime y configurarlo de nuevo.",
			footer:
				"Ha recibido este correo porque era miembro de {{team}} en Uptime. No hay nada que necesite hacer.",
		},

		teamInvite: {
			subject: "Ha sido invitado a unirse a {{team}} en Uptime",
			preview: "Únase a {{team}} en Uptime",
			heading: "Ha sido invitado a unirse a {{team}}",
			body: "{{team}} usa Uptime para vigilar sus servicios. Acepte la invitación para unirse al equipo.",
			action: "Aceptar invitación",
			footer:
				"Ha recibido este correo porque alguien le invitó a su equipo en Uptime. Si no lo esperaba, puede ignorar este mensaje.",
		},

		alert: {
			subject: "[Alerta de Uptime] {{monitor}} está {{status}}",
			preview: "{{monitor}} está {{status}}",
			heading: "{{monitor}} está {{status}}",
			action: "Abrir el panel de control",
			incidentCooldown:
				"Notificaciones de este incidente: {{sent}} enviadas, {{suppressed}} retenidas por el tiempo de espera de la alerta.",
			footer:
				"Ha recibido este correo porque una de las alertas de su equipo coincidió con este evento.",

			status: {
				up: "RECUPERADO",
				down: "CAÍDO",
				degraded: "DEGRADADO",
			},

			fields: {
				monitor: "Monitor",
				status: "Estado",
				time: "Hora",
				url: "URL",
				responseStatus: "Estado de respuesta",
				responseTime: "Tiempo de respuesta",
				domain: "Dominio",
				endpoint: "Endpoint",
				schedule: "Programación",
				lastPing: "Último ping",
				nextExpected: "Próximo esperado",
				hostname: "Nombre de host",
				expiresAt: "Expira el",
				records: "Registros",
				findings: "Qué cambió",
				tests: "Pruebas",
				failedTest: "Prueba fallida",
				failureDetail: "Qué falló",
				duration: "Duración",
			},

			values: {
				none: "—",
				never: "nunca",
				monitor: "{{name}} ({{type}})",
				responseStatus: "{{actual}} (esperado {{expected}})",
				milliseconds: "{{value}}ms",
				endpoint: "{{host}}:{{port}}",
				schedule: "{{expression}} ({{timezone}})",
				dnsRecordCounts:
					"{{missing}} ausentes, {{changed}} cambiados, {{new}} vistos por primera vez",

				/** One finding, written out per outcome so each reads as its own sentence. */
				dnsFinding: {
					missing: "Ya no resuelve: {{name}} {{type}} {{value}}",
					changed: "Ahora resuelve a: {{name}} {{type}} {{value}}",
					new: "Visto por primera vez: {{name}} {{type}} {{value}}",
				},

				dnsMoreFindings: "…y {{count}} más",
				flowTests: "{{passed}} de {{total}} superadas",
				flowFailedTest: "{{title}} (línea {{line}})",
			},

			/** Explains what a DNS diff means, shown only where that meaning is needed. */
			dns: {
				recordSetEditNote:
					"Un conjunto de registros con varios valores no tiene identidad por registro en DNS, así que un valor editado dentro de él se informa como un registro que deja de resolver más un registro nuevo.",
				newRecordsNote:
					"Los registros vistos por primera vez todavía no se vigilan. Abra el monitor para aceptar los que esperaba, o corrija su DNS.",
			},
		},

		teamDigest: {
			action: "Abrir el panel de control",
			footer: "Ha recibido este correo porque es miembro de {{team}} en Uptime.",
			manageAction: "Elija qué correos recibe",

			status: {
				up: "Activo",
				degraded: "Degradado",
				down: "Caído",
				noData: "Sin comprobar",
			},

			types: {
				http: "HTTP",
				dns: "DNS",
				tcp: "TCP",
				cron: "Cron job",
				flow: "Flujo",
			},

			columns: {
				monitor: "Monitor",
				status: "Estado",
				uptime: "Disponibilidad",
			},

			values: {
				none: "—",
				percentage: "{{value}}%",
			},

			bar: {
				uptime: "{{value}}% de disponibilidad",
				legend: {
					up: "Activo",
					degraded: "Degradado",
					down: "Caído",
					noData: "Sin datos",
				},
			},

			daily: {
				subject_one: "{{team}}: el monitor necesita una revisión",
				subject_other: "{{team}}: {{up}} de {{count}} monitores activos ayer",
				subjectAll_one: "{{team}}: el monitor estuvo activo ayer",
				subjectAll_other: "{{team}}: los {{count}} monitores activos ayer",
				preview: "El último día completo de comprobaciones en {{team}}",
				heading: "Ayer en {{team}}",
				summaryAll_one: "El monitor del equipo estuvo activo el {{date}}.",
				summaryAll_other: "Los {{count}} monitores estuvieron activos el {{date}}.",
				summary_one: "El monitor del equipo no estuvo activo el {{date}}.",
				summary_other: "{{up}} de {{count}} monitores estuvieron activos el {{date}}.",
			},

			weekly: {
				subject_one: "{{team}}: el monitor tuvo un mal día esta semana",
				subject_other: "{{team}}: {{up}} de {{count}} monitores activos toda la semana",
				subjectAll_one: "{{team}}: el monitor estuvo activo toda la semana",
				subjectAll_other: "{{team}}: los {{count}} monitores activos toda la semana",
				preview: "Los últimos siete días de comprobaciones en {{team}}",
				heading: "Los últimos siete días en {{team}}",
				summaryAll_one: "El monitor del equipo estuvo activo todos los días.",
				summaryAll_other: "Los {{count}} monitores estuvieron activos todos los días.",
				summary_one: "El monitor del equipo no estuvo activo todos los días.",
				summary_other: "{{up}} de {{count}} monitores estuvieron activos todos los días.",
			},
		},

		trial: {
			stopAction: "Dejar de recibir estos correos",

			/**
			 * The report page every per-target trial report links, shared because the wrap-up and the
			 * repeat-submission answer point at the same page with the same sentence.
			 */
			reportLink: {
				body: "Este informe también vive en un enlace que puede reabrir o compartir:",
				action: "Verlo en línea",
			},
			stop: "Un clic termina con todas las URL que nos pidió vigilar y borra su dirección y sus datos. Puede volver a empezar cuando quiera desde nuestro sitio web.",

			status: {
				up: "ACTIVO",
				degraded: "DEGRADADO",
				down: "CAÍDO",
			},

			fields: {
				url: "URL",
				status: "Estado",
				previousStatus: "Estado anterior",
				responseStatus: "Estado de respuesta",
				responseTime: "Tiempo de respuesta",
				checkedAt: "Comprobado el",
				changedAt: "Cambió el",
				checks: "Comprobaciones realizadas",
				uptime: "Disponibilidad",
				slowest: "Respuesta más lenta",
			},

			values: {
				none: "—",
				milliseconds: "{{value}}ms",
				percentage: "{{value}}%",
			},

			bar: {
				uptime: "{{value}}% de disponibilidad",
				legend: {
					up: "Activo",
					degraded: "Degradado",
					down: "Caído",
					noData: "Sin datos",
				},
			},

			confirmation: {
				subject: "Ahora comprobamos {{url}} cada hora",
				preview: "Las comprobaciones cada hora de {{url}} ya han empezado",
				heading: "Ahora comprobamos {{url}} cada hora",
				body: "Esta es la comprobación que acaba de ejecutar. Repetiremos la misma cada hora hasta el {{until}} y le escribiremos cada vez que el resultado cambie. También recibirá un resumen una vez al día.",
				footer:
					"Ha recibido este correo porque nos pidió comprobar esta URL desde nuestro sitio web.",
			},

			change: {
				subject: "{{url}} está {{status}}",
				preview: "{{url}} está {{status}}",
				heading: "{{url}} está {{status}}",
				body: "La comprobación de las {{time}} devolvió un resultado distinto al de la anterior.",
				footer: "Ha recibido este correo porque nos pidió vigilar esta URL durante una semana.",
			},

			daily: {
				subject: "Informe diario: {{url}}",
				subjectMany: "Informe diario: {{total}} URL",
				preview: "Las últimas 24 horas de comprobaciones de {{url}}",
				previewMany: "Las últimas 24 horas de comprobaciones de {{total}} URL",
				heading: "{{url}} en las últimas 24 horas",
				headingMany: "Sus {{total}} URL en las últimas 24 horas",
				summaryAll: "Las {{total}} estaban activas en la última comprobación.",
				summary: "{{up}} de {{total}} estaban activas en la última comprobación.",
				target: "{{url}} — {{status}}",
				rangeStart: "Hace 24 horas",
				rangeEnd: "Ahora",
				footer:
					"Ha recibido este correo porque nos pidió realizar estas comprobaciones desde nuestro sitio web.",
			},

			weekly: {
				subject: "Informe de siete días: {{url}}",
				preview: "La semana completa de comprobaciones de {{url}}",
				heading: "{{url}} en los últimos siete días",
				rangeStart: "Hace 7 días",
				rangeEnd: "Hoy",
				closing:
					"Este era el séptimo día, así que las comprobaciones gratuitas de {{url}} terminan aquí.",
				action: "Seguir comprobando esta URL",
				footer:
					"Ha recibido este correo porque nos pidió vigilar esta URL durante una semana. Este es el último.",
			},

			repeat: {
				subject: "Lo que hemos encontrado en {{url}} hasta ahora",
				preview: "Las comprobaciones que ya tenemos de {{url}}",
				heading: "{{url}} ya se está comprobando",
				intro:
					"Nos pidió vigilar {{url}} el {{since}}. Esto es todo lo que encontraron esas comprobaciones.",
				rangeStart: "Día 1",
				rangeEnd: "Día 7",
				closing:
					"Cada URL tiene una semana gratuita cada 30 días, así que esta petición no ha iniciado una segunda. Para seguir comprobando {{url}} —con la frecuencia que quiera y con un aviso en cuanto cambie— use Uptime.",
				action: "Seguir comprobando esta URL",
				footer:
					"Ha recibido este correo porque envió esta URL en nuestra web y ya teníamos un informe de ella.",
			},
		},
	},

	components: {
		copyButton: {
			label: "Copiar",
			copied: "¡Copiado!",
		},

		selectAll: {
			select: "Seleccionar todo",
			clear: "Borrar todo",
		},

		/**
		 * The scope picker, shared by the alert and maintenance-window forms. A monitor type
		 * is named the same wherever it is offered, so the option copy lives here once; the
		 * sentence describing what narrowing does to a given form stays on that form's page.
		 */
		monitorScope: {
			label: "Alcance",
			teamWide: "Todo el equipo (todos los monitores)",
			unknownMonitor: "Un monitor que ya no existe",
			types: {
				http: "Monitores HTTP",
				dns: "Monitores DNS",
				tcp: "Monitores TCP",
				cron: "Tareas programadas",
				flow: "Monitores de flujo",
			},
			allOfType: {
				http: "Todos los monitores HTTP",
				dns: "Todos los monitores DNS",
				tcp: "Todos los monitores TCP",
				cron: "Todas las tareas programadas",
				flow: "Todos los monitores de flujo",
			},
		},
	},

	cron: {
		error: {
			empty: "Introduzca una expresión cron.",
			"field-count":
				"Una expresión cron necesita exactamente cinco campos: minuto, hora, día del mes, mes y día de la semana.",
			"seconds-not-supported":
				"Los segundos no son compatibles. Use el formato de cinco campos, empezando por el minuto.",
			"unknown-macro":
				"Ese atajo no es compatible. Use @hourly, @daily, @weekly, @monthly o @yearly.",
			syntax: "Uno de los campos no es un valor, un rango, una lista ni un paso.",
			"unknown-name":
				"No se reconoce uno de los nombres de mes o de día de la semana. Use abreviaturas de tres letras como JAN o MON.",
			"out-of-range": "Uno de los valores está fuera del rango que permite su campo.",
			"reversed-range": "Uno de los rangos empieza después de terminar.",
			"invalid-step": "Un paso debe ser un número entero mayor que cero.",
			"impossible-date": "Ese día del mes nunca ocurre en el mes con el que está combinado.",
		},
	},

	schedule: {
		interval: {
			minute_one: "Cada minuto",
			minute_other: "Cada {{count}} minutos",
			hour_one: "Cada hora",
			hour_other: "Cada {{count}} horas",
		},
		hourly: {
			onTheHour: "Cada hora",
			atMinutes: "Cada hora en el minuto {{minutes}}",
		},
		daily: "Todos los días a las {{times}}",
		weekly: "Todos los {{days}} a las {{times}}",
		monthly: "Cada mes el día {{days}} a las {{times}}",
		yearly: "Cada año el {{days}} de {{months}} a las {{times}}",
		expression: "Programación personalizada ({{expression}})",
	},

	actions: {
		checks: {
			queued: "Comprobación en cola para «{{name}}».",
			subscriptionRequired: "Se requiere una suscripción activa para ejecutar una comprobación.",
		},

		addDomain: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notAllowed: "No tiene permiso para agregar dominios a este equipo.",
				alreadyExists: "{{hostname}} fue agregado el {{verifiedAt}}.",
			},

			success: {
				accepted: "{{hostname}} aún está pendiente de verificación.",
				created: "{{hostname}} fue agregado a {{team}}. La verificación está pendiente.",
			},
		},

		changeRole: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notAllowed: "No tiene permiso para cambiar roles en este equipo.",
				cannotChangeOwner: "No puede cambiar el rol del propietario del equipo.",
			},

			success: "El rol de {{name}} fue cambiado a {{role}} en {{team}}.",
		},

		createAlert: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notAllowed: "No tiene permiso para crear alertas en este equipo.",
				limitExceeded: "Ha alcanzado el límite de {{limit}} alertas en este equipo.",
			},
			success: { created: "La alerta {{name}} fue creada." },
		},

		createInvite: {
			email: {
				subject: "Ha sido invitado a unirse a {{team}} en Uptime",
			},

			errors: {
				generic: "¡Ups! Algo salió mal.",
				notAllowed: "No tiene permiso para invitar miembros a este equipo.",
				alreadyAccepted: "Ya existe un miembro de {{team}} con este correo electrónico.",
			},

			success: "{{email}} fue invitado a unirse a {{team}}.",
		},

		createMonitor: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
			},

			success: "El monitor {{name}} fue creado.",
		},

		/**
		 * Una importación masiva reporta dos números, y `partial` es el que importa: un
		 * envío donde algunas líneas entraron cuenta como éxito con una lista de pendientes,
		 * así que nombra cuántos monitores existen antes que las líneas por corregir.
		 */
		importMonitors: {
			errors: {
				generic: "¡Ups! Algo salió mal. Revise la lista e inténtelo de nuevo.",
				none: "No se pudo importar nada de esa lista. Revise los motivos de abajo e inténtelo de nuevo.",
			},

			success_one: "Se creó 1 monitor.",
			success_other: "Se crearon {{count}} monitores.",
			partial_one: "Se creó 1 monitor. Otras {{rejected}} líneas no pudieron ser — vea abajo.",
			partial_other:
				"Se crearon {{count}} monitores. Otras {{rejected}} líneas no pudieron ser — vea abajo.",
		},

		updateMonitor: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notFound: "Este monitor no existe.",
			},

			success: "El monitor {{name}} fue actualizado.",
		},

		updateSsl: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notFound: "Este monitor no existe.",
			},

			success: "La configuración SSL para {{name}} fue actualizada.",
		},

		deleteMonitor: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notAllowed: "No tiene permiso para eliminar monitores en este equipo.",
				notFound: "Este monitor no existe.",
			},
			success: "El monitor {{name}} fue eliminado.",
		},

		removeAlert: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				forbidden: "No tiene permiso para eliminar alertas en este equipo.",
				notFound: "{{name}} no existe.",
			},
			success: "La alerta {{name}} fue eliminada.",
		},

		removeDomain: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notAllowed: "No tiene permiso para eliminar dominios de este equipo.",
				notFound: "{{hostname}} no existe.",
			},

			success: "{{hostname}} fue eliminado de {{team}}.",
		},

		removeMember: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notAllowed: "No tiene permiso para eliminar miembros de este equipo.",
				cannotRemoveOwner: "No puede eliminar al propietario del equipo.",
			},

			success: "{{name}} fue eliminado de {{team}}.",
		},

		retryDomainVerification: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notAllowed: "No tiene permiso para reintentar la verificación de dominio en este equipo.",
				notFound: "{{hostname}} no existe.",
				workflowFailed:
					"El proceso de verificación falló al iniciarse para {{hostname}}. Intente de nuevo más tarde.",
			},

			success: {
				alreadyVerified: "{{hostname}} ya está verificado.",
				requested: "Se solicitó el reintento de verificación de {{hostname}}.",
			},
		},

		revokeInvite: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notAllowed: "No tiene permiso para revocar invitaciones en este equipo.",
				notFound: "Esta invitación no existe.",
				alreadyAccepted: "Esta invitación ya fue aceptada por el invitado.",
			},

			success: "La invitación de {{email}} fue revocada de {{team}}.",
		},

		updateTeam: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				forbidden: "No tiene permiso para actualizar la configuración del equipo.",
			},

			success: {
				updated: "La configuración del equipo fue actualizada exitosamente.",
			},
		},

		deleteTeam: {
			errors: {
				generic: "¡Ups! Algo salió mal al eliminar el equipo.",
				forbidden: "Solo el propietario del equipo puede eliminar el equipo.",
				confirmationRequired: "Por favor, escriba DELETE para confirmar.",
			},

			success: "{{team}} ha sido eliminado.",
		},

		leaveTeam: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notMember: "Usted no es miembro de este equipo.",
				ownerCannotLeave:
					"Los propietarios del equipo no pueden abandonar su equipo. Primero transfiera la propiedad.",
				adminCannotLeave:
					"Los administradores no pueden abandonar el equipo. Pida al propietario que le quite el rol primero.",
			},

			success: "Ha abandonado {{team}}.",
		},

		createStatusPage: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				slugTaken: "Este slug ya está en uso.",
			},
		},

		updateStatusPage: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notFound: "Esta página de estado no existe.",
				slugTaken: "Este slug ya está en uso.",
			},
		},

		deleteStatusPage: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notFound: "Esta página de estado no existe.",
			},

			success: "La página de estado fue eliminada.",
		},

		createMaintenance: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				invalidDates: "La hora de fin debe ser posterior a la hora de inicio.",
			},

			success: {
				created: "La ventana de mantenimiento '{{name}}' fue creada.",
			},
		},

		deleteMaintenance: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notFound: "Esta ventana de mantenimiento no existe.",
				forbidden: "No tiene permiso para eliminar esta ventana de mantenimiento.",
			},

			success: "La ventana de mantenimiento '{{name}}' fue eliminada.",
		},

		endMaintenance: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notFound: "Esta ventana de mantenimiento no existe.",
				forbidden: "No tiene permiso para finalizar esta ventana de mantenimiento.",
			},

			success: "La ventana de mantenimiento '{{name}}' fue finalizada antes de tiempo.",
		},

		createTeam: {
			errors: {
				generic: "¡Ups! Algo salió mal al crear el equipo.",
			},

			success: {
				created: "El equipo {{name}} fue creado exitosamente.",
			},
		},

		createDnsMonitor: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				limitExceeded: "Ha alcanzado el límite de {{limit}} monitores DNS en este equipo.",
			},

			success: {
				created: "El monitor DNS {{name}} fue creado.",
			},
		},

		updateDnsMonitor: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notFound: "Este monitor DNS no existe.",
				forbidden: "No tiene permiso para actualizar este monitor DNS.",
			},

			success: "El monitor DNS {{name}} fue actualizado.",
		},

		deleteDnsMonitor: {
			errors: {
				generic: "¡Ups! Algo salió mal.",
				notFound: "Este monitor DNS no existe.",
				forbidden: "No tiene permiso para eliminar este monitor DNS.",
			},

			success: "El monitor DNS {{name}} fue eliminado.",
		},

		checkDnsMonitor: {
			success: { checked: 'Se verificó "{{name}}".' },
		},

		reviewDnsMonitor: {
			errors: { generic: "No pudimos guardar qué registros vigilar. Inténtelo de nuevo." },
			success: {
				saved_one: "Vigilando {{count}} registro.",
				saved_other: "Vigilando {{count}} registros.",
			},
		},

		toggleDnsMonitorRecord: {
			errors: { generic: "No pudimos cambiar ese registro. Inténtelo de nuevo." },
			success: { enabled: "Ahora vigilando {{name}}.", disabled: "Ya no se vigila {{name}}." },
		},

		importDnsMonitorZoneFile: {
			errors: {
				generic: "No pudimos leer ese archivo de zona. Inténtelo de nuevo.",
				tooLarge: "Un archivo de zona debe pesar {{limit}} o menos.",
				tooManyNames:
					"Esa zona tiene más de {{limit}} nombres, más de lo que un solo monitor puede recorrer.",
			},
			success: {
				imported_one: "Se importó {{count}} nombre de su archivo de zona.",
				imported_other: "Se importaron {{count}} nombres de su archivo de zona.",
			},
		},

		createTcpMonitor: {
			errors: {
				generic: "¡Ups! Algo salió mal al crear el monitor TCP.",
			},
			success: "El monitor TCP {{name}} fue creado.",
		},

		updateTcpMonitor: {
			errors: {
				generic: "¡Ups! Algo salió mal al actualizar el monitor TCP.",
				notFound: "Este monitor TCP no existe.",
			},
			success: "El monitor TCP {{name}} fue actualizado.",
		},

		deleteTcpMonitor: {
			errors: {
				generic: "¡Ups! Algo salió mal al eliminar el monitor TCP.",
				notAllowed: "No tiene permiso para eliminar monitores TCP en este equipo.",
				notFound: "Este monitor TCP no existe.",
			},
			success: "El monitor TCP {{name}} fue eliminado.",
		},

		createApiKey: {
			errors: {
				generic: "¡Ups! Algo salió mal al crear la clave API.",
				limitExceeded: "Ha alcanzado el límite de {{limit}} claves API en este equipo.",
			},
			success: {
				created: "La clave API '{{name}}' fue creada.",
			},
		},

		deleteApiKey: {
			errors: {
				generic: "¡Ups! Algo salió mal al eliminar la clave API.",
				notFound: "Esta clave API no existe.",
			},
			success: "La clave API '{{name}}' fue eliminada.",
		},

		updateLanguage: {
			errors: {
				generic: "¡Ups! Algo salió mal al actualizar su preferencia de idioma.",
			},
			success: "Preferencia de idioma actualizada exitosamente.",
		},

		createCronJob: {
			errors: {
				generic: "¡Ups! Algo salió mal al crear el cron job.",
				limitExceeded: "Ha alcanzado el límite de {{limit}} monitores de cron job en este equipo.",
			},
			success: "El cron job {{name}} fue creado.",
		},

		updateCronJob: {
			errors: {
				generic: "¡Ups! Algo salió mal al actualizar el cron job.",
				notFound: "Este cron job no existe.",
			},
			success: "El cron job {{name}} fue actualizado.",
		},

		deleteCronJob: {
			errors: {
				generic: "¡Ups! Algo salió mal al eliminar el cron job.",
				notFound: "Este cron job no existe.",
				forbidden: "No tiene permiso para eliminar este cron job.",
			},
			success: "El cron job {{name}} fue eliminado.",
		},
	},

	page: {
		dashboard: {
			header: {
				title: "Panel de control",
			},

			quickPing: {
				title: "Verificación rápida",
				description: "Verifique una URL una vez. Nada se guarda, sin alertas; cuesta un ping.",
				field: {
					label: "URL a verificar",
					placeholder: "https://example.com/healthcheck",
				},
				action: {
					submit: "Verificar una vez",
					/** Names the icon button that opens the bar as a sheet, below the width it is a row at. */
					open: "Abrir verificación rápida",
				},
				result: {
					/** Names the toast region a finished check is reported in. */
					label: "Resultado de la verificación",
					noResponse: "Sin respuesta",
					status: {
						up: "Activo",
						degraded: "Degradado",
						down: "Caído",
					},
				},
				error: {
					invalidUrl: "Introduzca una URL completa con http:// o https://.",
					subscriptionRequired:
						"Se requiere una suscripción activa para ejecutar una verificación.",
				},
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			empty: {
				title: "Aún no hay monitores",
				description: "Cree su primer monitor para comenzar a rastrear sus servicios.",
				cta: "Crear Monitor",
			},

			stats: {
				monitors: {
					label: "Uso mensual de pings",
					value: "{{consumed}}<small> usados</small>",
					description: "De {{estimated}} estimados",
					unavailable: "Estimación no disponible",
				},

				uptime: {
					label: "Porcentaje de Uptime",
					description: "Uptime general del sistema",
				},

				httpMonitors: {
					label: "Monitores HTTP",
					create: "Nuevo monitor HTTP",
					breakdown: {
						up: "{{up}} activos",
						down: "{{down}} caídos",
					},
				},
				dnsMonitors: {
					label: "Monitores DNS",
					create: "Nuevo monitor DNS",
					/** One monitor is one domain, so this count is smaller than the work behind it. */
					hint: "Un monitor cubre un dominio entero y todos los registros que se le siguen.",
					breakdown: {
						ok: "{{ok}} ok",
						changed: "{{changed}} cambiados",
						error: "{{error}} error",
					},
				},
				flowMonitors: {
					label: "Monitores de flujo",
					create: "Nuevo monitor de flujo",
					breakdown: {
						up: "{{up}} superados",
						down: "{{down}} fallidos",
						error: "{{error}} no ejecutables",
					},
				},
				tcpMonitors: {
					label: "Monitores TCP",
					create: "Nuevo monitor TCP",
					breakdown: {
						up: "{{up}} activos",
						down: "{{down}} caídos",
					},
				},
				cronJobs: {
					label: "Trabajos Cron",
					create: "Nuevo cron job",
					breakdown: {
						healthy: "{{healthy}} saludables",
						late: "{{late}} retrasados",
						missed: "{{missed}} perdidos",
					},
				},

				slowestEndpoint: {
					label: {
						default: 'Endpoint más lento "<em>{{name}}</em>"',
						noData: "Endpoint más lento",
					},
					value: { noData: "N/D" },
					description: "En las últimas 24 horas",
				},
			},

			tabs: {
				http: "HTTP",
				dns: "DNS",
				tcp: "TCP",
				cronJobs: "Trabajos Cron",
			},

			loading: "Cargando…",

			panel: {
				tabsLabel: "Tipo de monitor",
				tabPanelLabel: "Monitores de {{tab}}",
				refresh: "Actualizar",
			},

			error: {
				card: {
					label: "Error",
					value: "-",
					description: "Error al cargar los datos",
				},
				table: {
					message: "Error al cargar los monitores. Por favor, inténtelo de nuevo.",
				},
				analytics: {
					message:
						"Los datos de análisis no están disponibles temporalmente. Por favor, inténtelo de nuevo más tarde.",
				},
			},

			table: {
				label: "Monitores",

				columns: {
					name: "Nombre",
					latencyChart: "Tendencia de latencia",
					status: "Estado",
					lastIncident: "Último incidente",
					responseTime: "Latencia prom.",
					actions: "Acciones",
				},

				status: {
					up: "En funcionamiento",
					down: "Caído",
					degraded: "Degradado",
					unknown: "Sin datos",
				},

				lastIncident: { never: "-" },
				responseTime: "~{{value}}",

				actions: {
					menu: "Menú de acciones",
					edit: "Editar Monitor",
					delete: "Eliminar Monitor",
					play: "Ejecutar Monitor",
				},

				confirmation: {
					deleteMonitor:
						"¿Está seguro de que desea eliminar el monitor {{name}}? Esta acción no se puede deshacer.",
				},
			},
		},

		monitors: {
			header: {
				title: "Monitores de Uptime",
				cta: "Crear Monitor",
				subscribe: "Sus monitores están pausados. Suscríbase para continuar monitoreando",
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},
		},

		createMonitor: {
			header: {
				title: "Crear Monitor",
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nombre del Monitor",
						placeholder: "Página de inicio",
						description: "Un nombre descriptivo para su monitor.",
					},
					url: {
						label: "URL a monitorear",
						placeholder: "https://example.com/healthcheck",
						description: "La URL del servicio que desea monitorear.",
					},
					method: {
						label: "Método de solicitud",
						placeholder: "HEAD",
						description: "El método HTTP a usar para la solicitud.",
					},
					status: {
						label: "Código de estado esperado",
						placeholder: "200",
						description: "El código de estado HTTP que espera recibir.",
					},
					interval: {
						label: "Intervalo de verificación",
						placeholder: "60",
						description: "Intervalo en segundos. El mínimo es 60 segundos.",
					},
					visibility: {
						label: "Visibilidad",
						description: "Los monitores públicos se pueden compartir con cualquiera.",
						options: { public: "Público", private: "Privado" },
					},
					region: {
						label: "Región",
						description: "La región desde la cual se ejecutará el ping.",
						placeholder: "Selecciona una región",
						options: {
							afr: "{{emoji}} África",
							apac: "{{emoji}} Asia-Pacífico",
							eeur: "{{emoji}} Europa Oriental",
							enam: "{{emoji}} Norteamérica Oriental",
							me: "{{emoji}} Medio Oriente",
							oc: "{{emoji}} Oceanía",
							sam: "{{emoji}} Sudamérica",
							weur: "{{emoji}} Europa Occidental",
							wnam: "{{emoji}} Norteamérica Occidental",
						},
					},
				},

				sections: {
					basics: {
						title: "Datos básicos",
						description: "Qué vigila este monitor.",
					},
					checks: {
						title: "Configuración de comprobación",
						description:
							"Con qué frecuencia se ejecuta el monitor, qué respuesta espera y desde dónde se ejecuta.",
					},
				},

				cta: "Crear Monitor",
			},
		},

		editMonitor: {
			header: {
				title: "Editar Monitor",
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nombre del Monitor",
						placeholder: "Página de inicio",
						description: "Un nombre descriptivo para su monitor.",
					},
					url: {
						label: "URL a monitorear",
						placeholder: "https://example.com/healthcheck",
						description: "La URL del servicio que desea monitorear.",
					},
					method: {
						label: "Método de solicitud",
						placeholder: "HEAD",
						description: "El método HTTP a usar para la solicitud.",
					},
					status: {
						label: "Código de estado esperado",
						placeholder: "200",
						description: "El código de estado HTTP que espera recibir.",
					},
					interval: {
						label: "Intervalo de verificación",
						placeholder: "60",
						description: "Intervalo en segundos. El mínimo es 60 segundos.",
					},
					visibility: {
						label: "Visibilidad",
						description: "Los monitores públicos se pueden compartir con cualquiera.",
						options: { public: "Público", private: "Privado" },
					},
					region: {
						label: "Región",
						description: "La región desde la cual se ejecutará el ping.",
						placeholder: "wnam",
						options: {
							afr: "{{emoji}} África",
							apac: "{{emoji}} Asia-Pacífico",
							eeur: "{{emoji}} Europa Oriental",
							enam: "{{emoji}} Norteamérica Oriental",
							me: "{{emoji}} Medio Oriente",
							oc: "{{emoji}} Oceanía",
							sam: "{{emoji}} Sudamérica",
							weur: "{{emoji}} Europa Occidental",
							wnam: "{{emoji}} Norteamérica Occidental",
						},
					},
					ssl: {
						enabled: {
							label: "Habilitar monitoreo SSL",
							description:
								"Monitoree la expiración del certificado SSL y reciba alertas antes de que expire.",
						},
						expiresAt: {
							label: "Fecha de expiración del certificado",
							placeholder: "Seleccione fecha de expiración",
							description:
								"Ingrese la fecha de expiración de su certificado SSL. Puede encontrarla en el panel de su proveedor de hosting o verificando los detalles del certificado en su navegador.",
						},
						issuer: {
							label: "Emisor del certificado",
							placeholder: "Let's Encrypt, DigiCert, etc.",
							description:
								"La Autoridad de Certificación que emitió su certificado SSL (opcional).",
						},
						warningDays: {
							label: "Alertar antes de la expiración",
							description:
								"Reciba alertas esta cantidad de días antes de que expire el certificado.",
						},
					},
				},

				sections: {
					basics: {
						title: "Datos básicos",
						description: "Qué vigila este monitor.",
					},
					checks: {
						title: "Configuración de comprobación",
						description:
							"Con qué frecuencia se ejecuta el monitor, qué respuesta espera y desde dónde se ejecuta.",
					},
				},

				cancel: "Cancelar",
				cta: "Guardar cambios",
			},

			ssl: {
				title: "Monitoreo de certificado SSL",
				description:
					"Controle la expiración de su certificado para enterarse antes que sus visitantes.",
				cta: "Guardar configuración SSL",
			},

			dangerZone: {
				title: "Zona de peligro",
				description: "Las acciones de esta sección no se pueden deshacer.",
				warning:
					"Eliminar este monitor borra definitivamente sus comprobaciones, su historial y sus alertas.",
				delete: "Eliminar monitor",
			},
		},

		monitor: {
			header: {
				title: 'Monitor "{{name}}"',

				action: {
					play: "Ejecutar Monitor",
					running: "Ejecutando…",
					edit: "Editar Monitor",
					refresh: "Actualizar",
				},
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			stats: {
				monitors: {
					label: "Uso mensual de pings",
					value: "{{consumed}}<small> usados</small>",
					description: "De {{estimated}} estimados",
					estimateUnavailable: "Estimación no disponible",
				},

				uptime: {
					label: "Porcentaje de Uptime",
					description: "Últimos 90 días",
				},

				slowestResult: {
					label: "Resultado más lento",
					description: "En las últimas 24 horas",
				},

				p99ResponseTime: {
					label: "Tiempo de respuesta P99",
					value: "{{value}} ms",
					description: "p99, últimas 24 h",
				},
			},

			ssl: {
				title: "Certificado SSL",
				status: {
					valid: "Válido",
					expiring: "Por expirar",
					expired: "Expirado",
					error: "Error",
					unknown: "No configurado",
				},
				expiresAt: "Expira",
				expiresIn: "{{days}} días",
				issuer: "Emisor",
				lastChecked: "Última verificación",
				notConfigured: "El monitoreo SSL no está habilitado para este monitor.",
				configure: "Configurar monitoreo SSL",
			},
			run: {
				toast: {
					up: "{{name}} está en funcionamiento",
					down: "{{name}} está caído",
					degraded: "{{name}} está degradado",
					changed: "La comprobación que acaba de ejecutar cambió el estado de este monitor.",
					notQueued: {
						title: "No se ejecutó la comprobación",
						description: "Se requiere una suscripción activa para ejecutar una comprobación.",
					},
				},
			},
		},

		billing: {
			header: {
				title: "Facturación",
			},
			ownerOnly:
				"Solo el propietario del equipo puede ver y gestionar la facturación de este equipo.",
			unavailable:
				"La facturación no está disponible temporalmente. Vuelve a intentarlo en unos minutos.",
		},

		members: {
			header: {
				title: "Miembros del Equipo",

				action: {
					invite: "Invitar miembro",
				},
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			sections: {
				members: {
					title: "Miembros",
					description: "Administre los miembros de su equipo y sus roles.",
				},
			},

			membersTable: {
				label: "Miembros actuales",
				description: "Personas que tienen acceso a este equipo.",

				columns: {
					name: "Nombre",
					role: "Rol en el equipo",
					actions: "Acciones",
				},

				role: {
					member: "Miembro",
					admin: "Administrador",
					owner: "Propietario",
				},

				actions: {
					menu: "Menú de acciones",
					remove: "Eliminar del equipo",
					transfer: "Transferir propiedad",
					changeRole: {
						member: "Convertir en administrador",
						admin: "Convertir en miembro",
						owner: "No se puede cambiar al propietario",
					},
				},

				confirmation: {
					removeMember: "¿Está seguro de que desea eliminar a {{name}} del equipo?",
				},
			},

			invitedMembersTable: {
				label: "Invitaciones pendientes",
				description: "Personas que han sido invitadas pero aún no se han unido.",

				columns: {
					email: "Correo electrónico",
					actions: "Acciones",
				},

				actions: {
					menu: "Menú de acciones",
					copy: "Copiar enlace de invitación",
					revoke: "Revocar invitación",
				},

				confirmation: {
					revokeInvite: "¿Está seguro de que desea revocar la invitación de {{email}}?",
				},
			},

			error: {
				forbidden: {
					title: "No tiene permiso para acceder a esta página.",
					description: "Por favor, contacte al administrador de su equipo para obtener ayuda.",
				},

				unknown: {
					title: "Ocurrió un error inesperado.",
					description: "Por favor, intente de nuevo más tarde o contacte a soporte.",
				},
			},
		},

		invite: {
			header: {
				title: "Invitar miembro del equipo",
				description: "Envíe una invitación para unirse a su equipo.",
			},

			dialog: {
				close: "Cerrar diálogo",
			},

			form: {
				fields: {
					email: {
						label: "Dirección de correo electrónico",
						placeholder: "juan.perez@example.com",
						description:
							"La dirección de correo electrónico de la persona que desea invitar a {{team}}.",
					},
				},

				cancel: "Cancelar",
				cta: "Invitar miembro",
			},
		},

		acceptInvite: {
			errors: {
				pageTitle: "Invitación no disponible",
				notFound: "Esta invitación no existe.",
				gone: "Esta invitación ya fue aceptada.",
				forbidden: "Esta invitación no estaba destinada a usted.",
				badRequest:
					"De alguna manera no tiene una dirección de correo electrónico. Intente iniciar sesión de nuevo.",
				wrongEmail:
					"Esta invitación se envió a {{email}}. Inicia sesión con ese correo para aceptarla.",
			},
		},

		domains: {
			header: {
				title: "Dominios del Equipo",
				action: { addDomain: "Agregar dominio" },
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			sections: {
				domains: {
					title: "Dominios",
					description: "Administre los dominios verificados para su equipo.",
				},
			},

			form: {
				fields: {
					hostname: {
						label: "Dominio",
						placeholder: "example.com",
						description: "El dominio que desea agregar a {{team}}.",
					},
				},

				cta: "Agregar dominio",
			},

			table: {
				label: "Dominios verificados",
				description:
					"Dominios que se pueden usar para el aprovisionamiento automático de miembros del equipo.",

				columns: {
					hostname: "Nombre de host",
					id: "ID de verificación",
					verifiedAt: "Verificado el",
					actions: "Acciones",
				},

				verifiedAt: {
					pending: "Esperando verificación",
				},

				actions: {
					menu: "Menú de acciones",
					copy: "Copiar ID de verificación",
					remove: "Eliminar dominio",
					retryVerification: "Reintentar verificación",
				},

				confirmation: {
					removeDomain: "¿Está seguro de que desea eliminar {{hostname}} del equipo?",
				},
			},

			instructions: {
				title: "Cómo verificar su dominio",

				description:
					"Para verificar su dominio, agregue el siguiente registro `TXT` a su configuración DNS:",

				record: {
					name: {
						label: "Nombre",
						value: "_ping-verification",
					},
					content: {
						label: "Contenido",
						value: "VERIFICATION_ID",
					},
				},

				note: "Asegúrese de reemplazar <code>VERIFICATION_ID</code> con el ID de verificación real mostrado arriba.",

				disclaimer:
					"Los cambios de DNS pueden tardar en propagarse, por lo que la verificación podría retrasarse.",
			},

			error: {
				forbidden: {
					title: "No tiene permiso para acceder a esta página.",
					description: "Por favor, contacte al administrador de su equipo para obtener ayuda.",
				},

				unknown: {
					title: "Ocurrió un error inesperado.",
					description: "Por favor, intente de nuevo más tarde o contacte a soporte.",
				},
			},
		},

		alerts: {
			header: {
				title: "Alertas",

				action: {
					create: "Crear Alerta",
					history: "Ver historial",
				},
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			empty: {
				title: "No hay alertas configuradas",
				description: "Cree una alerta para recibir notificaciones cuando sus monitores fallen.",
				cta: "Crear Alerta",
			},

			limitReached: "Este equipo ha alcanzado el límite de {{limit}} alertas.",

			form: {
				fields: {
					name: {
						label: "Nombre",
						placeholder: "Alerta CTO",
						description: "Un nombre para identificar la alerta.",
					},

					/**
					 * Shared with the maintenance-window scope picker; this description covers
					 * just the alerts-specific sentence. See `components.monitorScope` for the
					 * rest of the picker's copy.
					 */
					scope: {
						description:
							"Qué vigila esta alerta. Déjala para todo el equipo, limítala a un tipo de monitor o apúntala a uno solo.",
					},

					channel: {
						label: "Canal",
						description: "El canal a usar para la alerta.",
						options: {
							webhook: "Webhook",
							email: "Correo electrónico",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "URL",
								placeholder: "https://example.com/webhook",
								description: "La URL a la que enviar el payload de la alerta.",
							},
							secret: {
								label: "Secreto de firma (opcional)",
								placeholder: "secreto-opcional",
								description:
									"Un secreto opcional para incluir en los encabezados de la solicitud. Se agregará un encabezado `Webhook-Signature` con una firma HMAC SHA256 del payload usando este secreto.",
							},
							signatureNote:
								"Cuando se configura, las solicitudes incluyen un encabezado <code>Webhook-Signature: sha256=<hex></code>: un HMAC-SHA256 del cuerpo JSON sin procesar usando este secreto.",
						},
						email: {
							to: {
								label: "Destinatario",
								placeholder: "cto@example.com",
								description: "La dirección de correo electrónico a la que enviar la alerta.",
							},

							subjectPrefix: {
								label: "Prefijo del asunto (opcional)",
								placeholder: "[Alerta Uptime]",
								description:
									"Un prefijo opcional para agregar al asunto del correo. Útil para filtrar alertas en su bandeja de entrada.",
							},
						},
						slack: {
							webhookUrl: {
								label: "URL del Webhook",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"La URL del Webhook entrante de Slack. Cree uno en api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Canal personalizado (opcional)",
								placeholder: "#alertas",
								description:
									"Canal opcional donde publicar en lugar del predeterminado del webhook. Incluya el prefijo #.",
							},
						},
						discord: {
							webhookUrl: {
								label: "URL del Webhook",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"La URL del Webhook de Discord. Cree uno en Configuración del servidor > Integraciones > Webhooks.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Notificar en recuperación",
						description:
							"Enviar una alerta cuando el monitor se recupere de un estado caído. Incluye tiempo de recuperación y duración del tiempo de inactividad.",
					},

					cooldown: {
						label: "Tiempo de espera de alertas",
						description:
							"Tiempo mínimo entre alertas del mismo tipo. Previene la fatiga de alertas durante interrupciones en curso.",
						options: {
							none: "Sin tiempo de espera",
							"5min": "5 minutos",
							"15min": "15 minutos",
							"30min": "30 minutos",
							"1hour": "1 hora",
							"2hours": "2 horas",
							custom: "Personalizado",
						},
						custom: {
							label: "Tiempo de espera personalizado (minutos)",
							placeholder: "Ingrese minutos",
							description: "Ingrese el número de minutos entre alertas.",
						},
					},

					cooldownMinutes: {
						label: "Tiempo de espera (minutos)",
						description:
							"Cuánto esperar antes de repetir una alerta mientras un monitor sigue caído. La primera alerta de un incidente se envía siempre de inmediato, y la recuperación se envía siempre. Las repeticiones nunca se espacian menos de {{floor}} minutos, sea lo que ponga aquí.",
					},

					legends: {
						email: "Configuración de correo electrónico",
						webhook: "Configuración del webhook",
						slack: "Configuración de Slack",
						discord: "Configuración de Discord",
					},
				},

				cta: "Crear Alerta",
			},

			table: {
				label: "Alertas",

				columns: {
					name: "Nombre",
					scope: "Alcance",
					strategy: "Tipo",
					notifyOnRecovery: "Recuperación",
					cooldown: "Tiempo de espera",
					actions: "Acciones",
				},

				scope: {
					unknownMonitor: "Monitor desconocido",
					teamWide: "Todo el equipo",
					allOfType: {
						http: "Todos los monitores HTTP",
						dns: "Todos los monitores DNS",
						tcp: "Todos los monitores TCP",
						cron: "Todas las tareas programadas",
						flow: "Todos los monitores de flujo",
					},
				},

				cooldown: {
					none: "Lo más rápido permitido",
					minutes: "{{count}} min",
					hours: "{{count}} hr",
				},

				actions: {
					menu: "Menú de acciones",
					edit: "Editar Alerta",
					remove: "Eliminar Alerta",
				},

				types: {
					webhook: "Webhook",
					email: "Correo electrónico",
					slack: "Slack",
					discord: "Discord",
				},

				notifyOnRecovery: {
					enabled: "Sí",
					disabled: "No",
				},

				confirmation: {
					deleteAlert: "¿Está seguro de que desea eliminar la alerta {{name}}?",
				},
			},
		},

		statusPages: {
			header: {
				title: "Páginas de estado",

				action: {
					create: "Crear Página de estado",
				},
			},

			empty: {
				title: "Aún no hay páginas de estado",
				description:
					"Cree una página de estado para compartir el estado de su sistema con sus usuarios.",
				cta: "Crear Página de estado",
			},

			table: {
				label: "Páginas de estado",

				columns: {
					name: "Nombre",
					slug: "URL",
					services: "Servicios",
					monitors: "Monitores",
					visibility: "Visibilidad",
					actions: "Acciones",
				},

				visibility: {
					public: "Pública",
					private: "Privada",
				},

				actions: {
					menu: "Menú de acciones",
					view: "Ver página",
					edit: "Editar página",
					delete: "Eliminar página",
				},

				confirmation: {
					delete: "¿Está seguro de que desea eliminar la página de estado {{name}}?",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nombre interno",
						placeholder: "Estado de producción",
						description: "Un nombre para identificar la página de estado internamente.",
					},
					slug: {
						label: "Slug de URL",
						placeholder: "produccion",
						description: "La ruta URL para la página de estado pública (ej., /status/produccion).",
					},
					title: {
						label: "Título público",
						placeholder: "Estado de Acme Inc.",
						description: "El título que se muestra en la página de estado pública.",
					},
					description: {
						label: "Descripción",
						placeholder: "Estado actual de los servicios de Acme Inc.",
						description: "Una descripción opcional para la página de estado.",
					},
					logoUrl: {
						label: "URL del logo",
						placeholder: "https://example.com/logo.png",
						description: "Un logo opcional para mostrar en la página de estado.",
					},
					isPublic: {
						label: "Pública",
						description: "Hacer esta página de estado accesible para cualquiera con el enlace.",
					},
					showOverallStatus: {
						label: "Mostrar estado general",
						description:
							"Mostrar un banner de estado general del sistema en la parte superior de la página.",
					},
					monitors: {
						label: "Monitores a incluir",
						description: "Seleccione qué monitores mostrar en esta página de estado.",
					},
					cronJobs: {
						label: "Cron jobs a incluir",
						description: "Seleccione qué cron jobs mostrar en esta página de estado.",
					},
				},

				cta: "Crear Página de estado",
				ctaUpdate: "Guardar cambios",
			},
		},

		createStatusPage: {
			header: {
				title: "Crear Página de estado",
			},
			form: {
				sections: {
					branding: {
						title: "Identidad",
						description: "Cómo se identifica la página, internamente y ante quienes la visitan.",
					},
					visibility: {
						title: "Visibilidad",
						description: "Quién puede acceder a esta página y cuánto revela de un vistazo.",
					},
					services: {
						title: "Servicios",
						description: "Elija los monitores y cron jobs sobre los que informa esta página.",
						empty:
							"Todavía no tiene monitores ni cron jobs. Cree uno y podrá añadirlo a esta página más adelante.",
					},
				},
			},
		},

		editStatusPage: {
			header: {
				title: "Editar Página de estado",
			},
			form: {
				sections: {
					branding: {
						title: "Identidad",
						description: "Cómo se identifica la página, ante usted y ante sus visitantes.",
					},
					visibility: {
						title: "Visibilidad",
						description: "Quién puede acceder a esta página y qué muestra en la parte superior.",
					},
					services: {
						title: "Servicios",
						description: "Elija los monitores y cron jobs sobre los que informa esta página.",
						empty: "Todavía no tiene monitores ni cron jobs que añadir.",
					},
				},
			},
			dangerZone: {
				title: "Zona de peligro",
				description: "Las acciones de esta sección no se pueden deshacer.",
				warning:
					"Al eliminar esta página de estado, su URL pública queda fuera de servicio para siempre.",
				deleteDescription: "Esta acción no se puede deshacer.",
			},
		},

		monitorsImport: {
			meta: { title: "Importar monitores" },
			header: { title: "Importar Monitores" },

			form: {
				sections: {
					urls: {
						title: "Qué importar",
						description: "Pegue las direcciones que quiere vigilar, una por línea.",
					},
					schedule: {
						title: "Cada cuánto comprobar",
						description:
							"Se aplica a todos los monitores que cree esta importación. Puede cambiar cualquiera de ellos después.",
					},
				},

				fields: {
					urls: {
						label: "URL a monitorear",
						description:
							"Una URL por línea, hasta {{limit}}. Un host suelto como ejemplo.com se convierte en https://ejemplo.com. Las líneas vacías y las repeticiones de la misma dirección se omiten.",
						placeholder: "ejemplo.com\nhttps://www.ejemplo.org/health\nstatus.ejemplo.net",
					},
					interval: {
						label: "Intervalo de comprobación",
						description:
							"Se aplica a todos los monitores de esta lista. Puede cambiar cualquiera de ellos después.",
					},
				},
				cta: "Importar Monitores",
			},

			/**
			 * Las líneas rechazadas, mostradas encima de la caja en la que se vuelven a
			 * pegar. Empezar por lo que sí se creó hace que una importación parcial se
			 * lea como un éxito.
			 */
			report: {
				section: { title: "Última importación" },
				title_one: "Se creó 1 monitor. Estas líneas no:",
				title_other: "Se crearon {{count}} monitores. Estas líneas no:",
				overflow_one:
					"Quedó 1 línea más fuera: una importación acepta {{limit}} líneas a la vez. Pegue el resto para importarlas.",
				overflow_other:
					"Quedaron {{count}} líneas más fuera: una importación acepta {{limit}} líneas a la vez. Pegue el resto para importarlas.",
				table: {
					label: "Líneas que no se importaron",
					columns: { line: "Línea", input: "Lo que pegó", reason: "Por qué" },
				},
				reasons: {
					invalidUrl: "No es una URL que podamos comprobar.",
					duplicate: "La misma dirección que una línea anterior.",
					tooLong: "Demasiado larga para ser una URL.",
				},
			},
		},

		httpMonitors: {
			header: {
				title: "Monitores HTTP",
				action: {
					create: "Crear Monitor",
					import: "Importar",
				},
			},
			empty: {
				title: "Aún no hay monitores HTTP",
				description: "Crea un monitor HTTP para comenzar a rastrear tus endpoints.",
				cta: "Crear Monitor",
			},
			table: {
				label: "Monitores HTTP",
				columns: {
					name: "Nombre",
					url: "URL",
					status: "Estado",
					responseTime: "Tiempo de Respuesta",
					lastChecked: "Última Verificación",
					actions: "Acciones",
				},
				neverChecked: "Nunca",
				disabled: "Deshabilitado",
				actions: {
					menu: "Menú de Acciones",
					view: "Ver",
					edit: "Editar",
					delete: "Eliminar",
				},
				status: {
					up: "Activo",
					down: "Caído",
					degraded: "Degradado",
					unknown: "Desconocido",
				},
				confirmation: {
					delete: "¿Estás seguro de que deseas eliminar el monitor {{name}}?",
					deleteDescription:
						"Esto también elimina sus verificaciones de contenido y el historial de resultados. Esta acción no se puede deshacer.",
				},
			},
		},

		dnsMonitors: {
			header: {
				title: "Monitores DNS",

				action: {
					create: "Crear Monitor DNS",
				},
			},

			empty: {
				title: "Aún no hay monitores DNS",
				description: "Cree un monitor DNS para rastrear cambios en los registros DNS.",
				cta: "Crear Monitor DNS",
			},

			table: {
				label: "Monitores DNS",

				columns: {
					name: "Nombre",
					domain: "Dominio",
					records: "Registros",
					status: "Estado",
					lastChecked: "Última verificación",
					actions: "Acciones",
				},

				records: "{{enabled}} de {{total}} vigilados",
				noRecords: "Ninguno aún",
				disabled: "Deshabilitado",
				neverChecked: "Nunca",
				notChecked: "No verificado",

				actions: {
					menu: "Menú de acciones",
					check: "Verificar ahora",
					edit: "Editar",
					delete: "Eliminar",
				},

				confirmation: {
					delete: "¿Está seguro de que desea eliminar el monitor DNS {{name}}?",
				},
			},
		},

		createDnsMonitor: {
			header: {
				title: "Crear Monitor DNS",
			},

			form: {
				sections: {
					basics: {
						title: "Datos básicos",
						description: "Qué vigila este monitor.",
					},
					checks: {
						title: "Ajustes de comprobación",
						description:
							"Con qué frecuencia se resuelve cada nombre al que se le hace seguimiento.",
					},
					zoneFile: {
						title: "Archivo de zona",
						description:
							"Pegue su zona para monitorear subdominios. Sin ella solo podemos ver el ápex de su dominio.",
					},
				},

				fields: {
					name: {
						label: "Nombre del Monitor",
						placeholder: "DNS de producción",
						description: "Un nombre descriptivo para este monitor DNS.",
					},

					domain: {
						label: "Dominio",
						placeholder: "example.com",
						description: "El dominio para monitorear los registros DNS.",
					},

					zoneFile: {
						label: "Archivo de zona",
						placeholder: "example.com.\t1\tIN\tA\t192.0.2.1",
						description:
							"Opcional. Pegue un archivo de zona BIND exportado desde su proveedor de DNS. Se lee una sola vez y nunca se almacena, y es la única forma en que podemos conocer los nombres de su zona.",
						limits: "Hasta {{size}} de texto y {{limit}} nombres por monitor.",
					},

					interval: {
						label: "Intervalo de verificación",
						description:
							"Con qué frecuencia se resuelve cada nombre al que se le hace seguimiento.",
						options: {
							"5m": "5 minutos",
							"15m": "15 minutos",
							"30m": "30 minutos",
							"1h": "1 hora",
							"6h": "6 horas",
							"12h": "12 horas",
							"24h": "24 horas",
						},
					},

					isEnabled: {
						label: "Habilitar monitoreo",
						description: "Comenzar a monitorear este dominio inmediatamente.",
					},
				},

				/** ADR-026 §14 requires this notice on the setup screen as well as in the docs. */
				apexOnlyNotice:
					"DNS no permite a nadie listar los registros de una zona. Sin un archivo de zona solo podemos vigilar el ápex de su dominio, nunca un subdominio.",

				cta: "Crear Monitor DNS",
			},
		},

		editDnsMonitor: {
			header: {
				title: "Editar Monitor DNS",
			},

			form: {
				sections: {
					basics: {
						title: "Datos básicos",
						description: "Qué vigila este monitor y con qué frecuencia comprueba.",
					},
				},

				fields: {
					name: {
						label: "Nombre del Monitor",
						placeholder: "DNS de producción",
						description: "Un nombre descriptivo para este monitor DNS.",
					},

					domain: {
						label: "Dominio",
						placeholder: "example.com",
						description: "El dominio para monitorear los registros DNS.",
					},

					zoneFile: {
						label: "Archivo de zona",
						placeholder: "example.com.\t1\tIN\tA\t192.0.2.1",
						description:
							"Opcional. Pegue un archivo de zona BIND exportado desde su proveedor de DNS. Se lee una sola vez y nunca se almacena, y es la única forma en que podemos conocer los nombres de su zona.",
					},

					interval: {
						label: "Intervalo de verificación",
						description:
							"Con qué frecuencia se resuelve cada nombre al que se le hace seguimiento.",
						options: {
							"5m": "5 minutos",
							"15m": "15 minutos",
							"30m": "30 minutos",
							"1h": "1 hora",
							"6h": "6 horas",
							"12h": "12 horas",
							"24h": "24 horas",
						},
					},

					isEnabled: {
						label: "Habilitar monitoreo",
						description: "Si monitorear activamente este dominio.",
					},
				},

				cancel: "Cancelar",
				cta: "Guardar cambios",
			},

			zoneFileImport: {
				title: "Archivo de zona",
				description:
					"Vuelva a pegar su zona para incorporar los nombres añadidos desde la última importación. El texto se lee una sola vez y nunca se almacena, por eso actualizarlo implica pedirle el archivo otra vez.",
				lastImported: "Importado por última vez el {{date}}.",
				neverImported:
					"No se ha importado ningún archivo de zona. Este monitor cubre solo el ápex.",
				cta: "Importar archivo de zona",
			},

			dangerZone: {
				title: "Zona de peligro",
				deleteMonitor: "Eliminar monitor",
				deleteDescription:
					"Esto también elimina sus registros y su historial de verificaciones. Esto no se puede deshacer.",
				description: "Las acciones de esta sección no se pueden deshacer.",
				warning:
					"Al eliminar este monitor se borran para siempre sus comprobaciones DNS, su historial y sus alertas.",
			},
		},

		dnsMonitorDetail: {
			header: {
				title: 'Monitor DNS "{{name}}"',

				action: {
					check: "Verificar ahora",
					refresh: "Actualizar",
					edit: "Editar",
				},
			},

			uptimeHistory: "Historial de actividad",
			notChecked: "No verificado",

			info: {
				domain: "Dominio",
				status: "Estado",
				recordsWatched: "Registros vigilados",
				recordsWatchedValue: "{{enabled}} de {{total}}",
				zoneFileImported: "Archivo de zona importado",
				zoneFileNeverImported: "Nunca — solo el ápex",
			},

			stats: {
				totalChecks: {
					label: "Verificaciones totales",
					description: "Número de verificaciones DNS realizadas",
				},

				successRate: {
					label: "Tasa de éxito",
					description: "Porcentaje de verificaciones exitosas",
				},
			},

			results: {
				title: "Historial de verificaciones",
				empty: "Aún no se han realizado verificaciones.",

				table: {
					columns: {
						checkedAt: "Verificado el",
						status: "Estado",
						findings: "Hallazgos",
						responseTime: "Consulta más lenta",
					},
				},

				findings: "{{changed}} cambiados · {{missing}} faltantes · {{new}} nuevos",
				noFindings: "Sin cambios",
				/** Only successfully answered queries enter the diff, so a partial sweep reads as partial. */
				queriesFailed_one: "{{count}} consulta no respondió",
				queriesFailed_other: "{{count}} consultas no respondieron",
			},

			records: {
				title: "Registros con seguimiento",
				description:
					"Todos los registros que hemos visto alguna vez para este dominio. Los registros sin vigilar se conservan para que nunca se vuelvan a descubrir como nuevos.",
				empty: "Aún no se le hace seguimiento a ningún registro.",

				table: {
					columns: {
						name: "Nombre",
						type: "Tipo",
						value: "Valor",
						source: "Origen",
						state: "Estado",
						watched: "Vigilado",
					},
				},

				source: {
					resolver: "Resuelto",
					zone_file: "Archivo de zona",
				},

				state: {
					ok: "OK",
					changed: "Cambiado",
					missing: "Faltante",
					new: "Nuevo",
					error: "Error",
				},

				actions: {
					enable: "Vigilar",
					disable: "Dejar de vigilar",
				},
			},
		},

		/**
		 * The review step between creating a domain monitor and monitoring anything
		 * with it. Its own page keeps a reload landing back on this decision point.
		 */
		dnsMonitorReview: {
			header: {
				title: 'Revise los registros de "{{name}}"',
				description:
					"Todos los registros que encontramos se vigilan de forma predeterminada. Desmarque aquello sobre lo que no quiera recibir alertas: se conserva de todos modos, así que nada de lo que descarte volverá más adelante como un registro nuevo.",
			},

			/** Every line the parser could not use is still surfaced to the user. */
			unparsed: {
				title_one: "{{count}} línea no se importó",
				title_other: "{{count}} líneas no se importaron",
				description:
					"Estas líneas no forman parte del subconjunto que leemos. Nada de lo que declaran se monitorea.",
				line: "Línea {{line}}: {{reason}}",

				/** One sentence per parser outcome, so each names the fix it points at. */
				reasons: {
					originDirective:
						"Cambia a qué zona pertenecen los nombres que vienen después, así que no podemos leerla con seguridad",
					ttlDirective: "No hacemos seguimiento de los TTL",
					includeDirective: "Nombra un archivo que no tenemos y que no vamos a descargar",
					generateDirective: "Se expande en muchos nombres a la vez",
					unsupportedDirective: "No es una directiva que leamos",
					multiLineRecord: "Repartido en varias líneas con paréntesis",
					blankOwnerContinuation: "Empieza con un espacio y hereda el nombre de la línea anterior",
					nonInternetClass: "No es un registro de la clase internet",
					unsupportedType: "No es ninguno de los seis tipos de registro que vigilamos",
					outOfZone: "Pertenece a otro dominio",
					malformed: "No pudimos leer esto como un registro",
				},
			},

			groups: {
				resolving: {
					title: "Resolviendo ahora",
					description:
						"Encontrados al resolver todos los tipos de registro admitidos en cada nombre conocido.",
				},
				discovered: {
					title: "Descubiertos recientemente",
					description:
						"Resuelven ahora, pero no estaban en la última revisión. Quedan sin vigilar hasta que los acepte, de modo que un registro que apareció sin su intervención nunca se convierte en una expectativa en su nombre.",
				},
				declared: {
					title: "Declarados pero sin resolver",
					description:
						"Están en su archivo de zona, pero hoy nada responde por ellos. Quedan sin vigilar salvo que indique lo contrario: una zona pegada es una foto de un momento, y solo envejece.",
					proxiedNote:
						"Un registro tras un proxy no aparece en la exportación de su propia zona y responde con la dirección del proxy. En una zona con proxy esto es normal y esperable: no es señal de que algo esté fallando.",
				},
			},

			/**
			 * A line repeating a record an earlier line already declared. Kept apart
			 * from the rejections, since nothing was lost — the record was imported
			 * from whichever line named it first.
			 */
			duplicates: {
				title_one: "{{count}} línea declaraba un registro que otra línea ya declaraba",
				title_other: "{{count}} líneas declaraban registros que otras líneas ya declaraban",
				description:
					"No se perdió nada. DNS responde una sola vez a un registro repetido, así que se importó desde la primera línea que lo declaraba.",
				line: "Línea {{line}}: {{name}} {{type}} ya se había declarado en la línea {{firstLine}}.",
			},

			/** The cap is enforced at review time, so this notice appears there too. */
			namesCap: {
				title: "Más nombres de los que un monitor puede vigilar",
				description:
					"Este monitor abarca ahora {{count}} nombres, y una comprobación puede recorrer {{limit}}. Reparta la zona entre varios monitores para que todos los nombres se sigan comprobando.",
			},

			/** Column headings match the monitor's own record list, so both screens read alike. */
			table: {
				columns: {
					watched: "Vigilado",
					name: "Nombre",
					type: "Tipo",
					value: "Valor",
				},

				/** Each box names the record it decides, so a row makes sense read on its own. */
				watchRecord: "Vigilar {{name}} {{type}}",
			},

			empty: "No se encontró nada para este dominio.",
			cancel: "Cancelar",
			cta: "Guardar registros",
		},

		maintenance: {
			header: {
				title: "Ventanas de mantenimiento",

				action: {
					create: "Programar mantenimiento",
				},
			},

			empty: {
				title: "No hay ventanas de mantenimiento",
				description:
					"Programe ventanas de mantenimiento para suprimir alertas durante el tiempo de inactividad planificado.",
				cta: "Programar mantenimiento",
			},

			tabs: {
				label: "Estado de mantenimiento",
				active: "Activo",
				upcoming: "Próximo",
				past: "Pasado",
			},

			noActive: "No hay ventanas de mantenimiento activas",
			noUpcoming: "No hay ventanas de mantenimiento próximas",
			noPast: "No hay ventanas de mantenimiento pasadas",

			table: {
				columns: {
					name: "Nombre",
					schedule: "Horario",
					monitor: "Monitor",
					status: "Estado",
					actions: "Acciones",
					scope: "Alcance",
					starts: "Inicio",
					ends: "Fin",
				},

				allMonitors: "Todos los Monitores",
				recurring: "Recurrente",
				unknownMonitor: "Monitor desconocido",
				endedEarly: "Finalizada antes de tiempo",
				edit: "Editar",

				status: {
					active: "Activo",
					upcoming: "Programado",
					past: "Completado",
				},

				actions: {
					menu: "Menú de acciones",
					end: "Finalizar ahora",
					delete: "Eliminar",
				},

				confirmation: {
					endMaintenance:
						"¿Está seguro de que desea finalizar el mantenimiento '{{name}}' antes de tiempo?",
					deleteMaintenance: "¿Está seguro de que desea eliminar '{{name}}'?",
				},
			},
		},

		createMaintenance: {
			header: {
				title: "Programar mantenimiento",
			},

			form: {
				sections: {
					coverage: {
						title: "Alcance",
						description: "Ponga un nombre a esta ventana y elija a qué monitores se aplica.",
					},
					schedule: {
						title: "Programación",
						description: "Cuándo empieza y termina la ventana de mantenimiento.",
					},
					behavior: {
						title: "Comportamiento",
						description: "Qué ocurre mientras la ventana está activa y si se repite.",
					},
				},

				fields: {
					name: {
						label: "Nombre",
						placeholder: "Actualización de base de datos",
						description: "Una descripción del trabajo de mantenimiento.",
					},

					monitor: {
						label: "Monitor",
						description: "Seleccione un monitor específico o deje vacío para todos los monitores.",
						all: "Todos los Monitores",
					},

					startsAt: {
						label: "Hora de inicio",
						description: "Cuándo comienza la ventana de mantenimiento.",
					},

					duration: {
						label: "Duración",
						description: "Cuánto dura la ventana de mantenimiento.",
						options: {
							"15m": "15 minutos",
							"30m": "30 minutos",
							"1h": "1 hora",
							"2h": "2 horas",
							"4h": "4 horas",
							"8h": "8 horas",
						},
					},

					suppressAlerts: {
						label: "Suprimir alertas",
						description: "No enviar alertas durante esta ventana de mantenimiento.",
					},

					showOnStatusPage: {
						label: "Mostrar en página de estado",
						description: "Mostrar un aviso de mantenimiento en las páginas de estado públicas.",
					},

					isRecurring: {
						label: "Recurrente",
						description: "Repetir esta ventana de mantenimiento según un horario.",
					},

					recurringPattern: {
						label: "Patrón de recurrencia",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"Formato del patrón: 'daily:HH:MM-HH:MM', 'weekly:diaDeLaSemana:HH:MM-HH:MM', o 'monthly:diaDelMes:HH:MM-HH:MM'",
					},
				},

				preview: {
					label: "Ventana de mantenimiento",
				},

				cta: "Programar mantenimiento",
			},
		},

		editMaintenance: {
			header: {
				title: "Editar {{name}}",
			},

			form: {
				cta: "Guardar cambios",
				cancel: "Cancelar",
				sections: {
					coverage: {
						title: "Qué abarca",
						description: "Ponga un nombre a esta ventana y elija a qué monitores se aplica.",
					},
					schedule: {
						title: "Programación",
						description: "Cuándo empieza y termina la ventana de mantenimiento.",
					},
					behavior: {
						title: "Durante el mantenimiento",
						description:
							"Cómo se comportan las alertas y su página de estado mientras la ventana está activa.",
					},
					recurrence: {
						title: "Repetición",
						description:
							"Repita esta ventana según una programación en lugar de ejecutarla una sola vez.",
					},
				},
			},

			endNow: {
				cta: "Finalizar mantenimiento ahora",
				title: "Finalizar esta ventana",
				description: "Esta ventana está activa en este momento.",
				warning:
					"Al finalizarla ahora se reanudan las alertas y se retira el aviso de mantenimiento de su página de estado. La ventana en sí se conserva.",
			},

			danger: {
				title: "Zona de peligro",

				description: "Acciones irreversibles para esta ventana de mantenimiento.",
				warning: "Eliminar esta ventana de mantenimiento no se puede deshacer.",
				delete: {
					trigger: "Eliminar ventana de mantenimiento",
					confirmTitle: "¿Eliminar esta ventana de mantenimiento?",
					confirmDescription: "Esta acción no se puede deshacer.",
					confirm: "Eliminar",
				},
			},
		},

		maintenanceWindows: {
			form: {
				fields: {
					name: {
						label: "Nombre",
					},

					scope: {
						description:
							"Qué cubre esta ventana. Déjala para todo el equipo, limítala a un tipo de monitor o apúntala a uno solo.",
					},

					startsAt: {
						label: "Hora de inicio",
					},

					endsAt: {
						label: "Hora de fin",
					},

					suppressAlerts: {
						label: "Suprimir alertas durante esta ventana",
					},

					showOnStatusPage: {
						label: "Mostrar en la página de estado",
					},

					recurring: {
						label: "Recurrente",
					},

					recurringPattern: {
						label: "Patrón de recurrencia (si es recurrente)",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"daily:HH:MM-HH:MM, weekly:<día>:HH:MM-HH:MM, o monthly:<día-del-mes>:HH:MM-HH:MM, en UTC.",
					},
				},
			},
		},

		alertHistory: {
			header: {
				title: "Historial de alertas",
			},

			breadcrumbs: {
				alerts: "Alertas",
			},

			empty: {
				title: "Aún no hay eventos de alerta",
				description:
					"Los eventos de alerta aparecerán aquí cuando los monitores activen alertas. Configure alertas para comenzar.",
				cta: "Ver Alertas",
			},

			table: {
				label: "Eventos de alerta",

				columns: {
					alert: "Alerta",
					monitor: "Monitor",
					eventType: "Evento",
					status: "Estado",
					sentAt: "Hora",
				},

				unknownAlert: "Alerta desconocida",
				unknownMonitor: "Monitor desconocido",

				eventType: {
					down: "Caído",
					up: "Recuperado",
					degraded: "Degradado",
				},

				status: {
					sent: "Enviado",
					skipped_cooldown: "Omitido (Tiempo de espera)",
					skipped_cap: "Omitido (Límite de repeticiones)",
					skipped: "Omitido",
					failed: "Fallido",
				},
			},
		},

		createAlert: {
			header: {
				title: "Crear Alerta",
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			form: {
				sections: {
					basics: {
						title: "Datos básicos",
						description: "Cómo se llama esta alerta y qué monitores vigila.",
					},
					channel: {
						title: "Canal de notificación",
						description:
							"Adónde se envía la notificación. Solo son obligatorios los campos del canal que elija.",
					},
					delivery: {
						title: "Reglas de envío",
						description:
							"Si se anuncian las recuperaciones y con qué frecuencia se repite el aviso mientras un monitor sigue caído.",
					},
				},

				fields: {
					name: {
						label: "Nombre",
						placeholder: "Alerta CTO",
						description: "Un nombre para identificar la alerta.",
					},

					strategy: {
						label: "Estrategia",
						description: "La estrategia a usar para la alerta.",
						options: {
							webhook: "Webhook",
							email: "Correo electrónico",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "URL del Webhook",
								placeholder: "https://example.com/webhook",
								description: "La URL a la que enviar el payload de la alerta.",
							},
							secret: {
								label: "Secreto",
								placeholder: "secreto-opcional",
								description:
									"Un secreto opcional para incluir en los encabezados de la solicitud. Se agregará un encabezado `Webhook-Signature` con una firma HMAC SHA256 del payload usando este secreto.",
							},
						},
						email: {
							to: {
								label: "Dirección de correo electrónico",
								placeholder: "cto@example.com",
								description: "La dirección de correo electrónico a la que enviar la alerta.",
							},

							subjectPrefix: {
								label: "Prefijo del asunto",
								placeholder: "[Alerta Uptime]",
								description:
									"Un prefijo opcional para agregar al asunto del correo. Útil para filtrar alertas en su bandeja de entrada.",
							},
						},
						slack: {
							webhookUrl: {
								label: "URL del Webhook de Slack",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"La URL del Webhook entrante de Slack. Cree uno en api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Canal personalizado",
								placeholder: "#alertas",
								description:
									"Canal opcional donde publicar en lugar del predeterminado del webhook. Incluya el prefijo #.",
							},
						},
						discord: {
							webhookUrl: {
								label: "URL del Webhook de Discord",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"La URL del Webhook de Discord. Cree uno en Configuración del servidor > Integraciones > Webhooks.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Notificar en recuperación",
						description:
							"Enviar una alerta cuando el monitor se recupere de un estado caído. Incluye tiempo de recuperación y duración del tiempo de inactividad.",
					},

					cooldown: {
						label: "Tiempo de espera de alertas",
						description:
							"Tiempo mínimo entre alertas del mismo tipo. Previene la fatiga de alertas durante interrupciones en curso.",
						options: {
							none: "Sin tiempo de espera",
							"5min": "5 minutos",
							"15min": "15 minutos",
							"30min": "30 minutos",
							"1hour": "1 hora",
							"2hours": "2 horas",
							custom: "Personalizado",
						},
						custom: {
							label: "Tiempo de espera personalizado (minutos)",
							placeholder: "Ingrese minutos",
							description: "Ingrese el número de minutos entre alertas.",
						},
					},
				},

				cta: "Crear Alerta",
			},
		},

		editAlert: {
			header: {
				title: "Editar Alerta",
			},

			form: {
				cta: "Guardar cambios",
				cancel: "Cancelar",
				sections: {
					basics: {
						title: "Qué vigila",
						description:
							"Ponga un nombre a esta alerta y elija si cubre todos los monitores o solo uno.",
					},
					channel: {
						title: "Cómo avisa",
						description: "Elija un canal y complete el destino al que debe enviar.",
					},
					delivery: {
						title: "Reglas de envío",
						description:
							"Controle los avisos de recuperación y con qué frecuencia puede repetirse una alerta durante una caída.",
					},
				},
			},

			danger: {
				title: "Zona de peligro",

				description: "Acciones irreversibles para esta alerta.",
				warning:
					"Al eliminar esta alerta se detienen todas las notificaciones que envía. Esta acción no se puede deshacer.",
				delete: {
					trigger: "Eliminar alerta",
					confirmTitle: "¿Eliminar esta alerta?",
					confirmDescription: "Esta acción no se puede deshacer.",
					confirm: "Eliminar",
				},
			},
		},

		logout: {
			title: "¿Está seguro de que desea cerrar sesión?",
			cta: "Cerrar sesión",
		},

		trial: {
			/**
			 * El informe como página propia, accesible con el token de la vigilancia. Cada
			 * cifra se calcula a partir de las comprobaciones guardadas, así que una vigilancia
			 * sin comprobaciones muestra una raya con una explicación, ya que nada ha corrido aún.
			 */
			report: {
				meta: {
					title: "Su informe de salud del sitio de {{days}} días — Uptime",
					description:
						"El uptime, las comprobaciones y los incidentes que registramos en su sitio durante su semana gratuita de monitoreo.",
				},
				eyebrow: "Informe de salud de {{days}} días",
				period: "Monitoreado del {{start}} al {{end}} ({{zone}})",
				bar: {
					caption: "Un bloque por día durante {{days}} días, el más antiguo primero.",
					status: {
						up: "Activo todo el día",
						degraded: "Lento al menos una vez",
						down: "Caído al menos una vez",
						noData: "Sin comprobaciones ese día",
					},
				},
				summary: {
					title: "Lo que registramos",
					uptime: "Uptime",
					checks: "Comprobaciones completadas",
					healthy: "Comprobaciones totalmente sanas",
					noChecks:
						"Todavía no ha terminado ninguna comprobación, así que no hay nada que informar sobre esta URL. La primera comprobación horaria se ejecuta una hora después de que empezara la vigilancia.",
				},
				incidents: {
					title: "Incidentes",
					unknown:
						"Todavía no ha terminado ninguna comprobación, así que no podemos decir si esta URL tuvo algún incidente.",
					none_one:
						"Ningún incidente: la única comprobación completada respondió como se esperaba.",
					none_other:
						"Ningún incidente: las {{count}} comprobaciones completadas respondieron como se esperaba.",
					summary_one: "Un incidente.",
					summary_other: "{{count}} incidentes.",
					entry_one: "Primer fallo visto el {{started}} — falló una comprobación.",
					entry_other:
						"Primer fallo visto el {{started}} — fallaron {{count}} comprobaciones seguidas.",
				},
				timing: {
					title: "Tiempos de respuesta",
					fastest: "Más rápido",
					average: "Promedio",
					slowest: "Más lento",
					basis_one: "Medido sobre la única comprobación que respondió.",
					basis_other: "Medido sobre las {{count}} comprobaciones que respondieron.",
				},
				cta: {
					title: "Siga monitoreando este sitio por {{price}}/mes",
					action: "Empezar a monitorear",
					convertible: {
						body: "Inicie sesión y convertiremos esta URL en un monitor real, con el histórico de arriba ya incorporado.",
					},
					expired: {
						body: "Esta semana gratuita ya pasó su plazo de reclamación, así que el histórico de arriba se queda aquí, pero puede empezar a monitorear esta URL en serio cuando quiera.",
					},
					converted: {
						title: "Esta URL ya se está monitoreando",
						body: "Convirtió este objetivo en un monitor, así que ahora se comprueba con su propia frecuencia.",
						action: "Abrir su panel de control",
					},
				},
			},

			meta: {
				title: "Informe gratuito de salud web de {{days}} días — Uptime",
				description:
					"Comprobamos su sitio ahora, luego cada hora durante {{days}} días, y le enviamos por correo lo que encontramos. Sin cuenta, sin tarjeta.",
			},

			heading: "Un informe de salud gratuito de {{days}} días para su sitio",
			intro:
				"Denos una URL y la comprobamos ahora mismo desde nuestra red: la misma comprobación que ejecuta un monitor de pago. Deje un email después y seguimos comprobando cada hora durante {{days}} días, y luego le enviamos el informe.",

			form: {
				url: {
					label: "URL a comprobar",
					description: "Una dirección http:// o https:// en la internet pública.",
					placeholder: "https://ejemplo.com",
				},
				submit: "Ejecutar la primera comprobación",
			},

			refusal: {
				title: "La comprobación no se ejecutó",
				blockedTarget:
					"Esa no es una dirección que vayamos a comprobar en su nombre. Tiene que ser una URL http:// o https:// pública, en el puerto 80 o 443, sin usuario ni contraseña, y resolver a algún sitio de la internet abierta.",
				challengeIncomplete: "Complete la verificación y podremos ejecutar la comprobación.",
				failedChallenge:
					"No pudimos confirmar que la petición viniera de un navegador. Recargue la página e inténtelo de nuevo.",
				rateLimited: "Puede ejecutar otra comprobación en un minuto.",
				rateLimitedFor: "Puede ejecutar otra comprobación en {{seconds}} segundos.",
				budgetExhausted:
					"Ya hemos hecho todas las comprobaciones gratuitas que hacemos en un día. Esto es cosa nuestra, no de su URL: vuelva mañana, o empiece a monitorear y la comprobaremos cada minuto.",
				unavailable:
					"Algo de nuestro lado impidió que la comprobación llegara a ejecutarse, así que no aprendimos nada sobre su URL. El problema es nuestro, no suyo. Inténtelo de nuevo en un momento.",
			},

			result: {
				checkAnother: "Comprobar otra URL",
				noResponse: "Sin respuesta",
				httpStatus: "HTTP {{status}}",
				milliseconds: "{{value}} ms",
				checkedAt: "Comprobado el {{time}}",

				redirect: {
					badge: "Redirige",
					title: "Esta URL redirige a otro sitio",
					description:
						"Respondió, y respondió señalándonos otra dirección. No fuimos allí: solo comprobamos la URL que nos dio, y eso es lo que impide que esta caja sirva para llegar a donde no debe. Compruebe el destino y tendrá un resultado real de él.",
					destination: "Apunta a {{url}}",
					action: "Comprobar esa en su lugar",
					unknownDestination:
						"No leímos a dónde apunta. Abra la URL en un navegador, mire dónde acaba y compruebe aquí esa dirección.",
				},

				status: {
					up: "Activo",
					degraded: "Lento",
					down: "Caído",
				},
			},

			lead: {
				title: "Reciba el informe gratuito de {{days}} días",
				description:
					"La comprobación que acaba de ver era la primera. Deje un email y seguimos, y luego le contamos qué encontraron {{days}} días de comprobaciones.",
				consent: "Escríbanme también de vez en cuando sobre Uptime.",
				consentNote: "En cualquier caso tendrá las comprobaciones.",
				promise: "Cada email lleva un enlace de un clic que los detiene y borra su dirección.",
				submit: "Empezar el informe gratuito de {{days}} días",

				/**
				 * Lo que acepta un visitante, dicho junto al campo. Cada línea nombra una
				 * garantía que el sistema ya cumple: la dirección sondeada, la frecuencia y
				 * duración propias de la vigilancia, y los tres correos que existen.
				 */
				expectations: {
					target:
						"Seguimos comprobando {{url}}: exactamente la dirección que acabamos de comprobar, y nada más.",
					cadence: "Una vez por hora, cada hora, durante {{days}} días.",
					emails:
						"Un resumen al día, un aviso cuando cambia el estado y el informe completo al final.",
					noAccount: "Sin tarjeta, sin contraseña, sin cuenta que crear.",
				},

				email: {
					label: "Email",
					placeholder: "tu@ejemplo.com",
					error: "Eso no parece una dirección de email.",
				},
			},

			monitor: {
				title: "Siga vigilando esta URL",
				description:
					"Convierta esta comprobación en un monitor: la misma comprobación con la frecuencia que elija y un aviso en cuanto algo cambie.",
				subscribeDescription:
					"Convierta esta comprobación en un monitor: la misma comprobación con la frecuencia que elija y un aviso en cuanto algo cambie. Empezará a ejecutarse en cuanto su suscripción esté activa.",
				create: "Crear un monitor para esta URL",
				subscribe: "Activar su suscripción",
			},

			watching: {
				title: "Estamos en ello",
				description:
					"La primera comprobación horaria de {{url}} se ejecuta dentro de una hora, y seguimos comprobando durante {{days}} días. Ya tiene en su bandeja una copia de la que acaba de hacer.",
			},

			repeated: {
				title: "Esta ya la hemos comprobado",
				description:
					"{{url}} ya tuvo su informe gratuito en una petición anterior: cada URL tiene uno cada 30 días. Le hemos enviado por correo todo lo que encontraron esas comprobaciones, así que no hemos iniciado nada nuevo.",
			},

			benefits: {
				title: "Qué cubre el informe",
				description:
					"Todo lo que un monitor de pago le diría sobre esta URL, gratis, durante {{days}} días.",

				list: {
					hourly: {
						title: "Una comprobación cada hora",
						description:
							"Durante {{days}} días, desde la misma red en la que corre un monitor de pago.",
					},
					changes: {
						title: "Un email cuando cambia",
						description:
							"Se cae o vuelve, y se entera. Como mucho uno al día, para que un sitio inestable no le desborde.",
					},
					digest: {
						title: "Un resumen al día",
						description:
							"Cómo aguantó su URL, de un vistazo, y los {{days}} días completos en un informe al final.",
					},
					noAccount: {
						title: "Sin cuenta y sin tarjeta",
						description: "Nada que registrar, y un clic lo detiene para siempre.",
					},
				},
			},

			more: {
				title: "No solo sitios web",
				description:
					"El informe gratuito cubre HTTP. Con una cuenta de pago le vigilamos tres cosas más.",

				list: {
					tcp: {
						title: "TCP",
						description:
							"Saber que un puerto sigue respondiendo, para lo que no son webs: bases de datos, servidores de correo, servidores de juego.",
					},
					dns: {
						title: "DNS",
						description:
							"Saber que un registro sigue apuntando a donde debe, para que un secuestro o un cambio mal hecho no pase desapercibido.",
					},
					cron: {
						title: "Tareas programadas",
						description:
							"Saber que su copia de seguridad nocturna terminó, y enterarse la noche en que no.",
					},
				},
			},

			cta: {
				badge: "Cuando acabe el informe",
				title: "Siga monitoreando este sitio por {{price}} al mes",
				description:
					"Registrarse convierte esta URL en un monitor real y arrastra su histórico de comprobaciones, así que nada empieza de cero. Una comprobación cada minuto en lugar de cada hora, todas las URL que quiera, alertas donde ya trabaja, páginas de estado y un año de histórico.",
				action: "Seguir monitoreando este sitio",
				pricing: "Ver precios",
			},
		},

		unsubscribe: {
			confirm: {
				title: "¿Detener estos emails?",
				body: "Esto termina todas las comprobaciones que pidió esa dirección y borra la dirección junto con todo lo registrado a su nombre. No se guarda nada, así que no hay nada que deshacer, pero puedes volver a empezar desde nuestra web cuando quieras.",
				cta: "Sí, detener y borrar",
			},

			done: {
				title: "Te has dado de baja",
				body: "Esa dirección ya no está en nuestra lista y las comprobaciones que pidió se han detenido. No se le enviará nada más. Puedes volver a empezar desde nuestra web cuando quieras.",
				cta: "Volver al sitio",
			},
		},
		splat: {
			notFound: {
				title: "No encontrado",
				description: "La página que está buscando no existe.",
			},
		},

		account: {
			meta: {
				title: "Cuenta - Uptime",
				description: "Administre la configuración de su cuenta y equipos.",
			},

			header: {
				title: "Cuenta",
			},

			form: {
				actions: {
					cancel: "Cancelar",
				},
			},

			profile: {
				title: "Perfil",
				description: "Su información personal.",

				card: {
					title: "Detalles del perfil",
					description: "Su nombre, dirección de correo electrónico y avatar.",
				},
			},

			language: {
				title: "Preferencia de idioma",
				description: "Elija su idioma preferido para la interfaz.",

				card: {
					title: "Idioma",
					description: "Se aplica al panel y a las notificaciones por correo electrónico.",
				},

				form: {
					fields: {
						language: {
							label: "Idioma preferido",
							description:
								"Seleccione su idioma preferido. Auto-detectar usa la configuración de su navegador.",
							options: {
								auto: "Auto-detectar",
								en: "English",
								es: "Español",
								de: "Deutsch",
								ja: "日本語",
								fr: "Français",
								it: "Italiano",
							},
						},
					},

					cta: "Guardar idioma",
				},
			},

			emails: {
				title: "Correos",
				description: "Elija qué correos le enviamos.",

				card: {
					title: "Notificaciones por correo electrónico",
					description:
						"Se aplican a todos los equipos a los que pertenece. Las alertas y las invitaciones no se ven afectadas.",
				},

				list: {
					teamDailyDigest: {
						name: "Resumen diario de monitores",
						description:
							"Cada mañana, un correo por equipo con el estado de cada uno de sus monitores durante el día anterior.",
					},
					teamWeeklyDigest: {
						name: "Resumen semanal de monitores",
						description:
							"Los lunes, el mismo informe de los últimos siete días, con la disponibilidad de la semana día a día.",
					},
				},

				form: {
					cta: "Guardar correos",
				},
			},

			teams: {
				title: "Sus equipos",
				description: "Equipos de los que forma parte.",

				actions: {
					createTeam: "Crear equipo",
				},

				empty: {
					title: "Todavía no tiene equipos",
					description: "Cree un equipo para empezar a monitorear sus servicios.",
					cta: "Crear equipo",
				},

				table: {
					label: "Equipos",
					description: "Todos los equipos a los que pertenece.",

					columns: {
						team: "Equipo",
						role: "Rol",
						actions: "Acciones",
					},

					role: {
						member: "Miembro",
						admin: "Administrador",
						owner: "Propietario",
					},

					actions: {
						menu: "Menú de acciones",
						leave: "Salir del equipo",
					},

					confirmation: {
						leaveTeam: "¿Seguro que quiere salir de {{name}}?",
					},
				},
			},

			dataExport: {
				title: "Sus datos",
				description: "Descargue todo lo que esta aplicación guarda sobre usted.",

				card: {
					title: "Exporte sus datos",
					description: "Un solo archivo JSON, generado cuando usted lo pide. No se almacena nada.",
					includes:
						"Incluye su perfil y sus preferencias, cada equipo al que pertenece y su rol en él y —para los equipos de los que es propietario— sus monitores, alertas, ventanas de mantenimiento, páginas de estado y dominios verificados.",
					excludes:
						"Excluye todo lo que no le corresponde llevarse: los datos de otros miembros, las direcciones de las personas invitadas, los hashes de las claves de API, los secretos de los webhooks y las URL de los webhooks de Slack o Discord. El historial de comprobaciones también queda fuera: lo produce la configuración anterior, y el archivo lo indica.",
				},

				form: {
					cta: "Descargar JSON",
				},
			},

			deleteAccount: {
				title: "Eliminar cuenta",
				description: "Cierre su cuenta y elimine los datos que hay detrás.",

				queued: {
					title: "Eliminación solicitada",
					description:
						"Su cuenta está en cola para ser eliminada y todavía no se ha eliminado nada. Ocurre en menos de un día, y le enviaremos un correo cuando esté hecho. Todavía puede detenerlo: cancele abajo en cualquier momento antes de que se ejecute.",
					requestedAt: "Solicitada el {{date}}.",
					cta: "Cancelar eliminación",
				},

				card: {
					title: "Elimine su cuenta",
					description:
						"Pone su cuenta en cola para ser eliminada. No se elimina nada al enviar este formulario.",

					whatHappens:
						"Su solicitud queda en cola y se cierra su sesión. En menos de un día cancelamos su suscripción, eliminamos sus datos y le enviamos un correo para confirmar que está hecho. Hasta entonces nada ha desaparecido, y si vuelve a iniciar sesión puede cancelar.",

					noOwnedTeams:
						"No es propietario de ningún equipo, así que solo se eliminarán sus propias membresías y preferencias. Los equipos a los que pertenece siguen adelante sin usted.",

					ownedTeamsIntro:
						"En esta aplicación no hay forma de traspasar un equipo a otra persona, así que todo equipo del que es propietario se elimina junto con su cuenta, con sus monitores, alertas, páginas de estado, claves de API y miembros:",
					ownedTeam_one: "{{name}} — 1 miembro más pierde el acceso.",
					ownedTeam_other: "{{name}} — {{count}} miembros más pierden el acceso.",
					ownedTeamAlone: "{{name}} — sin otros miembros.",

					othersWarning_one:
						"1 persona más perderá el acceso a un equipo cuando esto se ejecute. No se le preguntará ni se le avisará.",
					othersWarning_other:
						"{{count}} personas más perderán el acceso a sus equipos cuando esto se ejecute. No se les preguntará ni se les avisará.",

					retained: {
						intro: "Hay cosas que no se pueden eliminar, y preferimos decirlo:",
						billing:
							"Las facturas y los registros de pago que guarda nuestro proveedor de facturación: la ley fiscal obliga a conservarlos.",
						analytics:
							"Los resultados de las comprobaciones de monitoreo en nuestro almacén de analítica, que solo admite agregar datos: los registros expiran según un calendario de retención y no se pueden eliminar antes.",
						logs: "Los registros de peticiones del servidor, que expiran según el mismo tipo de calendario.",
						identity:
							"Su identidad de inicio de sesión, que pertenece al proveedor de identidad con el que inicia sesión y no a nosotros.",
					},

					confirmation: {
						label: 'Escriba "DELETE" para confirmar',
						placeholder: "DELETE",
					},

					cta: "Poner la cuenta en cola para eliminación",
				},
			},
		},

		createTeam: {
			header: {
				title: "Crear Equipo",
				description: "Cree un nuevo equipo para monitorear sus servicios.",
			},

			dialog: {
				close: "Cerrar diálogo",
			},

			form: {
				fields: {
					name: {
						label: "Nombre del Equipo",
						placeholder: "Mi Equipo Increíble",
						description: "Elija un nombre para su nuevo equipo.",
					},
				},

				cancel: "Cancelar",
				cta: "Crear Equipo",
			},
		},

		settings: {
			header: {
				title: "Configuración del Equipo",
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			sections: {
				general: {
					title: "General",
					description: "Administre la información básica de su equipo.",
				},
			},

			form: {
				card: {
					title: "Perfil del Equipo",
					description: "Actualice el nombre y logo de su equipo.",
				},

				fields: {
					logo: {
						label: "URL del logo",
						placeholder: "https://example.com/logo.png",
						description: "Una URL a la imagen del logo de su equipo.",
					},
					name: {
						label: "Nombre del Equipo",
						placeholder: "Mi Equipo",
						description: "El nombre de su equipo.",
					},
				},

				actions: {
					cancel: "Cancelar",
					save: "Guardar cambios",
				},
			},

			members: {
				title: "Miembros",
				description: "Administre los miembros de su equipo y sus roles.",

				actions: {
					invite: "Invitar miembro",
				},

				table: {
					label: "Miembros actuales",
					description: "Personas que tienen acceso a este equipo.",

					columns: {
						name: "Nombre",
						role: "Rol",
						actions: "Acciones",
					},

					role: {
						member: "Miembro",
						admin: "Administrador",
						owner: "Propietario",
					},

					actions: {
						menu: "Menú de acciones",
						remove: "Eliminar del equipo",
						transfer: "Transferir propiedad",
						changeRole: {
							member: "Convertir en administrador",
							admin: "Convertir en miembro",
							owner: "No se puede cambiar al propietario",
						},
					},

					confirmation: {
						removeMember: "¿Está seguro de que desea eliminar a {{name}} del equipo?",
					},
				},

				invitedTable: {
					label: "Invitaciones pendientes",
					description: "Personas que han sido invitadas pero aún no se han unido.",

					columns: {
						email: "Correo electrónico",
						expires: "Expira",
						actions: "Acciones",
					},

					expires: {
						expired: "Expirado",
					},

					actions: {
						menu: "Menú de acciones",
						copy: "Copiar enlace de invitación",
						revoke: "Revocar invitación",
					},

					confirmation: {
						revokeInvite: "¿Está seguro de que desea revocar la invitación de {{email}}?",
					},

					empty: {
						description: "No hay invitaciones pendientes.",
					},
				},
			},

			domains: {
				title: "Dominios",
				description: "Administre los dominios verificados para su equipo.",

				actions: {
					addDomain: "Agregar dominio",
				},

				table: {
					label: "Dominios verificados",
					description:
						"Dominios que se pueden usar para el aprovisionamiento automático de miembros del equipo.",

					columns: {
						hostname: "Nombre de host",
						id: "ID de verificación",
						verifiedAt: "Verificado el",
						actions: "Acciones",
					},

					verifiedAt: {
						pending: "Esperando verificación",
					},

					actions: {
						menu: "Menú de acciones",
						copy: "Copiar ID de verificación",
						remove: "Eliminar dominio",
						retryVerification: "Reintentar verificación",
					},

					confirmation: {
						removeDomain: "¿Está seguro de que desea eliminar {{hostname}} del equipo?",
					},

					empty: {
						description: "Aún no hay dominios verificados.",
					},
				},

				form: {
					title: "Agregar dominio",

					fields: {
						hostname: {
							label: "Dominio",
							placeholder: "example.com",
							description: "El dominio que desea agregar a {{team}}.",
						},
					},

					cta: "Agregar dominio",
				},

				instructions: {
					title: "Cómo verificar su dominio",
					description:
						"Para verificar su dominio, agregue el siguiente registro TXT a su configuración DNS:",

					record: {
						name: {
							label: "Nombre",
							value: "_ping-verification",
						},
						content: {
							label: "Contenido",
							value: "VERIFICATION_ID",
						},
					},

					note: "Asegúrese de reemplazar <code>VERIFICATION_ID</code> con el ID de verificación real mostrado arriba.",
					disclaimer:
						"Los cambios de DNS pueden tardar en propagarse, por lo que la verificación podría retrasarse.",
				},
			},

			billing: {
				title: "Facturación",
				description: "Administre su suscripción y detalles de pago.",

				card: {
					title: "Suscripción y pagos",
					description: "Vea facturas, actualice métodos de pago y administre su suscripción.",
					notice:
						"Será redirigido al portal de clientes de Polar para administrar su configuración de facturación.",
					cta: "Abrir portal de facturación",
				},
			},

			danger: {
				title: "Zona de peligro",
				description: "Acciones irreversibles que afectan a su equipo.",

				card: {
					title: "Eliminar Equipo",
					description:
						"Eliminar permanentemente este equipo y todos sus datos. Esta acción no se puede deshacer.",
					warning:
						"Esto cancelará su suscripción y eliminará todos los monitores, alertas, dominios, miembros e invitaciones.",
					confirmation: {
						label: "Escriba DELETE para confirmar",
						placeholder: "DELETE",
					},
					cta: "Eliminar Equipo",
				},
			},

			error: {
				forbidden: {
					title: "No tiene permiso para acceder a esta página.",
					description: "Por favor, contacte al administrador de su equipo para obtener ayuda.",
				},

				unknown: {
					title: "Ocurrió un error inesperado.",
					description: "Por favor, intente de nuevo más tarde o contacte a soporte.",
				},
			},
		},

		flowMonitorDetail: {
			header: {
				breadcrumb: { flowMonitors: "Monitores de flujo" },
				action: { edit: "Editar" },
			},

			info: {
				status: "Estado",
				interval: "Se ejecuta cada",
				lastChecked: "Última verificación",
				enabled: "Habilitado",
			},

			stats: {
				passRate: { label: "Tasa de éxito" },
				avgDuration: { label: "Duración media" },
				totalRuns: { label: "Ejecuciones totales" },
			},

			failure: {
				title: "Último fallo",
				failedTest: "{{test}} falló en la línea {{line}}.",
			},

			source: { title: "Flujo" },

			results: {
				title: "Ejecuciones",
				empty: "Aún no hay ejecuciones.",
				label: "Ejecuciones del flujo",
				columns: {
					time: "Hora",
					status: "Estado",
					tests: "Pruebas",
					requests: "Solicitudes",
					duration: "Duración",
				},
			},
		},

		flowMonitors: {
			header: {
				title: "Monitores de flujo",
				action: { create: "Crear" },
			},

			empty: {
				title: "Aún no hay monitores de flujo",
				description:
					"Un monitor de flujo ejecuta varias solicitudes en orden y comprueba lo que devuelven: inicia sesión, lee el token y llama al endpoint que ese token autoriza. Responde la pregunta que una sola solicitud no puede hacer.",
				cta: "Cree su primer monitor de flujo",
			},

			table: {
				label: "Monitores de flujo",
				columns: {
					name: "Nombre",
					interval: "Cada",
					status: "Estado",
					lastChecked: "Última verificación",
					actions: "Acciones",
				},
				status: {
					pending: "Aún sin verificar",
					up: "Superado",
					down: "Fallido",
					error: "No se puede ejecutar",
					disabled: "Deshabilitado",
				},
				actions: {
					menu: "Menú de acciones",
					view: "Ver",
					edit: "Editar",
					delete: "Eliminar",
					confirmation: {
						delete:
							"¿Está seguro de que desea eliminar el monitor de flujo {{name}}? Esta acción no se puede deshacer.",
					},
				},
			},

			run: {
				cta: "Ejecutar ahora",
				toast: {
					up: "{{name}} superado",
					down: "{{name}} falló",
					error: "{{name}} no se pudo ejecutar",
					refused: "{{name}} no se ejecutó",
					summary:
						"{{passed}} de {{total}} pruebas superadas, {{requests}} solicitudes, {{duration}}ms.",
					failedTest: "Fallo: {{test}} (línea {{line}}).",
				},
			},
		},

		createFlowMonitor: {
			header: {
				title: "Crear monitor de flujo",
				breadcrumb: { flowMonitors: "Monitores de flujo" },
			},

			form: {
				cta: "Crear monitor de flujo",
				sections: {
					basics: {
						title: "Flujo",
						description: "Qué hace este flujo y con qué frecuencia se ejecuta.",
					},
				},
				fields: {
					name: {
						label: "Nombre del monitor",
						placeholder: "Iniciar sesión y cargar el panel",
						description: "Un nombre descriptivo para este flujo.",
					},
					source: {
						label: "Flujo",
						placeholder: 'test "un miembro puede iniciar sesión" { when { … } then { … } }',
						description:
							"Las solicitudes y las aserciones entre ellas. Cada URL debe escribirse aquí para poder comprobarse contra sus dominios verificados.",
						verifiedDomains: "Este flujo puede alcanzar: {{domains}} — y sus subdominios.",
						noVerifiedDomains:
							"Este equipo no tiene dominios verificados, así que todavía no puede ejecutarse ningún flujo. Verifique primero un dominio en la configuración del equipo.",
					},
					interval: {
						label: "Ejecutar cada",
						description:
							"Con qué frecuencia se ejecuta este flujo. Cada ejecución factura una verificación por cada solicitud que realiza, así que un intervalo más corto cuesta más.",
						options: {
							"900": "15 minutos",
							"1800": "30 minutos",
							"3600": "1 hora",
							"10800": "3 horas",
							"21600": "6 horas",
							"43200": "12 horas",
							"86400": "1 día",
						},
					},
					isEnabled: { label: "Habilitado" },
				},
			},
		},

		editFlowMonitor: {
			header: {
				title: "Editar monitor de flujo",
				breadcrumb: { flowMonitors: "Monitores de flujo" },
			},

			lastRun: {
				title: "Última ejecución",
				description: "Qué concluyó este flujo la última vez que se ejecutó.",
				summary:
					"{{passed}} de {{total}} pruebas superadas, {{requests}} solicitudes, {{duration}}ms.",
				failedTest: "Fallo: {{test}} (línea {{line}}).",
			},

			form: {
				cta: "Guardar cambios",
				cancel: "Cancelar",
				sections: {
					settings: {
						title: "Flujo",
						description: "Qué hace este flujo y con qué frecuencia se ejecuta.",
					},
				},
				fields: {
					name: {
						label: "Nombre del monitor",
						placeholder: "Iniciar sesión y cargar el panel",
						description: "Un nombre descriptivo para este flujo.",
					},
					source: {
						label: "Flujo",
						placeholder: 'test "un miembro puede iniciar sesión" { when { … } then { … } }',
						description:
							"Las solicitudes y las aserciones entre ellas. Cada URL debe escribirse aquí para poder comprobarse contra sus dominios verificados.",
						verifiedDomains: "Este flujo puede alcanzar: {{domains}} — y sus subdominios.",
						noVerifiedDomains:
							"Este equipo no tiene dominios verificados, así que todavía no puede ejecutarse ningún flujo. Verifique primero un dominio en la configuración del equipo.",
					},
					interval: {
						label: "Ejecutar cada",
						description:
							"Con qué frecuencia se ejecuta este flujo. Cada ejecución factura una verificación por cada solicitud que realiza, así que un intervalo más corto cuesta más.",
						options: {
							"900": "15 minutos",
							"1800": "30 minutos",
							"3600": "1 hora",
							"10800": "3 horas",
							"21600": "6 horas",
							"43200": "12 horas",
							"86400": "1 día",
						},
					},
					isEnabled: { label: "Habilitado" },
				},
			},

			danger: {
				title: "Zona de peligro",
				sectionDescription: "Acciones irreversibles para este monitor de flujo.",
				warning:
					"Al eliminar este monitor de flujo también se eliminan todos los resultados que ha registrado.",
				description: "Esta acción no se puede deshacer.",
				cta: "Eliminar monitor de flujo",
			},
		},
		tcpMonitors: {
			header: {
				title: "Monitores TCP",
				action: {
					create: "Crear Monitor TCP",
				},
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
				limitation: {
					title: "Limitación del monitoreo TCP",
					description:
						"El monitoreo de puertos TCP requiere el plan pago de Cloudflare Workers con soporte de sockets. En el plan gratuito, las verificaciones TCP se mostrarán como no disponibles. Considere usar el monitoreo HTTP como alternativa.",
				},
			},

			empty: {
				title: "Aún no hay monitores TCP",
				description:
					"Cree un monitor TCP para verificar si los puertos están abiertos y responden.",
				cta: "Crear Monitor TCP",
			},

			table: {
				label: "Monitores TCP",
				columns: {
					name: "Nombre",
					endpoint: "Host:Puerto",
					status: "Estado",
					lastChecked: "Última verificación",
					responseTime: "Tiempo de respuesta",
					actions: "Acciones",
				},
				status: {
					up: "Activo",
					down: "Caído",
					timeout: "Tiempo agotado",
					disabled: "Deshabilitado",
					pending: "Pendiente",
				},
				actions: {
					edit: "Editar",
					delete: "Eliminar",
					confirmation: {
						delete: "¿Está seguro de que desea eliminar {{name}}?",
					},
				},
			},
		},

		createTcpMonitor: {
			header: {
				title: "Crear Monitor TCP",
				breadcrumb: {
					tcpMonitors: "Monitores TCP",
				},
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			form: {
				sections: {
					basics: {
						title: "Datos básicos",
						description: "Qué vigila este monitor y con qué frecuencia lo comprueba.",
					},
				},

				fields: {
					name: {
						label: "Nombre del Monitor",
						placeholder: "Servidor de base de datos",
						description: "Un nombre descriptivo para este monitor TCP.",
					},
					host: {
						label: "Host",
						placeholder: "db.example.com",
						description: "El nombre de host o dirección IP a monitorear.",
					},
					port: {
						label: "Puerto",
						placeholder: "5432",
						description: "El puerto TCP a verificar (1-65535).",
						decrement: "Disminuir puerto",
						increment: "Aumentar puerto",
					},
					interval: {
						label: "Intervalo de verificación",
						description: "Con qué frecuencia verificar el puerto.",
						decrement: "Disminuir intervalo de verificación",
						increment: "Aumentar intervalo de verificación",
					},
					timeout: {
						label: "Tiempo de espera de conexión",
						description: "Cuánto tiempo esperar una conexión antes de agotar el tiempo.",
						decrement: "Disminuir tiempo de espera de conexión",
						increment: "Aumentar tiempo de espera de conexión",
					},
				},
				cta: "Crear Monitor",
			},
		},

		editTcpMonitor: {
			header: {
				title: "Editar Monitor TCP",
				breadcrumb: {
					tcpMonitors: "Monitores TCP",
				},
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			form: {
				sections: {
					settings: {
						title: "Ajustes del monitor",
						description: "A qué se conecta este monitor y con qué frecuencia comprueba.",
					},
				},

				fields: {
					name: {
						label: "Nombre del Monitor",
						placeholder: "Servidor de base de datos",
						description: "Un nombre descriptivo para este monitor TCP.",
					},
					host: {
						label: "Host",
						placeholder: "db.example.com",
						description: "El nombre de host o dirección IP a monitorear.",
					},
					port: {
						label: "Puerto",
						placeholder: "5432",
						description: "El puerto TCP a verificar (1-65535).",
						decrement: "Disminuir puerto",
						increment: "Aumentar puerto",
					},
					interval: {
						label: "Intervalo de verificación",
						description: "Con qué frecuencia verificar el puerto.",
						decrement: "Disminuir intervalo de verificación",
						increment: "Aumentar intervalo de verificación",
					},
					timeout: {
						label: "Tiempo de espera de conexión",
						description: "Cuánto tiempo esperar una conexión antes de agotar el tiempo.",
						decrement: "Disminuir tiempo de espera de conexión",
						increment: "Aumentar tiempo de espera de conexión",
					},
					isEnabled: {
						label: "Habilitar monitoreo",
					},
				},
				cancel: "Cancelar",
				cta: "Guardar cambios",
			},

			danger: {
				title: "Zona de peligro",
				cta: "Eliminar monitor",
				description:
					"Esto también elimina su historial de resultados de verificación. Esta acción no se puede deshacer.",
				sectionDescription: "Las acciones de esta sección no se pueden deshacer.",
				warning:
					"Al eliminar este monitor se borran para siempre sus comprobaciones, su historial y sus alertas.",
			},
		},

		tcpMonitorDetail: {
			header: {
				breadcrumb: {
					tcpMonitors: "Monitores TCP",
				},
				action: {
					edit: "Editar",
					checkNow: "Verificar ahora",
				},
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			info: {
				title: "Configuración del Monitor",
				endpoint: "Endpoint",
				status: "Estado",
				interval: "Intervalo de verificación",
				timeout: "Tiempo de espera",
			},

			stats: {
				uptime: {
					label: "Uptime",
					description: "Basado en verificaciones recientes",
				},
				avgResponseTime: {
					label: "Tiempo de respuesta prom.",
					description: "Tiempo promedio de conexión",
				},
				totalChecks: {
					label: "Verificaciones totales",
					description: "Número de verificaciones realizadas",
				},
			},

			history: {
				title: "Historial de Uptime",
			},

			results: {
				title: "Historial de verificaciones",
				description: "Resultados recientes de verificaciones de conexión TCP",
				label: "Resultados",
				empty:
					"Aún no hay resultados de verificación. Los resultados aparecerán después de que se ejecute la primera verificación.",
				columns: {
					time: "Hora",
					status: "Estado",
					responseTime: "Tiempo de respuesta",
					error: "Error",
				},
			},
		},

		apiKeys: {
			header: {
				title: "Claves API",
				action: {
					create: "Crear clave API",
				},
			},

			docsLink: {
				text: "Aprende a usar las claves de API en nuestra",
				link: "documentación",
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			empty: {
				title: "Aún no hay claves API",
				description: "Cree una clave API para acceder a la API de Uptime programáticamente.",
				cta: "Crear clave API",
			},

			newKey: {
				title: "¡Clave API '{{name}}' creada!",
				description: "Copie esta clave ahora. Por razones de seguridad, no podrá verla de nuevo.",
				dismiss: "He copiado mi clave",
				copyLabel: "Copiar clave",
			},

			form: {
				title: "Crear nueva clave API",
				description: "Las claves API permiten acceso programático a sus monitores y alertas.",

				sections: {
					details: {
						title: "Detalles de la clave",
						description:
							"Póngale un nombre para reconocerla más adelante y decida cuándo debe dejar de funcionar.",
					},
				},

				fields: {
					name: {
						label: "Nombre de la clave",
						placeholder: "Clave API de producción",
						description: "Un nombre para identificar esta clave API.",
					},
					scopes: {
						label: "Permisos",
						description: "Seleccione a qué puede acceder esta clave API.",
						descriptions: {
							"teams:read":
								"Leer el nombre y el logotipo del equipo, y listar sus miembros con sus roles.",
							"teams:write":
								"Cambiar el nombre y el logotipo del equipo. No permite añadir ni eliminar miembros, ni eliminar el equipo.",
							"invites:read":
								"Listar las invitaciones del equipo, pendientes y aceptadas, incluida la dirección de correo a la que se envió cada una.",
							"invites:write":
								"Invitar a una dirección de correo al equipo y revocar una invitación existente. Quien acepte una invitación pasa a ser miembro.",
							"team-domains:read":
								"Listar los dominios reclamados por el equipo y si cada uno está verificado.",
							"team-domains:write":
								"Reclamar un dominio para el equipo o eliminarlo. Una vez verificado un dominio, cualquiera que se registre con un correo de ese dominio se une automáticamente al equipo.",
							"monitors:read":
								"Leer los monitores HTTP, sus resultados de comprobación, sus estadísticas de disponibilidad y el estado general del equipo.",
							"monitors:write":
								"Crear, actualizar y eliminar monitores HTTP y sus comprobaciones de contenido. También permite encolar una reconstrucción de las estadísticas diarias.",
							"maintenance:read": "Listar y leer las ventanas de mantenimiento del equipo.",
							"maintenance:write":
								"Crear, actualizar, finalizar antes de tiempo y eliminar ventanas de mantenimiento. Una ventana en curso puede silenciar las alertas de los monitores que cubre.",
							"dns-monitors:read":
								"Listar y leer los monitores DNS y los resultados de resolución que registraron.",
							"dns-monitors:write": "Crear, actualizar y eliminar monitores DNS.",
							"tcp-monitors:read":
								"Listar y leer los monitores TCP y los resultados de conexión que registraron.",
							"tcp-monitors:write": "Crear, actualizar y eliminar monitores TCP.",
							"flow-monitors:read":
								"Listar y leer los monitores de flujo y los resultados de sus ejecuciones. El código del flujo nunca se devuelve, ya que contiene las credenciales con las que el flujo inicia sesión.",
							"flow-monitors:write": "Crear, actualizar y eliminar monitores de flujo.",
							"alerts:read":
								"Listar y leer las alertas y los eventos que dispararon. Las URL de webhook y otros secretos de canal nunca se devuelven.",
							"alerts:write":
								"Crear, actualizar y eliminar alertas, incluidos sus destinos de webhook y chat. Eliminar una alerta detiene todas las notificaciones que enviaba.",
							"status-pages:read":
								"Listar y leer las páginas de estado del equipo y los monitores asociados a cada una.",
							"status-pages:write":
								"Crear, actualizar y eliminar páginas de estado, y reemplazar el conjunto de monitores y trabajos cron que una página muestra públicamente.",
							"cron-jobs:read": "Listar y leer los trabajos cron del equipo y sus programaciones.",
							"cron-jobs:write":
								"Crear, actualizar y eliminar trabajos cron. Eliminar uno hace que su URL de ping deje de aceptarse.",
							"cron-jobs:ping":
								"Figura por la URL de ping de los trabajos cron, que es pública y no comprueba ningún alcance. Concederlo no da a la clave ningún acceso que no tenga ya.",
							"api-keys:read":
								"Listar las claves API del equipo con su nombre, prefijo, alcances y caducidad. La clave secreta en sí nunca se devuelve.",
							"api-keys:write":
								"Crear y eliminar las claves API del equipo. Una clave nueva puede recibir cualquier alcance, así que este permite conceder todos los demás.",
							"ping:trigger":
								"Ejecutar comprobaciones HTTP, DNS y TCP puntuales sin crear un monitor. Cada comprobación se factura como un ping y requiere una suscripción activa.",
						} satisfies Record<ApiKeyScope, string>,
					},
					expiresAt: {
						label: "Fecha de expiración (Opcional)",
						description: "Deje vacío para una clave que nunca expire.",
					},
				},

				actions: {
					cancel: "Cancelar",
					create: "Crear clave API",
				},
			},

			table: {
				label: "Claves API",

				columns: {
					name: "Nombre",
					prefix: "Clave",
					scopes: "Permisos",
					lastUsed: "Último uso",
					expires: "Expira",
					actions: "Acciones",
				},

				lastUsed: {
					never: "Nunca",
				},

				expires: {
					never: "Nunca",
				},

				actions: {
					menu: "Menú de acciones",
					delete: "Eliminar clave",
				},

				confirmation: {
					delete:
						"¿Está seguro de que desea eliminar la clave API '{{name}}'? Esta acción no se puede deshacer.",
				},
			},

			error: {
				forbidden: {
					title: "No tiene permiso para acceder a esta página.",
					description: "Por favor, contacte al administrador de su equipo para obtener ayuda.",
				},

				unknown: {
					title: "Ocurrió un error inesperado.",
					description: "Por favor, intente de nuevo más tarde o contacte a soporte.",
				},
			},
		},

		cronJobs: {
			header: {
				title: "Cron Jobs",
				action: {
					create: "Crear Cron Job",
				},
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			empty: {
				title: "Aún no hay cron jobs",
				description: "Cree un monitor de cron job para rastrear sus tareas programadas.",
				cta: "Crear Cron Job",
			},

			table: {
				label: "Monitores de Cron Job",
				columns: {
					name: "Nombre",
					schedule: "Horario",
					status: "Estado",
					lastPing: "Último Ping",
					nextExpected: "Próximo Esperado",
					actions: "Acciones",
				},
				status: {
					healthy: "Saludable",
					late: "Retrasado",
					missed: "Perdido",
					new: "Nuevo",
				},
				disabled: "Deshabilitado",
				actions: {
					edit: "Editar",
					delete: "Eliminar",
					confirmation: {
						delete: "¿Está seguro de que desea eliminar {{name}}?",
					},
				},
			},
		},

		createCronJob: {
			header: {
				title: "Crear Cron Job",
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			form: {
				sections: {
					basics: {
						title: "Datos básicos",
						description: "Cómo se llama este trabajo y qué hace.",
					},
					schedule: {
						title: "Programación",
						description:
							"Cuándo se espera que se ejecute el trabajo y cuánto puede retrasarse antes de contar como omitido.",
					},
					alerting: {
						title: "Alertas",
						description: "Qué ocurre cuando no llega una ejecución esperada.",
					},
				},

				fields: {
					name: {
						label: "Nombre",
						placeholder: "Respaldo Diario",
						description: "Un nombre descriptivo para este monitor de cron job.",
					},
					description: {
						label: "Descripción",
						placeholder: "Descripción opcional de lo que hace este trabajo",
						description: "Una descripción opcional para ayudar a identificar este cron job.",
					},
					cronExpression: {
						label: "Expresión Cron",
						placeholder: "0 * * * *",
						description: "La expresión de programación cron (ej., '0 * * * *' para cada hora).",
					},
					gracePeriod: {
						label: "Período de Gracia",
						description:
							"Cuánto tiempo esperar después del tiempo esperado antes de marcar como retrasado.",
						decrement: "Disminuir período de gracia",
						increment: "Aumentar período de gracia",
						unit: {
							minutes: "minutos",
							seconds: "segundos",
						},
					},
					timezone: {
						label: "Zona Horaria",
						description: "La zona horaria para la programación cron.",
					},
					alertOnLate: {
						label: "Alertar en Retraso",
						description: "Enviar una alerta cuando el trabajo pierde su tiempo esperado.",
					},
					enabled: {
						label: "Habilitado",
						description: "Comenzar a monitorear este cron job inmediatamente.",
					},
				},
				cta: "Crear Cron Job",
			},
		},

		editCronJob: {
			header: {
				title: "Editar Cron Job",
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			form: {
				sections: {
					basics: {
						title: "Datos básicos",
						description: "Cómo se llama este trabajo y qué hace.",
					},
					schedule: {
						title: "Programación",
						description:
							"Cuándo se espera que se ejecute el trabajo y cuánto puede retrasarse antes de contar como omitido.",
					},
					alerting: {
						title: "Alertas",
						description: "Qué ocurre cuando no llega una ejecución esperada.",
					},
				},

				fields: {
					name: {
						label: "Nombre",
						placeholder: "Respaldo Diario",
						description: "Un nombre descriptivo para este monitor de cron job.",
					},
					description: {
						label: "Descripción",
						placeholder: "Descripción opcional de lo que hace este trabajo",
						description: "Una descripción opcional para ayudar a identificar este cron job.",
					},
					cronExpression: {
						label: "Expresión Cron",
						placeholder: "0 * * * *",
						description: "La expresión de programación cron (ej., '0 * * * *' para cada hora).",
					},
					gracePeriod: {
						label: "Período de Gracia",
						description:
							"Cuánto tiempo esperar después del tiempo esperado antes de marcar como retrasado.",
						decrement: "Disminuir período de gracia",
						increment: "Aumentar período de gracia",
						unit: {
							minutes: "minutos",
							seconds: "segundos",
						},
					},
					timezone: {
						label: "Zona Horaria",
						description: "La zona horaria para la programación cron.",
					},
					alertOnLate: {
						label: "Alertar en Retraso",
						description: "Enviar una alerta cuando el trabajo pierde su tiempo esperado.",
					},
					enabled: {
						label: "Habilitado",
						description: "Si monitorear activamente este cron job.",
					},
				},
				cancel: "Cancelar",
				cta: "Guardar Cambios",
			},

			danger: {
				title: "Zona de peligro",

				description: "Las acciones de esta sección no se pueden deshacer.",
				warning:
					"Al eliminar este cron job se borran para siempre su historial de pings y sus alertas.",
				delete: {
					trigger: "Eliminar monitor",
					confirmTitle: "¿Eliminar este monitor de cron job?",
					confirmDescription:
						"Esto también elimina su historial de pings. Esta acción no se puede deshacer.",
					confirm: "Eliminar",
				},
			},
		},

		cronJobDetail: {
			header: {
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
				action: {
					edit: "Editar",
					delete: "Eliminar",
				},
			},

			alert: {
				subscription: {
					title: "¡Sus monitores están pausados!",
					description: "Se requiere una suscripción para continuar monitoreando automáticamente.",
					cta: "Comenzar a monitorear",
				},
			},

			info: {
				title: "Configuración del Cron Job",
				schedule: "Horario",
				timezone: "Zona Horaria",
				status: "Estado",
				gracePeriod: "Período de Gracia",
				gracePeriodValue: "{{duration}} de gracia",
				description: "Descripción",
			},

			stats: {
				totalPings: {
					label: "Total de Pings",
					description: "Número de pings recibidos",
				},
				onTimeRate: {
					label: "Tasa a Tiempo",
					description: "Porcentaje de pings a tiempo",
				},
				lastPing: {
					label: "Último Ping",
					description: "Cuándo se recibió el último ping",
					never: "Nunca",
				},
				nextExpected: {
					label: "Próximo Esperado",
					description: "Cuándo se espera el próximo ping",
				},
			},

			ping: {
				title: "Haga ping a este monitor",
				description:
					"Haz que tu tarea envíe una petición POST aquí al terminar, con una clave de API que tenga el alcance `cron-jobs:ping`.",
				snippet: {
					curl: "Desde un script",
					copyCurl: "Copiar comando",
					crontab: "Desde crontab",
					copyCrontab: "Copiar línea de crontab",
				},
				apiKey: {
					text: "Sin una clave con ese alcance, el ping se rechaza con un 401 y la ejecución igual cuenta como perdida.",
					cta: "Crea una clave de API",
				},
			},

			uptimeHistory: "Historial de actividad",

			pings: {
				title: "Historial de Pings",
				description: "Pings recientes recibidos de este cron job",
				empty:
					"Aún no se han recibido pings. Los pings aparecerán aquí después de que su trabajo envíe su primer ping.",
				label: "Pings",
				columns: {
					time: "Hora",
					status: "Estado",
					sourceIp: "IP de Origen",
				},
				status: {
					onTime: "A Tiempo",
					late: "Retrasado",
				},
			},

			integration: {
				title: "Instrucciones de Integración",
				description: "Envíe una solicitud POST a este endpoint cuando su cron job se complete.",
				endpoint: "Endpoint de Ping",
				curlExample: "Ejemplo cURL",
				codeExamples: {
					title: "Ejemplos de Código",
					bash: "Bash / Cron",
					python: "Python",
					nodejs: "Node.js",
				},
				apiKeyNote:
					"Necesita una clave API con el alcance 'cron-jobs:ping'. Cree una en la configuración de Claves API.",
			},

			delete: {
				confirmation:
					"¿Está seguro de que desea eliminar {{name}}? Esta acción no se puede deshacer.",
			},
		},
	},

	docs: {
		meta: {
			title: "Documentación - Uptime",
			description:
				"Documentación del servicio de monitoreo Uptime. Aprenda a usar monitores, alertas, páginas de estado y más.",
		},

		header: {
			cta: {
				in: "Abrir Panel",
				out: "Comenzar a Monitorear",
			},
		},

		sidebar: {
			title: "Documentación",
			description: "Guías y referencia",
			searchPlaceholder: "Buscar...",
			openMenu: "Abrir menú",
			closeMenu: "Cerrar menú",
		},

		nav: {
			gettingStarted: "Primeros Pasos",
			overview: "Descripción General",
			quickstart: "Inicio Rápido",

			api: "Referencia de API",
			apiOverview: "Descripción de API",
			authentication: "Autenticación",
			errors: "Errores",

			resources: "Recursos",
			monitors: "Monitores",
			dnsMonitors: "Monitores DNS",
			tcpMonitors: "Monitores TCP",
			cronJobs: "Tareas Cron",
			alerts: "Alertas",
			statusPages: "Páginas de Estado",
		},

		error: {
			title: "Error de Documentación",
			description: "Hubo un error al cargar esta página de documentación.",
			notFoundTitle: "Página No Encontrada",
			notFoundDescription: "La página de documentación que buscas no existe.",
		},

		lastUpdated: "Última actualización: {{date}}",
	},
};
