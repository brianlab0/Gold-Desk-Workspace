# B 區塊新增：近期波動範圍與風險預算試算

日期：2026-10-28。基底：`NekoMaTA864/Gold-Desk-Workspace` main（df1fcdc）。分支：`feature/b-volatility-range`。

## 一句話

在「確認前核對」的「01 部位與價格風險」底下，新增「近期波動範圍」。使用者建立草稿後可以看到：持有 15 分鐘、1 小時、4 小時，價格對這筆單最不利的變動通常有多大；也可以輸入「這筆最多願意承擔多少美元」，反推手數上限。**沒有相似案例（0 筆匹配）時一樣會顯示**，這是《Gold Desk 五人分工》B 區塊「無匹配案例時的波動風險範圍」的實作。

## 畫面在哪

接在 `RiskReview`（`frontend/src/IntegratedReview.tsx`）。這個元件同時被「回放審核」和「對話審核」使用，所以兩個畫面都會出現，沒有改任何下單、確認、防重送流程。

## 使用者會看到什麼

用白話寫，不放統計術語（MAE、p95、百分位）：

- 一句話摘要：「最近 20 個交易日，如果持有 1 小時：100 次裡有 95 次，價格對你不利的走勢不超過 X 美元／盎司（這筆約 Y 美元）。其餘 5 次可能更大。這是過去的紀錄，不是預測，也不是損失上限。」
- 三個持有時間的表格：「一般情況（一半的時候不超過）」與「較大波動（100 次有 95 次不超過）」，各附這筆的美元。4 小時那列標「僅供粗略參考」。
- **你的停損會被碰到多少比例**（有設停損時）：顯示停損離進場價多少美元，以及過去持有 15 分鐘、1 小時、4 小時各有約幾成的時間價格會走到這個距離。沒設停損就說算不出來。
- 「資料從哪來、有什麼限制」展開說明。
- 預算試算：輸入「這筆你最多願意虧多少美元」，反推手數上限。有設停損用停損距離，沒設就用 1 小時較大波動並明說「這不是停損」。結果寫出目前草稿是否已經超過。只是試算，不改草稿。

## 說明（事實清單）也會引用

- **後端（完整版）**：`backend/evidence.py` 的 `risk` 區新增一條 `risk.volatility` 事實，由 `backend/volatility.py` 的 `volatility_fact` 產生。數字與整句話都由程式寫好，LLM 只能挑編號，改不了字。預設會出現、不是強制項，沒有草稿時不會出現。
- **Pages 版（Groq 說明）**：`frontend/src/groqFacts.ts` 在送給代理的 `facts` 裡多加一個很小的 `volatility` 區塊。**代理限制 `facts` 不超過 1,500 字，超過整個請求會被拒絕**，所以只有加了之後仍在 1,400 字以內才會附上，否則維持原樣，不會因為我的欄位讓 Groq 說明失效。
- 已部署的代理提示詞是「只用所給的程式事實回答」，所以多出的欄位會被當成事實使用。**我沒有金鑰，沒有實際呼叫 Groq，這一段只驗證到「送出的內容正確且不超限」，沒驗證模型實際怎麼回答。**

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
| `backend/tests/test_volatility.py` | 34 項，數字可手算 |
| `frontend/src/rangeMath.ts` | 瀏覽器端同一套算法（Pages 沒有後端，所以前端要自己算） |
| `frontend/src/VolatilityRange.tsx` | 畫面元件（白話文字、停損被碰到比例、預算試算） |
| `frontend/src/groqFacts.ts` | 把波動事實加進 Groq 說明的 facts（含長度保護） |
| `backend/tests/test_volatility_evidence.py` | 事實清單整合測試 6 項 |
| `frontend/src/volatility-snapshot.json` | 衍生快照（只有百分位與筆數，沒有原始 K 線） |
| `frontend/tests/range-math.test.ts`、`volatility-card.test.ts`、`groq-facts.test.ts` | 34 項 |
| `scripts/build_volatility_snapshot.py` | 重建快照 |
| `research/volatility_coverage.py` | 滾動驗證 |
| `docs/volatility_range_validation_20261028.md` | 驗證結果 |

修改（既有檔案，共四處，都很小）：

| 檔案 | 改了什麼 |
|---|---|
| `frontend/src/IntegratedReview.tsx` | 增加 2 行（import 與渲染） |
| `frontend/src/integration.css` | 增加約 18 行（沿用既有的 `--line`、`--ink`、`--raised` 主題變數） |
| `backend/evidence.py` | 增加 5 行（import 與一條事實） |
| `frontend/src/groqProxy.ts` | 改 5 行（加 import、用 `withVolatility` 包住原本的物件） |
| `HANDOFF.md` | 增加記錄段落 |

`evidence.py`、`groqProxy.ts`、`HANDOFF.md` 原本是 CRLF，我保留了，所以 diff 只會顯示實際改動的行。

## 資料來源與限制（請務必讀）

- 快照來源是 Yahoo Finance 的 GC=F（COMEX 黃金期貨）5 分鐘 K，**不是現貨 XAUUSD，也不是券商報價**，畫面和快照都有標示。
- 快照涵蓋 2026-09-30 至 2026-10-27 共 20 個交易日、5,383 根棒，擷取於 2026-10-27。
- 只存衍生數字，原始 K 線沒有放進 repo。
- 相鄰視窗大量重疊，實際獨立樣本比筆數少，持有越久越明顯。
- 各時段波動不同（美股開盤前後通常較大），目前混合計算，沒有分時段。
- 未含價差、佣金、隔夜費、跳空與滑價。
- 這是歷史描述，不是預測，也不是損失上限。畫面沒有使用「最大損失」字樣，也沒有帳戶風險百分比（分工.md 驗收要求）。
- 我曾算過「目前波動排在過去 20 日第幾百分位」，但那個數字受時段影響很大（清淡時段排名自然偏低），秀出來會誤導，所以**沒有放進畫面**。函式還在 `backend/volatility.py`，用之前請先做同時段比較。

## 驗證

- 前端：`npm test` 138 項全過（原有 104 項 + 新增 34 項）；`npm run build` 與 `npm run build:pages` 通過。
- 後端：照 CI 指令 `python -B -m pytest -q backend/tests research/test_context_similarity_ab.py research/test_assistant_case_acceptance.py` 504 項全過（原有 + 新增 40 項），他們原有的說明相關測試沒有因為多一條事實而失敗。
- 兩個語言算法一致：預算反推與停損被碰到比例，前後端測試用同一組數字。
- 測試有效性：故意破壞三處（買單算反、百分位少一名、預算改四捨五入），測試都會失敗，還原後全過。
- 防退步：畫面不得出現 MAE、p95、百分位等術語；不得出現「最大損失」或帳戶風險百分比。
- 實際瀏覽器操作（本機 Pages 建置）：買進 0.2 手停損 2916，停損區塊顯示 15 分鐘約 1%、1 小時約 8%、4 小時約 40%；另用獨立程式從快照重算，三個數字一致。預算 200 美元得到 0.16 手、草稿 0.2 手「已經超過」，與手算一致。390px 手機寬度沒有水平捲動。
- 滾動驗證（`docs/volatility_range_validation_20261028.md`）：15 分鐘與 1 小時的 95% 範圍，隔天實際被超過的比例平均約 3% 到 5%，大致守得住；**4 小時逐日差異很大**。樣本只有 30 到 45 個測試日、單一行情時期，不可過度引用。
- 停損被碰到的比例解析度只有 1 個百分點，而且只描述快照那 20 個交易日，不是機率。

## 還沒做

- 即時模式的行情來源：目前用快照。C 接上 cTrader 後，把 `scripts/build_volatility_snapshot.py` 的 `load_bars` 換成券商 5 分 K 即可，`backend/volatility.py` 吃任何一串 5 分 K。
- 分時段（亞、歐、美盤）的範圍。
- 實際呼叫 Groq：沒有金鑰，沒驗證模型怎麼回答。
- 個人規則：沒有改 `personal_rules.py`。`version` 欄位、預設規則包、波動規則要同時改前後端兩套驗證器，需要先和 A 對契約。
- 點差、重大數據前提醒：點差只有即時報價才有，事件提醒需要 CPI、NFP、FOMC 時間表，且回放用合成日期，這兩項要等資料與單位確認。
- 多年驗證：需要私人側檔的 5 分 K，要資料擁有者同意。
- 後端 API：目前前端直接使用快照，沒有新增端點。要 API 化時用 `backend/volatility.py` 即可。

## 給接手的人

- 只在 gdw 版驗證過。**kuan35 最新版（10/27）沒有 `IntegratedReview.tsx`**，所以要放進那一版得另找接點（例如它的風險面板），我沒有驗證過。
- 重建快照：`pip install yfinance`，再 `python scripts/build_volatility_snapshot.py`（Yahoo 只提供約 60 天的 5 分鐘資料）。
- 重跑驗證：`python research/volatility_coverage.py --write docs/volatility_range_validation_20261028.md`。
- 前端測試前請先 `python scripts/fetch_public_data.py`，否則既有的 `published-history` 那一項會因缺公開資料而失敗（與這次改動無關）。
