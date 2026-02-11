export default {
	landing: {
		meta: {
			title: "Uptime by Sergio Xalambrí",
			description: "開発者向けのシンプルで信頼性の高いUptime監視",
		},

		header: {
			title: "Uptime",

			nav: {
				pricing: "料金",
				features: "機能",

				cta: {
					in: "ダッシュボードを開く",
					out: "監視を始める",
				},
			},
		},

		hero: {
			pill: "稼働時間監視",
			title: "安心してサービスを<strong>監視</strong>",
			description:
				"ウェブサイトやAPIがダウンした時に即座にアラートを受け取れます。簡単にウェブサイトやAPIを監視できます。",

			cta: {
				in: "ダッシュボードを開く",
				out: "監視を始める",
				pricing: "料金を見る",
			},

			screenshot: {
				alt: "2つのサービスと週間ヒートマップチャートを表示するUptime監視ダッシュボードのスクリーンショット。各ドットはチェックを表しています：緑は成功、黄色は混合、赤は失敗、グレーはデータなし。各モニターはUptime率、総チェック数、最終チェック時刻、99パーセンタイル応答時間も表示しています",
			},

			trustIndicators: {
				freeToStart: "無料で開始",
				payForAutomation: "自動化に課金",
				cancelAnytime: "いつでもキャンセル可能",
			},
		},

		trustIndicators: {
			uptimeSla: "Uptime SLA",
			globalRegions: "グローバルリージョン",
			daysDataRetention: "日間データ保持",
			alertLatency: "アラート遅延",
		},

		features: {
			title: "シンプルで強力な監視",
			description:
				"サービスをスムーズに稼働させるために必要なすべてを、不必要な複雑さなしに提供します。",
			badge: "機能",
			learnMore: "詳細を見る",

			list: {
				first: {
					title: "Uptimeを監視",
					description:
						"99.9%の監視信頼性で24時間365日サービスを追跡します。詳細なメトリクスとパフォーマンスのインサイトを一目で確認できます。",
				},
				second: {
					title: "どこでもアラートを受信",
					description:
						"サービスがダウンタイムやパフォーマンスの問題を経験した時に、メール、Slack、Discord、またはwebhookを通じて即座に通知を受け取れます。",
				},
				third: {
					title: "使った分だけ支払い",
					description:
						"隠れた料金のない透明な価格設定。必要に応じてスケールアップまたはダウンでき、監視ニーズに合わせて成長するプランです。",
				},
				fourth: {
					title: "ステータスページ",
					description:
						"ユーザーにサービスの可用性とインシデントを通知するための美しい公開ステータスページを作成できます。",
				},
				fifth: {
					title: "SSL監視",
					description:
						"証明書の有効期限を追跡し、SSL証明書が期限切れになる前にアラートを受け取ることで、セキュリティ警告を防ぎます。",
				},
				sixth: {
					title: "DNS監視",
					description:
						"DNSレコードの変更や伝播の問題がユーザーに影響を与える前、またはハイジャックされる前に検出します。",
				},
				seventh: {
					title: "ネイティブ統合",
					description:
						"基本的なwebhookだけでなく、リッチな通知を備えたSlackとDiscordの直接統合を提供します。",
				},
			},
		},

		completeFeatureSet: {
			badge: "完全な機能セット",
			title: "信頼性の高い監視に必要なすべて",
			description: "監視を簡単かつ包括的にする高度な機能。",

			list: {
				maintenanceWindows: {
					title: "メンテナンスウィンドウ",
					description: "計画されたメンテナンス中のダウンタイムをスケジュールし、アラートを抑制",
				},
				contentMonitoring: {
					title: "コンテンツ監視",
					description: "ページに特定のキーワードやコンテンツが表示されているかを確認",
				},
				recoveryAlerts: {
					title: "復旧アラート",
					description: "インシデント後にサービスが復旧した時に通知を受け取る",
				},
				apiAccess: {
					title: "APIアクセス",
					description: "自動化のためのキー管理を備えた完全なREST API",
				},
				alertCooldowns: {
					title: "アラートクールダウン",
					description: "設定可能なクールダウン期間でアラート疲れを防止",
				},
				customHeaders: {
					title: "カスタムヘッダー",
					description: "認証ヘッダーとカスタムリクエストパラメータを追加",
				},
			},
		},

		useCases: {
			badge: "ユースケース",
			title: "あらゆる監視ニーズに対応",
			description: "シンプルなヘルスチェックから複雑な分散システムまで、すべてをカバーします。",
			learnMore: "詳細を見る",
			tailoredFor: "対象ソリューション：",

			list: {
				websiteMonitoring: {
					title: "ウェブサイト監視",
					description:
						"ランディングページ、ブログ、ウェブアプリケーションのアップタイムとパフォーマンスを追跡。",
				},
				apiMonitoring: {
					title: "API監視",
					description: "REST API、GraphQLエンドポイント、webhookの可用性を監視。",
				},
				saas: {
					title: "SaaSアプリケーション",
					description: "プロアクティブな監視と即座のアラートでSaaS製品の信頼性を維持。",
				},
				microservices: {
					title: "マイクロサービス",
					description: "分散システムを監視し、障害がカスケードする前にキャッチ。",
				},
				healthChecks: {
					title: "ヘルスチェック",
					description: "スケジュールされたpingでサービスの状態とデータベース接続を確認。",
				},
			},

			audiences: {
				indieHackers: "インディーハッカー",
				soloDevelopers: "ソロ開発者",
				startups: "スタートアップ",
				agencies: "代理店",
				enterprises: "エンタープライズ",
			},
		},

		pricing: {
			badge: "料金",
			title: "シンプルで透明な料金",
			description:
				"単一のサブスクリプション、階層なし。わかりやすい料金モデルで使った分だけお支払い",

			howItWorks: {
				title: "料金の仕組み",

				list: {
					first: {
						title: "基本サブスクリプション",
						description: "月額$5で最初の5,000回のpingを含む",
					},

					second: {
						title: "追加ping",
						description: "5,000回以降は1pingあたり$0.001",
					},

					third: {
						title: "隠れた料金なし",
						description:
							"機能や統合に追加料金はかかりません。使用したpingの分だけお支払いください。",
					},
				},
			},

			calculator: {
				title: "料金計算機",
				description: "監視ニーズに基づいて月額コストを計算",

				add: "モニターを追加",

				monitor: {
					label: "モニターの頻度",
					delete: "削除",
					frequency: {
						lower: "1分",
						upper: "60分",
					},
				},

				stats: {
					pingsPerMonth: "月間ping数：",
					baseSubscription: "基本サブスクリプション",
					includes: "最初の{{amount}}回のpingを含む",
					additionalPings: "追加ping：",
					additionalPingsCost: "{{pings}} × {{costPerPing}}",
					totalCost: "月額合計：",
				},
			},
		},

		faq: {
			badge: "FAQ",
			title: "よくある質問",
			description: "Uptimeに関するよくある質問への回答",

			list: {
				first: {
					q: "Uptimeはどのようにサービスを監視しますか？",
					a: "Uptimeはエンドポイントに定期的なHTTPまたはHTTPSリクエストを送信します。レスポンスコードとレスポンス時間をチェックして、サービスが利用可能で応答しているかを判断します。",
				},

				second: {
					q: "障害が検出されるとどうなりますか？",
					a: "Uptimeが障害を検出すると、設定されたチャネルを通じて即座にアラートを送信します。",
				},

				third: {
					q: "内部サービスを監視できますか？",
					a: "はい、内部サービスがインターネットからアクセス可能であれば監視できます。リクエストを認証するためにカスタムヘッダーを設定することもできます。",
				},

				fourth: {
					q: "どのように始めればいいですか？",
					a: "サインアップして、最初のモニターを作成し、アラート設定を行うだけです。1分以内に稼働を開始できます。",
				},

				fifth: {
					q: "無料プランはありますか？",
					a: "はい！無制限のモニターを作成し、手動でpingをトリガーすることが永久に無料でできます。スケジュールされた自動監視にはサブスクリプションが必要です。",
				},

				sixth: {
					q: "pingデータはどのくらいの期間保存されますか？",
					a: "ping結果は365日間保存されます。その後、自動的に削除されます。",
				},

				seventh: {
					q: "認証が必要なサービスを監視できますか？",
					a: "はい。トークンや認証情報を含むカスタムヘッダーを設定してリクエストを認証できます。",
				},

				eighth: {
					q: "複数のURLを監視できますか？",
					a: "はい。各URLに対して別々のモニターを作成するだけです。各モニターは独自のチェック頻度、HTTPメソッド、期待されるステータスコードなどを持つことができます。",
				},

				ninth: {
					q: "APIを監視できますか？",
					a: "もちろんです。UptimeはウェブサイトとAPIの両方を監視するように設計されています。エンドポイント、メソッド、ヘッダー、期待されるレスポンスを設定して、APIを効果的に監視できます。",
				},

				tenth: {
					q: "各pingにタイムアウトを設定できますか？",
					a: "はい。各モニターにタイムアウトを設定できます。レスポンスが予想より長くかかった場合、失敗として扱われます。これにより遅いサービスを検出できます。",
				},

				eleventh: {
					q: "モニターを一時的に停止または無効にできますか？",
					a: "はい。いつでも任意のモニターを個別に一時停止できます。",
				},

				twelfth: {
					q: "モニター作成直後にテストできますか？",
					a: "はい。モニターを作成した直後にpingが自動的にトリガーされます。",
				},

				thirteenth: {
					q: "ステータスページに対応していますか？",
					a: "はい！ユーザーとサービスの状態を共有するためのカスタマイズ可能な公開ステータスページを作成できます。任意のモニターを含め、ブランディングを追加できます。",
				},

				fourteenth: {
					q: "過去のパフォーマンストレンドを見ることができますか？",
					a: "すべての過去の結果を保存しているので、完全な履歴を取得できます。パフォーマンストレンドチャートは将来のリリースで予定されています。",
				},

				fifteenth: {
					q: "どのアラートチャネルに対応していますか？",
					a: "メール、Slack、Discord、webhookに対応しています。ネイティブ統合により、チームが既に使用している場所でアラートを簡単に受け取れます。webhookを使用して他のサービスに接続することもできます。",
				},

				sixteenth: {
					q: "チームや共有モニターに対応していますか？",
					a: "はい！各ユーザーはチームから始まります。異なる役割（オーナー、管理者、メンバー）でチームメンバーを招待できます。ドメイン自動プロビジョニングにより、確認済みの会社メールドメインを持つユーザーが自動的に追加されます。",
				},

				seventeenth: {
					q: "プランの制限を超えるとどうなりますか？",
					a: "サブスクリプションに含まれる5,000回を超えるpingに対して、1,000pingごとに$1が課金されます。",
				},

				eighteenth: {
					q: "リクエストやレスポンスのボディを保存していますか？",
					a: "いいえ。ボディデータは一切保存しません。プライバシーと効率性を高めるために、`HEAD`メソッドの使用をお勧めします。",
				},

				nineteenth: {
					q: "どのリージョンからサービスを監視できますか？",
					a: "Uptimeは複数のリージョンからの監視に対応しています：アフリカ、アジア太平洋、東ヨーロッパ、西ヨーロッパ、東北アメリカ、西北アメリカ、中東、オセアニア、南アメリカ。\n\nモニターごとに1つのリージョンを選択できます。リージョンはヒントとして扱われ、実際のpingはそのリージョン内またはその近くのサーバーから発信されます。",
				},
			},
		},

		footer: {
			name: "Uptime",
			description: "ウェブサイトとAPIのためのシンプルで信頼性の高い監視。",
			copyright: "© {{year}} Uptime by Sergio Xalambrí. All rights reserved.",
			sections: {
				product: {
					title: "製品",
					features: "機能",
					pricing: "料金",
					faq: "よくある質問",
				},
				features: {
					title: "機能",
					monitors: "モニター",
					alerts: "アラート",
					statusPages: "ステータスページ",
					ssl: "SSL監視",
					dns: "DNS監視",
					contentMonitoring: "コンテンツ監視",
					maintenance: "メンテナンスウィンドウ",
					integrations: "インテグレーション",
					teams: "チーム",
					analytics: "分析",
					api: "APIアクセス",
				},
				useCases: {
					title: "ユースケース",
					websiteMonitoring: "ウェブサイト監視",
					apiMonitoring: "API監視",
					saas: "SaaSアプリケーション",
					microservices: "マイクロサービス",
					healthChecks: "ヘルスチェック",
				},
				solutions: {
					title: "ソリューション",
					indieHackers: "インディーハッカー向け",
					soloDevs: "個人開発者向け",
					startups: "スタートアップ向け",
					agencies: "代理店向け",
					enterprises: "企業向け",
				},
				compare: {
					title: "比較",
					uptimerobot: "vs UptimeRobot",
					pingdom: "vs Pingdom",
					betterUptime: "vs Better Uptime",
					checkly: "vs Checkly",
					statuscake: "vs StatusCake",
					datadog: "vs Datadog",
					site24x7: "vs Site24x7",
					ohdear: "vs Oh Dear",
				},
				legal: {
					title: "法的情報",
					terms: "利用規約",
					privacy: "プライバシーポリシー",
				},
			},
		},
	},

	app: {
		meta: {
			title: "Uptime by Sergio Xalambrí",
			description: "開発者向けのシンプルで信頼性の高いUptime監視",
		},

		layout: {
			sidebar: {
				teamPicker: { label: "チームを選択" },
				userMenu: { label: "ユーザーメニュー" },

				navigation: {
					items: {
						dashboard: "ダッシュボード",
						alerts: "アラート",
						maintenance: "メンテナンス",
						monitors: "モニター",
						statusPages: "ステータスページ",
						tcpMonitors: "TCPモニター",
						dnsMonitors: "DNSモニター",
						settings: "設定",
						billing: "請求",
						domains: "ドメイン",
						members: "メンバー",
						team: "チーム",
						apiKeys: "APIキー",
					},
				},

				account: {
					title: "アカウント",
					overview: "概要",
					teams: "チーム一覧",
				},
			},
		},

		errors: {
			notFound: {
				title: "404 見つかりません",
				description: "お探しのチームは存在しません。",
			},
		},
	},

	monitorDetail: {
		header: {
			region: "{{emoji}} {{code}}",
		},
		stats: {
			title: "統計",
			uptime: "Uptime",
			totalChecks: "総チェック数",
			lastCheck: "最終チェック",
			p99ResponseTime: "P99応答時間",
			p99ResponseTimeValue: "{{value}}",
			neverRan: "N/A",
		},

		actions: {
			refresh: "更新",
			delete: {
				confirm: "このモニターを削除してもよろしいですか？",
				cta: "モニターを削除",
			},
		},
	},

	monitorList: {
		header: {
			title: "Uptimeモニター",
			cta: "モニターを作成",
			subscribe: "モニターが一時停止されています。監視を続けるにはサブスクリプションが必要です",
		},
	},

	statusPage: {
		heatmap: {
			daysAgo: "30日前",
			today: "今日",
			legend: {
				full: "100%",
				partial: "一部",
				down: "ダウン",
				noData: "データなし",
			},
			tooltip: {
				uptime: "{{percentage}}% 稼働率",
				noData: "データなし",
			},
		},
		error: {
			title: "ステータスページが見つかりません",
			description: "お探しのステータスページは存在しないか、公開されていません。",
			goHome: "ホームページへ",
		},
	},

	contentMonitoring: {
		title: "コンテンツ監視",
		description:
			"特定のキーワードやパターンのレスポンスコンテンツをチェックします。いずれかのチェックが通らない場合、モニターは失敗となります。",
		empty:
			"コンテンツチェックが設定されていません。レスポンス内の特定のキーワードやパターンを監視するためのチェックを追加してください。",
		addButton: "コンテンツチェックを追加",

		form: {
			checkType: {
				label: "チェックタイプ",
				description: "レスポンスコンテンツのマッチング方法を選択",
				options: {
					contains: "含む",
					notContains: "含まない",
					regex: "正規表現パターン",
				},
			},
			value: {
				label: "値",
				placeholder: "キーワードまたはパターンを入力",
				description: "チェックするテキストまたは正規表現パターン",
			},
			caseSensitive: "大文字小文字を区別",
			cancel: "キャンセル",
			add: "チェックを追加",
		},

		item: {
			caseSensitive: "大文字小文字を区別",
			disabled: "無効",
			delete: "削除",
		},

		types: {
			contains: "含む",
			notContains: "含まない",
			regex: "正規表現",
		},
	},

	auth: {
		error: {
			title: "認証エラー",
			errorCode: "エラーコード: {{code}}",
			description: "説明: {{description}}",
			uri: "URI:",
			tryAgain: "もう一度お試しいただくか、問題が解決しない場合はサポートにお問い合わせください。",
		},
	},

	dashboard: {
		header: {
			title: "Uptimeモニター",
			cta: "モニターを作成",
			subscribe: "モニターが一時停止されています。監視を続けるにはサブスクリプションが必要です",
		},

		monitor: {
			stats: {
				title: "統計",
				uptime: "Uptime",
				totalChecks: "総チェック数",
				lastCheck: "最終チェック",
				p99ResponseTime: "P99応答時間",
				p99ResponseTimeValue: "{{value}} ms",
				neverRan: "N/A",
			},

			actions: {
				refresh: "更新",
				delete: {
					confirm: "このモニターを削除してもよろしいですか？",
					cta: "モニターを削除",
				},
			},
		},
	},

	createMonitor: {
		title: "新しいモニターを作成",
		fields: {
			name: {
				label: "モニター名",
				placeholder: "ランディングページ",
				description: "モニターの説明的な名前。",
			},
			url: {
				label: "監視するURL",
				placeholder: "https://example.com/healthcheck",
				description: "監視したいサービスのURL。",
			},
			method: {
				label: "リクエストメソッド",
				placeholder: "HEAD",
				description: "リクエストに使用するHTTPメソッド。",
			},
			status: {
				label: "期待されるステータスコード",
				placeholder: "200",
				description: "受信を期待するHTTPステータスコード。",
			},
			interval: {
				label: "チェック間隔",
				placeholder: "60",
				description: "秒単位の間隔。最小は60秒です。",
			},
			visibility: {
				label: "公開設定",
				description: "公開モニターは誰とでも共有できます。",
				options: { public: "公開", private: "非公開" },
			},
			region: {
				label: "リージョン",
				description: "pingが実行されるリージョン。",
				placeholder: "wnam",
				options: {
					afr: "{{emoji}} アフリカ",
					apac: "{{emoji}} アジア太平洋",
					eeur: "{{emoji}} 東ヨーロッパ",
					enam: "{{emoji}} 東北アメリカ",
					me: "{{emoji}} 中東",
					oc: "{{emoji}} オセアニア",
					sam: "{{emoji}} 南アメリカ",
					weur: "{{emoji}} 西ヨーロッパ",
					wnam: "{{emoji}} 西北アメリカ",
				},
			},
		},
		cta: "モニターを作成",
	},

	toasts: {
		refreshMonitor: {
			pending: "{{name}}をpingしています...",
			success: "{{name}}のpingが完了しました。",
			failure: "モニターの実行中にエラーが発生しました。",
		},

		deleteMonitor: {
			success: "{{name}}が削除されました。",
			failure: "{{name}}を削除できませんでした。もう一度お試しください。",
		},

		createMonitor: {
			pending: "モニター{{name}}を作成しています...",
			success: "{{name}}が作成されました。",
			failure: "{{name}}を作成できませんでした。もう一度お試しください。",
		},
	},

	components: {
		heatmap: {
			tooltip: "{{date}}\n成功率：{{successRate}}\nチェック数：{{checks}}",
			legend: {
				success: "成功",
				failure: "失敗",
				mixed: "混合",
				noData: "データなし",
			},
		},
	},

	actions: {
		addDomain: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームにドメインを追加する権限がありません。",
				alreadyExists: "{{hostname}}は{{verifiedAt}}に追加されました。",
			},

			success: {
				accepted: "{{hostname}}は確認待ちの状態です。",
				created: "{{hostname}}が{{team}}に追加されました。確認は保留中です。",
			},
		},

		changeRole: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームで役割を変更する権限がありません。",
				cannotChangeOwner: "チームオーナーの役割は変更できません。",
			},

			success: "{{name}}の役割が{{team}}で{{role}}に変更されました。",
		},

		createAlert: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームでアラートを作成する権限がありません。",
				limitExceeded: "このチームのアラート上限（{{limit}}個）に達しました。",
			},
			success: { created: "{{name}}アラートが作成されました。" },
		},

		createInvite: {
			email: {
				subject: "Uptimeの{{team}}に招待されました",
			},

			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームにメンバーを招待する権限がありません。",
				alreadyAccepted: "このメールアドレスは既に{{team}}のメンバーです。",
			},

			success: "{{email}}が{{team}}に招待されました。",
		},

		createMonitor: {
			errors: {
				generic: "エラーが発生しました。",
			},

			success: "{{name}}モニターが作成されました。",
		},

		updateMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このモニターは存在しません。",
			},

			success: "{{name}}モニターが更新されました。",
		},

		updateSsl: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このモニターは存在しません。",
			},

			success: "{{name}}のSSL設定が更新されました。",
		},

		deleteMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームでモニターを削除する権限がありません。",
				notFound: "このモニターは存在しません。",
			},
			success: "{{name}}モニターが削除されました。",
		},

		playMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このモニターは存在しません。",
			},

			pending: "{{name}}をpingしています...",
			success: "{{name}}のpingが完了しました。",
			failure: "モニターの実行中にエラーが発生しました。",
		},

		removeAlert: {
			errors: {
				generic: "エラーが発生しました。",
				forbidden: "このチームでアラートを削除する権限がありません。",
				notFound: "{{name}}は存在しません。",
			},
			success: "{{name}}アラートが削除されました。",
		},

		removeDomain: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームからドメインを削除する権限がありません。",
				notFound: "{{hostname}}は存在しません。",
			},

			success: "{{hostname}}が{{team}}から削除されました。",
		},

		removeMember: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームからメンバーを削除する権限がありません。",
				cannotRemoveOwner: "チームオーナーは削除できません。",
			},

			success: "{{name}}が{{team}}から削除されました。",
		},

		retryDomainVerification: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームでドメイン確認を再試行する権限がありません。",
				notFound: "{{hostname}}は存在しません。",
				workflowFailed:
					"{{hostname}}の確認プロセスを開始できませんでした。後でもう一度お試しください。",
			},

			success: {
				alreadyVerified: "{{hostname}}は既に確認済みです。",
				requested: "{{hostname}}の確認再試行がリクエストされました。",
			},
		},

		revokeInvite: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームで招待を取り消す権限がありません。",
				notFound: "この招待は存在しません。",
				alreadyAccepted: "この招待は既に受け入れられています。",
			},

			success: "{{email}}の{{team}}への招待が取り消されました。",
		},

		updateTeam: {
			errors: {
				generic: "エラーが発生しました。",
				forbidden: "チーム設定を更新する権限がありません。",
			},

			success: {
				updated: "チーム設定が正常に更新されました。",
			},
		},

		deleteTeam: {
			errors: {
				generic: "チームの削除中にエラーが発生しました。",
				forbidden: "チームを削除できるのはチームオーナーのみです。",
				confirmationRequired: "確認のためDELETEと入力してください。",
			},

			success: "{{team}}が削除されました。",
		},

		leaveTeam: {
			errors: {
				generic: "エラーが発生しました。",
				notMember: "あなたはこのチームのメンバーではありません。",
				ownerCannotLeave:
					"チームオーナーはチームを離れることができません。先にオーナー権限を移譲してください。",
				adminCannotLeave:
					"管理者はチームを離れることができません。オーナーに降格を依頼してください。",
			},

			success: "{{team}}を離れました。",
		},

		createStatusPage: {
			errors: {
				generic: "エラーが発生しました。",
				slugTaken: "このスラッグは既に使用されています。",
			},
		},

		updateStatusPage: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このステータスページは存在しません。",
				slugTaken: "このスラッグは既に使用されています。",
			},
		},

		deleteStatusPage: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このステータスページは存在しません。",
			},

			success: "ステータスページが削除されました。",
		},

		createMaintenance: {
			errors: {
				generic: "エラーが発生しました。",
				invalidDates: "終了時刻は開始時刻より後である必要があります。",
			},

			success: {
				created: "メンテナンスウィンドウ「{{name}}」が作成されました。",
			},
		},

		deleteMaintenance: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このメンテナンスウィンドウは存在しません。",
				forbidden: "このメンテナンスウィンドウを削除する権限がありません。",
			},

			success: "メンテナンスウィンドウ「{{name}}」が削除されました。",
		},

		endMaintenance: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このメンテナンスウィンドウは存在しません。",
				forbidden: "このメンテナンスウィンドウを終了する権限がありません。",
			},

			success: "メンテナンスウィンドウ「{{name}}」が早期終了されました。",
		},

		createTeam: {
			errors: {
				generic: "チームの作成中にエラーが発生しました。",
			},

			success: {
				created: "{{name}}チームが正常に作成されました。",
			},
		},

		createDnsMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				limitExceeded: "このチームのDNSモニター上限（{{limit}}個）に達しました。",
			},

			success: {
				created: "{{name}} DNSモニターが作成されました。",
			},
		},

		updateDnsMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このDNSモニターは存在しません。",
				forbidden: "このDNSモニターを更新する権限がありません。",
			},

			success: "{{name}} DNSモニターが更新されました。",
		},

		deleteDnsMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このDNSモニターは存在しません。",
				forbidden: "このDNSモニターを削除する権限がありません。",
			},

			success: "{{name}} DNSモニターが削除されました。",
		},

		checkDnsMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このDNSモニターは存在しません。",
				forbidden: "このDNSモニターをチェックする権限がありません。",
			},

			success: "{{name}}のDNSチェックが完了しました。",
		},

		createTcpMonitor: {
			errors: {
				generic: "TCPモニターの作成中にエラーが発生しました。",
			},
			success: "{{name}} TCPモニターが作成されました。",
		},

		updateTcpMonitor: {
			errors: {
				generic: "TCPモニターの更新中にエラーが発生しました。",
				notFound: "このTCPモニターは存在しません。",
			},
			success: "{{name}} TCPモニターが更新されました。",
		},

		deleteTcpMonitor: {
			errors: {
				generic: "TCPモニターの削除中にエラーが発生しました。",
				notAllowed: "このチームでTCPモニターを削除する権限がありません。",
				notFound: "このTCPモニターは存在しません。",
			},
			success: "{{name}} TCPモニターが削除されました。",
		},

		createApiKey: {
			errors: {
				generic: "APIキーの作成中にエラーが発生しました。",
				limitExceeded: "このチームのAPIキー上限（{{limit}}個）に達しました。",
			},
			success: {
				created: "APIキー「{{name}}」が作成されました。",
			},
		},

		deleteApiKey: {
			errors: {
				generic: "APIキーの削除中にエラーが発生しました。",
				notFound: "このAPIキーは存在しません。",
			},
			success: "APIキー「{{name}}」が削除されました。",
		},

		updateLanguage: {
			errors: {
				generic: "言語設定の更新中にエラーが発生しました。",
			},
			success: "言語設定が正常に更新されました。",
		},
	},

	page: {
		dashboard: {
			header: {
				title: "ダッシュボード",
				action: {
					create: "モニターを作成",
					refresh: "更新",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			empty: {
				title: "モニターがありません",
				description: "最初のモニターを作成してサービスの追跡を開始しましょう。",
				cta: "モニターを作成",
			},

			stats: {
				monitors: {
					label: "月間ping使用量",
					value: "{{consumed}}<small> 使用済み</small>",
					description: "推定{{estimated}}のうち",
				},

				uptime: {
					label: "Uptime率",
					description: "システム全体のUptime",
				},

				slowestEndpoint: {
					label: {
						default: "最も遅いエンドポイント「<em>{{name}}</em>」",
						noData: "最も遅いエンドポイント",
					},
					value: { noData: "N/A" },
					description: "過去24時間",
				},
			},

			table: {
				label: "モニター",

				columns: {
					name: "名前",
					latencyChart: "レイテンシトレンド",
					status: "ステータス",
					lastIncident: "最終インシデント",
					responseTime: "平均レイテンシ",
					actions: "アクション",
				},

				status: {
					up: "稼働中",
					down: "ダウン",
					degraded: "低下",
					unknown: "データなし",
				},

				lastIncident: { never: "-" },
				responseTime: "約{{value}}",

				actions: {
					menu: "アクションメニュー",
					edit: "モニターを編集",
					delete: "モニターを削除",
					play: "モニターを実行",
				},

				confirmation: {
					deleteMonitor: "モニター{{name}}を削除してもよろしいですか？この操作は取り消せません。",
				},
			},
		},

		monitors: {
			header: {
				title: "Uptimeモニター",
				cta: "モニターを作成",
				subscribe: "モニターが一時停止されています。監視を続けるにはサブスクリプションが必要です",
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},
		},

		createMonitor: {
			header: {
				title: "モニターを作成",
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			form: {
				fields: {
					name: {
						label: "モニター名",
						placeholder: "ランディングページ",
						description: "モニターの説明的な名前。",
					},
					url: {
						label: "監視するURL",
						placeholder: "https://example.com/healthcheck",
						description: "監視したいサービスのURL。",
					},
					method: {
						label: "リクエストメソッド",
						placeholder: "HEAD",
						description: "リクエストに使用するHTTPメソッド。",
					},
					status: {
						label: "期待されるステータスコード",
						placeholder: "200",
						description: "受信を期待するHTTPステータスコード。",
					},
					interval: {
						label: "チェック間隔",
						placeholder: "60",
						description: "秒単位の間隔。最小は60秒です。",
					},
					visibility: {
						label: "公開設定",
						description: "公開モニターは誰とでも共有できます。",
						options: { public: "公開", private: "非公開" },
					},
					region: {
						label: "リージョン",
						description: "pingが実行されるリージョン。",
						placeholder: "wnam",
						options: {
							afr: "{{emoji}} アフリカ",
							apac: "{{emoji}} アジア太平洋",
							eeur: "{{emoji}} 東ヨーロッパ",
							enam: "{{emoji}} 東北アメリカ",
							me: "{{emoji}} 中東",
							oc: "{{emoji}} オセアニア",
							sam: "{{emoji}} 南アメリカ",
							weur: "{{emoji}} 西ヨーロッパ",
							wnam: "{{emoji}} 西北アメリカ",
						},
					},
				},

				cta: "モニターを作成",
			},
		},

		editMonitor: {
			header: {
				title: "モニターを編集",
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			form: {
				fields: {
					name: {
						label: "モニター名",
						placeholder: "ランディングページ",
						description: "モニターの説明的な名前。",
					},
					url: {
						label: "監視するURL",
						placeholder: "https://example.com/healthcheck",
						description: "監視したいサービスのURL。",
					},
					method: {
						label: "リクエストメソッド",
						placeholder: "HEAD",
						description: "リクエストに使用するHTTPメソッド。",
					},
					status: {
						label: "期待されるステータスコード",
						placeholder: "200",
						description: "受信を期待するHTTPステータスコード。",
					},
					interval: {
						label: "チェック間隔",
						placeholder: "60",
						description: "秒単位の間隔。最小は60秒です。",
					},
					visibility: {
						label: "公開設定",
						description: "公開モニターは誰とでも共有できます。",
						options: { public: "公開", private: "非公開" },
					},
					region: {
						label: "リージョン",
						description: "pingが実行されるリージョン。",
						placeholder: "wnam",
						options: {
							afr: "{{emoji}} アフリカ",
							apac: "{{emoji}} アジア太平洋",
							eeur: "{{emoji}} 東ヨーロッパ",
							enam: "{{emoji}} 東北アメリカ",
							me: "{{emoji}} 中東",
							oc: "{{emoji}} オセアニア",
							sam: "{{emoji}} 南アメリカ",
							weur: "{{emoji}} 西ヨーロッパ",
							wnam: "{{emoji}} 西北アメリカ",
						},
					},
					ssl: {
						enabled: {
							label: "SSL監視を有効化",
							description: "SSL証明書の有効期限を監視し、期限切れ前にアラートを受け取ります。",
						},
						expiresAt: {
							label: "証明書の有効期限",
							placeholder: "有効期限を選択",
							description:
								"SSL証明書の有効期限を入力してください。ホスティングプロバイダーのダッシュボードまたはブラウザで証明書の詳細を確認できます。",
						},
						issuer: {
							label: "証明書発行者",
							placeholder: "Let's Encrypt、DigiCertなど",
							description: "SSL証明書を発行した認証局（任意）。",
						},
						warningDays: {
							label: "期限前アラート",
							description: "証明書の有効期限の何日前にアラートを受け取るか。",
						},
					},
				},

				cancel: "キャンセル",
				cta: "変更を保存",
			},
		},

		monitor: {
			header: {
				title: "モニター「{{name}}」",

				action: {
					play: "モニターを実行",
					edit: "モニターを編集",
					refresh: "更新",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			stats: {
				monitors: {
					label: "月間ping使用量",
					value: "{{consumed}}<small> 使用済み</small>",
					description: "推定{{estimated}}のうち",
				},

				uptime: {
					label: "Uptime率",
					description: "モニター全体のUptime",
				},

				slowestResult: {
					label: "最も遅い結果",
					description: "過去24時間",
				},
			},

			heatmap: {
				tooltip: "{{date}}\n成功率：{{successRate}}\nチェック数：{{checks}}",
				legend: {
					success: "成功",
					failure: "失敗",
					mixed: "混合",
					noData: "データなし",
				},
			},

			ssl: {
				title: "SSL証明書",
				status: {
					valid: "有効",
					expiring: "まもなく期限切れ",
					expired: "期限切れ",
					error: "エラー",
					unknown: "未設定",
				},
				expiresAt: "有効期限",
				expiresIn: "{{days}}日",
				issuer: "発行者",
				lastChecked: "最終チェック",
				notConfigured: "このモニターではSSL監視が有効になっていません。",
				configure: "SSL監視を設定",
			},
		},

		billing: {
			header: {
				title: "請求",
			},
		},

		members: {
			header: {
				title: "チームメンバー",

				action: {
					invite: "メンバーを招待",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			sections: {
				members: {
					title: "メンバー",
					description: "チームメンバーと役割を管理します。",
				},
			},

			membersTable: {
				label: "現在のメンバー",
				description: "このチームにアクセスできるメンバー。",

				columns: {
					name: "名前",
					role: "チームの役割",
					actions: "アクション",
				},

				role: {
					member: "メンバー",
					admin: "管理者",
					owner: "オーナー",
				},

				actions: {
					menu: "アクションメニュー",
					remove: "チームから削除",
					transfer: "オーナー権限を移譲",
					changeRole: {
						member: "管理者に変更",
						admin: "メンバーに変更",
						owner: "オーナーは変更できません",
					},
				},

				confirmation: {
					removeMember: "{{name}}をチームから削除してもよろしいですか？",
				},
			},

			invitedMembersTable: {
				label: "保留中の招待",
				description: "招待されたがまだ参加していないメンバー。",

				columns: {
					email: "メール",
					actions: "アクション",
				},

				actions: {
					menu: "アクションメニュー",
					copy: "招待リンクをコピー",
					revoke: "招待を取り消し",
				},

				confirmation: {
					revokeInvite: "{{email}}の招待を取り消してもよろしいですか？",
				},
			},

			error: {
				forbidden: {
					title: "このページにアクセスする権限がありません。",
					description: "チーム管理者にお問い合わせください。",
				},

				unknown: {
					title: "予期しないエラーが発生しました。",
					description: "後でもう一度お試しいただくか、サポートにお問い合わせください。",
				},
			},
		},

		invite: {
			header: {
				title: "チームメンバーを招待",
				description: "チームへの参加招待を送信します。",
			},

			dialog: {
				close: "ダイアログを閉じる",
			},

			form: {
				fields: {
					email: {
						label: "メールアドレス",
						placeholder: "john.doe@example.com",
						description: "{{team}}に招待したい方のメールアドレス。",
					},
				},

				cancel: "キャンセル",
				cta: "メンバーを招待",
			},
		},

		acceptInvite: {
			errors: {
				notFound: "この招待は存在しません。",
				gone: "この招待は既に受け入れられています。",
				forbidden: "この招待はあなた宛てではありません。",
				badRequest: "メールアドレスが見つかりません。再度ログインしてください。",
			},
		},

		domains: {
			header: {
				title: "チームドメイン",
				action: { addDomain: "ドメインを追加" },
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			sections: {
				domains: {
					title: "ドメイン",
					description: "チームの確認済みドメインを管理します。",
				},
			},

			form: {
				fields: {
					hostname: {
						label: "ドメイン",
						placeholder: "example.com",
						description: "{{team}}に追加したいドメイン。",
					},
				},

				cta: "ドメインを追加",
			},

			table: {
				label: "確認済みドメイン",
				description: "チームメンバーの自動プロビジョニングに使用できるドメイン。",

				columns: {
					hostname: "ホスト名",
					id: "確認ID",
					verifiedAt: "確認日時",
					actions: "アクション",
				},

				verifiedAt: {
					pending: "確認待ち",
				},

				actions: {
					menu: "アクションメニュー",
					copy: "確認IDをコピー",
					remove: "ドメインを削除",
					retryVerification: "確認を再試行",
				},

				confirmation: {
					removeDomain: "{{hostname}}をチームから削除してもよろしいですか？",
				},
			},

			instructions: {
				title: "ドメインを確認する方法",

				description: "ドメインを確認するには、DNS設定に以下の`TXT`レコードを追加してください：",

				record: {
					name: {
						label: "名前",
						value: "_ping-verification",
					},
					content: {
						label: "内容",
						value: "VERIFICATION_ID",
					},
				},

				note: "<code>VERIFICATION_ID</code>を上に表示されている実際の確認IDに置き換えてください。",

				disclaimer: "DNS変更の反映には時間がかかる場合があるため、確認が遅れることがあります。",
			},

			error: {
				forbidden: {
					title: "このページにアクセスする権限がありません。",
					description: "チーム管理者にお問い合わせください。",
				},

				unknown: {
					title: "予期しないエラーが発生しました。",
					description: "後でもう一度お試しいただくか、サポートにお問い合わせください。",
				},
			},
		},

		alerts: {
			header: {
				title: "アラート",

				action: {
					create: "アラートを作成",
					history: "履歴を表示",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			empty: {
				title: "アラートが設定されていません",
				description: "モニターがダウンした時に通知を受け取るためのアラートを作成してください。",
				cta: "アラートを作成",
			},

			form: {
				fields: {
					name: {
						label: "名前",
						placeholder: "CTOアラート",
						description: "アラートを識別するための名前。",
					},

					strategy: {
						label: "戦略",
						description: "アラートに使用する戦略。",
						options: {
							webhook: "Webhook",
							email: "メール",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "Webhook URL",
								placeholder: "https://example.com/webhook",
								description: "アラートペイロードを送信するURL。",
							},
							secret: {
								label: "シークレット",
								placeholder: "オプションのシークレット",
								description:
									"リクエストヘッダーに含めるオプションのシークレット。このシークレットを使用したペイロードのHMAC SHA256署名が`Webhook-Signature`ヘッダーとして追加されます。",
							},
						},
						email: {
							to: {
								label: "メールアドレス",
								placeholder: "cto@example.com",
								description: "アラートを送信するメールアドレス。",
							},

							subjectPrefix: {
								label: "件名プレフィックス",
								placeholder: "[Uptimeアラート]",
								description:
									"メール件名に追加するオプションのプレフィックス。受信箱でアラートをフィルタリングするのに便利です。",
							},
						},
						slack: {
							webhookUrl: {
								label: "Slack Webhook URL",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"Slackの受信Webhook URL。api.slack.com/apps > 受信Webhookで作成できます。",
							},
							channel: {
								label: "チャンネルの上書き",
								placeholder: "#alerts",
								description:
									"Webhookのデフォルトの代わりに投稿するオプションのチャンネル。#プレフィックスを含めてください。",
							},
						},
						discord: {
							webhookUrl: {
								label: "Discord Webhook URL",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"DiscordのWebhook URL。サーバー設定 > 連携サービス > Webhookで作成できます。",
							},
						},
					},

					notifyOnRecovery: {
						label: "復旧時に通知",
						description:
							"モニターがダウン状態から復旧した時にアラートを送信します。復旧時間とダウンタイムの期間が含まれます。",
					},

					cooldown: {
						label: "アラートクールダウン",
						description:
							"同じタイプのアラート間の最小時間。継続的な障害中のアラート疲れを防ぎます。",
						options: {
							none: "クールダウンなし",
							"5min": "5分",
							"15min": "15分",
							"30min": "30分",
							"1hour": "1時間",
							"2hours": "2時間",
							custom: "カスタム",
						},
						custom: {
							label: "カスタムクールダウン（分）",
							placeholder: "分を入力",
							description: "アラート間の分数を入力してください。",
						},
					},
				},

				cta: "アラートを作成",
			},

			table: {
				label: "アラート",

				columns: {
					name: "名前",
					strategy: "タイプ",
					notifyOnRecovery: "復旧通知",
					cooldown: "クールダウン",
					actions: "アクション",
				},

				cooldown: {
					none: "なし",
					minutes: "{{count}}分",
					hours: "{{count}}時間",
				},

				actions: {
					menu: "アクションメニュー",
					edit: "アラートを編集",
					remove: "アラートを削除",
				},

				types: {
					webhook: "Webhook",
					email: "メール",
					slack: "Slack",
					discord: "Discord",
				},

				notifyOnRecovery: {
					enabled: "はい",
					disabled: "いいえ",
				},

				confirmation: {
					deleteAlert: "アラート{{name}}を削除してもよろしいですか？",
				},
			},
		},

		statusPages: {
			header: {
				title: "ステータスページ",

				action: {
					create: "ステータスページを作成",
				},
			},

			empty: {
				title: "ステータスページがありません",
				description:
					"ユーザーとシステムステータスを共有するためのステータスページを作成してください。",
				cta: "ステータスページを作成",
			},

			table: {
				label: "ステータスページ",

				columns: {
					name: "名前",
					slug: "URL",
					monitors: "モニター",
					visibility: "公開設定",
					actions: "アクション",
				},

				visibility: {
					public: "公開",
					private: "非公開",
				},

				actions: {
					menu: "アクションメニュー",
					view: "ページを表示",
					edit: "ページを編集",
					delete: "ページを削除",
				},

				confirmation: {
					delete: "ステータスページ{{name}}を削除してもよろしいですか？",
				},
			},

			form: {
				fields: {
					name: {
						label: "内部名",
						placeholder: "本番ステータス",
						description: "ステータスページを内部で識別するための名前。",
					},
					slug: {
						label: "URLスラッグ",
						placeholder: "production",
						description: "公開ステータスページのURLパス（例：/status/production）。",
					},
					title: {
						label: "公開タイトル",
						placeholder: "Acme Inc. ステータス",
						description: "公開ステータスページに表示されるタイトル。",
					},
					description: {
						label: "説明",
						placeholder: "Acme Inc.サービスの現在のステータス",
						description: "ステータスページのオプションの説明。",
					},
					logoUrl: {
						label: "ロゴURL",
						placeholder: "https://example.com/logo.png",
						description: "ステータスページに表示するオプションのロゴ。",
					},
					isPublic: {
						label: "公開",
						description:
							"リンクを知っている人なら誰でもこのステータスページにアクセスできるようにします。",
					},
					showOverallStatus: {
						label: "全体ステータスを表示",
						description: "ページの上部にシステム全体のステータスバナーを表示します。",
					},
					monitors: {
						label: "含めるモニター",
						description: "このステータスページに表示するモニターを選択してください。",
					},
				},

				cta: "ステータスページを作成",
				ctaUpdate: "変更を保存",
			},
		},

		createStatusPage: {
			header: {
				title: "ステータスページを作成",
			},
		},

		editStatusPage: {
			header: {
				title: "ステータスページを編集",
			},
		},

		dnsMonitors: {
			header: {
				title: "DNSモニター",

				action: {
					create: "DNSモニターを作成",
				},
			},

			empty: {
				title: "DNSモニターがありません",
				description: "DNSレコードの変更を追跡するためのDNSモニターを作成してください。",
				cta: "DNSモニターを作成",
			},

			table: {
				label: "DNSモニター",

				columns: {
					name: "名前",
					domain: "ドメイン",
					recordType: "タイプ",
					status: "ステータス",
					lastChecked: "最終チェック",
					actions: "アクション",
				},

				disabled: "無効",
				neverChecked: "未実行",

				actions: {
					menu: "アクションメニュー",
					check: "今すぐチェック",
					edit: "編集",
					delete: "削除",
				},

				confirmation: {
					delete: "DNSモニター{{name}}を削除してもよろしいですか？",
				},
			},
		},

		createDnsMonitor: {
			header: {
				title: "DNSモニターを作成",
			},

			form: {
				fields: {
					name: {
						label: "モニター名",
						placeholder: "本番DNS",
						description: "このDNSモニターの説明的な名前。",
					},

					domain: {
						label: "ドメイン",
						placeholder: "example.com",
						description: "DNSレコードを監視するドメイン。",
					},

					recordType: {
						label: "レコードタイプ",
						description: "チェックするDNSレコードのタイプ。",
					},

					expectedValue: {
						label: "期待値",
						placeholder: "192.168.1.1",
						description:
							"任意。解決された値が一致しない場合にアラートします。変更を追跡するには空のままにしてください。",
					},

					interval: {
						label: "チェック間隔",
						description: "DNSレコードをチェックする頻度。",
						options: {
							"5m": "5分",
							"15m": "15分",
							"30m": "30分",
							"1h": "1時間",
							"6h": "6時間",
							"12h": "12時間",
							"24h": "24時間",
						},
					},

					isEnabled: {
						label: "監視を有効化",
						description: "このDNSレコードの監視を直ちに開始します。",
					},
				},

				cta: "DNSモニターを作成",
			},
		},

		editDnsMonitor: {
			header: {
				title: "DNSモニターを編集",
			},

			form: {
				fields: {
					name: {
						label: "モニター名",
						placeholder: "本番DNS",
						description: "このDNSモニターの説明的な名前。",
					},

					domain: {
						label: "ドメイン",
						placeholder: "example.com",
						description: "DNSレコードを監視するドメイン。",
					},

					recordType: {
						label: "レコードタイプ",
						description: "チェックするDNSレコードのタイプ。",
					},

					expectedValue: {
						label: "期待値",
						placeholder: "192.168.1.1",
						description:
							"任意。解決された値が一致しない場合にアラートします。変更を追跡するには空のままにしてください。",
					},

					interval: {
						label: "チェック間隔",
						description: "DNSレコードをチェックする頻度。",
						options: {
							"5m": "5分",
							"15m": "15分",
							"30m": "30分",
							"1h": "1時間",
							"6h": "6時間",
							"12h": "12時間",
							"24h": "24時間",
						},
					},

					isEnabled: {
						label: "監視を有効化",
						description: "このDNSレコードを積極的に監視するかどうか。",
					},
				},

				cancel: "キャンセル",
				cta: "変更を保存",
			},
		},

		dnsMonitorDetail: {
			header: {
				title: "DNSモニター「{{name}}」",

				action: {
					check: "今すぐチェック",
					refresh: "更新",
					edit: "編集",
				},
			},

			info: {
				domain: "ドメイン",
				recordType: "レコードタイプ",
				status: "ステータス",
				expectedValue: "期待値",
				currentValue: "現在の値",
			},

			stats: {
				totalChecks: {
					label: "総チェック数",
					description: "実行されたDNSチェックの数",
				},

				successRate: {
					label: "成功率",
					description: "成功したチェックの割合",
				},

				avgResponseTime: {
					label: "平均応答時間",
					description: "平均DNS解決時間",
				},
			},

			results: {
				title: "チェック履歴",
				empty: "まだチェックが実行されていません。",

				table: {
					columns: {
						checkedAt: "チェック日時",
						status: "ステータス",
						value: "値",
						responseTime: "応答時間",
					},
				},
			},
		},

		maintenance: {
			header: {
				title: "メンテナンスウィンドウ",

				action: {
					create: "メンテナンスをスケジュール",
				},
			},

			empty: {
				title: "メンテナンスウィンドウがありません",
				description:
					"計画されたダウンタイム中にアラートを抑制するためのメンテナンスウィンドウをスケジュールしてください。",
				cta: "メンテナンスをスケジュール",
			},

			tabs: {
				label: "メンテナンスステータス",
				active: "実行中",
				upcoming: "予定",
				past: "過去",
			},

			noActive: "実行中のメンテナンスウィンドウはありません",
			noUpcoming: "予定されたメンテナンスウィンドウはありません",
			noPast: "過去のメンテナンスウィンドウはありません",

			table: {
				columns: {
					name: "名前",
					schedule: "スケジュール",
					monitor: "モニター",
					status: "ステータス",
					actions: "アクション",
				},

				allMonitors: "すべてのモニター",
				recurring: "繰り返し",

				status: {
					active: "実行中",
					upcoming: "予定",
					past: "完了",
				},

				actions: {
					menu: "アクションメニュー",
					end: "今すぐ終了",
					delete: "削除",
				},

				confirmation: {
					endMaintenance: "「{{name}}」メンテナンスを早期終了してもよろしいですか？",
					deleteMaintenance: "「{{name}}」を削除してもよろしいですか？",
				},
			},
		},

		createMaintenance: {
			header: {
				title: "メンテナンスをスケジュール",
			},

			form: {
				fields: {
					name: {
						label: "名前",
						placeholder: "データベースアップグレード",
						description: "メンテナンス作業の説明。",
					},

					monitor: {
						label: "モニター",
						description:
							"特定のモニターを選択するか、すべてのモニターの場合は空のままにしてください。",
						all: "すべてのモニター",
					},

					startsAt: {
						label: "開始時刻",
						description: "メンテナンスウィンドウが始まる時刻。",
					},

					duration: {
						label: "期間",
						description: "メンテナンスウィンドウの長さ。",
						options: {
							"15m": "15分",
							"30m": "30分",
							"1h": "1時間",
							"2h": "2時間",
							"4h": "4時間",
							"8h": "8時間",
						},
					},

					suppressAlerts: {
						label: "アラートを抑制",
						description: "このメンテナンスウィンドウ中はアラートを送信しません。",
					},

					showOnStatusPage: {
						label: "ステータスページに表示",
						description: "公開ステータスページにメンテナンス通知を表示します。",
					},

					isRecurring: {
						label: "繰り返し",
						description: "このメンテナンスウィンドウをスケジュールに従って繰り返します。",
					},

					recurringPattern: {
						label: "繰り返しパターン",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"パターン形式：'daily:HH:MM-HH:MM'、'weekly:曜日:HH:MM-HH:MM'、または'monthly:日:HH:MM-HH:MM'",
					},
				},

				preview: {
					label: "メンテナンスウィンドウ",
				},

				cta: "メンテナンスをスケジュール",
			},
		},

		alertHistory: {
			header: {
				title: "アラート履歴",
			},

			breadcrumbs: {
				alerts: "アラート",
			},

			empty: {
				title: "アラートイベントがありません",
				description:
					"モニターがアラートをトリガーすると、アラートイベントがここに表示されます。アラートを設定して開始してください。",
				cta: "アラートを表示",
			},

			table: {
				label: "アラートイベント",

				columns: {
					alert: "アラート",
					monitor: "モニター",
					eventType: "イベント",
					status: "ステータス",
					sentAt: "時刻",
				},

				unknownAlert: "不明なアラート",
				unknownMonitor: "不明なモニター",

				eventType: {
					down: "ダウン",
					up: "復旧",
					degraded: "低下",
				},

				status: {
					sent: "送信済み",
					skipped_cooldown: "スキップ（クールダウン）",
					failed: "失敗",
				},
			},
		},

		createAlert: {
			header: {
				title: "アラートを作成",
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			form: {
				fields: {
					name: {
						label: "名前",
						placeholder: "CTOアラート",
						description: "アラートを識別するための名前。",
					},

					strategy: {
						label: "戦略",
						description: "アラートに使用する戦略。",
						options: {
							webhook: "Webhook",
							email: "メール",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "Webhook URL",
								placeholder: "https://example.com/webhook",
								description: "アラートペイロードを送信するURL。",
							},
							secret: {
								label: "シークレット",
								placeholder: "オプションのシークレット",
								description:
									"リクエストヘッダーに含めるオプションのシークレット。このシークレットを使用したペイロードのHMAC SHA256署名が`Webhook-Signature`ヘッダーとして追加されます。",
							},
						},
						email: {
							to: {
								label: "メールアドレス",
								placeholder: "cto@example.com",
								description: "アラートを送信するメールアドレス。",
							},

							subjectPrefix: {
								label: "件名プレフィックス",
								placeholder: "[Uptimeアラート]",
								description:
									"メール件名に追加するオプションのプレフィックス。受信箱でアラートをフィルタリングするのに便利です。",
							},
						},
						slack: {
							webhookUrl: {
								label: "Slack Webhook URL",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"Slackの受信Webhook URL。api.slack.com/apps > 受信Webhookで作成できます。",
							},
							channel: {
								label: "チャンネルの上書き",
								placeholder: "#alerts",
								description:
									"Webhookのデフォルトの代わりに投稿するオプションのチャンネル。#プレフィックスを含めてください。",
							},
						},
						discord: {
							webhookUrl: {
								label: "Discord Webhook URL",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"DiscordのWebhook URL。サーバー設定 > 連携サービス > Webhookで作成できます。",
							},
						},
					},

					notifyOnRecovery: {
						label: "復旧時に通知",
						description:
							"モニターがダウン状態から復旧した時にアラートを送信します。復旧時間とダウンタイムの期間が含まれます。",
					},

					cooldown: {
						label: "アラートクールダウン",
						description:
							"同じタイプのアラート間の最小時間。継続的な障害中のアラート疲れを防ぎます。",
						options: {
							none: "クールダウンなし",
							"5min": "5分",
							"15min": "15分",
							"30min": "30分",
							"1hour": "1時間",
							"2hours": "2時間",
							custom: "カスタム",
						},
						custom: {
							label: "カスタムクールダウン（分）",
							placeholder: "分を入力",
							description: "アラート間の分数を入力してください。",
						},
					},
				},

				cta: "アラートを作成",
			},
		},

		logout: {
			title: "ログアウトしてもよろしいですか？",
			cta: "ログアウト",
		},

		splat: {
			notFound: {
				title: "見つかりません",
				description: "お探しのページは存在しません。",
			},
		},

		account: {
			meta: {
				title: "アカウント - Uptime",
				description: "アカウント設定とチームを管理します。",
			},

			header: {
				title: "アカウント",
			},

			profile: {
				title: "プロフィール",
				description: "個人情報。",
			},

			language: {
				title: "言語設定",
				description: "インターフェースの優先言語を選択してください。",

				form: {
					fields: {
						language: {
							label: "言語",
							description: "優先言語を選択してください。自動検出はブラウザの設定を使用します。",
							options: {
								auto: "自動検出",
								en: "English",
								es: "Español",
								de: "Deutsch",
								ja: "日本語",
								fr: "Français",
								it: "Italiano",
							},
						},
					},

					cta: "言語を保存",
				},
			},

			teams: {
				title: "チーム一覧",
				description: "所属しているチーム。",

				actions: {
					createTeam: "チームを作成",
				},

				empty: {
					title: "チームがありません",
					description: "サービスの監視を開始するためにチームを作成してください。",
					cta: "チームを作成",
				},

				table: {
					label: "チーム",
					description: "所属しているすべてのチーム。",

					columns: {
						team: "チーム",
						role: "役割",
						actions: "アクション",
					},

					role: {
						member: "メンバー",
						admin: "管理者",
						owner: "オーナー",
					},

					actions: {
						menu: "アクションメニュー",
						leave: "チームを離れる",
					},

					confirmation: {
						leaveTeam: "{{name}}を離れてもよろしいですか？",
					},
				},
			},
		},

		createTeam: {
			header: {
				title: "チームを作成",
				description: "サービスを監視するための新しいチームを作成します。",
			},

			dialog: {
				close: "ダイアログを閉じる",
			},

			form: {
				fields: {
					name: {
						label: "チーム名",
						placeholder: "最高のチーム",
						description: "新しいチームの名前を選択してください。",
					},
				},

				cancel: "キャンセル",
				cta: "チームを作成",
			},
		},

		settings: {
			header: {
				title: "チーム設定",
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			sections: {
				general: {
					title: "一般",
					description: "チームの基本情報を管理します。",
				},
			},

			form: {
				card: {
					title: "チームプロフィール",
					description: "チームの名前とロゴを更新します。",
				},

				fields: {
					logo: {
						label: "ロゴURL",
						placeholder: "https://example.com/logo.png",
						description: "チームのロゴ画像のURL。",
					},
					name: {
						label: "チーム名",
						placeholder: "マイチーム",
						description: "チームの名前。",
					},
				},

				actions: {
					cancel: "キャンセル",
					save: "変更を保存",
				},
			},

			members: {
				title: "メンバー",
				description: "チームメンバーと役割を管理します。",

				actions: {
					invite: "メンバーを招待",
				},

				table: {
					label: "現在のメンバー",
					description: "このチームにアクセスできるメンバー。",

					columns: {
						name: "名前",
						role: "役割",
						actions: "アクション",
					},

					role: {
						member: "メンバー",
						admin: "管理者",
						owner: "オーナー",
					},

					actions: {
						menu: "アクションメニュー",
						remove: "チームから削除",
						transfer: "オーナー権限を移譲",
						changeRole: {
							member: "管理者に変更",
							admin: "メンバーに変更",
							owner: "オーナーは変更できません",
						},
					},

					confirmation: {
						removeMember: "{{name}}をチームから削除してもよろしいですか？",
					},
				},

				invitedTable: {
					label: "保留中の招待",
					description: "招待されたがまだ参加していないメンバー。",

					columns: {
						email: "メール",
						expires: "有効期限",
						actions: "アクション",
					},

					expires: {
						expired: "期限切れ",
					},

					actions: {
						menu: "アクションメニュー",
						copy: "招待リンクをコピー",
						revoke: "招待を取り消し",
					},

					confirmation: {
						revokeInvite: "{{email}}の招待を取り消してもよろしいですか？",
					},
				},
			},

			domains: {
				title: "ドメイン",
				description: "チームの確認済みドメインを管理します。",

				actions: {
					addDomain: "ドメインを追加",
				},

				table: {
					label: "確認済みドメイン",
					description: "チームメンバーの自動プロビジョニングに使用できるドメイン。",

					columns: {
						hostname: "ホスト名",
						id: "確認ID",
						verifiedAt: "確認日時",
						actions: "アクション",
					},

					verifiedAt: {
						pending: "確認待ち",
					},

					actions: {
						menu: "アクションメニュー",
						copy: "確認IDをコピー",
						remove: "ドメインを削除",
						retryVerification: "確認を再試行",
					},

					confirmation: {
						removeDomain: "{{hostname}}をチームから削除してもよろしいですか？",
					},
				},

				form: {
					fields: {
						hostname: {
							label: "ドメイン",
							placeholder: "example.com",
							description: "{{team}}に追加したいドメイン。",
						},
					},

					cta: "ドメインを追加",
				},

				instructions: {
					title: "ドメインを確認する方法",
					description: "ドメインを確認するには、DNS設定に以下のTXTレコードを追加してください：",

					record: {
						name: {
							label: "名前",
							value: "_ping-verification",
						},
						content: {
							label: "内容",
							value: "VERIFICATION_ID",
						},
					},

					note: "<code>VERIFICATION_ID</code>を上に表示されている実際の確認IDに置き換えてください。",
					disclaimer: "DNS変更の反映には時間がかかる場合があるため、確認が遅れることがあります。",
				},
			},

			billing: {
				title: "請求",
				description: "サブスクリプションと支払い詳細を管理します。",

				card: {
					title: "サブスクリプションと支払い",
					description: "請求書の確認、支払い方法の更新、サブスクリプションの管理。",
					notice: "請求設定を管理するためにPolarのカスタマーポータルにリダイレクトされます。",
					cta: "請求ポータルを開く",
				},
			},

			danger: {
				title: "危険ゾーン",
				description: "チームに影響を与える取り消し不可能なアクション。",

				card: {
					title: "チームを削除",
					description: "このチームとすべてのデータを完全に削除します。この操作は取り消せません。",
					warning:
						"サブスクリプションがキャンセルされ、すべてのモニター、アラート、ドメイン、メンバー、招待が削除されます。",
					confirmation: {
						label: "確認のためDELETEと入力",
						placeholder: "DELETE",
					},
					cta: "チームを削除",
				},
			},

			error: {
				forbidden: {
					title: "このページにアクセスする権限がありません。",
					description: "チーム管理者にお問い合わせください。",
				},

				unknown: {
					title: "予期しないエラーが発生しました。",
					description: "後でもう一度お試しいただくか、サポートにお問い合わせください。",
				},
			},
		},

		tcpMonitors: {
			header: {
				title: "TCPモニター",
				action: {
					create: "TCPモニターを作成",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
				limitation: {
					title: "TCP監視の制限",
					description:
						"TCPポート監視にはソケットサポート付きのCloudflare Workers有料プランが必要です。無料プランでは、TCPチェックは利用不可と表示されます。代替としてHTTP監視の使用をご検討ください。",
				},
			},

			empty: {
				title: "TCPモニターがありません",
				description:
					"ポートが開いていて応答しているかを確認するためのTCPモニターを作成してください。",
				cta: "TCPモニターを作成",
			},

			table: {
				label: "TCPモニター",
				columns: {
					name: "名前",
					endpoint: "ホスト:ポート",
					status: "ステータス",
					lastChecked: "最終チェック",
					responseTime: "応答時間",
					actions: "アクション",
				},
				status: {
					up: "稼働中",
					down: "ダウン",
					timeout: "タイムアウト",
					disabled: "無効",
					pending: "保留中",
				},
				actions: {
					edit: "編集",
					delete: "削除",
					confirmation: {
						delete: "{{name}}を削除してもよろしいですか？",
					},
				},
			},
		},

		createTcpMonitor: {
			header: {
				title: "TCPモニターを作成",
				breadcrumb: {
					tcpMonitors: "TCPモニター",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			form: {
				fields: {
					name: {
						label: "モニター名",
						placeholder: "データベースサーバー",
						description: "このTCPモニターの説明的な名前。",
					},
					host: {
						label: "ホスト",
						placeholder: "db.example.com",
						description: "監視するホスト名またはIPアドレス。",
					},
					port: {
						label: "ポート",
						placeholder: "5432",
						description: "チェックするTCPポート（1-65535）。",
					},
					interval: {
						label: "チェック間隔",
						description: "ポートをチェックする頻度。",
					},
					timeout: {
						label: "接続タイムアウト",
						description: "タイムアウトまでに接続を待つ時間。",
					},
				},
				cta: "モニターを作成",
			},
		},

		editTcpMonitor: {
			header: {
				title: "TCPモニターを編集",
				breadcrumb: {
					tcpMonitors: "TCPモニター",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			form: {
				fields: {
					name: {
						label: "モニター名",
						placeholder: "データベースサーバー",
						description: "このTCPモニターの説明的な名前。",
					},
					host: {
						label: "ホスト",
						placeholder: "db.example.com",
						description: "監視するホスト名またはIPアドレス。",
					},
					port: {
						label: "ポート",
						placeholder: "5432",
						description: "チェックするTCPポート（1-65535）。",
					},
					interval: {
						label: "チェック間隔",
						description: "ポートをチェックする頻度。",
					},
					timeout: {
						label: "接続タイムアウト",
						description: "タイムアウトまでに接続を待つ時間。",
					},
					isEnabled: {
						label: "監視を有効化",
					},
				},
				cancel: "キャンセル",
				cta: "変更を保存",
			},
		},

		tcpMonitorDetail: {
			header: {
				breadcrumb: {
					tcpMonitors: "TCPモニター",
				},
				action: {
					edit: "編集",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			info: {
				title: "モニター設定",
				endpoint: "エンドポイント",
				status: "ステータス",
				interval: "チェック間隔",
				timeout: "タイムアウト",
			},

			stats: {
				uptime: {
					label: "Uptime",
					description: "最近のチェックに基づく",
				},
				avgResponseTime: {
					label: "平均応答時間",
					description: "平均接続時間",
				},
				totalChecks: {
					label: "総チェック数",
					description: "実行されたチェック数",
				},
			},

			results: {
				title: "チェック履歴",
				description: "最近のTCP接続チェック結果",
				label: "結果",
				empty: "まだチェック結果がありません。最初のチェックが実行された後に結果が表示されます。",
				columns: {
					time: "時刻",
					status: "ステータス",
					responseTime: "応答時間",
					error: "エラー",
				},
			},
		},

		apiKeys: {
			header: {
				title: "APIキー",
				action: {
					create: "APIキーを作成",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			empty: {
				title: "APIキーがありません",
				description: "Uptime APIにプログラムでアクセスするためのAPIキーを作成してください。",
				cta: "APIキーを作成",
			},

			newKey: {
				title: "APIキー「{{name}}」が作成されました！",
				description:
					"今すぐこのキーをコピーしてください。セキュリティ上の理由から、再度表示することはできません。",
				dismiss: "キーをコピーしました",
			},

			form: {
				title: "新しいAPIキーを作成",
				description: "APIキーを使用すると、モニターとアラートにプログラムでアクセスできます。",

				fields: {
					name: {
						label: "キー名",
						placeholder: "本番APIキー",
						description: "このAPIキーを識別するための名前。",
					},
					scopes: {
						label: "権限",
						description: "このAPIキーがアクセスできる内容を選択してください。",
						options: {
							"monitors:read": "モニターの読み取り",
							"monitors:write": "モニターの書き込み",
							"alerts:read": "アラートの読み取り",
							"alerts:write": "アラートの書き込み",
						},
					},
					expiresAt: {
						label: "有効期限（任意）",
						description: "有効期限のないキーの場合は空のままにしてください。",
					},
				},

				actions: {
					cancel: "キャンセル",
					create: "APIキーを作成",
				},
			},

			table: {
				label: "APIキー",

				columns: {
					name: "名前",
					prefix: "キー",
					scopes: "権限",
					lastUsed: "最終使用",
					expires: "有効期限",
					actions: "アクション",
				},

				lastUsed: {
					never: "未使用",
				},

				expires: {
					never: "無期限",
				},

				actions: {
					menu: "アクションメニュー",
					delete: "キーを削除",
				},

				confirmation: {
					delete: "APIキー「{{name}}」を削除してもよろしいですか？この操作は取り消せません。",
				},
			},

			error: {
				forbidden: {
					title: "このページにアクセスする権限がありません。",
					description: "チーム管理者にお問い合わせください。",
				},

				unknown: {
					title: "予期しないエラーが発生しました。",
					description: "後でもう一度お試しいただくか、サポートにお問い合わせください。",
				},
			},
		},
	},
};
