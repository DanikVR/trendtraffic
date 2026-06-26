# LLM Review: French (fr)

**Model:** gemini-2.5-flash  
**Took:** 242.2s  
**Fixes proposed:** 260 (valid after placeholder-check: 250)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.rooms` | Chambres | **Salles** | Incorrect word sense: 'Chambres' for bedrooms, 'Salles' for meeting rooms. |
| `nav.admin` | panneau d'administration | **Panneau d'administration** | Missing definite article. |
| `nav.createRoom` | Créer une pièce | **Créer une salle** | Incorrect word sense: 'Pièce' for rooms in a house, 'Salle' for meeting rooms. |
| `nav.home` | Maison | **Accueil** | 'Maison' is a noun; 'Accueil' is the correct term for a home page link. |
| `rooms.tabs.video` | appels vidéo | **Appels vidéo** | Missing definite article. |
| `rooms.tabs.questFlow` | Flux de quête | **Quest Flow** | Brand name should not be translated. |
| `rooms.nothingFound` | Rien trouvé | **Aucun résultat** | More natural for 'Nothing found' in search context. |
| `rooms.noRoomsInCategory` | Il n'y a pas encore de chambres dans cette catégorie. | **Il n'y a pas encore de salles dans cette catégorie.** | Incorrect word sense: 'Chambres' for bedrooms, 'Salles' for meeting rooms. |
| `rooms.actions.open` | Se connecter | **Entrer** | 'Se connecter' implies login; 'Entrer' is for joining a room. |
| `rooms.actions.rename` | Rebaptiser | **Renommer** | 'Rebaptiser' is not the correct word for renaming a room. |
| `rooms.toasts.joined` | Quelqu'un est entré dans la pièce "{{room}}" | **Quelqu'un est entré dans la salle "{{room}}"** | Incorrect word sense: 'Pièce' for rooms in a house, 'Salle' for meeting rooms. |
| `rooms.confirmDelete.title` | Supprimer définitivement la pièce ? | **Supprimer définitivement la salle ?** | Incorrect word sense: 'Pièce' for rooms in a house, 'Salle' for meeting rooms. |
| `common.back` | Dos | **Retour** | 'Dos' is a noun (back of body); 'Retour' is correct for 'back' (navigation). |
| `common.edit` | Changement | **Modifier** | 'Changement' is a noun; 'Modifier' is the correct verb for 'edit'. |
| `common.tryAgain` | Répéter | **Réessayer** | 'Répéter' means to repeat; 'Réessayer' means to try again. |
| `common.success` | Prêt | **Succès** | 'Prêt' means ready; 'Succès' is better for 'Done/Success'. |
| `balance.label` | Équilibre | **Solde** | 'Équilibre' is physical balance; 'Solde' is financial balance. |
| `balance.openPlans` | Tarifs ouverts et équilibre | **Ouvrir les tarifs et le solde** | 'Équilibre' is wrong word sense; 'Tarifs ouverts' is grammatically awkward. |
| `tier.trial` | Procès | **Essai** | WRONG WORD SENSE: 'Procès' means legal trial; 'Essai' is for a trial period. |
| `tier.standardYearly` | Annuel | **Yearly** | Brand name should not be translated. |
| `tier.enterprise` | Entreprise | **Enterprise** | Brand name should not be translated. |
| `languagePicker.noResults` | Rien trouvé | **Aucun résultat** | More natural for 'Nothing found' in search context. |
| `moreSheet.sip.sub` | Installation des coffres | **Configuration des jonctions** | 'Coffres' is wrong word sense; 'Jonctions' is correct for SIP trunks. |
| `moreSheet.enterprise.label` | Paramètres d'entreprise | **Paramètres Enterprise** | Brand name should not be translated. |
| `moreSheet.enterprise.sub` | Clé Gemini, flux de quête, étiquettes, CRM | **Clé Gemini, Quest Flow, étiquettes, CRM** | Brand name 'Quest Flow' should not be translated. |
| `moreSheet.admin.label` | panneau d'administration | **Panneau d'administration** | Missing definite article. |
| `call.you` | Toi | **Vous** | 'Toi' is informal; 'Vous' is more appropriate for a general UI. |
| `call.muted` | Aucun son | **Muet** | 'Aucun son' is too literal; 'Muet' is correct for muted audio. |
| `call.toPlayground` | 🎯 À la décharge | **🎯 Au Playground** | 'Décharge' is wrong word sense; 'Playground' is a feature name. |
| `call.sentToPlayground` | ✅ La phrase a été envoyée au terrain d'entraînement ! | **✅ Phrase envoyée au Playground d'entraînement !** | 'Terrain d'entraînement' is long; 'Playground' is a feature name. |
| `call.playgroundTip` | Envoyer une phrase au terrain d'entraînement de l'IA | **Envoyer une phrase au Playground d'entraînement de l'IA** | 'Terrain d'entraînement' is long; 'Playground' is a feature name. |
| `call.micOn` | Éteignez le microphone | **Désactiver le microphone** | Imperative verb; should be infinitive for a button label. |
| `call.micOff` | Activez le microphone | **Activer le microphone** | Imperative verb; should be infinitive for a button label. |
| `call.camOn` | Éteignez la caméra | **Désactiver la caméra** | Imperative verb; should be infinitive for a button label. |
| `call.camOff` | Allumez la caméra | **Activer la caméra** | Imperative verb; should be infinitive for a button label. |
| `call.screenshareOff` | Arrêtez le partage d'écran | **Arrêter le partage d'écran** | Imperative verb; should be infinitive for a button label. |
| `call.more` | En plus | **Plus** | 'En plus' is wrong word sense; 'Plus' is common for 'More' in UI. |
| `call.hangUp` | Fin de l'appel | **Terminer l'appel** | Noun phrase; should be a verb phrase for a button label. |
| `call.backToRooms` | Retour à la liste des chambres | **Retour à la liste des salles** | Incorrect word sense: 'Chambres' for bedrooms, 'Salles' for meeting rooms. |
| `call.connecting` | Connexion à la chambre… | **Connexion à la salle…** | Incorrect word sense: 'Chambre' for bedrooms, 'Salle' for meeting rooms. |
| `coach.help` | Aidez-nous à répondre | **Aider à répondre** | Imperative verb; should be infinitive for a button label. |
| `coach.ask` | Demandez à l'IA | **Demander à l'IA** | Imperative verb; should be infinitive for a button label. |
| `coach.copy` | Copie | **Copier** | 'Copie' is a noun; 'Copier' is the correct verb for a button label. |
| `coach.pin` | Épinglez-le | **Épingler** | Imperative verb; should be infinitive for a button label. |
| `coach.tones.formal` | Officiellement | **Formel** | Adverb; should be adjective or noun phrase. |
| `coach.tones.scientific` | Scientifiquement | **Scientifique** | Adverb; should be adjective or noun phrase. |
| `coach.tonePrompts.formal` | Répondez de manière formelle et polie, sans hésitation. | **Répondez de manière formelle et polie.** | Extra words not in source. |
| `roomActions.translation.enableSub` | Le robot retournera dans la pièce | **Le robot retournera dans la salle** | Incorrect word sense: 'Pièce' for rooms in a house, 'Salle' for meeting rooms. |
| `roomActions.translation.disableSub` | Les procès-verbaux ne seront plus annulés. | **Les minutes ne seront plus décomptées.** | 'Procès-verbaux' is wrong word sense; 'décomptées' is correct for minutes being used. |
| `roomActions.copyLink` | Copiez le lien vers la salle | **Copier le lien vers la salle** | Imperative verb; should be infinitive for a button label. |
| `roomActions.deleteSub` | Clôturez la réunion et effacez toutes les données. | **Clôturer la réunion et effacer toutes les données.** | Imperative verb; should be infinitive for a button label. |
| `billing.quotaExhausted` | La traduction est terminée. | **Les minutes de traduction sont épuisées.** | Wrong word sense; 'terminée' implies the process is done, not the quota. |
| `billing.createRoomFailed` | Impossible de créer de l'espace | **Impossible de créer une salle** | 'Espace' is too generic; 'salle' is specific to rooms. |
| `settings.themeLightSub` | Aurore boréale (lumière) | **Cloud Aurora (Clair)** | Brand name 'Cloud Aurora' should not be translated. 'Lumière' is a noun, 'Clair' is an adjective. |
| `settings.themeDarkSub` | Aurore abyssale (Sombre) | **Abyss Aurora (Sombre)** | Brand name 'Abyss Aurora' should not be translated. |
| `partner.title` | Partner program | **Programme de partenariat** | English term; should be translated to French. |
| `partner.subtitle` | Share your link and earn | **Partagez votre lien et gagnez** | English term; should be translated to French. |
| `partner.yourLink` | Your link | **Votre lien** | English term; should be translated to French. |
| `partner.copy` | Copy | **Copier** | English term; should be translated to French. |
| `partner.copied` | ✓ Link copied | **✓ Lien copié** | English term; should be translated to French. |
| `partner.stats.clicks` | Clicks | **Clics** | English term; should be translated to French. |
| `partner.stats.registrations` | Sign-ups | **Inscriptions** | English term; should be translated to French. |
| `partner.stats.paid` | Payments | **Paiements** | English term; should be translated to French. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} utilisateurs · {{minutes}} min** | English term 'users' should be translated. |
| `partner.terms` | Program terms | **Conditions du programme** | English term; should be translated to French. |
| `partner.contact` | Contact us | **Nous contacter** | English term; should be translated to French. |
| `partner.termsModalTitle` | Partner program terms | **Conditions du programme de partenariat** | English term; should be translated to French. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Les conditions du programme ne sont pas encore définies. Veuillez contacter le SuperAdmin.** | English terms; should be translated to French. |
| `partner.loadError` | Failed to load partner data | **Échec du chargement des données de partenariat** | English term; should be translated to French. |
| `toneMenu.explainIn` | Expliquez sur ce ton | **Expliquer sur ce ton** | Imperative verb; should be infinitive for a button label. |
| `toneMenu.tone` | Tonifier | **Ton** | 'Tonifier' is wrong word sense; 'Ton' is correct for tone of voice. |
| `sip.subtitle` | Configuration des lignes pour les appels entrants et sortants | **Configuration des jonctions pour les appels entrants et sortants** | 'Lignes' is less precise than 'jonctions' for SIP trunks. |
| `sip.newTrunk` | Nouvelle ligne SIP | **Nouvelle jonction SIP** | 'Ligne' is less precise than 'jonction' for SIP trunks. |
| `sip.editTrunk` | Modifier les paramètres du coffre | **Modifier les paramètres de la jonction** | 'Coffre' is wrong word sense; 'Jonction' is correct for SIP trunks. |
| `sip.loginLabel` | Nom d'utilisateur (connexion SIP) | **Nom d'utilisateur (login SIP)** | 'Connexion SIP' is a noun; 'login SIP' is more common as a technical term. |
| `sip.loginShort` | Se connecter | **Login** | 'Se connecter' is a verb; 'Login' is the noun. |
| `sip.trunkId` | ID du tronc | **ID de la jonction** | 'Tronc' is wrong word sense; 'Jonction' is correct for SIP trunks. |
| `sip.savingShort` | Économie… | **Enregistrement…** | 'Économie' is wrong word sense; 'Enregistrement' is correct for saving data. |
| `sip.createTrunk` | Créer un coffre | **Créer une jonction** | 'Coffre' is wrong word sense; 'Jonction' is correct for SIP trunks. |
| `sip.deletingShort` | Suppression… | **Suppression en cours…** | Noun; should be a verb phrase for an ongoing action. |
| `sip.incoming.create` | Créez une adresse SIP pour les appels entrants | **Créer une adresse SIP pour les appels entrants** | Imperative verb; should be infinitive for a button label. |
| `sip.incoming.active` | Nous recevons des appels entrants. | **La réception des appels entrants est active** | Grammatically awkward; should be a more direct statement. |
| `sip.incoming.activeHint` | Le traducteur Bridge écoute ce qui se passe dans la pièce. Chaque appel est traduit en temps réel. | **Le traducteur Bridge écoute ce qui se passe dans la salle. Chaque appel est traduit en temps réel.** | Incorrect word sense: 'Pièce' for rooms in a house, 'Salle' for meeting rooms. |
| `sip.incoming.stop` | Arrêt | **Arrêter** | 'Arrêt' is a noun; should be a verb for a button label. |
| `sip.incoming.copy` | Copie | **Copier** | 'Copie' is a noun; should be a verb for a button label. |
| `sip.incoming.reissue` | Rééditer | **Regénérer** | 'Rééditer' is wrong word sense; 'Regénérer' is correct for reissuing credentials. |
| `sip.incoming.toggleFailed` | Impossible de changer de réception | **Impossible de basculer la réception** | 'Changer de réception' is awkward; 'basculer' is more precise. |
| `sip.outbound.noTrunkTitle` | Commencez par configurer une liaison SIP sortante. | **Commencez par configurer une jonction SIP sortante.** | 'Liaison' is less precise than 'jonction' for SIP trunks. |
| `sip.outbound.noTrunkHint` | Remplissez le formulaire « Nouvelle ligne SIP » en haut de la page ; VibeVox utilisera votre fournisseur SIP (Zadarma, OnlinePBX, etc.) pour les appels sortants. | **Remplissez le formulaire « Nouvelle jonction SIP » en haut de la page ; VibeVox utilisera votre fournisseur SIP (Zadarma, OnlinePBX, etc.) pour les appels sortants.** | 'Ligne' is less precise than 'jonction' for SIP trunks. |
| `sip.outbound.configureFirst` | Commencez par configurer une liaison SIP sortante (formulaire ci-dessus). | **Commencez par configurer une jonction SIP sortante (formulaire ci-dessus).** | 'Liaison' is less precise than 'jonction' for SIP trunks. |
| `sip.outbound2.callButton` | Appel | **Appeler** | 'Appel' is a noun; should be a verb for a button label. |
| `sip.outbound2.callingButton` | Nous vous appelons... | **Appel en cours…** | 'Nous vous appelons' is too specific; 'Appel en cours' is more general. |
| `sip.howTo.step1` | Obtenez les identifiants de votre trunk SIP auprès de votre fournisseur (Zadarma, OnlinePBX, Asterisk). | **Obtenez les identifiants de votre jonction SIP auprès de votre fournisseur (Zadarma, OnlinePBX, Asterisk).** | English term 'trunk SIP' should be translated to 'jonction SIP'. |
| `sip.howTo.step3` | VibeVox créera automatiquement une liaison SIP sortante dans LiveKit Cloud. | **VibeVox créera automatiquement une jonction SIP sortante dans LiveKit Cloud.** | 'Liaison' is less precise than 'jonction' for SIP trunks. |
| `sip.toasts.saveFailed` | Impossible de sauver le coffre | **Impossible d'enregistrer la jonction** | 'Coffre' is wrong word sense; 'Jonction' is correct for SIP trunks. |
| `sip.toasts.deleted` | Le coffre a été supprimé. | **La jonction a été supprimée.** | 'Coffre' is wrong word sense; 'Jonction' is correct for SIP trunks. |
| `sip.toasts.deleteFailed` | Échec de la suppression du tronc | **Échec de la suppression de la jonction** | 'Tronc' is wrong word sense; 'Jonction' is correct for SIP trunks. |
| `sip.tenantOnly.title` | Les liaisons SIP sont configurées au niveau du locataire. | **Les jonctions SIP sont configurées au niveau du locataire.** | 'Liaisons' is less precise than 'jonctions' for SIP trunks. |
| `sip.tenantOnly.hint2` | Connectez-vous en tant qu'utilisateur normal possédant son propre tenantId pour créer un trunk. | **Connectez-vous en tant qu'utilisateur normal possédant son propre tenantId pour créer une jonction.** | English term 'trunk' should be translated to 'jonction'. |
| `sip.connected` | La liaison SIP est enregistrée et synchronisée avec LiveKit. | **La jonction SIP est enregistrée et synchronisée avec LiveKit.** | 'Liaison' is less precise than 'jonction' for SIP trunks. |
| `sip.danger.deleteTrunk` | Supprimer le coffre | **Supprimer la jonction** | 'Coffre' is wrong word sense; 'Jonction' is correct for SIP trunks. |
| `sip.danger.deleteTrunkHint` | La configuration sera supprimée. Les appels sortants seront interrompus jusqu'à ce que vous recréiez la liaison. | **La configuration sera supprimée. Les appels sortants seront interrompus jusqu'à ce que vous recréiez la jonction.** | 'Liaison' is less precise than 'jonction' for SIP trunks. |
| `sip.danger.deleteInboundHint` | La règle de réception et de répartition des appels entrants LiveKit sera supprimée. Vous ne recevrez plus d'appels entrants. | **La jonction entrante et la règle de répartition LiveKit seront supprimées. Vous ne recevrez plus d'appels entrants.** | English term 'inbound trunk' should be translated to 'jonction entrante'. |
| `sip.danger.reissueHint` | Veuillez renouveler votre identifiant et votre mot de passe pour l'adresse SIP. Les anciennes informations ne seront plus valides. | **Cela réémettra l'identifiant et le mot de passe pour l'adresse SIP. Les anciennes informations ne seront plus valides.** | Imperative verb; should be a statement. |
| `sip.confirm.deleteTrunkBody` | Cette action est irréversible. Une fois la ligne supprimée, les appels sortants seront interrompus jusqu'à la création d'une nouvelle ligne. | **Cette action est irréversible. Une fois la jonction supprimée, les appels sortants seront interrompus jusqu'à la création d'une nouvelle jonction.** | 'Ligne' is less precise than 'jonction' for SIP trunks. |
| `sip.confirm.deleteInboundBody` | Cette action est irréversible. La règle de trafic entrant et de répartition dans LiveKit Cloud sera supprimée. | **Cette action est irréversible. La jonction entrante et la règle de répartition dans LiveKit Cloud seront supprimées.** | English term 'inbound trunk' should be translated to 'jonction entrante'. |
| `enterprise.page.title` | Paramètres d'entreprise | **Paramètres Enterprise** | Brand name should not be translated. |
| `enterprise.page.upsellTitle` | Cette section est disponible avec le forfait Entreprise. | **Cette section est disponible avec le forfait Enterprise.** | Brand name should not be translated. |
| `enterprise.page.upsellBody` | Ici, vous pouvez configurer : une clé API Gemini personnelle, une invite et une base de connaissances, l’intégration avec Quest Flow + bot Telegram et la connexion à Chatwoot CRM. | **Ici, vous pouvez configurer : une clé API Gemini personnelle, une invite et une base de connaissances, l’intégration avec Quest Flow + bot Telegram et la connexion à Chatwoot CRM.** | Brand name 'Quest Flow' should not be translated. |
| `enterprise.page.upsellCta` | Consultez les tarifs | **Consulter les tarifs** | Imperative verb; should be infinitive for a button label. |
| `enterprise.tabs.prompts` | Conseils | **Prompts** | 'Conseils' is wrong word sense; 'Prompts' is the correct technical term. |
| `enterprise.tabs.questFlow` | Flux de quête | **Quest Flow** | Brand name should not be translated. |
| `enterprise.common.savedPlaceholder` | Enregistré (saisissez « nouveau » pour remplacer) | **Enregistré (saisissez-en un nouveau pour remplacer)** | 'nouveau' is not a placeholder and should not be quoted as such. |
| `enterprise.common.saving` | Économie… | **Enregistrement…** | 'Économie' is wrong word sense; 'Enregistrement' is correct for saving data. |
| `enterprise.common.copy` | Copie | **Copier** | 'Copie' is a noun; should be a verb for a button label. |
| `enterprise.apiKey.savedPlaceholder` | Enregistré (saisissez « nouveau » pour remplacer) | **Enregistré (saisissez-en un nouveau pour remplacer)** | 'nouveau' is not a placeholder and should not be quoted as such. |
| `enterprise.apiKey.copy` | Copie | **Copier** | 'Copie' is a noun; should be a verb for a button label. |
| `enterprise.gemini.leadSuffix` | Utilisé à la place du code global pour tous les appels Gemini sur votre compte. | **Utilisé à la place de la clé globale pour tous les appels Gemini sur votre compte.** | 'Code global' is wrong word sense; 'clé globale' is correct. |
| `enterprise.gemini.aiStudioLink` | Studio d'IA | **AI Studio** | Brand name should not be translated. |
| `enterprise.gemini.savingLabel` | Économie… | **Enregistrement…** | 'Économie' is wrong word sense; 'Enregistrement' is correct for saving data. |
| `enterprise.gemini.telegram.leadStartCmd` | /commencer | **/start** | Command should not be translated. |
| `enterprise.gemini.telegram.tokenLabel` | jeton du bot Telegram | **Jeton du bot Telegram** | Missing definite article. |
| `enterprise.gemini.telegram.successSavedWithBroadcast` | ✓ Bot @{{username}} enregistré. Message envoyé aux abonnés de {{sent}}. | **✓ Bot @{{username}} enregistré. Message envoyé à {{sent}} abonnés.** | Grammatically awkward. |
| `enterprise.gemini.telegram.savingLabel` | Économie… | **Enregistrement…** | 'Économie' is wrong word sense; 'Enregistrement' is correct for saving data. |
| `enterprise.gemini.telegram.testingLabel` | Casque… | **Envoi en cours…** | 'Casque' is wrong word sense; 'Envoi en cours' is correct for 'sending'. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Délier | **Dissocier** | 'Délier' is wrong word sense; 'Dissocier' is correct for unlinking. |
| `enterprise.gemini.telegram.lastBroadcast` | Dernier envoi : livré {{sent}} depuis {{total}} | **Dernier envoi : livré {{sent}} sur {{total}}** | Grammatically awkward. |
| `enterprise.prompt.heading` | Conseils | **Prompts** | 'Conseils' is wrong word sense; 'Prompts' is the correct technical term. |
| `enterprise.prompt.subtitle` | Base de connaissances et de réponses pour la transcription uniquement dans les salles vidéo | **Prompt et base de connaissances uniquement pour la transcription dans les salles vidéo** | 'Réponses' is extra; 'Prompt' is the correct technical term. |
| `enterprise.prompt.promptLabel` | Message système (ton, style, vocabulaire) | **Prompt système (ton, style, vocabulaire)** | 'Message système' is wrong word sense; 'Prompt système' is correct. |
| `enterprise.prompt.savePrompt` | Invite d'enregistrement | **Enregistrer le prompt** | Awkward phrasing; should be a verb phrase. |
| `enterprise.prompt.showDefault` | Quels sont les paramètres par défaut de l'IA ? | **Ce que l'IA utilise par défaut** | Extra word; should be a direct translation. |
| `enterprise.prompt.defaultLabel` | Invite par défaut de VibeVox | **Prompt par défaut de VibeVox** | Consistency with other 'prompt' translations. |
| `enterprise.prompt.headerLeadBold1` | uniquement pour le décryptage des messages dans les salles vidéo | **uniquement pour la transcription des messages dans les salles vidéo** | 'Décryptage' is wrong word sense; 'transcription' is correct. |
| `enterprise.prompt.headerLeadPart2` | - lorsque vous cliquez sur un message dans une conversation et sélectionnez une sonnerie | **- lorsque vous cliquez sur un message dans une conversation et sélectionnez un ton** | 'Sonnerie' is wrong word sense; 'ton' is correct. |
| `enterprise.prompt.headerLeadBold2` | « Conformément à votre demande » | **« Selon votre prompt »** | 'Demande' is wrong word sense; 'prompt' is the correct technical term. |
| `enterprise.prompt.contextHeading` | Contexte / invite | **Contexte / prompt** | Consistency with other 'prompt' translations. |
| `enterprise.prompt.contextLeadPart1` | Utilisé lorsque vous cliquez sur un message dans une conversation vidéo et sélectionnez une sonnerie. | **Utilisé lorsque vous cliquez sur un message dans une conversation vidéo et sélectionnez un ton.** | 'Sonnerie' is wrong word sense; 'ton' is correct. |
| `enterprise.prompt.contextLeadBold` | « Conformément à votre demande » | **« Selon votre prompt »** | 'Demande' is wrong word sense; 'prompt' is the correct technical term. |
| `enterprise.prompt.defaultSummary` | Valeurs utilisées par défaut par l'IA (si votre champ est vide) - cliquez pour afficher | **Ce que l'IA utilise par défaut (si votre champ est vide) - cliquez pour afficher** | Extra word; should be a direct translation. |
| `enterprise.prompt.extendNoteText` | avec leurs propres règles/style/terminologie, elles seront combinées avec l'invite par défaut ci-dessus et la base de connaissances. | **avec leurs propres règles/style/terminologie, elles seront combinées avec le prompt par défaut ci-dessus et la base de connaissances.** | Consistency with other 'prompt' translations. |
| `enterprise.prompt.savingPromptLabel` | Économie… | **Enregistrement…** | 'Économie' is wrong word sense; 'Enregistrement' is correct for saving data. |
| `enterprise.prompt.savePromptLabel` | Invite d'enregistrement | **Enregistrer le prompt** | Awkward phrasing; should be a verb phrase. |
| `enterprise.prompt.successPromptSaved` | Message enregistré. | **Prompt enregistré.** | 'Message' is wrong word sense; 'Prompt' is correct. |
| `enterprise.prompt.errClearKb` | Échec du déblocage | **Échec de l'effacement** | 'Déblocage' is wrong word sense; 'effacement' is correct for clearing. |
| `enterprise.prompt.presetsHeading` | Des tons d'explication accessibles | **Tons d'explication accessibles** | Missing indefinite article. |
| `enterprise.prompt.presetsLeadPart1` | Dans la conversation de la Salle Entreprise, vous pouvez sélectionner n'importe quel message et demander à l'IA de l'expliquer sur le ton choisi. | **Dans la conversation de la Salle Enterprise, vous pouvez sélectionner n'importe quel message et demander à l'IA de l'expliquer sur le ton choisi.** | Brand name 'Enterprise' should not be translated. |
| `enterprise.prompt.presetsLeadBold` | « Conformément à votre demande » | **« Selon votre prompt »** | 'Demande' is wrong word sense; 'prompt' is the correct technical term. |
| `enterprise.prompt.presetsLeadPart2` | utilise votre invite du champ ci-dessus. | **utilise votre prompt du champ ci-dessus.** | Consistency with other 'prompt' translations. |
| `enterprise.questFlow.heading` | Flux de quête | **Quest Flow** | Brand name should not be translated. |
| `enterprise.questFlow.warning` | Si le champ est vide, l'invite générale VibeVox est utilisée. | **Si le champ est vide, le prompt général VibeVox est utilisé.** | Consistency with other 'prompt' translations. |
| `enterprise.questFlow.apiKeyLabel` | Clé API entrante (porteur) | **Clé API entrante (Bearer)** | Technical term 'Bearer' should not be translated. |
| `enterprise.questFlow.promptLabel` | Invite du système de flux de quête | **Prompt système Quest Flow** | Brand name 'Quest Flow' translated; 'Invite' is less precise than 'Prompt'. |
| `enterprise.questFlow.tagsLabel` | Étiquettes nécessaires | **Étiquettes de besoins** | 'Nécessaires' is wrong word sense; 'de besoins' is correct. |
| `enterprise.questFlow.savePrompt` | Invite d'enregistrement | **Enregistrer le prompt** | Awkward phrasing; should be a verb phrase. |
| `enterprise.questFlow.keyLabelPlaceholder` | Étiquette (facultative), par exemple : « Clinique de robots de production » | **Étiquette (facultative), par exemple : « Prod bot clinique »** | Example text should not be translated literally if it's a specific internal name. |
| `enterprise.questFlow.errDelete` | Delete error | **Erreur de suppression** | English term; should be translated to French. |
| `enterprise.questFlow.copyKey` | Copie | **Copier** | 'Copie' is a noun; should be a verb for a button label. |
| `enterprise.questFlow.savedKeyConfirm` | J'ai sauvé la clé | **J'ai enregistré la clé** | 'Sauvé' is wrong word sense; 'enregistré' is correct for saving data. |
| `enterprise.questFlow.deleteTitle` | Delete | **Supprimer** | English term; should be translated to French. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Supprimer la clé ?** | English term; should be translated to French. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **La clé sera supprimée définitivement. Quest Flow cessera de fonctionner avec elle — vous devrez créer une nouvelle clé et la remplacer dans le flux.** | English terms; should be translated to French. Brand name 'Quest Flow' should not be translated. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Supprimer** | English term; should be translated to French. |
| `enterprise.questFlow.promptHeading` | Suggestion pour les conversations Telegram | **Prompt pour les conversations Telegram** | 'Suggestion' is wrong word sense; 'Prompt' is the correct technical term. |
| `enterprise.questFlow.promptLead1` | Détermine COMMENT l'IA communique avec les clients via Quest Flow : ton, style, éléments à identifier. | **Détermine COMMENT l'IA communique avec les clients via Quest Flow : ton, style, éléments à identifier.** | Brand name 'Quest Flow' should not be translated. |
| `enterprise.questFlow.promptLead2` | — l'invite générale VibeVox est utilisée (ci-dessous). | **— le prompt général VibeVox est utilisé (ci-dessous).** | Consistency with other 'prompt' translations. |
| `enterprise.questFlow.promptLead3` | - Il sera combiné avec l'invite de commande de base et la base de connaissances. | **— il sera combiné avec le prompt de base et la base de connaissances.** | 'Invite de commande' is wrong word sense; 'prompt de base' is correct. |
| `enterprise.questFlow.savingPromptLabel` | Économie… | **Enregistrement…** | 'Économie' is wrong word sense; 'Enregistrement' is correct for saving data. |
| `enterprise.questFlow.successPromptSaved` | Invite de flux de quête enregistrée. | **Prompt Quest Flow enregistré.** | Brand name 'Quest Flow' translated; 'Invite' is less precise than 'Prompt'. |
| `enterprise.questFlow.kbLeadBold2` | séparé | **séparée** | Gender agreement: 'base' is feminine, so 'séparée' is needed. |
| `enterprise.questFlow.kbLead3` | Extrait de la section « Conseils » — pour la transcription vidéo. Limite : fichier de 50 Mo / 500 000 caractères dans la base de données. | **de la section « Prompts » — là pour la transcription vidéo. Limite : fichier de 50 Mo / 500 000 caractères dans la base de données.** | 'Conseils' is wrong word sense; 'Prompts' is the correct technical term. |
| `enterprise.questFlow.confirmKbDeleteBody` | La base de connaissances de Quest Flow sera effacée. Cette action est irréversible. | **La base de connaissances Quest Flow sera effacée. Cette action est irréversible.** | Brand name 'Quest Flow' should not be translated. |
| `enterprise.questFlow.tagsHeading` | Étiquettes nécessaires | **Étiquettes de besoins** | 'Nécessaires' is wrong word sense; 'de besoins' is correct. |
| `enterprise.questFlow.tagsLead` | L'IA attribue ces étiquettes aux clients si elle détecte une correspondance dans la conversation. Les étiquettes sont affichées sur la fiche de chambre du client et transmises au CRM (section 4). | **L'IA attribue ces étiquettes aux clients si elle détecte une correspondance dans la conversation. Les étiquettes sont affichées sur la fiche de salle du client et transmises au CRM (section 4).** | Incorrect word sense: 'Chambre' for bedrooms, 'Salle' for meeting rooms. |
| `enterprise.chatwoot.tokenLabel` | jeton API de l'agent | **Jeton API de l'agent** | Missing definite article. |
| `enterprise.chatwoot.test` | Vérifiez la connexion | **Vérifier la connexion** | Imperative verb; should be infinitive for a button label. |
| `enterprise.chatwoot.statusConfigured` | configuré | **Configuré** | Missing article. |
| `enterprise.chatwoot.statusActive` | Actif | **Active** | Gender agreement: 'connexion' is feminine, so 'Active' is needed. |
| `enterprise.chatwoot.statusDisabled` | Éteint | **Désactivée** | Gender agreement and more precise: 'connexion' is feminine, 'Désactivée' is better. |
| `enterprise.chatwoot.tokenPlaceholder` | jeton d'accès de l'agent | **Jeton d'accès de l'agent** | Missing definite article. |
| `enterprise.chatwoot.savingLabel` | Économie… | **Enregistrement…** | 'Économie' is wrong word sense; 'Enregistrement' is correct for saving data. |
| `enterprise.chatwoot.testLabel` | test de connexion | **Test de connexion** | Missing definite article. |
| `enterprise.chatwoot.whatSentItem3Prefix` | Tous les besoins assignés dans | **Tous les tags de besoins attribués dans** | Awkward phrasing; 'tags de besoins' is more natural. |
| `enterprise.chatwoot.whatSentFooter` | Envoyé lorsque vous cliquez manuellement sur « Envoyer au CRM » dans la conversation de groupe. L'envoi automatique lors de la détection d'une étiquette sera la prochaine fonctionnalité. | **Envoyé lorsque vous cliquez manuellement sur « Envoyer au CRM » dans le chat de la salle. L'envoi automatique lors de la détection de tags sera la prochaine fonctionnalité.** | 'Conversation de groupe' is wrong; 'fonctionnalité' is better than 'feature'. |
| `chat.tone` | Tonifier | **Ton** | 'Tonifier' is wrong word sense; 'Ton' is correct for tone of voice. |
| `chat.deletingShort` | Suppression… | **Suppression en cours…** | Noun; should be a verb phrase for an ongoing action. |
| `chat.backToRooms` | ← Retour aux chambres | **← Retour aux salles** | Incorrect word sense: 'Chambres' for bedrooms, 'Salles' for meeting rooms. |
| `chat.enterpriseOnlyHint` | Les salons de discussion sont une fonctionnalité réservée aux entreprises. Passez à un forfait supérieur dans la section « Tarifs ». | **Les salons de discussion sont une fonctionnalité Enterprise. Passez à un forfait supérieur dans la section « Tarifs ».** | Brand name 'Enterprise' should not be translated. |
| `chat.telegramBadge` | Télégramme | **Telegram** | Brand name should not be translated. |
| `insights.recalc` | Raconter | **Recalculer** | 'Raconter' means to tell a story; 'Recalculer' is correct. |
| `insights.summary` | CV | **Résumé** | 'CV' is wrong word sense; 'Résumé' is correct. |
| `insights.sentiment` | Clé | **Tonalité** | 'Clé' means key; 'Tonalité' is correct for sentiment. |
| `insights.engagement` | Fiançailles | **Engagement** | 'Fiançailles' is wrong word sense; 'Engagement' is correct. |
| `insights.leadScore` | Score principal | **Lead Score** | Technical term 'Lead Score' should be preserved. |
| `insights.leadValues.warm` | Chaud | **Tiède** | 'Chaud' means hot; 'Tiède' is warm. |
| `lobby.nameLabel` | Quel est ton nom? | **Quel est votre nom ?** | 'Ton' is informal; 'Votre' is more appropriate for UI. |
| `lobby.shareSection` | Partagez le lien | **Partager le lien** | Imperative verb; should be infinitive for a section title. |
| `lobby.shareHint` | Copiez et envoyez ce document à votre interlocuteur pour l'inviter à une réunion. | **Copiez et envoyez ce lien à votre interlocuteur pour l'inviter à une réunion.** | 'Ce document' is wrong word sense; 'ce lien' is correct. |
| `lobby.tosAgree` | En vous inscrivant, vous acceptez les conditions suivantes : | **En rejoignant, vous acceptez les conditions suivantes :** | 'En vous inscrivant' is wrong word sense; 'En rejoignant' is correct for joining. |
| `lobby.andWord` |  Et  | ** et ** | Should be lowercase in the middle of a sentence. |
| `lobby.privacy` | politique de confidentialité | **la politique de confidentialité** | Missing definite article. |
| `lobby.roomFullMsg` | Un participant est déjà inscrit à la réunion. Veuillez contacter l'organisateur ou demander l'ajout d'un nouveau participant. | **Un participant est déjà présent à la réunion. Veuillez contacter l'organisateur ou demander une nouvelle réunion.** | 'Inscrit' is wrong word sense; 'présent' is correct. Simplified last part for brevity. |
| `paywall.buyStandard` | Formule standard – 29 €/mois (120 min) | **Standard – 29 €/mois (120 min)** | Brand name 'Standard' should not be translated. |
| `paywall.subscribe` | Conception | **S'abonner** | 'Conception' is wrong word sense; 'S'abonner' is correct for subscribing. |
| `paywall.featureMinutes` | {{count}} min traduction | **{{count}} min de traduction** | Missing preposition 'de'. |
| `paywall.topupTitle` | Achetez plus de minutes | **Acheter plus de minutes** | Imperative verb; should be infinitive for a title. |
| `paywall.topupPlusLine` | Tarif Plus (VV0__ min inclus) | **Tarif Plus ({{count}} min inclus)** | Placeholder error: 'VV0__' should be '{{count}}'. |
| `confirmModal.ok` | D'ACCORD | **OK** | 'OK' is shorter and commonly used. |
| `defaultRoom.namePattern` | Chambre {{name}} · {{date}}, {{time}} | **Salle {{name}} · {{date}}, {{time}}** | Incorrect word sense: 'Chambre' for bedrooms, 'Salle' for meeting rooms. |
| `postCallInsights.subtitle` | Entreprise · Analyses post-appel | **Enterprise · Analyses post-appel** | Brand name 'Enterprise' should not be translated. |
| `postCallInsights.analyzing` | Analysons la conversation... | **Analyse de la conversation…** | Imperative verb; should be a noun phrase for an ongoing action. |
| `postCallInsights.metricSentiment` | Humeur | **Tonalité** | 'Humeur' is wrong word sense; 'Tonalité' is correct for sentiment. |
| `postCallInsights.metricEngagement` | Fiançailles | **Engagement** | 'Fiançailles' is wrong word sense; 'Engagement' is correct. |
| `postCallInsights.metricLeadScore` | Score de plomb | **Lead Score** | Technical term 'Lead Score' should be preserved. |
| `postCallInsights.summary` | CV | **Résumé** | 'CV' is wrong word sense; 'Résumé' is correct. |
| `postCallInsights.close` | Fermez et retournez dans les chambres | **Fermer et retourner aux salles** | Imperative verb; should be infinitive. 'Chambres' for bedrooms, 'Salles' for meeting rooms. |
| `billingPage.tierLabel` | Taux | **Tarif** | 'Taux' is wrong word sense; 'Tarif' is correct for a plan. |
| `billingPage.untilEndOfPeriod` | jusqu'à la fin de la période rémunérée | **jusqu'à la fin de la période payée** | 'Rémunérée' is wrong word sense; 'payée' is correct. |
| `billingPage.cancelTooltip` | Annulation du renouvellement automatique. Votre abonnement restera actif jusqu'à la fin de la période en cours. | **Annuler l'auto-renouvellement. Votre abonnement restera actif jusqu'à la fin de la période en cours.** | Noun; should be a verb phrase for a tooltip action. |
| `billingPage.resume` | CV | **Reprendre** | 'CV' is wrong word sense; 'Reprendre' is correct. |
| `billingPage.tierEnterpriseName` | Entreprise | **Enterprise** | Brand name should not be translated. |
| `billingPage.featureLearnHub` | Centre d'apprentissage de l'IA — ses propres dialectes | **AI Learning Hub — ses propres dialectes** | Brand name 'AI Learning Hub' should not be translated. |
| `billingPage.featureAllStandard` | Tous les produits Standard | **Tout de Standard** | Extra word 'produits'; should be a direct translation. |
| `billingPage.featureBranding` | Identité visuelle des chambres (logo, couleurs) | **Identité visuelle des salles (logo, couleurs)** | Incorrect word sense: 'Chambres' for bedrooms, 'Salles' for meeting rooms. |
| `billingPage.featurePersonalPrompts` | Messages d'IA personnelle | **Prompts d'IA personnelle** | 'Messages' is wrong word sense; 'Prompts' is correct. |
| `billingPage.ctaSubscribePlus` | Obtenez plus | **S'abonner à Plus** | Imperative verb; should be infinitive for a button label. |
| `billingPage.ctaSubscribeStandard` | Commande standard | **S'abonner à Standard** | 'Commande' is wrong word sense; 'S'abonner' is correct. |
| `billingPage.ctaContactWhatsApp` | Contactez-moi via WhatsApp | **Nous contacter via WhatsApp** | Too specific; should be general. |
| `billingPage.ctaContact` | Contact | **Nous contacter** | Noun; should be a verb phrase for a CTA. |
| `billingPage.searchLanguagesPlaceholder` | Trouvez votre langue - par exemple, « portugais », « português », ru | **Rechercher votre langue - par exemple, « portugais », « português », ru** | Imperative verb; should be infinitive for a placeholder. |
| `billingPage.clearSearch` | Recherche propre | **Effacer la recherche** | 'Recherche propre' is wrong word sense; 'Effacer la recherche' is correct. |
| `billingPage.languagesCount_few` | {{count}} langue | **{{count}} langues** | Incorrect plural form. |
| `billingPage.faqA2` | Oui. Vous pouvez annuler votre annulation en un clic depuis votre compte personnel. La période déjà payée restera valable jusqu'à son terme. | **Oui. Vous pouvez annuler votre abonnement en un clic depuis votre compte personnel. La période déjà payée restera valable jusqu'à son terme.** | Double negative; should be 'annuler votre abonnement'. |
| `billingPage.faqQ3` | Que comprend le forfait Entreprise ? | **Que comprend le forfait Enterprise ?** | Brand name 'Enterprise' should not be translated. |
| `billingPage.faqA3` | Suite IA complète : fiches clients avec reconnaissance automatique, autorisation Telegram, messages personnalisés, Google Agenda, étiquetage intelligent des besoins, exportation CRM, intégration avec questflow.pro et un onglet d’administration séparé. | **Suite IA complète : fiches clients avec reconnaissance automatique, autorisation Telegram, prompts personnalisés, Google Agenda, étiquetage intelligent des besoins, exportation CRM, intégration avec questflow.pro et un onglet d’administration séparé.** | Brand name 'Telegram' should not be translated. 'Messages' is wrong word sense; 'prompts' is correct. |
| `billingPage.faqA4` | Tout système conforme aux RFC : Zadarma, OnlinePBX, Asterisk/FreePBX, etc. VibeVox crée automatiquement une liaison sortante. | **Tout système conforme aux RFC : Zadarma, OnlinePBX, Asterisk/FreePBX, etc. VibeVox crée automatiquement une jonction sortante.** | 'Liaison' is less precise than 'jonction' for SIP trunks. |
| `billingPage.renewsOn` | extension {{date}} | **Renouvellement le {{date}}** | 'Extension' is wrong word sense; 'Renouvellement' is correct. |
| `billingPage.searchResultsCount_one` | Langue trouvée : {{count}} | **Trouvé : {{count}} langue** | Grammatical agreement and more direct. |
| `auth.login.title` | Accueillir | **Bienvenue** | 'Accueillir' is a verb; 'Bienvenue' is the correct noun for 'Welcome'. |
| `auth.login.registerLink` | Registre | **S'inscrire** | 'Registre' is a noun; should be a verb for a link. |
| `auth.register.submit` | Registre | **S'inscrire** | 'Registre' is a noun; should be a verb for a button label. |
| `auth.register.namePlaceholder` | votre nom | **Votre nom** | Missing article. |
| `auth.register.ruleNumber` | Nombre | **Chiffre** | 'Nombre' is a number; 'Chiffre' is a digit. |
| `auth.register.agreementAnd` |  Et  | ** et ** | Should be lowercase in the middle of a sentence. |
| `auth.register.agreementPrivacy` | politique de confidentialité | **la politique de confidentialité** | Missing definite article. |
| `auth.forgot.successTitle` | La lettre a été envoyée. | **L'e-mail a été envoyé.** | 'Lettre' is wrong word sense; 'e-mail' is correct. |
| `auth.forgot.successHint` | Veuillez vérifier votre boîte de réception pour le courriel contenant {{email}}. Si vous ne le trouvez pas, vérifiez votre dossier de courriers indésirables. | **Veuillez vérifier votre boîte de réception à l'adresse {{email}}. Si vous ne le trouvez pas, vérifiez votre dossier de courriers indésirables.** | Awkward phrasing. |
| `pwaInstall.buttonLabel` | Installez l'application | **Installer l'application** | Imperative verb; should be infinitive for a button label. |
| `pwaInstall.buttonSubtitle` | Accédez à l'écran d'accueil - lancement en un seul clic | **Sur l'écran d'accueil - lancement en un seul clic** | Imperative verb; should be a prepositional phrase for a subtitle. |
| `pwaInstall.buttonAria` | Installez VibeVox comme une application | **Installer VibeVox comme une application** | Imperative verb; should be infinitive for an ARIA label. |

⚠ 10 fix(es) skipped (no-op, missing path, or would break placeholders).
