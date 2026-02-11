/**
 * 質問選択のユニットテスト
 */

import {
  shouldInsertConfirm,
  getNextHardConfirmType,
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
