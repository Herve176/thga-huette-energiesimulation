const HUTTEN_DEFAULTS = Object.freeze({
  length: 2.7,
  width: 2.025,
  height: 2.4,
  uValue: 0.34,
  occupancy: "weekend",
  pvSize: 6,
  battery: 10
});

const INSULATION_PROFILES = Object.freeze({
  "0.42": { status: "warning", label: "Nicht gedämmt", note: "Höhere Wärmeverluste; Dämmung und Luftdichtheit verbessern." },
  "0.34": { status: "warning", label: "Vorhandener Bestand", note: "Ist-Zustand: Hülse gedämmt, aber Feuchteschutz und Luftdichtheit prüfen." },
  "0.16": { status: "good", label: "Sanierter Zustand", note: "Verbesserter Bestand: 100 mm PIR-Dach und gedämmte Gebäudehülle." }
});

function getSimulationState() {
  const defaults = { ...HUTTEN_DEFAULTS };
  try {
    const saved = JSON.parse(sessionStorage.getItem("huettenenergie-state") || "{}");
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

function saveSimulationState(state) {
  sessionStorage.setItem("huettenenergie-state", JSON.stringify(state));
}

function calculateEnergyBalance(input) {
  const state = { ...HUTTEN_DEFAULTS, ...input };
  const length = Math.min(20, Math.max(2, Number(state.length) || HUTTEN_DEFAULTS.length));
  const width = Math.min(20, Math.max(2, Number(state.width) || HUTTEN_DEFAULTS.width));
  const height = Math.min(8, Math.max(2, Number(state.height) || HUTTEN_DEFAULTS.height));
  const uValue = Number(state.uValue) || HUTTEN_DEFAULTS.uValue;
  const pvSize = Number(state.pvSize) || 0;
  const batteryCapacity = Number(state.battery) || 0;

  const innerFloorArea = length * width;
  const roofArea = length * width * 1.08;
  const wallArea = 2 * height * (length + width);
  const envelopeArea = wallArea + roofArea + innerFloorArea;
  const maxRoofPv = roofArea / 2.2;

  const meanTemperatures = [2.3, 3.2, 6.2, 9.8, 14.1, 17.2, 19.2, 18.7, 14.9, 10.6, 6.0, 3.1];
  const dailySolarWh = [0.62, 1.08, 1.75, 2.70, 3.45, 3.90, 3.75, 3.18, 2.25, 1.38, 0.78, 0.55];
  const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const monthlyData = [];

  let annualDemand = 0;
  let annualPvYield = 0;
  let batteryEnergy = batteryCapacity * 0.5;
  let shortageHours = 0;
  let longestShortage = 0;
  let currentShortage = 0;

  for (let month = 0; month < 12; month += 1) {
    let pvKwh = 0;
    let loadKwh = 0;

    for (let day = 0; day < daysPerMonth[month]; day += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        const daylight = Math.max(0, Math.cos(((hour - 13) / 24) * 2 * Math.PI));
        const cloudFactor = 0.88 - 0.10 * Math.sin((day * 1.7 + month * 0.8));
        const temperature = meanTemperatures[month] - 3.8 * Math.cos(((hour - 5) / 24) * 2 * Math.PI);
        const deltaT = Math.max(0, 20 - temperature);

        const wallLoss = wallArea * uValue * deltaT;
        const roofLoss = roofArea * (uValue <= 0.16 ? 0.14 : uValue <= 0.34 ? 0.38 : 0.38) * deltaT;
        const floorLoss = innerFloorArea * 0.37 * deltaT;
        const ventilationLoss = innerFloorArea * 0.35 * deltaT * 0.28;
        const heatDemandKw = (wallLoss + roofLoss + floorLoss + ventilationLoss) / 1000;

        const occupancyFactor = state.occupancy === "regular" ? 1.22 : state.occupancy === "vacant" ? 0.64 : 0.82;
        const applianceKw = (0.14 + (hour >= 18 && hour <= 22 ? 0.22 : 0)) * occupancyFactor;
        const cop = temperature < 2 ? 2.1 : temperature > 12 ? 3.4 : 2.1 + ((temperature - 2) / 10) * 1.3;
        const heatPumpKw = heatDemandKw / cop;
        const load = applianceKw + heatPumpKw;

        const solarFactor = daylight * cloudFactor;
        const pvKw = pvSize * (dailySolarWh[month] / 4.1) * solarFactor;
        const surplus = Math.max(0, pvKw - load);
        const deficit = Math.max(0, load - pvKw);
        let unmet = deficit;

        if (surplus > 0) {
          batteryEnergy = Math.min(batteryCapacity, batteryEnergy + surplus * 0.92);
        }
        if (deficit > 0 && batteryEnergy > 0) {
          const supplied = Math.min(deficit, batteryEnergy * 0.95);
          batteryEnergy -= supplied / 0.95;
          unmet = deficit - supplied;
        }

        loadKwh += load;
        pvKwh += pvKw;
        annualDemand += load;
        annualPvYield += pvKw;

        if (unmet > 0.05) {
          shortageHours += 1;
          currentShortage += 1;
          longestShortage = Math.max(longestShortage, currentShortage);
        } else {
          currentShortage = 0;
        }
      }
    }

    monthlyData.push({
      month: monthNames[month],
      pvKwh: Math.round(pvKwh),
      loadKwh: Math.round(loadKwh)
    });
  }

  const annualDemandRounded = Math.max(1, Math.round(annualDemand));
  const coveredHours = 8760 - shortageHours;
  const autarky = Math.max(0, Math.min(100, Math.round((coveredHours / 8760) * 100)));

  return {
    innerFloorArea,
    footprintArea: length * width,
    roofArea,
    wallArea,
    envelopeArea,
    maxRoofPv,
    annualDemand: annualDemandRounded,
    annualPvYield: Math.round(annualPvYield),
    autarky,
    shortageHours,
    longestShortage,
    batteryEnd: batteryEnergy,
    monthlyData,
    insulationInfo: INSULATION_PROFILES[String(uValue)] || INSULATION_PROFILES["0.34"]
  };
}
