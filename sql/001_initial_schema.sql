-- CG1020 - Schéma initial
-- MySQL 8.0+
-- Exécuter dans la base configurée par DB_NAME.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NULL,
  login VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  agent_code VARCHAR(30) NULL,
  role ENUM('admin', 'agent', 'superviseur', 'executif') NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_login (login),
  UNIQUE KEY uq_users_agent_code (agent_code),
  CONSTRAINT chk_agent_has_code CHECK (role <> 'agent' OR agent_code IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token_hash (token_hash),
  KEY idx_sessions_user_id (user_id),
  KEY idx_sessions_expires_at (expires_at),
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cartons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  carton_uid VARCHAR(64) NOT NULL,
  libelle VARCHAR(255) NOT NULL,
  barcode VARCHAR(100) NULL,
  carton_damaged BOOLEAN NOT NULL DEFAULT FALSE,
  carton_damage_note TEXT NULL,
  status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cartons_carton_uid (carton_uid),
  KEY idx_cartons_created_by (created_by),
  KEY idx_cartons_status (status),
  KEY idx_cartons_barcode (barcode),
  CONSTRAINT fk_cartons_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  carton_id BIGINT UNSIGNED NOT NULL,
  client_request_id CHAR(36) NOT NULL,
  guichet_number VARCHAR(100) NULL,
  ddu_number VARCHAR(100) NULL,
  classification_reference VARCHAR(191) NULL,
  ilot_number VARCHAR(100) NULL,
  lot_number VARCHAR(100) NULL,
  surface_area DECIMAL(15, 2) NULL,
  land_title_number VARCHAR(100) NULL,
  housing_estate VARCHAR(191) NULL,
  commune VARCHAR(191) NULL,
  case_nature VARCHAR(191) NOT NULL,
  last_name VARCHAR(100) NULL,
  first_names VARCHAR(191) NULL,
  address TEXT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(191) NULL,
  contact_person VARCHAR(191) NULL,
  contact_mobile VARCHAR(50) NULL,
  dossier_damaged BOOLEAN NOT NULL DEFAULT FALSE,
  dossier_damage_note TEXT NULL,
  has_difficulty BOOLEAN NOT NULL DEFAULT FALSE,
  difficulty_note TEXT NULL,
  inventory_date DATE NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_client_request (client_request_id),
  KEY idx_inventory_carton_id (carton_id),
  KEY idx_inventory_created_by (created_by),
  KEY idx_inventory_date (inventory_date),
  KEY idx_inventory_created_at (created_at),
  KEY idx_inventory_commune (commune),
  KEY idx_inventory_guichet (guichet_number),
  KEY idx_inventory_ddu (ddu_number),
  KEY idx_inventory_land_title (land_title_number),
  CONSTRAINT fk_inventory_carton
    FOREIGN KEY (carton_id) REFERENCES cartons(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_teams (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  supervisor_user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_teams_name (name),
  KEY idx_inventory_teams_supervisor (supervisor_user_id),
  CONSTRAINT fk_inventory_teams_supervisor
    FOREIGN KEY (supervisor_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_team_members (
  team_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, user_id),
  UNIQUE KEY uq_inventory_team_member_user (user_id),
  CONSTRAINT fk_inventory_team_members_team
    FOREIGN KEY (team_id) REFERENCES inventory_teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_team_members_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
