/**
 * ==========================================================================
 * 성남시중원도서관 AI 홍보 비서 및 만족도 조사 자동화 시스템
 * 공통 유틸리티
 * ==========================================================================
 */


// ==========================================================================
// 시트 생성 및 초기화
// ==========================================================================

function getOrCreateSheet_(name) {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  return (
    spreadsheet.getSheetByName(name)
    || spreadsheet.insertSheet(name)
  );
}


function resetSheet_(name) {
  const sheet =
    getOrCreateSheet_(name);

  removeAllCharts_(sheet);

  const dataRange =
    sheet.getDataRange();

  if (dataRange) {
    dataRange.breakApart();
  }

  sheet.clear();
  sheet.clearConditionalFormatRules();

  return sheet;
}


function removeAllCharts_(sheet) {
  sheet
    .getCharts()
    .forEach(function(chart) {
      sheet.removeChart(chart);
    });
}


/**
 * 보고서 시트를 APP_CONFIG.REPORT_SHEETS 순서대로 정렬합니다.
 *
 * 00_설정 시트는 별도 관리하므로 REPORT_SHEETS에 포함하지 않아도 됩니다.
 */
function moveReportSheetsInOrder_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  let targetPosition = 1;

  const settingsSheetName =
    APP_CONFIG.SETTINGS_SHEET
    || "00_설정";

  const settingsSheet =
    spreadsheet.getSheetByName(
      settingsSheetName
    );

  if (settingsSheet) {
    spreadsheet.setActiveSheet(
      settingsSheet
    );

    spreadsheet.moveActiveSheet(
      1
    );

    targetPosition = 2;
  }


  APP_CONFIG.REPORT_SHEETS
    .forEach(function(name) {
      const sheet =
        spreadsheet.getSheetByName(
          name
        );

      if (!sheet) {
        return;
      }

      spreadsheet.setActiveSheet(
        sheet
      );

      spreadsheet.moveActiveSheet(
        targetPosition
      );

      targetPosition++;
    });
}


// ==========================================================================
// 보고서 공통 서식
// ==========================================================================

function title_(
  sheet,
  rangeA1,
  text
) {
  const range =
    sheet.getRange(
      rangeA1
    );

  range.breakApart();

  range
    .merge()
    .setValue(
      text
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
    .setFontSize(
      16
    )
    .setHorizontalAlignment(
      "center"
    )
    .setVerticalAlignment(
      "middle"
    )
    .setWrap(
      true
    );

  sheet.setRowHeights(
    1,
    2,
    32
  );
}


function styleHeader_(range) {
  range
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
    )
    .setVerticalAlignment(
      "middle"
    )
    .setWrap(
      true
    );
}


function finishReportSheet_(
  sheet,
  lastRow,
  lastColumn
) {
  const actualLastRow =
    Math.max(
      Number(lastRow) || 1,
      sheet.getLastRow()
    );

  const actualLastColumn =
    Math.max(
      Number(lastColumn) || 1,
      sheet.getLastColumn()
    );


  const range =
    sheet.getRange(
      1,
      1,
      actualLastRow,
      actualLastColumn
    );


  range
    .setFontFamily(
      "맑은 고딕"
    )
    .setVerticalAlignment(
      "middle"
    );


  range.setBorder(
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
    2
  );
}


// ==========================================================================
// 스프레드시트 URL 처리
// ==========================================================================

function extractSpreadsheetId_(input) {
  const value =
    cleanText_(
      input
    );

  if (!value) {
    return "";
  }


  const urlMatch =
    value.match(
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/
    );


  if (urlMatch) {
    return urlMatch[1];
  }


  return /^[a-zA-Z0-9-_]{20,}$/.test(value)
    ? value
    : "";
}


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

function normalizeMultiValue_(value) {
  return splitMultiValue_(
    value
  ).join("|");
}


/**
 * 복수응답 문자열을 배열로 분리합니다.
 *
 * 우선순위:
 * 1. | 기호
 * 2. 줄바꿈
 * 3. 세미콜론
 * 4. 괄호 밖의 쉼표
 *
 * 예:
 * 인터넷(도서관 홈페이지, 배움숲 등)
 * 위 선택지는 하나의 항목으로 유지됩니다.
 */
function splitMultiValue_(value) {
  const text =
    cleanText_(
      value
    );

  if (!text) {
    return [];
  }


  let items;


  if (
    text.includes("|")
  ) {
    items =
      text.split(
        /\s*\|\s*/
      );

  } else if (
    /\n/.test(text)
  ) {
    items =
      text.split(
        /\s*\n+\s*/
      );

  } else if (
    text.includes(";")
  ) {
    items =
      text.split(
        /\s*;\s*/
      );

  } else {
    items =
      splitByCommaOutsideParentheses_(
        text
      );
  }


  return items
    .map(
      cleanText_
    )
    .filter(
      Boolean
    )
    .filter(function(
      item,
      index,
      array
    ) {
      return (
        array.indexOf(item)
        === index
      );
    });
}


/**
 * 괄호 밖에 있는 쉼표만 구분자로 처리합니다.
 */
function splitByCommaOutsideParentheses_(
  text
) {
  const result = [];

  let buffer = "";
  let depth = 0;


  for (
    let index = 0;
    index < text.length;
    index++
  ) {
    const character =
      text[index];


    if (
      character === "("
      || character === "（"
    ) {
      depth++;

      buffer +=
        character;

      continue;
    }


    if (
      character === ")"
      || character === "）"
    ) {
      depth =
        Math.max(
          0,
          depth - 1
        );

      buffer +=
        character;

      continue;
    }


    if (
      character === ","
      && depth === 0
    ) {
      if (
        buffer.trim()
      ) {
        result.push(
          buffer.trim()
        );
      }

      buffer = "";

      continue;
    }


    buffer +=
      character;
  }


  if (
    buffer.trim()
  ) {
    result.push(
      buffer.trim()
    );
  }


  return result;
}


// ==========================================================================
// 점수 변환
// ==========================================================================

function validScore_(value) {
  const number =
    Number(
      value
    );

  return (
    number >= 1
    && number <= 5
  )
    ? number
    : 0;
}


function scoreFromText_(value) {
  const text =
    cleanText_(
      value
    )
      .replace(
        /^\s*\d+\)\s*/,
        ""
      )
      .replace(
        /⑤/g,
        "5"
      )
      .replace(
        /④/g,
        "4"
      )
      .replace(
        /③/g,
        "3"
      )
      .replace(
        /②/g,
        "2"
      )
      .replace(
        /①/g,
        "1"
      );


  const directNumber =
    Number(
      text
    );


  if (
    directNumber >= 1
    && directNumber <= 5
  ) {
    return directNumber;
  }


  if (
    /매우\s*(그렇다|그러함|만족)/.test(
      text
    )
  ) {
    return 5;
  }


  if (
    /전혀\s*(그렇지\s*않다|그렇지\s*않음|불만족)/.test(
      text
    )
  ) {
    return 1;
  }


  if (
    /그렇지\s*않다|그렇지\s*않음|불만족/.test(
      text
    )
  ) {
    return 2;
  }


  if (
    /보통/.test(
      text
    )
  ) {
    return 3;
  }


  if (
    /그렇다|그러함|만족/.test(
      text
    )
  ) {
    return 4;
  }


  const numberMatch =
    text.match(
      /(?:^|\D)([1-5])(?:\D|$)/
    );


  return numberMatch
    ? Number(
        numberMatch[1]
      )
    : 0;
}


// ==========================================================================
// 이용자 유형 정규화
// ==========================================================================

function normalizeUserType_(value) {
  const text =
    cleanText_(
      value
    )
      .replace(
        /^\s*\d+\)\s*/,
        ""
      );


  if (
    !text
  ) {
    return "미응답";
  }


  if (
    /일반/.test(
      text
    )
  ) {
    return "일반 이용자";
  }


  if (
    /프로그램/.test(
      text
    )
  ) {
    return "프로그램 참여자";
  }


  if (
    /어린이.*보호자|보호자/.test(
      text
    )
  ) {
    return "어린이 보호자";
  }


  if (
    /기관.*담당|인솔/.test(
      text
    )
  ) {
    return "기관 담당자 또는 인솔자";
  }


  if (
    /청소년/.test(
      text
    )
  ) {
    return "청소년";
  }


  if (
    /기타/.test(
      text
    )
  ) {
    return text;
  }


  return text;
}


// ==========================================================================
// 주관식 유효성 및 개인정보 마스킹
// ==========================================================================

function isValidOpinion_(value) {
  const text =
    cleanText_(
      value
    );


  if (!text) {
    return false;
  }


  const compactText =
    text
      .replace(
        /\s+/g,
        ""
      )
      .toLowerCase();


  const invalidValues = [
    "없음",
    "없습니다",
    "해당없음",
    "모름",
    "잘모르겠습니다",
    "특이사항없음",
    "의견없음",
    "-",
    ".",
    "x",
    "없어요"
  ];


  return (
    !invalidValues.includes(
      compactText
    )
    && text.length >= 2
  );
}


/**
 * 자유의견을 AI에 전달하기 전에 전화번호와 이메일을 마스킹합니다.
 */
function maskPersonalInfo_(
  value
) {
  return cleanText_(
    value
  )
    .replace(
      /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g,
      "[전화번호 비식별 처리]"
    )
    .replace(
      /\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/g,
      "[전화번호 비식별 처리]"
    )
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[이메일 비식별 처리]"
    );
}


// ==========================================================================
// 수학 함수
// ==========================================================================

function average_(numbers) {
  if (
    !Array.isArray(numbers)
    || numbers.length === 0
  ) {
    return 0;
  }


  return numbers.reduce(
    function(sum, number) {
      return (
        sum
        + Number(
          number
          || 0
        )
      );
    },
    0
  ) / numbers.length;
}


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
