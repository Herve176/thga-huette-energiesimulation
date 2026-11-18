document.addEventListener("DOMContentLoaded", () => {
  const state = getSimulationState();
  const els = {
    length: document.querySelector("#lengthInput"),
    width: document.querySelector("#widthInput"),
    height: document.querySelector("#heightInput"),
    insulation: document.querySelector("#insulation"),
    occupancy: document.querySelector("#occupancy"),
    pvRange: document.querySelector("#pvRange"),
    batteryRange: document.querySelector("#batteryRange"),
    pvOutput: document.querySelector("#pvOutput"),
    batteryOutput: document.querySelector("#batteryOutput"),
    autarky: document.querySelector("#autarky"),
    demand: document.querySelector("#demand"),
    shortage: document.querySelector("#shortage"),
    autarkyTrend: document.querySelector("#autarkyTrend"),
    chart: document.querySelector("#chart"),
    physicsHint: document.querySelector("#physicsHint"),
    roofWarning: document.querySelector("#roofWarning"),
    toast: document.querySelector(".toast")
  };

  function syncInputs() {
    els.length.value = state.length;
    els.width.value = state.width;
    els.height.value = state.height;
    els.insulation.value = String(state.uValue);
    els.occupancy.value = state.occupancy;
    els.pvRange.value = state.pvSize;
    els.batteryRange.value = state.battery;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function readInputs() {
    const length = Math.min(20, Math.max(2, Number(els.length.value) || HUTTEN_DEFAULTS.length));
    const width = Math.min(20, Math.max(2, Number(els.width.value) || HUTTEN_DEFAULTS.width));
    const height = Math.min(8, Math.max(2, Number(els.height.value) || HUTTEN_DEFAULTS.height));
    els.length.value = length;
    els.width.value = width;
    els.height.value = height;
    return {
      length,
      width,
      height,
      uValue: Number(els.insulation.value),
      occupancy: els.occupancy.value,
      pvSize: Number(els.pvRange.value),
      battery: Number(els.batteryRange.value)
    };
  }

  function render() {
    Object.assign(state, readInputs());
    saveSimulationState(state);
    const result = calculateEnergyBalance(state);

    els.pvOutput.innerHTML = `${state.pvSize.toFixed(1).replace(".", ",")} <small>kWp</small>`;
    els.batteryOutput.innerHTML = `${state.battery.toFixed(1).replace(".", ",")} <small>kWh</small>`;
    els.autarky.textContent = `${result.autarky} %`;
    els.demand.textContent = `${result.annualDemand.toLocaleString("de-DE")} kWh`;
    els.shortage.textContent = `${result.shortageHours.toLocaleString("de-DE")} h`;
    els.autarkyTrend.textContent = result.autarky >= 85 ? "Sehr gut" : result.autarky >= 65 ? "Gut" : "Optimieren";
    els.autarkyTrend.className = `pill ${result.autarky < 65 ? "warn" : ""}`;

    els.physicsHint.className = `physics-hint ${result.insulationInfo.status}`;
    els.physicsHint.textContent = result.insulationInfo.note;

    if (state.pvSize > result.maxRoofPv) {
      els.roofWarning.hidden = false;
      els.roofWarning.textContent = `Die Dachfläche trägt rechnerisch ca. ${result.maxRoofPv.toFixed(1).replace(".", ",")} kWp. Für mehr Leistung ist ein Carport oder eine andere Fläche nötig.`;
    } else {
      els.roofWarning.hidden = true;
    }

    const maxValue = Math.max(...result.monthlyData.map((item) => Math.max(item.pvKwh, item.loadKwh)), 100);
    els.chart.innerHTML = result.monthlyData.map((item) => {
      const pvHeight = Math.max(4, Math.round((item.pvKwh / maxValue) * 92));
      const loadHeight = Math.max(4, Math.round((item.loadKwh / maxValue) * 92));
      return `<div class="month-column" title="${item.month}: PV ${item.pvKwh} kWh, Bedarf ${item.loadKwh} kWh">
        <div class="chart-bars"><i class="chart-bar pv" style="height:${pvHeight}%"></i><i class="chart-bar load" style="height:${loadHeight}%"></i></div>
        <span>${item.month}</span>
      </div>`;
    }).join("");
  }

  document.querySelectorAll(".section-heading").forEach((heading) => {
    heading.addEventListener("click", () => {
      const section = heading.closest(".setting-section");
      const content = section.querySelector(".section-content");
      const willOpen = !section.classList.contains("open");
      section.classList.toggle("open", willOpen);
      content.classList.toggle("collapsed", !willOpen);
      heading.setAttribute("aria-expanded", String(willOpen));
    });
  });

  [els.length, els.width, els.height, els.insulation, els.occupancy, els.pvRange, els.batteryRange].forEach((element) => {
    element.addEventListener("input", render);
    element.addEventListener("change", render);
  });

  document.querySelector("#resetButton").addEventListener("click", () => {
    Object.assign(state, HUTTEN_DEFAULTS);
    syncInputs();
    render();
    showToast("THGA-Prototyp mit Originalmaßen wiederhergestellt.");
  });

  const variantDrawer = document.querySelector("#variantDrawer");
  const drawerBackdrop = document.querySelector("#drawerBackdrop");
  function setDrawer(open) {
    variantDrawer.classList.toggle("open", open);
    drawerBackdrop.classList.toggle("open", open);
    variantDrawer.setAttribute("aria-hidden", String(!open));
  }

  document.querySelector("#variantsLink").addEventListener("click", () => setDrawer(true));
  document.querySelector("#closeDrawer").addEventListener("click", () => setDrawer(false));
  drawerBackdrop.addEventListener("click", () => setDrawer(false));

  function readVariants() {
    try { return JSON.parse(localStorage.getItem("huettenenergie-variants") || "[]"); }
    catch { return []; }
  }

  function renderVariants() {
    const variants = readVariants();
    const list = document.querySelector("#variantList");
    if (!variants.length) {
      list.innerHTML = '<p class="empty-state">Noch keine Varianten gespeichert.</p>';
      return;
    }
    list.innerHTML = variants.map((variant, index) => `
      <article class="variant-item">
        <button type="button" class="variant-load" data-index="${index}">
          <span><strong>${variant.name}</strong><small>${variant.state.pvSize} kWp · ${variant.state.battery} kWh · ${variant.autarky} %</small></span>
          <b>Öffnen</b>
        </button>
      </article>`).join("");
    list.querySelectorAll(".variant-load").forEach((button) => {
      button.addEventListener("click", () => {
        const variant = variants[Number(button.dataset.index)];
        Object.assign(state, variant.state);
        syncInputs();
        render();
        setDrawer(false);
        showToast(`${variant.name} geladen.`);
      });
    });
  }

  document.querySelector("#saveButton").addEventListener("click", () => {
    const variants = readVariants();
    const result = calculateEnergyBalance(state);
    variants.push({
      name: `Variante ${variants.length + 1}`,
      state: { ...state },
      autarky: result.autarky
    });
    localStorage.setItem("huettenenergie-variants", JSON.stringify(variants));
    renderVariants();
    setDrawer(true);
  });

  const menuButton = document.querySelector(".menu-button");
  const navigation = document.querySelector(".main-nav");
  menuButton.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!open));
    navigation.classList.toggle("open", !open);
  });

  document.querySelector("#simulateButton").addEventListener("click", () => {
    const overlay = document.querySelector("#calculationOverlay");
    const button = document.querySelector("#simulateButton");
    render();
    button.disabled = true;
    overlay.classList.add("active");
    window.setTimeout(() => {
      window.location.href = "graph.html";
    }, 1200);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setDrawer(false);
  });

  syncInputs();
  renderVariants();
  render();
});
