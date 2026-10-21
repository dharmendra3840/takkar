// The exams Takkar prepares for, and how each one plays (design/01-exam-patterns.md).
// Shared by the app and the server. Verify against the latest official notices before launch.
//
// marks / negative: per question, as in the real paper.
// seconds: per question in duels and mocks (exam time ÷ questions).
// weights: how often each question type appears (1 = normal), so a duel feels like this exam.

export const EXAMS = {
  'ssc-cgl': {
    id: 'ssc-cgl', short: 'SSC CGL', name: 'SSC CGL Tier 1', group: 'SSC', badge: 'SSC', color: '#2A3BE8',
    paper: { questions: 100, minutes: 60 }, marks: 2, negative: 0.5, seconds: 36,
    sections: [['Reasoning', 25], ['General Awareness', 25], ['Quant', 25], ['English', 25]],
    mock: { quant: 12, reasoning: 13, minutes: 15, sectional: false },
    weights: {
      'percent-of': 3, 'percent-change': 3, 'ratio-share': 3, 'profit-sp': 2, 'profit-percent': 2, discount: 2, 'successive-discount': 2,
      'simple-interest': 2, 'compound-interest': 2, 'work-together': 2, speed: 2, 'train-platform': 2, 'average-new': 2, simplify: 2, 'lcm-bells': 2,
      'number-series': 3, coding: 3, 'odd-prime': 3, analogy: 3, 'letter-series': 2, direction: 2, 'row-position': 2, 'alphabet-position': 2,
    },
  },
  'ibps-po': {
    id: 'ibps-po', short: 'IBPS PO', name: 'IBPS PO Prelims', group: 'Banking', badge: 'PO', color: '#0B6B50',
    paper: { questions: 100, minutes: 60 }, marks: 1, negative: 0.25, seconds: 36,
    sections: [['English', 30], ['Quant', 35], ['Reasoning', 35]],
    mock: { quant: 12, reasoning: 13, minutes: 15, sectional: true },
    weights: {
      simplify: 4, 'number-series': 4, 'percent-of': 2, 'percent-change': 2, 'profit-percent': 2, 'ages-ratio': 2, mixture: 2, partnership: 2,
      boats: 2, 'average-new': 2, 'work-together': 2, pipes: 2, 'compound-interest': 2,
      coding: 3, 'row-position': 3, 'alphabet-position': 3, direction: 2, 'clock-angle': 0.5, calendar: 0.5,
    },
  },
  'rrb-ntpc': {
    id: 'rrb-ntpc', short: 'RRB NTPC', name: 'RRB NTPC CBT 1', group: 'Railways', badge: 'RRB', color: '#B84700',
    paper: { questions: 100, minutes: 90 }, marks: 1, negative: 1 / 3, seconds: 54,
    sections: [['General Awareness', 40], ['Maths', 30], ['Reasoning', 30]],
    mock: { quant: 12, reasoning: 13, minutes: 22.5, sectional: false },
    weights: {
      'lcm-bells': 3, simplify: 3, 'percent-of': 3, 'simple-interest': 3, 'compound-interest': 2, 'work-together': 3, speed: 2, 'average-new': 2,
      'ratio-share': 2, 'profit-sp': 2,
      analogy: 3, 'number-series': 3, coding: 3, 'odd-prime': 2, direction: 2, calendar: 2, 'clock-angle': 2, 'alphabet-position': 2,
    },
  },
};

export const EXAM_IDS = Object.keys(EXAMS);
export const getExam = (id) => EXAMS[id] || null;

/** "+2 / −0.5" style marking label. */
export function markingLabel(exam) {
  const neg = exam.negative === 1 / 3 ? '⅓' : String(exam.negative);
  return `+${exam.marks} / −${neg}`;
}

/** "Quant" for the engine's quant topic, "Maths" for railways (as the paper says). */
export const quantName = (exam) => (exam && exam.id === 'rrb-ntpc' ? 'Maths' : 'Quant');
