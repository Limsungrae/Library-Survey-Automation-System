const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('Web/survey-dashboard-v2.html', 'utf8');
const appHtml = fs.readFileSync('Web/survey-dashboard-v2-app.html', 'utf8');
const css = fs.readFileSync('Web/survey-dashboard-v2-css.html', 'utf8');
const service = fs.readFileSync('AppsScript/10_WebService', 'utf8');
const aiService = fs.readFileSync('AppsScript/14_DynamicAI.gs', 'utf8');
const script = appHtml.slice(appHtml.indexOf('<script>') + 8, appHtml.lastIndexOf('</script>'));
new vm.Script(script, { filename: 'survey-dashboard-v2-app.js' });

function extractFunction(name) {
  const start = script.indexOf(`function ${name}(`);
  assert(start >= 0, `function ${name} exists`);
  const brace = script.indexOf('{', start);
  let depth = 0;
  for (let index = brace; index < script.length; index += 1) {
    if (script[index] === '{') depth += 1;
    if (script[index] === '}' && --depth === 0) return vm.runInNewContext(`(${script.slice(start, index + 1)})`);
  }
  throw new Error(`unterminated function ${name}`);
}
const formatMetric = extractFunction('formatMetric_');
const qualityLabel = extractFunction('qualityLabel');
assert.strictEqual(formatMetric(1, '명', 0), '1명');
assert.strictEqual(formatMetric(30, '명', 0), '30명');
assert.strictEqual(formatMetric(80, '명', 0), '80명');
assert.strictEqual(formatMetric(250, '명', 0), '250명');
assert.strictEqual(formatMetric(1250, '명', 0), '1,250명');
assert.strictEqual(formatMetric(null, '%', 1), '해당 없음');
['PASS', 'WARNING', 'FAIL', 'ERROR', 'STALE'].forEach(status => assert.notStrictEqual(qualityLabel(status), '검사 전'));

const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]));
const references = new Set([...appHtml.matchAll(/el\("([^"]+)"\)/g)].map(match => match[1]));
assert.deepStrictEqual([...references].filter(id => !ids.has(id)), [], 'all el() references must resolve');

const requiredApis = [
  'secureGetSurveySettingsForWeb', 'secureSaveSurveySettingsFromWeb',
  'secureGetDynamicSurveySystemStatusFromWeb', 'secureInspectSurveyExcelForMappingFromWeb',
  'secureInspectSurveyExcelByRuleFromWeb', 'secureGetSavedSurveyMappingsFromWeb',
  'secureSaveSurveyMappingsFromWeb', 'secureCreateGenericRawSheetFromWeb',
  'secureGenerateDynamicStatisticalReportFromWeb', 'secureGetDynamicSurveyDashboardDataFromWeb',
  'secureGetDynamicSurveyQualityFromWeb', 'secureGenerateDynamicAIReportFromWeb',
  'secureExportDynamicSurveyReportFromWeb'
];
requiredApis.forEach(name => assert(appHtml.includes(name), `reuses ${name}`));

['respondent', 'single', 'multiple', 'satisfaction', 'recommendation', 'text'].forEach(tab =>
  assert(html.includes(`data-analysis-tab="${tab}"`), `analysis tab ${tab}`));
['respondent:', 'single:', 'multiple:', 'satisfaction:', 'recommendations:', 'text:'].forEach(field =>
  assert(service.includes(field), `dashboard API field ${field}`));

// Required empty/variant scenarios are represented by explicit guards rather than hidden tabs.
assert(appHtml.includes('if(!items||!items.length)'), 'empty dashboard/TOP data');
assert(appHtml.includes('if(!questions||!questions.length)'), 'zero-question analysis tabs');
assert(appHtml.includes('m.nps!==null&&m.nps!==undefined'), 'NPS absent/present');
assert(appHtml.includes('item.scaleKind==="NPS_0_10"'), 'NPS and five-point recommendation split');
assert(appHtml.includes('주관식 문항이 없어도 정량 통계 기반 AI 분석'), 'zero text questions');
assert(appHtml.includes('item.label).setWrap') || appHtml.includes('escapeHtml(item.label'), 'long labels retained');
assert(!appHtml.includes('setInterval(advance'), 'no fake progress timers');
assert(appHtml.includes('완료율은 임의로 표시하지 않습니다'), 'AI indeterminate status');
assert(appHtml.includes('previousResult=state.aiResult'), 'AI failed regeneration preserves result');
assert(aiService.includes('report:{summaryText:summaryText,futurePlanText:futurePlanText}'), 'existing AI text returned without parsing');
assert(appHtml.includes('downloadStatus:state.downloadResult?"stale"'), 'downstream report stale');
assert(appHtml.includes('quality.aiAllowed') || appHtml.includes('qualityAiAllowed'), 'quality aiAllowed remains gate');
assert(appHtml.includes('getQualityUserMessage_'), 'quality code translation');
assert(!html.includes('scoreMapText'), 'no scoreMap JSON editor');
assert(!html.includes('00_품질검사') || html.includes('내부 품질검사 시트는 포함되지 않습니다'), 'quality excluded wording');
assert(css.includes('overflow-wrap:anywhere'), 'long text wrapping');

console.log('survey-dashboard-v2 static workflow checks passed');
