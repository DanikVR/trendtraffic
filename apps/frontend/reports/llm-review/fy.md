# LLM Review: Frisian (fy)

**Model:** gemini-2.5-flash  
**Took:** 156.5s  
**Fixes proposed:** 68 (valid after placeholder-check: 68)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.enterpriseSettings` | Bedriuwsynstellingen | **Enterprise-ynstellingen** | 'Enterprise' is a brand/tier name and should be preserved. |
| `rooms.actions.open` | Oanmelde | **Yngean** | 'Oanmelde' means 'log in'; 'Yngean' means 'enter/join'. |
| `common.back` | Rêch | **Werom** | 'Rêch' means body part; 'Werom' means 'back' (direction). |
| `common.edit` | Feroaring | **Bewurkje** | 'Feroaring' is a noun; 'Bewurkje' means 'edit' (verb). |
| `tier.enterprise` | Bedriuw | **Enterprise** | 'Enterprise' is a brand/tier name and should be preserved. |
| `moreSheet.enterprise.label` | Bedriuwsynstellingen | **Enterprise-ynstellingen** | 'Enterprise' is a brand/tier name and should be preserved. |
| `call.autoAI` | Auto (KI) | **Auto (AI)** | 'AI' is a preserved term. |
| `call.toPlayground` | 🎯 Nei de stoartplak | **🎯 Nei it trainingsfjild** | 'Stoartplak' means dump/landfill; 'trainingsfjild' means training ground. |
| `call.more` | Derneist | **Mear** | 'Derneist' means 'in addition'; 'Mear' means 'more'. |
| `call.validating` | Testen fan feilige ferbining fan VibeVox… | **Kontrolearje feilige ferbining fan VibeVox…** | 'Testen' means testing; 'Kontrolearje' means checking/validating. |
| `call.translatorJoining` | In AI-oersetter lansearje… | **In AI-oersetter starte…** | 'AI' is a preserved term. 'Starte' is a more direct translation for 'launch'. |
| `coach.help` | Help antwurd | **Help mei antwurdzjen** | Grammatically more natural phrasing. |
| `coach.title` | AI-assistint: Hoe te antwurdzjen | **AI-assistint: Hoe antwurdzje** | 'AI' is a preserved term. Shorter and natural phrasing. |
| `coach.pin` | Pin it fêst | **Fêstpinne** | Button label too long; 'Fêstpinne' is shorter and a verb. |
| `partner.title` | Partner program | **Partnerprogramma** | English term not translated. |
| `partner.subtitle` | Share your link and earn | **Diel jo keppeling en fertsjinje** | English term not translated. |
| `partner.yourLink` | Your link | **Jo keppeling** | English term not translated. |
| `partner.copy` | Copy | **Kopiearje** | English term not translated. |
| `partner.copied` | ✓ Link copied | **✓ Keppeling kopiearre** | English term not translated. |
| `partner.stats.clicks` | Clicks | **Kliks** | English term not translated. |
| `partner.stats.registrations` | Sign-ups | **Registraasjes** | English term not translated. |
| `partner.stats.paid` | Payments | **Betellingen** | English term not translated. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} brûkers · {{minutes}} min** | English term 'users' not translated. |
| `partner.terms` | Program terms | **Programbetingsten** | English term not translated. |
| `partner.contact` | Contact us | **Nim kontakt mei ús op** | English term not translated. |
| `partner.termsModalTitle` | Partner program terms | **Betingsten fan it partnerprogramma** | English term not translated. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Programbetingsten binne noch net ynsteld. Nim dan kontakt op mei SuperAdmin.** | English terms not translated. |
| `partner.loadError` | Failed to load partner data | **Koe partnergegevens net lade** | English terms not translated. |
| `sip.editTrunk` | Feroarje de ynstellings foar de kofferbak | **Feroarje de SIP-trunk ynstellings** | Wrong word sense for 'trunk'. 'kofferbak' means car trunk. |
| `sip.createTrunk` | Meitsje in kofferbak | **Meitsje in SIP-trunk** | Wrong word sense for 'trunk'. 'kofferbak' means car trunk. |
| `sip.deletingShort` | Wiske… | **Wiskje…** | Wrong tense, should be present continuous. |
| `sip.incoming.pausedHint` | Aktivearje de resepsje om VibeVox ynkommende oproppen troch te stjoeren te litten. | **Aktivearje de resepsje om VibeVox ynkommende oproppen oersette te litten.** | Awkward phrasing, 'trochstjoere' (forward) is not 'translate'. |
| `sip.toasts.deleted` | De romp is wiske. | **De trunk is wiske.** | Wrong word sense for 'trunk'. 'romp' means hull/torso. |
| `enterprise.page.title` | Bedriuwsynstellingen | **Enterprise-ynstellingen** | 'Enterprise' is a brand/tier name and should be preserved. |
| `enterprise.gemini.confirmDeleteBody` | KI-funksjes sille de dielde kaai fan VibeVox brûke (as konfigurearre). | **AI-funksjes sille de dielde kaai fan VibeVox brûke (as konfigurearre).** | 'AI' is a preserved term. |
| `enterprise.gemini.telegram.testingLabel` | Helm… | **Stjoere…** | Wrong word sense. 'Helm' means helmet. |
| `enterprise.gemini.telegram.lastBroadcast` | Lêste post: bezorge {{sent}} fan {{total}} | **Lêste útstjoering: bezorge {{sent}} fan {{total}}** | 'Post' is wrong word sense for 'broadcast/mailing'. |
| `enterprise.prompt.headerLeadBold2` | "Neffens jo fersyk" | **"Neffens jo prompt"** | 'Fersyk' is wrong word sense for 'prompt'. |
| `enterprise.prompt.contextLeadBold` | "Neffens jo fersyk" | **"Neffens jo prompt"** | 'Fersyk' is wrong word sense for 'prompt'. |
| `enterprise.prompt.presetsLeadBold` | "Neffens jo fersyk" | **"Neffens jo prompt"** | 'Fersyk' is wrong word sense for 'prompt'. |
| `enterprise.questFlow.tagsLabel` | Benodigdheden foar tags | **Tags foar behoeften** | 'Benodigdheden' is not the best translation for 'needs'. |
| `enterprise.questFlow.errCreate` | Meitsjen fan in flater | **Flater by it oanmeitsjen** | Grammatically incorrect phrasing. |
| `enterprise.questFlow.errDelete` | Delete error | **Wiskeflater** | English term not translated. |
| `enterprise.questFlow.usedOn` | brûkte {{date}} | **brûkt op {{date}}** | Grammatical improvement. |
| `enterprise.questFlow.deleteTitle` | Delete | **Wiskje** | English term not translated. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Kaai wiskje?** | English term not translated. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **De kaai wurdt permanint wiske. Quest Flow sil der net mear troch wurkje — jo moatte in nije kaai oanmeitsje en dy yn 'e stream ferfange.** | English terms not translated. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Wiskje** | English term not translated. |
| `enterprise.questFlow.promptHeading` | Freegje om Telegram-petearen | **Prompt foar Telegram-petearen** | 'Freegje' is wrong word sense for 'prompt'. |
| `enterprise.questFlow.promptLeadBold2` | As jo jo ynfolje | **As jo jo eigen ynfolje** | Grammatically incomplete phrase. |
| `enterprise.questFlow.tagsHeading` | Benodigdheden foar tags | **Tags foar behoeften** | 'Benodigdheden' is not the best translation for 'needs'. |
| `chat.deletingShort` | Wiske… | **Wiskje…** | Wrong tense, should be present continuous. |
| `insights.summary` | CV | **Gearfetting** | 'CV' means curriculum vitae; 'Gearfetting' means summary. |
| `insights.sentiment` | Kaai | **Toan** | Wrong word sense. 'Kaai' means key; 'Toan' means tone/sentiment. |
| `insights.engagement` | Ferloving | **Betrokkenheid** | Wrong word sense. 'Ferloving' means marriage engagement; 'Betrokkenheid' means involvement. |
| `paywall.subscribe` | Ûntwerp | **Abonnearje** | Wrong word sense. 'Ûntwerp' means design/draft; 'Abonnearje' means subscribe. |
| `postCallInsights.subtitle` | Bedriuw · ynsjoch nei it petear | **Enterprise · ynsjoch nei it petear** | 'Enterprise' is a brand/tier name and should be preserved. |
| `postCallInsights.analyzing` | Litte wy it petear analysearje ... | **Wy analysearje it petear...** | 'Litte wy' means 'let's'; should be 'We are analyzing...'. |
| `postCallInsights.metricEngagement` | Ferloving | **Betrokkenheid** | Wrong word sense. 'Ferloving' means marriage engagement; 'Betrokkenheid' means involvement. |
| `postCallInsights.summary` | CV | **Gearfetting** | 'CV' means curriculum vitae; 'Gearfetting' means summary. |
| `billingPage.resume` | CV | **Wer oppakke** | 'CV' means curriculum vitae; 'Wer oppakke' means resume/renew. |
| `billingPage.topupCarried` | Útsteld | **Oerdroegen** | Wrong word sense. 'Útsteld' means postponed; 'Oerdroegen' means carried over. |
| `billingPage.tierEnterpriseName` | Bedriuw | **Enterprise** | 'Enterprise' is a brand/tier name and should be preserved. |
| `billingPage.ctaSubscribePlus` | Krij Plus | **Abonnearje op Plus** | 'Krij' means get; 'Abonnearje op' means subscribe to. |
| `billingPage.ctaSubscribeStandard` | Bestelstandert | **Abonnearje op Standard** | 'Bestel' means order; 'Abonnearje op' means subscribe to. |
| `billingPage.renewsOn` | útwreiding {{date}} | **fernijing {{date}}** | Wrong word sense. 'útwreiding' means extension; 'fernijing' means renewal. |
| `auth.login.registerLink` | Register | **Registrearje** | English term not translated. |
| `auth.register.submit` | Register | **Registrearje** | English term not translated. |
