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


    const excelBlob =
      exportResponse
        .getBlob()
        .setName(
          fileName
        )
        .setContentType(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
    if(excelBlob.getBytes().length===0)throw new Error("생성된 Excel 파일이 비어 있습니다.");


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
