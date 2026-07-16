/**
 * ==========================================================================
 * 성남시중원도서관 AI 홍보 비서 시스템
 * 홍보문 생성 서비스
 * ==========================================================================
 *
 * 담당 기능
 * 1. 스프레드시트 현재 행의 홍보문 생성
 * 2. index.html에서 전달한 이미지·텍스트 기반 홍보문 생성
 * 3. AI 응답을 홈페이지·인스타그램·포스터 원고로 분리
 *
 * 주의
 * - 기관명, 배움숲 주소, 기본 연락처는 00_Config.gs의 APP_CONFIG를 사용합니다.
 * - Gemini 통신은 02_GeminiService.gs의 callGeminiText_()를 사용합니다.
 */


// ==========================================================================
// 홍보관리 시트 열 번호
// ==========================================================================

const COL_TITLE = 1;       // A열: 강좌·행사명
const COL_EDU_DATE = 2;    // B열: 교육·운영 기간
const COL_REG_DATE = 3;    // C열: 접수 기간
const COL_TARGET = 4;      // D열: 대상 및 정원
const COL_PLACE = 5;       // E열: 운영 장소
const COL_COST = 6;        // F열: 수강료 및 재료비
const COL_CONTENT = 7;     // G열: 주요 내용
const COL_CONTACT = 8;     // H열: 문의처
const COL_OUT_HOME = 9;    // I열: 홈페이지 공지문
const COL_OUT_INS = 10;    // J열: 인스타그램 홍보문
const COL_OUT_POS = 11;    // K열: 포스터 원고
const COL_TYPE = 12;       // L열: 홍보 유형


// ==========================================================================
// 스프레드시트 현재 행 홍보문 생성
// ==========================================================================

/**
 * 현재 선택한 행의 정보를 읽어 홍보문 3종을 생성합니다.
 */
function generateLibraryPromos() {
  try {
    const sheet =
      SpreadsheetApp
        .getActiveSpreadsheet()
        .getActiveSheet();

    const row =
      sheet
        .getActiveCell()
        .getRow();


    if (row <= 3) {
      throw new Error(
        "실제 데이터가 있는 4행부터 선택해 주세요."
      );
    }


    const values =
      sheet
        .getRange(
          row,
          1,
          1,
          COL_TYPE
        )
        .getDisplayValues()[0];


    const getValue = function(column) {
      return String(
        values[column - 1] || ""
      ).trim();
    };


    const data = {
      title:
        getValue(COL_TITLE),

      eduDate:
        getValue(COL_EDU_DATE),

      regDate:
        getValue(COL_REG_DATE),

      target:
        getValue(COL_TARGET),

      place:
        getValue(COL_PLACE),

      cost:
        getValue(COL_COST),

      content:
        getValue(COL_CONTENT),

      contact:
        getValue(COL_CONTACT)
        || APP_CONFIG.PROMO_CONTACT,

      promoType:
        getValue(COL_TYPE)
        || "강좌"
    };


    if (!data.title) {
      throw new Error(
        "'강좌·행사명'이 비어 있습니다."
      );
    }


    const payload =
      buildPromoPayload_(
        data
      );


    const response =
      callGeminiText_(
        payload
      );


    const result =
      splitPromoResponse_(
        response
      );


    sheet
      .getRange(
        row,
        COL_OUT_HOME,
        1,
        3
      )
      .setValues([
        [
          result.homepage,
          result.instagram,
          result.poster
        ]
      ]);


    SpreadsheetApp
      .getUi()
      .alert(
        "완료",
        "홈페이지 공지문, 인스타그램 홍보문, 포스터 원고가 생성되었습니다.",
        SpreadsheetApp
          .getUi()
          .ButtonSet
          .OK
      );

  } catch (error) {
    showError(
      error && error.message
        ? error.message
        : String(error)
    );
  }
}


// ==========================================================================
// 홍보 유형별 작성 방향
// ==========================================================================

/**
 * 홍보 유형에 따른 문체와 강조사항을 반환합니다.
 */
function promoStyle_(type) {
  const styles = {
    "강좌":
      "모집과 교육 내용 중심으로 작성한다.",

    "행사":
      "주민의 흥미를 높이고 참여를 유도하는 방향으로 작성한다.",

    "전시":
      "감성적이고 정중한 관람 안내로 작성하며, 제공되지 않은 접수정보는 만들지 않는다.",

    "독서문화":
      "독서의 가치와 문화 향유의 의미를 강조한다.",

    "방학특강":
      "학부모가 이해하기 쉬운 문체를 사용하고 선착순 모집의 긴급성을 적절히 강조한다.",

    "공지":
      "공공기관의 공식적이고 정중한 안내문으로 작성한다."
  };


  return (
    styles[type]
    || "단정하고 직관적으로 작성한다."
  );
}


// ==========================================================================
// 홍보문 프롬프트
// ==========================================================================

/**
 * 이미지 분석 안내와 입력 데이터를 포함한 공통 프롬프트를 만듭니다.
 */
function buildPromoPrompt_(
  data,
  imageNotice
) {
  const promoType =
    data.promoType
    || "강좌";


  const contact =
    data.contact
    || APP_CONFIG.PROMO_CONTACT;


  return `
너는 ${APP_CONFIG.LIBRARY_NAME}의 베테랑 홍보 담당 사서이다.

제공된 사실만 사용하며 자료에 없는 날짜, 장소, 대상, 비용, 신청방법, 연락처를 추정하거나 만들어내지 않는다.

공공기관에 적합한 정확하고 자연스러우며 정중한 문체를 사용한다.

마크다운 강조 기호인 별표, 이중 별표, 제목용 샵 기호는 사용하지 않는다.

답변 앞뒤의 설명이나 인사말은 쓰지 않는다.

세 콘텐츠 사이에는 [구분선]만 단독 한 줄로 출력한다.

홍보 유형: ${promoType}

작성 방향:
${promoStyle_(promoType)}

${imageNotice || ""}

[입력 정보]

강좌·행사명:
${data.title || "이미지에서 확인"}

교육·운영 기간:
${data.eduDate || "이미지에서 확인"}

접수 기간:
${data.regDate || "이미지에서 확인"}

대상 및 정원:
${data.target || "이미지에서 확인"}

운영 장소:
${data.place || "이미지에서 확인"}

수강료 및 재료비:
${data.cost || "이미지에서 확인"}

주요 내용:
${data.content || "이미지에서 확인"}

문의처:
${contact}


① 홈페이지용 공지문

▢ 운영 개요
▢ 신청 안내
▢ 주요 내용
▢ 문의처

위 구조로 정중하고 명확하게 작성한다.

접수 기간이 실제로 제공된 경우에만 아래 접수방법을 포함한다.

성남시 평생학습 통합플랫폼 '배움숲' 온라인 접수
${APP_CONFIG.BAEUMSOOP_URL}


[구분선]


② 인스타그램용 홍보문

첫 줄은 콘텐츠와 어울리는 이모지와 짧은 관심 유도 문구로 시작한다.

주민들이 편안하게 읽을 수 있도록 정중하고 친근한 해요체를 사용한다.

모바일 가독성을 고려하여 의미 단위로 줄바꿈한다.

제공된 정보가 있는 항목만 다음과 같이 정리한다.

📅 운영기간
👥 참여대상
📍 운영장소
💰 수강료 또는 관람료
📌 신청방법
☎ 문의처

접수기간이 실제로 제공된 경우에만 배움숲 접수주소를 포함한다.

마지막에는 콘텐츠와 관련된 해시태그를 8개 이상 작성한다.


[구분선]


③ 홍보 포스터용 원고

[메인 타이틀]
시선을 끌 수 있는 헤드카피 2개

[핵심 요약 포인트]
포스터 중앙에 배치할 한 줄 문구

[상세 안내]
제공된 정보 중 일시, 대상, 장소, 비용, 신청방법, 문의처만 간결하게 정리한다.
`.trim();
}


// ==========================================================================
// 텍스트 전용 Gemini 요청
// ==========================================================================

/**
 * 스프레드시트 행 데이터를 Gemini 요청 객체로 만듭니다.
 */
function buildPromoPayload_(data) {
  return {
    contents: [
      {
        parts: [
          {
            text:
              buildPromoPrompt_(
                data,
                ""
              )
          }
        ]
      }
    ],

    generationConfig: {
      temperature:
        0.6,

      topP:
        0.9,

      maxOutputTokens:
        8192
    }
  };
}


// ==========================================================================
// index.html 이미지·텍스트 요청 처리
// ==========================================================================

/**
 * index.html에서 전달된 이미지 및 입력정보를 Gemini에 전달합니다.
 */
function callGeminiFromWeb(formData) {
  const data =
    formData
    || {};


  const parts = [];
  let imageNotice = "";


  if (
    data.imageObj
    && data.imageObj.base64Data
  ) {
    parts.push({
      inlineData: {
        mimeType:
          data.imageObj.mimeType
          || "image/jpeg",

        data:
          data.imageObj.base64Data
      }
    });


    imageNotice = `
첨부된 홍보용 포스터 또는 리플렛 이미지를 확인한다.

이미지에서 명확하게 확인되는 프로그램명, 운영기간, 접수기간, 대상, 장소, 비용, 문의처 등의 정보만 사용한다.

판독이 어렵거나 이미지에 없는 정보는 임의로 추정하지 않는다.
`.trim();
  }


  const normalizedData = {
    promoType:
      data.promoType
      || "강좌",

    title:
      data.title
      || "",

    eduDate:
      data.eduDate
      || "",

    regDate:
      data.regDate
      || "",

    target:
      data.target
      || "",

    place:
      data.place
      || "",

    cost:
      data.cost
      || "",

    content:
      data.content
      || "",

    contact:
      data.contact
      || APP_CONFIG.PROMO_CONTACT
  };


  parts.push({
    text:
      buildPromoPrompt_(
        normalizedData,
        imageNotice
      )
  });


  const payload = {
    contents: [
      {
        parts:
          parts
      }
    ],

    generationConfig: {
      temperature:
        0.5,

      topP:
        0.9,

      maxOutputTokens:
        8192
    }
  };


  const response =
    callGeminiText_(
      payload
    );


  return splitPromoResponse_(
    response
  );
}


/**
 * index.html에서 google.script.run으로 호출하는 공개 함수입니다.
 */
function processWebPromoRequest(formData) {
  try {
    if (
      !formData
      || typeof formData !== "object"
    ) {
      throw new Error(
        "홍보문 생성에 필요한 입력 데이터가 전달되지 않았습니다."
      );
    }


    const hasImage =
      Boolean(
        formData.imageObj
        && formData.imageObj.base64Data
      );


    const hasTitle =
      Boolean(
        String(
          formData.title
          || ""
        ).trim()
      );


    if (
      !hasImage
      && !hasTitle
    ) {
      throw new Error(
        "포스터 이미지를 등록하거나 강좌·행사명을 입력해 주세요."
      );
    }


    return {
      success:
        true,

      data:
        callGeminiFromWeb(
          formData
        )
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


// ==========================================================================
// Gemini 응답 분리
// ==========================================================================

/**
 * [구분선]을 기준으로 홈페이지·인스타그램·포스터 결과를 분리합니다.
 */
function splitPromoResponse_(text) {
  const parts =
    String(
      text
      || ""
    )
      .split(
        /\[\s*구\s*분\s*선\s*\]/g
      )
      .map(function(value) {
        return value.trim();
      })
      .filter(function(value) {
        return value.length > 0;
      });


  if (parts.length < 3) {
    throw new Error(
      "AI 응답의 [구분선] 형식이 올바르지 않아 결과를 분리하지 못했습니다."
    );
  }


  return {
    homepage:
      removePromoHeading_(
        parts[0],
        [
          "① 홈페이지용 공지문",
          "홈페이지용 공지문"
        ]
      ),

    instagram:
      removePromoHeading_(
        parts[1],
        [
          "② 인스타그램용 홍보문",
          "인스타그램용 홍보문"
        ]
      ),

    poster:
      removePromoHeading_(
        parts
          .slice(2)
          .join("\n"),
        [
          "③ 홍보 포스터용 원고",
          "홍보 포스터용 원고"
        ]
      )
  };
}


/**
 * AI 응답 첫 줄에 포함된 채널 제목을 제거합니다.
 */
function removePromoHeading_(
  text,
  headings
) {
  let result =
    String(
      text
      || ""
    ).trim();


  headings.forEach(function(heading) {
    result =
      result.replace(
        new RegExp(
          "^\\s*"
          + escapeRegex_(heading)
          + "\\s*",
          "i"
        ),
        ""
      );
  });


  return result.trim();
}


// ==========================================================================
// 공통 오류 표시
// ==========================================================================

/**
 * 스프레드시트 메뉴 실행 중 발생한 오류를 표시합니다.
 */
function showError(message) {
  SpreadsheetApp
    .getUi()
    .alert(
      "알림",
      message
      || "오류가 발생했습니다.",
      SpreadsheetApp
        .getUi()
        .ButtonSet
        .OK
    );
}
