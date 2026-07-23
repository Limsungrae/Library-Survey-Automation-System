/**
 * ==========================================================================
 * 성남시중원도서관 AI 홍보 비서 및 만족도 보고서 시스템
 * 공통 환경설정
 * ==========================================================================
 *
 * 주의:
 * 전역 설정값은 이 파일에서만 선언합니다.
 * 다른 .gs 파일에서 APP_CONFIG 또는 동일한 상수를 다시 선언하지 않습니다.
 */

const APP_CONFIG = Object.freeze({

  // ------------------------------------------------------------------------
  // 기관 기본정보
  // ------------------------------------------------------------------------

  LIBRARY_NAME: "기관",

  TEAM_NAME: "기본정보",

  // 만족도 조사 설문 및 결과보고서 문의번호
  SURVEY_CONTACT: "031-000-0000",

  // AI 홍보 비서 기본 문의처
  PROMO_CONTACT: "성남시중원도서관 (031-000-0000)",

  // 배움숲 접수 주소
  BAEUMSOOP_URL: "https://sugang.seongnam.go.kr",


  // ------------------------------------------------------------------------
  // Gemini API 설정
  // ------------------------------------------------------------------------

  DEFAULT_GEMINI_MODEL: "gemini-3.5-flash",

  GEMINI_API_BASE:
    "https://generativelanguage.googleapis.com/v1beta/models",


  // ------------------------------------------------------------------------
  // 만족도 보고서 시트 설정
  // ------------------------------------------------------------------------
  SETTINGS_SHEET: "00_설정",

  // ------------------------------------------------------------------------
  // 보고서 서식 색상
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

    YELLOW: "#FFF2CC"
  })

});

const DYNAMIC_SURVEY_CONFIG = Object.freeze({
  SHEETS: Object.freeze({
    SETTINGS: "00_설정", QUALITY: "00_품질검사", OVERVIEW: "01_조사개요",
    DASHBOARD: "02_대시보드", RESPONDENT: "03_응답자특성", SINGLE: "04_단일응답분석",
    MULTIPLE: "05_복수응답분석", SCALE: "06_척도분석", RECOMMENDATION: "07_추천의향분석",
    TEXT: "08_주관식분석", AI_SUMMARY: "09_AI총평", FUTURE_PLAN: "10_향후계획",
    RAW: "11_범용원자료", MAPPING: "12_문항매핑",
    LEGACY_RAW: "09_범용원자료", LEGACY_MAPPING: "10_문항매핑"
  }),
  SCALE: Object.freeze({MIN: 1, MAX: 5, POSITIVE_MIN: 4, NEUTRAL: 3}),
  ALLOWED_RECOMMENDATION_KINDS: Object.freeze(["NPS_0_10", "RECOMMENDATION_1_5"]),
  QUALITY: Object.freeze({HIGH_MISSING_RATE: 50, RATE_TOLERANCE: 0.2}),
  REPORT: Object.freeze({MAX_CHARTS: 10, HEADER_COLOR: "#244D78", TITLE_COLOR: "#17375E"}),
  DEBUG: false
});


/**
 * 스크립트 속성에 등록한 Gemini API 키를 가져옵니다.
 */
function getGeminiApiKey_() {

  const key =
    PropertiesService
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
 * 스크립트 속성에 GEMINI_MODEL이 있으면 해당 값을 사용하고,
 * 없으면 DEFAULT_GEMINI_MODEL을 사용합니다.
 */
function getGeminiModel_() {

  const configuredModel =
    PropertiesService
      .getScriptProperties()
      .getProperty("GEMINI_MODEL");

  return (
    configuredModel
    || APP_CONFIG.DEFAULT_GEMINI_MODEL
  );
}
