-- Live test reports and recommendations (design/03 section 3.4): what each test asked and how the batch did, kept with
-- the test, so a student's report and progress add up a few small rows instead of reading every paper and attempt again.
ALTER TABLE live_tests ADD COLUMN outline TEXT; -- JSON, one entry per question in the paper's order: [template id, topic label, 'q' | 'r']
ALTER TABLE live_tests ADD COLUMN batch TEXT;   -- JSON, set when the test is marked: { sat, right: [per question], secs: [per question, summed], sumX12 }
