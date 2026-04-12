import json, collections

files = {
    'file1_famous': r'c:\tool\eronator_mvp0_ws_v1_5_3\data\simulation-results\sim-2026-04-11T12-00-49.json',
    'file2_mid': r'c:\tool\eronator_mvp0_ws_v1_5_3\data\simulation-results\sim-2026-04-12T08-22-29.json',
    'file3_unknown': r'c:\tool\eronator_mvp0_ws_v1_5_3\data\simulation-results\sim-2026-04-12T08-35-12.json',
}

for label, path in files.items():
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    results = data['results']
    
    print(f"\n{'='*60}")
    print(f"=== {label} (n={len(results)}) ===")
    print(f"{'='*60}")
    
    has_ended_by = sum(1 for r in results if 'endedBy' in r)
    print(f"  Results with 'endedBy' field: {has_ended_by}")
    
    if has_ended_by > 0:
        ended_by_dist = collections.Counter(r.get('endedBy') for r in results)
        print(f"  endedBy distribution:")
        for k, v in ended_by_dist.most_common():
            print(f"    {k}: {v}")
    
    print(f"\n  Top-level keys in first result: {list(results[0].keys())}")
    
    for key in ['ambiguityLevel', 'noiseRate', 'config', 'params', 'settings']:
        if key in data:
            val = data[key]
            if isinstance(val, dict):
                print(f"  data['{key}']: {json.dumps(val, indent=2)[:500]}")
            else:
                print(f"  data['{key}']: {val}")
    
    amb_levels = set()
    for r in results:
        if 'ambiguityLevel' in r:
            amb_levels.add(r['ambiguityLevel'])
    if amb_levels:
        print(f"  ambiguityLevel values: {amb_levels}")
    
    print(f"\n  --- EARLY EXIT DEEP ANALYSIS ---")
    for review_q in [25, 30, 35]:
        confs_at_review = []
        eff_cands_at_review = []
        would_exit = 0
        match_low_conf = 0
        match_wide_cand = 0
        total_at_review = 0
        
        for r in results:
            for s in r['steps']:
                ee = s.get('earlyExit', {})
                if ee and ee.get('isReviewPoint') and ee.get('questionCountAfterAnswer') == review_q:
                    total_at_review += 1
                    confs_at_review.append(ee.get('confidence', 0))
                    eff_cands_at_review.append(ee.get('effectiveCandidates', 0))
                    if ee.get('wouldEarlyExit'):
                        would_exit += 1
                    if ee.get('matchLowConfidence'):
                        match_low_conf += 1
                    if ee.get('matchWideCandidates'):
                        match_wide_cand += 1
        
        if total_at_review > 0:
            avg_conf = sum(confs_at_review)/len(confs_at_review)
            avg_eff = sum(eff_cands_at_review)/len(eff_cands_at_review)
            print(f"\n  Q{review_q} review (n={total_at_review}):")
            print(f"    Avg confidence: {avg_conf:.4f}")
            print(f"    Avg effectiveCandidates: {avg_eff:.1f}")
            pct1 = match_low_conf/total_at_review*100
            pct2 = match_wide_cand/total_at_review*100
            pct3 = would_exit/total_at_review*100
            print(f"    matchLowConfidence: {match_low_conf} ({pct1:.1f}%)")
            print(f"    matchWideCandidates: {match_wide_cand} ({pct2:.1f}%)")
            print(f"    wouldEarlyExit (BOTH): {would_exit} ({pct3:.1f}%)")
            
            thresholds = {
                25: {'minConf': 0.04, 'maxEC': 90},
                30: {'minConf': 0.06, 'maxEC': 60},
                35: {'minConf': 0.08, 'maxEC': 35},
            }
            t = thresholds[review_q]
            below_conf = sum(1 for c in confs_at_review if c < t['minConf'])
            above_ec = sum(1 for c in eff_cands_at_review if c > t['maxEC'])
            pct4 = below_conf/total_at_review*100
            pct5 = above_ec/total_at_review*100
            print(f"    Config threshold: conf < {t['minConf']}, eff.cand > {t['maxEC']}")
            print(f"    conf < {t['minConf']}: {below_conf} ({pct4:.1f}%)")
            print(f"    eff.cand > {t['maxEC']}: {above_ec} ({pct5:.1f}%)")

    print(f"\n  --- POPULARITY QUESTION ---")
    pop_questions = 0
    pop_answers = collections.Counter()
    conf_change_after_pop = []
    for r in results:
        for s in r['steps']:
            q = s.get('question', {})
            if q and q.get('specialQuestionType') == 'POPULARITY':
                pop_questions += 1
                pop_answers[s.get('answer')] += 1
                change = s.get('confidenceAfter', 0) - s.get('confidenceBefore', 0)
                conf_change_after_pop.append(change)
    
    print(f"    POPULARITY questions total: {pop_questions}")
    for ans, cnt in pop_answers.most_common():
        print(f"      Answer '{ans}': {cnt}")
    if conf_change_after_pop:
        print(f"    Avg confidence change: {sum(conf_change_after_pop)/len(conf_change_after_pop):.6f}")

    print(f"\n  --- REVEAL THRESHOLD CHECK AT REVIEW POINTS ---")
    for review_q in [25, 30, 35]:
        rt = 0.5 if review_q <= 25 else 0.4
        above_rt = 0
        total = 0
        for r in results:
            if not r['success']:
                for s in r['steps']:
                    ee = s.get('earlyExit', {})
                    if ee and ee.get('isReviewPoint') and ee.get('questionCountAfterAnswer') == review_q:
                        total += 1
                        if ee.get('confidence', 0) >= rt:
                            above_rt += 1
        if total > 0:
            print(f"    Q{review_q} (fails only): {above_rt}/{total} above revealThreshold {rt} -> would SKIP earlyExit check")
