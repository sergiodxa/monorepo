/**
 * German (de) translation dictionary for the Uptime app. It maps every UI copy key
 * to its German string across the landing page, dashboard, monitors, alerts, teams,
 * domains, status pages, and toast/error messages. It exists so the interface can be
 * rendered in German, mirroring the shape of the English base dictionary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ApiKeyScope } from "~/database/schema";

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

		try: {
			title: "Prüfen Sie jede URL, kostenlos",
			description:
				"Kein Konto nötig. Wir führen eine Prüfung durch und zeigen genau, was ein Monitor melden würde.",
			label: "URL prüfen",
			placeholder: "https://beispiel.de",
			submit: "Prüfung starten",
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

			try: {
				label: "URL prüfen",
				placeholder: "https://beispiel.de",
				submit: "Prüfung starten",
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

	legal: {
		terms: {
			meta: {
				title: "Nutzungsbedingungen | Uptime",
				description:
					"Nutzungsbedingungen für Uptime, den Uptime-Monitoring-Dienst von Sergio Xalambrí.",
			},

			lastUpdated: "Zuletzt aktualisiert: 11. Februar 2026",
			title: "Nutzungsbedingungen",

			sections: {
				introduction: {
					title: "1. Einleitung",
					body: "Willkommen bei Uptime. Diese Nutzungsbedingungen regeln Ihre Nutzung unseres Uptime-Monitoring-Dienstes, betrieben von Sergio Xalambrí. Mit dem Zugriff auf Uptime oder der Nutzung von Uptime erklären Sie sich mit diesen Bedingungen einverstanden.",
				},
				serviceDescription: {
					title: "2. Leistungsbeschreibung",
					body: "Uptime überwacht die Verfügbarkeit Ihrer Dienste und Ihrer geplanten Aufgaben: HTTP-Endpunkte, DNS, TCP-Ports, SSL-Zertifikate und Cronjobs. So behalten Sie den Zustand Ihrer Dienste und geplanten Aufgaben im Blick. Wir prüfen Ihre Endpunkte aus mehreren Regionen weltweit und benachrichtigen Sie, sobald Probleme erkannt werden.",
				},
				accountTerms: {
					title: "3. Kontobedingungen",
					first:
						"Sie müssen bei der Erstellung eines Kontos zutreffende und vollständige Angaben machen.",
					second:
						"Sie sind für die Sicherheit Ihrer Zugangsdaten und für alle Aktivitäten verantwortlich, die über Ihr Konto stattfinden.",
					third:
						"Sie müssen mindestens 18 Jahre alt oder befugt sein, diese Vereinbarung im Namen einer Organisation rechtsverbindlich abzuschließen.",
					fourth: "Sie müssen uns unverzüglich informieren, wenn Ihr Konto unbefugt genutzt wird.",
				},
				acceptableUse: {
					title: "4. Zulässige Nutzung",
					intro: "Bei der Nutzung von Uptime verpflichten Sie sich, Folgendes zu unterlassen:",
					first:
						"Unseren Dienst missbrauchen, überlasten oder stören oder versuchen, Nutzungsgrenzen zu umgehen.",
					second:
						"URLs oder Endpunkte überwachen, die Ihnen nicht gehören oder für die Sie keine Berechtigung haben.",
					third:
						"Cronjobs oder geplante Aufgaben überwachen, die Ihnen nicht gehören oder für die Sie keine Berechtigung haben.",
					fourth:
						"Cronjob-Ping-Endpunkte für andere Zwecke als die legitime Überwachung geplanter Aufgaben verwenden.",
					fifth: "Den Dienst für rechtswidrige oder unbefugte Zwecke nutzen.",
					sixth:
						"Versuchen, unbefugt auf unsere Systeme oder die Konten anderer Nutzer zuzugreifen.",
					seventh:
						"Den Dienst ohne unsere schriftliche Zustimmung weiterverkaufen oder weitergeben.",
				},
				paymentTerms: {
					title: "5. Zahlungsbedingungen",
					first:
						"Uptime rechnet nutzungsabhängig ab. Sie zahlen entsprechend der Anzahl Ihrer Monitore und der von Ihnen eingestellten Prüfhäufigkeit.",
					second: "Abonnements werden über Polar verwaltet und abgewickelt.",
					third:
						"Wenn Sie kündigen, erstatten wir den nicht genutzten Teil Ihres Abonnements anteilig.",
					fourth:
						"Wir behalten uns vor, die Preise mit einer Frist von 30 Tagen zu ändern. Die weitere Nutzung nach einer Preisänderung gilt als Zustimmung.",
				},
				dataAndPrivacy: {
					title: "6. Daten und Datenschutz",
					firstPrefix: "Für Ihre Nutzung von Uptime gilt außerdem unsere ",
					firstLinkText: "Datenschutzerklärung",
					firstSuffix: ", die beschreibt, wie wir Ihre Daten erheben, verwenden und schützen.",
					second:
						"Monitoring-Daten werden 365 Tage lang aufbewahrt. Danach werden historische Daten automatisch gelöscht.",
					third:
						"Sie können jederzeit die Löschung Ihrer Daten verlangen, indem Sie uns kontaktieren. Nach der Schließung Ihres Kontos werden Ihre Daten innerhalb von 30 Tagen gelöscht.",
				},
				serviceAvailability: {
					title: "7. Verfügbarkeit des Dienstes",
					first:
						"Wir streben eine Verfügbarkeit von 99,9 % an, aber das ist ein Ziel und keine Garantie. Wir bieten keine Service-Level-Agreements (SLAs) mit finanziellen Entschädigungen.",
					second:
						"Wartungsarbeiten kündigen wir nach Möglichkeit rechtzeitig im Voraus an. Notfallwartungen können ohne Ankündigung erfolgen.",
					third:
						"Wir haften nicht für Ausfallzeiten, Datenverluste oder Schäden, die durch geplante oder ungeplante Unterbrechungen des Dienstes entstehen.",
				},
				limitationOfLiability: {
					title: "8. Haftungsbeschränkung",
					first:
						"Uptime wird „wie besehen“ und „wie verfügbar“ bereitgestellt, ohne ausdrückliche oder stillschweigende Gewährleistungen jeglicher Art.",
					second:
						"Wir garantieren nicht, dass unser Dienst jeden Ausfall Ihrer überwachten Endpunkte erkennt. Die Überwachung hängt von Netzwerkbedingungen und anderen Faktoren ab, die außerhalb unserer Kontrolle liegen.",
					third:
						"Unsere Gesamthaftung Ihnen gegenüber für Ansprüche aus der Nutzung des Dienstes ist auf den Betrag begrenzt, den Sie uns in den 12 Monaten vor dem Anspruch gezahlt haben.",
					fourth: "Wir haften nicht für indirekte, zufällige, besondere, Folge- oder Strafschäden.",
				},
				termination: {
					title: "9. Beendigung",
					first:
						"Sie können Ihr Konto jederzeit über Ihre Kontoeinstellungen oder durch eine Nachricht an uns schließen.",
					second:
						"Wir können Ihr Konto sperren oder schließen, wenn Sie gegen diese Bedingungen verstoßen, oder aus anderen Gründen mit angemessener Vorankündigung.",
					third:
						"Mit der Beendigung endet Ihr Zugang zum Dienst und Ihre Daten werden innerhalb von 30 Tagen gelöscht.",
				},
				changesToTerms: {
					title: "10. Änderungen dieser Bedingungen",
					body: "Wir können diese Nutzungsbedingungen von Zeit zu Zeit aktualisieren. Über wesentliche Änderungen informieren wir Sie per E-Mail oder über den Dienst. Wenn Sie Uptime nach Inkrafttreten der Änderungen weiter nutzen, gilt das als Zustimmung zu den überarbeiteten Bedingungen.",
				},
				contact: {
					title: "11. Kontakt",
					prefix:
						"Wenn Sie Fragen zu diesen Nutzungsbedingungen haben, schreiben Sie uns bitte an ",
					email: "hello@sergiodxa.com",
				},
			},
		},
		privacy: {
			meta: {
				title: "Datenschutzerklärung | Uptime",
				description:
					"Datenschutzerklärung für Uptime. Erfahren Sie, wie wir Ihre Daten erheben, verwenden und schützen, wenn Sie unseren Uptime-Monitoring-Dienst nutzen.",
			},

			lastUpdated: "Zuletzt aktualisiert: 2. August 2026",
			title: "Datenschutzerklärung",

			sections: {
				introduction: {
					title: "1. Einleitung",
					first:
						"Diese Datenschutzerklärung beschreibt, wie Uptime, betrieben von Sergio Xalambrí („wir“, „uns“ oder „unser“), Ihre personenbezogenen Daten erhebt, verwendet und schützt, wenn Sie unseren Uptime-Monitoring-Dienst nutzen.",
					second:
						"Diese Erklärung gilt für alle Nutzer unseres Dienstes und umfasst die Daten, die über unsere Website und unsere Monitoring-Plattform erhoben werden.",
				},
				dataCollected: {
					title: "2. Daten, die wir erheben",
					accountData: {
						title: "Kontodaten",
						body: "Wenn Sie sich über die GitHub-Anmeldung registrieren, erheben wir Ihre E-Mail-Adresse und Ihren Anzeigenamen aus Ihrem GitHub-Profil.",
					},
					monitoringData: {
						title: "Monitoring-Daten",
						body: "Wir erheben Daten zu den Monitoren, die Sie anlegen, darunter die URLs, die Sie überwachen möchten, Antwortzeiten, HTTP-Statuscodes sowie Verfügbarkeits- und Ausfallereignisse.",
					},
					cronJobData: {
						title: "Daten zur Cronjob-Überwachung",
						intro: "Für die Überwachung von Cronjobs (geplanten Aufgaben) erheben wir:",
						first: "Ping-Zeitstempel (wann Ihre geplanten Aufgaben ihren Abschluss melden)",
						second: "Quell-IP-Adressen der Ping-Anfragen",
						third: "User-Agent-Angaben aus den Ping-Anfragen",
						fourth: "Zeitplan-Konfiguration (Cron-Ausdrücke, Zeitzonen, Karenzzeiten)",
						outro:
							"Diese Daten helfen Ihnen zu verfolgen, ob Ihre geplanten Aufgaben pünktlich laufen, und ermöglichen es uns, Sie zu benachrichtigen, wenn erwartete Pings ausbleiben.",
					},
					usageData: {
						title: "Nutzungsdaten",
						body: "Wir erheben Analyse- und Protokolldaten darüber, wie Sie unseren Dienst nutzen, darunter Seitenaufrufe, die Nutzung von Funktionen und Fehlerprotokolle.",
					},
					paymentData: {
						title: "Zahlungsdaten",
						body: "Die Zahlungsabwicklung übernimmt Polar. Wir speichern Ihre Kreditkartendaten nicht. Von Polar erhalten wir lediglich eine Bestätigung Ihres Abonnementstatus und Ihrer Rechnungshistorie.",
					},
				},
				dataUsage: {
					title: "3. Wie wir Ihre Daten verwenden",
					first: {
						label: "Um den Monitoring-Dienst bereitzustellen:",
						body: "Wir nutzen Ihre Daten, um die von Ihnen angegebenen URLs zu überwachen und deren Verfügbarkeit zu verfolgen.",
					},
					second: {
						label: "Um Warnungen und Benachrichtigungen zu senden:",
						body: "Wir nutzen Ihre E-Mail-Adresse, um Ihnen Ausfallwarnungen und Statusmeldungen zu schicken.",
					},
					third: {
						label: "Um den Dienst zu verbessern:",
						body: "Wir analysieren Nutzungsmuster, um Funktionen zu verbessern und Fehler zu beheben.",
					},
					fourth: {
						label: "Um mit Ihnen zu kommunizieren:",
						body: "Wir senden Ihnen unter Umständen Produktneuigkeiten, Sicherheitshinweise und Support-Nachrichten.",
					},
				},
				dataSharing: {
					title: "4. Weitergabe von Daten",
					noSell: "Wir verkaufen Ihre personenbezogenen Daten nicht.",
					intro:
						"Wir geben Daten an die folgenden Drittanbieter weiter, die uns beim Betrieb von Uptime unterstützen:",
					first: {
						label: "Cloudflare:",
						body: "Infrastruktur, Hosting und Auslieferung von Inhalten",
					},
					second: { label: "Polar:", body: "Zahlungsabwicklung und Abonnementverwaltung" },
					third: { label: "Resend:", body: "E-Mail-Zustellung für Warnungen und Hinweise" },
					fourth: { label: "GitHub:", body: "Authentifizierung" },
					outro:
						"Wir können Ihre Daten außerdem offenlegen, wenn wir gesetzlich dazu verpflichtet sind oder um unsere Rechte und die Sicherheit unserer Nutzer zu schützen.",
				},
				dataRetention: {
					title: "5. Speicherdauer",
					first: { label: "Monitoring-Daten:", body: "365 Tage ab der Erhebung" },
					second: { label: "Kontodaten:", body: "Bis Sie Ihr Konto löschen" },
					third: { label: "Protokolle:", body: "30 Tage" },
				},
				rights: {
					title: "6. Ihre Rechte (DSGVO)",
					intro: "Nach der Datenschutz-Grundverordnung (DSGVO) haben Sie das Recht:",
					first: {
						label: "Auf Auskunft:",
						body: "Eine Kopie der personenbezogenen Daten anzufordern, die wir über Sie gespeichert haben",
					},
					second: {
						label: "Auf Berichtigung:",
						body: "Die Korrektur unrichtiger personenbezogener Daten zu verlangen",
					},
					third: {
						label: "Auf Löschung:",
						body: "Die Löschung Ihrer personenbezogenen Daten zu verlangen",
					},
					fourth: {
						label: "Auf Datenübertragbarkeit:",
						body: "Ihre Daten in einem übertragbaren Format zu erhalten",
					},
					fifth: {
						label: "Auf Widerspruch:",
						body: "Bestimmten Arten der Datenverarbeitung zu widersprechen",
					},
					outro:
						"Um eines dieser Rechte auszuüben, kontaktieren Sie uns bitte unter der unten angegebenen E-Mail-Adresse.",
				},
				security: {
					title: "7. Sicherheit",
					intro: "Wir setzen angemessene Sicherheitsmaßnahmen ein, um Ihre Daten zu schützen:",
					first: {
						label: "Verschlüsselung bei der Übertragung:",
						body: "Alle Daten werden über HTTPS/TLS übertragen",
					},
					second: {
						label: "Verschlüsselung im Ruhezustand:",
						body: "Gespeicherte Daten sind verschlüsselt",
					},
					third: {
						label: "Zugriffskontrollen:",
						body: "Strenge Zugriffskontrollen begrenzen, wer auf Ihre Daten zugreifen kann",
					},
					fourth: {
						label: "Regelmäßige Sicherheitsprüfungen:",
						body: "Wir überprüfen unsere Sicherheitspraktiken regelmäßig",
					},
				},
				cookies: {
					title: "8. Cookies",
					intro: "Wir verwenden nur die Cookies, die für den Betrieb des Dienstes nötig sind:",
					first: {
						label: "Sitzungs-Cookies:",
						body: "Für die Anmeldung und damit Sie angemeldet bleiben",
					},
					outro:
						"Wir verwenden keine Tracking-Cookies, keine Werbe-Cookies von Dritten und keine Cookies zu Marketingzwecken.",
				},
				turnstile: {
					title: "9. Bot-Schutz",
					first:
						"Die öffentliche Seite, auf der jeder ohne Konto eine URL prüfen kann, ist durch Cloudflare Turnstile geschützt. Es dient dazu, einen Menschen von einem Bot zu unterscheiden, damit die kostenlose Prüfung nicht durch automatisierten Traffic aufgebraucht wird.",
					second:
						"Dazu erhält Cloudflare Ihre IP-Adresse und Informationen über Ihren Browser und speichert möglicherweise ein Token in Ihrem Browser, um sich zu merken, dass die Prüfung bestanden wurde.",
					third:
						"Turnstile läuft ausschließlich auf dieser öffentlichen Seite. In der angemeldeten Anwendung wird es nirgendwo eingesetzt.",
					referencePrefix: "Was Cloudflare mit diesen Daten macht, steht im ",
					referenceLinkText: "Turnstile-Datenschutzzusatz",
					referenceSuffix: " von Cloudflare.",
				},
				childrensPrivacy: {
					title: "10. Datenschutz für Kinder",
					body: "Uptime ist nicht für Personen unter 18 Jahren bestimmt. Wir erheben wissentlich keine personenbezogenen Daten von Kindern unter 18 Jahren.",
				},
				internationalTransfers: {
					title: "11. Internationale Datenübermittlung",
					first:
						"Ihre Daten werden möglicherweise über das globale Netzwerk von Cloudflare verarbeitet. Wenn Sie sich in der Europäischen Union befinden, können Ihre Daten in die Vereinigten Staaten übermittelt und dort verarbeitet werden.",
					second:
						"Wir stützen uns auf die Standardvertragsklauseln von Cloudflare und weitere geeignete Garantien, damit Ihre Daten im Einklang mit den Anforderungen der DSGVO geschützt sind.",
				},
				changesToPolicy: {
					title: "12. Änderungen dieser Erklärung",
					first:
						"Wir können diese Datenschutzerklärung von Zeit zu Zeit aktualisieren. Über wesentliche Änderungen informieren wir Sie, indem wir die neue Fassung auf dieser Seite veröffentlichen und das Datum unter „Zuletzt aktualisiert“ anpassen.",
					second:
						"Bei erheblichen Änderungen schicken wir Ihnen zusätzlich eine E-Mail-Benachrichtigung, wenn Sie ein Konto bei uns haben.",
				},
				contact: {
					title: "13. Kontakt",
					body: "Wenn Sie Fragen zu dieser Datenschutzerklärung haben oder Ihre Datenrechte ausüben möchten, erreichen Sie uns unter:",
					email: "privacy@sergiodxa.com",
				},
			},
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
		uptimeBar: {
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

	emails: {
		teamInvite: {
			subject: "Sie wurden eingeladen, {{team}} auf Uptime beizutreten",
			preview: "{{team}} auf Uptime beitreten",
			heading: "Sie wurden eingeladen, {{team}} beizutreten",
			body: "{{team}} nutzt Uptime, um seine Dienste im Blick zu behalten. Nehmen Sie die Einladung an, um dem Team beizutreten.",
			action: "Einladung annehmen",
			footer:
				"Sie erhalten diese E-Mail, weil Sie jemand in sein Team auf Uptime eingeladen hat. Falls Sie damit nicht gerechnet haben, können Sie diese Nachricht ignorieren.",
		},

		alert: {
			subject: "[Uptime-Alarm] {{monitor}} ist {{status}}",
			preview: "{{monitor}} ist {{status}}",
			heading: "{{monitor}} ist {{status}}",
			action: "Dashboard öffnen",
			incident:
				"Benachrichtigungen für diesen Vorfall: {{sent}} gesendet, {{suppressed}} durch die Abkühlzeit und das Limit von {{cap}} pro Vorfall unterdrückt.",
			footer:
				"Sie erhalten diese E-Mail, weil eine der Benachrichtigungen Ihres Teams zu diesem Ereignis passt.",

			status: {
				up: "WIEDERHERGESTELLT",
				down: "AUSGEFALLEN",
				degraded: "BEEINTRÄCHTIGT",
			},

			fields: {
				monitor: "Monitor",
				status: "Status",
				time: "Zeit",
				url: "URL",
				responseStatus: "Antwortstatus",
				responseTime: "Antwortzeit",
				domain: "Domain",
				resolvedValue: "Aufgelöster Wert",
				endpoint: "Endpunkt",
				schedule: "Zeitplan",
				lastPing: "Letzter Ping",
				nextExpected: "Nächster erwarteter Ping",
				hostname: "Hostname",
				expiresAt: "Läuft ab am",
			},

			values: {
				none: "—",
				never: "nie",
				monitor: "{{name}} ({{type}})",
				responseStatus: "{{actual}} (erwartet {{expected}})",
				milliseconds: "{{value}}ms",
				domain: "{{domain}} ({{recordType}})",
				endpoint: "{{host}}:{{port}}",
				schedule: "{{expression}} ({{timezone}})",
			},
		},

		trial: {
			stopAction: "Diese E-Mails beenden",
			stop: "Ein Klick beendet alle URLs, um deren Beobachtung Sie uns gebeten haben, und löscht Ihre Adresse samt Daten. Sie können jederzeit über unsere Website neu beginnen.",

			status: {
				up: "ERREICHBAR",
				degraded: "BEEINTRÄCHTIGT",
				down: "AUSGEFALLEN",
			},

			fields: {
				url: "URL",
				status: "Status",
				previousStatus: "Vorheriger Status",
				responseStatus: "Antwortstatus",
				responseTime: "Antwortzeit",
				checkedAt: "Geprüft am",
				changedAt: "Geändert am",
				checks: "Durchgeführte Prüfungen",
				uptime: "Verfügbarkeit",
				slowest: "Langsamste Antwort",
			},

			values: {
				none: "—",
				milliseconds: "{{value}}ms",
				percentage: "{{value}}%",
			},

			bar: {
				uptime: "{{value}}% Verfügbarkeit",
				legend: {
					up: "Erreichbar",
					degraded: "Beeinträchtigt",
					down: "Ausgefallen",
					noData: "Keine Daten",
				},
			},

			confirmation: {
				subject: "Wir prüfen {{url}} jetzt stündlich",
				preview: "Die stündlichen Prüfungen von {{url}} haben begonnen",
				heading: "Wir prüfen {{url}} jetzt stündlich",
				body: "Das ist die Prüfung, die Sie gerade ausgeführt haben. Wir wiederholen sie stündlich bis zum {{until}} und schreiben Ihnen, sobald sich das Ergebnis ändert. Einmal täglich erhalten Sie außerdem eine Zusammenfassung.",
				footer:
					"Sie erhalten diese E-Mail, weil Sie uns auf unserer Website gebeten haben, diese URL zu prüfen.",
			},

			change: {
				subject: "{{url}} ist {{status}}",
				preview: "{{url}} ist {{status}}",
				heading: "{{url}} ist {{status}}",
				body: "Die stündliche Prüfung um {{time}} hat ein anderes Ergebnis geliefert als die vorherige.",
				footer:
					"Sie erhalten diese E-Mail, weil Sie uns gebeten haben, diese URL eine Woche lang zu beobachten.",
			},

			daily: {
				subject: "Täglicher Bericht: {{url}}",
				subjectMany: "Täglicher Bericht: {{total}} URLs",
				preview: "Die letzten 24 Stunden an Prüfungen von {{url}}",
				previewMany: "Die letzten 24 Stunden an Prüfungen von {{total}} URLs",
				heading: "{{url}} in den letzten 24 Stunden",
				headingMany: "Ihre {{total}} URLs in den letzten 24 Stunden",
				summaryAll: "Alle {{total}} waren bei der letzten Prüfung erreichbar.",
				summary: "{{up}} von {{total}} waren bei der letzten Prüfung erreichbar.",
				target: "{{url}} — {{status}}",
				rangeStart: "Vor 24 Stunden",
				rangeEnd: "Jetzt",
				footer:
					"Sie erhalten diese E-Mail, weil Sie uns auf unserer Website um diese Prüfungen gebeten haben.",
			},

			weekly: {
				subject: "Bericht über sieben Tage: {{url}}",
				preview: "Die vollständige Woche an Prüfungen von {{url}}",
				heading: "{{url}} in den letzten sieben Tagen",
				rangeStart: "Vor 7 Tagen",
				rangeEnd: "Heute",
				closing: "Das war der siebte Tag, damit enden die kostenlosen Prüfungen von {{url}} hier.",
				action: "Diese URL weiter prüfen",
				footer:
					"Sie erhalten diese E-Mail, weil Sie uns gebeten haben, diese URL eine Woche lang zu beobachten. Es ist die letzte.",
			},
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

	cron: {
		error: {
			empty: "Geben Sie einen Cron-Ausdruck ein.",
			"field-count":
				"Ein Cron-Ausdruck braucht genau fünf Felder: Minute, Stunde, Tag des Monats, Monat und Wochentag.",
			"seconds-not-supported":
				"Sekunden werden nicht unterstützt. Verwenden Sie das Format mit fünf Feldern, beginnend mit der Minute.",
			"unknown-macro":
				"Diese Kurzform wird nicht unterstützt. Verwenden Sie @hourly, @daily, @weekly, @monthly oder @yearly.",
			syntax: "Eines der Felder ist weder ein Wert noch ein Bereich, eine Liste oder ein Schritt.",
			"unknown-name":
				"Einer der Monats- oder Wochentagsnamen ist unbekannt. Verwenden Sie dreibuchstabige Abkürzungen wie JAN oder MON.",
			"out-of-range": "Einer der Werte liegt außerhalb des für sein Feld erlaubten Bereichs.",
			"reversed-range": "Einer der Bereiche beginnt nach seinem Ende.",
			"invalid-step": "Ein Schritt muss eine ganze Zahl größer als null sein.",
			"impossible-date": "Dieser Tag des Monats kommt im angegebenen Monat nie vor.",
		},
	},

	schedule: {
		interval: {
			minute_one: "Jede Minute",
			minute_other: "Alle {{count}} Minuten",
			hour_one: "Jede Stunde",
			hour_other: "Alle {{count}} Stunden",
		},
		hourly: {
			onTheHour: "Jede Stunde",
			atMinutes: "Jede Stunde zur Minute {{minutes}}",
		},
		daily: "Täglich um {{times}}",
		weekly: "Jeden {{days}} um {{times}}",
		monthly: "Monatlich am {{days}}. um {{times}}",
		yearly: "Jährlich am {{days}}. {{months}} um {{times}}",
		expression: "Individueller Zeitplan ({{expression}})",
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
			},
			success: "Cron Job '{{name}}' wurde erstellt.",
		},

		updateCronJob: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser Cron Job existiert nicht.",
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

			quickPing: {
				title: "Schnellprüfung",
				description:
					"Prüfen Sie eine URL einmalig. Nichts gespeichert, keine Benachrichtigungen, ein Ping.",
				field: {
					label: "URL",
					placeholder: "https://example.com/healthcheck",
				},
				action: {
					submit: "Prüfung starten",
				},
				result: {
					noResponse: "Keine Antwort",
					status: {
						up: "Aktiv",
						degraded: "Beeinträchtigt",
						down: "Ausgefallen",
					},
				},
				error: {
					invalidUrl: "Geben Sie eine vollständige http:// oder https:// URL ein.",
					subscriptionRequired: "Für eine Prüfung ist ein aktives Abonnement erforderlich.",
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
					skipped_cap: "Übersprungen (Wiederholungslimit)",
					skipped: "Übersprungen",
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

		trial: {
			meta: {
				title: "Eine URL prüfen — Uptime",
				description:
					"Führe eine echte Prüfung einer beliebigen URL aus unserem Netz aus, ohne Konto. Danach beobachten wir sie eine Woche lang.",
			},

			heading: "Prüfe jetzt eine URL",
			intro:
				"Gib eine URL ein und wir führen eine echte Prüfung aus unserem Netz aus — dieselbe, die ein bezahlter Monitor ausführt. Nichts wird gespeichert und nichts berechnet, solange du uns nicht bittest weiterzumachen.",

			form: {
				url: {
					label: "Zu prüfende URL",
					description: "Eine http:// oder https:// Adresse im öffentlichen Internet.",
					placeholder: "https://beispiel.de",
				},
				submit: "Prüfung ausführen",
			},

			refusal: {
				title: "Die Prüfung wurde nicht ausgeführt",
				blockedTarget:
					"Diese Adresse prüfen wir nicht für dich. Es muss eine öffentliche http:// oder https:// URL auf Port 80 oder 443 sein, ohne Benutzername und Passwort, und sie muss auf eine Adresse im offenen Internet auflösen.",
				failedChallenge:
					"Wir konnten nicht bestätigen, dass die Anfrage aus einem Browser kam. Lade die Seite neu und versuche es erneut.",
				rateLimited: "Sie können in einer Minute eine weitere Prüfung starten.",
				rateLimitedFor: "Sie können in {{seconds}} Sekunden eine weitere Prüfung starten.",
				budgetExhausted:
					"Wir haben heute schon alle kostenlosen Prüfungen ausgeführt, die wir an einem Tag ausführen. Das liegt an uns und nicht an deiner URL — komm morgen wieder, oder starte die Überwachung und wir prüfen sie jede Minute.",
				unavailable:
					"Unsere Sonde hat nicht geantwortet, also haben wir nichts über deine URL erfahren. Das liegt an uns und nicht an dir. Versuche es gleich noch einmal.",
			},

			result: {
				checkAnother: "Weitere URL prüfen",
				noResponse: "Keine Antwort",
				httpStatus: "HTTP {{status}}",
				milliseconds: "{{value}} ms",
				checkedAt: "Geprüft am {{time}}",

				redirect: {
					badge: "Leitet weiter",
					title: "Diese URL leitet woanders hin",
					description:
						"Sie hat geantwortet, und zwar mit einem Verweis auf eine andere Adresse. Dorthin sind wir nicht gegangen: wir prüfen nur die URL, die du uns gegeben hast, und genau das verhindert, dass dieses Feld benutzt wird, um irgendwo hinzukommen, wo es nichts zu suchen hat. Prüfe stattdessen das Ziel, dann bekommst du dafür ein echtes Ergebnis.",
					destination: "Sie verweist auf {{url}}",
					action: "Stattdessen die prüfen",
					unknownDestination:
						"Wir haben nicht gelesen, wohin sie verweist. Öffne die URL im Browser, sieh nach, wo du landest, und prüfe diese Adresse hier.",
				},

				status: {
					up: "Erreichbar",
					degraded: "Langsam",
					down: "Ausgefallen",
				},
			},

			lead: {
				title: "E-Mail, sobald sich etwas ändert",
				description:
					"Hinterlasse eine E-Mail-Adresse und wir führen dieselbe Prüfung sieben Tage lang stündlich aus, mit einer Zusammenfassung pro Tag. Ohne Konto und ohne Karte.",
				consent: "Schreibt mir gelegentlich auch über Uptime selbst.",
				consentNote: "Die Prüfungen bekommst du so oder so.",
				promise:
					"Jede E-Mail enthält einen Link, der sie mit einem Klick beendet und deine Adresse löscht.",
				submit: "Diese URL eine Woche beobachten",

				email: {
					label: "E-Mail",
					placeholder: "du@beispiel.de",
					error: "Das sieht nicht nach einer E-Mail-Adresse aus.",
				},
			},

			watching: {
				title: "Wir kümmern uns darum",
				description:
					"Die erste stündliche Prüfung von {{url}} läuft in einer Stunde. Eine Kopie der gerade ausgeführten Prüfung liegt schon in deinem Postfach.",
			},

			benefits: {
				title: "So sieht die Woche aus",
				description:
					"Alles, was dir ein bezahlter Monitor über diese URL sagen würde — kostenlos, sieben Tage lang.",

				list: {
					hourly: {
						title: "Jede Stunde eine Prüfung",
						description:
							"Sieben Tage lang, aus demselben Netz, in dem ein bezahlter Monitor läuft.",
					},
					changes: {
						title: "Eine E-Mail, wenn sich etwas ändert",
						description:
							"Fällt sie aus oder kommt zurück, du erfährst es. Höchstens eine pro Tag, damit eine flatternde Seite dich nicht überschwemmt.",
					},
					digest: {
						title: "Eine Zusammenfassung pro Tag",
						description: "Wie sich deine URL gehalten hat, auf einen Blick.",
					},
					noAccount: {
						title: "Kein Konto, keine Karte",
						description: "Nichts anzumelden, und ein Klick beendet es endgültig.",
					},
				},
			},

			more: {
				title: "Nicht nur Websites",
				description:
					"Die kostenlose Woche deckt HTTP ab. Mit einem bezahlten Konto behalten wir drei weitere Dinge für dich im Auge.",

				list: {
					tcp: {
						title: "TCP",
						description:
							"Wissen, dass ein Port noch antwortet — für alles, was keine Website ist: Datenbanken, Mailserver, Gameserver.",
					},
					dns: {
						title: "DNS",
						description:
							"Wissen, dass ein Eintrag noch dorthin zeigt, wo er soll, damit eine Übernahme oder eine verpatzte Änderung nicht untergeht.",
					},
					cron: {
						title: "Cron-Jobs",
						description:
							"Wissen, dass dein nächtliches Backup fertig geworden ist — und es erfahren in der Nacht, in der es das nicht ist.",
					},
				},
			},

			cta: {
				badge: "Nach der Woche",
				title: "Behalte die Prüfungen, nimm den Rest dazu",
				description:
					"Jede Minute statt jede Stunde, so viele URLs du willst, Benachrichtigungen dort wo du ohnehin arbeitest, Statusseiten und ein Jahr Verlauf. {{price}} im Monat.",
				action: "Überwachung starten",
				pricing: "Preise ansehen",
			},
		},

		unsubscribe: {
			confirm: {
				title: "Diese E-Mails beenden?",
				body: "Das beendet jede Prüfung, die diese Adresse angefordert hat, und löscht die Adresse samt allem, was dazu festgehalten wurde. Nichts bleibt übrig, also gibt es nichts rückgängig zu machen — aber du kannst jederzeit wieder auf unserer Website anfangen.",
				cta: "Ja, beenden und löschen",
			},

			done: {
				title: "Du bist abgemeldet",
				body: "Diese Adresse steht nicht mehr auf unserer Liste und die Prüfungen, die sie angefordert hatte, sind beendet. Es wird nichts mehr dorthin geschickt. Du kannst jederzeit wieder auf unserer Website anfangen.",
				cta: "Zurück zur Website",
			},
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
						descriptions: {
							"teams:read":
								"Name und Logo des Teams lesen sowie seine Mitglieder und deren Rollen auflisten.",
							"teams:write":
								"Name und Logo des Teams ändern. Mitglieder lassen sich damit weder hinzufügen noch entfernen, und das Team nicht löschen.",
							"invites:read":
								"Die Einladungen des Teams auflisten, offene wie angenommene, einschließlich der E-Mail-Adresse, an die jede ging.",
							"invites:write":
								"Eine E-Mail-Adresse ins Team einladen und eine bestehende Einladung zurückziehen. Wer eine Einladung annimmt, wird Mitglied.",
							"team-domains:read":
								"Die vom Team beanspruchten Domains auflisten und ob jede verifiziert ist.",
							"team-domains:write":
								"Eine Domain für das Team beanspruchen oder entfernen. Sobald eine Domain verifiziert ist, tritt jeder, der sich mit einer E-Mail-Adresse dieser Domain registriert, dem Team automatisch bei.",
							"monitors:read":
								"HTTP-Monitore, ihre Prüfergebnisse, ihre Verfügbarkeitsstatistiken und den Gesamtstatus des Teams lesen.",
							"monitors:write":
								"HTTP-Monitore und ihre Inhaltsprüfungen erstellen, ändern und löschen. Zusätzlich lässt sich damit ein Neuaufbau der Tagesstatistiken einreihen.",
							"maintenance:read": "Die Wartungsfenster des Teams auflisten und lesen.",
							"maintenance:write":
								"Wartungsfenster erstellen, ändern, vorzeitig beenden und löschen. Ein laufendes Fenster kann Benachrichtigungen für die abgedeckten Monitore unterdrücken.",
							"dns-monitors:read":
								"DNS-Monitore und die von ihnen aufgezeichneten Auflösungsergebnisse auflisten und lesen.",
							"dns-monitors:write": "DNS-Monitore erstellen, ändern und löschen.",
							"tcp-monitors:read":
								"TCP-Monitore und die von ihnen aufgezeichneten Verbindungsergebnisse auflisten und lesen.",
							"tcp-monitors:write": "TCP-Monitore erstellen, ändern und löschen.",
							"alerts:read":
								"Benachrichtigungen und die von ihnen ausgelösten Ereignisse auflisten und lesen. Webhook-URLs und andere Kanal-Geheimnisse werden nie zurückgegeben.",
							"alerts:write":
								"Benachrichtigungen erstellen, ändern und löschen, samt ihrer Webhook- und Chat-Ziele. Das Löschen einer Benachrichtigung stoppt alles, was sie versendet hat.",
							"status-pages:read":
								"Die Statusseiten des Teams und die jeweils angehängten Monitore auflisten und lesen.",
							"status-pages:write":
								"Statusseiten erstellen, ändern und löschen sowie festlegen, welche Monitore und Cron Jobs eine Seite öffentlich zeigt.",
							"cron-jobs:read": "Die Cron Jobs des Teams und ihre Zeitpläne auflisten und lesen.",
							"cron-jobs:write":
								"Cron Jobs erstellen, ändern und löschen. Wird einer gelöscht, wird seine Ping-URL nicht mehr angenommen.",
							"cron-jobs:ping":
								"Aufgeführt wegen der Ping-URL der Cron Jobs, die öffentlich ist und keinen Bereich prüft. Die Vergabe verschafft einem Schlüssel keinen Zugriff, den er nicht ohnehin hat.",
							"api-keys:read":
								"Die API-Schlüssel des Teams mit Name, Präfix, Bereichen und Ablauf auflisten. Der geheime Schlüssel selbst wird nie zurückgegeben.",
							"api-keys:write":
								"API-Schlüssel des Teams erstellen und löschen. Ein neuer Schlüssel kann jeden Bereich erhalten, dieser hier kann also jede andere Berechtigung vergeben.",
							"ping:trigger":
								"Einmalige HTTP-, DNS- und TCP-Prüfungen ausführen, ohne einen Monitor anzulegen. Jede Prüfung wird als ein Ping abgerechnet und erfordert ein aktives Abonnement.",
						} satisfies Record<ApiKeyScope, string>,
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
				gracePeriodValue: "{{duration}} Karenz",
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
					"Lassen Sie Ihren Job nach Abschluss eine POST-Anfrage hierher senden, mit einem API-Schlüssel mit dem Bereich `cron-jobs:ping`.",
				snippet: {
					curl: "Aus einem Skript",
					copyCurl: "Befehl kopieren",
					crontab: "Aus der Crontab",
					copyCrontab: "Crontab-Zeile kopieren",
				},
				apiKey: {
					text: "Ohne Schlüssel mit diesem Bereich wird der Ping mit einem 401 abgelehnt, und der Lauf gilt trotzdem als verpasst.",
					cta: "API-Schlüssel erstellen",
				},
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
