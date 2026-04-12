import json, collections

with open(r'c:\tool\eronator_mvp0_ws_v1_5_3\data\simulation-results\sim-2026-04-12T08-35-12.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
results = data['results']

print("=== A. HIGH CONFIDENCE FAILURES (conf > 0.5 but failed) ===")
high_conf_fails = []
for r in results:
    if r['success']:
        continue
    max_conf = 0
    max_conf_step = None
    for s in r['steps']:
        if s.get('confidenceAfter', 0) > max_conf:
            max_conf = s['confidenceAfter']
            max_conf_step = s
    if max_conf > 0.5:
        high_conf_fails.append((r, max_conf, max_conf_step))

print(f"  Count: {len(high_conf_fails)} / {sum(1 for r in results if not r['success'])} failures")

drop_patterns = []
for r, mc, _ in high_conf_fails[:50]:
    steps = r['steps']
    confs = [(s['qIndex'], s.get('confidenceAfter', 0)) for s in steps]
    peak_idx = max(range(len(confs)), key=lambda i: confs[i][1])
    peak_q = confs[peak_idx][0]
    peak_conf = confs[peak_idx][1]
    final_conf = confs[-1][1]
    top1_correct = any(s.get('top1WorkId','').replace('cid:','') == r['workId'].replace('cid:','') for s in steps)
    drop_patterns.append({
        'title': r['title'][:30],
        'peak_q': peak_q,
        'peak_conf': peak_conf,
        'final_conf': final_conf,
        'outcome': r['outcome'],
        'top1_ever_correct': top1_correct,
        'total_qs': r['questionCount']
    })

for dp in drop_patterns[:20]:
    print(f"  [{dp['outcome']}] peak=Q{dp['peak_q']}({dp['peak_conf']:.3f}) final={dp['final_conf']:.3f} top1correct={dp['top1_ever_correct']} qs={dp['total_qs']}")

ever_top1 = sum(1 for r, mc, _ in high_conf_fails
    if any(s.get('top1WorkId','').replace('cid:','') == r['workId'].replace('cid:','') for s in r['steps']))
print(f"\n  High-conf fails where correct was ever top1: {ever_top1}/{len(high_conf_fails)}")

print(f"\n=== B. TAG EFFECTIVENESS FOR FAILURES ===")
fail_explore_with_coverage = 0
fail_explore_total = 0
for r in results:
    if r['success']:
        continue
    for s in r['steps']:
        q = s.get('question', {})
        if q and q.get('kind') == 'EXPLORE_TAG':
            fail_explore_total += 1
            if s.get('tagCoverage', 0) > 0:
                fail_explore_with_coverage += 1
print(f"  EXPLORE_TAG in failures: {fail_explore_total}")
if fail_explore_total > 0:
    print(f"  With tagCoverage > 0: {fail_explore_with_coverage} ({fail_explore_with_coverage/fail_explore_total*100:.1f}%)")
else:
    print(f"  With tagCoverage > 0: {fail_explore_with_coverage} (N/A)")

print(f"\n=== C. EFFECTIVE CANDIDATES TRAJECTORY ===")
eff_cand_success = collections.defaultdict(list)
eff_cand_fail = collections.defaultdict(list)
for r in results:
    for s in r['steps']:
        ee = s.get('earlyExit', {})
        if ee and 'effectiveCandidates' in ee:
            qi = s['qIndex']
            if r['success']:
                eff_cand_success[qi].append(ee['effectiveCandidates'])
            else:
                eff_cand_fail[qi].append(ee['effectiveCandidates'])

print("  Q  | Success eff.cand | Fail eff.cand")
for qi in range(1, 36):
    s_vals = eff_cand_success.get(qi, [])
    f_vals = eff_cand_fail.get(qi, [])
    s_avg = sum(s_vals)/len(s_vals) if s_vals else 0
    f_avg = sum(f_vals)/len(f_vals) if f_vals else 0
    print(f"  Q{qi:2d}: {s_avg:8.1f} (n={len(s_vals):3d}) | {f_avg:8.1f} (n={len(f_vals):3d})")

print(f"\n=== D. FAIL_LIST vs MAX_QUESTIONS ===")
for ot in ['FAIL_LIST', 'MAX_QUESTIONS']:
    subset = [r for r in results if r['outcome'] == ot]
    if not subset:
        continue
    print(f"\n  {ot} (n={len(subset)}):")
    avg_qs = sum(r['questionCount'] for r in subset) / len(subset)
    print(f"    Avg questions: {avg_qs:.1f}")
    max_confs = [max(s.get('confidenceAfter', 0) for s in r['steps']) for r in subset]
    print(f"    Max confidence avg: {sum(max_confs)/len(max_confs):.4f}")
    for t in [0.3, 0.5, 0.7, 0.9]:
        c = sum(1 for mc in max_confs if mc > t)
        print(f"    Max conf > {t}: {c} ({c/len(subset)*100:.1f}%)")
    kinds = collections.Counter()
    for r in subset:
        for s in r['steps']:
            q = s.get('question', {})
            if q:
                kinds[q.get('kind', '')] += 1
    total_k = sum(kinds.values())
    print(f"    Kinds:")
    for k, v in kinds.most_common():
        print(f"      {k}: {v} ({v/total_k*100:.1f}%)")

print(f"\n=== E. NOISE IMPACT ===")
noise_success = []
noise_fail = []
for r in results:
    noise = sum(1 for s in r['steps'] if s.get('wasNoisy'))
    if r['success']:
        noise_success.append(noise)
    else:
        noise_fail.append(noise)
print(f"  Noise/trial (success): avg={sum(noise_success)/len(noise_success):.2f}")
print(f"  Noise/trial (fail): avg={sum(noise_fail)/len(noise_fail):.2f}")

drops_after_noise = 0
total_noisy_in_fail = 0
for r in results:
    if r['success']:
        continue
    for s in r['steps']:
        if s.get('wasNoisy'):
            total_noisy_in_fail += 1
            if s.get('confidenceAfter', 0) < s.get('confidenceBefore', 0):
                drops_after_noise += 1
if total_noisy_in_fail > 0:
    print(f"  Conf drops after noisy: {drops_after_noise}/{total_noisy_in_fail} ({drops_after_noise/total_noisy_in_fail*100:.1f}%)")

print(f"\n=== F. LOW-CONF FAILURES (max conf < 0.1) ===")
low_conf_fails = []
for r in results:
    if r['success']:
        continue
    max_conf = max(s.get('confidenceAfter', 0) for s in r['steps'])
    if max_conf < 0.1:
        low_conf_fails.append((r, max_conf))
print(f"  Never-above-10pct failures: {len(low_conf_fails)}")
for r, mc in low_conf_fails[:5]:
    print(f"\n  Title: {r['title'][:50]}")
    print(f"  Outcome: {r['outcome']}, Qs: {r['questionCount']}, MaxConf: {mc:.4f}")
    kinds = [s['question']['kind'] for s in r['steps'] if s.get('question')]
    print(f"  Flow: {' -> '.join(kinds[:15])}")

print(f"\n=== G. SOFT CONFIRM IN FAILURES ===")
sc_fail_data = []
for r in results:
    if r['success']:
        continue
    sc_count = sum(1 for s in r['steps'] if s.get('question',{}).get('kind') == 'SOFT_CONFIRM')
    sc_fail_data.append(sc_count)
print(f"  Avg SOFT_CONFIRM per failed trial: {sum(sc_fail_data)/len(sc_fail_data):.1f}")
print(f"  Failed trials with 0 SOFT_CONFIRM: {sum(1 for c in sc_fail_data if c == 0)}")
print(f"  Failed trials with 5+ SOFT_CONFIRM: {sum(1 for c in sc_fail_data if c >= 5)}")
print(f"  Failed trials with 10+ SOFT_CONFIRM: {sum(1 for c in sc_fail_data if c >= 10)}")

print(f"\n=== H. WAS CORRECT WORK EVER TOP-1? ===")
ever_top1_success = 0
ever_top1_fail = 0
never_top1_fail = 0
for r in results:
    was_top1 = any(s.get('top1WorkId','').replace('cid:','') == r['workId'].replace('cid:','') for s in r['steps'])
    if r['success']:
        if was_top1:
            ever_top1_success += 1
    else:
        if was_top1:
            ever_top1_fail += 1
        else:
            never_top1_fail += 1
print(f"  Success & ever top1: {ever_top1_success}/{sum(1 for r in results if r['success'])}")
print(f"  Fail & ever top1: {ever_top1_fail}/{sum(1 for r in results if not r['success'])}")
print(f"  Fail & NEVER top1: {never_top1_fail}/{sum(1 for r in results if not r['success'])}")
