-- CG1020 - rôles hiérarchiques et équipes d'inventaire

SET NAMES utf8mb4;

ALTER TABLE users
  MODIFY role ENUM('admin', 'agent', 'superviseur', 'executif') NOT NULL;

CREATE TABLE IF NOT EXISTS inventory_teams (
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

CREATE TABLE IF NOT EXISTS inventory_team_members (
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
