export default {
	landing: {
		meta: {
			title: "Uptime di Sergio Xalambrí",
			description: "Monitoraggio uptime semplice e affidabile per sviluppatori",
		},

		header: {
			title: "Uptime",

			nav: {
				pricing: "Prezzi",
				features: "Funzionalità",

				cta: {
					in: "Apri Dashboard",
					out: "Inizia il Monitoraggio",
				},
			},
		},

		hero: {
			pill: "Monitora i tuoi servizi con sicurezza",
			title: "Monitora i tuoi servizi <strong>con sicurezza</strong>",
			description:
				"Riceva avvisi istantanei quando i suoi siti web e API vanno offline. Monitora i suoi siti web e API con facilità.",

			cta: {
				in: "Apri Dashboard",
				out: "Inizia il Monitoraggio",
				pricing: "Vedi Prezzi",
			},

			screenshot: {
				alt: "Screenshot di una dashboard di monitoraggio uptime che mostra due servizi con grafici heatmap settimanali. Ogni punto rappresenta un controllo: verde per successo, giallo per misto, rosso per fallimento e grigio per nessun dato. Ogni monitor mostra anche la percentuale di uptime, controlli totali, ultimo controllo e tempo di risposta al 99° percentile",
			},
		},

		features: {
			title: "Monitoraggio Potente Reso Semplice",
			description:
				"Tutto ciò che Le serve per mantenere i suoi servizi attivi senza inutili complessità.",

			list: {
				first: {
					title: "Monitora il tuo uptime",
					description:
						"Traccia i suoi servizi 24/7 con il 99,9% di affidabilità del monitoraggio. Ottenga metriche dettagliate e informazioni sulle prestazioni a colpo d'occhio.",
				},
				second: {
					title: "Riceva avvisi ovunque",
					description:
						"Riceva notifiche istantanee via email, Slack, Discord o webhook quando i suoi servizi subiscono interruzioni o problemi di prestazioni.",
				},
				third: {
					title: "Paghi per quello che usa",
					description:
						"Prezzi trasparenti senza costi nascosti. Scala verso l'alto o verso il basso secondo necessità, con piani che crescono con le sue esigenze di monitoraggio.",
				},
			},
		},

		pricing: {
			title: "Prezzi Semplici e Trasparenti",
			description:
				"Un abbonamento, nessun livello. Paghi solo per quello che usa con il nostro modello di prezzi diretto",

			howItWorks: {
				title: "Come funzionano i prezzi",

				list: {
					first: {
						title: "Abbonamento base",
						description: "$5/mese include i primi 5.000 ping",
					},

					second: {
						title: "Ping aggiuntivi",
						description: "$0,001 per ping dopo i primi 5.000",
					},

					third: {
						title: "Nessun costo nascosto",
						description:
							"Nessun costo aggiuntivo per funzionalità o integrazioni. Paghi per i ping che utilizza.",
					},
				},
			},

			calculator: {
				title: "Calcolatore Prezzi",
				description: "Calcola il costo mensile in base alle sue esigenze di monitoraggio",

				add: "Aggiungi Monitor",

				monitor: {
					label: "Frequenza monitor",
					delete: "Rimuovi",
					frequency: {
						lower: "1m",
						upper: "60m",
					},
				},

				stats: {
					pingsPerMonth: "Ping al mese:",
					baseSubscription: "Abbonamento base",
					includes: "Include i primi {{amount}} ping",
					additionalPings: "Ping aggiuntivi:",
					additionalPingsCost: "{{pings}} × {{costPerPing}}",
					totalCost: "Costo mensile totale:",
				},
			},
		},

		faq: {
			title: "Domande Frequenti",
			description: "Trova risposte alle domande comuni su Uptime",

			list: {
				first: {
					q: "Come monitora Uptime i miei servizi?",
					a: "Uptime invia richieste HTTP o HTTPS regolari ai suoi endpoint. Controlliamo i codici di risposta e i tempi di risposta per determinare se il suo servizio è disponibile e reattivo.",
				},

				second: {
					q: "Cosa succede quando viene rilevata un'interruzione?",
					a: "Quando Uptime rileva un'interruzione, invia immediatamente un avviso attraverso i canali che ha configurato.",
				},

				third: {
					q: "Posso monitorare servizi interni?",
					a: "Sì, purché i suoi servizi interni siano accessibili da internet. Può anche configurare intestazioni personalizzate per autenticare le richieste.",
				},

				fourth: {
					q: "Come posso iniziare?",
					a: "Basta registrarsi, creare il primo monitor e configurare le preferenze di avviso. Sarà operativo in meno di un minuto.",
				},

				fifth: {
					q: "C'è un piano gratuito?",
					a: "Sì! Può creare monitor illimitati e attivare ping manualmente gratuitamente, per sempre. Il monitoraggio automatico programmato richiede un abbonamento.",
				},

				sixth: {
					q: "Per quanto tempo vengono conservati i dati dei ping?",
					a: "Conserviamo i risultati dei suoi ping per 365 giorni. Successivamente vengono eliminati automaticamente.",
				},

				seventh: {
					q: "Posso monitorare servizi che richiedono autenticazione?",
					a: "Sì. Può impostare intestazioni personalizzate con token o credenziali per autenticare le sue richieste.",
				},

				eighth: {
					q: "Posso monitorare più URL?",
					a: "Sì. Basta creare un monitor separato per ogni URL. Ogni monitor può avere la propria frequenza di controllo, metodo HTTP, codice di stato atteso e altro.",
				},

				ninth: {
					q: "Posso monitorare API?",
					a: "Assolutamente. Uptime è progettato per monitorare sia siti web che API. Può impostare l'endpoint, il metodo, le intestazioni e le risposte attese per monitorare efficacemente la sua API.",
				},

				tenth: {
					q: "Posso impostare un timeout per ogni ping?",
					a: "Sì. Può configurare un timeout per ogni monitor. Se la risposta impiega più tempo del previsto, viene considerata un fallimento. Questo aiuta a rilevare servizi lenti.",
				},

				eleventh: {
					q: "Posso mettere in pausa o disabilitare temporaneamente un monitor?",
					a: "Sì. Può mettere in pausa qualsiasi monitor in qualsiasi momento, individualmente.",
				},

				twelfth: {
					q: "Posso testare un monitor subito dopo averlo creato?",
					a: "Sì. Un ping viene automaticamente attivato subito dopo la creazione di un monitor.",
				},

				thirteenth: {
					q: "Supportate le pagine di stato?",
					a: "Sì! Crea pagine di stato pubbliche personalizzabili per condividere lo stato dei suoi servizi con gli utenti. Includa qualsiasi monitor desideri e aggiunga il suo branding.",
				},

				fourteenth: {
					q: "Posso visualizzare i trend storici delle prestazioni?",
					a: "Conserviamo tutti i risultati passati in modo da avere una cronologia completa. I grafici dei trend delle prestazioni sono pianificati per una versione futura.",
				},

				fifteenth: {
					q: "Quali canali di avviso sono supportati?",
					a: "Email, Slack, Discord e webhook. Le integrazioni native rendono facile ricevere avvisi dove il suo team lavora già. I webhook Le permettono di connettersi a qualsiasi altro servizio.",
				},

				sixteenth: {
					q: "Supportate team o monitor condivisi?",
					a: "Sì! Ogni utente inizia con un team. Inviti i membri del team con ruoli diversi (Proprietario, Amministratore, Membro). Il provisioning automatico del dominio aggiunge automaticamente gli utenti con domini email aziendali verificati.",
				},

				seventeenth: {
					q: "Cosa succede se supero i limiti del mio piano?",
					a: "Le verrà addebitato $1 per ogni 1.000 ping oltre i 5.000 inclusi nel suo abbonamento.",
				},

				eighteenth: {
					q: "Memorizzate i body delle richieste o delle risposte?",
					a: "No. Non memorizziamo mai i dati del body. Per maggiore privacy ed efficienza, consigliamo di utilizzare il metodo `HEAD`.",
				},

				nineteenth: {
					q: "Da quali regioni posso monitorare i miei servizi?",
					a: "Uptime supporta il monitoraggio da più regioni: Africa, Asia-Pacifico, Europa Orientale e Occidentale, Nord America Orientale e Occidentale, Medio Oriente, Oceania e Sud America.\n\nPuò scegliere una regione per monitor. La regione è trattata come un suggerimento, il ping effettivo proverrà da un server in quella regione o nelle vicinanze.",
				},
			},
		},

		footer: {
			name: "Uptime",
			description: "Monitoraggio semplice e affidabile per i suoi siti web e API.",
			copyright: "© {{year}} Uptime di Sergio Xalambrí. Tutti i diritti riservati.",
			links: {
				privacy: "Privacy",
				terms: "Termini di Servizio",
				security: "Sicurezza",
			},
		},
	},

	app: {
		meta: {
			title: "Uptime di Sergio Xalambrí",
			description: "Monitoraggio uptime semplice e affidabile per sviluppatori",
		},

		layout: {
			sidebar: {
				teamPicker: { label: "Seleziona Team" },
				userMenu: { label: "Menu Utente" },

				navigation: {
					items: {
						dashboard: "Dashboard",
						alerts: "Avvisi",
						maintenance: "Manutenzione",
						monitors: "Monitor",
						statusPages: "Pagine di Stato",
						tcpMonitors: "Monitor TCP",
						dnsMonitors: "Monitor DNS",
						settings: "Impostazioni",
						billing: "Fatturazione",
						domains: "Domini",
						members: "Membri",
						team: "Team",
						apiKeys: "Chiavi API",
					},
				},

				account: {
					title: "Account",
					overview: "Panoramica",
					teams: "I Suoi Team",
				},
			},
		},

		errors: {
			notFound: {
				title: "404 Non Trovato",
				description: "Il team che sta cercando non esiste.",
			},
		},
	},

	monitorDetail: {
		header: {
			region: "{{emoji}} {{code}}",
		},
		stats: {
			title: "Statistiche",
			uptime: "Uptime",
			totalChecks: "Controlli Totali",
			lastCheck: "Ultimo Controllo",
			p99ResponseTime: "Tempo di Risposta P99",
			p99ResponseTimeValue: "{{value}}",
			neverRan: "N/D",
		},

		actions: {
			refresh: "Aggiorna",
			delete: {
				confirm: "È sicuro di voler eliminare questo monitor?",
				cta: "Elimina Monitor",
			},
		},
	},

	monitorList: {
		header: {
			title: "Monitor Uptime",
			cta: "Crea Monitor",
			subscribe: "I suoi monitor sono in pausa. Si abboni per continuare il monitoraggio",
		},
	},

	dashboard: {
		header: {
			title: "Monitor Uptime",
			cta: "Crea Monitor",
			subscribe: "I suoi monitor sono in pausa. Si abboni per continuare il monitoraggio",
		},

		monitor: {
			stats: {
				title: "Statistiche",
				uptime: "Uptime",
				totalChecks: "Controlli Totali",
				lastCheck: "Ultimo Controllo",
				p99ResponseTime: "Tempo di Risposta P99",
				p99ResponseTimeValue: "{{value}} ms",
				neverRan: "N/D",
			},

			actions: {
				refresh: "Aggiorna",
				delete: {
					confirm: "È sicuro di voler eliminare questo monitor?",
					cta: "Elimina Monitor",
				},
			},
		},
	},

	createMonitor: {
		title: "Crea un Nuovo Monitor",
		fields: {
			name: {
				label: "Nome Monitor",
				placeholder: "Pagina di Atterraggio",
				description: "Un nome descrittivo per il suo monitor.",
			},
			url: {
				label: "URL da Monitorare",
				placeholder: "https://example.com/healthcheck",
				description: "L'URL del servizio che desidera monitorare.",
			},
			method: {
				label: "Metodo di Richiesta",
				placeholder: "HEAD",
				description: "Il metodo HTTP da utilizzare per la richiesta.",
			},
			status: {
				label: "Codice di Stato Atteso",
				placeholder: "200",
				description: "Il codice di stato HTTP che si aspetta di ricevere.",
			},
			interval: {
				label: "Intervallo di Controllo",
				placeholder: "60",
				description: "Intervallo in secondi. Il minimo è 60 secondi.",
			},
			visibility: {
				label: "Visibilità",
				description: "I monitor pubblici possono essere condivisi con chiunque.",
				options: { public: "Pubblico", private: "Privato" },
			},
			region: {
				label: "Regione",
				description: "La regione da cui verrà eseguito il ping.",
				placeholder: "wnam",
				options: {
					afr: "{{emoji}} Africa",
					apac: "{{emoji}} Asia-Pacifico",
					eeur: "{{emoji}} Europa Orientale",
					enam: "{{emoji}} Nord America Orientale",
					me: "{{emoji}} Medio Oriente",
					oc: "{{emoji}} Oceania",
					sam: "{{emoji}} Sud America",
					weur: "{{emoji}} Europa Occidentale",
					wnam: "{{emoji}} Nord America Occidentale",
				},
			},
		},
		cta: "Crea Monitor",
	},

	toasts: {
		refreshMonitor: {
			pending: "Ping di {{name}} in corso...",
			success: "Il ping di {{name}} è terminato.",
			failure: "Ops! Qualcosa è andato storto durante l'esecuzione del monitor.",
		},

		deleteMonitor: {
			success: "{{name}} è stato eliminato.",
			failure: "Non siamo riusciti a eliminare {{name}}. Per favore riprovi.",
		},

		createMonitor: {
			pending: "Creazione del monitor {{name}}...",
			success: "{{name}} è stato creato.",
			failure: "Non siamo riusciti a creare {{name}}. Per favore riprovi.",
		},
	},

	components: {
		heatmap: {
			tooltip: "{{date}}\n{{successRate}} tasso di successo\n{{checks}} controlli",
			legend: {
				success: "Successo",
				failure: "Fallimento",
				mixed: "Misto",
				noData: "Nessun dato",
			},
		},
	},

	actions: {
		addDomain: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito aggiungere domini a questo team.",
				alreadyExists: "{{hostname}} è stato aggiunto il {{verifiedAt}}.",
			},

			success: {
				accepted: "{{hostname}} è ancora in attesa di verifica.",
				created: "{{hostname}} è stato aggiunto a {{team}}. La verifica è in sospeso.",
			},
		},

		changeRole: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito cambiare i ruoli in questo team.",
				cannotChangeOwner: "Non può cambiare il ruolo del proprietario del team.",
			},

			success: "Il ruolo di {{name}} è stato cambiato in {{role}} in {{team}}.",
		},

		createAlert: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito creare avvisi in questo team.",
				limitExceeded: "Ha raggiunto il limite di {{limit}} avvisi in questo team.",
			},
			success: { created: "L'avviso {{name}} è stato creato." },
		},

		createInvite: {
			email: {
				subject: "È stato invitato a unirsi a {{team}} su Uptime",
			},

			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito invitare membri in questo team.",
				alreadyAccepted: "C'è già un membro di {{team}} con questa email.",
			},

			success: "{{email}} è stato invitato a unirsi a {{team}}.",
		},

		createMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
			},

			success: "Il monitor {{name}} è stato creato.",
		},

		updateMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo monitor non esiste.",
			},

			success: "Il monitor {{name}} è stato aggiornato.",
		},

		updateSsl: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo monitor non esiste.",
			},

			success: "Le impostazioni SSL per {{name}} sono state aggiornate.",
		},

		deleteMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito eliminare monitor in questo team.",
				notFound: "Questo monitor non esiste.",
			},
			success: "Il monitor {{name}} è stato eliminato.",
		},

		playMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo monitor non esiste.",
			},

			pending: "Ping di {{name}} in corso...",
			success: "Il ping di {{name}} è terminato.",
			failure: "Ops! Qualcosa è andato storto durante l'esecuzione del monitor.",
		},

		removeAlert: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				forbidden: "Non Le è consentito rimuovere avvisi in questo team.",
				notFound: "{{name}} non esiste.",
			},
			success: "L'avviso {{name}} è stato rimosso.",
		},

		removeDomain: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito rimuovere domini da questo team.",
				notFound: "{{hostname}} non esiste.",
			},

			success: "{{hostname}} è stato rimosso da {{team}}.",
		},

		removeMember: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito rimuovere membri da questo team.",
				cannotRemoveOwner: "Non può rimuovere il proprietario del team.",
			},

			success: "{{name}} è stato rimosso da {{team}}.",
		},

		retryDomainVerification: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito riprovare la verifica del dominio in questo team.",
				notFound: "{{hostname}} non esiste.",
				workflowFailed:
					"Il processo di verifica non è riuscito ad avviarsi per {{hostname}}. Riprovi più tardi.",
			},

			success: {
				alreadyVerified: "{{hostname}} è già verificato.",
				requested: "È stato richiesto un nuovo tentativo di verifica per {{hostname}}.",
			},
		},

		revokeInvite: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito revocare inviti in questo team.",
				notFound: "Questo invito non esiste.",
				alreadyAccepted: "Questo invito è già stato accettato dall'invitato.",
			},

			success: "L'invito di {{email}} è stato revocato da {{team}}.",
		},

		updateTeam: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				forbidden: "Non Le è consentito aggiornare le impostazioni del team.",
			},

			success: {
				updated: "Le impostazioni del team sono state aggiornate con successo.",
			},
		},

		deleteTeam: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante l'eliminazione del team.",
				forbidden: "Solo il proprietario del team può eliminare il team.",
				confirmationRequired: "Per favore digiti DELETE per confermare.",
			},

			success: "{{team}} è stato eliminato.",
		},

		leaveTeam: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notMember: "Non è un membro di questo team.",
				ownerCannotLeave:
					"I proprietari del team non possono abbandonare il loro team. Prima trasferisca la proprietà.",
				adminCannotLeave:
					"Gli amministratori non possono abbandonare il team. Chieda al proprietario di declassarLa prima.",
			},

			success: "Ha abbandonato {{team}}.",
		},

		createStatusPage: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				slugTaken: "Questo slug è già in uso.",
			},
		},

		updateStatusPage: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questa pagina di stato non esiste.",
				slugTaken: "Questo slug è già in uso.",
			},
		},

		deleteStatusPage: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questa pagina di stato non esiste.",
			},

			success: "La pagina di stato è stata eliminata.",
		},

		createMaintenance: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				invalidDates: "L'ora di fine deve essere successiva all'ora di inizio.",
			},

			success: {
				created: "La finestra di manutenzione '{{name}}' è stata creata.",
			},
		},

		deleteMaintenance: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questa finestra di manutenzione non esiste.",
				forbidden: "Non Le è consentito eliminare questa finestra di manutenzione.",
			},

			success: "La finestra di manutenzione '{{name}}' è stata eliminata.",
		},

		endMaintenance: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questa finestra di manutenzione non esiste.",
				forbidden: "Non Le è consentito terminare questa finestra di manutenzione.",
			},

			success: "La finestra di manutenzione '{{name}}' è stata terminata anticipatamente.",
		},

		createTeam: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante la creazione del team.",
			},

			success: {
				created: "Il team {{name}} è stato creato con successo.",
			},
		},

		createDnsMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				limitExceeded: "Ha raggiunto il limite di {{limit}} monitor DNS in questo team.",
			},

			success: {
				created: "Il monitor DNS {{name}} è stato creato.",
			},
		},

		updateDnsMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo monitor DNS non esiste.",
				forbidden: "Non Le è consentito aggiornare questo monitor DNS.",
			},

			success: "Il monitor DNS {{name}} è stato aggiornato.",
		},

		deleteDnsMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo monitor DNS non esiste.",
				forbidden: "Non Le è consentito eliminare questo monitor DNS.",
			},

			success: "Il monitor DNS {{name}} è stato eliminato.",
		},

		checkDnsMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo monitor DNS non esiste.",
				forbidden: "Non Le è consentito controllare questo monitor DNS.",
			},

			success: "Il controllo DNS per {{name}} è stato completato.",
		},

		createTcpMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante la creazione del monitor TCP.",
			},
			success: "Il monitor TCP {{name}} è stato creato.",
		},

		updateTcpMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante l'aggiornamento del monitor TCP.",
				notFound: "Questo monitor TCP non esiste.",
			},
			success: "Il monitor TCP {{name}} è stato aggiornato.",
		},

		deleteTcpMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante l'eliminazione del monitor TCP.",
				notAllowed: "Non Le è consentito eliminare monitor TCP in questo team.",
				notFound: "Questo monitor TCP non esiste.",
			},
			success: "Il monitor TCP {{name}} è stato eliminato.",
		},

		createApiKey: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante la creazione della chiave API.",
				limitExceeded: "Ha raggiunto il limite di {{limit}} chiavi API in questo team.",
			},
			success: {
				created: "La chiave API '{{name}}' è stata creata.",
			},
		},

		deleteApiKey: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante l'eliminazione della chiave API.",
				notFound: "Questa chiave API non esiste.",
			},
			success: "La chiave API '{{name}}' è stata eliminata.",
		},

		updateLanguage: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante l'aggiornamento della preferenza lingua.",
			},
			success: "La preferenza lingua è stata aggiornata con successo.",
		},
	},

	page: {
		dashboard: {
			header: {
				title: "Dashboard",
				action: {
					create: "Crea Monitor",
					refresh: "Aggiorna",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			empty: {
				title: "Nessun monitor ancora",
				description: "Crei il suo primo monitor per iniziare a tracciare i suoi servizi.",
				cta: "Crea Monitor",
			},

			stats: {
				monitors: {
					label: "Utilizzo Ping Mensile",
					value: "{{consumed}}<small> utilizzati</small>",
					description: "Su {{estimated}} stimati",
				},

				uptime: {
					label: "Percentuale Uptime",
					description: "Uptime complessivo del sistema",
				},

				slowestEndpoint: {
					label: {
						default: 'Endpoint più lento "<em>{{name}}</em>"',
						noData: "Endpoint più lento",
					},
					value: { noData: "N/D" },
					description: "Nelle ultime 24 ore",
				},
			},

			table: {
				label: "Monitor",

				columns: {
					name: "Nome",
					latencyChart: "Trend Latenza",
					status: "Stato",
					lastIncident: "Ultimo Incidente",
					responseTime: "Latenza Media",
					actions: "Azioni",
				},

				status: {
					up: "Attivo e Funzionante",
					down: "Non Attivo",
					degraded: "Degradato",
					unknown: "Nessun Dato",
				},

				lastIncident: { never: "-" },
				responseTime: "~{{value}}",

				actions: {
					menu: "Menu Azioni",
					edit: "Modifica Monitor",
					delete: "Elimina Monitor",
					play: "Esegui Monitor",
				},

				confirmation: {
					deleteMonitor:
						"È sicuro di voler eliminare il monitor {{name}}? Questa azione non può essere annullata.",
				},
			},
		},

		monitors: {
			header: {
				title: "Monitor Uptime",
				cta: "Crea Monitor",
				subscribe: "I suoi monitor sono in pausa. Si abboni per continuare il monitoraggio",
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},
		},

		createMonitor: {
			header: {
				title: "Crea Monitor",
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome Monitor",
						placeholder: "Pagina di Atterraggio",
						description: "Un nome descrittivo per il suo monitor.",
					},
					url: {
						label: "URL da Monitorare",
						placeholder: "https://example.com/healthcheck",
						description: "L'URL del servizio che desidera monitorare.",
					},
					method: {
						label: "Metodo di Richiesta",
						placeholder: "HEAD",
						description: "Il metodo HTTP da utilizzare per la richiesta.",
					},
					status: {
						label: "Codice di Stato Atteso",
						placeholder: "200",
						description: "Il codice di stato HTTP che si aspetta di ricevere.",
					},
					interval: {
						label: "Intervallo di Controllo",
						placeholder: "60",
						description: "Intervallo in secondi. Il minimo è 60 secondi.",
					},
					visibility: {
						label: "Visibilità",
						description: "I monitor pubblici possono essere condivisi con chiunque.",
						options: { public: "Pubblico", private: "Privato" },
					},
					region: {
						label: "Regione",
						description: "La regione da cui verrà eseguito il ping.",
						placeholder: "wnam",
						options: {
							afr: "{{emoji}} Africa",
							apac: "{{emoji}} Asia-Pacifico",
							eeur: "{{emoji}} Europa Orientale",
							enam: "{{emoji}} Nord America Orientale",
							me: "{{emoji}} Medio Oriente",
							oc: "{{emoji}} Oceania",
							sam: "{{emoji}} Sud America",
							weur: "{{emoji}} Europa Occidentale",
							wnam: "{{emoji}} Nord America Occidentale",
						},
					},
				},

				cta: "Crea Monitor",
			},
		},

		editMonitor: {
			header: {
				title: "Modifica Monitor",
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome Monitor",
						placeholder: "Pagina di Atterraggio",
						description: "Un nome descrittivo per il suo monitor.",
					},
					url: {
						label: "URL da Monitorare",
						placeholder: "https://example.com/healthcheck",
						description: "L'URL del servizio che desidera monitorare.",
					},
					method: {
						label: "Metodo di Richiesta",
						placeholder: "HEAD",
						description: "Il metodo HTTP da utilizzare per la richiesta.",
					},
					status: {
						label: "Codice di Stato Atteso",
						placeholder: "200",
						description: "Il codice di stato HTTP che si aspetta di ricevere.",
					},
					interval: {
						label: "Intervallo di Controllo",
						placeholder: "60",
						description: "Intervallo in secondi. Il minimo è 60 secondi.",
					},
					visibility: {
						label: "Visibilità",
						description: "I monitor pubblici possono essere condivisi con chiunque.",
						options: { public: "Pubblico", private: "Privato" },
					},
					region: {
						label: "Regione",
						description: "La regione da cui verrà eseguito il ping.",
						placeholder: "wnam",
						options: {
							afr: "{{emoji}} Africa",
							apac: "{{emoji}} Asia-Pacifico",
							eeur: "{{emoji}} Europa Orientale",
							enam: "{{emoji}} Nord America Orientale",
							me: "{{emoji}} Medio Oriente",
							oc: "{{emoji}} Oceania",
							sam: "{{emoji}} Sud America",
							weur: "{{emoji}} Europa Occidentale",
							wnam: "{{emoji}} Nord America Occidentale",
						},
					},
					ssl: {
						enabled: {
							label: "Abilita Monitoraggio SSL",
							description:
								"Monitora la scadenza del certificato SSL e riceva avvisi prima che scada.",
						},
						expiresAt: {
							label: "Data Scadenza Certificato",
							placeholder: "Seleziona data scadenza",
							description:
								"Inserisca la data di scadenza del suo certificato SSL. Può trovarla nella dashboard del suo provider di hosting o controllando i dettagli del certificato nel suo browser.",
						},
						issuer: {
							label: "Emittente Certificato",
							placeholder: "Let's Encrypt, DigiCert, ecc.",
							description:
								"L'Autorità di Certificazione che ha emesso il suo certificato SSL (opzionale).",
						},
						warningDays: {
							label: "Avviso Prima della Scadenza",
							description:
								"Riceva avvisi questo numero di giorni prima della scadenza del certificato.",
						},
					},
				},

				cancel: "Annulla",
				cta: "Salva Modifiche",
			},
		},

		monitor: {
			header: {
				title: 'Monitor "{{name}}"',

				action: {
					play: "Esegui Monitor",
					edit: "Modifica Monitor",
					refresh: "Aggiorna",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			stats: {
				monitors: {
					label: "Utilizzo Ping Mensile",
					value: "{{consumed}}<small> utilizzati</small>",
					description: "Su {{estimated}} stimati",
				},

				uptime: {
					label: "Percentuale Uptime",
					description: "Uptime complessivo del monitor",
				},

				slowestResult: {
					label: "Risultato più Lento",
					description: "Nelle ultime 24 ore",
				},
			},

			heatmap: {
				tooltip: "{{date}}\n{{successRate}} tasso di successo\n{{checks}} controlli",
				legend: {
					success: "Successo",
					failure: "Fallimento",
					mixed: "Misto",
					noData: "Nessun dato",
				},
			},

			ssl: {
				title: "Certificato SSL",
				status: {
					valid: "Valido",
					expiring: "In Scadenza",
					expired: "Scaduto",
					error: "Errore",
					unknown: "Non Configurato",
				},
				expiresAt: "Scade",
				expiresIn: "{{days}} giorni",
				issuer: "Emittente",
				lastChecked: "Ultimo Controllo",
				notConfigured: "Il monitoraggio SSL non è abilitato per questo monitor.",
				configure: "Configura Monitoraggio SSL",
			},
		},

		billing: {
			header: {
				title: "Fatturazione",
			},
		},

		members: {
			header: {
				title: "Membri del Team",

				action: {
					invite: "Invita Membro",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			sections: {
				members: {
					title: "Membri",
					description: "Gestisca i membri del suo team e i loro ruoli.",
				},
			},

			membersTable: {
				label: "Membri Attuali",
				description: "Persone che hanno accesso a questo team.",

				columns: {
					name: "Nome",
					role: "Ruolo nel Team",
					actions: "Azioni",
				},

				role: {
					member: "Membro",
					admin: "Amministratore",
					owner: "Proprietario",
				},

				actions: {
					menu: "Menu Azioni",
					remove: "Rimuovi dal Team",
					transfer: "Trasferisci Proprietà",
					changeRole: {
						member: "Converti in Amministratore",
						admin: "Converti in Membro",
						owner: "Non può cambiare il proprietario",
					},
				},

				confirmation: {
					removeMember: "È sicuro di voler rimuovere {{name}} dal team?",
				},
			},

			invitedMembersTable: {
				label: "Inviti in Sospeso",
				description: "Persone che sono state invitate ma non si sono ancora unite.",

				columns: {
					email: "Email",
					actions: "Azioni",
				},

				actions: {
					menu: "Menu Azioni",
					copy: "Copia Link Invito",
					revoke: "Revoca Invito",
				},

				confirmation: {
					revokeInvite: "È sicuro di voler revocare l'invito di {{email}}?",
				},
			},

			error: {
				forbidden: {
					title: "Non ha il permesso di accedere a questa pagina.",
					description: "Per favore contatti l'amministratore del suo team per assistenza.",
				},

				unknown: {
					title: "Si è verificato un errore imprevisto.",
					description: "Per favore riprovi più tardi o contatti l'assistenza.",
				},
			},
		},

		invite: {
			header: {
				title: "Invita Membro del Team",
				description: "Invia un invito per unirsi al suo team.",
			},

			dialog: {
				close: "Chiudi finestra",
			},

			form: {
				fields: {
					email: {
						label: "Indirizzo Email",
						placeholder: "mario.rossi@example.com",
						description: "L'indirizzo email della persona che desidera invitare a {{team}}.",
					},
				},

				cancel: "Annulla",
				cta: "Invita Membro",
			},
		},

		acceptInvite: {
			errors: {
				notFound: "Questo invito non esiste.",
				gone: "Questo invito è già stato accettato.",
				forbidden: "Questo invito non era destinato a Lei.",
				badRequest: "In qualche modo non ha un indirizzo email. Provi ad accedere di nuovo.",
			},
		},

		domains: {
			header: {
				title: "Domini del Team",
				action: { addDomain: "Aggiungi Dominio" },
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			sections: {
				domains: {
					title: "Domini",
					description: "Gestisca i domini verificati per il suo team.",
				},
			},

			form: {
				fields: {
					hostname: {
						label: "Dominio",
						placeholder: "example.com",
						description: "Il dominio che desidera aggiungere a {{team}}.",
					},
				},

				cta: "Aggiungi Dominio",
			},

			table: {
				label: "Domini Verificati",
				description:
					"Domini che possono essere utilizzati per il provisioning automatico dei membri del team.",

				columns: {
					hostname: "Hostname",
					id: "ID Verifica",
					verifiedAt: "Verificato Il",
					actions: "Azioni",
				},

				verifiedAt: {
					pending: "In attesa di verifica",
				},

				actions: {
					menu: "Menu Azioni",
					copy: "Copia ID Verifica",
					remove: "Rimuovi Dominio",
					retryVerification: "Riprova Verifica",
				},

				confirmation: {
					removeDomain: "È sicuro di voler rimuovere {{hostname}} dal team?",
				},
			},

			instructions: {
				title: "Come verificare il suo dominio",

				description:
					"Per verificare il suo dominio, aggiunga il seguente record `TXT` alle sue impostazioni DNS:",

				record: {
					name: {
						label: "Nome",
						value: "_ping-verification",
					},
					content: {
						label: "Contenuto",
						value: "VERIFICATION_ID",
					},
				},

				note: "Assicurati di sostituire <code>VERIFICATION_ID</code> con l'ID di verifica effettivo mostrato sopra.",

				disclaimer:
					"Le modifiche DNS potrebbero richiedere del tempo per propagarsi, quindi la verifica potrebbe essere ritardata.",
			},

			error: {
				forbidden: {
					title: "Non ha il permesso di accedere a questa pagina.",
					description: "Per favore contatti l'amministratore del suo team per assistenza.",
				},

				unknown: {
					title: "Si è verificato un errore imprevisto.",
					description: "Per favore riprovi più tardi o contatti l'assistenza.",
				},
			},
		},

		alerts: {
			header: {
				title: "Avvisi",

				action: {
					create: "Crea Avviso",
					history: "Visualizza Cronologia",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			empty: {
				title: "Nessun avviso configurato",
				description: "Crei un avviso per essere notificato quando i suoi monitor vanno offline.",
				cta: "Crea Avviso",
			},

			form: {
				fields: {
					name: {
						label: "Nome",
						placeholder: "Avviso CTO",
						description: "Un nome per identificare l'avviso.",
					},

					strategy: {
						label: "Strategia",
						description: "La strategia da utilizzare per l'avviso.",
						options: {
							webhook: "Webhook",
							email: "Email",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "URL Webhook",
								placeholder: "https://example.com/webhook",
								description: "L'URL a cui inviare il payload dell'avviso.",
							},
							secret: {
								label: "Segreto",
								placeholder: "segreto-opzionale",
								description:
									"Un segreto opzionale da includere negli header della richiesta. Verrà aggiunto un header `Webhook-Signature` con una firma HMAC SHA256 del payload usando questo segreto.",
							},
						},
						email: {
							to: {
								label: "Indirizzo Email",
								placeholder: "cto@example.com",
								description: "L'indirizzo email a cui inviare l'avviso.",
							},

							subjectPrefix: {
								label: "Prefisso Oggetto",
								placeholder: "[Avviso Uptime]",
								description:
									"Un prefisso opzionale da aggiungere all'oggetto dell'email. Utile per filtrare gli avvisi nella sua casella di posta.",
							},
						},
						slack: {
							webhookUrl: {
								label: "URL Webhook Slack",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"L'URL Webhook in Entrata di Slack. Creane uno su api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Override Canale",
								placeholder: "#avvisi",
								description:
									"Canale opzionale in cui pubblicare invece del predefinito del webhook. Includa il prefisso #.",
							},
						},
						discord: {
							webhookUrl: {
								label: "URL Webhook Discord",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"L'URL Webhook di Discord. Creane uno in Impostazioni Server > Integrazioni > Webhook.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Notifica al ripristino",
						description:
							"Invia un avviso quando il monitor si riprende da uno stato non attivo. Include tempo di ripristino e durata del disservizio.",
					},

					cooldown: {
						label: "Cooldown Avviso",
						description:
							"Tempo minimo tra avvisi dello stesso tipo. Previene l'affaticamento da avvisi durante interruzioni prolungate.",
						options: {
							none: "Nessun cooldown",
							"5min": "5 minuti",
							"15min": "15 minuti",
							"30min": "30 minuti",
							"1hour": "1 ora",
							"2hours": "2 ore",
							custom: "Personalizzato",
						},
						custom: {
							label: "Cooldown Personalizzato (minuti)",
							placeholder: "Inserisci minuti",
							description: "Inserisca il numero di minuti tra gli avvisi.",
						},
					},
				},

				cta: "Crea Avviso",
			},

			table: {
				label: "Avvisi",

				columns: {
					name: "Nome",
					strategy: "Tipo",
					notifyOnRecovery: "Ripristino",
					cooldown: "Cooldown",
					actions: "Azioni",
				},

				cooldown: {
					none: "Nessuno",
					minutes: "{{count}} min",
					hours: "{{count}} ore",
				},

				actions: {
					menu: "Menu Azioni",
					edit: "Modifica Avviso",
					remove: "Rimuovi Avviso",
				},

				types: {
					webhook: "Webhook",
					email: "Email",
					slack: "Slack",
					discord: "Discord",
				},

				notifyOnRecovery: {
					enabled: "Sì",
					disabled: "No",
				},

				confirmation: {
					deleteAlert: "È sicuro di voler eliminare l'avviso {{name}}?",
				},
			},
		},

		statusPages: {
			header: {
				title: "Pagine di Stato",

				action: {
					create: "Crea Pagina di Stato",
				},
			},

			empty: {
				title: "Nessuna pagina di stato ancora",
				description:
					"Crei una pagina di stato per condividere lo stato del suo sistema con i suoi utenti.",
				cta: "Crea Pagina di Stato",
			},

			table: {
				label: "Pagine di Stato",

				columns: {
					name: "Nome",
					slug: "URL",
					monitors: "Monitor",
					visibility: "Visibilità",
					actions: "Azioni",
				},

				visibility: {
					public: "Pubblica",
					private: "Privata",
				},

				actions: {
					menu: "Menu Azioni",
					view: "Visualizza Pagina",
					edit: "Modifica Pagina",
					delete: "Elimina Pagina",
				},

				confirmation: {
					delete: "È sicuro di voler eliminare la pagina di stato {{name}}?",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome Interno",
						placeholder: "Stato Produzione",
						description: "Un nome per identificare la pagina di stato internamente.",
					},
					slug: {
						label: "Slug URL",
						placeholder: "produzione",
						description:
							"Il percorso URL per la pagina di stato pubblica (es. /status/produzione).",
					},
					title: {
						label: "Titolo Pubblico",
						placeholder: "Stato Acme Inc.",
						description: "Il titolo visualizzato sulla pagina di stato pubblica.",
					},
					description: {
						label: "Descrizione",
						placeholder: "Stato attuale dei servizi di Acme Inc.",
						description: "Una descrizione opzionale per la pagina di stato.",
					},
					logoUrl: {
						label: "URL Logo",
						placeholder: "https://example.com/logo.png",
						description: "Un logo opzionale da visualizzare sulla pagina di stato.",
					},
					isPublic: {
						label: "Pubblica",
						description: "Renda questa pagina di stato accessibile a chiunque abbia il link.",
					},
					showOverallStatus: {
						label: "Mostra Stato Generale",
						description: "Visualizza un banner di stato generale del sistema in cima alla pagina.",
					},
					monitors: {
						label: "Monitor da Includere",
						description: "Selezioni quali monitor visualizzare su questa pagina di stato.",
					},
				},

				cta: "Crea Pagina di Stato",
				ctaUpdate: "Salva Modifiche",
			},
		},

		createStatusPage: {
			header: {
				title: "Crea Pagina di Stato",
			},
		},

		editStatusPage: {
			header: {
				title: "Modifica Pagina di Stato",
			},
		},

		dnsMonitors: {
			header: {
				title: "Monitor DNS",

				action: {
					create: "Crea Monitor DNS",
				},
			},

			empty: {
				title: "Nessun monitor DNS ancora",
				description: "Crei un monitor DNS per tracciare le modifiche ai record DNS.",
				cta: "Crea Monitor DNS",
			},

			table: {
				label: "Monitor DNS",

				columns: {
					name: "Nome",
					domain: "Dominio",
					recordType: "Tipo",
					status: "Stato",
					lastChecked: "Ultimo Controllo",
					actions: "Azioni",
				},

				disabled: "Disabilitato",
				neverChecked: "Mai",

				actions: {
					menu: "Menu Azioni",
					check: "Controlla Ora",
					edit: "Modifica",
					delete: "Elimina",
				},

				confirmation: {
					delete: "È sicuro di voler eliminare il monitor DNS {{name}}?",
				},
			},
		},

		createDnsMonitor: {
			header: {
				title: "Crea Monitor DNS",
			},

			form: {
				fields: {
					name: {
						label: "Nome Monitor",
						placeholder: "DNS Produzione",
						description: "Un nome descrittivo per questo monitor DNS.",
					},

					domain: {
						label: "Dominio",
						placeholder: "example.com",
						description: "Il dominio per cui monitorare i record DNS.",
					},

					recordType: {
						label: "Tipo Record",
						description: "Il tipo di record DNS da controllare.",
					},

					expectedValue: {
						label: "Valore Atteso",
						placeholder: "192.168.1.1",
						description:
							"Opzionale. Avvisa se il valore risolto non corrisponde. Lascia vuoto per tracciare le modifiche.",
					},

					interval: {
						label: "Intervallo di Controllo",
						description: "Con quale frequenza controllare il record DNS.",
						options: {
							"5m": "5 minuti",
							"15m": "15 minuti",
							"30m": "30 minuti",
							"1h": "1 ora",
							"6h": "6 ore",
							"12h": "12 ore",
							"24h": "24 ore",
						},
					},

					isEnabled: {
						label: "Abilita monitoraggio",
						description: "Inizia a monitorare questo record DNS immediatamente.",
					},
				},

				cta: "Crea Monitor DNS",
			},
		},

		editDnsMonitor: {
			header: {
				title: "Modifica Monitor DNS",
			},

			form: {
				fields: {
					name: {
						label: "Nome Monitor",
						placeholder: "DNS Produzione",
						description: "Un nome descrittivo per questo monitor DNS.",
					},

					domain: {
						label: "Dominio",
						placeholder: "example.com",
						description: "Il dominio per cui monitorare i record DNS.",
					},

					recordType: {
						label: "Tipo Record",
						description: "Il tipo di record DNS da controllare.",
					},

					expectedValue: {
						label: "Valore Atteso",
						placeholder: "192.168.1.1",
						description:
							"Opzionale. Avvisa se il valore risolto non corrisponde. Lascia vuoto per tracciare le modifiche.",
					},

					interval: {
						label: "Intervallo di Controllo",
						description: "Con quale frequenza controllare il record DNS.",
						options: {
							"5m": "5 minuti",
							"15m": "15 minuti",
							"30m": "30 minuti",
							"1h": "1 ora",
							"6h": "6 ore",
							"12h": "12 ore",
							"24h": "24 ore",
						},
					},

					isEnabled: {
						label: "Abilita monitoraggio",
						description: "Se monitorare attivamente questo record DNS.",
					},
				},

				cancel: "Annulla",
				cta: "Salva Modifiche",
			},
		},

		dnsMonitorDetail: {
			header: {
				title: 'Monitor DNS "{{name}}"',

				action: {
					check: "Controlla Ora",
					refresh: "Aggiorna",
					edit: "Modifica",
				},
			},

			info: {
				domain: "Dominio",
				recordType: "Tipo Record",
				status: "Stato",
				expectedValue: "Valore Atteso",
				currentValue: "Valore Attuale",
			},

			stats: {
				totalChecks: {
					label: "Controlli Totali",
					description: "Numero di controlli DNS eseguiti",
				},

				successRate: {
					label: "Tasso di Successo",
					description: "Percentuale di controlli riusciti",
				},

				avgResponseTime: {
					label: "Tempo di Risposta Medio",
					description: "Tempo medio di risoluzione DNS",
				},
			},

			results: {
				title: "Cronologia Controlli",
				empty: "Nessun controllo è stato ancora eseguito.",

				table: {
					columns: {
						checkedAt: "Controllato Il",
						status: "Stato",
						value: "Valore",
						responseTime: "Tempo di Risposta",
					},
				},
			},
		},

		maintenance: {
			header: {
				title: "Finestre di Manutenzione",

				action: {
					create: "Programma Manutenzione",
				},
			},

			empty: {
				title: "Nessuna finestra di manutenzione",
				description:
					"Programmi finestre di manutenzione per sopprimere gli avvisi durante i tempi di inattività pianificati.",
				cta: "Programma Manutenzione",
			},

			tabs: {
				label: "Stato Manutenzione",
				active: "Attiva",
				upcoming: "Programmata",
				past: "Passata",
			},

			noActive: "Nessuna finestra di manutenzione attiva",
			noUpcoming: "Nessuna finestra di manutenzione programmata",
			noPast: "Nessuna finestra di manutenzione passata",

			table: {
				columns: {
					name: "Nome",
					schedule: "Programmazione",
					monitor: "Monitor",
					status: "Stato",
					actions: "Azioni",
				},

				allMonitors: "Tutti i Monitor",
				recurring: "Ricorrente",

				status: {
					active: "Attiva",
					upcoming: "Programmata",
					past: "Completata",
				},

				actions: {
					menu: "Menu Azioni",
					end: "Termina Ora",
					delete: "Elimina",
				},

				confirmation: {
					endMaintenance: "È sicuro di voler terminare anticipatamente la manutenzione '{{name}}'?",
					deleteMaintenance: "È sicuro di voler eliminare '{{name}}'?",
				},
			},
		},

		createMaintenance: {
			header: {
				title: "Programma Manutenzione",
			},

			form: {
				fields: {
					name: {
						label: "Nome",
						placeholder: "Aggiornamento database",
						description: "Una descrizione del lavoro di manutenzione.",
					},

					monitor: {
						label: "Monitor",
						description: "Selezioni un monitor specifico o lasci vuoto per tutti i monitor.",
						all: "Tutti i Monitor",
					},

					startsAt: {
						label: "Ora di Inizio",
						description: "Quando inizia la finestra di manutenzione.",
					},

					duration: {
						label: "Durata",
						description: "Quanto dura la finestra di manutenzione.",
						options: {
							"15m": "15 minuti",
							"30m": "30 minuti",
							"1h": "1 ora",
							"2h": "2 ore",
							"4h": "4 ore",
							"8h": "8 ore",
						},
					},

					suppressAlerts: {
						label: "Sopprimi avvisi",
						description: "Non inviare avvisi durante questa finestra di manutenzione.",
					},

					showOnStatusPage: {
						label: "Mostra sulla pagina di stato",
						description: "Visualizza un avviso di manutenzione sulle pagine di stato pubbliche.",
					},

					isRecurring: {
						label: "Ricorrente",
						description: "Ripeti questa finestra di manutenzione secondo una programmazione.",
					},

					recurringPattern: {
						label: "Schema Ricorrente",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"Formato schema: 'daily:HH:MM-HH:MM' o 'weekly:giornoSettimana:HH:MM-HH:MM'",
					},
				},

				preview: {
					label: "Finestra di manutenzione",
				},

				cta: "Programma Manutenzione",
			},
		},

		alertHistory: {
			header: {
				title: "Cronologia Avvisi",
			},

			breadcrumbs: {
				alerts: "Avvisi",
			},

			empty: {
				title: "Nessun evento di avviso ancora",
				description:
					"Gli eventi di avviso appariranno qui quando i monitor attivano gli avvisi. Configuri gli avvisi per iniziare.",
				cta: "Visualizza Avvisi",
			},

			table: {
				label: "Eventi Avviso",

				columns: {
					alert: "Avviso",
					monitor: "Monitor",
					eventType: "Evento",
					status: "Stato",
					sentAt: "Ora",
				},

				unknownAlert: "Avviso Sconosciuto",
				unknownMonitor: "Monitor Sconosciuto",

				eventType: {
					down: "Non Attivo",
					up: "Ripristinato",
					degraded: "Degradato",
				},

				status: {
					sent: "Inviato",
					skipped_cooldown: "Saltato (Cooldown)",
					failed: "Fallito",
				},
			},
		},

		createAlert: {
			header: {
				title: "Crea Avviso",
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome",
						placeholder: "Avviso CTO",
						description: "Un nome per identificare l'avviso.",
					},

					strategy: {
						label: "Strategia",
						description: "La strategia da utilizzare per l'avviso.",
						options: {
							webhook: "Webhook",
							email: "Email",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "URL Webhook",
								placeholder: "https://example.com/webhook",
								description: "L'URL a cui inviare il payload dell'avviso.",
							},
							secret: {
								label: "Segreto",
								placeholder: "segreto-opzionale",
								description:
									"Un segreto opzionale da includere negli header della richiesta. Verrà aggiunto un header `Webhook-Signature` con una firma HMAC SHA256 del payload usando questo segreto.",
							},
						},
						email: {
							to: {
								label: "Indirizzo Email",
								placeholder: "cto@example.com",
								description: "L'indirizzo email a cui inviare l'avviso.",
							},

							subjectPrefix: {
								label: "Prefisso Oggetto",
								placeholder: "[Avviso Uptime]",
								description:
									"Un prefisso opzionale da aggiungere all'oggetto dell'email. Utile per filtrare gli avvisi nella sua casella di posta.",
							},
						},
						slack: {
							webhookUrl: {
								label: "URL Webhook Slack",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"L'URL Webhook in Entrata di Slack. Creane uno su api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Override Canale",
								placeholder: "#avvisi",
								description:
									"Canale opzionale in cui pubblicare invece del predefinito del webhook. Includa il prefisso #.",
							},
						},
						discord: {
							webhookUrl: {
								label: "URL Webhook Discord",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"L'URL Webhook di Discord. Creane uno in Impostazioni Server > Integrazioni > Webhook.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Notifica al ripristino",
						description:
							"Invia un avviso quando il monitor si riprende da uno stato non attivo. Include tempo di ripristino e durata del disservizio.",
					},

					cooldown: {
						label: "Cooldown Avviso",
						description:
							"Tempo minimo tra avvisi dello stesso tipo. Previene l'affaticamento da avvisi durante interruzioni prolungate.",
						options: {
							none: "Nessun cooldown",
							"5min": "5 minuti",
							"15min": "15 minuti",
							"30min": "30 minuti",
							"1hour": "1 ora",
							"2hours": "2 ore",
							custom: "Personalizzato",
						},
						custom: {
							label: "Cooldown Personalizzato (minuti)",
							placeholder: "Inserisci minuti",
							description: "Inserisca il numero di minuti tra gli avvisi.",
						},
					},
				},

				cta: "Crea Avviso",
			},
		},

		logout: {
			title: "È sicuro di voler effettuare il logout?",
			cta: "Logout",
		},

		splat: {
			notFound: {
				title: "Non Trovato",
				description: "La pagina che sta cercando non esiste.",
			},
		},

		account: {
			meta: {
				title: "Account - Uptime",
				description: "Gestisca le impostazioni del suo account e i team.",
			},

			header: {
				title: "Account",
			},

			profile: {
				title: "Profilo",
				description: "Le sue informazioni personali.",
			},

			language: {
				title: "Preferenza Lingua",
				description: "Scelga la sua lingua preferita per l'interfaccia.",

				form: {
					fields: {
						language: {
							label: "Lingua",
							description:
								"Selezioni la sua lingua preferita. Il rilevamento automatico utilizza le impostazioni del suo browser.",
							options: {
								auto: "Rilevamento automatico",
								en: "English",
								es: "Español",
								de: "Deutsch",
								ja: "Giapponese",
								fr: "Français",
								it: "Italiano",
							},
						},
					},

					cta: "Salva Lingua",
				},
			},

			teams: {
				title: "I Suoi Team",
				description: "Team di cui è membro.",

				actions: {
					createTeam: "Crea Team",
				},

				empty: {
					title: "Nessun team ancora",
					description: "Crei un team per iniziare a monitorare i suoi servizi.",
					cta: "Crea Team",
				},

				table: {
					label: "Team",
					description: "Tutti i team a cui appartiene.",

					columns: {
						team: "Team",
						role: "Ruolo",
						actions: "Azioni",
					},

					role: {
						member: "Membro",
						admin: "Amministratore",
						owner: "Proprietario",
					},

					actions: {
						menu: "Menu Azioni",
						leave: "Abbandona Team",
					},

					confirmation: {
						leaveTeam: "È sicuro di voler abbandonare {{name}}?",
					},
				},
			},
		},

		createTeam: {
			header: {
				title: "Crea Team",
				description: "Crei un nuovo team per monitorare i suoi servizi.",
			},

			dialog: {
				close: "Chiudi finestra",
			},

			form: {
				fields: {
					name: {
						label: "Nome Team",
						placeholder: "Il Mio Team Fantastico",
						description: "Scelga un nome per il suo nuovo team.",
					},
				},

				cancel: "Annulla",
				cta: "Crea Team",
			},
		},

		settings: {
			header: {
				title: "Impostazioni Team",
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			sections: {
				general: {
					title: "Generale",
					description: "Gestisca le informazioni di base del suo team.",
				},
			},

			form: {
				card: {
					title: "Profilo Team",
					description: "Aggiorni il nome e il logo del suo team.",
				},

				fields: {
					logo: {
						label: "URL Logo",
						placeholder: "https://example.com/logo.png",
						description: "Un URL dell'immagine logo del suo team.",
					},
					name: {
						label: "Nome Team",
						placeholder: "Il Mio Team",
						description: "Il nome del suo team.",
					},
				},

				actions: {
					cancel: "Annulla",
					save: "Salva Modifiche",
				},
			},

			members: {
				title: "Membri",
				description: "Gestisca i membri del suo team e i loro ruoli.",

				actions: {
					invite: "Invita Membro",
				},

				table: {
					label: "Membri Attuali",
					description: "Persone che hanno accesso a questo team.",

					columns: {
						name: "Nome",
						role: "Ruolo",
						actions: "Azioni",
					},

					role: {
						member: "Membro",
						admin: "Amministratore",
						owner: "Proprietario",
					},

					actions: {
						menu: "Menu Azioni",
						remove: "Rimuovi dal Team",
						transfer: "Trasferisci Proprietà",
						changeRole: {
							member: "Converti in Amministratore",
							admin: "Converti in Membro",
							owner: "Non può cambiare il proprietario",
						},
					},

					confirmation: {
						removeMember: "È sicuro di voler rimuovere {{name}} dal team?",
					},
				},

				invitedTable: {
					label: "Inviti in Sospeso",
					description: "Persone che sono state invitate ma non si sono ancora unite.",

					columns: {
						email: "Email",
						expires: "Scade",
						actions: "Azioni",
					},

					expires: {
						expired: "Scaduto",
					},

					actions: {
						menu: "Menu Azioni",
						copy: "Copia Link Invito",
						revoke: "Revoca Invito",
					},

					confirmation: {
						revokeInvite: "È sicuro di voler revocare l'invito di {{email}}?",
					},
				},
			},

			domains: {
				title: "Domini",
				description: "Gestisca i domini verificati per il suo team.",

				actions: {
					addDomain: "Aggiungi Dominio",
				},

				table: {
					label: "Domini Verificati",
					description:
						"Domini che possono essere utilizzati per il provisioning automatico dei membri del team.",

					columns: {
						hostname: "Hostname",
						id: "ID Verifica",
						verifiedAt: "Verificato Il",
						actions: "Azioni",
					},

					verifiedAt: {
						pending: "In attesa di verifica",
					},

					actions: {
						menu: "Menu Azioni",
						copy: "Copia ID Verifica",
						remove: "Rimuovi Dominio",
						retryVerification: "Riprova Verifica",
					},

					confirmation: {
						removeDomain: "È sicuro di voler rimuovere {{hostname}} dal team?",
					},
				},

				form: {
					fields: {
						hostname: {
							label: "Dominio",
							placeholder: "example.com",
							description: "Il dominio che desidera aggiungere a {{team}}.",
						},
					},

					cta: "Aggiungi Dominio",
				},

				instructions: {
					title: "Come verificare il suo dominio",
					description:
						"Per verificare il suo dominio, aggiunga il seguente record TXT alle sue impostazioni DNS:",

					record: {
						name: {
							label: "Nome",
							value: "_ping-verification",
						},
						content: {
							label: "Contenuto",
							value: "VERIFICATION_ID",
						},
					},

					note: "Assicurati di sostituire <code>VERIFICATION_ID</code> con l'ID di verifica effettivo mostrato sopra.",
					disclaimer:
						"Le modifiche DNS potrebbero richiedere del tempo per propagarsi, quindi la verifica potrebbe essere ritardata.",
				},
			},

			billing: {
				title: "Fatturazione",
				description: "Gestisca il suo abbonamento e i dettagli di pagamento.",

				card: {
					title: "Abbonamento e Pagamenti",
					description:
						"Visualizzi le fatture, aggiorni i metodi di pagamento e gestisca il suo abbonamento.",
					notice:
						"Verrà reindirizzato al portale clienti di Polar per gestire le sue impostazioni di fatturazione.",
					cta: "Apri Portale Fatturazione",
				},
			},

			danger: {
				title: "Zona Pericolosa",
				description: "Azioni irreversibili che influenzano il suo team.",

				card: {
					title: "Elimina Team",
					description:
						"Elimina permanentemente questo team e tutti i suoi dati. Questa azione non può essere annullata.",
					warning:
						"Questo cancellerà il suo abbonamento ed eliminerà tutti i monitor, avvisi, domini, membri e inviti.",
					confirmation: {
						label: "Digiti DELETE per confermare",
						placeholder: "DELETE",
					},
					cta: "Elimina Team",
				},
			},

			error: {
				forbidden: {
					title: "Non ha il permesso di accedere a questa pagina.",
					description: "Per favore contatti l'amministratore del suo team per assistenza.",
				},

				unknown: {
					title: "Si è verificato un errore imprevisto.",
					description: "Per favore riprovi più tardi o contatti l'assistenza.",
				},
			},
		},

		tcpMonitors: {
			header: {
				title: "Monitor TCP",
				action: {
					create: "Crea Monitor TCP",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
				limitation: {
					title: "Limitazione Monitoraggio TCP",
					description:
						"Il monitoraggio delle porte TCP richiede il piano a pagamento di Cloudflare Workers con supporto socket. Con il piano gratuito, i controlli TCP appariranno come non disponibili. Consideri l'utilizzo del monitoraggio HTTP come alternativa.",
				},
			},

			empty: {
				title: "Nessun monitor TCP ancora",
				description: "Crei un monitor TCP per verificare se le porte sono aperte e responsive.",
				cta: "Crea Monitor TCP",
			},

			table: {
				label: "Monitor TCP",
				columns: {
					name: "Nome",
					endpoint: "Host:Porta",
					status: "Stato",
					lastChecked: "Ultimo Controllo",
					responseTime: "Tempo di Risposta",
					actions: "Azioni",
				},
				status: {
					up: "Attivo",
					down: "Non Attivo",
					timeout: "Timeout",
					disabled: "Disabilitato",
					pending: "In Attesa",
				},
				actions: {
					edit: "Modifica",
					delete: "Elimina",
					confirmation: {
						delete: "È sicuro di voler eliminare {{name}}?",
					},
				},
			},
		},

		createTcpMonitor: {
			header: {
				title: "Crea Monitor TCP",
				breadcrumb: {
					tcpMonitors: "Monitor TCP",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome Monitor",
						placeholder: "Server Database",
						description: "Un nome descrittivo per questo monitor TCP.",
					},
					host: {
						label: "Host",
						placeholder: "db.example.com",
						description: "L'hostname o l'indirizzo IP da monitorare.",
					},
					port: {
						label: "Porta",
						placeholder: "5432",
						description: "La porta TCP da controllare (1-65535).",
					},
					interval: {
						label: "Intervallo di Controllo",
						description: "Con quale frequenza controllare la porta.",
					},
					timeout: {
						label: "Timeout Connessione",
						description: "Quanto tempo attendere per una connessione prima del timeout.",
					},
				},
				cta: "Crea Monitor",
			},
		},

		editTcpMonitor: {
			header: {
				title: "Modifica Monitor TCP",
				breadcrumb: {
					tcpMonitors: "Monitor TCP",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome Monitor",
						placeholder: "Server Database",
						description: "Un nome descrittivo per questo monitor TCP.",
					},
					host: {
						label: "Host",
						placeholder: "db.example.com",
						description: "L'hostname o l'indirizzo IP da monitorare.",
					},
					port: {
						label: "Porta",
						placeholder: "5432",
						description: "La porta TCP da controllare (1-65535).",
					},
					interval: {
						label: "Intervallo di Controllo",
						description: "Con quale frequenza controllare la porta.",
					},
					timeout: {
						label: "Timeout Connessione",
						description: "Quanto tempo attendere per una connessione prima del timeout.",
					},
					isEnabled: {
						label: "Abilita monitoraggio",
					},
				},
				cancel: "Annulla",
				cta: "Salva Modifiche",
			},
		},

		tcpMonitorDetail: {
			header: {
				breadcrumb: {
					tcpMonitors: "Monitor TCP",
				},
				action: {
					edit: "Modifica",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			info: {
				title: "Configurazione Monitor",
				endpoint: "Endpoint",
				status: "Stato",
				interval: "Intervallo di Controllo",
				timeout: "Timeout",
			},

			stats: {
				uptime: {
					label: "Uptime",
					description: "Basato sui controlli recenti",
				},
				avgResponseTime: {
					label: "Tempo di Risposta Medio",
					description: "Tempo medio di connessione",
				},
				totalChecks: {
					label: "Controlli Totali",
					description: "Numero di controlli eseguiti",
				},
			},

			results: {
				title: "Cronologia Controlli",
				description: "Risultati recenti dei controlli di connessione TCP",
				label: "Risultati",
				empty:
					"Nessun risultato ancora. I risultati appariranno dopo l'esecuzione del primo controllo.",
				columns: {
					time: "Ora",
					status: "Stato",
					responseTime: "Tempo di Risposta",
					error: "Errore",
				},
			},
		},

		apiKeys: {
			header: {
				title: "Chiavi API",
				action: {
					create: "Crea Chiave API",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			empty: {
				title: "Nessuna chiave API ancora",
				description: "Crei una chiave API per accedere all'API di Uptime in modo programmatico.",
				cta: "Crea Chiave API",
			},

			newKey: {
				title: "Chiave API '{{name}}' creata!",
				description: "Copi questa chiave ora. Per motivi di sicurezza, non potrà vederla di nuovo.",
				dismiss: "Ho copiato la mia chiave",
			},

			form: {
				title: "Crea Nuova Chiave API",
				description: "Le chiavi API consentono l'accesso programmatico ai suoi monitor e avvisi.",

				fields: {
					name: {
						label: "Nome Chiave",
						placeholder: "Chiave API Produzione",
						description: "Un nome per identificare questa chiave API.",
					},
					scopes: {
						label: "Permessi",
						description: "Selezioni a cosa può accedere questa chiave API.",
						options: {
							"monitors:read": "Leggi Monitor",
							"monitors:write": "Scrivi Monitor",
							"alerts:read": "Leggi Avvisi",
							"alerts:write": "Scrivi Avvisi",
						},
					},
					expiresAt: {
						label: "Data Scadenza (Opzionale)",
						description: "Lasci vuoto per una chiave che non scade mai.",
					},
				},

				actions: {
					cancel: "Annulla",
					create: "Crea Chiave API",
				},
			},

			table: {
				label: "Chiavi API",

				columns: {
					name: "Nome",
					prefix: "Chiave",
					scopes: "Permessi",
					lastUsed: "Ultimo Utilizzo",
					expires: "Scade",
					actions: "Azioni",
				},

				lastUsed: {
					never: "Mai",
				},

				expires: {
					never: "Mai",
				},

				actions: {
					menu: "Menu Azioni",
					delete: "Elimina Chiave",
				},

				confirmation: {
					delete:
						"È sicuro di voler eliminare la chiave API '{{name}}'? Questa azione non può essere annullata.",
				},
			},

			error: {
				forbidden: {
					title: "Non ha il permesso di accedere a questa pagina.",
					description: "Per favore contatti l'amministratore del suo team per assistenza.",
				},

				unknown: {
					title: "Si è verificato un errore imprevisto.",
					description: "Per favore riprovi più tardi o contatti l'assistenza.",
				},
			},
		},
	},
};
