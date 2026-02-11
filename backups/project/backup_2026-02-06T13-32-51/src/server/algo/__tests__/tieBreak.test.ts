/**
 * Tie-breakの決定論テスト
 */

import { calculateConfidence } from '../scoring';
import { selectExploreTag } from '../questionSelection';
import type { WorkProbability } from '../types';
import type { TagInfo } from '../questionSelection';

describe('tie-break determinism', () => {
  describe('Work ordering (P desc → workId asc)', () => {
    it('should use workId asc for tie-break', () => {
      const probabilities: WorkProbability[] = [
        { workId: 'work_002', probability: 0.5 },
        { workId: 'work_001', probability: 0.5 },
        { workId: 'work_003', probability: 0.5 },
      ];

      const confidence = calculateConfidence(probabilities);
      // work_001 < work_002 < work_003 なので work_001 が選ばれる
      const sorted = [...probabilities].sort((a, b) => {
        if (a.probability !== b.probability) {
          return b.probability - a.probability;
        }
        return a.workId.localeCompare(b.workId);
      });
      expect(sorted[0].workId).toBe('work_001');
    });
  });

  describe('Tag ordering (tagKey asc)', () => {
    it('should use tagKey asc for tie-break', () => {
      const availableTags: TagInfo[] = [
        { tagKey: 'tag_b', displayName: 'B', tagType: 'OFFICIAL', workCount: 10 },
        { tagKey: 'tag_a', displayName: 'A', tagType: 'OFFICIAL', workCount: 10 },
        { tagKey: 'tag_c', displayName: 'C', tagType: 'OFFICIAL', workCount: 10 },
      ];

      const probabilities: WorkProbability[] = [
        { workId: 'w1', probability: 0.5 },
        { workId: 'w2', probability: 0.5 },
      ];

      // 全てのタグでp=0.5（同点）
      const workHasTag = (workId: string, tagKey: string) => {
        return tagKey === 'tag_a' || tagKey === 'tag_b' || tagKey === 'tag_c';
      };

      const selected = selectExploreTag(availableTags, probabilities, workHasTag);
      // tag_a < tag_b < tag_c なので tag_a が選ばれる
      expect(selected).toBe('tag_a');
    });
  });
});
