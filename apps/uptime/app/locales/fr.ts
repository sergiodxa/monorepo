/**
 * French (fr) translation dictionary for the Uptime app. It maps every UI copy key
 * to its French string across the landing page, dashboard, monitors, alerts, teams,
 * domains, status pages, and toast/error messages. It exists so the interface can be
 * rendered in French, mirroring the shape of the English base dictionary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ApiKeyScope } from "~/database/schema";

export default {
	landing: {
		meta: {
			title: "Uptime par Sergio Xalambrí",
			description: "Surveillance de disponibilité simple et fiable pour les développeurs",
		},

		header: {
			title: "Uptime",

			nav: {
				pricing: "Tarifs",
				features: "Fonctionnalités",
				compare: "Comparer",
				docs: "Docs",

				cta: {
					in: "Ouvrir le tableau de bord",
					out: "Commencer la surveillance",
				},
			},
		},

		try: {
			title: "Vérifiez n'importe quelle URL, gratuitement",
			description:
				"Aucun compte requis. Nous effectuons une vérification et vous montrons exactement ce qu'un moniteur signalerait.",
			label: "Vérifier une URL",
			placeholder: "https://exemple.com",
			submit: "Lancer un test",
		},

		hero: {
			pill: "Surveillance Uptime",
			title: "Surveillez vos services <strong>en toute confiance</strong>",
			description:
				"Recevez des alertes instantanées lorsque vos sites web et API tombent en panne. Surveillez vos sites web et API facilement.",

			cta: {
				in: "Ouvrir le tableau de bord",
				out: "Commencer la surveillance",
				pricing: "Voir les tarifs",
				try: "Surveiller un site {{days}} jours, gratuit",
			},

			try: {
				label: "Vérifier une URL",
				placeholder: "https://exemple.com",
				submit: "Lancer un test",
			},
			screenshot: {
				alt: "Capture d'écran du tableau de bord Uptime : une barre latérale listant les moniteurs HTTP, DNS et TCP, les tâches cron, les alertes, la maintenance et les pages de statut ; des cartes de synthèse pour la consommation mensuelle de pings, le pourcentage de disponibilité global et le point de terminaison le plus lent ; le nombre de moniteurs actifs et hors service par type ; et un tableau des moniteurs HTTP avec des courbes de tendance de latence et des badges de statut",
			},

			trustIndicators: {
				freeToStart: "Gratuit pour commencer",
				payForAutomation: "Payez pour l'automatisation",
				cancelAnytime: "Annulez à tout moment",
			},
		},

		trustIndicators: {
			monitorTypes: "Types de moniteur",
			globalRegions: "Régions mondiales",
			daysDataRetention: "Jours de rétention des données",
			minCheckInterval: "Intervalle minimum",
		},

		/**
		 * Les trois choses qui restent vraies quelle que soit l'ampleur de ce que vous surveillez.
		 * Le prix et le quota sont interpolés depuis `~/app/lib/pricing.ts` plutôt qu'écrits ici —
		 * une valeur littérale serait obsolète dès que les tarifs changent, et
		 * `app/lib/public-claims.ts` fait échouer le build si on en écrit une.
		 */
		benefits: {
			badge: "Pourquoi Uptime",
			title: "Un seul forfait, toutes les vérifications, sans compter",
			description:
				"Trois choses qui restent vraies quelle que soit l'ampleur de ce que vous surveillez.",

			list: {
				everythingIncluded: {
					title: "Tout est inclus",
					description:
						"Vérifications HTTP, DNS, TCP et SSL, signaux de tâches cron, alertes et pages de statut. Un seul forfait, rien vendu en supplément.",
				},
				noMonitorMath: {
					title: "Pas de calcul de moniteurs",
					description:
						"Moniteurs illimités et membres d'équipe illimités. Ajoutez tout ce que vous voulez surveiller, et toutes les personnes qui doivent le voir.",
				},
				payForUsage: {
					title: "Payez votre usage réel",
					description:
						"{{price}} par mois comprend {{included}} vérifications. Au-delà, vous payez les vérifications que vous effectuez réellement, et rien d'autre.",
				},
			},
		},

		features: {
			title: "Une surveillance puissante simplifiée",
			description:
				"Tout ce dont vous avez besoin pour maintenir vos services en fonctionnement, sans complexité inutile.",
			badge: "Fonctionnalités",
			learnMore: "En savoir plus",

			list: {
				first: {
					title: "Surveillez votre disponibilité",
					description:
						"Suivez vos services 24h/24 et 7j/7, depuis neuf régions et à des intervalles dès une minute. Obtenez des métriques détaillées et des aperçus de performance en un coup d'œil.",
				},
				second: {
					title: "Recevez des alertes partout",
					description:
						"Recevez des notifications instantanées par e-mail, Slack, Discord ou webhooks lorsque vos services subissent des pannes ou des problèmes de performance.",
				},
				third: {
					title: "Payez ce que vous utilisez",
					description:
						"Tarification transparente sans frais cachés. Augmentez ou diminuez selon vos besoins, avec des forfaits qui évoluent avec vos besoins de surveillance.",
				},
				fourth: {
					title: "Pages de statut",
					description:
						"Créez de belles pages de statut publiques pour tenir vos utilisateurs informés de la disponibilité des services et des incidents.",
				},
				fifth: {
					title: "Surveillance SSL",
					description:
						"Suivez les dates d'expiration des certificats et recevez des alertes avant que vos certificats SSL n'expirent pour éviter les avertissements de sécurité.",
				},
				sixth: {
					title: "Surveillance DNS",
					description:
						"Détectez les modifications d'enregistrements DNS et les problèmes de propagation avant qu'ils n'impactent vos utilisateurs ou ne soient détournés.",
				},
				seventh: {
					title: "Intégrations natives",
					description:
						"Intégrations directes Slack et Discord avec des notifications enrichies, pas seulement des webhooks basiques.",
				},
			},
		},

		completeFeatureSet: {
			badge: "Ensemble complet de fonctionnalités",
			title: "Tout ce dont vous avez besoin pour une surveillance fiable",
			description: "Des capacités avancées qui rendent la surveillance simple et complète.",

			list: {
				maintenanceWindows: {
					title: "Fenêtres de maintenance",
					description:
						"Planifiez des temps d'arrêt et supprimez les alertes pendant les maintenances planifiées",
				},
				contentMonitoring: {
					title: "Surveillance du contenu",
					description:
						"Vérifiez que des mots-clés ou du contenu spécifique apparaissent sur vos pages",
				},
				recoveryAlerts: {
					title: "Alertes de récupération",
					description: "Soyez notifié lorsque les services reviennent en ligne après un incident",
				},
				apiAccess: {
					title: "Accès API",
					description: "API REST complète avec gestion des clés pour l'automatisation",
				},
				alertCooldowns: {
					title: "Délais entre alertes",
					description: "Évitez la fatigue des alertes avec des périodes de délai configurables",
				},
				customHeaders: {
					title: "En-têtes personnalisés",
					description:
						"Ajoutez des en-têtes d'authentification et des paramètres de requête personnalisés",
				},
				cronMonitoring: {
					title: "Surveillance des tâches Cron",
					description:
						"Surveillez les tâches planifiées et les tâches en arrière-plan avec des vérifications de heartbeat",
				},
			},
		},

		useCases: {
			badge: "Cas d'utilisation",
			title: "Conçu pour tous les besoins de surveillance",
			description:
				"Des simples vérifications de santé aux systèmes distribués complexes, nous avons ce qu'il vous faut.",
			learnMore: "En savoir plus",
			tailoredFor: "Solutions adaptées pour :",

			list: {
				websiteMonitoring: {
					title: "Surveillance de sites web",
					description:
						"Suivez la disponibilité et les performances des pages d'accueil, blogs et applications web.",
				},
				apiMonitoring: {
					title: "Surveillance d'API",
					description:
						"Surveillez les API REST, les points de terminaison GraphQL et les webhooks pour leur disponibilité.",
				},
				saas: {
					title: "Applications SaaS",
					description:
						"Gardez votre produit SaaS fiable avec une surveillance proactive et des alertes instantanées.",
				},
				microservices: {
					title: "Microservices",
					description:
						"Surveillez les systèmes distribués et détectez les pannes avant qu'elles ne se propagent.",
				},
				healthChecks: {
					title: "Vérifications de santé",
					description:
						"Vérifiez la santé des services et les connexions aux bases de données avec des pings planifiés.",
				},
				ecommerce: {
					title: "E-commerce",
					description:
						"Surveillez les flux de paiement, les API de paiement et les pages produits pour protéger vos revenus.",
				},
			},

			audiences: {
				indieHackers: "Indie Hackers",
				soloDevelopers: "Développeurs solo",
				startups: "Startups",
				agencies: "Agences",
				enterprises: "Entreprises",
				devops: "DevOps",
			},
		},

		pricing: {
			badge: "Tarifs",
			title: "Tarification simple et transparente",
			description:
				"Un seul abonnement, pas de niveaux. Payez uniquement ce que vous utilisez avec notre modèle de tarification simple",

			howItWorks: {
				title: "Comment fonctionne la tarification",

				list: {
					first: {
						title: "Abonnement de base",
						description: "{{price}}/mois inclut vos {{included}} premiers pings",
					},

					second: {
						title: "Pings supplémentaires",
						description:
							"{{blockPrice}} par tranche entamée de {{blockSize}} pings supplémentaires",
					},

					third: {
						title: "Pas de frais cachés",
						description:
							"Pas de frais supplémentaires pour les fonctionnalités ou intégrations. Payez pour les pings que vous utilisez.",
					},
				},
			},

			calculator: {
				title: "Calculateur de tarifs",
				description: "Calculez votre coût mensuel en fonction de vos besoins de surveillance",

				add: "Ajouter un moniteur",

				monitor: {
					label: "Fréquence du moniteur",
					delete: "Supprimer",
					frequency: {
						lower: "1m",
						upper: "60m",
					},
				},

				stats: {
					pingsPerMonth: "Pings par mois :",
					baseSubscription: "Abonnement de base",
					includes: "Inclut les {{amount}} premiers pings",
					additionalPings: "Pings supplémentaires :",
					additionalPingsCost:
						"{{blocks}} × {{blockPrice}} par {{blockSize}} pings ({{pings}} au-delà)",
					totalCost: "Coût mensuel total :",
				},
			},
		},

		faq: {
			badge: "FAQ",
			title: "Questions fréquemment posées",
			description: "Trouvez des réponses aux questions courantes sur Uptime",

			list: {
				first: {
					q: "Comment Uptime surveille-t-il mes services ?",
					a: "Uptime envoie des requêtes HTTP ou HTTPS régulières à vos points de terminaison. Nous vérifions les codes de réponse et les temps de réponse pour déterminer si votre service est disponible et réactif.",
				},

				second: {
					q: "Que se passe-t-il lorsqu'une panne est détectée ?",
					a: "Lorsqu'Uptime détecte une panne, il envoie immédiatement une alerte via vos canaux configurés.",
				},

				third: {
					q: "Puis-je surveiller des services internes ?",
					a: "Oui, tant que vos services internes sont accessibles depuis Internet. Vous pouvez également configurer des en-têtes personnalisés pour authentifier les requêtes.",
				},

				fourth: {
					q: "Comment puis-je commencer ?",
					a: "Inscrivez-vous simplement, créez votre premier moniteur et configurez vos préférences d'alerte. Vous serez opérationnel en moins d'une minute.",
				},

				fifth: {
					q: "Y a-t-il un niveau gratuit ?",
					a: "Oui ! Vous pouvez créer un nombre illimité de moniteurs et déclencher des pings manuellement gratuitement, pour toujours. La surveillance automatique programmée nécessite un abonnement.",
				},

				sixth: {
					q: "Combien de temps les données de ping sont-elles conservées ?",
					a: "Nous conservons vos résultats de ping pendant 365 jours. Après cela, ils sont automatiquement supprimés.",
				},

				seventh: {
					q: "Puis-je surveiller des services qui nécessitent une authentification ?",
					a: "Oui. Vous pouvez définir des en-têtes personnalisés avec des jetons ou des identifiants pour authentifier vos requêtes.",
				},

				eighth: {
					q: "Puis-je surveiller plusieurs URL ?",
					a: "Oui. Créez simplement un moniteur séparé pour chaque URL. Chaque moniteur peut avoir sa propre fréquence de vérification, méthode HTTP, code de statut attendu, et plus encore.",
				},

				ninth: {
					q: "Puis-je surveiller des API ?",
					a: "Absolument. Uptime est conçu pour surveiller à la fois les sites web et les API. Vous pouvez définir le point de terminaison, la méthode, les en-têtes et les réponses attendues pour surveiller votre API efficacement.",
				},

				tenth: {
					q: "Puis-je définir un délai d'expiration pour chaque ping ?",
					a: "Oui. Vous pouvez configurer un délai d'expiration pour chaque moniteur. Si la réponse prend plus de temps que prévu, elle est considérée comme un échec. Cela aide à détecter les services lents.",
				},

				eleventh: {
					q: "Puis-je mettre en pause ou désactiver un moniteur temporairement ?",
					a: "Oui. Vous pouvez mettre en pause n'importe quel moniteur à tout moment, individuellement.",
				},

				twelfth: {
					q: "Puis-je tester un moniteur immédiatement après l'avoir créé ?",
					a: "Oui. Un ping est automatiquement déclenché juste après la création d'un moniteur.",
				},

				thirteenth: {
					q: "Prenez-vous en charge les pages de statut ?",
					a: "Oui ! Créez des pages de statut publiques personnalisables pour partager l'état de vos services avec les utilisateurs. Incluez les moniteurs que vous souhaitez et ajoutez votre image de marque.",
				},

				fourteenth: {
					q: "Puis-je voir les tendances de performance historiques ?",
					a: "Nous stockons tous les résultats passés pour que vous ayez un historique complet. Les graphiques de tendances de performance sont prévus pour une future version.",
				},

				fifteenth: {
					q: "Quels canaux d'alerte sont pris en charge ?",
					a: "E-mail, Slack, Discord et webhooks. Les intégrations natives facilitent la réception des alertes là où votre équipe travaille déjà. Les webhooks vous permettent de vous connecter à tout autre service.",
				},

				sixteenth: {
					q: "Prenez-vous en charge les équipes ou les moniteurs partagés ?",
					a: "Oui ! Chaque utilisateur commence avec une équipe. Invitez des membres d'équipe avec différents rôles (Propriétaire, Administrateur, Membre). L'approvisionnement automatique par domaine ajoute automatiquement les utilisateurs avec des domaines d'e-mail d'entreprise vérifiés.",
				},

				seventeenth: {
					q: "Que se passe-t-il si je dépasse les limites de mon forfait ?",
					a: "L'utilisation au-delà des {{included}} pings inclus dans votre abonnement est facturée par tranches entières de {{blockSize}} à {{blockPrice}} chacune : un seul ping supplémentaire entame une nouvelle tranche.",
				},

				eighteenth: {
					q: "Stockez-vous les corps de requête ou de réponse ?",
					a: "Non. Nous ne stockons jamais les données de corps. Pour plus de confidentialité et d'efficacité, nous recommandons d'utiliser la méthode `HEAD`.",
				},

				nineteenth: {
					q: "Depuis quelles régions puis-je surveiller mes services ?",
					a: "Uptime prend en charge la surveillance depuis plusieurs régions : Afrique, Asie-Pacifique, Europe de l'Est et de l'Ouest, Amérique du Nord de l'Est et de l'Ouest, Moyen-Orient, Océanie et Amérique du Sud.\n\nVous pouvez choisir une région par moniteur. La région est traitée comme une indication, le ping réel proviendra d'un serveur dans ou près de cette région.",
				},
			},
		},

		footer: {
			name: "Uptime",
			description: "Surveillance simple et fiable pour vos sites web et API.",
			copyright: "© {{year}} Uptime par Sergio Xalambrí. Tous droits réservés.",
			sections: {
				product: {
					title: "Produit",
					features: "Fonctionnalités",
					pricing: "Tarifs",
					faq: "FAQ",
				},
				features: {
					title: "Fonctionnalités",
					monitors: "Moniteurs",
					alerts: "Alertes",
					statusPages: "Pages de statut",
					ssl: "Surveillance SSL",
					dns: "Surveillance DNS",
					cronJobs: "Surveillance Cron Jobs",
					contentMonitoring: "Surveillance de contenu",
					maintenance: "Fenêtres de maintenance",
					integrations: "Intégrations",
					teams: "Équipes",
					analytics: "Analytique",
					api: "Accès API",
				},
				useCases: {
					title: "Cas d'utilisation",
					websiteMonitoring: "Surveillance de sites web",
					apiMonitoring: "Surveillance d'API",
					saas: "Applications SaaS",
					ecommerce: "E-commerce",
					cronJobs: "Surveillance Cron Jobs",
				},
				solutions: {
					title: "Solutions",
					indieHackers: "Pour les Indie Hackers",
					soloDevs: "Pour les développeurs solo",
					startups: "Pour les startups",
					agencies: "Pour les agences",
					enterprises: "Pour les entreprises",
					devops: "Pour DevOps",
				},
				compare: {
					title: "Comparer",
					uptimerobot: "vs UptimeRobot",
					pingdom: "vs Pingdom",
					betterUptime: "vs Better Uptime",
					healthchecks: "vs Healthchecks.io",
					cronitor: "vs Cronitor",
				},
				legal: {
					title: "Juridique",
					terms: "Conditions d'utilisation",
					privacy: "Politique de confidentialité",
				},
			},
		},

		comparison: {
			tableLabel: "Uptime vs {{competitor}}",
			tableCategoryHeader: "Catégorie",
			tableProductHeader: "Uptime",
			whyTeamsSwitchTitle: "Pourquoi les équipes passent à Uptime",
			gettingStartedTitle: "Premiers pas",
			finalCtaTitle: "Passez à Uptime",

			honestTake: {
				badge: "Avis honnête",
				title: "Quand {{competitor}} peut être préférable",
				description:
					"Nous croyons à la transparence. Voici les cas où {{competitor}} pourrait être le bon choix.",
			},

			pricing: {
				badge: "Tarifs",
				title: "Comparaison réelle des coûts",
				description:
					"Découvrez combien vous pourriez économiser sur une configuration de surveillance typique.",
				tableLabel: "Comparaison des coûts : Uptime vs {{competitor}}",
				scenarioHeader: "Cas d'usage",
				savingsHeader: "Économies",
				savingsPerYear: "~{{amount}}/an",
				footnote:
					"Estimations basées sur des usages typiques. Les tarifs de {{competitor}} peuvent évoluer et votre coût réel dépend de votre configuration.",
			},
		},

		finalCta: {
			body: "Créez votre premier moniteur en moins de 2 minutes. Aucune carte bancaire requise pour commencer.",
		},

		marketingPage: {
			everythingBadge: "En détail",
			everythingTitle: "Tout ce dont vous avez besoin",
			everythingDescription:
				"Un regard détaillé sur ce que vous obtenez, de la première vérification à l'alerte qui vous parvient.",
			howItWorksBadge: "Pour commencer",
			howItWorksTitle: "Comment ça marche",
			howItWorksDescription:
				"Trois étapes pour passer d'un tableau de bord vide à des vérifications qui s'exécutent seules.",
			faqBadge: "FAQ",
			faqTitle: "Questions fréquemment posées",
			faqDescription: "Les questions les plus courantes avant de commencer la surveillance.",
			finalCtaTitle: "Commencez à surveiller vos services",
		},
	},

	/**
	 * `/trust` — comment fonctionne la surveillance et qui l'opère.
	 */
	trust: {
		meta: {
			title: "Confiance | Uptime",
			description:
				"Comment Uptime fonctionne : qui l'opère, depuis où les vérifications partent, comment un incident est confirmé, et exactement ce qui est conservé ou non.",
		},
		footerLink: "Confiance",
		heading: "Confiance",
		intro:
			"Un moniteur ne vaut que la confiance que vous lui accordez. Cette page décrit le fonctionnement réel du service — qui l'opère, d'où partent vos vérifications, comment une panne devient une notification, et ce que nous conservons — avec assez de détails pour que vous décidiez si vous voulez vous y fier. Tout ce qui suit décrit le système tel qu'il est construit aujourd'hui, pas tel qu'il est prévu.",
		regions: {
			afr: "Afrique",
			apac: "Asie-Pacifique",
			eeur: "Europe de l'Est",
			enam: "Est de l'Amérique du Nord",
			me: "Moyen-Orient",
			oc: "Océanie",
			sam: "Amérique du Sud",
			weur: "Europe de l'Ouest",
			wnam: "Ouest de l'Amérique du Nord",
		},
		sections: {
			whoRuns: {
				title: "Qui l'opère",
				bodyPrefix: "Uptime est développé et opéré par ",
				founderName: "Sergio Xalambrí",
				bodySuffix:
					", en solo. Il n'y a ni rotation de support ni équipe d'astreinte derrière ce nom : une seule personne écrit le code, le déploie et répond aux e-mails.",
				second:
					"C'est bon à savoir dans les deux sens. Une question sur le comportement d'une vérification arrive directement à la personne qui l'a écrite. Un problème qui survient pendant que cette personne dort attend son réveil.",
			},

			/**
			 * Code-available, not open source: the repository carries its own license with
			 * conditions, so the claim is only that a reader can check the code.
			 */
			source: {
				title: "Vous pouvez lire le code",
				bodyPrefix:
					"Le code qui fait tourner ce service est public : les affirmations de cette page peuvent donc être vérifiées plutôt que crues sur parole — comment une vérification est classée, ce que contient un résultat stocké, quand une notification part : ",
				linkText: "apps/uptime sur GitHub",
				bodySuffix: ".",
				caveat:
					"Cela vous montre le code, pas le déploiement en cours d'exécution. C'est une chose de plus que vous pouvez vérifier vous-même, pas une garantie à elle seule.",
			},
			ownStatus: {
				title: "Notre propre page de statut",
				bodyPrefix:
					"Le service publie une page de statut à son propre sujet, construite avec la même surveillance de tâches cron que le produit propose : ",
				linkText: "uptime.sergiodxa.com/status/uptime",
				bodySuffix: ".",
				scope:
					"Ce que cette page couvre est plus restreint que son nom ne le laisse penser, voici donc l'affirmation exacte. Chacune des tâches internes planifiées du service — les passages de vérification des moniteurs, l'agrégation nocturne des statistiques quotidiennes, les nettoyages de rétention — signale sa fin d'exécution, la page montre donc si ce travail planifié tourne à l'heure. Ce n'est pas une sonde indépendante de l'ensemble du service, et elle tourne sur la même plateforme que l'application elle-même : un incident assez large pour arrêter l'application peut aussi arrêter les rapports de la page.",
			},
			whereChecksRun: {
				title: "D'où partent les vérifications",
				intro:
					"Chaque moniteur est vérifié depuis une région que vous choisissez. Neuf sont disponibles :",
				hint: "Une région est une indication, pas une promesse. La vérification s'exécute sur une infrastructure placée près de la région que vous avez choisie, et la plateforme peut la placer ailleurs quand elle y est contrainte. Les deux régions européennes font exception : elles sont ancrées dans l'UE, ce qui est une contrainte stricte et non une préférence.",
				timing:
					"Le temps de réponse enregistré pour une vérification ne mesure que la requête vers votre point de terminaison, pas notre propre travail autour, afin que le chiffre reste comparable à ce que quelqu'un dans cette région vivrait.",
			},
			incidents: {
				title: "Comment un incident est confirmé",
				classification:
					"Chaque vérification se termine par l'un de trois résultats. Hors ligne signifie que le point de terminaison n'a pas pu être joint du tout, a répondu avec un statut différent de celui que vous attendez, ou a échoué à une vérification de contenu que vous avez configurée. Dégradé signifie qu'il a répondu correctement mais plus lentement que le seuil que vous avez défini. En ligne signifie que tout correspondait.",
				noConfirmation:
					"Il n'y a pas de seconde vérification de confirmation avant la première notification : une seule vérification en échec suffit à marquer un moniteur hors ligne et à envoyer l'alerte. C'est un compromis assumé — un passage de confirmation retarderait chaque vraie alerte d'un intervalle complet — mais cela signifie aussi qu'un unique incident réseau malchanceux peut atteindre votre boîte de réception.",
				falsePositivesIntro: "Ce qui limite le bruit à la place :",
				infraFault: {
					label: "Nos pannes ne sont pas les vôtres.",
					body: "Quand notre propre infrastructure de sonde échoue, la vérification est réessayée plutôt qu'enregistrée. Une panne de notre côté ne devient jamais un résultat hors ligne dans votre historique ni une alerte dans votre boîte de réception.",
				},
				yourThresholds: {
					label: "Votre délai d'attente, vos seuils.",
					body: "Le délai d'attente, le statut attendu et le seuil de dégradation sont tous à vous de définir : une vérification n'est lente ou en échec que selon la définition que vous avez donnée.",
				},
				cooldown: {
					label: "Les répétitions sont espacées, et un rétablissement arrive toujours.",
					body: "La première alerte d'un incident part immédiatement. Tant qu'un moniteur reste en panne, les répétitions sont espacées par le délai d'attente de cette alerte — une heure par défaut — de sorte qu'une panne durable continue de vous relancer au lieu de se taire. Au rétablissement, vous recevez un message de plus.",
				},
				recovery: {
					label: "Des avis de rétablissement seulement après une vraie panne.",
					body: "Un message de rétablissement n'est envoyé que si le moniteur était auparavant en échec. La toute première vérification d'un moniteur ne s'annonce jamais comme un rétablissement.",
				},
				maintenance: {
					label: "Les fenêtres de maintenance suppriment les alertes.",
					body: "Tant qu'une fenêtre de maintenance couvre un moniteur, ses notifications sont entièrement ignorées, pour qu'un travail planifié ne réveille personne.",
				},
				accounting: {
					label: "Les notifications retenues sont comptabilisées.",
					body: "Quand un incident se termine, le message de rétablissement indique combien de notifications sont parties et combien ont été retenues, pour qu'un incident silencieux se distingue d'alertes perdues.",
				},
			},
			storage: {
				title: "Ce qui est conservé, et ce qui ne l'est pas",
				noBodies:
					"Les corps de réponse ne sont jamais conservés. Ni tronqués, ni hachés, ni échantillonnés — il n'existe aucune colonne pour cela nulle part dans la base de données.",
				contentChecks:
					"Un corps de réponse n'est téléchargé que si vous configurez une vérification de contenu pour ce moniteur. Le cas échéant, il est comparé à vos règles en mémoire pendant la vérification, puis jeté avec le reste de la requête. Un moniteur sans vérification de contenu ne lit jamais de corps de réponse.",
				storedIntro: "Ce qui est conservé, et pour combien de temps :",
				httpResults: {
					label: "Enregistrements des vérifications HTTP individuelles :",
					body: "le code de statut renvoyé, la durée de la requête et l'heure de fin. Conservés une semaine, ce qui couvre tout ce que lisent les vues récentes et le décompte de consommation.",
				},
				dailyStats: {
					label: "Statistiques quotidiennes :",
					body: "chaque nuit, les vérifications de la veille sont agrégées en une ligne par moniteur. Cette agrégation est l'historique de long terme derrière chaque graphique de disponibilité de l'application, et elle est conservée 365 jours.",
				},
				otherResults: {
					label: "Enregistrements des vérifications DNS et TCP :",
					body: "conservés 90 jours, parce que c'est l'historique que la page de détail d'un moniteur et un post-mortem lisent directement.",
				},
				alertHistory: {
					label: "Historique des alertes :",
					body: "chaque notification que nous avons envoyée, échoué à envoyer ou délibérément retenue, conservée 90 jours, pour que vous puissiez vérifier ce qui vous a été dit ou non.",
				},
				cronPings: {
					label: "Signalements des tâches cron :",
					body: "conservés 365 jours. L'adresse et l'agent utilisateur de la requête enregistrés à côté sont effacés après 30 jours ; le signalement lui-même reste.",
				},
			},
			customerData: {
				title: "Les données de votre compte",
				bodyPrefix:
					"Les informations de compte, la gestion des paiements, les cookies et vos droits sur l'ensemble sont couverts par la ",
				privacyLinkText: "politique de confidentialité",
				bodySuffix:
					", qui est le document de référence plutôt qu'un résumé écrit deux fois. La version courte : vos données ne sont pas vendues, et vos données de surveillance appartiennent à votre équipe.",
			},
			ourIncidents: {
				title: "Quand Uptime lui-même a un incident",
				retries:
					"Les vérifications sont mises en file plutôt qu'exécutées à la volée, et une vérification qui n'a pas pu aboutir à cause d'une panne de notre côté est réessayée au lieu d'être enregistrée. Aucun de nos propres incidents n'est inscrit dans l'historique de votre moniteur comme une panne de votre service.",
				gaps: "Si l'incident dure, les vérifications sont retardées ou ignorées. Une vérification ignorée n'écrit rien : la période apparaît dans votre historique comme un trou sans données plutôt que comme une indisponibilité que vous n'avez jamais eue, et vos chiffres sont calculés à partir des vérifications réellement effectuées.",
				missedAlerts:
					"Le mode de défaillance à bien comprendre est celui qui suit : si votre point de terminaison tombe pendant notre panne, votre alerte peut arriver en retard, ou pas du tout. Un service de surveillance ne peut pas vous alerter pendant qu'il est en panne, et celui-ci ne fait pas exception.",
				noSlaPrefix:
					"Nous ne proposons aucun accord de niveau de service, et nous ne publions aucun chiffre de disponibilité auquel nous engager. Les ",
				termsLinkText: "conditions d'utilisation",
				noSlaSuffix:
					" le disent, et cette page ne prétendra pas discrètement le contraire. Ce qu'il y a à la place : la page de statut ci-dessus, et une personne qui répond aux e-mails.",
			},
		},
	},

	legal: {
		terms: {
			meta: {
				title: "Conditions d'utilisation | Uptime",
				description:
					"Conditions d'utilisation d'Uptime, le service de surveillance de disponibilité de Sergio Xalambrí.",
			},

			lastUpdated: "Dernière mise à jour : 11 février 2026",
			title: "Conditions d'utilisation",

			sections: {
				introduction: {
					title: "1. Introduction",
					body: "Bienvenue sur Uptime. Ces conditions d'utilisation régissent votre utilisation de notre service de surveillance de disponibilité exploité par Sergio Xalambrí. En accédant à Uptime ou en l'utilisant, vous acceptez d'être lié par ces conditions.",
				},
				serviceDescription: {
					title: "2. Description du service",
					body: "Uptime fournit des services de surveillance de disponibilité et de tâches planifiées, notamment la surveillance de points de terminaison HTTP, la surveillance DNS, la surveillance de ports TCP, la surveillance de certificats SSL et la surveillance de tâches cron. Ces services vous aident à suivre l'état de vos services et de vos tâches planifiées. Nous surveillons vos points de terminaison depuis plusieurs régions du monde et vous prévenons dès qu'un problème est détecté.",
				},
				accountTerms: {
					title: "3. Conditions relatives au compte",
					first:
						"Vous devez fournir des informations exactes et complètes lors de la création d'un compte.",
					second:
						"Vous êtes responsable de la sécurité de vos identifiants et de toutes les activités effectuées depuis votre compte.",
					third:
						"Vous devez avoir au moins 18 ans ou disposer de l'autorité juridique nécessaire pour conclure cet accord au nom d'une organisation.",
					fourth:
						"Vous devez nous prévenir immédiatement de toute utilisation non autorisée de votre compte.",
				},
				acceptableUse: {
					title: "4. Utilisation acceptable",
					intro: "En utilisant Uptime, vous vous engagez à ne pas :",
					first:
						"Abuser de notre service, le surcharger, le perturber ou tenter de contourner les limites d'utilisation.",
					second:
						"Surveiller des URL ou des points de terminaison qui ne vous appartiennent pas ou que vous n'êtes pas autorisé à surveiller.",
					third:
						"Surveiller des tâches cron ou des tâches planifiées qui ne vous appartiennent pas ou que vous n'êtes pas autorisé à surveiller.",
					fourth:
						"Utiliser les points de terminaison de ping des tâches cron à d'autres fins que la surveillance légitime de tâches planifiées.",
					fifth: "Utiliser le service à des fins illégales ou non autorisées.",
					sixth:
						"Tenter d'accéder sans autorisation à nos systèmes ou aux comptes d'autres utilisateurs.",
					seventh: "Revendre ou redistribuer le service sans notre consentement écrit.",
				},
				paymentTerms: {
					title: "5. Conditions de paiement",
					first:
						"Uptime fonctionne selon un modèle de facturation à l'usage. Vous payez en fonction du nombre de moniteurs et de la fréquence de vérification que vous configurez.",
					second: "Les abonnements sont gérés et traités par Polar.",
					third:
						"Les remboursements sont effectués au prorata de la partie non utilisée de votre abonnement si vous résiliez.",
					fourth:
						"Nous nous réservons le droit de modifier les tarifs moyennant un préavis de 30 jours. Continuer à utiliser le service après un changement de tarif vaut acceptation.",
				},
				dataAndPrivacy: {
					title: "6. Données et confidentialité",
					firstPrefix: "Votre utilisation d'Uptime est également régie par notre ",
					firstLinkText: "politique de confidentialité",
					firstSuffix: ", qui décrit comment nous collectons, utilisons et protégeons vos données.",
					second:
						"Les données de surveillance sont conservées pendant 365 jours. Passé ce délai, les données historiques sont automatiquement supprimées.",
					third:
						"Vous pouvez demander la suppression de vos données à tout moment en nous contactant. À la fermeture de votre compte, vos données seront supprimées sous 30 jours.",
				},
				serviceAvailability: {
					title: "7. Disponibilité du service",
					first:
						"Nous visons une disponibilité de service de 99,9%, mais il s'agit d'un objectif, pas d'une garantie. Nous ne proposons pas d'accords de niveau de service (SLA) assortis de compensations financières.",
					second:
						"Nous pouvons effectuer des maintenances planifiées avec un préavis raisonnable lorsque cela est possible. Une maintenance d'urgence peut avoir lieu sans préavis.",
					third:
						"Nous ne sommes pas responsables des interruptions, des pertes de données ou des dommages résultant d'une interruption du service, qu'elle soit planifiée ou non.",
				},
				limitationOfLiability: {
					title: "8. Limitation de responsabilité",
					first:
						"Uptime est fourni « tel quel » et « selon disponibilité », sans garantie d'aucune sorte, expresse ou implicite.",
					second:
						"Nous ne garantissons pas que notre service détectera toutes les pannes affectant les points de terminaison que vous surveillez. La surveillance dépend des conditions du réseau et d'autres facteurs indépendants de notre volonté.",
					third:
						"Notre responsabilité totale envers vous pour toute réclamation liée à votre utilisation du service est limitée au montant que vous nous avez versé au cours des 12 mois précédant la réclamation.",
					fourth:
						"Nous ne sommes pas responsables des dommages indirects, accessoires, spéciaux, consécutifs ou punitifs.",
				},
				termination: {
					title: "9. Résiliation",
					first:
						"Vous pouvez fermer votre compte à tout moment depuis les paramètres de votre compte ou en nous contactant.",
					second:
						"Nous pouvons suspendre ou fermer votre compte si vous enfreignez ces conditions, ou pour toute autre raison, moyennant un préavis raisonnable.",
					third:
						"À la résiliation, votre accès au service prend fin et vos données sont supprimées sous 30 jours.",
				},
				changesToTerms: {
					title: "10. Modifications des conditions",
					body: "Nous pouvons mettre à jour ces conditions d'utilisation de temps à autre. Nous vous informerons des changements importants par e-mail ou via le service. Continuer à utiliser Uptime après l'entrée en vigueur des changements vaut acceptation des conditions révisées.",
				},
				contact: {
					title: "11. Contact",
					prefix:
						"Si vous avez des questions à propos de ces conditions d'utilisation, contactez-nous à l'adresse ",
					email: "hello@sergiodxa.com",
				},
			},
		},
		privacy: {
			meta: {
				title: "Politique de confidentialité | Uptime",
				description:
					"Politique de confidentialité d'Uptime. Découvrez comment nous collectons, utilisons et protégeons vos données lorsque vous utilisez notre service de surveillance de disponibilité.",
			},

			lastUpdated: "Dernière mise à jour : 2 août 2026",
			title: "Politique de confidentialité",

			sections: {
				introduction: {
					title: "1. Introduction",
					first:
						"Cette politique de confidentialité décrit comment Uptime, exploité par Sergio Xalambrí (« nous », « notre »), collecte, utilise et protège vos informations personnelles lorsque vous utilisez notre service de surveillance de disponibilité.",
					second:
						"Cette politique s'applique à tous les utilisateurs de notre service et couvre les données collectées via notre site web et notre plateforme de surveillance.",
				},
				dataCollected: {
					title: "2. Données que nous collectons",
					accountData: {
						title: "Données de compte",
						body: "Lorsque vous vous inscrivez avec l'authentification GitHub, nous collectons votre adresse e-mail et votre nom d'affichage depuis votre profil GitHub.",
					},
					monitoringData: {
						title: "Données de surveillance",
						body: "Nous collectons les données liées aux moniteurs que vous créez, notamment les URL que vous choisissez de surveiller, les temps de réponse, les codes de statut HTTP et les événements de disponibilité et de panne.",
					},
					cronJobData: {
						title: "Données de surveillance des tâches cron",
						intro: "Pour la surveillance des tâches cron (tâches planifiées), nous collectons :",
						first:
							"Les horodatages des pings (le moment où vos tâches planifiées signalent leur exécution)",
						second: "Les adresses IP source des requêtes de ping",
						third: "Les chaînes user agent des requêtes de ping",
						fourth:
							"La configuration de la planification (expressions cron, fuseaux horaires, délais de grâce)",
						outro:
							"Ces données vous aident à savoir si vos tâches planifiées s'exécutent à l'heure et nous permettent de vous alerter lorsqu'un ping attendu n'arrive pas.",
					},
					usageData: {
						title: "Données d'utilisation",
						body: "Nous collectons des données analytiques et des journaux sur la façon dont vous interagissez avec notre service, notamment les pages vues, l'utilisation des fonctionnalités et les journaux d'erreurs.",
					},
					paymentData: {
						title: "Données de paiement",
						body: "Le traitement des paiements est assuré par Polar. Nous ne stockons pas les informations de votre carte bancaire. Nous recevons uniquement de Polar la confirmation du statut de votre abonnement et votre historique de facturation.",
					},
				},
				dataUsage: {
					title: "3. Comment nous utilisons vos données",
					first: {
						label: "Pour fournir le service de surveillance :",
						body: "Nous utilisons vos données pour surveiller les URL que vous indiquez et suivre leur disponibilité.",
					},
					second: {
						label: "Pour envoyer des alertes et des notifications :",
						body: "Nous utilisons votre adresse e-mail pour vous envoyer des alertes de panne et des notifications de statut.",
					},
					third: {
						label: "Pour améliorer le service :",
						body: "Nous analysons les habitudes d'utilisation pour enrichir les fonctionnalités et corriger les problèmes.",
					},
					fourth: {
						label: "Pour communiquer avec vous :",
						body: "Nous pouvons vous envoyer des mises à jour du service, des avis de sécurité et des messages d'assistance.",
					},
				},
				dataSharing: {
					title: "4. Partage des données",
					noSell: "Nous ne vendons pas vos données personnelles.",
					intro:
						"Nous partageons des données avec les services tiers suivants, qui nous aident à faire fonctionner Uptime :",
					first: {
						label: "Cloudflare :",
						body: "Infrastructure, hébergement et diffusion de contenu",
					},
					second: { label: "Polar :", body: "Traitement des paiements et gestion des abonnements" },
					third: { label: "GitHub :", body: "Services d'authentification" },
					outro:
						"Nous pouvons également divulguer vos données si la loi l'exige ou pour protéger nos droits et la sécurité de nos utilisateurs.",
				},
				dataRetention: {
					title: "5. Conservation des données",
					first: {
						label: "Données de surveillance :",
						body: "Conservées 365 jours à compter de leur collecte",
					},
					second: {
						label: "Données de compte :",
						body: "Conservées jusqu'à ce que vous supprimiez votre compte",
					},
					third: { label: "Journaux :", body: "Conservés 30 jours" },
				},
				rights: {
					title: "6. Vos droits (RGPD)",
					intro:
						"En vertu du Règlement général sur la protection des données (RGPD), vous avez le droit de :",
					first: {
						label: "Accéder à vos données :",
						body: "Demander une copie des données personnelles que nous détenons à votre sujet",
					},
					second: {
						label: "Corriger vos données :",
						body: "Demander la correction de données personnelles inexactes",
					},
					third: {
						label: "Supprimer vos données :",
						body: "Demander la suppression de vos données personnelles",
					},
					fourth: {
						label: "Exporter vos données :",
						body: "Recevoir vos données dans un format portable",
					},
					fifth: {
						label: "Vous opposer au traitement :",
						body: "Vous opposer à certains types de traitement de données",
					},
					outro:
						"Pour exercer l'un de ces droits, contactez-nous à l'adresse e-mail indiquée ci-dessous.",
				},
				security: {
					title: "7. Sécurité",
					intro:
						"Nous mettons en place des mesures de sécurité appropriées pour protéger vos données :",
					first: {
						label: "Chiffrement en transit :",
						body: "Toutes les données sont transmises via HTTPS/TLS",
					},
					second: { label: "Chiffrement au repos :", body: "Les données stockées sont chiffrées" },
					third: {
						label: "Contrôles d'accès :",
						body: "Des contrôles d'accès stricts limitent qui peut accéder à vos données",
					},
					fourth: {
						label: "Revues de sécurité régulières :",
						body: "Nous revoyons régulièrement nos pratiques de sécurité",
					},
				},
				cookies: {
					title: "8. Cookies",
					intro: "Nous utilisons le minimum de cookies nécessaires au fonctionnement du service :",
					first: {
						label: "Cookies de session :",
						body: "Utilisés pour l'authentification et le maintien de votre session",
					},
					outro:
						"Nous n'utilisons pas de cookies de suivi, de cookies publicitaires tiers, ni de cookies à des fins marketing.",
				},
				turnstile: {
					title: "9. Protection contre les robots",
					first:
						"La page publique où n'importe qui peut vérifier une URL sans compte est protégée par Cloudflare Turnstile. Elle sert à distinguer une personne d'un robot, afin que le vérificateur gratuit ne soit pas épuisé par du trafic automatisé.",
					second:
						"Pour cela, Cloudflare reçoit votre adresse IP et des informations sur votre navigateur, et peut déposer un jeton dans votre navigateur pour mémoriser que la vérification a réussi.",
					third:
						"Turnstile ne s'exécute que sur cette page publique. Il n'est utilisé nulle part dans l'application une fois connecté.",
					referencePrefix: "Pour savoir ce que Cloudflare fait de ces données, consultez son ",
					referenceLinkText: "Avenant de confidentialité Turnstile",
					referenceSuffix: ".",
				},
				childrensPrivacy: {
					title: "10. Protection des mineurs",
					body: "Uptime n'est pas destiné aux personnes de moins de 18 ans. Nous ne collectons pas sciemment d'informations personnelles auprès d'enfants de moins de 18 ans.",
				},
				internationalTransfers: {
					title: "11. Transferts internationaux de données",
					first:
						"Vos données peuvent être traitées via le réseau mondial de Cloudflare. Si vous vous trouvez dans l'Union européenne, vos données peuvent être transférées et traitées aux États-Unis.",
					second:
						"Nous nous appuyons sur les clauses contractuelles types de Cloudflare et sur d'autres garanties appropriées pour que vos données soient protégées conformément aux exigences du RGPD.",
				},
				changesToPolicy: {
					title: "12. Modifications de cette politique",
					first:
						"Nous pouvons mettre à jour cette politique de confidentialité de temps à autre. Nous vous informerons de tout changement substantiel en publiant la nouvelle politique sur cette page et en mettant à jour la date de « dernière mise à jour ».",
					second:
						"Pour les changements importants, nous vous enverrons également une notification par e-mail si vous avez un compte chez nous.",
				},
				contact: {
					title: "13. Nous contacter",
					body: "Si vous avez des questions à propos de cette politique de confidentialité ou si vous souhaitez exercer vos droits sur vos données, contactez-nous à :",
					email: "hello+privacy@sergiodxa.com",
				},
			},
		},
	},

	app: {
		meta: {
			title: "Uptime par Sergio Xalambrí",
			description: "Surveillance de disponibilité simple et fiable pour les développeurs",
		},

		layout: {
			sidebar: {
				teamPicker: { label: "Sélectionner une équipe" },
				userMenu: { label: "Menu utilisateur" },

				navigation: {
					items: {
						dashboard: "Tableau de bord",
						alerts: "Alertes",
						maintenance: "Maintenance",
						monitors: "Moniteurs",
						httpMonitors: "Moniteurs HTTP",
						statusPages: "Pages de statut",
						tcpMonitors: "Moniteurs TCP",
						dnsMonitors: "Moniteurs DNS",
						cronJobs: "Cron Jobs",
						settings: "Paramètres",
						billing: "Facturation",
						domains: "Domaines",
						members: "Membres",
						team: "Équipe",
						docs: "Documentation",
						apiKeys: "Clés API",
					},
				},

				account: {
					title: "Compte",
					overview: "Aperçu",
					teams: "Vos équipes",
				},
			},
			toasts: {
				region: "Notifications",
				dismiss: "Fermer",
			},
		},

		errors: {
			notFound: {
				title: "404 Non trouvé",
				description: "L'équipe que vous recherchez n'existe pas.",
			},
		},
	},

	monitorDetail: {
		header: {
			region: "{{emoji}} {{code}}",
		},
		stats: {
			title: "Statistiques",
			uptime: "Uptime",
			totalChecks: "Total des vérifications",
			lastCheck: "Dernière vérification",
			neverRan: "N/A",
		},

		actions: {
			refresh: "Actualiser",
			delete: {
				confirm: "Êtes-vous sûr de vouloir supprimer ce moniteur ?",
				cta: "Supprimer le moniteur",
			},
		},
	},

	monitorList: {
		header: {
			title: "Moniteurs Uptime",
			cta: "Créer un moniteur",
			subscribe: "Vos moniteurs sont en pause. Abonnez-vous pour continuer la surveillance",
		},
	},

	statusPage: {
		banner: {
			operational: "Tous les systèmes sont opérationnels",
			degraded: "Panne partielle du système",
			down: "Panne majeure du système",
		},
		status: {
			operational: "Opérationnel",
			degraded: "Dégradé",
			down: "Hors ligne",
			unknown: "Inconnu",
		},
		uptimeBar: {
			daysAgo: "Il y a 90 jours",
			today: "Aujourd'hui",
			legend: {
				full: "100%",
				partial: "Partiel",
				down: "Hors ligne",
				noData: "Pas de données",
			},
			tooltip: {
				uptime: "{{percentage}}% de disponibilité",
				noData: "Pas de données",
			},
		},
		cronJobs: {
			title: "Tâches planifiées",
			lastPing: "Dernier ping",
			never: "Jamais",
			schedule: "Planification",
		},
		empty: {
			description: "Aucun service n'est configuré pour cette page de statut.",
		},
		footer: {
			lastUpdated: "Dernière mise à jour {{date}}",
			poweredBy: "Propulsé par Uptime",
		},
		error: {
			title: "Page de statut introuvable",
			description: "La page de statut que vous recherchez n'existe pas ou n'est pas publique.",
			goHome: "Retourner à l'accueil",
		},
	},

	contentMonitoring: {
		title: "Surveillance du contenu",
		description:
			"Vérifiez le contenu des réponses pour des mots-clés ou des modèles spécifiques. Le moniteur échouera si une vérification ne passe pas.",
		empty:
			"Aucune vérification de contenu configurée. Ajoutez une vérification pour surveiller des mots-clés ou des modèles spécifiques dans la réponse.",
		addButton: "Ajouter une vérification de contenu",

		form: {
			title: "Ajouter une vérification",
			description: "Chaque vérification s'applique au corps de la réponse à chaque ping.",
			checkType: {
				label: "Type de vérification",
				description: "Choisissez comment faire correspondre le contenu de la réponse",
				options: {
					contains: "Contient",
					notContains: "Ne contient pas",
					regex: "Modèle Regex",
				},
			},
			value: {
				label: "Valeur",
				placeholder: "Entrez un mot-clé ou un modèle",
				description: "Le texte ou le modèle regex à vérifier",
			},
			caseSensitive: "Correspondance sensible à la casse",
			cancel: "Annuler",
			add: "Ajouter la vérification",
		},

		item: {
			type: "Type",
			status: "Statut",
			caseSensitive: "Sensible à la casse",
			enabled: "Activé",
			disabled: "Désactivé",
			yes: "Oui",
			no: "Non",
			delete: "Supprimer",
			deleteConfirmTitle: "Supprimer cette vérification de contenu ?",
		},

		types: {
			contains: "Contient",
			notContains: "Ne contient pas",
			regex: "Regex",
		},
	},

	auth: {
		error: {
			title: "Erreur d'authentification",
			errorCode: "Code d'erreur : {{code}}",
			description: "Description : {{description}}",
			uri: "URI :",
			tryAgain: "Veuillez réessayer ou contacter le support si le problème persiste.",

			signInFailedTitle: "Échec de la connexion",
			signInFailedGeneric: "La tentative de connexion n'a pas pu aboutir. Veuillez réessayer.",
			missingIdToken: "Le fournisseur d'identité n'a pas renvoyé de jeton d'identification.",
		},
	},

	dashboard: {
		header: {
			title: "Moniteurs Uptime",
			cta: "Créer un moniteur",
			subscribe: "Vos moniteurs sont en pause. Abonnez-vous pour continuer la surveillance",
		},

		monitor: {
			stats: {
				title: "Statistiques",
				uptime: "Uptime",
				totalChecks: "Total des vérifications",
				lastCheck: "Dernière vérification",
				neverRan: "N/A",
			},

			actions: {
				refresh: "Actualiser",
				delete: {
					confirm: "Êtes-vous sûr de vouloir supprimer ce moniteur ?",
					cta: "Supprimer le moniteur",
				},
			},
		},
	},

	createMonitor: {
		title: "Créer un nouveau moniteur",
		fields: {
			name: {
				label: "Nom du moniteur",
				placeholder: "Page d'accueil",
				description: "Un nom descriptif pour votre moniteur.",
			},
			url: {
				label: "URL à surveiller",
				placeholder: "https://example.com/healthcheck",
				description: "L'URL du service que vous souhaitez surveiller.",
			},
			method: {
				label: "Méthode de requête",
				placeholder: "HEAD",
				description: "La méthode HTTP à utiliser pour la requête.",
			},
			status: {
				label: "Code de statut attendu",
				placeholder: "200",
				description: "Le code de statut HTTP que vous attendez de recevoir.",
			},
			interval: {
				label: "Intervalle de vérification",
				placeholder: "60",
				description: "Intervalle en secondes. Le minimum est de 60 secondes.",
			},
			visibility: {
				label: "Visibilité",
				description: "Les moniteurs publics peuvent être partagés avec n'importe qui.",
				options: { public: "Public", private: "Privé" },
			},
			region: {
				label: "Région",
				description: "La région depuis laquelle le ping sera exécuté.",
				placeholder: "wnam",
				options: {
					afr: "{{emoji}} Afrique",
					apac: "{{emoji}} Asie-Pacifique",
					eeur: "{{emoji}} Europe de l'Est",
					enam: "{{emoji}} Amérique du Nord de l'Est",
					me: "{{emoji}} Moyen-Orient",
					oc: "{{emoji}} Océanie",
					sam: "{{emoji}} Amérique du Sud",
					weur: "{{emoji}} Europe de l'Ouest",
					wnam: "{{emoji}} Amérique du Nord de l'Ouest",
				},
			},
		},
		cta: "Créer le moniteur",
	},

	toasts: {
		refreshMonitor: {
			pending: "Ping de {{name}} en cours...",
			success: "Le ping de {{name}} est terminé.",
			failure: "Oups ! Une erreur s'est produite lors de l'exécution du moniteur.",
		},

		deleteMonitor: {
			success: "{{name}} a été supprimé.",
			failure: "Nous n'avons pas pu supprimer {{name}}. Veuillez réessayer.",
		},

		createMonitor: {
			pending: "Création du moniteur {{name}}...",
			success: "{{name}} a été créé.",
			failure: "Nous n'avons pas pu créer {{name}}. Veuillez réessayer.",
		},
	},

	emails: {
		accountDeleted: {
			subject: "Votre compte Uptime a été supprimé",
			preview: "Votre compte et ses données ont été supprimés.",
			heading: "Votre compte a été supprimé",
			body: "Vous nous avez demandé de supprimer votre compte Uptime, et c'est fait. Vos équipes, moniteurs, alertes, pages de statut et préférences ont disparu, toute équipe dont vous étiez propriétaire a été supprimée avec eux, et votre abonnement a été annulé.",
			retained: {
				intro:
					"Quelques éléments que nous n'avons pas pu supprimer, pour que vous sachiez exactement où vous en êtes :",
				billing:
					"Les factures et les registres de paiement détenus par notre prestataire de facturation. La loi fiscale nous oblige à les conserver, et le droit de la protection des données l'autorise pour cette raison.",
				analytics:
					"Les résultats des vérifications de surveillance dans notre entrepôt analytique. Il fonctionne en ajout seul — il n'existe aucun moyen d'y supprimer un enregistrement, seulement de le laisser expirer selon son calendrier de rétention.",
				logs: "Les journaux de requêtes du serveur, pour la même raison : ils expirent selon un calendrier de rétention et ne peuvent pas être supprimés plus tôt.",
				identity:
					"Votre identité de connexion elle-même, qui est détenue par le fournisseur d'identité avec lequel vous vous connectiez, et non par nous.",
			},
			address:
				"Cette adresse e-mail n'était conservée que pour pouvoir vous envoyer ce message. Elle vient d'être supprimée à son tour.",
			footer:
				"Vous avez reçu cet e-mail parce que vous nous avez demandé de supprimer votre compte Uptime. Aucun autre e-mail ne sera envoyé à cette adresse.",
		},

		teamDeleted: {
			subject: "{{team}} a été supprimée sur Uptime",
			preview: "{{team}} et tout ce qu'elle surveillait n'existent plus.",
			heading: "{{team}} a été supprimée",
			body: "Le propriétaire de {{team}} a supprimé son compte Uptime, et l'équipe a été supprimée avec lui. Vous n'y avez plus accès.",
			lost: "Tout ce qui appartenait à l'équipe a disparu : ses moniteurs, ses alertes et ses pages de statut n'existent plus, et rien de tout cela ne peut être récupéré.",
			next: "Si vous avez toujours besoin de cette surveillance, vous pouvez créer votre propre équipe sur Uptime et la reconfigurer.",
			footer:
				"Vous avez reçu cet e-mail parce que vous étiez membre de {{team}} sur Uptime. Vous n'avez rien à faire.",
		},

		teamInvite: {
			subject: "Vous avez été invité à rejoindre {{team}} sur Uptime",
			preview: "Rejoignez {{team}} sur Uptime",
			heading: "Vous avez été invité à rejoindre {{team}}",
			body: "{{team}} utilise Uptime pour garder un œil sur ses services. Acceptez l'invitation pour rejoindre l'équipe.",
			action: "Accepter l'invitation",
			footer:
				"Vous avez reçu cet e-mail parce que quelqu'un vous a invité dans son équipe sur Uptime. Si vous ne vous y attendiez pas, vous pouvez ignorer ce message.",
		},

		alert: {
			subject: "[Alerte Uptime] {{monitor}} est {{status}}",
			preview: "{{monitor}} est {{status}}",
			heading: "{{monitor}} est {{status}}",
			action: "Ouvrir le tableau de bord",
			incidentCooldown:
				"Notifications pour cet incident : {{sent}} envoyées, {{suppressed}} retenues par le délai d'attente de l'alerte.",
			footer:
				"Vous avez reçu cet e-mail parce qu'une des alertes de votre équipe correspond à cet événement.",

			status: {
				up: "RÉTABLI",
				down: "HORS LIGNE",
				degraded: "DÉGRADÉ",
			},

			fields: {
				monitor: "Moniteur",
				status: "Statut",
				time: "Heure",
				url: "URL",
				responseStatus: "Statut de la réponse",
				responseTime: "Temps de réponse",
				domain: "Domaine",
				resolvedValue: "Valeur résolue",
				endpoint: "Point de terminaison",
				schedule: "Planification",
				lastPing: "Dernier ping",
				nextExpected: "Prochain attendu",
				hostname: "Nom d'hôte",
				expiresAt: "Expire le",
			},

			values: {
				none: "—",
				never: "jamais",
				monitor: "{{name}} ({{type}})",
				responseStatus: "{{actual}} (attendu {{expected}})",
				milliseconds: "{{value}}ms",
				domain: "{{domain}} ({{recordType}})",
				endpoint: "{{host}}:{{port}}",
				schedule: "{{expression}} ({{timezone}})",
			},
		},

		teamDigest: {
			action: "Ouvrir le tableau de bord",
			footer: "Vous avez reçu cet e-mail parce que vous êtes membre de {{team}} sur Uptime.",
			manageAction: "Choisir les e-mails que vous recevez",

			status: {
				up: "En ligne",
				degraded: "Dégradé",
				down: "Hors ligne",
				noData: "Non vérifié",
			},

			types: {
				http: "HTTP",
				dns: "DNS",
				tcp: "TCP",
				cron: "Cron job",
			},

			columns: {
				monitor: "Moniteur",
				status: "Statut",
				uptime: "Disponibilité",
			},

			values: {
				none: "—",
				percentage: "{{value}} %",
			},

			bar: {
				uptime: "{{value}} % de disponibilité",
				legend: {
					up: "En ligne",
					degraded: "Dégradé",
					down: "Hors ligne",
					noData: "Aucune donnée",
				},
			},

			daily: {
				subject_one: "{{team}} : le moniteur mérite un coup d'œil",
				subject_other: "{{team}} : {{up}} moniteurs sur {{count}} en ligne hier",
				subjectAll_one: "{{team}} : le moniteur était en ligne hier",
				subjectAll_other: "{{team}} : les {{count}} moniteurs en ligne hier",
				preview: "La dernière journée complète de vérifications sur {{team}}",
				heading: "Hier sur {{team}}",
				summaryAll_one: "Le moniteur de l'équipe était en ligne le {{date}}.",
				summaryAll_other: "Les {{count}} moniteurs étaient en ligne le {{date}}.",
				summary_one: "Le moniteur de l'équipe n'était pas en ligne le {{date}}.",
				summary_other: "{{up}} moniteurs sur {{count}} étaient en ligne le {{date}}.",
			},

			weekly: {
				subject_one: "{{team}} : le moniteur a eu une mauvaise journée cette semaine",
				subject_other: "{{team}} : {{up}} moniteurs sur {{count}} en ligne toute la semaine",
				subjectAll_one: "{{team}} : le moniteur est resté en ligne toute la semaine",
				subjectAll_other: "{{team}} : les {{count}} moniteurs en ligne toute la semaine",
				preview: "Les sept derniers jours de vérifications sur {{team}}",
				heading: "Les sept derniers jours sur {{team}}",
				summaryAll_one: "Le moniteur de l'équipe était en ligne chaque jour.",
				summaryAll_other: "Les {{count}} moniteurs étaient en ligne chaque jour.",
				summary_one: "Le moniteur de l'équipe n'a pas été en ligne tous les jours.",
				summary_other: "{{up}} moniteurs sur {{count}} étaient en ligne chaque jour.",
			},
		},

		trial: {
			stopAction: "Arrêter ces e-mails",

			/**
			 * The report page every per-target trial report links, shared because the wrap-up and the
			 * repeat-submission answer point at the same page with the same sentence.
			 */
			reportLink: {
				body: "Ce rapport existe aussi à un lien que vous pouvez réouvrir ou partager :",
				action: "Le consulter en ligne",
			},
			stop: "Un clic met fin à toutes les URL que vous nous avez demandé de surveiller et supprime votre adresse et ses données. Vous pouvez recommencer à tout moment depuis notre site.",

			status: {
				up: "EN LIGNE",
				degraded: "DÉGRADÉ",
				down: "HORS LIGNE",
			},

			fields: {
				url: "URL",
				status: "Statut",
				previousStatus: "Statut précédent",
				responseStatus: "Statut de la réponse",
				responseTime: "Temps de réponse",
				checkedAt: "Vérifié le",
				changedAt: "Modifié le",
				checks: "Vérifications effectuées",
				uptime: "Disponibilité",
				slowest: "Réponse la plus lente",
			},

			values: {
				none: "—",
				milliseconds: "{{value}}ms",
				percentage: "{{value}} %",
			},

			bar: {
				uptime: "{{value}} % de disponibilité",
				legend: {
					up: "En ligne",
					degraded: "Dégradé",
					down: "Hors ligne",
					noData: "Aucune donnée",
				},
			},

			confirmation: {
				subject: "Nous vérifions désormais {{url}} toutes les heures",
				preview: "Les vérifications horaires de {{url}} ont commencé",
				heading: "Nous vérifions désormais {{url}} toutes les heures",
				body: "Voici la vérification que vous venez de lancer. Nous la répéterons toutes les heures jusqu'au {{until}} et vous écrirons dès que le résultat change. Vous recevrez également un récapitulatif une fois par jour.",
				footer:
					"Vous avez reçu cet e-mail parce que vous nous avez demandé de vérifier cette URL depuis notre site.",
			},

			change: {
				subject: "{{url}} est {{status}}",
				preview: "{{url}} est {{status}}",
				heading: "{{url}} est {{status}}",
				body: "La vérification horaire de {{time}} a renvoyé un résultat différent de la précédente.",
				footer:
					"Vous avez reçu cet e-mail parce que vous nous avez demandé de surveiller cette URL pendant une semaine.",
			},

			daily: {
				subject: "Rapport quotidien : {{url}}",
				subjectMany: "Rapport quotidien : {{total}} URL",
				preview: "Les 24 dernières heures de vérifications de {{url}}",
				previewMany: "Les 24 dernières heures de vérifications de {{total}} URL",
				heading: "{{url}} sur les 24 dernières heures",
				headingMany: "Vos {{total}} URL sur les 24 dernières heures",
				summaryAll: "Toutes les {{total}} étaient en ligne à la dernière vérification.",
				summary: "{{up}} sur {{total}} étaient en ligne à la dernière vérification.",
				target: "{{url}} — {{status}}",
				rangeStart: "Il y a 24 heures",
				rangeEnd: "Maintenant",
				footer:
					"Vous avez reçu cet e-mail parce que vous nous avez demandé d'effectuer ces vérifications depuis notre site.",
			},

			weekly: {
				subject: "Rapport sur sept jours : {{url}}",
				preview: "La semaine complète de vérifications de {{url}}",
				heading: "{{url}} sur les sept derniers jours",
				rangeStart: "Il y a 7 jours",
				rangeEnd: "Aujourd'hui",
				closing:
					"C'était le septième jour, les vérifications gratuites de {{url}} s'arrêtent donc ici.",
				action: "Continuer à vérifier cette URL",
				footer:
					"Vous avez reçu cet e-mail parce que vous nous avez demandé de surveiller cette URL pendant une semaine. C'est le dernier.",
			},

			repeat: {
				subject: "Ce que nous avons trouvé sur {{url}} jusqu'ici",
				preview: "Les vérifications déjà effectuées sur {{url}}",
				heading: "{{url}} est déjà vérifiée",
				intro:
					"Vous nous avez demandé de surveiller {{url}} le {{since}}. Voici tout ce que ces vérifications ont trouvé.",
				rangeStart: "Jour 1",
				rangeEnd: "Jour 7",
				closing:
					"Chaque URL bénéficie d'une semaine gratuite tous les 30 jours ; cette demande n'en a donc pas lancé une seconde. Pour continuer à vérifier {{url}} — aussi souvent que vous le souhaitez, avec une alerte dès que cela change — utilisez Uptime.",
				action: "Continuer à vérifier cette URL",
				footer:
					"Vous avez reçu cet e-mail parce que vous avez soumis cette URL sur notre site et que nous avions déjà un rapport la concernant.",
			},
		},
	},

	components: {
		copyButton: {
			label: "Copier",
			copied: "Copié !",
		},

		selectAll: {
			select: "Tout sélectionner",
			clear: "Tout désélectionner",
		},
	},

	cron: {
		error: {
			empty: "Saisissez une expression cron.",
			"field-count":
				"Une expression cron doit comporter exactement cinq champs : minute, heure, jour du mois, mois et jour de la semaine.",
			"seconds-not-supported":
				"Les secondes ne sont pas prises en charge. Utilisez le format à cinq champs, en commençant par la minute.",
			"unknown-macro":
				"Ce raccourci n'est pas pris en charge. Utilisez @hourly, @daily, @weekly, @monthly ou @yearly.",
			syntax: "L'un des champs n'est ni une valeur, ni une plage, ni une liste, ni un pas.",
			"unknown-name":
				"L'un des noms de mois ou de jour n'est pas reconnu. Utilisez des abréviations de trois lettres comme JAN ou MON.",
			"out-of-range": "L'une des valeurs est en dehors de la plage autorisée pour son champ.",
			"reversed-range": "L'une des plages commence après sa fin.",
			"invalid-step": "Un pas doit être un nombre entier supérieur à zéro.",
			"impossible-date": "Ce jour du mois n'existe jamais dans le mois auquel il est associé.",
		},
	},

	schedule: {
		interval: {
			minute_one: "Chaque minute",
			minute_other: "Toutes les {{count}} minutes",
			hour_one: "Chaque heure",
			hour_other: "Toutes les {{count}} heures",
		},
		hourly: {
			onTheHour: "Chaque heure",
			atMinutes: "Chaque heure à la minute {{minutes}}",
		},
		daily: "Chaque jour à {{times}}",
		weekly: "Chaque {{days}} à {{times}}",
		monthly: "Chaque mois le {{days}} à {{times}}",
		yearly: "Chaque année le {{days}} {{months}} à {{times}}",
		expression: "Planification personnalisée ({{expression}})",
	},

	actions: {
		checks: {
			subscriptionRequired: "Un abonnement actif est nécessaire pour lancer une vérification.",
		},

		addDomain: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notAllowed: "Vous n'êtes pas autorisé à ajouter des domaines à cette équipe.",
				alreadyExists: "{{hostname}} a été ajouté le {{verifiedAt}}.",
			},

			success: {
				accepted: "{{hostname}} est toujours en attente de vérification.",
				created: "{{hostname}} a été ajouté à {{team}}. La vérification est en attente.",
			},
		},

		changeRole: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notAllowed: "Vous n'êtes pas autorisé à modifier les rôles dans cette équipe.",
				cannotChangeOwner: "Vous ne pouvez pas modifier le rôle du propriétaire de l'équipe.",
			},

			success: "Le rôle de {{name}} a été changé en {{role}} dans {{team}}.",
		},

		createAlert: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notAllowed: "Vous n'êtes pas autorisé à créer des alertes dans cette équipe.",
				limitExceeded: "Vous avez atteint la limite de {{limit}} alertes dans cette équipe.",
			},
			success: { created: "L'alerte {{name}} a été créée." },
		},

		createInvite: {
			email: {
				subject: "Vous avez été invité à rejoindre {{team}} sur Uptime",
			},

			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notAllowed: "Vous n'êtes pas autorisé à inviter des membres dans cette équipe.",
				alreadyAccepted: "Il y a déjà un membre de {{team}} avec cet e-mail.",
			},

			success: "{{email}} a été invité à rejoindre {{team}}.",
		},

		createMonitor: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
			},

			success: "Le moniteur {{name}} a été créé.",
		},

		/**
		 * Un import en masse rapporte deux nombres, et `partial` est celui qui compte : un envoi
		 * dont une partie des lignes est passée est un succès avec une liste de choses à corriger,
		 * pas un échec — il dit donc combien de moniteurs existent avant de dire combien de lignes
		 * sont à reprendre.
		 */
		importMonitors: {
			errors: {
				generic: "Oups ! Une erreur s'est produite. Vérifiez la liste et réessayez.",
				none: "Rien dans cette liste n'a pu être importé. Consultez les raisons ci-dessous et réessayez.",
			},

			success_one: "1 moniteur a été créé.",
			success_other: "{{count}} moniteurs ont été créés.",
			partial_one:
				"1 moniteur a été créé. {{rejected}} de plus n'ont pas pu l'être — voir ci-dessous.",
			partial_other:
				"{{count}} moniteurs ont été créés. {{rejected}} de plus n'ont pas pu l'être — voir ci-dessous.",
		},

		updateMonitor: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Ce moniteur n'existe pas.",
			},

			success: "Le moniteur {{name}} a été mis à jour.",
		},

		updateSsl: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Ce moniteur n'existe pas.",
			},

			success: "Les paramètres SSL de {{name}} ont été mis à jour.",
		},

		deleteMonitor: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notAllowed: "Vous n'êtes pas autorisé à supprimer des moniteurs dans cette équipe.",
				notFound: "Ce moniteur n'existe pas.",
			},
			success: "Le moniteur {{name}} a été supprimé.",
		},

		playMonitor: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Ce moniteur n'existe pas.",
			},

			pending: "Ping de {{name}} en cours...",
			success: "Le ping de {{name}} est terminé.",
			failure: "Oups ! Une erreur s'est produite lors de l'exécution du moniteur.",
		},

		removeAlert: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				forbidden: "Vous n'êtes pas autorisé à supprimer des alertes dans cette équipe.",
				notFound: "{{name}} n'existe pas.",
			},
			success: "L'alerte {{name}} a été supprimée.",
		},

		removeDomain: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notAllowed: "Vous n'êtes pas autorisé à supprimer des domaines de cette équipe.",
				notFound: "{{hostname}} n'existe pas.",
			},

			success: "{{hostname}} a été supprimé de {{team}}.",
		},

		removeMember: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notAllowed: "Vous n'êtes pas autorisé à supprimer des membres de cette équipe.",
				cannotRemoveOwner: "Vous ne pouvez pas supprimer le propriétaire de l'équipe.",
			},

			success: "{{name}} a été supprimé de {{team}}.",
		},

		retryDomainVerification: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notAllowed:
					"Vous n'êtes pas autorisé à réessayer la vérification de domaine dans cette équipe.",
				notFound: "{{hostname}} n'existe pas.",
				workflowFailed:
					"Le processus de vérification n'a pas pu démarrer pour {{hostname}}. Réessayez plus tard.",
			},

			success: {
				alreadyVerified: "{{hostname}} est déjà vérifié.",
				requested: "Une nouvelle tentative de vérification de {{hostname}} a été demandée.",
			},
		},

		revokeInvite: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notAllowed: "Vous n'êtes pas autorisé à révoquer des invitations dans cette équipe.",
				notFound: "Cette invitation n'existe pas.",
				alreadyAccepted: "Cette invitation a déjà été acceptée par l'invité.",
			},

			success: "L'invitation de {{email}} a été révoquée de {{team}}.",
		},

		updateTeam: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				forbidden: "Vous n'êtes pas autorisé à mettre à jour les paramètres de l'équipe.",
			},

			success: {
				updated: "Les paramètres de l'équipe ont été mis à jour avec succès.",
			},
		},

		deleteTeam: {
			errors: {
				generic: "Oups ! Une erreur s'est produite lors de la suppression de l'équipe.",
				forbidden: "Seul le propriétaire de l'équipe peut supprimer l'équipe.",
				confirmationRequired: "Veuillez taper DELETE pour confirmer.",
			},

			success: "{{team}} a été supprimée.",
		},

		leaveTeam: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notMember: "Vous n'êtes pas membre de cette équipe.",
				ownerCannotLeave:
					"Les propriétaires d'équipe ne peuvent pas quitter leur équipe. Transférez d'abord la propriété.",
				adminCannotLeave:
					"Les administrateurs ne peuvent pas quitter l'équipe. Demandez au propriétaire de vous rétrograder d'abord.",
			},

			success: "Vous avez quitté {{team}}.",
		},

		createStatusPage: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				slugTaken: "Ce slug est déjà utilisé.",
			},
		},

		updateStatusPage: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Cette page de statut n'existe pas.",
				slugTaken: "Ce slug est déjà utilisé.",
			},
		},

		deleteStatusPage: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Cette page de statut n'existe pas.",
			},

			success: "La page de statut a été supprimée.",
		},

		createMaintenance: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				invalidDates: "L'heure de fin doit être après l'heure de début.",
			},

			success: {
				created: "La fenêtre de maintenance '{{name}}' a été créée.",
			},
		},

		deleteMaintenance: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Cette fenêtre de maintenance n'existe pas.",
				forbidden: "Vous n'êtes pas autorisé à supprimer cette fenêtre de maintenance.",
			},

			success: "La fenêtre de maintenance '{{name}}' a été supprimée.",
		},

		endMaintenance: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Cette fenêtre de maintenance n'existe pas.",
				forbidden: "Vous n'êtes pas autorisé à terminer cette fenêtre de maintenance.",
			},

			success: "La fenêtre de maintenance '{{name}}' a été terminée plus tôt.",
		},

		createTeam: {
			errors: {
				generic: "Oups ! Une erreur s'est produite lors de la création de l'équipe.",
			},

			success: {
				created: "L'équipe {{name}} a été créée avec succès.",
			},
		},

		createDnsMonitor: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				limitExceeded: "Vous avez atteint la limite de {{limit}} moniteurs DNS dans cette équipe.",
			},

			success: {
				created: "Le moniteur DNS {{name}} a été créé.",
			},
		},

		updateDnsMonitor: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Ce moniteur DNS n'existe pas.",
				forbidden: "Vous n'êtes pas autorisé à mettre à jour ce moniteur DNS.",
			},

			success: "Le moniteur DNS {{name}} a été mis à jour.",
		},

		deleteDnsMonitor: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Ce moniteur DNS n'existe pas.",
				forbidden: "Vous n'êtes pas autorisé à supprimer ce moniteur DNS.",
			},

			success: "Le moniteur DNS {{name}} a été supprimé.",
		},

		checkDnsMonitor: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Ce moniteur DNS n'existe pas.",
				forbidden: "Vous n'êtes pas autorisé à vérifier ce moniteur DNS.",
			},

			success: "La vérification DNS de {{name}} est terminée.",
		},

		createTcpMonitor: {
			errors: {
				generic: "Oups ! Une erreur s'est produite lors de la création du moniteur TCP.",
			},
			success: "Le moniteur TCP {{name}} a été créé.",
		},

		updateTcpMonitor: {
			errors: {
				generic: "Oups ! Une erreur s'est produite lors de la mise à jour du moniteur TCP.",
				notFound: "Ce moniteur TCP n'existe pas.",
			},
			success: "Le moniteur TCP {{name}} a été mis à jour.",
		},

		deleteTcpMonitor: {
			errors: {
				generic: "Oups ! Une erreur s'est produite lors de la suppression du moniteur TCP.",
				notAllowed: "Vous n'êtes pas autorisé à supprimer des moniteurs TCP dans cette équipe.",
				notFound: "Ce moniteur TCP n'existe pas.",
			},
			success: "Le moniteur TCP {{name}} a été supprimé.",
		},

		createApiKey: {
			errors: {
				generic: "Oups ! Une erreur s'est produite lors de la création de la clé API.",
				limitExceeded: "Vous avez atteint la limite de {{limit}} clés API dans cette équipe.",
			},
			success: {
				created: "La clé API '{{name}}' a été créée.",
			},
		},

		deleteApiKey: {
			errors: {
				generic: "Oups ! Une erreur s'est produite lors de la suppression de la clé API.",
				notFound: "Cette clé API n'existe pas.",
			},
			success: "La clé API '{{name}}' a été supprimée.",
		},

		updateLanguage: {
			errors: {
				generic:
					"Oups ! Une erreur s'est produite lors de la mise à jour de votre préférence de langue.",
			},
			success: "La préférence de langue a été mise à jour avec succès.",
		},

		createCronJob: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				limitExceeded: "Vous avez atteint la limite de {{limit}} cron jobs dans cette équipe.",
			},
			success: "Le cron job '{{name}}' a été créé.",
		},

		updateCronJob: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Ce cron job n'existe pas.",
			},
			success: "Le cron job '{{name}}' a été mis à jour.",
		},

		deleteCronJob: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Ce cron job n'existe pas.",
				forbidden: "Vous n'êtes pas autorisé à supprimer ce cron job.",
			},
			success: "Le cron job '{{name}}' a été supprimé.",
		},
	},

	page: {
		dashboard: {
			header: {
				title: "Tableau de bord",
				action: {
					create: "Créer un moniteur",
					refresh: "Actualiser",
				},
			},

			quickPing: {
				title: "Vérification rapide",
				description:
					"Vérifiez une URL une fois. Rien n'est enregistré, aucune alerte — coûte un ping.",
				field: {
					label: "URL",
					placeholder: "https://example.com/healthcheck",
				},
				action: {
					submit: "Lancer la vérification",
				},
				result: {
					noResponse: "Aucune réponse",
					status: {
						up: "Actif",
						degraded: "Dégradé",
						down: "Hors Service",
					},
				},
				error: {
					invalidUrl: "Saisissez une URL complète commençant par http:// ou https://.",
					subscriptionRequired: "Un abonnement actif est nécessaire pour lancer une vérification.",
				},
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			empty: {
				title: "Pas encore de moniteurs",
				description: "Créez votre premier moniteur pour commencer à suivre vos services.",
				cta: "Créer un moniteur",
			},

			stats: {
				monitors: {
					label: "Utilisation mensuelle des pings",
					value: "{{consumed}}<small> utilisés</small>",
					description: "Sur {{estimated}} estimés",
					unavailable: "Estimation non disponible",
				},

				uptime: {
					label: "Pourcentage de disponibilité",
					description: "Disponibilité globale du système",
				},

				httpMonitors: {
					label: "Moniteurs HTTP",
					breakdown: {
						up: "{{up}} actifs",
						down: "{{down}} hors service",
					},
				},
				dnsMonitors: {
					label: "Moniteurs DNS",
					breakdown: {
						ok: "{{ok}} ok",
						changed: "{{changed}} modifiés",
						error: "{{error}} erreur",
					},
				},
				tcpMonitors: {
					label: "Moniteurs TCP",
					breakdown: {
						up: "{{up}} actifs",
						down: "{{down}} hors service",
					},
				},
				cronJobs: {
					label: "Tâches Cron",
					breakdown: {
						healthy: "{{healthy}} saines",
						late: "{{late}} en retard",
						missed: "{{missed}} manquées",
					},
				},

				slowestEndpoint: {
					label: {
						default: 'Point de terminaison le plus lent "<em>{{name}}</em>"',
						noData: "Point de terminaison le plus lent",
					},
					value: { noData: "N/A" },
					description: "Au cours des dernières 24 heures",
				},

				sslMonitors: {
					label: "Moniteurs SSL",
					breakdown: {
						valid: "{{valid}} valides",
						expiring: "{{expiring}} bientôt expirés",
						expired: "{{expired}} expirés",
					},
				},
			},

			tabs: {
				http: "HTTP",
				dns: "DNS",
				tcp: "TCP",
				cronJobs: "Tâches Cron",
			},

			loading: "Chargement…",

			panel: {
				tabsLabel: "Type de moniteur",
				tabPanelLabel: "Moniteurs {{tab}}",
				refresh: "Actualiser",
			},

			error: {
				card: {
					label: "Erreur",
					value: "-",
					description: "Échec du chargement des données",
				},
				table: {
					message: "Échec du chargement des moniteurs. Veuillez réessayer.",
				},
				analytics: {
					message:
						"Les données d'analyse sont temporairement indisponibles. Veuillez réessayer plus tard.",
				},
			},

			table: {
				label: "Moniteurs",

				columns: {
					name: "Nom",
					latencyChart: "Tendance de latence",
					status: "Statut",
					lastIncident: "Dernier incident",
					responseTime: "Latence moy.",
					actions: "Actions",
				},

				status: {
					up: "En ligne",
					down: "Hors ligne",
					degraded: "Dégradé",
					unknown: "Pas de données",
				},

				lastIncident: { never: "-" },
				responseTime: "~{{value}}",

				actions: {
					menu: "Menu d'actions",
					edit: "Modifier le moniteur",
					delete: "Supprimer le moniteur",
					play: "Exécuter le moniteur",
				},

				confirmation: {
					deleteMonitor:
						"Êtes-vous sûr de vouloir supprimer le moniteur {{name}} ? Cette action est irréversible.",
				},
			},
		},

		monitors: {
			header: {
				title: "Moniteurs Uptime",
				cta: "Créer un moniteur",
				subscribe: "Vos moniteurs sont en pause. Abonnez-vous pour continuer la surveillance",
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},
		},

		createMonitor: {
			header: {
				title: "Créer un moniteur",
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nom du moniteur",
						placeholder: "Page d'accueil",
						description: "Un nom descriptif pour votre moniteur.",
					},
					url: {
						label: "URL à surveiller",
						placeholder: "https://example.com/healthcheck",
						description: "L'URL du service que vous souhaitez surveiller.",
					},
					method: {
						label: "Méthode de requête",
						placeholder: "HEAD",
						description: "La méthode HTTP à utiliser pour la requête.",
					},
					status: {
						label: "Code de statut attendu",
						placeholder: "200",
						description: "Le code de statut HTTP que vous attendez de recevoir.",
					},
					interval: {
						label: "Intervalle de vérification",
						placeholder: "60",
						description: "Intervalle en secondes. Le minimum est de 60 secondes.",
					},
					visibility: {
						label: "Visibilité",
						description: "Les moniteurs publics peuvent être partagés avec n'importe qui.",
						options: { public: "Public", private: "Privé" },
					},
					region: {
						label: "Région",
						description: "La région depuis laquelle le ping sera exécuté.",
						placeholder: "Sélectionner une région",
						options: {
							afr: "{{emoji}} Afrique",
							apac: "{{emoji}} Asie-Pacifique",
							eeur: "{{emoji}} Europe de l'Est",
							enam: "{{emoji}} Amérique du Nord de l'Est",
							me: "{{emoji}} Moyen-Orient",
							oc: "{{emoji}} Océanie",
							sam: "{{emoji}} Amérique du Sud",
							weur: "{{emoji}} Europe de l'Ouest",
							wnam: "{{emoji}} Amérique du Nord de l'Ouest",
						},
					},
				},

				sections: {
					basics: {
						title: "Informations de base",
						description: "Ce que ce moniteur surveille.",
					},
					checks: {
						title: "Paramètres de vérification",
						description:
							"À quelle fréquence le moniteur s'exécute, ce qu'il attend en retour et d'où il s'exécute.",
					},
				},

				cta: "Créer le moniteur",
			},
		},

		editMonitor: {
			header: {
				title: "Modifier le moniteur",
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nom du moniteur",
						placeholder: "Page d'accueil",
						description: "Un nom descriptif pour votre moniteur.",
					},
					url: {
						label: "URL à surveiller",
						placeholder: "https://example.com/healthcheck",
						description: "L'URL du service que vous souhaitez surveiller.",
					},
					method: {
						label: "Méthode de requête",
						placeholder: "HEAD",
						description: "La méthode HTTP à utiliser pour la requête.",
					},
					status: {
						label: "Code de statut attendu",
						placeholder: "200",
						description: "Le code de statut HTTP que vous attendez de recevoir.",
					},
					interval: {
						label: "Intervalle de vérification",
						placeholder: "60",
						description: "Intervalle en secondes. Le minimum est de 60 secondes.",
					},
					visibility: {
						label: "Visibilité",
						description: "Les moniteurs publics peuvent être partagés avec n'importe qui.",
						options: { public: "Public", private: "Privé" },
					},
					region: {
						label: "Région",
						description: "La région depuis laquelle le ping sera exécuté.",
						placeholder: "wnam",
						options: {
							afr: "{{emoji}} Afrique",
							apac: "{{emoji}} Asie-Pacifique",
							eeur: "{{emoji}} Europe de l'Est",
							enam: "{{emoji}} Amérique du Nord de l'Est",
							me: "{{emoji}} Moyen-Orient",
							oc: "{{emoji}} Océanie",
							sam: "{{emoji}} Amérique du Sud",
							weur: "{{emoji}} Europe de l'Ouest",
							wnam: "{{emoji}} Amérique du Nord de l'Ouest",
						},
					},
					ssl: {
						enabled: {
							label: "Activer la surveillance SSL",
							description:
								"Surveillez l'expiration du certificat SSL et recevez des alertes avant son expiration.",
						},
						expiresAt: {
							label: "Date d'expiration du certificat",
							placeholder: "Sélectionner la date d'expiration",
							description:
								"Entrez la date d'expiration de votre certificat SSL. Vous pouvez la trouver dans le tableau de bord de votre hébergeur ou en vérifiant les détails du certificat dans votre navigateur.",
						},
						issuer: {
							label: "Émetteur du certificat",
							placeholder: "Let's Encrypt, DigiCert, etc.",
							description:
								"L'autorité de certification qui a émis votre certificat SSL (optionnel).",
						},
						warningDays: {
							label: "Alerte avant expiration",
							description:
								"Recevez des alertes ce nombre de jours avant l'expiration du certificat.",
						},
					},
				},

				sections: {
					basics: {
						title: "Informations de base",
						description: "Ce que ce moniteur surveille.",
					},
					checks: {
						title: "Paramètres de vérification",
						description:
							"À quelle fréquence le moniteur s'exécute, ce qu'il attend en retour et d'où il s'exécute.",
					},
				},

				cancel: "Annuler",
				cta: "Enregistrer les modifications",
			},

			ssl: {
				title: "Surveillance du certificat SSL",
				description:
					"Suivez l'expiration de votre certificat pour en être informé avant vos visiteurs.",
				cta: "Enregistrer les paramètres SSL",
			},

			dangerZone: {
				title: "Zone de danger",
				description: "Les actions de cette section sont irréversibles.",
				warning:
					"Supprimer ce moniteur efface définitivement ses vérifications, son historique et ses alertes.",
				delete: "Supprimer le moniteur",
			},
		},

		monitor: {
			header: {
				title: 'Moniteur "{{name}}"',

				action: {
					play: "Exécuter le moniteur",
					running: "Exécution…",
					edit: "Modifier le moniteur",
					refresh: "Actualiser",
				},
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			stats: {
				monitors: {
					label: "Utilisation mensuelle des pings",
					value: "{{consumed}}<small> utilisés</small>",
					description: "Sur {{estimated}} estimés",
					estimateUnavailable: "Estimation indisponible",
				},

				uptime: {
					label: "Pourcentage de disponibilité",
					description: "90 derniers jours",
				},

				slowestResult: {
					label: "Résultat le plus lent",
					description: "Au cours des dernières 24 heures",
				},

				p99ResponseTime: {
					label: "Temps de réponse P99",
					value: "{{value}} ms",
					description: "p99, dernières 24 h",
				},
			},

			ssl: {
				title: "Certificat SSL",
				status: {
					valid: "Valide",
					expiring: "Expire bientôt",
					expired: "Expiré",
					error: "Erreur",
					unknown: "Non configuré",
				},
				expiresAt: "Expire",
				expiresIn: "{{days}} jours",
				issuer: "Émetteur",
				lastChecked: "Dernière vérification",
				notConfigured: "La surveillance SSL n'est pas activée pour ce moniteur.",
				configure: "Configurer la surveillance SSL",
			},
			run: {
				toast: {
					up: "{{name}} est en ligne",
					down: "{{name}} est hors ligne",
					degraded: "{{name}} est dégradé",
					changed: "La vérification que vous venez de lancer a changé le statut de ce moniteur.",
					notQueued: {
						title: "Vérification non lancée",
						description: "Un abonnement actif est nécessaire pour lancer une vérification.",
					},
				},
			},
		},

		billing: {
			header: {
				title: "Facturation",
			},
			ownerOnly:
				"Seul le propriétaire de l'équipe peut consulter et gérer la facturation de cette équipe.",
		},

		members: {
			header: {
				title: "Membres de l'équipe",

				action: {
					invite: "Inviter un membre",
				},
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			sections: {
				members: {
					title: "Membres",
					description: "Gérez les membres de votre équipe et leurs rôles.",
				},
			},

			membersTable: {
				label: "Membres actuels",
				description: "Personnes ayant accès à cette équipe.",

				columns: {
					name: "Nom",
					role: "Rôle dans l'équipe",
					actions: "Actions",
				},

				role: {
					member: "Membre",
					admin: "Administrateur",
					owner: "Propriétaire",
				},

				actions: {
					menu: "Menu d'actions",
					remove: "Retirer de l'équipe",
					transfer: "Transférer la propriété",
					changeRole: {
						member: "Convertir en administrateur",
						admin: "Convertir en membre",
						owner: "Impossible de modifier le propriétaire",
					},
				},

				confirmation: {
					removeMember: "Êtes-vous sûr de vouloir retirer {{name}} de l'équipe ?",
				},
			},

			invitedMembersTable: {
				label: "Invitations en attente",
				description: "Personnes invitées qui n'ont pas encore rejoint.",

				columns: {
					email: "E-mail",
					actions: "Actions",
				},

				actions: {
					menu: "Menu d'actions",
					copy: "Copier le lien d'invitation",
					revoke: "Révoquer l'invitation",
				},

				confirmation: {
					revokeInvite: "Êtes-vous sûr de vouloir révoquer l'invitation de {{email}} ?",
				},
			},

			error: {
				forbidden: {
					title: "Vous n'avez pas la permission d'accéder à cette page.",
					description:
						"Veuillez contacter l'administrateur de votre équipe pour obtenir de l'aide.",
				},

				unknown: {
					title: "Une erreur inattendue s'est produite.",
					description: "Veuillez réessayer plus tard ou contacter le support.",
				},
			},
		},

		invite: {
			header: {
				title: "Inviter un membre de l'équipe",
				description: "Envoyez une invitation pour rejoindre votre équipe.",
			},

			dialog: {
				close: "Fermer la boîte de dialogue",
			},

			form: {
				fields: {
					email: {
						label: "Adresse e-mail",
						placeholder: "jean.dupont@example.com",
						description:
							"L'adresse e-mail de la personne que vous souhaitez inviter dans {{team}}.",
					},
				},

				cancel: "Annuler",
				cta: "Inviter un membre",
			},
		},

		acceptInvite: {
			errors: {
				pageTitle: "Invitation indisponible",
				notFound: "Cette invitation n'existe pas.",
				gone: "Cette invitation a déjà été acceptée.",
				forbidden: "Cette invitation ne vous était pas destinée.",
				badRequest: "Il semble que vous n'ayez pas d'adresse e-mail. Essayez de vous reconnecter.",
				wrongEmail:
					"Cette invitation a été envoyée à {{email}}. Connectez-vous avec cette adresse e-mail pour l'accepter.",
			},
		},

		domains: {
			header: {
				title: "Domaines de l'équipe",
				action: { addDomain: "Ajouter un domaine" },
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			sections: {
				domains: {
					title: "Domaines",
					description: "Gérez les domaines vérifiés pour votre équipe.",
				},
			},

			form: {
				fields: {
					hostname: {
						label: "Domaine",
						placeholder: "example.com",
						description: "Le domaine que vous souhaitez ajouter à {{team}}.",
					},
				},

				cta: "Ajouter un domaine",
			},

			table: {
				label: "Domaines vérifiés",
				description:
					"Domaines pouvant être utilisés pour l'approvisionnement automatique des membres de l'équipe.",

				columns: {
					hostname: "Nom d'hôte",
					id: "ID de vérification",
					verifiedAt: "Vérifié le",
					actions: "Actions",
				},

				verifiedAt: {
					pending: "En attente de vérification",
				},

				actions: {
					menu: "Menu d'actions",
					copy: "Copier l'ID de vérification",
					remove: "Supprimer le domaine",
					retryVerification: "Réessayer la vérification",
				},

				confirmation: {
					removeDomain: "Êtes-vous sûr de vouloir supprimer {{hostname}} de l'équipe ?",
				},
			},

			instructions: {
				title: "Comment vérifier votre domaine",

				description:
					"Pour vérifier votre domaine, ajoutez l'enregistrement `TXT` suivant à vos paramètres DNS :",

				record: {
					name: {
						label: "Nom",
						value: "_ping-verification",
					},
					content: {
						label: "Contenu",
						value: "VERIFICATION_ID",
					},
				},

				note: "Assurez-vous de remplacer <code>VERIFICATION_ID</code> par l'ID de vérification réel affiché ci-dessus.",

				disclaimer:
					"Les modifications DNS peuvent prendre un certain temps à se propager, la vérification pourrait donc être retardée.",
			},

			error: {
				forbidden: {
					title: "Vous n'avez pas la permission d'accéder à cette page.",
					description:
						"Veuillez contacter l'administrateur de votre équipe pour obtenir de l'aide.",
				},

				unknown: {
					title: "Une erreur inattendue s'est produite.",
					description: "Veuillez réessayer plus tard ou contacter le support.",
				},
			},
		},

		alerts: {
			header: {
				title: "Alertes",

				action: {
					create: "Créer une alerte",
					history: "Voir l'historique",
				},
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			empty: {
				title: "Aucune alerte configurée",
				description: "Créez une alerte pour être notifié lorsque vos moniteurs tombent en panne.",
				cta: "Créer une alerte",
			},

			limitReached: "Cette équipe a atteint la limite de {{limit}} alertes.",

			form: {
				fields: {
					name: {
						label: "Nom",
						placeholder: "Alerte CTO",
						description: "Un nom pour identifier l'alerte.",
					},

					scope: {
						label: "Portée",
						teamWide: "Toute l'équipe (tous les moniteurs)",
					},

					channel: {
						label: "Canal",
						description: "Le canal à utiliser pour l'alerte.",
						options: {
							webhook: "Webhook",
							email: "E-mail",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "URL",
								placeholder: "https://example.com/webhook",
								description: "L'URL vers laquelle envoyer la charge utile de l'alerte.",
							},
							secret: {
								label: "Secret de signature (optionnel)",
								placeholder: "secret-optionnel",
								description:
									"Un secret optionnel à inclure dans les en-têtes de la requête. Un en-tête `Webhook-Signature` sera ajouté avec une signature HMAC SHA256 de la charge utile utilisant ce secret.",
							},
							signatureNote:
								"Lorsqu'il est défini, les requêtes portent un en-tête <code>Webhook-Signature: sha256=<hex></code> — un HMAC-SHA256 du corps JSON brut utilisant ce secret.",
						},
						email: {
							to: {
								label: "Destinataire",
								placeholder: "cto@example.com",
								description: "L'adresse e-mail à laquelle envoyer l'alerte.",
							},

							subjectPrefix: {
								label: "Préfixe du sujet (optionnel)",
								placeholder: "[Alerte Uptime]",
								description:
									"Un préfixe optionnel à ajouter au sujet de l'e-mail. Utile pour filtrer les alertes dans votre boîte de réception.",
							},
						},
						slack: {
							webhookUrl: {
								label: "URL du webhook",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"L'URL du webhook entrant Slack. Créez-en un sur api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Canal personnalisé (optionnel)",
								placeholder: "#alertes",
								description:
									"Canal optionnel où publier au lieu de la valeur par défaut du webhook. Incluez le préfixe #.",
							},
						},
						discord: {
							webhookUrl: {
								label: "URL du webhook",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"L'URL du webhook Discord. Créez-en un dans Paramètres du serveur > Intégrations > Webhooks.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Notifier lors de la récupération",
						description:
							"Envoyer une alerte lorsque le moniteur se rétablit d'un état hors ligne. Inclut le temps de récupération et la durée de l'indisponibilité.",
					},

					cooldown: {
						label: "Délai de récupération des alertes",
						description:
							"Temps minimum entre les alertes du même type. Évite la fatigue des alertes lors de pannes prolongées.",
						options: {
							none: "Pas de délai",
							"5min": "5 minutes",
							"15min": "15 minutes",
							"30min": "30 minutes",
							"1hour": "1 heure",
							"2hours": "2 heures",
							custom: "Personnalisé",
						},
						custom: {
							label: "Délai personnalisé (minutes)",
							placeholder: "Entrez les minutes",
							description: "Entrez le nombre de minutes entre les alertes.",
						},
					},

					cooldownMinutes: {
						label: "Délai d'attente (minutes)",
						description:
							"Combien de temps attendre avant de répéter une alerte pendant qu'un moniteur est toujours en panne. La première alerte d'un incident part toujours immédiatement, et un rétablissement est toujours envoyé. Les répétitions ne sont jamais espacées de moins de {{floor}} minutes, quelle que soit la valeur saisie ici.",
					},

					legends: {
						email: "Paramètres e-mail",
						webhook: "Paramètres du webhook",
						slack: "Paramètres Slack",
						discord: "Paramètres Discord",
					},
				},

				cta: "Créer une alerte",
			},

			table: {
				label: "Alertes",

				columns: {
					name: "Nom",
					scope: "Portée",
					strategy: "Type",
					notifyOnRecovery: "Récupération",
					cooldown: "Délai",
					actions: "Actions",
				},

				scope: {
					unknownMonitor: "Moniteur inconnu",
					teamWide: "Toute l'équipe",
				},

				cooldown: {
					none: "Au plus vite",
					minutes: "{{count}} min",
					hours: "{{count}} h",
				},

				actions: {
					menu: "Menu d'actions",
					edit: "Modifier l'alerte",
					remove: "Supprimer l'alerte",
				},

				types: {
					webhook: "Webhook",
					email: "E-mail",
					slack: "Slack",
					discord: "Discord",
				},

				notifyOnRecovery: {
					enabled: "Oui",
					disabled: "Non",
				},

				confirmation: {
					deleteAlert: "Êtes-vous sûr de vouloir supprimer l'alerte {{name}} ?",
				},
			},
		},

		statusPages: {
			header: {
				title: "Pages de statut",

				action: {
					create: "Créer une page de statut",
				},
			},

			empty: {
				title: "Pas encore de pages de statut",
				description:
					"Créez une page de statut pour partager l'état de votre système avec vos utilisateurs.",
				cta: "Créer une page de statut",
			},

			table: {
				label: "Pages de statut",

				columns: {
					name: "Nom",
					slug: "URL",
					services: "Services",
					monitors: "Moniteurs",
					visibility: "Visibilité",
					actions: "Actions",
				},

				visibility: {
					public: "Publique",
					private: "Privée",
				},

				actions: {
					menu: "Menu d'actions",
					view: "Voir la page",
					edit: "Modifier la page",
					delete: "Supprimer la page",
				},

				confirmation: {
					delete: "Êtes-vous sûr de vouloir supprimer la page de statut {{name}} ?",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nom interne",
						placeholder: "Statut de production",
						description: "Un nom pour identifier la page de statut en interne.",
					},
					slug: {
						label: "Slug de l'URL",
						placeholder: "production",
						description:
							"Le chemin de l'URL pour la page de statut publique (ex. : /status/production).",
					},
					title: {
						label: "Titre public",
						placeholder: "Statut Acme Inc.",
						description: "Le titre affiché sur la page de statut publique.",
					},
					description: {
						label: "Description",
						placeholder: "Statut actuel des services Acme Inc.",
						description: "Une description optionnelle pour la page de statut.",
					},
					logoUrl: {
						label: "URL du logo",
						placeholder: "https://example.com/logo.png",
						description: "Un logo optionnel à afficher sur la page de statut.",
					},
					isPublic: {
						label: "Publique",
						description:
							"Rendre cette page de statut accessible à toute personne disposant du lien.",
					},
					showOverallStatus: {
						label: "Afficher le statut global",
						description: "Afficher une bannière de statut global du système en haut de la page.",
					},
					monitors: {
						label: "Moniteurs à inclure",
						description: "Sélectionnez les moniteurs à afficher sur cette page de statut.",
					},
					cronJobs: {
						label: "Cron jobs à inclure",
						description: "Sélectionnez les cron jobs à afficher sur cette page de statut.",
					},
				},

				cta: "Créer une page de statut",
				ctaUpdate: "Enregistrer les modifications",
			},
		},

		createStatusPage: {
			header: {
				title: "Créer une page de statut",
			},
			form: {
				sections: {
					branding: {
						title: "Identité",
						description:
							"Comment la page se présente, en interne et auprès de ceux qui la consultent.",
					},
					visibility: {
						title: "Visibilité",
						description: "Qui peut accéder à cette page et ce qu'elle révèle en un coup d'œil.",
					},
					services: {
						title: "Services",
						description: "Choisissez les moniteurs et cron jobs dont cette page rend compte.",
						empty:
							"Vous n'avez encore aucun moniteur ni cron job. Créez-en un et vous pourrez l'ajouter à cette page plus tard.",
					},
				},
			},
		},

		editStatusPage: {
			header: {
				title: "Modifier la page de statut",
			},
			form: {
				sections: {
					branding: {
						title: "Identité",
						description: "Comment la page se présente, à vous et à vos visiteurs.",
					},
					visibility: {
						title: "Visibilité",
						description: "Qui peut accéder à cette page et ce qu'elle affiche en haut.",
					},
					services: {
						title: "Services",
						description: "Choisissez les moniteurs et cron jobs dont cette page rend compte.",
						empty: "Vous n'avez encore aucun moniteur ni cron job à ajouter.",
					},
				},
			},
			dangerZone: {
				title: "Zone de danger",
				description: "Les actions de cette section sont irréversibles.",
				warning: "Supprimer cette page de statut met définitivement son URL publique hors ligne.",
				deleteDescription: "Cette action est irréversible.",
			},
		},

		monitorsImport: {
			meta: { title: "Importer des moniteurs" },
			header: { title: "Importer des moniteurs" },

			form: {
				sections: {
					urls: {
						title: "Ce qu'il faut importer",
						description: "Collez les adresses à surveiller, une par ligne.",
					},
					schedule: {
						title: "Fréquence des vérifications",
						description:
							"Appliqué à chaque moniteur créé par cet import. Vous pourrez modifier n'importe lequel ensuite.",
					},
				},

				fields: {
					urls: {
						label: "URL à surveiller",
						description:
							"Une URL par ligne, jusqu'à {{limit}}. Un simple hôte comme exemple.com devient https://exemple.com. Les lignes vides et les répétitions de la même adresse sont ignorées.",
						placeholder: "exemple.com\nhttps://www.exemple.org/health\nstatus.exemple.net",
					},
					interval: {
						label: "Intervalle de vérification",
						description:
							"Appliqué à chaque moniteur de cette liste. Vous pourrez modifier n'importe lequel ensuite.",
					},
				},
				cta: "Importer les moniteurs",
			},

			/**
			 * Les lignes rejetées, affichées au-dessus du champ où on les recolle. On commence par ce
			 * qui *a* été créé, pour qu'un import partiel ne se lise pas comme un échec.
			 */
			report: {
				section: { title: "Dernier import" },
				title_one: "1 moniteur a été créé. Ces lignes non :",
				title_other: "{{count}} moniteurs ont été créés. Ces lignes non :",
				overflow_one:
					"1 ligne de plus a été laissée de côté : un import prend {{limit}} lignes à la fois. Collez le reste pour les importer.",
				overflow_other:
					"{{count}} lignes de plus ont été laissées de côté : un import prend {{limit}} lignes à la fois. Collez le reste pour les importer.",
				table: {
					label: "Lignes qui n'ont pas été importées",
					columns: { line: "Ligne", input: "Ce que vous avez collé", reason: "Pourquoi" },
				},
				reasons: {
					invalidUrl: "Pas une URL que nous pouvons vérifier.",
					duplicate: "Même adresse qu'une ligne précédente.",
					tooLong: "Trop longue pour être une URL.",
				},
			},
		},

		httpMonitors: {
			header: {
				title: "Moniteurs HTTP",
				action: {
					create: "Créer un Moniteur",
					import: "Importer",
				},
			},
			empty: {
				title: "Pas encore de moniteurs HTTP",
				description: "Créez un moniteur HTTP pour commencer à suivre vos endpoints.",
				cta: "Créer un Moniteur",
			},
			table: {
				label: "Moniteurs HTTP",
				columns: {
					name: "Nom",
					url: "URL",
					status: "Statut",
					responseTime: "Temps de Réponse",
					lastChecked: "Dernière Vérification",
					actions: "Actions",
				},
				neverChecked: "Jamais",
				disabled: "Désactivé",
				actions: {
					menu: "Menu Actions",
					view: "Voir",
					edit: "Modifier",
					delete: "Supprimer",
				},
				status: {
					up: "Actif",
					down: "Hors Service",
					degraded: "Dégradé",
					unknown: "Inconnu",
				},
				confirmation: {
					delete: "Êtes-vous sûr de vouloir supprimer le moniteur {{name}} ?",
					deleteDescription:
						"Cela supprime également ses vérifications de contenu et son historique de résultats. Cette action est irréversible.",
				},
			},
		},

		dnsMonitors: {
			header: {
				title: "Moniteurs DNS",

				action: {
					create: "Créer un moniteur DNS",
				},
			},

			empty: {
				title: "Pas encore de moniteurs DNS",
				description: "Créez un moniteur DNS pour suivre les changements d'enregistrements DNS.",
				cta: "Créer un moniteur DNS",
			},

			table: {
				label: "Moniteurs DNS",

				columns: {
					name: "Nom",
					domain: "Domaine",
					recordType: "Type",
					status: "Statut",
					lastChecked: "Dernière vérification",
					actions: "Actions",
				},

				disabled: "Désactivé",
				neverChecked: "Jamais",
				notChecked: "Non vérifié",

				actions: {
					menu: "Menu d'actions",
					check: "Vérifier maintenant",
					edit: "Modifier",
					delete: "Supprimer",
				},

				confirmation: {
					delete: "Êtes-vous sûr de vouloir supprimer le moniteur DNS {{name}} ?",
				},
			},
		},

		createDnsMonitor: {
			header: {
				title: "Créer un moniteur DNS",
			},

			form: {
				sections: {
					basics: {
						title: "Informations de base",
						description: "Ce que ce moniteur surveille.",
					},
					checks: {
						title: "Paramètres de vérification",
						description:
							"Quel enregistrement est résolu, ce qu'il doit renvoyer et à quelle fréquence la vérification s'exécute.",
					},
				},

				fields: {
					name: {
						label: "Nom du moniteur",
						placeholder: "DNS de production",
						description: "Un nom descriptif pour ce moniteur DNS.",
					},

					domain: {
						label: "Domaine",
						placeholder: "example.com",
						description: "Le domaine pour lequel surveiller les enregistrements DNS.",
					},

					recordType: {
						label: "Type d'enregistrement",
						description: "Le type d'enregistrement DNS à vérifier.",
					},

					expectedValue: {
						label: "Valeur attendue",
						placeholder: "aspmx.l.google.com, alt1.aspmx.l.google.com",
						description:
							"Facultatif. Alerte si l'une de ces valeurs est absente des enregistrements résolus. Séparez plusieurs valeurs par des virgules. Les enregistrements supplémentaires sont autorisés. Laissez vide pour suivre tout changement.",
					},

					interval: {
						label: "Intervalle de vérification",
						description: "À quelle fréquence vérifier l'enregistrement DNS.",
						options: {
							"5m": "5 minutes",
							"15m": "15 minutes",
							"30m": "30 minutes",
							"1h": "1 heure",
							"6h": "6 heures",
							"12h": "12 heures",
							"24h": "24 heures",
						},
					},

					isEnabled: {
						label: "Activer la surveillance",
						description: "Commencer à surveiller cet enregistrement DNS immédiatement.",
					},
				},

				cta: "Créer un moniteur DNS",
			},
		},

		editDnsMonitor: {
			header: {
				title: "Modifier le moniteur DNS",
			},

			form: {
				sections: {
					basics: {
						title: "Informations de base",
						description: "Ce que ce moniteur surveille et à quelle fréquence il vérifie.",
					},
				},

				fields: {
					name: {
						label: "Nom du moniteur",
						placeholder: "DNS de production",
						description: "Un nom descriptif pour ce moniteur DNS.",
					},

					domain: {
						label: "Domaine",
						placeholder: "example.com",
						description: "Le domaine pour lequel surveiller les enregistrements DNS.",
					},

					recordType: {
						label: "Type d'enregistrement",
						description: "Le type d'enregistrement DNS à vérifier.",
					},

					expectedValue: {
						label: "Valeur attendue",
						placeholder: "aspmx.l.google.com, alt1.aspmx.l.google.com",
						description:
							"Facultatif. Alerte si l'une de ces valeurs est absente des enregistrements résolus. Séparez plusieurs valeurs par des virgules. Les enregistrements supplémentaires sont autorisés. Laissez vide pour suivre tout changement.",
					},

					interval: {
						label: "Intervalle de vérification",
						description: "À quelle fréquence vérifier l'enregistrement DNS.",
						options: {
							"5m": "5 minutes",
							"15m": "15 minutes",
							"30m": "30 minutes",
							"1h": "1 heure",
							"6h": "6 heures",
							"12h": "12 heures",
							"24h": "24 heures",
						},
					},

					isEnabled: {
						label: "Activer la surveillance",
						description: "Surveiller activement cet enregistrement DNS ou non.",
					},
				},

				cancel: "Annuler",
				cta: "Enregistrer les modifications",
			},

			dangerZone: {
				title: "Zone de danger",
				deleteMonitor: "Supprimer le moniteur",
				deleteDescription:
					"Cela supprime également son historique de résultats de vérification. Cette action est irréversible.",
				description: "Les actions de cette section sont irréversibles.",
				warning:
					"Supprimer ce moniteur efface définitivement ses vérifications DNS, son historique et ses alertes.",
			},
		},

		dnsMonitorDetail: {
			header: {
				title: 'Moniteur DNS "{{name}}"',

				action: {
					check: "Vérifier maintenant",
					refresh: "Actualiser",
					edit: "Modifier",
				},
			},

			uptimeHistory: "Historique de disponibilité",
			notChecked: "Non vérifié",

			info: {
				domain: "Domaine",
				recordType: "Type d'enregistrement",
				status: "Statut",
				expectedValue: "Valeur attendue",
				currentValue: "Valeur actuelle",
			},

			stats: {
				totalChecks: {
					label: "Total des vérifications",
					description: "Nombre de vérifications DNS effectuées",
				},

				successRate: {
					label: "Taux de réussite",
					description: "Pourcentage de vérifications réussies",
				},

				avgResponseTime: {
					label: "Temps de réponse moy.",
					description: "Temps moyen de résolution DNS",
				},
			},

			results: {
				title: "Historique des vérifications",
				empty: "Aucune vérification n'a encore été effectuée.",

				table: {
					columns: {
						checkedAt: "Vérifié le",
						status: "Statut",
						value: "Valeur",
						responseTime: "Temps de réponse",
					},
				},
			},
		},

		maintenance: {
			header: {
				title: "Fenêtres de maintenance",

				action: {
					create: "Planifier une maintenance",
				},
			},

			empty: {
				title: "Pas de fenêtres de maintenance",
				description:
					"Planifiez des fenêtres de maintenance pour supprimer les alertes pendant les temps d'arrêt planifiés.",
				cta: "Planifier une maintenance",
			},

			tabs: {
				label: "Statut de maintenance",
				active: "Active",
				upcoming: "À venir",
				past: "Passée",
			},

			noActive: "Pas de fenêtres de maintenance actives",
			noUpcoming: "Pas de fenêtres de maintenance à venir",
			noPast: "Pas de fenêtres de maintenance passées",

			table: {
				columns: {
					name: "Nom",
					schedule: "Planification",
					monitor: "Moniteur",
					status: "Statut",
					actions: "Actions",
					scope: "Portée",
					starts: "Début",
					ends: "Fin",
				},

				allMonitors: "Tous les moniteurs",
				recurring: "Récurrente",
				unknownMonitor: "Moniteur inconnu",
				endedEarly: "Terminée plus tôt",
				edit: "Modifier",

				status: {
					active: "Active",
					upcoming: "Planifiée",
					past: "Terminée",
				},

				actions: {
					menu: "Menu d'actions",
					end: "Terminer maintenant",
					delete: "Supprimer",
				},

				confirmation: {
					endMaintenance: "Êtes-vous sûr de vouloir terminer la maintenance '{{name}}' plus tôt ?",
					deleteMaintenance: "Êtes-vous sûr de vouloir supprimer '{{name}}' ?",
				},
			},
		},

		createMaintenance: {
			header: {
				title: "Planifier une maintenance",
			},

			form: {
				sections: {
					coverage: {
						title: "Couverture",
						description:
							"Nommez cette fenêtre et choisissez les moniteurs auxquels elle s'applique.",
					},
					schedule: {
						title: "Planification",
						description: "Quand la fenêtre de maintenance commence et se termine.",
					},
					behavior: {
						title: "Comportement",
						description: "Ce qui se passe pendant que la fenêtre est active, et si elle se répète.",
					},
				},

				fields: {
					name: {
						label: "Nom",
						placeholder: "Mise à niveau de la base de données",
						description: "Une description du travail de maintenance.",
					},

					monitor: {
						label: "Moniteur",
						description:
							"Sélectionnez un moniteur spécifique ou laissez vide pour tous les moniteurs.",
						all: "Tous les moniteurs",
					},

					startsAt: {
						label: "Heure de début",
						description: "Quand la fenêtre de maintenance commence.",
					},

					duration: {
						label: "Durée",
						description: "Combien de temps dure la fenêtre de maintenance.",
						options: {
							"15m": "15 minutes",
							"30m": "30 minutes",
							"1h": "1 heure",
							"2h": "2 heures",
							"4h": "4 heures",
							"8h": "8 heures",
						},
					},

					suppressAlerts: {
						label: "Supprimer les alertes",
						description: "Ne pas envoyer d'alertes pendant cette fenêtre de maintenance.",
					},

					showOnStatusPage: {
						label: "Afficher sur la page de statut",
						description: "Afficher un avis de maintenance sur les pages de statut publiques.",
					},

					isRecurring: {
						label: "Récurrente",
						description: "Répéter cette fenêtre de maintenance selon un calendrier.",
					},

					recurringPattern: {
						label: "Modèle de récurrence",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"Format du modèle : 'daily:HH:MM-HH:MM', 'weekly:jourDeLaSemaine:HH:MM-HH:MM', ou 'monthly:jourDuMois:HH:MM-HH:MM'",
					},
				},

				preview: {
					label: "Fenêtre de maintenance",
				},

				cta: "Planifier la maintenance",
			},
		},

		editMaintenance: {
			header: {
				title: "Modifier {{name}}",
			},

			form: {
				cta: "Enregistrer les modifications",
				cancel: "Annuler",
				sections: {
					coverage: {
						title: "Ce qu'elle couvre",
						description:
							"Nommez cette fenêtre et choisissez les moniteurs auxquels elle s'applique.",
					},
					schedule: {
						title: "Planification",
						description: "Quand la fenêtre de maintenance commence et se termine.",
					},
					behavior: {
						title: "Pendant la maintenance",
						description:
							"Le comportement des alertes et de votre page de statut pendant la fenêtre.",
					},
					recurrence: {
						title: "Récurrence",
						description:
							"Répétez cette fenêtre selon une planification au lieu de l'exécuter une seule fois.",
					},
				},
			},

			endNow: {
				cta: "Terminer la maintenance maintenant",
				title: "Terminer cette fenêtre",
				description: "Cette fenêtre est active en ce moment.",
				warning:
					"La terminer maintenant rétablit les alertes et retire l'avis de maintenance de votre page de statut. La fenêtre elle-même est conservée.",
			},

			danger: {
				title: "Zone de danger",

				description: "Actions irréversibles pour cette fenêtre de maintenance.",
				warning: "La suppression de cette fenêtre de maintenance est irréversible.",
				delete: {
					trigger: "Supprimer la fenêtre de maintenance",
					confirmTitle: "Supprimer cette fenêtre de maintenance ?",
					confirmDescription: "Cette action est irréversible.",
					confirm: "Supprimer",
				},
			},
		},

		maintenanceWindows: {
			form: {
				fields: {
					name: {
						label: "Nom",
					},

					scope: {
						label: "Portée",
						allMonitors: "Tous les moniteurs",
					},

					startsAt: {
						label: "Début",
					},

					endsAt: {
						label: "Fin",
					},

					suppressAlerts: {
						label: "Suspendre les alertes pendant cette fenêtre",
					},

					showOnStatusPage: {
						label: "Afficher sur la page de statut",
					},

					recurring: {
						label: "Récurrente",
					},

					recurringPattern: {
						label: "Modèle de récurrence (si récurrente)",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"daily:HH:MM-HH:MM, weekly:<jour>:HH:MM-HH:MM, ou monthly:<jour-du-mois>:HH:MM-HH:MM, en UTC.",
					},
				},
			},
		},

		alertHistory: {
			header: {
				title: "Historique des alertes",
			},

			breadcrumbs: {
				alerts: "Alertes",
			},

			empty: {
				title: "Pas encore d'événements d'alerte",
				description:
					"Les événements d'alerte apparaîtront ici lorsque les moniteurs déclencheront des alertes. Configurez des alertes pour commencer.",
				cta: "Voir les alertes",
			},

			table: {
				label: "Événements d'alerte",

				columns: {
					alert: "Alerte",
					monitor: "Moniteur",
					eventType: "Événement",
					status: "Statut",
					sentAt: "Heure",
				},

				unknownAlert: "Alerte inconnue",
				unknownMonitor: "Moniteur inconnu",

				eventType: {
					down: "Hors ligne",
					up: "Rétabli",
					degraded: "Dégradé",
				},

				status: {
					sent: "Envoyé",
					skipped_cooldown: "Ignoré (Délai)",
					skipped_cap: "Ignoré (Limite de répétitions)",
					skipped: "Ignoré",
					failed: "Échoué",
				},
			},
		},

		createAlert: {
			header: {
				title: "Créer une alerte",
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			form: {
				sections: {
					basics: {
						title: "Informations de base",
						description: "Le nom de cette alerte et les moniteurs qu'elle surveille.",
					},
					channel: {
						title: "Canal de notification",
						description:
							"Où la notification est envoyée. Seuls les champs du canal choisi sont obligatoires.",
					},
					delivery: {
						title: "Règles d'envoi",
						description:
							"Si les rétablissements sont annoncés, et à quelle fréquence un rappel est envoyé tant qu'un moniteur reste hors ligne.",
					},
				},

				fields: {
					name: {
						label: "Nom",
						placeholder: "Alerte CTO",
						description: "Un nom pour identifier l'alerte.",
					},

					strategy: {
						label: "Stratégie",
						description: "La stratégie à utiliser pour l'alerte.",
						options: {
							webhook: "Webhook",
							email: "E-mail",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "URL du webhook",
								placeholder: "https://example.com/webhook",
								description: "L'URL vers laquelle envoyer la charge utile de l'alerte.",
							},
							secret: {
								label: "Secret",
								placeholder: "secret-optionnel",
								description:
									"Un secret optionnel à inclure dans les en-têtes de la requête. Un en-tête `Webhook-Signature` sera ajouté avec une signature HMAC SHA256 de la charge utile utilisant ce secret.",
							},
						},
						email: {
							to: {
								label: "Adresse e-mail",
								placeholder: "cto@example.com",
								description: "L'adresse e-mail à laquelle envoyer l'alerte.",
							},

							subjectPrefix: {
								label: "Préfixe du sujet",
								placeholder: "[Alerte Uptime]",
								description:
									"Un préfixe optionnel à ajouter au sujet de l'e-mail. Utile pour filtrer les alertes dans votre boîte de réception.",
							},
						},
						slack: {
							webhookUrl: {
								label: "URL du webhook Slack",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"L'URL du webhook entrant Slack. Créez-en un sur api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Canal personnalisé",
								placeholder: "#alertes",
								description:
									"Canal optionnel où publier au lieu de la valeur par défaut du webhook. Incluez le préfixe #.",
							},
						},
						discord: {
							webhookUrl: {
								label: "URL du webhook Discord",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"L'URL du webhook Discord. Créez-en un dans Paramètres du serveur > Intégrations > Webhooks.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Notifier lors de la récupération",
						description:
							"Envoyer une alerte lorsque le moniteur se rétablit d'un état hors ligne. Inclut le temps de récupération et la durée de l'indisponibilité.",
					},

					cooldown: {
						label: "Délai de récupération des alertes",
						description:
							"Temps minimum entre les alertes du même type. Évite la fatigue des alertes lors de pannes prolongées.",
						options: {
							none: "Pas de délai",
							"5min": "5 minutes",
							"15min": "15 minutes",
							"30min": "30 minutes",
							"1hour": "1 heure",
							"2hours": "2 heures",
							custom: "Personnalisé",
						},
						custom: {
							label: "Délai personnalisé (minutes)",
							placeholder: "Entrez les minutes",
							description: "Entrez le nombre de minutes entre les alertes.",
						},
					},
				},

				cta: "Créer une alerte",
			},
		},

		editAlert: {
			header: {
				title: "Modifier l'alerte",
			},

			form: {
				cta: "Enregistrer les modifications",
				cancel: "Annuler",
				sections: {
					basics: {
						title: "Ce qu'elle surveille",
						description:
							"Nommez cette alerte et choisissez si elle couvre tous les moniteurs ou un seul.",
					},
					channel: {
						title: "Comment elle notifie",
						description: "Choisissez un canal et renseignez la destination vers laquelle envoyer.",
					},
					delivery: {
						title: "Règles d'envoi",
						description:
							"Contrôlez les avis de rétablissement et la fréquence à laquelle une alerte peut se répéter pendant une panne.",
					},
				},
			},

			danger: {
				title: "Zone de danger",

				description: "Actions irréversibles pour cette alerte.",
				warning:
					"Supprimer cette alerte arrête toutes les notifications qu'elle envoie. Cette action est irréversible.",
				delete: {
					trigger: "Supprimer l'alerte",
					confirmTitle: "Supprimer cette alerte ?",
					confirmDescription: "Cette action est irréversible.",
					confirm: "Supprimer",
				},
			},
		},

		logout: {
			title: "Êtes-vous sûr de vouloir vous déconnecter ?",
			cta: "Déconnexion",
		},

		trial: {
			/**
			 * Le rapport comme page à part entière, accessible par le jeton de la surveillance. Chaque
			 * chiffre est calculé depuis les vérifications enregistrées : chacun a donc une formulation
			 * « rien à signaler pour l'instant » à côté de lui. Une surveillance sans vérification
			 * terminée affiche un tiret et dit pourquoi, et ne prétend jamais « aucun incident »,
			 * puisque personne n'a encore regardé.
			 */
			report: {
				meta: {
					title: "Votre rapport de santé sur {{days}} jours — Uptime",
					description:
						"La disponibilité, les vérifications et les incidents que nous avons enregistrés pour votre site pendant sa semaine de surveillance gratuite.",
				},
				eyebrow: "Rapport de santé sur {{days}} jours",
				period: "Surveillé du {{start}} au {{end}} ({{zone}})",
				bar: {
					caption: "Un bloc par jour sur {{days}} jours, du plus ancien au plus récent.",
					status: {
						up: "En ligne toute la journée",
						degraded: "Lent au moins une fois",
						down: "Hors ligne au moins une fois",
						noData: "Aucune vérification ce jour-là",
					},
				},
				summary: {
					title: "Ce que nous avons enregistré",
					uptime: "Disponibilité",
					checks: "Vérifications effectuées",
					healthy: "Vérifications entièrement saines",
					noChecks:
						"Aucune vérification n'est encore terminée, il n'y a donc rien à signaler sur cette URL. La première vérification horaire s'exécute une heure après le début de la surveillance.",
				},
				incidents: {
					title: "Incidents",
					unknown:
						"Aucune vérification n'est encore terminée, nous ne pouvons donc pas dire si cette URL a connu un incident.",
					none_one: "Aucun incident : la seule vérification terminée a répondu comme prévu.",
					none_other:
						"Aucun incident : les {{count}} vérifications terminées ont toutes répondu comme prévu.",
					summary_one: "Un incident.",
					summary_other: "{{count}} incidents.",
					entry_one: "Première panne vue le {{started}} — une vérification a échoué.",
					entry_other:
						"Première panne vue le {{started}} — {{count}} vérifications d'affilée ont échoué.",
				},
				timing: {
					title: "Temps de réponse",
					fastest: "Le plus rapide",
					average: "Moyenne",
					slowest: "Le plus lent",
					basis_one: "Mesuré sur la seule vérification qui a répondu.",
					basis_other: "Mesuré sur les {{count}} vérifications qui ont répondu.",
				},
				cta: {
					title: "Continuez à surveiller ce site pour {{price}}/mois",
					action: "Lancer la surveillance",
					convertible: {
						body: "Connectez-vous et nous transformerons cette URL en véritable moniteur, en reprenant l'historique ci-dessus.",
					},
					expired: {
						body: "Cette semaine gratuite a dépassé son délai de récupération : l'historique ci-dessus reste ici — mais vous pouvez surveiller cette URL pour de bon quand vous voulez.",
					},
					converted: {
						title: "Cette URL est déjà surveillée",
						body: "Vous avez transformé cette cible en moniteur : elle est maintenant vérifiée à la fréquence que vous avez choisie.",
						action: "Ouvrir votre tableau de bord",
					},
				},
			},

			meta: {
				title: "Rapport de santé gratuit sur {{days}} jours pour votre site — Uptime",
				description:
					"Nous vérifions votre site tout de suite, puis chaque heure pendant {{days}} jours, et nous vous envoyons par email ce que nous avons trouvé. Sans compte, sans carte.",
			},

			heading: "Un rapport de santé gratuit sur {{days}} jours pour votre site",
			intro:
				"Donnez-nous une URL et nous la vérifions tout de suite depuis notre réseau — le même test qu'un moniteur payant. Laissez ensuite un email et nous continuons à la vérifier chaque heure pendant {{days}} jours, puis nous vous envoyons le rapport.",

			form: {
				url: {
					label: "URL à vérifier",
					description: "Une adresse http:// ou https:// sur l'internet public.",
					placeholder: "https://exemple.com",
				},
				submit: "Lancer le premier test",
			},

			refusal: {
				title: "Le test n'a pas été lancé",
				blockedTarget:
					"Ce n'est pas une adresse que nous testerons pour vous. Il faut une URL http:// ou https:// publique, sur le port 80 ou 443, sans identifiant ni mot de passe, et qui résout vers l'internet ouvert.",
				challengeIncomplete: "Complétez la vérification et nous pourrons lancer le test.",
				failedChallenge:
					"Nous n'avons pas pu confirmer que la requête venait d'un navigateur. Rechargez la page et réessayez.",
				rateLimited: "Vous pouvez lancer une autre vérification dans une minute.",
				rateLimitedFor: "Vous pouvez lancer une autre vérification dans {{seconds}} secondes.",
				budgetExhausted:
					"Nous avons déjà effectué tous les tests gratuits que nous faisons en une journée. Cela vient de nous, pas de votre URL — revenez demain, ou lancez la surveillance et nous la testerons chaque minute.",
				unavailable:
					"Quelque chose de notre côté a empêché le test de se lancer, nous n'avons donc rien appris sur votre URL. Cela vient de chez nous, pas de chez vous. Réessayez dans un instant.",
			},

			result: {
				checkAnother: "Vérifier une autre URL",
				noResponse: "Aucune réponse",
				httpStatus: "HTTP {{status}}",
				milliseconds: "{{value}} ms",
				checkedAt: "Testé le {{time}}",

				redirect: {
					badge: "Redirige",
					title: "Cette URL redirige ailleurs",
					description:
						"Elle a répondu, et sa réponse nous renvoyait vers une autre adresse. Nous n'y sommes pas allés : nous ne testons que l'URL que vous nous avez donnée, et c'est ce qui empêche ce champ de servir à atteindre des endroits qu'il ne devrait pas. Testez plutôt la destination et vous en aurez un vrai résultat.",
					destination: "Elle pointe vers {{url}}",
					action: "Tester celle-là",
					unknownDestination:
						"Nous n'avons pas lu où elle pointe. Ouvrez l'URL dans un navigateur, regardez où vous arrivez, et testez cette adresse ici.",
				},

				status: {
					up: "En ligne",
					degraded: "Lent",
					down: "Hors ligne",
				},
			},

			lead: {
				title: "Recevez le rapport gratuit sur {{days}} jours",
				description:
					"Le test que vous venez de voir était le premier. Laissez un email et nous continuons, puis nous vous dirons ce que {{days}} jours de vérifications ont trouvé.",
				consent: "Écrivez-moi aussi de temps en temps à propos d'Uptime.",
				consentNote: "Dans tous les cas vous recevez les tests.",
				promise:
					"Chaque email contient un lien qui les arrête en un clic et supprime votre adresse.",
				submit: "Lancer le rapport gratuit sur {{days}} jours",

				/**
				 * Ce à quoi un visiteur consent, indiqué à côté du champ plutôt qu'après. Chaque ligne
				 * correspond à quelque chose que le système fait réellement — l'adresse est celle que
				 * nous venons de sonder et pas une qu'il peut retaper, la fréquence et la durée sont
				 * celles de la surveillance, et les trois emails cités sont les trois qui existent.
				 */
				expectations: {
					target:
						"Nous continuons à vérifier {{url}} — l'adresse exacte que nous venons de tester, et rien d'autre.",
					cadence: "Une fois par heure, chaque heure, pendant {{days}} jours.",
					emails:
						"Un récapitulatif par jour, un message quand le statut change, et le rapport complet à la fin.",
					noAccount: "Ni carte, ni mot de passe, ni compte à créer.",
				},

				email: {
					label: "Email",
					placeholder: "vous@exemple.com",
					error: "Cela ne ressemble pas à une adresse email.",
				},
			},

			monitor: {
				title: "Continuer à surveiller cette URL",
				description:
					"Transformez ce test unique en moniteur : le même test à la fréquence de votre choix, avec une alerte dès que quelque chose change.",
				subscribeDescription:
					"Transformez ce test unique en moniteur : le même test à la fréquence de votre choix, avec une alerte dès que quelque chose change. Il démarrera dès que votre abonnement sera actif.",
				create: "Créer un moniteur pour cette URL",
				subscribe: "Démarrer votre abonnement",
			},

			watching: {
				title: "C'est parti",
				description:
					"Le premier test horaire de {{url}} sera lancé dans une heure, et nous continuons à vérifier pendant {{days}} jours. Une copie du test que vous venez de faire est déjà dans votre boîte.",
			},

			repeated: {
				title: "Nous avons déjà vérifié celle-ci",
				description:
					"{{url}} a déjà eu sa semaine gratuite lors d'une demande précédente : chaque URL en a une tous les 30 jours. Nous vous avons envoyé par e-mail tout ce que ces vérifications ont trouvé, donc rien de nouveau n'a été lancé.",
			},

			benefits: {
				title: "Ce que couvre le rapport",
				description:
					"Tout ce qu'un moniteur payant vous dirait de cette URL, gratuitement, pendant {{days}} jours.",

				list: {
					hourly: {
						title: "Un test toutes les heures",
						description:
							"Pendant {{days}} jours, depuis le réseau qui fait tourner les moniteurs payants.",
					},
					changes: {
						title: "Un email quand ça change",
						description:
							"En ligne ou hors ligne, vous êtes prévenu. Un par jour au maximum, pour qu'un site instable ne vous submerge pas.",
					},
					digest: {
						title: "Un récapitulatif par jour",
						description:
							"Comment votre URL a tenu, en un coup d'œil — et les {{days}} jours entiers dans un seul rapport à la fin.",
					},
					noAccount: {
						title: "Ni compte ni carte",
						description: "Rien à créer, et un clic arrête tout définitivement.",
					},
				},
			},

			more: {
				title: "Pas seulement des sites web",
				description:
					"Le rapport gratuit couvre le HTTP. Un compte payant garde un œil sur trois choses de plus.",

				list: {
					tcp: {
						title: "TCP",
						description:
							"Savoir qu'un port répond toujours, pour tout ce qui n'est pas un site : bases de données, serveurs mail, serveurs de jeu.",
					},
					dns: {
						title: "DNS",
						description:
							"Savoir qu'un enregistrement pointe toujours au bon endroit, pour qu'un détournement ou une modification ratée ne passe pas inaperçu.",
					},
					cron: {
						title: "Tâches planifiées",
						description:
							"Savoir que votre sauvegarde de nuit s'est terminée, et l'apprendre la nuit où ce n'est pas le cas.",
					},
				},
			},

			cta: {
				badge: "Quand le rapport se termine",
				title: "Continuez à surveiller ce site pour {{price}} par mois",
				description:
					"Vous inscrire transforme cette URL en véritable moniteur et reprend son historique de vérifications, donc rien ne repart de zéro. Un test chaque minute au lieu de chaque heure, autant d'URL que vous voulez, des alertes là où vous travaillez déjà, des pages de statut et un an d'historique.",
				action: "Continuer à surveiller ce site",
				pricing: "Voir les tarifs",
			},
		},

		unsubscribe: {
			confirm: {
				title: "Arrêter ces emails ?",
				body: "Cela met fin à tous les tests demandés par cette adresse et supprime l'adresse ainsi que tout ce qui y est rattaché. Rien n'est conservé, il n'y a donc rien à annuler — mais vous pouvez recommencer depuis notre site quand vous voulez.",
				cta: "Oui, arrêter et supprimer",
			},

			done: {
				title: "Vous êtes désabonné",
				body: "Cette adresse ne figure plus sur notre liste et les tests qu'elle avait demandés sont arrêtés. Plus rien ne lui sera envoyé. Vous pouvez recommencer depuis notre site quand vous voulez.",
				cta: "Retour au site",
			},
		},
		splat: {
			notFound: {
				title: "Non trouvé",
				description: "La page que vous recherchez n'existe pas.",
			},
		},

		account: {
			meta: {
				title: "Compte - Uptime",
				description: "Gérez les paramètres de votre compte et vos équipes.",
			},

			header: {
				title: "Compte",
			},

			form: {
				actions: {
					cancel: "Annuler",
				},
			},

			profile: {
				title: "Profil",
				description: "Vos informations personnelles.",

				card: {
					title: "Détails du profil",
					description: "Votre nom, votre adresse e-mail et votre avatar.",
				},
			},

			language: {
				title: "Préférence de langue",
				description: "Choisissez votre langue préférée pour l'interface.",

				card: {
					title: "Langue",
					description: "S'applique au tableau de bord et aux notifications par e-mail.",
				},

				form: {
					fields: {
						language: {
							label: "Langue préférée",
							description:
								"Sélectionnez votre langue préférée. La détection automatique utilise les paramètres de votre navigateur.",
							options: {
								auto: "Détection automatique",
								en: "English",
								es: "Español",
								de: "Deutsch",
								ja: "Japanese",
								fr: "Français",
								it: "Italiano",
							},
						},
					},

					cta: "Enregistrer la langue",
				},
			},

			emails: {
				title: "E-mails",
				description: "Choisissez les e-mails que nous vous envoyons.",

				card: {
					title: "Notifications par e-mail",
					description:
						"S'appliquent à toutes les équipes dont vous êtes membre. Les alertes et les invitations ne sont pas concernées.",
				},

				list: {
					teamDailyDigest: {
						name: "Rapport quotidien des moniteurs",
						description:
							"Chaque matin, un e-mail par équipe avec l'état de chacun de ses moniteurs sur la journée précédente.",
					},
					teamWeeklyDigest: {
						name: "Rapport hebdomadaire des moniteurs",
						description:
							"Le lundi, le même rapport sur les sept derniers jours, avec la disponibilité de la semaine jour par jour.",
					},
				},

				form: {
					cta: "Enregistrer les e-mails",
				},
			},

			dataExport: {
				title: "Vos données",
				description: "Téléchargez tout ce que cette application détient à votre sujet.",

				card: {
					title: "Exporter vos données",
					description:
						"Un seul fichier JSON, généré au moment où vous le demandez. Rien n'est stocké.",
					includes:
						"Comprend votre profil et vos préférences, chaque équipe dont vous êtes membre et le rôle que vous y avez, et — pour les équipes dont vous êtes propriétaire — leurs moniteurs, alertes, fenêtres de maintenance, pages de statut et domaines vérifiés.",
					excludes:
						"Exclut tout ce qui ne vous appartient pas : les informations des autres membres, les adresses des personnes invitées, les empreintes des clés d'API, les secrets de webhook et les URL de webhook Slack ou Discord. L'historique des vérifications est également laissé de côté — il est produit par la configuration ci-dessus, et le fichier le précise.",
				},

				form: {
					cta: "Télécharger le JSON",
				},
			},

			deleteAccount: {
				title: "Supprimer le compte",
				description: "Fermez votre compte et supprimez les données qui s'y rattachent.",

				queued: {
					title: "Suppression demandée",
					description:
						"Votre compte est en file d'attente pour suppression et rien n'a encore été supprimé. L'opération s'exécute dans la journée, et nous vous enverrons un e-mail dès que ce sera fait. Vous pouvez encore l'arrêter : annulez ci-dessous à tout moment avant son exécution.",
					requestedAt: "Demandé le {{date}}.",
					cta: "Annuler la suppression",
				},

				card: {
					title: "Supprimer votre compte",
					description:
						"Met votre compte en file d'attente pour suppression. Rien n'est supprimé lorsque vous envoyez ce formulaire.",

					whatHappens:
						"Votre demande est mise en file d'attente et vous êtes déconnecté. Dans la journée, nous annulons votre abonnement, supprimons vos données et vous envoyons un e-mail pour confirmer que c'est fait. Jusque-là, rien n'a disparu, et il vous suffit de vous reconnecter pour annuler.",

					noOwnedTeams:
						"Vous n'êtes propriétaire d'aucune équipe : seules vos propres adhésions et préférences seront supprimées. Les équipes dont vous êtes membre continuent sans vous.",

					ownedTeamsIntro:
						"Il n'existe aucun moyen de confier une équipe à quelqu'un d'autre dans cette application : chaque équipe dont vous êtes propriétaire est donc supprimée avec votre compte, ainsi que ses moniteurs, alertes, pages de statut, clés d'API et membres :",
					ownedTeam_one: "{{name}} — 1 autre membre perd son accès.",
					ownedTeam_other: "{{name}} — {{count}} autres membres perdent leur accès.",
					ownedTeamAlone: "{{name}} — aucun autre membre.",

					othersWarning_one:
						"1 autre personne perdra l'accès à une équipe lors de l'exécution. Elle ne sera ni consultée ni avertie.",
					othersWarning_other:
						"{{count}} autres personnes perdront l'accès à leurs équipes lors de l'exécution. Elles ne seront ni consultées ni averties.",

					retained: {
						intro: "Certains éléments ne peuvent pas être supprimés, et nous préférons le dire :",
						billing:
							"Les factures et les registres de paiement détenus par notre prestataire de facturation — la loi fiscale nous oblige à les conserver.",
						analytics:
							"Les résultats des vérifications de surveillance dans notre entrepôt analytique, qui fonctionne en ajout seul : les enregistrements expirent selon un calendrier de rétention et ne peuvent pas être supprimés plus tôt.",
						logs: "Les journaux de requêtes du serveur, qui expirent selon le même type de calendrier.",
						identity:
							"Votre identité de connexion, qui appartient au fournisseur d'identité avec lequel vous vous connectez, et non à nous.",
					},

					confirmation: {
						label: 'Tapez "DELETE" pour confirmer',
						placeholder: "DELETE",
					},

					cta: "Demander la suppression du compte",
				},
			},
		},

		createTeam: {
			header: {
				title: "Créer une équipe",
				description: "Créez une nouvelle équipe pour surveiller vos services.",
			},

			dialog: {
				close: "Fermer la boîte de dialogue",
			},

			form: {
				fields: {
					name: {
						label: "Nom de l'équipe",
						placeholder: "Mon équipe géniale",
						description: "Choisissez un nom pour votre nouvelle équipe.",
					},
				},

				cancel: "Annuler",
				cta: "Créer une équipe",
			},
		},

		settings: {
			header: {
				title: "Paramètres de l'équipe",
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			sections: {
				general: {
					title: "Général",
					description: "Gérez les informations de base de votre équipe.",
				},
			},

			form: {
				card: {
					title: "Profil de l'équipe",
					description: "Mettez à jour le nom et le logo de votre équipe.",
				},

				fields: {
					logo: {
						label: "URL du logo",
						placeholder: "https://example.com/logo.png",
						description: "Une URL vers l'image du logo de votre équipe.",
					},
					name: {
						label: "Nom de l'équipe",
						placeholder: "Mon équipe",
						description: "Le nom de votre équipe.",
					},
				},

				actions: {
					cancel: "Annuler",
					save: "Enregistrer les modifications",
				},
			},

			members: {
				title: "Membres",
				description: "Gérez les membres de votre équipe et leurs rôles.",

				actions: {
					invite: "Inviter un membre",
				},

				table: {
					label: "Membres actuels",
					description: "Personnes ayant accès à cette équipe.",

					columns: {
						name: "Nom",
						role: "Rôle",
						actions: "Actions",
					},

					role: {
						member: "Membre",
						admin: "Administrateur",
						owner: "Propriétaire",
					},

					actions: {
						menu: "Menu d'actions",
						remove: "Retirer de l'équipe",
						transfer: "Transférer la propriété",
						changeRole: {
							member: "Convertir en administrateur",
							admin: "Convertir en membre",
							owner: "Impossible de modifier le propriétaire",
						},
					},

					confirmation: {
						removeMember: "Êtes-vous sûr de vouloir retirer {{name}} de l'équipe ?",
					},
				},

				invitedTable: {
					label: "Invitations en attente",
					description: "Personnes invitées qui n'ont pas encore rejoint.",

					columns: {
						email: "E-mail",
						expires: "Expire",
						actions: "Actions",
					},

					expires: {
						expired: "Expirée",
					},

					actions: {
						menu: "Menu d'actions",
						copy: "Copier le lien d'invitation",
						revoke: "Révoquer l'invitation",
					},

					confirmation: {
						revokeInvite: "Êtes-vous sûr de vouloir révoquer l'invitation de {{email}} ?",
					},

					empty: {
						description: "Aucune invitation en attente.",
					},
				},
			},

			domains: {
				title: "Domaines",
				description: "Gérez les domaines vérifiés pour votre équipe.",

				actions: {
					addDomain: "Ajouter un domaine",
				},

				table: {
					label: "Domaines vérifiés",
					description:
						"Domaines pouvant être utilisés pour l'approvisionnement automatique des membres de l'équipe.",

					columns: {
						hostname: "Nom d'hôte",
						id: "ID de vérification",
						verifiedAt: "Vérifié le",
						actions: "Actions",
					},

					verifiedAt: {
						pending: "En attente de vérification",
					},

					actions: {
						menu: "Menu d'actions",
						copy: "Copier l'ID de vérification",
						remove: "Supprimer le domaine",
						retryVerification: "Réessayer la vérification",
					},

					confirmation: {
						removeDomain: "Êtes-vous sûr de vouloir supprimer {{hostname}} de l'équipe ?",
					},

					empty: {
						description: "Aucun domaine vérifié pour le moment.",
					},
				},

				form: {
					title: "Ajouter un domaine",

					fields: {
						hostname: {
							label: "Domaine",
							placeholder: "example.com",
							description: "Le domaine que vous souhaitez ajouter à {{team}}.",
						},
					},

					cta: "Ajouter un domaine",
				},

				instructions: {
					title: "Comment vérifier votre domaine",
					description:
						"Pour vérifier votre domaine, ajoutez l'enregistrement TXT suivant à vos paramètres DNS :",

					record: {
						name: {
							label: "Nom",
							value: "_ping-verification",
						},
						content: {
							label: "Contenu",
							value: "VERIFICATION_ID",
						},
					},

					note: "Assurez-vous de remplacer <code>VERIFICATION_ID</code> par l'ID de vérification réel affiché ci-dessus.",
					disclaimer:
						"Les modifications DNS peuvent prendre un certain temps à se propager, la vérification pourrait donc être retardée.",
				},
			},

			billing: {
				title: "Facturation",
				description: "Gérez votre abonnement et vos informations de paiement.",

				card: {
					title: "Abonnement et paiements",
					description:
						"Consultez les factures, mettez à jour les méthodes de paiement et gérez votre abonnement.",
					notice:
						"Vous serez redirigé vers le portail client de Polar pour gérer vos paramètres de facturation.",
					cta: "Ouvrir le portail de facturation",
				},
			},

			danger: {
				title: "Zone de danger",
				description: "Actions irréversibles qui affectent votre équipe.",

				card: {
					title: "Supprimer l'équipe",
					description:
						"Supprimer définitivement cette équipe et toutes ses données. Cette action est irréversible.",
					warning:
						"Cela annulera votre abonnement et supprimera tous les moniteurs, alertes, domaines, membres et invitations.",
					confirmation: {
						label: "Tapez DELETE pour confirmer",
						placeholder: "DELETE",
					},
					cta: "Supprimer l'équipe",
				},
			},

			error: {
				forbidden: {
					title: "Vous n'avez pas la permission d'accéder à cette page.",
					description:
						"Veuillez contacter l'administrateur de votre équipe pour obtenir de l'aide.",
				},

				unknown: {
					title: "Une erreur inattendue s'est produite.",
					description: "Veuillez réessayer plus tard ou contacter le support.",
				},
			},
		},

		tcpMonitors: {
			header: {
				title: "Moniteurs TCP",
				action: {
					create: "Créer un moniteur TCP",
				},
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
				limitation: {
					title: "Limitation de la surveillance TCP",
					description:
						"La surveillance des ports TCP nécessite un forfait payant Cloudflare Workers avec prise en charge des sockets. Avec le forfait gratuit, les vérifications TCP seront indisponibles. Envisagez d'utiliser la surveillance HTTP comme alternative.",
				},
			},

			empty: {
				title: "Pas encore de moniteurs TCP",
				description: "Créez un moniteur TCP pour vérifier si les ports sont ouverts et réactifs.",
				cta: "Créer un moniteur TCP",
			},

			table: {
				label: "Moniteurs TCP",
				columns: {
					name: "Nom",
					endpoint: "Hôte:Port",
					status: "Statut",
					lastChecked: "Dernière vérification",
					responseTime: "Temps de réponse",
					actions: "Actions",
				},
				status: {
					up: "En ligne",
					down: "Hors ligne",
					timeout: "Délai dépassé",
					disabled: "Désactivé",
					pending: "En attente",
				},
				actions: {
					edit: "Modifier",
					delete: "Supprimer",
					confirmation: {
						delete: "Êtes-vous sûr de vouloir supprimer {{name}} ?",
					},
				},
			},
		},

		createTcpMonitor: {
			header: {
				title: "Créer un moniteur TCP",
				breadcrumb: {
					tcpMonitors: "Moniteurs TCP",
				},
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			form: {
				sections: {
					basics: {
						title: "Informations de base",
						description: "Ce que ce moniteur surveille et à quelle fréquence il le vérifie.",
					},
				},

				fields: {
					name: {
						label: "Nom du moniteur",
						placeholder: "Serveur de base de données",
						description: "Un nom descriptif pour ce moniteur TCP.",
					},
					host: {
						label: "Hôte",
						placeholder: "db.example.com",
						description: "Le nom d'hôte ou l'adresse IP à surveiller.",
					},
					port: {
						label: "Port",
						placeholder: "5432",
						description: "Le port TCP à vérifier (1-65535).",
						decrement: "Diminuer le port",
						increment: "Augmenter le port",
					},
					interval: {
						label: "Intervalle de vérification",
						description: "À quelle fréquence vérifier le port.",
						decrement: "Diminuer l'intervalle de vérification",
						increment: "Augmenter l'intervalle de vérification",
					},
					timeout: {
						label: "Délai de connexion",
						description: "Combien de temps attendre une connexion avant d'expirer.",
						decrement: "Diminuer le délai de connexion",
						increment: "Augmenter le délai de connexion",
					},
				},
				cta: "Créer le moniteur",
			},
		},

		editTcpMonitor: {
			header: {
				title: "Modifier le moniteur TCP",
				breadcrumb: {
					tcpMonitors: "Moniteurs TCP",
				},
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			form: {
				sections: {
					settings: {
						title: "Paramètres du moniteur",
						description: "Ce à quoi ce moniteur se connecte et à quelle fréquence il vérifie.",
					},
				},

				fields: {
					name: {
						label: "Nom du moniteur",
						placeholder: "Serveur de base de données",
						description: "Un nom descriptif pour ce moniteur TCP.",
					},
					host: {
						label: "Hôte",
						placeholder: "db.example.com",
						description: "Le nom d'hôte ou l'adresse IP à surveiller.",
					},
					port: {
						label: "Port",
						placeholder: "5432",
						description: "Le port TCP à vérifier (1-65535).",
						decrement: "Diminuer le port",
						increment: "Augmenter le port",
					},
					interval: {
						label: "Intervalle de vérification",
						description: "À quelle fréquence vérifier le port.",
						decrement: "Diminuer l'intervalle de vérification",
						increment: "Augmenter l'intervalle de vérification",
					},
					timeout: {
						label: "Délai de connexion",
						description: "Combien de temps attendre une connexion avant d'expirer.",
						decrement: "Diminuer le délai de connexion",
						increment: "Augmenter le délai de connexion",
					},
					isEnabled: {
						label: "Activer la surveillance",
					},
				},
				cancel: "Annuler",
				cta: "Enregistrer les modifications",
			},

			danger: {
				title: "Zone de danger",
				cta: "Supprimer le moniteur",
				description:
					"Cela supprime également l'historique des résultats de vérification. Cette action est irréversible.",
				sectionDescription: "Les actions de cette section sont irréversibles.",
				warning:
					"Supprimer ce moniteur efface définitivement ses vérifications, son historique et ses alertes.",
			},
		},

		tcpMonitorDetail: {
			header: {
				breadcrumb: {
					tcpMonitors: "Moniteurs TCP",
				},
				action: {
					edit: "Modifier",
					checkNow: "Vérifier maintenant",
				},
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			info: {
				title: "Configuration du moniteur",
				endpoint: "Point de terminaison",
				status: "Statut",
				interval: "Intervalle de vérification",
				timeout: "Délai",
			},

			stats: {
				uptime: {
					label: "Uptime",
					description: "Basé sur les vérifications récentes",
				},
				avgResponseTime: {
					label: "Temps de réponse moy.",
					description: "Temps de connexion moyen",
				},
				totalChecks: {
					label: "Total des vérifications",
					description: "Nombre de vérifications effectuées",
				},
			},

			history: {
				title: "Historique de l'Uptime",
			},

			results: {
				title: "Historique des vérifications",
				description: "Résultats récents des vérifications de connexion TCP",
				label: "Résultats",
				empty:
					"Pas encore de résultats de vérification. Les résultats apparaîtront après la première vérification.",
				columns: {
					time: "Heure",
					status: "Statut",
					responseTime: "Temps de réponse",
					error: "Erreur",
				},
			},
		},

		apiKeys: {
			header: {
				title: "Clés API",
				action: {
					create: "Créer une clé API",
				},
			},

			docsLink: {
				text: "Découvrez comment utiliser les clés API dans notre",
				link: "documentation",
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			empty: {
				title: "Pas encore de clés API",
				description: "Créez une clé API pour accéder à l'API Uptime de manière programmatique.",
				cta: "Créer une clé API",
			},

			newKey: {
				title: "La clé API '{{name}}' a été créée !",
				description:
					"Copiez cette clé maintenant. Pour des raisons de sécurité, vous ne pourrez plus la voir.",
				dismiss: "J'ai copié ma clé",
				copyLabel: "Copier la clé",
			},

			form: {
				title: "Créer une nouvelle clé API",
				description: "Les clés API permettent un accès programmatique à vos moniteurs et alertes.",

				sections: {
					details: {
						title: "Détails de la clé",
						description:
							"Nommez la clé pour la reconnaître plus tard, et décidez quand elle doit cesser de fonctionner.",
					},
				},

				fields: {
					name: {
						label: "Nom de la clé",
						placeholder: "Clé API de production",
						description: "Un nom pour identifier cette clé API.",
					},
					scopes: {
						label: "Permissions",
						description: "Sélectionnez ce à quoi cette clé API peut accéder.",
						descriptions: {
							"teams:read":
								"Lire le nom et le logo de l'équipe, et lister ses membres avec leurs rôles.",
							"teams:write":
								"Modifier le nom et le logo de l'équipe. Ne permet ni d'ajouter ou retirer des membres, ni de supprimer l'équipe.",
							"invites:read":
								"Lister les invitations de l'équipe, en attente comme acceptées, y compris l'adresse e-mail destinataire de chacune.",
							"invites:write":
								"Inviter une adresse e-mail dans l'équipe et révoquer une invitation existante. Quiconque accepte une invitation devient membre.",
							"team-domains:read":
								"Lister les domaines revendiqués par l'équipe et l'état de vérification de chacun.",
							"team-domains:write":
								"Revendiquer un domaine pour l'équipe ou en retirer un. Une fois un domaine vérifié, toute personne qui s'inscrit avec une adresse e-mail de ce domaine rejoint automatiquement l'équipe.",
							"monitors:read":
								"Lire les moniteurs HTTP, leurs résultats de vérification, leurs statistiques de disponibilité et le statut global de l'équipe.",
							"monitors:write":
								"Créer, modifier et supprimer les moniteurs HTTP et leurs vérifications de contenu. Permet aussi de mettre en file une reconstruction des statistiques quotidiennes.",
							"maintenance:read": "Lister et lire les fenêtres de maintenance de l'équipe.",
							"maintenance:write":
								"Créer, modifier, terminer par anticipation et supprimer des fenêtres de maintenance. Une fenêtre en cours peut suspendre les alertes des moniteurs qu'elle couvre.",
							"dns-monitors:read":
								"Lister et lire les moniteurs DNS et les résultats de résolution qu'ils ont enregistrés.",
							"dns-monitors:write": "Créer, modifier et supprimer des moniteurs DNS.",
							"tcp-monitors:read":
								"Lister et lire les moniteurs TCP et les résultats de connexion qu'ils ont enregistrés.",
							"tcp-monitors:write": "Créer, modifier et supprimer des moniteurs TCP.",
							"alerts:read":
								"Lister et lire les alertes et les événements qu'elles ont déclenchés. Les URL de webhook et autres secrets de canal ne sont jamais renvoyés.",
							"alerts:write":
								"Créer, modifier et supprimer des alertes, y compris leurs destinations webhook et chat. Supprimer une alerte arrête toutes les notifications qu'elle envoyait.",
							"status-pages:read":
								"Lister et lire les pages de statut de l'équipe et les moniteurs rattachés à chacune.",
							"status-pages:write":
								"Créer, modifier et supprimer des pages de statut, et remplacer l'ensemble des moniteurs et tâches Cron qu'une page affiche publiquement.",
							"cron-jobs:read":
								"Lister et lire les tâches Cron de l'équipe et leurs planifications.",
							"cron-jobs:write":
								"Créer, modifier et supprimer des tâches Cron. En supprimer une fait cesser l'acceptation de son URL de ping.",
							"cron-jobs:ping":
								"Présente pour l'URL de ping des tâches Cron, qui est publique et ne vérifie aucune portée. L'accorder ne donne à une clé aucun accès qu'elle n'a déjà.",
							"api-keys:read":
								"Lister les clés API de l'équipe avec leur nom, préfixe, portées et expiration. La clé secrète elle-même n'est jamais renvoyée.",
							"api-keys:write":
								"Créer et supprimer les clés API de l'équipe. Une nouvelle clé peut recevoir n'importe quelle portée, donc celle-ci permet d'accorder toutes les autres.",
							"ping:trigger":
								"Exécuter des vérifications HTTP, DNS et TCP ponctuelles sans créer de moniteur. Chaque vérification est facturée comme un ping et nécessite un abonnement actif.",
						} satisfies Record<ApiKeyScope, string>,
					},
					expiresAt: {
						label: "Date d'expiration (optionnel)",
						description: "Laissez vide pour une clé qui n'expire jamais.",
					},
				},

				actions: {
					cancel: "Annuler",
					create: "Créer une clé API",
				},
			},

			table: {
				label: "Clés API",

				columns: {
					name: "Nom",
					prefix: "Clé",
					scopes: "Permissions",
					lastUsed: "Dernière utilisation",
					expires: "Expire",
					actions: "Actions",
				},

				lastUsed: {
					never: "Jamais",
				},

				expires: {
					never: "Jamais",
				},

				actions: {
					menu: "Menu d'actions",
					delete: "Supprimer la clé",
				},

				confirmation: {
					delete:
						"Êtes-vous sûr de vouloir supprimer la clé API '{{name}}' ? Cette action est irréversible.",
				},
			},

			error: {
				forbidden: {
					title: "Vous n'avez pas la permission d'accéder à cette page.",
					description:
						"Veuillez contacter l'administrateur de votre équipe pour obtenir de l'aide.",
				},

				unknown: {
					title: "Une erreur inattendue s'est produite.",
					description: "Veuillez réessayer plus tard ou contacter le support.",
				},
			},
		},

		cronJobs: {
			header: {
				title: "Cron Jobs",
				action: {
					create: "Créer un Cron Job",
				},
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			empty: {
				title: "Pas encore de cron jobs",
				description: "Créez un moniteur de cron job pour suivre vos tâches planifiées.",
				cta: "Créer un Cron Job",
			},

			table: {
				label: "Moniteurs Cron Job",
				columns: {
					name: "Nom",
					schedule: "Planification",
					status: "Statut",
					lastPing: "Dernier Ping",
					nextExpected: "Prochain Attendu",
					actions: "Actions",
				},
				status: {
					healthy: "Sain",
					late: "En retard",
					missed: "Manqué",
					new: "Nouveau",
				},
				disabled: "Désactivé",
				actions: {
					edit: "Modifier",
					delete: "Supprimer",
					confirmation: {
						delete: "Êtes-vous sûr de vouloir supprimer {{name}} ?",
					},
				},
			},
		},

		createCronJob: {
			header: {
				title: "Créer un Cron Job",
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			form: {
				sections: {
					basics: {
						title: "Informations de base",
						description: "Le nom de ce job et ce qu'il fait.",
					},
					schedule: {
						title: "Planification",
						description:
							"Quand le job est censé s'exécuter, et le retard toléré avant qu'il soit considéré comme manqué.",
					},
					alerting: {
						title: "Alertes",
						description: "Ce qui se passe lorsqu'une exécution attendue n'arrive pas.",
					},
				},

				fields: {
					name: {
						label: "Nom",
						placeholder: "Sauvegarde Quotidienne",
						description: "Un nom descriptif pour ce moniteur de cron job.",
					},
					description: {
						label: "Description",
						placeholder: "Description optionnelle de ce que fait ce job",
						description: "Une description optionnelle pour aider à identifier ce cron job.",
					},
					cronExpression: {
						label: "Expression Cron",
						placeholder: "0 * * * *",
						description: "L'expression de planification cron (ex. '0 * * * *' pour chaque heure).",
					},
					gracePeriod: {
						label: "Période de Grâce",
						description:
							"Combien de temps attendre après l'heure prévue avant de marquer comme en retard.",
						decrement: "Diminuer la période de grâce",
						increment: "Augmenter la période de grâce",
						unit: {
							minutes: "minutes",
							seconds: "secondes",
						},
					},
					timezone: {
						label: "Fuseau Horaire",
						placeholder: "Sélectionner le fuseau horaire",
						description: "Le fuseau horaire pour la planification cron.",
					},
					alertOnLate: {
						label: "Alerter en Retard",
						description: "Envoyer une alerte lorsque le job manque son heure prévue.",
					},
					enabled: {
						label: "Activé",
						description: "Commencer à surveiller ce cron job immédiatement.",
					},
				},
				cta: "Créer le Cron Job",
			},
		},

		editCronJob: {
			header: {
				title: "Modifier le Cron Job",
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			form: {
				sections: {
					basics: {
						title: "Informations de base",
						description: "Le nom de ce job et ce qu'il fait.",
					},
					schedule: {
						title: "Planification",
						description:
							"Quand le job est censé s'exécuter, et le retard toléré avant qu'il soit considéré comme manqué.",
					},
					alerting: {
						title: "Alertes",
						description: "Ce qui se passe lorsqu'une exécution attendue n'arrive pas.",
					},
				},

				fields: {
					name: {
						label: "Nom",
						placeholder: "Sauvegarde Quotidienne",
						description: "Un nom descriptif pour ce moniteur de cron job.",
					},
					description: {
						label: "Description",
						placeholder: "Description optionnelle de ce que fait ce job",
						description: "Une description optionnelle pour aider à identifier ce cron job.",
					},
					cronExpression: {
						label: "Expression Cron",
						placeholder: "0 * * * *",
						description: "L'expression de planification cron (ex. '0 * * * *' pour chaque heure).",
					},
					gracePeriod: {
						label: "Période de Grâce",
						description:
							"Combien de temps attendre après l'heure prévue avant de marquer comme en retard.",
						decrement: "Diminuer la période de grâce",
						increment: "Augmenter la période de grâce",
						unit: {
							minutes: "minutes",
							seconds: "secondes",
						},
					},
					timezone: {
						label: "Fuseau Horaire",
						placeholder: "Sélectionner le fuseau horaire",
						description: "Le fuseau horaire pour la planification cron.",
					},
					alertOnLate: {
						label: "Alerter en Retard",
						description: "Envoyer une alerte lorsque le job manque son heure prévue.",
					},
					enabled: {
						label: "Activé",
						description: "Si ce cron job doit être activement surveillé.",
					},
				},
				cancel: "Annuler",
				cta: "Enregistrer les modifications",
			},

			danger: {
				title: "Zone de danger",

				description: "Les actions de cette section sont irréversibles.",
				warning:
					"Supprimer ce cron job efface définitivement son historique de pings et ses alertes.",
				delete: {
					trigger: "Supprimer le moniteur",
					confirmTitle: "Supprimer ce moniteur de cron job ?",
					confirmDescription:
						"Cela supprime également son historique de pings. Cette action est irréversible.",
					confirm: "Supprimer",
				},
			},
		},

		cronJobDetail: {
			header: {
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
				action: {
					edit: "Modifier",
					delete: "Supprimer",
				},
			},

			alert: {
				subscription: {
					title: "Vos moniteurs sont en pause !",
					description: "Un abonnement est nécessaire pour continuer la surveillance automatique.",
					cta: "Commencer la surveillance",
				},
			},

			info: {
				title: "Configuration du Cron Job",
				schedule: "Planification",
				timezone: "Fuseau Horaire",
				status: "Statut",
				gracePeriod: "Période de Grâce",
				gracePeriodValue: "{{duration}} de grâce",
				description: "Description",
			},

			stats: {
				totalPings: {
					label: "Total des Pings",
					description: "Nombre de pings reçus",
				},
				onTimeRate: {
					label: "Taux de Ponctualité",
					description: "Pourcentage de pings à l'heure",
				},
				lastPing: {
					label: "Dernier Ping",
					description: "Quand le dernier ping a été reçu",
					never: "Jamais",
				},
				nextExpected: {
					label: "Prochain Attendu",
					description: "Quand le prochain ping est attendu",
				},
			},

			ping: {
				title: "Pinguer ce moniteur",
				description:
					"Faites en sorte que votre tâche envoie une requête POST ici une fois terminée, avec une clé d'API portant la portée `cron-jobs:ping`.",
				snippet: {
					curl: "Depuis un script",
					copyCurl: "Copier la commande",
					crontab: "Depuis la crontab",
					copyCrontab: "Copier la ligne de crontab",
				},
				apiKey: {
					text: "Sans clé portant cette portée, le ping est rejeté avec un 401 et l'exécution est tout de même comptée comme manquée.",
					cta: "Créer une clé d'API",
				},
			},

			uptimeHistory: "Historique de disponibilité",

			pings: {
				title: "Historique des Pings",
				description: "Pings récents reçus de ce cron job",
				empty:
					"Aucun ping reçu encore. Les pings apparaîtront ici après que votre job envoie son premier ping.",
				label: "Pings",
				columns: {
					time: "Heure",
					status: "Statut",
					sourceIp: "IP Source",
				},
				status: {
					onTime: "À l'heure",
					late: "En retard",
				},
			},

			integration: {
				title: "Instructions d'Intégration",
				description:
					"Envoyez une requête POST à ce point de terminaison lorsque votre cron job se termine.",
				endpoint: "Point de Terminaison Ping",
				curlExample: "Exemple cURL",
				codeExamples: {
					title: "Exemples de Code",
					bash: "Bash / Cron",
					python: "Python",
					nodejs: "Node.js",
				},
				apiKeyNote:
					"Vous avez besoin d'une clé API avec la portée 'cron-jobs:ping'. Créez-en une dans les paramètres des Clés API.",
			},

			delete: {
				confirmation:
					"Êtes-vous sûr de vouloir supprimer {{name}} ? Cette action est irréversible.",
			},
		},
	},
};
