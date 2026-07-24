/**
 * ==========================================================================
 * 성남시중원도서관 AI 홍보 비서 및 만족도 조사 자동화 시스템
 * 공통 유틸리티
 * ==========================================================================
 */


// ==========================================================================
// 시트 생성 및 초기화
// ==========================================================================

function removeAllCharts_(sheet) {
  sheet
    .getCharts()
    .forEach(function(chart) {
      sheet.removeChart(chart);
    });
}


// ==========================================================================
// 보고서 공통 서식
// ==========================================================================

// ==========================================================================
// 스프레드시트 URL 처리
// ==========================================================================

// ==========================================================================
// 문자열 정리
// ==========================================================================

function normalizeHeader_(value) {
  return String(
    value
    || ""
  )
    .replace(
      /\u00A0/g,
      " "
    )
    .replace(
      /\r?\n/g,
      ""
    )
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /ㆍ/g,
      "·"
    )
    .trim()
    .toLowerCase();
}


function cleanText_(value) {
  return String(
    value === null
    || value === undefined
      ? ""
      : value
  )
    .replace(
      /\u00A0/g,
      " "
    )
    .replace(
      /\r\n/g,
      "\n"
    )
    .replace(
      /\r/g,
      "\n"
    )
    .trim();
}


/**
 * Dynamic Survey 원문에서 AI·품질검사에 전달할 개인정보를 비식별 처리합니다.
 * 빈 값과 개인정보가 아닌 문자열은 그대로 유지합니다.
 *
 * @param {*} value 원본 문자열
 * @return {string} 비식별 처리된 문자열
 */
function maskDynamicPersonalInfo_(value) {
  let text = cleanText_(value);

  if (!text) {
    return "";
  }

  text = text.replace(
    /\b(0\d{1,2})[-\s]?\d{3,4}[-\s]?(\d{4})\b/g,
    "$1-****-$2"
  );

  text = text.replace(
    /\b([A-Z0-9])[A-Z0-9._%+-]*@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
    "$1***@$2"
  );

  text = text.replace(
    /\b(\d{6})[-\s]?[1-4]\d{6}\b/g,
    "$1-*******"
  );

  text = text.replace(
    /((?:이름|성명)\s*[:：]?\s*)([가-힣])([가-힣]+)([가-힣])/g,
    "$1$2*$4"
  );

  if (/^[가-힣]{3}$/.test(text)) {
    text = text.charAt(0) + "*" + text.charAt(2);
  }

  return text;
}


/**
 * 정규식 특수문자를 안전하게 이스케이프합니다.
 */
function escapeRegex_(value) {
  return String(
    value
    || ""
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}


// ==========================================================================
// 복수응답 처리
// ==========================================================================

// ==========================================================================
// 점수 변환
// ==========================================================================

// ==========================================================================
// 이용자 유형 정규화
// ==========================================================================

// ==========================================================================
// 주관식 유효성 및 개인정보 마스킹
// ==========================================================================

// ==========================================================================
// 수학 함수
// ==========================================================================

function round_(
  number,
  digits
) {
  const decimalPlaces =
    Number(
      digits
      || 0
    );


  const factor =
    Math.pow(
      10,
      decimalPlaces
    );


  return Math.round(
    (
      Number(
        number
        || 0
      )
      + Number.EPSILON
    )
    * factor
  ) / factor;
}


// Shared dynamic-survey settings persistence.
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

    const spreadsheet =
      SpreadsheetApp.getActiveSpreadsheet();

    let sheet =
      spreadsheet.getSheetByName(
        sheetName
      );

    if (!sheet) {
      sheet =
        spreadsheet.insertSheet(
          sheetName
        );
    }

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
