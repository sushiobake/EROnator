# .env.localファイルの文字エンコーディングをUTF-8（BOMなし）に修正するスクリプト

$envFile = ".env.local"

if (Test-Path $envFile) {
    Write-Host "現在の.env.localファイルを読み込み中..."
    
    # 現在の内容を読み込み（Shift-JISやANSIでも読み込めるように）
    $content = Get-Content $envFile -Raw -Encoding Default
    
    # UTF-8（BOMなし）で保存
    [System.IO.File]::WriteAllText(
        (Resolve-Path $envFile).Path,
        $content,
        [System.Text.UTF8Encoding]::new($false)
    )
    
    Write-Host "✓ .env.localファイルをUTF-8（BOMなし）で保存しました"
} else {
    Write-Host "✗ .env.localファイルが見つかりません"
}
