# 今後進めること（ロードマップ・メモ）

このファイルは「エロネイター次の一手」の集約メモです。詳細手順はリンク先ドキュメントを参照してください。

## 前提（ブレない軸）

- **サービス定義:** 同人誌版アキネイター。主役は「思い浮かべた作品を当てる」体験。推薦・購入・SNSは付図。
- **目標の流れ:** プレイ（成功/失敗）→ 繰り返し／推薦 → X 等でネタ化 → おすすめ購入。
- **拡散の核:** 「当てられた／当てられなかった」の驚き・悔しさがコンテンツ。
- **宣伝:** 有名帯で当たる体験が証明できてから本格拡散が安全。

## 優先度一覧

| 星 | 内容 | 詳細ドキュメント / 実装 |
|---|------|-------------------------|
| ★★★ | 有名作品帯の正解率・体感検証 | [VERIFY-top100-hit-rate.md](./VERIFY-top100-hit-rate.md) |
| ★★★ | Reveal→Success のタメ・演出 | `NEXT_PUBLIC_REVEAL_SUCCESS_BUILDUP_MS`（[page.tsx](../src/app/page.tsx)） |
| ★★☆ | 結果画面のシェア位置・文言 | [Success.tsx](../src/app/components/Success.tsx)、[api/og](../src/app/api/og/route.tsx) |
| ★★☆ | 失敗リストのシェア向けコピー | [FailList.tsx](../src/app/components/FailList.tsx)、`result=miss` の OG |
| ★★☆ | X 小規模テスト配信 | [X-smoke-test-procedure.md](./X-smoke-test-procedure.md) |
| ★★☆ | 全体コピー・位置・スマホチェック | [CHECKLIST-copy-layout-mobile.md](./CHECKLIST-copy-layout-mobile.md)（担当: オーナー） |
| ★☆☆ | 推薦・購買導線の改善 | [BACKLOG-recommend-purchase-and-untagged.md](./BACKLOG-recommend-purchase-and-untagged.md) |
| ★☆☆ | 未タグ約3万件の消化 | 上記バックログと同ファイル |

## 参照

- 会話での方針: アキネイター主役／精度と驚きが拡散の核／診断タイプのメイン化はしない。
