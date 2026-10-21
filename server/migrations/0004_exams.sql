-- Exam-first (beta 0.3): each player prepares for one exam, and every duel is played in an exam's pattern.

-- 'ssc-cgl' | 'ibps-po' | 'rrb-ntpc'; null until the player picks one.
ALTER TABLE users ADD COLUMN exam_id TEXT;
-- 'YYYY-MM' of the player's exam, for the countdown; null if they don't know yet.
ALTER TABLE users ADD COLUMN exam_month TEXT;
-- Duels a day the player aims for: 1, 3 or 5.
ALTER TABLE users ADD COLUMN daily_goal INTEGER;

-- The exam whose marking the duel used (null for duels from before exams).
-- Scores are now multiples of 1/12 (−0.5, −0.25, −⅓ marking); SQLite keeps them as REAL.
ALTER TABLE duels ADD COLUMN exam_id TEXT;
CREATE INDEX duels_exam_day ON duels(exam_id, day);
