-- TASK-BILL-01 / QA04-02. Member E owns billing; coordinate the sequence with A.
-- Keep historical invoices intact. PostgreSQL enforces this constraint for new
-- references immediately. Validate existing rows after approved reconciliation.
ALTER TABLE invoices
    ADD CONSTRAINT invoices_patient_fk
    FOREIGN KEY (patient_id) REFERENCES patients(id) NOT VALID;
