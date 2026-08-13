ALTER TABLE inventory_records
  ADD COLUMN supervisor_user_id BIGINT UNSIGNED NULL AFTER created_by,
  ADD COLUMN review_status ENUM('PENDING_SUPERVISOR', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED' AFTER supervisor_user_id,
  ADD COLUMN review_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER review_status,
  ADD COLUMN agent_signature MEDIUMBLOB NULL AFTER review_version,
  ADD COLUMN agent_signature_sha256 CHAR(64) NULL AFTER agent_signature,
  ADD COLUMN agent_signed_at DATETIME NULL AFTER agent_signature_sha256,
  ADD COLUMN supervisor_signature MEDIUMBLOB NULL AFTER agent_signed_at,
  ADD COLUMN supervisor_signature_sha256 CHAR(64) NULL AFTER supervisor_signature,
  ADD COLUMN supervisor_signed_at DATETIME NULL AFTER supervisor_signature_sha256,
  ADD COLUMN supervisor_comment TEXT NULL AFTER supervisor_signed_at,
  ADD COLUMN rejection_reason TEXT NULL AFTER supervisor_comment,
  ADD COLUMN rejected_at DATETIME NULL AFTER rejection_reason,
  ADD KEY idx_inventory_review_queue (supervisor_user_id, review_status, created_at),
  ADD KEY idx_inventory_agent_review (created_by, review_status, created_at),
  ADD CONSTRAINT fk_inventory_record_supervisor
    FOREIGN KEY (supervisor_user_id) REFERENCES users(id) ON DELETE RESTRICT;

CREATE TABLE inventory_record_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_record_events_record (record_id, created_at),
  CONSTRAINT fk_inventory_record_events_record
    FOREIGN KEY (record_id) REFERENCES inventory_records(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_record_events_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
