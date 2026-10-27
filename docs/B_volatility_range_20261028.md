# B 區塊新增：近期波動範圍與風險預算試算

日期：2026-10-28。基底：`NekoMaTA864/Gold-Desk-Workspace` main（df1fcdc）。分支：`feature/b-volatility-range`。

## 一句話

在「確認前核對」的「01 部位與價格風險」底下，新增「近期波動範圍」。使用者建立草稿後可以看到：持有 15 分鐘、1 小時、4 小時，價格對這筆單最不利的變動通常有多大；也可以輸入「這筆最多願意承擔多少美元」，反推手數上限。**沒有相似案例（0 筆匹配）時一樣會顯示**，這是《Gold Desk 五人分工》B 區塊「無匹配案例時的波動風險範圍」的實作。

## 畫面在哪

接在 `RiskReview`（`frontend/src/IntegratedReview.tsx`）。這個元件同時被「回放審核」和「對話審核」使用，所以兩個畫面都會出現，沒有改任何下單、確認、防重送流程。

## 使用者會看到什麼

- 一句話摘要：「過去 20 個交易日，持有 1 小時的不利變動有 95% 在 X 美元／盎司以內，換算本筆約 Y 美元。這是歷史描述，不是損失上限。」
- 三個持有時間的表格（一半情況內、95% 情況內，各附本筆美元）。
- 「算法與限制」展開說明：定義、資料來源與日期、視窗重疊、時段混合、未含價差與滑價、4 小時不穩。
- 預算試算：輸入美元，系統以「你設定的停損距離」反推手數上限；沒設停損就改用 1 小時 95% 的距離並明說「這不是停損」。結果寫出目前草稿是否高於上限。只是試算，不改草稿。

## 怎麼算

- 不利變動（MAE）：從某根 5 分 K 的收盤價起算，往後 N 根之內，價格對部位最不利的點離起點多遠。買單看最低價下跌，賣單看最高價上漲。
- 以起點收盤價的百分比表示，再乘本筆擬成交價、手數與每手 100 盎司換算成美元。這樣回放（價位約 2,900）與真實市場（約 4,000）不會因價位不同而失真。
- 百分位用 nearest-rank，不內插，可以手算驗證。
- 與 kuan35 版「途中最大逆向」概念相同（買單看最低價下跌、賣單看最高價上漲），但起點取法略有不同：他們用進場後第一根完整 5 分棒的開盤價，這裡用起點棒的收盤價。有案例與無案例的數字可以大致對照，不要當成逐筆相等。
- 跨越休市或缺棒的視窗不計入。
- 預算反推手數：手數 = 預算 ÷（每盎司距離 × 100），向下取到 0.01 手，不會超過預算；上限 100 手；全程 Decimal。

## 檔案

新增：

| 檔案 | 用途 |
|---|---|
| `backend/volatility.py` | 範圍、波動基準、預算反推的純函式（不連網、不用 LLM、不依賴其他後端模組） |
| `backend/tests/test_volatility.py` | 21 項，數字可手算 |
| `frontend/src/rangeMath.ts` | 瀏覽器端同一套算法（Pages 沒有後端，所以前端要自己算） |
| `frontend/src/VolatilityRange.tsx` | 畫面元件 |
| `frontend/src/volatility-snapshot.json` | 衍生快照（只有百分位與筆數，沒有原始 K 線） |
| `frontend/tests/range-math.test.ts`、`volatility-card.test.ts` | 19 項 |
| `scripts/build_volatility_snapshot.py` | 重建快照 |
| `research/volatility_coverage.py` | 滾動驗證 |
| `docs/volatility_range_validation_20261028.md` | 驗證結果 |

修改（只有這兩處）：`frontend/src/IntegratedReview.tsx` 增加 2 行（import 與渲染）、`frontend/src/integration.css` 增加 14 行（沿用既有的 `--line`、`--ink`、`--raised` 等主題變數）。

## 資料來源與限制（請務必讀）

- 快照來源是 Yahoo Finance 的 GC=F（COMEX 黃金期貨）5 分鐘 K，**不是現貨 XAUUSD，也不是券商報價**，畫面和快照都有標示。
- 快照涵蓋 2026-09-30 至 2026-10-27 共 20 個交易日、5,373 根棒，擷取於 2026-10-27。
- 只存衍生數字，原始 K 線沒有放進 repo。
- 相鄰視窗大量重疊，實際獨立樣本比筆數少，持有越久越明顯。
- 各時段波動不同（美股開盤前後通常較大），目前混合計算，沒有分時段。
- 未含價差、佣金、隔夜費、跳空與滑價。
- 這是歷史描述，不是預測，也不是損失上限。畫面沒有使用「最大損失」字樣，也沒有帳戶風險百分比（分工.md 驗收要求）。
- 我曾算過「目前波動排在過去 20 日第幾百分位」，但那個數字受時段影響很大（清淡時段排名自然偏低），秀出來會誤導，所以**沒有放進畫面**。函式還在 `backend/volatility.py`，用之前請先做同時段比較。

## 驗證

- 前端：`npm test` 123 項全過（原有 104 項 + 新增 19 項）；`npm run build` 與 `npm run build:pages` 通過。
- 後端：照 CI 指令 `python -B -m pytest -q backend/tests research/test_context_similarity_ab.py research/test_assistant_case_acceptance.py` 485 項全過（含新增 21 項）。
- 測試有效性：我故意破壞三處（買單算反、百分位少一名、預算改四捨五入），測試都會失敗，還原後全過。
- 實際瀏覽器操作（本機 Pages 建置）：買單無停損、賣單有停損，兩條路徑的數字都與手算一致；確認按鈕仍可用；手機寬度 390px 沒有水平捲動。
- 滾動驗證（`docs/volatility_range_validation_20261028.md`）：15 分鐘與 1 小時的 95% 範圍，隔天實際被超過的比例平均約 3% 到 5%，大致守得住；**4 小時逐日差異很大**（多數日子用不到、少數日子被大幅突破），畫面的限制說明已註明只能當粗略參考。樣本只有 30 到 45 個測試日、單一行情時期，不可過度引用。

## 還沒做

- 即時模式的行情來源：目前用快照。C 接上 cTrader 後，把 `scripts/build_volatility_snapshot.py` 的 `load_bars` 換成券商 5 分 K 即可，`backend/volatility.py` 吃任何一串 5 分 K。
- 分時段（亞、歐、美盤）的範圍。
- 個人規則：沒有改 `personal_rules.py`。`version` 欄位、預設規則包、波動規則要同時改前後端兩套驗證器，需要先和 A 對契約。
- 點差、重大數據前提醒：點差只有即時報價才有，事件提醒需要 CPI、NFP、FOMC 時間表，且回放用合成日期，這兩項要等資料與單位確認。
- 多年驗證：需要私人側檔的 5 分 K，要資料擁有者同意。
- 後端 API：目前前端直接使用快照，沒有新增端點。要 API 化時用 `backend/volatility.py` 即可。

## 給接手的人

- 只在 gdw 版驗證過。**kuan35 最新版（10/27）沒有 `IntegratedReview.tsx`**，所以要放進那一版得另找接點（例如它的風險面板），我沒有驗證過。
- 重建快照：`pip install yfinance`，再 `python scripts/build_volatility_snapshot.py`（Yahoo 只提供約 60 天的 5 分鐘資料）。
- 重跑驗證：`python research/volatility_coverage.py --write docs/volatility_range_validation_20261028.md`。
- 前端測試前請先 `python scripts/fetch_public_data.py`，否則既有的 `published-history` 那一項會因缺公開資料而失敗（與這次改動無關）。
