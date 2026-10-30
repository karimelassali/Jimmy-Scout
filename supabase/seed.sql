-- JimiScout BTP - Initial Seed Data
-- Swiss Contractors Directory, Initial Settings, and Pipeline Deals

-- Default single-row configuration
INSERT INTO agent_settings (
    is_active,
    daily_limit,
    selected_cantons,
    sender_name,
    sender_email,
    sender_phone,
    tone,
    hooks,
    equipment_focus
) VALUES (
    true,
    25,
    ARRAY['BE', 'ZH', 'VD', 'TI', 'GE', 'VS'],
    'Jamal',
    'contact@jimiexport.ch',
    '+41 79 123 45 67',
    'swiss_formal',
    '{"cash_settlement": true, "transport_covered": true, "as_is": true}'::jsonb,
    'Pelles sur chenilles 15-30t, camions benne 4 essieux, dumpers articulés, concasseurs'
);

-- Seed Verified Swiss Contractors
INSERT INTO companies (name, domain, canton, language, email, phone, industry) VALUES
('Frutiger AG', 'frutiger.com', 'BE', 'de', 'info@frutiger.com', '+41 58 226 88 88', 'tiefbau'),
('Implenia Schweiz AG', 'implenia.com', 'ZH', 'de', 'info@implenia.com', '+41 58 474 74 74', 'tiefbau'),
('KIBAG Kieswerk & Concassage AG', 'kibag.ch', 'ZH', 'de', 'baustoffe@kibag.ch', '+41 58 387 11 11', 'quarry'),
('Marti Construction SA', 'marti-vd.ch', 'VD', 'fr', 'direction@marti-vd.ch', '+41 21 651 81 81', 'civil_engineering'),
('Orllati SA', 'orllati.ch', 'VD', 'fr', 'contact@orllati.ch', '+41 21 637 60 60', 'demolition'),
('Induni & Cie SA', 'induni.ch', 'GE', 'fr', 'contact@induni.ch', '+41 22 827 75 00', 'civil_engineering'),
('Walo Bertschinger AG', 'walo.ch', 'VS', 'fr', 'sion@walo.ch', '+41 27 327 25 50', 'civil_engineering'),
('CSC Costruzioni SA', 'csc-sa.ch', 'TI', 'it', 'info@csc-sa.ch', '+41 91 850 51 11', 'civil_engineering'),
('Züblin Bau AG', 'zueblin.ch', 'ZH', 'de', 'info@zueblin.ch', '+41 44 206 21 11', 'tiefbau'),
('Käppeli Bau AG', 'kaeppeli.ch', 'BE', 'de', 'tiefbau@kaeppeli.ch', '+41 33 655 40 40', 'quarry'),
('Ghelma AG Baubetriebe', 'ghelma.ch', 'BE', 'de', 'info@ghelma.ch', '+41 33 972 62 62', 'tiefbau'),
('PraderLosinger SA', 'praderlosinger.ch', 'GE', 'fr', 'geneve@praderlosinger.ch', '+41 22 708 81 81', 'civil_engineering');

-- Seed Inbound Leads (CRM Pipeline)
INSERT INTO inbound_leads (
    company_id,
    sender_email,
    raw_subject,
    raw_body,
    intent,
    machinery_detected,
    contact_name,
    contact_phone,
    lead_status,
    ai_summary
) VALUES
(
    (SELECT id FROM companies WHERE name = 'Frutiger AG' LIMIT 1),
    'b.schneider@frutiger.com',
    'Re: Disponibilité matériel de terrassement',
    'Guten Tag Herr Jamal, wir erneuern unseren Maschinenpark im Werkhof Thun per Ende November. Wir hätten einen Raupenbagger CAT 320 GC (Baujahr 2019, 4800 Betriebsstunden) in gutem Zustand abzugeben. Preisvorstellung: CHF 44''000 exkl. MwSt. Barzahlung und Abholung ab Platz wäre uns recht. Freundliche Grüsse, Beat Schneider (+41 79 432 11 88)',
    'HOT_LEAD',
    '[{"type": "Pelle sur chenilles", "make_model": "CAT 320 GC", "year": 2019, "hours": 4800, "asking_price": "CHF 44''000"}]'::jsonb,
    'Beat Schneider',
    '+41 79 432 11 88',
    'new',
    'Offre ferme pour un CAT 320 GC (2019, 4800h) à CHF 44''000 au dépôt de Thun. Paiement comptant et enlèvement sur place acceptés.'
),
(
    (SELECT id FROM companies WHERE name = 'KIBAG Kieswerk & Concassage AG' LIMIT 1),
    'm.weber@kibag.ch',
    'AW: Maschinenankauf Kieswerk Regensdorf',
    'Hallo Jamal, wir haben einen Radlader Volvo L150H (Jahrgang 2018, ca. 6200 Stunden) sowie zwei 4-Achs Kipper Mercedes Arocs 3245 (2020) zu verkaufen. Radlader bei CHF 58''000, Kipper je CHF 52''000. Schneller Abtransport gewünscht. Gruss, Marc Weber, Tel 078 610 99 22',
    'HOT_LEAD',
    '[{"type": "Chargeuse sur pneus", "make_model": "Volvo L150H", "year": 2018, "hours": 6200, "asking_price": "CHF 58''000"}, {"type": "Camion benne 4 essieux", "make_model": "Mercedes Arocs 3245", "year": 2020, "asking_price": "CHF 52''000"}]'::jsonb,
    'Marc Weber',
    '+41 78 610 99 22',
    'contacted',
    'Volvo L150H (CHF 58''000) et 2 camions benne Mercedes Arocs 3245 (CHF 52''000/u) disponibles à Regensdorf. Enlèvement rapide exigé.'
),
(
    (SELECT id FROM companies WHERE name = 'Induni & Cie SA' LIMIT 1),
    's.bovet@induni.ch',
    'Re: Renouvellement parc engins génie civil',
    'Bonjour Jamal, Nous avons terminé le chantier CEVA et libérons une pelle Liebherr R924 Compact (2021, 3100h) équipée OilQuick OQ70/55. Prix souhaité CHF 75''000 net. Pouvez-vous organiser le convoi vers fin de semaine prochaine ? Stéphane Bovet, 076 544 20 15.',
    'HOT_LEAD',
    '[{"type": "Pelle sur chenilles", "make_model": "Liebherr R924 Compact", "year": 2021, "hours": 3100, "asking_price": "CHF 75''000"}]'::jsonb,
    'Stéphane Bovet',
    '+41 76 544 20 15',
    'inspecting',
    'Liebherr R924 Compact (2021, 3100h) avec attache OilQuick OQ70/55 disponible à Genève pour CHF 75''000. Convoi à prévoir fin de semaine.'
);
