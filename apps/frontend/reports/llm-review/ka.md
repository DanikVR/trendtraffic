# LLM Review: Georgian (ka)

**Model:** gemini-2.5-flash  
**Took:** 178.8s  
**Fixes proposed:** 55 (valid after placeholder-check: 43)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.tabs.questFlow` | ქვესტის ნაკადი | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `rooms.live` | პირდაპირი ეთერი | **Live** | UI term 'Live' should be preserved as per instructions. |
| `tier.standardYearly` | ყოველწლიურად | **Yearly** | Brand name 'Yearly' must be preserved. |
| `moreSheet.enterprise.sub` | Gemini key, Quest Flow, ტეგები, CRM | **Gemini გასაღები, Quest Flow, ტეგები, CRM** | Translate 'key' to 'გასაღები' and preserve 'Quest Flow'. |
| `call.you` | შენ | **თქვენ** | Use formal 'you' (თქვენ) in UI context. |
| `billing.lowBalance` | თარგმანის დასრულებამდე {{n}} წუთი დარჩა | **დარჩენილია {{n}} წთ თარგმანი** | More concise and accurate translation for 'remaining minutes'. |
| `settings.themeDarkSub` | უფსკრულის ავრორა (ბნელი) | **Abyss Aurora (ბნელი)** | Brand name 'Abyss Aurora' must be preserved. |
| `settings.themeLightSub` | ღრუბლისებრი ავრორა (ნათება) | **Cloud Aurora (ნათება)** | Brand name 'Cloud Aurora' must be preserved. |
| `partner.title` | Partner program | **პარტნიორული პროგრამა** | English phrase should be translated to Georgian. |
| `partner.subtitle` | Share your link and earn | **გააზიარეთ თქვენი ბმული და გამოიმუშავეთ** | English phrase should be translated to Georgian. |
| `partner.yourLink` | Your link | **თქვენი ბმული** | English phrase should be translated to Georgian. |
| `partner.copy` | Copy | **კოპირება** | English phrase should be translated to Georgian. |
| `partner.copied` | ✓ Link copied | **✓ ბმული დაკოპირებულია** | English phrase should be translated to Georgian. |
| `partner.stats.clicks` | Clicks | **დაწკაპუნებები** | English phrase should be translated to Georgian. |
| `partner.stats.registrations` | Sign-ups | **რეგისტრაციები** | English phrase should be translated to Georgian. |
| `partner.stats.paid` | Payments | **გადახდები** | English phrase should be translated to Georgian. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} მომხმარებელი · {{minutes}} წთ** | English words 'users' and 'min' should be translated. |
| `partner.terms` | Program terms | **პროგრამის პირობები** | English phrase should be translated to Georgian. |
| `partner.contact` | Contact us | **დაგვიკავშირდით** | English phrase should be translated to Georgian. |
| `partner.termsModalTitle` | Partner program terms | **პარტნიორული პროგრამის პირობები** | English phrase should be translated to Georgian. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **პროგრამის პირობები ჯერ არ არის დაყენებული. გთხოვთ, დაუკავშირდეთ SuperAdmin-ს.** | English phrase should be translated to Georgian. |
| `partner.loadError` | Failed to load partner data | **პარტნიორული მონაცემების ჩატვირთვა ვერ მოხერხდა** | English phrase should be translated to Georgian. |
| `enterprise.tabs.prompts` | რჩევები | **პრომპტები** | Translate 'prompts' more accurately as 'პრომპტები' instead of 'რჩევები' (tips). |
| `enterprise.tabs.questFlow` | ქვესტის ნაკადი | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.gemini.leadPrefix` | პირადი გასაღები | **პირადი გასაღები AI Studio-დან** | Missing 'AI Studio-დან' (from AI Studio) for full context. |
| `enterprise.gemini.leadSuffix` | თქვენს ანგარიშზე Gemini-ს ყველა ზარისთვის გამოიყენება გლობალურის ნაცვლად. | **AI Studio-დან. გამოიყენება გლობალურის ნაცვლად თქვენს ანგარიშზე Gemini-ს ყველა ზარისთვის.** | Missing 'AI Studio-დან' (from AI Studio) for full context. |
| `enterprise.gemini.keyPlaceholder` | აიზასი... | **AIzaSy...** | Placeholder 'AIzaSy...' must be preserved exactly. |
| `enterprise.prompt.heading` | რჩევები | **პრომპტები** | Translate 'prompts' more accurately as 'პრომპტები' instead of 'რჩევები' (tips). |
| `enterprise.prompt.presetsLeadPart1` | Enterprise Room-ის ჩატში შეგიძლიათ მონიშნოთ ნებისმიერი შეტყობინება და სთხოვოთ ხელოვნურ ინტელექტს, ახსნას ის არჩეული ტონით. ღილაკი | **Enterprise ოთახის ჩატში შეგიძლიათ მონიშნოთ ნებისმიერი შეტყობინება და სთხოვოთ ხელოვნურ ინტელექტს, ახსნას ის არჩეული ტონით. ღილაკი** | Preserve 'Enterprise' as a brand/tier name. |
| `enterprise.questFlow.heading` | ქვესტის ნაკადი | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.keyLabelPlaceholder` | ლეიბლი (არასავალდებულო), მაგალითად: „Prod bot clinic“ | **ლეიბლი (არასავალდებულო), მაგალითად: „კლინიკის პროდ ბოტი“** | Translate example text to Georgian. |
| `enterprise.questFlow.errDelete` | Delete error | **წაშლის შეცდომა** | English phrase should be translated to Georgian. |
| `enterprise.questFlow.deleteTitle` | Delete | **წაშლა** | English phrase should be translated to Georgian. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **გასაღების წაშლა?** | English phrase should be translated to Georgian. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **გასაღები სამუდამოდ წაიშლება. Quest Flow შეწყვეტს მუშაობას მის მეშვეობით — საჭირო იქნება ახალი გასაღების შექმნა და მისი ჩანაცვლება ნაკადში.** | English phrase should be translated to Georgian, preserve 'Quest Flow'. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **წაშლა** | English phrase should be translated to Georgian. |
| `enterprise.questFlow.kbLead3` | „მინიშნებების“ განყოფილებიდან - ვიდეო ტრანსკრიფციისთვის. ლიმიტი: 50 მბ ფაილი / 500,000 სიმბოლო მონაცემთა ბაზაში. | **განყოფილება „პრომპტები“-დან - ვიდეო ტრანსკრიფციისთვის. ლიმიტი: 50 მბ ფაილი / 500,000 სიმბოლო მონაცემთა ბაზაში.** | Use corrected term for 'Подсказки' (prompts). |
| `insights.leadScore` | ლიდერობის ქულა | **Lead Score** | Preserve 'Lead Score' as per instructions for sales funnel term. |
| `lobby.nameLabel` | რა გქვია? | **რა გქვიათ?** | Use formal 'you' (თქვენ) in UI context. |
| `postCallInsights.metricLeadScore` | ლიდერობის ქულა | **Lead Score** | Preserve 'Lead Score' as per instructions for sales funnel term. |
| `billingPage.promoPlaceholder` | მაგალითად: 25 წლის ზაფხული | **მაგალითად: SUMMER25** | Placeholder 'SUMMER25' must be preserved exactly. |
| `billingPage.featureLearnHub` | ხელოვნური ინტელექტის სასწავლო ცენტრი — საკუთარი დიალექტები | **AI Learning Hub — საკუთარი დიალექტები** | Brand name 'AI Learning Hub' must be preserved. |
| `billingPage.faqA3` | სრული ხელოვნური ინტელექტის დასტა: მომხმარებლის ბარათები ავტომატური ამოცნობით, Telegram-ის ავტორიზაცია, პერსონალური პრომპტები, Google Calendar, ჭკვიანი საჭიროებების მონიშვნა, CRM ექსპორტი, questflow.pro-სთან ინტეგრაცია და ცალკე ადმინისტრატორის ჩანართი. | **სრული ხელოვნური ინტელექტის დასტა: მომხმარებლის ბარათები ავტომატური ამოცნობით, Telegram-ის ავტორიზაცია, პერსონალური პრომპტები, Google Calendar, ჭკვიანი საჭიროებების მონიშვნა, ექსპორტი CRM-ში, questflow.pro-სთან ინტეგრაცია და ცალკე ადმინისტრატორის ჩანართი.** | Correct word order for 'CRM export' (ექსპორტი CRM-ში). |

⚠ 12 fix(es) skipped (no-op, missing path, or would break placeholders).
