function promptImportNaverSurvey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "네이버폼 원자료 가져오기",
    "네이버폼 Excel을 Google Drive에 업로드한 뒤 'Google 스프레드시트로 열기'를 선택하고, 열린 파일의 URL 또는 스프레드시트 ID를 입력해 주세요.",
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  try {
    const sourceId = extractSpreadsheetId_(response.getResponseText());
    if (!sourceId) throw new Error("URL 또는 스프레드시트 ID를 확인해 주세요.");
    const result = importNaverSurveyBySpreadsheetId_(sourceId);
    ui.alert("가져오기 완료",`${result.rowCount}건을 09_원자료로 가져왔습니다.\n원본 시트: ${result.sourceSheet}`,ui.ButtonSet.OK);
  } catch (error) {
    ui.alert("가져오기 실패",error.message||String(error),ui.ButtonSet.OK);
  }
}

function importNaverSurveyBySpreadsheetId_(sourceId) {
  const current = SpreadsheetApp.getActiveSpreadsheet();
  if (sourceId === current.getId()) throw new Error("현재 파일이 아닌 네이버폼 원본 파일 URL을 입력해 주세요.");

  const source = SpreadsheetApp.openById(sourceId);
  const sourceSheet = findSurveySourceSheet_(source);
  if (!sourceSheet) throw new Error("설문 원자료 컬럼을 포함한 시트를 찾지 못했습니다.");

  const values = sourceSheet.getDataRange().getDisplayValues();
  if (values.length < 2) throw new Error("원본 시트에 응답 데이터가 없습니다.");

  const standardized = standardizeSurveyRows_(values);
  const target = getOrCreateSheet_(APP_CONFIG.SOURCE_SHEET);
  removeAllCharts_(target);
  target.clear();
  target.getRange(1,1,standardized.length,APP_CONFIG.RAW_HEADERS.length).setValues(standardized);
  formatRawSheet_(target);
  moveReportSheetsInOrder_();

  return {rowCount:standardized.length-1,sourceSheet:sourceSheet.getName()};
}

function findSurveySourceSheet_(spreadsheet) {
  const required = ["이용자 유형","이용 공간·서비스(복수)","Q1 공간·시설 편의성","재이용·추천"];
  for (const sheet of spreadsheet.getSheets()) {
    if (!sheet.getLastColumn()) continue;
    const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0].map(normalizeHeader_);
    if (required.every(req=>headers.includes(normalizeHeader_(req)))) return sheet;
  }
  return null;
}

function standardizeSurveyRows_(values) {
  const sourceHeaders = values[0].map(v=>String(v||"").trim());
  const normalized = sourceHeaders.map(normalizeHeader_);
  const indexMap = {};
  APP_CONFIG.RAW_HEADERS.forEach(h=>indexMap[h]=normalized.indexOf(normalizeHeader_(h)));

  const missing = APP_CONFIG.RAW_HEADERS.slice(0,14).filter(h=>indexMap[h]===-1);
  if (missing.length) throw new Error("필수 컬럼 누락:\n- "+missing.join("\n- "));

  const output=[APP_CONFIG.RAW_HEADERS.slice()];

  values.slice(1).forEach((row,rowIndex)=>{
    const get = h => indexMap[h] >= 0 ? row[indexMap[h]] : "";
    const qTexts=[
      get("Q1 공간·시설 편의성"),get("Q2 체험·창작 공간 적합성"),
      get("Q3 콘텐츠 흥미·유익성"),get("Q4 디지털 기술 이해 도움"),
      get("Q5 직원·강사 안내"),get("Q6 전반적 만족도")
    ].map(cleanText_);

    const scores=qTexts.map((text,i)=>validScore_(get(APP_CONFIG.SCORE_HEADERS[i]))||scoreFromText_(text));
    const validScores=scores.filter(s=>s>=1&&s<=5);
    const recommendationText=cleanText_(get("재이용·추천"));
    const recommendationScore=validScore_(get("추천점수"))||scoreFromText_(recommendationText);
    const services=normalizeMultiValue_(get("이용 공간·서비스(복수)"));
    const channels=normalizeMultiValue_(get("인지 경로(복수)"));
    const improvements=normalizeMultiValue_(get("개선 필요사항(복수)"));
    const future=normalizeMultiValue_(get("향후 희망 서비스(복수)"));
    const comment=cleanText_(get("자유의견"));
    const userType=cleanText_(get("이용자 유형"));

    output.push([
      get("참여자 번호")||rowIndex+1,userType,services,channels,...qTexts,
      recommendationText,improvements,future,comment,...scores,
      validScores.length?round_(average_(validScores),2):"",
      recommendationScore||"",
      splitMultiValue_(services).length,splitMultiValue_(channels).length,
      splitMultiValue_(improvements).length,splitMultiValue_(future).length,
      normalizeUserType_(userType),isValidOpinion_(comment)?"유효":"무효"
    ]);
  });
  return output;
}

function validateRawSheetFromMenu() {
  try {
    const result=validateRawSheet_();
    SpreadsheetApp.getUi().alert("원자료 검사 완료",`응답 ${result.rowCount}건과 필수 컬럼을 확인했습니다.`,SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(error) {
    SpreadsheetApp.getUi().alert("원자료 검사 실패",error.message||String(error),SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function validateRawSheet_() {
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_CONFIG.SOURCE_SHEET);
  if (!sheet) throw new Error("09_원자료 시트가 없습니다.");
  if (sheet.getLastRow()<2) throw new Error("09_원자료에 응답 데이터가 없습니다.");
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0].map(normalizeHeader_);
  const missing=APP_CONFIG.RAW_HEADERS.filter(h=>!headers.includes(normalizeHeader_(h)));
  if (missing.length) throw new Error("누락된 컬럼:\n- "+missing.join("\n- "));
  return {rowCount:sheet.getLastRow()-1,headerCount:APP_CONFIG.RAW_HEADERS.length};
}

function formatRawSheet_(sheet) {
  const c=APP_CONFIG.COLORS;
  const rows=sheet.getLastRow(), cols=APP_CONFIG.RAW_HEADERS.length;
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,cols).setBackground(c.NAVY).setFontColor(c.WHITE)
    .setFontWeight("bold").setHorizontalAlignment("center").setWrap(true);
  if (rows>1) sheet.getRange(2,1,rows-1,cols).setVerticalAlignment("top").setWrap(true);
  sheet.autoResizeColumns(1,cols);
  [3,4,12,13].forEach(col=>sheet.setColumnWidth(col,240));
  sheet.setColumnWidth(14,320);
  sheet.getDataRange().setBorder(true,true,true,true,true,true,c.BORDER,SpreadsheetApp.BorderStyle.SOLID);
}

/**
 * ==========================================================================
 * 웹페이지용 네이버폼 Excel 업로드 처리
 * ==========================================================================
 *
 * survey-dashboard.html에서 전달한 Excel 파일을 임시로 Drive에 저장한 뒤,
 * Google 스프레드시트로 변환하고 09_원자료 시트로 가져옵니다.
 */


/**
 * 웹페이지에서 업로드한 Excel 파일을 처리합니다.
 *
 * @param {Object} fileData
 * {
 *   fileName: "설문결과.xlsx",
 *   mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 *   base64Data: "..."
 * }
 *
 * @return {Object} 처리 결과
 */
function uploadSurveyExcelFromWeb(fileData) {
  let uploadedFileId = null;
  let convertedFileId = null;

  try {
    if (!fileData || !fileData.base64Data) {
      throw new Error(
        "업로드된 Excel 파일 데이터가 없습니다."
      );
    }

    const fileName =
      cleanText_(fileData.fileName)
      || "네이버폼_설문결과.xlsx";

    const lowerFileName =
      fileName.toLowerCase();

    if (
      !lowerFileName.endsWith(".xlsx")
      && !lowerFileName.endsWith(".xls")
    ) {
      throw new Error(
        "Excel 파일(.xlsx 또는 .xls)만 업로드할 수 있습니다."
      );
    }

// 브라우저가 보내주는 flaky한 mimeType 대신, 확장자를 기준으로 정확한 MIME 타입을 강제 지정합니다.
let mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; // 기본값 (.xlsx)

if (lowerFileName.endsWith(".xls")) {
  mimeType = "application/vnd.ms-excel"; // 구형 엑셀 파일 대응
}
// ----------------------------------------------------------------------
    // 🔥 [수정] 웹용 Base64 접두어(data:...;base64,)가 있다면 안전하게 제거
    // ----------------------------------------------------------------------
    let pureBase64Data = fileData.base64Data;
    if (pureBase64Data.indexOf(",") !== -1) {
      pureBase64Data = pureBase64Data.split(",")[1];
    }
    const binaryData =
      Utilities.base64Decode(
        fileData.base64Data
      );

    const blob =
      Utilities.newBlob(
        binaryData,
        mimeType,
        fileName
      );

    // ----------------------------------------------------------------------
    // 1. 원본 Excel 파일을 Drive에 임시 저장
    // ----------------------------------------------------------------------

    const uploadedFile =
      DriveApp.createFile(
        blob
      );

    uploadedFileId =
      uploadedFile.getId();

    // ----------------------------------------------------------------------
    // 2. Excel 파일을 Google 스프레드시트로 변환
    // ----------------------------------------------------------------------

    const resource = {
      name:
        "TEMP_CONVERTED_"
        + Date.now()
        + "_"
        + fileName.replace(
          /\.(xlsx|xls)$/i,
          ""
        ),

      mimeType:
        "application/vnd.google-apps.spreadsheet"
    };

    const convertedFile =
      Drive.Files.create(
        resource,
        blob,
        {
          fields:
            "id,name,mimeType"
        }
      );

    convertedFileId =
      convertedFile.id;

    if (!convertedFileId) {
      throw new Error(
        "Excel 파일을 Google 스프레드시트로 변환하지 못했습니다."
      );
    }

    // 변환 직후 파일이 준비될 시간을 약간 기다립니다.
    Utilities.sleep(
      1500
    );

    // ----------------------------------------------------------------------
    // 3. 기존 원자료 가져오기 로직 재사용
    // ----------------------------------------------------------------------

    const importResult =
      importNaverSurveyBySpreadsheetId_(
        convertedFileId
      );

    return {
      success:
        true,

      message:
        "Excel 파일을 성공적으로 가져왔습니다.",

      fileName:
        fileName,

      rowCount:
        importResult.rowCount,

      sourceSheet:
        importResult.sourceSheet
    };

  } catch (error) {
    return {
      success:
        false,

      error:
        error && error.message
          ? error.message
          : String(error)
    };

  } finally {
    // ----------------------------------------------------------------------
    // 4. 임시 파일 정리
    // ----------------------------------------------------------------------

    if (uploadedFileId) {
      try {
        DriveApp
          .getFileById(
            uploadedFileId
          )
          .setTrashed(
            true
          );
      } catch (ignored) {
        // 임시 원본 파일 삭제 실패는 결과에 영향을 주지 않습니다.
      }
    }

    if (convertedFileId) {
      try {
        DriveApp
          .getFileById(
            convertedFileId
          )
          .setTrashed(
            true
          );
      } catch (ignored) {
        // 임시 변환 파일 삭제 실패는 결과에 영향을 주지 않습니다.
      }
    }
  }
}


/**
 * 웹페이지에서 원자료 구조를 검사합니다.
 *
 * @return {Object} 검사 결과
 */
function validateRawSheetFromWeb() {
  try {
    const result =
      validateRawSheet_();

    return {
      success:
        true,

      rowCount:
        result.rowCount,

      headerCount:
        result.headerCount,

      message:
        "응답 "
        + result.rowCount
        + "건과 필수 컬럼 "
        + result.headerCount
        + "개를 확인했습니다."
    };

  } catch (error) {
    return {
      success:
        false,

      error:
        error && error.message
          ? error.message
          : String(error)
    };
  }
}
/**
 * Google Drive 권한 승인을 위한 임시 테스트 함수
 * 권한 승인과 테스트가 끝나면 삭제해도 됩니다.
 */
function authorizeDriveAccessTest_() {
  const testBlob = Utilities.newBlob(
    "Drive 권한 테스트",
    "text/plain",
    "drive_authorization_test.txt"
  );

  const testFile = DriveApp.createFile(testBlob);

  console.log("Drive 테스트 파일 생성 성공: " + testFile.getId());

  // 테스트 파일은 바로 휴지통으로 이동
  testFile.setTrashed(true);
}
/**
 * ==========================================================================
 * 범용 설문 문항 분석용 Excel 미리보기
 * ==========================================================================
 *
 * 기존 uploadSurveyExcelFromWeb() 함수와 별도로 동작합니다.
 *
 * 이 함수는:
 * 1. Excel 파일을 임시 Google 스프레드시트로 변환하고
 * 2. 설문 응답이 가장 많아 보이는 시트를 선택한 뒤
 * 3. 문항명과 예시 응답을 추출하고
 * 4. 11_SurveyMapping.gs의 문항 유형 추천 기능을 호출합니다.
 *
 * 중요:
 * - 09_원자료를 생성하거나 수정하지 않습니다.
 * - 기존 보고서 시트도 수정하지 않습니다.
 * - 기존 Excel 업로드 기능에 영향을 주지 않습니다.
 *
 * @param {Object} fileData 웹페이지에서 전달받은 Excel 파일 정보
 * @return {Object} 문항 분석 결과
 */
function inspectSurveyExcelForMappingFromWeb(fileData) {
  let convertedFileId = null;

  try {
    // ----------------------------------------------------------------------
    // 1. 전달값 검사
    // ----------------------------------------------------------------------

    if (
      !fileData
      || !fileData.base64Data
    ) {
      throw new Error(
        "분석할 Excel 파일 데이터가 없습니다."
      );
    }

    const fileName =
      cleanText_(
        fileData.fileName
      )
      || "네이버폼_설문결과.xlsx";

    const lowerFileName =
      fileName.toLowerCase();

    if (
      !lowerFileName.endsWith(".xlsx")
      && !lowerFileName.endsWith(".xls")
    ) {
      throw new Error(
        "Excel 파일(.xlsx 또는 .xls)만 분석할 수 있습니다."
      );
    }

    // ----------------------------------------------------------------------
    // 2. Excel MIME 타입 설정
    // ----------------------------------------------------------------------

    let mimeType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    if (
      lowerFileName.endsWith(".xls")
    ) {
      mimeType =
        "application/vnd.ms-excel";
    }

    // ----------------------------------------------------------------------
    // 3. Base64 접두어 제거 및 Blob 생성
    // ----------------------------------------------------------------------

    let pureBase64Data =
      String(
        fileData.base64Data
      );

    if (
      pureBase64Data.indexOf(",") !== -1
    ) {
      pureBase64Data =
        pureBase64Data
          .split(",")
          .pop();
    }

    const binaryData =
      Utilities.base64Decode(
        pureBase64Data
      );

    const blob =
      Utilities.newBlob(
        binaryData,
        mimeType,
        fileName
      );

    // ----------------------------------------------------------------------
    // 4. Excel을 임시 Google 스프레드시트로 변환
    // ----------------------------------------------------------------------

    const resource = {
      name:
        "TEMP_SURVEY_MAPPING_"
        + Date.now()
        + "_"
        + fileName.replace(
          /\.(xlsx|xls)$/i,
          ""
        ),

      mimeType:
        "application/vnd.google-apps.spreadsheet"
    };

    const convertedFile =
      Drive.Files.create(
        resource,
        blob,
        {
          fields:
            "id,name,mimeType"
        }
      );

    convertedFileId =
      convertedFile.id;

    if (!convertedFileId) {
      throw new Error(
        "Excel 파일을 Google 스프레드시트로 변환하지 못했습니다."
      );
    }

    // 변환 파일이 준비될 시간을 잠시 기다립니다.
    Utilities.sleep(
      1200
    );

    // ----------------------------------------------------------------------
    // 5. 변환된 스프레드시트 열기
    // ----------------------------------------------------------------------

    const convertedSpreadsheet =
      SpreadsheetApp.openById(
        convertedFileId
      );

    const surveySheet =
      findBestSurveySheetForMapping_(
        convertedSpreadsheet
      );

    if (!surveySheet) {
      throw new Error(
        "설문 문항을 확인할 수 있는 시트를 찾지 못했습니다."
      );
    }

    // ----------------------------------------------------------------------
    // 6. 문항과 예시 응답 추출
    // ----------------------------------------------------------------------

    const structure =
      readSurveySheetStructureForMapping_(
        surveySheet
      );

    const mappings =
      buildSurveyQuestionMappings_(
        structure.headers,
        structure.sampleRow
      );

    const validation =
      validateSurveyMappings_(
        mappings
      );

    return {
      success:
        true,

      fileName:
        fileName,

      sheetName:
        surveySheet.getName(),

      headerRow:
        structure.headerRow,

      responseCount:
        structure.responseCount,

      questionCount:
        mappings.length,

      mappings:
        mappings,

      validation:
        validation,

      message:
        "응답 "
        + structure.responseCount
        + "건과 문항 "
        + mappings.length
        + "개를 확인했습니다."
    };

  } catch (error) {
    return {
      success:
        false,

      error:
        error && error.message
          ? error.message
          : String(error)
    };

  } finally {
    // ----------------------------------------------------------------------
    // 7. 임시 변환 파일 정리
    // ----------------------------------------------------------------------

    if (convertedFileId) {
      try {
        DriveApp
          .getFileById(
            convertedFileId
          )
          .setTrashed(
            true
          );

      } catch (ignored) {
        // 임시 파일 삭제 실패는 문항 분석 결과에 영향을 주지 않습니다.
      }
    }
  }
}


/**
 * 변환된 Excel에서 설문 응답 시트로 보이는 시트를 찾습니다.
 *
 * 기준:
 * - 데이터가 최소 2행 이상 있어야 합니다.
 * - 컬럼이 최소 2개 이상 있어야 합니다.
 * - 응답 행 수가 가장 많은 시트를 우선 선택합니다.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @return {GoogleAppsScript.Spreadsheet.Sheet|null}
 */
function findBestSurveySheetForMapping_(
  spreadsheet
) {
  const candidates =
    spreadsheet
      .getSheets()
      .filter(function(sheet) {
        return (
          sheet.getLastRow() >= 2
          && sheet.getLastColumn() >= 2
        );
      });

  if (
    candidates.length === 0
  ) {
    return null;
  }

  candidates.sort(function(a, b) {
    const aResponseCount =
      Math.max(
        a.getLastRow() - 1,
        0
      );

    const bResponseCount =
      Math.max(
        b.getLastRow() - 1,
        0
      );

    return (
      bResponseCount
      - aResponseCount
    );
  });

  return candidates[0];
}


/**
 * 설문 시트에서 헤더 행과 예시 응답을 읽습니다.
 *
 * 네이버폼 Excel은 일반적으로 첫 행이 헤더이지만,
 * 위쪽에 빈 행이나 제목 행이 있을 경우를 대비하여
 * 상단 10개 행 안에서 헤더 후보를 찾습니다.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @return {Object}
 */
function readSurveySheetStructureForMapping_(
  sheet
) {
  const lastRow =
    sheet.getLastRow();

  const lastColumn =
    sheet.getLastColumn();

  if (
    lastRow < 2
    || lastColumn < 2
  ) {
    throw new Error(
      "선택된 시트에 분석할 응답 데이터가 없습니다."
    );
  }

  const searchRowCount =
    Math.min(
      lastRow,
      10
    );

  const topRows =
    sheet
      .getRange(
        1,
        1,
        searchRowCount,
        lastColumn
      )
      .getDisplayValues();

  let headerRowIndex = -1;

  for (
    let rowIndex = 0;
    rowIndex < topRows.length;
    rowIndex++
  ) {
    const nonEmptyCount =
      topRows[rowIndex]
        .filter(function(value) {
          return (
            cleanText_(value) !== ""
          );
        })
        .length;

    if (
      nonEmptyCount >= 2
    ) {
      headerRowIndex =
        rowIndex;

      break;
    }
  }

  if (
    headerRowIndex === -1
  ) {
    throw new Error(
      "설문 문항 헤더 행을 찾지 못했습니다."
    );
  }

  const headerRow =
    headerRowIndex + 1;

  const headers =
    topRows[headerRowIndex]
      .map(function(value) {
        return cleanText_(value);
      });

  let sampleRow =
    new Array(
      lastColumn
    ).fill("");

  if (
    lastRow > headerRow
  ) {
    sampleRow =
      sheet
        .getRange(
          headerRow + 1,
          1,
          1,
          lastColumn
        )
        .getDisplayValues()[0];
  }

  return {
    headerRow:
      headerRow,

    headers:
      headers,

    sampleRow:
      sampleRow,

    responseCount:
      Math.max(
        lastRow - headerRow,
        0
      )
  };
}
/**
 * 선택한 네이버폼 Excel 원본을
 * 09_범용원자료 시트에 그대로 저장합니다.
 *
 * 기존 09_원자료는 수정하지 않습니다.
 *
 * @param {Object} fileData 웹페이지에서 전달한 Excel 파일
 * @return {Object} 처리 결과
 */
function createGenericRawSheetFromWeb(fileData) {
  let convertedFileId = null;

  try {
    if (!fileData || !fileData.base64Data) {
      throw new Error("업로드된 Excel 파일이 없습니다.");
    }

    const spreadsheet =
      SpreadsheetApp.getActiveSpreadsheet();

    // 문항 유형을 먼저 저장했는지 확인합니다.
    const mappingSheet =
      spreadsheet.getSheetByName("10_문항매핑");

    if (!mappingSheet || mappingSheet.getLastRow() < 2) {
      throw new Error(
        "먼저 문항 구조를 확인하고 문항 분석 유형을 저장해 주세요."
      );
    }

    const fileName =
      cleanText_(fileData.fileName)
      || "네이버폼_설문결과.xlsx";

    const lowerFileName =
      fileName.toLowerCase();

    if (
      !lowerFileName.endsWith(".xlsx")
      && !lowerFileName.endsWith(".xls")
    ) {
      throw new Error(
        "Excel 파일(.xlsx 또는 .xls)만 사용할 수 있습니다."
      );
    }

    const mimeType =
      lowerFileName.endsWith(".xls")
        ? "application/vnd.ms-excel"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    let pureBase64Data =
      String(fileData.base64Data);

    if (pureBase64Data.includes(",")) {
      pureBase64Data =
        pureBase64Data.split(",").pop();
    }

    const blob =
      Utilities.newBlob(
        Utilities.base64Decode(pureBase64Data),
        mimeType,
        fileName
      );

    // Excel을 임시 Google 스프레드시트로 변환합니다.
    const convertedFile =
      Drive.Files.create(
        {
          name: "TEMP_GENERIC_RAW_" + Date.now(),
          mimeType:
            "application/vnd.google-apps.spreadsheet"
        },
        blob,
        {
          fields: "id"
        }
      );

    convertedFileId =
      convertedFile.id;

    if (!convertedFileId) {
      throw new Error(
        "Excel 파일 변환에 실패했습니다."
      );
    }

    Utilities.sleep(1200);

    const sourceSpreadsheet =
      SpreadsheetApp.openById(
        convertedFileId
      );

    // 응답 데이터가 가장 많은 시트를 선택합니다.
    const sourceSheet =
      sourceSpreadsheet
        .getSheets()
        .filter(function(sheet) {
          return (
            sheet.getLastRow() >= 2
            && sheet.getLastColumn() >= 2
          );
        })
        .sort(function(a, b) {
          return (
            b.getLastRow()
            - a.getLastRow()
          );
        })[0];

    if (!sourceSheet) {
      throw new Error(
        "설문 응답 시트를 찾지 못했습니다."
      );
    }

    const values =
      sourceSheet
        .getDataRange()
        .getDisplayValues();

    const targetSheetName =
      "09_범용원자료";

    let targetSheet =
      spreadsheet.getSheetByName(
        targetSheetName
      );

    if (!targetSheet) {
      targetSheet =
        spreadsheet.insertSheet(
          targetSheetName
        );
    }

// 기존 시트에 병합 셀이 남아 있을 경우를 대비하여
// 전체 병합을 해제한 뒤 내용을 초기화합니다.
targetSheet
  .getRange(
    1,
    1,
    targetSheet.getMaxRows(),
    targetSheet.getMaxColumns()
  )
  .breakApart();

targetSheet.clear();
removeAllCharts_(targetSheet);

    targetSheet
      .getRange(
        1,
        1,
        values.length,
        values[0].length
      )
      .setValues(values);

    // 기본 서식
    targetSheet.setFrozenRows(1);

    targetSheet
      .getRange(
        1,
        1,
        1,
        values[0].length
      )
      .setBackground("#1b365d")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setWrap(true);

    if (values.length > 1) {
      targetSheet
        .getRange(
          2,
          1,
          values.length - 1,
          values[0].length
        )
        .setVerticalAlignment("top")
        .setWrap(true);
    }

    targetSheet.autoResizeColumns(
      1,
      values[0].length
    );

    return {
      success: true,
      sheetName: targetSheetName,
      sourceSheet: sourceSheet.getName(),
      rowCount: values.length - 1,
      columnCount: values[0].length,
      message:
        "09_범용원자료 시트에 응답 "
        + (values.length - 1)
        + "건과 문항 "
        + values[0].length
        + "개를 저장했습니다."
    };

  } catch (error) {
    return {
      success: false,
      error:
        error && error.message
          ? error.message
          : String(error)
    };

  } finally {
    if (convertedFileId) {
      try {
        DriveApp
          .getFileById(convertedFileId)
          .setTrashed(true);
      } catch (ignored) {
        // 임시 파일 삭제 실패는 무시합니다.
      }
    }
  }
}
