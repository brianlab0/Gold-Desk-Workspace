# Gold Desk 交接紀錄

## 2026-10-28：B 區塊新增近期波動範圍、停損被碰到比例與風險預算試算（分支 feature/b-volatility-range，尚未併入 main）

在「確認前核對」的部位與價格風險下新增「近期波動範圍」：持有 15 分、1 小時、4 小時，過去 20 個交易日價格對這筆單不利的走勢（一半情況與 95% 情況），換算成本筆美元；有設停損時顯示「你的停損過去被碰到的比例」；並提供輸入預算反推手數上限的試算。沒有相似案例時一樣顯示。接在 `IntegratedReview.tsx` 的 `RiskReview`，回放審核與對話審核共用。文字改成白話。

說明也會引用：後端 `evidence.py` 的 risk 區新增 `risk.volatility` 事實（程式寫好整句話，LLM 只能挑編號）；Pages 的 Groq facts 多一個小區塊，超過代理 1,500 字限制時自動不附，避免 Groq 說明失效。沒有金鑰，未實際呼叫 Groq。

資料是 Yahoo GC=F 期貨 5 分 K 的衍生快照，不是現貨或券商報價，只存分布數字；歷史描述，不是預測或損失上限。新增 `backend/volatility.py`、`frontend/src/rangeMath.ts`、`VolatilityRange.tsx`、`groqFacts.ts`、快照與驗證腳本及測試；既有檔案只動 `IntegratedReview.tsx`、`integration.css`、`evidence.py`、`groqProxy.ts` 與本檔，皆很小。前端 138 項（原 104 + 新 34）、後端 CI 指令 504 項、兩種建置通過；本機 Pages 建置實際操作並以獨立程式重算停損比例。細節、限制與未完成項目見 [docs/B_volatility_range_20261028.md](docs/B_volatility_range_20261028.md)。沒有改後端 API、相似規則、個人規則或券商流程；沒有部署到組員的站。

## 2026-10-26：左側目錄收斂為三個主頁（本地預覽，尚未部署）

實際檢視三頁後，判斷「本頁內容」與各頁現有的側欄、按鈕及分頁重複，故從左側移除。左側保留交易對話、即時看盤、歷史回放三個主頁入口與底部公開展示來源說明；對話頁的帳戶／草稿切換、即時看盤的下一步按鈕、回放頁的持倉與案例分頁仍在原位。清除 `DeskRouteFrame.tsx`、`App.tsx` 中僅供該區塊使用的事件與型別，以及相應 CSS；沒有改資料或交易流程。前一節記錄的是此輪前的中間本地版本，以本節的三頁目錄為準。

修改 `frontend/src/DeskRouteFrame.tsx`、`App.tsx`、`integration.css`、`secondaryPages.css`、`frontend/tests/desk-pages.test.ts`。前端 104 項測試、`npm run build:pages`、`npm run build` 及 Git diff 空白檢查通過；本地瀏覽器目視確認交易對話、即時看盤、歷史回放的左側目錄與版面。預覽仍在 `http://127.0.0.1:5175/Gold-Desk-Workspace/`。沒有推送或部署。

## 2026-10-26：左側本頁導覽語意一致（本地預覽，尚未部署）

公開版原「快速前往」混合本頁定位與直接切換至歷史回放；即時看盤與交易對話尤其容易誤判點擊結果。改為「本頁內容」，只列所在頁面可到達的區塊：交易對話為對話輸入、帳戶與提醒、委託草稿；即時看盤為參考行情圖、行情說明與下一步；歷史回放為回放 K 線、模擬委託、持倉與紀錄、相似歷史案例。跨頁仍由三個主頁選單及內容區明確標示的按鈕負責；對話帳戶區的持倉、紀錄、案例及提醒按鈕也直接標出「到回放頁」。同步修正即時看盤頁說明，避免暗示此頁直接展示歷史案例。

修改 `frontend/src/DeskRouteFrame.tsx`、`App.tsx`、`ReplayAccountSummary.tsx`、`integration.css`、`secondaryPages.css`、`frontend/tests/desk-pages.test.ts`、`replay-account.test.ts`。前端 104 項測試、`npm run build:pages`、`npm run build` 通過；最後文字調整後再次執行 104 項測試與 Pages 建置。瀏覽器確認對話頁委託草稿顯示於同頁側欄、即時看盤說明停留同頁、歷史回放案例切換同頁分頁，最後也目視核對即時看盤頁說明與對話帳戶區跨頁按鈕。沒有推送或部署。

## 2026-10-26：公開 Pages 細節修整（本地預覽，尚未部署）

對照現行公開 Pages 與本地三頁後，保留左側目錄、共用頁首、三欄工作區、登入入口與原有操作流程。本輪只修正容易誤解的介面細節：公開交易對話的建議問題與輸入提示改稱「回放行情」，避免使用者以為助手會直接讀取 TradingView 外部即時價；即時看盤的側欄小標改為「行情脈絡」；入口的帳號體驗展開後顯示「收合帳號體驗」。即時看盤及歷史回放各保留一個頁面主標題，商品名稱改為次標題，視覺大小不變。

修改 `frontend/src/App.tsx`、`EntryGate.tsx`、`LiveChart.tsx`、`LivePageGuide.tsx`、`entry-integration.css`、`integration.css`。前端 103 項測試、`npm run build:pages`、`npm run build` 與 Git diff 空白檢查均通過。本地 Pages 預覽已目視檢查入口、帳號展開狀態、交易對話、即時看盤、歷史回放，三頁版面正常；預覽網址為 `http://127.0.0.1:5175/Gold-Desk-Workspace/`。這次沒有改資料來源、模擬交易、API 或身分驗證，沒有推送或部署；若決定發布，再走審查與線上驗收。

## 2026-10-26：過時版型與技能選型文件封存

盤點舊 Markdown 的用途後，保留 `PRODUCT.md` 的產品目的、範圍與限制，以及 API 契約、角色交接、專題報告、資料稽核和相似檢索研究證據。`docs/layout-comparison.md` 描述已移除的舊版型網址參數；`docs/ui-terminal-20261013/skill-assessment.md` 是 10 月 13 日的技能選型與舊 UI 行號，現行程式、Pages、測試和交接均不引用，故從追蹤樹移出。兩份檔案已先封存在 repo 外本機 ZIP，內含 2 個檔案，SHA-256 `48F0E2716C36D19EAC5473A324FC26F91F2E3AA29AAD6BB8D21F3C29F2DE197F`；也可從合併前 commit `f0a117d5c77a558e6ca81e53a3b56204a5b6114d` 還原。更新歷史 README 連結指向固定提交。

這次只刪文件，不改前端、後端或 Pages workflow。已先確認 Pages workflow 只從 `frontend/` 建置，公開站入口與交易對話、即時看盤、歷史回放三頁可開啟；合併後仍須確認 GitHub Actions 與線上網站。下一步若檢視其餘較舊文件，依實際用途與研究追溯價值判斷，不以 GitHub 顯示的「2 days ago」作刪除條件。

## 2026-10-26：交接文件入口收斂

重寫 `TEAM_HANDOFF.md` 為此 repo 的現行接手入口，修正舊版指向 `kuan35/Gold-Trading-Project` 的 clone 指令，並移除已過時的固定測試數、重複角色提示與 Pages 舊狀態。`docs/team_handoff_20261023/` 的角色文件與部署規格仍供分工使用，已加上歷史版本提示；`HANDOFF.md` 保留逐次變更紀錄，`docs/pages-current-handoff-20261025.md` 保留已部署能力摘要。

`E-前端改善筆記.md` 以 2026-10-01 程式與已過時的時程撰寫，不再作為現行待辦，故從追蹤樹移出；清理前在 repo 外本機封存同 SHA-256 的副本，亦可由 Git 歷史取得。它提出的資料來源、人工確認與錯誤狀態原則，仍由現行 API 契約、前端角色文件及 Pages 現況指南承接。這次僅改文件，不改程式與資料；驗證為 Git diff 空白檢查、連結與路徑核對及 CI。下一步由組員按現行入口接手。

## 2026-10-26：現行 repo 舊版檔案清理

從追蹤樹移出 `.agents/skills/`、`site/`、`prototype/`，合計 426 個檔案、約 7.25 MiB。現行 Pages 仍由 `frontend/` 建置；API、研究、資料契約與部署流程未改。清理前已將這 426 個追蹤檔封存於 repo 外的本機 ZIP，並驗證數量與 SHA-256；詳細原因、清理前 commit 與復原方式見 [清理紀錄](docs/legacy-cleanup-20261026.md)。完整 Git 歷史保留，沒有改寫組員既有的 commit。

驗證：前端 103 項測試通過，`npm run build:pages` 與 `npm run build` 通過；`git -c core.whitespace=cr-at-eol diff --check` 通過。這次沒有修改後端程式，後端完整回歸由 PR 的 Verify workflow 再驗證。下一步是 PR 審查與合併後確認 Pages workflow 成功。舊檔案需要回查時請使用清理紀錄中的固定 commit，不要從舊 README 連到現行樹下不存在的路徑。

## 2026-10-25：公開 Pages 現況交接與來源文案

新增 [公開 Pages 現況與接手指南](docs/pages-current-handoff-20261025.md)，從 `README.md`、`TEAM_HANDOFF.md` 連入。文件依已部署畫面與現行程式列出入口、交易對話、歷史回放、即時看盤、服務狀態的實際能力及限制；說明 `build:pages`／一般 build、公開資料校驗、乾淨 clone 的重現命令、前端接線範圍、A／C 組需交付的契約、私有資料界線、後續畫面改善與組員交付清單。瀏覽器目視查看公開站的交易對話、即時看盤及歷史回放，三頁版面可用。`frontend/src/PublicTicker.tsx` 將橫幅標為「外部參考價」及「不參與回放成交」，減少與下方合成回放報價混淆；未改資料或交易邏輯。

Windows 本機以 PowerShell 展開測試檔名後，前端 103 passed；`npm run build:pages` 通過。仍待 GitHub Actions 與發布後公開畫面驗收。後端、私有資料與憑證沒有變動。

## 2026-10-24：公開 Pages 三頁工作台統一

將公開版的交易對話、歷史回放、即時看盤放進同一組左側目錄、頁首與頁面標題；對話頁保留既有聊天、帳戶提醒、委託草稿與入口流程。窄桌面優先顯示對話和草稿，帳戶資訊排在下方；手機以橫向頂部目錄及單欄內容呈現。對話頁的本頁目錄可跳至聊天及帳戶；回放頁的版面還原移到共用頁首，避免原頁首留下空白。一般後端模式的對話工作台不改。

修改：`frontend/src/DeskRouteFrame.tsx`、`frontend/src/App.tsx`、`frontend/src/integration.css`。驗證：`tsx --test tests/*.test.ts`（PowerShell 展開檔名）103 passed；`npm run build:pages` 成功；本機 Pages 模式瀏覽器檢查三頁切換、回放還原控制及 390px 手機版。未變更 API、案例檢索規則、私人資料或實際券商委託；Pages 仍為公開合成展示。下一步以 GitHub Actions 和公開 Pages 檢查發布結果。

## 2026-10-25：工作台文字改為使用者優先（本地預覽）

保留展示登入與訪客入口、交易對話／回放演練／即時看盤三頁、持倉與資料來源資訊，將入口、頂部選單及連線面板的開發規劃文字改成使用者可理解的功能和目前狀態。頂部改為「資料來源」「服務狀態」；服務面板簡述使用身分、對話解讀、即時報價與持倉、歷史案例與盤面的可用情況，底部只留一行「後續預留」供教授辨識未來接入方向。仍明示展示帳號未經驗證、行情未連線及回放盤面的資料界線。修改 `frontend/src/EntryGate.tsx`、`IntegrationShell.tsx`、`ConnectionCenter.tsx`、`integration.css`；沒有改動交易或身分驗證邏輯。`npm run build` 及前端 103 項測試通過；本機瀏覽器目視確認入口與服務面板。網址 `http://127.0.0.1:8765/`，只留本地，未推送或部署。

## 2026-10-25：本機資料就緒與即時服務核對

新增本機專用 `GET /api/data/readiness`，只回傳案例來源、案例數、候選側檔校驗狀態與回放行情是否合成，不回傳案例列或帳戶資料；`ConnectionCenter.tsx` 增加「歷史案例與盤面」，區分私有案例側檔已驗證與本次盤面查詢尚未就緒，並將 cTrader `NOT_CONFIGURED` 明示為「尚未設定」。更新 `backend/app.py`、`backend/tests/test_api.py`、`frontend/src/ConnectionCenter.tsx`、`API_CONTRACT.md`。本機 Python 獨立檢查得到 `trader_history` 11902 筆、候選側檔 `READY` 10887 筆；回放行情仍是合成，`private/audit.json` 與 `.env.ctrader` 不存在。重啟 8765 服務後 API 與瀏覽器均確認新狀態。`/api/assistant/status` 為未設定，`/api/broker/market` 和已收 K 線為 `NOT_CONFIGURED`，即時案例查詢回 `BROKER_QUOTE_UNAVAILABLE`；關閉模型、關閉案例查詢的即時對話回 `local_market_rules`／`market_unavailable` 且沒有草稿。後端相關假串流／API 測試 40 passed，前端 103 passed，一般建置通過。沒有真實券商連線、模型呼叫或送單；只留本地，未推送或部署。

## 2026-10-25：帳號與連線前端接點（本地預覽）

工作台頂部新增可收合的「帳號與連線」，保留展示身分、AI 解讀與 cTrader DEMO 三條接入路徑。完整模式開啟面板時讀取 `/api/assistant/status` 與 `/api/broker/market`，顯示實際連線狀態或取不到狀態；公開模式不呼叫私人後端。未提供自備 API Key 輸入或假授權按鈕，因正式帳號、資源隔離與安全保存尚未完成。保留原本登入入口、三頁工作台與資料來源說明。修改 `frontend/src/ConnectionCenter.tsx`、`IntegrationShell.tsx`、`integration.css`，並更新團隊接入圖。一般建置與型別檢查通過；本機瀏覽器確認面板顯示訪客未驗證、AI 未啟用及 cTrader 未連線。既有 103 項測試本輪未執行：自動核准服務回報用量限制，核准程序未完成。只留本地，未推送或部署。

## 2026-10-25：完整模式先顯示展示登入入口（本地預覽）

本機 `http://127.0.0.1:8765/` 現在先顯示與 Pages 同源的入口，桌面版把「登入／假註冊」放在畫面右側，另有訪客預覽。展示帳號只存在此頁記憶體，登入後進入原本的 FastAPI 工作台，頂部標示「展示帳號 · 未驗證」；訪客標示「訪客預覽 · 未驗證」。可從工作台返回入口，重新整理會清除展示帳號。這不是後端身分驗證、角色或資料隔離。Pages 原有入口仍採原本可展開的帳號體驗。修改 `frontend/src/IntegrationShell.tsx`、`EntryGate.tsx`、`entry-integration.css`。一般建置與前端 103 項測試通過；以純測試資料在本機瀏覽器完成註冊、登入、工作台顯示、返回入口與訪客預覽。只留本地，未推送或部署。

## 2026-10-25：展示登入可見性與 A–E 接入位置（本地預覽）

確認登入沒有被移除：現行 Pages 由 `frontend/src/IntegrationShell.tsx` 在入口掛載 `EntryGate.tsx`，其中「註冊與登入」是 `demoAuth.ts` 的頁面記憶體展示帳號；當時一般 build 直接進 FastAPI 工作台，因正式認證、角色與資料隔離尚未完成。`site/` 原入口仍保留，但不是現行 Pages 建置來源。這次讓 Pages 登入後在頂部標示展示帳號，訪客標示「訪客模擬」；一般模式標示「本機未驗證」，帳號狀態說明區作為日後正式會話與角色的接入位置。沒有建立後端帳號或賦予權限。

新增 [團隊功能接入位置](docs/team-integration-map-20261025.md)，對照 A–E 的現有畫面／程式接點、待定契約與驗收順序；維持既有三頁區域，不以空白假功能卡代替組員內容。修改 `frontend/src/IntegrationShell.tsx`、`frontend/src/integration.css` 與交接文件。前端 103 項測試通過，`npm run build:pages` 與 `npm run build` 通過；瀏覽器以純測試資料完成本地 Pages 註冊、登入並確認「展示帳號」狀態，另確認完整模式顯示「本機未驗證」及正式登入待接說明。修正帳號說明面板被共用頁首遮蓋的層級問題，兩種模式均已目視確認。只留本地，未推送或部署。

## 2026-10-25：公開 Pages 對照與參考行情跨頁引導（本地預覽）

對照目前線上 Pages 與本地版本：線上交易對話仍為舊三欄畫面；本地版已是對話主區、可切換側欄與首屏輸入框，因此這些先前核准的改善尚未發布。本輪檢查三頁後，發現公開「即時看盤」的 TradingView 參考圖缺少顯眼的來源界線與回對話入口。修改 `frontend/src/LivePageGuide.tsx`、`frontend/src/secondaryPages.css`、`frontend/src/App.tsx`：右欄直接說明圖表資料不會自動進入合成回放分析／案例／模擬委託；加入「回交易對話整理想法」，返回後聚焦輸入框；回放案例與下單按鈕明確指出目的地。沒有更動行情、案例排名、帳戶或交易邏輯。

本地瀏覽器確認：新說明可見，返回對話並聚焦輸入框，案例按鈕切至回放頁相似案例分頁。`frontend/tests/desk-pages.test.ts` 更新公開導覽的既有驗收文案；前端 103 項測試、`npm run build:pages` 和 `npm run build` 通過。仍只在本地，未推送或部署。

## 2026-10-25：私有案例資料與完整前後端本地預覽

確認 `GoldDesk_PRIVATE_CASE_DATA_20261023.zip` 是七份 `private/` 案例與行情側檔，沒有後端 Python 程式；後端程式來自團隊 GitHub 專案，公開靜態 Pages 與一般 FastAPI 模式仍是兩種不同入口。先核對 ZIP manifest 的七個 SHA-256，再只把 `private/` 檔案解到本地產品根目錄；`private/` 持續由 Git 忽略，沒有上傳。載入檢查顯示 11,902 筆歷史案例、10,887 份候選市場側檔，候選側檔狀態 `READY`。這不代表合成回放查詢可取得真實盤面相似案例：本地 `/api/cases` 對該查詢回 0 筆與 `QUERY_UNAVAILABLE`，符合來源隔離。

在 `frontend/src/ConversationWorkspace.tsx` 與 `frontend/src/productDesk.css` 增加即時報價未就緒提示和歷史回放入口；本地瀏覽器確認提示可見、入口確實切換到清楚標為合成行情的回放。`backend/tests/test_api.py` 改用私有資料存在時的成熟候選案例檢查 detail 的進場前 K 線，不再假設合成查詢一定有第一筆相似案例；未修改檢索規則或原始資料。一般前端 `npm run build`、公開版 `npm run build:pages`、前端 `tsx --test`（PowerShell 展開檔名）103 項通過。後端 `python -B -X utf8 -m pytest -q backend/tests --basetemp private/pytest_tmp_20261025 --tb=short` 為 449 passed、3 warnings；首次未指定本地暫存目錄時，63 項 fixture 因系統暫存權限錯誤，與程式判斷無關。

本地完整模式啟動於 `http://127.0.0.1:8765/`，僅綁定 `127.0.0.1`。cTrader DEMO 報價與帳戶、Groq 均未連線，未執行真實或 DEMO 下單。改動只留本地，未推送或部署。下一步若要驗收真 DEMO，需由帳戶持有人設定受控憑證並實際連線；公開雲端後端仍需認證、隔離與耐久儲存。

## 2026-10-25：對話到持倉路徑與可見入口（本地預覽）

新增 [對話到持倉產品路徑](docs/conversation_to_position_plan_20261025.md)，串起提問、依據、草稿、核對、確認、持倉／待成交／紀錄，明確區分公開合成回放與外部參考行情、後續受保護 DEMO。公開對話頁的標題旁新增即時的「黃金模擬持倉 N 筆」入口；點擊切至右側「持倉與帳戶」摘要，再由既有「查看持倉與損益」進入回放頁完整持倉表。修改 `frontend/src/App.tsx`、`frontend/src/integration.css`，不改交易計算、確認或後端。

本地公開版瀏覽器確認：0 筆時標籤及空狀態正確；從委託草稿點持倉入口可切回摘要，再進入回放持倉分頁。前端 103 passed、`npm run build:pages` 成功。仍僅本地預覽，未推送或部署；非零持倉與 DEMO 帳戶流程未在本輪執行實際送單驗收。

## 2026-10-25：公開對話頁改為對話優先（本地預覽）

依桌面使用情境，將公開 Pages 模式的交易對話改為主對話區加右側切換面板：移除桌面版重複的頁面標題，輸入框與建議問題留在首屏；右側「交易脈絡／委託草稿」按需切換，保留帳戶、報價、持倉、案例、提醒與原委託核對流程。左側「帳戶與提醒」會開啟交易脈絡。調整對話空狀態文案及建議問題的排版，沒有新增模型能力、後端連線或自動送單。修改 `frontend/src/App.tsx`、`frontend/src/integration.css`，保留公開合成回放與外部參考行情的區分。

本地公開模式桌面瀏覽器確認：輸入框首屏可見；「委託草稿」與「交易脈絡」切換、建議問題填入、送出後本地規則回覆、左側帳戶捷徑可用。前端 103 passed，`npm run build:pages` 成功。此版仍在 `codex/frontend-local-preview` 本地分支，未推送、未部署；僅針對桌面視覺與互動進行實地檢查，行動版尚待下一輪設計驗收。

## 2026-10-24：桌面三頁導覽與頁首微調（本地預覽）

公開 Pages 模式在桌面寬度下縮短三頁共用的行情頁首與標題區，讓內容更早進入畫面；左側捷徑改用各頁實際目的地名稱。即時看盤的「回放持倉與紀錄」現在會切到回放頁的持倉區，修正公開版原先連到不存在的 DEMO 區塊而無反應的情況；行情圖捷徑會捲至圖表。修改 `frontend/src/DeskRouteFrame.tsx`、`frontend/src/App.tsx`、`frontend/src/integration.css`，未更動行動版規則。

本地公開模式瀏覽器確認：對話頁相似案例捷徑進入回放案例、回放 K 線捷徑定位圖表、即時看盤持倉捷徑進入回放持倉。前端 103 passed、`npm run build:pages` 成功，`git diff --check` 無錯。維持本地分支與預覽，尚未推送或部署；待使用者看過後決定是否發布。

## 2026-10-24：桌面版對話輸入捷徑（本地預覽）

公開 Pages 模式的對話頁在一般桌面高度下，輸入框位於首屏下方。於對話卡標題新增「開始輸入」按鈕，左側「對話助手」捷徑也直接聚焦同一輸入框，由瀏覽器捲至可輸入位置；保留原對話、委託與資料流程。修改 `frontend/src/App.tsx`、`frontend/src/integration.css`，未修改後端或行動版規則。

本地 `vite --mode pages` 桌面瀏覽器確認：兩個入口皆聚焦輸入框，範例問題可填入並由本地規則助手回覆；前端 103 passed、`npm run build:pages` 成功。此為本地預覽，尚未推送或部署 Pages。

## 2026-10-24：公開 Pages 三頁工作台統一

將公開版的交易對話、歷史回放、即時看盤放進同一組左側目錄、頁首與頁面標題；對話頁保留既有聊天、帳戶提醒、委託草稿與入口流程。窄桌面優先顯示對話和草稿，帳戶資訊排在下方；手機以橫向頂部目錄及單欄內容呈現。對話頁的本頁目錄可跳至聊天及帳戶；回放頁的版面還原移到共用頁首，避免原頁首留下空白。一般後端模式的對話工作台不改。

修改：`frontend/src/DeskRouteFrame.tsx`、`frontend/src/App.tsx`、`frontend/src/integration.css`。驗證：`tsx --test tests/*.test.ts`（PowerShell 展開檔名）103 passed；`npm run build:pages` 成功；本機 Pages 模式瀏覽器檢查三頁切換、回放還原控制及 390px 手機版。未變更 API、案例檢索規則、私人資料或實際券商委託；Pages 仍為公開合成展示。下一步以 GitHub Actions 和公開 Pages 檢查發布結果。

## 2026-10-24：整合至 NekoMaTA864/Gold-Desk-Workspace

以 eb047ca 團隊版本整合前後端與原本站介面。frontend/ 為現行建置來源，site/ 保留；五區核對只呈現既有結果，不重寫確認或排名。前端 103 passed、兩種 build 通過，後端 463 passed。詳細檔案、部署範圍與回復方式見 [整合交接](docs/integration-20261024.md)。私人資料與秘密不進 Git。Pages 是公開展示，受保護雲端後端待後續完成。

## 2026-10-23：最新工作台與前後端分工交接

本次以 c9a3396 為基準，同步最新深灰金色聊天工作台及即時／回放／案例等分頁；31個精確白名單路徑，另更新本交接紀錄。新增 DeskChrome／DeskRouteFrame、帳戶 tray、唯讀文字紀錄、趨勢支持／反向訊號、圖表共用色票與分頁樣式，保留共用草稿、固定快照、確認／版本／防重送與 UNKNOWN。後端僅修正啟動時 quote 時間戳缺值回 UNAVAILABLE，沒有改相似規則或 API。

[TEAM_HANDOFF.md](TEAM_HANDOFF.md) 是共同入口；[前端](docs/team_handoff_20261023/FRONTEND.md)、[後端](docs/team_handoff_20261023/BACKEND.md) 各有模組位置、已完成／待辦、驗收與可貼給 Codex 的任務。兩位 clone 相同 commit，再各開 codex/frontend-deploy、codex/backend-deploy 分支。架站順序與受控資料需求見 [DEPLOYMENT.md](docs/team_handoff_20261023/DEPLOYMENT.md)。

發布包 fresh 驗證：`python -B -X utf8 -m pytest -q backend/tests research/test_context_similarity_ab.py research/test_assistant_case_acceptance.py` 得462 passed、1 skipped；`npm test` 得101 passed；`npm run build` 及 `npm run build:pages` 成功。保留原 chunk 大小與 FastAPI/httpx 提示。前兩輪已完成本機桌面與手機互動驗收，本次重跑公開包測試／建置；沒有真 DEMO 下單、平倉或外部模型呼叫。

既有公開三份data JSON未改；私人案例包、金鑰、帳戶設定、提交日誌、原始資料與QA未加入。掃描命中的兩項key字串已逐一核對為遮蔽功能的固定合成測試值；其餘無憑證模式命中。文件連結與diff空白另檢查，收據留原工作區private目錄。

一般 build＋FastAPI 包含完整新聊天工作台；Pages 仍為靜態展示入口，保留原瀏覽器聊天與合成回放。推送會觸發 verify 及 Pages workflow，是否成功以此 commit 的 Actions 為準；完整受保護雲端後端仍待同學部署，登入／資源隔離／持久資料／單owner串流是下一步。相似檢索獨立盲評未完成，不報準確率。branch main；提交以本條紀錄所在 git commit 為準。

## 2026-10-23：同步最新產品程式與架站交接

入口：[TEAM_HANDOFF.md](TEAM_HANDOFF.md)，包含可直接貼給前端／後端同學Codex的任務。[架站工作](docs/team_handoff_20261023/DEPLOYMENT.md)仍待實作及驗收，這次推送不是完整雲端後端已部署的聲明。

同步React聊天工作台與可調聊天大小、共用草稿、固定快照、案例對照、cTrader形成棒／已收棒、持倉／損益／紀錄／確認式平倉、Groq盤面解讀與tick量分析，以及context_contract_v1核心和相關測試。Pages繼續使用獨立合成回放及舊公開索引；一般build才接FastAPI。既有公開data三檔未改。

未包含private/、憑證、原始對帳單、私人行情／索引、委託日誌及QA。乾淨clone可以示範啟動，不等於真實案例側檔與券商已設定；資料需求見DEPLOYMENT.md。原工作區保留完整本機收據與原件SHA驗證。

乾淨發布包重跑：Python後端與兩份研究回歸458 passed、1 skipped；前端npm ci後86 passed；一般build及build:pages成功。修正一項圖集路由測試對本機private圖集的依賴，改為暫存合成fixture，仍驗證白名單／存取限制／缺檔，不上傳私人圖集。既有前端chunk大小提示與FastAPI httpx警告保留。沒有真帳戶送單或外部模型呼叫。新增verify.yml讓同學PR自動驗證兩端，Pages workflow保留。

公開檔案掃描無禁入路徑／憑證模式，既有三個公開資料檔雜湊保持相同。真實案例最小受控資料包已在擁有者本機另行準備，沒有進GitHub；同學須私下取得，再執行loader完整性檢查。推送提交請以GitHub Actions和git log核對。

下一步：兩位先clone相同commit、各開分支，後端先做授權／隔離／耐久部署，前端配合API與SSE認證，再共同驗收測試站。獨立盲評尚未完成，切勿將程式通過當人工相似準確率。
