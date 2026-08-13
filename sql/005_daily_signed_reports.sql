-- CG1020 - rapports journaliers signes et piste d'audit

SET NAMES utf8mb4;

CREATE TABLE daily_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_date DATE NOT NULL,
  agent_user_id BIGINT UNSIGNED NOT NULL,
  supervisor_user_id BIGINT UNSIGNED NOT NULL,
  team_id BIGINT UNSIGNED NOT NULL,
  team_code VARCHAR(30) NOT NULL,
  team_name VARCHAR(120) NOT NULL,
  direction VARCHAR(191) NOT NULL,
  status ENUM('PENDING_SUPERVISOR', 'APPROVED', 'REJECTED') NOT NULL,
  version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  cartons_count INT UNSIGNED NOT NULL DEFAULT 0,
  dossiers_count INT UNSIGNED NOT NULL DEFAULT 0,
  degraded_cartons_count INT UNSIGNED NOT NULL DEFAULT 0,
  degraded_dossiers_count INT UNSIGNED NOT NULL DEFAULT 0,
  major_difficulties TEXT NULL,
  agent_signature MEDIUMBLOB NOT NULL,
  agent_signature_sha256 CHAR(64) NOT NULL,
  agent_signed_at DATETIME NOT NULL,
  supervisor_signature MEDIUMBLOB NULL,
  supervisor_signature_sha256 CHAR(64) NULL,
  supervisor_signed_at DATETIME NULL,
  supervisor_comment TEXT NULL,
  rejection_reason TEXT NULL,
  rejected_at DATETIME NULL,
  approved_pdf_sha256 CHAR(64) NULL,
  email_status ENUM('NOT_SENT', 'SENT', 'FAILED') NOT NULL DEFAULT 'NOT_SENT',
  resend_email_id VARCHAR(100) NULL,
  email_sent_at DATETIME NULL,
  email_error VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_daily_reports_agent_date (agent_user_id, report_date),
  KEY idx_daily_reports_supervisor_status (supervisor_user_id, status, report_date),
  KEY idx_daily_reports_team_date (team_id, report_date),
  CONSTRAINT fk_daily_reports_agent
    FOREIGN KEY (agent_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_daily_reports_supervisor
    FOREIGN KEY (supervisor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_daily_reports_team
    FOREIGN KEY (team_id) REFERENCES inventory_teams(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE daily_report_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_daily_report_events_report (report_id, created_at),
  CONSTRAINT fk_daily_report_events_report
    FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_daily_report_events_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
