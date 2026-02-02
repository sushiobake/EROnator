/**
 * スコアリングのユニットテスト
 */

import {
  normalizeWeights,
  calculateConfidence,
  calculateEffectiveCandidates,
} from '../scoring';
import type { WorkWeight, WorkProbability } from '../types';

describe('scoring', () => {
  describe('normalizeWeights', () => {
    it('should normalize weights correctly', () => {
      const weights: WorkWeight[] = [
        { workId: 'w1', weight: 2.0 },
        { workId: 'w2', weight: 3.0 },
        { workId: 'w3', weight: 5.0 },
      ];

      const probabilities = normalizeWeights(weights);
      expect(probabilities.length).toBe(3);
      expect(probabilities.reduce((sum, p) => sum + p.probability, 0)).toBeCloseTo(1.0, 5);
    });

    it('should handle zero total weight', () => {
      const weights: WorkWeight[] = [
        { workId: 'w1', weight: 0 },
        { workId: 'w2', weight: 0 },
      ];

      const probabilities = normalizeWeights(weights);
      expect(probabilities.length).toBe(2);
      expect(probabilities[0].probability).toBeCloseTo(0.5, 5);
      expect(probabilities[1].probability).toBeCloseTo(0.5, 5);
    });
  });

  describe('calculateConfidence', () => {
    it('should return top1 probability', () => {
      const probabilities: WorkProbability[] = [
        { workId: 'w1', probability: 0.3 },
        { workId: 'w2', probability: 0.7 },
        { workId: 'w3', probability: 0.0 },
      ];

      const confidence = calculateConfidence(probabilities);
      expect(confidence).toBe(0.7);
    });

    it('should use workId asc for tie-break (決定論的)', () => {
      const probabilities: WorkProbability[] = [
        { workId: 'w2', probability: 0.5 },
        { workId: 'w1', probability: 0.5 },
      ];

      const confidence = calculateConfidence(probabilities);
      // w1 < w2 なので w1 が選ばれる
      expect(confidence).toBe(0.5);
    });
  });

  describe('calculateEffectiveCandidates', () => {
    it('should calculate correctly', () => {
      const probabilities: WorkProbability[] = [
        { workId: 'w1', probability: 0.5 },
        { workId: 'w2', probability: 0.5 },
      ];

      const effective = calculateEffectiveCandidates(probabilities);
      // 1 / (0.5^2 + 0.5^2) = 1 / 0.5 = 2
      expect(effective).toBeCloseTo(2.0, 5);
    });
  });
});
