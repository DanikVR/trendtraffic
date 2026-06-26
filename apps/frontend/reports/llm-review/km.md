# LLM Review: Khmer (km)

**Model:** gemini-2.5-flash  
**Took:** 164.8s  
**Fixes proposed:** 51 (valid after placeholder-check: 50)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.billing` | ពន្ធគយ | **ផែនការ** | Wrong word sense: 'ពន្ធគយ' means customs duty, not pricing plan. |
| `rooms.subtitle` | វគ្គបកស្រាយក្នុងពេលដំណាលគ្នាសកម្មរបស់អ្នក | **វគ្គបកប្រែក្នុងពេលដំណាលគ្នាសកម្មរបស់អ្នក** | 'បកស្រាយ' means interpretation, 'បកប្រែ' is translation (app context). |
| `languagePicker.searchPlaceholder` | កំពុងស្វែងរកភាសា... | **ស្វែងរកភាសា...** | More direct translation for 'Search language...'. |
| `balance.openPlans` | ពន្ធបើកចំហ និងសមតុល្យ | **បើកផែនការ និងសមតុល្យ** | Wrong word sense: 'ពន្ធ' means tax/duty, not pricing plan. |
| `balance.tariffs` | ពន្ធគយ | **ផែនការ** | Wrong word sense: 'ពន្ធគយ' means customs duty, not pricing plan. |
| `call.speaksLang` | និយាយភាសាអង់គ្លេស | **និយាយភាសា{{lang}}** | Hardcoded language; should use placeholder {{lang}}. |
| `partner.title` | Partner program | **កម្មវិធីដៃគូ** | Should be translated, not preserved English. |
| `partner.subtitle` | Share your link and earn | **ចែករំលែកតំណភ្ជាប់របស់អ្នក ហើយរកប្រាក់ចំណូល** | Should be translated, not preserved English. |
| `partner.yourLink` | Your link | **តំណភ្ជាប់របស់អ្នក** | Should be translated, not preserved English. |
| `partner.copy` | Copy | **ចម្លង** | Should be translated, not preserved English. |
| `partner.copied` | ✓ Link copied | **✓ តំណភ្ជាប់ត្រូវបានចម្លង** | Should be translated, not preserved English. |
| `partner.stats.clicks` | Clicks | **ការចុច** | Should be translated, not preserved English. |
| `partner.stats.registrations` | Sign-ups | **ការចុះឈ្មោះ** | Should be translated, not preserved English. |
| `partner.stats.paid` | Payments | **ការទូទាត់** | Should be translated, not preserved English. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} អ្នកប្រើប្រាស់ · {{minutes}} នាទី** | Should be translated and 'min' replaced with local equivalent. |
| `partner.terms` | Program terms | **លក្ខខណ្ឌកម្មវិធី** | Should be translated, not preserved English. |
| `partner.contact` | Contact us | **ទាក់ទងមកយើងខ្ញុំ** | Should be translated, not preserved English. |
| `partner.termsModalTitle` | Partner program terms | **លក្ខខណ្ឌកម្មវិធីដៃគូ** | Should be translated, not preserved English. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **លក្ខខណ្ឌកម្មវិធីមិនទាន់ត្រូវបានកំណត់នៅឡើយទេ។ សូមទាក់ទង SuperAdmin។** | Should be translated, not preserved English. |
| `partner.loadError` | Failed to load partner data | **បរាជ័យក្នុងការផ្ទុកទិន្នន័យដៃគូ** | Should be translated, not preserved English. |
| `sip.incoming.toggleFailed` | មិនអាចប្តូរការទទួលបានទេ | **មិនអាចប្តូរការទទួលទេ** | 'ការទទួលបាន' is slightly redundant; 'ការទទួល' is more concise. |
| `sip.outbound.noTrunkHint` | បំពេញទម្រង់ "New SIP Trunk" នៅផ្នែកខាងលើនៃទំព័រ - VibeVox នឹងប្រើប្រាស់អ្នកផ្តល់សេវា SIP របស់អ្នក (Zadarma, OnlinePBX ។ល។) សម្រាប់ការហៅចេញ។ | **បំពេញទម្រង់ "SIP Trunk ថ្មី" នៅផ្នែកខាងលើនៃទំព័រ - VibeVox នឹងប្រើប្រាស់អ្នកផ្តល់សេវា SIP របស់អ្នក (Zadarma, OnlinePBX ។ល។) សម្រាប់ការហៅចេញ។** | 'New SIP Trunk' is not a brand name and should be translated. |
| `sip.confirm.deleteInboundTitle` | លុបអាសយដ្ឋាន SIP សម្រាប់​អ្នក​ចូល? | **លុបអាសយដ្ឋាន SIP សម្រាប់ការហៅចូល?** | More precise for 'for incoming' in the context of calls. |
| `enterprise.page.upsellCta` | ចូលទៅកាន់ពន្ធគយ | **ចូលទៅកាន់ផែនការ** | Wrong word sense: 'ពន្ធគយ' means customs duty, not pricing plan. |
| `enterprise.gemini.leadSuffix` | ប្រើជំនួសការហៅទូរសព្ទសកលសម្រាប់ការហៅទូរសព្ទ Gemini ទាំងអស់នៅលើគណនីរបស់អ្នក។ | **។ ប្រើជំនួសសោសកលសម្រាប់ការហៅទូរសព្ទ Gemini ទាំងអស់នៅលើគណនីរបស់អ្នក។** | Grammatical correction: 'calls' vs 'key' in context. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | ស្រាយចំណង | **ផ្ដាច់** | More consistent with 'unlink' and better word choice. |
| `enterprise.prompt.savePrompt` | រក្សាទុក​ការ​ជូនដំណឹង | **រក្សាទុកការណែនាំ** | 'ការជូនដំណឹង' means notification; 'ការណែនាំ' is better for 'prompt'. |
| `enterprise.prompt.headerLeadBold2` | «តាមសំណើរបស់អ្នក» | **«តាមការណែនាំរបស់អ្នក»** | 'សំណើ' means request; 'ការណែនាំ' is better for 'prompt'. |
| `enterprise.prompt.contextHeading` | បរិបទ / promt | **បរិបទ / ការណែនាំ** | Consistency in translating 'prompt' to 'ការណែនាំ'. |
| `enterprise.prompt.contextLeadBold` | «តាមសំណើរបស់អ្នក» | **«តាមការណែនាំរបស់អ្នក»** | 'សំណើ' means request; 'ការណែនាំ' is better for 'prompt'. |
| `enterprise.prompt.savePromptLabel` | រក្សាទុក​ការ​ជូនដំណឹង | **រក្សាទុកការណែនាំ** | 'ការជូនដំណឹង' means notification; 'ការណែនាំ' is better for 'prompt'. |
| `enterprise.prompt.successPromptSaved` | បានរក្សាទុកសារជំរុញ។ | **បានរក្សាទុកការណែនាំ។** | Consistency in translating 'prompt' to 'ការណែនាំ'. |
| `enterprise.prompt.presetsLeadBold` | «តាមសំណើរបស់អ្នក» | **«តាមការណែនាំរបស់អ្នក»** | 'សំណើ' means request; 'ការណែនាំ' is better for 'prompt'. |
| `enterprise.questFlow.savePrompt` | រក្សាទុក​ការ​ជូនដំណឹង | **រក្សាទុកការណែនាំ** | 'ការជូនដំណឹង' means notification; 'ការណែនាំ' is better for 'prompt'. |
| `enterprise.questFlow.keyLabelPlaceholder` | ស្លាក (ស្រេចចិត្ត) ឧទាហរណ៍៖ "គ្លីនិកប្រូតបូត" | **ស្លាក (ស្រេចចិត្ត) ឧទាហរណ៍៖ «បូតគ្លីនិកផលិតផល»** | Example text should be translated to Khmer. |
| `enterprise.questFlow.errDelete` | Delete error | **កំហុសក្នុងការលុប** | Should be translated, not preserved English. |
| `enterprise.questFlow.deleteTitle` | Delete | **លុប** | Should be translated, not preserved English. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **លុបសោរ?** | Should be translated, not preserved English. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **សោរនឹងត្រូវបានលុបជាអចិន្ត្រៃយ៍។ Quest Flow នឹងឈប់ដំណើរការតាមរយៈវា — អ្នកនឹងត្រូវបង្កើតសោរថ្មី ហើយជំនួសវានៅក្នុងលំហូរ។** | Should be translated, not preserved English. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **លុប** | Should be translated, not preserved English. |
| `lobby.roomFullMsg` | មានអ្នកចូលរួមក្នុងកិច្ចប្រជុំរួចហើយ។ សូមទាក់ទងអ្នកបង្កើតកិច្ចប្រជុំ ឬស្នើសុំអ្នកបង្កើតកិច្ចប្រជុំថ្មី។ | **មានអ្នកចូលរួមក្នុងកិច្ចប្រជុំរួចហើយ។ សូមទាក់ទងអ្នកបង្កើតកិច្ចប្រជុំ ឬបង្កើតថ្មី។** | Grammatical correction: 'request a new meeting creator' is incorrect. |
| `chat.enterpriseOnlyHint` | បន្ទប់ជជែកគឺជាមុខងារ Enterprise។ ធ្វើឱ្យប្រសើរឡើងនូវផែនការរបស់អ្នកនៅក្នុងផ្នែក «តម្លៃ»។ | **បន្ទប់ជជែកគឺជាមុខងារ Enterprise។ ធ្វើឱ្យប្រសើរឡើងនូវផែនការរបស់អ្នកនៅក្នុងផ្នែក «ផែនការ»។** | Wrong word sense: 'តម្លៃ' means price, not pricing plan. |
| `insights.summary` | ប្រវត្តិរូបសង្ខេប | **សេចក្តីសង្ខេប** | 'ប្រវត្តិរូបសង្ខេប' means resume/CV; 'សេចក្តីសង្ខេប' is summary. |
| `postCallInsights.subtitle` | Enterprise · ការយល់ដឹងក្រោយការហៅទូរសព្ទ | **Enterprise · ការយល់ដឹងក្រោយការហៅ** | 'post-call insights' should be translated, not partially transliterated. |
| `postCallInsights.summary` | ប្រវត្តិរូបសង្ខេប | **សេចក្តីសង្ខេប** | 'ប្រវត្តិរូបសង្ខេប' means resume/CV; 'សេចក្តីសង្ខេប' is summary. |
| `billingPage.title` | ពន្ធ និងការទូទាត់ | **ផែនការ និងការទូទាត់** | Wrong word sense: 'ពន្ធ' means tax/duty, not pricing plan. |
| `billingPage.featureLearnHub` | AI Learning Hub — ភាសាផ្ទាល់ខ្លួន | **មជ្ឈមណ្ឌលសិក្សា AI — ភាសាផ្ទាល់ខ្លួន** | 'AI Learning Hub' is not a brand name and should be translated. |
| `billingPage.featureBranding` | ការផ្សព្វផ្សាយពាណិជ្ជកម្មបន្ទប់ (ឡូហ្គោ ពណ៌) | **ការដាក់ម៉ាកយីហោបន្ទប់ (ឡូហ្គោ ពណ៌)** | 'ការផ្សព្វផ្សាយពាណិជ្ជកម្ម' means advertising; 'ការដាក់ម៉ាកយីហោ' is branding. |
| `billingPage.faqA3` | ជង់ AI ពេញលេញ៖ កាតអតិថិជនដែលមានការទទួលស្គាល់ដោយស្វ័យប្រវត្តិ ការអនុញ្ញាត Telegram ការជូនដំណឹងផ្ទាល់ខ្លួន ប្រតិទិន Google ការដាក់ស្លាកតម្រូវការឆ្លាតវៃ ការនាំចេញ CRM ការរួមបញ្ចូលជាមួយ questflow.pro និងផ្ទាំងអ្នកគ្រប់គ្រងដាច់ដោយឡែក។ | **ជង់ AI ពេញលេញ៖ កាតអតិថិជនដែលមានការទទួលស្គាល់ដោយស្វ័យប្រវត្តិ ការអនុញ្ញាត Telegram ការណែនាំផ្ទាល់ខ្លួន ប្រតិទិន Google ការដាក់ស្លាកតម្រូវការឆ្លាតវៃ ការនាំចេញ CRM ការរួមបញ្ចូលជាមួយ questflow.pro និងផ្ទាំងអ្នកគ្រប់គ្រងដាច់ដោយឡែក។** | 'ការជូនដំណឹង' means notification; 'ការណែនាំ' is better for 'prompts'. |
| `billingPage.presetHours` | {{count}}h | **{{count}}ម៉** | 'h' should be translated to the local short form for hour ('ម៉'). |

⚠ 1 fix(es) skipped (no-op, missing path, or would break placeholders).
