/** Dynamic survey Excel inspection and generic raw-sheet creation. */

function inspectSurveyExcelForMappingFromWeb(fileData, options) {
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
    validateSurveyExcelBinary_(binaryData, lowerFileName);

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

    // 규칙 엔진 결과를 안전망으로 유지하면서 Column Profile을 Gemini에
    // 전달합니다. Gemini 호출이나 검증이 실패하면 이 함수 내부에서
    // 기존 규칙 기반 매핑으로 정상 복구합니다.
    const ruleOnly = options && options.ruleOnly === true;
    const ruleMappings = buildSurveyQuestionMappings_(structure.headers, structure.sampleRow);
    const mappingResult = ruleOnly
      ? {mappings: ruleMappings, surveyStructure: {title: "", description: "",
          respondentColumnNumber: null, confidence: 0, reason: ""}, mappingSource: "RULE",
          fallbackUsed: false, fallbackReason: "", aiWarnings: []}
      : buildSurveyQuestionMappingsWithAI_(structure.headers, structure.sampleRow, structure.responseRows);

    const mappings =
      mappingResult.mappings;

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

      surveyStructure:
        mappingResult.surveyStructure,

      mappingSource:
        mappingResult.mappingSource,

      fallbackUsed:
        mappingResult.fallbackUsed,

      fallbackReason:
        mappingResult.fallbackReason,

      aiWarnings:
        mappingResult.aiWarnings || [],

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

  // 프로파일 통계는 실행 시간과 개인정보 노출을 제한하기 위해 최대
  // 200개 응답만 읽습니다. Gemini에는 이 중 열별 최대 3개 샘플만
  // 마스킹하여 전달합니다.
  const profileRowCount =
    Math.min(
      Math.max(lastRow - headerRow, 0),
      200
    );

  const responseRows =
    profileRowCount > 0
      ? sheet
          .getRange(
            headerRow + 1,
            1,
            profileRowCount,
            lastColumn
          )
          .getDisplayValues()
      : [];

  return {
    headerRow:
      headerRow,

    headers:
      headers,

    sampleRow:
      sampleRow,

    responseRows:
      responseRows,

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
    const mappingSheet = spreadsheet.getSheetByName(DYNAMIC_SURVEY_CONFIG.SHEETS.MAPPING)
      || spreadsheet.getSheetByName(DYNAMIC_SURVEY_CONFIG.SHEETS.LEGACY_MAPPING);

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
        validateSurveyExcelBase64_(pureBase64Data, lowerFileName),
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

    if (values.length > 20001 || values[0].length > 300
        || values.length * values[0].length > 2000000) {
      throw new Error("설문 데이터가 처리 한도를 초과했습니다(최대 20,000행, 300열, 2,000,000셀).");
    }
    const normalizedHeaders = {};
    values[0].forEach(function(header, index) {
      const normalized = normalizeHeader_(header);
      if (!normalized) throw new Error((index + 1) + "번 열의 헤더가 비어 있습니다.");
      if (normalizedHeaders[normalized]) throw new Error("중복 문항 헤더가 있습니다: " + cleanText_(header));
      normalizedHeaders[normalized] = true;
    });
    const nonEmptyValues = [values[0]].concat(values.slice(1).filter(function(row) {
      return row.some(function(value) { return cleanText_(value) !== ""; });
    }));

    const targetSheetName = DYNAMIC_SURVEY_CONFIG.SHEETS.RAW;

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
        nonEmptyValues.length,
        nonEmptyValues[0].length
      )
      .setValues(nonEmptyValues);
    targetSheet.getRange(1, 1).setNote(JSON.stringify({
      sourceFileName: fileName, sourceSheetName: sourceSheet.getName(), importedAt: new Date().toISOString(),
      blankRowsRemoved: values.length - nonEmptyValues.length
    }));

    // 기본 서식
    targetSheet.setFrozenRows(1);
    if (targetSheet.getFilter()) targetSheet.getFilter().remove();
    targetSheet.getRange(1,1,nonEmptyValues.length,nonEmptyValues[0].length).createFilter();
    targetSheet.getBandings().forEach(function(banding){banding.remove();});
    targetSheet.getRange(1,1,nonEmptyValues.length,nonEmptyValues[0].length)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY,true,false);

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
    const savedMappings=getSavedSurveyMappingsFromWeb();
    if(savedMappings.success&&savedMappings.exists){
      targetSheet.showColumns(1,targetSheet.getMaxColumns());
      savedMappings.mappings.filter(function(mapping){return mapping.selectedType==="PERSONAL_INFO";})
        .forEach(function(mapping){if(mapping.columnNumber<=targetSheet.getMaxColumns())targetSheet.hideColumns(mapping.columnNumber);});
    }

    return {
      success: true,
      sheetName: targetSheetName,
      sourceSheet: sourceSheet.getName(),
      rowCount: nonEmptyValues.length - 1,
      columnCount: values[0].length,
      message:
        targetSheetName + " 시트에 응답 "
        + (nonEmptyValues.length - 1)
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

function validateSurveyExcelBase64_(pureBase64Data, lowerFileName) {
  const encoded = String(pureBase64Data || "").replace(/\s/g, "");
  if (!encoded) throw new Error("Excel 파일 데이터가 비어 있습니다.");
  if (encoded.length > 16 * 1024 * 1024) {
    throw new Error("업로드 파일이 너무 큽니다. 최대 12MB의 Excel 파일만 지원합니다.");
  }
  let bytes;
  try { bytes = Utilities.base64Decode(encoded); }
  catch (ignored) { throw new Error("Excel 파일의 Base64 데이터가 올바르지 않습니다."); }
  if (bytes.length > 12 * 1024 * 1024) {
    throw new Error("업로드 파일이 너무 큽니다. 최대 12MB의 Excel 파일만 지원합니다.");
  }
  validateSurveyExcelBinary_(bytes, lowerFileName);
  return bytes;
}

function validateSurveyExcelBinary_(bytes, lowerFileName) {
  if (!bytes || bytes.length < 8) throw new Error("Excel 파일이 비어 있거나 손상되었습니다.");
  const unsigned = function(index) { return (Number(bytes[index]) + 256) % 256; };
  const isXlsx = unsigned(0) === 0x50 && unsigned(1) === 0x4B;
  const isXls = unsigned(0) === 0xD0 && unsigned(1) === 0xCF
    && unsigned(2) === 0x11 && unsigned(3) === 0xE0;
  if ((lowerFileName.endsWith(".xlsx") && !isXlsx)
      || (lowerFileName.endsWith(".xls") && !isXls)) {
    throw new Error("파일 확장자와 실제 Excel 파일 형식이 일치하지 않습니다.");
  }
}
