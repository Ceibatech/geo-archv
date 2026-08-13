-- CG1020 - liste officielle des directions d'inventaire

SET NAMES utf8mb4;

ALTER TABLE inventory_teams
  MODIFY direction ENUM(
    'DCM',
    'DEMA',
    'SDA',
    'DTC',
    'DAJC',
    'DDU',
    'DGUF',
    'SBICU',
    'GUF'
  ) NOT NULL;
