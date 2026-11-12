import test from 'node:test';
import assert from 'node:assert/strict';

import { POOL_SAMPLE } from '../src/data/pool-sample.ts';
import { isConstructionCompany } from '../src/data/construction-filter.ts';

// Construction-only filter (12 Nov 2026): the first LINDAS harvest filtered
// on the substring "bau" and let pest control, fertiliser, agro and a trade
// union into the Pool sample. Every row of the sample must pass this check,
// and the old junk rows must fail it.

test('every Pool sample row is a construction company', () => {
  assert.equal(POOL_SAMPLE.length, 21);
  const failures = POOL_SAMPLE.filter((row) => !isConstructionCompany(row.name, row.purpose));
  assert.deepEqual(
    failures.map((row) => row.name),
    [],
    'these Pool rows are not construction companies'
  );
  for (const row of POOL_SAMPLE) {
    assert.match(row.uid, /^CHE\d{9}$/, `${row.name} has a Swiss UID`);
    assert.ok(row.city.length > 0, `${row.name} has a city`);
    assert.match(row.canton, /^[A-Z]{2}$/, `${row.name} has a canton code`);
  }
});

test('the old junk rows from the "bau" substring filter are rejected', () => {
  const junk: Array<[string, string]> = [
    [
      'INSEKTOL AG PEST CONTROL',
      'Die Gesellschaft bezweckt Entwesen, Desinfizieren und Reinigen von Lebensmittelbetrieben sowie öffentlichen und privaten Liegenschaften. Sie kann Immobilien erwerben, überbauen, verwalten und veräussern.',
    ],
    [
      'Bio-Agrar-Counsel GmbH',
      'Zweck der Gesellschaft ist die Forschung, Entwicklung, Beratung und Technologietransfer auf dem Gebiet des ökologischen Landbaus sowie Herstellung, Vermittlung und Vertrieb entsprechender Produkte.',
    ],
    [
      'Hauert HBG Dünger AG',
      'Fabrikation von und Handel mit Düngern und Hilfsstoffen für den Pflanzenbau sowie die Beratung und Forschung auf dem Gebiete des Pflanzenbaues.',
    ],
    [
      'Schneiter AGRO AG',
      'Handel mit Pflanzenschutzmitteln und Hilfsstoffen für Landwirtschafts-, Forst-, Reb- und Gartenbau, Dienstleistungen in diesen Bereichen.',
    ],
    [
      'Société suisse des employés de commerce',
      'Der Kaufmännische Verband Schweiz ist die nationale Berufsorganisation der Arbeitnehmerinnen und Arbeitnehmer im kaufmännischen und betriebswirtschaftlichen Bereich und im Detailhandel.',
    ],
    [
      'Verein PRS PET-Recycling Schweiz',
      'Der Verein bezweckt die Sammlung und das Recycling von PET-Getränkeflaschen in der Schweiz.',
    ],
    [
      'DECOROF BERN AG',
      'Verkauf von Vorhängen, Rideaux, Stores und Dekoration für Wohnräume.',
    ],
  ];
  for (const [name, purpose] of junk) {
    assert.equal(isConstructionCompany(name, purpose), false, `${name} must be rejected`);
  }
});

test('bare "bau" as a substring is not a construction signal', () => {
  // Farming (Anbau) and boilerplate (überbauen) contain "bau" but are not construction.
  assert.equal(
    isConstructionCompany(
      'Weinbau Müller GmbH',
      'Anbau und Verkauf von Wein. Die Gesellschaft kann Grundstücke erwerben, überbauen und veräussern.'
    ),
    false
  );
  assert.equal(
    isConstructionCompany(
      'Immo Holding AG',
      'Erwerb, Verwaltung und Veräusserung von Liegenschaften. Die Gesellschaft kann Grundstücke erwerben, überbauen und verwalten.'
    ),
    false
  );
  // Whole-word "Bau" is a signal, as is a strong term in the first sentence.
  assert.equal(
    isConstructionCompany(
      'Müller Bau AG',
      'Ausführung von Bau- und Umbauarbeiten aller Art im Hoch- und Tiefbau.'
    ),
    true
  );
  assert.equal(
    isConstructionCompany(
      'Aarebau AG',
      'Ausführung von Bauabdichtungen, Beschichtungen und Betonsanierungen.'
    ),
    true
  );
});
