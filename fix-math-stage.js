// fix-math-stage.js —— 把"分学段专业口径"岗位的 mathMajorOnly 精确化为 mathMajorOnlyStages
// 背景：mathMajorOnly:true 语义 = 该岗所有数学岗都限「数学类」，排除小学教育(040107)。
//       但部分岗位是"小学数学岗接受小学教育、初中/高中段数学岗排除小学教育"，
//       这类岗若整体标 mathMajorOnly:true 会误伤小学段。
// 方案：改为 mathMajorOnlyStages: ["初中","高中"]，表示仅这些学段的数学岗限数学类；
//       match.js 据此只在用户报对应学段时触发"专业不符"判定。
const fs = require('fs');
const path = __dirname + '/data.js';
let txt = fs.readFileSync(path, 'utf8');

// id → 替换的 mathMajorOnly 字段（精确到"该岗哪些学段排除小学教育"）
const FIX = {
  20: 'mathMajorOnlyStages: ["初中","高中"]',   // 龙湾：小学数学16含小学教育，初中数学8不含
  21: 'mathMajorOnlyStages: ["初中","高中"]',   // 瓯海：小学数学3含，初中数学2不含
  24: 'mathMajorOnlyStages: ["初中","高中"]',   // 平湖：小学数学岗含，中学段不含
  28: 'mathMajorOnlyStages: ["初中","高中"]',   // 秀洲：小学数学3含040107，初中数学8不含
  43: 'mathMajorOnlyStages: ["初中","高中"]',   // 义乌：小学数学2含，初中数学1/2不含
  49: 'mathMajorOnlyStages: ["初中","高中"]',   // 金东：小学数学5(040107+初中教资可报)，初中数学9不含
  51: 'mathMajorOnlyStages: ["初中","高中"]',   // 路桥：小学数学1含，初中数学4不含
  54: 'mathMajorOnlyStages: ["初中","高中"]',   // 玉环：小学数学5含040107，初中数学10不含
  81: 'mathMajorOnlyStages: ["初中","高中"]',   // 开发区：小学数学1含小学教育，初中数学6不含
  100: 'mathMajorOnlyStages: ["初中","高中"]',  // 鄞州：全学段数学限数学类，小学数学2推定含040107
};

let changed = 0, failed = [];
for (const [id, newField] of Object.entries(FIX)) {
  const idRe = new RegExp('id:\\s*' + id + ',');
  const m = idRe.exec(txt);
  if (!m) { failed.push(id + '(找不到id)'); continue; }
  const seg = txt.slice(m.index, m.index + 2500);
  const rulesM = seg.match(/rules:\s*\{[^}]*\}/);
  if (!rulesM) { failed.push(id + '(rules行未匹配)'); continue; }
  const rulesStr = rulesM[0];
  if (rulesStr.indexOf('mathMajorOnly: true') === -1) {
    failed.push(id + '(无mathMajorOnly:true)');
    continue;
  }
  // 把 mathMajorOnly: true 替换为 mathMajorOnlyStages
  const newRules = rulesStr.replace('mathMajorOnly: true', newField);
  txt = txt.replace(rulesStr, newRules);
  changed++;
  console.log('#' + id + ' 改为 ' + newField);
}

console.log('\n修改 ' + changed + ' 条，失败 ' + failed.length + ' 条：', failed.join(', ') || '(无)');
fs.writeFileSync(path, txt);
console.log('已写回 data.js');
