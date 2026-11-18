document.addEventListener("DOMContentLoaded", () => {
  const defaults = {
    length: 2.70,
    width: 2.025,
    height: 2.07,
    uValue: 0.40,
    pvSize: 2.7,
    battery: 5.0
  };

  let state = { ...defaults };
  try {
    const saved = JSON.parse(sessionStorage.getItem("huettenenergie-state") || "{}");
    state = { ...defaults, ...saved };
  } catch {
    state = { ...defaults };
  }

  const length = Number(state.length) || defaults.length;
  const width = Number(state.width) || defaults.width;
  const height = Number(state.height) || defaults.height;
  const pvSize = Number(state.pvSize) || defaults.pvSize;
  const batterySize = Number(state.battery) || defaults.battery;
  const uValue = Number(state.uValue) <= 0.16 ? 0.32 : 0.40;

  const wallArea = 2 * height * (length + width);
  const roofArea = (length + 0.425) * (width + 0.475);
  const floorArea = length * width;
  const envelopeArea = wallArea + roofArea + floorArea;
  const heatLoadKw = (envelopeArea * uValue * 25) / 1000;
  const cabinArea = length * width;
  const splitSystem = cabinArea <= 22;

  const pvModule = roofArea < 12
    ? { name: "470-Wp-ABC-Module", watts: 470, area: 1.757 * 1.134, price: 77, id: "aiko470" }
    : { name: "450-Wp-TOPCon-Module", watts: 450, area: 1.762 * 1.134, price: 70, id: "trina450" };
  const pvModuleCount = Math.max(1, Math.ceil(pvSize / (pvModule.watts / 1000)));
  const pvCapacity = pvModuleCount * pvModule.watts / 1000;
  const requiredRoofArea = pvModuleCount * pvModule.area;

  const batterySummary = batterySize <= 5.5
    ? { title: "LiFePO₄", capacity: "4,8 kWh", power: "≈ 3,5 kW", id: "pylon-us5000" }
    : { title: "LiFePO₄", capacity: "5,12 kWh", power: "5,12 kW", id: "byd-hvs51" };

  document.querySelector("#pumpType").textContent = splitSystem
    ? "Luft-Luft-Split-Wärmepumpe"
    : "Luft-Wasser-Wärmepumpe";
  document.querySelector("#pumpDescription").textContent = splitSystem
    ? "Empfohlen für THGA-Hütten bis 22 m² mit geringem Platz- und Speicherbedarf."
    : "Empfohlen für größere Hütten ab 22 m² mit zentralem Heiz- und Wasserkreis.";
  document.querySelector("#pumpPower").textContent = splitSystem
    ? `${Math.max(2.5, heatLoadKw).toFixed(1).replace(".", ",")} kW`
    : `${Math.max(3.4, heatLoadKw).toFixed(1).replace(".", ",")} kW`;
  document.querySelector("#tankSize").textContent = splitSystem ? "Kein Pufferspeicher nötig" : "150–200 l";
  document.querySelector("#pvRecommendation").textContent = `${pvSize.toFixed(1).replace(".", ",")} kWp`;

  const pvSuitability = pvCapacity >= pvSize ? 18 : 10;
  const batterySuitability = batterySize >= 5 ? 18 : 11;
  const insulationSuitability = uValue <= 0.32 ? 25 : 17;
  const matchScore = Math.min(98, 25 + pvSuitability + batterySuitability + insulationSuitability);
  document.querySelector("#matchScore").textContent = `${matchScore} %`;
  document.querySelector("#matchLabel").textContent = matchScore >= 85 ? "Sehr gute Passung" : "Auslegung prüfen";
  document.querySelector("#matchText").textContent = matchScore >= 85
    ? "Dämmstandard, Dachfläche und Speicher sind passend dimensioniert."
    : "PV-Fläche, Dämmung oder Speicher sollten aufeinander abgestimmt werden.";
  document.querySelector("#matchBar").style.width = `${matchScore}%`;

  document.querySelector("#pvTitle").textContent = pvModule.name;
  document.querySelector("#pvCapacity").textContent = `${pvCapacity.toFixed(2).replace(".", ",")} kWp`;
  document.querySelector("#pvModules").textContent = `${pvModuleCount} Module`;
  document.querySelector("#pvArea").textContent = `${requiredRoofArea.toFixed(2).replace(".", ",")} m²`;
  const roofWarning = document.querySelector("#roofWarning");
  if (requiredRoofArea > roofArea) {
    roofWarning.hidden = false;
    roofWarning.textContent = `Dachfläche prüfen: benötigt werden etwa ${requiredRoofArea.toFixed(1).replace(".", ",")} m², verfügbar sind ${roofArea.toFixed(1).replace(".", ",")} m² inklusive Überstände.`;
  } else {
    roofWarning.hidden = true;
  }

  document.querySelector("#batteryTitle").textContent = batterySummary.title;
  document.querySelector("#batteryCapacity").textContent = batterySummary.capacity;
  document.querySelector("#batteryPower").textContent = batterySummary.power;

  const products = [
    {
      id:"daikin-perfera", category:"heat", name:"Daikin Perfera FTXM25A + RXM25A9",
      price:1843, top:true, topLabel:"Top Pick",
      specs:["Luft-Luft Split · R32","2,5 kW Kühl. / 2,8 kW Heiz.","SCOP 5,20 · A+++","ab 19 dB(A) · WiFi · Heat-Boost"]
    },
    {
      id:"mitsubishi-rz25", category:"heat", name:"Mitsubishi Electric MSZ-RZ25VU + MUZ-RZ25VUHZ",
      price:2489,
      specs:["Hyper-Heating Split · R290","GWP 0,02 · 3,2 kW Leistung","100 % Heizleistung bis −25 °C","Betrieb bis −30 °C · SCOP 5,30 · A+++ · ab 19 dB(A)"]
    },
    {
      id:"vaillant-arotherm", category:"heat", name:"Vaillant aroTHERM plus VWL 35/8.1 A",
      price:5254, top:true, topLabel:"Top Pick",
      specs:["Luft-Wasser Monoblock · R290","3,0 kW · max. 3,4 kW","Vorlauf bis 75 °C · A+++","ETAs 202 % · 27,5 dB(A) Nachtmodus"]
    },
    {
      id:"aiko470", category:"pv", name:"AIKO Neostar 2P+ 470 Wp (A-MAH54Dw)",
      price:77, top:true, topLabel:"Top Pick", watts:470,
      specs:["N-Type ABC Rückkontakt · Glas-Glas","23,6 % Wirkungsgrad","1.757 × 1.134 × 30 mm · 24,5 kg","−0,26 %/°C · 25/30 J. Garantie"]
    },
    {
      id:"trina450", category:"pv", name:"Trina Solar Vertex S+ 450 Wp (TSM-NEG9R.28)",
      price:70, watts:450,
      specs:["N-Type i-TOPCon Doppelglas","22,5 % Wirkungsgrad","1.762 × 1.134 × 30 mm · 21,1 kg","5.400 Pa Schneelast"]
    },
    {
      id:"aiko470g3", category:"pv", name:"AIKO Neostar 3S+ 470 Wp (Gen. 3 Fullblack)",
      price:82, watts:470,
      specs:["N-Type ABC Gen. 3 Doppelglas","Bis 23,8 % Wirkungsgrad","1.757 × 1.134 × 30 mm · 21,5 kg","Stäubli MC4-EVO2 · Teilverschattungs-Optimierung"]
    },
    {
      id:"pylon-us5000", category:"battery", name:"Pylontech US5000 (4,8 kWh · 48 V)",
      price:750, top:true, topLabel:"Top Pick",
      specs:["Niedervolt · LiFePO₄ · 48 V","4,56 kWh nutzbar · 95 % DoD","> 6.000 Zyklen · 39,5 kg","Ideal für 48-V-Inselanlagen (Victron)"]
    },
    {
      id:"huawei-luna5", category:"battery", name:"Huawei LUNA2000-5-S0 (5,0 kWh)",
      price:2016,
      specs:["Hochvolt modular · LiFePO₄","5,0 kWh nutzbar · 100 % DoD","2,5 kW Entladung","IP66 · −20 °C bis +55 °C"]
    },
    {
      id:"byd-hvs51", category:"battery", name:"BYD Battery-Box Premium HVS 5.1 (5,12 kWh)",
      price:2031, top:true, topLabel:"Top Pick",
      specs:["Hochvolt-Turm · LiFePO₄","5,12 kWh nutzbar · 100 % DoD","5,12 kW Entladung · Peak 50 A","IP55 · Off-Grid- & Ersatzstrombetrieb"]
    }
  ];

  const categoryLabels = { heat:"Wärmepumpe", pv:"PV-Modul", battery:"Batteriespeicher" };
  const selected = {
    heat: splitSystem ? "daikin-perfera" : "vaillant-arotherm",
    pv: pvModule.id,
    battery: batterySummary.id
  };
  let activeCategory = "alle";
  let includeShell = false;

  function formatEuro(value) {
    return `${Math.round(value).toLocaleString("de-DE")} €`;
  }

  function getSelectedProduct(category) {
    return products.find((product) => product.id === selected[category]);
  }

  function updateCosts() {
    const heat = getSelectedProduct("heat");
    const pv = getSelectedProduct("pv");
    const battery = getSelectedProduct("battery");
    const pvCount = pv.watts
      ? Math.max(1, Math.ceil(pvSize / (pv.watts / 1000)))
      : pvModuleCount;
    const pvTotal = pv.price * pvCount;
    const shell = includeShell ? 1977.77 : 0;
    const total = heat.price + pvTotal + battery.price + shell;

    document.querySelector("#heatPumpCost").textContent = formatEuro(heat.price);
    document.querySelector("#pvCost").textContent = formatEuro(pvTotal);
    document.querySelector("#batteryCost").textContent = formatEuro(battery.price);
    document.querySelector("#totalCost").textContent = total >= 10000
      ? total.toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2}) + " €"
      : formatEuro(total);
  }

  function renderProducts() {
    const visible = activeCategory === "alle"
      ? products
      : products.filter((product) => product.category === activeCategory);
    document.querySelector("#productGrid").innerHTML = visible.map((product) => {
      const selectedState = selected[product.category] === product.id;
      const priceNote = product.category === "pv" ? "pro Modul" : "inkl. MwSt.";
      return `
        <article class="product-card${selectedState ? " selected" : ""}" data-id="${product.id}">
          <div class="product-card-top">
            <span class="category-tag">${categoryLabels[product.category]}</span>
            ${product.top ? `<span class="category-tag top-pick">${product.topLabel}</span>` : ""}
          </div>
          <h3>${product.name}</h3>
          <ul class="product-specs">${product.specs.map((spec) => `<li>${spec}</li>`).join("")}</ul>
          <div class="product-footer">
            <div class="product-price">${formatEuro(product.price)}<small>${priceNote}</small></div>
            <button type="button" class="select-button" data-id="${product.id}" aria-pressed="${selectedState}">
              ${selectedState ? "Ausgewählt" : "Auswählen"}
            </button>
          </div>
        </article>`;
    }).join("");

    document.querySelectorAll(".select-button").forEach((button) => {
      button.addEventListener("click", () => {
        const product = products.find((item) => item.id === button.dataset.id);
        selected[product.category] = product.id;
        renderProducts();
        updateCosts();
      });
    });
  }

  document.querySelectorAll("#categoryTabs button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#categoryTabs button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      activeCategory = button.dataset.category;
      renderProducts();
    });
  });

  document.querySelector("#shellToggle").addEventListener("change", (event) => {
    includeShell = event.target.checked;
    updateCosts();
  });
  document.querySelector("#printButton").addEventListener("click", () => window.print());

  renderProducts();
  updateCosts();
});
