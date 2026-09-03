const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    // Navigation
    const currentTab = ref('diag');

    // Formulaire & Persistance
    const vehicle = ref(localStorage.getItem('idiag_vehicle') || '');
    const symptoms = ref(localStorage.getItem('idiag_symptoms') || '');
    const dtcCode = ref('');
    const dtcError = ref('');
    const isLoading = ref(false);

    // Données Diagnostic
    const report = ref(null);

    // Historique
    const history = ref(JSON.parse(localStorage.getItem('idiag_history') || '[]'));

    // Exemples Rapides
    const quickExamples = [
      { label: 'Toyota Yaris 3 Hybride (C1252)', vehicle: 'Toyota Yaris 3 Hybride', dtc: 'C1252', symptoms: 'Pédale de frein dure, voyant ABS et triangle allumés' },
      { label: 'Clio 4 1.5 dCi (P0380)', vehicle: 'Renault Clio 4 1.5 dCi', dtc: 'P0380', symptoms: 'Démarrage difficile à froid, message injection à contrôler' },
      { label: 'Golf 7 2.0 TDI (P0401)', vehicle: 'Volkswagen Golf 7 2.0 TDI', dtc: 'P0401', symptoms: 'Manque de puissance sous 2000 tr/min, voyant moteur' },
      { label: 'BMW E36 320i (P0300)', vehicle: 'BMW Série 3 E36 320i', dtc: 'P0300', symptoms: 'Ralenti instable, ratés à l\'accélération' }
    ];

    // Recherche DTC locale
    const dtcSearch = ref('');
    const dtcDatabase = ref([
      { code: 'P0300', system: 'Moteur', label: 'Ratés d\'allumage multiples / cylindres aléatoires détectés' },
      { code: 'P0301', system: 'Moteur', label: 'Raté d\'allumage détecté sur le cylindre 1' },
      { code: 'P0380', system: 'Préchauffage', label: 'Panne dans le circuit des bougies de préchauffage' },
      { code: 'P0401', system: 'EGR', label: 'Débit insuffisant détecté dans le circuit de recirculation des gaz' },
      { code: 'P0420', system: 'Échappement', label: 'Rendement du catalyseur en dessous du seuil (Ligne 1)' },
      { code: 'C1252', system: 'Freinage / Hybride', label: 'Circuit du moteur de pompe d\'assistance de freinage' },
      { code: 'C1256', system: 'Freinage / Hybride', label: 'Pression d\'accumulateur de freinage anormalement basse' },
      { code: 'C1528', system: 'Direction assistée', label: 'Anomalie rotation / signal capteur moteur EPS' },
      { code: 'U0100', system: 'Réseau CAN', label: 'Perte de communication avec le calculateur moteur (ECM/PCM)' }
    ]);

    // PWA & Installation
    const installPrompt = ref(null);
    const showInstallModal = ref(false);

    // Sauvegarde automatique du véhicule et des symptômes
    const savePersistentData = () => {
      localStorage.setItem('idiag_vehicle', vehicle.value);
      localStorage.setItem('idiag_symptoms', symptoms.value);
    };

    // Validation stricte du DTC à chaque frappe
    const onDtcInput = () => {
      dtcCode.value = dtcCode.value.toUpperCase().trim();
      const val = dtcCode.value;

      if (!val) {
        dtcError.value = '';
        return;
      }

      const dtcRegex = /^[PCBU][0-9A-F]{4}$/;

      if (!/^[PCBU]/.test(val)) {
        dtcError.value = 'Doit débuter par P, C, B ou U';
      } else if (val.length < 5) {
        dtcError.value = `5 caractères requis (${val.length}/5)`;
      } else if (!dtcRegex.test(val)) {
        dtcError.value = 'Format invalide (chiffres 0-9 et lettres A-F)';
      } else {
        dtcError.value = '';
      }
    };

    // Chargement d'un exemple
    const loadExample = (ex) => {
      vehicle.value = ex.vehicle;
      dtcCode.value = ex.dtc;
      symptoms.value = ex.symptoms;
      dtcError.value = '';
      savePersistentData();
    };

    // Formulaire valide
    const isFormValid = computed(() => {
      const dtcRegex = /^[PCBU][0-9A-F]{4}$/;
      return vehicle.value.trim().length >= 2 && dtcRegex.test(dtcCode.value);
    });

    // Compteur de cases cochées
    const completedChecksCount = computed(() => {
      if (!report.value || !report.value.checks) return 0;
      return report.value.checks.filter(c => c.done).length;
    });

    // Filtrage base DTC
    const filteredDtcList = computed(() => {
      const q = dtcSearch.value.trim().toUpperCase();
      if (!q) return dtcDatabase.value;
      return dtcDatabase.value.filter(d => d.code.includes(q) || d.label.toUpperCase().includes(q));
    });

    // Liens vers pièces détachées
    const getPartsUrl = (platform) => {
      const query = encodeURIComponent(`${vehicle.value} ${dtcCode.value}`);
      if (platform === 'oscaro') return `https://www.oscaro.com/fr/search?q=${query}`;
      if (platform === 'autodoc') return `https://www.auto-doc.fr/search?keyword=${query}`;
      return `https://www.amazon.fr/s?k=${query}`;
    };

    // Lancement du diagnostic
    const startDiagnostic = async () => {
      if (!isFormValid.value) return;

      isLoading.value = true;
      savePersistentData();

      setTimeout(() => {
        const code = dtcCode.value;
        const isToyotaHybride = vehicle.value.toLowerCase().includes('toyota') || vehicle.value.toLowerCase().includes('yaris');

        if (code === 'C1252' || (code.startsWith('C12') && isToyotaHybride)) {
          report.value = {
            severity_title: 'DÉFAILLANCE HYDRAULIQUE DE FREINAGE - ARRÊT IMMÉDIAT',
            severity_desc: 'Chute de pression ou dysfonctionnement de la pompe d\'assistance hydraulique (Brake Booster). Pédale dure, risque élevé de perte de freinage assisté.',
            checks: [
              { label: 'Mesurer la tension de la batterie auxiliaire 12V (au repos et mode READY)', done: false },
              { label: 'Vérifier le fusible de puissance ABS MTR (30A/40A)', done: false },
              { label: 'Contrôler la continuité et l\'alimentation du relais de pompe de gavage de frein', done: false },
              { label: 'Vérifier l\'absence de fuite au niveau de l\'accumulateur de pression', done: false }
            ],
            technical_analysis: `Le code DTC ${code} sur ${vehicle.value} signale une anomalie dans le circuit d'alimentation ou de commande du moteur de pompe d'assistance de freinage. Sur cette architecture hybride, l'assistance ne provient pas de la dépression moteur mais d'un ensemble moteur/pompe électrique 12V haute pression couplé à un accumulateur.`,
            causes: [
              { title: 'Pompe de frein / Accumulateur HS', detail: 'Usure interne des charbons du moteur de pompe ou fuite interne de pression.' },
              { title: 'Batterie 12V faible', detail: 'Une sous-tension au démarrage coupe la régulation du bloc hydraulique ABS/VSC.' },
              { title: 'Relais ABS défaillant', detail: 'Contacts internes calaminés coupant l\'alimentation sous fort appel de courant.' }
            ],
            steps: [
              { title: 'Contrôle batterie 12V', instruction: 'Vérifier que la tension de repos est supérieure ou égale à 12,5 V. Si < 12,0 V, recharger ou remplacer.' },
              { title: 'Test actif de pompe à la valise', instruction: 'Activer le test actionneur de la pompe de freinage avec Techstream ou un outil multimarque et écouter si le moteur tourne.' },
              { title: 'Mesure de pression en direct', instruction: 'Lire la valeur de consigne et réelle du capteur de pression d\'accumulateur (doit monter rapidement au-dessus de 3,2 MPa).' }
            ],
            suspect_parts: [
              'Bloc pompe hydraulique / Accumulateur de freinage',
              'Relais moteur ABS / EPS',
              'Batterie auxiliaire 12V AGM'
            ]
          };
        } else {
          report.value = {
            severity_title: 'ANOMALIE SYSTÈME DÉTECTÉE - VÉRIFICATION NÉCESSAIRE',
            severity_desc: `Défaut enregistré sous le code ${code}. Un contrôle méthodique du circuit électrique et des actionneurs associés est recommandé.`,
            checks: [
              { label: 'Contrôler l\'état de charge de la batterie 12V', done: false },
              { label: 'Vérifier le fusible associé au circuit', done: false },
              { label: 'Inspecter visuellement l\'état du faisceau et des connecteurs', done: false }
            ],
            technical_analysis: `Le code DTC ${code} indique une divergence de signal ou une absence de communication dans le module concerné pour le véhicule ${vehicle.value}.`,
            causes: [
              { title: 'Faisceau / Connecteur', detail: 'Faux contact, oxydation ou fil pincé sur la ligne de mesure.' },
              { title: 'Composant / Capteur défaillant', detail: 'Composant hors tolérance ou en court-circuit interne.' }
            ],
            steps: [
              { title: 'Contrôle des alimentations', instruction: 'Vérifier la présence du 12V permanent, du + après contact et la masse (< 0,5 Ohm).' },
              { title: 'Lecture des flux de données', instruction: 'Analyser les paramètres en temps réel sous la valise pour observer la cohérence du signal.' }
            ],
            suspect_parts: [
              'Capteur / Actionneur relié au code DTC',
              'Faisceau électrique et prises associées'
            ]
          };
        }

        // Ajout dans l'historique
        const entry = {
          vehicle: vehicle.value,
          dtc: code,
          date: new Date().toLocaleDateString('fr-FR') + ' ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        };
        history.value.unshift(entry);
        if (history.value.length > 5) history.value.pop();
        localStorage.setItem('idiag_history', JSON.stringify(history.value));

        isLoading.value = false;
      }, 700);
    };

    // Restauration depuis historique
    const restoreHistory = (h) => {
      vehicle.value = h.vehicle;
      dtcCode.value = h.dtc;
      savePersistentData();
      startDiagnostic();
    };

    const clearHistory = () => {
      history.value = [];
      localStorage.removeItem('idiag_history');
    };

    // Partage WhatsApp
    const shareReportWhatsApp = () => {
      if (!report.value) return;
      const text = encodeURIComponent(
        `*Rapport iDiagAuto - ${vehicle.value}*\n` +
        `Code DTC : ${dtcCode.value}\n` +
        `Statut : ${report.value.severity_title}\n\n` +
        `Analyse : ${report.value.technical_analysis}`
      );
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    };

    // Impression / Export PDF
    const exportPdf = () => {
      window.print();
    };

    // Copie Presse-papier
    const copyReport = async () => {
      if (!report.value) return;
      const text = `Rapport iDiagAuto - ${vehicle.value} (DTC: ${dtcCode.value})\n${report.value.severity_title}\n\n${report.value.technical_analysis}`;
      try {
        await navigator.clipboard.writeText(text);
        alert('Rapport copié dans le presse-papier !');
      } catch (e) {
        console.error(e);
      }
    };

    // Installation PWA
    const handleInstallClick = async () => {
      if (installPrompt.value) {
        installPrompt.value.prompt();
        const { outcome } = await installPrompt.value.userChoice;
        if (outcome === 'accepted') {
          installPrompt.value = null;
        }
      } else {
        showInstallModal.value = true;
      }
    };

    onMounted(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(console.error);
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        installPrompt.value = e;
      });
    });

    return {
      currentTab,
      vehicle,
      symptoms,
      dtcCode,
      dtcError,
      isLoading,
      report,
      history,
      quickExamples,
      dtcSearch,
      filteredDtcList,
      installPrompt,
      showInstallModal,
      savePersistentData,
      onDtcInput,
      loadExample,
      isFormValid,
      completedChecksCount,
      getPartsUrl,
      startDiagnostic,
      restoreHistory,
      clearHistory,
      shareReportWhatsApp,
      exportPdf,
      copyReport,
      handleInstallClick
    };
  }
}).mount('#app');