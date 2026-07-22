/**
 * ==========================================================================
 * 성남시중원도서관 AI 홍보 비서 및 만족도 보고서 시스템
 * 메인 진입점
 * ==========================================================================
 *
 * 담당 기능
 * 1. 스프레드시트 사용자 메뉴 생성
 * 2. 웹앱 페이지 라우팅
 *
 * 주의:
 * - onOpen()과 doGet()은 이 파일에서만 선언합니다.
 * - 다른 .gs 파일에서 같은 이름의 함수를 중복 선언하지 않습니다.
 */


/**
 * 스프레드시트를 열 때 상단 메뉴를 생성합니다.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();


  // 기존 AI 홍보 비서 메뉴
  ui.createMenu("🤖 도서관 AI 비서")
    .addItem(
      "현재 행 3개 채널 홍보문 동시 생성",
      "generateLibraryPromos"
    )
    .addToUi();


  // 신규 만족도 보고서 자동화 메뉴
  ui.createMenu("📊 만족도 보고서")
    .addItem(
      "1. 네이버폼 원자료 가져오기",
      "promptImportNaverSurvey"
    )
    .addSeparator()
    .addItem(
      "2. 보고서 전체 생성",
      "generateFullSurveyReport"
    )
    .addItem(
      "3. 통계 시트만 다시 생성",
      "generateStatisticalSheets"
    )
    .addItem(
      "4. AI 총평·향후계획 다시 생성",
      "generateAIReportSheets"
    )
    .addSeparator()
    .addItem(
      "5. 보고서 Excel(.xlsx) 저장",
      "exportSurveyReportToXlsx"
    )
    .addItem(
      "원자료 구조 검사",
      "validateRawSheetFromMenu"
    )
    .addToUi();
}


/**
 * 웹앱 접속 주소에 따라 HTML 화면을 구분합니다.
 *
 * 기본 주소:
 * index.html
 *
 * ?page=survey:
 * survey-dashboard.html
 */
function doGet(e) {
  const page =
    e && e.parameter
      ? e.parameter.page
      : "";

  const requestedUi =
    e && e.parameter
      ? String(e.parameter.ui || "").toLowerCase()
      : "";

  const useSurveyV2 =
    page === "survey"
    && requestedUi === "v2";

  const fileName =
    useSurveyV2
      ? "survey-dashboard-v2"
      : page === "survey"
        ? "survey-dashboard"
      : "index";

  const template =
    HtmlService.createTemplateFromFile(fileName);

  template.webAppUrl =
    ScriptApp.getService().getUrl();

  return template
    .evaluate()
    .setTitle(
      page === "survey"
        ? useSurveyV2
          ? "Survey Insight Studio v2"
          : "성남시중원도서관 만족도 조사 보고서 시스템"
        : "성남시중원도서관 AI 홍보 비서 시스템"
    )
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    )
    .addMetaTag(
      "viewport",
      "width=device-width, initial-scale=1"
    );
}


/**
 * HtmlService 템플릿에서 v2 전용 CSS와 JavaScript 조각을 포함합니다.
 * 기존 페이지는 이 함수를 사용하지 않으므로 렌더링 경로가 변경되지 않습니다.
 *
 * @param {string} fileName 포함할 HTML 파일명
 * @return {string}
 */
function includeHtml_(fileName) {
  return HtmlService
    .createHtmlOutputFromFile(fileName)
    .getContent();
}
