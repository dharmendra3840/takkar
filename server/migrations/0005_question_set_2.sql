-- Question set 2 (app 0.4): the new question types, so the admin can pause them like the others.
INSERT OR IGNORE INTO templates (id, label, topic, status, updated_at, updated_by) VALUES ('bodmas', 'BODMAS', 'quant', 'active', '2026-10-26T00:00:00.000Z', 'system');
INSERT OR IGNORE INTO templates (id, label, topic, status, updated_at, updated_by) VALUES ('unit-digit', 'Number system', 'quant', 'active', '2026-10-26T00:00:00.000Z', 'system');
INSERT OR IGNORE INTO templates (id, label, topic, status, updated_at, updated_by) VALUES ('divisible-add', 'Number system', 'quant', 'active', '2026-10-26T00:00:00.000Z', 'system');
INSERT OR IGNORE INTO templates (id, label, topic, status, updated_at, updated_by) VALUES ('fraction-compare', 'Fractions', 'quant', 'active', '2026-10-26T00:00:00.000Z', 'system');
INSERT OR IGNORE INTO templates (id, label, topic, status, updated_at, updated_by) VALUES ('approximation', 'Approximation', 'quant', 'active', '2026-10-26T00:00:00.000Z', 'system');
INSERT OR IGNORE INTO templates (id, label, topic, status, updated_at, updated_by) VALUES ('quadratic', 'Quadratic equations', 'quant', 'active', '2026-10-26T00:00:00.000Z', 'system');
INSERT OR IGNORE INTO templates (id, label, topic, status, updated_at, updated_by) VALUES ('inequality', 'Inequalities', 'reasoning', 'active', '2026-10-26T00:00:00.000Z', 'system');
INSERT OR IGNORE INTO templates (id, label, topic, status, updated_at, updated_by) VALUES ('syllogism', 'Syllogism', 'reasoning', 'active', '2026-10-26T00:00:00.000Z', 'system');
INSERT OR IGNORE INTO templates (id, label, topic, status, updated_at, updated_by) VALUES ('blood-relation', 'Blood relations', 'reasoning', 'active', '2026-10-26T00:00:00.000Z', 'system');
INSERT OR IGNORE INTO templates (id, label, topic, status, updated_at, updated_by) VALUES ('word-analogy', 'Word analogy', 'reasoning', 'active', '2026-10-26T00:00:00.000Z', 'system');
INSERT OR IGNORE INTO templates (id, label, topic, status, updated_at, updated_by) VALUES ('letter-analogy', 'Letter analogy', 'reasoning', 'active', '2026-10-26T00:00:00.000Z', 'system');
INSERT OR IGNORE INTO templates (id, label, topic, status, updated_at, updated_by) VALUES ('letter-classify', 'Classification', 'reasoning', 'active', '2026-10-26T00:00:00.000Z', 'system');
