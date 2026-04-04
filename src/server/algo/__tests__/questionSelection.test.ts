/**
 * 質問選択のユニットテスト
 */

import {
  shouldInsertConfirm,
  getNextHardConfirmType,
  selectConfirmType,
} from '../questionSelection';

describe('questionSelection', () => {
  describe('shouldInsertConfirm', () => {
    it('should insert at Q6 (qForcedIndices)', () => {
      const result = shouldInsertConfirm(
        6,
        0.8, // confidence高くても
        1000, // effectiveCandidates多くても
        {
          qForcedIndices: [6, 10],
          confidenceConfirmBand: [0.4, 0.6],
          effectiveConfirmThreshold: 100,
        }
      );
      expect(result).toBe(true);
    });

    it('should insert at Q10 (qForcedIndices)', () => {
      const result = shouldInsertConfirm(
        10,
        0.8,
        1000,
        {
          qForcedIndices: [6, 10],
          confidenceConfirmBand: [0.4, 0.6],
          effectiveConfirmThreshold: 100,
        }
      );
      expect(result).toBe(true);
    });

    it('should not insert at Q5 (off-by-one確認)', () => {
      const result = shouldInsertConfirm(
        5, // Q6ではない
        0.8,
        1000,
        {
          qForcedIndices: [6, 10],
          confidenceConfirmBand: [0.4, 0.6],
          effectiveConfirmThreshold: 100,
        }
      );
      expect(result).toBe(false);
    });

    it('should insert when confidence in band', () => {
      const result = shouldInsertConfirm(
        3,
        0.5, // band内
        1000,
        {
          qForcedIndices: [6, 10],
          confidenceConfirmBand: [0.4, 0.6],
          effectiveConfirmThreshold: 100,
        }
      );
      expect(result).toBe(true);
    });

    it('should insert when effectiveCandidates <= threshold', () => {
      const result = shouldInsertConfirm(
        3,
        0.8,
        50, // threshold以下
        {
          qForcedIndices: [6, 10],
          confidenceConfirmBand: [0.4, 0.6],
          effectiveConfirmThreshold: 100,
        }
      );
      expect(result).toBe(true);
    });
  });

  describe('selectConfirmType', () => {
    const cfg = { softConfidenceMin: 0.25, hardConfidenceMin: 0.45 };

    it('returns HARD when confidence >= hardConfidenceMin', () => {
      expect(selectConfirmType(0.5, true, cfg)).toBe('HARD_CONFIRM');
    });

    it('returns SOFT when below hard min but has soft data', () => {
      expect(selectConfirmType(0.3, true, cfg)).toBe('SOFT_CONFIRM');
    });

    it('returns HARD when below hard min and no soft data', () => {
      expect(selectConfirmType(0.3, false, cfg)).toBe('HARD_CONFIRM');
    });
  });

  describe('getNextHardConfirmType', () => {
    it('should return TITLE_INITIAL first', () => {
      const result = getNextHardConfirmType([]);
      expect(result).toBe('TITLE_INITIAL');
    });

    it('should return AUTHOR after TITLE_INITIAL', () => {
      const result = getNextHardConfirmType(['TITLE_INITIAL']);
      expect(result).toBe('AUTHOR');
    });

    it('should return null after both used', () => {
      const result = getNextHardConfirmType(['TITLE_INITIAL', 'AUTHOR']);
      expect(result).toBe(null);
    });
  });
});
