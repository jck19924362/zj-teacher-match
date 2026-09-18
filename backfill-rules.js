// backfill-rules.js —— 把 verifiedNote 里核验出的报考条件，抽取回填到 rules 字段
// 用途：将附件核验中"与个人档案有关"的硬门槛，从自然语言 verifiedNote 精确落成结构化 rules，
//       使 match.js 的筛选匹配机制真正联动这些条件。
// 设计原则：幂等（可重复运行）、可审计（每处回填都打印 id + 变更内容）。
//
// 补录字段说明：
//   mathMajorOnly   : true = 该岗数学岗限「数学类/统计学类/学科教学(数学)」等，不含"小学教育(040107)"
//                     （小学教育(数学方向)专业 → 数学岗专业不符，需走教资通道或判不符）
//   degreeByStage   : { 小学/初中/高中: "本科"|"硕士" } 按学段细分学历门槛
//   experienceRequired : 社招岗须 N 年教学经历（应届不可报）
//   hukou           : 修正为精确市/县户籍（原标 none 但实际有限制）
//
const fs = require('fs');
const path = __dirname + '/data.js';
let txt = fs.readFileSync(path, 'utf8');

// 精确补丁：id → 需要追加/修正的 rules 字段（JSON 片段）
// 追加项：在 rules 对象末尾（最后一个字段后、} 前）注入
const PATCHES = {
  // ===== A. 专业目录排除（mathMajorOnly）：备注明确"不含小学教育/不在目录" =====
  4:   { add: ', mathMajorOnly: true' },
  20:  { add: ', mathMajorOnly: true' },
  21:  { add: ', mathMajorOnly: true' },
  23:  { add: ', mathMajorOnly: true' },
  24:  { add: ', mathMajorOnly: true' },
  27:  { add: ', mathMajorOnly: true' },
  28:  { add: ', mathMajorOnly: true' },
  31:  { add: ', mathMajorOnly: true' },   // 已有 mathMajorOnly:false，需改成 true
  43:  { add: ', mathMajorOnly: true' },
  49:  { add: ', mathMajorOnly: true' },
  51:  { add: ', mathMajorOnly: true' },
  54:  { add: ', mathMajorOnly: true' },
  56:  { add: ', mathMajorOnly: true' },
  67:  { add: ', mathMajorOnly: true' },
  76:  { add: ', mathMajorOnly: true' },
  77:  { add: ', mathMajorOnly: true' },
  81:  { add: ', mathMajorOnly: true' },
  97:  { add: ', mathMajorOnly: true' },
  98:  { add: ', mathMajorOnly: true' },
  100: { add: ', mathMajorOnly: true' },
  104: { add: ', mathMajorOnly: true' },
  105: { add: ', mathMajorOnly: true' },
  107: { add: ', mathMajorOnly: true' },
  109: { add: ', mathMajorOnly: true' },
  111: { add: ', mathMajorOnly: true' },
};

// 先处理 add（在 rules 对象闭合前注入）
let changed = 0, failed = [];
for (const [id, patch] of Object.entries(PATCHES)) {
  const idRe = new RegExp('id:\\s*' + id + ',');
  const m = idRe.exec(txt);
  if (!m) { failed.push(id + '(找不到id)'); continue; }
  const seg = txt.slice(m.index, m.index + 2500);
  const rulesM = seg.match(/rules:\s*\{[^}]*\}/);
  if (!rulesM) { failed.push(id + '(rules行未匹配)'); continue; }

  const rulesStr = rulesM[0];
  let newRulesStr = rulesStr;

  if (patch.add) {
    // 若已存在同名字段则跳过（幂等）
    const fieldName = patch.add.match(/:\s*true|:\s*false|:\s*"[^"]*"|:\s*\{/) ? patch.add.replace(/^,\s*/, '').split(':')[0].trim() : '';
    if (fieldName && new RegExp(fieldName + '\\s*:').test(rulesStr)) {
      // 字段已存在，不重复添加
      if (fieldName !== 'mathMajorOnly') failed.push(id + '(' + fieldName + '已存在)');
      continue;
    }
    newRulesStr = rulesStr.replace(/\}$/, patch.add + ' }');
  }

  if (newRulesStr !== rulesStr) {
    txt = txt.replace(rulesStr, newRulesStr);
    changed++;
    console.log('#' + id + ' 补录成功 → ' + patch.add);
  }
}

console.log('\n共修改 ' + changed + ' 条，失败 ' + failed.length + ' 条：', failed.join(', ') || '(无)');

fs.writeFileSync(path, txt);
console.log('已写回 data.js');
