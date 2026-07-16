/**
 * ==========================================================================
 * 성남시중원도서관 만족도 조사 자동화 시스템
 * 범용 통계 보고서 생성
 * ==========================================================================
 *
 * 생성 시트
 * - 01_조사개요
 * - 02_대시보드
 * - 03_응답자특성
 * - 04_복수응답분석
 * - 05_만족도분석
 * - 06_주관식분석
 */


/**
 * 웹 대시보드에서 범용 통계 보고서를 생성합니다.
 *
 * @return {Object}
 */
function generateDynamicStatisticalReportFromWeb() {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const settings = getSurveySettings_();
    const analysis = calculateDynamicSurveyAnalysis_();

    createDynamicOverviewSheet_(analysis, settings);
    createDynamicDashboardSheet_(analysis, settings);
    createDynamicRespondentSheet_(analysis);
    createDynamicMultipleSheet_(analysis);
    createDynamicSatisfactionSheet_(analysis);
    createDynamicOpinionRawSheet_(analysis);

    moveDynamicStatisticalSheetsInOrder_();
    SpreadsheetApp.flush();

    return {
      success: true,
      message: "범용 통계 보고서 생성이 완료되었습니다.",
      generatedSheets: [
        "01_조사개요",
        "02_대시보드",
        "03_응답자특성",
        "04_복수응답분석",
        "05_만족도분석",
        "06_주관식분석"
      ],
      summary: buildDynamicReportSummary_(analysis)
    };

  } catch (error) {
    return {
      success: false,
      error: error && error.message
        ? error.message
        : String(error)
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {
      // 잠금 미획득 시 무시
    }
  }
}


/**
 * 스프레드시트 메뉴에서 실행할 때 사용합니다.
 */
function generateDynamicStatisticalReport() {
  const ui = SpreadsheetApp.getUi();
  const result = generateDynamicStatisticalReportFromWeb();

  if (result.success) {
    ui.alert(
      "통계 보고서 생성 완료",
      result.message,
      ui.ButtonSet.OK
    );
  } else {
    ui.alert(
      "통계 보고서 생성 실패",
      result.error,
      ui.ButtonSet.OK
    );
  }

  return result;
}


function buildDynamicReportSummary_(analysis) {
  const recommendation =
    analysis.recommendation
    && analysis.recommendation.length > 0
      ? analysis.recommendation[0]
      : null;

  return {
    respondentCount: Number(analysis.respondentCount || 0),
    totalRespondents: Number(analysis.respondentCount || 0),
    overallAverage: Number(
      analysis.scaleSummary
      && analysis.scaleSummary.overallAverage
        ? analysis.scaleSummary.overallAverage
        : 0
    ),
    overallConverted100: Number(
      analysis.scaleSummary
      && analysis.scaleSummary.overallConverted100
        ? analysis.scaleSummary.overallConverted100
        : 0
    ),
    overallPositiveRate: Number(
      analysis.scaleSummary
      && analysis.scaleSummary.overallPositiveRate
        ? analysis.scaleSummary.overallPositiveRate
        : 0
    ),
    recommendationAverage:
      recommendation ? Number(recommendation.average || 0) : 0,
    recommendationPositiveRate:
      recommendation ? Number(recommendation.positiveRate || 0) : 0
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
    ["조사명", getDynamicSettingValue_(settings, "조사명", "surveyName")],
    ["조사목적", getDynamicSettingValue_(settings, "조사목적", "surveyPurpose")],
    ["조사기간", getDynamicSettingValue_(settings, "조사기간", "surveyPeriod")],
    ["조사대상", getDynamicSettingValue_(settings, "조사대상", "surveyTarget")],
    ["조사방법", getDynamicSettingValue_(settings, "조사방법", "surveyMethod")],
    ["분석방법", getDynamicSettingValue_(settings, "분석방법", "analysisMethod")],
    ["표본 수", Number(analysis.respondentCount || 0) + "명"],
    ["담당부서", getDynamicSettingValue_(settings, "담당부서", "department")],
    ["문의처", getDynamicSettingValue_(settings, "문의처", "contact")],
    ["생성기관", getDynamicSettingValue_(settings, "생성기관", "organization")]
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
  const sheet = resetDynamicReportSheet_("02_대시보드");
  const summary = buildDynamicReportSummary_(analysis);

  setDynamicReportTitle_(
    sheet,
    "A1:H2",
    getDynamicSettingValue_(settings, "대시보드 제목", "dashboardTitle")
      || "만족도 조사 대시보드"
  );

  const cards = [
    ["전체 응답", summary.respondentCount + "명"],
    ["만족도 평균", summary.overallAverage.toFixed(2) + "점"],
    ["100점 환산", summary.overallConverted100.toFixed(1) + "점"],
    ["전체 긍정률", summary.overallPositiveRate.toFixed(1) + "%"],
    ["재이용·추천 평균", summary.recommendationAverage.toFixed(2) + "점"],
    ["재이용·추천 긍정률", summary.recommendationPositiveRate.toFixed(1) + "%"]
  ];

  sheet.getRange(4, 1, cards.length, 2).setValues(cards);
  styleDynamicReportHeader_(sheet.getRange(4, 1, 1, 2));
  sheet.getRange(5, 1, cards.length - 1, 1)
    .setBackground("#EAF2F8")
    .setFontWeight("bold");

  let row = 12;
  const scaleRows = [["문항", "평균", "100점 환산", "긍정률", "순위"]];

  (analysis.scale || []).forEach(function(item) {
    scaleRows.push([
      item.question,
      Number(item.average || 0),
      Number(item.converted100 || 0),
      Number(item.positiveRate || 0) / 100,
      item.rank || ""
    ]);
  });

  sheet.getRange(row, 1, scaleRows.length, 5).setValues(scaleRows);
  styleDynamicReportHeader_(sheet.getRange(row, 1, 1, 5));

  if (scaleRows.length > 1) {
    sheet.getRange(row + 1, 2, scaleRows.length - 1, 2)
      .setNumberFormat("0.00");
    sheet.getRange(row + 1, 4, scaleRows.length - 1, 1)
      .setNumberFormat("0.0%");

    const chart = sheet.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(sheet.getRange(row, 1, scaleRows.length, 2))
      .setOption("title", "문항별 평균 만족도")
      .setOption("legend", { position: "none" })
      .setOption("vAxis", { minValue: 0, maxValue: 5 })
      .setPosition(4, 7, 0, 0)
      .build();

    sheet.insertChart(chart);
  }

  sheet.setColumnWidth(1, 360);
  sheet.setColumnWidths(2, 4, 120);
  finishDynamicReportSheet_(sheet, row + scaleRows.length + 2, 8);
}


function createDynamicRespondentSheet_(analysis) {
  const sheet = resetDynamicReportSheet_("03_응답자특성");
  setDynamicReportTitle_(sheet, "A1:F2", "응답자 특성 및 단일응답 분석");

  let row = 4;
  const questions = []
    .concat(analysis.respondent || [])
    .concat(analysis.single || []);

  if (questions.length === 0) {
    sheet.getRange(row, 1).setValue("분석 대상 문항이 없습니다.");
    finishDynamicReportSheet_(sheet, row + 2, 6);
    return;
  }

  questions.forEach(function(question) {
    sheet.getRange(row, 1, 1, 4)
      .merge()
      .setValue(question.question)
      .setBackground("#EAF2F8")
      .setFontWeight("bold");

    row++;

    const rows = [["항목", "응답수", "비율", "유효응답"]];

    (question.items || []).forEach(function(item) {
      rows.push([
        item.label,
        Number(item.count || 0),
        Number(item.rate || 0) / 100,
        Number(question.validCount || 0)
      ]);
    });

    sheet.getRange(row, 1, rows.length, 4).setValues(rows);
    styleDynamicReportHeader_(sheet.getRange(row, 1, 1, 4));

    if (rows.length > 1) {
      sheet.getRange(row + 1, 3, rows.length - 1, 1)
        .setNumberFormat("0.0%");
    }

    row += rows.length + 2;
  });

  sheet.setColumnWidth(1, 380);
  sheet.setColumnWidths(2, 3, 120);
  finishDynamicReportSheet_(sheet, row, 6);
}


function createDynamicMultipleSheet_(analysis) {
  const sheet = resetDynamicReportSheet_("04_복수응답분석");
  setDynamicReportTitle_(sheet, "A1:F2", "복수응답 분석");

  let row = 4;
  const questions = analysis.multiple || [];

  if (questions.length === 0) {
    sheet.getRange(row, 1).setValue("복수응답 분석 대상 문항이 없습니다.");
    finishDynamicReportSheet_(sheet, row + 2, 6);
    return;
  }

  questions.forEach(function(question) {
    sheet.getRange(row, 1, 1, 6)
      .merge()
      .setValue(question.question)
      .setBackground("#EAF2F8")
      .setFontWeight("bold");

    row++;

    const rows = [[
      "항목",
      "선택건수",
      "선택건수 비율",
      "전체 응답자 선택률",
      "유효 응답자",
      "전체 선택건수"
    ]];

    (question.items || []).forEach(function(item) {
      rows.push([
        item.label,
        Number(item.count || 0),
        Number(item.selectionRate || 0) / 100,
        Number(item.respondentRate || 0) / 100,
        Number(question.validRespondentCount || 0),
        Number(question.totalSelectionCount || 0)
      ]);
    });

    sheet.getRange(row, 1, rows.length, 6).setValues(rows);
    styleDynamicReportHeader_(sheet.getRange(row, 1, 1, 6));

    if (rows.length > 1) {
      sheet.getRange(row + 1, 3, rows.length - 1, 2)
        .setNumberFormat("0.0%");
    }

    row += rows.length + 2;
  });

  sheet.setColumnWidth(1, 380);
  sheet.setColumnWidths(2, 5, 125);
  finishDynamicReportSheet_(sheet, row, 6);
}


function createDynamicSatisfactionSheet_(analysis) {
  const sheet = resetDynamicReportSheet_("05_만족도분석");
  setDynamicReportTitle_(sheet, "A1:O2", "5점 척도 만족도 및 추천 분석");

  const rows = [[
    "문항",
    "유효응답",
    "5점",
    "4점",
    "3점",
    "2점",
    "1점",
    "평균",
    "100점 환산",
    "긍정률",
    "중립률",
    "부정률",
    "순위",
    "전체평균 대비",
    "유형"
  ]];

  (analysis.scale || []).forEach(function(item) {
    const distribution = {};
    (item.distribution || []).forEach(function(value) {
      distribution[value.score] = value.count;
    });

    rows.push([
      item.question,
      Number(item.validCount || 0),
      Number(distribution[5] || 0),
      Number(distribution[4] || 0),
      Number(distribution[3] || 0),
      Number(distribution[2] || 0),
      Number(distribution[1] || 0),
      Number(item.average || 0),
      Number(item.converted100 || 0),
      Number(item.positiveRate || 0) / 100,
      Number(item.neutralRate || 0) / 100,
      Number(item.negativeRate || 0) / 100,
      item.rank || "",
      Number(item.deviation || 0),
      "만족도"
    ]);
  });

  (analysis.recommendation || []).forEach(function(item) {
    const distribution = {};
    (item.distribution || []).forEach(function(value) {
      distribution[value.score] = value.count;
    });

    rows.push([
      item.question,
      Number(item.validCount || 0),
      Number(distribution[5] || 0),
      Number(distribution[4] || 0),
      Number(distribution[3] || 0),
      Number(distribution[2] || 0),
      Number(distribution[1] || 0),
      Number(item.average || 0),
      Number(item.converted100 || 0),
      Number(item.positiveRate || 0) / 100,
      Number(item.neutralRate || 0) / 100,
      Number(item.negativeRate || 0) / 100,
      "",
      "",
      "재이용·추천"
    ]);
  });

  sheet.getRange(4, 1, rows.length, rows[0].length).setValues(rows);
  styleDynamicReportHeader_(sheet.getRange(4, 1, 1, rows[0].length));

  if (rows.length > 1) {
    sheet.getRange(5, 8, rows.length - 1, 2).setNumberFormat("0.00");
    sheet.getRange(5, 10, rows.length - 1, 3).setNumberFormat("0.0%");
    sheet.getRange(5, 14, rows.length - 1, 1).setNumberFormat("0.00");
  }

  sheet.setColumnWidth(1, 420);
  sheet.setColumnWidths(2, 14, 95);
  finishDynamicReportSheet_(sheet, rows.length + 6, 15);
}


function createDynamicOpinionRawSheet_(analysis) {
  const sheet = resetDynamicReportSheet_("06_주관식분석");
  setDynamicReportTitle_(sheet, "A1:D2", "주관식 응답 목록");

  const rows = [["문항", "응답 번호", "의견", "상태"]];

  (analysis.text || []).forEach(function(question) {
    (question.opinions || []).forEach(function(opinion) {
      rows.push([
        question.question,
        Number(opinion.responseNumber || 0),
        opinion.text,
        "AI 분석 전"
      ]);
    });
  });

  if (rows.length === 1) {
    rows.push(["-", "-", "유효한 주관식 응답이 없습니다.", "-"]);
  }

  sheet.getRange(4, 1, rows.length, 4).setValues(rows);
  styleDynamicReportHeader_(sheet.getRange(4, 1, 1, 4));
  sheet.getRange(5, 1, rows.length - 1, 4)
    .setWrap(true)
    .setVerticalAlignment("top");
  sheet.setColumnWidth(1, 340);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 560);
  sheet.setColumnWidth(4, 120);
  finishDynamicReportSheet_(sheet, rows.length + 6, 4);
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
    "01_조사개요",
    "02_대시보드",
    "03_응답자특성",
    "04_복수응답분석",
    "05_만족도분석",
    "06_주관식분석",
    "07_AI총평",
    "08_향후계획",
    "09_범용원자료",
    "10_문항매핑"
  ];

  order.forEach(function(sheetName, index) {
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      return;
    }

    spreadsheet.setActiveSheet(sheet);
    spreadsheet.moveActiveSheet(index + 1);
  });
}
