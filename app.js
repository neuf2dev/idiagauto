const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const currentTab = ref('diag'); // 'diag', 'elec', ou 'offline_dtc'

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

    // Calculateur électrique
    const elecComponent = ref('battery_rest');
    const elecValue = ref(null);

    // Dictionnaire DTC hors-ligne
    const dtcSearchQuery = ref('');
    const offlineDtcDatabase = [
      {
        code: 'P0300',
        system: 'Allumage',
        title: 'Ratés d\'allumage multiples / aléatoires détectés',
        causes: 'Bougies usées, bobines d\'allumage défaillantes, prise d\'air admission, injecteurs encrassés.',
        check: 'Contrôler la couleur des bougies, tester la résistance des bobines (primaire/secondaire), vérifier l\'étanchéité de l\'admission avec de la fumée.'
      },
      {
        code: 'P0340',
        system: 'Capteurs',
        title: 'Capteur de position d\'arbre à cames (Ligne 1) - Panne du circuit',
        causes: 'Capteur AAC HS, faisceau coupé/oxydé, cible d\'arbre à cames sale, calage de distribution décalé.',
        check: 'Mesurer la continuité et l\'alimentation (5V ou 12V) au connecteur. Signal au multimètre/oscilloscope. Vérifier le calage distribution.'
      },
      {
        code: 'P0171',
        system: 'Injection',
        title: 'Mélange trop pauvre (Ligne 1 - Trop d\'air ou pas assez de carburant)',
        causes: 'Prise d\'air après débitmètre (durite percée), débitmètre de masse d\'air (MAF) encrassé, filtre à essence colmaté, pompe à essence fatiguée.',
        check: 'Inspecter les manchons d\'admission en caoutchouc, nettoyer le capteur MAF au nettoyant contact, mesurer la pression d\'essence à la rampe.'
      },
      {
        code: 'P0172',
        system: 'Injection',
        title: 'Mélange trop riche (Ligne 1 - Trop de carburant ou manque d\'air)',
        causes: 'Sonde lambda amont défaillante, régulateur de pression d\'essence bloqué fermé, injecteur qui fuit/goutte, filtre à air bouché.',
        check: 'Contrôler la tension oscillante de la sonde lambda (0,1V à 0,9V), vérifier le tuyau de dépression du régulateur de pression.'
      },
      {
        code: 'P0420',
        system: 'Dépollution',
        title: 'Rendement du catalyseur inférieur au seuil (Ligne 1)',
        causes: 'Catalyseur colmaté ou détruit, fuite à l\'échappement en amont, sonde lambda aval défectueuse.',
        check: 'Vérifier l\'absence de fuite/trou sur la ligne d\'échappement. Comparer la courbe de la sonde aval (qui doit être stable à ~0,45V à chaud).'
      },
      {
        code: 'P0190',
        system: 'Injection',
        title: 'Capteur de pression de la rampe de distribution - Panne du circuit',
        causes: 'Capteur de pression de rampe HS, faisceau écrasé, connecteur oxydé, pompe haute pression (Common Rail).',
        check: 'Contrôler l\'alimentation 5V et la masse du capteur. Mesurer la tension du signal au ralenti (environ 1,0V à 1,3V selon consigne).'
      },
      {
        code: 'P0115',
        system: 'Refroidissement',
        title: 'Sonde de température de liquide de refroidissement (ECT) - Panne du circuit',
        causes: 'Sonde CTN coupée ou en court-circuit, thermostat bloqué ouvert, connecteur corrodé.',
        check: 'Mesurer la résistance de la sonde débranchée (environ 2000 à 3000 Ω à 20°C, chute à ~200-300 Ω à 90°C).'
      },
      {
        code: 'P0401',
        system: 'Dépollution',
        title: 'Système EGR - Débit insuffisant détecté',
        causes: 'Vanne EGR calaminée/bloquée, conduits d\'admission encrassés, capteur de pression différentielle défaillant.',
        check: 'Démonter la vanne EGR pour nettoyage mécanique, tester l\'actionneur pneumatique ou électrique, décalaminer les conduits.'
      },
      {
        code: 'DF053',
        system: 'Injection',
        title: 'Renault/Dacia : Fonction régulation de pression rail',
        causes: 'Régulateur de débit sur pompe HP grippé, filtre à gazole colmaté, fuite de retour d\'injecteurs excessive.',
        check: 'Faire un test de débit de retour d\'injecteurs aux éprouvettes (godets), remplacer le filtre à gazole, contrôler la limaille dans le filtre.'
      },
      {
        code: 'DF002',
        system: 'Alimentation',
        title: 'Renault/Dacia : Potentiomètre de position papillon / Pédale',
        causes: 'Piste du potentiomètre usée, connecteur pédale d\'accélérateur lâche, boîtier papillon encrassé.',
        check: 'Mesurer la variation linéaire de tension sur les deux pistes lors de l\'enfoncement progressif de la pédale (double piste de sécurité).'
      }
    ];

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

    const filteredDtcList = computed(() => {
      const q = dtcSearchQuery.value.trim().toLowerCase();
      if (!q) return offlineDtcDatabase;
      return offlineDtcDatabase.filter(item => 
        item.code.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.causes.toLowerCase().includes(q) ||
        item.system.toLowerCase().includes(q)
      );
    });

    const injectDtcToDiag = (item) => {
      form.value.dtc_code = item.code;
      form.value.symptoms = item.title;
      currentTab.value = 'diag';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const currentUnit = computed(() => {
      if (elecComponent.value.startsWith('battery') || elecComponent.value === 'alternator') {
        return 'Volts DC (V)';
      }
      if (elecComponent.value === 'ignition_secondary') {
        return 'kilo-Ohms (kΩ)';
      }
      return 'Ohms (Ω)';
    });

    const currentPlaceholder = computed(() => {
      switch (elecComponent.value) {
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

    const elecResult = computed(() => {
      const val = elecValue.value;
      if (val === null || val === undefined || isNaN(val) || val === '') return null;

      switch (elecComponent.value) {
        case 'battery_rest':
          if (val >= 12.6) {
            return {
              status: 'Batterie chargée à 100 %',
              icon: '🟢',
              range: '12,6 V à 12,8 V',
              comment: 'Tension de repos optimale.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else if (val >= 12.2) {
            return {
              status: 'Batterie partiellement déchargée (50-75 %)',
              icon: '🟡',
              range: '12,6 V à 12,8 V',
              comment: 'Recharge conseillée pour éviter la sulfatation.',
              boxClass: 'bg-amber-950/80 border-amber-800 text-amber-200'
            };
          } else {
            return {
              status: 'Batterie déchargée ou en fin de vie',
              icon: '🔴',
              range: '12,6 V à 12,8 V',
              comment: 'Tension critique (< 12,0 V = décharge profonde). Tester et recharger.',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'battery_cranking':
          if (val >= 9.6) {
            return {
              status: 'Chute de tension normale au démarrage',
              icon: '🟢',
              range: '≥ 9,6 V sous action démarreur',
              comment: 'Intensité délivrée suffisante sous forte charge.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else {
            return {
              status: 'Chute de tension excessive au démarrage',
              icon: '🔴',
              range: '≥ 9,6 V',
              comment: 'Batterie affaiblie, démarreur en court-circuit ou masse moteur défectueuse.',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'alternator':
          if (val >= 13.8 && val <= 14.7) {
            return {
              status: 'Circuit de charge conforme',
              icon: '🟢',
              range: '13,8 V à 14,7 V moteur tournant',
              comment: 'Régulateur et alternateur opérationnels.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else if (val < 13.8) {
            return {
              status: 'Sous-charge (Alternateur défaillant)',
              icon: '🔴',
              range: '13,8 V à 14,7 V',
              comment: 'Courroie détendue, charbons usés ou alternateur HS.',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          } else {
            return {
              status: 'Surtension critique (Régulateur HS)',
              icon: '🔴',
              range: '13,8 V à 14,7 V',
              comment: 'Tension trop haute (> 14,8 V). Risque de griller les calculateurs.',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'ignition_primary':
          if (val >= 0.4 && val <= 1.5) {
            return {
              status: 'Enroulement primaire conforme',
              icon: '🟢',
              range: '0,4 Ω à 1,5 Ω',
              comment: 'Résistance primaire de bobine normale.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else {
            return {
              status: 'Bobine non conforme (Primaire)',
              icon: '🔴',
              range: '0,4 Ω à 1,5 Ω',
              comment: 'Court-circuit interne (si ~0 Ω) ou bobinage coupé (si infini / OL).',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'ignition_secondary':
          if (val >= 5.0 && val <= 15.0) {
            return {
              status: 'Enroulement secondaire conforme',
              icon: '🟢',
              range: '5 kΩ à 15 kΩ',
              comment: 'Résistance haute tension normale.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else {
            return {
              status: 'Secondaire haute tension défaillant',
              icon: '🔴',
              range: '5 kΩ à 15 kΩ',
              comment: 'Bobinage HT coupé ou amorçage interne.',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'injector':
          if (val >= 11.0 && val <= 16.0) {
            return {
              status: 'Solénoïde d\'injecteur conforme',
              icon: '🟢',
              range: '11 Ω à 16 Ω (haute impédance)',
              comment: 'Résistance nominale pour injecteur essence standard.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else {
            return {
              status: 'Injecteur hors tolérance',
              icon: '🔴',
              range: '11 Ω à 16 Ω',
              comment: 'Bobinage en court-circuit ou coupé.',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'crank_sensor':
          if (val >= 400 && val <= 1000) {
            return {
              status: 'Capteur PMH inductif conforme',
              icon: '🟢',
              range: '400 Ω à 1000 Ω (froid)',
              comment: 'Bobinage de détection de position opérationnel.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else {
            return {
              status: 'Capteur PMH HS ou coupé',
              icon: '🔴',
              range: '400 Ω à 1000 Ω',
              comment: 'Bobinage ouvert ou altéré par la chaleur (cause typique de calage à chaud).',
              boxClass: 'bg-red-950/80 border-red-800 text-red-200'
            };
          }

        case 'temp_sensor':
          if (val >= 1800 && val <= 3200) {
            return {
              status: 'Sonde CTN conforme à ~20°C',
              icon: '🟢',
              range: '2000 Ω à 3000 Ω à 20°C',
              comment: 'Valeur normale pour capteur de température eau/air.',
              boxClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            };
          } else {
            return {
              status: 'Sonde de température hors tolérance',
              icon: '🟡',
              range: '2000 Ω à 3000 Ω à 20°C',
              comment: 'Si mesurée à 20°C, la sonde dérive.',
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
      currentTab.value = 'diag';
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
      elecComponent,
      elecValue,
      currentUnit,
      currentPlaceholder,
      elecResult,
      dtcSearchQuery,
      filteredDtcList,
      injectDtcToDiag,
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