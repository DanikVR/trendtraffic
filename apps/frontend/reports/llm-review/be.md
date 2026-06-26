# LLM Review: Belarusian (be)

**Model:** gemini-2.5-flash  
**Took:** 146.7s  
**Fixes proposed:** 33 (valid after placeholder-check: 33)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `tier.trial` | Трыял | **Пробны перыяд** | Wrong word sense: 'Trial' means 'free trial period', not a transliteration. |
| `partner.title` | Partner program | **Партнёрская праграма** | Brand/product name translated to English, should be in Belarusian. |
| `partner.subtitle` | Share your link and earn | **Дзяліцеся спасылкай і зарабляйце** | Marketing copy translated to English, should be in Belarusian. |
| `partner.yourLink` | Your link | **Ваша спасылка** | UI label translated to English, should be in Belarusian. |
| `partner.copy` | Copy | **Скапіяваць** | UI button translated to English, should be in Belarusian. |
| `partner.copied` | ✓ Link copied | **✓ Спасылка скапіявана** | UI toast translated to English, should be in Belarusian. |
| `partner.stats.clicks` | Clicks | **Пераходы** | UI label translated to English, should be in Belarusian. |
| `partner.stats.registrations` | Sign-ups | **Рэгістрацыі** | UI label translated to English, should be in Belarusian. |
| `partner.stats.paid` | Payments | **Аплаты** | UI label translated to English, should be in Belarusian. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} чал · {{minutes}} мін** | UI label translated to English, should be in Belarusian. |
| `partner.terms` | Program terms | **Умовы супрацоўніцтва** | UI label translated to English, should be in Belarusian. |
| `partner.contact` | Contact us | **Звязацца з намі** | UI button translated to English, should be in Belarusian. |
| `partner.termsModalTitle` | Partner program terms | **Умовы партнёрскай праграмы** | UI title translated to English, should be in Belarusian. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Умовы праграмы пакуль не запоўнены. Калі ласка, звяжыцеся з SuperAdmin.** | UI message translated to English, should be in Belarusian. |
| `partner.loadError` | Failed to load partner data | **Не ўдалося загрузіць дадзеныя партнёрства** | UI error message translated to English, should be in Belarusian. |
| `sip.howTo.step4` | Хутка: які ўваходзіць SIP URI для пераадрасацыі вонкавых званкоў. | **Хутка: уваходны SIP URI для пераадрасацыі вонкавых званкоў.** | Grammar: 'які ўваходзіць' is less natural than 'уваходны'. |
| `sip.toasts.loadFailed` | Немагчыма загрузіць наладкі SIP: {{error}} | **Не ўдалося загрузіць наладкі SIP: {{error}}** | Consistency: 'Немагчыма' (impossible) should be 'Не ўдалося' (failed to). |
| `sip.confirm.deleteInboundTitle` | Выдаліць SIP-адрас для ўваходзяць? | **Выдаліць SIP-адрас для ўваходных?** | Grammar: 'ўваходзяць' (verb) should be 'ўваходных' (adjective). |
| `enterprise.gemini.statusInvalid` | Невалідэн | **Невалідны** | Grammar: Incorrect adjective ending. |
| `enterprise.gemini.successValid` | Ключ валідэн - Gemini API даступны. | **Ключ валідны - Gemini API даступны.** | Grammar: Incorrect adjective ending. |
| `enterprise.gemini.telegram.lead` | Стварыце робата ў @BotFather і ўстаўце яго токен. | **Стварыце бота ў @BotFather і ўстаўце яго токен.** | Word choice: 'робат' (robot) is less common than 'бот' in this context. |
| `enterprise.gemini.telegram.leadAllWhoStart` | Усе, хто напіша гэтаму робату | **Усе, хто напіша гэтаму боту** | Word choice: 'робату' (robot) should be 'боту'. |
| `enterprise.gemini.telegram.successUnlinked` | Робат адвязаны. | **Бот адвязаны.** | Word choice: 'робат' (robot) should be 'бот'. |
| `enterprise.prompt.warning` | Ня блытаць з Quest Flow | **Не блытаць з Quest Flow** | Grammar: 'Ня' (colloquial) should be 'Не' for negation. |
| `enterprise.prompt.kbPreviewSummary` | папярэдні прагляд (першыя 500 сімвалаў) | **Папярэдні прагляд (першыя 500 сімвалаў)** | Capitalization: Should be capitalized as a label/heading. |
| `enterprise.questFlow.errDelete` | Delete error | **Памылка выдалення** | UI error message translated to English, should be in Belarusian. |
| `enterprise.questFlow.deleteTitle` | Delete | **Выдаліць** | UI button translated to English, should be in Belarusian. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Выдаліць ключ?** | UI title translated to English, should be in Belarusian. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Ключ будзе выдалены без магчымасці аднаўлення. Quest Flow перастане працаваць праз яго — спатрэбіцца стварыць новы ключ і замяніць у ланцужку.** | UI message translated to English, should be in Belarusian. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Выдаліць** | UI button translated to English, should be in Belarusian. |
| `paywall.topupAddon` | Купля {{count}} мін × €0.17 | **Дакупка {{count}} мін × €0.17** | Word choice: 'Купля' (purchase) should be 'Дакупка' (top-up/additional purchase). |
| `postCallInsights.subtitle` | Enterprise · post-call insights | **Enterprise · аналіз пасля званка** | UI subtitle translated to English, should be in Belarusian. |
| `billingPage.topupTitle` | Купля хвілін | **Дакупка хвілін** | Word choice: 'Купля' (purchase) should be 'Дакупка' (top-up/additional purchase). |
