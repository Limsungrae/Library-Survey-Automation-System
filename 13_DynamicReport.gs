/**
 * ==========================================================================
 * 성남시중원도서관 만족도 조사 자동화 시스템
 * 범용 통계 보고서 생성
 * ==========================================================================
 *
 * 표 중심 보고서 시트
 * - 01_조사개요 ~ 06_주관식분석
 * - 각 문항 표의 보조열에 독립 범위 SPARKLINE 막대를 표시합니다.
 * - 일반 EmbeddedChart는 생성하지 않습니다.
 */


/**
 * 웹 대시보드에서 범용 통계 보고서를 생성합니다.
 *
 * @return {Object}
 */
function generateDynamicStatisticalReport_() {
  const lock = LockService.getScriptLock();
  let currentStage = "분석 잠금 획득";

  try {
    lock.waitLock(30000);

    currentStage = "조사 설정 조회";
    const settings = getSurveySettings_();
    currentStage = "문항 매핑 및 범용 원자료 조회";
    const source = getDynamicSurveySource_();
    currentStage = "동적 통계 계산";
    const analysis = calculateDynamicSurveyAnalysis_(source);
    currentStage = "통계 품질검사";
    const quality = validateDynamicSurveyQuality_(analysis, source);

    currentStage = "조사개요 시트 생성";
    createDynamicOverviewSheet_(analysis, settings);
    currentStage = "대시보드 시트 생성";
    createDynamicDashboardSheet_(analysis, settings);
    currentStage = "응답자특성 통합 시트 생성";
    createDynamicRespondentSheet_(analysis);
    currentStage = "복수응답 시트 생성";
    createDynamicMultipleSheet_(analysis);
    currentStage = "만족도 통합 시트 생성";
    createDynamicSatisfactionSheet_(analysis);
    currentStage = "주관식 시트 생성";
    createDynamicOpinionRawSheet_(analysis);
    currentStage = "품질검사 시트 숨김";
    hideDynamicQualitySheet_();

    currentStage = "통계 시트 정렬 및 저장";
    moveDynamicStatisticalSheetsInOrder_();
    SpreadsheetApp.flush();

    return {
      success: true,
      message: "범용 통계 보고서 생성이 완료되었습니다.",
      generatedSheets: [
        getDynamicInternalSheetName_("QUALITY", "00_품질검사"),
        getDynamicReportSheetName_("OVERVIEW", "01_조사개요"),
        getDynamicReportSheetName_("DASHBOARD", "02_대시보드"),
        getDynamicReportSheetName_("RESPONDENT", "03_응답자특성"),
        getDynamicReportSheetName_("MULTIPLE", "04_복수응답분석"),
        getDynamicReportSheetName_("SATISFACTION", "05_만족도분석"),
        getDynamicReportSheetName_("OPINION", "06_주관식분석")
      ],
      summary: buildDynamicReportSummary_(analysis),
      quality: quality
    };

  } catch (error) {
    const errorMessage = getWebErrorMessage_(error);
    console.error("Dynamic Survey Analysis 실패 [" + currentStage + "]: " + errorMessage);
    return {
      success: false,
      error: "통계 분석 실패 (" + currentStage + "): " + errorMessage
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {
      // 잠금 미획득 시 무시
    }
  }
}


function buildDynamicReportSummary_(analysis) {
  const recommendations = analysis.recommendation || [];
  const npsItems = recommendations.filter(function(item){return item.scaleKind === "NPS_0_10";});
  const recommendationItems = recommendations.filter(function(item){return item.scaleKind === "RECOMMENDATION_1_5";});

  return {
    respondentCount: Number(analysis.respondentCount || 0),
    totalRespondents: Number(analysis.respondentCount || 0),
    overallAverage: analysis.scaleSummary && analysis.scaleSummary.weightedAverage !== null
      ? Number(analysis.scaleSummary.weightedAverage) : null,
    overallConverted100: analysis.scaleSummary && analysis.scaleSummary.overallConverted100 !== null
      ? Number(analysis.scaleSummary.overallConverted100) : null,
    overallPositiveRate: Number(
      analysis.scaleSummary
      && analysis.scaleSummary.overallPositiveRate
        ? analysis.scaleSummary.overallPositiveRate
        : 0
    ),
    recommendationAverage:
      recommendationItems.length ? Number(recommendationItems[0].average || 0) : null,
    recommendationPositiveRate:
      recommendationItems.length ? Number(recommendationItems[0].positiveRate || 0) : null,
    nps: npsItems.length ? npsItems[0].nps : null,
    recommendationItems: recommendations.map(function(item){return {question:item.question,scaleKind:item.scaleKind,
      average:item.average===undefined?null:item.average,nps:item.nps===undefined?null:item.nps};}),
    analyzedQuestionCount: Number(analysis.summary && analysis.summary.analyzedQuestionCount || 0),
    opinionCount: Number(analysis.summary && analysis.summary.opinionCount || 0),
    missingRate: Number(analysis.summary && analysis.summary.missingRate || 0),
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
  };
}


function createDynamicOverviewSheet_(analysis, settings) {
  const sheet = resetDynamicReportSheet_(getDynamicReportSheetName_("OVERVIEW", "01_조사개요"));

  setDynamicReportTitle_(sheet, "A1:H2", "Ⅰ. 조사 개요");

  const rows = [
    ["구분", "내용"],
    ["조사명", getDynamicSettingDisplay_(settings, "조사명", "surveyName")],
    ["조사목적", getDynamicSettingDisplay_(settings, "조사목적", "surveyPurpose")],
    ["조사기간", getDynamicSettingDisplay_(settings, "조사기간", "surveyPeriod")],
    ["조사대상", getDynamicSettingDisplay_(settings, "조사대상", "surveyTarget")],
    ["조사방법", getDynamicSettingDisplay_(settings, "조사방법", "surveyMethod")],
    ["분석방법", getDynamicSettingDisplay_(settings, "분석방법", "analysisMethod")],
    ["표본 수", Number(analysis.respondentCount || 0) + "명"],
    ["분석 문항 수", Number(analysis.summary && analysis.summary.analyzedQuestionCount || 0) + "개"],
    ["담당부서", getDynamicSettingValue_(settings, "담당부서", "department")],
    ["문의처", getDynamicSettingValue_(settings, "문의처", "contact")],
    ["생성기관", getDynamicSettingDisplay_(settings, "생성기관", "organization")],
    ["유효응답 기준", "문항별 비어 있지 않고 유효하게 변환된 응답"],
    ["개인정보 처리", "개인정보 문항 분석 제외 및 AI 입력 비식별 처리"],
    ["생성일", Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyy-MM-dd HH:mm:ss")]
  ];

  sheet.getRange(4, 1, rows.length, 2).setValues(rows);
  styleDynamicReportHeader_(sheet.getRange(4, 1, 1, 2));
  sheet.getRange(5, 1, rows.length - 1, 1)
    .setBackground("#EAF2F8")
    .setFontWeight("bold");
  sheet.getRange(4, 1, rows.length, 2)
    .setWrap(true)
    .setVerticalAlignment("middle");
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 560);
  finishDynamicReportSheet_(sheet, rows.length + 5, 8);
}


function createDynamicDashboardSheet_(analysis, settings) {
  const sheet=resetDynamicDashboardSheet_();
  const model=buildDynamicDashboardModel_(analysis,settings);
  const mergePlanErrors=validateDynamicDashboardMergePlan_(getDynamicDashboardPlannedMerges_());
  if(mergePlanErrors.length)throw new Error("대시보드 병합 계획 오류: "+mergePlanErrors.join(", "));
  const titleRange=safeMergeDynamicDashboardRange_(sheet,"A1:H2","dashboard-title");
  titleRange.setValue(model.title).setBackground("#17375E").setFontColor("#FFFFFF")
    .setFontWeight("bold").setFontFamily("맑은 고딕").setFontSize(17)
    .setHorizontalAlignment("center").setVerticalAlignment("middle")
    .setBorder(true,true,true,true,false,false,"#102F50",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setRowHeights(1,2,30);
  sheet.getRange("A1:H19").setFontFamily("맑은 고딕").setVerticalAlignment("middle");

  model.kpis.forEach(function(kpi,index){
    const startColumn=index*2+1;
    const valueA1=dynamicDashboardRangeA1_(4,startColumn,6,startColumn+1);
    const labelA1=dynamicDashboardRangeA1_(7,startColumn,7,startColumn+1);
    safeMergeDynamicDashboardRange_(sheet,valueA1,"kpi-value-"+(index+1)).setValue(kpi.displayText)
      .setBackground("#EEF3F8").setFontColor("#17375E").setFontWeight("bold").setFontSize(18)
      .setHorizontalAlignment("center").setVerticalAlignment("middle");
    safeMergeDynamicDashboardRange_(sheet,labelA1,"kpi-label-"+(index+1)).setValue(kpi.label)
      .setBackground("#F8FAFC").setFontColor("#52677C").setFontSize(9)
      .setHorizontalAlignment("center").setVerticalAlignment("middle");
    sheet.getRange(4,startColumn,4,2).setBorder(true,true,true,true,true,true,"#AAB8C5",SpreadsheetApp.BorderStyle.SOLID);
  });

  model.sections.forEach(function(section,index){
    const startColumn=index*2+1;
    sheet.getRange(10,startColumn,1,2).setValues([[section.label,section.valueLabel]]);
    styleDynamicReportHeader_(sheet.getRange(10,startColumn,1,2));
    const rows=[];
    for(let rowIndex=0;rowIndex<9;rowIndex++){
      const item=section.items[rowIndex];
      rows.push(item?[item.label,item.displayText]:["",""]);
    }
    sheet.getRange(11,startColumn,9,2).setValues(rows).setWrap(true).setVerticalAlignment("middle");
    sheet.getRange(11,startColumn+1,9,1).setHorizontalAlignment("right")
      .setFontFamily("Consolas").setFontSize(9);
    sheet.getRange(10,startColumn,10,2).setBorder(true,true,true,true,true,true,"#AAB8C5",SpreadsheetApp.BorderStyle.SOLID);
    section.items.forEach(function(item,rowIndex){
      if(item.isMax)sheet.getRange(11+rowIndex,startColumn,1,2).setBackground("#FFF2CC");
    });
  });

  [210,190,210,190,210,190,210,190].forEach(function(width,index){sheet.setColumnWidth(index+1,width);});
  sheet.setRowHeights(4,4,24);sheet.setRowHeight(5,32);sheet.setRowHeight(6,32);
  sheet.setRowHeight(10,30);sheet.setRowHeights(11,9,36);
  sheet.setFrozenRows(0);sheet.setFrozenColumns(0);sheet.setHiddenGridlines(true);
}


/** typed cell 콘텐츠를 먼저 제거한 뒤 A1:H19 서식을 초기화합니다. */
function resetDynamicDashboardSheet_(){
  const spreadsheet=SpreadsheetApp.getActiveSpreadsheet();
  let sheet=spreadsheet.getSheetByName(getDynamicReportSheetName_("DASHBOARD", "02_대시보드"));
  if(!sheet)sheet=spreadsheet.insertSheet(getDynamicReportSheetName_("DASHBOARD", "02_대시보드"));
  prepareDynamicDashboardFreezeState_(sheet);
  sheet.getCharts().forEach(function(chart){sheet.removeChart(chart);});
  resetDynamicDashboardRange_(sheet);
  sheet.setConditionalFormatRules([]);
  sheet.setHiddenGridlines(true);
  return sheet;
}


function getDynamicDashboardPlannedMerges_(){
  return ["A1:H2","A4:B6","A7:B7","C4:D6","C7:D7","E4:F6","E7:F7","G4:H6","G7:H7"];
}


function validateDynamicDashboardMergePlan_(ranges){
  const parsed=[],errors=[];
  (ranges||[]).forEach(function(a1){
    const match=String(a1).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if(!match){errors.push("잘못된 범위 "+a1);return;}
    const item={a1:a1,r1:Number(match[2]),c1:dynamicDashboardColumnNumber_(match[1]),
      r2:Number(match[4]),c2:dynamicDashboardColumnNumber_(match[3])};
    parsed.forEach(function(other){
      if(item.r1<=other.r2&&item.r2>=other.r1&&item.c1<=other.c2&&item.c2>=other.c1)
        errors.push("겹침 "+other.a1+" / "+item.a1);
    });
    parsed.push(item);
  });
  return errors;
}


function dynamicDashboardColumnNumber_(letters){
  return String(letters).split("").reduce(function(total,letter){return total*26+letter.charCodeAt(0)-64;},0);
}


/** 기존 고정 경계를 기록하고 병합 해제보다 먼저 행·열 고정을 모두 해제합니다. */
function prepareDynamicDashboardFreezeState_(sheet,logger){
  const range=sheet.getRange("A1:H19");
  const frozenRows=sheet.getFrozenRows();
  const frozenColumns=sheet.getFrozenColumns();
  const mergedRanges=range.getMergedRanges();
  const merged=mergedRanges.map(function(item){return item.getA1Notation();});
  const message="[DASHBOARD_FREEZE_STATE]\nsheet="+sheet.getName()+"\nfrozenRows="+frozenRows+
    "\nfrozenColumns="+frozenColumns+"\nplannedMerges="+getDynamicDashboardPlannedMerges_().join(",")+
    "\ncurrentMerges="+(merged.join(",")||"none");
  if(typeof logger==="function")logger(message);else Logger.log(message);

  // 가져온 Excel/기존 시트에는 병합 범위가 고정 경계를 가로지르는 비정상 상태가 남을 수 있습니다.
  // 이 상태에서 setFrozenRows(0) 자체가 병합 오류를 던질 수 있으므로 경계를 가로지르는 병합부터 해제합니다.
  mergedRanges.forEach(function(mergedRange){
    const crossesFrozenRow=frozenRows>0&&mergedRange.getRow()<=frozenRows&&mergedRange.getLastRow()>frozenRows;
    const crossesFrozenColumn=frozenColumns>0&&mergedRange.getColumn()<=frozenColumns&&mergedRange.getLastColumn()>frozenColumns;
    if(crossesFrozenRow||crossesFrozenColumn){
      Logger.log("[DASHBOARD_PRE_UNMERGE] range="+mergedRange.getA1Notation()+
        " crossesFrozenRow="+crossesFrozenRow+" crossesFrozenColumn="+crossesFrozenColumn);
      mergedRange.breakApart();
    }
  });

  try{
    sheet.setFrozenRows(0);
    sheet.setFrozenColumns(0);
  }catch(error){
    // 일부 비정상 시트는 경계 판정만으로 해제되지 않을 수 있어 대시보드 영역의 병합을 모두 해제하고 한 번만 재시도합니다.
    Logger.log("[DASHBOARD_FREEZE_RESET_RETRY] error="+(error&&error.message?error.message:String(error)));
    range.breakApart();
    sheet.setFrozenRows(0);
    sheet.setFrozenColumns(0);
  }
}


function safeMergeDynamicDashboardRange_(sheet,a1Notation,stage){
  const range=sheet.getRange(a1Notation);
  const frozenRows=sheet.getFrozenRows(),frozenColumns=sheet.getFrozenColumns();
  if(frozenRows!==0||frozenColumns!==0){
    Logger.log("[DASHBOARD_MERGE_ERROR]\nstage="+stage+"\nrange="+a1Notation+
      "\nfrozenRows="+frozenRows+"\nfrozenColumns="+frozenColumns+
      "\nstartRow="+range.getRow()+"\nendRow="+range.getLastRow()+
      "\nstartColumn="+range.getColumn()+"\nendColumn="+range.getLastColumn());
    throw new Error("대시보드 병합 전에 고정 행·열이 해제되지 않았습니다: "+a1Notation);
  }
  const overlaps=range.getMergedRanges();
  if(overlaps.length){
    const exact=overlaps.length===1&&overlaps[0].getA1Notation()===a1Notation;
    if(exact)return range;
    throw new Error("대시보드 병합 범위가 기존 병합과 겹칩니다: "+a1Notation+" / "+
      overlaps.map(function(item){return item.getA1Notation();}).join(", "));
  }
  try{return range.merge();}catch(error){
    Logger.log("[DASHBOARD_MERGE_ERROR]\nstage="+stage+"\nrange="+a1Notation+"\nerror="+
      (error&&error.message?error.message:String(error)));
    throw error;
  }
}


function dynamicDashboardRangeA1_(startRow,startColumn,endRow,endColumn){
  return dynamicColumnLetter_(startColumn)+startRow+":"+dynamicColumnLetter_(endColumn)+endRow;
}


function resetDynamicDashboardRange_(sheet){
  const range=sheet.getRange("A1:H19");
  runDynamicDashboardRangeOperation_("resetDynamicDashboardRange_","unmerge",range,function(){range.breakApart();});
  runDynamicDashboardRangeOperation_("resetDynamicDashboardRange_","clear-content",range,function(){range.clearContent();});
  runDynamicDashboardRangeOperation_("resetDynamicDashboardRange_","clear-validation",range,function(){range.clearDataValidations();});
  runDynamicDashboardRangeOperation_("resetDynamicDashboardRange_","clear-notes",range,function(){range.clearNote();});
  runDynamicDashboardRangeOperation_("resetDynamicDashboardRange_","reset-visual-format",range,function(){
    range.setBackground("#FFFFFF").setFontColor("#000000").setFontWeight("normal").setFontStyle("normal")
      .setHorizontalAlignment("left").setVerticalAlignment("middle").setWrap(false)
      .setBorder(false,false,false,false,false,false);
  });
}


/** 오류를 숨기지 않고 Range·값·타입을 실행 로그에 남긴 뒤 원래 예외를 다시 던집니다. */
function runDynamicDashboardRangeOperation_(functionName,stage,range,operation,numberFormat){
  try{return operation();}catch(error){
    logDynamicDashboardRangeError_(functionName,stage,range,numberFormat,error);
    throw error;
  }
}


function logDynamicDashboardRangeError_(functionName,stage,range,numberFormat,error){
  let values=[];
  try{values=range.getValues();}catch(ignored){}
  const firstValue=values.length&&values[0].length?values[0][0]:undefined;
  Logger.log("[DASHBOARD_NUMBER_FORMAT_ERROR]\nfunction="+functionName+"\nstage="+stage+
    "\nrange="+range.getA1Notation()+"\nstartRow="+range.getRow()+"\nstartColumn="+range.getColumn()+
    "\nrows="+range.getNumRows()+"\ncolumns="+range.getNumColumns()+"\nvalue="+String(firstValue)+
    "\nvalueType="+typeof firstValue+"\nnumberFormat="+(numberFormat||"not requested")+
    "\nerror="+(error&&error.message?error.message:String(error)));
}
function getDynamicRecommendationKpiLabel_(item) {

  const question = cleanText_(item && item.question || "");

  if (/재이용|다시\s*이용|계속\s*이용/.test(question)) {
    return "재이용 긍정률";
  }

  if (/추천/.test(question)) {
    return "추천 긍정률";
  }

  if (/재참여/.test(question)) {
    return "재참여 긍정률";
  }

  return "의향 긍정률";
}

function buildDynamicDashboardModel_(analysis,settings){
  const respondentCount=Number(analysis.respondentCount||0);
  const overallAverage=analysis.scaleSummary&&analysis.scaleSummary.weightedAverage!==null
    &&analysis.scaleSummary.weightedAverage!==undefined?Number(analysis.scaleSummary.weightedAverage):null;
  const overallPositiveRate=analysis.scaleSummary&&analysis.scaleSummary.overallPositiveRate!==null
    &&analysis.scaleSummary.overallPositiveRate!==undefined?Number(analysis.scaleSummary.overallPositiveRate):null;
  const surveyName=getDynamicSettingValue_(settings,"조사명","surveyName")||"만족도 조사";
  const scale=(analysis.scale||[]).filter(function(item){return item.average!==null&&item.average!==undefined;});
  const recommendation=(analysis.recommendation||[]).filter(function(item){return item.positiveRate!==null&&item.positiveRate!==undefined;});
  const recommendationRate=recommendation.length?Number(recommendation[0].positiveRate):null;
  const recommendationLabel =
    recommendation.length
        ? getDynamicRecommendationKpiLabel_(recommendation[0])
        : "의향 긍정률";
  const future=selectDynamicDashboardMultipleQuestion_(analysis.multiple||[],/(?:향후|희망|원하|서비스|프로그램)/i);
  const improvement=selectDynamicDashboardMultipleQuestion_(analysis.multiple||[],/(?:개선|불편|보완|필요|요구)/i,future);
  return {title:surveyName+" 대시보드",kpis:[
    {label:"전체 응답자",value:respondentCount,displayText:respondentCount?respondentCount.toLocaleString("ko-KR")+"명":"-"},
    {label:scale.length+"개 만족도 평균",value:overallAverage,displayText:overallAverage===null?"-":overallAverage.toFixed(2)+"/5점"},
    {label:"만족도 긍정률",value:overallPositiveRate,displayText:overallPositiveRate!==null&&Number.isFinite(overallPositiveRate)?overallPositiveRate.toFixed(1)+"%":"-"},
    {label:recommendationLabel,value:recommendationRate,displayText:recommendationRate!==null&&Number.isFinite(recommendationRate)?recommendationRate.toFixed(1)+"%":"-"}
  ],sections:[
    {label:"세부 만족도",valueLabel:"평균",items:buildDynamicDashboardItems_(scale,5,8,true)},
    {label:"향후 희망 서비스",valueLabel:"선택 수",items:buildDynamicDashboardItems_(future?future.items:[],null,8,false)},
    {label:"개선 필요사항",valueLabel:"선택 수",items:buildDynamicDashboardItems_(improvement?improvement.items:[],null,8,false)},
    {label:"주관식 범주",valueLabel:"언급 수",items:buildDynamicDashboardOpinionItems_(analysis,8)}
  ]};
}


function selectDynamicDashboardMultipleQuestion_(questions,pattern,excluded){
  const candidates=(questions||[]).filter(function(question){return question!==excluded;});
  return candidates.filter(function(question){return pattern.test(cleanText_(question.question));})[0]||candidates[0]||null;
}


function buildDynamicDashboardItems_(source,fixedMaximum,limit,isScale){
  const items=(source||[]).map(function(item){return {label:cleanText_(item.question||item.label),
    value:Number(isScale?item.average:item.count||0)};}).filter(function(item){return item.label&&Number.isFinite(item.value);});
  if(!isScale)items.sort(function(a,b){return b.value-a.value||a.label.localeCompare(b.label,"ko");});
  const shown=items.slice(0,limit),maximum=fixedMaximum||Math.max.apply(null,shown.map(function(item){return item.value;}).concat([0]));
  const highest=shown.length?Math.max.apply(null,shown.map(function(item){return item.value;})):null;
  return shown.map(function(item){return {label:item.label,value:item.value,
    displayText:buildDynamicDashboardUnicodeBar_(item.value,maximum,isScale?item.value.toFixed(2):item.value.toLocaleString("ko-KR")),
    isMax:highest!==null&&item.value===highest};});
}


function buildDynamicDashboardOpinionItems_(analysis,limit){
  let categories=[];
  if(Array.isArray(analysis.opinionCategories))categories=analysis.opinionCategories;
  (analysis.text||[]).forEach(function(question){if(Array.isArray(question.categories))categories=categories.concat(question.categories);});
  if(!categories.length)return [{label:"분석 결과 없음",value:0,displayText:"-",isMax:false}];
  return buildDynamicDashboardItems_(categories.map(function(item){return {label:item.category||item.label,count:item.count};}),null,limit,false);
}


function buildDynamicDashboardUnicodeBar_(value,maximum,valueText){
  const width=12,ratio=maximum>0?Math.max(0,Math.min(1,Number(value||0)/maximum)):0;
  const filled=Math.round(width*ratio);
  return new Array(filled+1).join("█")+new Array(width-filled+1).join("░")+" "+valueText;
}

function createDynamicRespondentSheet_(analysis) {
  const sheetName = getDynamicReportSheetName_("RESPONDENT", "03_응답자특성");
  const sheet = resetDynamicReportSheet_(sheetName);
  setDynamicReportTitle_(sheet, "A1:F2", "Ⅲ. 응답자 특성");

  const respondentQuestions = analysis.respondent || [];
  const singleQuestions = analysis.single || [];
  const sections = [];

  if (respondentQuestions.length) {
    sections.push({label: "응답자 기본 특성", questions: respondentQuestions});
  }
  if (singleQuestions.length) {
    sections.push({label: "기타 단일응답 결과", questions: singleQuestions});
  }

  let row = 4;
  if (!sections.length) {
    sheet.getRange(row, 1).setValue("응답자 특성 분석 대상 문항이 없습니다.");
    finishDynamicReportSheet_(sheet, row + 2, 6);
    return;
  }

  sections.forEach(function(section) {
    sheet.getRange(row, 1, 1, 6).merge().setValue(section.label)
      .setBackground("#B4C6E7").setFontColor("#17375E")
      .setFontWeight("bold").setFontSize(11).setHorizontalAlignment("left");
    row += 2;
    row = appendDynamicCategoricalQuestions_(sheet, row, section.questions, analysis.respondentCount);
  });

  sheet.setColumnWidth(1, 380);
  sheet.setColumnWidths(2, 4, 130);
  finishDynamicReportSheet_(sheet, row, 6);
}

/**
 * 단일응답 문항 표를 지정 시트에 이어 붙입니다.
 * 전체 응답자 수를 명시적으로 전달해 기존 analysis 미정의 오류를 방지합니다.
 */
function appendDynamicCategoricalQuestions_(sheet, startRow, questions, respondentCount) {
  let row = startRow;
  (questions || []).forEach(function(question, questionIndex) {
    styleDynamicQuestionTitle_(
      sheet.getRange(row, 1, 1, 6).merge()
        .setValue(formatDynamicQuestionTitle_(question, questionIndex))
    );
    row++;

    const rows = [["항목", "빈도", "시각화", "유효응답 기준 비율", "전체응답 기준 비율", "분석 기준"]];
    (question.items || []).forEach(function(item) {
      rows.push([
        item.label,
        Number(item.count || 0),
        "",
        Number(item.validResponseRate !== undefined ? item.validResponseRate : (item.rate || 0)) / 100,
        Number(item.totalRespondentRate || 0) / 100,
        "유효 " + Number(question.validResponses || 0) + " / 무응답 " + Number(question.missingResponses || 0)
      ]);
    });

    const totalRespondents = getDynamicQuestionTotalRespondents_(question, respondentCount);
    rows.push([
      "합계",
      Number(question.validResponses || 0),
      "",
      question.validResponses ? 1 : 0,
      totalRespondents ? Number(question.validResponses || 0) / totalRespondents : 0,
      totalRespondents > 0 ? "전체 " + totalRespondents : "전체 응답자 확인 필요"
    ]);

    sheet.getRange(row, 1, rows.length, 6).setValues(rows);
    styleDynamicReportHeader_(sheet.getRange(row, 1, 1, 6));
    sheet.getRange(row + 1, 4, rows.length - 1, 2).setNumberFormat("0.0%");
    styleDynamicReportTotalRow_(sheet.getRange(row + rows.length - 1, 1, 1, 6));
    setDynamicBarSparklines_(sheet, row + 1, (question.items || []).length, 2, 3);
    highlightDynamicRowsByMetric_(sheet, row + 1, (question.items || []).length, 2, 1, 6, "max", "#FFF2CC",
      (question.items || []).map(function(item) {
        return !/^(?:무응답|결측|빈값)$/i.test(cleanText_(item.label));
      }));
    row += rows.length + 2;
  });
  return row;
}

function getDynamicQuestionTotalRespondents_(question, respondentCount) {
  const directTotal = Number(question && question.totalRespondents);
  if (Number.isFinite(directTotal) && directTotal > 0) return directTotal;

  const validResponses = Number(question && question.validResponses || 0);
  const missingResponses = Number(question && question.missingResponses || 0);
  const calculatedTotal = validResponses + missingResponses;
  if (calculatedTotal > 0) return calculatedTotal;

  return Number(respondentCount || 0);
}

/** 레거시 호출 호환용: 신규 보고서에서는 응답자특성 시트에 통합됩니다. */
function createDynamicSingleSheet_(analysis) {
  return createDynamicRespondentSheet_(analysis);
}

function createDynamicMultipleSheet_(analysis) {
  const sheet = resetDynamicReportSheet_(getDynamicReportSheetName_("MULTIPLE", "04_복수응답분석"));
  setDynamicReportTitle_(sheet, "A1:F2", "Ⅳ. 복수응답 분석");

  let row = 4;
  const questions = analysis.multiple || [];

  if (questions.length === 0) {
    sheet.getRange(row, 1).setValue("복수응답 분석 대상 문항이 없습니다.");
    finishDynamicReportSheet_(sheet, row + 2, 6);
    return;
  }

  questions.forEach(function(question, questionIndex) {
    styleDynamicQuestionTitle_(sheet.getRange(row, 1, 1, 6).merge().setValue(formatDynamicQuestionTitle_(question,questionIndex)));

    row++;

    const rows = [[
      "항목",
      "선택건수",
      "시각화",
      "선택건수 비율",
      "전체 응답자 선택률",
      "유효 응답자 선택률"
    ]];

    (question.items || []).forEach(function(item) {
      rows.push([
        item.label,
        Number(item.count || 0),
        "",
        Number(item.selectionRate || 0) / 100,
        Number(item.respondentRate || 0) / 100,
        Number(item.validRespondentRate || 0) / 100
      ]);
    });

    const totalRow=buildDynamicMultipleTotalRow_(question);
    rows.push([totalRow[0],totalRow[1],"",totalRow[2],totalRow[3],totalRow[4]]);

    sheet.getRange(row, 1, rows.length, 6).setValues(rows);
    styleDynamicReportHeader_(sheet.getRange(row, 1, 1, 6));

    if (rows.length > 1) {
      sheet.getRange(row + 1, 4, rows.length - 1, 3)
        .setNumberFormat("0.0%");
    }

    styleDynamicReportTotalRow_(sheet.getRange(row + rows.length - 1, 1, 1, 6));
    setDynamicBarSparklines_(sheet,row+1,(question.items||[]).length,2,3);
    highlightDynamicRowsByMetric_(sheet,row+1,(question.items||[]).length,2,1,6,"max","#FFF2CC",
      (question.items||[]).map(function(item){return !/^(?:무응답|결측|빈값)$/i.test(cleanText_(item.label));}));
    row += rows.length + 2;
  });

  sheet.setColumnWidth(1, 380);
  sheet.setColumnWidths(2, 4, 125);
finishDynamicReportSheet_(sheet, row, 6);}

function buildDynamicMultipleTotalRow_(question) {
  return ["합계",Number(question.totalSelections||question.totalSelectionCount||0),
    Number(question.totalSelections||question.totalSelectionCount||0)>0?1:0,"",""];
}


function createDynamicSatisfactionSheet_(analysis) {
  const sheet = resetDynamicReportSheet_(
    getDynamicReportSheetName_("SATISFACTION", "05_만족도분석")
  );
  setDynamicReportTitle_(sheet, "A1:S2", "Ⅴ. 만족도 분석");

  let row = 4;
  row = appendDynamicScaleAnalysis_(sheet, row, analysis);
  row += 2;
  row = appendDynamicRecommendationAnalysis_(sheet, row, analysis);

  sheet.setColumnWidth(1, 420);
  sheet.setColumnWidths(2, 18, 95);
  finishDynamicReportSheet_(sheet, row, 19);
}

function appendDynamicScaleAnalysis_(sheet, startRow, analysis) {
  let row = startRow;
  sheet.getRange(row, 1, 1, 19).merge().setValue("세부 만족도 분석")
    .setBackground("#B4C6E7").setFontColor("#17375E")
    .setFontWeight("bold").setFontSize(11).setHorizontalAlignment("left");
  row++;

  const headers = ["문항","유효응답","시각화","결측","미매핑","5점","4점","3점","2점","1점","평균","중앙값","표준편차","100점 환산","긍정률","중립률","부정률","전체 가중평균 대비","순위"];
  const scaleItems = analysis.scale || [];
  const rows = [headers];

  scaleItems.forEach(function(item) {
    const distribution = item.scoreDistribution || {};
    rows.push([
      item.question, Number(item.validCount || 0), "", Number(item.missingCount || 0), Number(item.unmappedCount || 0),
      distribution[5] || 0, distribution[4] || 0, distribution[3] || 0, distribution[2] || 0, distribution[1] || 0,
      item.average, item.median, item.standardDeviation, item.converted100,
      Number(item.positiveRate || 0) / 100, Number(item.neutralRate || 0) / 100,
      Number(item.negativeRate || 0) / 100, item.deviation, item.rank
    ]);
  });

  const summary = analysis.scaleSummary || {};
  rows.push([
    "전체 요약", Number(summary.totalValidResponses || 0), "", "", "", "", "", "", "", "",
    summary.weightedAverage, "", "", summary.overallConverted100,
    Number(summary.overallPositiveRate || 0) / 100,
    Number(summary.overallNeutralRate || 0) / 100,
    Number(summary.overallNegativeRate || 0) / 100, "", ""
  ]);

  sheet.getRange(row, 1, rows.length, headers.length).setValues(rows);
  styleDynamicReportHeader_(sheet.getRange(row, 1, 1, headers.length));
  if (rows.length > 1) {
    sheet.getRange(row + 1, 11, rows.length - 1, 4).setNumberFormat("0.00");
    sheet.getRange(row + 1, 15, rows.length - 1, 3).setNumberFormat("0.0%");
  }
  setDynamicBarSparklines_(sheet, row + 1, scaleItems.length, 2, 3);
  highlightDynamicRowsByMetric_(sheet, row + 1, scaleItems.length, 11, 1, headers.length, "max", "#FFF2CC",
    scaleItems.map(function(item) { return Number(item.validCount || 0) > 0; }));

  const scaleAverages = scaleItems.filter(function(item) {
    return Number(item.validCount || 0) > 0 && item.average !== null && item.average !== undefined;
  }).map(function(item) { return Number(item.average); });

  if (scaleAverages.length && Math.min.apply(null, scaleAverages) < Math.max.apply(null, scaleAverages)) {
    highlightDynamicRowsByMetric_(sheet, row + 1, scaleItems.length, 11, 1, headers.length, "min", "#FCE4D6",
      scaleItems.map(function(item) { return Number(item.validCount || 0) > 0; }));
  }

  styleDynamicReportTotalRow_(sheet.getRange(row + rows.length - 1, 1, 1, headers.length));
  row += rows.length;
  sheet.getRange(row, 1, 1, headers.length).merge().setValue(
    "※ 전체 평균은 전체 유효 척도 응답 기준 가중평균입니다. 표준편차는 모집단 방식이며, 순위는 평균→긍정률→5점 응답 수를 기준으로 합니다."
  ).setWrap(true);
  return row + 1;
}

function appendDynamicRecommendationAnalysis_(sheet, startRow, analysis) {
  let row = startRow;
  const questions = analysis.recommendation || [];
  sheet.getRange(row, 1, 1, 8).merge().setValue("재이용·추천 등 의향 분석")
    .setBackground("#B4C6E7").setFontColor("#17375E")
    .setFontWeight("bold").setFontSize(11).setHorizontalAlignment("left");
  row += 2;

  if (!questions.length) {
    sheet.getRange(row, 1).setValue("재이용·추천 등 의향 분석 대상 문항이 없습니다.");
    return row + 2;
  }

  questions.forEach(function(item, questionIndex) {
    styleDynamicQuestionTitle_(
      sheet.getRange(row, 1, 1, 8).merge()
        .setValue(formatDynamicQuestionTitle_(item, questionIndex))
    );
    row++;

    const totalRespondents = getDynamicRecommendationTotalRespondents_(item, analysis);
    const denominatorText = totalRespondents > 0 ? "전체 " + totalRespondents : "전체 응답자 확인 필요";
    const isNps = (item.scaleKind || item.scaleMode) === "NPS_0_10";
    let rows;

    if (isNps) {
      rows = [
        ["구분", "인원", "시각화", "비율", "NPS", "유효응답", "무응답", "분모"],
        ["추천자", item.promoterCount, "", Number(item.promoterRate || 0) / 100, item.nps, item.validResponses, item.missingResponses, "유효응답"],
        ["중립자", item.passiveCount, "", Number(item.passiveRate || 0) / 100, "", item.validResponses, item.missingResponses, "유효응답"],
        ["비추천자", item.detractorCount, "", Number(item.detractorRate || 0) / 100, "", item.validResponses, item.missingResponses, "유효응답"],
        ["합계", item.validResponses, "", item.validResponses ? 1 : 0, item.nps, item.validResponses, item.missingResponses, denominatorText]
      ];
    } else {
      rows = [
        ["구분", "인원", "시각화", "비율", "평균", "유효응답", "무응답", "분모"],
        ["긍정", item.positiveCount, "", Number(item.positiveRate || 0) / 100, item.average, item.validResponses, item.missingResponses, "유효응답"],
        ["보통", item.neutralCount, "", Number(item.neutralRate || 0) / 100, "", item.validResponses, item.missingResponses, "유효응답"],
        ["부정", item.negativeCount, "", Number(item.negativeRate || 0) / 100, "", item.validResponses, item.missingResponses, "유효응답"],
        ["합계", item.validResponses, "", item.validResponses ? 1 : 0, item.average, item.validResponses, item.missingResponses, denominatorText]
      ];
    }

    sheet.getRange(row, 1, rows.length, 8).setValues(rows);
    styleDynamicReportHeader_(sheet.getRange(row, 1, 1, 8));
    sheet.getRange(row + 1, 4, rows.length - 1, 1).setNumberFormat("0.0%");
    styleDynamicReportTotalRow_(sheet.getRange(row + rows.length - 1, 1, 1, 8));
    setDynamicBarSparklines_(sheet, row + 1, 3, 2, 3);
    highlightDynamicRowsByMetric_(sheet, row + 1, 3, 2, 1, 8, "max", "#FFF2CC");
    row += rows.length + 2;
  });
  return row;
}

/** 레거시 호출 호환용: 신규 보고서에서는 만족도분석 시트에 통합됩니다. */
function createDynamicRecommendationSheet_(analysis) {
  return createDynamicSatisfactionSheet_(analysis);
}

function getDynamicRecommendationTotalRespondents_(item, analysis) {
  const directTotal = Number(item && item.totalRespondents);

  if (Number.isFinite(directTotal) && directTotal > 0) {
    return directTotal;
  }

  const validResponses = Number(item && item.validResponses || 0);
  const missingResponses = Number(item && item.missingResponses || 0);
  const calculatedTotal = validResponses + missingResponses;

  if (calculatedTotal > 0) {
    return calculatedTotal;
  }

  return Number(analysis && analysis.respondentCount || 0);
}
function createDynamicOpinionRawSheet_(analysis) {
  const sheet = resetDynamicReportSheet_(getDynamicReportSheetName_("OPINION", "06_주관식분석"));
  setDynamicReportTitle_(sheet, "A1:H2", "Ⅵ. 주관식 분석");

  const rows = [["문항", "응답 ID", "응답 번호", "원문", "비식별문", "유효 여부", "제외 사유", "검토 상태"]];

  (analysis.text || []).forEach(function(question) {
    (question.responses || []).forEach(function(opinion) {
      rows.push([
        question.question,
        opinion.responseId,
        String(opinion.responseNumber || ""),
        opinion.text,
        opinion.maskedText,
        opinion.valid ? "유효" : "제외",
        opinion.exclusionReason,
        "AI 분석 전"
      ]);
    });
  });

  if (rows.length === 1) {
    rows.push(["-", "-", "-", "유효한 주관식 응답이 없습니다.", "-", "-", "-", "-"]);
  }

  sheet.getRange(4, 1, rows.length, 8).setValues(rows);
  styleDynamicReportHeader_(sheet.getRange(4, 1, 1, 8));
  sheet.getRange(5, 3, rows.length - 1, 1).setNumberFormat("@");
  sheet.getRange(5, 1, rows.length - 1, 8)
    .setWrap(true)
    .setVerticalAlignment("top");
  sheet.setColumnWidth(1, 340);
  sheet.setColumnWidth(2, 110);
  sheet.setColumnWidth(3, 90);
  sheet.setColumnWidth(4, 480);
  sheet.setColumnWidth(5, 480);
  sheet.setColumnWidth(6, 90);
  sheet.setColumnWidth(7, 150);
  sheet.setColumnWidth(8, 120);
  finishDynamicReportSheet_(sheet, rows.length + 6, 8);
}


function getDynamicSettingValue_(settings, koreanKey, webKey) {
  if (!settings) {
    return "";
  }

  return cleanText_(
    settings[koreanKey]
    || settings[webKey]
    || ""
  );
}

function getDynamicSettingDisplay_(settings,koreanKey,webKey){return getDynamicSettingValue_(settings,koreanKey,webKey)||"미입력";}

function setDynamicBarSparklines_(sheet,startRow,rowCount,valueColumn,visualColumn) {
  if (!sheet || Number(rowCount || 0) < 1) return;
  const valueLetter=dynamicColumnLetter_(valueColumn);
  const firstRow=Number(startRow);
  const lastRow=firstRow+Number(rowCount)-1;
  const formulas=[];
  for(let row=firstRow;row<=lastRow;row++){
    formulas.push(['=IF(MAX($'+valueLetter+'$'+firstRow+':$'+valueLetter+'$'+lastRow+')>0,SPARKLINE('+valueLetter+row+',{"charttype","bar";"max",MAX($'+valueLetter+'$'+firstRow+':$'+valueLetter+'$'+lastRow+');"color1","#4F81BD"}),"")']);
  }
  sheet.getRange(firstRow,visualColumn,rowCount,1).setFormulas(formulas);
}

function dynamicColumnLetter_(column) {
  let number=Number(column);let result="";
  while(number>0){number--;result=String.fromCharCode(65+(number%26))+result;number=Math.floor(number/26);}
  return result;
}

function getDynamicExtremeRowIndexes_(values, mode, eligibility) {
  const candidates=[];(values||[]).forEach(function(value,index){
    if(eligibility&&eligibility[index]===false)return;
    if(value===null||value===undefined||value==="")return;
    const numeric=Number(value);if(Number.isFinite(numeric))candidates.push({index:index,value:numeric});
  });
  if(!candidates.length)return [];
  const target=(mode==="min"?Math.min:Math.max).apply(null,candidates.map(function(item){return item.value;}));
  return candidates.filter(function(item){return item.value===target;}).map(function(item){return item.index;});
}


function highlightDynamicRowsByMetric_(sheet,startRow,rowCount,metricColumn,firstColumn,lastColumn,mode,color,eligibility) {
  if(!sheet||Number(rowCount||0)<1)return [];
  const values=sheet.getRange(startRow,metricColumn,rowCount,1).getValues().map(function(row){return row[0];});
  const indexes=getDynamicExtremeRowIndexes_(values,mode,eligibility);
  indexes.forEach(function(index){sheet.getRange(startRow+index,firstColumn,1,lastColumn-firstColumn+1).setBackground(color);});
  return indexes;
}


function getDynamicScaleExtremeNames_(scaleItems, mode) {
  const eligible=(scaleItems||[]).filter(function(item){return Number(item.validCount||0)>0&&item.average!==null;});
  if(!eligible.length)return "";
  const target=(mode==="min"?Math.min:Math.max).apply(null,eligible.map(function(item){return Number(item.average);}));
  return eligible.filter(function(item){return Number(item.average)===target;}).map(function(item){return item.question;}).join(" / ");
}

/**
 * 자동 생성 보고서 시트는 기존 시트를 초기화하지 않고
 * 삭제 후 같은 이름과 위치에 새로 생성합니다.
 *
 * Google Sheets 표(Table), typed cell, 병합, 고정 행 및
 * 숨은 서식 메타데이터가 남아서 발생하는 오류를 방지합니다.
 *
 * 주의:
 * 09_원자료, 11_범용원자료, 12_문항매핑에는 사용하지 않습니다.
 *
 * @param {string} sheetName
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function resetDynamicReportSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const existingSheet = spreadsheet.getSheetByName(sheetName);

  let targetIndex = null;

  if (existingSheet) {
    targetIndex = existingSheet.getIndex();

    // 삭제할 시트가 현재 활성 시트라면 다른 시트를 먼저 활성화합니다.
    const fallbackSheet = spreadsheet.getSheets().find(function(sheet) {
      return sheet.getSheetId() !== existingSheet.getSheetId();
    });

    if (fallbackSheet) {
      spreadsheet.setActiveSheet(fallbackSheet);
    }

    spreadsheet.deleteSheet(existingSheet);
  }

  const sheet = targetIndex !== null
    ? spreadsheet.insertSheet(sheetName, targetIndex)
    : spreadsheet.insertSheet(sheetName);

  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);
  sheet.setHiddenGridlines(true);

  Logger.log(
    "[DYNAMIC_REPORT_SHEET_RECREATED]"
    + " sheet=" + sheetName
    + " index=" + sheet.getIndex()
  );

  return sheet;
}


function setDynamicReportTitle_(sheet, rangeA1, title) {
  const range = sheet.getRange(rangeA1);
  range.merge()
    .setValue(title)
    .setBackground("#17375E")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontFamily("맑은 고딕")
    .setFontSize(17)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.setRowHeights(1, 2, 30);
}


function styleDynamicReportHeader_(range) {
  range
    .setBackground("#244D78")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontFamily("맑은 고딕")
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);
}


/** 문항 코드를 본문과 분리해 기관 보고서형 제목으로 표시합니다. */
function formatDynamicQuestionTitle_(question, index) {
  const original=cleanText_(question&&question.question||"");
  const matched=original.match(/^\s*(Q\d+)\s*[.:：)_-]?\s*/i);
  const code=matched?matched[1].toUpperCase():"문항 "+(Number(index||0)+1);
  const title=matched?original.substring(matched[0].length).trim():original;
  return "【"+code+"】\n"+(title||original||"제목 없음");
}


/** 문항별 독립 표의 제목 행을 동일한 기관 문서 스타일로 표시합니다. */
function styleDynamicQuestionTitle_(range) {
  return range.setBackground("#D9EAF7").setFontColor("#17375E")
    .setFontFamily("맑은 고딕").setFontSize(11).setFontWeight("bold")
    .setHorizontalAlignment("left").setVerticalAlignment("middle").setWrap(true);
}


/** 합계/요약 행을 최다값 강조색과 구분되는 연한 회색으로 표시합니다. */
function styleDynamicReportTotalRow_(range) {
  return range.setBackground("#E7E6E6").setFontColor("#1F2937")
    .setFontFamily("맑은 고딕").setFontWeight("bold");
}


/** 모든 통계 시트에 공통 글꼴·본문 크기·숫자 정렬·행 높이를 적용합니다. */
function applyDynamicPublicReportBaseStyle_(sheet, lastRow, columnCount) {
  const safeLastRow=Math.max(Number(lastRow||1),1),safeColumnCount=Math.max(Number(columnCount||1),1);
  const range=sheet.getRange(1,1,safeLastRow,safeColumnCount);
  range.setFontFamily("맑은 고딕").setFontSize(10).setVerticalAlignment("middle").setWrap(true);
  range.getMergedRanges().forEach(function(mergedRange){
    if(mergedRange.getRow()<=2)mergedRange.setFontSize(17);
    else if(mergedRange.getNumRows()===1)mergedRange.setFontSize(11);
  });
  const values=range.getValues(),numericCells=[];
  values.forEach(function(row,rowIndex){row.forEach(function(value,columnIndex){
    if(typeof value==="number"&&Number.isFinite(value))numericCells.push(dynamicColumnLetter_(columnIndex+1)+(rowIndex+1));
  });});
  if(numericCells.length)sheet.getRangeList(numericCells).setHorizontalAlignment("right");
  applyDynamicReportNumberFormats_(sheet,range,values);
  applyDynamicReportAdaptiveWidths_(sheet,range.getDisplayValues(),safeColumnCount);
  sheet.autoResizeRows(1,safeLastRow);
  sheet.setRowHeights(1,2,32);
}


function applyDynamicReportNumberFormats_(sheet, range, values) {
  const formats=range.getNumberFormats(),integerCells=[],decimalCells=[];
  values.forEach(function(row,rowIndex){row.forEach(function(value,columnIndex){
    if(typeof value!=="number"||!Number.isFinite(value)||String(formats[rowIndex][columnIndex]).toLowerCase()!=="general")return;
    const a1=dynamicColumnLetter_(columnIndex+1)+(rowIndex+1);
    (Math.floor(value)===value?integerCells:decimalCells).push(a1);
  });});
  if(integerCells.length)sheet.getRangeList(integerCells).setNumberFormat("#,##0");
  if(decimalCells.length)sheet.getRangeList(decimalCells).setNumberFormat("#,##0.00");
}


function applyDynamicReportAdaptiveWidths_(sheet, displayValues, columnCount) {
  for(let column=0;column<columnCount;column++){
    const maximum=(displayValues||[]).reduce(function(max,row){
      return Math.max(max,String(row[column]===undefined?"":row[column]).split("\n").reduce(function(lineMax,line){return Math.max(lineMax,line.length);},0));
    },0);
    sheet.setColumnWidth(column+1,Math.max(72,Math.min(420,maximum*8+24)));
  }
}


function finishDynamicReportSheet_(sheet, lastRow, columnCount) {
  const safeLastRow = Math.max(Number(lastRow || 1), 1);
  const safeColumnCount = Math.max(Number(columnCount || 1), 1);

  sheet.setFrozenRows(4);

  sheet.getRange(1, 1, safeLastRow, safeColumnCount)
    .setVerticalAlignment("middle");

  sheet.getRange(4, 1, Math.max(safeLastRow - 3, 1), safeColumnCount)
    .setBorder(
      true,
      true,
      true,
      true,
      true,
      true,
      "#D9E2EC",
      SpreadsheetApp.BorderStyle.SOLID
    );

  applyDynamicPublicReportBaseStyle_(sheet, safeLastRow, safeColumnCount);
}


function moveDynamicStatisticalSheetsInOrder_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const order = [
    getDynamicInternalSheetName_("SETTINGS", "00_설정"),
    getDynamicInternalSheetName_("QUALITY", "00_품질검사")
  ].concat(getDynamicFinalReportSheetOrderSafe_());

  // 아직 다른 파일에서 사용하는 내부 원자료와 매핑 시트는 보고서 뒤에 유지합니다.
  [
    getDynamicInternalSheetName_("IMPORT_RAW", "11_범용원자료"),
    getDynamicInternalSheetName_("MAPPING", "10_문항매핑"),
    "12_문항매핑"
  ].forEach(function(sheetName) {
    if (order.indexOf(sheetName) === -1) order.push(sheetName);
  });

  let targetPosition = 1;
  order.forEach(function(sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return;
    spreadsheet.setActiveSheet(sheet);
    spreadsheet.moveActiveSheet(targetPosition++);
  });

  hideDynamicQualitySheet_();
}

function getDynamicFinalReportSheetOrderSafe_() {
  if (typeof getDynamicFinalReportSheetOrder_ === "function") {
    return getDynamicFinalReportSheetOrder_(false);
  }
  return [
    getDynamicReportSheetName_("OVERVIEW", "01_조사개요"),
    getDynamicReportSheetName_("DASHBOARD", "02_대시보드"),
    getDynamicReportSheetName_("RESPONDENT", "03_응답자특성"),
    getDynamicReportSheetName_("MULTIPLE", "04_복수응답분석"),
    getDynamicReportSheetName_("SATISFACTION", "05_만족도분석"),
    getDynamicReportSheetName_("OPINION", "06_주관식분석"),
    getDynamicReportSheetName_("AI_SUMMARY", "07_AI총평"),
    getDynamicReportSheetName_("IMPROVEMENT_PLAN", "08_향후개선방향"),
    getDynamicReportSheetName_("RAW", "09_원자료")
  ];
}

function getDynamicReportSheetName_(key, fallback) {
  const config = typeof DYNAMIC_SURVEY_CONFIG !== "undefined" ? DYNAMIC_SURVEY_CONFIG : null;
  return cleanText_(config && config.REPORT_SHEETS && config.REPORT_SHEETS[key] || fallback);
}

function getDynamicInternalSheetName_(key, fallback) {
  const config = typeof DYNAMIC_SURVEY_CONFIG !== "undefined" ? DYNAMIC_SURVEY_CONFIG : null;
  return cleanText_(config && config.INTERNAL_SHEETS && config.INTERNAL_SHEETS[key] || fallback);
}

function hideDynamicQualitySheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(getDynamicInternalSheetName_("QUALITY", "00_품질검사"));
  if (!sheet) return false;
  try {
    if (!sheet.isSheetHidden()) sheet.hideSheet();
    return true;
  } catch (error) {
    Logger.log("[QUALITY_SHEET_HIDE_WARNING] " + (error && error.message ? error.message : String(error)));
    return false;
  }
}

