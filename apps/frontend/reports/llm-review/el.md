# LLM Review: Greek (el)

**Model:** gemini-2.5-flash  
**Took:** 215.4s  
**Fixes proposed:** 115 (valid after placeholder-check: 105)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.billing` | Δασμοί | **Τιμολόγια** | Wrong word sense: 'Δασμοί' means customs duties, not pricing plans. |
| `nav.home` | Σπίτι | **Αρχική** | Wrong word sense: 'Σπίτι' means home (building), 'Αρχική' for home page. |
| `rooms.tabs.questFlow` | Ροή Αποστολών | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `rooms.tabs.vibeAdd` | Προσθήκη Vibe | **VibeAdd** | Brand name 'VibeAdd' should be preserved, not translated. |
| `rooms.live` | Ζω | **Ζωντανά** | Wrong word sense: 'Ζω' (I live) vs 'Ζωντανά' (Live status). |
| `rooms.actions.open` | Σύνδεση | **Είσοδος** | Wrong word sense: 'Σύνδεση' (login/connection) vs 'Είσοδος' (enter). |
| `common.save` | Εκτός | **Αποθήκευση** | Wrong word sense: 'Εκτός' (outside/except) vs 'Αποθήκευση' (save). |
| `common.close` | Κοντά | **Κλείσιμο** | Wrong word sense: 'Κοντά' (near) vs 'Κλείσιμο' (close). |
| `common.open` | Ανοιχτό | **Άνοιγμα** | Wrong word sense: 'Ανοιχτό' (open, adjective) vs 'Άνοιγμα' (open, verb). |
| `balance.minutesShort` | λεπτά | **λ.** | Short form for 'minutes' should be an abbreviation like 'λ.'. |
| `balance.openPlans` | Ανοιχτά τιμολόγια και υπόλοιπο | **Άνοιγμα τιμολογίων και υπολοίπου** | Grammar: 'Ανοιχτά' (adjective) should be 'Άνοιγμα' (verb). 'Δασμοί' should be 'Τιμολόγια'. |
| `balance.tariffs` | Δασμοί | **Τιμολόγια** | Wrong word sense: 'Δασμοί' means customs duties, not pricing plans. |
| `tier.trial` | Δίκη | **Δοκιμή** | Wrong word sense: 'Δίκη' means court trial, not free trial period. |
| `tier.plus` | Συν | **Plus** | Brand name 'Plus' should be preserved, not translated. |
| `tier.standard` | Πρότυπο | **Standard** | Brand name 'Standard' should be preserved, not translated. |
| `tier.standardYearly` | Ετήσια | **Yearly** | Brand name 'Yearly' should be preserved, not translated. |
| `moreSheet.userFallback` | Μεταχειριζόμενος | **Χρήστης** | Wrong word sense: 'Μεταχειριζόμενος' means used (adjective), not user. |
| `moreSheet.enterprise.sub` | Κλειδί Gemini, Ροή Αποστολών, ετικέτες, CRM | **Κλειδί Gemini, Quest Flow, ετικέτες, CRM** | Brand name 'Quest Flow' should be preserved, not translated. |
| `call.geminiLive` | Δίδυμοι Ζωντανά | **Gemini Live** | Brand name 'Gemini' should be preserved, not translated. |
| `call.toPlayground` | 🎯 Προς την χωματερή | **🎯 Προς το πεδίο δοκιμών** | Wrong word sense: 'χωματερή' means landfill, 'πεδίο δοκιμών' for testing ground. |
| `call.validating` | Δοκιμή ασφαλούς σύνδεσης VibeVox… | **Επαλήθευση ασφαλούς σύνδεσης VibeVox…** | Wrong word sense: 'Δοκιμή' (test) vs 'Επαλήθευση' (validation/checking). |
| `coach.close` | Κοντά | **Κλείσιμο** | Wrong word sense: 'Κοντά' (near) vs 'Κλείσιμο' (close). |
| `coach.tones.short` | Μικρός | **Σύντομα** | Wrong word sense: 'Μικρός' (short, adjective) vs 'Σύντομα' (concisely, adverb). |
| `coach.tones.deep` | Βαθύς | **Βαθιά** | Wrong word sense: 'Βαθύς' (deep, adjective) vs 'Βαθιά' (deeply, adverb). |
| `coach.tones.empathic` | Ενσυναισθητικός | **Ενσυναισθητικά** | Wrong word sense: 'Ενσυναισθητικός' (empathic, adjective) vs 'Ενσυναισθητικά' (empathically, adverb). |
| `roomActions.translation.disableSub` | Τα πρακτικά δεν θα διαγράφονται πλέον | **Τα λεπτά δεν θα χρεώνονται πλέον** | Wrong word sense: 'πρακτικά' (meeting minutes) vs 'λεπτά' (time minutes). 'διαγράφονται' (deleted) vs 'χρεώνονται' (charged). |
| `billing.paywallNoSub` | Για να δημιουργήσετε ένα δωμάτιο, εγγραφείτε για ένα σχέδιο | **Για να δημιουργήσετε ένα δωμάτιο, επιλέξτε ένα πρόγραμμα** | 'σχέδιο' (design/plan) is less precise than 'πρόγραμμα' (plan/tier) for pricing. |
| `billing.paywallLowBalance` | Δεν υπάρχουν λεπτά στο υπόλοιπό σας - εγγραφείτε σε ένα πρόγραμμα ή αγοράστε περισσότερα | **Δεν υπάρχουν λεπτά στο υπόλοιπό σας - επιλέξτε ένα πρόγραμμα ή αγοράστε περισσότερα** | 'εγγραφείτε σε ένα πρόγραμμα' (enroll in a program) is less direct than 'επιλέξτε ένα πρόγραμμα' (choose a plan). |
| `partner.title` | Partner program | **Πρόγραμμα συνεργασίας** | English phrase 'Partner program' should be translated. |
| `partner.subtitle` | Share your link and earn | **Μοιραστείτε τον σύνδεσμό σας και κερδίστε** | English phrase 'Share your link and earn' should be translated. |
| `partner.yourLink` | Your link | **Ο σύνδεσμός σας** | English phrase 'Your link' should be translated. |
| `partner.copy` | Copy | **Αντιγραφή** | English word 'Copy' should be translated. |
| `partner.copied` | ✓ Link copied | **✓ Ο σύνδεσμος αντιγράφηκε** | English phrase 'Link copied' should be translated. |
| `partner.stats.clicks` | Clicks | **Κλικ** | English word 'Clicks' should be translated. |
| `partner.stats.registrations` | Sign-ups | **Εγγραφές** | English word 'Sign-ups' should be translated. |
| `partner.stats.paid` | Payments | **Πληρωμές** | English word 'Payments' should be translated. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} χρήστες · {{minutes}} λεπτά** | English words 'users' and 'min' should be translated. |
| `partner.terms` | Program terms | **Όροι προγράμματος** | English phrase 'Program terms' should be translated. |
| `partner.contact` | Contact us | **Επικοινωνήστε μαζί μας** | English phrase 'Contact us' should be translated. |
| `partner.termsModalTitle` | Partner program terms | **Όροι προγράμματος συνεργασίας** | English phrase 'Partner program terms' should be translated. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Οι όροι του προγράμματος δεν έχουν οριστεί ακόμη. Παρακαλούμε επικοινωνήστε με τον SuperAdmin.** | English sentence should be translated. |
| `partner.loadError` | Failed to load partner data | **Αποτυχία φόρτωσης δεδομένων συνεργασίας** | English phrase should be translated. |
| `sip.savingShort` | Οικονομία… | **Αποθηκεύεται…** | Wrong word sense: 'Οικονομία' (economy) vs 'Αποθηκεύεται' (saving data). |
| `sip.incoming.pausedHint` | Ενεργοποιήστε τη λήψη για να ξεκινήσει το VibeVox την προώθηση εισερχόμενων κλήσεων. | **Ενεργοποιήστε τη λήψη για να ξεκινήσει το VibeVox τη μετάφραση εισερχόμενων κλήσεων.** | Wrong word sense: 'προώθηση' (forwarding) vs 'μετάφραση' (translation). |
| `sip.incoming.reissue` | Ανατύπωση | **Επανέκδοση** | Wrong word sense: 'Ανατύπωση' (reprint) vs 'Επανέκδοση' (reissue). |
| `sip.tenantOnly.title` | Οι αγωγοί SIP διαμορφώνονται σε επίπεδο μισθωτή | **Οι κορμοί SIP διαμορφώνονται σε επίπεδο μισθωτή** | Wrong word sense: 'αγωγοί' (pipes) vs 'κορμοί' (trunks). |
| `enterprise.common.save` | Εκτός | **Αποθήκευση** | Wrong word sense: 'Εκτός' (outside/except) vs 'Αποθήκευση' (save). |
| `enterprise.common.saving` | Οικονομία… | **Αποθηκεύεται…** | Wrong word sense: 'Οικονομία' (economy) vs 'Αποθηκεύεται' (saving data). |
| `enterprise.gemini.aiStudioLink` | Στούντιο Τεχνητής Νοημοσύνης | **AI Studio** | Brand name 'AI Studio' should be preserved, not translated. |
| `enterprise.gemini.savingLabel` | Οικονομία… | **Αποθηκεύεται…** | Wrong word sense: 'Οικονομία' (economy) vs 'Αποθηκεύεται' (saving data). |
| `enterprise.gemini.telegram.leadStartCmd` | /αρχή | **/start** | Command '/start' should be preserved, not translated. |
| `enterprise.gemini.telegram.saveLabel` | Εκτός | **Αποθήκευση** | Wrong word sense: 'Εκτός' (outside/except) vs 'Αποθήκευση' (save). |
| `enterprise.gemini.telegram.savingLabel` | Οικονομία… | **Αποθηκεύεται…** | Wrong word sense: 'Οικονομία' (economy) vs 'Αποθηκεύεται' (saving data). |
| `enterprise.gemini.telegram.testingLabel` | Κράνος… | **Στέλνουμε…** | Wrong word sense: 'Κράνος' (helmet) vs 'Στέλνουμε' (sending). |
| `enterprise.prompt.subtitle` | Προτροπή και βάση γνώσεων για μεταγραφή μόνο σε βιντεοκλάμπ | **Προτροπή και βάση γνώσεων μόνο για μεταγραφή σε βιντεοδωμάτια** | Wrong word sense: 'βιντεοκλάμπ' (video clubs) vs 'βιντεοδωμάτια' (video rooms). |
| `enterprise.prompt.savingPromptLabel` | Οικονομία… | **Αποθηκεύεται…** | Wrong word sense: 'Οικονομία' (economy) vs 'Αποθηκεύεται' (saving data). |
| `enterprise.questFlow.heading` | Ροή Αποστολών | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.apiKeyLabel` | Εισερχόμενο Κλειδί API (Φορέας) | **Inbound API Key (Bearer)** | Brand names 'Inbound API Key' and 'Bearer' should be preserved. |
| `enterprise.questFlow.promptLabel` | Προτροπή Συστήματος Ροής Αποστολών | **Προτροπή Συστήματος Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.kbLabel` | Βάση γνώσεων ροής Quest | **Βάση γνώσεων Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.keysHeading` | Κλειδιά API Quest Flow | **API-κλειδιά Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. 'API' should also be preserved. |
| `enterprise.questFlow.errDelete` | Delete error | **Σφάλμα διαγραφής** | English phrase 'Delete error' should be translated. |
| `enterprise.questFlow.deleteTitle` | Delete | **Διαγραφή** | English word 'Delete' should be translated. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Διαγραφή κλειδιού;** | English phrase 'Delete key?' should be translated. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Το κλειδί θα διαγραφεί οριστικά. Το Quest Flow θα σταματήσει να λειτουργεί μέσω αυτού — θα χρειαστεί να δημιουργήσετε ένα νέο κλειδί και να το αντικαταστήσετε στη ροή.** | English sentence should be translated. 'Quest Flow' preserved. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Διαγραφή** | English word 'Delete' should be translated. |
| `enterprise.questFlow.promptLead1` | Καθορίζει τον ΠΩΣ η Τεχνητή Νοημοσύνη επικοινωνεί με τους πελάτες μέσω της Ροής Αποστολών: τόνος, στυλ, τι πρέπει να προσδιοριστεί. | **Καθορίζει τον ΠΩΣ η Τεχνητή Νοημοσύνη επικοινωνεί με τους πελάτες μέσω του Quest Flow: τόνος, στυλ, τι πρέπει να προσδιοριστεί.** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.savingPromptLabel` | Οικονομία… | **Αποθηκεύεται…** | Wrong word sense: 'Οικονομία' (economy) vs 'Αποθηκεύεται' (saving data). |
| `enterprise.questFlow.savePromptLabel` | Εκτός | **Αποθήκευση** | Wrong word sense: 'Εκτός' (outside/except) vs 'Αποθήκευση' (save). |
| `enterprise.questFlow.successPromptSaved` | Η προτροπή ροής αποστολής αποθηκεύτηκε. | **Η προτροπή Quest Flow αποθηκεύτηκε.** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.kbHeading` | Βάση γνώσεων για τη ροή αποστολών | **Βάση γνώσεων για το Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.chatwoot.save` | Εκτός | **Αποθήκευση** | Wrong word sense: 'Εκτός' (outside/except) vs 'Αποθήκευση' (save). |
| `enterprise.chatwoot.savingLabel` | Οικονομία… | **Αποθηκεύεται…** | Wrong word sense: 'Οικονομία' (economy) vs 'Αποθηκεύεται' (saving data). |
| `enterprise.chatwoot.saveLabel` | Εκτός | **Αποθήκευση** | Wrong word sense: 'Εκτός' (outside/except) vs 'Αποθήκευση' (save). |
| `insights.recalc` | Αφηγούμαι | **Επαναϋπολογισμός** | Wrong word sense: 'Αφηγούμαι' (narrate) vs 'Επαναϋπολογισμός' (recalculate). |
| `insights.sentiment` | Κλειδί | **Διάθεση** | Wrong word sense: 'Κλειδί' (key) vs 'Διάθεση' (sentiment/mood). |
| `insights.analyzedReplies_one` | {{count}} αντίγραφο αναλύθηκε | **{{count}} απάντηση αναλύθηκε** | Wrong word sense: 'αντίγραφο' (copy) vs 'απάντηση' (reply/utterance). |
| `insights.analyzedReplies_few` | {{count}} αναλυμένα αντίγραφα | **{{count}} αναλυμένες απαντήσεις** | Wrong word sense: 'αντίγραφα' (copies) vs 'απαντήσεις' (replies/utterances). |
| `insights.analyzedReplies_many` | {{count}} αναλυμένα αντίγραφα | **{{count}} αναλυμένες απαντήσεις** | Wrong word sense: 'αντίγραφα' (copies) vs 'απαντήσεις' (replies/utterances). |
| `insights.analyzedReplies_other` | {{count}} αναλυμένα αντίγραφα | **{{count}} αναλυμένες απαντήσεις** | Wrong word sense: 'αντίγραφα' (copies) vs 'απαντήσεις' (replies/utterances). |
| `lobby.tosAgree` | Με την εγγραφή σας συμφωνείτε να | **Με την εγγραφή σας συμφωνείτε με τους** | Grammar: 'συμφωνείτε να' (agree to) vs 'συμφωνείτε με τους' (agree with the). |
| `lobby.audioConsent` | , και επίσης συναινώ στην επεξεργασία του ήχου για μετάφραση. | **, και επίσης συναινείτε στην επεξεργασία του ήχου για μετάφραση.** | Grammar: 'συναινώ' (1st person singular) vs 'συναινείτε' (2nd person plural). |
| `paywall.buyPlus` | Επιπλέον — 19€/μήνα (60 λεπτά) | **Plus — 19€/μήνα (60 λεπτά)** | Brand name 'Plus' should be preserved, not translated. |
| `paywall.buyStandard` | Στάνταρ – 29€/μήνα (120 λεπτά) | **Standard – 29€/μήνα (120 λεπτά)** | Brand name 'Standard' should be preserved, not translated. |
| `paywall.subscribe` | Σχέδιο | **Εγγραφή** | Wrong word sense: 'Σχέδιο' (plan/design) vs 'Εγγραφή' (subscribe). |
| `paywall.topupCta` | Αγορά {{count}} ελάχιστο · €{{price}} | **Αγορά {{count}} λεπτά · €{{price}}** | Wrong word sense: 'ελάχιστο' (minimum) vs 'λεπτά' (minutes). |
| `paywall.topupPlusLine` | Συν χρέωση (συμπεριλαμβάνεται {{count}} λεπτό) | **Πρόγραμμα Plus (συμπεριλαμβάνεται {{count}} λεπτό)** | Brand name 'Plus' should be preserved. 'χρέωση' (charge) vs 'πρόγραμμα' (plan). |
| `paywall.topupFreeLine` | ↳ {{count}} λεπτά δωρεάν με χρέωση | **↳ {{count}} λεπτά δωρεάν με το πρόγραμμα** | Wrong word sense: 'χρέωση' (charge) vs 'πρόγραμμα' (plan). |
| `paywall.topupAddon` | Επιπλέον αγορά {{count}} ελάχιστο × €0,17 | **Επιπλέον αγορά {{count}} λεπτά × €0,17** | Wrong word sense: 'ελάχιστο' (minimum) vs 'λεπτά' (minutes). |
| `paywall.close` | Κοντά | **Κλείσιμο** | Wrong word sense: 'Κοντά' (near) vs 'Κλείσιμο' (close). |
| `postCallInsights.analyzing` | Ας αναλύσουμε την συζήτηση... | **Αναλύουμε τη συζήτηση...** | Grammar: 'Ας αναλύσουμε' (Let's analyze) vs 'Αναλύουμε' (We are analyzing). |
| `billingPage.balanceMinutes` | πρακτικά | **λεπτά** | Wrong word sense: 'πρακτικά' (meeting minutes) vs 'λεπτά' (time minutes). |
| `billingPage.tierLabel` | Τιμή | **Πρόγραμμα** | Wrong word sense: 'Τιμή' (price) vs 'Πρόγραμμα' (plan/tier). |
| `billingPage.resume` | Περίληψη | **Επανενεργοποίηση** | Wrong word sense: 'Περίληψη' (summary) vs 'Επανενεργοποίηση' (resume/reactivate). |
| `billingPage.topupCarried` | Αναβλήθηκε | **Μεταφέρθηκε** | Wrong word sense: 'Αναβλήθηκε' (postponed) vs 'Μεταφέρθηκε' (carried over). |
| `billingPage.minutesShort` | πρακτικά | **λεπτά** | Wrong word sense: 'πρακτικά' (meeting minutes) vs 'λεπτά' (time minutes). |
| `billingPage.tierPlusName` | Συν | **Plus** | Brand name 'Plus' should be preserved, not translated. |
| `billingPage.tierStandardName` | Πρότυπο | **Standard** | Brand name 'Standard' should be preserved, not translated. |
| `billingPage.ctaSubscribePlus` | Αποκτήστε Plus | **Εγγραφή στο Plus** | More appropriate verb for 'subscribe'. 'Plus' preserved. |
| `billingPage.ctaSubscribeStandard` | Πρότυπο παραγγελίας | **Εγγραφή στο Standard** | More appropriate verb for 'subscribe'. 'Standard' preserved. |
| `billingPage.languagesCount_few` | {{count}} γλώσσα | **{{count}} γλώσσες** | Incorrect plural form for 'γλώσσα' (language). |
| `billingPage.presetHours` | {{count}}h | **{{count}} ώρες** | Unit 'h' should be translated to 'ώρες'. |
| `billingPage.presetMinutes` | {{count}}m | **{{count}} λεπτά** | Unit 'm' should be translated to 'λεπτά'. |
| `billingPage.renewsOn` | επέκταση {{date}} | **ανανέωση {{date}}** | Wrong word sense: 'επέκταση' (extension) vs 'ανανέωση' (renewal). |
| `billingPage.cancelDetailMinutesAvailable` | Τα λεπτά ομιλίας με χρέωση είναι διαθέσιμα μέχρι αυτήν την ημερομηνία. Μπορούν να αγοραστούν επιπλέον λεπτά. | **Τα λεπτά του προγράμματος είναι διαθέσιμα μέχρι αυτήν την ημερομηνία. Μπορούν να αγοραστούν επιπλέον λεπτά.** | Wrong word sense: 'χρέωση' (charge) vs 'προγράμματος' (plan). |

⚠ 10 fix(es) skipped (no-op, missing path, or would break placeholders).
