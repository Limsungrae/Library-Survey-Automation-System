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
  test_("숫자형 5점 척도 공통 정규화",function(){const r=scale_([1,2,3,4,5,"1"," 2 ","3점"," 4점 ","5점",""]);
    equal_(r.validCount,10,"숫자 유효");equal_(r.missingCount,1,"빈 셀 결측");equal_(r.unmappedCount,0,"숫자 미매핑 없음");
    equal_(r.outOfRangeCount,0,"범위 오류 없음");equal_(r.average,3,"숫자 평균");});
  test_("5점 척도 범위 오류 분리",function(){const r=scale_([0,"6","7점","알 수 없음",""]);
    equal_(r.validCount,0,"범위 오류 유효 제외");equal_(r.missingCount,1,"빈 셀 결측");equal_(r.outOfRangeCount,3,"범위 오류");
    equal_(r.unmappedCount,1,"비숫자 미매핑");const q=validateDynamicSurveyQuality_({respondentCount:5,respondent:[],single:[],multiple:[],scale:[r],recommendation:[],text:[]},null);
    equal_(q.errors.some(function(item){return item.code==="SCALE_OUT_OF_RANGE";}),true,"범위 오류 코드");});
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
  test_("개인정보 마스킹",function(){
    equal_(maskDynamicPersonalInfo_("010-1234-5678"),"010-****-5678","전화번호");
    equal_(maskDynamicPersonalInfo_("abc@test.com"),"a***@test.com","이메일");
    equal_(maskDynamicPersonalInfo_("900101-1234567"),"900101-*******","주민번호");
    equal_(maskDynamicPersonalInfo_("홍길동"),"홍*동","이름");
    equal_(maskDynamicPersonalInfo_(""),"","빈 문자열");
    equal_(containsDynamicPersonalInfo_(maskDynamicPersonalInfo_("010-1234-5678 test@example.com")),false,"개인정보 잔존");});
  test_("결측과 미매핑 분리",function(){const r=scale_(["","알 수 없음"]);equal_(r.missingCount,1,"결측");equal_(r.unmappedCount,1,"미매핑");});
  test_("동일 응답자 중복 선택 제거",function(){const r=analyzeDynamicMultipleQuestions_({respondentCount:1,rows:[["AI교육, AI교육, 독서모임"]],mappings:[{columnNumber:1,originalHeader:"복수",selectedType:"MULTIPLE",analysisTarget:true}]})[0];
    equal_(r.totalSelections,2,"중복 제거");});
  test_("문항별 SPARKLINE 최대 범위 분리",function(){const calls=[];const sheet={getRange:function(row,column,rowCount,columnCount){return {
      setFormulas:function(formulas){calls.push({row:row,column:column,rowCount:rowCount,columnCount:columnCount,formulas:formulas});}
    };}};
    setDynamicBarSparklines_(sheet,5,3,2,3);setDynamicBarSparklines_(sheet,12,2,2,3);
    equal_(calls.length,2,"SPARKLINE 범위 수");
    equal_(calls[0].formulas[0][0].indexOf("MAX($B$5:$B$7)")>=0,true,"첫 문항 MAX 범위");
    equal_(calls[1].formulas[0][0].indexOf("MAX($B$12:$B$13)")>=0,true,"둘째 문항 MAX 범위");
    equal_(calls[0].formulas[0][0].indexOf("#4F81BD")>=0,true,"막대 색상");});
  test_("XLSX 비호환 수식 탐지",function(){
    equal_(isDynamicXlsxIncompatibleFormula_('=SPARKLINE(B5,{"charttype","bar"})',""),true,"SPARKLINE");
    equal_(isDynamicXlsxIncompatibleFormula_("=__xludf.DUMMYFUNCTION(B5)","#NAME?"),true,"xludf");
    equal_(isDynamicXlsxIncompatibleFormula_("=UNKNOWN(B5)","#NAME?"),true,"NAME 오류");
    ["=SUM(B5:B10)","=AVERAGE(B5:B10)","=ROUND(B5,1)","=COUNTIF(B5:B10,\">0\")",
      "=COUNTA(B5:B10)","=IF(B5>0,B5,0)"].forEach(function(formula){
      equal_(isDynamicXlsxIncompatibleFormula_(formula,"82"),false,"호환 수식 유지: "+formula);});
    ["=LET(x,B5,x)","=LAMBDA(x,x)(B5)","=FILTER(A:A,B:B>0)","=UNIQUE(A:A)","=SORT(A:A)",
      "=SORTN(A:A,5)","=TOCOL(A:B)","=TOROW(A:B)","=_xlfn.XLOOKUP(A1,B:B,C:C)"].forEach(function(formula){
      equal_(isDynamicXlsxIncompatibleFormula_(formula,""),true,"비호환 수식 제거: "+formula);});
    equal_(isDynamicXlsxIncompatibleFormula_("","#NAME?"),false,"일반 텍스트 유지");
    equal_(findDynamicXlsxForbiddenToken_("<f>_xlfn.SPARKLINE(B5)</f>"),"SPARKLINE","XLSX SPARKLINE");
    equal_(findDynamicXlsxForbiddenToken_("<f>__xludf.DUMMYFUNCTION(B5)</f>"),"__XLUDF","XLSX xludf");
    equal_(findDynamicXlsxForbiddenToken_("<v>82</v>"),"","정상 XLSX XML");});
  test_("공공기관 공통 표 스타일",function(){const calls={};const range={};
    ["setBackground","setFontColor","setFontFamily","setFontSize","setFontWeight","setHorizontalAlignment",
      "setVerticalAlignment","setWrap"].forEach(function(name){range[name]=function(value){calls[name]=value;return range;};});
    styleDynamicQuestionTitle_(range);equal_(calls.setBackground,"#D9EAF7","문항 제목 배경");
    equal_(calls.setFontFamily,"맑은 고딕","공통 글꼴");equal_(calls.setFontSize,11,"문항 제목 크기");
    styleDynamicReportTotalRow_(range);equal_(calls.setBackground,"#E7E6E6","합계행 배경");
    equal_(calls.setFontWeight,"bold","합계행 굵게");});
  test_("보고서 제목·문항 제목·인쇄 설정",function(){
    equal_(formatDynamicQuestionTitle_({question:"Q1 시설 및 환경 만족도"},0),"【Q1】\n시설 및 환경 만족도","Q 제목");
    equal_(formatDynamicQuestionTitle_({question:"응답자 유형"},1),"【문항 2】\n응답자 유형","일반 제목");
    const worksheet=applyDynamicWorksheetPrintSettingsXml_('<worksheet><sheetData/></worksheet>');
    equal_(worksheet.indexOf('paperSize="9"')>=0,true,"A4");equal_(worksheet.indexOf('orientation="landscape"')>=0,true,"가로");
    equal_(worksheet.indexOf('fitToWidth="1"')>=0,true,"페이지 맞춤");equal_(worksheet.indexOf('left="0.25"')>=0,true,"좁은 여백");
    const workbook=applyDynamicWorkbookPrintTitlesXml_('<workbook></workbook>',["01_조사개요"]);
    equal_(workbook.indexOf("$1:$4")>=0,true,"반복 머리글");});
  test_("문항별 최다·최저와 동률 강조 대상",function(){
    equal_(getDynamicExtremeRowIndexes_([3,7,7,2],"max").join(","),"1,2","최다 동률");
    equal_(getDynamicExtremeRowIndexes_([3,7,7,2],"min").join(","),"3","최저");
    equal_(getDynamicExtremeRowIndexes_([9,2,2],"min",[false,true,true]).join(","),"1,2","제외 및 최저 동률");
    equal_(getDynamicScaleExtremeNames_([{question:"A",validCount:2,average:4.5},{question:"B",validCount:2,average:4.5},
      {question:"C",validCount:2,average:3},{question:"D",validCount:0,average:5}],"max"),"A / B","공동 최고");
    equal_(getDynamicScaleExtremeNames_([{question:"A",validCount:2,average:4},{question:"B",validCount:2,average:2}],"min"),"B","최저 문항");});
  return {success:results.every(function(r){return r.status==="PASS";}),passed:results.filter(function(r){return r.status==="PASS";}).length,
    failed:results.filter(function(r){return r.status==="FAIL";}).length,results:results};
}

/** WebApp에서 호출하는 공개 API 심볼이 리팩토링 중 삭제되지 않았는지 확인합니다. */
function testDynamicSurveyPublicApiContracts() {
  const requiredApis = [
    "secureGetSurveySettingsForWeb",
    "secureGetDynamicSurveySystemStatusFromWeb",
    "secureSaveSurveySettingsFromWeb",
    "secureInspectSurveyExcelForMappingFromWeb",
    "secureInspectSurveyExcelByRuleFromWeb",
    "secureSaveSurveyMappingsFromWeb",
    "secureGetSavedSurveyMappingsFromWeb",
    "secureDeleteSavedSurveyMappingsFromWeb",
    "secureCreateGenericRawSheetFromWeb",
    "generateDynamicStatisticalReportFromWeb",
    "secureGenerateDynamicStatisticalReportFromWeb",
    "secureGetDynamicSurveyDashboardDataFromWeb",
    "secureGetDynamicSurveyQualityFromWeb",
    "secureGenerateDynamicAIReportFromWeb",
    "secureExportDynamicSurveyReportFromWeb"
  ];
  const missing = requiredApis.filter(function(apiName) {
    return typeof globalThis[apiName] !== "function";
  });
  if (missing.length) {
    throw new Error("누락된 Dynamic Survey 공개 API: " + missing.join(", "));
  }
  return {success:true, checked:requiredApis.length, missing:[]};
}
