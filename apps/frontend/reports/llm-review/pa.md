# LLM Review: Punjabi (pa)

**Model:** gemini-2.5-flash  
**Took:** 316.2s  
**Fixes proposed:** 50 (valid after placeholder-check: 50)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.actions.open` | ਲਾਗਿਨ | **ਦਾਖਲ ਹੋਵੋ** | Better word sense for "Enter room" (not "Login"). |
| `balance.openPlans` | ਖੁੱਲ੍ਹੇ ਟੈਰਿਫ ਅਤੇ ਬਕਾਇਆ | **ਟੈਰਿਫ ਅਤੇ ਬਕਾਇਆ ਖੋਲ੍ਹੋ** | Grammar: "Open tariffs and balance" should use imperative verb. |
| `tier.trial` | ਮੁਕੱਦਮਾ | **ਅਜ਼ਮਾਇਸ਼ੀ** | Wrong word sense: "Trial" in subscription context, not legal. |
| `moreSheet.sip.sub` | ਤਣੀਆਂ ਸਥਾਪਤ ਕਰਨਾ | **ਟਰੰਕ ਸਥਾਪਤ ਕਰਨਾ** | Use preserved term "ਟਰੰਕ" instead of "ਤਣੀਆਂ". |
| `call.toPlayground` | 🎯 ਲੈਂਡਫਿਲ ਵੱਲ | **🎯 ਸਿਖਲਾਈ ਮੈਦਾਨ ਵੱਲ** | Wrong word sense: "полигон" (proving ground) translated as "landfill". |
| `call.expandPeer` | ਵਾਰਤਾਕਾਰ ਨੂੰ ਫੈਲਾਓ | **ਵਾਰਤਾਕਾਰ ਨੂੰ ਵੱਡਾ ਕਰੋ** | More natural phrasing for "expand" in UI context. |
| `coach.help` | ਮਦਦ ਜਵਾਬ | **ਜਵਾਬ ਦੇਣ ਵਿੱਚ ਮਦਦ ਕਰੋ** | Grammar: "Help to answer" is more natural. |
| `coach.pin` | ਇਸ ਨੂੰ ਪਿੰਨ ਕਰੋ | **ਪਿੰਨ ਕਰੋ** | Shorter and more concise for a button label. |
| `roomActions.copyLink` | ਲਿੰਕ ਨੂੰ ਕਮਰੇ ਵਿੱਚ ਕਾਪੀ ਕਰੋ | **ਕਮਰੇ ਦਾ ਲਿੰਕ ਕਾਪੀ ਕਰੋ** | Grammar: "Copy room link" is more natural. |
| `sip.incoming.active` | ਆਉਣ ਵਾਲੀਆਂ ਕਾਲਾਂ ਆ ਰਹੀਆਂ ਹਨ। | **ਆਉਣ ਵਾਲੀਆਂ ਕਾਲਾਂ ਕਿਰਿਆਸ਼ੀਲ ਹਨ।** | More accurate translation for "active" in this context. |
| `sip.incoming.pausedHint` | VibeVox ਆਉਣ ਵਾਲੀਆਂ ਕਾਲਾਂ ਨੂੰ ਅੱਗੇ ਭੇਜਣ ਲਈ ਰਿਸੈਪਸ਼ਨ ਨੂੰ ਕਿਰਿਆਸ਼ੀਲ ਕਰੋ। | **VibeVox ਆਉਣ ਵਾਲੀਆਂ ਕਾਲਾਂ ਦਾ ਅਨੁਵਾਦ ਕਰਨਾ ਸ਼ੁਰੂ ਕਰੇ, ਇਸ ਲਈ ਰਿਸੈਪਸ਼ਨ ਨੂੰ ਕਿਰਿਆਸ਼ੀਲ ਕਰੋ।** | Wrong word sense: "forward" instead of "translate". |
| `sip.outbound.lead` | ਵੈੱਬ ਇੰਟਰਫੇਸ ਤੋਂ ਇੱਕ ਫ਼ੋਨ ਨੰਬਰ 'ਤੇ ਕਾਲ ਕਰੋ ਅਤੇ VibeVox ਤੁਹਾਡੀ ਗੱਲਬਾਤ ਨੂੰ ਰੀਅਲ ਟਾਈਮ ਵਿੱਚ ਆਪਣੇ ਆਪ ਟ੍ਰਾਂਸਫਰ ਕਰ ਦੇਵੇਗਾ। | **ਵੈੱਬ ਇੰਟਰਫੇਸ ਤੋਂ ਇੱਕ ਫ਼ੋਨ ਨੰਬਰ 'ਤੇ ਕਾਲ ਕਰੋ — VibeVox ਤੁਹਾਡੀ ਗੱਲਬਾਤ ਦਾ ਰੀਅਲ ਟਾਈਮ ਵਿੱਚ ਆਪਣੇ ਆਪ ਅਨੁਵਾਦ ਕਰ ਦੇਵੇਗਾ।** | Wrong word sense: "transfer" instead of "translate". |
| `sip.outbound.invalidNumber` | ਕਿਰਪਾ ਕਰਕੇ ਅੰਤਰਰਾਸ਼ਟਰੀ ਫਾਰਮੈਟ ਵਿੱਚ ਸਹੀ ਨੰਬਰ ਦਰਜ ਕਰੋ (+XXXXXXXXXXXX) | **ਕਿਰਪਾ ਕਰਕੇ ਅੰਤਰਰਾਸ਼ਟਰੀ ਫਾਰਮੈਟ ਵਿੱਚ ਸਹੀ ਨੰਬਰ ਦਰਜ ਕਰੋ (+XXXXXXXXXXX)** | Placeholder not preserved exactly. |
| `partner.title` | Partner program | **ਪਾਰਟਨਰ ਪ੍ਰੋਗਰਾਮ** | Translate the phrase, not keep English. |
| `partner.subtitle` | Share your link and earn | **ਆਪਣਾ ਲਿੰਕ ਸਾਂਝਾ ਕਰੋ ਅਤੇ ਕਮਾਓ** | Translate the phrase, not keep English. |
| `partner.yourLink` | Your link | **ਤੁਹਾਡਾ ਲਿੰਕ** | Translate the phrase, not keep English. |
| `partner.copy` | Copy | **ਕਾਪੀ ਕਰੋ** | Translate the phrase, not keep English. |
| `partner.copied` | ✓ Link copied | **✓ ਲਿੰਕ ਕਾਪੀ ਕੀਤਾ ਗਿਆ** | Translate the phrase, not keep English. |
| `partner.stats.clicks` | Clicks | **ਕਲਿੱਕ** | Translate the phrase, not keep English. |
| `partner.stats.registrations` | Sign-ups | **ਰਜਿਸਟ੍ਰੇਸ਼ਨਾਂ** | Translate the phrase, not keep English. |
| `partner.stats.paid` | Payments | **ਭੁਗਤਾਨ** | Translate the phrase, not keep English. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} ਉਪਭੋਗਤਾ · {{minutes}} ਮਿੰਟ** | Translate the phrase, not keep English. |
| `partner.terms` | Program terms | **ਪ੍ਰੋਗਰਾਮ ਦੀਆਂ ਸ਼ਰਤਾਂ** | Translate the phrase, not keep English. |
| `partner.contact` | Contact us | **ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ** | Translate the phrase, not keep English. |
| `partner.termsModalTitle` | Partner program terms | **ਪਾਰਟਨਰ ਪ੍ਰੋਗਰਾਮ ਦੀਆਂ ਸ਼ਰਤਾਂ** | Translate the phrase, not keep English. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **ਪ੍ਰੋਗਰਾਮ ਦੀਆਂ ਸ਼ਰਤਾਂ ਅਜੇ ਸੈੱਟ ਨਹੀਂ ਕੀਤੀਆਂ ਗਈਆਂ ਹਨ। ਕਿਰਪਾ ਕਰਕੇ ਸੁਪਰਐਡਮਿਨ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।** | Translate the phrase, not keep English. |
| `partner.loadError` | Failed to load partner data | **ਪਾਰਟਨਰ ਡਾਟਾ ਲੋਡ ਕਰਨ ਵਿੱਚ ਅਸਫਲ ਰਿਹਾ** | Translate the phrase, not keep English. |
| `enterprise.gemini.telegram.successUnlinked` | ਬੋਟ ਖੁੱਲ੍ਹਾ ਹੈ। | **ਬੋਟ ਅਣਲਿੰਕ ਕੀਤਾ ਗਿਆ।** | Wrong word sense: "open" instead of "unlinked". |
| `enterprise.gemini.telegram.testingLabel` | ਹੈਲਮੇਟ… | **ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…** | Wrong word sense: "sending" translated as "helmet". |
| `enterprise.gemini.telegram.confirmUnlinkCta` | ਟਾਈ ਖੋਲ੍ਹੋ | **ਅਣਲਿੰਕ ਕਰੋ** | Wrong word sense: "untie" instead of "unlink". |
| `enterprise.prompt.headerLeadBold2` | "ਤੁਹਾਡੀ ਬੇਨਤੀ ਅਨੁਸਾਰ" | **"ਤੁਹਾਡੇ ਪ੍ਰੋਂਪਟ ਅਨੁਸਾਰ"** | Preserve "prompt" as a technical term. |
| `enterprise.prompt.contextLeadBold` | "ਤੁਹਾਡੀ ਬੇਨਤੀ ਅਨੁਸਾਰ" | **"ਤੁਹਾਡੇ ਪ੍ਰੋਂਪਟ ਅਨੁਸਾਰ"** | Preserve "prompt" as a technical term. |
| `enterprise.prompt.presetsLeadBold` | "ਤੁਹਾਡੀ ਬੇਨਤੀ ਅਨੁਸਾਰ" | **"ਤੁਹਾਡੇ ਪ੍ਰੋਂਪਟ ਅਨੁਸਾਰ"** | Preserve "prompt" as a technical term. |
| `enterprise.questFlow.errDelete` | Delete error | **ਮਿਟਾਉਣ ਵਿੱਚ ਗਲਤੀ** | Translate the phrase, not keep English. |
| `enterprise.questFlow.deleteTitle` | Delete | **ਮਿਟਾਓ** | Translate the phrase, not keep English. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **ਕੀ ਕੁੰਜੀ ਮਿਟਾਉਣੀ ਹੈ?** | Translate the phrase, not keep English. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **ਕੁੰਜੀ ਨੂੰ ਪੱਕੇ ਤੌਰ 'ਤੇ ਮਿਟਾ ਦਿੱਤਾ ਜਾਵੇਗਾ। ਕੁਐਸਟ ਫਲੋ ਇਸ ਰਾਹੀਂ ਕੰਮ ਕਰਨਾ ਬੰਦ ਕਰ ਦੇਵੇਗਾ — ਤੁਹਾਨੂੰ ਇੱਕ ਨਵੀਂ ਕੁੰਜੀ ਬਣਾਉਣ ਅਤੇ ਇਸਨੂੰ ਚੇਨ ਵਿੱਚ ਬਦਲਣ ਦੀ ਲੋੜ ਪਵੇਗੀ।** | Translate the phrase, not keep English. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **ਮਿਟਾਓ** | Translate the phrase, not keep English. |
| `chat.enterpriseOnlyHint` | ਚੈਟ ਰੂਮ ਇੱਕ ਐਂਟਰਪ੍ਰਾਈਜ਼ ਵਿਸ਼ੇਸ਼ਤਾ ਹਨ। "ਕੀਮਤ" ਭਾਗ ਵਿੱਚ ਆਪਣੇ ਪਲਾਨ ਨੂੰ ਅੱਪਗ੍ਰੇਡ ਕਰੋ। | **ਚੈਟ ਰੂਮ ਇੱਕ ਐਂਟਰਪ੍ਰਾਈਜ਼ ਵਿਸ਼ੇਸ਼ਤਾ ਹਨ। "ਟੈਰਿਫ" ਭਾਗ ਵਿੱਚ ਆਪਣੇ ਪਲਾਨ ਨੂੰ ਅੱਪਗ੍ਰੇਡ ਕਰੋ।** | Wrong word sense: "price" instead of "tariff". |
| `insights.sentiment` | ਕੁੰਜੀ | **ਟੋਨ** | Wrong word sense: "key" instead of "tonality/sentiment". |
| `postCallInsights.analyzing` | ਆਓ ਗੱਲਬਾਤ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰੀਏ... | **ਗੱਲਬਾਤ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ…** | Grammar: "Analyzing conversation..." (passive) not "Let's analyze...". |
| `postCallInsights.metricSentiment` | ਮੂਡ | **ਟੋਨ** | Consistency with "insights.sentiment" (tonality). |
| `paywall.subscribe` | ਡਿਜ਼ਾਈਨ | **ਸਬਸਕ੍ਰਾਈਬ ਕਰੋ** | Wrong word sense: "design" instead of "subscribe". |
| `paywall.topupAddon` | ਵਾਧੂ ਖਰੀਦ {{count}} ਘੱਟੋ-ਘੱਟ × €0.17 | **ਵਾਧੂ ਖਰੀਦ {{count}} ਮਿੰਟ × €0.17** | Wrong word sense: "minimum" instead of "minutes". |
| `billingPage.tierLabel` | ਰੇਟ ਕਰੋ | **ਟੈਰਿਫ** | Wrong word sense: "rate" (verb) instead of "tariff" (noun). |
| `billingPage.resume` | ਰੈਜ਼ਿਊਮੇ | **ਮੁੜ ਸ਼ੁਰੂ ਕਰੋ** | More natural phrasing for "resume" (verb). |
| `billingPage.ctaSubscribePlus` | ਪਲੱਸ ਪ੍ਰਾਪਤ ਕਰੋ | **ਪਲੱਸ ਸਬਸਕ੍ਰਾਈਬ ਕਰੋ** | More accurate translation for "subscribe" in this context. |
| `billingPage.ctaSubscribeStandard` | ਆਰਡਰ ਸਟੈਂਡਰਡ | **ਸਟੈਂਡਰਡ ਸਬਸਕ੍ਰਾਈਬ ਕਰੋ** | More accurate translation for "subscribe" in this context. |
| `billingPage.autoRenewCancelledHint` | ਤੁਹਾਡੇ ਪਲਾਨ ਦੇ ਮਿੰਟ ਇਸ ਮਿਤੀ ਤੱਕ ਵੈਧ ਹਨ; ਤੁਸੀਂ ਵਾਧੂ ਮਿੰਟ ਖਰੀਦ ਸਕਦੇ ਹੋ। ਜੇਕਰ ਤੁਸੀਂ ਆਪਣਾ ਮਨ ਬਦਲਦੇ ਹੋ ਤਾਂ "Resume" 'ਤੇ ਕਲਿੱਕ ਕਰੋ। | **ਤੁਹਾਡੇ ਪਲਾਨ ਦੇ ਮਿੰਟ ਇਸ ਮਿਤੀ ਤੱਕ ਵੈਧ ਹਨ; ਤੁਸੀਂ ਵਾਧੂ ਮਿੰਟ ਖਰੀਦ ਸਕਦੇ ਹੋ। ਜੇਕਰ ਤੁਸੀਂ ਆਪਣਾ ਮਨ ਬਦਲਦੇ ਹੋ ਤਾਂ "ਮੁੜ ਸ਼ੁਰੂ ਕਰੋ" 'ਤੇ ਕਲਿੱਕ ਕਰੋ।** | Translate "Resume" for consistency with other UI elements. |
| `auth.common.passwordRepeatLabel` | ਪਾਸਵਰਡ ਦੁਹਰਾਊ | **ਪਾਸਵਰਡ ਦੁਹਰਾਓ** | Grammar: Use imperative verb for "Repeat password". |
