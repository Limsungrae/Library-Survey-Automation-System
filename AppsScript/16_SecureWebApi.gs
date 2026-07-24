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
