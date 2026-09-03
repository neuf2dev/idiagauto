const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const currentTab = ref('diag');

    // Persistance
    const vehicle = ref(localStorage.getItem('idiag_vehicle') || '');
    const symptoms = ref(localStorage.getItem('idiag_symptoms') || '');
    const dtcCode = ref('');
    const dtcError = ref('');
    const isLoading = ref(false);

    // Données des exemples rapides (avec label et code séparés)
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
      { code: 'C1528', system: 'Direction assistée', label: 'Anomalie rotation / signal capteur moteur EPS' },
      { code: 'U0100', system: 'Réseau CAN', label: 'Perte de communication avec le calculateur moteur (ECM/PCM)' }
    ]);

    // PWA
    const installPrompt = ref(null);
    const showInstallModal = ref(false);

    const savePersistentData = () => {
      localStorage.setItem('idiag_vehicle', vehicle.value);
      localStorage.setItem('idiag_symptoms', symptoms.value);
    };

    const onDtcInput = () => {
      dtcCode.value = dtcCode.value.toUpperCase().trim();
      const val = dtcCode.value;

      if (!val) {
        dtcError.value = '';
        return;
      }

      const isStandardDtc = /^[PCBU][0-9A-F]{4}$/.test(val);
      const isRenaultDf = /^DF[0-9A-F]{3}$/.test(val);

      if (val.length < 5) {
        dtcError.value = `5 caractères requis (${val.length}/5)`;
      } else if (!isStandardDtc && !isRenaultDf) {
        dtcError.value = 'Code invalide (ex: P0340 ou DF053)';
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
      const val = dtcCode.value;
      const isStandardDtc = /^[PCBU][0-9A-F]{4}$/.test(val);
      const isRenaultDf = /^DF[0-9A-F]{3}$/.test(val);
      return vehicle.value.trim().length >= 2 && (isStandardDtc || isRenaultDf);
    });

    const filteredDtcList = computed(() => {
      const q = dtcSearch.value.trim().toUpperCase();
      if (!q) return dtcDatabase.value;
      return dtcDatabase.value.filter(d => d.code.includes(q) || d.label.toUpperCase().includes(q));
    });

    const startDiagnostic = () => {
      if (!isFormValid.value) return;
      isLoading.value = true;
      savePersistentData();

      setTimeout(() => {
        isLoading.value = false;
      }, 500);
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
    });

    return {
      currentTab,
      vehicle,
      symptoms,
      dtcCode,
      dtcError,
      isLoading,
      quickExamples,
      dtcSearch,
      filteredDtcList,
      showInstallModal,
      savePersistentData,
      onDtcInput,
      loadExample,
      isFormValid,
      startDiagnostic,
      handleInstallClick
    };
  }
}).mount('#app');