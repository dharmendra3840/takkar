-- Live tests: each attempt is marked once, at submit or when the test closes, and the reports read the stored marks
-- instead of marking every attempt again (the class report has to fit the Workers free plan's CPU limit).
ALTER TABLE live_attempts ADD COLUMN marks TEXT; -- one character per question, in the paper's order: r right, w wrong, - skipped
