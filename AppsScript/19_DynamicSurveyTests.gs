/** Apps Script 편집기와 로컬 V8 호환 순수 회귀 테스트 모음. */
function testDynamicSurveyV2RegressionSuite() {
  const results=[];
  function test_(name,callback){try{callback();results.push({name:name,status:"PASS",error:""});}
    catch(error){results.push({name:name,status:"FAIL",error:error.message});}}
  function equal_(actual,expected,message,tolerance){
    if(typeof expected==="number"&&tolerance!==undefined){if(Math.abs(actual-expected)>tolerance)throw new Error(message+": "+actual);}
    else if(actual!==expected)throw new Error(message+": "+actual+" != "+expected);
  }
  function scale_(values){return analyzeDynamicScaleQuestions_({respondentCount:values.length,
    rows:values.map(function(v){return [v];}),mappings:[{columnNumber:1,originalHeader:"척도",selectedType:"SCALE",analysisTarget:true,scoreMap:{}}]})[0];}

  test_("한글 5점 척도와 결측/미매핑",function(){const r=scale_(["매우 만족","만족","보통","불만족","매우 불만족","","알 수 없음"]);
    equal_(r.validCount,5,"유효");equal_(r.missingCount,1,"결측");equal_(r.unmappedCount,1,"미매핑");
    equal_(r.average,3,"평균");equal_(r.positiveRate,40,"긍정");equal_(r.neutralRate,20,"중립");equal_(r.negativeRate,40,"부정");});
  test_("가중평균과 macro 평균",function(){const a=scale_(new Array(10).fill("5")),b=scale_(["1","1"]),s=buildDynamicScaleSummary_([a,b]);
    equal_(s.weightedAverage,4.3333,"가중",0.0001);equal_(s.macroAverage,3,"macro");});
  test_("복수응답 집계",function(){const values=["AI교육, 독서모임","AI교육|디지털교육","독서모임; AI교육",""];
    const r=analyzeDynamicMultipleQuestions_({respondentCount:4,rows:values.map(function(v){return[v];}),mappings:[{columnNumber:1,originalHeader:"복수",selectedType:"MULTIPLE",analysisTarget:true}]})[0];
    equal_(r.validRespondents,3,"유효응답자");equal_(r.totalSelections,6,"선택건수");equal_(r.averageSelectionsPerRespondent,2,"평균선택");
    equal_(r.items.reduce(function(t,i){return t+i.selectionRate;},0),100,"비율합",0.2);});
  test_("복수응답 동의어",function(){const values=["홈페이지","도서관 홈페이지","도서관 누리집"];
    const r=analyzeDynamicMultipleQuestions_({respondentCount:3,rows:values.map(function(v){return[v];}),mappings:[{columnNumber:1,originalHeader:"경로",selectedType:"MULTIPLE",analysisTarget:true}]})[0];
    equal_(r.items.length,1,"동의어 항목수");equal_(r.items[0].count,3,"동의어 빈도");});
  test_("명시적 NPS",function(){const m={columnNumber:1,originalHeader:"추천",selectedType:"RECOMMENDATION",analysisTarget:true,scaleKind:"NPS_0_10"};
    const r=analyzeDynamicRecommendationQuestions_({respondentCount:6,rows:[["10"],["9"],["8"],["7"],["6"],["0"]],mappings:[m]})[0];
    equal_(r.promoterCount,2,"추천자");equal_(r.passiveCount,2,"중립자");equal_(r.detractorCount,2,"비추천자");equal_(r.nps,0,"NPS");});
  test_("5점 추천의향 NPS 미산출",function(){const vals=["매우 그렇다","그렇다","보통","그렇지 않다","전혀 그렇지 않다"];
    const m={columnNumber:1,originalHeader:"추천",selectedType:"RECOMMENDATION",analysisTarget:true,scaleKind:"RECOMMENDATION_1_5",scoreMap:{}};
    const r=analyzeDynamicRecommendationQuestions_({respondentCount:5,rows:vals.map(function(v){return[v];}),mappings:[m]})[0];
    equal_(r.average,3,"평균");equal_(r.nps,null,"NPS 미산출");});
  test_("복수응답 합계행 퍼센트 안전",function(){const row=buildDynamicMultipleTotalRow_({totalSelections:82});
    equal_(row[1],82,"합계 선택건수");equal_(row[2],1,"선택건수 비율");equal_(row[3],"","전체응답률 공란");equal_(row[4],"","유효응답률 공란");});
  test_("완전 동점 공동순위",function(){const rows=analyzeDynamicScaleQuestions_({respondentCount:2,rows:[["5","5"],["4","4"]],mappings:[
    {columnNumber:1,originalHeader:"A",selectedType:"SCALE",analysisTarget:true,scoreMap:{}},{columnNumber:2,originalHeader:"B",selectedType:"SCALE",analysisTarget:true,scoreMap:{}}]});
    equal_(rows[0].rank,rows[1].rank,"공동순위");});
  test_("Critical 품질 오류 AI 차단",function(){const r=scale_(["알 수 없음"]),q=validateDynamicSurveyQuality_({respondentCount:1,respondent:[],single:[],multiple:[],scale:[r],recommendation:[],text:[]},null);
    equal_(q.aiAllowed,false,"AI 차단");});
  test_("개인정보 마스킹",function(){const masked=maskDynamicPersonalInfo_("010-1234-5678 test@example.com");
    equal_(containsDynamicPersonalInfo_(masked),false,"개인정보 잔존");});
  test_("결측과 미매핑 분리",function(){const r=scale_(["","알 수 없음"]);equal_(r.missingCount,1,"결측");equal_(r.unmappedCount,1,"미매핑");});
  test_("동일 응답자 중복 선택 제거",function(){const r=analyzeDynamicMultipleQuestions_({respondentCount:1,rows:[["AI교육, AI교육, 독서모임"]],mappings:[{columnNumber:1,originalHeader:"복수",selectedType:"MULTIPLE",analysisTarget:true}]})[0];
    equal_(r.totalSelections,2,"중복 제거");});
  return {success:results.every(function(r){return r.status==="PASS";}),passed:results.filter(function(r){return r.status==="PASS";}).length,
    failed:results.filter(function(r){return r.status==="FAIL";}).length,results:results};
}
