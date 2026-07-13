# 千词斩 LexTV — Android TV 金融·新闻英语学习软件

深墨蓝印刷词典风格,专为大屏电视 + 遥控器设计。FSRS-4.5 间隔重复调度。

## v3.5 新特性 · 实景模拟 🏦
在电视上 1:1 还原真实金融 App 的手机界面,带**手指点击动画 + 聚光灯逐项讲解 + 真人发音**,像看真机演示一样学会每个界面、每个词、每步操作:

| 课程 | 内容 |
|---|---|
| 💼 IBKR 账户总览与持仓 | Net Liquidation / Buying Power / Excess Liquidity / 浮盈浮亏 |
| 📈 IBKR 限价单买入全流程 | 搜索→行情→Order Ticket→Preview→Submit→Filled 成交动画 |
| 🇭🇰 汇丰香港 FPS 转数快 | Proxy ID / Payee / 免手续费秒到账全流程 |
| 💰 汇丰香港 定期存款 | Tenor / p.a. / Maturity / 到期指示 |
| 🇸🇬 DBS PayNow 即时转账 | NRIC / UEN / 数字令牌验证动画 |
| 🌏 DBS Remit 跨境汇款 | SWIFT / Beneficiary / 汇率锁定 / SHA·OUR |

遥控器:▶/OK 下一步 · ◀ 上一步 · ⏯ 自动播放 · 菜单键重听 · 每课完成 +40 XP

同时新增词库「港新银行实战」(90+ 词,含音标/释义/真实语境例句),界面对照新增 FPS / 定期存款 / PayNow / 跨境汇款四组。

## 功能总览
- 学新词(卡片翻转)/ 智能复习(FSRS)/ 闪电测验 / 听音辨义 / 例句填空 / 词义配对 / 极速判断 / 人机对战
- 🏦 实景模拟(v3.5)· 📱 界面对照 · 👨‍🏫 AI 外教(对话/跟读/情景课/教练,支持语音输入)
- 自选复习 / 单词本 / 统计热力图 / 自动检查更新

## 内置词库(可离线)
- 📰 新闻核心 ~1200 词 · 🤖 科技媒体 ~300 词 · 🏦 银行证券App ~250 词 · 🏙️ 港新银行实战 ~90 词(v3.5)

## 自动更新
设置 → 检查更新:App 会读取本仓库最新 Release(tag 形如 `v3.5-6`,末尾为 versionCode),有新版即可一键下载安装,学习进度完整保留。每次 push 后 GitHub Actions 自动打包 APK 并发布 Release。

## 打包安装
1. push 本仓库,Actions 自动运行 “Build APK”
2. Release 页下载 `LexTV.apk`(或下载 Actions 工件),U 盘拷入电视安装
3. 之后的升级直接在电视上“检查更新”即可

## 添加词书(两个口子)
- 口子A:把 .json 放进 `app/src/main/assets/decks/`,在 manifest.json 登记,重新打包
- 口子B(免打包):电视上复制到 `/sdcard/Android/data/com.lextv.app/files/decks/`,重启应用自动加载
- 词条格式:`[["单词","音标","词性 中文释义","英文例句"], ...]`

## 版本历史
- **3.5** 实景模拟(IBKR/汇丰/DBS 6门动画实操课)· 港新银行实战词库 · 界面对照扩充
- 3.2 界面对照教学 · 银行证券词库 · 自动更新
- 3.x AI 外教 · 语音识别 · 人机对战
