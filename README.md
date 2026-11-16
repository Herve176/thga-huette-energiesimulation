# Autarke Energieversorgung einer THGA-Hütte

Bachelorprojekt im Studiengang Maschinenbau mit Vertiefung Energietechnik an der Technischen Hochschule Georg Agricola (THGA) in Bochum.

## Projektziel

Auf dem THGA-Campus steht eine kleine, gedämmte Hütte. In diesem Projekt untersuche ich, wie sie ganzjährig ohne Netzanschluss mit Wärme und Strom versorgt werden kann. Dazu simuliere ich das Zusammenspiel von Wärmepumpe, Photovoltaik und Batteriespeicher und untersuche, welche Anlagengrößen den Bedarf auch in kalten und sonnenarmen Winterperioden decken können.

## Simulationsmodell

- Den Heizwärmebedarf aus dem Bauteilaufbau der Hütte und den stündlichen Wetterdaten eines Testreferenzjahres des Deutschen Wetterdienstes (DWD) berechnen.
- Den Strombedarf der Wärmepumpe, die PV-Erzeugung und den Ladezustand der Batterie im Inselbetrieb stündlich über ein Jahr simulieren.
- Verschiedene Kombinationen aus Wärmepumpenleistung, PV-Leistung und nutzbarer Batteriekapazität vergleichen.
- Den Autarkiegrad sowie Dauer und Umfang möglicher Versorgungslücken auswerten.
- Die Ergebnisse anhand von Literaturwerten und, soweit verfügbar, Messwerten an der Hütte überprüfen.

## Browser-Anwendung

Die Simulation wird als interaktive Webanwendung mit HTML, CSS und JavaScript umgesetzt. Die THGA-Hütte dient als voreingestelltes Beispiel. Nutzerinnen und Nutzer können Gebäudedaten und Anlagengrößen ändern und damit auch eigene Hütten simulieren. Diagramme sollen zeigen, wie sich Heizwärmebedarf, PV-Erzeugung und Batterieladezustand im Jahresverlauf verändern.

## Projektstatus

Das Projekt befindet sich in der Entwicklung. Die Webanwendung soll über GitHub Pages aufrufbar sein.