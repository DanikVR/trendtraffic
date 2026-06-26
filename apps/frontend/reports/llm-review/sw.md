# LLM Review: Swahili (sw)

**Model:** gemini-2.5-flash  
**Took:** 240.0s  
**Fixes proposed:** 49 (valid after placeholder-check: 49)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.enterpriseSettings` | Mipangilio ya Biashara | **Mipangilio ya Enterprise** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `balance.minutes` | {{count}} min | **{{count}} dakika** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `balance.minutesShort` | min | **dakika** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `tier.trial` | Trial | **Jaribio** | The word 'Trial' in subscription context means 'free trial period', not legal trial. |
| `tier.enterprise` | Biashara | **Enterprise** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `moreSheet.enterprise.label` | Mipangilio ya Biashara | **Mipangilio ya Enterprise** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `billing.lowBalance` | Zimesalia {{n}} min za tafsiri | **Zimesalia {{n}} dakika za tafsiri** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `billing.topupCta` | min · €{{price}} | **dakika · €{{price}}** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `partner.title` | Partner program | **Mpango wa Ushirikiano** | English phrase 'Partner program' should be translated to Swahili. |
| `partner.subtitle` | Share your link and earn | **Shiriki kiungo chako na upate mapato** | English phrase should be translated to Swahili. |
| `partner.yourLink` | Your link | **Kiungo chako** | English phrase should be translated to Swahili. |
| `partner.copy` | Copy | **Nakili** | English word 'Copy' should be translated to Swahili. |
| `partner.copied` | ✓ Link copied | **✓ Kiungo kimenakiliwa** | English phrase should be translated to Swahili. |
| `partner.stats.clicks` | Clicks | **Mibofyo** | English word 'Clicks' should be translated to Swahili. |
| `partner.stats.registrations` | Sign-ups | **Usajili** | English word 'Sign-ups' should be translated to Swahili. |
| `partner.stats.paid` | Payments | **Malipo** | English word 'Payments' should be translated to Swahili. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} watumiaji · {{minutes}} dakika** | English words 'users' and 'min' should be translated to Swahili. |
| `partner.terms` | Program terms | **Masharti ya programu** | English phrase 'Program terms' should be translated to Swahili. |
| `partner.contact` | Contact us | **Wasiliana nasi** | English phrase 'Contact us' should be translated to Swahili. |
| `partner.termsModalTitle` | Partner program terms | **Masharti ya programu ya ushirikiano** | English phrase 'Partner program terms' should be translated to Swahili. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Masharti ya programu bado hayajawekwa. Tafadhali wasiliana na SuperAdmin.** | English sentence should be translated to Swahili. |
| `partner.loadError` | Failed to load partner data | **Imeshindwa kupakia data ya ushirikiano** | English phrase should be translated to Swahili. |
| `enterprise.page.title` | Mipangilio ya Biashara | **Mipangilio ya Enterprise** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `enterprise.page.upsellTitle` | Sehemu hii inapatikana kwenye mpango wa Biashara. | **Sehemu hii inapatikana kwenye mpango wa Enterprise.** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `enterprise.prompt.presetsLeadPart1` | Kitufe | **Katika chumba cha Enterprise, utaweza kuchagua ujumbe wowote na kumwomba AI aueleze kwa sauti iliyochaguliwa. Kitufe** | Incomplete translation; missing the first part of the sentence. Also, 'Enterprise' should be preserved. |
| `enterprise.questFlow.errDelete` | Delete error | **Hitilafu ya kufuta** | English phrase 'Delete error' should be translated to Swahili. |
| `enterprise.questFlow.deleteTitle` | Delete | **Futa** | English word 'Delete' should be translated to Swahili. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Futa ufunguo?** | English phrase 'Delete key?' should be translated to Swahili. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Ufunguo utafutwa kabisa. Quest Flow haitafanya kazi tena kupitia huo — utahitaji kuunda ufunguo mpya na kuubadilisha kwenye mnyororo.** | English sentence should be translated to Swahili. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Futa** | English word 'Delete' should be translated to Swahili. |
| `enterprise.questFlow.savePromptLabel` | Hifadhi kidokezo | **Hifadhi** | Button label should be short; 'Hifadhi' (Save) is sufficient. |
| `chat.enterpriseOnlyHint` | Vyumba vya gumzo ni kipengele cha Biashara. Boresha mpango wako katika sehemu ya "Mipango". | **Vyumba vya gumzo ni kipengele cha Enterprise. Boresha mpango wako katika sehemu ya "Mipango".** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `postCallInsights.subtitle` | Biashara · maarifa ya baada ya simu | **Enterprise · maarifa ya baada ya simu** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `paywall.buyPlus` | Plus — €19/mwezi (60 min) | **Plus — €19/mwezi (60 dakika)** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `paywall.buyStandard` | Standard — €29/mwezi (120 min) | **Standard — €29/mwezi (120 dakika)** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `paywall.topupPerMin` | €0.17 / min | **€0.17 / dakika** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `paywall.topupCta` | Nunua {{count}} min · €{{price}} | **Nunua {{count}} dakika · €{{price}}** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `paywall.topupNoSubInfo` | ℹ Huna usajili unaoendelea. Plus itaongezwa kwenye ununuzi wako kwa €19/mwezi—60 min zimejumuishwa kwenye mpango wako, kwa hivyo hakuna malipo ya ziada. | **ℹ Huna usajili unaoendelea. Plus itaongezwa kwenye ununuzi wako kwa €19/mwezi—60 dakika zimejumuishwa kwenye mpango wako, kwa hivyo hakuna malipo ya ziada.** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `paywall.topupPlusLine` | Mpango Plus ({{count}} min imejumuishwa) | **Mpango Plus ({{count}} dakika zimejumuishwa)** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `paywall.topupFreeLine` | ↳ {{count}} min bila malipo na mpango | **↳ {{count}} dakika bila malipo na mpango** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `paywall.topupAddon` | Ununuzi wa ziada {{count}} min × €0.17 | **Ununuzi wa ziada {{count}} dakika × €0.17** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `billingPage.minutesShort` | min | **dakika** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `billingPage.tierEnterpriseName` | Biashara | **Enterprise** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `billingPage.tierPlusPrice` | €0.31 / min | **€0.31 / dakika** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `billingPage.tierStandardPrice` | €0.24 / min | **€0.24 / dakika** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `billingPage.faqQ3` | Biashara inajumuisha nini? | **Enterprise inajumuisha nini?** | Brand/tier name 'Enterprise' should be preserved, not translated. |
| `billingPage.topupSliderMax` | {{max}} min (saa 10) | **{{max}} dakika (saa 10)** | Translate 'min' (minutes) to Swahili 'dakika'. |
| `billingPage.presetHours` | {{count}}h | **{{count}} saa** | Translate 'h' (hours) to Swahili 'saa'. |
| `billingPage.presetMinutes` | {{count}}m | **{{count}} dakika** | Translate 'm' (minutes) to Swahili 'dakika'. |
