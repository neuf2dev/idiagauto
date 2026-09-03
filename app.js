const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const currentTab = ref('diag');

    // Persistance
    const vehicle = ref(localStorage.getItem('idiag_vehicle') || '');
    const dtcCode = ref(localStorage.getItem('idiag_dtc') || '');
    const symptoms = ref(localStorage.getItem('idiag_symptoms') || '');
    const dtcError = ref('');
    const isLoading = ref(false);

    // Données du Rapport
    const report = ref(null);

    // Listes d'historique pour autocomplétion
    const vehicleHistory = ref(JSON.parse(localStorage.getItem('idiag_vehicle_history') || '[]'));
    const dtcHistory = ref(JSON.parse(localStorage.getItem('idiag_dtc_history') || '[]'));

    // Exemples rapides
    const quickExamples = [
      { label: 'BMW 320i E36', code: 'P0340', vehicle: 'BMW Série 3 E36 320i 1998', symptoms: 'Manque de reprise, ralenti instable, démarrage difficile' },
      { label: 'Opel Meriva 1.7 CDTI', code: 'P0190', vehicle: 'Opel Meriva 1.7 CDTI', symptoms: 'Coupure moteur sous forte charge, voyant clé' },
      { label: 'Renault Clio 3 1.5 dCi', code: 'DF053', vehicle: 'Renault Clio 3 1.5 dCi', symptoms: 'Message injection à contrôler' }
    ];

    // Base DTC locale
    const dtcSearch = ref('');
    const dtcDatabase = ref([
      { code: 'P0300', system: 'Moteur', label: 'Ratés d\'allumage multiples / cylindres aléatoires détectés' },
      { code: 'P0340', system: 'Capteurs', label: 'Capteur de position d\'arbre à cames A - panne du circuit' },
      { code: 'P0190', system: 'Injection', label: 'Capteur de pression de la rampe de distribution - panne du circuit' },
      { code: 'DF053', system: 'Renault / Dacia', label: 'Fonction régulation de pression rail' },
      { code: 'C1252', system: 'Freinage / Hybride', label: 'Circuit du moteur de pompe d\'assistance de freinage' },
      { code: 'C1522', system: 'Direction assistée', label: 'Moteur d\'assistance de direction électrique EPS' },
      { code: 'C1528', system: 'Direction assistée', label: 'Anomalie rotation / signal capteur moteur EPS' },
      { code: 'U0100', system: 'Réseau CAN', label: 'Perte de communication avec le calculateur moteur (ECM/PCM)' }
    ]);

    // PWA Prompt
    const installPrompt = ref(null);
    const showInstallModal = ref(false);

    const savePersistentData = () => {
      localStorage.setItem('idiag_vehicle', vehicle.value);
      localStorage.setItem('idiag_dtc', dtcCode.value);
      localStorage.setItem('idiag_symptoms', symptoms.value);
    };

    const addToHistory = (item, listRef, storageKey) => {
      const cleanItem = (item || '').trim();
      if (!cleanItem) return;
      if (!listRef.value.includes(cleanItem)) {
        listRef.value.unshift(cleanItem);
        if (listRef.value.length > 20) listRef.value.pop();
        localStorage.setItem(storageKey, JSON.stringify(listRef.value));
      }
    };

    const onDtcInput = () => {
      dtcCode.value = (dtcCode.value || '').toUpperCase().trim();
      const val = dtcCode.value;
      savePersistentData();

      if (!val) {
        dtcError.value = '';
        return;
      }

      const isStandardDtc = /^[PCBU][0-9A-F]{4}$/i.test(val);
      const isRenaultDf = /^DF[0-9A-F]{3}$/i.test(val);

      if (val.length < 5) {
        dtcError.value = `5 caractères requis (${val.length}/5)`;
      } else if (!isStandardDtc && !isRenaultDf) {
        dtcError.value = 'Format attendu : ex: P0340, C1252, DF053';
      } else {
        dtcError.value = '';
      }
    };

    const loadExample = (ex) => {
      vehicle.value = ex.vehicle;
      dtcCode.value = ex.code;
      symptoms.value = ex.symptoms;
      dtcError.value = '';
      savePersistentData();
    };

    const isFormValid = computed(() => {
      const val = (dtcCode.value || '').trim();
      return (vehicle.value || '').trim().length >= 2 && val.length === 5;
    });

    const completedChecksCount = computed(() => {
      if (!report.value || !report.value.checks) return 0;
      return report.value.checks.filter(c => c.done).length;
    });

    const filteredDtcList = computed(() => {
      const q = dtcSearch.value.trim().toUpperCase();
      if (!q) return dtcDatabase.value;
      return dtcDatabase.value.filter(d => d.code.includes(q) || d.label.toUpperCase().includes(q));
    });

    const startDiagnostic = () => {
      const code = (dtcCode.value || '').toUpperCase().trim();
      const currentVehicle = (vehicle.value || '').trim();

      if (!code || code.length < 5) {
        dtcError.value = '5 caractères requis';
        return;
      }

      isLoading.value = true;
      savePersistentData();

      addToHistory(currentVehicle, vehicleHistory, 'idiag_vehicle_history');
      addToHistory(code, dtcHistory, 'idiag_dtc_history');

      setTimeout(() => {
        const isToyotaHybride = currentVehicle.toLowerCase().includes('toyota') || currentVehicle.toLowerCase().includes('yaris');

        if (code === 'C1252' || (code.startsWith('C12') && isToyotaHybride)) {
          report.value = {
            severity_title: 'DÉFAILLANCE HYDRAULIQUE DE FREINAGE - ARRÊT IMMÉDIAT',
            severity_desc: 'Chute de pression ou anomalie moteur de pompe hydraulique (Brake Booster). Pédale dure, risque de perte de freinage assisté.',
            checks: [
              { label: 'Mesurer la tension de la batterie auxiliaire 12V (repos et mode READY)', done: false },
              { label: 'Contrôler le fusible de puissance ABS MTR (30A/40A)', done: false },
              { label: 'Tester la continuité du relais de pompe de freinage', done: false },
              { label: 'Vérifier l\'absence de fuite au niveau de l\'accumulateur de pression', done: false }
            ],
            technical_analysis: `Le code DTC ${code} sur ${currentVehicle} signale une coupure d'alimentation ou un blocage du moteur de pompe d'assistance hydraulique. Sur ce véhicule, l'assistance est assurée par un groupe électropompe haute pression avec accumulateur de gaz.`,
            causes: [
              { title: 'Pompe de frein / Accumulateur HS', detail: 'Usure des charbons du moteur électrique de pompe ou fuite interne.' },
              { title: 'Batterie 12V faible', detail: 'Sous-tension au démarrage coupant le calculateur de freinage.' },
              { title: 'Relais ABS défaillant', detail: 'Coupure d\'alimentation sous fort appel d\'intensité.' }
            ],
            steps: [
              { title: 'Contrôle batterie 12V', instruction: 'Mesurer au multimètre : ≥ 12,6 V au repos, entre 13,8 V et 14,5 V en mode READY.' },
              { title: 'Test actionneur valise', instruction: 'Activer manuellement le moteur de pompe via la valise pour écouter s\'il tourne.' },
              { title: 'Lecture pression accumulateur', instruction: 'Vérifier la pression dans les paramètres en direct (doit dépasser 3,2 MPa).' }
            ],
            suspect_parts: [
              'Bloc pompe hydraulique / Accumulateur de freinage',
              'Relais moteur ABS / Freinage',
              'Batterie auxiliaire 12V AGM'
            ]
          };
        } else {
          report.value = {
            severity_title: 'ANOMALIE SYSTÈME DÉTECTÉE - VÉRIFICATION NÉCESSAIRE',
            severity_desc: `Défaut enregistré sous le code ${code}. Un contrôle méthodique du circuit électrique et des actionneurs associés est requis.`,
            checks: [
              { label: 'Contrôler l\'état de charge de la batterie 12V', done: false },
              { label: 'Vérifier le fusible associé au circuit', done: false },
              { label: 'Inspecter visuellement l\'état du faisceau et des connecteurs', done: false }
            ],
            technical_analysis: `Le code DTC ${code} indique une divergence de signal ou une absence de réponse dans le circuit concerné sur ${currentVehicle}.`,
            causes: [
              { title: 'Faisceau / Connectique', detail: 'Oxydation, mauvais contact ou fil coupé/pincé.' },
              { title: 'Composant / Capteur défaillant', detail: 'Composant hors tolérances ou en court-circuit.' }
            ],
            steps: [
              { title: 'Alimentations et masses', instruction: 'Mesurer la présence du 12V et la résistance de masse (< 0,5 Ohm).' },
              { title: 'Paramètres en direct', instruction: 'Vérifier la cohérence de la valeur mesurée à la valise de diagnostic.' }
            ],
            suspect_parts: [
              'Capteur / Actionneur associé au DTC',
              'Faisceau électrique et connecteurs'
            ]
          };
        }

        isLoading.value = false;
      }, 300);
    };

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

    const exportPdf = () => {
      window.print();
    };

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

      if (dtcCode.value) {
        onDtcInput();
      }
    });

    return {
      currentTab,
      vehicle,
      symptoms,
      dtcCode,
      dtcError,
      isLoading,
      report,
      quickExamples,
      dtcSearch,
      filteredDtcList,
      vehicleHistory,
      dtcHistory,
      showInstallModal,
      savePersistentData,
      onDtcInput,
      loadExample,
      isFormValid,
      completedChecksCount,
      startDiagnostic,
      shareReportWhatsApp,
      exportPdf,
      handleInstallClick
    };
  }
}).mount('#app');