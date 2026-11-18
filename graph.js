document.addEventListener("DOMContentLoaded", () => {
  const state = getSimulationState();
  const result = calculateEnergyBalance(state);

  document.querySelector("#autarky").textContent = `${result.autarky} %`;
  document.querySelector("#gaugeValue").textContent = result.autarky;
  document.querySelector("#gaugeRing").style.setProperty("--value", `${result.autarky}%`);
  document.querySelector("#annualDemand").textContent = `${result.annualDemand.toLocaleString("de-DE")} kWh`;
  document.querySelector("#shortage").textContent = `${result.shortageHours.toLocaleString("de-DE")} h`;
  document.querySelector("#pvValue").textContent = `${state.pvSize.toFixed(1).replace(".", ",")} kWp`;
  document.querySelector("#batteryValue").textContent = `${state.battery.toFixed(1).replace(".", ",")} kWh`;
  document.querySelector("#areaValue").textContent = `${result.innerFloorArea.toFixed(1).replace(".", ",")} m²`;

  const status = document.querySelector("#autarkyStatus");
  status.textContent = result.autarky >= 85 ? "Sehr gut versorgt" : result.autarky >= 65 ? "Gut versorgt" : "Auslegung verbessern";
  status.className = `status-pill${result.autarky < 65 ? " neutral" : ""}`;

  const maxValue = Math.max(...result.monthlyData.map((item) => Math.max(item.pvKwh, item.loadKwh)), 100);
  document.querySelector("#barChart").innerHTML = result.monthlyData.map((item) => {
    const pvHeight = Math.max(4, Math.round((item.pvKwh / maxValue) * 94));
    const loadHeight = Math.max(4, Math.round((item.loadKwh / maxValue) * 94));
    return `<div class="month-column" title="${item.month}: Erzeugung ${item.pvKwh} kWh · Bedarf ${item.loadKwh} kWh">
      <div class="chart-bars"><i class="chart-bar pv" style="height:${pvHeight}%"></i><i class="chart-bar load" style="height:${loadHeight}%"></i></div>
      <span>${item.month}</span>
    </div>`;
  }).join("");

  function renderGlaser(mode) {
    const existing = mode === "existing";
    const temperatures = existing
      ? [20, 15.8, 5.4, -3.6, -5]
      : [20, 17.2, 14.4, 11.1, -5];
    const labels = ["Innenluft", "OSB", "PE-Folie", "Dämmung", "Außenluft"];
    const xs = [55, 190, 315, 440, 580];
    const yFor = (temperature) => 32 + ((20 - temperature) / 25) * 190;
    const dewY = yFor(9.3);
    const points = temperatures.map((temperature, index) => `${xs[index]},${yFor(temperature)}`).join(" ");
    const circles = temperatures.map((temperature, index) =>
      `<circle cx="${xs[index]}" cy="${yFor(temperature)}" r="5" fill="${index === 2 ? (existing ? "#cf4c3e" : "#155647") : "#cf4c3e"}" stroke="#fff" stroke-width="2"/>
       <text x="${xs[index]}" y="${yFor(temperature) - 13}" text-anchor="middle" class="glaser-temp">${temperature > 0 ? "+" : ""}${temperature.toFixed(1).replace(".", ",")} °C</text>`
    ).join("");
    const layerLabels = labels.map((label, index) => {
      const x = xs[index];
      return `<text x="${x}" y="246" text-anchor="middle" class="glaser-label">${label}</text>`;
    }).join("");

    document.querySelector("#glaserChart").innerHTML = `
      <svg viewBox="0 0 620 270" aria-label="${existing ? "Ist-Zustand" : "Sanierter Zustand"} des Dachquerschnitts">
        <defs>
          <linearGradient id="glaserFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#cf4c3e" stop-opacity=".16"/>
            <stop offset="1" stop-color="#cf4c3e" stop-opacity=".02"/>
          </linearGradient>
        </defs>
        <rect x="55" y="32" width="525" height="190" rx="8" fill="#faf8f2"/>
        <line x1="55" y1="222" x2="580" y2="222" class="svg-grid"/>
        <line x1="55" y1="${yFor(9.3)}" x2="580" y2="${dewY}" stroke="#5f7d74" stroke-width="2" stroke-dasharray="8 7"/>
        <text x="568" y="${dewY - 8}" text-anchor="end" class="dew-label">Taupunkt 9,3 °C</text>
        <polygon points="${xs[0]},222 ${points} ${xs[4]},222" fill="url(#glaserFill)"/>
        <polyline points="${points}" fill="none" stroke="#cf4c3e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        ${circles}
        ${layerLabels}
      </svg>`;

    const result = document.querySelector("#glaserResult");
    result.className = `glaser-result${existing ? "" : " good"}`;
    result.innerHTML = existing
      ? "<strong>Risiko:</strong><span>An der kalten Seite der PE-Folie liegt die Temperatur bei −3,6 °C – deutlich unter dem Taupunkt von 9,3 °C.</span>"
      : "<strong>Sicher:</strong><span>Mit 100 mm PIR steigt die PE-Folie auf +11,1 °C und liegt damit oberhalb des Taupunkts.</span>";
  }

  function renderHeatLoss() {
    const components = [
      { label: "Dach", existing: 5.91, retrofit: 2.18 },
      { label: "Wände", existing: 7.52, retrofit: 7.32 },
      { label: "Boden", existing: 2.02, retrofit: 2.02 },
      { label: "Fenster/Tür", existing: 3.30, retrofit: 3.30 }
    ];
    const max = Math.max(...components.flatMap((item) => [item.existing, item.retrofit]));
    document.querySelector("#heatLossChart").innerHTML = components.map((item) => `
      <div class="loss-row">
        <span class="loss-label">${item.label}</span>
        <div class="loss-bars">
          <div class="loss-track existing" title="Ist-Zustand: ${item.existing.toFixed(2).replace(".", ",")} W/K"><i style="width:${(item.existing / max) * 100}%"></i></div>
          <div class="loss-track retrofit" title="Sanierung: ${item.retrofit.toFixed(2).replace(".", ",")} W/K"><i style="width:${(item.retrofit / max) * 100}%"></i></div>
        </div>
      </div>`).join("");
  }

  function renderBattery(capacityKwh) {
    const soc = [];
    let charge = capacityKwh * 0.74;
    let shortage = 0;
    for (let hour = 0; hour < 168; hour += 1) {
      const hourOfDay = hour % 24;
      const day = Math.floor(hour / 24);
      const solar = hourOfDay >= 9 && hourOfDay <= 15 ? Math.max(0, 0.75 - 0.04 * day) : 0;
      const heatPump = hourOfDay >= 6 && hourOfDay <= 23 ? (hourOfDay % 4 === 0 ? 0.46 : 0.31) : 0.18;
      const appliances = 0.11 + (hourOfDay >= 18 && hourOfDay <= 22 ? 0.16 : 0);
      const load = heatPump + appliances;
      charge += solar * 0.82;
      charge -= load;
      if (charge < 0) {
        shortage += 1;
        charge = 0;
      }
      charge = Math.min(capacityKwh, charge);
      soc.push(Math.round((charge / capacityKwh) * 100));
    }

    const width = 620;
    const height = 220;
    const left = 42;
    const right = 12;
    const top = 12;
    const bottom = 28;
    const plotW = width - left - right;
    const plotH = height - top - bottom;
    const x = (index) => left + (index / 167) * plotW;
    const y = (value) => top + ((100 - value) / 100) * plotH;
    const points = soc.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    const area = `${left},${top + plotH} ${points} ${left + plotW},${top + plotH}`;
    const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label, index) =>
      `<text x="${left + (index + 0.5) * (plotW / 7)}" y="${height - 7}" text-anchor="middle" class="battery-label">${label}</text>`
    ).join("");

    document.querySelector("#batteryChart").innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" aria-label="Ladezustand bei ${capacityKwh} kWh Kapazität">
        <defs>
          <linearGradient id="batteryFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#efa72b" stop-opacity=".55"/>
            <stop offset="1" stop-color="#efa72b" stop-opacity=".08"/>
          </linearGradient>
        </defs>
        ${[0,25,50,75,100].map((value) => `<line x1="${left}" y1="${y(value)}" x2="${left + plotW}" y2="${y(value)}" class="svg-grid"/><text x="${left - 8}" y="${y(value) + 3}" text-anchor="end" class="battery-tick">${value}%</text>`).join("")}
        <polygon points="${area}" fill="url(#batteryFill)"/>
        <polyline points="${points}" fill="none" stroke="#c47a1a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${soc.map((value, index) => value === 0 ? `<circle cx="${x(index)}" cy="${y(0)}" r="3" fill="#b64d32"/>` : "").join("")}
        ${dayLabels}
      </svg>`;

    const minimum = Math.min(...soc);
    document.querySelector("#minimumSoc").textContent = `${minimum} %`;
    document.querySelector("#shortageHours").textContent = `${shortage} h`;
    document.querySelector("#criticalState").textContent = shortage > 18 ? "Mehrere Nachtdefizite" : shortage > 0 ? "Einzelne Engpassstunden" : "Woche überstanden";
  }

  function renderCosts() {
    const costs = [
      { label: "Timber & OSB", value: 755.30 },
      { label: "Insulation", value: 441.47 },
      { label: "Windows & door", value: 460.00 },
      { label: "Roof / sealing", value: 321.00 }
    ];
    const max = Math.max(...costs.map((item) => item.value));
    document.querySelector("#costChart").innerHTML = costs.map((item) => `
      <div class="cost-row">
        <span class="cost-label">${item.label}</span>
        <div class="cost-track"><i style="width:${(item.value / max) * 100}%"></i></div>
        <span class="cost-value">${item.value.toFixed(2).replace(".", ",")} €</span>
      </div>`).join("");
  }

  document.querySelectorAll("#glaserSwitch button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#glaserSwitch button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderGlaser(button.dataset.state);
    });
  });
  document.querySelectorAll("#batterySwitch button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#batterySwitch button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderBattery(Number(button.dataset.battery));
    });
  });

  renderGlaser("existing");
  renderHeatLoss();
  renderBattery(10);
  renderCosts();

  const prepareForPrint = () => {
    renderGlaser("existing");
    renderHeatLoss();
    renderBattery(10);
    renderCosts();
  };

  window.addEventListener("beforeprint", prepareForPrint);

  document.querySelector("#printButton")?.addEventListener("click", () => {
    prepareForPrint();
    window.requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 50);
    });
  });
});
