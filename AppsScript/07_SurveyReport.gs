/**
 * ==========================================================================
 * 성남시중원도서관 만족도 조사 자동화 시스템
 * 보고서 시트 생성 서비스
 * ==========================================================================
 *
 * 생성 시트
 * 00_설정
 * 01_조사개요
 * 02_대시보드
 * 03_응답자특성
 * 04_복수응답분석
 * 05_만족도분석
 * 06_주관식분석
 * 07_AI총평
 * 08_향후계획
 *
 * 중요
 * - 조사명, 조사목적, 조사기간, 조사대상 등은 00_설정 시트에서 관리합니다.
 * - 코드에 특정 조사 정보를 고정하지 않습니다.
 * - AI 총평 및 향후계획은 담당자 검토용 초안입니다.
 */


// ==========================================================================
// 전체 보고서 생성
// ==========================================================================

/**
 * 통계 시트, 주관식 분석, AI 총평 및 향후계획을 모두 생성합니다.
 */
function generateFullSurveyReport() {
  const ui = SpreadsheetApp.getUi();

  try {
    const settings = getSurveySettings_();
    const data = getRawSurveyObjects_();
    const analysis = calculateSurveyAnalysis_(data);

    createOverviewSheet_(analysis, settings);
    createRespondentSheet_(analysis, settings);
    createMultipleAnalysisSheet_(analysis, settings);
    createSatisfactionSheet_(analysis, settings);

    const opinion = analyzeOpinionsWithAI_(data);

    createOpinionSheet_(
      data,
      opinion,
      settings
    );

    const context = buildAnalysisContext_(
      analysis,
      opinion
    );

    // AI가 어떤 조사인지 알 수 있도록 조사 설정값 추가
    context.survey = {
      name: settings["조사명"],
      purpose: settings["조사목적"],
      period: settings["조사기간"],
      target: settings["조사대상"],
      method: settings["조사방법"],
      department: settings["담당부서"],
      contact: settings["문의처"]
    };

    const summary = generateAISummaryText_(context);

    const futurePlan = generateFuturePlanText_(
      context,
      summary
    );

    createAISummarySheet_(
      summary,
      settings
    );

    createFuturePlanSheet_(
      futurePlan,
      settings
    );

    createDashboardSheet_(
      analysis,
      settings
    );

    moveReportSheetsInOrder_();

    ui.alert(
      "보고서 생성 완료",
      "01_조사개요부터 08_향후계획까지 생성했습니다.\n\n"
      + "AI가 작성한 총평과 향후계획은 담당자가 원자료 및 실제 운영 여건과 "
      + "대조·검증한 후 최종 확정해 주세요.",
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert(
      "보고서 생성 실패",
      error && error.message
        ? error.message
        : String(error),
      ui.ButtonSet.OK
    );
  }
}


/**
 * AI 기능을 제외한 통계 시트만 다시 생성합니다.
 */
function generateStatisticalSheets() {
  const ui = SpreadsheetApp.getUi();

  try {
    const settings = getSurveySettings_();
    const data = getRawSurveyObjects_();
    const analysis = calculateSurveyAnalysis_(data);

    createOverviewSheet_(analysis, settings);
    createRespondentSheet_(analysis, settings);
    createMultipleAnalysisSheet_(analysis, settings);
    createSatisfactionSheet_(analysis, settings);
    createDashboardSheet_(analysis, settings);

    moveReportSheetsInOrder_();

    ui.alert(
      "완료",
      "통계 시트 생성이 완료되었습니다.",
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert(
      "통계 시트 생성 실패",
      error && error.message
        ? error.message
        : String(error),
      ui.ButtonSet.OK
    );
  }
}


/**
 * 주관식 분석, AI 총평 및 향후계획만 다시 생성합니다.
 */
function generateAIReportSheets() {
  const ui = SpreadsheetApp.getUi();

  try {
    const settings = getSurveySettings_();
    const data = getRawSurveyObjects_();
    const analysis = calculateSurveyAnalysis_(data);
    const opinion = analyzeOpinionsWithAI_(data);

    createOpinionSheet_(
      data,
      opinion,
      settings
    );

    const context = buildAnalysisContext_(
      analysis,
      opinion
    );

    context.survey = {
      name: settings["조사명"],
      purpose: settings["조사목적"],
      period: settings["조사기간"],
      target: settings["조사대상"],
      method: settings["조사방법"],
      department: settings["담당부서"],
      contact: settings["문의처"]
    };

    const summary = generateAISummaryText_(context);

    const futurePlan = generateFuturePlanText_(
      context,
      summary
    );

    createAISummarySheet_(
      summary,
      settings
    );

    createFuturePlanSheet_(
      futurePlan,
      settings
    );

    moveReportSheetsInOrder_();

    ui.alert(
      "완료",
      "주관식 분석, AI 총평 및 향후계획 생성이 완료되었습니다.",
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert(
      "AI 보고서 생성 실패",
      error && error.message
        ? error.message
        : String(error),
      ui.ButtonSet.OK
    );
  }
}


// ==========================================================================
// 00_설정 시트
// ==========================================================================

/**
 * 00_설정 시트가 없으면 입력용 템플릿을 자동 생성합니다.
 */
function createSurveySettingsTemplate_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const sheetName =
    APP_CONFIG.SETTINGS_SHEET
    || "00_설정";

  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  sheet.clear();
  sheet.getDataRange().breakApart();

  const rows = [
    ["설정 항목", "입력 내용", "작성 안내"],
    ["조사명", "", "예: 2026년 상반기 「공간혁신 및 정보기술 서비스」 만족도 조사"],
    ["보고서 제목", "", "비워두면 조사명 뒤에 '결과 보고'가 자동 추가됩니다."],
    ["대시보드 제목", "", "비워두면 조사명 뒤에 '대시보드'가 자동 추가됩니다."],
    ["조사목적", "", "조사를 실시하는 목적을 입력합니다."],
    ["조사기간", "", "예: 2026. 6. 9. ~ 2026. 6. 16."],
    ["조사대상", "", "예: 중원도서관 공간 및 정보기술 서비스 이용자"],
    ["조사방법", "비대면(네이버 폼 활용 설문조사 시행)", "설문 실시 방법을 입력합니다."],
    ["분석방법", "단일응답 빈도, 복수응답 이중 비율, 5점 척도 및 주관식 의미 범주 분석 등", "실제로 구현된 분석방법만 입력합니다."],
    ["담당부서", APP_CONFIG.TEAM_NAME || "평생학습지원팀", "담당 부서명"],
    ["문의처", APP_CONFIG.SURVEY_CONTACT || "", "설문 관련 문의번호"],
    ["생성기관", APP_CONFIG.LIBRARY_NAME || "성남시중원도서관", "보고서 생성 기관"]
  ];

  sheet
    .getRange(
      1,
      1,
      rows.length,
      3
    )
    .setValues(rows);

  sheet
    .getRange(
      1,
      1,
      1,
      3
    )
    .setBackground(APP_CONFIG.COLORS.NAVY)
    .setFontColor(APP_CONFIG.COLORS.WHITE)
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  sheet
    .getRange(
      2,
      1,
      rows.length - 1,
      1
    )
    .setBackground(APP_CONFIG.COLORS.LIGHT_BLUE)
    .setFontWeight("bold");

  sheet
    .getRange(
      2,
      2,
      rows.length - 1,
      1
    )
    .setBackground(APP_CONFIG.COLORS.YELLOW);

  sheet
    .getDataRange()
    .setFontFamily("맑은 고딕")
    .setVerticalAlignment("middle")
    .setWrap(true)
    .setBorder(
      true,
      true,
      true,
      true,
      true,
      true,
      APP_CONFIG.COLORS.BORDER,
      SpreadsheetApp.BorderStyle.SOLID
    );

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 500);
  sheet.setColumnWidth(3, 430);

  spreadsheet.setActiveSheet(sheet);
  spreadsheet.moveActiveSheet(1);

  return sheet;
}


/**
 * 00_설정 시트 내용을 객체로 반환합니다.
 */
function getSurveySettings_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const sheetName =
    APP_CONFIG.SETTINGS_SHEET
    || "00_설정";

  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    createSurveySettingsTemplate_();

    throw new Error(
      sheetName
      + " 시트를 새로 만들었습니다.\n\n"
      + "조사명, 조사목적, 조사기간, 조사대상 등을 입력한 뒤 다시 실행해 주세요."
    );
  }

  const values = sheet
    .getDataRange()
    .getDisplayValues();

  const settings = {};

  // 첫 행은 헤더이므로 제외
  values.slice(1).forEach(function(row) {
    const key = cleanText_(row[0]);
    const value = cleanText_(row[1]);

    if (key) {
      settings[key] = value;
    }
  });

  const requiredKeys = [
    "조사명",
    "조사목적",
    "조사기간",
    "조사대상",
    "조사방법"
  ];

  const missingKeys = requiredKeys.filter(function(key) {
    return !settings[key];
  });

  if (missingKeys.length > 0) {
    throw new Error(
      sheetName
      + " 시트에서 다음 항목을 입력해 주세요.\n\n- "
      + missingKeys.join("\n- ")
    );
  }

  // 선택항목 기본값
  if (!settings["보고서 제목"]) {
    settings["보고서 제목"] =
      settings["조사명"]
      + " 결과 보고";
  }

  if (!settings["대시보드 제목"]) {
    settings["대시보드 제목"] =
      settings["조사명"]
      + " 대시보드";
  }

  if (!settings["분석방법"]) {
    settings["분석방법"] =
      "단일응답 빈도, 복수응답 이중 비율, 5점 척도 및 주관식 의미 범주 분석 등";
  }

  if (!settings["담당부서"]) {
    settings["담당부서"] =
      APP_CONFIG.TEAM_NAME
      || "";
  }

  if (!settings["문의처"]) {
    settings["문의처"] =
      APP_CONFIG.SURVEY_CONTACT
      || "";
  }

  if (!settings["생성기관"]) {
    settings["생성기관"] =
      APP_CONFIG.LIBRARY_NAME
      || "성남시중원도서관";
  }

  return settings;
}


// ==========================================================================
// 01_조사개요
// ==========================================================================

function createOverviewSheet_(
  analysis,
  settings
) {
  const sheet = resetSheet_("01_조사개요");
  const colors = APP_CONFIG.COLORS;

  title_(
    sheet,
    "A1:H2",
    settings["보고서 제목"]
  );

  const overviewRows = [
    ["구분", "내용"],
    ["조 사 명", settings["조사명"]],
    ["조사목적", settings["조사목적"]],
    ["조사기간", settings["조사기간"]],
    ["조사대상", settings["조사대상"]],
    ["조사방법", settings["조사방법"]],
    ["표 본 수", analysis.totalRespondents + "명"],
    ["분석방법", settings["분석방법"]]
  ];

  overviewRows.forEach(function(row, index) {
    const rowNumber = 4 + index;

    sheet
      .getRange(
        rowNumber,
        1,
        1,
        2
      )
      .merge()
      .setValue(row[0]);

    sheet
      .getRange(
        rowNumber,
        3,
        1,
        6
      )
      .merge()
      .setValue(row[1]);
  });

  styleHeader_(
    sheet.getRange("A4:H4")
  );

  sheet
    .getRange("A5:B11")
    .setBackground(colors.LIGHT_BLUE)
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  sheet
    .getRange("C5:H11")
    .setWrap(true);

  const criteriaRows = [
    [
      "문항 구분",
      "대상",
      "분석 기준",
      "비고"
    ],
    [
      "단일응답",
      "이용자 유형, 재이용·추천",
      "유효응답자 기준 응답수 및 비율",
      "문항별 비율 합계 100.0%"
    ],
    [
      "복수응답",
      "서비스, 인지경로, 개선, 희망",
      "선택건수 비율 및 응답자 선택률",
      "응답자 선택률 합계 100% 초과 가능"
    ],
    [
      "5점 척도",
      "만족도 6문항",
      "평균, 100점 환산, 긍정률",
      "긍정응답=5점+4점"
    ],
    [
      "주관식",
      "신규 도입·개선 의견",
      "8개 의미 범주 분류",
      "하나의 의견을 중복 코딩할 수 있음"
    ]
  ];

  criteriaRows.forEach(function(row, index) {
    const rowNumber = 14 + index;

    sheet
      .getRange(
        rowNumber,
        1,
        1,
        2
      )
      .merge()
      .setValue(row[0]);

    sheet
      .getRange(
        rowNumber,
        3,
        1,
        2
      )
      .merge()
      .setValue(row[1]);

    sheet
      .getRange(
        rowNumber,
        5,
        1,
        2
      )
      .merge()
      .setValue(row[2]);

    sheet
      .getRange(
        rowNumber,
        7,
        1,
        2
      )
      .merge()
      .setValue(row[3]);
  });

  styleHeader_(
    sheet.getRange("A14:H14")
  );

  finishReportSheet_(
    sheet,
    18,
    8
  );

  sheet.setColumnWidths(
    1,
    8,
    110
  );

  sheet.setRowHeight(
    1,
    35
  );

  sheet.setRowHeight(
    2,
    35
  );
}


// ==========================================================================
// 02_대시보드
// ==========================================================================

function createDashboardSheet_(
  analysis,
  settings
) {
  const sheet = resetSheet_("02_대시보드");
  const colors = APP_CONFIG.COLORS;

  title_(
    sheet,
    "A1:L2",
    settings["대시보드 제목"]
  );

  const kpiItems = [
    [
      "전체 응답",
      analysis.totalRespondents
      + "명"
    ],
    [
      "6개 만족도 평균",
      Number(
        analysis.overallAverage
        || 0
      ).toFixed(2)
      + "점"
    ],
    [
      "긍정률",
      Number(
        analysis.overallPositiveRate
        || 0
      ).toFixed(1)
      + "%"
    ],
    [
      "재이용·추천 긍정률",
      Number(
        analysis.recommendation.positiveRate
        || 0
      ).toFixed(1)
      + "%"
    ]
  ];

  kpiItems.forEach(function(item, index) {
    const startColumn =
      1 + index * 3;

    sheet
      .getRange(
        4,
        startColumn,
        1,
        3
      )
      .merge()
      .setValue(item[0])
      .setBackground(colors.LIGHT_BLUE)
      .setFontWeight("bold")
      .setHorizontalAlignment("center");

    sheet
      .getRange(
        5,
        startColumn,
        2,
        3
      )
      .merge()
      .setValue(item[1])
      .setFontSize(20)
      .setFontWeight("bold")
      .setFontColor(colors.NAVY)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
  });

  const userTypeRows = [
    ["이용자 유형", "응답수"]
  ].concat(
    analysis.userTypes.map(function(item) {
      return [
        item.label,
        item.count
      ];
    })
  );

  const futureItems =
    analysis.multiple[
      "향후 희망 서비스(복수)"
    ]
    || [];

  const futureRows = [
    ["향후 희망 서비스", "선택건수"]
  ].concat(
    futureItems.map(function(item) {
      return [
        item.label,
        item.count
      ];
    })
  );

  const satisfactionRows = [
    ["만족도 항목", "평균"]
  ].concat(
    analysis.satisfaction.map(function(item) {
      return [
        item.label,
        item.average
      ];
    })
  );

  sheet
    .getRange(
      9,
      1,
      userTypeRows.length,
      2
    )
    .setValues(userTypeRows);

  sheet
    .getRange(
      9,
      4,
      futureRows.length,
      2
    )
    .setValues(futureRows);

  sheet
    .getRange(
      9,
      7,
      satisfactionRows.length,
      2
    )
    .setValues(satisfactionRows);

  styleHeader_(
    sheet.getRange(9, 1, 1, 2)
  );

  styleHeader_(
    sheet.getRange(9, 4, 1, 2)
  );

  styleHeader_(
    sheet.getRange(9, 7, 1, 2)
  );

  if (userTypeRows.length > 1) {
    const userTypeChart = sheet
      .newChart()
      .setChartType(
        Charts.ChartType.PIE
      )
      .addRange(
        sheet.getRange(
          9,
          1,
          userTypeRows.length,
          2
        )
      )
      .setOption(
        "title",
        "응답자 유형 분포"
      )
      .setOption(
        "pieHole",
        0.35
      )
      .setPosition(
        20,
        1,
        0,
        0
      )
      .build();

    sheet.insertChart(
      userTypeChart
    );
  }

  if (futureRows.length > 1) {
    const futureChart = sheet
      .newChart()
      .setChartType(
        Charts.ChartType.BAR
      )
      .addRange(
        sheet.getRange(
          9,
          4,
          futureRows.length,
          2
        )
      )
      .setOption(
        "title",
        "향후 희망 서비스"
      )
      .setOption(
        "legend",
        {
          position: "none"
        }
      )
      .setPosition(
        20,
        7,
        0,
        0
      )
      .build();

    sheet.insertChart(
      futureChart
    );
  }

  if (satisfactionRows.length > 1) {
    const satisfactionChart = sheet
      .newChart()
      .setChartType(
        Charts.ChartType.COLUMN
      )
      .addRange(
        sheet.getRange(
          9,
          7,
          satisfactionRows.length,
          2
        )
      )
      .setOption(
        "title",
        "문항별 평균 만족도"
      )
      .setOption(
        "legend",
        {
          position: "none"
        }
      )
      .setOption(
        "vAxis",
        {
          minValue: 0,
          maxValue: 5
        }
      )
      .setPosition(
        38,
        1,
        0,
        0
      )
      .build();

    sheet.insertChart(
      satisfactionChart
    );
  }

  finishReportSheet_(
    sheet,
    55,
    12
  );

  sheet.setColumnWidths(
    1,
    12,
    105
  );
}


// ==========================================================================
// 03_응답자특성
// ==========================================================================

function createRespondentSheet_(
  analysis,
  settings
) {
  const sheet = resetSheet_("03_응답자특성");

  title_(
    sheet,
    "A1:D2",
    settings["조사명"]
    + " 응답자 특성"
  );

  const rows = [
    [
      "순위",
      "이용자 유형",
      "응답수",
      "비율"
    ]
  ];

  analysis.userTypes.forEach(function(item, index) {
    rows.push([
      index + 1,
      item.label,
      item.count,
      Number(
        item.rate
        || 0
      ) / 100
    ]);
  });

  rows.push([
    "",
    "합계",
    analysis.totalRespondents,
    1
  ]);

  sheet
    .getRange(
      4,
      1,
      rows.length,
      4
    )
    .setValues(rows);

  styleHeader_(
    sheet.getRange(
      4,
      1,
      1,
      4
    )
  );

  sheet
    .getRange(
      5,
      4,
      rows.length - 1,
      1
    )
    .setNumberFormat("0.0%");

  sheet
    .getRange(
      4 + rows.length - 1,
      1,
      1,
      4
    )
    .setFontWeight("bold")
    .setBackground(
      APP_CONFIG.COLORS.LIGHT_BLUE
    );

  if (analysis.userTypes.length > 0) {
    const chart = sheet
      .newChart()
      .setChartType(
        Charts.ChartType.PIE
      )
      .addRange(
        sheet.getRange(
          4,
          2,
          analysis.userTypes.length + 1,
          2
        )
      )
      .setOption(
        "title",
        "응답자 유형 분포"
      )
      .setPosition(
        4,
        6,
        0,
        0
      )
      .build();

    sheet.insertChart(chart);
  }

  finishReportSheet_(
    sheet,
    Math.max(
      rows.length + 5,
      22
    ),
    10
  );

  sheet.setColumnWidths(
    1,
    4,
    150
  );
}


// ==========================================================================
// 04_복수응답분석
// ==========================================================================

function createMultipleAnalysisSheet_(
  analysis,
  settings
) {
  const sheet = resetSheet_("04_복수응답분석");

  title_(
    sheet,
    "A1:F2",
    settings["조사명"]
    + " 복수응답 분석"
  );

  let startRow = 4;

  APP_CONFIG.MULTI_COLUMNS.forEach(function(config) {
    const items =
      analysis.multiple[
        config.header
      ]
      || [];

    sheet
      .getRange(
        startRow,
        1,
        1,
        6
      )
      .merge()
      .setValue(config.title)
      .setBackground(
        APP_CONFIG.COLORS.BLUE
      )
      .setFontColor(
        APP_CONFIG.COLORS.WHITE
      )
      .setFontWeight("bold");

    const rows = [
      [
        "순위",
        "항목",
        "선택건수",
        "선택건수 비율",
        "응답자 선택률",
        "비고"
      ]
    ];

    items.forEach(function(item, index) {
      rows.push([
        index + 1,
        item.label,
        item.count,
        item.selectionShare / 100,
        item.respondentRate / 100,
        ""
      ]);
    });

    if (items.length === 0) {
      rows.push([
        "",
        "응답 없음",
        0,
        0,
        0,
        ""
      ]);
    }

    sheet
      .getRange(
        startRow + 1,
        1,
        rows.length,
        6
      )
      .setValues(rows);

    styleHeader_(
      sheet.getRange(
        startRow + 1,
        1,
        1,
        6
      )
    );

    if (rows.length > 1) {
      sheet
        .getRange(
          startRow + 2,
          4,
          rows.length - 1,
          2
        )
        .setNumberFormat("0.0%");
    }

    startRow +=
      rows.length + 3;
  });

  finishReportSheet_(
    sheet,
    startRow,
    6
  );

  sheet.setColumnWidth(1, 70);
  sheet.setColumnWidth(2, 300);
  sheet.setColumnWidths(3, 3, 130);
}


// ==========================================================================
// 05_만족도분석
// ==========================================================================

function createSatisfactionSheet_(
  analysis,
  settings
) {
  const sheet = resetSheet_("05_만족도분석");

  title_(
    sheet,
    "A1:O2",
    settings["조사명"]
    + " 5점 척도 만족도 분석"
  );

  const header = [
    "문항",
    "항목",
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
    "전체평균 대비"
  ];

  const rows = [header];

  analysis.satisfaction.forEach(function(item) {
    rows.push([
      item.questionNo,
      item.label,
      item.validCount,
      item.distribution[5],
      item.distribution[4],
      item.distribution[3],
      item.distribution[2],
      item.distribution[1],
      item.average,
      item.converted100,
      item.positiveRate / 100,
      item.neutralRate / 100,
      item.negativeRate / 100,
      item.rank,
      item.deviation
    ]);
  });

  rows.push([
    "종합",
    "6개 문항 전체",
    analysis.validSatisfactionResponses,
    "",
    "",
    "",
    "",
    "",
    analysis.overallAverage,
    analysis.overallConverted100,
    analysis.overallPositiveRate / 100,
    "",
    "",
    "",
    ""
  ]);

  sheet
    .getRange(
      4,
      1,
      rows.length,
      header.length
    )
    .setValues(rows);

  styleHeader_(
    sheet.getRange(
      4,
      1,
      1,
      header.length
    )
  );

  sheet
    .getRange(
      5,
      9,
      rows.length - 1,
      2
    )
    .setNumberFormat("0.00");

  sheet
    .getRange(
      5,
      11,
      rows.length - 1,
      3
    )
    .setNumberFormat("0.0%");

  sheet
    .getRange(
      4 + rows.length - 1,
      1,
      1,
      header.length
    )
    .setBackground(
      APP_CONFIG.COLORS.LIGHT_BLUE
    )
    .setFontWeight("bold");

  if (analysis.satisfaction.length > 0) {
    const chart = sheet
      .newChart()
      .setChartType(
        Charts.ChartType.COLUMN
      )
      .addRange(
        sheet.getRange(
          4,
          2,
          analysis.satisfaction.length + 1,
          1
        )
      )
      .addRange(
        sheet.getRange(
          4,
          9,
          analysis.satisfaction.length + 1,
          1
        )
      )
      .setOption(
        "title",
        "문항별 평균 만족도"
      )
      .setOption(
        "legend",
        {
          position: "none"
        }
      )
      .setOption(
        "vAxis",
        {
          minValue: 0,
          maxValue: 5
        }
      )
      .setPosition(
        14,
        1,
        0,
        0
      )
      .build();

    sheet.insertChart(chart);
  }

  finishReportSheet_(
    sheet,
    32,
    header.length
  );

  sheet.setColumnWidth(1, 65);
  sheet.setColumnWidth(2, 330);
  sheet.setColumnWidths(3, 13, 95);
}


// ==========================================================================
// 06_주관식분석
// ==========================================================================

function createOpinionSheet_(
  data,
  opinion,
  settings
) {
  const sheet = resetSheet_("06_주관식분석");

  title_(
    sheet,
    "A1:G2",
    settings["조사명"]
    + " 주관식 의견 분석"
  );

  const rows = [
    [
      "순위",
      "의미 범주",
      "건수",
      "유효의견 대비 비율",
      "참여자 번호",
      "대표 의견",
      "비고"
    ]
  ];

  opinion.categories.forEach(function(item, index) {
    rows.push([
      index + 1,
      item.category,
      item.count,
      opinion.validCount > 0
        ? item.count / opinion.validCount
        : 0,
      Array.isArray(
        item.participantNumbers
      )
        ? item.participantNumbers.join(", ")
        : "",
      item.representativeOpinions.join("\n"),
      "중복 코딩 가능"
    ]);
  });

  sheet
    .getRange(
      4,
      1,
      rows.length,
      7
    )
    .setValues(rows);

  styleHeader_(
    sheet.getRange(
      4,
      1,
      1,
      7
    )
  );

  sheet
    .getRange(
      5,
      4,
      rows.length - 1,
      1
    )
    .setNumberFormat("0.0%");

  sheet
    .getRange(
      5,
      5,
      rows.length - 1,
      2
    )
    .setWrap(true);

  const startRow =
    6 + rows.length;

  sheet
    .getRange(
      startRow,
      1,
      1,
      3
    )
    .merge()
    .setValue("유효 자유의견 원문")
    .setBackground(
      APP_CONFIG.COLORS.BLUE
    )
    .setFontColor(
      APP_CONFIG.COLORS.WHITE
    )
    .setFontWeight("bold");

  sheet
    .getRange(
      startRow + 1,
      1,
      1,
      3
    )
    .setValues([
      [
        "참여자 번호",
        "이용자 유형",
        "자유의견"
      ]
    ]);

  styleHeader_(
    sheet.getRange(
      startRow + 1,
      1,
      1,
      3
    )
  );

  const comments = data
    .filter(function(row) {
      return isValidOpinion_(
        row["자유의견"]
      );
    })
    .map(function(row) {
      return [
        row["참여자 번호"],
        row["정규화 이용자 유형"]
          || row["이용자 유형"],
        row["자유의견"]
      ];
    });

  if (comments.length > 0) {
    sheet
      .getRange(
        startRow + 2,
        1,
        comments.length,
        3
      )
      .setValues(comments)
      .setWrap(true);
  }

  finishReportSheet_(
    sheet,
    startRow
      + comments.length
      + 2,
    7
  );

  sheet.setColumnWidth(1, 75);
  sheet.setColumnWidth(2, 230);
  sheet.setColumnWidth(5, 170);
  sheet.setColumnWidth(6, 380);
}


// ==========================================================================
// 07_AI총평
// ==========================================================================

function createAISummarySheet_(
  text,
  settings
) {
  const sheet = resetSheet_("07_AI총평");

  title_(
    sheet,
    "A1:H2",
    settings["조사명"]
    + " AI 조사결과 총평 초안"
  );

  sheet
    .getRange("A4:H4")
    .merge()
    .setValue("검증 원칙")
    .setBackground(
      APP_CONFIG.COLORS.YELLOW
    )
    .setFontWeight("bold");

  sheet
    .getRange("A5:H6")
    .merge()
    .setValue(
      "본 초안은 비식별 설문 통계와 주관식 의견을 바탕으로 "
      + "AI가 작성한 보조자료입니다. 최종 문안은 담당자가 "
      + "원자료와 실제 운영 여건을 대조·검증하여 확정해야 합니다."
    )
    .setWrap(true)
    .setVerticalAlignment("middle");

  sheet
    .getRange("A8:H8")
    .merge()
    .setValue("Ⅳ. 총평")
    .setBackground(
      APP_CONFIG.COLORS.BLUE
    )
    .setFontColor(
      APP_CONFIG.COLORS.WHITE
    )
    .setFontWeight("bold");

  sheet
    .getRange("A9:H28")
    .merge()
    .setValue(text)
    .setWrap(true)
    .setVerticalAlignment("top");

  finishReportSheet_(
    sheet,
    28,
    8
  );

  sheet.setColumnWidths(
    1,
    8,
    110
  );
}


// ==========================================================================
// 08_향후계획
// ==========================================================================

function createFuturePlanSheet_(
  text,
  settings
) {
  const sheet = resetSheet_("08_향후계획");

  title_(
    sheet,
    "A1:H2",
    settings["조사명"]
    + " 향후계획 초안"
  );

  sheet
    .getRange("A4:H4")
    .merge()
    .setValue("검증 원칙")
    .setBackground(
      APP_CONFIG.COLORS.YELLOW
    )
    .setFontWeight("bold");

  sheet
    .getRange("A5:H6")
    .merge()
    .setValue(
      "본 초안은 만족도 조사 결과를 바탕으로 작성한 검토용 문안이며, "
      + "실제 추진 여부·일정·예산은 담당 부서의 내부 검토 후 확정해야 합니다."
    )
    .setWrap(true)
    .setVerticalAlignment("middle");

  sheet
    .getRange("A8:H8")
    .merge()
    .setValue("Ⅴ. 향후계획")
    .setBackground(
      APP_CONFIG.COLORS.BLUE
    )
    .setFontColor(
      APP_CONFIG.COLORS.WHITE
    )
    .setFontWeight("bold");

  sheet
    .getRange("A9:H24")
    .merge()
    .setValue(text)
    .setWrap(true)
    .setVerticalAlignment("top");

  finishReportSheet_(
    sheet,
    24,
    8
  );

  sheet.setColumnWidths(
    1,
    8,
    110
  );
}
/**
 * ==========================================================================
 * 웹페이지용 조사 설정 저장·조회
 * ==========================================================================
 */


/**
 * survey-dashboard.html에서 입력한 조사 정보를
 * 00_설정 시트에 저장합니다.
 *
 * @param {Object} settingsData
 * @return {Object}
 */
function saveSurveySettingsFromWeb(settingsData) {
  try {
    if (
      !settingsData
      || typeof settingsData !== "object"
    ) {
      throw new Error(
        "조사 설정 정보가 전달되지 않았습니다."
      );
    }

    const requiredFields = [
      {
        key: "surveyName",
        label: "조사명"
      },
      {
        key: "surveyPurpose",
        label: "조사목적"
      },
      {
        key: "surveyPeriod",
        label: "조사기간"
      },
      {
        key: "surveyTarget",
        label: "조사대상"
      },
      {
        key: "surveyMethod",
        label: "조사방법"
      }
    ];

    const missingFields =
      requiredFields.filter(function(field) {
        return !cleanText_(
          settingsData[field.key]
        );
      });

    if (missingFields.length > 0) {
      throw new Error(
        "다음 필수 항목을 입력해 주세요.\n\n- "
        + missingFields
          .map(function(field) {
            return field.label;
          })
          .join("\n- ")
      );
    }

    const sheetName =
      APP_CONFIG.SETTINGS_SHEET
      || "00_설정";

    const sheet =
      getOrCreateSheet_(
        sheetName
      );

    removeAllCharts_(
      sheet
    );

    sheet
      .getDataRange()
      .breakApart();

    sheet.clear();
    sheet.clearConditionalFormatRules();

    const surveyName =
      cleanText_(
        settingsData.surveyName
      );

    const reportTitle =
      cleanText_(
        settingsData.reportTitle
      )
      || surveyName + " 결과 보고";

    const dashboardTitle =
      cleanText_(
        settingsData.dashboardTitle
      )
      || surveyName + " 대시보드";

    const rows = [
      [
        "설정 항목",
        "입력 내용",
        "작성 안내"
      ],
      [
        "조사명",
        surveyName,
        "설문 및 보고서의 공식 명칭"
      ],
      [
        "보고서 제목",
        reportTitle,
        "01_조사개요 상단 제목"
      ],
      [
        "대시보드 제목",
        dashboardTitle,
        "02_대시보드 상단 제목"
      ],
      [
        "조사목적",
        cleanText_(
          settingsData.surveyPurpose
        ),
        "조사를 실시한 목적"
      ],
      [
        "조사기간",
        cleanText_(
          settingsData.surveyPeriod
        ),
        "예: 2026. 6. 9. ~ 2026. 6. 16."
      ],
      [
        "조사대상",
        cleanText_(
          settingsData.surveyTarget
        ),
        "설문 응답 대상"
      ],
      [
        "조사방법",
        cleanText_(
          settingsData.surveyMethod
        ),
        "예: 비대면(네이버 폼 활용 설문조사 시행)"
      ],
      [
        "분석방법",
        cleanText_(
          settingsData.analysisMethod
        )
        || "단일응답 빈도, 복수응답 이중 비율, 5점 척도 및 주관식 의미 범주 분석 등",
        "실제로 수행하는 분석방법"
      ],
      [
        "담당부서",
        cleanText_(
          settingsData.department
        )
        || APP_CONFIG.TEAM_NAME
        || "",
        "담당 부서명"
      ],
      [
        "문의처",
        cleanText_(
          settingsData.contact
        )
        || APP_CONFIG.SURVEY_CONTACT
        || "",
        "설문 및 보고서 문의처"
      ],
      [
        "생성기관",
        cleanText_(
          settingsData.organization
        )
        || APP_CONFIG.LIBRARY_NAME
        || "성남시중원도서관",
        "보고서 작성 기관"
      ]
    ];

    sheet
      .getRange(
        1,
        1,
        rows.length,
        3
      )
      .setValues(
        rows
      );

    sheet
      .getRange(
        1,
        1,
        1,
        3
      )
      .setBackground(
        APP_CONFIG.COLORS.NAVY
      )
      .setFontColor(
        APP_CONFIG.COLORS.WHITE
      )
      .setFontWeight(
        "bold"
      )
      .setHorizontalAlignment(
        "center"
      );

    sheet
      .getRange(
        2,
        1,
        rows.length - 1,
        1
      )
      .setBackground(
        APP_CONFIG.COLORS.LIGHT_BLUE
      )
      .setFontWeight(
        "bold"
      );

    sheet
      .getRange(
        2,
        2,
        rows.length - 1,
        1
      )
      .setBackground(
        APP_CONFIG.COLORS.YELLOW
      );

    sheet
      .getDataRange()
      .setFontFamily(
        "맑은 고딕"
      )
      .setVerticalAlignment(
        "middle"
      )
      .setWrap(
        true
      )
      .setBorder(
        true,
        true,
        true,
        true,
        true,
        true,
        APP_CONFIG.COLORS.BORDER,
        SpreadsheetApp.BorderStyle.SOLID
      );

    sheet.setFrozenRows(
      1
    );

    sheet.setColumnWidth(
      1,
      160
    );

    sheet.setColumnWidth(
      2,
      500
    );

    sheet.setColumnWidth(
      3,
      360
    );

    moveReportSheetsInOrder_();

    return {
      success: true,
      message: "조사 기본정보를 저장했습니다.",
      settings: {
        surveyName: surveyName,
        reportTitle: reportTitle,
        dashboardTitle: dashboardTitle,
        surveyPurpose:
          cleanText_(
            settingsData.surveyPurpose
          ),
        surveyPeriod:
          cleanText_(
            settingsData.surveyPeriod
          ),
        surveyTarget:
          cleanText_(
            settingsData.surveyTarget
          ),
        surveyMethod:
          cleanText_(
            settingsData.surveyMethod
          ),
        analysisMethod:
          cleanText_(
            settingsData.analysisMethod
          ),
        department:
          cleanText_(
            settingsData.department
          )
          || APP_CONFIG.TEAM_NAME
          || "",
        contact:
          cleanText_(
            settingsData.contact
          )
          || APP_CONFIG.SURVEY_CONTACT
          || "",
        organization:
          cleanText_(
            settingsData.organization
          )
          || APP_CONFIG.LIBRARY_NAME
          || ""
      }
    };

  } catch (error) {
    return {
      success: false,
      error:
        error && error.message
          ? error.message
          : String(error)
    };
  }
}


/**
 * 00_설정 시트의 조사정보를 웹페이지로 반환합니다.
 *
 * @return {Object}
 */
function getSurveySettingsForWeb() {
  try {
    const sheetName =
      APP_CONFIG.SETTINGS_SHEET
      || "00_설정";

    const sheet =
      SpreadsheetApp
        .getActiveSpreadsheet()
        .getSheetByName(
          sheetName
        );

    if (!sheet) {
      return {
        success: true,
        exists: false,
        settings: {
          surveyName: "",
          reportTitle: "",
          dashboardTitle: "",
          surveyPurpose: "",
          surveyPeriod: "",
          surveyTarget: "",
          surveyMethod:
            "비대면(네이버 폼 활용 설문조사 시행)",
          analysisMethod:
            "단일응답 빈도, 복수응답 이중 비율, 5점 척도 및 주관식 의미 범주 분석 등",
          department:
            APP_CONFIG.TEAM_NAME
            || "",
          contact:
            APP_CONFIG.SURVEY_CONTACT
            || "",
          organization:
            APP_CONFIG.LIBRARY_NAME
            || ""
        }
      };
    }

    const values =
      sheet
        .getDataRange()
        .getDisplayValues();

    const settingsMap = {};

    values
      .slice(1)
      .forEach(function(row) {
        const key =
          cleanText_(
            row[0]
          );

        const value =
          cleanText_(
            row[1]
          );

        if (key) {
          settingsMap[key] =
            value;
        }
      });

    return {
      success: true,
      exists: true,
      settings: {
        surveyName:
          settingsMap["조사명"]
          || "",

        reportTitle:
          settingsMap["보고서 제목"]
          || "",

        dashboardTitle:
          settingsMap["대시보드 제목"]
          || "",

        surveyPurpose:
          settingsMap["조사목적"]
          || "",

        surveyPeriod:
          settingsMap["조사기간"]
          || "",

        surveyTarget:
          settingsMap["조사대상"]
          || "",

        surveyMethod:
          settingsMap["조사방법"]
          || "",

        analysisMethod:
          settingsMap["분석방법"]
          || "",

        department:
          settingsMap["담당부서"]
          || APP_CONFIG.TEAM_NAME
          || "",

        contact:
          settingsMap["문의처"]
          || APP_CONFIG.SURVEY_CONTACT
          || "",

        organization:
          settingsMap["생성기관"]
          || APP_CONFIG.LIBRARY_NAME
          || ""
      }
    };

  } catch (error) {
    return {
      success: false,
      error:
        error && error.message
          ? error.message
          : String(error)
    };
  }
}
