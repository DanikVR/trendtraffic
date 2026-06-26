# LLM Review: Italian (it)

**Model:** gemini-2.5-flash  
**Took:** 562.8s  
**Fixes proposed:** 134 (valid after placeholder-check: 123)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.rooms` | Camere | **Stanze** | Use 'Stanze' for virtual rooms, 'Camere' is for hotel rooms. |
| `nav.home` | Casa | **Pagina iniziale** | More appropriate for a navigation link (Homepage). |
| `rooms.tabs.questFlow` | Flusso di ritorno | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `rooms.noRoomsInCategory` | Al momento non ci sono camere disponibili in questa categoria. | **Al momento non ci sono stanze disponibili in questa categoria.** | Use 'stanze' for virtual rooms, 'camere' is for hotel rooms. |
| `rooms.live` | Vivere | **Live** | 'Vivere' means 'to live' (verb). 'Live' as status is often a loanword or 'In diretta'. |
| `rooms.actions.open` | Login | **Entra** | 'Login' is for authentication. 'Entra' means 'Enter' (a room). |
| `rooms.actions.chat` | Chiacchierata | **Chat** | 'Chat' is a common loanword and shorter for a UI button. |
| `rooms.confirmDelete.message` | In questo modo la riunione verrà chiusa per tutti i partecipanti ed elimineranno tutti i dati. | **In questo modo la riunione verrà chiusa per tutti i partecipanti ed eliminerà tutti i dati.** | Grammar: 'eliminerà' (singular) matches 'la riunione' (singular subject). |
| `common.close` | Vicino | **Chiudi** | 'Vicino' means 'near'. 'Chiudi' is the imperative verb for 'Close'. |
| `balance.label` | Bilancia | **Saldo** | 'Bilancia' means 'scale'. 'Saldo' is correct for account balance. |
| `balance.openPlans` | Tariffe aperte e saldo | **Apri tariffe e saldo** | Grammar: verb should come first for an action/link. |
| `tier.plus` | Più | **Plus** | Brand/tier name 'Plus' must be preserved. |
| `tier.standardYearly` | Annuale | **Yearly** | Brand/tier name 'Yearly' must be preserved. |
| `languagePicker.searchPlaceholder` | Ricerca nella lingua... | **Cerca lingua...** | More natural phrasing for 'Search language...' |
| `moreSheet.sip.sub` | Allestimento dei bauli | **Configurazione dei trunk** | 'Bauli' means 'trunks' (storage). 'Trunk' is a technical term, better kept or translated as 'linee trunk'. |
| `call.toPlayground` | 🎯 Alla discarica | **🎯 Al campo di addestramento** | 'Discarica' means 'landfill'. 'Campo di addestramento' is 'training ground'. |
| `call.muted` | Nessun suono | **Muto** | 'Nessun suono' means 'no sound'. 'Muto' is correct for 'muted'. |
| `call.screenshareOn` | Acquisizione dello schermo | **Condividi schermo** | 'Acquisizione dello schermo' means 'screen capture'. 'Condividi schermo' is 'screen sharing'. |
| `call.screenshareOff` | Interrompi l'acquisizione dello schermo | **Interrompi condivisione schermo** | 'Acquisizione dello schermo' means 'screen capture'. 'Condivisione schermo' is 'screen sharing'. |
| `call.more` | Riepilogo | **Altro** | 'Riepilogo' means 'summary'. 'Altro' means 'more' or 'additional'. |
| `call.backToRooms` | Torna all'elenco delle camere | **Torna all'elenco delle stanze** | Use 'stanze' for virtual rooms, 'camere' is for hotel rooms. |
| `call.cameraBlocked` | È vietato utilizzare telecamere o microfoni. | **Camera o microfono non consentiti** | More concise and accurate for 'Camera or microphone not allowed'. |
| `coach.pin` | Appuntalo | **Fissa** | 'Appuntalo' means 'pin it' (as a note). 'Fissa' is more common for UI pinning. |
| `coach.close` | Vicino | **Chiudi** | 'Vicino' means 'near'. 'Chiudi' is the imperative verb for 'Close'. |
| `coach.tones.scientific` | Dal punto di vista medico | **Scientifico** | 'Dal punto di vista medico' means 'from a medical point of view'. 'Scientifico' is 'scientific'. |
| `roomActions.translation.disableSub` | I verbali non saranno più cancellati | **I minuti non saranno più addebitati** | 'Verbali' means 'meeting minutes'. 'Minuti' (time) is correct. 'Cancellati' (cancelled) should be 'addebitati' (charged). |
| `billing.createRoomFailed` | Impossibile creare spazio | **Impossibile creare la stanza** | 'Spazio' means 'space'. 'Stanza' is correct for 'room'. |
| `settings.themeLightSub` | Aurora boreale (luce) | **Cloud Aurora (Luce)** | Brand name 'Cloud Aurora' must be preserved. 'Aurora boreale' means 'Northern Lights'. |
| `sip.subtitle` | Configurazione delle linee telefoniche per le chiamate in entrata e in uscita | **Configurazione dei trunk per le chiamate in entrata e in uscita** | Use technical term 'trunk' instead of generic 'linee telefoniche'. |
| `sip.newTrunk` | Nuovo SIP | **Nuovo trunk SIP** | Missing 'trunk' from the technical term 'SIP-trunk'. |
| `sip.editTrunk` | Modifica le impostazioni del bagagliaio | **Modifica le impostazioni del trunk** | 'Bagagliaio' means 'trunk' (storage). Use technical term 'trunk'. |
| `sip.trunkId` | ID del bagagliaio | **ID del trunk** | 'Bagagliaio' means 'trunk' (storage). Use technical term 'trunk'. |
| `sip.updated` | Fatto | **Aggiornato** | 'Fatto' means 'Done'. 'Aggiornato' is correct for 'Updated'. |
| `sip.savingShort` | Risparmio… | **Salvataggio…** | 'Risparmio' means 'saving' (money). 'Salvataggio' is 'saving' (data). |
| `sip.createTrunk` | Crea un baule | **Crea un trunk** | 'Baule' means 'trunk' (storage). Use technical term 'trunk'. |
| `sip.incoming.show` | Spettacolo | **Mostra** | 'Spettacolo' means 'show' (performance). 'Mostra' is 'show' (display). |
| `sip.incoming.reissue` | Ristampa | **Rigenera** | 'Ristampa' means 'reprint'. 'Rigenera' is 'reissue' (e.g., a key). |
| `sip.outbound.invalidNumber` | Inserisci il numero corretto nel formato internazionale (+XXXXXXXXXX) | **Inserisci il numero corretto nel formato internazionale (+XXXXXXXXXXX)** | Placeholder 'XXXXXXXXXXX' must be preserved exactly. |
| `sip.toasts.saveFailed` | Impossibile salvare il tronco | **Impossibile salvare il trunk** | 'Tronco' means 'trunk' (tree). Use technical term 'trunk'. |
| `sip.toasts.deleted` | Il tronco è stato eliminato. | **Il trunk è stato eliminato.** | 'Tronco' means 'trunk' (tree). Use technical term 'trunk'. |
| `sip.danger.deleteTrunk` | Elimina il bagagliaio | **Elimina il trunk** | 'Bagagliaio' means 'trunk' (storage). Use technical term 'trunk'. |
| `sip.outbound2.callButton` | Chiamata | **Chiama** | 'Chiamata' is 'call' (noun). 'Chiama' is the imperative verb for 'Call'. |
| `sip.confirm.deleteTrunkBody` | Questa azione è irreversibile. Una volta eliminata, le chiamate in uscita si interromperanno fino alla creazione di una nuova linea. | **Questa azione è irreversibile. Una volta eliminato, le chiamate in uscita si interromperanno fino alla creazione di un nuovo trunk.** | Use technical term 'trunk' instead of generic 'linea'. |
| `enterprise.tabs.questFlow` | Flusso di ritorno | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.tabs.chatwoot` | CRM (Chattwoot) | **CRM (Chatwoot)** | Brand name 'Chatwoot' must be preserved exactly. |
| `enterprise.common.saving` | Risparmio… | **Salvataggio…** | 'Risparmio' means 'saving' (money). 'Salvataggio' is 'saving' (data). |
| `enterprise.common.show` | Spettacolo | **Mostra** | 'Spettacolo' means 'show' (performance). 'Mostra' is 'show' (display). |
| `enterprise.apiKey.show` | Spettacolo | **Mostra** | 'Spettacolo' means 'show' (performance). 'Mostra' is 'show' (display). |
| `enterprise.gemini.savingLabel` | Risparmio… | **Salvataggio…** | 'Risparmio' means 'saving' (money). 'Salvataggio' is 'saving' (data). |
| `enterprise.gemini.confirmDeleteTitle` | Come rimuovere la chiave Gemini per singolo tenant? | **Eliminare la chiave Gemini per singolo tenant?** | Grammar: 'How to remove' vs 'Delete'. |
| `enterprise.gemini.telegram.leadStartCmd` | /inizio | **/start** | Command '/start' must be preserved exactly. |
| `enterprise.gemini.telegram.successUnlinked` | Il bot è stato sbloccato. | **Il bot è stato scollegato.** | 'Sbloccato' means 'unlocked'. 'Scollegato' is 'unlinked'. |
| `enterprise.gemini.telegram.savingLabel` | Risparmio… | **Salvataggio…** | 'Risparmio' means 'saving' (money). 'Salvataggio' is 'saving' (data). |
| `enterprise.gemini.telegram.testingLabel` | Casco… | **Invio…** | 'Casco' means 'helmet' or 'I fall'. 'Invio' is 'Sending...'. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Sciogliere | **Scollega** | 'Sciogliere' means 'to dissolve/untie'. 'Scollega' is 'unlink'. |
| `enterprise.prompt.subtitle` | Promemoria e base di conoscenze per la trascrizione solo nelle sale video. | **Prompt e base di conoscenze per la trascrizione solo nelle sale video.** | 'Promemoria' means 'reminder'. 'Prompt' is a technical term, better kept as is. |
| `enterprise.prompt.promptLabel` | Suggerimenti di sistema (tono, stile, vocabolario) | **Prompt di sistema (tono, stile, vocabolario)** | 'Suggerimenti' means 'suggestions'. 'Prompt' is a technical term, better kept as is. |
| `enterprise.prompt.defaultLabel` | prompt predefinito di VibeVox | **Prompt predefinito di VibeVox** | Capitalization for a label starting with a noun. |
| `enterprise.prompt.promptPlaceholder` | Il tuo suggerimento... | **Il tuo prompt...** | 'Suggerimento' means 'suggestion'. 'Prompt' is a technical term, better kept as is. |
| `enterprise.prompt.savingPromptLabel` | Risparmio… | **Salvataggio…** | 'Risparmio' means 'saving' (money). 'Salvataggio' is 'saving' (data). |
| `enterprise.prompt.errSave` | Errore di denominazione | **Errore di salvataggio** | 'Errore di denominazione' means 'naming error'. 'Errore di salvataggio' is 'save error'. |
| `enterprise.prompt.kbReplaceFile` | File sostituito | **Sostituisci file** | Grammar: 'File sostituito' is past participle. 'Sostituisci file' is the imperative verb. |
| `enterprise.prompt.presetsHeading` | Luoghi di spiegazione accessibili | **Toni di spiegazione disponibili** | 'Luoghi' means 'places'. 'Toni' is correct for 'tones'. |
| `enterprise.questFlow.heading` | Flusso di ritorno | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.warning` | Se il campo è vuoto, viene utilizzato il messaggio predefinito di VibeVox. | **Se il campo è vuoto, viene utilizzato il prompt predefinito di VibeVox.** | 'Messaggio' means 'message'. 'Prompt' is a technical term, better kept as is. |
| `enterprise.questFlow.promptLabel` | Richiesta del sistema Flusso di ritorno | **Prompt del sistema Quest Flow** | Brand name 'Quest Flow' must be preserved. Use 'Prompt' for consistency. |
| `enterprise.questFlow.tagsLabel` | Necessita di etichette | **Tag delle esigenze** | More accurate for 'needs tags'. 'Tag' is a common loanword. |
| `enterprise.questFlow.keysLead` | Ogni chiave è un segreto che inserisci nel blocco HTTP di Quest Flow di una blockchain. VibeVox lo utilizza per identificare il tuo account. Puoi creare più chiavi per diverse blockchain. | **Ogni chiave è un segreto che inserisci nel blocco HTTP della catena Quest Flow. VibeVox lo utilizza per identificare il tuo account. Puoi creare più chiavi per diverse catene.** | 'Blockchain' is incorrect here; should be 'catena' (chain/flow). |
| `enterprise.questFlow.errDelete` | Delete error | **Errore di eliminazione** | English phrase, should be translated to Italian. |
| `enterprise.questFlow.deleteTitle` | Delete | **Elimina** | English phrase, should be translated to Italian. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Eliminare la chiave?** | English phrase, should be translated to Italian. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **La chiave verrà eliminata definitivamente. Quest Flow smetterà di funzionare tramite essa — sarà necessario creare una nuova chiave e sostituirla nel flusso.** | English phrase, should be translated to Italian. 'Quest Flow' is preserved. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Elimina** | English phrase, should be translated to Italian. |
| `enterprise.questFlow.promptPlaceholder` | Il tuo suggerimento... | **Il tuo prompt...** | 'Suggerimento' means 'suggestion'. 'Prompt' is a technical term, better kept as is. |
| `enterprise.questFlow.savingPromptLabel` | Risparmio… | **Salvataggio…** | 'Risparmio' means 'saving' (money). 'Salvataggio' is 'saving' (data). |
| `enterprise.questFlow.kbReplaceFile` | File sostituito | **Sostituisci file** | Grammar: 'File sostituito' is past participle. 'Sostituisci file' is the imperative verb. |
| `enterprise.questFlow.tagsHeading` | Necessita di etichette | **Tag delle esigenze** | More accurate for 'needs tags'. 'Tag' is a common loanword. |
| `enterprise.questFlow.tagsLead` | L'IA assegna questi tag ai clienti se rileva una corrispondenza nella conversazione. I tag vengono visualizzati sulla scheda della camera del cliente e trasmessi al CRM (Sezione 4). | **L'IA assegna questi tag ai clienti se rileva una corrispondenza nella conversazione. I tag vengono visualizzati sulla scheda della stanza del cliente e trasmessi al CRM (Sezione 4).** | Use 'stanza' for room, 'camera' is for hotel rooms. |
| `enterprise.questFlow.errSave` | Errore di denominazione | **Errore di salvataggio** | 'Errore di denominazione' means 'naming error'. 'Errore di salvataggio' is 'save error'. |
| `enterprise.chatwoot.heading` | Integrazione CRM (Chattwoot) | **Integrazione CRM (Chatwoot)** | Brand name 'Chatwoot' must be preserved exactly. |
| `enterprise.chatwoot.headingShort` | CRM (Chattwoot) | **CRM (Chatwoot)** | Brand name 'Chatwoot' must be preserved exactly. |
| `enterprise.chatwoot.statusHeading` | stati di connessione | **Stato della connessione** | Grammar: 'Stato' (singular) for 'Status'. |
| `enterprise.chatwoot.statusConfigured` | Preparato | **Configurato** | 'Preparato' means 'prepared'. 'Configurato' is 'configured'. |
| `enterprise.chatwoot.savingLabel` | Risparmio… | **Salvataggio…** | 'Risparmio' means 'saving' (money). 'Salvataggio' is 'saving' (data). |
| `enterprise.chatwoot.testLabel` | test di combinazione | **Test di connessione** | 'Test di combinazione' means 'combination test'. 'Test di connessione' is 'connection test'. |
| `enterprise.chatwoot.errSave` | Errore di denominazione | **Errore di salvataggio** | 'Errore di denominazione' means 'naming error'. 'Errore di salvataggio' is 'save error'. |
| `enterprise.chatwoot.docsLabel` | Documentazione API di Chatterwood | **Documentazione API di Chatwoot** | Brand name 'Chatwoot' must be preserved exactly. |
| `chat.refreshShort` | Rinfrescato | **Aggiorna** | 'Rinfrescato' is past participle. 'Aggiorna' is the imperative verb for 'Refresh'. |
| `chat.telegramBadge` | Telegramma | **Telegram** | Brand name 'Telegram' must be preserved. |
| `insights.recalc` | Raccontare | **Ricalcola** | 'Raccontare' means 'to tell/narrate'. 'Ricalcola' is 'recalculate'. |
| `insights.summary` | Riprendere | **Riepilogo** | 'Riprendere' means 'to resume'. 'Riepilogo' is 'summary'. |
| `insights.sentiment` | Chiave | **Tonalità** | 'Chiave' means 'key'. 'Tonalità' is 'sentiment/tone'. |
| `insights.engagement` | Fidanzamento | **Coinvolgimento** | 'Fidanzamento' means 'engagement' (marriage). 'Coinvolgimento' is 'involvement/engagement'. |
| `insights.leadScore` | Punteggio principale | **Punteggio lead** | 'Punteggio principale' is literal. 'Punteggio lead' is the common term for 'Lead Score'. |
| `lobby.tosAgree` | Iscrivendoti accetti | **Accedendo, accetti** | 'Iscrivendoti' means 'by subscribing'. 'Accedendo' is 'by joining/accessing'. |
| `lobby.audioConsent` | e acconsentono anche al trattamento dell'audio a fini di traduzione. | **e acconsenti anche al trattamento dell'audio a fini di traduzione.** | Grammar: 'acconsenti' (singular) matches implied 'you' (singular subject). |
| `paywall.buyPlus` | Inoltre — 19 €/mese (60 min) | **Plus — 19 €/mese (60 min)** | Brand/tier name 'Plus' must be preserved. 'Inoltre' means 'also'. |
| `paywall.subscribe` | Progetto | **Abbonati** | 'Progetto' means 'project'. 'Abbonati' is 'Subscribe'. |
| `paywall.topupPlusLine` | Tariffa maggiorata (minuti inclusi) | **Tariffa Plus ({{count}} min inclusi)** | Brand/tier name 'Plus' must be preserved. Placeholder '{{count}}' was missing. |
| `paywall.close` | Vicino | **Chiudi** | 'Vicino' means 'near'. 'Chiudi' is the imperative verb for 'Close'. |
| `postCallInsights.metricSentiment` | Umore | **Tonalità** | 'Umore' means 'mood'. 'Tonalità' is 'sentiment/tone'. |
| `postCallInsights.metricEngagement` | Fidanzamento | **Coinvolgimento** | 'Fidanzamento' means 'engagement' (marriage). 'Coinvolgimento' is 'involvement/engagement'. |
| `postCallInsights.metricLeadScore` | Punteggio principale | **Punteggio lead** | 'Punteggio principale' is literal. 'Punteggio lead' is the common term for 'Lead Score'. |
| `postCallInsights.summary` | Riprendere | **Riepilogo** | 'Riprendere' means 'to resume'. 'Riepilogo' is 'summary'. |
| `billingPage.tierLabel` | Valutare | **Tariffa** | 'Valutare' means 'to evaluate'. 'Tariffa' is 'plan/rate'. |
| `billingPage.promoApply` | Fare domanda a | **Applica** | 'Fare domanda a' means 'to apply to'. 'Applica' is 'Apply' (a code). |
| `billingPage.topupCarried` | Rinviato | **Riportato** | 'Rinviato' means 'postponed'. 'Riportato' is 'carried over'. |
| `billingPage.tierPlusName` | Più | **Plus** | Brand/tier name 'Plus' must be preserved. |
| `billingPage.featureCountWithMinutes` | minuti di traduzione al mese | **{{count}} minuti di traduzione al mese** | Missing placeholder '{{count}}'. |
| `billingPage.featureHd` | Voci di traduzione in alta definizione (Aoede, Caronte, Kore) | **Voci di traduzione in alta definizione (Aoede, Charon, Kore)** | Brand name 'Charon' must be preserved. |
| `billingPage.featureBranding` | Personalizzazione della camera (logo, colori) | **Personalizzazione della stanza (logo, colori)** | Use 'stanza' for room, 'camera' is for hotel rooms. |
| `billingPage.featurePersonalPrompts` | Suggerimenti personalizzati basati sull'IA | **Prompt personalizzati basati sull'IA** | 'Suggerimenti' means 'suggestions'. 'Prompt' is a technical term, better kept as is. |
| `billingPage.featureCRMExport` | Esporta nel CRM (Chatwood + API) | **Esporta nel CRM (Chatwoot + API)** | Brand name 'Chatwoot' must be preserved exactly. |
| `billingPage.ctaSubscribeStandard` | Ordine standard | **Abbonati a Standard** | 'Ordine standard' means 'standard order'. 'Abbonati a Standard' is 'Subscribe to Standard'. |
| `billingPage.languagesCount_one` | Trovato: linguaggio {{count}} | **Trovato: {{count}} lingua** | Grammar: 'lingua' for specific language. Placeholder order. |
| `billingPage.faqA2` | Sì. Puoi annullare l'abbonamento dal tuo account personale con un solo clic. Il periodo già pagato si rinnoverà automaticamente fino alla sua scadenza. | **Sì. Puoi annullare l'abbonamento dal tuo account personale con un solo clic. Il periodo già pagato continua a funzionare fino alla sua scadenza.** | 'Si rinnoverà automaticamente' means 'will renew automatically'. 'Continua a funzionare' means 'continues to work'. |
| `billingPage.faqA3` | Suite completa di intelligenza artificiale: schede cliente con riconoscimento automatico, autorizzazione tramite Telegram, promemoria personalizzati, Google Calendar, etichettatura intelligente delle esigenze, esportazione dal CRM, integrazione con questflow.pro e una scheda amministrativa separata. | **Suite completa di intelligenza artificiale: schede cliente con riconoscimento automatico, autorizzazione tramite Telegram, prompt personalizzati, Google Calendar, etichettatura intelligente delle esigenze, esportazione dal CRM, integrazione con questflow.pro e una scheda amministrativa separata.** | 'Promemoria' means 'reminder'. 'Prompt' is a technical term, better kept as is. |
| `billingPage.renewsOn` | estensione {{date}} | **rinnovo {{date}}** | 'Estensione' means 'extension'. 'Rinnovo' is 'renewal'. |
| `auth.login.submit` | Login | **Accedi** | 'Login' is for authentication. 'Accedi' is 'Log in'. |
| `auth.login.registerLink` | Registro | **Registrati** | 'Registro' is 'register' (noun). 'Registrati' is the imperative verb for 'Register'. |
| `auth.register.submit` | Registro | **Registrati** | 'Registro' is 'register' (noun). 'Registrati' is the imperative verb for 'Register'. |
| `auth.register.loginLink` | Login | **Accedi** | 'Login' is for authentication. 'Accedi' is 'Log in'. |
| `auth.forgot.successTitle` | La lettera è stata inviata | **Email inviata** | 'Lettera' means 'letter' (physical). 'Email inviata' is 'Email sent'. |

⚠ 11 fix(es) skipped (no-op, missing path, or would break placeholders).
