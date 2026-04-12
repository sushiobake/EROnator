import json, collections

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
    print(f"=== {label} ===")
    print(f"{'='*60}")
    
    print(f"\n  --- TAME (SOFT_CONFIRM with YES near end) ---")
    
    success_trials = [r for r in results if r['success']]
    tame_count = 0
    tame_at_various_distances = collections.Counter()
    
    for r in success_trials:
        total_qs = r['questionCount']
        for s in r['steps']:
            q = s.get('question', {})
            if q and q.get('kind') == 'SOFT_CONFIRM' and s.get('answer') == 'YES':
                distance_from_end = total_qs - s['qIndex']
                if distance_from_end <= 5:
                    tame_count += 1
                    tame_at_various_distances[distance_from_end] += 1
    
    pct = tame_count / len(success_trials) * 100 if success_trials else 0
    print(f"    Success trials: {len(success_trials)}")
    print(f"    Trials with TAME (SC+YES within last 5 Qs): {tame_count} ({pct:.1f}%)")
    print(f"    Distance from end distribution:")
    for d in range(0, 6):
        print(f"      {d} questions before end: {tame_at_various_distances.get(d, 0)}")
    
    sc_yes_total = 0
    sc_no_total = 0
    sc_unknown_total = 0
    for r in success_trials:
        for s in r['steps']:
            q = s.get('question', {})
            if q and q.get('kind') == 'SOFT_CONFIRM':
                if s.get('answer') == 'YES':
                    sc_yes_total += 1
                elif s.get('answer') == 'NO':
                    sc_no_total += 1
                else:
                    sc_unknown_total += 1
    print(f"\n    All SOFT_CONFIRM answers in success: YES={sc_yes_total}, NO={sc_no_total}, UNKNOWN={sc_unknown_total}")
    
    print(f"\n  --- HARD CONFIRM DETAILS ---")
    hc_yes_then_reveal = 0
    hc_yes_total = 0
    hc_yes_then_no_reveal = 0
    for r in results:
        steps = r['steps']
        for i, s in enumerate(steps):
            q = s.get('question', {})
            if q and q.get('kind') == 'HARD_CONFIRM' and s.get('answer') == 'YES':
                hc_yes_total += 1
                if i + 1 < len(steps):
                    next_q = steps[i+1].get('question', {})
                    if next_q and next_q.get('kind') == 'REVEAL':
                        hc_yes_then_reveal += 1
                    else:
                        hc_yes_then_no_reveal += 1
                        if hc_yes_then_no_reveal <= 3:
                            print(f"    HC+YES but no REVEAL next: {next_q.get('kind')} (conf={s.get('confidenceAfter',0):.3f})")
    
    print(f"    HC with YES answer: {hc_yes_total}")
    print(f"    HC+YES -> REVEAL next: {hc_yes_then_reveal}")
    print(f"    HC+YES -> NOT REVEAL next: {hc_yes_then_no_reveal}")
    
    print(f"\n  --- POPULARITY Q IMPACT ON EFFECTIVE CANDIDATES ---")
    for r in results[:200]:
        for i, s in enumerate(r['steps']):
            q = s.get('question', {})
            if q and q.get('specialQuestionType') == 'POPULARITY':
                ec_before = r['steps'][i-1].get('earlyExit', {}).get('effectiveCandidates', 0) if i > 0 else 0
                ec_after = s.get('earlyExit', {}).get('effectiveCandidates', 0) if s.get('earlyExit') else 0
                if ec_before > 0 and ec_after > 0:
                    change = ec_after - ec_before
                    if abs(change) > 100:
                        pass
                break
    
    ec_befores = []
    ec_afters = []
    for r in results:
        for i, s in enumerate(r['steps']):
            q = s.get('question', {})
            if q and q.get('specialQuestionType') == 'POPULARITY':
                if i > 0:
                    prev_ec = r['steps'][i-1].get('earlyExit', {}).get('effectiveCandidates', 0)
                    curr_ec = s.get('earlyExit', {}).get('effectiveCandidates', 0) if s.get('earlyExit') else 0
                    if prev_ec > 0:
                        ec_befores.append(prev_ec)
                    if curr_ec > 0:
                        ec_afters.append(curr_ec)
                break
    
    if ec_befores and ec_afters:
        print(f"    Avg eff.cand BEFORE POPULARITY: {sum(ec_befores)/len(ec_befores):.1f}")
        print(f"    Avg eff.cand AFTER POPULARITY: {sum(ec_afters)/len(ec_afters):.1f}")
    
    if label == 'unknown':
        print(f"\n  --- TAG UNIQUENESS (unknown only) ---")
        top1_at_q20_success = collections.Counter()
        top1_at_q20_fail = collections.Counter()
        for r in results:
            for s in r['steps']:
                if s['qIndex'] == 20:
                    wid = s.get('top1WorkId', '')
                    if r['success']:
                        top1_at_q20_success[wid] += 1
                    else:
                        top1_at_q20_fail[wid] += 1
                    break
        
        print(f"    Unique top-1 works at Q20 (success): {len(top1_at_q20_success)}")
        print(f"    Unique top-1 works at Q20 (fail): {len(top1_at_q20_fail)}")
        print(f"    Top 10 most common top-1 at Q20 (fail):")
        for wid, cnt in top1_at_q20_fail.most_common(10):
            print(f"      {wid}: {cnt} times")
        
        shared_top1 = sum(cnt for cnt in top1_at_q20_fail.values() if cnt > 1)
        print(f"    Failed trials sharing top-1 with another: {shared_top1}/{sum(top1_at_q20_fail.values())}")
