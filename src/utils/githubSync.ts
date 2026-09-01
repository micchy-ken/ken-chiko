import { GameSaveData } from '../types';

export function generateGitHubWorkflowYaml(): string {
  return `name: Sync Ken-Chiko Pet State and Nyans Data

on:
  push:
    branches: [ main, master ]
  schedule:
    # Run every Sunday midnight for weekly sync
    - cron: '0 0 * * 0'
  workflow_dispatch:

jobs:
  sync-data:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Validate Nyans CSV & State
        run: |
          echo "Checking data/nyans.csv and pet-state.json..."
          if [ -f "data/nyans.csv" ]; then
            echo "Found $(wc -l < data/nyans.csv) character definitions."
          fi

      - name: Auto-commit latest pet state and zukan updates
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore(data): auto-sync ken-chiko pet state & nyans catalog [skip ci]"
          file_pattern: "data/*.json data/*.csv data/*.yml"
`;
}

export function formatDataForGitHub(saveData: GameSaveData): {
  petStateJson: string;
  workflowYaml: string;
  readmeMd: string;
} {
  const petStateJson = JSON.stringify(saveData, null, 2);
  const workflowYaml = generateGitHubWorkflowYaml();
  const readmeMd = `# けんちこワールド (ken-chiko)

セカイをうろつくオジサン「けんちこ」の放置型ペットシミュレーター＆◯◯にゃん図鑑データリポジトリです。

## リポジトリ構成
- \`.github/workflows/sync-kenchiko.yml\`: 毎週のデータ更新と自動コミット用ワークフロー
- \`data/nyans.csv\`: 毎週更新される「◯◯にゃん」キャラクター定義CSV
- \`data/pet-state.json\`: けんちこの現在地、冒険記録、おもいで絵日記、図鑑登録状況

## けんちこステータス
- 現在地: \`${saveData.kenchiko.currentLocation}\`
- 活動内容: \`${saveData.kenchiko.currentActivityTitle}\`
- 図鑑登録数: \`${saveData.characters.filter((c) => c.discovered).length} / ${saveData.characters.length}\`
- 最終更新日時: \`${new Date(saveData.lastSaved).toLocaleString('ja-JP')}\`
`;

  return { petStateJson, workflowYaml, readmeMd };
}
