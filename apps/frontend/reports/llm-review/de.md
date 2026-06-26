# LLM Review: German (de)

**Model:** gemini-2.5-flash  
**Took:** 193.3s  
**Fixes proposed:** 161 (valid after placeholder-check: 160)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.rooms` | Zimmer | **Räume** | "Zimmer" is for physical rooms, "Räume" for virtual/meeting rooms. |
| `nav.enterpriseSettings` | Unternehmenseinstellungen | **Enterprise-Einstellungen** | Preserve brand/tier name "Enterprise". |
| `nav.createRoom` | Erstelle einen Raum | **Raum erstellen** | More natural and common phrasing for a button label. |
| `nav.billing` | Zölle | **Tarife** | "Zölle" means customs duties; "Tarife" is correct for pricing plans. |
| `nav.home` | Heim | **Startseite** | "Heim" is a noun; "Startseite" is correct for a home page link. |
| `rooms.noRoomsInCategory` | In dieser Kategorie sind noch keine Zimmer verfügbar. | **In dieser Kategorie sind noch keine Räume verfügbar.** | "Zimmer" is for physical rooms, "Räume" for virtual/meeting rooms. |
| `rooms.actions.open` | Login | **Beitreten** | "Login" is a noun; "Beitreten" is more appropriate for joining a room. |
| `rooms.confirmDelete.title` | Zimmer endgültig löschen? | **Raum endgültig löschen?** | "Zimmer" is for physical rooms, "Raum" for virtual/meeting rooms. |
| `common.cancel` | Stornieren | **Abbrechen** | "Stornieren" is for bookings; "Abbrechen" is for actions/dialogs. |
| `common.open` | Offen | **Öffnen** | "Offen" is an adjective; "Öffnen" is the correct verb for a button. |
| `common.success` | Bereit | **Erfolgreich** | "Bereit" means ready; "Erfolgreich" is better for success. |
| `common.no` | NEIN | **Nein** | Typo: "NEIN" should be "Nein". |
| `balance.label` | Gleichgewicht | **Guthaben** | "Gleichgewicht" is for equilibrium; "Guthaben" is for account balance. |
| `balance.openPlans` | Offene Zölle und Bilanz | **Tarife und Guthaben öffnen** | "Offene" is adjective; "Zölle" is wrong; "Bilanz" is wrong. |
| `balance.tariffs` | Zölle | **Tarife** | "Zölle" means customs duties; "Tarife" is correct for pricing plans. |
| `tier.trial` | Versuch | **Testphase** | "Versuch" is wrong word sense for subscription trial. |
| `tier.standardYearly` | Jährlich | **Yearly** | Preserve brand/tier name "Yearly". |
| `tier.enterprise` | Unternehmen | **Enterprise** | Preserve brand/tier name "Enterprise". |
| `languagePicker.searchPlaceholder` | Sprache wird gesucht... | **Sprache suchen...** | More natural phrasing for a search placeholder. |
| `moreSheet.enterprise.label` | Unternehmenseinstellungen | **Enterprise-Einstellungen** | Preserve brand/tier name "Enterprise". |
| `moreSheet.logout` | Melde dich von deinem Konto ab | **Abmelden** | Shorter and more common phrasing for "log out". |
| `moreSheet.createRoomAria` | Erstellen Sie einen Übersetzungsraum | **Übersetzungsraum erstellen** | More natural phrasing for an action. |
| `call.toPlayground` | 🎯 Ab auf die Mülldeponie | **🎯 Zum Trainingsgelände** | "Mülldeponie" is wrong word sense; "Trainingsgelände" is correct for AI training. |
| `call.expandPeer` | Erweitere den Gesprächspartner | **Gesprächspartner vergrößern** | "Erweitere" is imperative; "vergrößern" is more natural for expanding view. |
| `call.focusPiP` | Fokus (Bild) | **Fokus (PiP)** | Preserve brand name "PiP". |
| `call.more` | Zusätzlich | **Mehr** | "Zusätzlich" is an adverb; "Mehr" is better for a menu item. |
| `call.hangUp` | Anruf beendet | **Anruf beenden** | "Anruf beendet" is past tense; "Anruf beenden" is correct for a button. |
| `call.backToRooms` | Zurück zur Zimmerliste | **Zurück zur Raumliste** | "Zimmer" is for physical rooms, "Räume" for virtual/meeting rooms. |
| `call.connecting` | Verbindung zum Zimmer… | **Verbindung zum Raum…** | "Zimmer" is for physical rooms, "Raum" for virtual/meeting rooms. |
| `call.translatorJoining` | Einführung eines KI-Übersetzers… | **KI-Übersetzer wird gestartet…** | "Einführung" is wrong word sense; "wird gestartet" is correct for launching. |
| `coach.copy` | Kopie | **Kopieren** | "Kopie" is a noun; "Kopieren" is the correct verb for a button. |
| `roomActions.translation.disableSub` | Protokolle werden nicht mehr abgeschrieben | **Minuten werden nicht mehr abgerechnet** | "Protokolle" is wrong word sense; "Minuten" is correct for time units. "abgerechnet" is better than "abgeschrieben". |
| `roomActions.copyLink` | Kopiere den Link zum Raum | **Link zum Raum kopieren** | More natural phrasing for an action. |
| `settings.editName` | Namensänderung | **Namen ändern** | "Namensänderung" is a noun; "Namen ändern" is correct for an action. |
| `settings.themeDarkSub` | Abyss Aurora (Dunkel) | **Abyss Aurora (Dark)** | Preserve brand name "Abyss Aurora" and "Dark". |
| `settings.themeLightSub` | Wolken-Aurora (Licht) | **Cloud Aurora (Light)** | Preserve brand name "Cloud Aurora" and "Light". |
| `partner.title` | Partner program | **Partnerprogramm** | Translate to German. |
| `partner.subtitle` | Share your link and earn | **Teilen Sie Ihren Link und verdienen Sie** | Translate to German. |
| `partner.yourLink` | Your link | **Ihr Link** | Translate to German. |
| `partner.copy` | Copy | **Kopieren** | Translate to German. |
| `partner.copied` | ✓ Link copied | **✓ Link kopiert** | Translate to German. |
| `partner.stats.clicks` | Clicks | **Klicks** | Translate to German. |
| `partner.stats.registrations` | Sign-ups | **Registrierungen** | Translate to German. |
| `partner.stats.paid` | Payments | **Zahlungen** | Translate to German. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} Nutzer · {{minutes}} min** | Translate "users" to German. |
| `partner.terms` | Program terms | **Programmbedingungen** | Translate to German. |
| `partner.contact` | Contact us | **Kontaktieren Sie uns** | Translate to German. |
| `partner.termsModalTitle` | Partner program terms | **Partnerprogrammbedingungen** | Translate to German. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Die Programmbedingungen sind noch nicht festgelegt. Bitte kontaktieren Sie den SuperAdmin.** | Translate to German. |
| `partner.loadError` | Failed to load partner data | **Partnerdaten konnten nicht geladen werden** | Translate to German. |
| `toneMenu.explainIn` | Erklären Sie im richtigen Ton | **Im Ton erklären** | "Im richtigen Ton" implies correctness; "Im Ton erklären" is more neutral. |
| `sip.subtitle` | Einrichten von Leitungen für eingehende und ausgehende Anrufe | **Einrichten von Trunks für eingehende und ausgehende Anrufe** | Use technical term "Trunks" for consistency. |
| `sip.createTrunk` | Erstellen Sie einen Stamm | **Trunk erstellen** | "Stamm" is wrong word sense; "Trunk" is the correct technical term. |
| `sip.incoming.create` | Erstellen Sie eine SIP-Adresse für eingehende Anrufe | **SIP-Adresse für eingehende Anrufe erstellen** | More natural phrasing for an action. |
| `sip.incoming.creating` | Wir erschaffen… | **Erstellen…** | "Erschaffen" is too grand; "Erstellen" is appropriate for creating an entry. |
| `sip.incoming.pausedHint` | Aktivieren Sie den Empfang, damit VibeVox eingehende Anrufe weiterleitet. | **Aktivieren Sie den Empfang, damit VibeVox eingehende Anrufe übersetzt.** | "Weiterleitet" is wrong word sense; "übersetzt" is correct. |
| `sip.incoming.copy` | Kopie | **Kopieren** | "Kopie" is a noun; "Kopieren" is the correct verb for a button. |
| `sip.incoming.reissue` | Neuausgabe | **Neu generieren** | "Neuausgabe" is a noun; "Neu generieren" is better for keys/credentials. |
| `sip.outbound.lead` | Rufen Sie über die Weboberfläche eine Telefonnummer an, und VibeVox leitet Ihr Gespräch automatisch in Echtzeit weiter. | **Rufen Sie über die Weboberfläche eine Telefonnummer an, und VibeVox übersetzt Ihr Gespräch automatisch in Echtzeit.** | "Weiterleitet" is wrong word sense; "übersetzt" is correct. |
| `sip.outbound.languageLabel` | Sprache des Anrufers | **Sprache des Anrufempfängers** | "Anrufers" is wrong word sense; "Anrufempfängers" is correct. |
| `sip.connected` | Der SIP-Trunk wird gespeichert und mit LiveKit synchronisiert. | **Der SIP-Trunk ist gespeichert und mit LiveKit synchronisiert.** | "Wird gespeichert" implies ongoing action; "ist gespeichert" is correct for a completed state. |
| `sip.danger.reissueHint` | Bitten Sie um neue Anmeldedaten für die SIP-Adresse. Die alten Informationen sind nicht mehr gültig. | **Generiert den Login und das Passwort für die SIP-Adresse neu. Alte Daten funktionieren nicht mehr.** | "Bitten Sie um" is wrong word sense; "Generiert neu" is correct for reissuing. |
| `sip.outbound2.callButton` | Anruf | **Anrufen** | "Anruf" is a noun; "Anrufen" is the correct verb for a button. |
| `enterprise.page.title` | Unternehmenseinstellungen | **Enterprise-Einstellungen** | Preserve brand/tier name "Enterprise". |
| `enterprise.tabs.prompts` | Tipps | **Prompts** | "Tipps" is wrong word sense; "Prompts" is the correct technical term. |
| `enterprise.tabs.questFlow` | Questablauf | **Quest Flow** | Preserve brand name "Quest Flow". |
| `enterprise.common.test` | Prüfen | **Test** | "Test" is shorter and commonly used as a button label. |
| `enterprise.common.copy` | Kopie | **Kopieren** | "Kopie" is a noun; "Kopieren" is the correct verb for a button. |
| `enterprise.apiKey.copy` | Kopie | **Kopieren** | "Kopie" is a noun; "Kopieren" is the correct verb for a button. |
| `enterprise.gemini.leadSuffix` | Wird anstelle der globalen Option für alle Gemini-Anrufe in Ihrem Konto verwendet. | **. Wird anstelle des globalen Schlüssels für alle Gemini-Anrufe in Ihrem Konto verwendet.** | "Option" is not in source; "Schlüssels" is correct. |
| `enterprise.gemini.aiStudioLink` | KI-Studio | **AI Studio** | Preserve brand name "AI Studio". |
| `enterprise.gemini.statusNotChecked` | Nicht verifiziert | **Nicht geprüft** | "Nicht verifiziert" is too strong; "Nicht geprüft" is more direct. |
| `enterprise.gemini.telegram.leadCreatePart1` | Erstelle einen Bot unter | **Erstellen Sie einen Bot unter** | Consistent formal address. |
| `enterprise.gemini.telegram.botUnlink` | Entferne die Verbindung zum Bot. | **Bot-Verbindung trennen** | More natural and formal phrasing for an action. |
| `enterprise.gemini.telegram.successUnlinked` | Der Bot ist entfesselt. | **Bot-Verbindung getrennt.** | "Entfesselt" is wrong word sense; "Verbindung getrennt" is correct for unlinking. |
| `enterprise.gemini.telegram.testLabel` | Prüfen | **Test** | "Test" is shorter and commonly used as a button label. |
| `enterprise.gemini.telegram.testingLabel` | Helm… | **Senden…** | "Helm" is wrong word sense; "Senden" is correct for sending. |
| `enterprise.gemini.telegram.testTooltip` | Sende eine Testbenachrichtigung per Bot | **Testbenachrichtigung per Bot senden** | More natural phrasing for an action. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Lösen | **Trennen** | "Lösen" is ambiguous; "Trennen" is more precise for unlinking. |
| `enterprise.prompt.heading` | Tipps | **Prompts** | "Tipps" is wrong word sense; "Prompts" is the correct technical term. |
| `enterprise.prompt.subtitle` | Hilfestellung und Wissensdatenbank für die Transkription ausschließlich in Videokonferenzräumen | **Prompts und Wissensdatenbank nur für die Transkription in Videoräumen** | "Hilfestellung" is too generic; "Prompts" is the correct technical term. |
| `enterprise.prompt.promptLabel` | Systemansagen (Tonfall, Stil, Wortwahl) | **System-Prompt (Tonfall, Stil, Wortwahl)** | "Systemansagen" is less precise; "System-Prompt" is more accurate. |
| `enterprise.prompt.savePrompt` | Speichern | **Prompt speichern** | More natural phrasing for an action. |
| `enterprise.prompt.headerLeadBold1` | nur zum Entschlüsseln von Nachrichten in Videoräumen | **nur zur Transkription von Nachrichten in Videoräumen** | "Entschlüsseln" is wrong word sense; "Transkription" is correct. |
| `enterprise.prompt.headerLeadBold2` | „Gemäß Ihrer Anfrage“ | **„Gemäß Ihrem Prompt“** | "Anfrage" is too generic; "Prompt" is the correct technical term. |
| `enterprise.prompt.headerLeadPart3` | Die | **.** | Grammatical error, "Die" is an article. |
| `enterprise.prompt.contextHeading` | Kontext / Aufforderung | **Kontext / Prompt** | "Aufforderung" is too generic; "Prompt" is the correct technical term. |
| `enterprise.prompt.contextLeadBold` | „Gemäß Ihrer Anfrage“ | **„Gemäß Ihrem Prompt“** | "Anfrage" is too generic; "Prompt" is the correct technical term. |
| `enterprise.prompt.contextLeadPart2` | Die Wissensbasis ist ebenfalls integriert (siehe unten). | **. Die Wissensbasis ist ebenfalls integriert (siehe unten).** | Grammatical error, "Die" is an article. |
| `enterprise.prompt.promptPlaceholder` | Ihre Aufforderung... | **Ihr Prompt...** | "Aufforderung" is too generic; "Prompt" is the correct technical term. |
| `enterprise.prompt.savePromptLabel` | Speichern | **Prompt speichern** | More natural phrasing for an action. |
| `enterprise.prompt.successPromptSaved` | Eingabeaufforderung gespeichert. | **Prompt gespeichert.** | Consistent use of "Prompt". |
| `enterprise.prompt.presetsHeading` | Verständliche Erklärungssprache | **Verfügbare Erklärungstöne** | "Verständliche Erklärungssprache" is wrong word sense; "Verfügbare Erklärungstöne" is correct. |
| `enterprise.prompt.presetsLeadBold` | „Gemäß Ihrer Anfrage“ | **„Gemäß Ihrem Prompt“** | "Anfrage" is too generic; "Prompt" is the correct technical term. |
| `enterprise.prompt.presetsLeadPart2` | verwendet Ihre Eingabeaufforderung aus dem obigen Feld. | **verwendet Ihren Prompt aus dem obigen Feld.** | Consistent use of "Prompt". |
| `enterprise.questFlow.heading` | Questablauf | **Quest Flow** | Preserve brand name "Quest Flow". |
| `enterprise.questFlow.warning` | Wenn das Feld leer ist, wird die allgemeine VibeVox-Ansage verwendet. | **Wenn das Feld leer ist, wird der allgemeine VibeVox-Prompt verwendet.** | "Ansage" is wrong word sense; "Prompt" is the correct technical term. |
| `enterprise.questFlow.promptLabel` | Quest-Flow-System-Aufforderung | **Quest Flow System-Prompt** | "Aufforderung" is too generic; "Prompt" is the correct technical term. |
| `enterprise.questFlow.tagsLabel` | Benötigt Tags | **Bedarfs-Tags** | "Benötigt Tags" is grammatically awkward; "Bedarfs-Tags" is more natural. |
| `enterprise.questFlow.savePrompt` | Speichern | **Prompt speichern** | More natural phrasing for an action. |
| `enterprise.questFlow.createKey` | Erstellen Sie einen Schlüssel | **Schlüssel erstellen** | More natural phrasing for an action. |
| `enterprise.questFlow.creatingKey` | Wir erschaffen… | **Erstellen…** | "Erschaffen" is too grand; "Erstellen" is appropriate for creating an entry. |
| `enterprise.questFlow.errDelete` | Delete error | **Fehler beim Löschen** | Translate to German. |
| `enterprise.questFlow.copyKey` | Kopie | **Kopieren** | "Kopie" is a noun; "Kopieren" is the correct verb for a button. |
| `enterprise.questFlow.savedKeyConfirm` | Ich habe den Schlüssel aufbewahrt | **Ich habe den Schlüssel gespeichert** | "Aufbewahrt" is wrong word sense; "gespeichert" is correct. |
| `enterprise.questFlow.noLabel` | kein Etikett | **ohne Bezeichnung** | "Etikett" is for physical labels; "Bezeichnung" is for descriptive labels. |
| `enterprise.questFlow.usedOn` | verwendete {{date}} | **verwendet am {{date}}** | "Verwendete" is past tense verb; "verwendet am" is more natural. |
| `enterprise.questFlow.deleteTitle` | Delete | **Löschen** | Translate to German. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Schlüssel löschen?** | Translate to German. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Der Schlüssel wird dauerhaft gelöscht. Quest Flow funktioniert dann nicht mehr damit – Sie müssen einen neuen Schlüssel erstellen und ihn im Flow ersetzen.** | Translate to German. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Löschen** | Translate to German. |
| `enterprise.questFlow.promptHeading` | Anregung für Telegram-Konversationen | **Prompt für Telegram-Dialoge** | "Anregung" is wrong word sense; "Prompt" is the correct technical term. |
| `enterprise.questFlow.promptLead2` | — Es wird die allgemeine VibeVox-Eingabeaufforderung verwendet (siehe unten). | **— Es wird der allgemeine VibeVox-Prompt verwendet (siehe unten).** | Consistent use of "Prompt". |
| `enterprise.questFlow.promptLeadBold2` | Wenn Sie Ihr Formular ausfüllen | **Wenn Sie Ihren eigenen Prompt ausfüllen** | "Formular" is not in the source; "Prompt" is correct. |
| `enterprise.questFlow.promptLead3` | - es wird mit der grundlegenden Eingabeaufforderung und Wissensdatenbank kombiniert. | **- es wird mit dem grundlegenden Prompt und der Wissensdatenbank kombiniert.** | Consistent use of "Prompt". |
| `enterprise.questFlow.promptPlaceholder` | Ihre Aufforderung... | **Ihr Prompt...** | "Aufforderung" is too generic; "Prompt" is the correct technical term. |
| `enterprise.questFlow.successPromptSaved` | Quest Flow-Aufforderung gespeichert. | **Quest Flow Prompt gespeichert.** | "Aufforderung" is too generic; "Prompt" is the correct technical term. |
| `enterprise.questFlow.kbLeadBold2` | separate | **separat** | Translate to German. |
| `enterprise.questFlow.kbLead3` | Aus dem Abschnitt „Hinweise“ – für die Videotranskription. Limit: 50 MB Datei / 500.000 Zeichen in der Datenbank. | **Aus dem Abschnitt „Prompts“ – dort für die Videotranskription. Limit: 50 MB Datei / 500.000 Zeichen in der Datenbank.** | "Hinweise" is wrong word sense; "Prompts" is the correct technical term. |
| `enterprise.questFlow.tagsHeading` | Benötigt Tags | **Bedarfs-Tags** | "Benötigt Tags" is grammatically awkward; "Bedarfs-Tags" is more natural. |
| `enterprise.questFlow.tagsLead` | Die KI ordnet diese Tags den Kunden zu, wenn sie eine Übereinstimmung im Gespräch erkennt. Die Tags werden auf der Zimmerkarte des Kunden angezeigt und an das CRM übermittelt (Abschnitt 4). | **Die KI ordnet diese Tags den Kunden zu, wenn sie eine Übereinstimmung im Gespräch erkennt. Die Tags werden auf der Raumkarte des Kunden angezeigt und an das CRM übermittelt (Abschnitt 4).** | "Zimmer" is for physical rooms, "Raum" for virtual/meeting rooms. |
| `enterprise.chatwoot.test` | Überprüfen Sie die Verbindung. | **Verbindung prüfen** | More natural phrasing for an action. |
| `enterprise.chatwoot.headerLead` | Überträgt den Gesprächsverlauf und die Kundenbedürfnisse-Tags an Chatwoot CRM. | **Überträgt den Gesprächsverlauf und die Bedarfs-Tags der Kunden an Chatwoot CRM.** | More natural phrasing for "Kundenbedürfnisse-Tags". |
| `enterprise.chatwoot.whatSentItem3Prefix` | Alle zugewiesenen Bedarfskennzeichnungen in | **Alle zugewiesenen Bedarfs-Tags in** | "Bedarfskennzeichnungen" is long; "Bedarfs-Tags" is more concise. |
| `chat.openWithClient` | Öffnen Sie einen Chat mit dem Kunden. | **Chat mit dem Kunden öffnen** | More natural phrasing for an action. |
| `chat.telegramBadge` | Telegramm | **Telegram** | Preserve brand name "Telegram". |
| `insights.recalc` | Erzählen | **Neuberechnen** | "Erzählen" is wrong word sense; "Neuberechnen" is correct for "recalculate". |
| `insights.summary` | Wieder aufnehmen | **Zusammenfassung** | "Wieder aufnehmen" means "resume"; "Zusammenfassung" is correct for "summary". |
| `insights.sentiment` | Schlüssel | **Stimmung** | "Schlüssel" means "key"; "Stimmung" is correct for "sentiment". |
| `insights.leadScore` | Bleipunktzahl | **Lead Score** | "Bleipunktzahl" is a literal translation that loses meaning; "Lead Score" should be preserved. |
| `lobby.andWord` |  Und  | ** und ** | "Und" should be lowercase in the middle of a sentence. |
| `paywall.subscribe` | Design | **Abonnieren** | "Design" is wrong word sense; "Abonnieren" is correct for subscribing. |
| `paywall.topupAddon` | Zusätzlicher Kauf {{count}} min × 0,17 € | **Minuten-Zukauf {{count}} min × 0,17 €** | "Zusätzlicher Kauf" is clunky; "Minuten-Zukauf" is more natural. |
| `billingPage.title` | Zölle und Zahlung | **Tarife und Zahlung** | "Zölle" means customs duties; "Tarife" is correct for pricing plans. |
| `billingPage.tierLabel` | Rate | **Tarif** | "Rate" is wrong word sense; "Tarif" is correct for pricing plan. |
| `billingPage.cancelAutoRenewQuestion` | Automatische Verlängerung meines Abonnements kündigen? | **Automatische Verlängerung des Abonnements kündigen?** | "Meines Abonnements" is not in the source; "des Abonnements" is more accurate. |
| `billingPage.cancel` | Stornieren | **Abbrechen** | "Stornieren" is for bookings; "Abbrechen" is for actions/dialogs. |
| `billingPage.resumeFailed` | Ihr Abonnement konnte nicht verlängert werden. | **Ihr Abonnement konnte nicht wiederhergestellt werden.** | "Verlängert werden" is wrong word sense; "wiederhergestellt werden" is correct. |
| `billingPage.stripeOpening` | Eröffnungszahlung... | **Zahlung wird geöffnet…** | "Eröffnungszahlung" is wrong word sense; "Zahlung wird geöffnet" is correct. |
| `billingPage.topupHelp` | Zusätzlicher Kaufregler. Verfügbar mit einem aktiven Abonnement. | **Zukauf-Schieberegler. Verfügbar mit einem aktiven Abonnement.** | "Zusätzlicher Kaufregler" is clunky; "Zukauf-Schieberegler" is more natural. |
| `billingPage.topupCarried` | Verschoben | **Übertragen** | "Verschoben" means "moved/postponed"; "Übertragen" is correct for "carried over". |
| `billingPage.tierEnterpriseName` | Unternehmen | **Enterprise** | Preserve brand/tier name "Enterprise". |
| `billingPage.tierEnterpriseSummary` | Vollständige KI-Architektur für Unternehmen | **Vollständiger KI-Stack für Unternehmen** | "KI-Architektur" is wrong word sense; "KI-Stack" is more direct. |
| `billingPage.featureLearnHub` | AI Learning Hub – seine eigenen Dialekte | **AI Learning Hub – eigene Dialekte** | Preserve brand name "AI Learning Hub"; "eigene Dialekte" is more natural. |
| `billingPage.featureAllStandard` | Alles aus der Standardversion | **Alles aus Standard** | "Standard" is a tier name; "Alles aus Standard" is more direct. |
| `billingPage.featureBranding` | Zimmerbranding (Logo, Farben) | **Raum-Branding (Logo, Farben)** | "Zimmer" is for physical rooms, "Raum" for virtual/meeting rooms. |
| `billingPage.featurePersonalPrompts` | Personalisierte KI-Vorschläge | **Personalisierte KI-Prompts** | "Vorschläge" is wrong word sense; "Prompts" is the correct technical term. |
| `billingPage.featureSmartTags` | Intelligente Kennzeichnung von Bedürfnissen | **Intelligente Bedarfs-Tags** | "Kennzeichnung von Bedürfnissen" is long; "Bedarfs-Tags" is more concise. |
| `billingPage.ctaSubscribePlus` | Hol dir Plus | **Plus abonnieren** | "Hol dir" is informal; "Plus abonnieren" is more appropriate. |
| `billingPage.ctaSubscribeStandard` | Standardbestellung | **Standard abonnieren** | "Standardbestellung" is wrong word sense; "Standard abonnieren" is more appropriate. |
| `billingPage.languagesCount_few` | {{count}} Sprache | **{{count}} Sprachen** | Incorrect pluralization for "Sprache". |
| `billingPage.faqA3` | Vollständiger KI-Stack: Kundenkarten mit automatischer Erkennung, Telegram-Autorisierung, personalisierte Hinweise, Google Kalender, intelligente Bedarfskennzeichnung, CRM-Export, Integration mit questflow.pro und ein separater Admin-Tab. | **Vollständiger KI-Stack: Kundenkarten mit automatischer Erkennung, Telegram-Autorisierung, personalisierte Prompts, Google Kalender, intelligente Bedarfs-Tags, CRM-Export, Integration mit questflow.pro und ein separater Admin-Tab.** | "Hinweise" is wrong word sense; "Prompts" is correct. "Bedarfskennzeichnung" is long. |
| `billingPage.renewsOn` | Erweiterung {{date}} | **Verlängerung {{date}}** | "Erweiterung" is wrong word sense; "Verlängerung" is correct for renewal. |
| `auth.login.submit` | Login | **Anmelden** | "Login" is a noun; "Anmelden" is the correct verb for a button. |
| `auth.login.loading` | Wir betreten die... | **Anmelden…** | "Wir betreten die" is grammatically incomplete and wrong word sense; "Anmelden" is correct. |
| `auth.register.loginLink` | Login | **Anmelden** | "Login" is a noun; "Anmelden" is the correct verb for a button. |
| `auth.register.agreementAnd` |  Und  | ** und ** | "Und" should be lowercase in the middle of a sentence. |
| `auth.forgot.successTitle` | Der Brief wurde verschickt | **E-Mail gesendet** | "Brief" is wrong word sense; "E-Mail" is correct. |
| `pwaInstall.buttonLabel` | Installieren Sie die App | **App installieren** | More natural phrasing for an action. |
| `pwaInstall.buttonAria` | Installieren Sie VibeVox als App | **VibeVox als App installieren** | More natural phrasing for an action. |

⚠ 1 fix(es) skipped (no-op, missing path, or would break placeholders).
