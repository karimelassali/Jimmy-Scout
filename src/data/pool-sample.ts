// Échantillon LINDAS — 21 sociétés de construction uniquement, vérifiées.
// Récolte brute (sans e-mail), filtrée construction : chaque ligne a été
// contrôlée contre le filtre de src/data/construction-filter.ts
// (activité de construction réelle, pas de jardinage/agriculture, pas de
// syndicats, pas de sociétés en liquidation). Remplacé par la vraie récolte
// quand elle arrivera. Source : LINDAS (ld.admin.ch), registre Zefix, 12 nov. 2026.

export interface PoolCompany {
  name: string;
  uid: string;
  city: string;
  canton: string;
  purpose: string;
}

export const POOL_SAMPLE: PoolCompany[] = [
  {
    "name": "Gebr. Huber AG",
    "uid": "CHE105988320",
    "city": "Aarau",
    "canton": "AG",
    "purpose": "Die Gesellschaft bezweckt die Übernahme und Ausführung von Bauarbeiten aller Art: Rückbau, Erdarbeiten, Spezialtiefbau, Strassen- und Werkleitungsbau, Umbau und Betonbau. Sie bezweckt weiter die Ausführung von Transporten, den Betrieb von Kiesgruben und Steinbrüchen, die Aufbereitung und den Handel von Baustoffen, die Betonproduktion sowie die Ausführung von General- und Totalunternehmeraufträgen. Sie kann sich bei anderen Unternehmen beteiligen, Zweigniederlassungen errichten, gleichartige Unternehmen erwerben oder errichten, sowie alle Geschäfte eingehen und Verträge abschliessen, die geeignet sind, den Zweck der Gesellschaft zu fördern oder die direkt oder indirekt damit im Zusammenhang stehen. Die Gesellschaft kann Grundstücke erwerben, verwalten und veräussern. Zur Errichtung von Zweigniederlassungen ist der Verwaltungsrat ermächtigt."
  },
  {
    "name": "Peter Berger AG",
    "uid": "CHE106967177",
    "city": "Aarberg",
    "canton": "BE",
    "purpose": "Die Gesellschaft bezweckt den Betrieb einer Spenglerei sowie die Installation von Sanitäranlagen. Die Gesellschaft kann Zweigniederlassungen errichten, sich an anderen Unternehmungen des In- und Auslandes beteiligen, gleichartige oder verwandte Unternehmen erwerben oder sich mit solchen zusammenschliessen, Grundstücke erwerben oder weiterveräussern, sowie alle Geschäfte eingehen und Verträge abschliessen, die geeignet sind, den Zweck der Gesellschaft zu fördern, oder direkt oder indirekt damit im Zusammenhang stehen."
  },
  {
    "name": "Müller Aarberg AG",
    "uid": "CHE101467306",
    "city": "Aarberg",
    "canton": "BE",
    "purpose": "Die Gesellschaft bezweckt den Betrieb einer Bauunternehmung. Die Gesellschaft kann Zweigniederlassungen errichten, sich an andern Unternehmungen des In- und Auslandes beteiligen, gleichartige oder verwandte Unternehmen erwerben oder sich mit solchen zusammenschliessen, Grundstücke erwerben oder weiterveräussern sowie alle Geschäfte eingehen und Verträge abschliessen, die geeignet sind, den Zweck der Gesellschaf zu fördern oder die direkt oder indirekt damit im Zusammenhang stehen."
  },
  {
    "name": "Mattbois Sàrl",
    "uid": "CHE465167328",
    "city": "Châtillon FR",
    "canton": "FR",
    "purpose": "Exploitation d'une entreprise de charpente, de couverture, de rénovation, de transformation et d'escaliers (cf. statuts pour but complet)."
  },
  {
    "name": "Charly Berchier S.A.",
    "uid": "CHE107774296",
    "city": "Cugy FR",
    "canton": "FR",
    "purpose": "l'exploitation d'une entreprise générale de construction et de travaux publics. La société peut faire toutes opérations mobilières, immobilières, financières ou commerciales en rapport avec son but."
  },
  {
    "name": "Baratelli SA",
    "uid": "CHE101471070",
    "city": "Aire-la-Ville",
    "canton": "GE",
    "purpose": "exploitation d'une entreprise de constructions métalliques, de serrurerie générale et de tôlerie."
  },
  {
    "name": "ALPHA Edification SA",
    "uid": "CHE203795383",
    "city": "Aire-la-Ville",
    "canton": "GE",
    "purpose": "Réalisation de toutes constructions dans les domaines du bâtiment et du génie civil (cf. statuts pour but complet)."
  },
  {
    "name": "Jon Caviezel AG, Elektroanlagen",
    "uid": "CHE107038748",
    "city": "Lenzerheide/Lai",
    "canton": "GR",
    "purpose": "Betrieb eines Elektroinstallationsgeschäftes sowie Handel, Reparatur und Vermietung von Elektroartikeln aller Art, Kauf, Verkauf, Überbauung und Verwaltung von Grundstücken; die Gesellschaft kann sich an anderen, ähnlichen Unternehmungen beteiligen."
  },
  {
    "name": "Bauunternehmung Paterlini AG Lenzerheide",
    "uid": "CHE113823201",
    "city": "Lenzerheide/Lai",
    "canton": "GR",
    "purpose": "Die Führung einer Bauunternehmung, Produktion von und Handel mit Baumaterialien aller Art, Ausführen von Lastwagen- und Schwertransporten. Die Gesellschaft kann alle Geschäfte eingehen und Verträge abschliessen, die geeignet sind, den Zweck der Gesellschaft zu fördern. Darin eingeschlossen sind der Erwerb, die Verwaltung und die Veräusserung von Grundeigentum. Ferner kann sie Zweigniederlassungen im In- und Ausland errichten, sich an anderen Unternehmungen beteiligen oder sich mit diesen zusammenschliessen."
  },
  {
    "name": "Angehrn & Reinöhl AG",
    "uid": "CHE302370573",
    "city": "Lömmenschwil",
    "canton": "SG",
    "purpose": "Ausübung von Arbeiten im Hoch- und Tiefbau sowie Betreiben von Immobiliengeschäften aller Art, wie Erwerb, Verwaltung, Vermietung und Veräusserung von Grundeigentum. Die Gesellschaft kann Zweigniederlassungen und Tochtergesellschaften im In- und Ausland errichten, sich an anderen Unternehmen im In- und Ausland beteiligen, im In- und Ausland Grundeigentum erwerben, belasten, veräussern und verwalten, Finanzierungen für eigene oder fremde Rechnung vornehmen sowie Garantien und Bürgschaften für Tochtergesellschaften und Dritte eingehen."
  },
  {
    "name": "Desnivel Group AG",
    "uid": "CHE202401434",
    "city": "Häggenschwil",
    "canton": "SG",
    "purpose": "Die Gesellschaft bezweckt den Betrieb von Baugeschäften. Die Gesellschaft kann Zweigniederlassungen und Tochtergesellschaften im In- und Ausland errichten und sich an anderen Unternehmen im In- und Ausland beteiligen. Die Gesellschaft kann Grundstücke und Liegenschaften erwerben, verwalten und veräussern. Die Gesellschaft kann alle kommerziellen, finanziellen und anderen Tätigkeiten ausüben, welche mit dem Zweck der Gesellschaft im Zusammenhang stehen."
  },
  {
    "name": "Erne Bau AG",
    "uid": "CHE105774167",
    "city": "Egerkingen",
    "canton": "SO",
    "purpose": "Ausführung von Hoch-, Tiefbau- und Baumeisterarbeiten sowie Gerüstbau. Die Gesellschaft kann sich an andern Unternehmungen beteiligen und solche erwerben, Grundstücke erwerben, belasten, verwalten und veräussern"
  },
  {
    "name": "Vogel AG Bauunternehmung",
    "uid": "CHE105696900",
    "city": "Egerkingen",
    "canton": "SO",
    "purpose": "Arbeiten im Hoch- und Tiefbau, Bearbeitung von und Handel mit Stein-, Holz- und Baustoffen jeder Art, Beratungen und Expertisen in der Baubranche sowie Handel mit Waren aller Art. Kann sich an anderen Unternehmen beteiligen, Lizenzen, Patente und andere immaterielle Werte sowie Grundeigentum erwerben, verwalten, vermitteln und veräussern, ferner Zweigniederlassungen und Tochtergesellschaften im In- und Ausland errichten und überhaupt alle Geschäfte tätigen, die mit dem Zweck der Gesellschaft zusammenhängen oder diesen zu fördern geeignet sind."
  },
  {
    "name": "Bischoff isol-tech SA",
    "uid": "CHE100449205",
    "city": "Castione",
    "canton": "TI",
    "purpose": "L'esecuzione e il commercio, l'importazione e l'esportazione di opere e materiale di isolazione e rivestimenti termici e acustici e industriali per impianti di riscaldamento, sanitari, refrigerazione, climatizzazione, ventilazione e di opere edili; la progettazione, costruzione, acquisto o vendita, montaggio di canne fumarie, camini e scarichi industriali, l'esercizio di un'impresa di costruzioni di sopra e sottostruttura. La società può partecipare ad altre imprese. La società può acquisire, possedere e vendere beni immobili. La società può esercitare tutte le attività che siano in relazione con lo scopo sociale."
  },
  {
    "name": "SCND SA",
    "uid": "CHE103011874",
    "city": "Arbedo",
    "canton": "TI",
    "purpose": "L'esecuzione di un'impresa di costruzioni edili, del genio civile, di sopra e sottostruttura, di un'impresa generale (general contractor); il risanamento di edifici, di manufatti, di opere in calcestruzzo ed in gesso; l'esecuzione di lavori di pavimentazione; la gestione di un ufficio tecnico e di progettazione; l'allestimento di perizie tecniche; l'esecuzione di arginature, di trasporti, di scavi meccanici, di movimenti di terra; l'assunzione di rappresentanze nonché la vendita di materiali per l'edilizia; la gestione e l'acquisto di terreni e/o immobili; la società può partecipare ad altre imprese in Svizzera o all'estero aventi scopo analogo. La gestione di un'officina meccanica, compresa la riparazione e la manutenzione di autoveicoli e macchinari, l'esecuzione del cambio gomme, la compravendita di autoveicoli e macchinari. La gestione dell'officina meccanica estesa anche ai veicoli industriali. La società può svolgere ogni attività o concludere ogni negozio giuridico volto al conseguimento dello scopo sociale."
  },
  {
    "name": "Atra S.A.",
    "uid": "CHE105737597",
    "city": "Aigle",
    "canton": "VD",
    "purpose": "exploitation d'une entreprise de travaux publics et génie civil; exploitation de tous matériaux et minerais, transport de marchandises en tous genres, ainsi que acquisition, aménagement, construction; exploitation, location, vente et gérance d'immeubles, de droits immobiliers."
  },
  {
    "name": "Michel Démolition SA",
    "uid": "CHE107904860",
    "city": "Aigle",
    "canton": "VD",
    "purpose": "La société a pour but l'exploitation d'une entreprise de démolition, d'assainissement, de terrassement et de génie civil, de construction de routes et d'immeubles, le traitement, le transport et le commerce de matériaux (pour but complet cf. statuts)."
  },
  {
    "name": "Mathias Bellwald Aktiengesellschaft",
    "uid": "CHE103644364",
    "city": "Glis",
    "canton": "VS",
    "purpose": "Vornahme von Renovationen und Umbauten aller Art im Hoch- und Tiefbau sowie Handel mit Baumaterial; Beteiligung an Unternehmen mit ähnlicher Zielsetzung."
  },
  {
    "name": "Clausen Beton-Trenn AG",
    "uid": "CHE106019754",
    "city": "Gamsen",
    "canton": "VS",
    "purpose": "Betrieb einer Untenrehmung zum Trennen, Bohren und Abbruch von Beton. Kann weitere Arbeiten der Baubranche ausführen und Warenhandel betreiben."
  },
  {
    "name": "Baucal AG",
    "uid": "CHE101961641",
    "city": "Affoltern am Albis",
    "canton": "ZH",
    "purpose": "Die Gesellschaft bezweckt das Planen und Erstellen von Hoch- und Tiefbauten mit Einzelleistungsträgern, als Generalunternehmer oder als Totalunternehmer. Die Gesellschaft kann Zweigniederlassungen und Tochtergesellschaften im In- und Ausland errichten und sich an anderen Unternehmen im In- und Ausland beteiligen sowie alle Geschäfte tätigen, die direkt oder indirekt mit ihrem Zweck in Zusammenhang stehen. Die Gesellschaft kann im In- und Ausland Grundeigentum erwerben, belasten, veräussern und verwalten. Sie kann auch Finanzierungen für eigene oder fremde Rechnung vornehmen sowie Garantien und Bürgschaften für Tochtergesellschaften und Dritte eingehen."
  },
  {
    "name": "Otth Bauabdichtungen und Bodenbeläge",
    "uid": "CHE106206753",
    "city": "Affoltern am Albis",
    "canton": "ZH",
    "purpose": "Ausführung von Bauabdichtungsarbeiten sowie Verkauf und Verlegen von Bodenbelägen."
  },
];
