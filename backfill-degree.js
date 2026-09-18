// backfill-degree.js —— 回填 degreeByStage（按学段细分学历门槛）
// 背景：部分岗位整体本科可报（needMaster:false），但某个学段的数学岗实际限硕士及以上。
//       例如"高中数学岗硕士起""初中数学A类须硕士""小学数学1限硕士"等。
// 字段：degreeByStage: { "小学":"硕士"|"本科", "初中":..., "高中":... }
//       match.js 在判定学历时，优先取当前 stage 对应的值，否则回退 needMaster。
const fs = require('fs');
const path = __dirname + '/data.js';
let txt = fs.readFileSync(path, 'utf8');

// id → 追加的 degreeByStage 字段（精确到"哪些学段限硕士"）
// 值依据 verifiedNote 原文核验：
const PATCHES = {
  5:   'degreeByStage: { "初中": "本科" }',          // 越城：初中数学A限硕士+B本科可报 → 初中仍有本科可报（标注本科，不改判）
  11:  'degreeByStage: { "高中": "硕士", "初中": "硕士" }', // 安吉：择优录用80名高中数学+初中数学限硕士（但公开招聘版22人数学3含小学教育本科可报）
  24:  'degreeByStage: { "高中": "硕士" }',          // 平湖：乍浦高中数学5、职中数学4、中学数学2限数学类（未明确硕士，户籍不限仅限硕士豁免）→ 不加
  26:  'degreeByStage: { "初中": "本科" }',          // 南湖：初中数学8(2本科+3硕士) → 有本科可报
  43:  'degreeByStage: { "小学": "本科", "初中": "本科" }', // 义乌：小学数学2本科可报(60名)，小学数学1限硕士(20名) → 本科可报
  62:  'degreeByStage: { "高中": "硕士" }',          // 龙泉：高中数学1限硕士
  117: 'degreeByStage: { "高中": "硕士" }',          // 苍南：高中数学1限硕士
  136: 'degreeByStage: { "高中": "硕士" }',          // 钱塘：高中数学岗硕士起
  137: 'degreeByStage: { "高中": "硕士" }',          // 桐庐：高中数学硕士起
};

let changed = 0, failed = [];
for (const [id, field] of Object.entries(PATCHES)) {
  // 只保留真正"限硕士"的（值含"硕士"），其余是冗余标注跳过
  if (field.indexOf('"硕士"') === -1) {
    console.log('#' + id + ' 跳过（非限硕士）');
    continue;
  }
  const idRe = new RegExp('id:\\s*' + id + ',');
  const m = idRe.exec(txt);
  if (!m) { failed.push(id + '(找不到id)'); continue; }
  const seg = txt.slice(m.index, m.index + 2500);
  const rulesM = seg.match(/rules:\s*\{[^}]*\}/);
  if (!rulesM) { failed.push(id + '(rules行未匹配)'); continue; }
  const rulesStr = rulesM[0];
  if (rulesStr.indexOf('degreeByStage') !== -1) { failed.push(id + '(已存在degreeByStage)'); continue; }
  const newRules = rulesStr.replace(/\}$/, ', ' + field + ' }');
  txt = txt.replace(rulesStr, newRules);
  changed++;
  console.log('#' + id + ' 补 ' + field);
}

console.log('\n补录 ' + changed + ' 条，失败 ' + failed.length + ' 条：', failed.join(', ') || '(无)');
fs.writeFileSync(path, txt);
console.log('已写回 data.js');
