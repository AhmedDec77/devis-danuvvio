-- =====================================================
-- Schéma DEVIS DANUVVIO — à coller dans Supabase SQL Editor
-- =====================================================

-- 1. Catalogue de prestations
create table if not exists prestations (
  id text primary key,
  categorie_id text not null,
  categorie text not null,
  nom text not null,
  unite text not null default 'pauschal',
  prix_bas numeric not null,
  prix_median numeric not null,
  prix_haut numeric not null,
  actif boolean default true,
  cree_le timestamptz default now()
);

-- 2. Devis
create table if not exists devis (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  date_devis date not null default current_date,
  client_civilite text,
  client_prenom text,
  client_nom text not null,
  client_adresse text,
  client_ville text,
  titre text,
  niveau_prix text default 'median',
  total_ht numeric not null,
  tva numeric not null,
  total_ttc numeric not null,
  statut text default 'brouillon',
  lignes jsonb not null,
  cree_le timestamptz default now()
);

-- 3. Compteur de numérotation par année
create table if not exists compteurs (
  annee int primary key,
  dernier int not null default 0
);

create or replace function prochain_numero()
returns text language plpgsql as $$
declare a int := extract(year from current_date); n int;
begin
  insert into compteurs(annee, dernier) values (a, 1)
  on conflict (annee) do update set dernier = compteurs.dernier + 1
  returning dernier into n;
  return a || lpad(n::text, 3, '0');
end $$;

-- 4. Sécurité : seul un utilisateur connecté accède aux données
alter table prestations enable row level security;
alter table devis enable row level security;
alter table compteurs enable row level security;

create policy "auth read prestations" on prestations for select to authenticated using (true);
create policy "auth write prestations" on prestations for all to authenticated using (true) with check (true);
create policy "auth all devis" on devis for all to authenticated using (true) with check (true);
create policy "auth all compteurs" on compteurs for all to authenticated using (true) with check (true);

-- 5. Seed : catalogue issu de l'analyse des 330 devis/factures 2017-2026
insert into prestations (id, categorie_id, categorie, nom, unite, prix_bas, prix_median, prix_haut) values
('schutz', 'vorbereitung', 'Vorbereitung & Schutz', 'Schutz des Arbeitsbereichs (Abdeckung Boden, Möbel, Aufzug)', 'pauschal', 70, 80, 150),
('anfahrt', 'vorbereitung', 'Vorbereitung & Schutz', 'Anfahrt / Fahrtkosten', 'pauschal', 40, 60, 120),
('demontage_sanitaer', 'abbruch', 'Demontage & Abbruch', 'Demontage von Sanitärobjekten (WC, Waschbecken, Dusche/Wanne, Heizkörper)', 'pauschal', 400, 400, 500),
('fliesen_entfernen', 'abbruch', 'Demontage & Abbruch', 'Entfernung von Wand- und Bodenfliesen inkl. Kleber-/Mörtelreste', 'pauschal', 450, 900, 950),
('entsorgung', 'abbruch', 'Demontage & Abbruch', 'Entsorgung / Container / Bauschutt', 'pauschal', 150, 380, 500),
('ausgleich', 'rohbau', 'Untergrund & Rohbau', 'Wand-/Bodenvorbereitung (Ausgleichsmörtel, selbstnivellierende Masse)', 'pauschal', 200, 400, 450),
('estrich', 'rohbau', 'Untergrund & Rohbau', 'Estricharbeiten', 'pauschal', 150, 400, 700),
('trockenbau', 'rohbau', 'Untergrund & Rohbau', 'Trockenbau / Rigips / Vorwandinstallation', 'pauschal', 175, 400, 1075),
('abdichtung_bad', 'abdichtung', 'Abdichtung', 'Abdichtung Dusche/Bad (Lastogum, Dichtband, Manschetten)', 'pauschal', 250, 300, 400),
('wandfliesen', 'fliesen', 'Fliesenarbeiten', 'Wandfliesen verlegen', 'pauschal', 900, 1900, 2300),
('bodenfliesen', 'fliesen', 'Fliesenarbeiten', 'Bodenfliesen verlegen', 'pauschal', 350, 500, 1072),
('verfugen', 'fliesen', 'Fliesenarbeiten', 'Verfugen der Fliesen', 'pauschal', 200, 350, 450),
('silikon', 'fliesen', 'Fliesenarbeiten', 'Silikonfugen erneuern/ausführen', 'pauschal', 80, 150, 400),
('leitungen', 'sanitaer', 'Sanitärinstallation', 'Sanitärinstallation Kalt-/Warmwasser- und Abwasserleitungen', 'pauschal', 200, 450, 700),
('wc_montage', 'sanitaer', 'Sanitärinstallation', 'Montage WC/Toilette', 'pauschal', 150, 375, 600),
('waschbecken_montage', 'sanitaer', 'Sanitärinstallation', 'Montage Waschbecken inkl. Armatur', 'pauschal', 212, 438, 600),
('dusche_montage', 'sanitaer', 'Sanitärinstallation', 'Montage Dusche/Duschkabine', 'pauschal', 120, 420, 700),
('streichen', 'maler', 'Malerarbeiten', 'Wände und Decken streichen', 'pauschal', 150, 350, 700),
('spachteln', 'maler', 'Malerarbeiten', 'Spachteln und Schleifen (Q2-Q3)', 'pauschal', 170, 450, 800),
('grundierung', 'maler', 'Malerarbeiten', 'Grundierung auftragen', 'pauschal', 165, 300, 675),
('tapete', 'maler', 'Malerarbeiten', 'Tapezieren / Tapete entfernen', 'pauschal', 50, 200, 562),
('fassade', 'maler', 'Malerarbeiten', 'Fassadenanstrich', 'pauschal', 2000, 8389, 10472),
('laminat', 'boden', 'Bodenbeläge', 'Laminat/Vinyl/Parkett verlegen', 'pauschal', 385, 560, 1126),
('teppich', 'boden', 'Bodenbeläge', 'Teppich verlegen', 'pauschal', 300, 600, 1500),
('sockelleisten', 'boden', 'Bodenbeläge', 'Sockelleisten montieren', 'pauschal', 293, 600, 1410),
('elektro', 'elektro', 'Elektroarbeiten', 'Elektroarbeiten (Steckdosen, Schalter, Leitungen)', 'pauschal', 70, 150, 800),
('material', 'material', 'Material', 'Materialien und Lieferung', 'pauschal', 90, 150, 350),
('stundensatz', 'stunden', 'Regiearbeiten', 'Stundensatz Facharbeiter', 'stunde', 50, 60, 75)
on conflict (id) do nothing;
