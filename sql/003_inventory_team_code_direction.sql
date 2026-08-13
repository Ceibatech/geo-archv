-- CG1020 - rattachement des équipes aux directions d'inventaire

SET NAMES utf8mb4;

ALTER TABLE inventory_teams
  ADD COLUMN code VARCHAR(30) NOT NULL AFTER id,
  ADD COLUMN direction VARCHAR(191) NOT NULL AFTER name,
  ADD UNIQUE KEY uq_inventory_teams_code (code);
