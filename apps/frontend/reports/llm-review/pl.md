# LLM Review: Polish (pl)

**Model:** gemini-2.5-flash  
**Took:** 260.7s  
**Fixes proposed:** 249 (valid after placeholder-check: 249)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.enterpriseSettings` | Ustawienia przedsiębiorstwa | **Ustawienia Enterprise** | Preserve brand name 'Enterprise'. |
| `nav.home` | Dom | **Strona główna** | Better translation for 'Home' in navigation context. |
| `rooms.create` | Tworzyć | **Utwórz** | Button label should be imperative 'Utwórz' not infinitive 'Tworzyć'. |
| `rooms.tabs.questFlow` | Przepływ zadań | **Quest Flow** | Preserve brand name 'Quest Flow'. |
| `rooms.participants` | uczestnicy | **uczestników** | Correct genitive plural form for 'participants'. |
| `rooms.actions.open` | Login | **Wejdź** | Translate 'Войти' to Polish 'Wejdź' instead of English 'Login'. |
| `rooms.actions.chat` | Pogawędzić | **Czat** | Button label should be noun 'Czat' not infinitive 'Pogawędzić'. |
| `rooms.actions.delete` | Usuwać | **Usuń** | Button label should be imperative 'Usuń' not infinitive 'Usuwać'. |
| `rooms.actions.rename` | Przemianować | **Zmień nazwę** | Button label should be imperative 'Zmień nazwę' not infinitive 'Przemianować'. |
| `rooms.confirmDelete.confirm` | Usuwać | **Usuń** | Button label should be imperative 'Usuń' not infinitive 'Usuwać'. |
| `common.cancel` | Anulować | **Anuluj** | Button label should be imperative 'Anuluj' not infinitive 'Anulować'. |
| `common.confirm` | Potwierdzać | **Potwierdź** | Button label should be imperative 'Potwierdź' not infinitive 'Potwierdzać'. |
| `common.save` | Ratować | **Zapisz** | Wrong word sense. 'Ratować' means 'to rescue', 'Zapisz' means 'to save (data)'. |
| `common.delete` | Usuwać | **Usuń** | Button label should be imperative 'Usuń' not infinitive 'Usuwać'. |
| `common.back` | Z powrotem | **Wróć** | More concise and common button label 'Wróć' for 'Back'. |
| `common.loading` | Załadunek... | **Ładowanie...** | Wrong word sense. 'Załadunek' is cargo loading, 'Ładowanie' is data loading. |
| `common.open` | Otwarte | **Otwórz** | Button label should be imperative 'Otwórz' not adjective 'Otwarte'. |
| `common.select` | Wybierać | **Wybierz** | Button label should be imperative 'Wybierz' not infinitive 'Wybierać'. |
| `common.edit` | Zmiana | **Edytuj** | Button label should be imperative 'Edytuj' not noun 'Zmiana'. |
| `common.tryAgain` | Powtarzać | **Spróbuj ponownie** | Better translation for 'Try again' as an imperative. |
| `common.success` | Gotowy | **Gotowe** | Adjective 'Gotowy' should be neuter 'Gotowe' for a general 'Done/Success'. |
| `balance.label` | Balansować | **Saldo** | Wrong word sense. 'Balansować' is a verb, 'Saldo' is a noun for balance. |
| `balance.minutes_few` | {{count}} minut | **{{count}} minuty** | Correct plural form for 'few' (2-4) minutes in Polish. |
| `balance.openPlans` | Otwarte taryfy i saldo | **Otwórz taryfy i saldo** | Button label should be imperative 'Otwórz' not adjective 'Otwarte'. |
| `tier.trial` | Test | **Okres próbny** | Wrong word sense. 'Test' is too general, 'Okres próbny' is specific to subscription trial. |
| `tier.standardYearly` | Rocznie | **Yearly** | Preserve brand name 'Yearly'. |
| `tier.enterprise` | Przedsiębiorstwo | **Enterprise** | Preserve brand name 'Enterprise'. |
| `languagePicker.searchPlaceholder` | Wyszukiwanie języka... | **Szukaj języka...** | Placeholder should be imperative 'Szukaj języka...' not noun 'Wyszukiwanie języka...'. |
| `sidebar.logoAria` | VibeVox — Strona główna | **VibeVox — Na stronę główną** | More accurate translation for 'to home page' in ARIA label. |
| `moreSheet.sip.sub` | Konfigurowanie pni | **Konfigurowanie trunków** | Correct term for SIP trunks is 'trunków', not 'pni'. |
| `moreSheet.enterprise.label` | Ustawienia przedsiębiorstwa | **Ustawienia Enterprise** | Preserve brand name 'Enterprise'. |
| `call.more` | Dodatkowo | **Więcej** | Button label should be 'Więcej' (More) not adverb 'Dodatkowo'. |
| `call.validating` | Testowanie bezpiecznego połączenia VibeVox… | **Sprawdzanie bezpiecznego połączenia VibeVox…** | More accurate translation for 'validating' is 'Sprawdzanie'. |
| `call.connected` | Połączony | **Połączono** | Correct neuter form for 'Connected' status. |
| `call.translatorJoining` | Wprowadzamy na rynek tłumacza AI… | **Uruchamianie tłumacza AI…** | Wrong word sense. 'Wprowadzamy na rynek' means 'launching to market', 'Uruchamianie' means 'starting'. |
| `call.cameraBlocked` | Kamera i mikrofon są niedozwolone | **Kamera lub mikrofon nie są dozwolone** | Correct conjunction 'lub' (or) and more natural phrasing for 'not allowed'. |
| `coach.promptPlaceholder` | Zapytaj o cokolwiek – o rozmowę lub o cokolwiek, co sam sobie zadajesz | **Zapytaj o cokolwiek – o rozmowę lub o dowolne swoje pytanie** | More natural phrasing for 'or any of your questions'. |
| `coach.copy` | Kopia | **Kopiuj** | Button label should be imperative 'Kopiuj' not noun 'Kopia'. |
| `coach.pin` | Przypnij to | **Przypnij** | More concise button label 'Przypnij'. |
| `coach.tones.neutral` | Neutralny | **Neutralnie** | Adjective 'Neutralny' should be adverb 'Neutralnie' for tone. |
| `coach.tones.short` | Krótki | **Krótko** | Adjective 'Krótki' should be adverb 'Krótko' for tone. |
| `coach.tones.empathic` | Empatyczny | **Empatycznie** | Adjective 'Empatyczny' should be adverb 'Empatycznie' for tone. |
| `coach.tonePrompts.formal` | Odpowiadaj w sposób formalny i uprzejmy. | **Odpowiedz w sposób formalny i uprzejmy.** | Use perfective imperative 'Odpowiedz' for a single action. |
| `coach.tonePrompts.scientific` | Odpowiadaj jak naukowiec, odwołując się do badań i danych. | **Odpowiedz jak naukowiec, odwołując się do badań i danych.** | Use perfective imperative 'Odpowiedz' for a single action. |
| `coach.tonePrompts.empathic` | Reaguj empatycznie, biorąc pod uwagę uczucia drugiej osoby. | **Odpowiedz empatycznie, biorąc pod uwagę uczucia drugiej osoby.** | Use 'Odpowiedz' (answer) instead of 'Reaguj' (react). |
| `roomActions.translation.disableSub` | Protokoły nie będą już odpisywane | **Minuty nie będą już odpisywane** | Wrong word sense. 'Protokoły' means 'protocols', 'Minuty' means 'minutes (time)'. |
| `billing.lowBalanceSub` | Kup sobie dodatkowe minuty, aby podtrzymać rozmowę. | **Dokup dodatkowe minuty, aby rozmowa nie została przerwana.** | More formal and natural phrasing for 'buy more minutes' and 'conversation not interrupted'. |
| `billing.paywallNoSub` | Aby utworzyć pokój, zarejestruj się w planie | **Aby utworzyć pokój, wykup plan** | More appropriate verb for 'subscribe to a plan'. |
| `billing.paywallLowBalance` | Na Twoim koncie nie ma już minut – zapisz się na plan lub kup więcej | **Na Twoim koncie nie ma już minut – wykup plan lub dokup więcej** | More appropriate verb for 'subscribe to a plan' and 'buy more'. |
| `settings.themeDarkSub` | Abyss Aurora (Ciemność) | **Abyss Aurora (Dark)** | Preserve brand name 'Dark'. |
| `settings.themeLightSub` | Zorza polarna (światło) | **Cloud Aurora (Light)** | Preserve brand names 'Cloud Aurora' and 'Light'. |
| `partner.title` | Partner program | **Program partnerski** | Translate 'Partner program' to Polish 'Program partnerski'. |
| `partner.subtitle` | Share your link and earn | **Udostępnij swój link i zarabiaj** | Translate to Polish 'Udostępnij swój link i zarabiaj'. |
| `partner.yourLink` | Your link | **Twój link** | Translate to Polish 'Twój link'. |
| `partner.copy` | Copy | **Kopiuj** | Translate to Polish 'Kopiuj'. |
| `partner.copied` | ✓ Link copied | **✓ Link skopiowany** | Translate to Polish '✓ Link skopiowany'. |
| `partner.stats.clicks` | Clicks | **Kliknięcia** | Translate to Polish 'Kliknięcia'. |
| `partner.stats.registrations` | Sign-ups | **Rejestracje** | Translate to Polish 'Rejestracje'. |
| `partner.stats.paid` | Payments | **Płatności** | Translate to Polish 'Płatności'. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} użytkowników · {{minutes}} min** | Translate 'users' to Polish 'użytkowników'. |
| `partner.terms` | Program terms | **Warunki programu** | Translate to Polish 'Warunki programu'. |
| `partner.contact` | Contact us | **Skontaktuj się z nami** | Translate to Polish 'Skontaktuj się z nami'. |
| `partner.termsModalTitle` | Partner program terms | **Warunki programu partnerskiego** | Translate to Polish 'Warunki programu partnerskiego'. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Warunki programu nie zostały jeszcze ustawione. Skontaktuj się z SuperAdminem.** | Translate to Polish. |
| `partner.loadError` | Failed to load partner data | **Nie udało się załadować danych partnerstwa** | Translate to Polish. |
| `sip.subtitle` | Konfigurowanie łączy dla połączeń przychodzących i wychodzących | **Konfigurowanie trunków dla połączeń przychodzących i wychodzących** | Correct term for SIP trunks is 'trunków', not 'łączy'. |
| `sip.newTrunk` | Nowy port SIP | **Nowy trunk SIP** | Correct term for 'SIP trunk' is 'trunk SIP', not 'port SIP'. |
| `sip.editTrunk` | Zmień ustawienia bagażnika | **Zmień ustawienia trunku** | Wrong word sense. 'Bagażnika' means 'car trunk', 'trunku' is for SIP trunk. |
| `sip.loginLabel` | Nazwa użytkownika (logowanie SIP) | **Nazwa użytkownika (login SIP)** | More accurate translation for 'SIP login' as a noun. |
| `sip.trunkId` | Identyfikator bagażnika | **Identyfikator trunku** | Wrong word sense. 'Bagażnika' means 'car trunk', 'trunku' is for SIP trunk. |
| `sip.savingShort` | Oszczędność… | **Zapisywanie…** | Wrong word sense. 'Oszczędność' is 'saving money', 'Zapisywanie' is 'saving data'. |
| `sip.createTrunk` | Utwórz pień | **Utwórz trunk** | Correct term for 'trunk' in SIP context is 'trunk', not 'pień'. |
| `sip.incoming.emptyHint` | Utwórz unikalny SIP URI + login/hasło, aby klienci mogli dzwonić do Ciebie z dowolnego telefonu, a VibeVox automatycznie przetłumaczy Twój głos w czasie rzeczywistym. | **Utwórz unikalny SIP URI + login/hasło, aby klienci mogli dzwonić do Ciebie z dowolnego telefonu, a VibeVox automatycznie tłumaczył głos w czasie rzeczywistym.** | Correct verb tense for 'would translate' and more general 'głos' (voice). |
| `sip.incoming.pausedHint` | Aktywuj odbiór, aby VibeVox zaczął przekierowywać połączenia przychodzące. | **Aktywuj odbiór, aby VibeVox zaczął tłumaczyć połączenia przychodzące.** | Wrong word sense. 'Przekierowywać' means 'redirect', should be 'tłumaczyć' (translate). |
| `sip.incoming.stop` | Zatrzymywać się | **Zatrzymaj** | Button label should be imperative 'Zatrzymaj' not infinitive 'Zatrzymywać się'. |
| `sip.incoming.show` | Pokazywać | **Pokaż** | Button label should be imperative 'Pokaż' not infinitive 'Pokazywać'. |
| `sip.incoming.hide` | Ukrywać | **Ukryj** | Button label should be imperative 'Ukryj' not infinitive 'Ukrywać'. |
| `sip.incoming.copy` | Kopia | **Kopiuj** | Button label should be imperative 'Kopiuj' not noun 'Kopia'. |
| `sip.incoming.reissue` | Wznawiać wydanie | **Wydaj ponownie** | More accurate translation for 'reissue'. |
| `sip.outbound.noTrunkTitle` | Najpierw skonfiguruj wychodzący sygnał SIP | **Najpierw skonfiguruj wychodzący trunk SIP** | Correct term for 'SIP trunk' is 'trunk SIP', not 'sygnał SIP'. |
| `sip.outbound.configureFirst` | Najpierw skonfiguruj wychodzący sygnał SIP (formularz powyżej) | **Najpierw skonfiguruj wychodzący trunk SIP (formularz powyżej)** | Correct term for 'SIP trunk' is 'trunk SIP', not 'sygnał SIP'. |
| `sip.outbound.calling` | Nazywamy {{number}}… | **Dzwonimy na {{number}}…** | Wrong word sense. 'Nazywamy' means 'we name', 'Dzwonimy' means 'we call (on phone)'. |
| `sip.howTo.step3` | VibeVox automatycznie utworzy wychodzący sygnał SIP w chmurze LiveKit. | **VibeVox automatycznie utworzy wychodzący trunk SIP w chmurze LiveKit.** | Correct term for 'SIP trunk' is 'trunk SIP', not 'sygnał SIP'. |
| `sip.toasts.saved` | Ustawienia łącza SIP zapisane | **Ustawienia trunku SIP zapisane** | Correct term for 'SIP trunk' is 'trunk SIP', not 'łącze SIP'. |
| `sip.toasts.saveFailed` | Nie udało się zapisać bagażnika | **Nie udało się zapisać trunku** | Wrong word sense. 'Bagażnika' means 'car trunk', 'trunku' is for SIP trunk. |
| `sip.toasts.deleted` | Pień został usunięty. | **Trunk został usunięty.** | Correct term for 'trunk' in SIP context is 'trunk', not 'pień'. |
| `sip.toasts.deleteFailed` | Nie udało się usunąć pnia | **Nie udało się usunąć trunku** | Correct term for 'trunk' in SIP context is 'trunku', not 'pnia'. |
| `sip.tenantOnly.title` | Łącza SIP są konfigurowane na poziomie dzierżawcy | **Trunki SIP są konfigurowane na poziomie dzierżawcy** | Correct term for 'SIP trunks' is 'Trunki SIP', not 'Łącza SIP'. |
| `sip.tenantOnly.hint2` | Zaloguj się jako zwykły użytkownik, który ma własny tenantId, aby utworzyć linię główną. | **Zaloguj się jako zwykły użytkownik, który ma własny tenantId, aby utworzyć trunk.** | Correct term for 'trunk' in SIP context is 'trunk', not 'linię główną'. |
| `sip.connected` | Połączenie SIP jest zapisywane i synchronizowane z LiveKit | **Trunk SIP został zapisany i zsynchronizowany z LiveKit** | Correct term for 'SIP trunk' and correct verb form. |
| `sip.danger.deleteTrunk` | Usuń pień | **Usuń trunk** | Correct term for 'trunk' in SIP context is 'trunk', not 'pień'. |
| `sip.danger.deleteTrunkHint` | Konfiguracja zostanie usunięta. Połączenia wychodzące zostaną wstrzymane do czasu ponownego utworzenia łącza. | **Konfiguracja zostanie usunięta. Połączenia wychodzące zostaną wstrzymane do czasu ponownego utworzenia trunku.** | Correct term for 'trunk' in SIP context is 'trunku', not 'łącza'. |
| `sip.danger.deleteInboundHint` | Reguła przychodzącego połączenia i wysyłki LiveKit zostaną usunięte. Połączenia przychodzące nie będą już odbierane. | **Usunięte zostaną LiveKit inbound trunk i reguła wysyłki. Połączenia przychodzące nie będą już odbierane.** | Preserve 'LiveKit inbound trunk' and improve phrasing. |
| `sip.outbound2.callButton` | Dzwonić | **Zadzwoń** | Button label should be imperative 'Zadzwoń' not infinitive 'Dzwonić'. |
| `sip.confirm.deleteTrunkBody` | Ta czynność jest nieodwracalna. Po usunięciu połączenia wychodzące zostaną wstrzymane do czasu utworzenia nowego łącza. | **Ta czynność jest nieodwracalna. Po usunięciu połączenia wychodzące zostaną wstrzymane do czasu utworzenia nowego trunku.** | Correct term for 'trunk' in SIP context is 'trunku', not 'łącza'. |
| `sip.confirm.deleteInboundBody` | Ta akcja jest nieodwracalna. Połączenie przychodzące i reguła wysyłki w chmurze LiveKit zostaną usunięte. | **Ta akcja jest nieodwracalna. Usunięte zostaną inbound trunk i reguła wysyłki w chmurze LiveKit.** | Preserve 'inbound trunk' and improve phrasing. |
| `enterprise.page.title` | Ustawienia przedsiębiorstwa | **Ustawienia Enterprise** | Preserve brand name 'Enterprise'. |
| `enterprise.tabs.prompts` | Porady | **Podpowiedzi** | More accurate translation for 'prompts' is 'Podpowiedzi'. |
| `enterprise.tabs.questFlow` | Przepływ zadań | **Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.common.delete` | Usuwać | **Usuń** | Button label should be imperative 'Usuń' not infinitive 'Usuwać'. |
| `enterprise.common.save` | Ratować | **Zapisz** | Wrong word sense. 'Ratować' means 'to rescue', 'Zapisz' means 'to save (data)'. |
| `enterprise.common.saving` | Oszczędność… | **Zapisywanie…** | Wrong word sense. 'Oszczędność' is 'saving money', 'Zapisywanie' is 'saving data'. |
| `enterprise.common.pasteApiKey` | Wprowadź klucz API | **Wklej klucz API** | More accurate translation for 'paste' is 'Wklej'. |
| `enterprise.common.copy` | Kopia | **Kopiuj** | Button label should be imperative 'Kopiuj' not noun 'Kopia'. |
| `enterprise.common.show` | Pokazywać | **Pokaż** | Button label should be imperative 'Pokaż' not infinitive 'Pokazywać'. |
| `enterprise.common.hide` | Ukrywać | **Ukryj** | Button label should be imperative 'Ukryj' not infinitive 'Ukrywać'. |
| `enterprise.apiKey.pastePlaceholder` | Wprowadź klucz API | **Wklej klucz API** | More accurate translation for 'paste' is 'Wklej'. |
| `enterprise.apiKey.copy` | Kopia | **Kopiuj** | Button label should be imperative 'Kopiuj' not noun 'Kopia'. |
| `enterprise.apiKey.show` | Pokazywać | **Pokaż** | Button label should be imperative 'Pokaż' not infinitive 'Pokazywać'. |
| `enterprise.apiKey.hide` | Ukrywać | **Ukryj** | Button label should be imperative 'Ukryj' not infinitive 'Ukrywać'. |
| `enterprise.gemini.leadSuffix` | . Używaj zamiast globalnego dla wszystkich połączeń Gemini na Twoim koncie. | **. Jest używany zamiast globalnego dla wszystkich połączeń Gemini na Twoim koncie.** | Correct verb tense and form for 'is used'. |
| `enterprise.gemini.savingLabel` | Oszczędność… | **Zapisywanie…** | Wrong word sense. 'Oszczędność' is 'saving money', 'Zapisywanie' is 'saving data'. |
| `enterprise.gemini.deleteLabel` | Usuwać | **Usuń** | Button label should be imperative 'Usuń' not infinitive 'Usuwać'. |
| `enterprise.gemini.successDeleted` | Klucz dla każdego lokatora został usunięty. | **Klucz per-tenant został usunięty.** | Preserve technical term 'per-tenant'. |
| `enterprise.gemini.confirmDeleteTitle` | Usunąć klucz Gemini dla każdego dzierżawcy? | **Usunąć klucz Gemini per-tenant?** | Preserve technical term 'per-tenant'. |
| `enterprise.gemini.confirmDeleteCta` | Usuwać | **Usuń** | Button label should be imperative 'Usuń' not infinitive 'Usuwać'. |
| `enterprise.gemini.telegram.lead` | Utwórz bota z @BotFather i wstaw jego token. Każdy, kto wyśle wiadomość do tego bota za pomocą /start, otrzyma powiadomienia: o nowych klientach, tagach, błędach integracji. Możesz subskrybować wielu pracowników lub dodać bota do grupy lub kanału — powiadomienia zostaną automatycznie wysłane do wszystkich. | **Utwórz bota u @BotFather i wstaw jego token. Każdy, kto wyśle wiadomość do tego bota za pomocą /start, otrzyma powiadomienia: o nowych klientach, tagach, błędach integracji. Możesz subskrybować wielu pracowników lub dodać bota do grupy lub kanału — powiadomienia zostaną automatycznie wysłane do wszystkich.** | Correct preposition 'u' (at) instead of 'z' (with). |
| `enterprise.gemini.telegram.leadCreatePart1` | Utwórz bota w | **Utwórz bota u** | Correct preposition 'u' (at) instead of 'w' (in). |
| `enterprise.gemini.telegram.leadAllWhoStart` | Każdy, kto pisze do tego bota | **Każdy, kto napisze do tego bota** | Correct verb tense for 'who sends/will write'. |
| `enterprise.gemini.telegram.errEnterToken` | Włóż token bota | **Wklej token bota** | More accurate translation for 'paste' is 'Wklej'. |
| `enterprise.gemini.telegram.successSavedWithBroadcast` | ✓ Bot @{{username}} został zapisany. Powitanie zostało wysłane do subskrybentów {{sent}}. | **✓ Bot @{{username}} został zapisany. Powitanie zostało wysłane do {{sent}} subskrybentów.** | Correct preposition 'do' for 'to subscribers'. |
| `enterprise.gemini.telegram.successSavedNoBroadcast` | ✓ Bot @{{username}} został zapisany. Każdy, kto wyśle do niego SMS-a o treści /start, otrzyma powiadomienie. | **✓ Bot @{{username}} został zapisany. Każdy, kto napisze mu /start, otrzyma powiadomienie.** | More accurate translation for 'who writes him /start'. |
| `enterprise.gemini.telegram.saveLabel` | Ratować | **Zapisz** | Wrong word sense. 'Ratować' means 'to rescue', 'Zapisz' means 'to save (data)'. |
| `enterprise.gemini.telegram.savingLabel` | Oszczędność… | **Zapisywanie…** | Wrong word sense. 'Oszczędność' is 'saving money', 'Zapisywanie' is 'saving data'. |
| `enterprise.gemini.telegram.testingLabel` | Kask… | **Wysyłamy…** | Wrong word sense. 'Kask' means 'helmet', 'Wysyłamy' means 'sending'. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Rozwiązać | **Odłącz** | More accurate translation for 'unlink' is 'Odłącz'. |
| `enterprise.gemini.telegram.lastBroadcastFailed` | · błędy: {{failed}} | **· błędów: {{failed}}** | Correct genitive plural form for 'errors'. |
| `enterprise.prompt.heading` | Porady | **Podpowiedzi** | More accurate translation for 'prompts' is 'Podpowiedzi'. |
| `enterprise.prompt.promptLabel` | Monit systemowy (ton, styl, słownictwo) | **Podpowiedź systemowa (ton, styl, słownictwo)** | More natural Polish for 'system prompt' is 'Podpowiedź systemowa'. |
| `enterprise.prompt.savePrompt` | Zapisz monit | **Zapisz podpowiedź** | More natural Polish for 'save prompt' is 'Zapisz podpowiedź'. |
| `enterprise.prompt.hideDefault` | Ukrywać | **Ukryj** | Button label should be imperative 'Ukryj' not infinitive 'Ukrywać'. |
| `enterprise.prompt.defaultLabel` | Domyślny monit VibeVox | **Domyślna podpowiedź VibeVox** | More natural Polish for 'default prompt' is 'Domyślna podpowiedź'. |
| `enterprise.prompt.headerLeadBold1` | tylko do odszyfrowywania wiadomości w pokojach wideo | **tylko do transkrypcji wiadomości w pokojach wideo** | Wrong word sense. 'Odszyfrowywania' means 'deciphering', 'transkrypcji' is 'transcription'. |
| `enterprise.prompt.headerLeadBold2` | „Zgodnie z twoją prośbą” | **„Zgodnie z twoją podpowiedzią”** | More accurate translation for 'prompt' is 'podpowiedzią'. |
| `enterprise.prompt.contextHeading` | Kontekst / zachęta | **Kontekst / podpowiedź** | Wrong word sense. 'Zachęta' means 'incentive', 'podpowiedź' is 'prompt'. |
| `enterprise.prompt.contextLeadPart1` | Używane, gdy klikniesz na wiadomość w czacie wideo i wybierzesz dźwięk | **Używane, gdy klikniesz na wiadomość w czacie wideo i wybierzesz ton** | Wrong word sense. 'Dźwięk' means 'sound', should be 'ton'. |
| `enterprise.prompt.contextLeadBold` | „Zgodnie z twoją prośbą” | **„Zgodnie z twoją podpowiedzią”** | More accurate translation for 'prompt' is 'podpowiedzią'. |
| `enterprise.prompt.contextLeadPart2` | Baza wiedzy jest również wymieszana (poniżej). | **Baza wiedzy jest również dodawana (poniżej).** | More accurate translation for 'mixed in/added' is 'dodawana'. |
| `enterprise.prompt.extendNoteBold` | Można go uzupełnić | **Można uzupełnić** | More concise phrasing, 'go' (it) is redundant. |
| `enterprise.prompt.extendNoteText` | z własnymi zasadami/stylem/terminologią - zostaną połączone z domyślnym monitem powyżej i bazą wiedzy. | **z własnymi zasadami/stylem/terminologią - zostaną połączone z domyślną podpowiedzią powyżej i bazą wiedzy.** | More natural Polish for 'default prompt' is 'domyślną podpowiedzią'. |
| `enterprise.prompt.promptPlaceholder` | Twój komunikat... | **Twoja podpowiedź...** | Wrong word sense. 'Komunikat' means 'message', 'podpowiedź' is 'prompt'. |
| `enterprise.prompt.savingPromptLabel` | Oszczędność… | **Zapisywanie…** | Wrong word sense. 'Oszczędność' is 'saving money', 'Zapisywanie' is 'saving data'. |
| `enterprise.prompt.savePromptLabel` | Zapisz monit | **Zapisz podpowiedź** | More natural Polish for 'save prompt' is 'Zapisz podpowiedź'. |
| `enterprise.prompt.successPromptSaved` | Monit zapisany. | **Podpowiedź zapisana.** | More natural Polish for 'prompt saved' is 'Podpowiedź zapisana'. |
| `enterprise.prompt.kbCharsSuffix` | symbolika | **znaków** | Wrong word sense. 'Symbolika' means 'symbolism', 'znaków' means 'characters'. |
| `enterprise.prompt.kbUploading` | Załadunek… | **Ładowanie…** | Wrong word sense. 'Załadunek' is cargo loading, 'Ładowanie' is data loading. |
| `enterprise.prompt.confirmKbDeleteCta` | Usuwać | **Usuń** | Button label should be imperative 'Usuń' not infinitive 'Usuwać'. |
| `enterprise.prompt.presetsHeading` | Przystępne tony wyjaśnień | **Dostępne tony wyjaśnień** | Wrong word sense. 'Przystępne' means 'affordable', 'Dostępne' means 'available'. |
| `enterprise.prompt.presetsLeadBold` | „Zgodnie z twoją prośbą” | **„Zgodnie z twoją podpowiedzią”** | More accurate translation for 'prompt' is 'podpowiedzią'. |
| `enterprise.questFlow.heading` | Przepływ zadań | **Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.warning` | Jeżeli pole jest puste, używany jest ogólny monit VibeVox. | **Jeżeli pole jest puste, używana jest ogólna podpowiedź VibeVox.** | More natural Polish for 'prompt' is 'Podpowiedź'. |
| `enterprise.questFlow.apiKeyLabel` | Klucz API przychodzący (nośnik) | **Klucz API przychodzący (Bearer)** | Preserve technical term 'Bearer'. |
| `enterprise.questFlow.promptLabel` | Monit systemu Quest Flow | **Podpowiedź systemowa Quest Flow** | More natural Polish for 'system prompt' is 'Podpowiedź systemowa'. |
| `enterprise.questFlow.tagsLabel` | Potrzebuje tagów | **Tagi potrzeb** | Correct phrasing for 'tags of needs'. |
| `enterprise.questFlow.savePrompt` | Zapisz monit | **Zapisz podpowiedź** | More natural Polish for 'save prompt' is 'Zapisz podpowiedź'. |
| `enterprise.questFlow.errDelete` | Delete error | **Błąd usuwania** | Translate to Polish 'Błąd usuwania'. |
| `enterprise.questFlow.copyKey` | Kopia | **Kopiuj** | Button label should be imperative 'Kopiuj' not noun 'Kopia'. |
| `enterprise.questFlow.deleteTitle` | Delete | **Usuń** | Translate to Polish 'Usuń'. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Usunąć klucz?** | Translate to Polish 'Usunąć klucz?'. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Klucz zostanie trwale usunięty. Quest Flow przestanie przez niego działać — będzie trzeba utworzyć nowy klucz i zastąpić go w przepływie.** | Translate to Polish. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Usuń** | Translate to Polish 'Usuń'. |
| `enterprise.questFlow.promptHeading` | Monit o konwersacje w Telegramie | **Podpowiedź do konwersacji w Telegramie** | More natural Polish for 'prompt' is 'Podpowiedź'. |
| `enterprise.questFlow.promptLead2` | — używany jest ogólny komunikat VibeVox (poniżej). | **— używana jest ogólna podpowiedź VibeVox (poniżej).** | Wrong word sense. 'Komunikat' means 'message', 'podpowiedź' is 'prompt'. |
| `enterprise.questFlow.promptPlaceholder` | Twoja zachęta... | **Twoja podpowiedź...** | Wrong word sense. 'Zachęta' means 'incentive', 'podpowiedź' is 'prompt'. |
| `enterprise.questFlow.savingPromptLabel` | Oszczędność… | **Zapisywanie…** | Wrong word sense. 'Oszczędność' is 'saving money', 'Zapisywanie' is 'saving data'. |
| `enterprise.questFlow.savePromptLabel` | Ratować | **Zapisz** | Wrong word sense. 'Ratować' means 'to rescue', 'Zapisz' means 'to save (data)'. |
| `enterprise.questFlow.successPromptSaved` | Monit Quest Flow został zapisany. | **Podpowiedź Quest Flow została zapisana.** | More natural Polish for 'prompt saved' is 'Podpowiedź zapisana'. |
| `enterprise.questFlow.kbLeadBold1` | Jeśli pusty | **Jeśli puste** | Correct neuter adjective form for 'empty' referring to 'pole' (field). |
| `enterprise.questFlow.kbLeadBold2` | oddzielny | **oddzielna** | Correct feminine adjective form for 'separate' referring to 'baza' (base). |
| `enterprise.questFlow.kbLead3` | Z sekcji „Wskazówki” – do transkrypcji wideo. Limit: plik 50 MB / 500 000 znaków w bazie danych. | **Z sekcji „Podpowiedzi” – do transkrypcji wideo. Limit: plik 50 MB / 500 000 znaków w bazie danych.** | More accurate translation for 'prompts' is 'Podpowiedzi'. |
| `enterprise.questFlow.kbCharsSuffix` | symbolika | **znaków** | Wrong word sense. 'Symbolika' means 'symbolism', 'znaków' means 'characters'. |
| `enterprise.questFlow.kbDeleteTitle` | Usuwać | **Usuń** | Button label should be imperative 'Usuń' not infinitive 'Usuwać'. |
| `enterprise.questFlow.kbUploading` | Załadunek… | **Ładowanie…** | Wrong word sense. 'Załadunek' is cargo loading, 'Ładowanie' is data loading. |
| `enterprise.questFlow.confirmKbDeleteCta` | Usuwać | **Usuń** | Button label should be imperative 'Usuń' not infinitive 'Usuwać'. |
| `enterprise.questFlow.tagsHeading` | Potrzebuje tagów | **Tagi potrzeb** | Correct phrasing for 'tags of needs'. |
| `enterprise.chatwoot.save` | Ratować | **Zapisz** | Wrong word sense. 'Ratować' means 'to rescue', 'Zapisz' means 'to save (data)'. |
| `enterprise.chatwoot.connected` | Połączony | **Połączono** | Correct neuter form for 'Connected' status. |
| `enterprise.chatwoot.notConnected` | Nie połączony | **Nie połączono** | Correct neuter form for 'Not connected' status. |
| `enterprise.chatwoot.statusActive` | Aktywny | **Aktywna** | Correct feminine adjective form for 'Active' referring to 'integracja'. |
| `enterprise.chatwoot.statusDisabled` | Wyłączony | **Wyłączona** | Correct feminine adjective form for 'Disabled' referring to 'integracja'. |
| `enterprise.chatwoot.savingLabel` | Oszczędność… | **Zapisywanie…** | Wrong word sense. 'Oszczędność' is 'saving money', 'Zapisywanie' is 'saving data'. |
| `enterprise.chatwoot.saveLabel` | Ratować | **Zapisz** | Wrong word sense. 'Ratować' means 'to rescue', 'Zapisz' means 'to save (data)'. |
| `enterprise.chatwoot.whatSentItem2` | Rozmowa z prywatną notatką = pełna historia dialogu | **Konwersacja z prywatną notatką = pełna historia dialogu** | Translate 'Conversation' to Polish 'Konwersacja'. |
| `enterprise.chatwoot.whatSentItem3Code` | atrybuty_niestandardowe.tag_vibevox | **custom_attributes.vibevox_tags** | Preserve technical term 'custom_attributes.vibevox_tags'. |
| `chat.refreshShort` | Odświeżać | **Odśwież** | Button label should be imperative 'Odśwież' not infinitive 'Odświeżać'. |
| `chat.send` | Wysłać | **Wyślij** | Button label should be imperative 'Wyślij' not infinitive 'Wysłać'. |
| `chat.enterpriseOnlyHint` | Czat to funkcja dostępna dla przedsiębiorstw. Ulepsz swój plan w sekcji „Cennik”. | **Czat to funkcja dostępna dla przedsiębiorstw. Ulepsz swój plan w sekcji „Taryfy”.** | Wrong word sense. 'Cennik' means 'price list', 'Taryfy' means 'tariffs/plans'. |
| `insights.recalc` | Opowiadać | **Przelicz ponownie** | Wrong word sense. 'Opowiadać' means 'to tell', 'Przelicz ponownie' means 'recalculate'. |
| `insights.summary` | Wznawiać | **Podsumowanie** | Wrong word sense. 'Wznawiać' means 'to resume', 'Podsumowanie' is 'summary'. |
| `insights.sentiment` | Klawisz | **Tonalność** | Wrong word sense. 'Klawisz' means 'key', 'Tonalność' means 'tonality/sentiment'. |
| `insights.engagement` | Zaręczyny | **Zaangażowanie** | Wrong word sense. 'Zaręczyny' means 'marriage engagement', 'Zaangażowanie' is 'involvement'. |
| `insights.leadScore` | Wynik wiodący | **Lead Score** | Preserve technical term 'Lead Score'. |
| `insights.analyzedReplies_one` | Przeanalizowano replikę {{count}} | **Przeanalizowano {{count}} replikę** | Correct word order for 'analyzed X reply'. |
| `insights.analyzedReplies_few` | Przeanalizowano repliki {{count}} | **Przeanalizowano {{count}} repliki** | Correct word order for 'analyzed X replies'. |
| `insights.analyzedReplies_many` | Przeanalizowano repliki {{count}} | **Przeanalizowano {{count}} replik** | Correct word order for 'analyzed X replies' (genitive plural). |
| `insights.analyzedReplies_other` | Przeanalizowano repliki {{count}} | **Przeanalizowano {{count}} replik** | Correct word order for 'analyzed X replies' (genitive plural). |
| `insights.sentimentValues.neutral` | Neutralny | **Neutralnie** | Adjective 'Neutralny' should be adverb 'Neutralnie' for sentiment value. |
| `insights.leadValues.cold` | Zimno | **Zimny** | Adverb 'Zimno' should be adjective 'Zimny' for lead value. |
| `lobby.connect` | Łączyć | **Połącz** | Button label should be imperative 'Połącz' not infinitive 'Łączyć'. |
| `lobby.andWord` |  I  | ** i ** | Conjunction 'i' (and) should not be capitalized mid-sentence. |
| `lobby.audioConsent` | oraz wyrażasz zgodę na przetwarzanie dźwięku w celu tłumaczenia. | **, oraz wyrażasz zgodę na przetwarzanie dźwięku w celu tłumaczenia.** | Missing comma at the beginning of the phrase. |
| `lobby.roomFullMsg` | W spotkaniu jest już jeden uczestnik. Skontaktuj się z twórcą spotkania lub poproś o dodanie nowego. | **W spotkaniu jest już jeden uczestnik. Skontaktuj się z twórcą spotkania lub utwórz nową.** | More accurate translation for 'order a new one' is 'create a new one'. |
| `paywall.titleNoSub` | Aby utworzyć pokój, zarejestruj się w planie | **Aby utworzyć pokój, wykup plan** | More appropriate verb for 'subscribe to a plan'. |
| `paywall.titleLowBalance` | Na Twoim koncie nie ma minut – zapisz się na plan lub kup więcej | **Na Twoim koncie nie ma minut – wykup plan lub dokup więcej** | More appropriate verb for 'subscribe to a plan' and 'buy more'. |
| `paywall.subscribe` | Projekt | **Wykup** | Wrong word sense. 'Projekt' means 'project', 'Wykup' means 'subscribe/buy'. |
| `paywall.featureMinutes` | {{count}} min tłumaczenie | **{{count}} min tłumaczenia** | Correct genitive form for 'minutes of translation'. |
| `paywall.or` | Lub | **lub** | Conjunction 'lub' (or) should not be capitalized mid-sentence. |
| `paywall.topupPlusLine` | Taryfa Plus ({{count}} min wliczona) | **Taryfa Plus ({{count}} min wliczonych)** | Correct genitive plural form for 'minutes included'. |
| `paywall.total` | Całkowity | **Suma** | Adjective 'Całkowity' should be noun 'Suma' for 'Total'. |
| `confirmModal.cancel` | Anulować | **Anuluj** | Button label should be imperative 'Anuluj' not infinitive 'Anulować'. |
| `confirmModal.confirm` | Potwierdzać | **Potwierdź** | Button label should be imperative 'Potwierdź' not infinitive 'Potwierdzać'. |
| `confirmModal.delete` | Usuwać | **Usuń** | Button label should be imperative 'Usuń' not infinitive 'Usuwać'. |
| `postCallInsights.subtitle` | Przedsiębiorstwo · spostrzeżenia po rozmowie | **Enterprise · spostrzeżenia po rozmowie** | Preserve brand name 'Enterprise'. |
| `postCallInsights.analyzing` | Przeanalizujmy rozmowę... | **Analizujemy rozmowę...** | Correct verb tense for 'analyzing'. |
| `postCallInsights.metricEngagement` | Zaręczyny | **Zaangażowanie** | Wrong word sense. 'Zaręczyny' means 'marriage engagement', 'Zaangażowanie' is 'involvement'. |
| `postCallInsights.metricLeadScore` | Wynik wiodący | **Lead Score** | Preserve technical term 'Lead Score'. |
| `postCallInsights.summary` | Wznawiać | **Podsumowanie** | Wrong word sense. 'Wznawiać' means 'to resume', 'Podsumowanie' is 'summary'. |
| `settingsMore.subscription` | Prenumerata | **Subskrypcja** | More appropriate term for service subscription is 'Subskrypcja'. |
| `billingPage.balanceMinutes` | protokół | **minut** | Wrong word sense. 'Protokół' means 'protocol', 'minut' means 'minutes (time)'. |
| `billingPage.tierLabel` | Wskaźnik | **Taryfa** | Wrong word sense. 'Wskaźnik' means 'indicator', 'Taryfa' means 'tariff/plan'. |
| `billingPage.cancel` | Anulować | **Anuluj** | Button label should be imperative 'Anuluj' not infinitive 'Anulować'. |
| `billingPage.resume` | Wznawiać | **Wznów** | Button label should be imperative 'Wznów' not infinitive 'Wznawiać'. |
| `billingPage.resumeFailed` | Nie udało się odnowić subskrypcji | **Nie udało się wznowić subskrypcji** | More accurate translation for 'resume subscription' is 'wznowić subskrypcję'. |
| `billingPage.promoApply` | Stosować | **Zastosuj** | Button label should be imperative 'Zastosuj' not infinitive 'Stosować'. |
| `billingPage.promoHint` | Rabat zostanie naliczony automatycznie po zapisaniu się na plan lub zakupie dodatkowych minut. | **Rabat zostanie naliczony automatycznie po wykupieniu planu lub zakupie dodatkowych minut.** | More appropriate verb for 'subscribing to a plan'. |
| `billingPage.monthlyToggle` | Miesięczny | **Miesięcznie** | Adjective 'Miesięczny' should be adverb 'Miesięcznie' for 'Monthly'. |
| `billingPage.topupHelp` | Dodatkowy suwak zakupu. Dostępny z aktywną subskrypcją. | **Suwak do dokupowania minut. Dostępny z aktywną subskrypcją.** | More accurate translation for 'top-up slider'. |
| `billingPage.topupCarried` | Odłożony | **Przeniesione** | Wrong word sense. 'Odłożony' means 'postponed', 'Przeniesione' means 'transferred'. |
| `billingPage.minutesShort` | protokół | **minut** | Wrong word sense. 'Protokół' means 'protocol', 'minut' means 'minutes (time)'. |
| `billingPage.tierEnterpriseName` | Przedsiębiorstwo | **Enterprise** | Preserve brand name 'Enterprise'. |
| `billingPage.tierEnterpriseLabel` | Za zgodą | **Na podstawie umowy** | Wrong word sense. 'Za zgodą' means 'with consent', 'Na podstawie umowy' means 'by contract'. |
| `billingPage.ctaSubscribePlus` | Uzyskaj Plus | **Wykup Plus** | More appropriate verb for 'subscribe to Plus'. |
| `billingPage.ctaSubscribeStandard` | Zamówienie standardowe | **Wykup Standard** | More appropriate verb for 'subscribe to Standard'. |
| `billingPage.ctaContact` | Kontakt | **Skontaktuj się** | Button label should be imperative 'Skontaktuj się' not noun 'Kontakt'. |
| `billingPage.languagesCount_few` | {{count}} język | **{{count}} języki** | Correct plural form for 'few' (2-4) languages in Polish. |
| `billingPage.languagesCount_many` | {{count}} języki | **{{count}} języków** | Correct genitive plural form for 'many' (5+) languages in Polish. |
| `billingPage.languagesCount_other` | {{count}} języki | **{{count}} języków** | Correct genitive plural form for 'other' (5+) languages in Polish. |
| `billingPage.faqA3` | Pełny zestaw rozwiązań AI: karty klientów z automatycznym rozpoznawaniem, autoryzacja w Telegramie, spersonalizowane monity, Kalendarz Google, inteligentne tagowanie potrzeb, eksport CRM, integracja z questflow.pro i osobna karta administracyjna. | **Pełny zestaw rozwiązań AI: karty klientów z automatycznym rozpoznawaniem, autoryzacja w Telegramie, spersonalizowane podpowiedzi, Kalendarz Google, inteligentne tagowanie potrzeb, eksport CRM, integracja z questflow.pro i osobna karta administracyjna.** | More natural Polish for 'prompts' is 'podpowiedzi'. |
| `billingPage.faqA4` | Dowolny zgodny ze standardem RFC: Zadarma, OnlinePBX, Asterisk/FreePBX itd. VibeVox automatycznie tworzy łącze wychodzące. | **Dowolny zgodny ze standardem RFC: Zadarma, OnlinePBX, Asterisk/FreePBX itd. VibeVox automatycznie tworzy outbound trunk.** | Preserve technical term 'outbound trunk'. |
| `billingPage.renewsOn` | rozszerzenie {{date}} | **odnowienie {{date}}** | Wrong word sense. 'Rozszerzenie' means 'extension', 'odnowienie' means 'renewal'. |
| `auth.common.or` | Lub | **lub** | Conjunction 'lub' (or) should not be capitalized mid-sentence. |
| `auth.login.title` | Powitanie | **Witaj** | More natural translation for 'Welcome' title is 'Witaj'. |
| `auth.login.submit` | Login | **Zaloguj się** | Translate 'Войти' to Polish 'Zaloguj się' instead of English 'Login'. |
| `auth.login.registerLink` | Rejestr | **Zarejestruj się** | Button label should be imperative 'Zarejestruj się' not noun 'Rejestr'. |
| `auth.register.submit` | Rejestr | **Zarejestruj się** | Button label should be imperative 'Zarejestruj się' not noun 'Rejestr'. |
| `auth.register.loginLink` | Login | **Zaloguj się** | Translate 'Войти' to Polish 'Zaloguj się' instead of English 'Login'. |
| `auth.register.nameLabel` | Nazwa | **Imię** | Wrong word sense. 'Nazwa' is object name, 'Imię' is person's name. |
| `auth.register.agreementAnd` |  I  | ** i ** | Conjunction 'i' (and) should not be capitalized mid-sentence. |
| `auth.forgot.loading` | Przesyłka… | **Wysyłamy…** | Wrong word sense. 'Przesyłka' means 'shipment', 'Wysyłamy' means 'sending'. |
