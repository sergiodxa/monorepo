/**
 * French (fr) translation dictionary for the Uptime app. It maps every UI copy key
 * to its French string across the landing page, dashboard, monitors, alerts, teams,
 * domains, status pages, and toast/error messages. It exists so the interface can be
 * rendered in French, mirroring the shape of the English base dictionary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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

		hero: {
			pill: "Surveillance Uptime",
			title: "Surveillez vos services <strong>en toute confiance</strong>",
			description:
				"Recevez des alertes instantanées lorsque vos sites web et API tombent en panne. Surveillez vos sites web et API facilement.",

			cta: {
				in: "Ouvrir le tableau de bord",
				out: "Commencer la surveillance",
				pricing: "Voir les tarifs",
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
			uptimeSla: "SLA de disponibilité",
			globalRegions: "Régions mondiales",
			daysDataRetention: "Jours de rétention des données",
			alertLatency: "Latence des alertes",
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
						"Suivez vos services 24h/24 et 7j/7 avec une fiabilité de surveillance de 99,9%. Obtenez des métriques détaillées et des aperçus de performance en un coup d'œil.",
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
		heatmap: {
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

	components: {
		heatmap: {
			tooltip: "{{date}}\n{{successRate}} taux de réussite\n{{checks}} vérifications",
			legend: {
				success: "Succès",
				failure: "Échec",
				mixed: "Mixte",
				noData: "Pas de données",
			},
		},
		copyButton: {
			label: "Copier",
			copied: "Copié !",
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
				invalidCron: "Expression cron invalide.",
			},
			success: "Le cron job '{{name}}' a été créé.",
		},

		updateCronJob: {
			errors: {
				generic: "Oups ! Une erreur s'est produite.",
				notFound: "Ce cron job n'existe pas.",
				invalidCron: "Expression cron invalide.",
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
					description: "{{up}} actifs / {{down}} hors service",
				},
				dnsMonitors: {
					label: "Moniteurs DNS",
					description: "{{ok}} ok / {{changed}} modifiés / {{error}} erreur",
				},
				tcpMonitors: {
					label: "Moniteurs TCP",
					description: "{{up}} actifs / {{down}} hors service",
				},
				cronJobs: {
					label: "Tâches Cron",
					description: "{{healthy}} sains / {{late}} en retard / {{missed}} manqués",
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
					description: "{{valid}} valides, {{expiring}} bientôt expirés, {{expired}} expirés",
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

				cancel: "Annuler",
				cta: "Enregistrer les modifications",
			},

			ssl: {
				title: "Surveillance du certificat SSL",
				cta: "Enregistrer les paramètres SSL",
			},

			dangerZone: {
				title: "Zone de danger",
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
					description: "Disponibilité globale du moniteur",
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

			heatmap: {
				tooltip: "{{date}}\n{{successRate}} taux de réussite\n{{checks}} vérifications",
				legend: {
					success: "Succès",
					failure: "Échec",
					mixed: "Mixte",
					noData: "Pas de données",
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
						label: "Délai (minutes, 0 = aucun délai)",
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
					none: "Aucun",
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
				},

				cta: "Créer une page de statut",
				ctaUpdate: "Enregistrer les modifications",
			},
		},

		createStatusPage: {
			header: {
				title: "Créer une page de statut",
			},
		},

		editStatusPage: {
			header: {
				title: "Modifier la page de statut",
			},
		},

		httpMonitors: {
			header: {
				title: "Moniteurs HTTP",
				action: {
					create: "Créer un Moniteur",
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
						placeholder: "192.168.1.1",
						description:
							"Optionnel. Alerter si la valeur résolue ne correspond pas. Laissez vide pour suivre les changements.",
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
						placeholder: "192.168.1.1",
						description:
							"Optionnel. Alerter si la valeur résolue ne correspond pas. Laissez vide pour suivre les changements.",
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
			},

			endNow: {
				cta: "Terminer la maintenance maintenant",
			},

			danger: {
				title: "Zone de danger",

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
			},

			danger: {
				title: "Zone de danger",

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

			teams: {
				title: "Vos équipes",
				description: "Équipes dont vous êtes membre.",

				actions: {
					createTeam: "Créer une équipe",
				},

				empty: {
					title: "Pas encore d'équipes",
					description: "Créez une équipe pour commencer à surveiller vos services.",
					cta: "Créer une équipe",
				},

				table: {
					label: "Équipes",
					description: "Toutes les équipes auxquelles vous appartenez.",

					columns: {
						team: "Équipe",
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
						leave: "Quitter l'équipe",
					},

					confirmation: {
						leaveTeam: "Êtes-vous sûr de vouloir quitter {{name}} ?",
					},
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

				fields: {
					name: {
						label: "Nom de la clé",
						placeholder: "Clé API de production",
						description: "Un nom pour identifier cette clé API.",
					},
					scopes: {
						label: "Permissions",
						description: "Sélectionnez ce à quoi cette clé API peut accéder.",
						options: {
							"monitors:read": "Lire les moniteurs",
							"monitors:write": "Écrire les moniteurs",
							"alerts:read": "Lire les alertes",
							"alerts:write": "Écrire les alertes",
							"cron-jobs:read": "Lire les tâches Cron",
							"cron-jobs:write": "Écrire les tâches Cron",
							"cron-jobs:ping": "Ping Cron Jobs",
						},
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
					"Faites en sorte que votre tâche envoie une requête POST ici après son exécution. Aucune authentification requise — traitez cette URL comme un secret.",
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
