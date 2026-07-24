/**
 * ==========================================================================
 * 성남시중원도서관 만족도 조사 자동화 시스템
 * 범용 통계 보고서 생성
 * ==========================================================================
 *
 * 표 중심 보고서 시트
 * - 01_조사개요 ~ 08_주관식분석
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
    currentStage = "응답자특성 시트 생성";
    createDynamicRespondentSheet_(analysis);
    currentStage = "단일응답 시트 생성";
    createDynamicSingleSheet_(analysis);
    currentStage = "복수응답 시트 생성";
    createDynamicMultipleSheet_(analysis);
    currentStage = "척도분석 시트 생성";
    createDynamicSatisfactionSheet_(analysis);
    currentStage = "추천의향 시트 생성";
    createDynamicRecommendationSheet_(analysis);
    currentStage = "주관식 시트 생성";
    createDynamicOpinionRawSheet_(analysis);

    currentStage = "통계 시트 정렬 및 저장";
    moveDynamicStatisticalSheetsInOrder_();
    SpreadsheetApp.flush();

    return {
      success: true,
      message: "범용 통계 보고서 생성이 완료되었습니다.",
      generatedSheets: [
        "00_품질검사",
        "01_조사개요",
        "02_대시보드",
        "03_응답자특성",
        "04_단일응답분석",
        "05_복수응답분석",
        "06_척도분석",
        "07_추천의향분석",
        "08_주관식분석"
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
  const sheet = resetDynamicReportSheet_("01_조사개요");

  setDynamicReportTitle_(
    sheet,
    "A1:H2",
    getDynamicSettingValue_(settings, "보고서 제목", "reportTitle")
      || getDynamicSettingValue_(settings, "조사명", "surveyName")
      || "만족도 조사 결과 보고"
  );

  const rows = [
    ["구분", "내용"],
    ["조사명", getDynamicSettingDisplay_(settings, "조사명", "surveyName")],
    ["조사목적", getDynamicSettingDisplay_(settings, "조사목적", "surveyPurpose")],
    ["조사기간", getDynamicSettingDisplay_(settings, "조사기간", "surveyPeriod")],
    ["조사대상", getDynamicSettingDisplay_(settings, "조사대상", "surveyTarget")],
    ["조사방법", getDynamicSettingDisplay_(settings, "조사방법", "surveyMethod")],
    ["분석방법", getDynamicSettingDisplay_(settings, "분석방법", "analysisMethod")],
    ["표본 수", Number(analysis.respondentCount || 0) + "명"],
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
  const sheet=resetDynamicReportSheet_(DYNAMIC_SURVEY_CONFIG.SHEETS.DASHBOARD);
  const summary=buildDynamicReportSummary_(analysis);
  setDynamicReportTitle_(sheet,"A1:H2",getDynamicSettingValue_(settings,"대시보드 제목","dashboardTitle")||"만족도 조사 대시보드");
  const npsText=summary.nps===null?"NPS 문항 없음":summary.nps.toFixed(1);
  const top=analysis.scaleSummary.highest, low=analysis.scaleSummary.lowest;
  const cards=[
    ["전체 응답자",summary.respondentCount+"명","가중평균",summary.overallAverage===null?"산출 불가":summary.overallAverage.toFixed(2)+"점"],
    ["전체 긍정률",summary.overallPositiveRate.toFixed(1)+"%","추천/NPS",npsText],
    ["유효 주관식",summary.opinionCount+"건","결측률",summary.missingRate.toFixed(1)+"%"],
    ["최고 만족",top?top.question:"산출 불가","개선 우선",low?low.question:"산출 불가"]
  ];
  sheet.getRange(4,1,4,4).setValues(cards);
  sheet.getRange(4,1,4,4).setBorder(true,true,true,true,true,true,"#D9E2EC",SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(4,1,4,1).setBackground("#EAF2F8").setFontWeight("bold");
  sheet.getRange(4,3,4,1).setBackground("#EAF2F8").setFontWeight("bold");
  const ranked=(analysis.scale||[]).filter(function(i){return i.average!==null;}).slice().sort(compareDynamicScaleResults_);
  const rows=[["구분","문항","평균","시각화","긍정률","순위"]];
  ranked.slice(0,5).forEach(function(i){rows.push(["상위",i.question,i.average,"",i.positiveRate/100,i.rank]);});
  ranked.slice(-5).reverse().forEach(function(i){rows.push(["하위",i.question,i.average,"",i.positiveRate/100,i.rank]);});
  sheet.getRange(10,1,rows.length,6).setValues(rows);styleDynamicReportHeader_(sheet.getRange(10,1,1,6));
  if(rows.length>1){sheet.getRange(11,3,rows.length-1,1).setNumberFormat("0.00");sheet.getRange(11,5,rows.length-1,1).setNumberFormat("0.0%");}
  setDynamicBarSparklines_(sheet,11,rows.length-1,3,4);
  highlightDynamicMaximums_(sheet,11,rows.length-1,[3,5]);
  finishDynamicReportSheet_(sheet,rows.length+11,8);
}

function createDynamicRespondentSheet_(analysis) {
  createDynamicCategoricalSheet_("03_응답자특성", "응답자 특성", analysis.respondent || []);
}

function createDynamicSingleSheet_(analysis) {
  createDynamicCategoricalSheet_("04_단일응답분석", "단일응답 분석", analysis.single || []);
}

function createDynamicCategoricalSheet_(sheetName, title, questions) {
  const sheet = resetDynamicReportSheet_(sheetName);
  setDynamicReportTitle_(sheet, "A1:F2", title);
  let row = 4;
  if (questions.length === 0) {
    sheet.getRange(row, 1).setValue("분석 대상 문항이 없습니다.");
    finishDynamicReportSheet_(sheet, row + 2, 6);
    return;
  }
  questions.forEach(function(question) {
    sheet.getRange(row, 1, 1, 6).merge().setValue(question.question)
      .setBackground("#EAF2F8").setFontWeight("bold");
    row++;
    const rows = [["항목", "빈도", "시각화", "유효응답 기준 비율", "전체응답 기준 비율", "분석 기준"]];
    (question.items || []).forEach(function(item) {
      rows.push([item.label, Number(item.count || 0), "", Number(item.validResponseRate || item.rate || 0) / 100,
        Number(item.totalRespondentRate || 0) / 100, "유효 " + question.validResponses + " / 무응답 " + question.missingResponses]);
    });
    rows.push(["합계", Number(question.validResponses || 0), "", question.validResponses ? 1 : 0,
      question.totalRespondents ? Number(question.validResponses || 0) / question.totalRespondents : 0, "전체 " + question.totalRespondents]);
    sheet.getRange(row, 1, rows.length, 6).setValues(rows);
    styleDynamicReportHeader_(sheet.getRange(row, 1, 1, 6));
    sheet.getRange(row + 1, 4, rows.length - 1, 2).setNumberFormat("0.0%");
    sheet.getRange(row + rows.length - 1, 1, 1, 6).setFontWeight("bold").setBackground("#FFF2CC");
    setDynamicBarSparklines_(sheet,row+1,(question.items||[]).length,2,3);
    highlightDynamicMaximums_(sheet,row+1,(question.items||[]).length,[2,4,5]);
    row += rows.length + 2;
  });
  sheet.setColumnWidth(1, 380); sheet.setColumnWidths(2, 4, 130);
  finishDynamicReportSheet_(sheet, row, 6);
}

function createDynamicMultipleSheet_(analysis) {
  const sheet = resetDynamicReportSheet_("05_복수응답분석");
  setDynamicReportTitle_(sheet, "A1:F2", "복수응답 분석");

  let row = 4;
  const questions = analysis.multiple || [];

  if (questions.length === 0) {
    sheet.getRange(row, 1).setValue("복수응답 분석 대상 문항이 없습니다.");
    finishDynamicReportSheet_(sheet, row + 2, 6);
    return;
  }

  questions.forEach(function(question) {
    sheet.getRange(row, 1, 1, 5)
      .merge()
      .setValue(question.question)
      .setBackground("#EAF2F8")
      .setFontWeight("bold");

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

    sheet.getRange(row + rows.length - 1, 1, 1, 6)
      .setFontWeight("bold").setBackground("#FFF2CC");
    setDynamicBarSparklines_(sheet,row+1,(question.items||[]).length,2,3);
    highlightDynamicMaximums_(sheet,row+1,(question.items||[]).length,[2,4,5,6]);
    row += rows.length + 2;
  });

  sheet.setColumnWidth(1, 380);
  sheet.setColumnWidths(2, 4, 125);
  finishDynamicReportSheet_(sheet, row, 5);
}

function buildDynamicMultipleTotalRow_(question) {
  return ["합계",Number(question.totalSelections||question.totalSelectionCount||0),
    Number(question.totalSelections||question.totalSelectionCount||0)>0?1:0,"",""];
}


function createDynamicSatisfactionSheet_(analysis) {
  const sheet=resetDynamicReportSheet_(DYNAMIC_SURVEY_CONFIG.SHEETS.SCALE);
  setDynamicReportTitle_(sheet,"A1:S2","5점 척도 분석");
  const headers=["문항","유효응답","시각화","결측","미매핑","5점","4점","3점","2점","1점","평균","중앙값","표준편차","100점 환산","긍정률","중립률","부정률","전체 가중평균 대비","순위"];
  const rows=[headers];
  (analysis.scale||[]).forEach(function(item){const d=item.scoreDistribution||{};rows.push([item.question,item.validCount,"",item.missingCount,item.unmappedCount,
    d[5]||0,d[4]||0,d[3]||0,d[2]||0,d[1]||0,item.average,item.median,item.standardDeviation,item.converted100,
    item.positiveRate/100,item.neutralRate/100,item.negativeRate/100,item.deviation,item.rank]);});
  const s=analysis.scaleSummary;
  rows.push(["전체 요약",s.totalValidResponses,"","","",s.totalPositiveCount?"":"","","","","",s.weightedAverage,"","",s.overallConverted100,
    s.overallPositiveRate/100,s.overallNeutralRate/100,s.overallNegativeRate/100,"",""]);
  sheet.getRange(4,1,rows.length,headers.length).setValues(rows);styleDynamicReportHeader_(sheet.getRange(4,1,1,headers.length));
  if(rows.length>1){sheet.getRange(5,11,rows.length-1,4).setNumberFormat("0.00");sheet.getRange(5,15,rows.length-1,3).setNumberFormat("0.0%");}
  setDynamicBarSparklines_(sheet,5,(analysis.scale||[]).length,2,3);
  highlightDynamicMaximums_(sheet,5,(analysis.scale||[]).length,[2,6,7,8,9,10,15,16,17]);
  sheet.getRange(4+rows.length-1,1,1,headers.length).setBackground("#FFF2CC").setFontWeight("bold");
  const noteRow=5+rows.length;sheet.getRange(noteRow,1,1,headers.length).merge().setValue(
    "※ 전체 평균은 전체 유효 척도 응답 기준 가중평균입니다. 표준편차는 모집단 방식입니다. 순위는 평균→긍정률→5점 응답 수이며 완전 동점은 공동순위입니다.").setWrap(true);
  sheet.setColumnWidth(1,420);sheet.setColumnWidths(2,headers.length-1,95);finishDynamicReportSheet_(sheet,noteRow,headers.length);
}

function createDynamicRecommendationSheet_(analysis) {
  const sheet = resetDynamicReportSheet_(DYNAMIC_SURVEY_CONFIG.SHEETS.RECOMMENDATION);
  setDynamicReportTitle_(sheet, "A1:H2", "추천의향 및 NPS 분석");
  let row = 4;
  const questions = analysis.recommendation || [];
  if (questions.length === 0) {
    sheet.getRange(row, 1).setValue("추천 분석 대상 문항이 없습니다.");
    finishDynamicReportSheet_(sheet, row + 2, 8);
    return;
  }
  questions.forEach(function(item) {
    sheet.getRange(row, 1, 1, 8).merge().setValue(item.question).setBackground("#EAF2F8").setFontWeight("bold");
    row++;
    let rows;
    if (item.scaleMode === "NPS_0_10") {
      rows = [["구분", "인원", "시각화", "비율", "NPS", "유효응답", "무응답", "분모"] ,
        ["추천자", item.promoterCount, "", item.promoterRate / 100, item.nps, item.validResponses, item.missingResponses, "유효응답"],
        ["중립자", item.passiveCount, "", item.passiveRate / 100, "", item.validResponses, item.missingResponses, "유효응답"],
        ["비추천자", item.detractorCount, "", item.detractorRate / 100, "", item.validResponses, item.missingResponses, "유효응답"],
        ["합계", item.validResponses, "", item.validResponses ? 1 : 0, item.nps, item.validResponses, item.missingResponses, "전체 " + item.totalRespondents]];
    } else {
      rows = [["구분", "인원", "시각화", "비율", "평균", "유효응답", "무응답", "분모"],
        ["긍정", item.positiveCount, "", item.positiveRate / 100, item.average, item.validResponses, item.missingResponses, "유효응답"],
        ["보통", item.neutralCount, "", item.neutralRate / 100, "", item.validResponses, item.missingResponses, "유효응답"],
        ["부정", item.negativeCount, "", item.negativeRate / 100, "", item.validResponses, item.missingResponses, "유효응답"],
        ["합계", item.validResponses, "", item.validResponses ? 1 : 0, item.average, item.validResponses, item.missingResponses, "전체 " + item.totalRespondents]];
    }
    sheet.getRange(row, 1, rows.length, 8).setValues(rows);
    styleDynamicReportHeader_(sheet.getRange(row, 1, 1, 8));
    sheet.getRange(row + 1, 4, rows.length - 1, 1).setNumberFormat("0.0%");
    sheet.getRange(row + rows.length - 1, 1, 1, 8).setFontWeight("bold").setBackground("#FFF2CC");
    setDynamicBarSparklines_(sheet,row+1,3,2,3);
    highlightDynamicMaximums_(sheet,row+1,3,[2,4]);
    row += rows.length + 2;
  });
  finishDynamicReportSheet_(sheet, row, 8);
}

function createDynamicOpinionRawSheet_(analysis) {
  const sheet = resetDynamicReportSheet_("08_주관식분석");
  setDynamicReportTitle_(sheet, "A1:D2", "주관식 응답 목록");

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
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 560);
  sheet.setColumnWidth(4, 120);
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

function highlightDynamicMaximums_(sheet,startRow,rowCount,columns) {
  if (!sheet || Number(rowCount || 0) < 1) return;
  columns.forEach(function(column) {
    const range=sheet.getRange(startRow,column,rowCount,1);
    const values=range.getValues();
    const numericValues=values.filter(function(row){return typeof row[0]==="number"&&Number.isFinite(row[0]);})
      .map(function(row){return row[0];});
    if (!numericValues.length) return;
    const maximum=Math.max.apply(null,numericValues);
    const backgrounds=range.getBackgrounds();
    values.forEach(function(row,index){
      if (typeof row[0]==="number"&&Number.isFinite(row[0])&&row[0]===maximum) backgrounds[index][0]="#FFF2CC";
    });
    range.setBackgrounds(backgrounds);
  });
}

function resetDynamicReportSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  sheet.clear();

  // Sheet 객체에는 clearCharts()가 없으므로 기존 차트를 하나씩 제거합니다.
  sheet.getCharts().forEach(function(chart) {
    sheet.removeChart(chart);
  });

  sheet.getDataRange().breakApart();
  sheet.setHiddenGridlines(true);

  return sheet;
}


function setDynamicReportTitle_(sheet, rangeA1, title) {
  const range = sheet.getRange(rangeA1);
  range.merge()
    .setValue(title)
    .setBackground("#17375E")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(16)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.setRowHeights(1, 2, 30);
}


function styleDynamicReportHeader_(range) {
  range
    .setBackground("#244D78")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);
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
}


function moveDynamicStatisticalSheetsInOrder_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const order = [
    "00_설정",
    "00_품질검사",
    "01_조사개요",
    "02_대시보드",
    "03_응답자특성",
    "04_단일응답분석",
    "05_복수응답분석",
    "06_척도분석",
    "07_추천의향분석",
    "08_주관식분석",
    "09_AI총평",
    "10_향후계획",
    "11_범용원자료",
    "12_문항매핑"
  ];

  let targetPosition = 1;

  order.forEach(function(sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      return;
    }

    spreadsheet.setActiveSheet(sheet);
    spreadsheet.moveActiveSheet(targetPosition);
    targetPosition++;
  });
}
