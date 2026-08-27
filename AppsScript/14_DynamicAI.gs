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
 * 5. 08_향후개선방향 시트 생성
 *
 * 기존 공통 기능 재사용
 * - callGeminiJson_()
 * - callGeminiText_()
 * - calculateDynamicSurveyAnalysis_()
 * - getSurveySettings_()
 * - cleanText_()
 *
 * 
 * 검증 원칙
 * - Gemini가 반환한 건수를 그대로 사용하지 않습니다.
 * - 실제 원자료에 존재하는 응답 번호만 인정합니다.
 * - 개인정보로 보이는 문자열은 Gemini 전달 전에 마스킹합니다.
 * - 자료에 없는 원인, 정책, 예산, 일정은 생성하지 않습니다.
 */


/**
 * 범용 AI 보고서 전체를 생성합니다.
 * 생성 시트: 06_주관식분석, 07_AI총평, 08_향후개선방향
 *
 * @return {Object} 생성 결과 리포트 오브젝트
 */
function generateDynamicAIReport(onStage) {
  let lock=null;
  const updateStage = typeof onStage === "function"
    ? onStage
    : function() {};
  try {
    const revisions=assertDynamicQualityFresh_(null,true);
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
        error:"품질검사 오류를 먼저 해결해 주세요.",quality:quality,generatedSheets:[getDynamicAIReportSheetName_("AI_SUMMARY", "07_AI총평")]};
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
    invalidateDynamicAIRevision_();
    updateStage("06_주관식분석 시트 생성");
    createDynamicAIOpinionSheet_(analysis,opinionAnalysis);
    updateStage("07_AI총평 시트 생성");
    createDynamicAITextSheet_(getDynamicAIReportSheetName_("AI_SUMMARY", "07_AI총평"),"Ⅶ. 총평",summaryText,
      "※ 품질검사를 통과한 집계와 비식별 의견만 사용한 Gemini 초안입니다. 담당자 검토가 필요합니다.");
updateStage("08_향후개선방향 시트 생성");
createDynamicAITextSheet_(
  getDynamicAIReportSheetName_("IMPROVEMENT_PLAN", "08_향후개선방향"),
  "Ⅷ. 향후계획",
  futurePlanText,
  "※ 확정 정책·예산·일정이 아닌 검토용 초안입니다."
);

/*
 * AI 주관식 범주 결과를 통계 분석 객체에 연결합니다.
 *
 * 02_대시보드의 buildDynamicDashboardOpinionItems_()는
 * analysis.opinionCategories를 읽으므로,
 * 별도로 생성된 opinionAnalysis.categories를 전달해야 합니다.
 */
analysis.opinionCategories = Array.isArray(opinionAnalysis.categories)
  ? opinionAnalysis.categories
  : [];

/*
 * 처음 생성된 대시보드는 AI 분석 전 상태이므로
 * AI 범주 결과를 연결한 뒤 다시 생성합니다.
 */
updateStage("AI 주관식 범주 대시보드 반영");
createDynamicDashboardSheet_(analysis, settings);

updateStage("AI 보고서 시트 정렬 및 저장");
moveDynamicAISheetsInOrder_();
SpreadsheetApp.flush();
    markDynamicAIRevision_(revisions.rawRevision);
    const generatedSheets=[
      getDynamicAIReportSheetName_("OPINION", "06_주관식분석"),
      getDynamicAIReportSheetName_("AI_SUMMARY", "07_AI총평"),
      getDynamicAIReportSheetName_("IMPROVEMENT_PLAN", "08_향후개선방향")
    ];
    const summary={validOpinionCount:opinionAnalysis.validCount,categoryCount:opinionAnalysis.categories.length};
    return {success:true,message:"범용 AI 보고서 생성이 완료되었습니다.",
      generatedSheets:generatedSheets,quality:quality,summary:summary,
      report:{summaryText:summaryText,futurePlanText:futurePlanText}};
  } catch(error){throw new Error(error&&error.message?error.message:String(error));}
  finally{if(lock){try{lock.releaseLock();}catch(ignored){}}}
}

function createDynamicAIBlockedSheet_(quality) {
  const sheet=getOrResetDynamicAISheet_(getDynamicAIReportSheetName_("AI_SUMMARY", "07_AI총평"));
  setDynamicAISheetTitle_(sheet,"Ⅶ. 총평",8);
  const rows=[["수준","코드","문항","오류"]].concat((quality.errors||[]).map(function(item){return [item.level,item.code,item.questionId,item.message];}));
  sheet.getRange(4,1,rows.length,4).setValues(rows);styleDynamicAIHeader_(sheet.getRange(4,1,1,4));
  if(rows.length>1)styleDynamicAITable_(sheet.getRange(4,1,rows.length,4));
  applyDynamicPublicReportBaseStyle_(sheet,rows.length+3,8);
  applyDynamicReportReadability_(sheet,rows.length+3,8);
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
    scoreSummary: analysis.scoreSummary || null, // 서버가 계산한 범용 점수 평가 종합값

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

    scoreQuestions: (analysis.score || []).map(function(item) {
      return {
        question: item.question,
        validCount: item.validCount,
        missingCount: item.missingCount,
        average: item.average,
        min: item.min,
        max: item.max,
        distribution: item.distribution,
        unmappedCount: item.unmappedCount
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
  const prompt=buildDynamicAISummaryPrompt_(context);

  // 팩트의 정확성을 높이기 위해 창의성(temperature)을 낮게(0.2) 설정하여 텍스트를 생성합니다.
  return normalizeDynamicAIReportText_(callGeminiText_({
    contents: [
      { parts: [{ text: prompt }] }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 4096
    }
  }));
}


/**
 * 설문 결과 데이터와 앞서 생성한 총평 내용을 결합하여 실현 가능한 '향후계획' 초안을 생성합니다.
 *
 * @param {Object} context 검증된 조사 컨텍스트
 * @param {string} summaryText 앞 단계에서 생성된 AI 총평 텍스트 초안
 * @return {string} AI가 작성한 향후계획 텍스트 원문
 */
function generateDynamicFuturePlanText_(context, summaryText) {
  const prompt=buildDynamicAIFuturePlanPrompt_(context,summaryText);

  // 마찬가지로 팩트 왜곡 방지 및 신중한 문장 구성을 위해 뇌피셜(환각)을 극도로 제어(temperature: 0.2)합니다.
  return normalizeDynamicAIReportText_(callGeminiText_({
    contents: [
      { parts: [{ text: prompt }] }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 3072
    }
  }));
}

function buildDynamicAIInterpretationRules_() {
  return [
    "- 제공된 검증 통계 컨텍스트에 존재하는 사실과 수치만 사용한다.",
    "- 제공된 수치를 합산·재계산·추정하거나 새로운 수치를 만들지 않는다.",
    "- 컨텍스트에 없는 문항, 이용자 집단, 사업명, 프로그램, 기관명, 정책을 만들지 않는다.",
    "- 전년도 자료가 없으므로 증가·감소·전년 대비 표현을 사용하지 않는다.",
    "- 직접 근거가 없는 '~때문에', '~로 인해' 등의 인과 표현을 사용하지 않는다.",
    "- 실제 비교가 가능한 경우에만 '가장 높음', '상대적으로 낮음'을 사용하고 절대점수가 높은 항목을 낮다고 단정하지 않는다.",
    "- 압도적, 획기적, 폭발적, 성공적, 시너지, 니즈, 극대화 등 과장되거나 추상적인 컨설팅 표현을 사용하지 않는다.",
    "- 개인정보, 확정되지 않은 정책·예산·일정·담당 부서를 생성하지 않는다.",
    "- 해당 분석 데이터가 없으면 관련 문단 자체를 생략한다.",
    "- 마크다운 제목(#), 굵게(**), 표, 코드블록을 사용하지 않고 Excel 셀에 기록할 plain text만 반환한다."
  ].join("\n");
}

function buildDynamicAISummaryPrompt_(context){
  return `
너는 지방공공기관의 만족도 조사 결과보고서를 작성하는 행정 실무자이다.
일반적인 AI 설명문이나 컨설팅 보고서가 아니라 부서 내부 검토·결재자료에 바로 활용할 객관적인 총평을 작성한다.

작성 목적:
- 조사 결과에서 무엇이 나타났으며 그 결과가 무엇을 의미하는지 정리한다.
- 세부 사업 일정이나 실행계획은 작성하지 않는다.

공통 사실성 규칙:
${buildDynamicAIInterpretationRules_()}

문체와 형식:
- 제목은 시트 렌더러가 표시하므로 제목을 출력하지 않고 첫 줄부터 "○ "로 시작한다.
- 주요 결과는 "○ ", 통계에 직접 근거한 시사점은 "⇒ ", 필요한 세부사항은 "- " 또는 "⦁ "로 시작한다.
- 서로 관련된 통계는 하나의 ○ 문단에 묶고, "- "는 의미 범주를 구분해야 할 때만 제한적으로 사용한다.
- 문장은 짧은 개조식으로 작성하고 '~나타남', '~확인됨', '~파악됨', '~차지함', '~검토할 필요가 있음' 등으로 종결한다.
- '~입니다', '~했습니다', '추천합니다', '제안합니다', '기대됩니다', '~하는 것이 좋습니다' 문체를 사용하지 않는다.
- 가용 데이터 범위에서 주요 ○ 문단은 최대 5개, 시사점은 최대 2개로 작성하고 전체는 1,500자 이내로 제한한다.

내용 순서(데이터가 있는 항목만 작성):
1. 조사 참여 및 응답자 특성
2. 주요 이용 현황 또는 인지 경로
3. 만족도 전체 평균·긍정률 또는 점수 평가 종합점수와 최고·최저 문항
4. 재이용·추천 또는 NPS
5. 실제 개선 요구
6. 실제 향후 수요
7. 종합 시사점

추가 제한:
- 만족도 문항을 모두 나열하지 말고 전체 지표와 최고·상대적 최저 중심으로 작성한다.
- 점수 평가가 있으면 scoreSummary와 scoreQuestions의 서버 계산값만 사용하고 점수를 다시 계산하지 않는다.
- 복수응답 비율은 컨텍스트의 selectionRate, respondentRate, validRespondentRate 의미를 바꾸지 않는다.
- 복수응답 주요 결과에는 건수와 respondentRate를 함께 쓰며, 값이 없을 때 다른 비율을 응답자 선택률이라고 부르지 않는다.
- 평균은 소수점 둘째 자리, 백분율과 NPS는 소수점 첫째 자리, 응답자와 건수는 정수로 표시하되 값을 재계산하지 않는다.
- 주관식 의견이 없으면 주관식 결과를 언급하지 않는다.
- 개선 요구를 분류할 때는 실제 자료에서 의미가 명확한 경우에만 범주화하고 고정 범주를 억지로 만들지 않는다.
- 구체적인 예산, 일정, 담당 부서, 신규 사업명 또는 확정되지 않은 운영 약속을 작성하지 않는다.

검증된 조사자료:
${JSON.stringify(context,null,2)}
`.trim();
}

function buildDynamicAIFuturePlanPrompt_(context,summaryText){
  return `
너는 지방공공기관의 만족도 조사 결과를 업무계획에 반영하는 행정 실무자이다.
향후계획은 총평을 반복하는 문서가 아니며 조사에서 확인된 요구를 향후 업무에 반영할 실행 방향을 작성한다.

공통 사실성 규칙:
${buildDynamicAIInterpretationRules_()}

문체와 형식:
- 제목은 시트 렌더러가 표시하므로 제목을 출력하지 않고 첫 줄부터 "○ "로 시작한다.
- 주요 추진방향은 "○ ", 하위 실행방안은 "- ", 필요한 세부항목은 "⦁ "로 시작한다.
- 주요 ○ 항목은 3~6개를 권장하되 실제 근거가 부족하면 개수를 줄인다.
- 각 항목의 하위 실행방안은 필요한 경우에만 1~3개로 제한한다.
- '반영', '검토', '확대·개편 검토', '운영 방안 검토', '단계적 추진' 등 개조식 행정문서 표현을 사용한다.

역할 분리 및 실행 원칙:
- 총평의 수치와 문장을 장황하게 반복하지 않고 필요한 경우 근거 수치 1개 이내만 사용한다.
- 개선 요구, 향후 수요, 상대적으로 낮은 만족도 및 검증된 주관식 요구와 직접 연결된 방향만 작성한다.
- 관련 데이터가 없으면 공간·장비, 홍보, 프로그램 등 해당 추진항목을 만들지 않는다.
- 기관에서 확정되지 않은 사업은 '추진한다', '조성한다', '도입한다', '확보한다'로 단정하지 않는다.
- 시설·공간·장비처럼 예산이 수반될 수 있는 사항은 사업 필요성, 이용자 수요 및 여건을 검토한 단계적 추진사항으로 표현한다.
- 사업명, 예산액, 일정, 대상 인원, 담당 부서를 새로 만들지 않는다.
- 단순 감사·칭찬만 있는 경우 개선사업을 억지로 만들지 않는다.

검증된 조사자료:
${JSON.stringify(context,null,2)}

총평 초안(중복 작성 금지, 실행 방향 도출에만 참고):
${summaryText}
`.trim();
}

function normalizeDynamicAIReportText_(value){
  return String(value||"").replace(/```[^\n]*\n?/g,"").replace(/^\s*#{1,6}\s*/gm,"")
    .replace(/\*\*([^*]+)\*\*/g,"$1").replace(/__([^_]+)__/g,"$1")
    .replace(/^\s*\*\s+/gm,"- ").replace(/^\s*\|(.+)\|\s*$/gm,function(_,content){
      if(/^\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+$/.test(content))return "";
      return content.split("|").map(function(item){return cleanText_(item);}).filter(Boolean).join(" · ");
    }).replace(/^\s*[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\.\s*(?:AI\s*)?(?:총평|향후계획|향후개선방향)\s*\n?/i,"")
    .replace(/\n{3,}/g,"\n\n").trim();
}


/**
 * '06_주관식분석' 시트를 초기화하고 AI 분류 통계 데이터와 원문 매핑 상세 표를 그려줍니다.
 *
 * @param {Object} analysis 범용 통계 분석 결과
 * @param {Object} opinionAnalysis 주관식 AI 분석 결과
 */
function createDynamicAIOpinionSheet_(analysis, opinionAnalysis) {
  // 시트가 이미 있다면 깨끗이 밀어버리고(초기화) 새로 가져옵니다.
  const sheet = getOrResetDynamicAISheet_(getDynamicAIReportSheetName_("OPINION", "06_주관식분석"));

  // 시트 맨 상단에 제목(1~2행 병합)을 배치합니다.
  setDynamicAISheetTitle_(sheet, "Ⅵ. 주관식 분석", 7);

  // 4행에 카테고리 요약 통계 테이블의 머리글(헤더)을 작성합니다.
  sheet.getRange(4, 1, 1, 7).setValues([[
    "순위",
    "의미 범주",
    "분류 건수",
    "유효 의견 대비 비율(%)",
    "응답 번호",
    "대표 의견 1",
    "대표 의견 2"
  ]]);

  // 머리글 영역에 배경색, 정렬 등 공공기관 스타일 서식을 입힙니다.
  styleDynamicAIHeader_(sheet.getRange(4, 1, 1, 7));

  // 2차원 배열 형태로 시트에 입력할 카테고리별 요약 행 데이터를 가공합니다.
  const categoryRows = buildDynamicAIOpinionCategoryRows_(opinionAnalysis);

  // 뿌려줄 카테고리 데이터가 하나 이상 존재한다면
if (categoryRows.length > 0) {

    // 응답 번호가 숫자로 자동 변환되지 않도록 5열을 텍스트로 지정합니다.
    sheet
      .getRange(5,5,categoryRows.length,1)
      .setNumberFormat("@");

    sheet
      .getRange(5,1,categoryRows.length,7)
      .setValues(categoryRows);

    sheet
      .getRange(5,4,categoryRows.length,1)
      .setNumberFormat("0.0");
    sheet.getRange(5, 5, categoryRows.length, 1)
  .setNumberFormat("@");
    
    // 테이블 전체 영역에 회색 테두리 등의 기본 격자 서식을 적용합니다.
    styleDynamicAITable_(sheet.getRange(4, 1, categoryRows.length + 1, 7));

  } else {
    // 데이터가 아예 없을 때 예외적으로 출력할 안내 문구 세팅입니다.
    sheet.getRange(5, 1, 1, 7)
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
  const detailRows = buildDynamicAIOpinionDetailRows_(opinionAnalysis);

  // 상세 행 데이터가 있다면 시트에 일괄 기록하고 테두리 서식을 씌워줍니다.
  if (detailRows.length > 0) {
    sheet.getRange(detailStartRow + 1, 1, detailRows.length, 6).setValues(detailRows);
    styleDynamicAITable_(sheet.getRange(detailStartRow, 1, detailRows.length + 1, 6));
  }

  // 요약과 상세 표가 공유하는 열을 긴 문항·의견 중심으로 배치합니다.
  [90,180,340,560,280,450,450].forEach(function(width,index){sheet.setColumnWidth(index+1,width);});
  applyDynamicPublicReportBaseStyle_(sheet, detailStartRow + Math.max(detailRows.length, 1), 7);
  applyDynamicReportReadability_(sheet, detailStartRow + Math.max(detailRows.length, 1), 7);
}


function buildDynamicAIOpinionCategoryRows_(opinionAnalysis) {
  return (opinionAnalysis.categories||[]).map(function(category,index){return [
    index+1,category.category,category.count,
    opinionAnalysis.validCount>0?round_(category.count/opinionAnalysis.validCount*100,1):0,
    category.responseNumbers.join("· "),category.representativeOpinions[0]||"",category.representativeOpinions[1]||""
  ];});
}


function buildDynamicAIOpinionDetailRows_(opinionAnalysis) {
  return (opinionAnalysis.opinionAssignments||[]).map(function(item){return [
    item.id,item.responseNumber,item.question,item.text,
    item.categories.length?item.categories.join(" | "):"미분류","담당자 검토 필요"
  ];});
}


/**
 * 07_AI총평 또는 08_향후개선방향처럼 AI가 서술형으로 작성한 본문을 정돈된 시트 양식으로 생성합니다.
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
  const paragraphRows=[];
  paragraphs.forEach(function(paragraph) {
    paragraphRows.push(row);
    sheet.getRange(row, 1, 1, 8)
      .merge()
      .setValue(paragraph)
      .setFontSize(12)
      .setHorizontalAlignment("left")
      .setVerticalAlignment("top") // 긴 문단은 위에서부터 읽도록 정렬
      .setWrap(true)                  // 셀 너비 넘어가면 줄바꿈
      .setBorder(                     // 개별 카드 테두리 지정
        true, true, true, true, true, true,
        "#dfe7ef",
        SpreadsheetApp.BorderStyle.SOLID
      );

    // 문단 길이에 따라 병합 행 높이를 확보해 인쇄 시 본문이 잘리지 않게 합니다.
    sheet.setRowHeight(row, getDynamicAIParagraphRowHeight_(paragraph));

    // 다음 문단 사이에 한 행을 비우기 위해 2행 아래로 이동합니다.
    row += 2;
  });

  // 모든 열(1~8번 열)의 너비를 균등하게 확보해 긴 본문의 줄바꿈을 줄입니다.
  applyDynamicPublicReportBaseStyle_(sheet, Math.max(row - 1, 6), 8);
  applyDynamicReportReadability_(sheet, Math.max(row - 1, 6), 8);
  sheet.setColumnWidths(1, 8, 220);
  sheet.getRange(4,1,1,8).setFontSize(10).setWrap(true).setVerticalAlignment("middle").setHorizontalAlignment("left");
  paragraphRows.forEach(function(paragraphRow){
    sheet.getRange(paragraphRow,1,1,8).setFontSize(12).setWrap(true)
      .setVerticalAlignment("top").setHorizontalAlignment("left");
    sheet.setRowHeight(paragraphRow,getDynamicAIParagraphRowHeight_(sheet.getRange(paragraphRow,1).getDisplayValue()));
  });
}


/** 넓은 A:H 문서 폭과 실제 줄바꿈을 기준으로 AI 문단 높이를 계산합니다. */
function getDynamicAIParagraphRowHeight_(value) {
  const text=String(value||""),visualLines=text.split("\n").reduce(function(total,line){
    return total+Math.max(1,Math.ceil(line.length/150));
  },0)||1;
  if(visualLines<=1)return 54;
  if(visualLines<=3)return 84;
  if(visualLines<=5)return 116;
  return 150;
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
    .setFontFamily("맑은 고딕")
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
    .setFontFamily("맑은 고딕")
    .setFontSize(10)
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
    .setFontFamily("맑은 고딕")
    .setFontSize(10)
    .setVerticalAlignment("middle")      // 기본적으로 모든 텍스트는 세로 기준 정중앙 배치
    .setWrap(true);                       // 셀 크기 오버 시 텍스트 삐져나가지 않고 줄바꿈 처리
}


/**
 * 새로 생성하거나 갱신한 AI 관련 분석 탭 세 개를 다른 시트들 뒤로 밀리지 않게 앞쪽 보고서 정식 순서대로 강제 재배치합니다.
 */
function moveDynamicAISheetsInOrder_() {
  // 통계 보고서 파일의 공통 정렬 함수가 있으면 동일한 규칙을 재사용합니다.
  if (typeof moveDynamicStatisticalSheetsInOrder_ === "function") {
    moveDynamicStatisticalSheetsInOrder_();
    return;
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const reportOrder = getDynamicAIFinalReportOrder_();
  const internalPrefix = ["00_설정", "00_품질검사"];
  const fullOrder = internalPrefix.concat(reportOrder);

  let targetPosition = 1;
  fullOrder.forEach(function(sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return;
    spreadsheet.setActiveSheet(sheet);
    spreadsheet.moveActiveSheet(targetPosition++);
  });
}


/**
 * 새 설정 파일의 REPORT_SHEETS를 우선 사용하고, 이전 설정에서도 동작하도록
 * 기본 시트명을 반환합니다.
 *
 * @param {string} key REPORT_SHEETS 키
 * @param {string} fallbackName 설정 미존재 시 기본값
 * @return {string}
 */
function getDynamicAIReportSheetName_(key, fallbackName) {
  if (
    typeof DYNAMIC_SURVEY_CONFIG !== "undefined"
    && DYNAMIC_SURVEY_CONFIG.REPORT_SHEETS
    && DYNAMIC_SURVEY_CONFIG.REPORT_SHEETS[key]
  ) {
    return DYNAMIC_SURVEY_CONFIG.REPORT_SHEETS[key];
  }
  return fallbackName;
}


/**
 * 최종 공개 보고서 시트 순서를 반환합니다.
 * 00_품질검사는 숨김 내부 시트이므로 공개 순서에서 제외합니다.
 *
 * @return {Array<string>}
 */
function getDynamicAIFinalReportOrder_() {
  if (typeof getDynamicFinalReportSheetNames_ === "function") {
    return getDynamicFinalReportSheetNames_();
  }

  return [
    getDynamicAIReportSheetName_("OVERVIEW", "01_조사개요"),
    getDynamicAIReportSheetName_("DASHBOARD", "02_대시보드"),
    getDynamicAIReportSheetName_("RESPONDENT", "03_응답자특성"),
    getDynamicAIReportSheetName_("MULTIPLE", "04_복수응답분석"),
    getDynamicAIReportSheetName_("SATISFACTION", "05_만족도분석"),
    getDynamicAIReportSheetName_("OPINION", "06_주관식분석"),
    getDynamicAIReportSheetName_("AI_SUMMARY", "07_AI총평"),
    getDynamicAIReportSheetName_("IMPROVEMENT_PLAN", "08_향후개선방향"),
    getDynamicAIReportSheetName_("RAW", "09_원자료")
  ];
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
