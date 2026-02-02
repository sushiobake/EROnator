# Cursor ショートカット設定手順

## npm run dev を Ctrl+Shift+D で実行する設定

### 手順

1. **Cursorでキーバインド設定を開く**
   - `Ctrl+Shift+P` を押す
   - 「Preferences: Open Keyboard Shortcuts (JSON)」と入力して選択
   - または、`Ctrl+K Ctrl+S` でキーボードショートカット設定を開き、右上の「Open Keyboard Shortcuts (JSON)」をクリック

2. **以下の設定を追加**
   
   開いたJSONファイルに、以下の設定を追加してください：

   ```json
   [
     {
       "key": "ctrl+shift+d",
       "command": "workbench.action.terminal.sendSequence",
       "args": {
         "text": "npm run dev\r"
       }
     }
   ]
   ```

   **注意**: 既に他のキーバインドがある場合は、配列の中に追加してください。

3. **ファイルを保存**
   - `Ctrl+S` で保存

4. **動作確認**
   - ターミナルを開く（`Ctrl+Shift+` ` または `Ctrl+J`）
   - `Ctrl+Shift+D` を押す
   - ターミナルに `npm run dev` が入力され、自動実行されることを確認

### トラブルシューティング

- **キーバインドが効かない場合**
  - Cursorを再起動してみてください
  - 他の拡張機能や設定で `Ctrl+Shift+D` が既に使われている可能性があります
  - 別のキー（例: `Ctrl+Shift+N`）に変更してみてください

- **ターミナルが開かない場合**
  - 手動でターミナルを開いてから `Ctrl+Shift+D` を押してください
  - または、以下の設定でターミナルを自動で開くようにできます：

  ```json
  [
    {
      "key": "ctrl+shift+d",
      "command": "workbench.action.terminal.focus",
      "when": "!terminalFocus"
    },
    {
      "key": "ctrl+shift+d",
      "command": "workbench.action.terminal.sendSequence",
      "args": {
        "text": "npm run dev\r"
      },
      "when": "terminalFocus"
    }
  ]
  ```

### 代替方法

キーバインドが設定できない場合は、以下の方法も使えます：

1. **コマンドパレットから実行**
   - `Ctrl+Shift+P` → 「Tasks: Run Task」→ 「npm: dev」

2. **ターミナルから直接実行**
   - ターミナルで `npm run dev` と入力
