/**
 * ==========================================================================
 * 성남시중원도서관 AI 홍보 비서 및 만족도 조사 자동화 시스템
 * 공통 환경설정
 * ==========================================================================
 *
 * 관리 원칙
 * 1. 전역 설정값은 이 파일에서만 선언합니다.
 * 2. 다른 .gs 파일에서 APP_CONFIG, DYNAMIC_SURVEY_CONFIG를 재선언하지 않습니다.
 * 3. 실제 API 키는 코드에 작성하지 않고 Script Properties에서 관리합니다.
 * 4. REPORT_SHEETS는 최종 결과보고서의 공식 시트 구조입니다.
 * 5. SHEETS는 기존 코드와의 단계적 호환을 위한 레거시 키를 포함합니다.
 */

const APP_CONFIG = Object.freeze({

  // ------------------------------------------------------------------------
  // 기관 기본정보
  // ------------------------------------------------------------------------

  LIBRARY_NAME: "성남시중원도서관",
  TEAM_NAME: "담당부서",

  // 만족도 조사 설문 및 결과보고서 문의번호
  SURVEY_CONTACT: "031-000-0000",

  // AI 홍보 비서 기본 문의처
  PROMO_CONTACT: "성남시중원도서관 (031-000-0000)",

  // 배움숲 접수 주소
  BAEUMSOOP_URL: "https://sugang.seongnam.go.kr",


  // ------------------------------------------------------------------------
  // Gemini API 설정
  // ------------------------------------------------------------------------

  // Script Properties의 GEMINI_MODEL 값이 없을 때 사용하는 기본 모델입니다.
  DEFAULT_GEMINI_MODEL: "gemini-3.5-flash",

  GEMINI_API_BASE:
    "https://generativelanguage.googleapis.com/v1beta/models",


  // ------------------------------------------------------------------------
  // 공통 시트 설정
  // ------------------------------------------------------------------------

  SETTINGS_SHEET: "00_설정",


  // ------------------------------------------------------------------------
  // 보고서 공통 서식 색상
  // ------------------------------------------------------------------------

  COLORS: Object.freeze({
    NAVY: "#1B365D",
    BLUE: "#4A6FA5",
    LIGHT_BLUE: "#DCE6F1",
    LIGHT_GRAY: "#F3F4F6",
    BORDER: "#B8C2CC",
    WHITE: "#FFFFFF",
    DARK: "#1F2937",
    GREEN: "#E2F0D9",
    YELLOW: "#FFF2CC",
    WARNING: "#FCE4D6"
  })
});


/**
 * 범용 설문 자동화 설정입니다.
 *
 * REPORT_SHEETS
 * - 앞으로 사용할 최종 결과보고서 구조입니다.
 *
 * INTERNAL_SHEETS
 * - 사용자가 직접 보지 않아도 되는 내부 관리용 시트입니다.
 *
 * SHEETS
 * - 현재 프로젝트의 기존 코드와 호환하기 위한 키입니다.
 * - 13_DynamicReport.gs 등 관련 파일을 전환한 후에도 참조 호환성을 위해 유지합니다.
 */
const DYNAMIC_SURVEY_CONFIG = Object.freeze({

  // ------------------------------------------------------------------------
  // 최종 결과보고서 공식 시트 구조
  // ------------------------------------------------------------------------

  REPORT_SHEETS: Object.freeze({
    OVERVIEW: "01_조사개요",
    DASHBOARD: "02_대시보드",
    RESPONDENT: "03_응답자특성",
    MULTIPLE: "04_복수응답분석",
    SATISFACTION: "05_만족도분석",
    OPINION: "06_주관식분석",
    AI_SUMMARY: "07_AI총평",
    IMPROVEMENT_PLAN: "08_향후개선방향",
    RAW: "09_원자료"
  }),


  // ------------------------------------------------------------------------
  // 내부 관리용 시트
  // ------------------------------------------------------------------------

  INTERNAL_SHEETS: Object.freeze({
    SETTINGS: "00_설정",
    QUALITY: "00_품질검사",
    MAPPING: "10_문항매핑",
    IMPORT_RAW: "11_범용원자료",
    LEGACY_MAPPING: "12_문항매핑"
  }),


  // ------------------------------------------------------------------------
  // 기존 코드 호환용 시트 키
  // ------------------------------------------------------------------------
  // 주의:
  // 이 영역의 기존 키를 갑자기 삭제하면 아직 전환되지 않은 파일이 중단될 수 있습니다.
  // 최종 출력 코드는 REPORT_SHEETS를 우선 사용하도록 순차 전환합니다.

  SHEETS: Object.freeze({
    SETTINGS: "00_설정",
    QUALITY: "00_품질검사",

    OVERVIEW: "01_조사개요",
    DASHBOARD: "02_대시보드",
    RESPONDENT: "03_응답자특성",

    // 레거시 보고서 분리 시트
    SINGLE: "04_단일응답분석",
    MULTIPLE: "05_복수응답분석",
    SCALE: "06_척도분석",
    RECOMMENDATION: "07_추천의향분석",
    TEXT: "08_주관식분석",
    AI_SUMMARY: "09_AI총평",
    FUTURE_PLAN: "10_향후계획",

    // 현재 분석 엔진이 읽는 내부 원자료·매핑 시트
    RAW: "11_범용원자료",
    MAPPING: "12_문항매핑",

    // 이전 버전에서 사용했던 시트명
    LEGACY_RAW: "09_범용원자료",
    LEGACY_MAPPING: "10_문항매핑"
  }),


  // ------------------------------------------------------------------------
  // 5점 척도 기준
  // ------------------------------------------------------------------------

  SCALE: Object.freeze({
    MIN: 1,
    MAX: 5,
    POSITIVE_MIN: 4,
    NEUTRAL: 3,
    NEGATIVE_MAX: 2
  }),


  // ------------------------------------------------------------------------
  // 추천·재이용 문항 기준
  // ------------------------------------------------------------------------

  // 기존 자료의 NPS 읽기 호환성은 남기되,
  // 새 설문에서는 RECOMMENDATION_1_5 사용을 기본으로 합니다.
  DEFAULT_RECOMMENDATION_KIND: "RECOMMENDATION_1_5",

  ALLOWED_RECOMMENDATION_KINDS: Object.freeze([
    "RECOMMENDATION_1_5",
    "NPS_0_10"
  ]),


  // ------------------------------------------------------------------------
  // 품질검사 기준
  // ------------------------------------------------------------------------

  QUALITY: Object.freeze({
    HIGH_MISSING_RATE: 50,
    RATE_TOLERANCE: 0.2,
    BLOCK_AI_ON_ERROR: true,
    BLOCK_EXPORT_ON_FAIL: true
  }),


  // ------------------------------------------------------------------------
  // 보고서 출력 설정
  // ------------------------------------------------------------------------

  REPORT: Object.freeze({
    HEADER_COLOR: "#244D78",
    TITLE_COLOR: "#17375E",
    FONT_FAMILY: "맑은 고딕",
    TITLE_FONT_SIZE: 17,
    BODY_FONT_SIZE: 10,
    HIDE_QUALITY_SHEET: true,
    HIDE_GRIDLINES: true
  }),


  // ------------------------------------------------------------------------
  // 디버그 설정
  // ------------------------------------------------------------------------

  DEBUG: false
});


/**
 * 최종 결과보고서 시트 순서를 반환합니다.
 * 새 보고서 생성·정렬·내보내기에서 공통으로 사용합니다.
 *
 * @param {boolean=} includeQuality 품질검사 시트 포함 여부
 * @return {Array<string>}
 */
function getDynamicFinalReportSheetOrder_(includeQuality) {
  const report = DYNAMIC_SURVEY_CONFIG.REPORT_SHEETS;
  const order = [
    report.OVERVIEW,
    report.DASHBOARD,
    report.RESPONDENT,
    report.MULTIPLE,
    report.SATISFACTION,
    report.OPINION,
    report.AI_SUMMARY,
    report.IMPROVEMENT_PLAN,
    report.RAW
  ];

  if (includeQuality === true) {
    order.unshift(DYNAMIC_SURVEY_CONFIG.INTERNAL_SHEETS.QUALITY);
  }

  return order;
}


/**
 * 최종 Excel에 반드시 포함되어야 하는 기본 시트를 반환합니다.
 * AI 시트는 AI 분석 전에는 없을 수 있으므로 필수 목록에서 제외합니다.
 *
 * @return {Array<string>}
 */
function getDynamicRequiredReportSheetNames_() {
  const report = DYNAMIC_SURVEY_CONFIG.REPORT_SHEETS;

  return [
    DYNAMIC_SURVEY_CONFIG.INTERNAL_SHEETS.QUALITY,
    report.OVERVIEW,
    report.DASHBOARD,
    report.RESPONDENT,
    report.MULTIPLE,
    report.SATISFACTION,
    report.OPINION,
    report.RAW
  ];
}


/**
 * 내부 관리용 시트인지 확인합니다.
 *
 * @param {string} sheetName
 * @return {boolean}
 */
function isDynamicInternalSheet_(sheetName) {
  const target = String(sheetName || "");
  const internal = DYNAMIC_SURVEY_CONFIG.INTERNAL_SHEETS;

  return [
    internal.SETTINGS,
    internal.QUALITY,
    internal.MAPPING,
    internal.IMPORT_RAW,
    internal.LEGACY_MAPPING
  ].indexOf(target) !== -1;
}


/**
 * 스크립트 속성에 등록한 Gemini API 키를 가져옵니다.
 *
 * @return {string}
 */
function getGeminiApiKey_() {
  const key = PropertiesService
    .getScriptProperties()
    .getProperty("GEMINI_API_KEY");

  if (!key) {
    throw new Error(
      "Gemini API 키가 설정되지 않았습니다. "
      + "Apps Script의 프로젝트 설정 → 스크립트 속성에서 "
      + "GEMINI_API_KEY를 등록해 주세요."
    );
  }

  return key;
}


/**
 * 사용할 Gemini 모델명을 가져옵니다.
 *
 * Script Properties에 GEMINI_MODEL이 있으면 해당 값을 사용하고,
 * 없으면 APP_CONFIG.DEFAULT_GEMINI_MODEL을 사용합니다.
 *
 * @return {string}
 */
function getGeminiModel_() {
  const configuredModel = PropertiesService
    .getScriptProperties()
    .getProperty("GEMINI_MODEL");

  return configuredModel || APP_CONFIG.DEFAULT_GEMINI_MODEL;
}
