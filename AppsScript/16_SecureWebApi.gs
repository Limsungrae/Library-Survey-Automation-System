/**
 * ==========================================================================
 * 인증 토큰이 적용된 웹 API 래퍼
 * ==========================================================================
 *
 * 기존 웹 함수는 수정하지 않고, 인증 검증(requireWebAccessToken_) 후 
 * 성공 시에만 기존 비즈니스 로직 함수를 호출합니다.
 */

/**
 * 조사 설정 불러오기
 */
function secureGetSurveySettingsForWeb(accessToken) {
  requireWebAccessToken_(accessToken);
  return getSurveySettingsForWeb();
}

/**
 * 범용 시스템 상태 불러오기
 */
function secureGetDynamicSurveySystemStatusFromWeb(accessToken) {
  requireWebAccessToken_(accessToken);
  return getDynamicSurveySystemStatusFromWeb();
}

/**
 * 조사 설정 저장
 */
function secureSaveSurveySettingsFromWeb(payload, accessToken) {
  requireWebAccessToken_(accessToken);
  return saveSurveySettingsFromWeb(payload);
}

/**
 * Excel 문항 구조 분석
 */
function secureInspectSurveyExcelForMappingFromWeb(fileData, accessToken) {
  requireWebAccessToken_(accessToken);
  return inspectSurveyExcelForMappingFromWeb(fileData);
}

function secureInspectSurveyExcelByRuleFromWeb(fileData, accessToken) {
  requireWebAccessToken_(accessToken);
  return inspectSurveyExcelForMappingFromWeb(fileData, {ruleOnly: true});
}

/**
 * 문항 매핑 저장
 */
function secureSaveSurveyMappingsFromWeb(payload, accessToken) {
  requireWebAccessToken_(accessToken);
  return saveSurveyMappingsFromWeb(payload);
}

function secureGetSavedSurveyMappingsFromWeb(accessToken) {
  requireWebAccessToken_(accessToken);
  return getSavedSurveyMappingsFromWeb();
}

function secureDeleteSavedSurveyMappingsFromWeb(accessToken) {
  requireWebAccessToken_(accessToken);
  return deleteSavedSurveyMappingsFromWeb();
}

/**
 * 범용 원자료 생성
 */
function secureCreateGenericRawSheetFromWeb(fileData, accessToken) {
  requireWebAccessToken_(accessToken);
  return createGenericRawSheetFromWeb(fileData);
}

function secureUploadSurveyExcelFromWeb(fileData, accessToken) {
  requireWebAccessToken_(accessToken);
  return uploadSurveyExcelFromWeb(fileData);
}

function secureValidateRawSheetFromWeb(accessToken) {
  requireWebAccessToken_(accessToken);
  return validateRawSheetFromWeb();
}

function secureGenerateStatisticalSheetsFromWeb(accessToken) {
  requireWebAccessToken_(accessToken);
  return generateStatisticalSheetsFromWeb();
}

function secureGenerateAIReportSheetsFromWeb(accessToken) {
  requireWebAccessToken_(accessToken);
  return generateAIReportSheetsFromWeb();
}

function secureGenerateFullSurveyReportFromWeb(accessToken) {
  requireWebAccessToken_(accessToken);
  return generateFullSurveyReportFromWeb();
}

/**
 * 범용 통계 보고서 생성
 */
function generateDynamicStatisticalReportFromWeb() {
  return generateDynamicStatisticalReport_();
}

function secureGenerateDynamicStatisticalReportFromWeb(accessToken) {
  requireWebAccessToken_(accessToken);
  return generateDynamicStatisticalReportFromWeb();
}

/**
 * 범용 대시보드 데이터 조회
 */
function secureGetDynamicSurveyDashboardDataFromWeb(accessToken) {
  requireWebAccessToken_(accessToken);
  return getDynamicSurveyDashboardDataFromWeb();
}

function secureGetDynamicSurveyQualityFromWeb(accessToken) {
  requireWebAccessToken_(accessToken);
  return getDynamicSurveyQualityFromWeb();
}

/**
 * 범용 Gemini AI 보고서 생성
 */
function secureGenerateDynamicAIReportFromWeb(accessToken) {
  requireWebAccessToken_(accessToken);
  return generateDynamicAIReportFromWeb();
}

/**
 * 범용 Excel 보고서 생성
 */
function secureExportDynamicSurveyReportFromWeb(requestedFileName, accessToken, options) {
  requireWebAccessToken_(accessToken);
  return exportDynamicSurveyReportFromWeb(requestedFileName, options);
}

function securePrepareDynamicVisualizationPdfExportFromWeb(expectedRawRevision, accessToken) {
  requireWebAccessToken_(accessToken);
  return prepareDynamicVisualizationPdfExportFromWeb(expectedRawRevision);
}

function securePrepareDynamicVisualizationPngExportFromWeb(expectedRawRevision, accessToken) {
  requireWebAccessToken_(accessToken);
  return prepareDynamicVisualizationPngExportFromWeb(expectedRawRevision);
}

/** 인증된 담당자에게만 Gemini 설문 초안 생성을 허용합니다. */
function secureGenerateSurveyDraftFromWeb(payload, accessToken) {
  requireWebAccessToken_(accessToken);
  try {
    return {success:true, draft:generateSurveyDraft_(payload)};
  } catch (error) {
    console.error("Survey AI draft generation failed", error && error.stack ? error.stack : error);
    return {
      success:false,
      code:error && error.code ? error.code : "SURVEY_AI_API_ERROR",
      error:"설문 초안을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요."
    };
  }
}

/** 인증된 담당자의 검토 완료 Draft로만 Google Form을 생성합니다. */
function secureCreateGoogleFormFromWeb(payload, accessToken) {
  requireWebAccessToken_(accessToken);
  try {
    return {success:true, form:createGoogleFormFromReviewedDraft_(payload)};
  } catch (error) {
    console.error("Secure Google Form generation failed", error && error.stack ? error.stack : error);
    const validation = error && error.code === "SURVEY_FORM_VALIDATION_ERROR";
    return {
      success:false,
      code:validation ? "SURVEY_FORM_VALIDATION_ERROR" : "SURVEY_FORM_CREATE_ERROR",
      error:validation
        ? "Google Form으로 만들 수 없는 문항이 있습니다. 설문 초안을 확인해 주세요."
        : "Google Form을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요."
    };
  }
}

function secureInspectGoogleFormResponsesForMappingFromWeb(request, accessToken) {
  requireWebAccessToken_(accessToken);
  try {
    return inspectGoogleFormResponsesForMappingFromWeb(request);
  } catch (error) {
    console.error("Google Form response inspection failed", error && error.stack ? error.stack : error);
    const code = error && error.code || "GOOGLE_FORM_RESPONSE_INSPECT_ERROR";
    const messages = {
      GOOGLE_FORM_RESPONSE_ACCESS_ERROR:"Google Form 응답 시트에 접근할 수 없습니다. 응답 시트 권한을 확인해 주세요.",
      GOOGLE_FORM_RESPONSE_EMPTY:"아직 분석할 설문 응답이 없습니다.",
      GOOGLE_FORM_RESPONSE_STRUCTURE_ERROR:"설문 응답 구조를 확인할 수 없습니다.",
      GOOGLE_FORM_RESPONSE_VALIDATION_ERROR:"설문 응답 구조를 확인할 수 없습니다."
    };
    return {success:false, code:code, error:messages[code] || "설문 응답 구조를 확인할 수 없습니다."};
  }
}

function secureImportGoogleFormResponsesToRawFromWeb(request, accessToken) {
  requireWebAccessToken_(accessToken);
  try {
    return importGoogleFormResponsesToRawFromWeb(request);
  } catch (error) {
    console.error("Google Form response raw import failed", error && error.stack ? error.stack : error);
    const code = error && error.code || "GOOGLE_FORM_RESPONSE_IMPORT_ERROR";
    const message = code === "GOOGLE_FORM_RESPONSE_EMPTY" ? "아직 분석할 설문 응답이 없습니다."
      : code === "GOOGLE_FORM_RESPONSE_ACCESS_ERROR" ? "Google Form 응답 시트에 접근할 수 없습니다. 응답 시트 권한을 확인해 주세요."
        : code === "GOOGLE_FORM_RESPONSE_MAPPING_ERROR" ? "먼저 문항 구조를 확인하고 문항 분석 유형을 저장해 주세요."
          : "Google Form 응답을 분석 원자료로 가져오지 못했습니다.";
    return {success:false, code:code, error:message};
  }
}
