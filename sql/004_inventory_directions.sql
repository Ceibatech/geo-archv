SET NAMES utf8mb4;

ALTER TABLE inventory_teams
MODIFY direction ENUM(
    'GUF',
    'DDU',
    'DUDU',
    'DGUF',
    'DTC',
    'GUPCCU',
    'AGEF',
    'SDA',
    'SCPA',
    'SBICU',
    'DGCMA',
    'DEMA',
    'DCM',
    'DMISSA',
    'DGLCV',
    'DICAF',
    'DGLPI',
    'DCCV',
    'SALA',
    'DARRU',
    'ANAH',
    'SONAPIE',
    'DAJC'
) NOT NULL;
