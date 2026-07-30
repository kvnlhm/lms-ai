import { classifyRisk } from './learner-insights.service';

const baseline = {
  daysInactive: 1,
  daysSinceEnrolled: 30,
  averageProgress: 50,
  courseAverageProgress: 50,
};

describe('classifyRisk', () => {
  it('marks a recently active learner with normal progress as low risk', () => {
    expect(classifyRisk(baseline).level).toBe('LOW');
  });

  it('escalates with the length of inactivity, following PRD 8.6 thresholds', () => {
    expect(classifyRisk({ ...baseline, daysInactive: 6 }).level).toBe('LOW');
    expect(classifyRisk({ ...baseline, daysInactive: 7 }).level).toBe('MEDIUM');
    expect(classifyRisk({ ...baseline, daysInactive: 13 }).level).toBe('MEDIUM');
    expect(classifyRisk({ ...baseline, daysInactive: 14 }).level).toBe('HIGH');
  });

  it('flags a learner who never started long after enrolling', () => {
    const verdict = classifyRisk({
      ...baseline,
      daysInactive: null,
      daysSinceEnrolled: 20,
    });
    expect(verdict.level).toBe('HIGH');
    expect(verdict.reason).toContain('Belum pernah memulai');
  });

  it('does not punish a learner who only just enrolled', () => {
    expect(
      classifyRisk({ ...baseline, daysInactive: null, daysSinceEnrolled: 2 }).level,
    ).toBe('LOW');
  });

  it('flags an active learner whose progress trails the cohort badly', () => {
    const verdict = classifyRisk({
      ...baseline,
      averageProgress: 10,
      courseAverageProgress: 60,
    });
    expect(verdict.level).toBe('MEDIUM');
    expect(verdict.reason).toContain('di bawah rata-rata');
  });

  it('does not flag trailing progress when the cohort itself has barely started', () => {
    // Tanpa penjaga ini, seluruh pelajar akan berisiko pada hari pertama kursus.
    expect(
      classifyRisk({ ...baseline, averageProgress: 0, courseAverageProgress: 0 }).level,
    ).toBe('LOW');
  });

  it('always explains the verdict', () => {
    for (const daysInactive of [null, 1, 8, 20]) {
      expect(classifyRisk({ ...baseline, daysInactive }).reason.length).toBeGreaterThan(10);
    }
  });
});
