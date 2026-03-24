/**
 * BACKUP 2026-02-26: POST /api/recommend の「好みマッチ度」算出・並びスコア（変更前）
 * 復元手順: route.ts 内の scored = works.map(...) ブロックをこのファイルの該当部分で置換。
 *
 * --- 旧ロジック要約 ---
 * - matchRate: 選択タグのうち作品に何件一致したかの件数比率（0〜100、整数%）。重み・有名度嗜好は未使用。
 * - score (useNewScoring): sum*0.7 + min(1,popularityBase/50)*0.2 + (reviewAverage/5)*0.1
 * - popularityChoice はリクエストに含まれても未使用。
 */

// 以下は当時の route.ts 239-282 行付近相当（参照用）

/*
    const scored = works.map(w => {
      let score: number;
      if (useNewScoring) {
        let sum = 0;
        for (const wt of w.workTags) {
          const k = normalizeTagKey(wt.tagKey);
          const wgt = tagKeyToWeight.get(k);
          if (wgt) sum += wgt;
        }
        const popularityScore = Math.min(1, (w.popularityBase ?? 0) / 50);
        const reviewScore = w.reviewAverage ? w.reviewAverage / 5 : 0;
        score = sum * 0.7 + popularityScore * 0.2 + reviewScore * 0.1;
      } else {
        const selectedSet = new Set(legacyTagKeys);
        const hasTags = selectedSet.size > 0;
        const matchedTags = w.workTags.filter(wt => selectedSet.has(wt.tagKey));
        const matchScore = hasTags ? matchedTags.length / selectedSet.size : 1;
        const popularityScore = Math.min(1, (w.popularityBase ?? 0) / 50);
        const reviewScore = w.reviewAverage ? w.reviewAverage / 5 : 0;
        score = hasTags
          ? matchScore * 0.6 + popularityScore * 0.25 + reviewScore * 0.15
          : popularityScore * 0.6 + reviewScore * 0.4;
      }

      const matchedTagCount = useNewScoring
        ? w.workTags.filter(wt => allSelectedSet.has(normalizeTagKey(wt.tagKey))).length
        : w.workTags.filter(wt => legacyTagKeys.includes(wt.tagKey)).length;
      const totalSelected = useNewScoring ? allSelectedSet.size : legacyTagKeys.length;
      const matchRate = totalSelected > 0 ? Math.min(100, Math.round((matchedTagCount / totalSelected) * 100)) : 100;

      return {
        workId: w.workId,
        ...
        matchRate,
        score,
      };
    });
*/
