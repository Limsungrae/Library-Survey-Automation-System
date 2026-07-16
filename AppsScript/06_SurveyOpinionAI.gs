/**
 * ==========================================================================
 * 성남시중원도서관 만족도 조사 자동화 시스템
 * 주관식 의견 AI 분석 및 보고서 문안 생성
 * ==========================================================================
 *
 * 담당 기능
 * 1. 자유의견 의미 범주 분류
 * 2. 대표 의견 요약
 * 3. AI 총평 초안 생성
 * 4. 향후계획 초안 생성
 *
 * 검증 원칙
 * - Gemini는 의견을 범주에 배정하고 대표 의견을 요약합니다.
 * - 범주별 건수는 Apps Script가 참여자 번호를 기준으로 직접 계산합니다.
 * - AI가 임의로 작성한 count 값은 사용하지 않습니다.
 */


/**
 * 자유의견을 AI로 의미 범주에 분류합니다.
 *
 * @param {Array<Object>} data 설문 원자료 객체 배열
 * @return {Object} 주관식 분석 결과
 */
function analyzeOpinionsWithAI_(data) {

  const comments =
    data
      .map(function(row, index) {
        return {
          no:
            String(
              row["참여자 번호"]
              || index + 1
            ),

text:
  maskPersonalInfo_(
    row["자유의견"]
  )
        };
      })
      .filter(function(item) {
        return isValidOpinion_(
          item.text
        );
      });


  // 유효한 주관식 의견이 없는 경우
  if (
    comments.length === 0
  ) {
    return {
      validCount:
        0,

      categories:
        APP_CONFIG
          .OPINION_CATEGORIES
          .map(function(category) {
            return {
              category:
                category,

              count:
                0,

              participantNumbers:
                [],

              representativeOpinions:
                []
            };
          })
    };
  }


  const prompt = `
다음은 ${APP_CONFIG.LIBRARY_NAME} 공간혁신 및 정보기술 서비스 만족도 조사의 비식별 자유의견이다.

각 의견을 아래 의미 범주 중 하나 이상으로 분류한다.

분류 범주:
${APP_CONFIG.OPINION_CATEGORIES
  .map(function(category, index) {
    return (
      (index + 1)
      + ". "
      + category
    );
  })
  .join("\n")}

분류 규칙:
- 한 의견이 여러 주제를 포함하면 여러 범주에 중복 분류할 수 있다.
- 각 범주에는 해당하는 참여자 번호만 기록한다.
- 참여자 번호는 입력 자료에 존재하는 번호만 사용한다.
- 존재하지 않는 참여자 번호를 만들지 않는다.
- 자료에 없는 내용을 추가하거나 추정하지 않는다.
- 개인정보처럼 보이는 내용은 대표 의견에 포함하지 않는다.
- 대표 의견은 원문을 길게 복사하지 않고 의미를 정중하게 요약한다.
- 모든 범주를 반드시 결과에 포함한다.
- 해당 의견이 없는 범주는 participantNumbers를 빈 배열로 작성한다.
- count 값은 출력하지 않는다.

자유의견:
${comments
  .map(function(item) {
    return (
      "["
      + item.no
      + "] "
      + item.text
    );
  })
  .join("\n")}
`.trim();


  const schemaText = `{
  "categories": [
    {
      "category": "범주명",
      "participantNumbers": ["1", "2"],
      "representativeOpinions": [
        "대표 의견 요약"
      ]
    }
  ]
}`;


  const result =
    callGeminiJson_(
      prompt,
      schemaText
    );


  const validParticipantNumbers =
    new Set(
      comments.map(function(item) {
        return String(
          item.no
        );
      })
    );


  const categoryMap = {};


  const resultCategories =
    result
    && Array.isArray(
      result.categories
    )
      ? result.categories
      : [];


  resultCategories
    .forEach(function(item) {

      const categoryName =
        cleanText_(
          item.category
        );


      if (
        !APP_CONFIG
          .OPINION_CATEGORIES
          .includes(
            categoryName
          )
      ) {
        return;
      }


      const rawParticipantNumbers =
        Array.isArray(
          item.participantNumbers
        )
          ? item.participantNumbers
          : [];


      // AI가 반환한 번호 중 실제 존재하는 번호만 인정합니다.
      const participantNumbers =
        rawParticipantNumbers
          .map(function(value) {
            return String(
              value
            ).trim();
          })
          .filter(function(value) {
            return validParticipantNumbers.has(
              value
            );
          })
          .filter(function(value, index, array) {
            return (
              array.indexOf(value)
              === index
            );
          });


      const representativeOpinions =
        Array.isArray(
          item.representativeOpinions
        )
          ? item
              .representativeOpinions
              .map(
                cleanText_
              )
              .filter(Boolean)
              .slice(
                0,
                3
              )
          : [];


      categoryMap[
        categoryName
      ] = {
        category:
          categoryName,

        participantNumbers:
          participantNumbers,

        count:
          participantNumbers.length,

        representativeOpinions:
          representativeOpinions
      };
    });


  const categories =
    APP_CONFIG
      .OPINION_CATEGORIES
      .map(function(category) {

        return (
          categoryMap[category]
          || {
            category:
              category,

            participantNumbers:
              [],

            count:
              0,

            representativeOpinions:
              []
          }
        );
      })
      .sort(function(a, b) {

        return (
          b.count - a.count
          || a.category.localeCompare(
            b.category,
            "ko"
          )
        );
      });


  return {
    validCount:
      comments.length,

    categories:
      categories
  };
}


/**
 * 조사결과 총평 초안을 생성합니다.
 *
 * @param {Object} context 통계 및 주관식 분석 컨텍스트
 * @return {string} 총평 초안
 */
function generateAISummaryText_(
  context
) {

  const prompt = `
너는 ${APP_CONFIG.LIBRARY_NAME}의 공공기관 결과보고서 작성 보조자이다.

아래 통계자료만 근거로 「Ⅳ. 총평」 초안을 작성한다.

작성 규칙:
- 각 문단은 "○ "로 시작한다.
- 총 5개 이상 7개 이하의 문단으로 작성한다.
- 공공기관 보고서에 적합한 간결하고 객관적인 문체를 사용한다.
- 전체 응답자 수와 주요 이용자 유형을 포함한다.
- 주요 이용 공간 또는 서비스 결과를 포함한다.
- 주요 인지 경로 결과를 포함한다.
- 6개 만족도 문항의 전체 평균과 긍정률을 포함한다.
- 만족도가 가장 높은 항목과 상대적으로 낮은 항목을 포함한다.
- 재이용·추천 의향 결과를 포함한다.
- 주요 개선 요구와 향후 희망 서비스를 포함한다.
- 주관식 의견 결과가 있는 경우 주요 범주를 포함한다.
- 조사자료에서 확인되지 않은 인과관계, 사업성과, 예산, 일정은 추정하지 않는다.
- 만족도가 절대적으로 높지만 다른 항목보다 낮은 경우
  "상대적으로 낮게 나타남"이라고 표현한다.
- 개선 방향은 확정적으로 단정하지 않고
  "검토할 필요가 있음",
  "운영 시 참고할 필요가 있음"처럼 신중하게 표현한다.
- 동일한 수치나 내용을 불필요하게 반복하지 않는다.
- 마크다운 제목, 별표, 표, 코드블록을 사용하지 않는다.

통계자료:
${JSON.stringify(
  context,
  null,
  2
)}
`.trim();


  return callGeminiText_({
    contents: [
      {
        parts: [
          {
            text:
              prompt
          }
        ]
      }
    ],

    generationConfig: {
      temperature:
        0.2,

      topP:
        0.8,

      maxOutputTokens:
        4096
    }
  });
}


/**
 * 조사결과에 따른 향후계획 초안을 생성합니다.
 *
 * @param {Object} context 통계 및 주관식 분석 컨텍스트
 * @param {string} summaryText 총평 초안
 * @return {string} 향후계획 초안
 */
function generateFuturePlanText_(
  context,
  summaryText
) {

  const prompt = `
너는 ${APP_CONFIG.LIBRARY_NAME}의 공공기관 업무계획 작성 보조자이다.

아래 만족도 조사 통계와 총평 초안만 근거로 「Ⅴ. 향후계획」 초안을 작성한다.

작성 규칙:
- 각 항목은 "○ "로 시작한다.
- 총 4개 이상 6개 이하의 항목으로 작성한다.
- 조사에서 확인된 개선 요구와 향후 서비스 수요에 직접 대응한다.
- 자료로 확인되는 경우 교육 프로그램, 연령별 맞춤 운영,
  공간·장비, 홍보·안내, 운영방식 관련 내용을 포함한다.
- 자료에 근거가 없는 분야는 억지로 포함하지 않는다.
- 확정되지 않은 사업을 이미 결정된 것처럼 표현하지 않는다.
- 예산이 필요한 사항은
  "우선순위와 예산 여건을 검토하여 단계적으로 추진"
  또는 이와 유사한 신중한 표현을 사용한다.
- 조사자료에 없는 사업명, 예산액, 추진 일정, 대상 인원은 만들지 않는다.
- 총평 문장을 그대로 반복하지 않고 실행 방향 중심으로 작성한다.
- 공공기관의 정중하고 신중한 문체를 사용한다.
- 마크다운 제목, 별표, 표, 코드블록을 사용하지 않는다.

통계자료:
${JSON.stringify(
  context,
  null,
  2
)}

총평 초안:
${summaryText}
`.trim();


  return callGeminiText_({
    contents: [
      {
        parts: [
          {
            text:
              prompt
          }
        ]
      }
    ],

    generationConfig: {
      temperature:
        0.2,

      topP:
        0.8,

      maxOutputTokens:
        3072
    }
  });
}
