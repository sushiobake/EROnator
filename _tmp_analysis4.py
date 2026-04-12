import json, collections, math

files = {
    'famous': r'c:\tool\eronator_mvp0_ws_v1_5_3\data\simulation-results\sim-2026-04-11T12-00-49.json',
    'mid': r'c:\tool\eronator_mvp0_ws_v1_5_3\data\simulation-results\sim-2026-04-12T08-22-29.json',
    'unknown': r'c:\tool\eronator_mvp0_ws_v1_5_3\data\simulation-results\sim-2026-04-12T08-35-12.json',
}

for label, path in files.items():
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    results = data['results']
    
    print(f"\n{'='*60}")
    print(f"=== {label} (n={len(results)}, success={sum(1 for r in results if r['success'])}) ===")
    print(f"{'='*60}")
    
    print(f"\n  --- A. YES ANSWERS (tag matches) per trial ---")
    yes_counts_success = []
    yes_counts_fail = []
    no_counts_success = []
    no_counts_fail = []
    for r in results:
        yes_count = 0
        no_count = 0
        for s in r['steps']:
            q = s.get('question', {})
            if q and q.get('kind') == 'EXPLORE_TAG':
                base_answer = s.get('answer')
                if not s.get('wasNoisy'):
                    if base_answer == 'YES':
                        yes_count += 1
                    elif base_answer == 'NO':
                        no_count += 1
        if r['success']:
            yes_counts_success.append(yes_count)
            no_counts_success.append(no_count)
        else:
            yes_counts_fail.append(yes_count)
            no_counts_fail.append(no_count)
    
    if yes_counts_success:
        print(f"    Success: avg YES={sum(yes_counts_success)/len(yes_counts_success):.1f}, avg NO={sum(no_counts_success)/len(no_counts_success):.1f}")
    if yes_counts_fail:
        print(f"    Fail:    avg YES={sum(yes_counts_fail)/len(yes_counts_fail):.1f}, avg NO={sum(no_counts_fail)/len(no_counts_fail):.1f}")

    print(f"\n  --- B. When correct work first becomes top-1 ---")
    first_top1_q = []
    never_top1 = 0
    for r in results:
        found = False
        for s in r['steps']:
            top1 = s.get('top1WorkId', '').replace('cid:', '')
            target = r['workId'].replace('cid:', '')
            if top1 == target:
                first_top1_q.append(s['qIndex'])
                found = True
                break
        if not found:
            never_top1 += 1
    
    if first_top1_q:
        print(f"    Enters top-1: avg Q{sum(first_top1_q)/len(first_top1_q):.1f} (n={len(first_top1_q)})")
        for threshold in [5, 10, 15, 20, 25]:
            c = sum(1 for q in first_top1_q if q <= threshold)
            print(f"      By Q{threshold}: {c} ({c/len(results)*100:.1f}%)")
    print(f"    Never top-1: {never_top1} ({never_top1/len(results)*100:.1f}%)")

    print(f"\n  --- D. REVEAL MISS ANALYSIS ---")
    reveal_counts = collections.Counter()
    reveal_miss_counts = collections.Counter()
    for r in results:
        reveals = 0
        misses = 0
        for s in r['steps']:
            q = s.get('question', {})
            if q and q.get('kind') == 'REVEAL':
                reveals += 1
                if s.get('answer') != 'CORRECT' and s.get('revealResult') != 'SUCCESS':
                    misses += 1
        reveal_counts[reveals] += 1
        if not r['success']:
            reveal_miss_counts[misses] += 1
    
    print(f"    REVEAL attempts per trial: {dict(sorted(reveal_counts.items()))}")
    print(f"    REVEAL misses per FAILED trial: {dict(sorted(reveal_miss_counts.items()))}")

    print(f"\n  --- E. NOISE-FREE TRIALS ---")
    noise_free_success = 0
    noise_free_fail = 0
    noise_free_total = 0
    for r in results:
        has_noise = any(s.get('wasNoisy') for s in r['steps'])
        if not has_noise:
            noise_free_total += 1
            if r['success']:
                noise_free_success += 1
            else:
                noise_free_fail += 1
    
    if noise_free_total > 0:
        print(f"    Noise-free trials: {noise_free_total}")
        print(f"    Noise-free success rate: {noise_free_success}/{noise_free_total} ({noise_free_success/noise_free_total*100:.1f}%)")
    else:
        print(f"    No completely noise-free trials found")
    
    print(f"\n    By ambiguity level:")
    by_amb = collections.defaultdict(lambda: {'total': 0, 'success': 0})
    for r in results:
        amb = r.get('ambiguityLevel', 'unknown')
        by_amb[amb]['total'] += 1
        if r['success']:
            by_amb[amb]['success'] += 1
    
    for amb in sorted(by_amb.keys()):
        d = by_amb[amb]
        rate = d['success'] / d['total'] * 100 if d['total'] > 0 else 0
        print(f"      ambiguity={amb}: {d['success']}/{d['total']} ({rate:.1f}%)")

    print(f"\n  --- F. EXPLORE_TAG YES RATIO (tag distinctiveness) ---")
    yes_ratios_success = []
    yes_ratios_fail = []
    for r in results:
        explore_count = 0
        yes_count = 0
        for s in r['steps']:
            q = s.get('question', {})
            if q and q.get('kind') == 'EXPLORE_TAG' and not s.get('wasNoisy'):
                explore_count += 1
                if s.get('answer') == 'YES':
                    yes_count += 1
        if explore_count > 0:
            ratio = yes_count / explore_count
            if r['success']:
                yes_ratios_success.append(ratio)
            else:
                yes_ratios_fail.append(ratio)
    
    if yes_ratios_success:
        print(f"    Success: avg YES ratio={sum(yes_ratios_success)/len(yes_ratios_success):.3f}")
    if yes_ratios_fail:
        print(f"    Fail:    avg YES ratio={sum(yes_ratios_fail)/len(yes_ratios_fail):.3f}")

    print(f"\n  --- G. SPECIAL QUESTION TYPES ---")
    sp_types = collections.Counter()
    sp_yes = collections.Counter()
    for r in results:
        for s in r['steps']:
            q = s.get('question', {})
            if q and q.get('kind') == 'SPECIAL_QUESTION':
                spt = q.get('specialQuestionType', 'unknown')
                sp_types[spt] += 1
                if s.get('answer') == 'YES':
                    sp_yes[spt] += 1
    
    for spt, cnt in sp_types.most_common():
        yes = sp_yes.get(spt, 0)
        print(f"    {spt}: {cnt} (YES={yes}, {yes/cnt*100:.1f}%)")