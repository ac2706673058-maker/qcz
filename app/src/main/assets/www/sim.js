/* ================= 实景模拟 · 金融App动画实操课 (v3.5) =================
   在电视上 1:1 还原 盈透证券 / 汇丰香港 / DBS星展 手机App 界面,
   手指点击动画 + 界面元素聚光灯 + 词汇讲解 + 真人发音,像看真机演示一样学。
   依赖 app.js 中的全局: $, esc, speak, show, handlers, toast, P, saveP
=========================================================================== */
"use strict";

/* ---------- 小部件构建器(手机界面通用组件) ---------- */
var SB = '<div class="p-sbar"><span>9:41</span><span class="sig">5G ▂▄▆█ &nbsp;100% ▮</span></div>';
function NAV(title, sub) { return '<div class="p-navbar"><span class="bk">‹</span><span class="tt">' + title + (sub ? '<small>' + sub + '</small>' : '') + '</span><span class="mo">···</span></div>'; }
function R(id, l, v, cls) { return '<div class="p-row' + (cls ? ' ' + cls : '') + '"' + (id ? ' data-el="' + id + '"' : '') + '><span class="l">' + l + '</span><span class="v">' + v + '</span></div>'; }
function SEC(t) { return '<div class="p-sec">' + t + '</div>'; }
function BTN(id, t, cls) { return '<div class="p-btn ' + (cls || '') + '"' + (id ? ' data-el="' + id + '"' : '') + '>' + t + '</div>'; }
function NOTE(t) { return '<div class="p-note">' + t + '</div>'; }
function INP(id, l, v, ph) { return '<div class="p-input"' + (id ? ' data-el="' + id + '"' : '') + '><div class="l">' + l + '</div><div class="f">' + (v ? v : '<span class="ph">' + (ph || '') + '</span>') + '</div></div>'; }
function SEG(id, opts, on) { return '<div class="p-seg"' + (id ? ' data-el="' + id + '"' : '') + '>' + opts.map(function (o, i) { return '<span class="' + (i === on ? 'on' : '') + '">' + o + '</span>'; }).join('') + '</div>'; }
function KV(items) { return '<div class="p-kv">' + items.map(function (it) { return '<div class="c"' + (it[2] ? ' data-el="' + it[2] + '"' : '') + '><div class="k">' + it[0] + '</div><div class="w">' + it[1] + '</div></div>'; }).join('') + '</div>'; }
function CHECK(t, sub) { return '<div class="p-checkwrap"><div class="p-check" data-el="check">✓</div><div class="p-ct">' + t + '</div><div class="p-cs">' + (sub || '') + '</div></div>'; }
function up(v) { return '<span class="up">' + v + '</span>'; }
function dn(v) { return '<span class="dn">' + v + '</span>'; }

/* ---------- 场景数据 ---------- */
var SIM_SCN = [

/* ============ 1. IBKR 账户总览与持仓 ============ */
{
  id: "ibkr_acct", th: "ibkr", ic: "💼",
  app: "盈透证券 IBKR", title: "账户总览与持仓",
  desc: "看懂账户页每一个数字:净值/购买力/浮盈浮亏",
  state: {},
  screens: {
    acct: function () {
      return SB
        + '<div class="p-logo"><b class="ibkr-mark">IBKR</b><span>Account · U7654321</span></div>'
        + '<div class="p-big" data-el="netliq"><div class="k">Net Liquidation Value</div><div class="n">$128,540.32</div><div class="d">' + up('+1,284.20 (+1.01%) today') + '</div></div>'
        + SEC('BALANCES')
        + R('avail', 'Available Funds', '$42,180.55')
        + R('bp', 'Buying Power', '$168,722.20')
        + R('cash', 'Cash Balance', '$38,412.10')
        + SEC('MARGIN')
        + R('excess', 'Excess Liquidity', '$96,300.44')
        + R('mm', 'Maintenance Margin', '$32,240.18')
        + SEC('ACCRUALS')
        + R('accr', 'Interest Accruals', '$12.44')
        + R('divs', 'Accrued Dividends', '$86.00')
        + '<div class="p-tabspace"></div>'
        + '<div class="p-tabs"><div class="p-tab">⌂<i>Home</i></div><div class="p-tab">☆<i>Watchlist</i></div><div class="p-tab" data-el="tab-port">◫<i>Portfolio</i></div><div class="p-tab">≣<i>Orders</i></div><div class="p-tab on">◍<i>Account</i></div></div>';
    },
    port: function () {
      function pos(id, sym, name, qty, last, mv, pl, plc) {
        return '<div class="p-pos"' + (id ? ' data-el="' + id + '"' : '') + '><div class="a"><b>' + sym + '</b><i>' + qty + ' shares · ' + name + '</i></div><div class="b">' + last + '</div><div class="c"><b>' + mv + '</b><i class="' + plc + '">' + pl + '</i></div></div>';
      }
      return SB + NAV('Portfolio', 'U7654321')
        + '<div class="p-duo"><div class="c" data-el="dpl"><div class="k">Daily P&amp;L</div><div class="w up">+$1,284.20</div></div><div class="c" data-el="upl"><div class="k">Unrealized P&amp;L</div><div class="w up">+$9,412.36</div></div></div>'
        + SEC('POSITIONS (4)')
        + pos('pos-aapl', 'AAPL', 'Apple Inc', 50, '213.25', '$10,662.50', '+1,120.50', 'up')
        + pos('', 'NVDA', 'NVIDIA Corp', 24, '172.40', '$4,137.60', '+842.16', 'up')
        + pos('', 'TSLA', 'Tesla Inc', 10, '318.90', '$3,189.00', '−215.30', 'dn')
        + pos('', 'VOO', 'Vanguard S&P 500', 12, '585.20', '$7,022.40', '+960.12', 'up')
        + '<div class="p-tabspace"></div>'
        + '<div class="p-tabs"><div class="p-tab">⌂<i>Home</i></div><div class="p-tab">☆<i>Watchlist</i></div><div class="p-tab on">◫<i>Portfolio</i></div><div class="p-tab">≣<i>Orders</i></div><div class="p-tab">◍<i>Account</i></div></div>';
    },
    detail: function () {
      return SB + NAV('AAPL', 'Apple Inc · NASDAQ')
        + '<div class="p-big"><div class="k">Position Value</div><div class="n">$10,662.50</div><div class="d">' + up('+1,120.50 (+11.7%)') + '</div></div>'
        + SEC('POSITION')
        + R('', 'Position', '50 shares')
        + R('avg', 'Average Cost', '$190.84')
        + R('mv', 'Market Value', '$10,662.50')
        + R('cb', 'Cost Basis', '$9,542.00')
        + SEC('P&L')
        + R('uplr', 'Unrealized P&L', up('+$1,120.50'))
        + R('rpl', 'Realized P&L (YTD)', up('+$356.20'))
        + '<div class="p-btnrow">' + BTN('btn-buy2', 'Buy', 'blue') + BTN('btn-sell', 'Sell', 'red') + '</div>';
    }
  },
  steps: [
    { scr: "acct", el: "netliq", term: "Net Liquidation Value", phon: "net ˌlɪkwɪˈdeɪʃn ˈvæljuː", cn: "净清算价值", exp: "把账户里所有股票、现金按当前市价全部折算后的总价值,也就是你在券商的“真实身家”。IBKR 账户页第一眼看它。" },
    { scr: "acct", el: "avail", term: "Available Funds", phon: "əˈveɪləbl fʌndz", cn: "可用资金", exp: "现在马上可以拿来开新仓的钱。它 = 权益 − 已占用的保证金,买入前先看它够不够。" },
    { scr: "acct", el: "bp", term: "Buying Power", phon: "ˈbaɪɪŋ ˈpaʊər", cn: "购买力", exp: "算上融资杠杆之后你最多能买入的金额。保证金账户里它通常比可用资金大好几倍——数字大不等于你的钱多,用满就是加杠杆。" },
    { scr: "acct", el: "cash", term: "Cash Balance", phon: "kæʃ ˈbæləns", cn: "现金余额", exp: "账户里躺着的现金部分。为负数说明你在用融资(欠券商钱,要付利息)。" },
    { scr: "acct", el: "excess", term: "Excess Liquidity", phon: "ɪkˈses lɪˈkwɪdəti", cn: "剩余流动性", exp: "距离强制平仓的“安全垫”。这个数字一旦归零,IBKR 会自动强平你的持仓,不发 Margin Call 先斩后奏——盯紧它!" },
    { scr: "acct", el: "mm", term: "Maintenance Margin", phon: "ˈmeɪntənəns ˈmɑːrdʒɪn", cn: "维持保证金", exp: "维持当前持仓必须押着的最低资金。剩余流动性 = 权益 − 维持保证金。" },
    { scr: "acct", el: "accr", term: "Interest Accruals", phon: "ˈɪntrəst əˈkruːəlz", cn: "应计利息", exp: "闲置现金赚到的、或融资欠下的利息,按日累计月底结算。旁边 Accrued Dividends 是已宣派未到账的股息。" },
    { scr: "acct", el: "tab-port", tap: 1, term: "Portfolio", phon: "pɔːrtˈfoʊlioʊ", cn: "投资组合", exp: "你持有的全部资产的集合。底部导航栏几乎每个投资App都有这个词。", note: "👆 点击底部 Portfolio 标签,查看持仓列表" },
    { scr: "port", el: "dpl", term: "Daily P&L", phon: "ˈdeɪli piː ən el", cn: "当日盈亏", exp: "P&L = Profit and Loss(盈利与亏损)。这里显示今天一天账户赚/亏了多少,绿色为赚、红色为亏。" },
    { scr: "port", el: "upl", term: "Unrealized P&L", phon: "ˌʌnˈriːəlaɪzd piː ən el", cn: "未实现盈亏(浮盈浮亏)", exp: "持仓还没卖出,账面上的赚亏。俗称“浮盈/浮亏”——没卖出前都只是纸面富贵。" },
    { scr: "port", el: "pos-aapl", tap: 1, term: "Position", phon: "pəˈzɪʃn", cn: "持仓;头寸", exp: "每一行是一只持仓:代码、股数、现价、市值和浮动盈亏。点开看明细。", note: "👆 点击 AAPL 这一行,查看持仓详情" },
    { scr: "detail", el: "avg", term: "Average Cost", phon: "ˈævərɪdʒ kɔːst", cn: "平均成本", exp: "多次买入摊平后的每股平均买入价。现价高于它=赚,低于它=亏。" },
    { scr: "detail", el: "mv", term: "Market Value", phon: "ˈmɑːrkɪt ˈvæljuː", cn: "市值", exp: "这笔持仓按现价算值多少钱 = 股数 × 最新价。" },
    { scr: "detail", el: "cb", term: "Cost Basis", phon: "kɔːst ˈbeɪsɪs", cn: "成本基础", exp: "当初买入总共花的钱(含手续费),报税算盈亏就用它。市值 − 成本基础 = 未实现盈亏。" },
    { scr: "detail", el: "rpl", term: "Realized P&L", phon: "ˈriːəlaɪzd piː ən el", cn: "已实现盈亏", exp: "已经卖出、真正落袋的盈亏。YTD = Year To Date,今年以来。报税看的就是 Realized。" },
    { scr: "detail", el: "btn-sell", term: "Buy / Sell", phon: "baɪ / sel", cn: "买入 / 卖出", exp: "详情页底部随时可以加仓(Buy)或减仓(Sell)。本课完成!下一课手把手教你下一张限价单。" }
  ]
},

/* ============ 2. IBKR 限价单买入全流程 ============ */
{
  id: "ibkr_buy", th: "ibkr", ic: "📈",
  app: "盈透证券 IBKR", title: "限价单买入 AAPL 全流程",
  desc: "搜索→行情→下单→预览→提交→成交,一步不落",
  state: { filled: 0 },
  screens: {
    search: function () {
      return SB + '<div class="p-logo"><b class="ibkr-mark">IBKR</b><span>Trade</span></div>'
        + '<div class="p-search" data-el="srch">🔍 <b>AAPL</b><span class="cur">|</span></div>'
        + SEC('RESULTS')
        + '<div class="p-pos" data-el="res"><div class="a"><b>AAPL</b><i>Apple Inc · NASDAQ · USD</i></div><div class="c"><b>213.25</b><i class="up">+1.01%</i></div></div>'
        + '<div class="p-pos"><div class="a"><b>APLE</b><i>Apple Hospitality REIT · NYSE</i></div><div class="c"><b>14.82</b><i class="dn">−0.20%</i></div></div>';
    },
    quote: function () {
      return SB + NAV('AAPL', 'Apple Inc · NASDAQ')
        + '<div class="p-big" data-el="last"><div class="k">Last</div><div class="n">213.25</div><div class="d" data-el="chg">' + up('▲ +2.14 (+1.01%)') + '</div></div>'
        + '<div class="p-duo"><div class="c" data-el="bid"><div class="k">Bid × Size</div><div class="w">213.24 <i>×300</i></div></div><div class="c" data-el="ask"><div class="k">Ask × Size</div><div class="w">213.26 <i>×500</i></div></div></div>'
        + KV([["Open", "211.40"], ["High", "214.02"], ["Low", "210.88"], ["Prev Close", "211.11"], ["Volume", "48.2M", "vol"], ["Avg Vol", "55.1M"], ["Mkt Cap", "3.18T"], ["P/E", "33.4", "pe"], ["EPS", "6.38"], ["52W High", "260.10", "w52"], ["52W Low", "169.21"], ["Div Yield", "0.47%"]])
        + '<div class="p-btnrow">' + BTN('btn-sell2', 'Sell', 'red') + BTN('btn-buy', 'Buy', 'blue') + '</div>';
    },
    ticket: function () {
      return SB + NAV('Order Ticket', 'BUY AAPL · Apple Inc')
        + '<div class="p-sheetbar"></div>'
        + SEC('ORDER')
        + '<div class="p-input" data-el="qty"><div class="l">Quantity</div><div class="f">10 <span class="stp">−</span><span class="stp">+</span></div></div>'
        + '<div class="p-input" data-el="otype"><div class="l">Order Type</div><div class="f">' + SEG('', ['MKT', 'LMT', 'STP'], 1) + '</div></div>'
        + INP('lmt', 'Limit Price', '212.50')
        + '<div class="p-input" data-el="tif"><div class="l">Time-in-Force</div><div class="f">' + SEG('', ['DAY', 'GTC'], 1) + '</div></div>'
        + R('', 'Outside RTH', '<span class="p-toggle"></span>')
        + SEC('ESTIMATE')
        + R('est', 'Amount', '$2,125.00')
        + R('comm', 'Commission (est.)', '$1.00')
        + '<div class="p-btnrow">' + BTN('btn-prev', 'Preview', 'blue') + '</div>';
    },
    preview: function () {
      return SB + NAV('Preview Order', 'BUY 10 AAPL LMT 212.50')
        + SEC('ORDER DETAILS')
        + R('', 'Action', '<b class="up">BUY</b>')
        + R('', 'Quantity', '10')
        + R('', 'Order Type', 'Limit (LMT)')
        + R('', 'Limit Price', '212.50')
        + R('', 'Time-in-Force', 'GTC')
        + SEC('COST')
        + R('total', 'Estimated Total', '$2,126.00')
        + R('', 'Commission (est.)', '$1.00')
        + SEC('MARGIN IMPACT')
        + R('marg', 'Init. Margin Change', '+$531.25')
        + R('', 'Equity with Loan', '$128,540 → $128,539')
        + '<div class="p-btnrow">' + BTN('btn-submit', 'Slide to Submit Order ≫', 'blue') + '</div>';
    },
    status: function (S) {
      return SB + NAV('Orders', 'Working & Filled')
        + '<div class="p-card"><div class="p-ordhead"><b>BUY 10 AAPL</b><span class="p-badge ' + (S.filled ? 'ok' : '') + '" data-el="badge">' + (S.filled ? '✓ FILLED' : '⏳ SUBMITTED') + '</span></div>'
        + R('', 'Type', 'LMT 212.50 · GTC')
        + (S.filled
          ? R('fill', 'Filled', '10 / 10 @ <b>212.48</b>') + R('', 'Avg Fill Price', '212.48') + R('', 'Commission', '$1.00')
          : R('fill', 'Filled', '0 / 10') + R('', 'Status', 'Working at exchange'))
        + '</div>'
        + (S.filled ? CHECK('Order Filled', 'Bought 10 AAPL @ 212.48') : NOTE('Waiting for the market to reach your limit price…'));
    }
  },
  steps: [
    { scr: "search", el: "srch", term: "Symbol Search", phon: "ˈsɪmbl sɜːrtʃ", cn: "搜索股票代码", exp: "美股用代码(Ticker)交易:苹果=AAPL,英伟达=NVDA,特斯拉=TSLA。在搜索框输入代码或公司名。", say: "Symbol search" },
    { scr: "search", el: "res", tap: 1, term: "Ticker Symbol", phon: "ˈtɪkər ˈsɪmbl", cn: "股票代码", exp: "注意别选错:AAPL 是苹果公司,APLE 是一家酒店房地产。核对交易所(NASDAQ)和公司全名再点。", note: "👆 点击 AAPL · Apple Inc,进入行情页" },
    { scr: "quote", el: "last", term: "Last Price", phon: "læst praɪs", cn: "最新价", exp: "最近一笔成交的价格,也是K线图上跳动的那个数。" },
    { scr: "quote", el: "chg", term: "Change %", phon: "tʃeɪndʒ pərˈsent", cn: "涨跌幅", exp: "相对昨收价(Prev Close)的变化。美股绿涨红跌,和A股正好相反!" },
    { scr: "quote", el: "bid", term: "Bid", phon: "bɪd", cn: "买价(买一)", exp: "当前买方愿意出的最高价。×300 表示这个价位挂着300股买单。你“市价卖出”时大概率成交在 Bid。" },
    { scr: "quote", el: "ask", term: "Ask", phon: "æsk", cn: "卖价(卖一)", exp: "卖方要的最低价。Bid 和 Ask 之间的差叫 Spread(价差),越小说明流动性越好。市价买单会成交在 Ask。" },
    { scr: "quote", el: "vol", term: "Volume", phon: "ˈvɑːljuːm", cn: "成交量", exp: "今天已成交的股数,48.2M = 4820万股。放量+突破往往才可信。" },
    { scr: "quote", el: "pe", term: "P/E Ratio", phon: "piː iː ˈreɪʃioʊ", cn: "市盈率", exp: "股价 ÷ 每股收益(EPS),衡量股价贵不贵最常用的指标。33.4 意味着按当前盈利水平,33年回本。" },
    { scr: "quote", el: "w52", term: "52 Week High / Low", phon: "ˈfɪfti tuː wiːk haɪ loʊ", cn: "52周最高/最低", exp: "过去一年的价格区间,判断当前处于高位还是低位的快速参照。" },
    { scr: "quote", el: "btn-buy", tap: 1, term: "Buy", phon: "baɪ", cn: "买入", exp: "蓝色 Buy 买入,红色 Sell 卖出。点击后弹出下单页(Order Ticket)。", note: "👆 点击 Buy,弹出下单面板" },
    { scr: "ticket", up: 1, el: "qty", term: "Quantity", phon: "ˈkwɑːntəti", cn: "数量(股数)", exp: "买多少股。美股大多可以只买 1 股,IBKR 还支持小数股(Fractional Shares)。这里买 10 股。" },
    { scr: "ticket", el: "otype", term: "Order Type: Limit", phon: "ˈlɪmɪt ˈɔːrdər", cn: "订单类型:限价单", exp: "MKT市价单=立即按市场价成交;LMT限价单=指定价格,到价才成交;STP止损单=跌破触发价自动卖。新手强烈建议用限价单,不怕滑点买贵。" },
    { scr: "ticket", el: "lmt", term: "Limit Price", phon: "ˈlɪmɪt praɪs", cn: "限价", exp: "你愿意成交的最高买价。现价 213.25,我们挂 212.50,等它回调到这个价自动买入,买不到也不亏。" },
    { scr: "ticket", el: "tif", term: "Time-in-Force: GTC", phon: "taɪm ɪn fɔːrs", cn: "订单有效期:撤单前有效", exp: "DAY=当日有效,收盘没成交自动作废;GTC = Good-Til-Canceled,一直挂着直到成交或你手动撤单。" },
    { scr: "ticket", el: "est", term: "Estimated Cost", phon: "ˈestɪmeɪtɪd kɔːst", cn: "预计金额", exp: "10股 × 212.50 = $2,125,加上约 $1 佣金(Commission)。IBKR 美股佣金每股 $0.005、最低 $1。" },
    { scr: "ticket", el: "btn-prev", tap: 1, term: "Preview", phon: "ˈpriːvjuː", cn: "预览订单", exp: "提交前最后核对一遍。好习惯:永远先 Preview 再 Submit。", note: "👆 点击 Preview,核对订单明细" },
    { scr: "preview", el: "marg", term: "Margin Impact", phon: "ˈmɑːrdʒɪn ˈɪmpækt", cn: "保证金影响", exp: "这笔订单会占用多少初始保证金(Initial Margin)。占用过多会压缩你的剩余流动性,离强平更近。" },
    { scr: "preview", el: "btn-submit", tap: 1, term: "Submit Order", phon: "səbˈmɪt ˈɔːrdər", cn: "提交订单", exp: "滑动确认,订单发往交易所。", note: "👆 滑动 Submit Order,正式下单" },
    { scr: "status", el: "badge", term: "Submitted / Working", phon: "səbˈmɪtɪd / ˈwɜːrkɪŋ", cn: "已提交 / 挂单中", exp: "订单已到交易所排队,等价格触及 212.50。Filled 0/10 表示还没成交。GTC 单可以一直等。" },
    { scr: "status", el: "badge", set: { filled: 1 }, re: 1, term: "Filled", phon: "fɪld", cn: "已成交", exp: "成交回报!10/10 @ 212.48 —— 全部10股在 212.48 成交,比限价还便宜2美分(价格改善)。恭喜,你完成了第一笔限价单!", say: "Order filled. You bought ten shares of Apple at two hundred twelve dollars forty eight." }
  ]
},

/* ============ 3. 汇丰香港 FPS 转数快 ============ */
{
  id: "hsbc_fps", th: "hsbc", ic: "🇭🇰",
  app: "HSBC HK 汇丰香港", title: "FPS 转数快即时转账",
  desc: "手机号转账、免手续费、秒到账的香港国民操作",
  state: {},
  screens: {
    login: function () {
      return SB + '<div class="p-logo hsbc"><b class="hsbc-mark">◣◥</b><b>HSBC</b><span>Hong Kong</span></div>'
        + '<div class="p-hero">Log on to Mobile Banking</div>'
        + INP('user', 'Username', 'chan****man')
        + '<div class="p-faceid" data-el="faceid"><div class="ring"></div>👤<div class="t">Log on with Face ID</div></div>'
        + '<div class="p-btnrow">' + BTN('btn-logon', 'Log on', 'hsbcred') + '</div>'
        + NOTE('🔒 Never share your password or security code.');
    },
    home: function () {
      return SB + '<div class="p-logo hsbc"><b class="hsbc-mark">◣◥</b><b>HSBC</b><span>Good morning, CHAN TAI MAN</span></div>'
        + SEC('MY ACCOUNTS')
        + '<div class="p-card acc" data-el="card1"><div class="t">HKD Savings <span>•••• 668</span></div><div class="n" data-el="bal">HKD 45,280.50</div><div class="s">Available Balance</div></div>'
        + '<div class="p-card acc" data-el="card2"><div class="t">HSBC One <span>•••• 021</span></div><div class="n">HKD 128,660.00</div><div class="s">Available Balance</div></div>'
        + SEC('QUICK ACTIONS')
        + '<div class="p-grid4">'
        + '<div class="g" data-el="qa-pay">💸<i>Pay &amp; Transfer</i></div>'
        + '<div class="g">🌏<i>Global Transfer</i></div>'
        + '<div class="g">📲<i>PayMe</i></div>'
        + '<div class="g" data-el="qa-dep">🏦<i>Deposits</i></div>'
        + '</div>';
    },
    payee: function () {
      return SB + NAV('Pay & Transfer', 'New payment')
        + SEC('TRANSFER TO')
        + '<div class="p-input" data-el="ptab"><div class="l">Payee identifier</div><div class="f">' + SEG('', ['Mobile', 'FPS ID', 'Email', 'Account'], 0) + '</div></div>'
        + INP('mob', 'Mobile Number', '+852 9128 4455')
        + '<div class="p-card lite" data-el="resolved"><div class="t">Payee found</div><div class="n" style="font-size:2.5vmin">W** K* Y**</div><div class="s">Hang Seng Bank · 恒生银行</div></div>'
        + '<div class="p-fps" data-el="fps">⚡ via <b>FPS</b> · Faster Payment System 转数快<br><span>Instant · 24/7 · Free for HKD</span></div>'
        + '<div class="p-btnrow">' + BTN('btn-next', 'Continue', 'hsbcred') + '</div>';
    },
    amount: function () {
      return SB + NAV('Pay & Transfer', 'Amount')
        + INP('amt', 'Amount', 'HKD 800.00')
        + R('from', 'From', 'HKD Savings •••• 668')
        + R('fee', 'Fee', '<b class="up">Free</b>')
        + INP('ref', 'Reference (optional)', 'Dinner 🍜')
        + R('limit', 'Daily limit remaining', 'HKD 9,200.00')
        + NOTE('Transfers to new payees may take up to 24 hours to take effect for security reasons.')
        + '<div class="p-btnrow">' + BTN('btn-review', 'Review', 'hsbcred') + '</div>';
    },
    review: function () {
      return SB + NAV('Review & Confirm', '')
        + SEC('PAYEE')
        + R('', 'Name', 'W** K* Y**')
        + R('', 'Bank', 'Hang Seng Bank')
        + R('', 'Mobile', '+852 9128 4455')
        + SEC('PAYMENT')
        + R('', 'Amount', '<b>HKD 800.00</b>')
        + R('', 'From', 'HKD Savings •••• 668')
        + R('method', 'Method', '⚡ FPS · Instant')
        + R('', 'Fee', 'Free')
        + R('', 'Reference', 'Dinner 🍜')
        + '<div class="p-btnrow">' + BTN('btn-confirm', 'Confirm', 'hsbcred') + '</div>';
    },
    done: function () {
      return SB + NAV('Transfer', '')
        + CHECK('Transfer submitted', 'HKD 800.00 sent instantly via FPS')
        + R('', 'Transaction reference', 'FPS2607131234')
        + R('', 'Date', '13 Jul 2026 · 09:41')
        + '<div class="p-btnrow">' + BTN('receipt', 'Save e-Receipt', 'ghost') + BTN('', 'Done', 'hsbcred') + '</div>';
    }
  },
  steps: [
    { scr: "login", el: "user", term: "Username", phon: "ˈjuːzərneɪm", cn: "用户名", exp: "登录名。银行App会脱敏显示(chan****man),防止旁人偷看。" },
    { scr: "login", el: "faceid", term: "Face ID", phon: "feɪs aɪ diː", cn: "面容识别", exp: "生物识别(Biometrics)登录:刷脸或指纹(Fingerprint),比密码更安全也更快。", say: "Log on with Face ID" },
    { scr: "login", el: "btn-logon", tap: 1, term: "Log on", phon: "lɔːɡ ɑːn", cn: "登录", exp: "英式银行爱用 Log on / Log off,美式App多用 Sign in / Sign out,意思一样。", note: "👆 点击 Log on 登录" },
    { scr: "home", el: "card1", term: "Savings Account", phon: "ˈseɪvɪŋz əˈkaʊnt", cn: "储蓄账户", exp: "•••• 668 是账号末几位。香港账户常见还有 Current Account(往来/支票户)和综合户口。" },
    { scr: "home", el: "bal", term: "Available Balance", phon: "əˈveɪləbl ˈbæləns", cn: "可用余额", exp: "扣掉冻结、未入账部分后真正能动用的钱。和 Current Balance(当前余额)可能不一样。" },
    { scr: "home", el: "card2", term: "HSBC One", phon: "eɪtʃ es biː siː wʌn", cn: "汇丰One综合户口", exp: "港元、外币、投资一体的综合账户(Integrated Account)。升级版有 Premier(卓越理财)。" },
    { scr: "home", el: "qa-pay", tap: 1, term: "Pay & Transfer", phon: "peɪ ənd trænsˈfɜːr", cn: "支付与转账", exp: "所有转账入口都在这:本地转账、FPS、跨境汇款(Global Transfer)。", note: "👆 点击 Pay & Transfer" },
    { scr: "payee", el: "ptab", term: "Proxy ID", phon: "ˈprɑːksi aɪ diː", cn: "代理识别码", exp: "FPS 的杀手锏:不用记对方账号,用手机号 / FPS ID / 邮箱任意一个就能收款,这些统称 Proxy ID。" },
    { scr: "payee", el: "mob", term: "Mobile Number", phon: "ˈmoʊbaɪl ˈnʌmbər", cn: "手机号码", exp: "输入对方绑定了FPS的手机号,系统自动找到他的收款银行。" },
    { scr: "payee", el: "resolved", term: "Payee", phon: "peɪˈiː", cn: "收款人", exp: "系统返回脱敏姓名 W** K* Y** 和收款银行。转账前务必核对姓名,防止转错人——这是防骗第一关!" },
    { scr: "payee", el: "fps", term: "FPS · Faster Payment System", phon: "ˈfæstər ˈpeɪmənt ˈsɪstəm", cn: "转数快", exp: "香港金管局的实时支付系统:全年无休、秒级到账、港币小额转账免费。日常吃饭AA、交租全靠它。", say: "Faster Payment System" },
    { scr: "payee", el: "btn-next", tap: 1, term: "Continue", phon: "kənˈtɪnjuː", cn: "继续", exp: "下一步填金额。", note: "👆 点击 Continue" },
    { scr: "amount", el: "amt", term: "Amount", phon: "əˈmaʊnt", cn: "金额", exp: "转 HKD 800。注意货币代码:HKD港币 / USD美元 / SGD新元 / CNY人民币。" },
    { scr: "amount", el: "fee", term: "Fee: Free", phon: "fiː", cn: "手续费:免费", exp: "FPS 港币转账银行基本全免手续费。跨境汇款才会有 Handling Fee(手续费)和电报费。" },
    { scr: "amount", el: "ref", term: "Reference", phon: "ˈrefrəns", cn: "附言/备注", exp: "给这笔转账写个说明,对方账单上能看到。查账对账全靠它。" },
    { scr: "amount", el: "limit", term: "Daily Transfer Limit", phon: "ˈdeɪli trænsˈfɜːr ˈlɪmɪt", cn: "每日转账限额", exp: "为安全设置的单日上限,超过要去设置里调整并二次验证。给陌生收款人转账限额更低。" },
    { scr: "amount", el: "btn-review", tap: 1, term: "Review", phon: "rɪˈvjuː", cn: "核对", exp: "去最后确认页。", note: "👆 点击 Review 核对信息" },
    { scr: "review", el: "method", term: "Instant", phon: "ˈɪnstənt", cn: "即时到账", exp: "FPS 转账是 Instant(即时)的——点下确认,对方几秒内就收到。" },
    { scr: "review", el: "btn-confirm", tap: 1, term: "Confirm", phon: "kənˈfɜːrm", cn: "确认", exp: "最后一步,确认后立即执行、无法撤回。所以前面每一步核对都很重要。", note: "👆 点击 Confirm 完成转账" },
    { scr: "done", el: "check", term: "Transfer submitted", phon: "trænsˈfɜːr səbˈmɪtɪd", cn: "转账已提交", exp: "成功!FPS 秒到账。Transaction Reference(交易参考号)是这笔交易的唯一编号,有纠纷时报这个号。", say: "Transfer submitted successfully" },
    { scr: "done", el: "receipt", term: "e-Receipt", phon: "iː rɪˈsiːt", cn: "电子回单", exp: "电子凭证,可保存或分享给对方作为付款证明。本课完成!" }
  ]
},

/* ============ 4. 汇丰香港 定期存款 ============ */
{
  id: "hsbc_td", th: "hsbc", ic: "💰",
  app: "HSBC HK 汇丰香港", title: "开一笔定期存款",
  desc: "Tenor·p.a.·Maturity,存款单里的英文一次搞懂",
  state: {},
  screens: {
    list: function () {
      return SB + NAV('Deposits', '')
        + '<div class="p-card lite" data-el="td"><div class="t">Time Deposits</div><div class="n" style="font-size:2.4vmin">Lock in today’s rates</div><div class="s">Earn guaranteed interest</div></div>'
        + SEC('HKD BOARD RATES (P.A.)')
        + '<div class="p-kv" data-el="rates"><div class="c"><div class="k">1 Month</div><div class="w">3.60%</div></div><div class="c"><div class="k">3 Months</div><div class="w">3.80%</div></div><div class="c"><div class="k">6 Months</div><div class="w">3.55%</div></div><div class="c"><div class="k">12 Months</div><div class="w">3.30%</div></div></div>'
        + NOTE('Rates are indicative and subject to change without prior notice.')
        + '<div class="p-btnrow">' + BTN('btn-open', 'New Time Deposit', 'hsbcred') + '</div>';
    },
    form: function () {
      return SB + NAV('New Time Deposit', '')
        + '<div class="p-input" data-el="ccy"><div class="l">Currency</div><div class="f">' + SEG('', ['HKD', 'USD', 'CNY'], 0) + '</div></div>'
        + INP('principal', 'Principal Amount', 'HKD 50,000.00')
        + '<div class="p-input" data-el="tenor"><div class="l">Tenor</div><div class="f">' + SEG('', ['1M', '3M', '6M', '12M'], 1) + '</div></div>'
        + R('rate', 'Interest Rate', '<b>3.80% p.a.</b>')
        + R('value', 'Value Date', '13 Jul 2026')
        + R('maturity', 'Maturity Date', '13 Oct 2026')
        + R('interest', 'Interest at Maturity', '<b class="up">HKD 475.00</b>')
        + '<div class="p-input" data-el="instr"><div class="l">Maturity Instruction</div><div class="f" style="font-size:2vmin">Renew principal + interest ▾</div></div>'
        + '<div class="p-btnrow">' + BTN('btn-c', 'Continue', 'hsbcred') + '</div>';
    },
    confirm2: function () {
      return SB + NAV('Review & Confirm', '')
        + SEC('TIME DEPOSIT')
        + R('', 'From', 'HKD Savings •••• 668')
        + R('', 'Principal', 'HKD 50,000.00')
        + R('', 'Tenor', '3 Months')
        + R('', 'Rate', '3.80% p.a.')
        + R('', 'Maturity', '13 Oct 2026')
        + R('', 'Interest', 'HKD 475.00')
        + R('', 'At maturity', 'Renew principal + interest')
        + NOTE('Early withdrawal is normally not allowed, or interest will be forfeited.')
        + '<div class="p-btnrow">' + BTN('btn-c2', 'Confirm', 'hsbcred') + '</div>';
    },
    done2: function () {
      return SB + NAV('Time Deposit', '')
        + CHECK('Deposit set up', 'HKD 50,000.00 · 3 Months @ 3.80% p.a.')
        + R('depno', 'Deposit Number', 'TD-88231-668')
        + R('', 'Maturity Date', '13 Oct 2026')
        + '<div class="p-btnrow">' + BTN('', 'Done', 'hsbcred') + '</div>';
    }
  },
  steps: [
    { scr: "list", el: "td", term: "Time Deposit", phon: "taɪm dɪˈpɑːzɪt", cn: "定期存款", exp: "把钱锁定一段时间换取更高利息。美式英语叫 Fixed Deposit 或 CD(Certificate of Deposit),香港App两种叫法都常见。" },
    { scr: "list", el: "rates", term: "p.a. (per annum)", phon: "pɜːr ˈænəm", cn: "年利率(按年计)", exp: "所有利率后面的 p.a. = per annum(拉丁语“每年”)。3.80% p.a. 存3个月,实际利息约 = 本金 × 3.80% × 92/365,不是直接3.8%!" },
    { scr: "list", el: "btn-open", tap: 1, term: "New Time Deposit", phon: "njuː taɪm dɪˈpɑːzɪt", cn: "新开定期", exp: "注意牌价:3个月 3.80% 比 12个月 3.30% 还高,这叫利率倒挂,市场预期未来降息。", note: "👆 点击 New Time Deposit" },
    { scr: "form", el: "ccy", term: "Currency", phon: "ˈkɜːrənsi", cn: "币种", exp: "港币/美元/人民币利率各不相同,美元定存利率通常最高,但要承担汇率波动。" },
    { scr: "form", el: "principal", term: "Principal", phon: "ˈprɪnsəpl", cn: "本金", exp: "存入的本钱。注意拼写:principal(本金/校长) vs principle(原则)。" },
    { scr: "form", el: "tenor", term: "Tenor", phon: "ˈtenər", cn: "存期/期限", exp: "定存的期限:1M/3M/6M/12M(M=Month)。也叫 Term。选 3M。" },
    { scr: "form", el: "value", term: "Value Date", phon: "ˈvæljuː deɪt", cn: "起息日", exp: "从哪天开始计息。今天存,今天起息。" },
    { scr: "form", el: "maturity", term: "Maturity Date", phon: "məˈtʃʊrəti deɪt", cn: "到期日", exp: "定存到期的日子。到期前取出叫 Early Withdrawal(提前支取),通常会没收利息(interest forfeited)。" },
    { scr: "form", el: "interest", term: "Interest at Maturity", phon: "ˈɪntrəst ət məˈtʃʊrəti", cn: "到期利息", exp: "到期能拿到的利息:50,000 × 3.80% × 92/365 ≈ HKD 475。" },
    { scr: "form", el: "instr", term: "Maturity Instruction", phon: "məˈtʃʊrəti ɪnˈstrʌkʃn", cn: "到期指示", exp: "到期后钱怎么办:Renew(本息自动续存)/ 只续本金 / 全部转回储蓄户。不设置的话很多银行默认自动续存,想用钱要留意。" },
    { scr: "form", el: "btn-c", tap: 1, term: "Continue", phon: "kənˈtɪnjuː", cn: "继续", exp: "去确认页。", note: "👆 点击 Continue" },
    { scr: "confirm2", el: "btn-c2", tap: 1, term: "Confirm", phon: "kənˈfɜːrm", cn: "确认", exp: "核对本金、期限、利率、到期日,确认开立。", note: "👆 点击 Confirm 开立定存" },
    { scr: "done2", el: "depno", term: "Deposit Number", phon: "dɪˈpɑːzɪt ˈnʌmbər", cn: "存单编号", exp: "这笔定存的唯一编号。开立成功!到期日记得回来决定续不续。本课完成!", say: "Your time deposit has been set up successfully" }
  ]
},

/* ============ 5. DBS 星展新加坡 PayNow ============ */
{
  id: "dbs_paynow", th: "dbs", ic: "🇸🇬",
  app: "DBS digibank 星展银行", title: "PayNow 即时转账",
  desc: "新加坡版转数快:手机号/NRIC 秒转,数字令牌验证",
  state: {},
  screens: {
    home: function () {
      return SB + '<div class="p-logo dbs"><b class="dbs-mark">DBS</b><span>digibank · Hi, WEI MING</span></div>'
        + SEC('MY ACCOUNTS')
        + '<div class="p-card acc" data-el="acct1"><div class="t">DBS Multiplier Account <span>•••• 552</span></div><div class="n" data-el="bal">SGD 18,652.30</div><div class="s">Available Balance</div></div>'
        + '<div class="p-card acc"><div class="t">My Savings Account <span>•••• 107</span></div><div class="n">SGD 6,210.44</div><div class="s">Available Balance</div></div>'
        + '<div class="p-tabspace"></div>'
        + '<div class="p-tabs"><div class="p-tab on">⌂<i>Home</i></div><div class="p-tab" data-el="tab-pay">⇄<i>Pay &amp; Transfer</i></div><div class="p-tab">📈<i>Invest</i></div><div class="p-tab">💳<i>Cards</i></div><div class="p-tab">☰<i>More</i></div></div>';
    },
    paynow: function () {
      return SB + NAV('PayNow', 'Instant transfer')
        + '<div class="p-input" data-el="seg"><div class="l">Send to</div><div class="f">' + SEG('', ['Mobile', 'NRIC/FIN', 'UEN'], 0) + '</div></div>'
        + INP('mob', 'Mobile Number', '+65 9123 8877')
        + '<div class="p-card lite" data-el="nick"><div class="t">Recipient</div><div class="n" style="font-size:2.5vmin">JASON T.</div><div class="s">PayNow registered · OCBC Bank</div></div>'
        + NOTE('PayNow links a mobile number, NRIC/FIN or UEN to a bank account. No account number needed.')
        + '<div class="p-btnrow">' + BTN('btn-next', 'Next', 'dbsred') + '</div>';
    },
    amt: function () {
      return SB + NAV('PayNow', 'Amount')
        + INP('amt', 'Amount', 'SGD 120.00')
        + R('from', 'From', 'DBS Multiplier •••• 552')
        + INP('msg', 'Message (optional)', 'Lunch @ Maxwell 🍗')
        + R('fee-note', 'Transfer type', '<b class="up">⚡ Instant · No fee</b>')
        + R('', 'Daily PayNow limit left', 'SGD 4,880.00')
        + '<div class="p-btnrow">' + BTN('btn-review', 'Review', 'dbsred') + '</div>';
    },
    review: function () {
      return SB + NAV('Review Transfer', '')
        + SEC('RECIPIENT')
        + R('', 'Name', 'JASON T.')
        + R('', 'Via', 'PayNow · Mobile')
        + R('', 'Bank', 'OCBC Bank')
        + SEC('TRANSFER')
        + R('', 'Amount', '<b>SGD 120.00</b>')
        + R('', 'From', 'DBS Multiplier •••• 552')
        + R('', 'Message', 'Lunch @ Maxwell 🍗')
        + '<div class="p-btnrow">' + BTN('approve', 'Approve with Digital Token', 'dbsred') + '</div>';
    },
    token: function () {
      return SB + NAV('Digital Token', '')
        + '<div class="p-faceid big" data-el="shield"><div class="ring"></div>🛡️<div class="t">Verifying it’s you…</div></div>'
        + NOTE('Your digital token replaces SMS OTP for stronger security. Approve this transaction on this device.');
    },
    done: function () {
      return SB + NAV('PayNow', '')
        + CHECK('Transfer Successful', 'SGD 120.00 sent to JASON T.')
        + R('', 'Reference No.', 'PN26071309411')
        + R('', 'Date', '13 Jul 2026 · 09:41 SGT')
        + '<div class="p-btnrow">' + BTN('share', 'Share Receipt', 'ghost') + BTN('', 'Done', 'dbsred') + '</div>';
    }
  },
  steps: [
    { scr: "home", el: "acct1", term: "Multiplier Account", phon: "ˈmʌltɪplaɪər əˈkaʊnt", cn: "星展Multiplier加息账户", exp: "DBS 招牌账户:工资入账+消费+投资达标,存款利率成倍提升(multiply)。新加坡打工人标配。" },
    { scr: "home", el: "bal", term: "SGD Balance", phon: "es dʒiː diː ˈbæləns", cn: "新元余额", exp: "SGD = Singapore Dollar 新加坡元(坊间叫“新币/坡币”)。" },
    { scr: "home", el: "tab-pay", tap: 1, term: "Pay & Transfer", phon: "peɪ ənd trænsˈfɜːr", cn: "支付与转账", exp: "底部导航第二个,所有付款转账入口。", note: "👆 点击 Pay & Transfer → PayNow" },
    { scr: "paynow", el: "seg", term: "NRIC / FIN", phon: "en ɑːr aɪ siː / fɪn", cn: "新加坡身份证号", exp: "PayNow 支持三种收款ID:手机号、NRIC/FIN(公民/外国人身份证号)、UEN。和香港FPS的 Proxy ID 一个思路。" },
    { scr: "paynow", el: "seg", term: "UEN", phon: "juː iː en", cn: "企业注册号", exp: "Unique Entity Number,新加坡公司的统一编号。给商家/公司付款就选 UEN。" },
    { scr: "paynow", el: "mob", term: "Mobile Number", phon: "ˈmoʊbaɪl ˈnʌmbər", cn: "手机号", exp: "+65 是新加坡区号。输入对方注册了 PayNow 的手机号。" },
    { scr: "paynow", el: "nick", term: "Recipient Nickname", phon: "rɪˈsɪpiənt ˈnɪkneɪm", cn: "收款人昵称", exp: "PayNow 返回对方设置的昵称(JASON T.)和收款银行。昵称对不上就别转——防骗关键一步。" },
    { scr: "paynow", el: "btn-next", tap: 1, term: "Next", phon: "nekst", cn: "下一步", exp: "填金额去。", note: "👆 点击 Next" },
    { scr: "amt", el: "amt", term: "Amount", phon: "əˈmaʊnt", cn: "金额", exp: "SGD 120,转账金额。" },
    { scr: "amt", el: "from", term: "From Account", phon: "frʌm əˈkaʊnt", cn: "扣款账户", exp: "钱从哪个账户扣。多账户时别选错。" },
    { scr: "amt", el: "msg", term: "Message", phon: "ˈmesɪdʒ", cn: "留言", exp: "对方会看到的备注,相当于香港的 Reference。" },
    { scr: "amt", el: "fee-note", term: "Instant · No fee", phon: "ˈɪnstənt noʊ fiː", cn: "即时·免费", exp: "PayNow 走 FAST 系统(Fast And Secure Transfers),新加坡境内即时到账、免手续费。" },
    { scr: "amt", el: "btn-review", tap: 1, term: "Review", phon: "rɪˈvjuː", cn: "核对", exp: "去确认页。", note: "👆 点击 Review" },
    { scr: "review", el: "approve", tap: 1, term: "Digital Token", phon: "ˈdɪdʒɪtl ˈtoʊkən", cn: "数字令牌", exp: "新加坡银行已用手机内置的数字令牌取代短信OTP:更防钓鱼、无需等短信。点击用本机令牌授权。", note: "👆 点击 Approve with Digital Token" },
    { scr: "token", el: "shield", term: "Authenticating", phon: "ɔːˈθentɪkeɪtɪŋ", cn: "身份验证中", exp: "令牌在本机加密验证“确实是你本人”。Authenticate=验证身份,授权是 Authorise。", say: "Authenticating. Verifying it's you." },
    { scr: "done", el: "check", term: "Transfer Successful", phon: "trænsˈfɜːr səkˈsesfl", cn: "转账成功", exp: "秒到!Reference No. 是交易参考号,对账用。", say: "Transfer successful" },
    { scr: "done", el: "share", term: "Share Receipt", phon: "ʃer rɪˈsiːt", cn: "分享回单", exp: "把电子回单发给对方作凭证。本课完成!下一课挑战跨境汇款。" }
  ]
},

/* ============ 6. DBS Remit 跨境汇款 ============ */
{
  id: "dbs_remit", th: "dbs", ic: "🌏",
  app: "DBS digibank 星展银行", title: "DBS Remit 跨境汇款",
  desc: "SWIFT·汇率·手续费,把新元汇到香港全流程",
  state: {},
  screens: {
    setup: function () {
      return SB + NAV('Overseas Transfer', 'DBS Remit')
        + R('dest', 'Send to', '🇭🇰 Hong Kong ▾')
        + R('ccy', 'Recipient receives', '<b>HKD</b> · Hong Kong Dollar ▾')
        + '<div class="p-card lite" data-el="rate"><div class="t">Exchange Rate</div><div class="n" style="font-size:3vmin">1 SGD = 5.8240 HKD</div><div class="s" data-el="lock">🔒 Rate locked for 09:58</div></div>'
        + INP('send', 'You send', 'SGD 1,000.00')
        + INP('recv', 'They receive', 'HKD 5,824.00')
        + R('fee', 'DBS charge', '<b class="up">SGD 0</b> · Agent fee may apply (SHA)')
        + '<div class="p-btnrow">' + BTN('btn-b', 'Add Recipient', 'dbsred') + '</div>';
    },
    bene: function () {
      return SB + NAV('Recipient Details', 'Hong Kong · HKD')
        + INP('bname', 'Beneficiary Name', 'CHAN TAI MAN')
        + INP('bank', 'Beneficiary Bank', 'HSBC Hong Kong')
        + INP('swift', 'SWIFT / BIC Code', 'HSBCHKHHHKH')
        + INP('acc', 'Account Number', '123-456789-833')
        + '<div class="p-input" data-el="purpose"><div class="l">Purpose of Transfer</div><div class="f" style="font-size:2vmin">Family Maintenance ▾</div></div>'
        + '<div class="p-btnrow">' + BTN('btn-b2', 'Review', 'dbsred') + '</div>';
    },
    review: function () {
      return SB + NAV('Review Transfer', '')
        + SEC('RECIPIENT')
        + R('', 'Name', 'CHAN TAI MAN')
        + R('', 'Bank', 'HSBC Hong Kong')
        + R('', 'SWIFT', 'HSBCHKHHHKH')
        + SEC('TRANSFER')
        + R('', 'You send', 'SGD 1,000.00')
        + R('', 'Rate', '1 SGD = 5.8240 HKD')
        + R('', 'They receive', '<b>HKD 5,824.00</b>')
        + R('', 'Fees', 'SGD 0 (SHA)')
        + R('eta', 'Estimated arrival', '⚡ Within the same day')
        + '<div class="p-btnrow">' + BTN('confirm', 'Confirm & Transfer', 'dbsred') + '</div>';
    },
    done: function () {
      return SB + NAV('Overseas Transfer', '')
        + CHECK('Remittance Submitted', 'SGD 1,000.00 → HKD 5,824.00')
        + R('track', 'Status', '<b>Processing</b> · Track transfer →')
        + R('', 'Reference No.', 'RM2607134921')
        + NOTE('You will be notified when the beneficiary bank credits the funds.')
        + '<div class="p-btnrow">' + BTN('', 'Done', 'dbsred') + '</div>';
    }
  },
  steps: [
    { scr: "setup", el: "dest", term: "Overseas Transfer / Remittance", phon: "rɪˈmɪtns", cn: "跨境汇款", exp: "Remit=汇款(动词),Remittance=汇款(名词)。第一步选目的地国家/地区。DBS Remit 对主要币种免手续费、当日到账。", say: "Overseas transfer. Remittance." },
    { scr: "setup", el: "ccy", term: "Foreign Currency", phon: "ˈfɔːrən ˈkɜːrənsi", cn: "外币", exp: "对方收什么币种。汇去香港一般选 HKD;也可以直接汇 USD,看收款账户。" },
    { scr: "setup", el: "rate", term: "Exchange Rate", phon: "ɪksˈtʃeɪndʒ reɪt", cn: "汇率", exp: "1 SGD = 5.8240 HKD。银行给你的汇率里含点差(Spread),比中间价(Mid-market Rate)略差,这是银行的隐形收费。" },
    { scr: "setup", el: "lock", term: "Rate Lock", phon: "reɪt lɑːk", cn: "锁定汇率", exp: "10分钟内按这个价成交,汇率再波动也不影响你。倒计时结束要重新询价。" },
    { scr: "setup", el: "send", term: "You Send", phon: "juː send", cn: "汇出金额", exp: "你付出 SGD 1,000。" },
    { scr: "setup", el: "recv", term: "They Receive", phon: "ðeɪ rɪˈsiːv", cn: "到账金额", exp: "对方收到 HKD 5,824。比较汇款服务好坏,盯着“同样1000新元对方到手多少”最直观。" },
    { scr: "setup", el: "fee", term: "SHA / OUR Charges", phon: "ʃeə / ˈaʊər ˈtʃɑːrdʒɪz", cn: "手续费分担方式", exp: "跨境汇款费用分担:SHA=各付各的(中转行费用从到账金额里扣);OUR=汇款人全包,对方全额到账;BEN=收款人全担。给别人打款选OUR更体面。" },
    { scr: "setup", el: "btn-b", tap: 1, term: "Add Recipient", phon: "æd rɪˈsɪpiənt", cn: "添加收款人", exp: "填写收款人银行信息。", note: "👆 点击 Add Recipient" },
    { scr: "bene", el: "bname", term: "Beneficiary", phon: "ˌbenɪˈfɪʃieri", cn: "收款人(受益人)", exp: "跨境汇款里收款人叫 Beneficiary。姓名必须与对方银行开户名完全一致,拼错会被退票(汇款被退回还扣费)。" },
    { scr: "bene", el: "swift", term: "SWIFT / BIC Code", phon: "swɪft koʊd", cn: "银行国际代码", exp: "全球银行的“身份证号”,8或11位:HSBCHKHHHKH = 汇丰(HSBC)+香港(HK)+分行代码。汇款前找对方要准确的SWIFT码。", say: "SWIFT code" },
    { scr: "bene", el: "acc", term: "Account Number / IBAN", phon: "əˈkaʊnt ˈnʌmbər / ˈaɪbæn", cn: "账号 / 国际账号", exp: "港新用普通账号即可;汇欧洲则要 IBAN(International Bank Account Number)。数字一位都不能错。" },
    { scr: "bene", el: "purpose", term: "Purpose of Transfer", phon: "ˈpɜːrpəs əv trænsˈfɜːr", cn: "汇款用途", exp: "反洗钱合规必填:Family Maintenance(赡家)/ Education(学费)/ Investment(投资)…如实选择,大额汇款可能被要求补充证明材料。" },
    { scr: "bene", el: "btn-b2", tap: 1, term: "Review", phon: "rɪˈvjuː", cn: "核对", exp: "最后核对全部信息。", note: "👆 点击 Review" },
    { scr: "review", el: "eta", term: "Estimated Arrival", phon: "ˈestɪmeɪtɪd əˈraɪvl", cn: "预计到账时间", exp: "DBS Remit 到香港当日达;传统电汇(Telegraphic Transfer / Wire Transfer)一般1-3个工作日。" },
    { scr: "review", el: "confirm", tap: 1, term: "Confirm & Transfer", phon: "kənˈfɜːrm ənd trænsˈfɜːr", cn: "确认并汇出", exp: "确认后进入银行处理流程。", note: "👆 点击 Confirm & Transfer" },
    { scr: "done", el: "check", term: "Remittance Submitted", phon: "rɪˈmɪtns səbˈmɪtɪd", cn: "汇款已提交", exp: "汇款进入处理(Processing)状态。", say: "Remittance submitted" },
    { scr: "done", el: "track", term: "Track Transfer", phon: "træk trænsˈfɜːr", cn: "追踪汇款", exp: "像查快递一样查汇款走到哪了(SWIFT gpi 技术)。到账后App会推送通知。六课全部内容学完,恭喜!" }
  ]
}
];

/* ================= 引擎 ================= */
var SIM = { view: "list", li: 0, scn: null, i: 0, S: {}, auto: false, autoT: null, lock: false, curScr: "", curUp: false };

function simOpen() { SIM.view = "list"; show("sim"); }

function simDoneMap() { if (!P.simDone) P.simDone = {}; return P.simDone; }

function simList() {
  SIM.view = "list";
  $("sim-top").style.display = "";
  $("sim-play").style.display = "none";
  $("sim-title").textContent = "🏦 实景模拟 · 金融App实操课";
  $("sim-hint").textContent = "▲▼选课 · OK 开始 · 像看真机演示一样学";
  var box = $("sim-list"); box.style.display = ""; box.innerHTML = "";
  var done = simDoneMap();
  SIM_SCN.forEach(function (s, i) {
    var el = document.createElement("div");
    el.className = "rowitem" + (i === SIM.li ? " focus" : "");
    el.innerHTML = '<div class="ic">' + s.ic + '</div><div class="info"><div class="name">' + s.app + ' · ' + s.title
      + (done[s.id] ? ' <span style="color:var(--good);font-size:2vmin">✓ 已学' + done[s.id] + '遍</span>' : '')
      + '</div><div class="desc">' + s.desc + ' · ' + s.steps.length + ' 步</div></div><div class="val">OK</div>';
    box.appendChild(el);
  });
  try { var fc = box.querySelector(".focus"); if (fc && fc.scrollIntoView) fc.scrollIntoView({ block: "nearest" }); } catch (e) { }
}

function simStart(i) {
  SIM.scn = SIM_SCN[i];
  SIM.view = "play"; SIM.auto = false; SIM.curScr = ""; SIM.lock = false;
  $("sim-top").style.display = "none";
  $("sim-list").style.display = "none";
  $("sim-play").style.display = "flex";
  $("ph-scr").setAttribute("data-th", SIM.scn.th);
  simGo(0);
}

function simState(n) {
  var S = JSON.parse(JSON.stringify(SIM.scn.state || {}));
  for (var k = 0; k <= n && k < SIM.scn.steps.length; k++) {
    var st = SIM.scn.steps[k];
    if (st.set) for (var key in st.set) S[key] = st.set[key];
  }
  return S;
}

function simGo(n, dir) {
  var scn = SIM.scn, steps = scn.steps;
  clearTimeout(SIM.autoT);
  if (n < 0) n = 0;
  if (n >= steps.length) { simFinish(); return; }
  SIM.i = n;
  SIM.S = simState(n);
  var st = steps[n];
  var needRender = st.scr !== SIM.curScr || st.re || dir === "back";
  if (needRender) {
    var anim = dir === "back" ? "pg-fade" : (st.up ? "pg-up" : (st.scr !== SIM.curScr && SIM.curScr ? "pg-fwd" : "pg-fade"));
    $("ph-scr").innerHTML = '<div class="ph-page ' + anim + '">' + scn.screens[st.scr](SIM.S) + '</div>';
    SIM.curScr = st.scr;
  }
  // 聚光灯 + 手指
  var fingerDelay = needRender ? 320 : 60;
  var myStep = n;
  setTimeout(function () {
    if (SIM.i !== myStep || SIM.view !== "play") return;
    var page = $("ph-scr").querySelector(".ph-page");
    if (!page) return;
    page.querySelectorAll(".spot").forEach(function (x) { x.classList.remove("spot"); });
    var target = st.el ? page.querySelector('[data-el="' + st.el + '"]') : null;
    var fg = $("ph-finger");
    if (target) {
      target.classList.add("spot");
      try { target.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { target.scrollIntoView(); }
      setTimeout(function () {
        if (SIM.i !== myStep || SIM.view !== "play") return;
        if (st.tap) {
          var pr = $("ph-scr").getBoundingClientRect(), tr = target.getBoundingClientRect();
          fg.style.left = (tr.left - pr.left + tr.width * 0.62) + "px";
          fg.style.top = (tr.top - pr.top + tr.height * 0.60) + "px";
          fg.classList.add("show");
        } else fg.classList.remove("show");
      }, needRender ? 420 : 260);
    } else fg.classList.remove("show");
  }, fingerDelay);
  // 右侧教学面板
  $("t-app").textContent = scn.ic + " " + scn.app + " · " + scn.title;
  $("t-step").textContent = (n + 1) + " / " + steps.length;
  $("t-bar").style.width = ((n + 1) / steps.length * 100) + "%";
  var tt = $("t-term"); tt.textContent = st.term;
  tt.classList.remove("pop2"); void tt.offsetWidth; tt.classList.add("pop2");
  $("t-phon").textContent = st.phon ? "/" + st.phon + "/" : "";
  $("t-cn").textContent = st.cn;
  $("t-exp").textContent = st.exp;
  $("t-note").innerHTML = st.note ? esc(st.note) : (st.tap ? "👆 按 ▶/OK 执行点击" : "");
  $("t-keys").innerHTML = SIM.auto
    ? '<span style="color:var(--gold)">⏯ 自动播放中 · 按⏯或任意方向键停止</span>'
    : '<span class="k">▶/OK</span>下一步 <span class="k">◀</span>上一步 <span class="k">⏯</span>自动播放 <span class="k">菜单</span>重听 <span class="k">返回</span>退出';
  speak(st.say || st.term);
  if (SIM.auto) {
    var wait = Math.max(5600, (st.exp || "").length * 55);
    SIM.autoT = setTimeout(function () { if (SIM.view === "play" && SIM.auto) simAdvance(); }, wait);
  }
}

function simAdvance() {
  if (SIM.lock) return;
  var st = SIM.scn.steps[SIM.i];
  if (st.tap && st.el) {
    // 手指点击动画,然后翻页
    SIM.lock = true;
    var page = $("ph-scr").querySelector(".ph-page");
    var target = page && page.querySelector('[data-el="' + st.el + '"]');
    var fg = $("ph-finger");
    fg.classList.add("tapping");
    if (target) target.classList.add("tapflash");
    setTimeout(function () {
      fg.classList.remove("tapping"); fg.classList.remove("show");
      SIM.lock = false;
      simGo(SIM.i + 1);
    }, 420);
  } else {
    simGo(SIM.i + 1);
  }
}

function simFinish() {
  var scn = SIM.scn;
  var done = simDoneMap();
  done[scn.id] = (done[scn.id] || 0) + 1;
  P.xp += 40; saveP();
  clearTimeout(SIM.autoT); SIM.auto = false;
  $("t-term").textContent = "🎉 本课完成!";
  $("t-phon").textContent = "";
  $("t-cn").textContent = scn.app + " · " + scn.title;
  $("t-exp").textContent = "共学习 " + scn.steps.length + " 个界面词汇与操作,+40 XP。这些词大多也在「港新银行实战」词库里,去学新词/复习里巩固吧。";
  $("t-note").textContent = "";
  $("t-keys").innerHTML = '<span class="k">OK</span>返回课程列表 <span class="k">◀</span>回看上一步';
  $("t-bar").style.width = "100%";
  $("ph-finger").classList.remove("show");
  SIM.i = scn.steps.length;
  speak("Lesson complete. Well done!");
}

handlers.sim = {
  enter: function () { if (SIM.view === "list") simList(); },
  key: function (k) {
    if (SIM.view === "list") {
      if (k === "BACK") { show("home"); return; }
      if (!SIM_SCN.length) return;
      if (k === "UP") SIM.li = (SIM.li + SIM_SCN.length - 1) % SIM_SCN.length;
      else if (k === "DOWN") SIM.li = (SIM.li + 1) % SIM_SCN.length;
      else if (k === "OK") { simStart(SIM.li); return; }
      simList();
      return;
    }
    // 播放视图
    if (k === "BACK") { clearTimeout(SIM.autoT); SIM.auto = false; simList(); return; }
    if (k === "PLAY") {
      SIM.auto = !SIM.auto;
      if (SIM.auto && SIM.i < SIM.scn.steps.length) simGo(SIM.i); else { clearTimeout(SIM.autoT); simGo(Math.min(SIM.i, SIM.scn.steps.length - 1)); }
      return;
    }
    if (k === "MENU") { var st = SIM.scn.steps[Math.min(SIM.i, SIM.scn.steps.length - 1)]; speak(st.say || st.term); return; }
    if (SIM.auto) { SIM.auto = false; clearTimeout(SIM.autoT); }   // 手动按键退出自动模式
    if (SIM.i >= SIM.scn.steps.length) {   // 完成页
      if (k === "OK" || k === "RIGHT") { simList(); return; }
      if (k === "LEFT") { simGo(SIM.scn.steps.length - 1, "back"); return; }
      return;
    }
    if (k === "RIGHT" || k === "OK" || k === "DOWN") simAdvance();
    else if (k === "LEFT" || k === "UP") simGo(SIM.i - 1, "back");
  }
};
