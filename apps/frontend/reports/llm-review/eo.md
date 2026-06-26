# LLM Review: Esperanto (eo)

**Model:** gemini-2.5-flash  
**Took:** 186.1s  
**Fixes proposed:** 56 (valid after placeholder-check: 56)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.subtitle` | Viaj aktivaj samtempaj interpretadaj sesioj | **Viaj aktivaj samtempaj traduksesioj** | Interpretado implies human interpretation, tradukado is for AI/machine translation. |
| `rooms.tryAnother` | Provu alian demandon | **Provu alian serĉvorton** | Demando means question, serĉvorto is more appropriate for search query. |
| `common.edit` | Ŝanĝi | **Redakti** | Ŝanĝi means 'to change', Redakti means 'to edit'. |
| `tier.standard` | Normo | **Standard** | Standard is a tier name and should be preserved. |
| `tier.standardYearly` | Ĉiujare | **Yearly** | Yearly is a tier name and should be preserved. |
| `tier.enterprise` | Entrepreno | **Enterprise** | Enterprise is a tier name and should be preserved. |
| `languagePicker.searchPlaceholder` | Serĉante lingvon... | **Serĉi lingvon...** | Serĉi (infinitive) is more common for placeholder text than Serĉante (participle). |
| `settings.editName` | Ŝanĝi nomon | **Redakti nomon** | Ŝanĝi means 'to change', Redakti means 'to edit'. |
| `partner.title` | Partner program | **Partnera programo** | Not a brand name; should be translated. |
| `partner.subtitle` | Share your link and earn | **Kunhavigu vian ligilon kaj gajnu** | Not a brand name; should be translated. |
| `partner.yourLink` | Your link | **Via ligilo** | Not a brand name; should be translated. |
| `partner.copy` | Copy | **Kopii** | Not a brand name; should be translated. |
| `partner.copied` | ✓ Link copied | **✓ Ligilo kopiita** | Not a brand name; should be translated. |
| `partner.stats.clicks` | Clicks | **Alklakoj** | Not a brand name; should be translated. |
| `partner.stats.registrations` | Sign-ups | **Registriĝoj** | Not a brand name; should be translated. |
| `partner.stats.paid` | Payments | **Pagoj** | Not a brand name; should be translated. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} uzantoj · {{minutes}} min** | Users should be translated to uzantoj. |
| `partner.terms` | Program terms | **Programaj kondiĉoj** | Not a brand name; should be translated. |
| `partner.contact` | Contact us | **Kontaktu nin** | Not a brand name; should be translated. |
| `partner.termsModalTitle` | Partner program terms | **Kondiĉoj de partnera programo** | Not a brand name; should be translated. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Programaj kondiĉoj ankoraŭ ne estas agorditaj. Bonvolu kontakti SuperAdmin.** | Not a brand name; should be translated. |
| `partner.loadError` | Failed to load partner data | **Malsukcesis ŝargi partnerajn datumojn** | Not a brand name; should be translated. |
| `sip.editTrunk` | Ŝanĝi trunkajn agordojn | **Redakti trunkajn agordojn** | Ŝanĝi means 'to change', Redakti means 'to edit'. |
| `sip.incoming.emptyHint` | Kreu unikan SIP URI + ensaluton/pasvorton, por ke klientoj povu telefoni al vi de iu ajn telefono, kaj VibeVox aŭtomate tradukos vian voĉon en reala tempo. | **Kreu unikan SIP URI + ensaluton/pasvorton, por ke klientoj povu telefoni al vi de iu ajn telefono, kaj VibeVox aŭtomate tradukos la voĉon en reala tempo.** | Vian (your) is not in the source text. |
| `sip.outbound.lead` | Voku telefonnumeron per la TTT-interfaco kaj VibeVox aŭtomate tradukos vian konversacion en reala tempo. | **Voku telefonnumeron per la TTT-interfaco kaj VibeVox aŭtomate tradukos la konversacion en reala tempo.** | Vian (your) is not in the source text. |
| `sip.validation.loginRequired` | Bonvolu enigi vian uzantnomon | **Enigu uzantnomon** | Shorter and more direct for a validation message. 'Vian' (your) is not in source. |
| `sip.validation.passwordRequired` | Enigu vian pasvorton | **Enigu pasvorton** | Vian (your) is not in the source text. |
| `enterprise.gemini.errEnterKey` | Enigu vian Gemini API-ŝlosilon | **Enigu Gemini API-ŝlosilon** | Vian (your) is not in the source text. |
| `enterprise.gemini.telegram.lead` | Kreu roboton kun @BotFather kaj algluu ĝian ĵetonon. Ĉiu, kiu mesaĝos al ĉi tiu roboto per /start, ricevos sciigojn: novaj klientoj, etikedoj, integriĝaj eraroj. Vi povas aboni plurajn dungitojn aŭ aldoni la roboton al grupo aŭ kanalo — la sciigoj estos senditaj al ĉiuj aŭtomate. | **Kreu roboton ĉe @BotFather kaj algluu ĝian ĵetonon. Ĉiu, kiu mesaĝos al ĉi tiu roboto per /start, ricevos sciigojn: novaj klientoj, etikedoj, integriĝaj eraroj. Vi povas aboni plurajn dungitojn aŭ aldoni la roboton al grupo aŭ kanalo — la sciigoj estos senditaj al ĉiuj aŭtomate.** | Ĉe (at) is more appropriate for 'у @BotFather' than kun (with). |
| `enterprise.gemini.telegram.successSavedWithBroadcast` | ✓ Roboto @{{username}} konservita. Saluto sendita al abonantoj de {{sent}}. | **✓ Roboto @{{username}} konservita. Saluto sendita al {{sent}} abonantoj.** | Grammatical correction for number and noun order. |
| `enterprise.gemini.telegram.successSavedNoBroadcast` | ✓ Roboto @{{username}} estis konservita. Ĉiu, kiu sendos al ĝi tekstmesaĝon /start, ricevos sciigojn. | **✓ Roboto @{{username}} estis konservita. Ĉiu, kiu sendos al ĝi /start, ricevos sciigojn.** | Tekstmesaĝon is an unnecessary addition not present in the source. |
| `enterprise.gemini.telegram.successTestMany` | ✓ Mesaĝo liverita al {{count}} ricevantoj. Bonvolu kontroli Telegram. | **✓ Mesaĝo liverita al {{count}} ricevantoj. Kontrolu Telegram.** | Bonvolu (please) is not in the source. |
| `enterprise.gemini.telegram.lastBroadcast` | Plej lasta dissendo: liverita {{sent}} de {{total}} | **Plej lasta dissendo: liverita {{sent}} el {{total}}** | El (out of) is more appropriate than de (of) in this context. |
| `enterprise.prompt.subtitle` | Instigo kaj sciobazo por transskribo nur en videoĉambroj | **Prompto kaj sciobazo nur por transskribo en videoĉambroj** | Instigo is wrong word sense for prompt. Prompto should be preserved. |
| `enterprise.prompt.appendNote` | Vi povas aldoni viajn proprajn regulojn - ili estos kombinitaj kun la defaŭltaj. | **Vi povas aldoni viajn proprajn regulojn - ili estos kombinitaj kun la defaŭlta.** | Grammatical agreement: defaŭlta (singular) for defaŭlta prompto. |
| `enterprise.prompt.headerLeadBold1` | nur por malĉifri mesaĝojn en videoĉambroj | **nur por transskribi mesaĝojn en videoĉambroj** | Malĉifri means 'to decipher', transskribi means 'to transcribe'. |
| `enterprise.questFlow.promptLabel` | Quest Flow Sistemo Prompto | **Quest Flow Sistema Prompto** | Grammatical correction: Sistema (adjective) should modify Prompto. |
| `enterprise.questFlow.savePrompt` | Konservi promeson | **Konservi prompton** | Promeson means 'promise', should be 'prompton' (preserved brand/term). |
| `enterprise.questFlow.keyLabelPlaceholder` | Etikedo (nedeviga), ekzemple: "Prod bot kliniki" | **Etikedo (nedeviga), ekzemple: "Produkta roboto de kliniko"** | Example text should be translated to Esperanto. |
| `enterprise.questFlow.errDelete` | Delete error | **Foriga eraro** | Not a brand name; should be translated. |
| `enterprise.questFlow.deleteTitle` | Delete | **Forigi** | Not a brand name; should be translated. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Ĉu forigi ŝlosilon?** | Not a brand name; should be translated. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **La ŝlosilo estos forigita porĉiame. Quest Flow ĉesos funkcii per ĝi — vi devos krei novan ŝlosilon kaj anstataŭigi ĝin en la ĉeno.** | Not a brand name; should be translated. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Forigi** | Not a brand name; should be translated. |
| `enterprise.questFlow.promptLeadBold2` | Se vi plenigas vian | **Se vi plenigas propran** | Vian (your) is not in the source. Propran (own) is more accurate. |
| `enterprise.chatwoot.whatSentItem2` | Conversation kun privata noto = plena dialoghistorio | **Konversacio kun privata noto = plena dialoghistorio** | Conversation is English, should be translated to Konversacio. |
| `postCallInsights.subtitle` | Enterprise · post-call insights | **Enterprise · postvokaj analizoj** | Post-call insights is not a brand name; should be translated. |
| `postCallInsights.analyzing` | Ni analizu la konversacion... | **Ni analizas la konversacion...** | Ni analizu is imperative ('Let's analyze'), Ni analizas is present tense ('We are analyzing'). |
| `paywall.buyStandard` | Norma – €29/monate (120 min) | **Standard – €29/monate (120 min)** | Standard is a tier name and should be preserved. |
| `billingPage.tierEnterpriseName` | Entrepreno | **Enterprise** | Enterprise is a tier name and should be preserved. |
| `billingPage.featureLearnHub` | AI Learning Hub — ĝiaj propraj dialektoj | **AI Lernocentro — propraj dialektoj** | AI Learning Hub should be translated. Ĝiaj (its) is not in the source. |
| `pwaInstall.buttonSubtitle` | Iru al la ĉefa ekrano - lanĉu per unu tuŝo | **Al la ĉefekrano — lanĉu per unu tuŝo** | Al la ĉefekrano is a more direct translation of 'На главный экран'. |
| `auth.common.passwordPlaceholder` | Enigu vian pasvorton | **Enigu pasvorton** | Vian (your) is not in the source. |
| `auth.common.passwordRepeatPlaceholder` | Bonvolu enigi vian pasvorton denove | **Enigu pasvorton denove** | Bonvolu (please) and vian (your) are not in the source. |
| `auth.login.networkError` | Reta eraro - bonvolu provi denove | **Reta eraro - provu denove** | Bonvolu (please) is not in the source. |
| `auth.forgot.emailRequired` | Enigu vian retpoŝtadreson | **Enigu retpoŝtadreson** | Vian (your) is not in the source. |
