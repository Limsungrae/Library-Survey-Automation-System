const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('Web/survey-dashboard-v2.html', 'utf8');
const appHtml = fs.readFileSync('Web/survey-dashboard-v2-app.html', 'utf8');
const css = fs.readFileSync('Web/survey-dashboard-v2-css.html', 'utf8');
const service = fs.readFileSync('AppsScript/10_WebService', 'utf8');
const aiService = fs.readFileSync('AppsScript/14_DynamicAI.gs', 'utf8');
const qualityService = fs.readFileSync('AppsScript/17_QualityValidator.gs', 'utf8');
const exportService = fs.readFileSync('AppsScript/08_ExcelExport.gs', 'utf8');
const secureService = fs.readFileSync('AppsScript/16_SecureWebApi.gs', 'utf8');
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
const normalizedProcessingState = extractFunction('normalizedProcessingState_');
assert.strictEqual(formatMetric(1, '명', 0), '1명');
assert.strictEqual(formatMetric(30, '명', 0), '30명');
assert.strictEqual(formatMetric(80, '명', 0), '80명');
assert.strictEqual(formatMetric(250, '명', 0), '250명');
assert.strictEqual(formatMetric(1250, '명', 0), '1,250명');
assert.strictEqual(formatMetric(null, '%', 1), '해당 없음');
['PASS', 'WARNING', 'FAIL', 'ERROR', 'STALE'].forEach(status => assert.notStrictEqual(qualityLabel(status), '검사 전'));
assert.strictEqual(normalizedProcessingState('idle'),'idle');
assert.strictEqual(normalizedProcessingState('saving'),'running');
assert.strictEqual(normalizedProcessingState('existing'),'success');
assert.strictEqual(normalizedProcessingState('error'),'error');

const dashboardContext = {Number, String, Math, Array, escapeHtml:value => String(value), formatMetric_:formatMetric};
vm.createContext(dashboardContext);
['dashboardMultipleFallbackTitle_', 'classifyDashboardMultipleQuestion_', 'selectDashboardMultipleCards_',
  'dashboardKpis_', 'dashboardBarChartHtml_', 'dashboardInterpretations_', 'dashboardStatusPresentation_',
  'buildDynamicVisualizationReportModel_'].forEach(name => vm.runInContext(extractFunctionSource(name), dashboardContext));
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

const kpiBase = {totalRespondents:82,overallAverage:4.73,overallPositiveRate:93.7};
const visualization=dashboardContext.buildDynamicVisualizationReportModel_({summary:kpiBase||{},satisfaction:[],multiple:[{question:'개선할 점',items:[{label:'횟수 확대',count:36,selectionRate:28.6,respondentRate:43.9}]}]}, {}, null);
assert.strictEqual(visualization.multipleSections[0].items[0].respondentRate,43.9,'visualization uses respondent rate');
assert.strictEqual(visualization.satisfaction.length,0,'missing panels remain absent');
assert.strictEqual(visualization.respondentCount,82,'visualization preserves respondent count');
assert.strictEqual(visualization.kpis[1].value,'4.73 / 5','visualization preserves satisfaction formatting');
assert.strictEqual(visualization.kpis[2].value,'93.7%','visualization preserves positive-rate formatting');
assert.strictEqual(Object.prototype.hasOwnProperty.call(visualization,'text'),false,'visualization excludes opinion source text');
assert.deepStrictEqual([...dashboardContext.dashboardKpis_({...kpiBase,recommendationPositiveRate:null,nps:34.7}).map(item => item.value)], ['82명','4.73 / 5','93.7%','NPS +34.7']);
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
assert(html.includes('v2MappingPreflight') && html.includes('v2MappingPreflightDetails'), 'mapping preflight is explicit');
assert(appHtml.includes('mappingPreflightModel_') && html.includes('통계 분석 시작'), 'analysis preflight action contract');
assert(!html.includes('v2AnalysisConfirmMapping'), 'non-validating confirmation checkbox is removed');
['Analysis','Quality','Ai','Download'].forEach(prefix => assert(html.includes(`v2${prefix}Processing`), `${prefix} common processing card`));
['idle','running','success','error'].forEach(status => assert(appHtml.includes(`"${status}"`), `processing state ${status}`));
['v2AnalysisLogDetails','v2QualityLogDetails','v2AiLogDetails'].forEach(id => {
  const tag=html.match(new RegExp(`<details[^>]+id="${id}"[^>]*>`));
  assert(tag && !tag[0].includes(' open'), `${id} is collapsed by default`);
});
assert(appHtml.includes('normalized==="error"') && appHtml.includes('details.open=true'), 'error details automatically open');
assert(appHtml.includes('removeAttribute("aria-valuenow")'), 'indeterminate progress does not claim a percentage');
assert(appHtml.includes('options.globalLoading===true'), 'global loading is opt-in');
['validateToken','login','logout'].forEach(name => {
  const source=appHtml.slice(appHtml.indexOf(`${name}:function`),appHtml.indexOf('\n',appHtml.indexOf(`${name}:function`)));
  assert(source.includes('globalLoading:true'), `${name} may use bootstrap/auth overlay`);
});
['settings','saveSettings','systemStatus','createRawData','inspectMapping','inspectMappingByRule','savedMappings','saveMappings','generateAnalysis','dashboardData','runQuality','generateAiReport','exportReport'].forEach(name => {
  const source=appHtml.slice(appHtml.indexOf(`${name}:function`),appHtml.indexOf('\n',appHtml.indexOf(`${name}:function`)));
  assert(!source.includes('globalLoading:true'), `${name} does not block the full screen`);
});
assert(appHtml.includes('function setButtonBusy_') && appHtml.includes('setAttribute("aria-busy"'), 'shared button busy contract');
['v2AnalysisProcessing','v2QualityProcessing','v2AiProcessing','v2DownloadProcessing'].forEach(id => {
  assert(html.includes(`id="${id}"`) && html.includes('aria-busy="false"'), `${id} exposes busy semantics`);
});
assert(html.includes('v2-processing-flow--ai') && html.includes('AI 분석은 설문 규모에 따라'), 'long-running AI processing guidance');
assert(appHtml.includes('AI 분석 요청이 일시적으로 많아'), 'AI quota error has a user-safe message');
assert(service.includes('statisticsRevision === rawRevision') && service.includes('statisticsSheetsComplete'), 'statistics completion is revision-aware');
assert(service.includes('qualityRevision === rawRevision') && service.includes('aiRevision === rawRevision'), 'quality and AI freshness are revision-aware');
assert(aiService.includes('assertDynamicQualityFresh_(null,true)'), 'AI write is blocked for stale statistics or quality');
assert(qualityService.includes('assertDynamicStatisticsFresh_()') && qualityService.includes('markDynamicQualityRevision_'), 'quality binds to current statistics revision');
assert(exportService.includes('assertDynamicAIReportFresh_()'), 'XLSX export blocks mixed revisions before copying sheets');
assert(extractFunctionSource('selectFile').includes('state.dashboardData=null') && extractFunctionSource('selectFile').includes('state.dashboardStatus="idle"'), 'new raw selection clears the previous dashboard');
assert(extractFunctionSource('selectFile').includes('state.respondentCount=0'), 'new file selection clears the previous respondent preview');
assert(extractFunctionSource('renderUpload').includes('"확인 중"'), 'respondent preview avoids an unverified estimate');
assert(extractFunctionSource('applyMappingResult').includes('result.responseCount'), 'server mapping response is the preview count source of truth');
['v2VisualizationPreviewButton','v2VisualizationPdfButton','v2VisualizationPngButton'].forEach(id => assert(html.includes(`id="${id}"`), `${id} exists`));
assert(secureService.includes('securePrepareDynamicVisualizationPdfExportFromWeb') && secureService.includes('securePrepareDynamicVisualizationPngExportFromWeb'), 'secure PDF and PNG export APIs exist');
const visualizationExportSource=extractFunctionSource('startVisualizationExport_');
assert(visualizationExportSource.includes('visualizationModel_()') && visualizationExportSource.includes('buildDynamicVisualizationSvg_(model)'), 'PDF and PNG share the preview model and SVG renderer');
assert(visualizationExportSource.includes('if(state[statusKey]==="running")return'), 'PDF and PNG duplicate execution is blocked');
assert(visualizationExportSource.includes('prepare(authorization.rawRevision)'), 'revision is checked again before download');
assert(extractFunctionSource('setVisualizationBusy_').includes('setButtonBusy_'), 'visualization buttons expose disabled and aria-busy state');
assert(!extractFunctionSource('buildDynamicVisualizationReportModel_').match(/opinions|maskedText|email|phone/i), 'visualization model excludes personal and raw opinion fields');
assert(css.includes('prefers-reduced-motion') && css.includes('button[aria-busy="true"]'), 'busy animation is accessible');
assert(appHtml.includes('if(state.analysisStatus==="running")return') && appHtml.includes('if(state.qualityRunStatus==="running")return') && appHtml.includes('if(state.aiRunStatus==="running")return') && appHtml.includes('if(state.downloadStatus==="running")return'), 'duplicate execution guards remain');
const startQualitySource=extractFunctionSource('startQuality');
assert(!startQualitySource.includes('{analysis:true,quality:true'), 'quality run does not stale analysis');
assert(startQualitySource.includes('{quality:true,ai:true,report:true}'), 'quality run stales only downstream results');
assert(startQualitySource.includes('{quality:false}'), 'quality success marks quality fresh');
const startAnalysisSource=extractFunctionSource('startAnalysis');
assert(startAnalysisSource.includes('{analysis:false,quality:true,ai:true,report:true}'), 'analysis success refreshes analysis and stales downstream results');
const startAiSource=extractFunctionSource('startAiReport');
assert(startAiSource.includes('{ai:false,report:true}'), 'AI success refreshes AI and stales report');
const startExportSource=extractFunctionSource('startExport');
assert(startExportSource.includes('{report:false}'), 'export success refreshes report only');
assert(html.includes('v2VisualizationPreview') && appHtml.includes('buildDynamicVisualizationReportModel_'), 'visualization preview model');
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
