/**
 * German (de) translation dictionary for the Uptime app. It maps every UI copy key
 * to its German string across the landing page, dashboard, monitors, alerts, teams,
 * domains, status pages, and toast/error messages. It exists so the interface can be
 * rendered in German, mirroring the shape of the English base dictionary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export default {
	landing: {
		meta: {
			title: "Uptime von Sergio Xalambrí",
			description: "Einfache und zuverlässige Uptime-Überwachung für Entwickler",
		},

		header: {
			title: "Uptime",

			nav: {
				pricing: "Preise",
				features: "Funktionen",
				compare: "Vergleichen",
				docs: "Docs",

				cta: {
					in: "Dashboard öffnen",
					out: "Überwachung starten",
				},
			},
		},

		hero: {
			pill: "Uptime-Überwachung",
			title: "Überwachen Sie Ihre Dienste <strong>mit Zuversicht</strong>",
			description:
				"Erhalten Sie sofortige Benachrichtigungen, wenn Ihre Websites und APIs ausfallen. Überwachen Sie Ihre Websites und APIs mit Leichtigkeit.",

			cta: {
				in: "Dashboard öffnen",
				out: "Überwachung starten",
				pricing: "Preise ansehen",
			},

			screenshot: {
				alt: "Screenshot des Uptime-Dashboards: eine Seitenleiste mit HTTP-, DNS- und TCP-Monitoren, Cron-Jobs, Benachrichtigungen, Wartung und Statusseiten; Übersichtskarten für monatliche Ping-Nutzung, Gesamt-Uptime-Prozentsatz und den langsamsten Endpunkt; Zählungen aktiver und ausgefallener Monitore pro Typ; und eine Tabelle der HTTP-Monitore mit Latenz-Trendlinien und Status-Badges",
			},

			trustIndicators: {
				freeToStart: "Kostenlos starten",
				payForAutomation: "Zahlen Sie für Automatisierung",
				cancelAnytime: "Jederzeit kündbar",
			},
		},

		trustIndicators: {
			uptimeSla: "Uptime-SLA",
			globalRegions: "Globale Regionen",
			daysDataRetention: "Tage Datenspeicherung",
			alertLatency: "Benachrichtigungs-Latenz",
		},

		features: {
			title: "Leistungsstarke Überwachung einfach gemacht",
			description:
				"Alles, was Sie brauchen, um Ihre Dienste reibungslos am Laufen zu halten, ohne unnötige Komplexität.",
			badge: "Funktionen",
			learnMore: "Mehr erfahren",

			list: {
				first: {
					title: "Überwachen Sie Ihre Uptime",
					description:
						"Verfolgen Sie Ihre Dienste rund um die Uhr mit 99,9% Überwachungszuverlässigkeit. Erhalten Sie detaillierte Metriken und Leistungseinblicke auf einen Blick.",
				},
				second: {
					title: "Erhalten Sie Benachrichtigungen überall",
					description:
						"Erhalten Sie sofortige Benachrichtigungen per E-Mail, Slack, Discord oder Webhooks, wenn Ihre Dienste Ausfallzeiten oder Leistungsprobleme haben.",
				},
				third: {
					title: "Zahlen Sie nur, was Sie nutzen",
					description:
						"Transparente Preise ohne versteckte Gebühren. Skalieren Sie nach Bedarf hoch oder runter, mit Plänen, die mit Ihren Überwachungsanforderungen wachsen.",
				},
				fourth: {
					title: "Statusseiten",
					description:
						"Erstellen Sie ansprechende öffentliche Statusseiten, um Ihre Benutzer über die Dienstverfügbarkeit und Vorfälle zu informieren.",
				},
				fifth: {
					title: "SSL-Überwachung",
					description:
						"Verfolgen Sie Zertifikats-Ablaufdaten und erhalten Sie Benachrichtigungen, bevor Ihre SSL-Zertifikate ablaufen, um Sicherheitswarnungen zu vermeiden.",
				},
				sixth: {
					title: "DNS-Überwachung",
					description:
						"Erkennen Sie DNS-Eintragsänderungen und Propagierungsprobleme, bevor sie Ihre Benutzer beeinträchtigen oder gekapert werden.",
				},
				seventh: {
					title: "Native Integrationen",
					description:
						"Direkte Slack- und Discord-Integrationen mit umfangreichen Benachrichtigungen, nicht nur einfache Webhooks.",
				},
			},
		},

		completeFeatureSet: {
			badge: "Komplettes Funktionsset",
			title: "Alles, was Sie für zuverlässige Überwachung brauchen",
			description: "Erweiterte Funktionen, die die Überwachung mühelos und umfassend machen.",

			list: {
				maintenanceWindows: {
					title: "Wartungsfenster",
					description:
						"Planen Sie Ausfallzeiten und unterdrücken Sie Benachrichtigungen während geplanter Wartung",
				},
				contentMonitoring: {
					title: "Inhaltsüberwachung",
					description:
						"Überprüfen Sie, ob bestimmte Schlüsselwörter oder Inhalte auf Ihren Seiten erscheinen",
				},
				recoveryAlerts: {
					title: "Wiederherstellungs-Benachrichtigungen",
					description:
						"Werden Sie benachrichtigt, wenn Dienste nach einem Vorfall wieder verfügbar sind",
				},
				apiAccess: {
					title: "API-Zugang",
					description: "Vollständige REST-API mit Schlüsselverwaltung für Automatisierung",
				},
				alertCooldowns: {
					title: "Benachrichtigungs-Cooldowns",
					description:
						"Verhindern Sie Benachrichtigungsmüdigkeit mit konfigurierbaren Cooldown-Perioden",
				},
				customHeaders: {
					title: "Benutzerdefinierte Header",
					description:
						"Fügen Sie Authentifizierungs-Header und benutzerdefinierte Anfrageparameter hinzu",
				},
				cronMonitoring: {
					title: "Cron-Job-Überwachung",
					description: "Überwachen Sie geplante Jobs und Hintergrundaufgaben mit Heartbeat-Checks",
				},
			},
		},

		useCases: {
			badge: "Anwendungsfälle",
			title: "Für jeden Überwachungsbedarf entwickelt",
			description:
				"Von einfachen Gesundheitsprüfungen bis hin zu komplexen verteilten Systemen – wir haben Sie abgedeckt.",
			learnMore: "Mehr erfahren",
			tailoredFor: "Maßgeschneiderte Lösungen für:",

			list: {
				websiteMonitoring: {
					title: "Website-Überwachung",
					description:
						"Verfolgen Sie Uptime und Leistung für Landingpages, Blogs und Webanwendungen.",
				},
				apiMonitoring: {
					title: "API-Überwachung",
					description:
						"Überwachen Sie REST-APIs, GraphQL-Endpunkte und Webhooks auf Verfügbarkeit.",
				},
				saas: {
					title: "SaaS-Anwendungen",
					description:
						"Halten Sie Ihr SaaS-Produkt zuverlässig mit proaktiver Überwachung und sofortigen Benachrichtigungen.",
				},
				microservices: {
					title: "Microservices",
					description:
						"Überwachen Sie verteilte Systeme und erkennen Sie Fehler, bevor sie sich ausbreiten.",
				},
				healthChecks: {
					title: "Gesundheitsprüfungen",
					description:
						"Überprüfen Sie die Dienstverfügbarkeit und Datenbankverbindungen mit geplanten Pings.",
				},
				ecommerce: {
					title: "E-Commerce",
					description:
						"Überwachen Sie Checkout-Abläufe, Zahlungs-APIs und Produktseiten zum Schutz Ihrer Einnahmen.",
				},
			},

			audiences: {
				indieHackers: "Indie Hacker",
				soloDevelopers: "Solo-Entwickler",
				startups: "Startups",
				agencies: "Agenturen",
				enterprises: "Unternehmen",
				devops: "DevOps",
			},
		},

		pricing: {
			badge: "Preise",
			title: "Einfache, transparente Preise",
			description:
				"Ein Abonnement, keine Stufen. Zahlen Sie nur für das, was Sie nutzen, mit unserem unkomplizierten Preismodell",

			howItWorks: {
				title: "So funktioniert die Preisgestaltung",

				list: {
					first: {
						title: "Basis-Abonnement",
						description: "{{price}}/Monat beinhaltet Ihre ersten {{included}} Pings",
					},

					second: {
						title: "Zusätzliche Pings",
						description:
							"{{blockPrice}} pro weitere {{blockSize}} Pings, in ganzen Blöcken abgerechnet",
					},

					third: {
						title: "Keine versteckten Gebühren",
						description:
							"Keine zusätzlichen Kosten für Funktionen oder Integrationen. Zahlen Sie für die Pings, die Sie nutzen.",
					},
				},
			},

			calculator: {
				title: "Preisrechner",
				description:
					"Berechnen Sie Ihre monatlichen Kosten basierend auf Ihren Überwachungsanforderungen",

				add: "Monitor hinzufügen",

				monitor: {
					label: "Monitor-Frequenz",
					delete: "Entfernen",
					frequency: {
						lower: "1m",
						upper: "60m",
					},
				},

				stats: {
					pingsPerMonth: "Pings pro Monat:",
					baseSubscription: "Basis-Abonnement",
					includes: "Beinhaltet die ersten {{amount}} Pings",
					additionalPings: "Zusätzliche Pings:",
					additionalPingsCost:
						"{{blocks}} × {{blockPrice}} pro {{blockSize}} Pings ({{pings}} darüber)",
					totalCost: "Monatliche Gesamtkosten:",
				},
			},
		},

		faq: {
			badge: "FAQ",
			title: "Häufig gestellte Fragen",
			description: "Finden Sie Antworten auf häufige Fragen zu Uptime",

			list: {
				first: {
					q: "Wie überwacht Uptime meine Dienste?",
					a: "Uptime sendet regelmäßige HTTP- oder HTTPS-Anfragen an Ihre Endpunkte. Wir prüfen Antwortcodes und Antwortzeiten, um festzustellen, ob Ihr Dienst verfügbar und reaktionsfähig ist.",
				},

				second: {
					q: "Was passiert, wenn ein Ausfall erkannt wird?",
					a: "Wenn Uptime einen Ausfall erkennt, sendet es sofort eine Benachrichtigung über Ihre konfigurierten Kanäle.",
				},

				third: {
					q: "Kann ich interne Dienste überwachen?",
					a: "Ja, solange Ihre internen Dienste über das Internet erreichbar sind. Sie können auch benutzerdefinierte Header konfigurieren, um Anfragen zu authentifizieren.",
				},

				fourth: {
					q: "Wie fange ich an?",
					a: "Melden Sie sich einfach an, erstellen Sie Ihren ersten Monitor und konfigurieren Sie Ihre Benachrichtigungseinstellungen. Sie sind in weniger als einer Minute einsatzbereit.",
				},

				fifth: {
					q: "Gibt es eine kostenlose Stufe?",
					a: "Ja! Sie können unbegrenzt Monitore erstellen und Pings manuell kostenlos auslösen, für immer. Geplante automatische Überwachung erfordert ein Abonnement.",
				},

				sixth: {
					q: "Wie lange werden Ping-Daten gespeichert?",
					a: "Wir speichern Ihre Ping-Ergebnisse 365 Tage lang. Danach werden sie automatisch gelöscht.",
				},

				seventh: {
					q: "Kann ich Dienste überwachen, die Authentifizierung erfordern?",
					a: "Ja. Sie können benutzerdefinierte Header mit Tokens oder Anmeldedaten festlegen, um Ihre Anfragen zu authentifizieren.",
				},

				eighth: {
					q: "Kann ich mehrere URLs überwachen?",
					a: "Ja. Erstellen Sie einfach einen separaten Monitor für jede URL. Jeder Monitor kann seine eigene Prüffrequenz, HTTP-Methode, erwarteten Statuscode und mehr haben.",
				},

				ninth: {
					q: "Kann ich APIs überwachen?",
					a: "Absolut. Uptime ist so konzipiert, dass es sowohl Websites als auch APIs überwacht. Sie können den Endpunkt, die Methode, Header und erwartete Antworten festlegen, um Ihre API effektiv zu überwachen.",
				},

				tenth: {
					q: "Kann ich ein Timeout für jeden Ping festlegen?",
					a: "Ja. Sie können ein Timeout für jeden Monitor konfigurieren. Wenn die Antwort länger als erwartet dauert, wird sie als Fehler gewertet. Dies hilft, langsame Dienste zu erkennen.",
				},

				eleventh: {
					q: "Kann ich einen Monitor vorübergehend pausieren oder deaktivieren?",
					a: "Ja. Sie können jeden Monitor jederzeit einzeln pausieren.",
				},

				twelfth: {
					q: "Kann ich einen Monitor sofort nach der Erstellung testen?",
					a: "Ja. Ein Ping wird automatisch ausgelöst, direkt nachdem Sie einen Monitor erstellt haben.",
				},

				thirteenth: {
					q: "Unterstützen Sie Statusseiten?",
					a: "Ja! Erstellen Sie anpassbare öffentliche Statusseiten, um den Zustand Ihrer Dienste mit Benutzern zu teilen. Fügen Sie beliebige Monitore hinzu und ergänzen Sie Ihr Branding.",
				},

				fourteenth: {
					q: "Kann ich historische Leistungstrends einsehen?",
					a: "Wir speichern alle vergangenen Ergebnisse, sodass Sie eine vollständige Historie erhalten. Leistungstrend-Diagramme sind für eine zukünftige Version geplant.",
				},

				fifteenth: {
					q: "Welche Benachrichtigungskanäle werden unterstützt?",
					a: "E-Mail, Slack, Discord und Webhooks. Native Integrationen machen es einfach, Benachrichtigungen dort zu erhalten, wo Ihr Team bereits arbeitet. Webhooks ermöglichen die Verbindung zu jedem anderen Dienst.",
				},

				sixteenth: {
					q: "Unterstützen Sie Teams oder geteilte Monitore?",
					a: "Ja! Jeder Benutzer beginnt mit einem Team. Laden Sie Teammitglieder mit verschiedenen Rollen ein (Eigentümer, Admin, Mitglied). Die automatische Domain-Bereitstellung fügt automatisch Benutzer mit verifizierten Unternehmens-E-Mail-Domains hinzu.",
				},

				seventeenth: {
					q: "Was passiert, wenn ich die Limits meines Plans überschreite?",
					a: "Nutzung über die {{included}} in Ihrem Abonnement enthaltenen Pings hinaus wird in ganzen Blöcken von {{blockSize}} zu je {{blockPrice}} abgerechnet — ein einzelner Ping darüber beginnt einen neuen Block.",
				},

				eighteenth: {
					q: "Speichern Sie Anfrage- oder Antwortkörper?",
					a: "Nein. Wir speichern niemals Body-Daten. Für zusätzliche Privatsphäre und Effizienz empfehlen wir die Verwendung der `HEAD`-Methode.",
				},

				nineteenth: {
					q: "Aus welchen Regionen kann ich meine Dienste überwachen?",
					a: "Uptime unterstützt die Überwachung aus mehreren Regionen: Afrika, Asien-Pazifik, Ost- und Westeuropa, Ost- und West-Nordamerika, Naher Osten, Ozeanien und Südamerika.\n\nSie können eine Region pro Monitor wählen. Die Region wird als Hinweis behandelt, der tatsächliche Ping stammt von einem Server in oder nahe dieser Region.",
				},
			},
		},

		footer: {
			name: "Uptime",
			description: "Einfache, zuverlässige Überwachung für Ihre Websites und APIs.",
			copyright: "© {{year}} Uptime von Sergio Xalambrí. Alle Rechte vorbehalten.",
			sections: {
				product: {
					title: "Produkt",
					features: "Funktionen",
					pricing: "Preise",
					faq: "FAQ",
				},
				features: {
					title: "Funktionen",
					monitors: "Monitore",
					alerts: "Benachrichtigungen",
					statusPages: "Statusseiten",
					ssl: "SSL-Überwachung",
					dns: "DNS-Überwachung",
					cronJobs: "Cron-Job-Überwachung",
					contentMonitoring: "Inhaltsüberwachung",
					maintenance: "Wartungsfenster",
					integrations: "Integrationen",
					teams: "Teams",
					analytics: "Analytik",
					api: "API-Zugang",
				},
				useCases: {
					title: "Anwendungsfälle",
					websiteMonitoring: "Website-Überwachung",
					apiMonitoring: "API-Überwachung",
					saas: "SaaS-Anwendungen",
					ecommerce: "E-Commerce",
					cronJobs: "Cron-Job-Überwachung",
				},
				solutions: {
					title: "Lösungen",
					indieHackers: "Für Indie Hacker",
					soloDevs: "Für Solo-Entwickler",
					startups: "Für Startups",
					agencies: "Für Agenturen",
					enterprises: "Für Unternehmen",
					devops: "Für DevOps",
				},
				compare: {
					title: "Vergleichen",
					uptimerobot: "vs UptimeRobot",
					pingdom: "vs Pingdom",
					betterUptime: "vs Better Uptime",
					healthchecks: "vs Healthchecks.io",
					cronitor: "vs Cronitor",
				},
				legal: {
					title: "Rechtliches",
					terms: "Nutzungsbedingungen",
					privacy: "Datenschutzerklärung",
				},
			},
		},

		comparison: {
			tableLabel: "Uptime vs. {{competitor}}",
			tableCategoryHeader: "Kategorie",
			tableProductHeader: "Uptime",
			whyTeamsSwitchTitle: "Warum Teams zu Uptime wechseln",
			gettingStartedTitle: "Erste Schritte",
			finalCtaTitle: "Zu Uptime wechseln",

			honestTake: {
				badge: "Ehrliche Einschätzung",
				title: "Wann {{competitor}} die bessere Wahl sein kann",
				description:
					"Wir setzen auf Transparenz. In diesen Fällen kann {{competitor}} die richtige Wahl sein.",
			},

			pricing: {
				badge: "Preise",
				title: "Echter Kostenvergleich",
				description: "Sehen Sie, wie viel Sie bei einem typischen Monitoring-Setup sparen können.",
				tableLabel: "Kostenvergleich: Uptime vs. {{competitor}}",
				scenarioHeader: "Anwendungsfall",
				savingsHeader: "Ersparnis",
				savingsPerYear: "~{{amount}}/Jahr",
				footnote:
					"Schätzungen auf Basis typischer Nutzungsmuster. Die Preise von {{competitor}} können sich ändern, und Ihre tatsächlichen Kosten hängen von Ihrem Setup ab.",
			},
		},

		finalCta: {
			body: "Erstellen Sie Ihren ersten Monitor in weniger als 2 Minuten. Keine Kreditkarte erforderlich.",
		},

		marketingPage: {
			everythingBadge: "Im Detail",
			everythingTitle: "Alles, was Sie brauchen",
			everythingDescription:
				"Ein genauer Blick darauf, was Sie erhalten – von der ersten Prüfung bis zur Benachrichtigung, die Sie erreicht.",
			howItWorksBadge: "Erste Schritte",
			howItWorksTitle: "So funktioniert es",
			howItWorksDescription:
				"Drei Schritte von einem leeren Dashboard zu Prüfungen, die von selbst laufen.",
			faqBadge: "FAQ",
			faqTitle: "Häufig gestellte Fragen",
			faqDescription: "Die häufigsten Fragen, bevor Sie mit der Überwachung beginnen.",
			finalCtaTitle: "Überwachen Sie jetzt Ihre Dienste",
		},
	},

	app: {
		meta: {
			title: "Uptime von Sergio Xalambrí",
			description: "Einfache und zuverlässige Uptime-Überwachung für Entwickler",
		},

		layout: {
			sidebar: {
				teamPicker: { label: "Team auswählen" },
				userMenu: { label: "Benutzermenü" },

				navigation: {
					items: {
						dashboard: "Dashboard",
						alerts: "Benachrichtigungen",
						maintenance: "Wartung",
						monitors: "Monitore",
						httpMonitors: "HTTP-Monitore",
						statusPages: "Statusseiten",
						tcpMonitors: "TCP-Monitore",
						dnsMonitors: "DNS-Monitore",
						cronJobs: "Cron Jobs",
						settings: "Einstellungen",
						billing: "Abrechnung",
						domains: "Domains",
						members: "Mitglieder",
						team: "Team",
						docs: "Dokumentation",
						apiKeys: "API-Schlüssel",
					},
				},

				account: {
					title: "Konto",
					overview: "Übersicht",
					teams: "Ihre Teams",
				},
			},
		},

		errors: {
			notFound: {
				title: "404 Nicht gefunden",
				description: "Das Team, das Sie suchen, existiert nicht.",
			},
		},
	},

	monitorDetail: {
		header: {
			region: "{{emoji}} {{code}}",
		},
		stats: {
			title: "Statistiken",
			uptime: "Uptime",
			totalChecks: "Gesamtprüfungen",
			lastCheck: "Letzte Prüfung",
			neverRan: "N/V",
		},

		actions: {
			refresh: "Aktualisieren",
			delete: {
				confirm: "Sind Sie sicher, dass Sie diesen Monitor löschen möchten?",
				cta: "Monitor löschen",
			},
		},
	},

	monitorList: {
		header: {
			title: "Uptime-Monitore",
			cta: "Monitor erstellen",
			subscribe: "Ihre Monitore sind pausiert. Abonnieren Sie, um die Überwachung fortzusetzen",
		},
	},

	statusPage: {
		banner: {
			operational: "Alle Systeme funktionieren",
			degraded: "Teilweiser Systemausfall",
			down: "Größerer Systemausfall",
		},
		status: {
			operational: "Betriebsbereit",
			degraded: "Beeinträchtigt",
			down: "Ausgefallen",
			unknown: "Unbekannt",
		},
		heatmap: {
			daysAgo: "Vor 90 Tagen",
			today: "Heute",
			legend: {
				full: "100%",
				partial: "Teilweise",
				down: "Ausgefallen",
				noData: "Keine Daten",
			},
			tooltip: {
				uptime: "{{percentage}}% Uptime",
				noData: "Keine Daten",
			},
		},
		cronJobs: {
			title: "Geplante Jobs",
			lastPing: "Letzter Ping",
			never: "Nie",
			schedule: "Zeitplan",
		},
		empty: {
			description: "Für diese Statusseite sind keine Dienste konfiguriert.",
		},
		footer: {
			lastUpdated: "Zuletzt aktualisiert {{date}}",
			poweredBy: "Bereitgestellt von Uptime",
		},
		error: {
			title: "Statusseite nicht gefunden",
			description: "Die gesuchte Statusseite existiert nicht oder ist nicht öffentlich.",
			goHome: "Zur Startseite",
		},
	},

	contentMonitoring: {
		title: "Inhaltsüberwachung",
		description:
			"Überprüfen Sie Antwortinhalte auf bestimmte Schlüsselwörter oder Muster. Der Monitor schlägt fehl, wenn eine Prüfung nicht besteht.",
		empty:
			"Keine Inhaltsprüfungen konfiguriert. Fügen Sie eine Prüfung hinzu, um bestimmte Schlüsselwörter oder Muster in der Antwort zu überwachen.",
		addButton: "Inhaltsprüfung hinzufügen",

		form: {
			checkType: {
				label: "Prüfungstyp",
				description: "Wählen Sie, wie der Antwortinhalt abgeglichen werden soll",
				options: {
					contains: "Enthält",
					notContains: "Enthält nicht",
					regex: "Regex-Muster",
				},
			},
			value: {
				label: "Wert",
				placeholder: "Schlüsselwort oder Muster eingeben",
				description: "Der Text oder das Regex-Muster, nach dem gesucht werden soll",
			},
			caseSensitive: "Groß-/Kleinschreibung beachten",
			cancel: "Abbrechen",
			add: "Prüfung hinzufügen",
		},

		item: {
			type: "Typ",
			status: "Status",
			caseSensitive: "Groß-/Kleinschreibung beachten",
			enabled: "Aktiviert",
			disabled: "Deaktiviert",
			yes: "Ja",
			no: "Nein",
			delete: "Löschen",
			deleteConfirmTitle: "Diese Inhaltsprüfung löschen?",
		},

		types: {
			contains: "Enthält",
			notContains: "Enthält nicht",
			regex: "Regex",
		},
	},

	auth: {
		error: {
			title: "Authentifizierungsfehler",
			errorCode: "Fehlercode: {{code}}",
			description: "Beschreibung: {{description}}",
			uri: "URI:",
			tryAgain:
				"Bitte versuchen Sie es erneut oder kontaktieren Sie den Support, wenn das Problem weiterhin besteht.",

			signInFailedTitle: "Anmeldung fehlgeschlagen",
			signInFailedGeneric:
				"Der Anmeldeversuch konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
			missingIdToken: "Der Identitätsanbieter hat kein ID-Token zurückgegeben.",
		},
	},

	dashboard: {
		header: {
			title: "Uptime-Monitore",
			cta: "Monitor erstellen",
			subscribe: "Ihre Monitore sind pausiert. Abonnieren Sie, um die Überwachung fortzusetzen",
		},

		monitor: {
			stats: {
				title: "Statistiken",
				uptime: "Uptime",
				totalChecks: "Gesamtprüfungen",
				lastCheck: "Letzte Prüfung",
				neverRan: "N/V",
			},

			actions: {
				refresh: "Aktualisieren",
				delete: {
					confirm: "Sind Sie sicher, dass Sie diesen Monitor löschen möchten?",
					cta: "Monitor löschen",
				},
			},
		},
	},

	createMonitor: {
		title: "Neuen Monitor erstellen",
		fields: {
			name: {
				label: "Monitor-Name",
				placeholder: "Startseite",
				description: "Ein beschreibender Name für Ihren Monitor.",
			},
			url: {
				label: "Zu überwachende URL",
				placeholder: "https://example.com/healthcheck",
				description: "Die URL des Dienstes, den Sie überwachen möchten.",
			},
			method: {
				label: "Anfragemethode",
				placeholder: "HEAD",
				description: "Die HTTP-Methode für die Anfrage.",
			},
			status: {
				label: "Erwarteter Statuscode",
				placeholder: "200",
				description: "Der HTTP-Statuscode, den Sie erwarten.",
			},
			interval: {
				label: "Prüfintervall",
				placeholder: "60",
				description: "Intervall in Sekunden. Minimum ist 60 Sekunden.",
			},
			visibility: {
				label: "Sichtbarkeit",
				description: "Öffentliche Monitore können mit jedem geteilt werden.",
				options: { public: "Öffentlich", private: "Privat" },
			},
			region: {
				label: "Region",
				description: "Die Region, von der aus der Ping ausgeführt wird.",
				placeholder: "wnam",
				options: {
					afr: "{{emoji}} Afrika",
					apac: "{{emoji}} Asien-Pazifik",
					eeur: "{{emoji}} Osteuropa",
					enam: "{{emoji}} Ost-Nordamerika",
					me: "{{emoji}} Naher Osten",
					oc: "{{emoji}} Ozeanien",
					sam: "{{emoji}} Südamerika",
					weur: "{{emoji}} Westeuropa",
					wnam: "{{emoji}} West-Nordamerika",
				},
			},
		},
		cta: "Monitor erstellen",
	},

	toasts: {
		refreshMonitor: {
			pending: "Pinge {{name}}...",
			success: "Ping von {{name}} beendet.",
			failure: "Hoppla! Beim Ausführen des Monitors ist etwas schiefgelaufen.",
		},

		deleteMonitor: {
			success: "{{name}} wurde gelöscht.",
			failure: "Wir konnten {{name}} nicht löschen. Bitte versuchen Sie es erneut.",
		},

		createMonitor: {
			pending: "Erstelle Monitor {{name}}...",
			success: "{{name}} wurde erstellt.",
			failure: "Wir konnten {{name}} nicht erstellen. Bitte versuchen Sie es erneut.",
		},
	},

	components: {
		heatmap: {
			tooltip: "{{date}}\n{{successRate}} Erfolgsrate\n{{checks}} Prüfungen",
			legend: {
				success: "Erfolg",
				failure: "Fehler",
				mixed: "Gemischt",
				noData: "Keine Daten",
			},
		},
		copyButton: {
			label: "Kopieren",
			copied: "Kopiert!",
		},
	},

	actions: {
		addDomain: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Domains zu diesem Team hinzuzufügen.",
				alreadyExists: "{{hostname}} wurde am {{verifiedAt}} hinzugefügt.",
			},

			success: {
				accepted: "{{hostname}} wartet noch auf Verifizierung.",
				created: "{{hostname}} wurde zu {{team}} hinzugefügt. Verifizierung steht aus.",
			},
		},

		changeRole: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Rollen in diesem Team zu ändern.",
				cannotChangeOwner: "Sie können die Rolle des Team-Eigentümers nicht ändern.",
			},

			success: "Die Rolle von {{name}} wurde in {{team}} zu {{role}} geändert.",
		},

		createAlert: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Benachrichtigungen in diesem Team zu erstellen.",
				limitExceeded:
					"Sie haben das Limit von {{limit}} Benachrichtigungen in diesem Team erreicht.",
			},
			success: { created: "Benachrichtigung {{name}} wurde erstellt." },
		},

		createInvite: {
			email: {
				subject: "Sie wurden eingeladen, {{team}} auf Uptime beizutreten",
			},

			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Mitglieder zu diesem Team einzuladen.",
				alreadyAccepted: "Es gibt bereits ein Mitglied von {{team}} mit dieser E-Mail.",
			},

			success: "{{email}} wurde eingeladen, {{team}} beizutreten.",
		},

		createMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
			},

			success: "Monitor {{name}} wurde erstellt.",
		},

		updateMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser Monitor existiert nicht.",
			},

			success: "Monitor {{name}} wurde aktualisiert.",
		},

		updateSsl: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser Monitor existiert nicht.",
			},

			success: "SSL-Einstellungen für {{name}} wurden aktualisiert.",
		},

		deleteMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Monitore in diesem Team zu löschen.",
				notFound: "Dieser Monitor existiert nicht.",
			},
			success: "Monitor {{name}} wurde gelöscht.",
		},

		playMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser Monitor existiert nicht.",
			},

			pending: "Pinge {{name}}...",
			success: "Ping von {{name}} beendet.",
			failure: "Hoppla! Beim Ausführen des Monitors ist etwas schiefgelaufen.",
		},

		removeAlert: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				forbidden: "Sie sind nicht berechtigt, Benachrichtigungen in diesem Team zu entfernen.",
				notFound: "{{name}} existiert nicht.",
			},
			success: "Benachrichtigung {{name}} wurde entfernt.",
		},

		removeDomain: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Domains aus diesem Team zu entfernen.",
				notFound: "{{hostname}} existiert nicht.",
			},

			success: "{{hostname}} wurde aus {{team}} entfernt.",
		},

		removeMember: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Mitglieder aus diesem Team zu entfernen.",
				cannotRemoveOwner: "Sie können den Team-Eigentümer nicht entfernen.",
			},

			success: "{{name}} wurde aus {{team}} entfernt.",
		},

		retryDomainVerification: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed:
					"Sie sind nicht berechtigt, die Domain-Verifizierung in diesem Team zu wiederholen.",
				notFound: "{{hostname}} existiert nicht.",
				workflowFailed:
					"Der Verifizierungsprozess für {{hostname}} konnte nicht gestartet werden. Versuchen Sie es später erneut.",
			},

			success: {
				alreadyVerified: "{{hostname}} ist bereits verifiziert.",
				requested: "Wiederholung der Verifizierung für {{hostname}} wurde angefordert.",
			},
		},

		revokeInvite: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Einladungen in diesem Team zu widerrufen.",
				notFound: "Diese Einladung existiert nicht.",
				alreadyAccepted: "Diese Einladung wurde bereits vom Eingeladenen angenommen.",
			},

			success: "Die Einladung von {{email}} wurde aus {{team}} widerrufen.",
		},

		updateTeam: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				forbidden: "Sie sind nicht berechtigt, Team-Einstellungen zu aktualisieren.",
			},

			success: {
				updated: "Team-Einstellungen wurden erfolgreich aktualisiert.",
			},
		},

		deleteTeam: {
			errors: {
				generic: "Hoppla! Beim Löschen des Teams ist etwas schiefgelaufen.",
				forbidden: "Nur der Team-Eigentümer kann das Team löschen.",
				confirmationRequired: "Bitte geben Sie DELETE zur Bestätigung ein.",
			},

			success: "{{team}} wurde gelöscht.",
		},

		leaveTeam: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notMember: "Sie sind kein Mitglied dieses Teams.",
				ownerCannotLeave:
					"Team-Eigentümer können ihr Team nicht verlassen. Übertragen Sie zuerst das Eigentum.",
				adminCannotLeave:
					"Admins können das Team nicht verlassen. Bitten Sie den Eigentümer, Sie zuerst herabzustufen.",
			},

			success: "Sie haben {{team}} verlassen.",
		},

		createStatusPage: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				slugTaken: "Dieser Slug wird bereits verwendet.",
			},
		},

		updateStatusPage: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Diese Statusseite existiert nicht.",
				slugTaken: "Dieser Slug wird bereits verwendet.",
			},
		},

		deleteStatusPage: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Diese Statusseite existiert nicht.",
			},

			success: "Statusseite wurde gelöscht.",
		},

		createMaintenance: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				invalidDates: "Die Endzeit muss nach der Startzeit liegen.",
			},

			success: {
				created: "Wartungsfenster '{{name}}' wurde erstellt.",
			},
		},

		deleteMaintenance: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieses Wartungsfenster existiert nicht.",
				forbidden: "Sie sind nicht berechtigt, dieses Wartungsfenster zu löschen.",
			},

			success: "Wartungsfenster '{{name}}' wurde gelöscht.",
		},

		endMaintenance: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieses Wartungsfenster existiert nicht.",
				forbidden: "Sie sind nicht berechtigt, dieses Wartungsfenster zu beenden.",
			},

			success: "Wartungsfenster '{{name}}' wurde vorzeitig beendet.",
		},

		createTeam: {
			errors: {
				generic: "Hoppla! Beim Erstellen des Teams ist etwas schiefgelaufen.",
			},

			success: {
				created: "Team {{name}} wurde erfolgreich erstellt.",
			},
		},

		createDnsMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				limitExceeded: "Sie haben das Limit von {{limit}} DNS-Monitoren in diesem Team erreicht.",
			},

			success: {
				created: "DNS-Monitor {{name}} wurde erstellt.",
			},
		},

		updateDnsMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser DNS-Monitor existiert nicht.",
				forbidden: "Sie sind nicht berechtigt, diesen DNS-Monitor zu aktualisieren.",
			},

			success: "DNS-Monitor {{name}} wurde aktualisiert.",
		},

		deleteDnsMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser DNS-Monitor existiert nicht.",
				forbidden: "Sie sind nicht berechtigt, diesen DNS-Monitor zu löschen.",
			},

			success: "DNS-Monitor {{name}} wurde gelöscht.",
		},

		checkDnsMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser DNS-Monitor existiert nicht.",
				forbidden: "Sie sind nicht berechtigt, diesen DNS-Monitor zu prüfen.",
			},

			success: "DNS-Prüfung für {{name}} abgeschlossen.",
		},

		createTcpMonitor: {
			errors: {
				generic: "Hoppla! Beim Erstellen des TCP-Monitors ist etwas schiefgelaufen.",
			},
			success: "TCP-Monitor {{name}} wurde erstellt.",
		},

		updateTcpMonitor: {
			errors: {
				generic: "Hoppla! Beim Aktualisieren des TCP-Monitors ist etwas schiefgelaufen.",
				notFound: "Dieser TCP-Monitor existiert nicht.",
			},
			success: "TCP-Monitor {{name}} wurde aktualisiert.",
		},

		deleteTcpMonitor: {
			errors: {
				generic: "Hoppla! Beim Löschen des TCP-Monitors ist etwas schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, TCP-Monitore in diesem Team zu löschen.",
				notFound: "Dieser TCP-Monitor existiert nicht.",
			},
			success: "TCP-Monitor {{name}} wurde gelöscht.",
		},

		createApiKey: {
			errors: {
				generic: "Hoppla! Beim Erstellen des API-Schlüssels ist etwas schiefgelaufen.",
				limitExceeded: "Sie haben das Limit von {{limit}} API-Schlüsseln in diesem Team erreicht.",
			},
			success: {
				created: "API-Schlüssel '{{name}}' wurde erstellt.",
			},
		},

		deleteApiKey: {
			errors: {
				generic: "Hoppla! Beim Löschen des API-Schlüssels ist etwas schiefgelaufen.",
				notFound: "Dieser API-Schlüssel existiert nicht.",
			},
			success: "API-Schlüssel '{{name}}' wurde gelöscht.",
		},

		updateLanguage: {
			errors: {
				generic: "Hoppla! Beim Aktualisieren Ihrer Spracheinstellung ist etwas schiefgelaufen.",
			},
			success: "Spracheinstellung erfolgreich aktualisiert.",
		},

		createCronJob: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				limitExceeded: "Sie haben das Limit von {{limit}} Cron Jobs in diesem Team erreicht.",
				invalidCron: "Ungültiger Cron-Ausdruck.",
			},
			success: "Cron Job '{{name}}' wurde erstellt.",
		},

		updateCronJob: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser Cron Job existiert nicht.",
				invalidCron: "Ungültiger Cron-Ausdruck.",
			},
			success: "Cron Job '{{name}}' wurde aktualisiert.",
		},

		deleteCronJob: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser Cron Job existiert nicht.",
				forbidden: "Sie sind nicht berechtigt, diesen Cron Job zu löschen.",
			},
			success: "Cron Job '{{name}}' wurde gelöscht.",
		},
	},

	page: {
		dashboard: {
			header: {
				title: "Dashboard",
				action: {
					create: "Monitor erstellen",
					refresh: "Aktualisieren",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			empty: {
				title: "Noch keine Monitore",
				description: "Erstellen Sie Ihren ersten Monitor, um Ihre Dienste zu verfolgen.",
				cta: "Monitor erstellen",
			},

			tabs: {
				http: "HTTP",
				dns: "DNS",
				tcp: "TCP",
				cronJobs: "Cron-Jobs",
			},

			stats: {
				monitors: {
					label: "Monatliche Ping-Nutzung",
					value: "{{consumed}}<small> verwendet</small>",
					description: "Von {{estimated}} geschätzt",
					unavailable: "Schätzung nicht verfügbar",
				},

				uptime: {
					label: "Uptime-Prozentsatz",
					description: "Gesamte System-Uptime",
				},

				httpMonitors: {
					label: "HTTP-Monitore",
					description: "{{up}} aktiv / {{down}} ausgefallen",
				},
				dnsMonitors: {
					label: "DNS-Monitore",
					description: "{{ok}} ok / {{changed}} geändert / {{error}} Fehler",
				},
				tcpMonitors: {
					label: "TCP-Monitore",
					description: "{{up}} aktiv / {{down}} ausgefallen",
				},
				cronJobs: {
					label: "Cron-Jobs",
					description: "{{healthy}} gesund / {{late}} verspätet / {{missed}} verpasst",
				},

				slowestEndpoint: {
					label: {
						default: 'Langsamster Endpunkt "<em>{{name}}</em>"',
						noData: "Langsamster Endpunkt",
					},
					value: { noData: "N/V" },
					description: "In den letzten 24 Stunden",
				},

				sslMonitors: {
					label: "SSL-Monitore",
					description: "{{valid}} gültig, {{expiring}} bald ablaufend, {{expired}} abgelaufen",
				},
			},

			loading: "Wird geladen…",

			panel: {
				tabsLabel: "Monitortyp",
				tabPanelLabel: "{{tab}}-Monitore",
				refresh: "Aktualisieren",
			},

			error: {
				card: {
					label: "Fehler",
					value: "-",
					description: "Daten konnten nicht geladen werden",
				},
				table: {
					message: "Monitore konnten nicht geladen werden. Bitte versuchen Sie es erneut.",
				},
				analytics: {
					message:
						"Analysedaten sind vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.",
				},
			},

			table: {
				label: "Monitore",

				columns: {
					name: "Name",
					latencyChart: "Latenztrend",
					status: "Status",
					lastIncident: "Letzter Vorfall",
					responseTime: "Durchschn. Latenz",
					actions: "Aktionen",
				},

				status: {
					up: "Aktiv & Läuft",
					down: "Ausgefallen",
					degraded: "Beeinträchtigt",
					unknown: "Keine Daten",
				},

				lastIncident: { never: "-" },
				responseTime: "~{{value}}",

				actions: {
					menu: "Aktionsmenü",
					edit: "Monitor bearbeiten",
					delete: "Monitor löschen",
					play: "Monitor ausführen",
				},

				confirmation: {
					deleteMonitor:
						"Sind Sie sicher, dass Sie den Monitor {{name}} löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",
				},
			},
		},

		monitors: {
			header: {
				title: "Uptime-Monitore",
				cta: "Monitor erstellen",
				subscribe: "Ihre Monitore sind pausiert. Abonnieren Sie, um die Überwachung fortzusetzen",
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},
		},

		createMonitor: {
			header: {
				title: "Monitor erstellen",
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Startseite",
						description: "Ein beschreibender Name für Ihren Monitor.",
					},
					url: {
						label: "Zu überwachende URL",
						placeholder: "https://example.com/healthcheck",
						description: "Die URL des Dienstes, den Sie überwachen möchten.",
					},
					method: {
						label: "Anfragemethode",
						placeholder: "HEAD",
						description: "Die HTTP-Methode für die Anfrage.",
					},
					status: {
						label: "Erwarteter Statuscode",
						placeholder: "200",
						description: "Der HTTP-Statuscode, den Sie erwarten.",
					},
					interval: {
						label: "Prüfintervall",
						placeholder: "60",
						description: "Intervall in Sekunden. Minimum ist 60 Sekunden.",
					},
					visibility: {
						label: "Sichtbarkeit",
						description: "Öffentliche Monitore können mit jedem geteilt werden.",
						options: { public: "Öffentlich", private: "Privat" },
					},
					region: {
						label: "Region",
						description: "Die Region, von der aus der Ping ausgeführt wird.",
						placeholder: "Region auswählen",
						options: {
							afr: "{{emoji}} Afrika",
							apac: "{{emoji}} Asien-Pazifik",
							eeur: "{{emoji}} Osteuropa",
							enam: "{{emoji}} Ost-Nordamerika",
							me: "{{emoji}} Naher Osten",
							oc: "{{emoji}} Ozeanien",
							sam: "{{emoji}} Südamerika",
							weur: "{{emoji}} Westeuropa",
							wnam: "{{emoji}} West-Nordamerika",
						},
					},
				},

				cta: "Monitor erstellen",
			},
		},

		editMonitor: {
			header: {
				title: "Monitor bearbeiten",
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Startseite",
						description: "Ein beschreibender Name für Ihren Monitor.",
					},
					url: {
						label: "Zu überwachende URL",
						placeholder: "https://example.com/healthcheck",
						description: "Die URL des Dienstes, den Sie überwachen möchten.",
					},
					method: {
						label: "Anfragemethode",
						placeholder: "HEAD",
						description: "Die HTTP-Methode für die Anfrage.",
					},
					status: {
						label: "Erwarteter Statuscode",
						placeholder: "200",
						description: "Der HTTP-Statuscode, den Sie erwarten.",
					},
					interval: {
						label: "Prüfintervall",
						placeholder: "60",
						description: "Intervall in Sekunden. Minimum ist 60 Sekunden.",
					},
					visibility: {
						label: "Sichtbarkeit",
						description: "Öffentliche Monitore können mit jedem geteilt werden.",
						options: { public: "Öffentlich", private: "Privat" },
					},
					region: {
						label: "Region",
						description: "Die Region, von der aus der Ping ausgeführt wird.",
						placeholder: "wnam",
						options: {
							afr: "{{emoji}} Afrika",
							apac: "{{emoji}} Asien-Pazifik",
							eeur: "{{emoji}} Osteuropa",
							enam: "{{emoji}} Ost-Nordamerika",
							me: "{{emoji}} Naher Osten",
							oc: "{{emoji}} Ozeanien",
							sam: "{{emoji}} Südamerika",
							weur: "{{emoji}} Westeuropa",
							wnam: "{{emoji}} West-Nordamerika",
						},
					},
					ssl: {
						enabled: {
							label: "SSL-Überwachung aktivieren",
							description:
								"Überwachen Sie den Ablauf des SSL-Zertifikats und erhalten Sie Benachrichtigungen, bevor es abläuft.",
						},
						expiresAt: {
							label: "Zertifikats-Ablaufdatum",
							placeholder: "Ablaufdatum auswählen",
							description:
								"Geben Sie das Ablaufdatum Ihres SSL-Zertifikats ein. Sie finden dies im Dashboard Ihres Hosting-Anbieters oder indem Sie die Zertifikatsdetails in Ihrem Browser überprüfen.",
						},
						issuer: {
							label: "Zertifikatsaussteller",
							placeholder: "Let's Encrypt, DigiCert, etc.",
							description:
								"Die Zertifizierungsstelle, die Ihr SSL-Zertifikat ausgestellt hat (optional).",
						},
						warningDays: {
							label: "Warnung vor Ablauf",
							description:
								"Erhalten Sie Benachrichtigungen diese Anzahl von Tagen vor Ablauf des Zertifikats.",
						},
					},
				},

				cancel: "Abbrechen",
				cta: "Änderungen speichern",
			},

			ssl: {
				title: "SSL-Zertifikatsüberwachung",
				cta: "SSL-Einstellungen speichern",
			},

			dangerZone: {
				title: "Gefahrenzone",
				delete: "Monitor löschen",
			},
		},

		monitor: {
			header: {
				title: 'Monitor "{{name}}"',

				action: {
					play: "Monitor ausführen",
					running: "Wird ausgeführt…",
					edit: "Monitor bearbeiten",
					refresh: "Aktualisieren",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			stats: {
				monitors: {
					label: "Monatliche Ping-Nutzung",
					value: "{{consumed}}<small> verwendet</small>",
					description: "Von {{estimated}} geschätzt",
					estimateUnavailable: "Schätzung nicht verfügbar",
				},

				uptime: {
					label: "Uptime-Prozentsatz",
					description: "Gesamte Monitor-Uptime",
				},

				slowestResult: {
					label: "Langsamstes Ergebnis",
					description: "In den letzten 24 Stunden",
				},

				p99ResponseTime: {
					label: "P99 Antwortzeit",
					value: "{{value}} ms",
					description: "p99, letzte 24 Std.",
				},
			},

			heatmap: {
				tooltip: "{{date}}\n{{successRate}} Erfolgsrate\n{{checks}} Prüfungen",
				legend: {
					success: "Erfolg",
					failure: "Fehler",
					mixed: "Gemischt",
					noData: "Keine Daten",
				},
			},

			ssl: {
				title: "SSL-Zertifikat",
				status: {
					valid: "Gültig",
					expiring: "Läuft bald ab",
					expired: "Abgelaufen",
					error: "Fehler",
					unknown: "Nicht konfiguriert",
				},
				expiresAt: "Läuft ab",
				expiresIn: "{{days}} Tage",
				issuer: "Aussteller",
				lastChecked: "Zuletzt geprüft",
				notConfigured: "SSL-Überwachung ist für diesen Monitor nicht aktiviert.",
				configure: "SSL-Überwachung konfigurieren",
			},
		},

		billing: {
			header: {
				title: "Abrechnung",
			},
			ownerOnly: "Nur der Teambesitzer kann die Abrechnung für dieses Team einsehen und verwalten.",
		},

		members: {
			header: {
				title: "Team-Mitglieder",

				action: {
					invite: "Mitglied einladen",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			sections: {
				members: {
					title: "Mitglieder",
					description: "Verwalten Sie Ihre Team-Mitglieder und deren Rollen.",
				},
			},

			membersTable: {
				label: "Aktuelle Mitglieder",
				description: "Personen, die Zugang zu diesem Team haben.",

				columns: {
					name: "Name",
					role: "Team-Rolle",
					actions: "Aktionen",
				},

				role: {
					member: "Mitglied",
					admin: "Admin",
					owner: "Eigentümer",
				},

				actions: {
					menu: "Aktionsmenü",
					remove: "Aus Team entfernen",
					transfer: "Eigentum übertragen",
					changeRole: {
						member: "Zu Admin konvertieren",
						admin: "Zu Mitglied konvertieren",
						owner: "Eigentümer kann nicht geändert werden",
					},
				},

				confirmation: {
					removeMember: "Sind Sie sicher, dass Sie {{name}} aus dem Team entfernen möchten?",
				},
			},

			invitedMembersTable: {
				label: "Ausstehende Einladungen",
				description: "Personen, die eingeladen wurden, aber noch nicht beigetreten sind.",

				columns: {
					email: "E-Mail",
					actions: "Aktionen",
				},

				actions: {
					menu: "Aktionsmenü",
					copy: "Einladungslink kopieren",
					revoke: "Einladung widerrufen",
				},

				confirmation: {
					revokeInvite: "Sind Sie sicher, dass Sie die Einladung von {{email}} widerrufen möchten?",
				},
			},

			error: {
				forbidden: {
					title: "Sie haben keine Berechtigung, auf diese Seite zuzugreifen.",
					description: "Bitte kontaktieren Sie Ihren Team-Administrator für Unterstützung.",
				},

				unknown: {
					title: "Ein unerwarteter Fehler ist aufgetreten.",
					description: "Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.",
				},
			},
		},

		invite: {
			header: {
				title: "Team-Mitglied einladen",
				description: "Senden Sie eine Einladung, Ihrem Team beizutreten.",
			},

			dialog: {
				close: "Dialog schließen",
			},

			form: {
				fields: {
					email: {
						label: "E-Mail-Adresse",
						placeholder: "max.mustermann@beispiel.de",
						description: "Die E-Mail-Adresse der Person, die Sie zu {{team}} einladen möchten.",
					},
				},

				cancel: "Abbrechen",
				cta: "Mitglied einladen",
			},
		},

		acceptInvite: {
			errors: {
				notFound: "Diese Einladung existiert nicht.",
				gone: "Diese Einladung wurde bereits angenommen.",
				forbidden: "Diese Einladung war nicht für Sie bestimmt.",
				pageTitle: "Einladung nicht verfügbar",
				badRequest:
					"Sie haben anscheinend keine E-Mail-Adresse. Versuchen Sie, sich erneut anzumelden.",
				wrongEmail:
					"Diese Einladung wurde an {{email}} gesendet. Melde dich mit dieser E-Mail-Adresse an, um sie anzunehmen.",
			},
		},

		domains: {
			header: {
				title: "Team-Domains",
				action: { addDomain: "Domain hinzufügen" },
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			sections: {
				domains: {
					title: "Domains",
					description: "Verwalten Sie verifizierte Domains für Ihr Team.",
				},
			},

			form: {
				fields: {
					hostname: {
						label: "Domain",
						placeholder: "beispiel.de",
						description: "Die Domain, die Sie zu {{team}} hinzufügen möchten.",
					},
				},

				cta: "Domain hinzufügen",
			},

			table: {
				label: "Verifizierte Domains",
				description:
					"Domains, die für die automatische Bereitstellung von Team-Mitgliedern verwendet werden können.",

				columns: {
					hostname: "Hostname",
					id: "Verifizierungs-ID",
					verifiedAt: "Verifiziert am",
					actions: "Aktionen",
				},

				verifiedAt: {
					pending: "Wartet auf Verifizierung",
				},

				actions: {
					menu: "Aktionsmenü",
					copy: "Verifizierungs-ID kopieren",
					remove: "Domain entfernen",
					retryVerification: "Verifizierung wiederholen",
				},

				confirmation: {
					removeDomain: "Sind Sie sicher, dass Sie {{hostname}} aus dem Team entfernen möchten?",
				},
			},

			instructions: {
				title: "So verifizieren Sie Ihre Domain",

				description:
					"Um Ihre Domain zu verifizieren, fügen Sie den folgenden `TXT`-Eintrag zu Ihren DNS-Einstellungen hinzu:",

				record: {
					name: {
						label: "Name",
						value: "_ping-verification",
					},
					content: {
						label: "Inhalt",
						value: "VERIFICATION_ID",
					},
				},

				note: "Stellen Sie sicher, dass Sie <code>VERIFICATION_ID</code> durch die oben angezeigte tatsächliche Verifizierungs-ID ersetzen.",

				disclaimer:
					"DNS-Änderungen können einige Zeit zur Propagierung benötigen, daher kann sich die Verifizierung verzögern.",
			},

			error: {
				forbidden: {
					title: "Sie haben keine Berechtigung, auf diese Seite zuzugreifen.",
					description: "Bitte kontaktieren Sie Ihren Team-Administrator für Unterstützung.",
				},

				unknown: {
					title: "Ein unerwarteter Fehler ist aufgetreten.",
					description: "Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.",
				},
			},
		},

		alerts: {
			header: {
				title: "Benachrichtigungen",

				action: {
					create: "Benachrichtigung erstellen",
					history: "Verlauf anzeigen",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			empty: {
				title: "Keine Benachrichtigungen konfiguriert",
				description:
					"Erstellen Sie eine Benachrichtigung, um informiert zu werden, wenn Ihre Monitore ausfallen.",
				cta: "Benachrichtigung erstellen",
			},

			limitReached: "Dieses Team hat das Limit von {{limit}} Benachrichtigungen erreicht.",

			form: {
				fields: {
					name: {
						label: "Name",
						placeholder: "CTO-Benachrichtigung",
						description: "Ein Name zur Identifizierung der Benachrichtigung.",
					},

					scope: {
						label: "Umfang",
						teamWide: "Teamweit (alle Monitore)",
					},

					channel: {
						label: "Kanal",
						description: "Der Kanal für die Benachrichtigung.",
						options: {
							webhook: "Webhook",
							email: "E-Mail",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "URL",
								placeholder: "https://beispiel.de/webhook",
								description: "Die URL, an die die Benachrichtigungs-Payload gesendet wird.",
							},
							secret: {
								label: "Signatur-Geheimschlüssel (optional)",
								placeholder: "optionaler-geheimschlüssel",
								description:
									"Ein optionaler Geheimschlüssel für die Request-Header. Ein `Webhook-Signature`-Header wird mit einer HMAC SHA256-Signatur der Payload unter Verwendung dieses Geheimnisses hinzugefügt.",
							},
							signatureNote:
								"Wenn festgelegt, tragen Anfragen einen <code>Webhook-Signature: sha256=<hex></code>-Header — eine HMAC-SHA256-Signatur des rohen JSON-Bodys mit diesem Geheimnis.",
						},
						email: {
							to: {
								label: "Empfänger",
								placeholder: "cto@beispiel.de",
								description: "Die E-Mail-Adresse, an die die Benachrichtigung gesendet wird.",
							},

							subjectPrefix: {
								label: "Betreff-Präfix (optional)",
								placeholder: "[Uptime-Benachrichtigung]",
								description:
									"Ein optionales Präfix für den E-Mail-Betreff. Nützlich zum Filtern von Benachrichtigungen in Ihrem Posteingang.",
							},
						},
						slack: {
							webhookUrl: {
								label: "Webhook-URL",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"Die Slack Incoming Webhook-URL. Erstellen Sie eine unter api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Kanal-Override (optional)",
								placeholder: "#alerts",
								description:
									"Optionaler Kanal anstelle des Webhook-Standards. Fügen Sie das #-Präfix hinzu.",
							},
						},
						discord: {
							webhookUrl: {
								label: "Webhook-URL",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"Die Discord Webhook-URL. Erstellen Sie eine unter Servereinstellungen > Integrationen > Webhooks.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Bei Wiederherstellung benachrichtigen",
						description:
							"Senden Sie eine Benachrichtigung, wenn der Monitor sich von einem Ausfall erholt. Enthält Wiederherstellungszeit und Ausfalldauer.",
					},

					cooldown: {
						label: "Benachrichtigungs-Cooldown",
						description:
							"Mindestzeit zwischen Benachrichtigungen desselben Typs. Verhindert Benachrichtigungsmüdigkeit bei andauernden Ausfällen.",
						options: {
							none: "Kein Cooldown",
							"5min": "5 Minuten",
							"15min": "15 Minuten",
							"30min": "30 Minuten",
							"1hour": "1 Stunde",
							"2hours": "2 Stunden",
							custom: "Benutzerdefiniert",
						},
						custom: {
							label: "Benutzerdefinierter Cooldown (Minuten)",
							placeholder: "Minuten eingeben",
							description: "Geben Sie die Anzahl der Minuten zwischen Benachrichtigungen ein.",
						},
					},

					cooldownMinutes: {
						label: "Cooldown (Minuten, 0 = kein Cooldown)",
					},

					legends: {
						email: "E-Mail-Einstellungen",
						webhook: "Webhook-Einstellungen",
						slack: "Slack-Einstellungen",
						discord: "Discord-Einstellungen",
					},
				},

				cta: "Benachrichtigung erstellen",
			},

			table: {
				label: "Benachrichtigungen",

				columns: {
					name: "Name",
					scope: "Umfang",
					strategy: "Typ",
					notifyOnRecovery: "Wiederherstellung",
					cooldown: "Cooldown",
					actions: "Aktionen",
				},

				scope: {
					unknownMonitor: "Unbekannter Monitor",
					teamWide: "Teamweit",
				},

				cooldown: {
					none: "Keiner",
					minutes: "{{count}} Min.",
					hours: "{{count}} Std.",
				},

				actions: {
					menu: "Aktionsmenü",
					edit: "Benachrichtigung bearbeiten",
					remove: "Benachrichtigung entfernen",
				},

				types: {
					webhook: "Webhook",
					email: "E-Mail",
					slack: "Slack",
					discord: "Discord",
				},

				notifyOnRecovery: {
					enabled: "Ja",
					disabled: "Nein",
				},

				confirmation: {
					deleteAlert: "Sind Sie sicher, dass Sie die Benachrichtigung {{name}} löschen möchten?",
				},
			},
		},

		statusPages: {
			header: {
				title: "Statusseiten",

				action: {
					create: "Statusseite erstellen",
				},
			},

			empty: {
				title: "Noch keine Statusseiten",
				description:
					"Erstellen Sie eine Statusseite, um Ihren Systemstatus mit Ihren Benutzern zu teilen.",
				cta: "Statusseite erstellen",
			},

			table: {
				label: "Statusseiten",

				columns: {
					name: "Name",
					slug: "URL",
					services: "Dienste",
					monitors: "Monitore",
					visibility: "Sichtbarkeit",
					actions: "Aktionen",
				},

				visibility: {
					public: "Öffentlich",
					private: "Privat",
				},

				actions: {
					menu: "Aktionsmenü",
					view: "Seite anzeigen",
					edit: "Seite bearbeiten",
					delete: "Seite löschen",
				},

				confirmation: {
					delete: "Sind Sie sicher, dass Sie die Statusseite {{name}} löschen möchten?",
				},
			},

			form: {
				fields: {
					name: {
						label: "Interner Name",
						placeholder: "Produktionsstatus",
						description: "Ein Name zur internen Identifizierung der Statusseite.",
					},
					slug: {
						label: "URL-Slug",
						placeholder: "produktion",
						description: "Der URL-Pfad für die öffentliche Statusseite (z.B. /status/produktion).",
					},
					title: {
						label: "Öffentlicher Titel",
						placeholder: "Firma GmbH Status",
						description: "Der Titel, der auf der öffentlichen Statusseite angezeigt wird.",
					},
					description: {
						label: "Beschreibung",
						placeholder: "Aktueller Status der Firma GmbH Dienste",
						description: "Eine optionale Beschreibung für die Statusseite.",
					},
					logoUrl: {
						label: "Logo-URL",
						placeholder: "https://beispiel.de/logo.png",
						description: "Ein optionales Logo für die Statusseite.",
					},
					isPublic: {
						label: "Öffentlich",
						description: "Machen Sie diese Statusseite für jeden mit dem Link zugänglich.",
					},
					showOverallStatus: {
						label: "Gesamtstatus anzeigen",
						description: "Zeigen Sie ein Gesamtstatus-Banner oben auf der Seite an.",
					},
					monitors: {
						label: "Einzuschließende Monitore",
						description:
							"Wählen Sie, welche Monitore auf dieser Statusseite angezeigt werden sollen.",
					},
				},

				cta: "Statusseite erstellen",
				ctaUpdate: "Änderungen speichern",
			},
		},

		createStatusPage: {
			header: {
				title: "Statusseite erstellen",
			},
		},

		editStatusPage: {
			header: {
				title: "Statusseite bearbeiten",
			},
		},

		httpMonitors: {
			header: {
				title: "HTTP-Monitore",
				action: {
					create: "Monitor erstellen",
				},
			},
			empty: {
				title: "Noch keine HTTP-Monitore",
				description: "Erstellen Sie einen HTTP-Monitor, um Ihre Endpunkte zu überwachen.",
				cta: "Monitor erstellen",
			},
			table: {
				label: "HTTP-Monitore",
				columns: {
					name: "Name",
					url: "URL",
					status: "Status",
					responseTime: "Antwortzeit",
					lastChecked: "Zuletzt geprüft",
					actions: "Aktionen",
				},
				neverChecked: "Nie",
				disabled: "Deaktiviert",
				actions: {
					menu: "Aktionsmenü",
					view: "Ansehen",
					edit: "Bearbeiten",
					delete: "Löschen",
				},
				status: {
					up: "Aktiv",
					down: "Ausgefallen",
					degraded: "Beeinträchtigt",
					unknown: "Unbekannt",
				},
				confirmation: {
					delete: "Sind Sie sicher, dass Sie den Monitor {{name}} löschen möchten?",
					deleteDescription:
						"Dadurch werden auch die Inhaltsprüfungen und der Prüfergebnisverlauf gelöscht. Dies kann nicht rückgängig gemacht werden.",
				},
			},
		},

		dnsMonitors: {
			header: {
				title: "DNS-Monitore",

				action: {
					create: "DNS-Monitor erstellen",
				},
			},

			empty: {
				title: "Noch keine DNS-Monitore",
				description: "Erstellen Sie einen DNS-Monitor, um DNS-Eintragsänderungen zu verfolgen.",
				cta: "DNS-Monitor erstellen",
			},

			table: {
				label: "DNS-Monitore",

				columns: {
					name: "Name",
					domain: "Domain",
					recordType: "Typ",
					status: "Status",
					lastChecked: "Zuletzt geprüft",
					actions: "Aktionen",
				},

				disabled: "Deaktiviert",
				neverChecked: "Nie",
				notChecked: "Nicht geprüft",

				actions: {
					menu: "Aktionsmenü",
					check: "Jetzt prüfen",
					edit: "Bearbeiten",
					delete: "Löschen",
				},

				confirmation: {
					delete: "Sind Sie sicher, dass Sie den DNS-Monitor {{name}} löschen möchten?",
				},
			},
		},

		createDnsMonitor: {
			header: {
				title: "DNS-Monitor erstellen",
			},

			form: {
				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Produktions-DNS",
						description: "Ein beschreibender Name für diesen DNS-Monitor.",
					},

					domain: {
						label: "Domain",
						placeholder: "beispiel.de",
						description: "Die Domain, deren DNS-Einträge überwacht werden sollen.",
					},

					recordType: {
						label: "Eintragstyp",
						description: "Der Typ des zu prüfenden DNS-Eintrags.",
					},

					expectedValue: {
						label: "Erwarteter Wert",
						placeholder: "192.168.1.1",
						description:
							"Optional. Benachrichtigen Sie, wenn der aufgelöste Wert nicht übereinstimmt. Leer lassen, um Änderungen zu verfolgen.",
					},

					interval: {
						label: "Prüfintervall",
						description: "Wie oft der DNS-Eintrag geprüft werden soll.",
						options: {
							"5m": "5 Minuten",
							"15m": "15 Minuten",
							"30m": "30 Minuten",
							"1h": "1 Stunde",
							"6h": "6 Stunden",
							"12h": "12 Stunden",
							"24h": "24 Stunden",
						},
					},

					isEnabled: {
						label: "Überwachung aktivieren",
						description: "Starten Sie die Überwachung dieses DNS-Eintrags sofort.",
					},
				},

				cta: "DNS-Monitor erstellen",
			},
		},

		editDnsMonitor: {
			header: {
				title: "DNS-Monitor bearbeiten",
			},

			form: {
				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Produktions-DNS",
						description: "Ein beschreibender Name für diesen DNS-Monitor.",
					},

					domain: {
						label: "Domain",
						placeholder: "beispiel.de",
						description: "Die Domain, deren DNS-Einträge überwacht werden sollen.",
					},

					recordType: {
						label: "Eintragstyp",
						description: "Der Typ des zu prüfenden DNS-Eintrags.",
					},

					expectedValue: {
						label: "Erwarteter Wert",
						placeholder: "192.168.1.1",
						description:
							"Optional. Benachrichtigen Sie, wenn der aufgelöste Wert nicht übereinstimmt. Leer lassen, um Änderungen zu verfolgen.",
					},

					interval: {
						label: "Prüfintervall",
						description: "Wie oft der DNS-Eintrag geprüft werden soll.",
						options: {
							"5m": "5 Minuten",
							"15m": "15 Minuten",
							"30m": "30 Minuten",
							"1h": "1 Stunde",
							"6h": "6 Stunden",
							"12h": "12 Stunden",
							"24h": "24 Stunden",
						},
					},

					isEnabled: {
						label: "Überwachung aktivieren",
						description: "Ob dieser DNS-Eintrag aktiv überwacht werden soll.",
					},
				},

				cancel: "Abbrechen",
				cta: "Änderungen speichern",
			},

			dangerZone: {
				title: "Gefahrenzone",
				deleteMonitor: "Monitor löschen",
				deleteDescription:
					"Dies löscht auch den zugehörigen Prüfergebnisverlauf. Dies kann nicht rückgängig gemacht werden.",
			},
		},

		dnsMonitorDetail: {
			header: {
				title: 'DNS-Monitor "{{name}}"',

				action: {
					check: "Jetzt prüfen",
					refresh: "Aktualisieren",
					edit: "Bearbeiten",
				},
			},

			uptimeHistory: "Verlauf der Verfügbarkeit",
			notChecked: "Nicht geprüft",

			info: {
				domain: "Domain",
				recordType: "Eintragstyp",
				status: "Status",
				expectedValue: "Erwarteter Wert",
				currentValue: "Aktueller Wert",
			},

			stats: {
				totalChecks: {
					label: "Gesamtprüfungen",
					description: "Anzahl der durchgeführten DNS-Prüfungen",
				},

				successRate: {
					label: "Erfolgsrate",
					description: "Prozentsatz erfolgreicher Prüfungen",
				},

				avgResponseTime: {
					label: "Durchschn. Antwortzeit",
					description: "Durchschnittliche DNS-Auflösungszeit",
				},
			},

			results: {
				title: "Prüfverlauf",
				empty: "Es wurden noch keine Prüfungen durchgeführt.",

				table: {
					columns: {
						checkedAt: "Geprüft am",
						status: "Status",
						value: "Wert",
						responseTime: "Antwortzeit",
					},
				},
			},
		},

		maintenance: {
			header: {
				title: "Wartungsfenster",

				action: {
					create: "Wartung planen",
				},
			},

			empty: {
				title: "Keine Wartungsfenster",
				description:
					"Planen Sie Wartungsfenster, um Benachrichtigungen während geplanter Ausfallzeiten zu unterdrücken.",
				cta: "Wartung planen",
			},

			tabs: {
				label: "Wartungsstatus",
				active: "Aktiv",
				upcoming: "Geplant",
				past: "Vergangen",
			},

			noActive: "Keine aktiven Wartungsfenster",
			noUpcoming: "Keine geplanten Wartungsfenster",
			noPast: "Keine vergangenen Wartungsfenster",

			table: {
				columns: {
					name: "Name",
					schedule: "Zeitplan",
					monitor: "Monitor",
					status: "Status",
					actions: "Aktionen",
					scope: "Bereich",
					starts: "Beginn",
					ends: "Ende",
				},

				allMonitors: "Alle Monitore",
				recurring: "Wiederkehrend",
				unknownMonitor: "Unbekannter Monitor",
				endedEarly: "Vorzeitig beendet",
				edit: "Bearbeiten",

				status: {
					active: "Aktiv",
					upcoming: "Geplant",
					past: "Abgeschlossen",
				},

				actions: {
					menu: "Aktionsmenü",
					end: "Jetzt beenden",
					delete: "Löschen",
				},

				confirmation: {
					endMaintenance:
						"Sind Sie sicher, dass Sie die Wartung '{{name}}' vorzeitig beenden möchten?",
					deleteMaintenance: "Sind Sie sicher, dass Sie '{{name}}' löschen möchten?",
				},
			},
		},

		createMaintenance: {
			header: {
				title: "Wartung planen",
			},

			form: {
				fields: {
					name: {
						label: "Name",
						placeholder: "Datenbank-Upgrade",
						description: "Eine Beschreibung der Wartungsarbeiten.",
					},

					monitor: {
						label: "Monitor",
						description:
							"Wählen Sie einen bestimmten Monitor oder lassen Sie das Feld leer für alle Monitore.",
						all: "Alle Monitore",
					},

					startsAt: {
						label: "Startzeit",
						description: "Wann das Wartungsfenster beginnt.",
					},

					duration: {
						label: "Dauer",
						description: "Wie lange das Wartungsfenster dauert.",
						options: {
							"15m": "15 Minuten",
							"30m": "30 Minuten",
							"1h": "1 Stunde",
							"2h": "2 Stunden",
							"4h": "4 Stunden",
							"8h": "8 Stunden",
						},
					},

					suppressAlerts: {
						label: "Benachrichtigungen unterdrücken",
						description: "Keine Benachrichtigungen während dieses Wartungsfensters senden.",
					},

					showOnStatusPage: {
						label: "Auf Statusseite anzeigen",
						description: "Einen Wartungshinweis auf öffentlichen Statusseiten anzeigen.",
					},

					isRecurring: {
						label: "Wiederkehrend",
						description: "Dieses Wartungsfenster nach einem Zeitplan wiederholen.",
					},

					recurringPattern: {
						label: "Wiederholungsmuster",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"Musterformat: 'daily:HH:MM-HH:MM', 'weekly:wochentag:HH:MM-HH:MM', oder 'monthly:tagDesMonats:HH:MM-HH:MM'",
					},
				},

				preview: {
					label: "Wartungsfenster",
				},

				cta: "Wartung planen",
			},
		},

		editMaintenance: {
			header: {
				title: "{{name}} bearbeiten",
			},

			form: {
				cta: "Änderungen speichern",
				cancel: "Abbrechen",
			},

			endNow: {
				cta: "Wartung jetzt beenden",
			},

			danger: {
				title: "Gefahrenzone",

				delete: {
					trigger: "Wartungsfenster löschen",
					confirmTitle: "Dieses Wartungsfenster löschen?",
					confirmDescription: "Dies kann nicht rückgängig gemacht werden.",
					confirm: "Löschen",
				},
			},
		},

		maintenanceWindows: {
			form: {
				fields: {
					name: {
						label: "Name",
					},

					scope: {
						label: "Bereich",
						allMonitors: "Alle Monitore",
					},

					startsAt: {
						label: "Beginn",
					},

					endsAt: {
						label: "Ende",
					},

					suppressAlerts: {
						label: "Benachrichtigungen während dieses Fensters unterdrücken",
					},

					showOnStatusPage: {
						label: "Auf Statusseite anzeigen",
					},

					recurring: {
						label: "Wiederkehrend",
					},

					recurringPattern: {
						label: "Wiederholungsmuster (falls wiederkehrend)",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"daily:HH:MM-HH:MM, weekly:<Wochentag>:HH:MM-HH:MM, oder monthly:<Tag-des-Monats>:HH:MM-HH:MM, in UTC.",
					},
				},
			},
		},

		alertHistory: {
			header: {
				title: "Benachrichtigungsverlauf",
			},

			breadcrumbs: {
				alerts: "Benachrichtigungen",
			},

			empty: {
				title: "Noch keine Benachrichtigungsereignisse",
				description:
					"Benachrichtigungsereignisse erscheinen hier, wenn Monitore Benachrichtigungen auslösen. Konfigurieren Sie Benachrichtigungen, um zu beginnen.",
				cta: "Benachrichtigungen anzeigen",
			},

			table: {
				label: "Benachrichtigungsereignisse",

				columns: {
					alert: "Benachrichtigung",
					monitor: "Monitor",
					eventType: "Ereignis",
					status: "Status",
					sentAt: "Zeit",
				},

				unknownAlert: "Unbekannte Benachrichtigung",
				unknownMonitor: "Unbekannter Monitor",

				eventType: {
					down: "Ausgefallen",
					up: "Wiederhergestellt",
					degraded: "Beeinträchtigt",
				},

				status: {
					sent: "Gesendet",
					skipped_cooldown: "Übersprungen (Cooldown)",
					failed: "Fehlgeschlagen",
				},
			},
		},

		createAlert: {
			header: {
				title: "Benachrichtigung erstellen",
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				fields: {
					name: {
						label: "Name",
						placeholder: "CTO-Benachrichtigung",
						description: "Ein Name zur Identifizierung der Benachrichtigung.",
					},

					strategy: {
						label: "Strategie",
						description: "Die Strategie für die Benachrichtigung.",
						options: {
							webhook: "Webhook",
							email: "E-Mail",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "Webhook-URL",
								placeholder: "https://beispiel.de/webhook",
								description: "Die URL, an die die Benachrichtigungs-Payload gesendet wird.",
							},
							secret: {
								label: "Geheimschlüssel",
								placeholder: "optionaler-geheimschlüssel",
								description:
									"Ein optionaler Geheimschlüssel für die Request-Header. Ein `Webhook-Signature`-Header wird mit einer HMAC SHA256-Signatur der Payload unter Verwendung dieses Geheimnisses hinzugefügt.",
							},
						},
						email: {
							to: {
								label: "E-Mail-Adresse",
								placeholder: "cto@beispiel.de",
								description: "Die E-Mail-Adresse, an die die Benachrichtigung gesendet wird.",
							},

							subjectPrefix: {
								label: "Betreff-Präfix",
								placeholder: "[Uptime-Benachrichtigung]",
								description:
									"Ein optionales Präfix für den E-Mail-Betreff. Nützlich zum Filtern von Benachrichtigungen in Ihrem Posteingang.",
							},
						},
						slack: {
							webhookUrl: {
								label: "Slack Webhook-URL",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"Die Slack Incoming Webhook-URL. Erstellen Sie eine unter api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Kanal-Override",
								placeholder: "#alerts",
								description:
									"Optionaler Kanal anstelle des Webhook-Standards. Fügen Sie das #-Präfix hinzu.",
							},
						},
						discord: {
							webhookUrl: {
								label: "Discord Webhook-URL",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"Die Discord Webhook-URL. Erstellen Sie eine unter Servereinstellungen > Integrationen > Webhooks.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Bei Wiederherstellung benachrichtigen",
						description:
							"Senden Sie eine Benachrichtigung, wenn der Monitor sich von einem Ausfall erholt. Enthält Wiederherstellungszeit und Ausfalldauer.",
					},

					cooldown: {
						label: "Benachrichtigungs-Cooldown",
						description:
							"Mindestzeit zwischen Benachrichtigungen desselben Typs. Verhindert Benachrichtigungsmüdigkeit bei andauernden Ausfällen.",
						options: {
							none: "Kein Cooldown",
							"5min": "5 Minuten",
							"15min": "15 Minuten",
							"30min": "30 Minuten",
							"1hour": "1 Stunde",
							"2hours": "2 Stunden",
							custom: "Benutzerdefiniert",
						},
						custom: {
							label: "Benutzerdefinierter Cooldown (Minuten)",
							placeholder: "Minuten eingeben",
							description: "Geben Sie die Anzahl der Minuten zwischen Benachrichtigungen ein.",
						},
					},
				},

				cta: "Benachrichtigung erstellen",
			},
		},

		editAlert: {
			header: {
				title: "Benachrichtigung bearbeiten",
			},

			form: {
				cta: "Änderungen speichern",
				cancel: "Abbrechen",
			},

			danger: {
				title: "Gefahrenzone",

				delete: {
					trigger: "Benachrichtigung löschen",
					confirmTitle: "Diese Benachrichtigung löschen?",
					confirmDescription: "Dies kann nicht rückgängig gemacht werden.",
					confirm: "Löschen",
				},
			},
		},

		logout: {
			title: "Sind Sie sicher, dass Sie sich abmelden möchten?",
			cta: "Abmelden",
		},

		splat: {
			notFound: {
				title: "Nicht gefunden",
				description: "Die gesuchte Seite existiert nicht.",
			},
		},

		account: {
			meta: {
				title: "Konto - Uptime",
				description: "Verwalten Sie Ihre Kontoeinstellungen und Teams.",
			},

			header: {
				title: "Konto",
			},

			form: {
				actions: {
					cancel: "Abbrechen",
				},
			},

			profile: {
				title: "Profil",
				description: "Ihre persönlichen Informationen.",

				card: {
					title: "Profildetails",
					description: "Ihr Name, Ihre E-Mail-Adresse und Ihr Avatar.",
				},
			},

			language: {
				title: "Spracheinstellung",
				description: "Wählen Sie Ihre bevorzugte Sprache für die Oberfläche.",

				card: {
					title: "Sprache",
					description: "Gilt für das Dashboard und E-Mail-Benachrichtigungen.",
				},

				form: {
					fields: {
						language: {
							label: "Bevorzugte Sprache",
							description:
								"Wählen Sie Ihre bevorzugte Sprache. Automatische Erkennung verwendet Ihre Browser-Einstellungen.",
							options: {
								auto: "Automatisch erkennen",
								en: "English",
								es: "Español",
								de: "Deutsch",
								ja: "Japanisch",
								fr: "Français",
								it: "Italiano",
							},
						},
					},

					cta: "Sprache speichern",
				},
			},

			teams: {
				title: "Ihre Teams",
				description: "Teams, bei denen Sie Mitglied sind.",

				actions: {
					createTeam: "Team erstellen",
				},

				empty: {
					title: "Noch keine Teams",
					description: "Erstellen Sie ein Team, um mit der Überwachung Ihrer Dienste zu beginnen.",
					cta: "Team erstellen",
				},

				table: {
					label: "Teams",
					description: "Alle Teams, denen Sie angehören.",

					columns: {
						team: "Team",
						role: "Rolle",
						actions: "Aktionen",
					},

					role: {
						member: "Mitglied",
						admin: "Admin",
						owner: "Eigentümer",
					},

					actions: {
						menu: "Aktionsmenü",
						leave: "Team verlassen",
					},

					confirmation: {
						leaveTeam: "Sind Sie sicher, dass Sie {{name}} verlassen möchten?",
					},
				},
			},
		},

		createTeam: {
			header: {
				title: "Team erstellen",
				description: "Erstellen Sie ein neues Team zur Überwachung Ihrer Dienste.",
			},

			dialog: {
				close: "Dialog schließen",
			},

			form: {
				fields: {
					name: {
						label: "Team-Name",
						placeholder: "Mein großartiges Team",
						description: "Wählen Sie einen Namen für Ihr neues Team.",
					},
				},

				cancel: "Abbrechen",
				cta: "Team erstellen",
			},
		},

		settings: {
			header: {
				title: "Team-Einstellungen",
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			sections: {
				general: {
					title: "Allgemein",
					description: "Verwalten Sie die grundlegenden Informationen Ihres Teams.",
				},
			},

			form: {
				card: {
					title: "Team-Profil",
					description: "Aktualisieren Sie den Namen und das Logo Ihres Teams.",
				},

				fields: {
					logo: {
						label: "Logo-URL",
						placeholder: "https://beispiel.de/logo.png",
						description: "Eine URL zum Logo-Bild Ihres Teams.",
					},
					name: {
						label: "Team-Name",
						placeholder: "Mein Team",
						description: "Der Name Ihres Teams.",
					},
				},

				actions: {
					cancel: "Abbrechen",
					save: "Änderungen speichern",
				},
			},

			members: {
				title: "Mitglieder",
				description: "Verwalten Sie Ihre Team-Mitglieder und deren Rollen.",

				actions: {
					invite: "Mitglied einladen",
				},

				table: {
					label: "Aktuelle Mitglieder",
					description: "Personen, die Zugang zu diesem Team haben.",

					columns: {
						name: "Name",
						role: "Rolle",
						actions: "Aktionen",
					},

					role: {
						member: "Mitglied",
						admin: "Admin",
						owner: "Eigentümer",
					},

					actions: {
						menu: "Aktionsmenü",
						remove: "Aus Team entfernen",
						transfer: "Eigentum übertragen",
						changeRole: {
							member: "Zu Admin konvertieren",
							admin: "Zu Mitglied konvertieren",
							owner: "Eigentümer kann nicht geändert werden",
						},
					},

					confirmation: {
						removeMember: "Sind Sie sicher, dass Sie {{name}} aus dem Team entfernen möchten?",
					},
				},

				invitedTable: {
					label: "Ausstehende Einladungen",
					description: "Personen, die eingeladen wurden, aber noch nicht beigetreten sind.",

					columns: {
						email: "E-Mail",
						expires: "Läuft ab",
						actions: "Aktionen",
					},

					expires: {
						expired: "Abgelaufen",
					},

					actions: {
						menu: "Aktionsmenü",
						copy: "Einladungslink kopieren",
						revoke: "Einladung widerrufen",
					},

					confirmation: {
						revokeInvite:
							"Sind Sie sicher, dass Sie die Einladung von {{email}} widerrufen möchten?",
					},

					empty: {
						description: "Keine ausstehenden Einladungen.",
					},
				},
			},

			domains: {
				title: "Domains",
				description: "Verwalten Sie verifizierte Domains für Ihr Team.",

				actions: {
					addDomain: "Domain hinzufügen",
				},

				table: {
					label: "Verifizierte Domains",
					description:
						"Domains, die für die automatische Bereitstellung von Team-Mitgliedern verwendet werden können.",

					columns: {
						hostname: "Hostname",
						id: "Verifizierungs-ID",
						verifiedAt: "Verifiziert am",
						actions: "Aktionen",
					},

					verifiedAt: {
						pending: "Wartet auf Verifizierung",
					},

					actions: {
						menu: "Aktionsmenü",
						copy: "Verifizierungs-ID kopieren",
						remove: "Domain entfernen",
						retryVerification: "Verifizierung wiederholen",
					},

					confirmation: {
						removeDomain: "Sind Sie sicher, dass Sie {{hostname}} aus dem Team entfernen möchten?",
					},

					empty: {
						description: "Noch keine verifizierten Domains.",
					},
				},

				form: {
					title: "Domain hinzufügen",

					fields: {
						hostname: {
							label: "Domain",
							placeholder: "beispiel.de",
							description: "Die Domain, die Sie zu {{team}} hinzufügen möchten.",
						},
					},

					cta: "Domain hinzufügen",
				},

				instructions: {
					title: "So verifizieren Sie Ihre Domain",
					description:
						"Um Ihre Domain zu verifizieren, fügen Sie den folgenden TXT-Eintrag zu Ihren DNS-Einstellungen hinzu:",

					record: {
						name: {
							label: "Name",
							value: "_ping-verification",
						},
						content: {
							label: "Inhalt",
							value: "VERIFICATION_ID",
						},
					},

					note: "Stellen Sie sicher, dass Sie <code>VERIFICATION_ID</code> durch die oben angezeigte tatsächliche Verifizierungs-ID ersetzen.",
					disclaimer:
						"DNS-Änderungen können einige Zeit zur Propagierung benötigen, daher kann sich die Verifizierung verzögern.",
				},
			},

			billing: {
				title: "Abrechnung",
				description: "Verwalten Sie Ihr Abonnement und Zahlungsdetails.",

				card: {
					title: "Abonnement & Zahlungen",
					description:
						"Rechnungen anzeigen, Zahlungsmethoden aktualisieren und Ihr Abonnement verwalten.",
					notice:
						"Sie werden zum Kundenportal von Polar weitergeleitet, um Ihre Abrechnungseinstellungen zu verwalten.",
					cta: "Abrechnungsportal öffnen",
				},
			},

			danger: {
				title: "Gefahrenzone",
				description: "Unumkehrbare Aktionen, die Ihr Team betreffen.",

				card: {
					title: "Team löschen",
					description:
						"Löschen Sie dieses Team und alle seine Daten dauerhaft. Diese Aktion kann nicht rückgängig gemacht werden.",
					warning:
						"Dies wird Ihr Abonnement kündigen und alle Monitore, Benachrichtigungen, Domains, Mitglieder und Einladungen löschen.",
					confirmation: {
						label: "Geben Sie DELETE zur Bestätigung ein",
						placeholder: "DELETE",
					},
					cta: "Team löschen",
				},
			},

			error: {
				forbidden: {
					title: "Sie haben keine Berechtigung, auf diese Seite zuzugreifen.",
					description: "Bitte kontaktieren Sie Ihren Team-Administrator für Unterstützung.",
				},

				unknown: {
					title: "Ein unerwarteter Fehler ist aufgetreten.",
					description: "Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.",
				},
			},
		},

		tcpMonitors: {
			header: {
				title: "TCP-Monitore",
				action: {
					create: "TCP-Monitor erstellen",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
				limitation: {
					title: "TCP-Überwachungsbeschränkung",
					description:
						"TCP-Port-Überwachung erfordert den kostenpflichtigen Cloudflare Workers-Plan mit Socket-Unterstützung. Im kostenlosen Plan werden TCP-Prüfungen als nicht verfügbar angezeigt. Erwägen Sie HTTP-Überwachung als Alternative.",
				},
			},

			empty: {
				title: "Noch keine TCP-Monitore",
				description:
					"Erstellen Sie einen TCP-Monitor, um zu prüfen, ob Ports offen und reaktionsfähig sind.",
				cta: "TCP-Monitor erstellen",
			},

			table: {
				label: "TCP-Monitore",
				columns: {
					name: "Name",
					endpoint: "Host:Port",
					status: "Status",
					lastChecked: "Zuletzt geprüft",
					responseTime: "Antwortzeit",
					actions: "Aktionen",
				},
				status: {
					up: "Aktiv",
					down: "Ausgefallen",
					timeout: "Zeitüberschreitung",
					disabled: "Deaktiviert",
					pending: "Ausstehend",
				},
				actions: {
					edit: "Bearbeiten",
					delete: "Löschen",
					confirmation: {
						delete: "Sind Sie sicher, dass Sie {{name}} löschen möchten?",
					},
				},
			},
		},

		createTcpMonitor: {
			header: {
				title: "TCP-Monitor erstellen",
				breadcrumb: {
					tcpMonitors: "TCP-Monitore",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Datenbankserver",
						description: "Ein beschreibender Name für diesen TCP-Monitor.",
					},
					host: {
						label: "Host",
						placeholder: "db.beispiel.de",
						description: "Der Hostname oder die IP-Adresse zur Überwachung.",
					},
					port: {
						label: "Port",
						placeholder: "5432",
						description: "Der zu prüfende TCP-Port (1-65535).",
						decrement: "Port verringern",
						increment: "Port erhöhen",
					},
					interval: {
						label: "Prüfintervall",
						description: "Wie oft der Port geprüft werden soll.",
						decrement: "Prüfintervall verringern",
						increment: "Prüfintervall erhöhen",
					},
					timeout: {
						label: "Verbindungs-Timeout",
						description:
							"Wie lange auf eine Verbindung gewartet wird, bevor eine Zeitüberschreitung auftritt.",
						decrement: "Verbindungs-Timeout verringern",
						increment: "Verbindungs-Timeout erhöhen",
					},
				},
				cta: "Monitor erstellen",
			},
		},

		editTcpMonitor: {
			header: {
				title: "TCP-Monitor bearbeiten",
				breadcrumb: {
					tcpMonitors: "TCP-Monitore",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Datenbankserver",
						description: "Ein beschreibender Name für diesen TCP-Monitor.",
					},
					host: {
						label: "Host",
						placeholder: "db.beispiel.de",
						description: "Der Hostname oder die IP-Adresse zur Überwachung.",
					},
					port: {
						label: "Port",
						placeholder: "5432",
						description: "Der zu prüfende TCP-Port (1-65535).",
						decrement: "Port verringern",
						increment: "Port erhöhen",
					},
					interval: {
						label: "Prüfintervall",
						description: "Wie oft der Port geprüft werden soll.",
						decrement: "Prüfintervall verringern",
						increment: "Prüfintervall erhöhen",
					},
					timeout: {
						label: "Verbindungs-Timeout",
						description:
							"Wie lange auf eine Verbindung gewartet wird, bevor eine Zeitüberschreitung auftritt.",
						decrement: "Verbindungs-Timeout verringern",
						increment: "Verbindungs-Timeout erhöhen",
					},
					isEnabled: {
						label: "Überwachung aktivieren",
					},
				},
				cancel: "Abbrechen",
				cta: "Änderungen speichern",
			},

			danger: {
				title: "Gefahrenzone",
				cta: "Monitor löschen",
				description:
					"Dadurch wird auch der Prüfergebnisverlauf gelöscht. Dies kann nicht rückgängig gemacht werden.",
			},
		},

		tcpMonitorDetail: {
			header: {
				breadcrumb: {
					tcpMonitors: "TCP-Monitore",
				},
				action: {
					edit: "Bearbeiten",
					checkNow: "Jetzt prüfen",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			info: {
				title: "Monitor-Konfiguration",
				endpoint: "Endpunkt",
				status: "Status",
				interval: "Prüfintervall",
				timeout: "Timeout",
			},

			stats: {
				uptime: {
					label: "Uptime",
					description: "Basierend auf den letzten Prüfungen",
				},
				avgResponseTime: {
					label: "Durchschn. Antwortzeit",
					description: "Durchschnittliche Verbindungszeit",
				},
				totalChecks: {
					label: "Gesamtprüfungen",
					description: "Anzahl der durchgeführten Prüfungen",
				},
			},

			history: {
				title: "Uptime-Verlauf",
			},

			results: {
				title: "Prüfverlauf",
				description: "Aktuelle TCP-Verbindungsprüfungsergebnisse",
				label: "Ergebnisse",
				empty: "Noch keine Prüfergebnisse. Ergebnisse erscheinen nach der ersten Prüfung.",
				columns: {
					time: "Zeit",
					status: "Status",
					responseTime: "Antwortzeit",
					error: "Fehler",
				},
			},
		},

		apiKeys: {
			header: {
				title: "API-Schlüssel",
				action: {
					create: "API-Schlüssel erstellen",
				},
			},

			docsLink: {
				text: "Erfahre, wie du API-Schlüssel verwendest, in unserer",
				link: "Dokumentation",
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			empty: {
				title: "Noch keine API-Schlüssel",
				description:
					"Erstellen Sie einen API-Schlüssel, um programmgesteuert auf die Uptime-API zuzugreifen.",
				cta: "API-Schlüssel erstellen",
			},

			newKey: {
				title: "API-Schlüssel '{{name}}' erstellt!",
				description:
					"Kopieren Sie diesen Schlüssel jetzt. Aus Sicherheitsgründen können Sie ihn nicht erneut sehen.",
				dismiss: "Ich habe meinen Schlüssel kopiert",
				copyLabel: "Schlüssel kopieren",
			},

			form: {
				title: "Neuen API-Schlüssel erstellen",
				description:
					"API-Schlüssel ermöglichen programmgesteuerten Zugriff auf Ihre Monitore und Benachrichtigungen.",

				fields: {
					name: {
						label: "Schlüsselname",
						placeholder: "Produktions-API-Schlüssel",
						description: "Ein Name zur Identifizierung dieses API-Schlüssels.",
					},
					scopes: {
						label: "Berechtigungen",
						description: "Wählen Sie, worauf dieser API-Schlüssel zugreifen kann.",
						options: {
							"monitors:read": "Monitore lesen",
							"monitors:write": "Monitore schreiben",
							"alerts:read": "Benachrichtigungen lesen",
							"alerts:write": "Benachrichtigungen schreiben",
							"cron-jobs:read": "Cron Jobs lesen",
							"cron-jobs:write": "Cron Jobs schreiben",
							"cron-jobs:ping": "Cron Jobs Ping",
						},
					},
					expiresAt: {
						label: "Ablaufdatum (optional)",
						description: "Leer lassen für einen Schlüssel, der nie abläuft.",
					},
				},

				actions: {
					cancel: "Abbrechen",
					create: "API-Schlüssel erstellen",
				},
			},

			table: {
				label: "API-Schlüssel",

				columns: {
					name: "Name",
					prefix: "Schlüssel",
					scopes: "Berechtigungen",
					lastUsed: "Zuletzt verwendet",
					expires: "Läuft ab",
					actions: "Aktionen",
				},

				lastUsed: {
					never: "Nie",
				},

				expires: {
					never: "Nie",
				},

				actions: {
					menu: "Aktionsmenü",
					delete: "Schlüssel löschen",
				},

				confirmation: {
					delete:
						"Sind Sie sicher, dass Sie den API-Schlüssel '{{name}}' löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",
				},
			},

			error: {
				forbidden: {
					title: "Sie haben keine Berechtigung, auf diese Seite zuzugreifen.",
					description: "Bitte kontaktieren Sie Ihren Team-Administrator für Unterstützung.",
				},

				unknown: {
					title: "Ein unerwarteter Fehler ist aufgetreten.",
					description: "Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.",
				},
			},
		},

		cronJobs: {
			header: {
				title: "Cron Jobs",
				action: {
					create: "Cron Job erstellen",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			empty: {
				title: "Noch keine Cron Jobs",
				description:
					"Erstellen Sie einen Cron Job Monitor, um Ihre geplanten Aufgaben zu verfolgen.",
				cta: "Cron Job erstellen",
			},

			table: {
				label: "Cron Job Monitore",
				columns: {
					name: "Name",
					schedule: "Zeitplan",
					status: "Status",
					lastPing: "Letzter Ping",
					nextExpected: "Nächster Erwartet",
					actions: "Aktionen",
				},
				status: {
					healthy: "Gesund",
					late: "Verspätet",
					missed: "Verpasst",
					new: "Neu",
				},
				disabled: "Deaktiviert",
				actions: {
					edit: "Bearbeiten",
					delete: "Löschen",
					confirmation: {
						delete: "Sind Sie sicher, dass Sie {{name}} löschen möchten?",
					},
				},
			},
		},

		createCronJob: {
			header: {
				title: "Cron Job erstellen",
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				fields: {
					name: {
						label: "Name",
						placeholder: "Tägliches Backup",
						description: "Ein beschreibender Name für diesen Cron Job Monitor.",
					},
					description: {
						label: "Beschreibung",
						placeholder: "Optionale Beschreibung, was dieser Job tut",
						description: "Eine optionale Beschreibung zur Identifizierung dieses Cron Jobs.",
					},
					cronExpression: {
						label: "Cron-Ausdruck",
						placeholder: "0 * * * *",
						description: "Der Cron-Zeitplanausdruck (z.B. '0 * * * *' für jede Stunde).",
					},
					preset: {
						label: "Häufige Voreinstellungen",
						description:
							"Wählen Sie einen häufigen Zeitplan oder geben Sie einen benutzerdefinierten Ausdruck ein.",
						options: {
							custom: "Benutzerdefiniert",
							everyMinute: "Jede Minute",
							every5Minutes: "Alle 5 Minuten",
							every15Minutes: "Alle 15 Minuten",
							everyHour: "Jede Stunde",
							everyDay: "Täglich um Mitternacht",
							everyWeek: "Wöchentlich (Sonntag Mitternacht)",
						},
					},
					gracePeriod: {
						label: "Karenzzeit",
						description:
							"Wie lange nach der erwarteten Zeit gewartet werden soll, bevor als verspätet markiert wird.",
						decrement: "Karenzzeit verringern",
						increment: "Karenzzeit erhöhen",
						unit: {
							minutes: "Minuten",
							seconds: "Sekunden",
						},
					},
					timezone: {
						label: "Zeitzone",
						placeholder: "Zeitzone auswählen",
						description: "Die Zeitzone für den Cron-Zeitplan.",
					},
					alertOnLate: {
						label: "Bei Verspätung benachrichtigen",
						description:
							"Eine Benachrichtigung senden, wenn der Job seine erwartete Zeit verpasst.",
					},
					enabled: {
						label: "Aktiviert",
						description: "Diesen Cron Job sofort überwachen.",
					},
				},
				cta: "Cron Job erstellen",
			},
		},

		editCronJob: {
			header: {
				title: "Cron Job bearbeiten",
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				fields: {
					name: {
						label: "Name",
						placeholder: "Tägliches Backup",
						description: "Ein beschreibender Name für diesen Cron Job Monitor.",
					},
					description: {
						label: "Beschreibung",
						placeholder: "Optionale Beschreibung, was dieser Job tut",
						description: "Eine optionale Beschreibung zur Identifizierung dieses Cron Jobs.",
					},
					cronExpression: {
						label: "Cron-Ausdruck",
						placeholder: "0 * * * *",
						description: "Der Cron-Zeitplanausdruck (z.B. '0 * * * *' für jede Stunde).",
					},
					preset: {
						label: "Häufige Voreinstellungen",
						description:
							"Wählen Sie einen häufigen Zeitplan oder geben Sie einen benutzerdefinierten Ausdruck ein.",
						options: {
							custom: "Benutzerdefiniert",
							everyMinute: "Jede Minute",
							every5Minutes: "Alle 5 Minuten",
							every15Minutes: "Alle 15 Minuten",
							everyHour: "Jede Stunde",
							everyDay: "Täglich um Mitternacht",
							everyWeek: "Wöchentlich (Sonntag Mitternacht)",
						},
					},
					gracePeriod: {
						label: "Karenzzeit",
						description:
							"Wie lange nach der erwarteten Zeit gewartet werden soll, bevor als verspätet markiert wird.",
						decrement: "Karenzzeit verringern",
						increment: "Karenzzeit erhöhen",
						unit: {
							minutes: "Minuten",
							seconds: "Sekunden",
						},
					},
					timezone: {
						label: "Zeitzone",
						placeholder: "Zeitzone auswählen",
						description: "Die Zeitzone für den Cron-Zeitplan.",
					},
					alertOnLate: {
						label: "Bei Verspätung benachrichtigen",
						description:
							"Eine Benachrichtigung senden, wenn der Job seine erwartete Zeit verpasst.",
					},
					enabled: {
						label: "Aktiviert",
						description: "Ob dieser Cron Job aktiv überwacht werden soll.",
					},
				},
				cancel: "Abbrechen",
				cta: "Änderungen speichern",
			},

			danger: {
				title: "Gefahrenzone",

				delete: {
					trigger: "Monitor löschen",
					confirmTitle: "Diesen Cron-Job-Monitor löschen?",
					confirmDescription:
						"Dies löscht auch dessen Ping-Verlauf. Dies kann nicht rückgängig gemacht werden.",
					confirm: "Löschen",
				},
			},
		},

		cronJobDetail: {
			header: {
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
				action: {
					edit: "Bearbeiten",
					delete: "Löschen",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			info: {
				title: "Cron Job Konfiguration",
				schedule: "Zeitplan",
				timezone: "Zeitzone",
				status: "Status",
				gracePeriod: "Karenzzeit",
				description: "Beschreibung",
			},

			stats: {
				totalPings: {
					label: "Gesamt Pings",
					description: "Anzahl empfangener Pings",
				},
				onTimeRate: {
					label: "Pünktlichkeitsrate",
					description: "Prozentsatz pünktlicher Pings",
				},
				lastPing: {
					label: "Letzter Ping",
					description: "Wann der letzte Ping empfangen wurde",
					never: "Nie",
				},
				nextExpected: {
					label: "Nächster Erwartet",
					description: "Wann der nächste Ping erwartet wird",
				},
			},

			ping: {
				title: "Diesen Monitor pingen",
				description:
					"Lassen Sie Ihren Job nach Abschluss eine POST-Anfrage hierher senden. Keine Authentifizierung erforderlich — behandeln Sie diese URL als Geheimnis.",
			},

			uptimeHistory: "Verlauf der Betriebszeit",

			pings: {
				title: "Ping-Verlauf",
				description: "Kürzlich empfangene Pings von diesem Cron Job",
				empty:
					"Noch keine Pings empfangen. Pings werden hier angezeigt, nachdem Ihr Job seinen ersten Ping gesendet hat.",
				label: "Pings",
				columns: {
					time: "Zeit",
					status: "Status",
					sourceIp: "Quell-IP",
				},
				status: {
					onTime: "Pünktlich",
					late: "Verspätet",
				},
			},

			integration: {
				title: "Integrations-Anleitung",
				description:
					"Senden Sie eine POST-Anfrage an diesen Endpunkt, wenn Ihr Cron Job abgeschlossen ist.",
				endpoint: "Ping-Endpunkt",
				curlExample: "cURL-Beispiel",
				codeExamples: {
					title: "Code-Beispiele",
					bash: "Bash / Cron",
					python: "Python",
					nodejs: "Node.js",
				},
				apiKeyNote:
					"Sie benötigen einen API-Schlüssel mit dem Bereich 'cron-jobs:ping'. Erstellen Sie einen in den API-Schlüssel-Einstellungen.",
			},

			delete: {
				confirmation:
					"Sind Sie sicher, dass Sie {{name}} löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",
			},
		},
	},
};
