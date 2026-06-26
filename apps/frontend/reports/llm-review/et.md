# LLM Review: Estonian (et)

**Model:** gemini-2.5-flash  
**Took:** 163.3s  
**Fixes proposed:** 77 (valid after placeholder-check: 77)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.sip` | SIP-telefonisüsteem | **SIP-telefon** | Shorter and more common for navigation menu item. |
| `rooms.live` | Otseülekanne | **Otse** | Shorter and more common for 'live' status in UI. |
| `call.muted` | Heli puudub | **Vaigistatud** | More accurate translation for 'muted' (microphone). |
| `call.validating` | VibeVoxi turvalise ühenduse testimine… | **VibeVoxi turvalise ühenduse kontrollimine…** | More accurate for 'checking/validating' than 'testing'. |
| `coach.thinking` | Tehisintellekt arvab... | **Tehisintellekt mõtleb...** | More accurate for 'thinking' (processing) than 'arvab' (opining). |
| `partner.title` | Partner program | **Partnerprogramm** | Translate 'Partner program' to Estonian. |
| `partner.subtitle` | Share your link and earn | **Jaga oma linki ja teeni** | Translate 'Share your link and earn' to Estonian. |
| `partner.yourLink` | Your link | **Sinu link** | Translate 'Your link' to Estonian. |
| `partner.copy` | Copy | **Kopeeri** | Translate 'Copy' to Estonian. |
| `partner.copied` | ✓ Link copied | **✓ Link kopeeritud** | Translate 'Link copied' to Estonian. |
| `partner.stats.clicks` | Clicks | **Klikid** | Translate 'Clicks' to Estonian. |
| `partner.stats.registrations` | Sign-ups | **Registreerumised** | Translate 'Sign-ups' to Estonian. |
| `partner.stats.paid` | Payments | **Maksed** | Translate 'Payments' to Estonian. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} kasutajat · {{minutes}} min** | Translate 'users' to Estonian. |
| `partner.terms` | Program terms | **Programmi tingimused** | Translate 'Program terms' to Estonian. |
| `partner.contact` | Contact us | **Võta meiega ühendust** | Translate 'Contact us' to Estonian. |
| `partner.termsModalTitle` | Partner program terms | **Partnerprogrammi tingimused** | Translate 'Partner program terms' to Estonian. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Programmi tingimused pole veel määratud. Palun võtke ühendust SuperAdminiga.** | Translate 'Program terms are not set yet. Please contact SuperAdmin.' to Estonian. |
| `partner.loadError` | Failed to load partner data | **Partnerandmete laadimine ebaõnnestus** | Translate 'Failed to load partner data' to Estonian. |
| `moreSheet.sip.label` | SIP-telefonisüsteem | **SIP-telefon** | Shorter and more common for menu label. |
| `sip.title` | SIP-telefonisüsteem | **SIP-telefon** | Shorter and more common for 'SIP telephony'. |
| `sip.connected` | SIP-trunk salvestatakse ja sünkroonitakse LiveKitiga | **SIP-trunk on salvestatud ja sünkroonitud LiveKitiga** | Correct verb tense for 'saved' (past participle). |
| `enterprise.gemini.statusNotChecked` | Pole kinnitatud | **Pole kontrollitud** | More accurate for 'not checked' than 'not confirmed'. |
| `enterprise.gemini.successSavedValidated` | Võti on salvestatud ja kinnitatud – see töötab. | **Võti on salvestatud ja kontrollitud – see töötab.** | More accurate for 'validated' than 'confirmed'. |
| `enterprise.gemini.successSavedWithIssue` | Salvestatud, aga valideeritud: {{error}} | **Salvestatud, aga kontrollimine: {{error}}** | Use native Estonian 'kontrollimine' for 'validation'. |
| `enterprise.gemini.telegram.leadCreatePart2` | ja kleebi selle märk. | **ja sisesta selle token.** | Use 'token' as a technical term, and 'sisesta' for 'paste'. |
| `enterprise.gemini.telegram.botUnlink` | Boti linkimise tühistamine | **Eemalda bot** | Shorter and more direct verb phrase for 'unlink bot'. |
| `enterprise.gemini.telegram.confirmUnlinkTitle` | Kas boti linkimine tühistada? | **Kas eemaldada bot?** | Shorter and more direct verb phrase for 'unlink bot'. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Lahti sidumine | **Eemalda** | Shorter and more direct verb for 'unlink'. |
| `enterprise.prompt.subtitle` | Ainult videoruumides transkriptsiooniks mõeldud küsimused ja teadmistebaas | **Prompt ja teadmusbaas ainult videoruumides transkriptsiooniks** | Use 'prompt' as a technical term, 'küsimused' was incorrect. |
| `enterprise.prompt.promptLabel` | Süsteemiülesanne (toon, stiil, sõnavara) | **Süsteemi prompt (toon, stiil, sõnavara)** | Use 'prompt' as a technical term. |
| `enterprise.prompt.savePrompt` | Salvesta viip | **Salvesta prompt** | Consistency with 'prompt' as a technical term. |
| `enterprise.prompt.defaultLabel` | VibeVoxi vaikeviip | **VibeVoxi vaikeprompt** | Consistency with 'prompt' as a technical term. |
| `enterprise.prompt.appendNote` | Saate lisada oma reegleid – need kombineeritakse vaikesätetega. | **Saate lisada oma reegleid – need kombineeritakse vaikepromptiga.** | More precise, refers to the default prompt, not general settings. |
| `enterprise.prompt.headerLeadBold1` | ainult videoruumides sõnumite dekrüpteerimiseks | **ainult videoruumides sõnumite transkriptsiooniks** | More accurate for 'transcription' than 'decryption'. |
| `enterprise.prompt.headerLeadBold2` | "Vastavalt teie viibale" | **"Vastavalt teie promptile"** | Consistency with 'prompt' as a technical term. |
| `enterprise.prompt.contextHeading` | Kontekst / viip | **Kontekst / prompt** | Consistency with 'prompt' as a technical term. |
| `enterprise.prompt.contextLeadBold` | "Vastavalt teie viibale" | **"Vastavalt teie promptile"** | Consistency with 'prompt' as a technical term. |
| `enterprise.prompt.extendNoteText` | oma reeglite/stiili/terminoloogiaga - need kombineeritakse ülaltoodud vaikeviiba ja teadmusbaasiga. | **oma reeglite/stiili/terminoloogiaga - need kombineeritakse ülaltoodud vaikepromptiga ja teadmusbaasiga.** | Consistency with 'prompt' as a technical term. |
| `enterprise.prompt.promptPlaceholder` | Sinu viip... | **Sinu prompt...** | Consistency with 'prompt' as a technical term. |
| `enterprise.prompt.savePromptLabel` | Salvesta viip | **Salvesta prompt** | Consistency with 'prompt' as a technical term. |
| `enterprise.prompt.successPromptSaved` | Viip salvestatud. | **Prompt salvestatud.** | Consistency with 'prompt' as a technical term. |
| `enterprise.prompt.kbCharsSuffix` | sümbolid | **sümbolit** | Grammatical correctness for 'X characters' in Estonian. |
| `enterprise.prompt.kbDeleteTitle` | Teadmusbaasi kustutamine | **Kustuta teadmusbaas** | More direct verb phrase for 'delete knowledge base'. |
| `enterprise.prompt.presetsHeading` | Ligipääsetavad selgitustoonid | **Saadaolevad selgitustoonid** | More accurate for 'available' than 'accessible'. |
| `enterprise.prompt.presetsLeadBold` | "Vastavalt teie viibale" | **"Vastavalt teie promptile"** | Consistency with 'prompt' as a technical term. |
| `enterprise.prompt.presetsLeadPart2` | kasutab teie ülaltoodud väljalt saadud käsku. | **kasutab teie ülaltoodud väljalt saadud prompti.** | Consistency with 'prompt' as a technical term. |
| `enterprise.questFlow.warning` | Kui väli on tühi, kasutatakse üldist VibeVoxi viipa. | **Kui väli on tühi, kasutatakse üldist VibeVoxi prompti.** | Consistency with 'prompt' as a technical term. |
| `enterprise.questFlow.promptLabel` | Quest Flow süsteemi viip | **Quest Flow süsteemi prompt** | Consistency with 'prompt' as a technical term. |
| `enterprise.questFlow.kbLabel` | Teadmusbaas Quest Flow kohta | **Quest Flow teadmusbaas** | More concise and natural phrasing for 'Quest Flow knowledge base'. |
| `enterprise.questFlow.savePrompt` | Salvesta viip | **Salvesta prompt** | Consistency with 'prompt' as a technical term. |
| `enterprise.questFlow.errDelete` | Delete error | **Kustutamise viga** | Translate 'Delete error' to Estonian. |
| `enterprise.questFlow.neverUsed` | ei kasutata | **ei ole kasutatud** | Correct verb tense for 'has not been used'. |
| `enterprise.questFlow.deleteTitle` | Delete | **Kustuta** | Translate 'Delete' to Estonian. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Kas kustutada võti?** | Translate 'Delete key?' to Estonian. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Võti kustutatakse jäädavalt. Quest Flow lakkab selle kaudu töötamast – peate looma uue võtme ja selle ahelas asendama.** | Translate 'The key will be deleted permanently...' to Estonian. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Kustuta** | Translate 'Delete' to Estonian. |
| `enterprise.questFlow.promptHeading` | Telegrami vestluste viip | **Telegrami vestluste prompt** | Consistency with 'prompt' as a technical term. |
| `enterprise.questFlow.promptLead2` | — kasutatakse üldist VibeVoxi käsku (allpool). | **— kasutatakse üldist VibeVoxi prompti (allpool).** | Consistency with 'prompt' as a technical term. |
| `enterprise.questFlow.promptLead3` | - see kombineeritakse põhiküsimustiku ja teadmistebaasiga. | **- see kombineeritakse põhipromptiga ja teadmusbaasiga.** | Consistency with 'prompt' as a technical term. |
| `enterprise.questFlow.promptPlaceholder` | Sinu viip... | **Sinu prompt...** | Consistency with 'prompt' as a technical term. |
| `enterprise.questFlow.successPromptSaved` | Ülesandevoo viip salvestatud. | **Quest Flow prompt salvestatud.** | Consistency with 'prompt' as a technical term. |
| `enterprise.questFlow.kbHeading` | Teadmusbaas Quest Flow kohta | **Quest Flow teadmusbaas** | More concise and natural phrasing for 'Quest Flow knowledge base'. |
| `enterprise.questFlow.kbLead3` | Video transkriptsiooni jaoks jaotisest „Vihjed”. Piirang: 50 MB faili / 500 000 tähemärki andmebaasis. | **eraldi jaotisest „Näpunäited” – see on video transkriptsiooniks. Piirang: 50 MB faili / 500 000 tähemärki andmebaasis.** | Corrected sentence structure and meaning for 'separate from Prompts section, that one is for video transcription'. |
| `enterprise.questFlow.kbCharsSuffix` | sümbolid | **sümbolit** | Grammatical correctness for 'X characters' in Estonian. |
| `chat.enterpriseOnlyHint` | Vestlusruumid on ettevõtte funktsioon. Uuendage oma paketti jaotises „Hinnakujundus”. | **Vestlusruumid on ettevõtte funktsioon. Uuendage oma paketti jaotises „Tariifid”.** | Consistent with 'Tariifid' (plans/tariffs) used elsewhere. |
| `chat.telegramBadge` | Telegramm | **Telegram** | Preserve brand name 'Telegram'. |
| `paywall.titleNoSub` | Toa loomiseks palun registreeru plaani saamiseks | **Toa loomiseks palun osta pakett** | More direct translation for 'subscribe to a plan'. |
| `paywall.titleLowBalance` | Teie saldol pole minuteid jäänud – registreeruge paketile või ostke juurde | **Teie saldol pole minuteid jäänud – valige pakett või ostke juurde** | More direct translation for 'choose a plan'. |
| `paywall.subtitle` | Vali pakett või osta lisaminuteid – maksa Stripe'i kaudu ja saad kohe raha tagasi siin. | **Vali pakett või osta lisaminuteid – maksa Stripe'i kaudu ja naase kohe siia.** | Corrected meaning of 'return here immediately' (redirection after payment). |
| `paywall.featureMinutes` | {{count}} minutiline tõlge | **{{count}} tõlkeminutit** | More natural phrasing for 'translation minutes'. |
| `billingPage.featureCountWithMinutes` | {{count}} minutit tõlketööd kuus | **{{count}} tõlkeminutit kuus** | More natural phrasing for 'translation minutes'. |
| `billingPage.featureSip` | SIP-telefoniteenus (sissetulev ja väljaminev) | **SIP-telefon (sissetulev ja väljaminev)** | Shorter and more common for 'SIP telephony'. |
| `billingPage.featurePersonalPrompts` | Isiklikud tehisintellekti juhised | **Isiklikud tehisintellekti prompts** | Consistency with 'prompt' as a technical term. |
| `billingPage.faqA3` | isikupärastatud päringud | **isikupärastatud prompts** | Consistency with 'prompt' as a technical term. |
| `auth.login.submit` | Sisselogimine | **Logi sisse** | More direct verb for 'Log in' (button label). |
| `auth.register.loginLink` | Sisselogimine | **Logi sisse** | More direct verb for 'Log in' (link). |
