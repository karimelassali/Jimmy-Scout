// Échantillon LINDAS — 21 sociétés (récolte brute, sans e-mail).
// Données reprises telles quelles du registre, y compris les lignes hors
// champ (ex. INSEKTOL, Bio-Agrar-Counsel) : c'est la récolte brute, pas
// une liste vérifiée. Remplacé par la vraie récolte quand elle arrivera.
// Source : ~/workspace/lindas-construction-preview.csv

export interface PoolCompany {
  name: string;
  uid: string;
  city: string;
  canton: string;
  purpose: string;
}

export const POOL_SAMPLE: PoolCompany[] = [
  {
    "name": "INSEKTOL AG PEST CONTROL",
    "uid": "CHE108006805",
    "city": "Zürich",
    "canton": "ZH",
    "purpose": "Die Gesellschaft bezweckt. Entwesen, Desinfizieren und Reinigen von Lebensmittelbetrieben sowie öffentlichen und privaten Liegenschaften. Sie kann in diesem Zusammenhang mit Produkten im In- und Ausland Handel betreiben oder solche vermitteln und sie kann selbst Produkte herstellen und vertreiben. Sie kann Zweigniederlassungen und Tochtergesellschaften in der Schweiz und im Ausland errichten, kann Patente und Verfahren entwickeln, lizenzieren und/oder mit diesen handeln. Sie kann Immobilien erwerben, überbauen, verwalten und veräussern und alle Tätigkeiten ausüben, die geeignet sind die Erreichung des Gesellschaftszweckes direkt oder indirekt zu fördern und zu erleichtern. Sie kann auch Finanzierungen für eigene oder fremde Rechnung vornehmen sowie Garantien und Bürgschaften für Tochtergesellschaften und Dritte eingehen."
  },
  {
    "name": "Bio-Agrar-Counsel GmbH",
    "uid": "CHE108766460",
    "city": "Niederösch",
    "canton": "BE",
    "purpose": "Zweck der Gesellschaft ist die Forschung, Entwicklung, Beratung und Technologietransfer auf dem Gebiet des ökologischen Landbaus sowie Herstellung, Vermittlung und Vertrieb entsprechender Produkte. Die Gesellschaft kann im In- und Ausland Zweigniederlassungen errichten, sich an anderen Unternehmungen im In- und Ausland beteiligen, gleichartige oder verwandte Unternehmen des In- und Auslandes erwerben, sich mit solchen zusammenschliessen oder solche gründen, Grundstücke erwerben oder veräussern, Immaterialgüterrechte erwerben, halten und verwerten sowie alle Geschäfte eingehen und Verträge abschliessen, die geeignet sind, den Zweck der Gesellschaft zu fördern oder die direkt oder indirekt damit im Zusammenhang stehen. "
  },
  {
    "name": "Hauert HBG Dünger AG",
    "uid": "CHE111737855",
    "city": "Grossaffoltern",
    "canton": "BE",
    "purpose": "Fabrikation von und Handel mit Düngern und Hilsstoffen für den Pflanzenbau sowie die Beratung und Forschung auf dem Gebiete des Pflanzenbaues. Die Gesellschaft kann sich an gleichartigen oder verwandten Unternehmen des In- und Auslandes beteiligen, diese erwerben oder pachten, Darlehen aufnehmen und erteilen, Kredite aufnehmen, Grundstücke erwerben, belasten und weiterveräussern."
  },
  {
    "name": "Schneiter AGRO AG",
    "uid": "CHE238481198",
    "city": "Seon",
    "canton": "AG",
    "purpose": "Handel mit Pflanzenschutzmitteln und Hilfsstoffen für Landwirtschafts-, Forst-, Reb- und Gartenbau, Dienstleistungen in diesen Bereichen, einschliesslich Engineering und Planung; kann Zweigniederlassungen und Tochtergesellschaften errichten, sich an anderen Unternehmen beteiligen, Grundeigentum erwerben, belasten, veräussern und verwalten, Finanzierungen für eigene oder fremde Rechnung vornehmen sowie Garantien und Bürgschaften für Tochtergesellschaften und Dritte eingehen."
  },
  {
    "name": "Société suisse des employés de commerce",
    "uid": "CHE105840918",
    "city": "Zürich",
    "canton": "ZH",
    "purpose": "Der Kaufmännische Verband Schweiz ist die nationale Berufsorganisation der Arbeitnehmerinnen und Arbeitnehmer im kaufmännischen und betriebswirtschaftlichen Bereich und im Detailhandel sowie des in Ausbildung stehenden Berufsnachwuchses. Er nimmt für die Sektionen übergeordnete Aufgaben wahr und vertritt deren Interessen auf nationaler Ebene. Er vertritt die Interessen dieser Berufsgruppen in der Öffentlichkeit sowie gegenüber der öffentlichen und privaten Arbeitgeberschaft. Der Kaufmännische Verband Schweiz kann Liegenschaften erwerben (inklusive Mit- oder Stockwerkeigentum), überbauen, verkaufen, mieten oder Bauten im Baurecht erstellen."
  },
  {
    "name": "AAP Atelier für Architektur und Planung AG",
    "uid": "CHE102475946",
    "city": "Bolligen",
    "canton": "BE",
    "purpose": "Die Gesellschaft bezweckt die Führung eines Architektur- und Planungsbüros sowie die Erbringung von Dienstleistungen aller Art auf dem Gebiete der Architektur, Planung und des Bauwesens. Die Gesellschaft kann Zweigniederlassungen errichten, sich an andern Unternehmungen beteiligen und ihre Tätigkeit auf andere Gebiete ausdehnen, die mit dem Geschäftszweck der Gesellschaft im Zusammenhang stehen, inbegriffen Erwerb, Verwaltung und Veräusserung von Liegenschaften."
  },
  {
    "name": "Aarebau AG",
    "uid": "CHE106000507",
    "city": "Küttigen",
    "canton": "AG",
    "purpose": "Ausführung von Bauabdichtungen, Beschichtungen, Betonsanierungen, Flachdachsanierungen, Fugenabdichtungen, Industrieböden, Injektionen, Klebarmierungen, sowie Erstellung von Bauten, Bautreuhand und -beratungen jeglicher Art; die Gesellschaft kann sich an Unternehmen gleicher oder ähnlicher Art beteiligen, Lizenzen, Patente und andere immaterielle Werte sowie Grundeigentum erwerben, verwalten, vermitteln und veräussern sowie Zweigniederlassungen und Tochtergesellschaften im In- und Ausland errichten."
  },
  {
    "name": "Aare Electric AG",
    "uid": "CHE106131670",
    "city": "Bern",
    "canton": "BE",
    "purpose": "Projektierung und Bau elektrischer Stark- und Schwachstromanlagen; Fabrikation von und Handel mit elektrotechnischen Bedarfsartikel, Projektierung und Bau von Sicherheitsanlagen; Projektierung von und Handel mit Computer- und Kommunikationsgeräten inkl. Hard- und Software. Die Gesellschaft kann sich an Unternehmungen beteiligen, Zweigniederlassungen errichten, Grundeigentum erwerben oder veräussern sowie alle Geschäfte tätigen, die mit dem Betrieb ihrer Werke oder dem Handel einschlägiger Produkte zusammenhängen und den Zweck der Gesellschaft zu fördern geeignet sind."
  },
  {
    "name": "Aarekies Brienz AG",
    "uid": "CHE107900750",
    "city": "Brienz BE",
    "canton": "BE",
    "purpose": "Die Gesellschaft bezweckt den Abbau, die Aufbereitung, das Recycling und den Handel mit Stein, Kies, Sand, Beton und weiteren Baustoffen, die Fabrikation und den Handel mit Betonelementen sowie die Ausführung von Transporten. Die Gesellschaft kann im In- und Ausland Zweigniederlassungen errichten, sich an anderen Unternehmen im In- und Ausland beteiligen, gleichartige oder verwandte Unternehmen erwerben oder sich mit solchen zusammenschliessen, Grundstücke erwerben, verwalten und veräussern sowie alle Geschäfte eingehen und Verträge abschliessen, die geeignet sind, den Zweck der Gesellschaft zu fördern, oder die direkt oder indirekt damit im Zusammenhang stehen."
  },
  {
    "name": "Ligrufa Ausserschwyz AG",
    "uid": "CHE103191842",
    "city": "Zürich",
    "canton": "ZH",
    "purpose": "Die Gesellschaft bezweckt den Handel mit Immobilien; kann Liegenschaften erwerben, veräussern, verwalten, überbauen und sich als Generalunternehmerin betätigen; bezweckt Investitionen in erneuerbare Energien, insbesondere in Photovoltaik, deren Bau und Betrieb, um Strom für den Eigenverbrauch, die Drittnutzung und Netzeinspeisung zu erzeugen. Die Gesellschaft kann Zweigniederlassungen und Tochtergesellschaften im In- und Ausland errichten und sich an anderen Unternehmen im In- und Ausland beteiligen sowie alle Geschäfte tätigen, die direkt oder indirekt mit ihrem Zweck in Zusammenhang stehen. Die Gesellschaft kann im In- und Ausland Grundeigentum erwerben, belasten, veräussern und verwalten. Sie kann auch Finanzierungen für eigene oder fremde Rechnung vornehmen sowie Sicherheiten für Verbindlichkeiten verbundener Gesellschaften abgeben."
  },
  {
    "name": "AB Automazioni SA",
    "uid": "CHE103515034",
    "city": "Viganello",
    "canton": "TI",
    "purpose": "La società si propone la progettazione, la produzione, l'importazione, l'esportazione, il commercio, il montaggio e la revisione di qualsiasi tipologia di prodotto o d'impianto d'automazione a movimentazione oleodinamica ed elettromeccanica, nonché di comandi elettrici ed elettronici filari o via radio, di sistemi di sicurezza anti-intrusione, di videosorveglianza e controllo accessi, così come la consulenza tecnica in proposito. Tutte le opere edili, di metalcostruzione e di impiantistica elettrica in corrente debole e forte connesse allo scopo sociale. Essa potrà partecipare sotto qualunque forma a imprese similari."
  },
  {
    "name": "Möbel Abächerli AG",
    "uid": "CHE107066710",
    "city": "Giswil",
    "canton": "OW",
    "purpose": "Fabrikation von Möbeln, Innenausbau sowie sonstige Schreinerarbeiten; An- und Verkauf von Möbeln, Einrichtungen samt Zubehör. Die Gesellschaft kann sich an anderen Gesellschaften beteiligen oder sich mit diesen zusammenschliessen."
  },
  {
    "name": "Abag Anlage und Bau AG",
    "uid": "CHE102397370",
    "city": "Olten",
    "canton": "SO",
    "purpose": "An- und Verkauf sowie Ueberbauung von Grundstücken, Vermietung von Liegenschaften und Verwaltung und Unterhalt von Gebäuden sowie Finanzierungen und Beteiligungen."
  },
  {
    "name": "Abag Immobilien- und Generalunternehmung AG",
    "uid": "CHE103114793",
    "city": "Zürich",
    "canton": "ZH",
    "purpose": "Die Tätigkeit der Gesellschaft entspricht die des Betriebs einer Generalunternehmung im Baubereich. Die Gesellschaft kann Zweigniederlassungen und Tochtergesellschaften im In- und Ausland errichten und sich an anderen Unternehmen im In- und Ausland beteiligen sowie alle Geschäfte tätigen, die direkt oder indirekt mit ihrem Zweck in Zusammenhang stehen. Die Gesellschaft kann im In- und Ausland Grundeigentum erwerben, belasten, veräussern und verwalten. Sie kann auch Finanzierungen für eigene oder fremde Rechnung vornehmen sowie Garantien und Bürgschaften für Tochtergesellschaften und Dritte eingehen."
  },
  {
    "name": "Abaiga AG",
    "uid": "CHE102796497",
    "city": "Chur",
    "canton": "GR",
    "purpose": "Der Zweck der Gesellschaft ist der Erwerb, Verwaltung und Veräusserung von beweglichen und unbeweglichen Vermögenswerten aller Art sowie die Beteiligung an anderen Gesellschaften im In- und Ausland. Die Gesellschaft kann Grundstücke oder Liegenschaften kaufen, überbauen und veräussern und Dienstleistungen im Bau-, Verwaltungs- und Finanzbereich erbringen sowie alle Massnahmen treffen, welche die Erreichung des Gesellschaftszweckes fördern oder welche direkt oder indirekt damit im Zusammenhang stehen."
  },
  {
    "name": "Geostahl SA",
    "uid": "CHE100628222",
    "city": "Frick",
    "canton": "AG",
    "purpose": "Entwicklung von Produkten und Systemen zur Eindämmung von Naturgefahren (wie z.B. Steinschlag, Erdrutsche, Lawinen, Hochwasser), Entwicklung von Produkten und Systemen zur Sicherung des Untergrundes, von Bauwerken, Minen, Infrastrukturbauten, Entwicklung von Produkten und Systemen im Bereich Anker- und Vorspanntechnik sowie Entwicklung von Seilprodukten für architektonische und technische Anwendungen (wie z.B. Spezialseile, architektonische Tragelemente, Fittinge, Verbindungs- und Anschlusselemente, etc.) sowie die allgemeine technische Beratung; kann Zweigniederlassungen und Tochtergesellschaften errichten, sich an anderen Unternehmen beteiligen oder sich mit diesen zusammenschliessen, Unternehmen, an denen sie beteiligt ist, direkt oder indirekt finanzieren oder Sicherheiten zugunsten von einer Gesellschaft der Gruppe oder von nahe stehenden Gesellschaften bestellen sowie Grundstücke erwerben, halten, belasten und veräussern."
  },
  {
    "name": "Castiglioni Partner Architekten AG",
    "uid": "CHE100062349",
    "city": "Zug",
    "canton": "ZG",
    "purpose": "Betrieb eines oder mehrerer Architekturbüros, Handel mit Grundstücken jeder Art, Erwerb, Verkauf, Ueberbauung und Verwaltung eigener wie auch Liegenschaften Dritter, sowie Führung und Ueberwachung von Liegenschaftsbuchhaltungen; kann Finanz- und Handelsgeschäfte jeder Art und mit Bezug auf bewegliche und unbewegliche Sachen tätigen."
  },
  {
    "name": "ABBF Bausoft SA",
    "uid": "CHE102074613",
    "city": "Givisiez",
    "canton": "FR",
    "purpose": "Entwicklung und Vertrieb von Produkten und Leistungen sowie die Beratung im Gebiete der Informatik zur Anwendung im technischen Bereich, namentlich im Bauwesen."
  },
  {
    "name": "Abbühl Architektur + Planung AG",
    "uid": "CHE103864523",
    "city": "Burgdorf",
    "canton": "BE",
    "purpose": "Die Gesellschaft bezweckt die Ausführung von Architektur-, Ingenieur- und Planungsaufträgen aller Art auf dem Gebiet des Hoch- und Tiefbaues. Die Gesellschaft kann alle Geschäfte eingehen und Verträge abschliessen, die geeignet sind, den Zweck der Gesellschaft zu fördern, oder die direkt oder indirekt damit im Zusammenhang stehen, ferner Zweigniederlassungen im In- und Ausland errichten und sich an anderen Unternehmungen des In- und Auslandes beteiligen, gleichartige oder verwandte Unternehmen erwerben oder sich mit diesen zusammenschliessen. Sie kann Liegenschaften erwerben und veräussern."
  },
  {
    "name": "GK Glasklebetechnik AG",
    "uid": "CHE101422580",
    "city": "Rickenbach SO",
    "canton": "SO",
    "purpose": "Entwicklung und Planung von Techniken im Bereich Glasbau und Glasklebetechnik, Erbringen von Dienstleistungen und Herstellung von Produkten im Bereich Glasbau. Kann Zweigniederlassungen in der Schweiz und im Ausland errichten, sich an andern Unternehmen in der Schweiz und im Ausland beteiligen, gleichartige oder verwandte Unternehmen erwerben, pachten oder sich mit solchen zusammenschliessen, Grundstücke erwerben oder weiterveräussern sowie alle Geschäfte eingehen und Verträge abschliessen, die geeignet sind, den Zweck der Gesellschaft zu fördern."
  },
  {
    "name": "Huab Immo AG",
    "uid": "CHE102696074",
    "city": "Wattwil",
    "canton": "SG",
    "purpose": "Die Gesellschaft bezweckt Erwerb, Belastung, Veräusserung und Verwaltung von Grundeigentum. Sie bezweckt weiter die Erbringung von Dienstleistungen im Bereich treuhänderische Bauherrschaft, Bau- und Projektmanagement für die Erstellung von Bauten und Bauprojekten sowie Vertrieb und Verwaltung derselben. Die Gesellschaft kann Zweigniederlassungen und Tochtergesellschaften im In- und Ausland errichten und sich an anderen Unternehmen im In- und Ausland beteiligen sowie alle Geschäfte tätigen, die direkt oder indirekt mit ihrem Zweck in Zusammenhang stehen. Die Gesellschaft kann im In- und Ausland Grundeigentum erwerben, belasten, veräussern und verwalten. Sie kann auch Finanzierungen für eigene oder fremde Rechnung vornehmen sowie Sicherheiten für Verbindlichkeiten verbundener Gesellschaften abgeben."
  }
];
