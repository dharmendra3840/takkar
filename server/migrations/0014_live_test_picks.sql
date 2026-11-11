-- Live tests, class insights: the option each student picked, in the question's own order, kept when the attempt is
-- marked, so the class report can show the wrong answers many students chose without re-reading every attempt.
ALTER TABLE live_attempts ADD COLUMN picks TEXT; -- one character per question in the paper's order: 0-3, or - when not answered
