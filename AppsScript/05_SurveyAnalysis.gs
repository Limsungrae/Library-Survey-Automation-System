/**
 * ==========================================================================
 * 성남시중원도서관 만족도 조사 자동화 시스템
 * 설문 통계 분석 서비스
 * ==========================================================================
 *
 * 담당 기능
 * 1. 09_원자료를 객체 배열로 변환
 * 2. 단일응답 빈도 및 비율 분석
 * 
 * 3. 복수응답 선택건수 비율 및 응답자 선택률 분석
 * 4. 만족도 6개 문항 분석
 * 5. 재이용·추천 의향 분석
 * 6. AI 총평 생성을 위한 통계 컨텍스트 구성
 */


/**
 * 09_원자료 데이터를 객체 배열로 반환합니다.
 *
 * @return {Array<Object>} 설문 응답 객체 배열
 */
function getRawSurveyObjects_() {
  validateRawSheet_();

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        APP_CONFIG.SOURCE_SHEET
      );


  const values =
    sheet
      .getDataRange()
      .getValues();


  const headers =
    values[0].map(function(value) {
      return String(
        value || ""
      ).trim();
    });


  return values
    .slice(1)
    .filter(function(row) {
      return row.some(function(value) {
        return (
          value !== ""
          && value !== null
        );
      });
    })
    .map(function(row) {
      const object = {};

      headers.forEach(function(header, index) {
        object[header] =
          row[index];
      });

      return object;
    });
}


/**
 * 설문 전체 통계를 계산합니다.
 *
 * @param {Array<Object>} data 설문 응답 데이터
 * @return {Object} 설문 분석 결과
 */
function calculateSurveyAnalysis_(data) {
  if (
    !Array.isArray(data)
    || data.length === 0
  ) {
    throw new Error(
      "분석할 설문 데이터가 없습니다."
    );
  }


  const totalRespondents =
    data.length;


  // ------------------------------------------------------------------------
  // 이용자 유형 분석
  // ------------------------------------------------------------------------

  const userTypes =
    frequencySingle_(
      data,
      "정규화 이용자 유형",
      "이용자 유형"
    );


  userTypes.forEach(function(item) {
    item.rate =
      totalRespondents > 0
        ? round_(
            item.count
            / totalRespondents
            * 100,
            1
          )
        : 0;
  });


  // ------------------------------------------------------------------------
  // 복수응답 분석
  // ------------------------------------------------------------------------

  const multiple = {};


  APP_CONFIG.MULTI_COLUMNS
    .forEach(function(config) {
      multiple[config.header] =
        frequencyMultiple_(
          data,
          config.header
        );
    });


  // ------------------------------------------------------------------------
  // 만족도 전체 유효 점수 수집
  // ------------------------------------------------------------------------

  const allScores = [];


  data.forEach(function(row) {
    APP_CONFIG.SCORE_HEADERS
      .forEach(function(header) {
        const score =
          Number(
            row[header]
          );


        if (
          score >= 1
          && score <= 5
        ) {
          allScores.push(
            score
          );
        }
      });
  });


  const overallAverage =
    allScores.length > 0
      ? round_(
          average_(
            allScores
          ),
          2
        )
      : 0;


  const overallPositiveRate =
    allScores.length > 0
      ? round_(
          allScores.filter(
            function(score) {
              return score >= 4;
            }
          ).length
          / allScores.length
          * 100,
          1
        )
      : 0;


  // ------------------------------------------------------------------------
  // 문항별 만족도 및 추천 의향 분석
  // ------------------------------------------------------------------------

  const satisfaction =
    calculateSatisfaction_(
      data,
      overallAverage
    );


  const recommendation =
    calculateRecommendation_(
      data
    );


  return {
    totalRespondents:
      totalRespondents,

    validSatisfactionResponses:
      allScores.length,

    userTypes:
      userTypes,

    multiple:
      multiple,

    satisfaction:
      satisfaction,

    recommendation:
      recommendation,

    overallAverage:
      overallAverage,

    overallConverted100:
      round_(
        overallAverage * 20,
        1
      ),

    overallPositiveRate:
      overallPositiveRate
  };
}


/**
 * 단일응답 문항의 빈도수를 분석합니다.
 *
 * @param {Array<Object>} data 설문 응답 데이터
 * @param {string} preferredHeader 우선 사용할 컬럼명
 * @param {string} fallbackHeader 대체 컬럼명
 * @return {Array<Object>} 빈도 분석 결과
 */
function frequencySingle_(
  data,
  preferredHeader,
  fallbackHeader
) {
  const counts = {};


  data.forEach(function(row) {
    const value =
      cleanText_(
        row[preferredHeader]
        || row[fallbackHeader]
      )
      || "미응답";


    counts[value] =
      (
        counts[value]
        || 0
      )
      + 1;
  });


  return Object.keys(
    counts
  )
    .map(function(label) {
      return {
        label:
          label,

        count:
          counts[label]
      };
    })
    .sort(function(a, b) {
      return (
        b.count - a.count
        || a.label.localeCompare(
          b.label,
          "ko"
        )
      );
    });
}


/**
 * 복수응답 문항을 분석합니다.
 *
 * 선택건수 비율:
 * 해당 항목 선택건수 ÷ 전체 선택건수
 *
 * 응답자 선택률:
 * 해당 항목 선택건수 ÷ 전체 응답자 수
 *
 * @param {Array<Object>} data 설문 응답 데이터
 * @param {string} header 분석할 컬럼명
 * @return {Array<Object>} 복수응답 분석 결과
 */
function frequencyMultiple_(
  data,
  header
) {
  const counts = {};

  let totalSelections = 0;
  let respondentsWithAnswer = 0;


  data.forEach(function(row) {
    const items =
      splitMultiValue_(
        row[header]
      );


    if (
      items.length > 0
    ) {
      respondentsWithAnswer++;
    }


    items.forEach(function(item) {
      counts[item] =
        (
          counts[item]
          || 0
        )
        + 1;

      totalSelections++;
    });
  });


  return Object.keys(
    counts
  )
    .map(function(label) {
      const count =
        counts[label];


      return {
        label:
          label,

        count:
          count,

        totalSelections:
          totalSelections,

        respondentsWithAnswer:
          respondentsWithAnswer,

        selectionShare:
          totalSelections > 0
            ? round_(
                count
                / totalSelections
                * 100,
                1
              )
            : 0,

        respondentRate:
          data.length > 0
            ? round_(
                count
                / data.length
                * 100,
                1
              )
            : 0,

        validRespondentRate:
          respondentsWithAnswer > 0
            ? round_(
                count
                / respondentsWithAnswer
                * 100,
                1
              )
            : 0
      };
    })
    .sort(function(a, b) {
      return (
        b.count - a.count
        || a.label.localeCompare(
          b.label,
          "ko"
        )
      );
    });
}


/**
 * 만족도 6개 문항을 분석합니다.
 *
 * @param {Array<Object>} data 설문 응답 데이터
 * @param {number} overallAverage 만족도 전체 유효점수 평균
 * @return {Array<Object>} 문항별 만족도 분석 결과
 */
function calculateSatisfaction_(
  data,
  overallAverage
) {
  const result =
    APP_CONFIG.SCORE_HEADERS
      .map(function(
        header,
        index
      ) {
        const scores =
          data
            .map(function(row) {
              return Number(
                row[header]
              );
            })
            .filter(function(score) {
              return (
                score >= 1
                && score <= 5
              );
            });


        const distribution = {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0
        };


        scores.forEach(function(score) {
          distribution[score]++;
        });


        const average =
          scores.length > 0
            ? average_(
                scores
              )
            : 0;


        const positiveCount =
          scores.filter(function(score) {
            return score >= 4;
          }).length;


        const neutralCount =
          scores.filter(function(score) {
            return score === 3;
          }).length;


        const negativeCount =
          scores.filter(function(score) {
            return score <= 2;
          }).length;


        return {
          header:
            header,

          questionNo:
            "Q" + (index + 1),

          label:
            APP_CONFIG
              .QUESTION_LABELS[index],

          validCount:
            scores.length,

          missingCount:
            data.length
            - scores.length,

          distribution:
            distribution,

          average:
            round_(
              average,
              2
            ),

          converted100:
            round_(
              average * 20,
              1
            ),

          positiveCount:
            positiveCount,

          positiveRate:
            scores.length > 0
              ? round_(
                  positiveCount
                  / scores.length
                  * 100,
                  1
                )
              : 0,

          neutralCount:
            neutralCount,

          neutralRate:
            scores.length > 0
              ? round_(
                  neutralCount
                  / scores.length
                  * 100,
                  1
                )
              : 0,

          negativeCount:
            negativeCount,

          negativeRate:
            scores.length > 0
              ? round_(
                  negativeCount
                  / scores.length
                  * 100,
                  1
                )
              : 0,

          deviation:
            round_(
              average
              - overallAverage,
              2
            )
        };
      });


  // 평균이 높은 순서대로 순위를 부여합니다.
  const ranked =
    result
      .slice()
      .sort(function(a, b) {
        return (
          b.average - a.average
        );
      });


  let previousAverage = null;
  let previousRank = 0;


  ranked.forEach(function(item, index) {
    let rank;


    if (
      previousAverage !== null
      && item.average === previousAverage
    ) {
      rank =
        previousRank;

    } else {
      rank =
        index + 1;
    }


    const originalItem =
      result.find(function(value) {
        return (
          value.header
          === item.header
        );
      });


    originalItem.rank =
      rank;


    previousAverage =
      item.average;

    previousRank =
      rank;
  });


  return result;
}


/**
 * 재이용·추천 의향을 분석합니다.
 *
 * @param {Array<Object>} data 설문 응답 데이터
 * @return {Object} 추천 의향 분석 결과
 */
function calculateRecommendation_(
  data
) {
  const scores =
    data
      .map(function(row) {
        const existingScore =
          Number(
            row["추천점수"]
          );


        return (
          existingScore >= 1
          && existingScore <= 5
        )
          ? existingScore
          : scoreFromText_(
              row["재이용·추천"]
            );
      })
      .filter(function(score) {
        return (
          score >= 1
          && score <= 5
        );
      });


  const distribution = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0
  };


  scores.forEach(function(score) {
    distribution[score]++;
  });


  const positiveCount =
    scores.filter(function(score) {
      return score >= 4;
    }).length;


  const neutralCount =
    scores.filter(function(score) {
      return score === 3;
    }).length;


  const negativeCount =
    scores.filter(function(score) {
      return score <= 2;
    }).length;


  return {
    validCount:
      scores.length,

    missingCount:
      data.length
      - scores.length,

    distribution:
      distribution,

    average:
      scores.length > 0
        ? round_(
            average_(
              scores
            ),
            2
          )
        : 0,

    converted100:
      scores.length > 0
        ? round_(
            average_(
              scores
            )
            * 20,
            1
          )
        : 0,

    positiveCount:
      positiveCount,

    positiveRate:
      scores.length > 0
        ? round_(
            positiveCount
            / scores.length
            * 100,
            1
          )
        : 0,

    neutralCount:
      neutralCount,

    neutralRate:
      scores.length > 0
        ? round_(
            neutralCount
            / scores.length
            * 100,
            1
          )
        : 0,

    negativeCount:
      negativeCount,

    negativeRate:
      scores.length > 0
        ? round_(
            negativeCount
            / scores.length
            * 100,
            1
          )
        : 0
  };
}


/**
 * AI 총평과 향후계획 생성에 사용할 통계 컨텍스트를 구성합니다.
 *
 * @param {Object} analysis 통계 분석 결과
 * @param {Object|null} opinion 주관식 의견 분석 결과
 * @return {Object} AI 전달용 데이터
 */
function buildAnalysisContext_(
  analysis,
  opinion
) {
  const satisfactionDescending =
    analysis.satisfaction
      .slice()
      .sort(function(a, b) {
        return (
          b.average - a.average
        );
      });


  const satisfactionAscending =
    analysis.satisfaction
      .slice()
      .sort(function(a, b) {
        return (
          a.average - b.average
        );
      });


  const highestSatisfaction =
    satisfactionDescending.length
      ? satisfactionDescending[0]
      : null;


  const lowestSatisfaction =
    satisfactionAscending.length
      ? satisfactionAscending[0]
      : null;


  return {
    totalRespondents:
      analysis.totalRespondents,

    validSatisfactionResponses:
      analysis.validSatisfactionResponses,

    overallAverage:
      analysis.overallAverage,

    overallConverted100:
      analysis.overallConverted100,

    overallPositiveRate:
      analysis.overallPositiveRate,

    recommendation:
      analysis.recommendation,

    recommendationPositiveRate:
      analysis.recommendation
        .positiveRate,

    topUserType:
      analysis.userTypes.length
        ? analysis.userTypes[0]
        : null,

    userTypes:
      analysis.userTypes,

    topServices:
      (
        analysis.multiple[
          "이용 공간·서비스(복수)"
        ]
        || []
      ).slice(
        0,
        5
      ),

    topChannels:
      (
        analysis.multiple[
          "인지 경로(복수)"
        ]
        || []
      ).slice(
        0,
        5
      ),

    topImprovements:
      (
        analysis.multiple[
          "개선 필요사항(복수)"
        ]
        || []
      ).slice(
        0,
        5
      ),

    topFuture:
      (
        analysis.multiple[
          "향후 희망 서비스(복수)"
        ]
        || []
      ).slice(
        0,
        5
      ),

    highestSatisfaction:
      highestSatisfaction,

    lowestSatisfaction:
      lowestSatisfaction,

    satisfaction:
      analysis.satisfaction,

    opinionValidCount:
      opinion
      && opinion.validCount
        ? opinion.validCount
        : 0,

    opinionCategories:
      opinion
      && Array.isArray(
        opinion.categories
      )
        ? opinion.categories
        : []
  };
}
