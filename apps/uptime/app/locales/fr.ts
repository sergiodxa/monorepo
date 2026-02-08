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

				cta: {
					in: "Ouvrir le tableau de bord",
					out: "Commencer la surveillance",
				},
			},
		},

		hero: {
			pill: "Surveillez vos services en toute confiance",
			title: "Surveillez vos services <strong>en toute confiance</strong>",
			description:
				"Recevez des alertes instantanées lorsque vos sites web et API tombent en panne. Surveillez vos sites web et API facilement.",

			cta: {
				in: "Ouvrir le tableau de bord",
				out: "Commencer la surveillance",
				pricing: "Voir les tarifs",
			},

			screenshot: {
				alt: "Capture d'écran d'un tableau de bord de surveillance de disponibilité affichant deux services avec des graphiques de chaleur hebdomadaires. Chaque point représente une vérification : vert pour succès, jaune pour mixte, rouge pour échec et gris pour aucune donnée. Chaque moniteur affiche également le pourcentage de disponibilité, le nombre total de vérifications, l'heure de la dernière vérification et le temps de réponse au 99e percentile",
			},
		},

		features: {
			title: "Une surveillance puissante simplifiée",
			description:
				"Tout ce dont vous avez besoin pour maintenir vos services en fonctionnement, sans complexité inutile.",

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
			},
		},

		pricing: {
			title: "Tarification simple et transparente",
			description:
				"Un seul abonnement, pas de niveaux. Payez uniquement ce que vous utilisez avec notre modèle de tarification simple",

			howItWorks: {
				title: "Comment fonctionne la tarification",

				list: {
					first: {
						title: "Abonnement de base",
						description: "5$/mois inclut vos 5 000 premiers pings",
					},

					second: {
						title: "Pings supplémentaires",
						description: "0,001$ par ping après les 5 000 premiers",
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
					additionalPingsCost: "{{pings}} × {{costPerPing}}",
					totalCost: "Coût mensuel total :",
				},
			},
		},

		faq: {
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
					a: "Vous serez facturé 1$ pour chaque 1 000 pings au-delà des 5 000 inclus dans votre abonnement.",
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
			links: {
				privacy: "Confidentialité",
				terms: "Conditions d'utilisation",
				security: "Sécurité",
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
						statusPages: "Pages de statut",
						tcpMonitors: "Moniteurs TCP",
						dnsMonitors: "Moniteurs DNS",
						settings: "Paramètres",
						billing: "Facturation",
						domains: "Domaines",
						members: "Membres",
						team: "Équipe",
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
			p99ResponseTime: "Temps de réponse P99",
			p99ResponseTimeValue: "{{value}}",
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
				p99ResponseTime: "Temps de réponse P99",
				p99ResponseTimeValue: "{{value}} ms",
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
				},

				uptime: {
					label: "Pourcentage de disponibilité",
					description: "Disponibilité globale du système",
				},

				slowestEndpoint: {
					label: {
						default: 'Point de terminaison le plus lent "<em>{{name}}</em>"',
						noData: "Point de terminaison le plus lent",
					},
					value: { noData: "N/A" },
					description: "Au cours des dernières 24 heures",
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
		},

		monitor: {
			header: {
				title: 'Moniteur "{{name}}"',

				action: {
					play: "Exécuter le moniteur",
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
				},

				uptime: {
					label: "Pourcentage de disponibilité",
					description: "Disponibilité globale du moniteur",
				},

				slowestResult: {
					label: "Résultat le plus lent",
					description: "Au cours des dernières 24 heures",
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
				notFound: "Cette invitation n'existe pas.",
				gone: "Cette invitation a déjà été acceptée.",
				forbidden: "Cette invitation ne vous était pas destinée.",
				badRequest: "Il semble que vous n'ayez pas d'adresse e-mail. Essayez de vous reconnecter.",
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

			table: {
				label: "Alertes",

				columns: {
					name: "Nom",
					strategy: "Type",
					notifyOnRecovery: "Récupération",
					cooldown: "Délai",
					actions: "Actions",
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
				},

				allMonitors: "Tous les moniteurs",
				recurring: "Récurrente",

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
							"Format du modèle : 'daily:HH:MM-HH:MM' ou 'weekly:jourDeLaSemaine:HH:MM-HH:MM'",
					},
				},

				preview: {
					label: "Fenêtre de maintenance",
				},

				cta: "Planifier la maintenance",
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

			profile: {
				title: "Profil",
				description: "Vos informations personnelles.",
			},

			language: {
				title: "Préférence de langue",
				description: "Choisissez votre langue préférée pour l'interface.",

				form: {
					fields: {
						language: {
							label: "Langue",
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
					},
					interval: {
						label: "Intervalle de vérification",
						description: "À quelle fréquence vérifier le port.",
					},
					timeout: {
						label: "Délai de connexion",
						description: "Combien de temps attendre une connexion avant d'expirer.",
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
					},
					interval: {
						label: "Intervalle de vérification",
						description: "À quelle fréquence vérifier le port.",
					},
					timeout: {
						label: "Délai de connexion",
						description: "Combien de temps attendre une connexion avant d'expirer.",
					},
					isEnabled: {
						label: "Activer la surveillance",
					},
				},
				cancel: "Annuler",
				cta: "Enregistrer les modifications",
			},
		},

		tcpMonitorDetail: {
			header: {
				breadcrumb: {
					tcpMonitors: "Moniteurs TCP",
				},
				action: {
					edit: "Modifier",
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
	},
};
