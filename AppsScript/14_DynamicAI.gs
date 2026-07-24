/**
 * ==========================================================================
 * 성남시중원도서관 만족도 조사 자동화 시스템
 * 범용 설문 Gemini AI 분석
 * ==========================================================================
 *
 * 담당 기능
 * 1. 범용 주관식 의견의 비식별 의미 범주 분류
 * 2. 범주별 건수와 대표 의견 검증
 * 3. 06_주관식분석 시트 갱신
 * 4. 07_AI총평 시트 생성
 * 5. 08_향후계획 시트 생성
 *
 * 기존 공통 기능 재사용
 * - callGeminiJson_()
 * - callGeminiText_()
 * - calculateDynamicSurveyAnalysis_()
 * - getSurveySettings_()
 * - cleanText_()
 *
 * 검증 원칙
 * - Gemini가 반환한 건수를 그대로 사용하지 않습니다.
 * - 실제 원자료에 존재하는 응답 번호만 인정합니다.
 * - 개인정보로 보이는 문자열은 Gemini 전달 전에 마스킹합니다.
 * - 자료에 없는 원인, 정책, 예산, 일정은 생성하지 않습니다.
 */


/**
 * 범용 AI 보고서 전체를 생성합니다.
 * 생성 시트: 06_주관식분석, 07_AI총평, 08_향후계획
 *
 * @return {Object} 생성 결과 리포트 오브젝트
 */
function generateDynamicAIReport(onStage) {
  let lock=null;
  const updateStage = typeof onStage === "function"
    ? onStage
    : function() {};
  try {
    updateStage("조사 설정 조회");
    const settings=getSurveySettings_();
    updateStage("동적 분석 결과 조회");
    const source=getDynamicSurveySource_();
    const analysis=calculateDynamicSurveyAnalysis_(source);
    updateStage("통계 품질검사");
    const quality=validateDynamicSurveyQuality_(analysis,source);
    if(!quality.aiAllowed){
      updateStage("AI 차단 결과 시트 생성");
      createDynamicAIBlockedSheet_(quality);
      return {success:false,message:"통계 품질검사 실패로 AI 보고서 생성을 중단했습니다.",
        error:"품질검사 오류를 먼저 해결해 주세요.",quality:quality,generatedSheets:["09_AI총평"]};
    }
    // 외부 호출 중에는 ScriptLock을 보유하지 않습니다.
    const opinionAnalysis=analyzeDynamicOpinionsWithAI_(analysis,settings,updateStage);
    updateStage("검증된 AI 컨텍스트 생성");
    const context=buildDynamicAIContext_(analysis,opinionAnalysis,settings,quality);
    updateStage("Gemini 총평 요청");
    const summaryText=generateDynamicAISummaryText_(context);
    updateStage("Gemini 총평 응답 처리");
    updateStage("Gemini 향후계획 요청");
    const futurePlanText=generateDynamicFuturePlanText_(context,summaryText);
    updateStage("Gemini 향후계획 응답 처리");
    updateStage("보고서 저장 잠금 획득");
    lock=LockService.getScriptLock();lock.waitLock(30000);
    updateStage("08_주관식분석 시트 생성");
    createDynamicAIOpinionSheet_(analysis,opinionAnalysis);
    updateStage("09_AI총평 시트 생성");
    createDynamicAITextSheet_("09_AI총평","AI 총평",summaryText,
      "※ 품질검사를 통과한 집계와 비식별 의견만 사용한 Gemini 초안입니다. 담당자 검토가 필요합니다.");
    updateStage("10_향후계획 시트 생성");
    createDynamicAITextSheet_("10_향후계획","향후계획",futurePlanText,
      "※ 확정 정책·예산·일정이 아닌 검토용 초안입니다.");
    updateStage("AI 보고서 시트 정렬 및 저장");
    moveDynamicAISheetsInOrder_();SpreadsheetApp.flush();
    const generatedSheets=["08_주관식분석","09_AI총평","10_향후계획"];
    const summary={validOpinionCount:opinionAnalysis.validCount,categoryCount:opinionAnalysis.categories.length};
    return {success:true,message:"범용 AI 보고서 생성이 완료되었습니다.",
      generatedSheets:generatedSheets,quality:quality,summary:summary};
  } catch(error){throw new Error(error&&error.message?error.message:String(error));}
  finally{if(lock){try{lock.releaseLock();}catch(ignored){}}}
}

function createDynamicAIBlockedSheet_(quality) {
  const sheet=getOrResetDynamicAISheet_("09_AI총평");setDynamicAISheetTitle_(sheet,"AI 총평 생성 차단",8);
  const rows=[["수준","코드","문항","오류"]].concat((quality.errors||[]).map(function(item){return [item.level,item.code,item.questionId,item.message];}));
  sheet.getRange(4,1,rows.length,4).setValues(rows);styleDynamicAIHeader_(sheet.getRange(4,1,1,4));
  if(rows.length>1)styleDynamicAITable_(sheet.getRange(4,1,rows.length,4));
}

/**
 * 웹페이지(UI) 단에서 범용 AI 보고서 생성 요청이 올 때 호출하는 안전한 실행 함수입니다.
 *
 * @return {Object} 성공 또는 에러 객체 반환
 */
function generateDynamicAIReportFromWeb() {
  let currentStage = "AI 보고서 요청 시작";
  try {
    const result = generateDynamicAIReport(function(stage) {
      currentStage = stage;
      console.log("Dynamic AI 단계:", currentStage);
    });

    if (result && result.success === true) {
      console.log("Dynamic AI 반환 직전", {
        generatedSheets: result.generatedSheets,
        summary: result.summary
      });
    }

    return result;
  } catch (error) {
    console.error(
      "Dynamic AI 실패 단계:",
      currentStage,
      error && error.stack ? error.stack : error
    );
    return {
      success: false,
      error: "AI 보고서 생성 실패 (" + currentStage + "): "
        + (error && error.message ? error.message : String(error))
    };
  }
}


/**
 * 범용 주관식 의견을 Gemini AI로 전달하여 의미 범주로 분류합니다.
 * AI가 분류하되, 유효성 검증과 건수 계산은 실제 원자료 데이터를 기준으로 코드가 재계산합니다.
 *
 * @param {Object} analysis 범용 통계 분석 결과
 * @param {Object} settings 조사 설정
 * @return {Object} AI 분석 및 검증이 완료된 데이터 구조
 */
function analyzeDynamicOpinionsWithAI_(analysis, settings, onStage) {
  const updateStage = typeof onStage === "function"
    ? onStage
    : function() {};
  updateStage("주관식 의견 수집 및 개인정보 마스킹");
  const opinions = []; // AI에게 보낼 정돈된 의견들을 담을 배열

  // 분석 데이터 내 텍스트 문항 배열을 순회합니다.
  (analysis.text || []).forEach(function(question) {
    // 각 주관식 문항 안에 들어있는 개별 답변(의견)들을 순회합니다.
    (question.opinions || []).forEach(function(opinion) {
      opinions.push({
        // 문항 고유 컬럼 번호와 응답 행 번호를 조합하여 고유 ID를 만듭니다 (예: "11-4")
        id: String(question.columnNumber) + "-" + String(opinion.responseNumber),
        responseNumber: String(opinion.responseNumber), // 응답 번호
        question: cleanText_(question.question),       // 줄바꿈이나 공백을 정리한 질문 문항 텍스트
        text: maskDynamicPersonalInfo_(opinion.text)   // 개인정보(전화번호, 이메일)를 마스킹 처리한 답변 원문
      });
    });
  });

  // 분석할 유효한 주관식 의견이 하나도 없다면 빈 결과 구조를 즉시 반환합니다.
  if (opinions.length === 0) {
    return {
      validCount: 0,
      categories: [],
      opinionAssignments: []
    };
  }

  // 만족도 조사 이름을 가져옵니다. 값이 없으면 '만족도 조사'로 기본값을 지정합니다.
  const surveyName = getDynamicAISetting_(settings, "조사명", "surveyName") || "만족도 조사";

  // Gemini AI에게 요청할 지시사항(프롬프트)을 작성합니다.
  const prompt = `
너는 공공도서관 만족도 조사 주관식 의견을 분류하는 분석 보조자이다.

조사명:
${surveyName}

아래 의견만을 근거로 의미가 유사한 의견을 범주화한다.

분류 원칙:
- 자료에 실제로 나타난 내용만 사용한다.
- 범주는 최소 2개, 최대 8개로 구성한다.
- 단순 감사·칭찬·만족 표현은 필요하면 "긍정 의견 및 감사" 범주로 묶는다.
- 구체적인 개선 요구가 없는 긍정 표현을 개선 요구로 확대 해석하지 않는다.
- 한 의견에 여러 의미가 있으면 최대 2개 범주에 중복 배정할 수 한다.
- categoryName은 짧고 공공기관 보고서에 적합한 명사형 문구로 작성한다.
- sentiment는 POSITIVE, NEGATIVE, SUGGESTION, INCONVENIENCE, OTHER 중 하나로 작성한다.
- opinionIds에는 아래 입력에 존재하는 ID만 사용한다.
- 존재하지 않는 ID를 만들지 않는다.
- 대표 의견은 원문을 길게 복사하지 말고 핵심 의미를 1문장으로 요약한다.
- 개인정보, 기관명, 담당자명, 연락처를 대표 의견에 포함하지 않는다.
- count 값은 출력하지 않는다.
- JSON 이외의 설명을 출력하지 않는다.

의견 목록:
${opinions
  .map(function(item) {
    // 각 의견을 [ID] 문항: 내용 / 의견: 내용 형태로 가공하여 줄바꿈으로 연결합니다.
    return "[" + item.id + "] " + "문항: " + item.question + " / 의견: " + item.text;
  })
  .join("\n")}
`.trim();

  // AI가 반드시 지켜서 응답해야 하는 구조화된 JSON 형식을 지정합니다.
  const schemaText = `{
  "categories": [
    {
      "categoryName": "범주명",
      "sentiment": "SUGGESTION",
      "opinionIds": ["11-4", "11-7"],
      "representativeOpinions": [
        "대표 의견 요약"
      ]
    }
  ]
}`;

  // 공통 라이브러리 함수를 호출하여 AI로부터 규칙에 맞는 JSON 답변을 받아옵니다.
  updateStage("Gemini 주관식 분류 요청");
  const result = callGeminiJson_(prompt, schemaText, function() {
    updateStage("Gemini 주관식 분류 응답 파싱");
  });

  // 데이터 검증을 위해 원본 의견들의 고유 ID를 key로 가지는 맵(Map)을 생성합니다.
  const validOpinionMap = {};
  opinions.forEach(function(item) {
    validOpinionMap[item.id] = item;
  });

  const categoryNameSet = new Set(); // 중복 카테고리 발생 방지용 셋
  const categories = [];             // 검증이 완료된 최종 카테고리들을 담을 배열

  // AI가 준 응답에서 카테고리 배열을 추출합니다. (없으면 빈 배열)
  const rawCategories = result && Array.isArray(result.categories) ? result.categories : [];

  // 최대 8개까지만 카테고리를 처리하도록 제한합니다.
  rawCategories.slice(0, 8).forEach(function(categoryItem) {
    // 카테고리 이름을 가져와 깨끗하게 텍스트를 정리합니다.
    let categoryName = cleanText_(categoryItem.categoryName || categoryItem.category);

    if (!categoryName) return; // 카테고리명이 비어있으면 건너뜁니다.
    if (categoryNameSet.has(categoryName)) return; // 이미 등록된 중복 카테고리명 대피 건너뜁니다.

    categoryNameSet.add(categoryName); // 셋에 카테고리명 등록

    // AI가 분류해 준 해당 카테고리 소속 의견 ID 목록을 가져옵니다.
    const rawIds = Array.isArray(categoryItem.opinionIds) ? categoryItem.opinionIds : [];

    // 중요: AI가 지어낸 가짜 ID가 아닌, 실제 원본 데이터(validOpinionMap)에 있는 ID만 필터링합니다.
    const opinionIds = rawIds
      .map(function(value) {
        return String(value).trim();
      })
      .filter(function(id) {
        return Boolean(validOpinionMap[id]); // 실제 존재하는 ID만 남김 (검증 핵심)
      })
      .filter(function(id, index, array) {
        return array.indexOf(id) === index; // 중복으로 들어온 ID 제거
      });

    // AI가 작성한 카테고리별 요약 대표 의견을 최대 3개까지만 가져옵니다.
    const representativeOpinions = Array.isArray(categoryItem.representativeOpinions)
      ? categoryItem.representativeOpinions.map(function(value) {
          return maskDynamicPersonalInfo_(cleanText_(value));
        }).filter(Boolean).slice(0, 3)
      : [];

    // 검증된 정보와 실제 매핑된 데이터 건수를 기반으로 최종 카테고리 객체를 생성하여 배열에 추가합니다.
    categories.push({
      category: categoryName,
      sentiment: ["POSITIVE", "NEGATIVE", "SUGGESTION", "INCONVENIENCE", "OTHER"]
        .indexOf(cleanText_(categoryItem.sentiment).toUpperCase()) >= 0
          ? cleanText_(categoryItem.sentiment).toUpperCase() : "OTHER",
      count: opinionIds.length, // AI가 준 값이 아닌, 실제 유효 필터링을 거친 건수를 기록!
      opinionIds: opinionIds,
      responseNumbers: opinionIds.map(function(id) {
        return validOpinionMap[id].responseNumber; // 각 ID에 매칭되는 실제 설문 응답 행 번호 리스트
      }),
      representativeOpinions: representativeOpinions
    });
  });

  // 분류 건수가 많은 카테고리 순으로 내림차순 정렬합니다. 건수가 같으면 가나다순 정렬합니다.
  categories.sort(function(a, b) {
    return b.count - a.count || a.category.localeCompare(b.category, "ko");
  });

  const assignedIds = {};
  categories.forEach(function(category) {
    category.opinionIds.forEach(function(id) { assignedIds[id] = true; });
  });
  const unassignedIds = opinions.map(function(item) { return item.id; }).filter(function(id) {
    return !assignedIds[id];
  });
  if (unassignedIds.length > 0) {
    categories.push({category: "미분류 의견", sentiment: "OTHER", count: unassignedIds.length,
      opinionIds: unassignedIds, responseNumbers: unassignedIds.map(function(id) {
        return validOpinionMap[id].responseNumber;
      }), representativeOpinions: []});
  }

  // 역으로, 원본 의견별로 본인이 어떤 카테고리들에 매핑되었는지 정리(역인덱싱)합니다.
  const opinionAssignments = opinions.map(function(opinion) {
    const matchedCategories = categories
      .filter(function(category) {
        return category.opinionIds.includes(opinion.id); // 해당 의견 ID를 포함하고 있는 카테고리 필터링
      })
      .map(function(category) {
        return category.category; // 카테고리 이름만 추출
      });

    return {
      id: opinion.id,
      responseNumber: opinion.responseNumber,
      question: opinion.question,
      text: opinion.text,
      categories: matchedCategories // 배정된 카테고리 리스트 (없으면 빈 배열)
    };
  });

  // 최종 분석 완료 결과물을 묶어서 반환합니다.
  return {
    validCount: opinions.length,           // 전체 유효 의견 건수
    categories: categories,               // 카테고리별 통계 및 요약
    opinionAssignments: opinionAssignments // 개별 의견별 카테고리 매핑 리스트
  };
}


/**
 * 총평·향후계획 작성을 위해 전달할 통계 및 주관식 요약 데이터를 정돈된 하나의 오브젝트(컨텍스트)로 구성합니다.
 *
 * @param {Object} analysis 범용 통계 분석 결과
 * @param {Object} opinionAnalysis 주관식 AI 분석 결과
 * @param {Object} settings 조사 설정
 * @return {Object} AI에 주입할 정제된 팩트 데이터 셋
 */
function buildDynamicAIContext_(analysis, opinionAnalysis, settings, quality) {
  return {
    // 1. 설문조사 기본 개요 정보
    survey: {
      title: getDynamicAISetting_(settings, "조사명", "surveyName"),
      purpose: getDynamicAISetting_(settings, "조사목적", "surveyPurpose"),
      period: getDynamicAISetting_(settings, "조사기간", "surveyPeriod"),
      target: getDynamicAISetting_(settings, "조사대상", "surveyTarget"),
      method: getDynamicAISetting_(settings, "조사방법", "surveyMethod")
    },

    quality: quality || null,
    respondentCount: analysis.respondentCount, // 총 응답자 수
    satisfactionSummary: analysis.scaleSummary, // 척도(만족도) 문항 종합 요약 점수

    // 2. 개별 만족도 척도 문항 통계 데이터 매핑
    satisfactionQuestions: (analysis.scale || []).map(function(item) {
      return {
        question: item.question,         // 문항 내용
        validCount: item.validCount,     // 유효 응답 수
        average: item.average,           // 5점 만점 기준 평균
        converted100: item.converted100, // 100점 환산 점수
        positiveRate: item.positiveRate, // 긍정 응답률 (%)
        neutralRate: item.neutralRate,   // 보통 응답률 (%)
        negativeRate: item.negativeRate, // 부정 응답률 (%)
        rank: item.rank,                 // 전체 만족도 문항 중 순위
        deviation: item.deviation        // 전체 가중평균 대비 차이
      };
    }),

    // 3. 순수 추천고객지수(NPS) 또는 추천 여부 문항 통계 데이터 매핑
    recommendation: (analysis.recommendation || []).map(function(item) {
      return {
        question: item.question,
        validCount: item.validCount,
        average: item.average,
        converted100: item.converted100,
        positiveRate: item.positiveRate,
        neutralRate: item.neutralRate,
        negativeRate: item.negativeRate
        ,scaleKind: item.scaleKind
        ,nps: item.nps
      };
    }),

    // 4. 다중 선택(복수 응답) 문항 통계 데이터 매핑
    multipleResponses: (analysis.multiple || []).map(function(question) {
      return {
        question: question.question,
        totalRespondentCount: question.totalRespondentCount, // 총 대상자 수
        validRespondentCount: question.validRespondentCount, // 실제 응답자 수
        totalSelectionCount: question.totalSelectionCount,   // 총 선택된 보기 개수
        items: question.items                                 // 보기별 선택 건수 및 비율 배열
      };
    }),

    // 5. 응답자 인구통계학적 특성(성별, 연령대 등 단일선택 문항 결과) 결합
    respondentCharacteristics: (analysis.respondent || []).concat(analysis.single || []),

    // 6. 앞에서 스크립트가 철저히 팩트 체크하여 검증을 완료한 주관식 요약 데이터 매핑
    opinionSummary: {
      validCount: opinionAnalysis.validCount,
      categories: opinionAnalysis.categories.map(function(category) {
        return {
          category: category.category,
          count: category.count,
          representativeOpinions: category.representativeOpinions
        };
      })
    }
  };
}


/**
 * 제공된 팩트 데이터를 바탕으로 공공기관 스타일의 '설문조사 종합 총평' 초안을 생성합니다.
 *
 * @param {Object} context 검증된 조사 컨텍스트
 * @return {string} AI가 작성한 총평 텍스트 원문
 */
function generateDynamicAISummaryText_(context) {
  // AI에게 철저한 팩트 기반 작성을 요구하는 프롬프트를 구성합니다.
  const prompt = `
너는 성남시중원도서관의 공공기관 결과보고서 작성 보조자이다.

아래 검증된 조사자료만 근거로 "총평" 초안을 작성한다.

작성 규칙:
${buildDynamicAIInterpretationRules_()}
- 각 항목은 "○ "로 시작한다.
- 총 5개 이상 7개 이하의 항목으로 작성한다.
- 전체 응답자 수를 포함한다.
- 만족도 척도 문항 수, 전체 평균, 100점 환산, 긍정률을 포함한다.
- 평균이 가장 높은 항목과 상대적으로 낮게 나타난 항목을 포함한다.
- 절대값이 높더라도 다른 항목보다 낮은 경우 "만족도가 낮다"고 단정하지 않는다.
- 복수응답 결과가 있으면 응답자 선택률이 높은 항목을 중심으로 작성한다.
- 재이용·추천 결과가 있으면 포함한다.
- 주관식 범주가 있으면 건수가 높은 주요 범주를 포함한다.
- 자료에 없는 원인, 성과, 예산, 일정, 정책을 만들지 않는다.
- 공공기관 보고서에 적합한 객관적이고 신중한 문체를 사용한다.
- 마크다운 제목, 별표, 표, 코드블록을 사용하지 않는다.
- 수치와 문항명은 입력자료와 일치해야 한다.

검증된 조사자료:
${JSON.stringify(context, null, 2)}
`.trim();

  // 팩트의 정확성을 높이기 위해 창의성(temperature)을 낮게(0.2) 설정하여 텍스트를 생성합니다.
  return callGeminiText_({
    contents: [
      { parts: [{ text: prompt }] }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 4096
    }
  });
}


/**
 * 설문 결과 데이터와 앞서 생성한 총평 내용을 결합하여 실현 가능한 '향후계획' 초안을 생성합니다.
 *
 * @param {Object} context 검증된 조사 컨텍스트
 * @param {string} summaryText 앞 단계에서 생성된 AI 총평 텍스트 초안
 * @return {string} AI가 작성한 향후계획 텍스트 원문
 */
function generateDynamicFuturePlanText_(context, summaryText) {
  // 공공기관 특유의 조심스럽고 검토 위주의 계획 문안 작성을 유도하는 프롬프트입니다.
  const prompt = `
너는 성남시중원도서관의 공공기관 업무계획 작성 보조자이다.

아래 검증된 조사자료와 총평 초안만 근거로 "향후계획" 초안을 작성한다.

작성 규칙:
${buildDynamicAIInterpretationRules_()}
- 각 항목은 "○ "로 시작한다.
- 총 4개 이상 6개 이하의 항목으로 작성한다.
- 주관식 의견과 복수응답에서 실제로 확인된 요구에 대응한다.
- 만족도 결과 중 상대적으로 낮게 나타난 항목이 있으면 운영 검토 방향을 제시할 수 있다.
- 확정되지 않은 사업을 확정 표현으로 작성하지 않는다.
- "검토할 필요가 있음", "운영 시 참고", "여건을 고려하여 단계적으로 검토" 등의 신중한 문체를 사용한다.
- 조사자료에 없는 사업명, 예산액, 추진 일정, 대상 인원, 정책을 만들지 않는다.
- 단순 감사·칭찬 의견만 있는 경우 억지로 개선사업을 만들지 않는다.
- 총평 문장을 그대로 반복하지 않고 실행 검토 방향 중심으로 작성한다.
- 마크다운 제목, 별표, 표, 코드블록을 사용하지 않는다.

검증된 조사자료:
${JSON.stringify(context, null, 2)}

총평 초안:
${summaryText}
`.trim();

  // 마찬가지로 팩트 왜곡 방지 및 신중한 문장 구성을 위해 뇌피셜(환각)을 극도로 제어(temperature: 0.2)합니다.
  return callGeminiText_({
    contents: [
      { parts: [{ text: prompt }] }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 3072
    }
  });
}

function buildDynamicAIInterpretationRules_() {
  return [
    "- 제공된 수치를 다시 계산하거나 새로운 수치를 만들지 않는다.",
    "- 전년도 자료가 없으므로 증가·감소·전년 대비 표현을 사용하지 않는다.",
    "- 원인을 언급해야 하면 확인된 사실이 아니라 추론임을 명시한다.",
    "- 근거 없는 인과관계, 정책, 예산, 일정은 생성하지 않는다."
  ].join("\n");
}


/**
 * '06_주관식분석' 시트를 초기화하고 AI 분류 통계 데이터와 원문 매핑 상세 표를 그려줍니다.
 *
 * @param {Object} analysis 범용 통계 분석 결과
 * @param {Object} opinionAnalysis 주관식 AI 분석 결과
 */
function createDynamicAIOpinionSheet_(analysis, opinionAnalysis) {
  // 시트가 이미 있다면 깨끗이 밀어버리고(초기화) 새로 가져옵니다.
  const sheet = getOrResetDynamicAISheet_("08_주관식분석");

  // 시트 맨 상단에 제목(1~2행 병합)을 배치합니다.
  setDynamicAISheetTitle_(sheet, "주관식 의견 AI 분석", 8);

  // 4행에 카테고리 요약 통계 테이블의 머리글(헤더)을 작성합니다.
  sheet.getRange(4, 1, 1, 8).setValues([[
    "순위",
    "의미 범주",
    "분류 건수",
    "시각화",
    "유효 의견 대비 비율(%)",
    "응답 번호",
    "대표 의견 1",
    "대표 의견 2"
  ]]);

  // 머리글 영역에 배경색, 정렬 등 공공기관 스타일 서식을 입힙니다.
  styleDynamicAIHeader_(sheet.getRange(4, 1, 1, 8));

  // 2차원 배열 형태로 시트에 입력할 카테고리별 요약 행 데이터를 가공합니다.
  const categoryRows = opinionAnalysis.categories.map(function(category, index) {
    return [
      index + 1,                   // 순위 (1등부터 시작)
      category.category,            // AI가 명사형으로 정한 의미 범주명
      category.count,               // 검증 완료된 소속 답변 개수
      "",
      opinionAnalysis.validCount > 0
        ? round_(category.count / opinionAnalysis.validCount * 100, 1) // 비율 소수점 첫째자리 계산
        : 0,
      category.responseNumbers.join(", "), // 매핑된 응답자들의 행 번호들을 쉼표로 나열
      category.representativeOpinions[0] || "", // AI 요약 대표의견 1
      category.representativeOpinions[1] || ""  // AI 요약 대표의견 2
    ];
  });

  // 뿌려줄 카테고리 데이터가 하나 이상 존재한다면
  if (categoryRows.length > 0) {
    // 5행부터 데이터 길이만큼 영역을 잡아 표 데이터를 채워넣습니다.
    sheet.getRange(5, 1, categoryRows.length, 8).setValues(categoryRows);
    
    // 4번째 열(비율)에 소수점 첫째자리 서식("0.0")을 일괄 적용합니다.
    sheet.getRange(5, 5, categoryRows.length, 1).setNumberFormat("0.0");
    
    // 테이블 전체 영역에 회색 테두리 등의 기본 격자 서식을 적용합니다.
    styleDynamicAITable_(sheet.getRange(4, 1, categoryRows.length + 1, 8));
    setDynamicBarSparklines_(sheet,5,categoryRows.length,3,4);
    highlightDynamicMaximums_(sheet,5,categoryRows.length,[3,5]);

  } else {
    // 데이터가 아예 없을 때 예외적으로 출력할 안내 문구 세팅입니다.
    sheet.getRange(5, 1, 1, 8)
      .merge()
      .setValue("AI로 분류할 유효한 주관식 의견이 없습니다.")
      .setHorizontalAlignment("center");
  }

  // 상단 요약 표 아래에 개별 의견 상세 매핑 리스트 표를 그릴 시작 위치(행)를 동적으로 계산합니다.
  let detailStartRow = Math.max(8, 7 + categoryRows.length);

  // 상세 표의 대제목 섹션 행을 생성하고 어두운 파란색 배경을 입힙니다.
  sheet.getRange(detailStartRow, 1, 1, 6)
    .merge()
    .setValue("주관식 의견별 분류 결과")
    .setBackground("#4a6fa5")
    .setFontColor("#ffffff")
    .setFontWeight("bold");

  detailStartRow++; // 상세 표 머리글 행 위치로 이동

  // 상세 테이블의 머리글을 지정합니다.
  sheet.getRange(detailStartRow, 1, 1, 6).setValues([[
    "ID",
    "응답 번호",
    "주관식 문항",
    "의견 원문",
    "AI 의미 범주",
    "검토 상태"
  ]]);

  // 상세 테이블 머리글 서식을 적용합니다.
  styleDynamicAIHeader_(sheet.getRange(detailStartRow, 1, 1, 6));

  // 2차원 배열 형태로 개별 답변별 상세 행 데이터를 구축합니다.
  const detailRows = opinionAnalysis.opinionAssignments.map(function(item) {
    return [
      item.id,
      item.responseNumber,
      item.question,
      item.text,
      item.categories.length ? item.categories.join(" | ") : "미분류", // 중복 배정 시 | 기호로 구분
      "담당자 검토 필요" // 담당자가 최종 컨펌할 수 있도록 상태 초안 지정
    ];
  });

  // 상세 행 데이터가 있다면 시트에 일괄 기록하고 테두리 서식을 씌워줍니다.
  if (detailRows.length > 0) {
    sheet.getRange(detailStartRow + 1, 1, detailRows.length, 6).setValues(detailRows);
    styleDynamicAITable_(sheet.getRange(detailStartRow, 1, detailRows.length + 1, 6));
  }

  // 상단 요약 표 기준에 맞춰 초기 열 너비를 보기 좋게 수동 설정합니다.
  sheet.setColumnWidth(1, 75);
  sheet.setColumnWidth(2, 210);
  sheet.setColumnWidth(3, 95);
  sheet.setColumnWidth(4, 130);
  sheet.setColumnWidth(5, 210);
  sheet.setColumnWidth(6, 360);
  sheet.setColumnWidth(7, 360);

  // 하단 상세 리스트 표가 추가되었으므로 긴 텍스트가 많이 들어가는 문항/원문 열 너비를 넉넉하게 확장합니다.
  if (detailRows.length > 0) {
    sheet.setColumnWidth(3, 360);
    sheet.setColumnWidth(4, 520);
    sheet.setColumnWidth(5, 260);
    sheet.setColumnWidth(6, 150);
  }
}


/**
 * 07_AI총평 또는 08_향후계획처럼 AI가 서술형으로 작성한 본문을 정돈된 시트 양식으로 생성합니다.
 *
 * @param {string} sheetName 새로 생성/초기화할 시트명 ("07_AI총평" 등)
 * @param {string} title 시트 대제목 명칭 ("AI 총평" 등)
 * @param {string} bodyText AI가 출력한 원문 긴 텍스트
 * @param {string} notice 시트 상단에 들어갈 주황색 경고/안내 문구
 */
function createDynamicAITextSheet_(sheetName, title, bodyText, notice) {
  // 시트가 기존에 존재하면 완전 초기화 후 가져옵니다.
  const sheet = getOrResetDynamicAISheet_(sheetName);

  // 가로로 총 8개 열 크기의 대형 제목 레이아웃을 생성합니다.
  setDynamicAISheetTitle_(sheet, title, 8);

  // 4행 영역을 8열 크기로 병합하여 사용자 안내 노티스 존(연한 주황색 배경)을 만듭니다.
  sheet.getRange(4, 1, 1, 8)
    .merge()
    .setValue(notice)
    .setBackground("#fff7e7")
    .setFontColor("#7a5918")
    .setFontSize(10)
    .setWrap(true); // 내용이 길면 셀 내 줄바꿈 허용

  // AI 텍스트 본문을 문단(줄) 단위 배열로 쪼갭니다.
  const paragraphs = splitDynamicAIParagraphs_(bodyText);

  let row = 6; // 본문을 채워넣기 시작할 행 번호

  // 각 문단별로 루프를 돌며 카드를 배치하듯 셀을 큼직하게 병합하여 기록합니다.
  paragraphs.forEach(function(paragraph) {
    sheet.getRange(row, 1, 2, 8) // 가로 8열, 세로 2개 행을 통째로 병합
      .merge()
      .setValue(paragraph)
      .setVerticalAlignment("middle") // 텍스트 중앙 정렬
      .setWrap(true)                  // 셀 너비 넘어가면 줄바꿈
      .setBorder(                     // 개별 카드 테두리 지정
        true, true, true, true, true, true,
        "#dfe7ef",
        SpreadsheetApp.BorderStyle.SOLID
      );

    // 가독성을 극대화하기 위해 데이터가 들어간 병합된 행들의 높이를 넉넉하게 38픽셀씩 지정합니다.
    sheet.setRowHeight(row, 38);
    sheet.setRowHeight(row + 1, 38);

    // 다음 문단은 1행만큼 띄우고 배치하기 위해 3행 아래(row + 3)로 인덱스를 넘깁니다.
    row += 3;
  });

  // 모든 열(1~8번 열)의 너비를 균등하게 120픽셀로 맞춰 시트의 균형을 잡습니다.
  sheet.setColumnWidths(1, 8, 120);
}


/**
 * AI가 생성한 문자열 본문을 스프레드시트 각 셀에 하나씩 뿌리기 좋게 문단(라인) 단위 배열로 분할합니다.
 *
 * @param {string} text AI 출력 전체 서술 텍스트
 * @return {Array<string>} 문단별로 분리된 문자열 배열
 */
function splitDynamicAIParagraphs_(text) {
  // 윈도우 스타일 줄바꿈(\r) 기호를 제거하고 앞뒤 쓸데없는 공백을 도려냅니다.
  const normalized = String(text || "").replace(/\r/g, "").trim();

  // 만약 알맹이가 없다면 에러 대신 화면에 뿌려줄 대체 메시지를 배열에 넣어 반환합니다.
  if (!normalized) {
    return ["생성된 문안이 없습니다."];
  }

  // 연속된 줄바꿈 기호(\n+)를 기준으로 일차 분할하여 텍스트 청소 후 빈 줄을 걸러냅니다.
  const lines = normalized.split(/\n+/).map(cleanText_).filter(Boolean);

  // 일반적인 줄바꿈 분할 결과 개수가 2개 이상이면 정상 분할된 것으로 보고 즉시 반환합니다.
  if (lines.length > 1) {
    return lines;
  }

  // 만약 한 줄로 뭉쳐있다면, 프롬프트 규칙이었던 '○' 기호를 기준으로 정규식을 써서 강제 분할합니다.
  return normalized.split(/(?=○\s*)/).map(cleanText_).filter(Boolean);
}


/**
 * 설정 딕셔너리(Object)에서 한국어 키 또는 영문 웹 매핑 키를 사용해 설정값을 안전하게 추출합니다.
 *
 * @param {Object} settings '00_설정' 시트 기반 설정 맵
 * @param {string} koreanKey 한국어 항목명 ("조사명" 등)
 * @param {string} webKey 영문 변수 항목명 ("surveyName" 등)
 * @return {string} 정리된 설정 값 문자열
 */
function getDynamicAISetting_(settings, koreanKey, webKey) {
  if (!settings) return "";

  // 한국어 키값 우선 조회 후 없으면 영문 웹 키값 조회, 둘 다 없으면 빈 문자열을 택한 뒤 텍스트를 정리합니다.
  return cleanText_(settings[koreanKey] || settings[webKey] || "");
}


/**
 * 지정된 이름의 스프레드시트 탭(시트)을 가져옵니다. 없을 경우 신규 생성하고, 
 * 기존 차트, 병합 상태, 서식, 조건부 서식 등을 완벽히 밀어버려 백지 상태로 만듭니다.
 *
 * @param {string} sheetName 완전 초기화할 대상 시트 이름
 * @return {GoogleAppsScript.Spreadsheet.Sheet} 완전히 깨끗해진 시트 객체
 */
function getOrResetDynamicAISheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  // 시트가 없으면 새 탭을 추가합니다.
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  // 시트 내부에 잔존하는 모든 차트(그래프)를 순회하며 완전히 지웁니다.
  sheet.getCharts().forEach(function(chart) {
    sheet.removeChart(chart);
  });

  // 혹시 모를 대규모 셀 병합 상태를 방지하기 위해 전체 영역의 셀 병합을 강제 해제(breakApart)합니다.
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();

  sheet.clear(); // 데이터 및 기본 서식 지우기
  sheet.clearConditionalFormatRules(); // 조건부 서식 규칙 완전 초기화
  sheet.setHiddenGridlines(true); // 공공기관 보고서 특유의 깔끔함을 위해 스프레드시트 기본 회색 격자선을 숨김 처리!

  return sheet;
}


/**
 * 보고서 양식의 최상단 대제목 서식을 일괄 적용합니다. (1~2행 통합 디자인)
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 대상 시트 객체
 * @param {string} title 표기할 대제목 명칭
 * @param {number} columnCount 가로로 병합할 총 열의 개수
 */
function setDynamicAISheetTitle_(sheet, title, columnCount) {
  sheet.getRange(1, 1, 2, columnCount) // 1행 1열부터 2개 행, 지정된 열 개수만큼 범위 설정
    .merge() // 하나로 병합
    .setValue(title)
    .setBackground("#1b365d") // 신뢰감을 주는 기관용 다크블루 색상 배경
    .setFontColor("#ffffff")   // 흰색 글자
    .setFontWeight("bold")     // 굵게
    .setFontSize(18)           // 18포인트 크게 설정
    .setHorizontalAlignment("center") // 가로 가운데 정렬
    .setVerticalAlignment("middle");  // 세로 정렬도 중앙 정렬

  sheet.setFrozenRows(2); // 스크롤을 내려도 대제목 영역이 상단에 고정되도록 설정합니다.
}


/**
 * 테이블 머리글(헤더) 행에 공공기관 표준 색상과 디자인 서식을 입힙니다.
 *
 * @param {GoogleAppsScript.Spreadsheet.Range} range 대상 헤더 범위
 */
function styleDynamicAIHeader_(range) {
  range
    .setBackground("#4a6fa5")         // 차분한 인디고 블루 배경색
    .setFontColor("#ffffff")           // 흰색 글자
    .setFontWeight("bold")             // 굵게
    .setHorizontalAlignment("center") // 가로 중앙 정렬
    .setVerticalAlignment("middle")  // 세로 중앙 정렬
    .setWrap(true);                   // 좁을 때 줄바꿈 허용
}


/**
 * 데이터가 들어가는 테이블 본문 영역 전체에 얇은 회색 그리드 선과 기본 레이아웃 서식을 먹입니다.
 *
 * @param {GoogleAppsScript.Spreadsheet.Range} range 대상 테이블 전체 범위
 */
function styleDynamicAITable_(range) {
  range
    .setBorder(
      true, true, true, true, true, true, // 상 하 좌 우 내 가로 내 세로 선 전부 활성화
      "#c9d2dd",                          // 너무 튀지 않는 연회색 테두리 색상 지정
      SpreadsheetApp.BorderStyle.SOLID    // 단선 실선 스타일
    )
    .setVerticalAlignment("middle")      // 기본적으로 모든 텍스트는 세로 기준 정중앙 배치
    .setWrap(true);                       // 셀 크기 오버 시 텍스트 삐져나가지 않고 줄바꿈 처리
}


/**
 * 새로 생성하거나 갱신한 AI 관련 분석 탭 세 개를 다른 시트들 뒤로 밀리지 않게 앞쪽 보고서 정식 순서대로 강제 재배치합니다.
 */
function moveDynamicAISheetsInOrder_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // 정렬 순서 정의
  ["08_주관식분석", "09_AI총평", "10_향후계획"].forEach(function(sheetName, index) {
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) return; // 혹시라도 시트가 없으면 패스합니다.

    spreadsheet.setActiveSheet(sheet); // 해당 시트를 마우스로 클릭하듯 활성화 상태로 만듭니다.

    // 00_설정 탭(1번째) 및 01~05 통계 탭(2~6번째)이 앞에 고정되어 있다고 전제하므로,
    // 활성화된 탭을 순서대로 각각 7번째, 8번째, 9번째 탭 위치로 명시적 이동시킵니다.
    spreadsheet.moveActiveSheet(index + 9);
  });
}


/**
 * 가스(GAS) 내장 스크립트 편집기 환경에서 전체 범용 AI 자동화 보고서 로직이 잘 굴러가는지 직접 콘솔로 찍어보는 개발자 테스트 전용 함수입니다.
 */
function testDynamicAIReportGeneration() {
  // 메인 프로세스 실행
  const result = generateDynamicAIReport();

  // 콘솔창에 완료 안내 메시지 출력
  console.log(result.message);

  // 유효 답변 수와 카테고리 추출 건수가 올바른 팩트로 산출되었는지 보기 좋게 줄바꿈하여 로깅합니다.
  console.log(JSON.stringify(result.summary, null, 2));
}
