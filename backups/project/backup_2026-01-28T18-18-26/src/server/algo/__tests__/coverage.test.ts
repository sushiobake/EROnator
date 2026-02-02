/**
 * Coverage gateのユニットテスト
 */

import { passesCoverageGate } from '../coverage';

describe('coverage', () => {
  describe('passesCoverageGate - AUTO mode', () => {
    it('should pass when coverage >= minRatio (正常ケース)', () => {
      const result = passesCoverageGate(
        25, // tagWorkCount
        100, // totalWorks
        'AUTO',
        0.05, // minCoverageRatio (5%)
        20 // minCoverageWorks
      );
      // minRatio = max(0.05, min(20, 100)/100) = max(0.05, 0.2) = 0.2
      // coverage = 25/100 = 0.25 >= 0.2 ✓
      expect(result).toBe(true);
    });

    it('should pass when tagWorkCount >= minCoverageWorks (正常ケース)', () => {
      const result = passesCoverageGate(
        25, // tagWorkCount
        100, // totalWorks
        'AUTO',
        0.05, // minCoverageRatio
        20 // minCoverageWorks
      );
      // coverage = 25/100 = 0.25 >= max(0.05, 20/100=0.2) = 0.25 ✓
      expect(result).toBe(true);
    });

    it('should not break when totalWorks < minCoverageWorks (破綻しない確認)', () => {
      const result = passesCoverageGate(
        2, // tagWorkCount
        10, // totalWorks < minCoverageWorks(20)
        'AUTO',
        0.05, // minCoverageRatio
        20 // minCoverageWorks
      );
      // clampedMinWorks = min(20, 10) = 10
      // minRatio = max(0.05, 10/10 = 1.0) = 1.0
      // coverage = 2/10 = 0.2 < 1.0 ✗
      expect(result).toBe(false);
    });

    it('should not break when totalWorks = 0 (0除算回避)', () => {
      const result = passesCoverageGate(
        0,
        0, // totalWorks = 0
        'AUTO',
        0.05,
        20
      );
      // max(totalWorks, 1) = 1 で0除算回避
      expect(result).toBe(false);
    });

    it('should handle small DB correctly', () => {
      const result = passesCoverageGate(
        3, // tagWorkCount
        5, // totalWorks (小さいDB)
        'AUTO',
        0.05,
        20
      );
      // clampedMinWorks = min(20, 5) = 5
      // minRatio = max(0.05, 5/5 = 1.0) = 1.0
      // coverage = 3/5 = 0.6 < 1.0 ✗
      expect(result).toBe(false);
    });
  });

  describe('passesCoverageGate - RATIO mode', () => {
    it('should use ratio only', () => {
      const result = passesCoverageGate(
        10,
        100,
        'RATIO',
        0.05,
        null
      );
      // coverage = 0.1 >= 0.05 ✓
      expect(result).toBe(true);
    });
  });

  describe('passesCoverageGate - WORKS mode', () => {
    it('should use work count only', () => {
      const result = passesCoverageGate(
        25,
        100,
        'WORKS',
        null,
        20
      );
      // tagWorkCount = 25 >= 20 ✓
      expect(result).toBe(true);
    });
  });
});
