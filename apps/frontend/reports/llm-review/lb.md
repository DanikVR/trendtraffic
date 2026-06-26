# LLM Review: Luxembourgish (lb)

**Model:** gemini-2.5-flash  
**Took:** 161.4s  
**Fixes proposed:** 94 (valid after placeholder-check: 92)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.enterpriseSettings` | Astellungen fir d'Entreprise | **Enterprise Astellungen** | Preserve 'Enterprise' as a tier name. |
| `rooms.tabs.questFlow` | Quest-Flow | **Quest Flow** | Preserve 'Quest Flow' exactly as a brand name. |
| `rooms.live` | Liewen | **Live** | Wrong word sense: 'Liewen' means 'life', should be 'Live' (active). |
| `rooms.actions.open` | Aloggen | **Opmaachen** | Wrong word sense: 'Aloggen' means 'log in', should be 'Open'. |
| `common.select` | Wiel | **Wielen** | Grammar: Noun 'Wiel' (choice) should be verb 'Wielen' (select). |
| `common.edit` | Ännerung | **Änneren** | Grammar: Noun 'Ännerung' (change) should be verb 'Änneren' (edit). |
| `common.tryAgain` | Widderhuelen | **Probéiert nach eng Kéier** | More natural phrasing for 'Try again'. |
| `common.success` | Bereet | **Erfolleg** | Wrong word sense: 'Bereet' means 'ready', should be 'Success'. |
| `balance.minutesShort` | Minutten | **min** | Follow 'min_unit' rule to use 'min' for minutes. |
| `balance.openPlans` | Oppene Tariffer a Bilanz | **Tariffer a Saldo opmaachen** | Grammar: Adjective 'Oppene' should be verb 'opmaachen'. |
| `tier.trial` | Prozess | **Testperiod** | Wrong word sense: 'Prozess' means 'legal trial', should be 'trial period'. |
| `tier.standardYearly` | Jährlech | **Yearly** | Preserve 'Yearly' as a tier name. |
| `tier.enterprise` | Entreprise | **Enterprise** | Preserve 'Enterprise' as a tier name. |
| `sidebar.logoAria` | VibeVox — Home | **VibeVox — Heem** | Translate 'Home' to Luxembourgish. |
| `moreSheet.createRoomAria` | E Raum fir Iwwersetzungen opbauen | **E Raum fir Iwwersetzungen erstellen** | More appropriate verb for 'create'. |
| `moreSheet.enterprise.label` | Astellungen fir d'Entreprise | **Enterprise Astellungen** | Preserve 'Enterprise' as a tier name. |
| `call.muted` | Kee Klang | **Stumm** | More direct translation for 'muted'. |
| `call.toPlayground` | 🎯 Op d'Deponie | **🎯 Op den Trainingsplatz** | Wrong word sense: 'Deponie' means 'landfill', should be 'training ground'. |
| `call.expandPeer` | Den Gespréichspartner ausbauen | **Den Gespréichspartner vergréisseren** | More appropriate verb for 'expand view'. |
| `coach.help` | Hëllef Äntwert | **Hëllefen äntweren** | Grammar: Verb conjugation for 'help to answer'. |
| `coach.pin` | Pinn et | **Upechen** | More natural Luxembourgish for 'pin'. |
| `roomActions.translation.disableSub` | Protokoller ginn net méi ofgeschriwwen | **Minutte ginn net méi ofgeschriwwen** | Wrong word sense: 'Protokoller' means 'protocols', should be 'minutes'. |
| `settings.themeLightSub` | Wollekenaurora (Liicht) | **Cloud Aurora (Liicht)** | Preserve 'Cloud Aurora' as a brand name. |
| `partner.title` | Partner program | **Partnerprogramm** | Translate English phrase. |
| `partner.subtitle` | Share your link and earn | **Deelt Äre Link a verdéngt** | Translate English phrase. |
| `partner.yourLink` | Your link | **Äre Link** | Translate English phrase. |
| `partner.copy` | Copy | **Kopéieren** | Translate English phrase. |
| `partner.copied` | ✓ Link copied | **✓ Link kopéiert** | Translate English phrase. |
| `partner.stats.clicks` | Clicks | **Klicks** | Translate English phrase. |
| `partner.stats.registrations` | Sign-ups | **Aschreiwungen** | Translate English phrase. |
| `partner.stats.paid` | Payments | **Bezuelungen** | Translate English phrase. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} Benotzer · {{minutes}} min** | Translate 'users' to Luxembourgish. |
| `partner.terms` | Program terms | **Programmbedéngungen** | Translate English phrase. |
| `partner.contact` | Contact us | **Kontaktéiert eis** | Translate English phrase. |
| `partner.termsModalTitle` | Partner program terms | **Partnerprogrammbedéngungen** | Translate English phrase. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **D'Programmbedéngunge sinn nach net festgeluecht. Kontaktéiert w.e.g. de SuperAdmin.** | Translate English phrase. |
| `partner.loadError` | Failed to load partner data | **Konnt Partnerdaten net lueden** | Translate English phrase. |
| `toneMenu.explainIn` | Erkläert am Ton | **Am Toun erklären** | More natural word order for 'Explain in tone'. |
| `sip.editTrunk` | Kofferraumastellungen änneren | **Trunk-Astellunge änneren** | Wrong word sense: 'Kofferraum' means 'car trunk', should be 'Trunk'. |
| `sip.loginShort` | Aloggen | **Login** | Noun 'Login' vs. verb 'Aloggen' (log in). |
| `sip.createTrunk` | E Stamm erstellen | **En Trunk erstellen** | Wrong word sense: 'Stamm' means 'tree trunk', should be 'Trunk'. |
| `sip.incoming.reissue` | Nei-Editioun | **Nei erausginn** | Wrong word sense: 'Nei-Editioun' means 'new edition', should be 'reissue'. |
| `sip.outbound.lead` | Rufft eng Telefonsnummer iwwer d'Webinterface un a VibeVox wäert Är Konversatioun automatesch a Echtzäit weiderginn. | **Rufft eng Telefonsnummer iwwer d'Webinterface un a VibeVox wäert Är Konversatioun automatesch a Echtzäit iwwersetzen.** | Wrong word sense: 'weiderginn' means 'forward', should be 'translate'. |
| `sip.confirm.deleteTrunkBody` | Dës Aktioun ass ongëlteg. | **Dës Aktioun ass irreversibel.** | Wrong word sense: 'ongëlteg' means 'invalid', should be 'irreversible'. |
| `sip.confirm.deleteInboundTitle` | SIP-Adress fir den Ukënftege läschen? | **SIP-Adress fir ukommend Uriff läschen?** | Grammar: 'den Ukënftege' is singular masculine, should be plural/neutral. |
| `sip.confirm.deleteInboundBody` | Dës Aktioun ass ongëlteg. | **Dës Aktioun ass irreversibel.** | Wrong word sense: 'ongëlteg' means 'invalid', should be 'irreversible'. |
| `enterprise.page.upsellTitle` | Dës Sektioun ass am Enterprise-Plang verfügbar. | **Dës Sektioun ass am Enterprise Plang verfügbar.** | Preserve 'Enterprise' as a tier name. |
| `enterprise.tabs.prompts` | Tipps | **Prompts** | More accurate term for 'prompts' in AI context. |
| `enterprise.tabs.questFlow` | Quest-Flow | **Quest Flow** | Preserve 'Quest Flow' exactly as a brand name. |
| `enterprise.gemini.aiStudioLink` | KI Studio | **AI Studio** | Preserve 'AI Studio' as a brand name. |
| `enterprise.gemini.telegram.leadStartCmd` | /ufänken | **/start** | Preserve '/start' command exactly. |
| `enterprise.gemini.telegram.testingLabel` | Helm… | **Schécken…** | Wrong word sense: 'Helm' means 'helmet', should be 'Sending...'. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Entbinden | **Ofkoppelen** | More consistent with 'ofkoppelen' (unlink) used elsewhere. |
| `enterprise.prompt.heading` | Tipps | **Prompts** | More accurate term for 'prompts' in AI context. |
| `enterprise.prompt.headerLeadBold1` | nëmme fir d'Entschlësselung vu Messagen a Videoraim | **nëmme fir d'Transkriptioun vu Messagen a Videoraim** | Wrong word sense: 'Entschlësselung' means 'decryption', should be 'transcription'. |
| `enterprise.prompt.successPromptSaved` | Ufro gespäichert. | **Prompt gespäichert.** | More accurate term for 'prompt'. |
| `enterprise.prompt.presetsHeading` | Zougänglech Erklärungsstänn | **Zougänglech Tounoptiounen** | Wrong word sense: 'Stänn' means 'levels', should be 'tone options'. |
| `enterprise.questFlow.heading` | Quest-Flow | **Quest Flow** | Preserve 'Quest Flow' exactly as a brand name. |
| `enterprise.questFlow.errDelete` | Delete error | **Läschfehler** | Translate English phrase. |
| `enterprise.questFlow.deleteTitle` | Delete | **Läschen** | Translate English phrase. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Schlëssel läschen?** | Translate English phrase. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **De Schlëssel gëtt permanent geläscht. Quest Flow funktionéiert net méi doriwwer — Dir musst en neie Schlëssel erstellen an en am Flow ersetzen.** | Translate English phrase. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Läschen** | Translate English phrase. |
| `enterprise.questFlow.promptHeading` | Ufro fir Telegram-Gespréicher | **Prompt fir Telegram-Gespréicher** | More accurate term for 'prompt'. |
| `enterprise.questFlow.promptLeadBold2` | Wann Dir Är Ausfëllung ausfëllt | **Wann Dir Äert eegent ausfëllt** | Grammar: More natural phrasing for 'If you fill out yours'. |
| `enterprise.questFlow.successPromptSaved` | Quest Flow-Ufro gespäichert. | **Quest Flow Prompt gespäichert.** | More accurate term for 'prompt'. |
| `enterprise.questFlow.kbLead3` | Aus der Rubrik "Hiweiser" - fir Videotranskriptioun. | **Aus der Rubrik "Prompts" - fir Videotranskriptioun.** | Consistent with 'Prompts' terminology. |
| `enterprise.questFlow.tagsHeading` | Braucht Tags | **Bedierfnes-Tags** | More natural phrasing for 'Needs Tags'. |
| `enterprise.chatwoot.whatSentItem3Code` | personaliséiert_attributer.vibevox_tags | **custom_attributes.vibevox_tags** | Preserve 'custom_attributes.vibevox_tags' exactly. |
| `postCallInsights.subtitle` | Entreprise · Abléck nom Uruff | **Enterprise · Abléck nom Uruff** | Preserve 'Enterprise' as a tier name. |
| `postCallInsights.analyzing` | Loosst eis d'Gespréich analyséieren ... | **Mir analyséieren d'Gespréich...** | More direct translation for 'Analyzing conversation...' |
| `postCallInsights.summary` | CV | **Resumé** | Wrong word sense: 'CV' means 'curriculum vitae', should be 'summary'. |
| `insights.summary` | CV | **Resumé** | Wrong word sense: 'CV' means 'curriculum vitae', should be 'summary'. |
| `insights.sentiment` | Schlëssel | **Tonalitéit** | Wrong word sense: 'Schlëssel' means 'key' (musical), should be 'sentiment'. |
| `insights.leadValues.hot` | Waarm | **Héich Interessi** | Wrong word sense: 'Waarm' means 'warm', should be 'hot' (high interest). |
| `insights.leadValues.cold` | Keelt | **Kalt** | Wrong word sense: 'Keelt' means 'coldness', should be 'cold'. |
| `lobby.title` | Un enger Videokonferenz deelhuelen | **Verbindung mat enger Videokonferenz** | More accurate translation for 'Connecting to a video meeting'. |
| `paywall.subtitle` | kréien direkt Är Remboursement hei. | **gitt direkt hei zréck.** | Wrong word sense: 'Remboursement' means 'refund', should be 'return here'. |
| `paywall.subscribe` | Design | **Abonnéieren** | Wrong word sense: 'Design' should be 'Subscribe'. |
| `paywall.featureMinutes` | {{count}} Minutt Iwwersetzung | **{{count}} Minutten Iwwersetzung** | Grammar: Plural form for 'minutes' when count > 1. |
| `billingPage.tierLabel` | Bewäertung | **Tarif** | Wrong word sense: 'Bewäertung' means 'rating', should be 'tier/plan'. |
| `billingPage.tierEnterpriseName` | Entreprise | **Enterprise** | Preserve 'Enterprise' as a tier name. |
| `billingPage.resume` | CV | **Weiderféieren** | Wrong word sense: 'CV' means 'curriculum vitae', should be 'resume/continue'. |
| `billingPage.topupCarried` | Verréckelt | **Iwwerdroen** | More accurate translation for 'carried over'. |
| `billingPage.minutesShort` | Minutten | **min** | Follow 'min_unit' rule to use 'min' for minutes. |
| `billingPage.ctaSubscribeStandard` | Bestellungsstandard | **Standard abonnéieren** | More appropriate verb for 'subscribe to Standard'. |
| `billingPage.faqQ3` | Wat enthält d'Entreprise? | **Wat enthält Enterprise?** | Preserve 'Enterprise' as a tier name. |
| `billingPage.faqA3` | personaliséiert Ufroen | **personaliséiert Prompts** | More accurate term for 'prompts'. |
| `billingPage.languagesCount_few` | {{count}} Sprooch | **{{count}} Sproochen** | Grammar: Plural form for 'languages' when count is 'few'. |
| `billingPage.renewsOn` | Erweiderung {{date}} | **Erneierung {{date}}** | More accurate translation for 'renews' (renewal). |
| `auth.login.forgot` | passwuert vergiess? | **Passwuert vergiess?** | Capitalization: Start sentence with a capital letter. |
| `auth.forgot.successTitle` | De Bréif ass geschéckt ginn | **E-Mail geschéckt** | More appropriate for 'Email sent' rather than 'letter'. |

⚠ 2 fix(es) skipped (no-op, missing path, or would break placeholders).
