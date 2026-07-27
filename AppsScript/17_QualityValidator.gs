/**
 * 범용 설문 분석 품질 검증 계층.
 * 통계 객체를 변경하지 않고 Report, AI, Export가 공유하는 검증 결과만 반환합니다.
 */
function validateDynamicSurveyQuality_(analysis, source) {
  const errors = [];
  const warnings = [];
  const infos = [];
  const questionStats = [];
  function add_(level, code, message, questionId, details) {
    const item = {level: level, code: code, message: message, questionId: questionId || "", details: details || {}};
    if (level === "ERROR") errors.push(item);
    else if (level === "WARNING") warnings.push(item);
    else infos.push(item);
  }
  if (!analysis || typeof analysis !== "object") {
    add_("ERROR", "ANALYSIS_MISSING", "분석 결과가 없습니다.", "", {});
  } else {
    const total = Number(analysis.respondentCount || 0);
    [].concat(analysis.respondent || [], analysis.single || []).forEach(function(question) {
      const countSum = (question.items || []).reduce(function(sum,item){return sum+Number(item.count||0);},0);
      const rateSum = (question.items || []).reduce(function(sum,item){return sum+Number(item.validResponseRate||item.rate||0);},0);
      questionStats.push({questionId:question.questionId||"Q"+question.columnNumber,type:question.type,
        validCount:question.validResponses,missingCount:question.missingResponses,unmappedCount:0});
      if (countSum !== Number(question.validResponses||question.validCount||0))
        add_("ERROR","SINGLE_COUNT_MISMATCH","단일응답 빈도 합계가 유효응답 수와 다릅니다.",question.questionId,{countSum:countSum});
      if (countSum > 0 && Math.abs(rateSum-100) > 0.5)
        add_("WARNING","SINGLE_RATE_SUM","단일응답 비율 합계가 반올림 허용범위를 벗어납니다.",question.questionId,{rateSum:rateSum});
    });
    (analysis.multiple || []).forEach(function(question) {
      const countSum=(question.items||[]).reduce(function(sum,item){return sum+Number(item.count||0);},0);
      const rateSum=(question.items||[]).reduce(function(sum,item){return sum+Number(item.selectionRate||0);},0);
      if(countSum!==Number(question.totalSelections||question.totalSelectionCount||0))
        add_("ERROR","MULTIPLE_COUNT_MISMATCH","복수응답 항목 합계가 전체 선택건수와 다릅니다.",question.questionId,{countSum:countSum});
      if(countSum>0&&Math.abs(rateSum-100)>0.5)
        add_("WARNING","MULTIPLE_RATE_SUM","복수응답 선택건수 비율 합계가 반올림 허용범위를 벗어납니다.",question.questionId,{rateSum:rateSum});
    });
    (analysis.scale || []).forEach(function(question) {
      const distributionSum=Object.keys(question.scoreDistribution||{}).reduce(function(sum,key){return sum+question.scoreDistribution[key];},0);
      questionStats.push({questionId:question.questionId,type:"SCALE",validCount:question.validCount,
        missingCount:question.missingCount,unmappedCount:question.unmappedCount,
        outOfRangeCount:Number(question.outOfRangeCount||0)});
      if(distributionSum!==question.validCount)
        add_("ERROR","SCALE_DISTRIBUTION_MISMATCH","척도 분포 합계가 유효응답 수와 다릅니다.",question.questionId,{distributionSum:distributionSum});
      if(question.unmappedCount>0)
        add_("ERROR","SCALE_UNMAPPED_VALUE","척도 문항에 변환되지 않은 응답이 있습니다.",question.questionId,{values:question.unmappedValues});
      if(Number(question.outOfRangeCount||0)>0)
        add_("ERROR","SCALE_OUT_OF_RANGE","척도 문항에 1~5 범위를 벗어난 숫자 응답이 있습니다.",question.questionId,{values:question.outOfRangeValues});
      const denominator=total||1;
      if(question.missingCount/denominator*100>=DYNAMIC_SURVEY_CONFIG.QUALITY.HIGH_MISSING_RATE)
        add_("WARNING","HIGH_MISSING_RATE","문항 결측률이 50% 이상입니다.",question.questionId,{missingRate:question.missingCount/denominator*100});
    });
    (analysis.recommendation || []).forEach(function(question) {
      if(DYNAMIC_SURVEY_CONFIG.ALLOWED_RECOMMENDATION_KINDS.indexOf(question.scaleKind)===-1)
        add_("ERROR","RECOMMENDATION_SCALE_KIND_REQUIRED","추천 문항의 척도 유형을 명시해야 합니다.",question.questionId,{scaleKind:question.scaleKind});
      if(question.scaleKind==="NPS_0_10"&&question.unmappedCount>0)
        add_("ERROR","NPS_INVALID_RANGE","NPS 문항에 0~10 정수 범위를 벗어난 값이 있습니다.",question.questionId,{values:question.unmappedValues});
      if(question.nps!==null&&question.nps!==undefined&&(question.nps < -100||question.nps > 100))
        add_("ERROR","NPS_OUT_OF_RANGE","계산된 NPS가 -100~100 범위를 벗어납니다.",question.questionId,{nps:question.nps});
    });
    if (source) {
      const seen={};
      (source.mappings||[]).forEach(function(mapping){
        if(!mapping.originalHeader) add_("ERROR","MAPPING_HEADER_MISSING","매핑 문항 헤더가 비어 있습니다.","Q"+mapping.columnNumber,{});
        if(seen[mapping.columnNumber]) add_("ERROR","MAPPING_COLUMN_DUPLICATE","매핑 컬럼 번호가 중복되었습니다.","Q"+mapping.columnNumber,{});
        seen[mapping.columnNumber]=true;
      });
    }
    (analysis.text||[]).forEach(function(question){
      (question.opinions||[]).forEach(function(opinion){
        if (containsDynamicPersonalInfo_(opinion.maskedText))
          add_("ERROR","AI_PII_REMAINS","AI 입력용 의견에 개인정보 패턴이 남아 있습니다.",question.questionId,{responseId:opinion.responseId});
      });
    });
  }
  const status=errors.length?"FAIL":(warnings.length?"WARNING":"PASS");
  if(!errors.length&&!warnings.length) add_("INFO","QUALITY_PASS","통계 품질검사를 통과했습니다.","",{});
  return {status:status,errors:errors,warnings:warnings,infos:infos,questionStats:questionStats,
    aiAllowed:errors.length===0,checkedAt:new Date().toISOString()};
}

function containsDynamicPersonalInfo_(value) {
  const text=String(value||"");
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)
    || /(?:\+?82[- .]?)?(?:0\d{1,2})[- .]?\d{3,4}[- .]?\d{4}/.test(text)
    || /\b\d{6}[- ]?[1-4]\d{6}\b/.test(text);
}

function getDynamicSurveyQualityFromWeb() {
  try {
    const source=getDynamicSurveySource_();
    const analysis=calculateDynamicSurveyAnalysis_();
    const quality=validateDynamicSurveyQuality_(analysis,source);
    return {success:true,message:"범용 설문 품질검사를 완료했습니다.",error:null,data:quality,quality:quality};
  } catch(error) {
    return {success:false,message:"품질검사를 완료하지 못했습니다.",error:{message:getWebErrorMessage_(error)},data:null};
  }
}
