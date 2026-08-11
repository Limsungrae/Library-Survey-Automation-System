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
    currentStage = "최종 원자료 시트 생성";
    createDynamicRawDataSheet_();    
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
        getDynamicReportSheetName_("OPINION", "06_주관식분석"),
        getDynamicReportSheetName_("RAW", "09_원자료")

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
  const surveyName=getDynamicSettingDisplay_(settings,"조사명","surveyName");
  setDynamicReportTitle_(sheet,"A1:H2","「"+surveyName+"」 조사 개요");
  const rows=[
    ["조사명",surveyName],
    ["조사목적",getDynamicSettingDisplay_(settings,"조사목적","surveyPurpose")],
    ["조사기간",getDynamicSettingDisplay_(settings,"조사기간","surveyPeriod")],
    ["조사대상",getDynamicSettingDisplay_(settings,"조사대상","surveyTarget")],
    ["조사방법",getDynamicSettingDisplay_(settings,"조사방법","surveyMethod")],
    ["표본 수",Number(analysis.respondentCount||0)+"명"],
    ["분석방법",getDynamicSettingDisplay_(settings,"분석방법","analysisMethod")]
  ];
  sheet.getRange("A4:B4").merge().setValue("구분");
  sheet.getRange("C4:H4").merge().setValue("내용");
  styleDynamicReportHeader_(sheet.getRange("A4:H4"));
  rows.forEach(function(item,index){
    const row=5+index;
    sheet.getRange(row,1,1,2).merge().setValue(item[0]).setBackground("#EAF2F8").setFontWeight("bold");
    sheet.getRange(row,3,1,6).merge().setValue(item[1]);
    sheet.getRange(row,1,1,8).setWrap(true).setVerticalAlignment("middle")
      .setBorder(true,true,true,true,true,true,"#D9E2EC",SpreadsheetApp.BorderStyle.SOLID);
    sheet.setRowHeight(row,getDynamicDashboardRowHeight_(item[1],70,34,72));
  });
  sheet.setRowHeight(4,30);
  finishDynamicReportSheet_(sheet,12,8);
}


function createDynamicDashboardSheet_(analysis, settings) {
  const sheet=resetDynamicDashboardSheet_();
  const model=buildDynamicDashboardModel_(analysis,settings);
  const mergePlanErrors=validateDynamicDashboardMergePlan_(getDynamicDashboardPlannedMerges_(model.multipleSections.length));
  if(mergePlanErrors.length)throw new Error("대시보드 병합 계획 오류: "+mergePlanErrors.join(", "));
  const interpretationTitleRow=20+model.multipleSections.length*7;
  const footerRow=interpretationTitleRow+5;
  sheet.getRange("A1:P"+footerRow).setFontFamily("맑은 고딕");
  [55,145,145,145,85,85,90,90,32,32,32,32,32,32,32,32]
    .forEach(function(width,index){sheet.setColumnWidth(index+1,width);});
  sheet.setRowHeights(1,footerRow,24);sheet.setRowHeights(1,2,32);sheet.setRowHeights(3,2,27);sheet.setRowHeights(6,4,31);
  [5,10,19].forEach(function(row){sheet.getRange(row,1,1,16).clearContent().setBackground("#FFFFFF");sheet.setRowHeight(row,row===5?12:10);});
  sheet.setRowHeight(11,30);sheet.setRowHeight(footerRow,26);

  safeMergeDynamicDashboardRange_(sheet,"A1:P2","dashboard-title").setValue(model.title)
    .setBackground("#17375E").setFontColor("#FFFFFF").setFontWeight("bold")
    .setFontFamily("맑은 고딕").setFontSize(18).setHorizontalAlignment("center").setVerticalAlignment("middle");
  safeMergeDynamicDashboardRange_(sheet,"A3:P4","dashboard-info").setValue(model.surveyInfo)
    .setBackground("#F3F6F9").setFontColor("#52677C").setFontSize(10)
    .setHorizontalAlignment("left").setVerticalAlignment("middle").setWrap(true);

  const kpiRanges=["A6:D9","E6:H9","I6:L9","M6:P9"];
  model.kpis.forEach(function(kpi,index){
    safeMergeDynamicDashboardRange_(sheet,kpiRanges[index],"kpi-"+(index+1))
      .setValue(kpi.label+"\n"+kpi.displayText).setBackground("#EAF1F8").setFontColor("#17375E")
      .setFontWeight("bold").setFontSize(index===3?15:17).setHorizontalAlignment("center")
      .setVerticalAlignment("middle").setWrap(true)
      .setBorder(true,true,true,true,false,false,"#D9E2EC",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });

  styleDynamicDashboardSection_(sheet,"A11:P11","만족도 문항별 결과");
  renderDynamicDashboardSatisfactionRows_(sheet,model.satisfactionItems,model.hasMoreSatisfaction);
  let cursor=20;
  model.multipleSections.forEach(function(section,index){
    styleDynamicDashboardSection_(sheet,"A"+cursor+":P"+cursor,section.title);
    sheet.setRowHeight(cursor,30);
    renderDynamicDashboardTopRows_(sheet,section.items,cursor+1,1,"",index===0?"#4472C4":"#5B9BD5");
    sheet.setRowHeight(cursor+6,12);
    cursor+=7;
  });
  styleDynamicDashboardSection_(sheet,"A"+cursor+":P"+cursor,"핵심 해석");
  sheet.setRowHeight(cursor,30);
  renderDynamicDashboardInterpretationRows_(sheet,model.interpretations,cursor+1);
  safeMergeDynamicDashboardRange_(sheet,"A"+footerRow+":P"+footerRow,"dashboard-footer").setValue(model.footer)
    .setBackground("#EDF2F7").setFontColor("#64748B").setFontSize(9)
    .setHorizontalAlignment("right").setVerticalAlignment("middle");

  sheet.setFrozenRows(0);sheet.setFrozenColumns(0);sheet.setHiddenGridlines(true);
}


function styleDynamicDashboardSection_(sheet,a1,title){
  return safeMergeDynamicDashboardRange_(sheet,a1,"section-"+title).setValue(title)
    .setBackground("#244D78").setFontColor("#FFFFFF").setFontWeight("bold")
    .setFontSize(11).setHorizontalAlignment("left").setVerticalAlignment("middle");
}


function renderDynamicDashboardSatisfactionRows_(sheet,items,hasMore){
  const shown=(items||[]).slice(0,5);
  if(!shown.length){
    sheet.getRange("A12:P12").setBackground("#FFFFFF").setFontColor("#64748B").setFontSize(10);
    sheet.getRange("A12").setValue("만족도 문항이 없습니다.");return;
  }
  shown.forEach(function(item,index){
    const row=12+index;
    safeMergeDynamicDashboardRange_(sheet,"A"+row+":D"+row,"satisfaction-label-"+row)
      .setValue(item.label).setWrap(true).setFontSize(10).setFontColor("#1F2937").setVerticalAlignment("middle");
    safeMergeDynamicDashboardRange_(sheet,"E"+row+":F"+row,"satisfaction-score-"+row)
      .setValue(Number(item.value)).setNumberFormat('0.00"점"').setHorizontalAlignment("right").setFontWeight("bold");
    renderDynamicDashboardBackgroundBar_(sheet,row,7,10,Number(item.value)/5,"#4472C4");
    sheet.setRowHeight(row,getDynamicDashboardRowHeight_(item.label,55,32,70));
  });
  if(hasMore){
    safeMergeDynamicDashboardRange_(sheet,"A18:P18","satisfaction-guide")
      .setValue("※ 전체 만족도 문항별 세부 분석 결과는 '05_만족도분석' 시트에서 확인하실 수 있습니다.")
      .setBackground("#F0F4F8").setFontColor("#2B547E").setFontSize(10).setWrap(true)
      .setVerticalAlignment("middle").setHorizontalAlignment("left")
      .setBorder(true,false,true,false,false,false,"#D9E2EC",SpreadsheetApp.BorderStyle.SOLID);
    sheet.setRowHeight(18,36);
  }else sheet.setRowHeight(18,9);
}


function renderDynamicDashboardCoreMetricRows_(sheet,metrics){
  (metrics||[]).slice(0,5).forEach(function(metric,index){
    const row=12+index;
    safeMergeDynamicDashboardRange_(sheet,"P"+row+":R"+row,"core-label-"+row).setValue(metric.label)
      .setBackground("#F3F6F9").setFontWeight("bold").setFontSize(10).setFontColor("#1F4E78");
    safeMergeDynamicDashboardRange_(sheet,"S"+row+":V"+row,"core-value-"+row).setValue(metric.value)
      .setBackground("#FFFFFF").setFontSize(10).setFontColor("#1F2937").setWrap(true).setHorizontalAlignment("right");
  });
}


function renderDynamicDashboardTopRows_(sheet,items,startRow,startColumn,emptyText,color){
  const shown=(items||[]).slice(0,5);
  if(!shown.length){sheet.getRange(startRow,startColumn,1,16).setBackground("#F8FAFC").setBorder(true,true,true,true,false,false,"#D9E2EC",SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(startRow,startColumn).setValue(emptyText).setFontSize(10).setFontColor("#64748B").setWrap(true);
    sheet.setRowHeight(startRow,40);return;}
  shown.forEach(function(item,index){
    const row=startRow+index,offset=startColumn-1;
    sheet.getRange(row,1+offset).setValue(index+1).setHorizontalAlignment("center").setFontWeight("bold");
    safeMergeDynamicDashboardRange_(sheet,"B"+row+":F"+row,"top-label-"+startColumn+"-"+row)
      .setValue(item.label).setWrap(true).setFontSize(10).setFontColor("#1F2937").setVerticalAlignment("middle");
    sheet.getRange(row,7+offset).setValue(Number(item.value||0)).setNumberFormat('0"건"').setHorizontalAlignment("right");
    const rate=item.rate===null?null:Number(item.rate);
    sheet.getRange(row,8+offset).setValue(rate===null?"-":rate/100).setNumberFormat(rate===null?"@":"0.0%").setHorizontalAlignment("right");
    renderDynamicDashboardBackgroundBar_(sheet,row,9+offset,8,rate===null?0:rate/100,color);
    sheet.setRowHeight(row,getDynamicDashboardRowHeight_(item.label,65,32,84));
  });
}


function renderDynamicDashboardBackgroundBar_(sheet,row,startColumn,segmentCount,ratio,color){
  const filled=getDynamicDashboardFilledCells_(ratio,segmentCount);
  const backgrounds=[new Array(segmentCount).fill(null).map(function(_,index){return index<filled?color:"#E9EEF3";})];
  sheet.getRange(row,startColumn,1,segmentCount).setValues([new Array(segmentCount).fill("")])
    .setBackgrounds(backgrounds).setBorder(true,true,true,true,true,true,"#FFFFFF",SpreadsheetApp.BorderStyle.SOLID);
}

function getDynamicDashboardFilledCells_(ratio,segmentCount){
  const count=Math.max(0,Math.floor(Number(segmentCount)||0));
  const numeric=Number(ratio),safeRatio=Number.isFinite(numeric)?Math.max(0,Math.min(1,numeric)):0;
  return Math.max(0,Math.min(count,Math.round(safeRatio*count)));
}


function renderDynamicDashboardInterpretationRows_(sheet,interpretations,startRow){
  const firstRow=Number(startRow||21),messages=(interpretations||[]).slice(0,3);
  if(!messages.length)messages.push("대시보드 요약에 사용할 분석 결과가 충분하지 않습니다.");
  messages.forEach(function(message,index){const row=firstRow+index;safeMergeDynamicDashboardRange_(sheet,"A"+row+":P"+row,"interpretation-"+row)
    .setValue(String(index+1).padStart(2,"0")+"  "+message).setFontSize(11).setFontColor("#1F2937").setWrap(true).setVerticalAlignment("top");
    sheet.setRowHeight(row,getDynamicDashboardRowHeight_(message,110,36,64));});
  for(let row=firstRow+messages.length;row<firstRow+3;row++)sheet.setRowHeight(row,8);
}


function getDynamicDashboardRowHeight_(value,charactersPerLine,minimum,maximum){
  const text=cleanText_(value),lineWidth=Math.max(Number(charactersPerLine||1),1);
  const visualLines=(text.split("\n").reduce(function(total,line){return total+Math.max(1,Math.ceil(line.length/lineWidth));},0)||1);
  return Math.max(Number(minimum||24),Math.min(Number(maximum||120),24+visualLines*14));
}


/** 대시보드 재생성 전에 차트·PNG·셀 내용을 모두 정리합니다. */
function resetDynamicDashboardSheet_(){
  const spreadsheet=SpreadsheetApp.getActiveSpreadsheet();
  let sheet=spreadsheet.getSheetByName(getDynamicReportSheetName_("DASHBOARD", "02_대시보드"));
  if(!sheet)sheet=spreadsheet.insertSheet(getDynamicReportSheetName_("DASHBOARD", "02_대시보드"));
  prepareDynamicDashboardFreezeState_(sheet);
  sheet.getCharts().forEach(function(chart){sheet.removeChart(chart);});
  if(typeof sheet.getImages==="function")sheet.getImages().forEach(function(image){image.remove();});
  resetDynamicDashboardRange_(sheet);
  sheet.setConditionalFormatRules([]);sheet.setHiddenGridlines(true);
  return sheet;
}


function getDynamicDashboardPlannedMerges_(multipleSectionCount){
  const sectionCount=Math.max(0,Math.min(2,Number(multipleSectionCount===undefined?2:multipleSectionCount)||0));
  const ranges=["A1:P2","A3:P4","A6:D9","E6:H9","I6:L9","M6:P9","A11:P11","A18:P18"];
  for(let row=12;row<=16;row++)ranges.push("A"+row+":D"+row,"E"+row+":F"+row);
  let cursor=20;
  for(let section=0;section<sectionCount;section++){
    ranges.push("A"+cursor+":P"+cursor);
    for(let row=cursor+1;row<=cursor+5;row++)ranges.push("B"+row+":F"+row);
    cursor+=7;
  }
  ranges.push("A"+cursor+":P"+cursor);
  for(let row=cursor+1;row<=cursor+3;row++)ranges.push("A"+row+":P"+row);
  ranges.push("A"+(cursor+5)+":P"+(cursor+5));
  return ranges;
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
  const range=sheet.getRange("A1:V40");
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
  const range=sheet.getRange("A1:V40");
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
  const respondentCount=Number(analysis&&analysis.respondentCount||0);
  const overallAverage=analysis&&analysis.scaleSummary&&analysis.scaleSummary.weightedAverage!==null
    &&analysis.scaleSummary.weightedAverage!==undefined?Number(analysis.scaleSummary.weightedAverage):null;
  const overallPositiveRate=analysis&&analysis.scaleSummary&&analysis.scaleSummary.overallPositiveRate!==null
    &&analysis.scaleSummary.overallPositiveRate!==undefined?Number(analysis.scaleSummary.overallPositiveRate):null;
  const surveyName=getDynamicSettingValue_(settings,"조사명","surveyName")||"만족도 조사";
  const scale=(analysis&&analysis.scale||[]).filter(function(item){return item.average!==null&&item.average!==undefined&&Number.isFinite(Number(item.average));});
  const recommendation=analysis&&analysis.recommendation||[];
  const fivePointItem=recommendation.find(function(item){return item.scaleKind!=="NPS_0_10"&&Number.isFinite(Number(item.positiveRate));})||null;
  const npsItem=recommendation.find(function(item){return item.scaleKind==="NPS_0_10"&&item.nps!==null&&item.nps!==undefined&&Number.isFinite(Number(item.nps));})||null;
  const fivePointRate=fivePointItem?Number(fivePointItem.positiveRate):null;
  const npsValue=npsItem?Number(npsItem.nps):null;
  const signedNps=npsValue===null?"해당 없음":(npsValue>0?"+":"")+npsValue.toFixed(1);
  let fourthLabel="재이용·추천",fourthDisplay="해당 없음";
  if(fivePointRate!==null&&npsValue!==null)fourthDisplay=fivePointRate.toFixed(1)+"%\nNPS "+signedNps;
  else if(fivePointRate!==null)fourthDisplay=fivePointRate.toFixed(1)+"%";
  else if(npsValue!==null){fourthLabel="추천지수 NPS";fourthDisplay=signedNps;}

  const future=selectDynamicDashboardMultipleQuestion_(analysis&&analysis.multiple||[],
    /(?:향후.*(?:희망|원하|이용)|희망.*(?:서비스|프로그램)|원하는.*(?:서비스|프로그램)|참여하고\s*싶은)/i);
  const improvement=selectDynamicDashboardMultipleQuestion_(analysis&&analysis.multiple||[],/(?:개선|불편|보완|필요|요구)/i,future);
  const multipleSections=buildDynamicDashboardMultipleSections_(analysis&&analysis.multiple||[]);
  const satisfactionItems=buildDynamicDashboardItems_(scale,5,5,true);
  const futureItems=future?buildDynamicDashboardItems_(future.items,null,5,false):[];
  const improvementItems=improvement?buildDynamicDashboardItems_(improvement.items,null,5,false):[];
  let highestScale=null;
  scale.forEach(function(item){if(!highestScale||Number(item.average)>Number(highestScale.average))highestScale=item;});
  const highestText=highestScale?Number(highestScale.average).toFixed(2)+"점":"해당 없음";
  const averageText=overallAverage!==null&&Number.isFinite(overallAverage)?overallAverage.toFixed(2)+" / 5점":"해당 없음";
  const positiveText=overallPositiveRate!==null&&Number.isFinite(overallPositiveRate)?overallPositiveRate.toFixed(1)+"%":"해당 없음";
  const coreMetrics=[
    {label:"최고 만족도",value:highestText},
    {label:"종합 만족도",value:averageText},
    {label:"긍정 응답률",value:positiveText},
    {label:"재이용·추천",value:fivePointRate===null?"해당 없음":fivePointRate.toFixed(1)+"%"},
    {label:"NPS",value:signedNps}
  ];
  const interpretations=[];
  if(overallAverage!==null&&Number.isFinite(overallAverage))interpretations.push("종합 만족도는 5점 만점에 "+overallAverage.toFixed(2)+"점으로 나타났습니다.");
  if(highestScale)interpretations.push("가장 높은 만족도 문항은 ‘"+cleanText_(highestScale.question)+"’("+Number(highestScale.average).toFixed(2)+"점)입니다.");
  if(improvementItems.length)interpretations.push("가장 많이 선택된 개선 요구는 ‘"+improvementItems[0].label+"’입니다.");
  if(futureItems.length)interpretations.push("향후 희망 서비스는 ‘"+futureItems[0].label+"’ 응답이 가장 많았습니다.");
  const surveyInfo=["조사기간: "+getDynamicSettingDisplay_(settings,"조사기간","surveyPeriod"),
    "조사대상: "+getDynamicSettingDisplay_(settings,"조사대상","surveyTarget"),
    "조사방법: "+getDynamicSettingDisplay_(settings,"조사방법","surveyMethod")].join("   |   ");
  const generatedAt=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyy-MM-dd HH:mm:ss");
  return {
    title:surveyName+" 결과 요약",surveyInfo:surveyInfo,
    kpis:[
      {label:"총 응답자",value:respondentCount,displayText:respondentCount.toLocaleString("ko-KR")+"명"},
      {label:"종합 만족도",value:overallAverage,displayText:averageText.replace("점","")},
      {label:"긍정 응답률",value:overallPositiveRate,displayText:positiveText},
      {label:fourthLabel,value:null,displayText:fourthDisplay}
    ],
    satisfactionItems:satisfactionItems,hasMoreSatisfaction:scale.length>5,
    improvementItems:improvementItems,futureItems:futureItems,coreMetrics:coreMetrics,
    multipleSections:multipleSections,
    interpretations:interpretations.slice(0,3),
    footer:"생성일 "+generatedAt+"   |   상세 결과: 03_응답자특성 ~ 09_원자료 시트"
  };
}


function buildDynamicDashboardMultipleSections_(questions){
  const classified=(questions||[]).map(function(question,index){
    const label=cleanText_(question&&question.question||"");
    let priority=4,title=label?label+" TOP 5":"복수응답 TOP 5";
    if(/개선|불편|보완|아쉬|필요|요구/i.test(label)){priority=1;title="개선 필요사항 TOP 5";}
    else if(/향후|앞으로|희망|원하|참여하고|받고\s*싶은/i.test(label)){
      priority=2;title=/프로그램/i.test(label)?"향후 희망 프로그램 TOP 5":"향후 희망 서비스 TOP 5";
    }else if(/좋았|만족한\s*점|만족\s*요인|도움이\s*된|유익|장점/i.test(label)){priority=3;title="만족 요인 TOP 5";}
    return {question:question,index:index,priority:priority,title:title};
  }).filter(function(item){return item.question&&Array.isArray(item.question.items)&&item.question.items.length;});
  classified.sort(function(left,right){return left.priority-right.priority||left.index-right.index;});
  return classified.slice(0,2).map(function(item){return {
    title:item.title,question:item.question.question,
    items:buildDynamicDashboardItems_(item.question.items,null,5,false)
  };});
}


function selectDynamicDashboardMultipleQuestion_(
  questions,
  pattern,
  excluded
) {
  const candidates =
    (questions || []).filter(function(question) {
      return question !== excluded;
    });

  return candidates.find(function(question) {
    return pattern.test(
      cleanText_(question.question || "")
    );
  }) || null;
}


function buildDynamicDashboardItems_(source,fixedMaximum,limit,isScale){
  const items=(source||[]).map(function(item,index){
    const rateCandidates=[item.selectionRate,item.respondentRate,item.validRespondentRate];
    const rateValue=rateCandidates.find(function(value){return value!==null&&value!==undefined&&Number.isFinite(Number(value));});
    return {label:cleanText_(item.question||item.label),value:Number(isScale?item.average:item.count||0),
      rate:rateValue===undefined?null:Number(rateValue),originalIndex:index};
  }).filter(function(item){return item.label&&Number.isFinite(item.value);});
  if(!isScale)items.sort(function(left,right){return right.value-left.value||left.originalIndex-right.originalIndex;});
  return items.slice(0,limit).map(function(item){return {label:item.label,value:item.value,rate:item.rate,
    displayValue:isScale?item.value.toFixed(2):item.value.toLocaleString("ko-KR")};});
}


function buildDynamicDashboardOpinionItems_(analysis,limit){
  let categories=[];
  if(Array.isArray(analysis.opinionCategories))categories=analysis.opinionCategories;
  (analysis.text||[]).forEach(function(question){if(Array.isArray(question.categories))categories=categories.concat(question.categories);});
  return buildDynamicDashboardItems_(categories.map(function(item){return {label:item.category||item.label,count:item.count};}),null,limit,false);
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

sheet.setColumnWidth(1, 450);
sheet.setColumnWidths(2, 4, 150);
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
row += rows.length + 4;  });
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
  setDynamicReportTitle_(sheet, "A1:T2", "Ⅳ. 복수응답 분석");

  let row = 4;
  const questions = analysis.multiple || [];

  if (questions.length === 0) {
    sheet.getRange(row,1,1,20).merge().setValue("분석 가능한 복수응답 문항이 없습니다.")
      .setBackground("#F8FAFC").setFontColor("#64748B").setFontSize(11).setWrap(true);
    sheet.setRowHeight(row,40);
    finishDynamicReportSheet_(sheet,row+2,20);
    return;
  }

  questions.forEach(function(question, questionIndex) {
    const items=getDynamicMultipleDisplayItems_(question.items||[]);
    const showValidRate=shouldShowDynamicValidRespondentRate_(items);
    const titleRange=sheet.getRange(row,1,1,20).merge().setValue(formatDynamicQuestionTitle_(question,questionIndex));
    titleRange.setBackground("#17375E").setFontColor("#FFFFFF").setFontWeight("bold")
      .setFontSize(11).setHorizontalAlignment("left").setVerticalAlignment("middle").setWrap(true);
    sheet.setRowHeight(row,getDynamicDashboardRowHeight_(titleRange.getValue(),100,34,64));
    row++;

    sheet.getRange(row,1,1,20).merge().setValue(buildDynamicMultipleQuestionSummary_(question))
      .setBackground("#EEF3F8").setFontColor("#334E68").setFontSize(10).setWrap(true).setVerticalAlignment("middle");
    sheet.setRowHeight(row,30);row++;

    if(!items.length){
      sheet.getRange(row,1,1,20).merge().setValue("선택 응답이 없습니다.")
        .setBackground("#FFFFFF").setFontColor("#64748B").setWrap(true);
      sheet.setRowHeight(row,36);row+=2;return;
    }

    renderDynamicMultipleHeader_(sheet,row,showValidRate);row++;
    items.forEach(function(item,index){
      sheet.getRange(row,1).setValue(index+1).setHorizontalAlignment("center").setFontWeight("bold");
      sheet.getRange(row,2,1,5).merge().setValue(item.label).setWrap(true).setVerticalAlignment("top");
      sheet.getRange(row,7).setValue(item.count).setNumberFormat('0"건"').setHorizontalAlignment("right");
      sheet.getRange(row,8).setValue(item.selectionRate/100).setNumberFormat("0.0%").setHorizontalAlignment("right");
      sheet.getRange(row,9).setValue(item.respondentRate/100).setNumberFormat("0.0%").setHorizontalAlignment("right");
      const barColumn=showValidRate?11:10;
      if(showValidRate)sheet.getRange(row,10).setValue(item.validRespondentRate/100).setNumberFormat("0.0%").setHorizontalAlignment("right");
      renderDynamicDashboardBackgroundBar_(sheet,row,barColumn,10,item.respondentRate/100,"#4472C4");
      sheet.getRange(row,1,1,20).setBorder(false,false,true,false,false,false,"#E2E8F0",SpreadsheetApp.BorderStyle.SOLID);
      sheet.setRowHeight(row,getDynamicDashboardRowHeight_(item.label,72,30,100));row++;
    });

    const totalSelections=Number(question.totalSelections||question.totalSelectionCount||0);
    sheet.getRange(row,1,1,6).merge().setValue("합계");
    sheet.getRange(row,7).setValue(totalSelections).setNumberFormat('0"건"');
    sheet.getRange(row,8).setValue(totalSelections>0?1:0).setNumberFormat("0.0%");
    styleDynamicReportTotalRow_(sheet.getRange(row,1,1,20));sheet.setRowHeight(row,32);
    row++;
    sheet.setRowHeight(row,12);row++;
  });

  [55,105,105,105,105,105,90,100,130,130,26,26,26,26,26,26,26,26,26,26]
    .forEach(function(width,index){sheet.setColumnWidth(index+1,width);});
  sheet.setHiddenGridlines(true);
  finishDynamicReportSheet_(sheet,row,20);
}

function getDynamicMultipleDisplayItems_(source){
  return (source||[]).map(function(item,index){return {
    label:cleanText_(item.label),count:Number(item.count||0),selectionRate:Number(item.selectionRate||0),
    respondentRate:Number(item.respondentRate||0),validRespondentRate:Number(item.validRespondentRate||0),originalIndex:index
  };}).sort(function(left,right){return right.count-left.count||left.originalIndex-right.originalIndex;});
}

function shouldShowDynamicValidRespondentRate_(items){
  return (items||[]).some(function(item){return Math.abs(Number(item.respondentRate||0)-Number(item.validRespondentRate||0))>=1e-9;});
}

function buildDynamicMultipleQuestionSummary_(question){
  const valid=Number(question.validRespondentCount||question.validRespondents||question.validResponses||0);
  const total=Number(question.totalSelections||question.totalSelectionCount||0);
  const average=valid>0?total/valid:null;
  return "유효 응답자 "+valid.toLocaleString("ko-KR")+"명 · 총 선택 "+total.toLocaleString("ko-KR")+"건 · 1인 평균 "+
    (average===null?"해당 없음":average.toFixed(2)+"개 선택");
}

function renderDynamicMultipleHeader_(sheet,row,showValidRate){
  sheet.getRange(row,1).setValue("순위");
  sheet.getRange(row,2,1,5).merge().setValue("항목");
  sheet.getRange(row,7).setValue("선택건수");sheet.getRange(row,8).setValue("선택 비율");
  sheet.getRange(row,9).setValue(showValidRate?"전체 응답자 선택률":"응답자 선택률");
  const barColumn=showValidRate?11:10;
  if(showValidRate)sheet.getRange(row,10).setValue("유효 응답자 선택률");
  sheet.getRange(row,barColumn,1,10).merge().setValue("시각화");
  styleDynamicReportHeader_(sheet.getRange(row,1,1,20));sheet.setRowHeight(row,34);
}

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

  scaleItems.forEach(function(item, questionIndex) {
    const distribution = item.scoreDistribution || {};
    rows.push([
      formatDynamicQuestionTitle_(item, questionIndex), Number(item.validCount || 0), "", Number(item.missingCount || 0), Number(item.unmappedCount || 0),
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

styleDynamicReportTotalRow_(
    sheet.getRange(row + rows.length - 1, 1, 1, headers.length)
);

row += rows.length;

sheet.getRange(row, 1, 1, headers.length)
    .merge()
    .setValue(
        "※ 전체 평균은 전체 유효 척도 응답 기준 가중평균입니다.\n" +
        "※ 전체 만족도 긍정률은 모든 만족도 문항의 전체 유효응답 중 4점과 5점 응답 비율입니다.\n" +
        "※ 표준편차는 모집단 기준이며, 순위는 평균 → 긍정률 → 5점 응답 수 순으로 산정합니다."
    )
    .setWrap(true)
    .setHorizontalAlignment("left");

return row + 1;
}

function appendDynamicRecommendationAnalysis_(sheet, startRow, analysis) {
  let row = startRow;
  const questions = analysis.recommendation || [];

  sheet.getRange(row, 1, 1, 8).merge()
    .setValue("재이용·추천 등 의향 분석")
    .setBackground("#B4C6E7")
    .setFontColor("#17375E")
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("left");

  row += 2;

  if (!questions.length) {
    sheet.getRange(row, 1)
      .setValue("재이용·추천 등 의향 분석 대상 문항이 없습니다.");

    return row + 2;
  }

  questions.forEach(function(item, questionIndex) {
    styleDynamicQuestionTitle_(
      sheet.getRange(row, 1, 1, 8).merge()
        .setValue(formatDynamicQuestionTitle_(item, questionIndex))
    );

    row++;

    const totalRespondents =
      getDynamicRecommendationTotalRespondents_(item, analysis);

    const denominatorText =
      totalRespondents > 0
        ? "전체 " + totalRespondents
        : "전체 응답자 확인 필요";

    const isNps =
      (item.scaleKind || item.scaleMode) === "NPS_0_10";

    let rows;
    let chartRowCount;

    if (isNps) {
      rows = [
        [
          "구분",
          "인원",
          "시각화",
          "비율",
          "NPS",
          "유효응답",
          "무응답",
          "분모"
        ],
        [
          "추천자",
          Number(item.promoterCount || 0),
          "",
          Number(item.promoterRate || 0) / 100,
          item.nps,
          Number(item.validResponses || 0),
          Number(item.missingResponses || 0),
          "유효응답"
        ],
        [
          "중립자",
          Number(item.passiveCount || 0),
          "",
          Number(item.passiveRate || 0) / 100,
          "",
          Number(item.validResponses || 0),
          Number(item.missingResponses || 0),
          "유효응답"
        ],
        [
          "비추천자",
          Number(item.detractorCount || 0),
          "",
          Number(item.detractorRate || 0) / 100,
          "",
          Number(item.validResponses || 0),
          Number(item.missingResponses || 0),
          "유효응답"
        ],
        [
          "합계",
          Number(item.validResponses || 0),
          "",
          item.validResponses ? 1 : 0,
          item.nps,
          Number(item.validResponses || 0),
          Number(item.missingResponses || 0),
          denominatorText
        ]
      ];

      chartRowCount = 3;

    } else {
      const distribution = item.scoreDistribution || {};
      const validResponses = Number(item.validResponses || 0);

      function getScoreCount_(score) {
        return Number(
          distribution[score] !== undefined
            ? distribution[score]
            : distribution[String(score)] || 0
        );
      }

      function getScoreRate_(score) {
        return validResponses > 0
          ? getScoreCount_(score) / validResponses
          : 0;
      }

      rows = [
        [
          "구분",
          "인원",
          "시각화",
          "비율",
          "평균",
          "유효응답",
          "무응답",
          "분모"
        ],
        [
          "5점(매우 긍정)",
          getScoreCount_(5),
          "",
          getScoreRate_(5),
          Number(item.average || 0),
          validResponses,
          Number(item.missingResponses || 0),
          "유효응답"
        ],
        [
          "4점(긍정)",
          getScoreCount_(4),
          "",
          getScoreRate_(4),
          "",
          validResponses,
          Number(item.missingResponses || 0),
          "유효응답"
        ],
        [
          "3점(보통)",
          getScoreCount_(3),
          "",
          getScoreRate_(3),
          "",
          validResponses,
          Number(item.missingResponses || 0),
          "유효응답"
        ],
        [
          "2점(부정)",
          getScoreCount_(2),
          "",
          getScoreRate_(2),
          "",
          validResponses,
          Number(item.missingResponses || 0),
          "유효응답"
        ],
        [
          "1점(매우 부정)",
          getScoreCount_(1),
          "",
          getScoreRate_(1),
          "",
          validResponses,
          Number(item.missingResponses || 0),
          "유효응답"
        ],
        [
          "긍정률(4~5점)",
          Number(item.positiveCount || 0),
          "",
          Number(item.positiveRate || 0) / 100,
          Number(item.average || 0),
          validResponses,
          Number(item.missingResponses || 0),
          "유효응답"
        ],
        [
          "합계",
          validResponses,
          "",
          validResponses ? 1 : 0,
          Number(item.average || 0),
          validResponses,
          Number(item.missingResponses || 0),
          denominatorText
        ]
      ];

      chartRowCount = 5;
    }

    sheet.getRange(row, 1, rows.length, 8).setValues(rows);

    styleDynamicReportHeader_(
      sheet.getRange(row, 1, 1, 8)
    );

    // 비율은 소수점 첫째 자리까지 표시
    sheet.getRange(row + 1, 4, rows.length - 1, 1)
      .setNumberFormat("0.0%");

    // 평균은 소수점 둘째 자리까지 표시
    sheet.getRange(row + 1, 5, rows.length - 1, 1)
      .setNumberFormat("0.00");

    styleDynamicReportTotalRow_(
      sheet.getRange(row + rows.length - 1, 1, 1, 8)
    );

    setDynamicBarSparklines_(
      sheet,
      row + 1,
      chartRowCount,
      2,
      3
    );

    highlightDynamicRowsByMetric_(
      sheet,
      row + 1,
      chartRowCount,
      2,
      1,
      8,
      "max",
      "#FFF2CC"
    );

row += rows.length + 4;  });

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
/**
 * 내부 분석용 11_범용원자료를 최종 보고서용 09_원자료로 복사합니다.
 *
 * - 11_범용원자료는 그대로 유지합니다.
 * - 09_원자료에는 수식이 아니라 계산된 값만 저장합니다.
 * - 기존 09_원자료가 있으면 삭제 후 같은 위치에 다시 생성합니다.
 *
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function createDynamicRawDataSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const sourceSheetName = getDynamicInternalSheetName_(
    "IMPORT_RAW",
    "11_범용원자료"
  );

  const targetSheetName = getDynamicReportSheetName_(
    "RAW",
    "09_원자료"
  );

  const sourceSheet = spreadsheet.getSheetByName(sourceSheetName);

  if (!sourceSheet) {
    throw new Error(
      "최종 원자료를 생성할 수 없습니다. 내부 원자료 시트가 없습니다: "
      + sourceSheetName
    );
  }

  const existingTargetSheet = spreadsheet.getSheetByName(targetSheetName);
  let targetIndex = null;

  if (existingTargetSheet) {
    targetIndex = existingTargetSheet.getIndex();

    const fallbackSheet = spreadsheet.getSheets().find(function(sheet) {
      return sheet.getSheetId() !== existingTargetSheet.getSheetId();
    });

    if (fallbackSheet) {
      spreadsheet.setActiveSheet(fallbackSheet);
    }

    spreadsheet.deleteSheet(existingTargetSheet);
  }

  const targetSheet = targetIndex !== null
    ? spreadsheet.insertSheet(targetSheetName, targetIndex)
    : spreadsheet.insertSheet(targetSheetName);

  const lastRow = sourceSheet.getLastRow();
  const lastColumn = sourceSheet.getLastColumn();

  if (lastRow < 1 || lastColumn < 1) {
    targetSheet.getRange("A1").setValue("원자료가 없습니다.");
    targetSheet.setHiddenGridlines(true);
    return targetSheet;
  }

  const sourceRange = sourceSheet.getRange(
    1,
    1,
    lastRow,
    lastColumn
  );

  const targetRange = targetSheet.getRange(
    1,
    1,
    lastRow,
    lastColumn
  );

  // 수식이 아닌 계산된 값만 복사
  targetRange.setValues(sourceRange.getValues());

  // 표시 형식과 셀 서식 복사
  targetRange.setNumberFormats(sourceRange.getNumberFormats());

  sourceRange.copyTo(
    targetRange,
    SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
    false
  );

  // 열 너비 복사
  for (let column = 1; column <= lastColumn; column++) {
    targetSheet.setColumnWidth(
      column,
      sourceSheet.getColumnWidth(column)
    );
  }

  // 행 높이 복사
  for (let row = 1; row <= lastRow; row++) {
    targetSheet.setRowHeight(
      row,
      sourceSheet.getRowHeight(row)
    );
  }

  // 원본의 고정 행·열 설정 복사
  targetSheet.setFrozenRows(sourceSheet.getFrozenRows());
  targetSheet.setFrozenColumns(sourceSheet.getFrozenColumns());
  targetSheet.setHiddenGridlines(true);
  applyDynamicReportReadability_(targetSheet, lastRow, lastColumn);

  Logger.log(
    "[DYNAMIC_RAW_SHEET_CREATED]"
    + " source=" + sourceSheetName
    + " target=" + targetSheetName
    + " rows=" + lastRow
    + " columns=" + lastColumn
  );

  return targetSheet;
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


/** 원본 문항명을 우선해 번호와 함께 한눈에 읽히는 제목으로 표시합니다. */
function formatDynamicQuestionTitle_(question, index) {
  const source=question||{};
  let title=cleanText_(source.originalHeader||source.questionText||source.header||source.question||"");
  const titleCode=title.match(/^\s*(Q\d+)\s*[.:：)_-]?\s*/i);
  let code=cleanText_(source.questionId||"");
  if(!code&&Number(source.columnNumber)>0)code="Q"+Number(source.columnNumber);
  if(titleCode){if(!code)code=titleCode[1].toUpperCase();title=title.substring(titleCode[0].length).trim();}
  if(/^\d+$/.test(code))code="Q"+code;
  if(!code)code="문항 "+(Number(index||0)+1);
  return title?code+". "+title:code;
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


/**
 * 최종 보고서 시트별 화면·인쇄 가독성 서식을 적용합니다.
 * 데이터, 통계값, 행·열 구조는 변경하지 않고 표시 서식만 조정합니다.
 */
function applyDynamicReportReadability_(sheet, lastRow, columnCount) {
  const name=cleanText_(sheet.getName());
  const rows=Math.max(Number(lastRow||sheet.getLastRow()||1),1);
  const columns=Math.max(Number(columnCount||sheet.getLastColumn()||1),1);
  const body=sheet.getRange(1,1,rows,columns);
  body.setFontFamily("맑은 고딕").setVerticalAlignment("middle");
  if(name!=="02_대시보드")body.setFontSize(name==="09_원자료"?10:11);

  const widths={
    "01_조사개요":[90,90,110,110,110,110,110,110],
    "03_응답자특성":[380,110,170,170,170,190],
    "05_만족도분석":[380,95,120,95,95,95,95,95,95,95,95,95,95,95,95,95,95,95,95],
    "07_AI총평":[220,220,220,220,220,220,220,220],
    "08_향후개선방향":[220,220,220,220,220,220,220,220]
  }[name];
  if(name==="06_주관식분석"){
    const opinionWidths=columns===7?[90,180,340,560,280,450,450]:[340,110,120,560,520,90,160,130];
    opinionWidths.slice(0,columns).forEach(function(width,index){sheet.setColumnWidth(index+1,width);});
  }else if(widths)widths.slice(0,columns).forEach(function(width,index){sheet.setColumnWidth(index+1,width);});

  if(name==="01_조사개요"){
    sheet.getRange(4,1,Math.max(rows-3,1),8).setWrap(true).setVerticalAlignment("middle");
  }else if(name==="03_응답자특성"||name==="05_만족도분석"){
    body.setWrap(true);
    sheet.autoResizeRows(4,Math.max(rows-3,1));
  }else if(name==="04_복수응답분석"){
    body.setWrap(true).setVerticalAlignment("middle");
  }else if(name==="06_주관식분석"){
    body.setWrap(true).setVerticalAlignment("top");
    sheet.autoResizeRows(4,Math.max(rows-3,1));
  }else if(name==="07_AI총평"||name==="08_향후개선방향"){
    body.setFontSize(12).setWrap(true).setVerticalAlignment("top").setHorizontalAlignment("left");
  }else if(name==="09_원자료"){
    body.setWrap(false).setVerticalAlignment("middle");
    if(rows>1)sheet.setRowHeights(2,rows-1,24);
    sheet.setRowHeight(1,32);
  }
  if(name!=="09_원자료")sheet.setRowHeights(1,2,34);
}


function finishDynamicReportSheet_(sheet, lastRow, columnCount) {
  const safeLastRow = Math.max(Number(lastRow || 1), 1);
  const safeColumnCount = Math.max(Number(columnCount || 1), 1);
  sheet.setHiddenGridlines(true);

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
  applyDynamicReportReadability_(sheet, safeLastRow, safeColumnCount);
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
