import { expect,it } from 'vitest';
import { evidenceMetrics } from '../../convex/evidenceMetrics';
it('uses published probabilities and excludes pushes from proper scoring metrics',()=>{
  const report=evidenceMetrics([{sportId:'football',dayKey:'2026-10-02',source:'verified',finalScore:'2-0',report:{top3Selections:[{selection:'Over 1.5',marketTitle:'Total goals',confidence:'80%',rawOdds:2},{selection:'Over 2',marketTitle:'Total goals',confidence:'20%'}]}}]);
  expect(report.resolved).toBe(1);expect(report.brierScore).toBeCloseTo(.04);expect(report.logLoss).toBeCloseTo(-Math.log(.8));expect(report.calibrationGapPct).toBeCloseTo(-20);expect(report.grossRoiPct).toBe(100);
});
it('does not invent evidence for empty, qualitative or unpriced samples',()=>{
  expect(evidenceMetrics([]).brierScore).toBeNull();
  expect(evidenceMetrics([{report:{top3Selections:[{confidence:'High'}]}}]).resolved).toBe(0);
});
