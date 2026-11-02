// 题库与计分回归测试：node tests/scoring.cjs
// 用轻量 DOM 桩在 Node 中运行页面脚本；不替代真实浏览器里的视觉检查。
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeElement() {
  const classes = new Set();
  return {
    innerHTML: '', textContent: '', value: '', hidden: false, style: {}, dataset: {},
    offsetWidth: 0, offsetHeight: 0, offsetLeft: 0, offsetTop: 0,
    classList: {
      add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
      toggle: (c, on) => (on === undefined ? !classes.has(c) : on) ? (classes.add(c), true) : (classes.delete(c), false)
    },
    setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, focus() {},
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0}),
    getContext: () => new Proxy({}, {get: () => () => {}})
  };
}
const elements = {};
const element = id => elements[id] ??= makeElement();
const saved = {'hq.rec': JSON.stringify({
  '1-01': {s: 'D', r: 0},   // 原争议题：现按 E 计分 -> 0
  '1-14': {s: 'B', r: null}, // 原推定题的旧 null 判分：现按 B 计分 -> 1
  '1-02': {s: 'E', r: 0},   // 旧缓存判分错误 -> 重算为 1
  bogus: {s: 'A', r: 1},    // 未知题号 -> 丢弃
  '1-03': {s: 'Z', r: 1}    // 非法选项 -> 丢弃
})};
const sandbox = {
  document: {getElementById: element, addEventListener() {}, createElement: makeElement, body: makeElement()},
  localStorage: {getItem: k => saved[k] ?? null, setItem: (k, v) => { saved[k] = v; }},
  matchMedia: () => ({matches: true}), // 视为“减少动态效果”，跳过特效
  addEventListener() {}, getComputedStyle: () => ({getPropertyValue: () => ''}),
  requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout() {},
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, navigator: {}
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(script, ctx);
ctx.assert = assert;
vm.runInContext(`
assert.equal(QS.length, 183);
assert.equal(QS.filter(scorable).length, 183, '全部题目计分');

// 旧记录迁移：保留合法选择、按当前答案重算、丢弃非法记录
assert.equal(rec['1-01'].r, 0);
assert.equal(rec['1-14'].r, 1);
assert.equal(rec['1-02'].r, 1);
assert.equal(rec.bogus, undefined);
assert.equal(rec['1-03'], undefined);
for (const raw of [null, [], 5, 'bad']) assert.equal(Object.keys(migrateRecords(raw)).length, 0);

// 推定答案、回忆补全题都附有可追溯依据
for (const q of QS) if (q.mark === '†' || /补全|近似/.test(q.tags.join(' '))) assert.ok(q.exp && q.exp.trim(), '缺少答案依据：' + q.id);

// 逐题逐选项判分
for (const q of QS) {
  for (const s of ['A', 'B', 'C', 'D', 'E']) {
    const result = evaluate(q, s);
    if (result) assert.equal(result.r, +(s === q.ans), q.id + ' ' + s);
  }
  const full = evaluate(q, q.ans);
  assert.equal(full.r, 1, q.id + ' 标准答案应判对');
}

// 多选与参考题（合成题）
const synthetic = {opts: ['one', 'two', 'three'], ans: 'AC', tags: ['多选'], reliability: ['reliable']};
assert.equal(evaluate(synthetic, 'CA').r, 1);
assert.equal(evaluate(synthetic, 'A').r, 0);
assert.equal(evaluate(synthetic, 'AA'), null);
assert.equal(evaluate(synthetic, 'E'), null);
assert.equal(evaluate({...synthetic, reliability: ['inferred']}, 'A').r, null);
assert.equal(evaluate({...synthetic, opts: ['one', '……', 'three'], reliability: ['incomplete']}, 'B'), null);

// 错题筛选只收计分题
rec['9-99'] = {s: 'A', r: 0};
assert.equal(inScope({id: '9-99', ch: 9, tags: [], ans: 'B', opts: ['a', 'b'], reliability: ['inferred']}, 'wrong'), false);
delete rec['9-99'];

// 逐题渲染与作答
for (const q of QS) { list = [q]; pos = 0; pick.clear(); render(); choose(isMulti(q) ? q.ans[0] : 'A'); if (isMulti(q)) submit(); render(); assert.ok(rec[q.id], '未记录作答：' + q.id); }
list = QS; pos = 0; render();
assert.ok(document.getElementById('hDone').innerHTML.includes('/183'));
assert.ok(document.getElementById('hAcc').innerHTML.includes('%'));

// 计分题作答后显示对错；参考题不显示红绿、不判对错
list = [QS.find(q => q.id === '1-01')]; pos = 0; render();
assert.ok(document.getElementById('card').innerHTML.includes('回答错误'));
const ref = {...QS[0], id: '1-99', reliability: ['inferred']};
list = [ref]; pos = 0; pick.clear(); render(); choose('A'); render();
const card = document.getElementById('card').innerHTML;
assert.ok(card.includes('不判对错'));
assert.ok(!card.includes('回答错误'));
assert.ok(!card.includes('class="opt wrong') && !card.includes(' wrong"'));
assert.equal(rec['1-99'].r, null);
delete rec['1-99'];

// 题库校验：不确定标记或缺依据的题不得计分
const inferred = QS.find(q => q.mark === '†'), basis = inferred.exp;
delete inferred.exp; assert.throws(validateBank); inferred.exp = basis;
QS[0].tags.push('答案有争议'); assert.throws(validateBank); QS[0].tags.pop();
const original = QS[0].reliability; QS[0].reliability = ['reliable', 'inferred']; assert.throws(validateBank); QS[0].reliability = original;
validateBank();
`, ctx);
console.log('PASS: bank integrity, answer bases, every question/option, migration, multi-select, filters, statistics and rendering');
