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
  return vm.runInNewContext(`(${extractFunctionSource(name)})`);
}
function extractFunctionSource(name) {
  const start = script.indexOf(`function ${name}(`);
  assert(start >= 0, `function ${name} exists`);
  const brace = script.indexOf('{', start);
  let depth = 0;
  for (let index = brace; index < script.length; index += 1) {
    if (script[index] === '{') depth += 1;
    if (script[index] === '}' && --depth === 0) return script.slice(start, index + 1);
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

const dashboardContext = {Number, String, Math, Array, escapeHtml:value => String(value), formatMetric_:formatMetric};
vm.createContext(dashboardContext);
['dashboardMultipleFallbackTitle_', 'classifyDashboardMultipleQuestion_', 'selectDashboardMultipleCards_',
  'dashboardKpis_', 'dashboardBarChartHtml_', 'dashboardStatusPresentation_'].forEach(name => vm.runInContext(extractFunctionSource(name), dashboardContext));
const question = (text, counts=[3, 2, 1]) => ({question:text, items:counts.map((count,index) => ({label:`항목 ${index + 1}`,count}))});
const titles = questions => dashboardContext.selectDashboardMultipleCards_(questions).map(item => item.title);
assert.deepStrictEqual([...titles([question('개선할 점'), question('향후 희망 서비스')])], ['개선 필요사항 TOP 5', '향후 희망 서비스 TOP 5']);
assert.deepStrictEqual([...titles([question('프로그램에서 좋았던 점을 모두 선택해 주세요.'), question('앞으로 참여하고 싶은 프로그램을 모두 선택해 주세요.')])], ['향후 희망 프로그램 TOP 5', '만족 요인 TOP 5']);
assert.deepStrictEqual([...titles([question('개선할 점')])], ['개선 필요사항 TOP 5']);
assert.deepStrictEqual([...titles([question('좋았던 점')])], ['만족 요인 TOP 5']);
assert.deepStrictEqual([...titles([question('향후 희망 서비스')])], ['향후 희망 서비스 TOP 5']);
assert.strictEqual(titles([question('도서관 이용 목적'), question('프로그램 참여 경로')]).length, 2);
assert.strictEqual(titles([]).length, 0);
assert.strictEqual(titles([question('빈 문항', [])]).length, 0);

const bars = dashboardContext.dashboardBarChartHtml_([question('x', [0]).items[0]], {
  value:item => item.count, label:item => item.label, valueFormatter:value => `${value}건`
});
assert(!bars.includes('NaN') && !bars.includes('Infinity'), 'zero-count chart is finite');
assert(bars.includes('aria-label=') && bars.includes('0건'), 'bar is accessible and keeps text value');
const boundaryBars = dashboardContext.dashboardBarChartHtml_([{label:'최저',value:0},{label:'최고',value:5}], {
  maxValue:5,value:item => item.value,label:item => item.label,valueFormatter:value => `${value.toFixed(1)}점`
});
assert(boundaryBars.includes('width:0.00%') && boundaryBars.includes('width:100.00%'), 'average 0 and 5 use bounded widths');
assert.strictEqual((dashboardContext.dashboardBarChartHtml_(new Array(10).fill(null).map((_,i) => ({label:`L${i}`,value:i})), {
  limit:5, maxValue:5, value:item => item.value, label:item => item.label, valueFormatter:value => String(value)
}).match(/v2-dashboard-bar"/g) || []).length, 5, 'dashboard chart limits to five rows');

const kpiBase = {totalRespondents:72,overallAverage:4.14,overallPositiveRate:79.9};
assert.deepStrictEqual([...dashboardContext.dashboardKpis_({...kpiBase,recommendationPositiveRate:null,nps:34.7}).map(item => item.value)], ['72명','4.14 / 5','79.9%','NPS +34.7']);
assert(dashboardContext.dashboardKpis_({...kpiBase,recommendationPositiveRate:85,nps:null})[3].value.includes('85.0%'));
assert(dashboardContext.dashboardKpis_({...kpiBase,recommendationPositiveRate:85,nps:34.7})[3].value.includes('NPS +34.7'));
assert.strictEqual(dashboardContext.dashboardKpis_({...kpiBase,recommendationPositiveRate:null,nps:null})[3].value, '해당 없음');
dashboardContext.state={serverStatus:{qualityStatus:'PASS',aiComplete:false},downloadStatus:'idle'};
assert.strictEqual(dashboardContext.dashboardStatusPresentation_().page,'ai','quality complete advances to AI');
dashboardContext.state={serverStatus:{qualityStatus:'PASS',aiComplete:true},downloadStatus:'idle'};
assert.strictEqual(dashboardContext.dashboardStatusPresentation_().page,'download','AI complete advances to report');
dashboardContext.state={serverStatus:{qualityStatus:'PASS',aiComplete:true},downloadStatus:'success'};
assert.strictEqual(dashboardContext.dashboardStatusPresentation_().action,'Excel 다운로드','generated report is downloadable');
dashboardContext.state={serverStatus:{qualityStatus:'PASS',aiComplete:true},downloadStatus:'stale'};
assert(dashboardContext.dashboardStatusPresentation_().label.includes('업데이트'),'stale report is explicit');

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
assert(css.includes('@media(max-width:1100px)') && css.includes('@media(max-width:760px)'), 'desktop and narrow layouts');
const dashboardSource = script.slice(script.indexOf('function dashboardBarChartHtml_'), script.indexOf('function renderBottomNav'));
['Chart.js','Google Charts','newChart','insertChart','EmbeddedChart','insertImage','getBlob','PNG','SPARKLINE','█','░','canvas'].forEach(token =>
  assert(!dashboardSource.includes(token), `dashboard forbids ${token}`));
assert(html.includes('v2DashboardMultipleCards') && !html.includes('id="v2DashboardImprovement"'), 'multiple cards are dynamic');
assert(appHtml.includes('classList.toggle("is-compact",complete)'), 'completed dashboard compacts workflow');

console.log('survey-dashboard-v2 static workflow checks passed');
