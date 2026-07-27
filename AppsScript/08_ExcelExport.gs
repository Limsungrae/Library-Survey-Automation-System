/** Dynamic survey XLSX export. */

function buildReportFileName_() {
  const date =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyyMMdd"
    );


  let surveyName =
    "만족도조사";


  try {
    const settings =
      getSurveySettings_();

    surveyName =
      settings["조사명"]
      || surveyName;

  } catch (ignored) {
    // 00_설정 시트를 읽지 못하면 기본 명칭을 사용합니다.
  }


  const normalizedSurveyName =
    sanitizeFileName_(
      surveyName
    )
      .replace(
        /\s+/g,
        "_"
      )
      .replace(
        /_+/g,
        "_"
      );


  return (
    date
    + "_"
    + normalizedSurveyName
    + "_결과보고.xlsx"
  );
}


/**
 * 파일명에 사용할 수 없는 문자를 제거합니다.
 */
function sanitizeFileName_(
  value
) {
  let fileName =
    String(
      value || ""
    )
      .trim()
      .replace(
        /[\\/:*?"<>|]/g,
        "_"
      )
      .replace(
        /\s+/g,
        " "
      );


  if (!fileName) {
    fileName =
      "만족도조사_결과보고.xlsx";
  }


  const extension=fileName.toLowerCase().endsWith(".xlsx")?".xlsx":"";
  const base=extension?fileName.substring(0,fileName.length-extension.length):fileName;
  return base.substring(0,120)+extension;
}
/**
 * ==========================================================================
 * 범용 만족도 조사 보고서 Excel 내보내기
 * ==========================================================================
 *
 * 최종 Excel에 포함하는 시트:
 * - 01_조사개요
 * - 02_대시보드
 * - 03_응답자특성
 * - 04_단일응답분석
 * - 05_복수응답분석
 * - 06_척도분석
 * - 07_추천의향분석
 * - 08_주관식분석
 * - 09_AI총평       : 존재할 때만 포함
 * - 10_향후계획     : 존재할 때만 포함
 * - 11_범용원자료
 *
 * 제외하는 내부 관리 시트:
 * - 00_설정
 * - 12_문항매핑
 * - AI 홍보 비서용 시트
 */


/**
 * 범용 보고서의 시트 순서를 반환합니다.
 *
 * 전역 상수로 선언하지 않아 다른 파일과의 중복 선언을 방지합니다.
 *
 * @return {Array<string>}
 */
function getDynamicExportSheetNames_() {
  return [
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
    "11_범용원자료"
  ];
}


/**
 * 범용 보고서를 Excel 파일로 생성하고 Google Drive에 저장합니다.
 *
 * 웹페이지와 스프레드시트 메뉴에서 공통으로 사용할 수 있는
 * 실제 처리 함수입니다.
 *
 * @param {string} requestedFileName 사용자가 입력한 파일명
 * @return {Object} 생성된 파일 정보
 */
function createDynamicSurveyReportXlsx_(
  requestedFileName,
  options
) {
  let temporarySpreadsheet = null;

  try {
    const sourceSpreadsheet =
      SpreadsheetApp.getActiveSpreadsheet();

    const configuredSheets =
      getDynamicExportSheetNames_();


    // ----------------------------------------------------------------------
    // 반드시 존재해야 하는 범용 통계 보고서 시트
    // ----------------------------------------------------------------------

    const requiredSheets = [
      "01_조사개요",
      "00_품질검사",
      "02_대시보드",
      "03_응답자특성",
      "04_단일응답분석",
      "05_복수응답분석",
      "06_척도분석",
      "07_추천의향분석",
      "08_주관식분석",
      "11_범용원자료"
    ];


    const missingSheets =
      requiredSheets.filter(function(sheetName) {
        return !sourceSpreadsheet.getSheetByName(
          sheetName
        );
      });


    if (missingSheets.length > 0) {
      throw new Error(
        "다음 범용 보고서 시트가 없습니다.\n\n- "
        + missingSheets.join("\n- ")
        + "\n\n먼저 범용 통계 보고서를 생성해 주세요."
      );
    }

    const qualitySheet=sourceSpreadsheet.getSheetByName(DYNAMIC_SURVEY_CONFIG.SHEETS.QUALITY);
    if(qualitySheet&&qualitySheet.getRange("B5").getDisplayValue()==="FAIL"&&!(options&&options.force===true)){
      throw new Error("품질검사 실패 상태에서는 기본 내보내기를 차단합니다. 오류를 수정하거나 관리자 강제 내보내기를 사용하세요.");
    }


    // AI 시트는 아직 생성 전일 수 있으므로
    // 실제 존재하는 시트만 최종 파일에 포함합니다.
    const exportSheets =
      configuredSheets.filter(function(sheetName) {
        return Boolean(
          sourceSpreadsheet.getSheetByName(
            sheetName
          )
        );
      });


    // ----------------------------------------------------------------------
    // 파일명 설정
    // ----------------------------------------------------------------------

    let fileName =
      cleanText_(
        requestedFileName
      )
      || buildReportFileName_();


    if (
      !fileName
        .toLowerCase()
        .endsWith(".xlsx")
    ) {
      fileName += ".xlsx";
    }


    fileName =
      sanitizeFileName_(
        fileName
      );


    // ----------------------------------------------------------------------
    // 임시 스프레드시트 생성
    // ----------------------------------------------------------------------

    temporarySpreadsheet =
      SpreadsheetApp.create(
        "TEMP_DYNAMIC_SURVEY_REPORT_"
        + Date.now()
      );


    // 보고서 시트를 정해진 순서대로 복사합니다.
    exportSheets.forEach(function(sheetName) {
      const sourceSheet =
        sourceSpreadsheet.getSheetByName(
          sheetName
        );

      const copiedSheet =
        sourceSheet.copyTo(
          temporarySpreadsheet
        );

      copiedSheet.setName(
        sheetName
      );
    });


    // 임시 스프레드시트의 기본 시트 등 불필요한 시트를 삭제합니다.
    temporarySpreadsheet
      .getSheets()
      .forEach(function(sheet) {
        if (
          !exportSheets.includes(
            sheet.getName()
          )
        ) {
          temporarySpreadsheet.deleteSheet(
            sheet
          );
        }
      });


    // 복사된 시트 순서를 최종 보고서 순서로 정리합니다.
    exportSheets.forEach(function(
      sheetName,
      index
    ) {
      const sheet =
        temporarySpreadsheet.getSheetByName(
          sheetName
        );

      if (!sheet) {
        return;
      }

      temporarySpreadsheet.setActiveSheet(
        sheet
      );

      temporarySpreadsheet.moveActiveSheet(
        index + 1
      );
    });

    // Google Sheets 전용 수식은 임시 사본에서만 제거합니다.
    // 원본 보고서의 SPARKLINE 보조열과 통계 숫자는 변경하지 않습니다.
    const compatibilityResult =
      prepareDynamicSpreadsheetForXlsx_(
        temporarySpreadsheet,
        options
      );

    assertDynamicSpreadsheetXlsxCompatible_(
      temporarySpreadsheet
    );

    console.log(
      "Dynamic XLSX 호환성 정리 완료: "
      + JSON.stringify(compatibilityResult)
    );


    SpreadsheetApp.flush();

    // 차트와 서식이 반영될 시간을 확보합니다.
    Utilities.sleep(1500);


    // ----------------------------------------------------------------------
    // Google 스프레드시트를 XLSX로 변환
    // ----------------------------------------------------------------------

    const exportUrl =
      "https://docs.google.com/spreadsheets/d/"
      + temporarySpreadsheet.getId()
      + "/export"
      + "?format=xlsx"
      + "&exportFormat=xlsx";


    const exportResponse =
      UrlFetchApp.fetch(
        exportUrl,
        {
          method: "get",

          headers: {
            Authorization:
              "Bearer "
              + ScriptApp.getOAuthToken()
          },

          muteHttpExceptions: true
        }
      );


    const responseCode =
      exportResponse.getResponseCode();


    if (responseCode !== 200) {
      throw new Error(
        "범용 보고서 Excel 변환에 실패했습니다.\n"
        + "HTTP 상태코드: "
        + responseCode
        + "\n"
        + exportResponse
            .getContentText()
            .substring(0, 500)
      );
    }


    let excelBlob =
      exportResponse
        .getBlob()
        .setName(
          fileName
        )
        .setContentType(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
    if(excelBlob.getBytes().length===0)throw new Error("생성된 Excel 파일이 비어 있습니다.");

    excelBlob = applyDynamicXlsxPrintLayout_(excelBlob, exportSheets)
      .setName(fileName)
      .setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    assertDynamicXlsxBlobCompatible_(
      excelBlob
    );


    // ----------------------------------------------------------------------
    // 최종 Excel 파일을 Google Drive에 저장
    // ----------------------------------------------------------------------

    const savedFile =
      DriveApp.createFile(
        excelBlob
      );


    return {
      success: true,

      fileId:
        savedFile.getId(),

      fileName:
        savedFile.getName(),

      fileUrl:
        savedFile.getUrl(),

      downloadUrl:
        "https://drive.google.com/uc?export=download&id="
        + savedFile.getId(),

      includedSheets:
        exportSheets,

      message:
        "범용 만족도 조사 결과보고서 Excel 파일을 생성했습니다."
    };

  } finally {
    // ----------------------------------------------------------------------
    // 임시 스프레드시트 정리
    // ----------------------------------------------------------------------

    if (temporarySpreadsheet) {
      try {
        DriveApp
          .getFileById(
            temporarySpreadsheet.getId()
          )
          .setTrashed(true);

      } catch (ignored) {
        // 임시 파일 정리 실패는 최종 파일에 영향을 주지 않습니다.
      }
    }
  }
}


/**
 * XLSX에서 깨지는 Google Sheets 전용/오류 수식을 임시 사본에서 제거합니다.
 * 정확한 숫자표를 우선하므로 SPARKLINE 보조 셀은 빈 값으로 대체합니다.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet 임시 내보내기 문서
 * @param {Object=} options 내보내기 옵션
 * @return {{removedFormulaCount:number, affectedSheets:Array<string>, sheets:Array<Object>}}
 */
function prepareDynamicSpreadsheetForXlsx_(spreadsheet, options) {
  const affectedSheets = [];
  const sheetResults = [];
  let removedFormulaCount = 0;

  spreadsheet.getSheets().forEach(function(sheet) {
    const range = sheet.getDataRange();
    const formulas = range.getFormulas();
    const displayValues = range.getDisplayValues();
    const functionKinds = {};
    let sheetRemovedCount = 0;

    formulas.forEach(function(row, rowIndex) {
      row.forEach(function(formula, columnIndex) {
        const kinds = getDynamicXlsxIncompatibleFormulaKinds_(formula, displayValues[rowIndex][columnIndex]);
        if (!kinds.length) {
          return;
        }
        range.getCell(rowIndex + 1, columnIndex + 1).clearContent();
        removedFormulaCount++;
        sheetRemovedCount++;
        kinds.forEach(function(kind) { functionKinds[kind] = true; });
      });
    });

    SpreadsheetApp.flush();
    const hiddenVisualizationColumns = options && options.hideEmptyVisualizationColumns === false
      ? [] : hideEmptyDynamicVisualizationColumns_(sheet);
    if (sheetRemovedCount) affectedSheets.push(sheet.getName());
    const result = {sheetName:sheet.getName(),removedCellCount:sheetRemovedCount,
      removedFunctionKinds:Object.keys(functionKinds),hiddenVisualizationColumns:hiddenVisualizationColumns};
    sheetResults.push(result);
    console.log(result.sheetName + "\n" + (result.removedFunctionKinds.join(", ") || "NONE")
      + "\n" + result.removedCellCount + " cells");
  });

  SpreadsheetApp.flush();
  return {removedFormulaCount:removedFormulaCount, affectedSheets:affectedSheets, sheets:sheetResults};
}


/** Google Sheets 전용 함수 또는 계산 오류가 있는 수식인지 판별합니다. */
function isDynamicXlsxIncompatibleFormula_(formula, displayValue) {
  return getDynamicXlsxIncompatibleFormulaKinds_(formula, displayValue).length > 0;
}


/** 제거 대상 수식의 함수/오류 종류를 반환합니다. */
function getDynamicXlsxIncompatibleFormulaKinds_(formula, displayValue) {
  const normalizedFormula = String(formula || "").toUpperCase();
  if (!normalizedFormula) return [];
  const kinds = [];
  ["SPARKLINE", "__XLUDF", "DUMMYFUNCTION", "_XLFN."].forEach(function(token) {
    if (normalizedFormula.indexOf(token) !== -1) kinds.push(token);
  });
  ["LET", "LAMBDA", "FILTER", "UNIQUE", "SORT", "SORTN", "TOCOL", "TOROW"].forEach(function(name) {
    if (new RegExp("(?:^|[^A-Z0-9_])" + name + "\\s*\\(", "i").test(normalizedFormula)) kinds.push(name);
  });
  if (/^#(?:NAME\?|REF!|VALUE!|ERROR!|N\/A|DIV\/0!|NUM!|NULL!)$/i
    .test(String(displayValue || "").trim())) kinds.push("FORMULA_ERROR");
  return kinds.filter(function(kind, index) { return kinds.indexOf(kind) === index; });
}


/** SPARKLINE 제거 뒤 시각화 전용열이 완전히 비면 임시 XLSX 사본에서만 숨깁니다. */
function hideEmptyDynamicVisualizationColumns_(sheet) {
  const range = sheet.getDataRange();
  const values = range.getDisplayValues();
  const hiddenColumns = [];
  if (!values.length) return hiddenColumns;
  const columnCount = values.reduce(function(max, row) { return Math.max(max, row.length); }, 0);
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    const columnValues = values.map(function(row) { return String(row[columnIndex] || "").trim(); });
    if (columnValues.indexOf("시각화") === -1) continue;
    const hasNonVisualizationValue = columnValues.some(function(value) { return value && value !== "시각화"; });
    if (!hasNonVisualizationValue) {
      sheet.hideColumns(columnIndex + 1);
      hiddenColumns.push(columnIndex + 1);
    }
  }
  return hiddenColumns;
}


/** 정리 후에도 XLSX 비호환 수식이 남아 있으면 내보내기를 중단합니다. */
function assertDynamicSpreadsheetXlsxCompatible_(spreadsheet) {
  const violations = [];
  spreadsheet.getSheets().forEach(function(sheet) {
    const range = sheet.getDataRange();
    const formulas = range.getFormulas();
    const displayValues = range.getDisplayValues();
    formulas.forEach(function(row, rowIndex) {
      row.forEach(function(formula, columnIndex) {
        if (isDynamicXlsxIncompatibleFormula_(formula, displayValues[rowIndex][columnIndex])) {
          violations.push(sheet.getName() + "!" + range.getCell(rowIndex + 1, columnIndex + 1).getA1Notation());
        }
      });
    });
  });
  if (violations.length) {
    throw new Error("Excel 비호환 수식을 제거하지 못했습니다: " + violations.slice(0, 20).join(", "));
  }
  return true;
}


/** 변환된 XLSX ZIP 내부 XML에도 금지 토큰이 없는지 최종 확인합니다. */
function assertDynamicXlsxBlobCompatible_(excelBlob) {
  let entries;
  try {
    entries = Utilities.unzip(excelBlob.copyBlob());
  } catch (error) {
    throw new Error("생성된 Excel 파일의 호환성 검사를 수행하지 못했습니다: " + (error && error.message ? error.message : String(error)));
  }
  const violations = [];
  entries.forEach(function(entry) {
    const name = String(entry.getName() || "");
    if (!/\.(?:xml|rels)$/i.test(name)) return;
    const token = findDynamicXlsxForbiddenToken_(entry.getDataAsString());
    if (token) violations.push(name + " (" + token + ")");
  });
  if (violations.length) {
    throw new Error("생성된 Excel 파일에 비호환 수식이 남아 있습니다: " + violations.slice(0, 20).join(", "));
  }
  return true;
}


/** XLSX XML에서 금지된 함수/오류 토큰을 반환합니다. */
function findDynamicXlsxForbiddenToken_(content) {
  const normalized = String(content || "").toUpperCase();
  return ["SPARKLINE", "__XLUDF", "DUMMYFUNCTION", "_XLFN.", "LET(", "LAMBDA(", "FILTER(",
    "UNIQUE(", "SORT(", "SORTN(", "TOCOL(", "TOROW(", "#NAME?"].find(function(token) {
    return normalized.indexOf(token) !== -1;
  }) || "";
}


/** XLSX XML에 A4 가로·한 페이지 너비·좁은 여백·1~4행 반복 인쇄 설정을 적용합니다. */
function applyDynamicXlsxPrintLayout_(excelBlob, sheetNames) {
  let entries;
  try { entries=Utilities.unzip(excelBlob.copyBlob()); }
  catch(error){throw new Error("Excel 인쇄 설정을 적용하지 못했습니다: "+(error&&error.message?error.message:String(error)));}
  const updated=entries.map(function(entry){
    const name=String(entry.getName()||"");
    if(!/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)&&name!=="xl/workbook.xml")return entry;
    let content=entry.getDataAsString();
    if(/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)) content=applyDynamicWorksheetPrintSettingsXml_(content);
    else content=applyDynamicWorkbookPrintTitlesXml_(content,sheetNames||[]);
    return Utilities.newBlob(content,entry.getContentType(),name);
  });
  return Utilities.zip(updated,excelBlob.getName());
}


function applyDynamicWorksheetPrintSettingsXml_(content) {
  let xml=String(content||"");
  if(xml.indexOf("<pageSetUpPr")===-1){
    if(/<sheetPr\b[^>]*\/>/.test(xml))xml=xml.replace(/<sheetPr\b([^>]*)\/>/,'<sheetPr$1><pageSetUpPr fitToPage="1"/></sheetPr>');
    else if(xml.indexOf("<sheetPr")!==-1)xml=xml.replace(/<sheetPr([^>]*)>/,'<sheetPr$1><pageSetUpPr fitToPage="1"/>');
    else xml=xml.replace(/(<worksheet[^>]*>)/,'$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
  }
  xml=xml.replace(/<pageMargins\b[^>]*\/>/g,"").replace(/<pageSetup\b[^>]*\/>/g,"");
  return xml.replace("</worksheet>",'<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>');
}


function applyDynamicWorkbookPrintTitlesXml_(content, sheetNames) {
  let xml=String(content||"").replace(/<definedName\b[^>]*name="_xlnm\.Print_Titles"[^>]*>[\s\S]*?<\/definedName>/g,"");
  const names=(sheetNames||[]).map(function(sheetName,index){
    const escaped=String(sheetName).replace(/&/g,"&amp;").replace(/'/g,"&apos;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return '<definedName name="_xlnm.Print_Titles" localSheetId="'+index+'">&apos;'+escaped+'&apos;!$1:$4</definedName>';
  }).join("");
  if(!names)return xml;
  if(xml.indexOf("<definedNames")!==-1)return xml.replace("</definedNames>",names+"</definedNames>");
  return xml.replace("</workbook>","<definedNames>"+names+"</definedNames></workbook>");
}


/**
 * 웹페이지에서 범용 Excel 보고서를 생성합니다.
 *
 * @param {string} requestedFileName 웹페이지에서 입력한 파일명
 * @return {Object}
 */
function exportDynamicSurveyReportFromWeb(
  requestedFileName,
  options
) {
  try {
    const result = createDynamicSurveyReportXlsx_(
      requestedFileName,
      options
    );

    const savedFile = DriveApp.getFileById(
      result.fileId
    );

    const blob = savedFile.getBlob();

    const response = {
      success: true,
      fileName: result.fileName,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64Data:
        Utilities.base64Encode(blob.getBytes()),
      includedSheets: result.includedSheets,
      message:
        "범용 만족도 조사 결과보고서 Excel 파일을 생성했습니다."
    };

    // 웹 다운로드용 중간 파일은 전달 후 휴지통으로 이동합니다.
    savedFile.setTrashed(true);

    return response;

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
