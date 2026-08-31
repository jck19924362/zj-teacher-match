// match.js - 匹配引擎 V3
// 更新：学科匹配（专业 + 教资双通道，考哪门课就要哪门教资）、
//       户籍条款查不到时默认按"需浙江省户籍"处理、履历字段移除

// ========== 学历等级 ==========
const DEGREE_RANK = { '大专': 1, '本科': 2, '硕士': 3, '博士': 4 };

// ========== 荣誉等级（1~6，数字越大含金量越高） ==========
const HONOR_RANK = {
  // 荣誉称号
  '省级优秀毕业生': 5,
  '校级优秀毕业生': 3.5,
  '优秀学生干部': 3,
  '优秀团干部': 3,
  '优秀学生': 3,
  '优秀团员': 2.5,
  // 奖学金（按等级）
  '国家奖学金': 6,
  '国家励志奖学金': 4,
  '校级一等奖学金': 4,
  '校级二等奖学金': 3,
  '校级三等奖学金': 2.5,
  '校级单项奖学金': 2,
  // 省级师范生技能竞赛（按等级）
  '省级师范生技能竞赛一等奖': 5,
  '省级师范生技能竞赛二等奖': 4.5,
  '省级师范生技能竞赛三等奖': 4,
};

// 自定义荣誉按关键词评估等级
function estimateHonorLevel(name) {
  if (!name) return 0;
  if (/国家奖学金|国奖/.test(name)) return 6;
  if (/省优|省级优秀毕业生/.test(name)) return 5;
  if (/省师范生技能竞赛|师范生技能赛/.test(name)) {
    if (/一等奖/.test(name)) return 5;
    if (/二等奖/.test(name)) return 4.5;
    if (/三等奖/.test(name)) return 4;
    return 4;
  }
  if (/国家级|全国/.test(name)) return 4.5;
  if (/省级|省 .{0,4}(奖|赛|竞赛|优秀)/.test(name)) return 4.5;
  if (/校优|校级优秀/.test(name)) return 3.5;
  if (/一等奖|金奖/.test(name)) return 4;
  if (/二等奖|银奖/.test(name)) return 3;
  if (/三等奖|铜奖/.test(name)) return 2.5;
  if (/优秀|先进|竞赛|大赛/.test(name)) return 3;
  if (/奖学金/.test(name)) return 3;
  if (/院级|系级/.test(name)) return 2;
  return 2; // 未识别的自定义荣誉默认较低等级，建议人工核实
}

// 岗位荣誉门槛的等级要求（注意先匹配更具体的写法）
function honorRequirementLevel(gate) {
  if (!gate) return 0;
  if (/国奖|国家奖学金/.test(gate)) return 6;
  if (/省师范生技能竞赛|省师范生技能赛|师范生技能赛/.test(gate)) {
    if (/一等奖/.test(gate)) return 5;
    if (/二等奖/.test(gate)) return 4.5;
    if (/三等奖/.test(gate)) return 4;
    return 4;
  }
  if (/省优|省级优秀毕业生/.test(gate)) return 5;
  if (/省级|国家|全国/.test(gate)) return 5;
  if (/校一等/.test(gate)) return 4;
  if (/校二等|校综二等|综合奖学金/.test(gate)) return 3;
  if (/院级/.test(gate)) return 2;
  if (/校级|荣誉|获奖|奖学金/.test(gate)) return 3;
  return 3;
}

// 岗位是否提供"成绩/综测/排名前X%"的替代通道（有则返回百分比如30）
function rankAlternativePercent(job) {
  const text = (job.honorGate || '') + ' ' + (job.condition || '');
  const m = text.match(/(?:成绩|排名|综测|综合测评)[^%。；;]{0,10}?前\s*(\d{1,2})\s*%/);
  return m ? parseInt(m[1], 10) : null;
}

// 从公告标题+条件里识别面向的届别（如"2026届""2024-2026届"），识别不到返回 null
function jobTargetYears(job) {
  const text = (job.title || '') + ' ' + (job.condition || '');
  const years = new Set();
  const range = text.match(/(20(2[4-9]))\s*[-—~至]\s*(20(2[4-9]))\s*届/);
  if (range) {
    for (let y = parseInt(range[1], 10); y <= parseInt(range[3], 10); y++) years.add(y);
  }
  (text.match(/20(2[4-9])届/g) || []).forEach(s => years.add(parseInt(s, 10)));
  return years.size ? Array.from(years) : null;
}

// 教资等级：幼儿园=1 小学=1 初中=2 高中=3
function certStage(name) {
  if (!name) return 0;
  if (name.startsWith('幼儿园')) return 1;
  if (name.startsWith('小学')) return 1;
  if (name.startsWith('初中')) return 2;
  if (name.startsWith('高中')) return 3;
  return 1;
}

const CERT_LEVEL_REQ = { primary: 1, junior: 2, senior: 3 };
const STAGE_CERT_LEVEL = { '幼儿园': 1, '小学': 1, '初中': 2, '高中': 3 };

// 专业名 → 学科方向归一化（"小学教育（数学方向）"→"数学"）
function normalizeSubject(text) {
  if (!text) return '';
  if (/数学/.test(text)) return '数学';
  if (/语文|中文|汉语言/.test(text)) return '语文';
  if (/英语/.test(text)) return '英语';
  if (/物理|化学|生物|科学/.test(text)) return '科学';
  if (/体育/.test(text)) return '体育';
  if (/音乐/.test(text)) return '音乐';
  if (/美术|艺术|绘画|设计/.test(text)) return '美术';
  if (/信息|计算机|软件/.test(text)) return '信息技术';
  if (/学前/.test(text)) return '学前教育';
  if (/心理/.test(text)) return '心理健康';
  return '';
}

function normalizeJob(job) {
  const r = job.rules || {};
  let hukouText = '不限';
  if (r.hukou === 'none') hukouText = '不限';
  else if (r.hukou === 'zhejiang') hukouText = '浙江省';
  else if (r.hukou === 'unknown') hukouText = '浙江省（默认）';
  else if (r.hukou) hukouText = r.hukou;

  let certText = '不限';
  if (r.certLevel === 'none') certText = '应届可后补';
  else if (r.certLevel === 'any') certText = '相应学科教资';
  else if (r.certLevel === 'primary') certText = '小学及以上教资';
  else if (r.certLevel === 'junior') certText = '初中及以上教资';
  else if (r.certLevel === 'senior') certText = '高中教资';
  else if (r.certLevel === 'unknown') certText = '待核实';

  return {
    ...job,
    hukouText,
    subjects: (r.subjects && r.subjects.length) ? r.subjects : [],
    needMaster: !!r.needMaster,
    schoolGate: r.schoolGate || null,
    honorGate: r.honorGate || null,
    certText,
    certLevelReq: r.certLevel || 'none',
    audience: r.audience || 'fresh',
    stage: r.stage || job.stage || '小学',
  };
}

/**
 * 匹配主函数
 * profile: { graduateYear: '2026'|'2027'|'other'|'',
 *            region: 'zhejiang'|'other', city, district, otherProvince,
 *            degree: '本科'|'硕士', schoolType,
 *            major: 专业名（归一化出学科方向）,
 *            certs: [], honors: [] (含自定义), zongce: '5'|'10'|'20'|'30'|'50'|'',
 *            otherConditions: 选填文本 }
 * jobs: JOBS 数组
 * options: { stage: '小学'|'初中'|'高中'|'幼儿园', bianzhiOnly: bool }
 */
function matchJobs(profile, jobs, options) {
  if (!profile || !Array.isArray(jobs)) return [];
  options = options || { stage: '小学', bianzhiOnly: false };

  const inZhejiang = profile.region !== 'other';
  const userCity = profile.city || '';
  const userDistrict = profile.district || '';
  const userHonors = profile.honors || [];
  const userCerts = profile.certs || [];
  const degreeRank = DEGREE_RANK[profile.degree] || 0;
  const isGrad = /^\d{4}$/.test(profile.graduateYear || '');
  const userYear = isGrad ? parseInt(profile.graduateYear, 10) : null;
  const zongce = parseFloat(profile.zongce) || null;
  const stage = options.stage;
  const majorSubject = normalizeSubject(profile.major || '');

  // 用户各学科教资的最高学段（{ '数学': 2 } 表示持有初中数学教资）
  const certSubjects = {};
  userCerts.forEach(c => {
    const subj = c.replace(/^(幼儿园|小学|初中|高中)/, '') || '全科';
    const lv = certStage(c);
    if (!certSubjects[subj] || certSubjects[subj] < lv) certSubjects[subj] = lv;
  });
  const userMaxCertLevel = Math.max(0, ...Object.values(certSubjects));

  // 用户可报学科集合（教资学科 ∪ 专业学科）
  const userSubjects = new Set(Object.keys(certSubjects));
  if (majorSubject) userSubjects.add(majorSubject);

  // 用户荣誉最高等级（预设 + 自定义估算）
  const userMaxHonor = Math.max(0, ...userHonors.map(h => HONOR_RANK[h] || estimateHonorLevel(h)));

  return jobs.map(rawJob => {
    const j = normalizeJob(rawJob);
    let score = 0;
    const reasons = [];  // 硬性不符
    const risks = [];    // 需人工核实（待确认）
    const notes = [];    // 参考提示（不影响档位）

    // 0. 学段过滤（"中学"同时覆盖初中和高中两个tab）
    const stageOK = j.stage.includes(stage)
      || (j.stage.includes('中学') && (stage === '初中' || stage === '高中'));
    if (!stageOK) {
      return null;
    }

    // 1. 编制筛选
    const staffing = (j.staffing || '') + (j.batch || '');
    const isBianzhi = /事业编|备案|员额|在编|全额/.test(staffing);
    const isNonBianzhi = /派遣|合同制|非编|储备|劳动合同|编外/.test(staffing);
    if (options.bianzhiOnly && (isNonBianzhi || !isBianzhi)) {
      return null;
    }
    if (isBianzhi) score += 10;

    // 2. 面向人群（仅在职 vs 应届）
    if (j.audience === 'in-service') {
      reasons.push('仅面向在职在编教师（选调/选聘）');
    }

    // 3. 届别
    const targetYears = jobTargetYears(j);
    const allowsPast = /历届|往届|社会人员|社会考生/.test((j.condition || '') + (j.title || ''));
    if (targetYears && targetYears.length) {
      const label = targetYears.join('/');
      if (userYear !== null) {
        if (targetYears.includes(userYear)) {
          score += 5;
        } else if (userYear < Math.min(...targetYears)) {
          // 用户在公告面向的届别之前已毕业（往届身份）
          if (allowsPast) {
            score += 5;
          } else {
            reasons.push(`公告面向${label}届应届毕业生，往届生不可报`);
          }
        } else {
          // 用户比公告届别晚（还没毕业），此公告作参考样本
          notes.push(`此为${label}届公告，供参考；${userYear}届请关注今年下半年起发布的同类公告`);
        }
      } else if (profile.graduateYear === 'other') {
        if (allowsPast) score += 5;
        else risks.push(`公告面向${label}届，往届生需电话确认是否可报`);
      }
    }

    // 4. 户籍（条款查不到 → 默认按"需浙江省户籍"处理）
    const phdRelax = degreeRank === 4 && /博士/.test((j.condition || '') + (j.title || ''));
    const hk = j.hukouText;
    if (hk === '不限') {
      score += 30;
    } else if (hk === '浙江省（默认）') {
      if (inZhejiang) {
        score += 25;
        risks.push('户籍条款未查到，默认按需浙江省户籍处理，请以原公告核实');
      } else {
        reasons.push('户籍条款未查到，默认需浙江省户籍（省外户籍大概率不可报，请核实）');
      }
    } else if (hk === '浙江省') {
      if (inZhejiang) {
        score += 30;
      } else if (phdRelax) {
        score += 25;
        risks.push('公告提及博士可放宽户籍限制，请查看原文确认');
      } else {
        reasons.push('限浙江省户籍/生源');
      }
    } else {
      // 具体市/区县限制
      if (userDistrict && hk.includes(userDistrict)) {
        score += 30;
      } else if (userCity && hk.includes(userCity)) {
        score += 25;
        risks.push(`户籍要求${hk}，需确认你的区县是否在范围内`);
      } else if (phdRelax) {
        score += 25;
        risks.push(`户籍要求${hk}，公告提及博士可放宽，请查看原文确认`);
      } else {
        reasons.push(`限${hk}户籍/生源`);
      }
    }

    // 5. 学历
    if (j.needMaster) {
      if (degreeRank >= 3) score += 20;
      else reasons.push('要求硕士研究生及以上');
    } else if (degreeRank >= 2) {
      score += 20;
    } else if (degreeRank === 1) {
      // 专科学历：数据库公告均未明确写"大专可报"，一律提示核实
      score += 10;
      risks.push('公告未明确专科学历可报，请电话确认是否放宽至大专');
    } else {
      score += 20; // 未填学历，先按满足处理
    }

    // 6. 院校门槛
    if (j.schoolGate) {
      const st = profile.schoolType || '';
      const okSchool = /双一流/.test(st) && /双一流/.test(j.schoolGate)
        || /部属师范/.test(st)
        || (/浙师大/.test(st) && /浙师大/.test(j.schoolGate))
        || (degreeRank >= 3 && /硕士/.test(j.schoolGate));
      if (okSchool) {
        score += 15;
      } else {
        reasons.push(`院校门槛：${j.schoolGate}`);
      }
    }

    // 6.5 学科匹配：岗位招特定学科时，专业或教资须对口
    let subjectOverlap = [];
    if (j.subjects.length) {
      subjectOverlap = j.subjects.filter(s => userSubjects.has(s));
      if (subjectOverlap.length) {
        score += 10;
      } else if (userSubjects.size === 0) {
        risks.push(`岗位学科：${j.subjects.join('、')}，请先填写专业或教资再判断`);
      } else {
        reasons.push(`岗位学科：${j.subjects.join('、')}，与你的专业（${majorSubject || '未填'}）/教资不对口`);
      }
    } else if (/专业对口/.test(j.condition || '') && majorSubject) {
      notes.push(`公告要求专业对口，请按「${majorSubject}」方向对照岗位表选岗`);
    }

    // 7. 荣誉门槛（奖学金/竞赛等级 + 综测排名替代通道）
    if (j.honorGate && j.honorGate !== 'unknown') {
      const req = honorRequirementLevel(j.honorGate);
      const rankAlt = rankAlternativePercent(j);
      const passByRank = !!(rankAlt && zongce && zongce <= rankAlt);
      if (userMaxHonor >= req || passByRank) {
        score += 15;
        if (passByRank && userMaxHonor < req) {
          notes.push(`你的${zongce}%排名满足"前${rankAlt}%"替代通道`);
        }
      } else if (userMaxHonor > 0 || zongce) {
        score += 7;
        risks.push(`荣誉门槛：${j.honorGate}，你的荣誉/排名可能不够，建议电话确认`);
      } else {
        reasons.push(`荣誉门槛：${j.honorGate}`);
      }
    } else if (j.honorGate === 'unknown') {
      risks.push('荣誉门槛需查看原公告核实');
    } else {
      score += 15;
    }

    // 8. 教资（考哪门课就要哪门教资；岗位学科已判不符时不再重复判）
    const certReq = j.certLevelReq;
    const needLv = STAGE_CERT_LEVEL[stage] || 1;
    if (certReq === 'none') {
      score += 15; // 应届可后补或免
    } else if (certReq === 'unknown') {
      score += 12;
      risks.push('教资要求需查看原公告核实');
    } else if (certReq === 'any') {
      if (j.subjects.length && subjectOverlap.length === 0 && userSubjects.size > 0) {
        // 学科不对口，已由 6.5 判不符
      } else {
        // 公告允许"按所学专业报考"的，教资学科可放宽
        const byMajor = /专业或教资|按所学专业|专业对口或持教资|学历专业或教资证学科/.test(j.condition || '');
        let certOK = false;
        let failMsg = '';
        if (j.subjects.length) {
          certOK = j.subjects.some(s => (certSubjects[s] || 0) >= needLv);
          if (!certOK) {
            const hasLowerCert = j.subjects.some(s => certSubjects[s] !== undefined);
            if (hasLowerCert) {
              failMsg = `你持有${j.subjects.join('/')}学科教资，但学段不满足${stage}岗要求`;
            } else if (subjectOverlap.length) {
              failMsg = `岗位须${j.subjects.join('/')}学科教资，你专业对口但无该学科教资`;
            }
          }
        } else {
          certOK = userCerts.length > 0 && userMaxCertLevel >= needLv;
          if (!certOK && userCerts.length > 0) failMsg = `你暂无${stage}及以上学段教资`;
        }
        if (certOK) {
          score += 15;
        } else if (byMajor && (majorSubject || subjectOverlap.length)) {
          score += 12;
          risks.push('公告允许按所学专业报考，教资学科可放宽，请核实岗位表');
        } else if (failMsg) {
          if (isGrad) {
            score += 10;
            risks.push(failMsg + '，应届能否后补请核实公告');
          } else {
            reasons.push(failMsg);
          }
        } else if (isGrad) {
          score += 10;
          risks.push('须相应学科教资，应届能否凭合格证明/后补请核实公告');
        } else {
          reasons.push('须持相应学科教师资格证');
        }
      }
    } else {
      // primary / junior / senior：按公告明确的学段要求
      const needLv2 = CERT_LEVEL_REQ[certReq] || 1;
      if (userMaxCertLevel >= needLv2) {
        score += 15;
        if (needLv2 > 1) score += 2; // 高学段教资报低学段岗位有小加成
      } else {
        reasons.push(`须${j.certText}`);
      }
    }

    // 9. 判定档位：reasons→不符；risks→待确认；notes→不影响
    let status;
    if (reasons.length > 0) status = '不符';
    else if (risks.length > 0) status = '待确认';
    else status = '可报';

    return { ...j, score, status, reasons, risks, notes };
  })
  .filter(x => x !== null)
  .sort((a, b) => b.score - a.score);
}

window.matchJobs = matchJobs;
