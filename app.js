const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const form = ref({ vehicle: '', dtc_code: '', symptoms: '' });
    const activeVehicle = ref('');
    const activeDtc = ref('');
    const activeImage = ref(null);
    const loading = ref(false);
    const report = ref('');
    const error = ref('');
    const copied = ref(false);
    const history = ref([]);
    const deferredPrompt = ref(null);

    const severityLevel = ref('ORANGE');
    const severityLabel = ref('');
    const severityAdvice = ref('');
    const checklist = ref([]);

    const imageBase64 = ref(null);
    const imagePreview = ref(null);

    // États Dictée Vocale
    const isRecordingVehicle = ref(false);
    const isRecordingSymptoms = ref(false);
    let recognition = null;
    let activeVoiceTarget = null;
    let baseText = '';

    const examples = [
      { vehicle: 'BMW 320i E36', dtc: 'P0340', symptoms: 'Manque de puissance, calage à chaud' },
      { vehicle: 'Opel Meriva 1.7 CDTI', dtc: 'P0190', symptoms: 'Voyant moteur, à-coups à l\'accélération' },
      { vehicle: 'Renault Clio 3 1.5 dCi', dtc: 'DF053', symptoms: 'Démarrage difficile' }
    ];

    onMounted(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(console.error);
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt.value = e;
      });

      const saved = localStorage.getItem('idiagauto_history');
      if (saved) {
        try { history.value = JSON.parse(saved); } catch (e) {}
      }
    });

    const toggleVoiceInput = (target) => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("La reconnaissance vocale n'est pas supportée sur ce navigateur. Utilise Google Chrome, Edge ou Safari mobile.");
        return;
      }

      // Si le micro tourne déjà sur ce champ, on l'arrête
      if ((target === 'vehicle' && isRecordingVehicle.value) || (target === 'symptoms' && isRecordingSymptoms.value)) {
        stopAllVoice();
        return;
      }

      stopAllVoice();

      activeVoiceTarget = target;
      baseText = (target === 'vehicle' ? form.value.vehicle : form.value.symptoms) || '';

      recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        if (target === 'vehicle') isRecordingVehicle.value = true;
        if (target === 'symptoms') isRecordingSymptoms.value = true;
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          baseText = (baseText ? baseText.trim() + ' ' : '') + finalTranscript.trim();
        }

        const currentText = (baseText ? baseText.trim() + ' ' : '') + interimTranscript;

        if (activeVoiceTarget === 'vehicle') {
          form.value.vehicle = currentText.trimStart();
        } else if (activeVoiceTarget === 'symptoms') {
          form.value.symptoms = currentText.trimStart();
        }
      };

      recognition.onerror = (e) => {
        console.warn('Statut vocal :', e.error);
        if (e.error === 'not-allowed') {
          alert("Microphone bloqué. Vérifie les autorisations de ton navigateur ou les paramètres de confidentialité Windows.");
        }
        stopAllVoice();
      };

      recognition.onend = () => {
        stopAllVoice();
      };

      try {
        recognition.start();
      } catch (err) {
        console.warn('Erreur lancement micro :', err);
        stopAllVoice();
      }
    };

    const stopAllVoice = () => {
      isRecordingVehicle.value = false;
      isRecordingSymptoms.value = false;
      activeVoiceTarget = null;
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {}
        recognition = null;
      }
    };

    const severityClasses = computed(() => {
      if (severityLevel.value === 'RED') return 'bg-red-950/80 border-red-800 text-red-200';
      if (severityLevel.value === 'GREEN') return 'bg-emerald-950/80 border-emerald-800 text-emerald-200';
      return 'bg-amber-950/80 border-amber-800 text-amber-200';
    });

    const severityIcon = computed(() => {
      if (severityLevel.value === 'RED') return '🔴';
      if (severityLevel.value === 'GREEN') return '🟢';
      return '🟡';
    });

    const completedCount = computed(() => checklist.value.filter(c => c.checked).length);

    const progressPercent = computed(() => {
      if (checklist.value.length === 0) return 0;
      return Math.round((completedCount.value / checklist.value.length) * 100);
    });

    const handleImageUpload = (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        imageBase64.value = e.target.result;
        imagePreview.value = e.target.result;
      };
      reader.readAsDataURL(file);
    };

    const removeImage = () => {
      imageBase64.value = null;
      imagePreview.value = null;
    };

    const installPwa = async () => {
      if (deferredPrompt.value) {
        deferredPrompt.value.prompt();
        const { outcome } = await deferredPrompt.value.userChoice;
        if (outcome === 'accepted') deferredPrompt.value = null;
      } else {
        alert("Pour installer l'application :\n• Android : menu ⋮ > Ajouter à l'écran d'accueil\n• iPhone : icône Partage > Sur l'écran d'accueil");
      }
    };

    const fillExample = (ex) => {
      form.value.vehicle = ex.vehicle;
      form.value.dtc_code = ex.dtc;
      form.value.symptoms = ex.symptoms;
    };

    const parsedReport = computed(() => report.value ? marked.parse(report.value) : '');

    const oscaroLink = computed(() => {
      const query = encodeURIComponent(`${activeVehicle.value} ${activeDtc.value}`.trim());
      return `https://www.oscaro.com/fr/search?q=${query}`;
    });

    const autodocLink = computed(() => {
      const query = encodeURIComponent(`${activeVehicle.value} ${activeDtc.value}`.trim());
      return `https://www.auto-doc.fr/search?keyword=${query}`;
    });

    const amazonPartsLink = computed(() => {
      const query = encodeURIComponent(`piece auto ${activeVehicle.value} ${activeDtc.value}`.trim());
      return `https://www.amazon.fr/s?k=${query}`;
    });

    const runDiagnostic = async () => {
      stopAllVoice();
      loading.value = true;
      error.value = '';
      report.value = '';
      copied.value = false;
      activeVehicle.value = form.value.vehicle;
      activeDtc.value = form.value.dtc_code;
      activeImage.value = imageBase64.value;

      try {
        const payload = {
          vehicle: form.value.vehicle,
          dtc_code: form.value.dtc_code,
          symptoms: form.value.symptoms,
          image_base64: imageBase64.value
        };

        const response = await fetch('https://idiagauto.onrender.com/api/diagnose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Erreur serveur');
        }

        const data = await response.json();
        report.value = data.report;
        severityLevel.value = data.severity_level || 'ORANGE';
        severityLabel.value = data.severity_label || 'Roulage sous surveillance';
        severityAdvice.value = data.severity_advice || '';
        checklist.value = (data.checklist || []).map(item => ({ text: item, checked: false }));

        const newEntry = {
          vehicle: form.value.vehicle,
          dtc_code: form.value.dtc_code,
          symptoms: form.value.symptoms,
          image: activeImage.value,
          report: data.report,
          severity_level: severityLevel.value,
          severity_label: severityLabel.value,
          severity_advice: severityAdvice.value,
          checklist: checklist.value,
          date: new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        };
        history.value = [newEntry, ...history.value.filter(h => h.report !== data.report)].slice(0, 10);
        try {
          localStorage.setItem('idiagauto_history', JSON.stringify(history.value));
        } catch (storageErr) {
          console.warn('Quota LocalStorage dépassé.');
        }

      } catch (e) {
        error.value = e.message || 'Impossible de joindre le serveur API.';
      } finally {
        loading.value = false;
      }
    };

    const copyReport = async () => {
      if (!report.value) return;
      try {
        await navigator.clipboard.writeText(
          `=== Rapport iDiagAuto - ${activeVehicle.value} ===\n\n[${severityLabel.value}]\n${severityAdvice.value}\n\n` + report.value
        );
        copied.value = true;
        setTimeout(() => { copied.value = false; }, 2000);
      } catch (err) {
        console.error('Erreur copie :', err);
      }
    };

    const exportPdf = () => {
      window.print();
    };

    const loadFromHistory = (item) => {
      form.value.vehicle = item.vehicle;
      form.value.dtc_code = item.dtc_code || '';
      form.value.symptoms = item.symptoms || '';
      activeVehicle.value = item.vehicle;
      activeDtc.value = item.dtc_code || '';
      activeImage.value = item.image || null;
      report.value = item.report;
      severityLevel.value = item.severity_level || 'ORANGE';
      severityLabel.value = item.severity_label || '';
      severityAdvice.value = item.severity_advice || '';
      checklist.value = item.checklist || [];
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const clearHistory = () => {
      history.value = [];
      localStorage.removeItem('idiagauto_history');
    };

    return {
      form,
      activeVehicle,
      activeDtc,
      activeImage,
      loading,
      report,
      error,
      copied,
      history,
      parsedReport,
      examples,
      severityLevel,
      severityLabel,
      severityAdvice,
      severityClasses,
      severityIcon,
      checklist,
      completedCount,
      progressPercent,
      imageBase64,
      imagePreview,
      isRecordingVehicle,
      isRecordingSymptoms,
      toggleVoiceInput,
      stopAllVoice,
      handleImageUpload,
      removeImage,
      oscaroLink,
      autodocLink,
      amazonPartsLink,
      installPwa,
      fillExample,
      runDiagnostic,
      copyReport,
      exportPdf,
      loadFromHistory,
      clearHistory
    };
  }
}).mount('#app');