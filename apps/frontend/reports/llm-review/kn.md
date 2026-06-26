# LLM Review: Kannada (kn)

**Model:** gemini-2.5-flash  
**Took:** 175.7s  
**Fixes proposed:** 60 (valid after placeholder-check: 59)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.actions.open` | ಲಾಗಿನ್ ಮಾಡಿ | **ಪ್ರವೇಶಿಸಿ** | Wrong word sense: 'Войти' means 'Enter' (a room), not 'Login'. |
| `common.search` | ಹುಡುಕಿ Kannada | **ಹುಡುಕಿ** | Extra word 'Kannada' appended. |
| `common.open` | ತೆರೆದ | **ತೆರೆಯಿರಿ** | Incorrect verb form; should be imperative 'Open'. |
| `common.edit` | ಬದಲಾವಣೆ | **ಬದಲಾಯಿಸಿ** | Incorrect part of speech; noun 'change' instead of verb 'change/edit'. |
| `balance.openPlans` | ಮುಕ್ತ ಸುಂಕಗಳು ಮತ್ತು ಸಮತೋಲನ | **ಸುಂಕಗಳು ಮತ್ತು ಸಮತೋಲನವನ್ನು ತೆರೆಯಿರಿ** | Incorrect word choice; adjective 'open' instead of verb 'open'. |
| `tier.trial` | ವಿಚಾರಣೆ | **ಪ್ರಾಯೋಗಿಕ** | Wrong word sense: 'Trial' as legal trial instead of subscription trial period. |
| `tier.plus` | ಜೊತೆಗೆ | **Plus** | Brand name 'Plus' should be preserved, not translated. |
| `tier.standard` | ಪ್ರಮಾಣಿತ | **Standard** | Brand name 'Standard' should be preserved, not translated. |
| `tier.standardYearly` | ವಾರ್ಷಿಕ | **Yearly** | Brand name 'Yearly' should be preserved, not translated. |
| `call.toPlayground` | 🎯 ಭೂಕುಸಿತಕ್ಕೆ | **🎯 ತರಬೇತಿ ಮೈದಾನಕ್ಕೆ** | Wrong word sense: 'полигон' (training ground) translated as 'landslide'. |
| `coach.pin` | ಅದನ್ನು ಪಿನ್ ಮಾಡಿ | **ಪಿನ್ ಮಾಡಿ** | Unnecessary pronoun 'ಅದನ್ನು' (it). |
| `coach.tones.short` | ಚಿಕ್ಕದು | **ಸಂಕ್ಷಿಪ್ತ** | Incorrect part of speech; noun/adjective instead of appropriate adjective for tone. |
| `coach.tones.deep` | ಆಳವಾದ | **ಆಳವಾಗಿ** | Incorrect part of speech; adjective instead of adverb for tone. |
| `coach.tones.empathic` | ಸಹಾನುಭೂತಿಯುಳ್ಳ | **ಸಹಾನುಭೂತಿಯಿಂದ** | Incorrect part of speech; adjective instead of adverb for tone. |
| `roomActions.translation.disableSub` | ನಿಮಿಷಗಳನ್ನು ಇನ್ನು ಮುಂದೆ ರದ್ದುಗೊಳಿಸಲಾಗುವುದಿಲ್ಲ. | **ನಿಮಿಷಗಳನ್ನು ಕಡಿತಗೊಳಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಲಾಗುತ್ತದೆ.** | Inaccurate translation of 'списываться' (to be debited/charged). |
| `sip.incoming.pausedHint` | VibeVox ಒಳಬರುವ ಕರೆಗಳನ್ನು ಫಾರ್ವರ್ಡ್ ಮಾಡಲು ಸ್ವಾಗತವನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ. | **VibeVox ಒಳಬರುವ ಕರೆಗಳನ್ನು ಅನುವಾದಿಸಲು ಸ್ವಾಗತವನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ.** | Inaccurate translation of 'переводить' (to translate) as 'forward'. |
| `partner.title` | Partner program | **ಪಾಲುದಾರ ಕಾರ್ಯಕ್ರಮ** | String was not translated from English. |
| `partner.subtitle` | Share your link and earn | **ನಿಮ್ಮ ಲಿಂಕ್ ಹಂಚಿಕೊಳ್ಳಿ ಮತ್ತು ಗಳಿಸಿ** | String was not translated from English. |
| `partner.yourLink` | Your link | **ನಿಮ್ಮ ಲಿಂಕ್** | String was not translated from English. |
| `partner.copy` | Copy | **ನಕಲಿಸಿ** | String was not translated from English. |
| `partner.copied` | ✓ Link copied | **✓ ಲಿಂಕ್ ನಕಲಿಸಲಾಗಿದೆ** | String was not translated from English. |
| `partner.stats.clicks` | Clicks | **ಕ್ಲಿಕ್‌ಗಳು** | String was not translated from English. |
| `partner.stats.registrations` | Sign-ups | **ನೋಂದಣಿಗಳು** | String was not translated from English. |
| `partner.stats.paid` | Payments | **ಪಾವತಿಗಳು** | String was not translated from English. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} ಬಳಕೆದಾರರು · {{minutes}} ನಿಮಿಷ** | Partially untranslated: 'users' should be translated. |
| `partner.terms` | Program terms | **ಕಾರ್ಯಕ್ರಮದ ನಿಯಮಗಳು** | String was not translated from English. |
| `partner.contact` | Contact us | **ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ** | String was not translated from English. |
| `partner.termsModalTitle` | Partner program terms | **ಪಾಲುದಾರ ಕಾರ್ಯಕ್ರಮದ ನಿಯಮಗಳು** | String was not translated from English. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **ಕಾರ್ಯಕ್ರಮದ ನಿಯಮಗಳನ್ನು ಇನ್ನೂ ಹೊಂದಿಸಲಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಸೂಪರ್‌ಅಡ್ಮಿನ್ ಅನ್ನು ಸಂಪರ್ಕಿಸಿ.** | String was not translated from English. |
| `partner.loadError` | Failed to load partner data | **ಪಾಲುದಾರ ಡೇಟಾವನ್ನು ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ** | String was not translated from English. |
| `sip.loginShort` | ಲಾಗಿನ್ ಮಾಡಿ | **ಲಾಗಿನ್** | Incorrect part of speech; verb 'Login' instead of noun 'Login'. |
| `enterprise.gemini.leadPrefix` | ನಿಂದ ವೈಯಕ್ತಿಕ ಕೀಲಿ | **ವೈಯಕ್ತಿಕ ಕೀಲಿ** | Awkward phrasing due to split sentence structure; 'from' should be with 'AI Studio'. |
| `enterprise.gemini.telegram.botFatherLabel` | @ಬಾಟ್‌ಫಾದರ್ | **@BotFather** | Brand name '@BotFather' should be preserved, not translated. |
| `enterprise.gemini.telegram.leadStartCmd` | /ಪ್ರಾರಂಭಿಸಿ | **/start** | Command '/start' should be preserved, not translated. |
| `enterprise.gemini.telegram.testingLabel` | ಹೆಲ್ಮೆಟ್... | **ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...** | Wrong word sense: 'Шлём' (Sending...) translated as 'helmet'. |
| `enterprise.questFlow.tagsLabel` | ಟ್ಯಾಗ್‌ಗಳು ಅಗತ್ಯವಿದೆ | **ಅಗತ್ಯಗಳ ಟ್ಯಾಗ್‌ಗಳು** | Grammatically awkward phrasing: 'Tags are needed' instead of 'Needs tags'. |
| `enterprise.questFlow.errDelete` | Delete error | **ಅಳಿಸುವಲ್ಲಿ ದೋಷ** | String was not translated from English. |
| `enterprise.questFlow.deleteTitle` | Delete | **ಅಳಿಸಿ** | String was not translated from English. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **ಕೀಲಿಯನ್ನು ಅಳಿಸುವುದೇ?** | String was not translated from English. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **ಕೀಲಿಯನ್ನು ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಲಾಗುತ್ತದೆ. ಕ್ವೆಸ್ಟ್ ಫ್ಲೋ ಅದರ ಮೂಲಕ ಕಾರ್ಯನಿರ್ವಹಿಸುವುದನ್ನು ನಿಲ್ಲಿಸುತ್ತದೆ — ನೀವು ಹೊಸ ಕೀಲಿಯನ್ನು ರಚಿಸಬೇಕು ಮತ್ತು ಅದನ್ನು ಫ್ಲೋನಲ್ಲಿ ಬದಲಾಯಿಸಬೇಕು.** | String was not translated from English. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **ಅಳಿಸಿ** | String was not translated from English. |
| `enterprise.chatwoot.whatSentHeading` | ಚಾಟ್‌ವೂಟ್‌ನಲ್ಲಿ ಏನು ಹರಡುತ್ತದೆ | **ಚಾಟ್‌ವೂಟ್‌ಗೆ ಏನು ವರ್ಗಾಯಿಸಲಾಗುತ್ತದೆ** | Inaccurate translation of 'передаётся' (is transmitted) as 'spreads'. |
| `enterprise.chatwoot.whatSentItem3Prefix` | ಅಗತ್ಯವಿರುವ ಎಲ್ಲಾ ಟ್ಯಾಗ್‌ಗಳನ್ನು | **ಅಗತ್ಯಗಳ ಎಲ್ಲಾ ಟ್ಯಾಗ್‌ಗಳನ್ನು** | Grammatically awkward phrasing: 'needed tags' instead of 'needs tags'. |
| `insights.sentiment` | ಕೀ | **ಭಾವನೆ** | Wrong word sense: 'Тональность' (sentiment) translated as 'key'. |
| `postCallInsights.analyzing` | ಸಂಭಾಷಣೆಯನ್ನು ವಿಶ್ಲೇಷಿಸೋಣ... | **ಸಂಭಾಷಣೆಯನ್ನು ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ...** | Incorrect verb form/tense: 'Let's analyze' instead of 'Analyzing...' |
| `paywall.buyPlus` | ಜೊತೆಗೆ — €19/ತಿಂಗಳು (60 ನಿಮಿಷ) | **Plus — €19/ತಿಂಗಳು (60 ನಿಮಿಷ)** | Brand name 'Plus' should be preserved, not translated. |
| `paywall.buyStandard` | ಪ್ರಮಾಣಿತ – €29/ತಿಂಗಳು (120 ನಿಮಿಷ) | **Standard — €29/ತಿಂಗಳು (120 ನಿಮಿಷ)** | Brand name 'Standard' should be preserved, not translated. |
| `paywall.subscribe` | ವಿನ್ಯಾಸ | **ಚಂದಾದಾರರಾಗಿ** | Wrong word sense: 'Оформить' (subscribe) translated as 'design'. |
| `paywall.topupCta` | {{count}} ನಿಮಿಷಕ್ಕೆ ಖರೀದಿಸಿ · €{{price}} | **{{count}} ನಿಮಿಷಗಳನ್ನು ಖರೀದಿಸಿ · €{{price}}** | Grammatically awkward phrasing: 'buy per minute' instead of 'buy minutes'. |
| `paywall.topupNoSubInfo` | ℹ ನೀವು ಸಕ್ರಿಯ ಚಂದಾದಾರಿಕೆಯನ್ನು ಹೊಂದಿಲ್ಲ. ಜೊತೆಗೆ ನಿಮ್ಮ ಖರೀದಿಗೆ €19/ತಿಂಗಳಿಗೆ ಸೇರಿಸಲಾಗುತ್ತದೆ—ನಿಮ್ಮ ಯೋಜನೆಯಲ್ಲಿ 60 ನಿಮಿಷಗಳನ್ನು ಸೇರಿಸಲಾಗಿದೆ, ಆದ್ದರಿಂದ ಯಾವುದೇ ಹೆಚ್ಚುವರಿ ಶುಲ್ಕವಿಲ್ಲ. | **ℹ ನೀವು ಸಕ್ರಿಯ ಚಂದಾದಾರಿಕೆಯನ್ನು ಹೊಂದಿಲ್ಲ. Plus ನಿಮ್ಮ ಖರೀದಿಗೆ €19/ತಿಂಗಳಿಗೆ ಸೇರಿಸಲಾಗುತ್ತದೆ—ನಿಮ್ಮ ಯೋಜನೆಯಲ್ಲಿ 60 ನಿಮಿಷಗಳನ್ನು ಸೇರಿಸಲಾಗಿದೆ, ಆದ್ದರಿಂದ ಯಾವುದೇ ಹೆಚ್ಚುವರಿ ಶುಲ್ಕವಿಲ್ಲ.** | Brand name 'Plus' should be preserved, not translated. |
| `paywall.topupPlusLine` | ಪ್ಲಸ್ ಟ್ಯಾರಿಫ್ ({{count}} ನಿಮಿಷ ಸೇರಿದಂತೆ) | **Plus ಟ್ಯಾರಿಫ್ ({{count}} ನಿಮಿಷ ಸೇರಿದಂತೆ)** | Brand name 'Plus' should be preserved, not translated. |
| `billingPage.tierPlusName` | ಜೊತೆಗೆ | **Plus** | Brand name 'Plus' should be preserved, not translated. |
| `billingPage.tierStandardName` | ಪ್ರಮಾಣಿತ | **Standard** | Brand name 'Standard' should be preserved, not translated. |
| `billingPage.featureAllPlus` | ಎಲ್ಲವೂ ಪ್ಲಸ್‌ನಿಂದ | **ಎಲ್ಲವೂ Plus ನಿಂದ** | Brand name 'Plus' should be preserved, not translated. |
| `billingPage.featureAllStandard` | ಎಲ್ಲವೂ ಸ್ಟ್ಯಾಂಡರ್ಡ್‌ನಿಂದ | **ಎಲ್ಲವೂ Standard ನಿಂದ** | Brand name 'Standard' should be preserved, not translated. |
| `billingPage.ctaSubscribePlus` | ಪ್ಲಸ್ ಪಡೆಯಿರಿ | **Plus ಗೆ ಚಂದಾದಾರರಾಗಿ** | Brand name 'Plus' translated and 'Оформить' (subscribe) is better translated as 'ಚಂದಾದಾರರಾಗಿ'. |
| `billingPage.ctaSubscribeStandard` | ಆರ್ಡರ್ ಸ್ಟ್ಯಾಂಡರ್ಡ್ | **Standard ಗೆ ಚಂದಾದಾರರಾಗಿ** | Brand name 'Standard' translated and 'Оформить' (subscribe) is better translated as 'ಚಂದಾದಾರರಾಗಿ'. |
| `billingPage.presetHours` | __ವಿವಿ0__ಗಂ | **{{count}}ಗಂ** | Placeholder '{{count}}' was translated and corrupted. |
| `billingPage.presetMinutes` | __ವಿವಿ0__ಮೀ | **{{count}}ಮೀ** | Placeholder '{{count}}' was translated and corrupted. |

⚠ 1 fix(es) skipped (no-op, missing path, or would break placeholders).
