# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(__file__).resolve().parent.parent / "src" / "app" / "admin" / "tags" / "tabs" / "TitleReadingInitialTab.tsx"
text = path.read_text(encoding="utf-8")

anchor_state = "  const editContainerRef = useRef<HTMLDivElement>(null);\n"
insert_state = """  const editContainerRef = useRef<HTMLDivElement>(null);
  const [bulkAllRunning, setBulkAllRunning] = useState(false);
  const [bulkAllMessage, setBulkAllMessage] = useState<string | null>(null);
"""
if insert_state in text:
    print("state already applied")
elif anchor_state not in text:
    raise SystemExit("anchor_state not found")
else:
    text = text.replace(anchor_state, insert_state, 1)

anchor_return = """  };

  return (
    <section style={{ marginBottom: '0.75rem' }}>
      <h2 style={{ marginBottom: '0.35rem', fontSize: '1.1rem', fontWeight: 600 }}>作品頭文字</h2>"""

handler = """  };

  const handleBulkAllUnconfirmed = async () => {
    if (!adminToken || bulkAllRunning) return;
    setBulkAllRunning(true);
    setBulkAllMessage(null);
    setAutoMarkByWorkId(null);
    let cursor: string | null = null;
    let sumUpdated = 0;
    let sumConfirmed = 0;
    let sumSkipped = 0;
    let sumLow = 0;
    let batches = 0;
    try {
      for (;;) {
        const res = await fetch('/api/admin/title-reading-initial/auto/bulk-unconfirmed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-eronator-admin-token': adminToken,
          },
          body: JSON.stringify({ cursor: cursor ?? undefined, confirmNonRed: true }),
        });
        const data = await res.json();
        if (!data.success) {
          setBulkAllMessage(typeof data.error === 'string' ? data.error : '一括自動判定に失敗しました');
          break;
        }
        batches += 1;
        sumUpdated += data.updated ?? 0;
        sumConfirmed += data.confirmed ?? 0;
        sumSkipped += data.skipped ?? 0;
        sumLow += data.lowOnly ?? 0;
        setBulkAllMessage(
          `一括進行中… バッチ${batches}（当バッチ: 更新${data.updated ?? 0}・確認済み化${data.confirmed ?? 0}・候補のみ${data.lowOnly ?? 0}・スキップ${data.skipped ?? 0} / 累計更新${sumUpdated}）`
        );
        if (data.done) {
          setBulkAllMessage(
            `一括完了。DB更新${sumUpdated}件（うち確認済み化${sumConfirmed}件）。候補のみ（赤）${sumLow}件、スキップ（赤）${sumSkipped}件は未確認のまま残しています。`
          );
          break;
        }
        const next = typeof data.nextCursor === 'string' ? data.nextCursor : null;
        if (!next) {
          setBulkAllMessage(`一括完了。DB更新${sumUpdated}件。`);
          break;
        }
        cursor = next;
      }
      void fetchWorks();
    } catch (e) {
      console.error(e);
      setBulkAllMessage('一括自動判定に失敗しました');
    } finally {
      setBulkAllRunning(false);
    }
  };

  return (
    <section style={{ marginBottom: '0.75rem' }}>
      <h2 style={{ marginBottom: '0.35rem', fontSize: '1.1rem', fontWeight: 600 }}>作品頭文字</h2>"""

if "handleBulkAllUnconfirmed" in text:
    print("handler already applied")
elif anchor_return not in text:
    raise SystemExit("anchor_return not found")
else:
    text = text.replace(anchor_return, handler, 1)

btn_anchor = """        >
          {confirming ? '処理中...' : `この${works.length}件をまとめて確認済み`}
        </button>
      </div>
      {autoFillMessage && ("""

btn_insert = """        >
          {confirming ? '処理中...' : `この${works.length}件をまとめて確認済み`}
        </button>
        <button
          type="button"
          onClick={() => void handleBulkAllUnconfirmed()}
          disabled={
            !adminToken ||
            bulkAllRunning ||
            loading ||
            autoFilling ||
            confirming ||
            revertingAuto
          }
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.9rem',
            backgroundColor:
              !adminToken || bulkAllRunning || loading || autoFilling || confirming || revertingAuto
                ? '#ccc'
                : '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor:
              !adminToken || bulkAllRunning || loading || autoFilling || confirming || revertingAuto
                ? 'not-allowed'
                : 'pointer',
          }}
        >
          {bulkAllRunning
            ? '一括自動判定中…'
            : '未確認（漢字）をすべて自動判定（赤以外は確認済み）'}
        </button>
      </div>
      {autoFillMessage && ("""

if "未確認（漢字）をすべて自動判定" in text:
    print("button already applied")
elif btn_anchor not in text:
    raise SystemExit("btn_anchor not found")
else:
    text = text.replace(btn_anchor, btn_insert, 1)

msg_anchor = """      {autoFillMessage && (
        <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.85rem', color: '#333' }}>{autoFillMessage}</p>
      )}

      {!adminToken ? ("""

msg_insert = """      {autoFillMessage && (
        <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.85rem', color: '#333' }}>{autoFillMessage}</p>
      )}
      {bulkAllMessage && (
        <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.85rem', color: '#4c1d95' }}>{bulkAllMessage}</p>
      )}

      {!adminToken ? ("""

if "bulkAllMessage" in text and "{bulkAllMessage &&" in text:
    print("bulk message already applied")
elif msg_anchor not in text:
    raise SystemExit("msg_anchor not found")
else:
    text = text.replace(msg_anchor, msg_insert, 1)

memo_add = (
    "        先頭が<strong>括弧</strong>（【】『』「」・丸括弧・角括弧・山括弧 等、正規化で先頭から外すのと同じ種類）のとき、内側をサブ頭文字（カンマの2番目）として推定します。\n"
    "      </p>"
)
memo_new = (
    "        先頭が<strong>括弧</strong>（【】『』「」・丸括弧・角括弧・山括弧 等、正規化で先頭から外すのと同じ種類）のとき、内側をサブ頭文字（カンマの2番目）として推定します。\n"
    "        <strong>一括ボタン</strong>は DB 上の未確認かつ漢字始まりの<strong>全件</strong>を workId 順に走査します（数万件でもクライアントがバッチを連続 POST）。反映できた行は確認済みにし、候補のみ・スキップ（赤）は未確認のまま残します。\n"
    "      </p>"
)
if memo_new.split("\n")[2] in text:
    print("memo already applied")
elif memo_add not in text:
    raise SystemExit("memo_add not found")
else:
    text = text.replace(memo_add, memo_new, 1)

path.write_text(text, encoding="utf-8")
print("ok", path)
