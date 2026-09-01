const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const currentTab = ref('diag'); // 'diag' ou 'elec'

    // Diagnostic form
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

    // Calculateur Électrique
    const elec = ref({
      component: 'battery_rest',
      value: null
    });

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

    // Unités et placeholders pour le calculateur
    const currentUnit = computed(() => {
      if (elec.value.component.startsWith('battery') || elec.value.component === 'alternator') {
        return 'Volts DC (V)';
      }
      if (elec.value.component === 'ignition_secondary') {
        return 'kilo-Ohms (kΩ)';
      }
      return 'Ohms (Ω)';
    });

    const currentPlaceholder = computed(() => {
      switch (elec.value.component) {
        case 'battery_rest': return '12.6';
        case 'battery_cranking': return '10.2';
        case 'alternator': return '14.2';
        case 'ignition_primary': return '0.8';
        case 'ignition_secondary': return '8.5';
        case 'injector': return '14.0';
        case 'crank_sensor': return '650';
        case 'temp_sensor': return '2500';
        default: return '0';
      }
    });

    // Évaluation logique des mesures électriques
    const elecResult = computed(() => {
      const val = elec.value.value;
      if (val === null || val === undefined || isNaN(val) || val === '') return null;

      switch (elec.value.component) {
        case 'battery_rest':
          if (val >= 12.6) {
            return {
              status: 'Batterie chargée à 100 %',
              icon: '🟢',
              range: '12,6 V à 12,8 V',
              comment: 'Tension de repos parfaite. État de charge optimal.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else if (val >= 12.2) {
            return {
              status: 'Batterie partiellement déchargée (50-75 %)',
              icon: '🟡',
              range: '12,6 V à 12,8 V',
              comment: 'Recharge conseillée pour éviter la sulfatation des plaques.',
              boxClass: 'bg-amber-950/80 border-amber-800 text-amber-200'
            };
          } else {
            return {
              status: 'Batterie déchargée ou en fin de vie',
              icon: '🔴',
              range: '12,6 V à 12,8 V',
              comment: 'Tension critique (< 12,0 V = décharge profonde). Tester les éléments et recharger.',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'battery_cranking':
          if (val >= 9.6) {
            return {
              status: 'Chute de tension normale au démarrage',
              icon: '🟢',
              range: '≥ 9,6 V pendant l\'action du démarreur',
              comment: 'La batterie délivre une intensité suffisante sous forte charge.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else {
            return {
              status: 'Chute de tension excessive au démarrage',
              icon: '🔴',
              range: '≥ 9,6 V',
              comment: 'Batterie affaiblie, démarreur en court-circuit ou mauvaise masse moteur.',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'alternator':
          if (val >= 13.8 && val <= 14.7) {
            return {
              status: 'Circuit de charge conforme',
              icon: '🟢',
              range: '13,8 V à 14,7 V moteur tournant',
              comment: 'Régulateur et alternateur fonctionnent parfaitement.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else if (val < 13.8) {
            return {
              status: 'Sous-charge (Alternateur défaillant)',
              icon: '🔴',
              range: '13,8 V à 14,7 V',
              comment: 'Courroie accessoire détendue, charbons/régulateur usés ou alternateur HS.',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          } else {
            return {
              status: 'Surtension critique (Régulateur HS)',
              icon: '🔴',
              range: '13,8 V à 14,7 V',
              comment: 'Tension trop élevée (> 14,8 V) ! Risque de destruction des calculateurs et de la batterie.',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'ignition_primary':
          if (val >= 0.4 && val <= 1.5) {
            return {
              status: 'Enroulement primaire conforme',
              icon: '🟢',
              range: '0,4 Ω à 1,5 Ω',
              comment: 'Résistance du circuit primaire de bobine dans les tolérances standard.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else {
            return {
              status: 'Bobine non conforme (Primaire)',
              icon: '🔴',
              range: '0,4 Ω à 1,5 Ω',
              comment: 'Résistance hors plage : court-circuit interne (si ~0 Ω) ou bobinage coupé (si infini / OL).',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'ignition_secondary':
          if (val >= 5.0 && val <= 15.0) {
            return {
              status: 'Enroulement secondaire conforme',
              icon: '🟢',
              range: '5 kΩ à 15 kΩ (selon modèle)',
              comment: 'Résistance haute tension normale.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else {
            return {
              status: 'Secondaire haute tension défaillant',
              icon: '🔴',
              range: '5 kΩ à 15 kΩ',
              comment: 'Bobinage HT coupé ou amorçage interne. Remplacement de bobine requis.',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'injector':
          if (val >= 11.0 && val <= 16.0) {
            return {
              status: 'Solénoïde d\'injecteur conforme',
              icon: '🟢',
              range: '11 Ω à 16 Ω (haute impédance)',
              comment: 'Résistance normale pour un injecteur essence à commande indirecte.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else {
            return {
              status: 'Injecteur hors tolérance',
              icon: '🔴',
              range: '11 Ω à 16 Ω',
              comment: 'Bobinage d\'injecteur en court-circuit ou coupé.',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'crank_sensor':
          if (val >= 400 && val <= 1000) {
            return {
              status: 'Capteur PMH inductif conforme',
              icon: '🟢',
              range: '400 Ω à 1000 Ω (moteur froid)',
              comment: 'Continuité et bobinage de détection de position corrects.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else {
            return {
              status: 'Capteur PMH HS ou coupé',
              icon: '🔴',
              range: '400 Ω à 1000 Ω',
              comment: 'Bobinage ouvert ou altéré par la chaleur (cause typique de calage ou non-démarrage à chaud).',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'temp_sensor':
          if (val >= 1800 && val <= 3200) {
            return {
              status: 'Sonde CTN conforme à température ambiante',
              icon: '🟢',
              range: '2000 Ω à 3000 Ω à ~20°C',
              comment: 'Valeur normale pour capteur de température liquide de refroidissement ou air.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else {
            return {
              status: 'Sonde de température hors tolérance',
              icon: '🟡',
              range: '2000 Ω à 3000 Ω à 20°C',
              comment: 'Si mesurée à 20°C, la sonde dérive (fausse indication transmise au calculateur).',
              boxClass: 'bg-amber-950/80 border-amber-800 text-amber-200'
            };
          }

        default:
          return null;
      }
    });

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
      currentTab.value = 'diag';
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
      currentTab,
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
      elec,
      currentUnit,
      currentPlaceholder,
      elecResult,
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