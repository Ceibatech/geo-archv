ALTER TABLE inventory_records
  ADD UNIQUE KEY uq_inventory_agent_signature (created_by, agent_signature_sha256),
  ADD UNIQUE KEY uq_inventory_supervisor_signature (supervisor_user_id, supervisor_signature_sha256);

ALTER TABLE daily_reports
  ADD UNIQUE KEY uq_daily_report_agent_signature (agent_user_id, agent_signature_sha256),
  ADD UNIQUE KEY uq_daily_report_supervisor_signature (supervisor_user_id, supervisor_signature_sha256);
