const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const currentTab = ref('diag');

    // Persistance véhicule & symptômes
    const vehicle = ref(localStorage.getItem('idiag_vehicle') || '');
    const symptoms = ref(localStorage.getItem('idiag_symptoms') || '');
    const dtcCode = ref('');
    const dtcError = ref('');
    const isLoading = ref(false);
    const errorMessage = ref('');

    // Exemples d'origine conformes à l'image 088
    const quickExamples = [
      { label: 'BMW 320i E36 · P0340', vehicle: 'BMW Série 3 E36 320i', dtc: 'P0340', symptoms: 'Manque de reprise, ralenti instable, démarrage difficile' },
      { label: 'Opel Meriva 1.7 CDTI · P0190', vehicle: 'Opel Meriva 1.7 CDTI', dtc: 'P0190', symptoms: 'Coupure moteur sous charge, voyant clé' },
      { label: 'Renault Clio 3 1.5 dCi · DF053', vehicle: 'Renault Clio 3 1.5 dCi', dtc: 'P0089', symptoms: 'Message injection à contrôler' }
    ];

    // PWA Prompt
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

      const dtcRegex = /^[PCBU][0-9A-F]{4}$/;

      if (!/^[PCBU]/.test(val)) {
        dtcError.value = 'Doit débuter par P, C, B ou U';
      } else if (val.length < 5) {
        dtcError.value = `5 caractères requis (${val.length}/5)`;
      } else if (!dtcRegex.test(val)) {
        dtcError.value = 'Format hexadécimal invalide (0-9, A-F)';
      } else {
        dtcError.value = '';
      }
    };

    const loadExample = (ex) => {
      vehicle.value = ex.vehicle;
      dtcCode.value = ex.dtc;
      symptoms.value = ex.symptoms;
      dtcError.value = '';
      errorMessage.value = '';
      savePersistentData();
    };

    const isFormValid = computed(() => {
      const dtcRegex = /^[PCBU][0-9A-F]{4}$/;
      return vehicle.value.trim().length >= 2 && dtcRegex.test(dtcCode.value);
    });

    const startDiagnostic = () => {
      if (!isFormValid.value) return;
      isLoading.value = true;
      errorMessage.value = '';
      savePersistentData();

      // Simulation de traitement
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
      errorMessage,
      quickExamples,
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