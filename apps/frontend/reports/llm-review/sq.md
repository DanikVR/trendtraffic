# LLM Review: Albanian (sq)

**Model:** gemini-2.5-flash  
**Took:** 232.5s  
**Fixes proposed:** 152 (valid after placeholder-check: 141)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.home` | Shtëpi | **Kryefaqja** | Translate 'To homepage' as 'Kryefaqja' for menu label consistency. |
| `rooms.tabs.questFlow` | Fluksi i Kërkimeve | **Quest Flow** | Preserve brand name 'Quest Flow'. |
| `rooms.tryAnother` | Provo një pyetje tjetër | **Provo një kërkim tjetër** | 'Pyetje' means 'question', 'kërkim' is better for 'query/search'. |
| `rooms.participants` | pjesëmarrësit | **Pjesëmarrës** | Remove definite article for a general label. |
| `rooms.actions.open` | Hyrje | **Hyr** | Use verb 'Hyr' (Enter) for a button, not noun 'Hyrje'. |
| `balance.openPlans` | Tarifat e hapura dhe bilanci | **Hap tarifat dhe bilancin** | Use verb 'Hap' (Open) instead of noun phrase 'Tarifat e hapura'. |
| `tier.trial` | Provë | **Abonim provë** | Clarify 'Trial' as 'trial subscription' (abonim provë). |
| `languagePicker.searchPlaceholder` | Duke kërkuar gjuhë... | **Kërko gjuhë...** | Translate 'Search language...' instead of 'Searching language...' |
| `sidebar.logoAria` | VibeVox — Kryefaqja | **VibeVox — Në kryefaqe** | Translate 'To homepage' as 'Në kryefaqe' for better flow. |
| `moreSheet.userFallback` | Përdoruesi | **Përdorues** | Remove definite article for a general fallback label. |
| `call.geminiLive` | Binjakët Live | **Gemini Live** | Preserve brand name 'Gemini'. |
| `call.toPlayground` | 🎯 Për në deponi | **🎯 Për në poligon** | 'Deponi' means 'landfill', 'poligon' is better for 'training ground'. |
| `call.more` | Përveç kësaj | **Më shumë** | Translate 'More' (options) as 'Më shumë', not 'in addition'. |
| `coach.help` | Ndihmë për përgjigjen | **Ndihmo të përgjigjesh** | Use verb 'Ndihmo të përgjigjesh' (Help to answer) instead of noun phrase. |
| `coach.pin` | Ngjite atë | **Ngjite** | Remove redundant pronoun 'atë' (it). |
| `coach.tones.short` | I shkurtër | **Shkurt** | Use adverb 'Shkurt' (shortly) for tone, not adjective 'I shkurtër'. |
| `coach.tones.empathic` | Empatik | **Me empati** | Use adverbial phrase 'Me empati' (with empathy) for tone, not adjective. |
| `roomActions.translation.disableSub` | Procesverbalet nuk do të shlyhen më | **Minutat nuk do të shlyhen më** | 'Procesverbalet' means 'meeting minutes', 'minutat' is for 'time minutes'. |
| `billing.createRoomError` | Gabim në krijimin e dhomës gjatë krijimit të dhomës | **Gabim në krijimin e dhomës** | Remove redundant phrase 'gjatë krijimit të dhomës'. |
| `settings.themeDarkSub` | Aurora e Humnerës (E Errët) | **Abyss Aurora (E Errët)** | Preserve brand name 'Abyss Aurora'. |
| `settings.themeLightSub` | Aurora e Reve (Drita) | **Cloud Aurora (Drita)** | Preserve brand name 'Cloud Aurora'. |
| `partner.title` | Partner program | **Programi i partneritetit** | Translate 'Partner program'. |
| `partner.subtitle` | Share your link and earn | **Ndani lidhjen tuaj dhe fitoni** | Translate 'Share your link and earn'. |
| `partner.yourLink` | Your link | **Lidhja juaj** | Translate 'Your link'. |
| `partner.copy` | Copy | **Kopjo** | Translate 'Copy'. |
| `partner.copied` | ✓ Link copied | **✓ Lidhja u kopjua** | Translate 'Link copied'. |
| `partner.stats.clicks` | Clicks | **Klikime** | Translate 'Clicks'. |
| `partner.stats.registrations` | Sign-ups | **Regjistrime** | Translate 'Sign-ups'. |
| `partner.stats.paid` | Payments | **Pagesa** | Translate 'Payments'. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} përdorues · {{minutes}} min** | Translate 'users'. |
| `partner.terms` | Program terms | **Kushtet e programit** | Translate 'Program terms'. |
| `partner.contact` | Contact us | **Na kontaktoni** | Translate 'Contact us'. |
| `partner.termsModalTitle` | Partner program terms | **Kushtet e programit të partneritetit** | Translate 'Partner program terms'. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Kushtet e programit nuk janë vendosur ende. Ju lutemi kontaktoni SuperAdmin.** | Translate 'Program terms are not set yet'. |
| `partner.loadError` | Failed to load partner data | **Dështoi të ngarkonte të dhënat e partneritetit** | Translate 'Failed to load partner data'. |
| `sip.trunkId` | ID e bagazhit | **ID e linjës telefonike** | 'Bagazhit' means 'luggage/car trunk', 'linjës telefonike' is correct for 'telephony trunk'. |
| `sip.createTrunk` | Krijo një bagazh | **Krijo një linjë telefonike** | 'Bagazh' means 'luggage/car trunk', 'linjë telefonike' is correct for 'telephony trunk'. |
| `sip.incoming.emptyHint` | zërin tuaj në kohë reale. | **zërin në kohë reale.** | Source 'голос' is general, not 'your voice'. |
| `sip.incoming.activeHint` | Përkthyesi i Bridge dëgjon dhomën. | **Përkthyesi urë dëgjon dhomën.** | 'Bridge' is a common noun, not a brand, so translate it. |
| `sip.incoming.pausedHint` | të ridrejtojë thirrjet hyrëse. | **të përkthejë thirrjet hyrëse.** | 'Ridrejtojë' means 'redirect', 'përkthejë' is 'translate'. |
| `sip.incoming.reissue` | Ribotim | **Riboto** | Use verb 'Riboto' (reissue) for a button, not noun 'Ribotim'. |
| `sip.outbound.lead` | do ta transferojë automatikisht bisedën tuaj | **do ta përkthejë automatikisht bisedën tuaj** | 'Transferojë' means 'transfer', 'përkthejë' is 'translate'. |
| `sip.outbound.noTrunkTitle` | trunk SIP dalës | **linjë telefonike SIP dalëse** | 'Trunk' is wrong word sense, use 'linjë telefonike'. |
| `sip.outbound.noTrunkHint` | Rrjeti i ri SIP | **Linjë telefonike e re SIP** | 'Rrjeti i ri SIP' means 'New SIP network', 'Linjë telefonike e re SIP' is correct for 'New SIP trunk'. |
| `sip.outbound.configureFirst` | trunk SIP dalës | **linjë telefonike SIP dalëse** | 'Trunk' is wrong word sense, use 'linjë telefonike'. |
| `sip.howTo.step1` | trunk-ut SIP | **linjës telefonike SIP** | 'Trunk' is wrong word sense, use 'linjë telefonike'. |
| `sip.howTo.step3` | trunk SIP dalës | **linjë telefonike SIP dalëse** | 'Trunk' is wrong word sense, use 'linjë telefonike'. |
| `sip.toasts.saved` | trunk-ut SIP | **linjës telefonike SIP** | 'Trunk' is wrong word sense, use 'linjë telefonike'. |
| `sip.toasts.saveFailed` | trungut | **linjës telefonike** | 'Trungut' means 'tree trunk', 'linjës telefonike' is correct for 'telephony trunk'. |
| `sip.toasts.deleted` | Trungu është fshirë. | **Linja telefonike është fshirë.** | 'Trungu' means 'tree trunk', 'linja telefonike' is correct for 'telephony trunk'. |
| `sip.toasts.deleteFailed` | trungut | **linjës telefonike** | 'Trungut' means 'tree trunk', 'linjës telefonike' is correct for 'telephony trunk'. |
| `sip.validation.loginRequired` | Ju lutem futni emrin tuaj të përdoruesit. Ju lutem futni emrin e përdoruesit. | **Ju lutem futni emrin tuaj të përdoruesit.** | Remove redundant sentence. |
| `sip.tenantOnly.title` | Trunk-et SIP | **Linjat telefonike SIP** | 'Trunk-et' is wrong word sense, use 'linjat telefonike'. |
| `sip.tenantOnly.hint2` | trunk | **linjë telefonike** | 'Trunk' is wrong word sense, use 'linjë telefonike'. |
| `sip.connected` | Trungu SIP | **Linja telefonike SIP** | 'Trungu' means 'tree trunk', 'linja telefonike' is correct for 'telephony trunk'. |
| `sip.danger.deleteTrunk` | Fshij trungun | **Fshij linjën telefonike** | 'Trungun' means 'tree trunk', 'linjën telefonike' is correct for 'telephony trunk'. |
| `sip.danger.deleteTrunkHint` | trunk-un | **linjën telefonike** | 'Trunk-un' is wrong word sense, use 'linjën telefonike'. |
| `sip.danger.reissueHint` | Ripërdorni hyrjen dhe fjalëkalimin | **Rigjenero hyrjen dhe fjalëkalimin** | 'Ripërdorni' means 'reuse', 'Rigjenero' is better for 'reissue'. |
| `sip.confirm.deleteTrunkTitle` | Të fshihet trunku SIP? | **Të fshihet linja telefonike SIP?** | 'Trunku' means 'tree trunk', 'linja telefonike' is correct for 'telephony trunk'. |
| `enterprise.page.upsellBody` | integrimin me botin Quest Flow + Telegram | **integrimin me botin Quest Flow + Telegram** | Preserve brand name 'Quest Flow'. |
| `enterprise.tabs.gemini` | API-ja e Gemini-t | **Gemini API** | Preserve brand name 'Gemini'. |
| `enterprise.tabs.questFlow` | Fluksi i Kërkimeve | **Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.gemini.heading` | Çelësi i API-t të Google Gemini | **Çelësi i Google Gemini API** | Preserve brand name 'Gemini API'. |
| `enterprise.gemini.lead` | Një çelës personal nga AI Studio. | **Një çelës personal nga AI Studio.** | Preserve brand name 'AI Studio'. |
| `enterprise.gemini.aiStudioLink` | Studioja e AI-së | **AI Studio** | Preserve brand name 'AI Studio'. |
| `enterprise.gemini.telegram.leadStartCmd` | /fillim | **/start** | Preserve command '/start' exactly. |
| `enterprise.gemini.telegram.successUnlinked` | Boti është i zgjidhur. | **Boti është i shkëputur.** | 'I zgjidhur' means 'solved/untied', 'i shkëputur' is better for 'unlinked/disconnected'. |
| `enterprise.gemini.telegram.testingLabel` | Helmetë… | **Duke dërguar…** | Clear error: 'Helmetë' means 'helmet', should be 'Duke dërguar...' (Sending...). |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Zgjidh | **Shkëput** | 'Zgjidh' means 'solve/untie', 'Shkëput' is better for 'unlink/disconnect'. |
| `enterprise.prompt.subtitle` | Njohuri dhe bazë njohurish për transkriptim vetëm në dhoma videoje | **Prompt dhe bazë njohurish për transkriptim vetëm në dhoma videoje** | Use 'Prompt' as a technical loanword instead of 'Njohuri' (knowledge). |
| `enterprise.prompt.promptLabel` | Njoftimi i sistemit (toni, stili, fjalori) | **Prompti i sistemit (toni, stili, fjalori)** | Use 'Prompti' as a technical loanword instead of 'Njoftimi' (notification). |
| `enterprise.prompt.savePrompt` | Ruaj promt | **Ruaj prompt** | Correct typo 'promt' to 'prompt'. |
| `enterprise.prompt.defaultLabel` | VibeVox parazgjedhur kërkesë | **Prompti i parazgjedhur i VibeVox** | Use 'Prompti' as a technical loanword instead of 'kërkesë' (request). |
| `enterprise.prompt.headerLeadBold2` | "Sipas kërkesës suaj" | **"Sipas promptit tuaj"** | Use 'promptit' as a technical loanword instead of 'kërkesës' (request). |
| `enterprise.prompt.contextLeadBold` | "Sipas kërkesës suaj" | **"Sipas promptit tuaj"** | Use 'promptit' as a technical loanword instead of 'kërkesës' (request). |
| `enterprise.prompt.extendNoteText` | kërkesën e parazgjedhur më sipër | **promptin e parazgjedhur më sipër** | Use 'promptin' as a technical loanword instead of 'kërkesën' (request). |
| `enterprise.prompt.promptPlaceholder` | Premtimi juaj... | **Prompti juaj...** | 'Premtimi' means 'promise', 'Prompti' is correct for 'prompt'. |
| `enterprise.prompt.savePromptLabel` | Ruaj promt | **Ruaj prompt** | Correct typo 'promt' to 'prompt'. |
| `enterprise.prompt.successPromptSaved` | Kërkesa u ruajt. | **Prompti u ruajt.** | Use 'Prompti' as a technical loanword instead of 'Kërkesa' (request). |
| `enterprise.prompt.kbCharsSuffix` | simbolet | **simbole** | Use indefinite plural 'simbole' (characters). |
| `enterprise.prompt.presetsLeadPart1` | Në bisedën e Enterprise Room | **Në bisedën e dhomës Enterprise** | Translate 'Enterprise Room' as 'dhoma Enterprise'. |
| `enterprise.prompt.presetsLeadBold` | "Sipas kërkesës suaj" | **"Sipas promptit tuaj"** | Use 'promptit' as a technical loanword instead of 'kërkesës' (request). |
| `enterprise.prompt.presetsLeadPart2` | përdor kërkesën tuaj nga fusha më sipër. | **përdor promptin tuaj nga fusha më sipër.** | Use 'promptin' as a technical loanword instead of 'kërkesën' (request). |
| `enterprise.questFlow.heading` | Fluksi i Kërkimeve | **Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.warning` | njoftimi i përgjithshëm i VibeVox. | **prompti i përgjithshëm i VibeVox.** | Use 'prompti' as a technical loanword instead of 'njoftimi' (notification). |
| `enterprise.questFlow.promptLabel` | Kërkesa e Sistemit të Fluksit të Kërkimit | **Prompti i Sistemit Quest Flow** | Use 'Prompti' as a technical loanword instead of 'Kërkesa' (request) and preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.kbLabel` | Baza e Njohurive të Quest Flow | **Baza e Njohurive Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.savePrompt` | Ruaj promt | **Ruaj prompt** | Correct typo 'promt' to 'prompt'. |
| `enterprise.questFlow.headerLead` | Telegram-bot të lidhur me Quest Flow. | **Telegram-bot të lidhur me Quest Flow.** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.keysHeading` | Çelësat e API-t të Quest Flow | **Çelësat e Quest Flow API** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.keysLead` | bllokun HTTP të Quest Flow të një zinxhiri. | **bllokun HTTP të Quest Flow të një zinxhiri.** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.keyLabelPlaceholder` | Klinikë robotësh prodhimi | **Bot prodhimi i klinikës** | More natural phrasing for the example. |
| `enterprise.questFlow.errDelete` | Delete error | **Gabim fshirjeje** | Translate 'Delete error'. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Të fshihet çelësi?** | Translate 'Delete key?'. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Çelësi do të fshihet përgjithmonë. Quest Flow nuk do të funksionojë më përmes tij — do të duhet të krijoni një çelës të ri dhe ta zëvendësoni në rrjedhë.** | Translate the sentence and preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Fshij** | Translate 'Delete'. |
| `enterprise.questFlow.neverUsed` | nuk përdoret | **nuk është përdorur** | Use past tense 'nuk është përdorur' (has not been used). |
| `enterprise.questFlow.promptHeading` | Nxitje për biseda në Telegram | **Prompt për biseda në Telegram** | Use 'Prompt' as a technical loanword instead of 'Nxitje' (incentive). |
| `enterprise.questFlow.promptLead1` | klientët përmes Quest Flow | **klientët përmes Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.promptLead2` | kërkesa e përgjithshme e VibeVox | **prompti i përgjithshëm i VibeVox** | Use 'prompti' as a technical loanword instead of 'kërkesa' (request). |
| `enterprise.questFlow.promptLead3` | informacionin bazë dhe bazën e njohurive. | **promptin bazë dhe bazën e njohurive.** | Use 'promptin' as a technical loanword instead of 'informacionin bazë' (basic information). |
| `enterprise.questFlow.promptPlaceholder` | Premtimi juaj... | **Prompti juaj...** | 'Premtimi' means 'promise', 'Prompti' is correct for 'prompt'. |
| `enterprise.questFlow.successPromptSaved` | Kërkesa e Fluksit të Kërkimit u ruajt. | **Prompti Quest Flow u ruajt.** | Use 'Prompti' as a technical loanword instead of 'Kërkesa' (request) and preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.kbLeadBold2` | i ndarë | **e ndarë** | Correct gender agreement for 'baza' (feminine). |
| `enterprise.questFlow.kbCharsSuffix` | simbolet | **simbole** | Use indefinite plural 'simbole' (characters). |
| `enterprise.questFlow.confirmKbDeleteBody` | Baza e njohurive të Quest Flow do të pastrohet. | **Baza e njohurive Quest Flow do të pastrohet.** | Preserve brand name 'Quest Flow'. |
| `enterprise.chatwoot.tokenLabel` | Agjent API token | **Tokeni API i agjentit** | Translate English phrase 'Agent API token'. |
| `enterprise.chatwoot.statusActive` | Aktiv | **Aktive** | Correct gender agreement for 'status' (feminine). |
| `enterprise.chatwoot.statusDisabled` | I fikur | **E fikur** | Correct gender agreement for 'status' (feminine). |
| `enterprise.chatwoot.tokenPlaceholder` | Simboli i aksesit të agjentit | **Tokeni i aksesit të agjentit** | 'Simboli' means 'symbol', 'Tokeni' is better for 'token'. |
| `chat.enterpriseOnlyHint` | Dhomat e bisedave janë një veçori | **Dhoma e bisedës është një veçori** | Source 'Чат комнаты' is singular, not plural. |
| `insights.recalc` | Rinumërim | **Rillogarit** | 'Rinumërim' means 'recount', 'Rillogarit' is better for 'recalculate'. |
| `insights.sentiment` | Çelësi | **Tonaliteti** | 'Çelësi' means 'key', 'Tonaliteti' is better for 'sentiment/tonality'. |
| `insights.leadScore` | Rezultati kryesor | **Lead Score** | Preserve 'Lead Score' as per known failure modes. |
| `insights.analyzedReplies_few` | {{count}} kopjet e analizuara | **{{count}} replika të analizuara** | 'Kopjet' means 'copies', 'replika' is correct for 'replies'. |
| `insights.analyzedReplies_many` | {{count}} kopjet e analizuara | **{{count}} replika të analizuara** | 'Kopjet' means 'copies', 'replika' is correct for 'replies'. |
| `insights.analyzedReplies_other` | {{count}} kopjet e analizuara | **{{count}} replika të analizuara** | 'Kopjet' means 'copies', 'replika' is correct for 'replies'. |
| `postCallInsights.metricSentiment` | Gjendja shpirtërore | **Sentiment** | 'Gjendja shpirtërore' means 'mood', 'Sentiment' is better as a loanword. |
| `postCallInsights.metricLeadScore` | Rezultati kryesor | **Lead Score** | Preserve 'Lead Score' as per known failure modes. |
| `lobby.andWord` | Dhe | ** dhe ** | Correct spacing for conjunction 'dhe' (and). |
| `paywall.subtitle` | rimbursoni menjëherë këtu. | **dhe do të ktheheni menjëherë këtu.** | Improve phrasing for 'return immediately here'. |
| `paywall.subscribe` | Dizajn | **Abonohu** | 'Dizajn' means 'design', 'Abonohu' is correct for 'subscribe'. |
| `paywall.featureHd` | Trajner i IA-së | **AI Coach** | Preserve brand name 'AI Coach'. |
| `billingPage.tierLabel` | Vlerëso | **Tarifë** | 'Vlerëso' means 'evaluate', 'Tarifë' is correct for 'tariff/plan'. |
| `billingPage.resume` | Rezyme | **Rifillo** | 'Rezyme' means 'resume' (noun), 'Rifillo' is correct for 'resume' (verb). |
| `billingPage.featureLearnHub` | Qendra e Mësimit të IA-së — dialektet e veta | **AI Learning Hub — dialektet e veta** | Preserve brand name 'AI Learning Hub'. |
| `billingPage.featurePersonalPrompts` | Nxitje personale të inteligjencës artificiale | **Promptet personale të IA-së** | Use 'Promptet' as a technical loanword instead of 'Nxitje' (incentive). |
| `billingPage.ctaSubscribePlus` | Merr Plus | **Abonohu në Plus** | 'Merr' means 'take', 'Abonohu në' is correct for 'subscribe to'. |
| `billingPage.ctaSubscribeStandard` | Porosit Standard | **Abonohu në Standard** | 'Porosit' means 'order', 'Abonohu në' is correct for 'subscribe to'. |
| `billingPage.ctaContact` | Kontakti | **Kontakto** | Use verb 'Kontakto' (Contact) for a button, not noun 'Kontakti'. |
| `billingPage.languagesCount_one` | gjuhë {{count}} | **{{count}} gjuhë** | Correct word order for plural count. |
| `billingPage.languagesCount_few` | gjuhë {{count}} | **{{count}} gjuhë** | Correct word order for plural count. |
| `billingPage.languagesCount_many` | gjuhët {{count}} | **{{count}} gjuhë** | Remove definite article and correct word order for plural count. |
| `billingPage.languagesCount_other` | gjuhët {{count}} | **{{count}} gjuhë** | Remove definite article and correct word order for plural count. |
| `billingPage.faqA3` | kërkesa të personalizuara | **promptet personale** | Use 'promptet' as a technical loanword instead of 'kërkesa' (request). |
| `billingPage.faqA4` | Çdo pjatë që përputhet me RFC | **Çdo ofrues i pajtueshëm me RFC** | 'Pjatë' means 'plate', 'ofrues' is correct for 'provider'. |
| `billingPage.faqA4` | trunk dalës | **linjë telefonike dalëse** | 'Trunk' is wrong word sense, use 'linjë telefonike'. |
| `billingPage.renewsOn` | zgjatim {{date}} | **rinovim {{date}}** | 'Zgjatim' means 'extension', 'rinovim' is correct for 'renewal'. |
| `auth.login.submit` | Hyrje | **Hyr** | Use verb 'Hyr' (Enter) for a button, not noun 'Hyrje'. |
| `auth.register.loginLink` | Hyrje | **Hyr** | Use verb 'Hyr' (Enter) for a link, not noun 'Hyrje'. |
| `auth.register.agreementAnd` | Dhe | ** dhe ** | Correct spacing for conjunction 'dhe' (and). |

⚠ 11 fix(es) skipped (no-op, missing path, or would break placeholders).
