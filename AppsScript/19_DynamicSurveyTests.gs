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
  function propertyStore_(initial){const values=Object.assign({},initial||{});return {
    getProperty:function(key){return Object.prototype.hasOwnProperty.call(values,key)?values[key]:null;},
    setProperty:function(key,value){values[key]=String(value);return this;},
    setProperties:function(items){Object.keys(items||{}).forEach(function(key){values[key]=String(items[key]);});return this;},
    deleteProperty:function(key){delete values[key];return this;}
  };}
  function authEnvironment_(){
    const properties={WEB_APP_PASSCODE:"secret"},cacheValues={},cacheTtls={},removed=[];
    const propertyStore={getProperty:function(key){return Object.prototype.hasOwnProperty.call(properties,key)?properties[key]:null;},
      setProperty:function(key,value){properties[key]=String(value);return this;},deleteProperty:function(key){delete properties[key];return this;}};
    const cache={get:function(key){return Object.prototype.hasOwnProperty.call(cacheValues,key)?cacheValues[key]:null;},
      put:function(key,value,ttl){cacheValues[key]=String(value);cacheTtls[key]=ttl;},remove:function(key){delete cacheValues[key];removed.push(key);}};
    let uuidCount=0;
    const utilities={DigestAlgorithm:{SHA_256:"SHA_256"},Charset:{UTF_8:"UTF_8"},getUuid:function(){uuidCount++;return "uuid-"+uuidCount;},
      computeDigest:function(algorithm,value){const text=String(value),bytes=[];for(let i=0;i<32;i++)bytes.push((text.charCodeAt(i%Math.max(text.length,1))||0)-128);return bytes;}};
    return {properties:properties,cacheValues:cacheValues,cacheTtls:cacheTtls,removed:removed,
      PropertiesService:{getScriptProperties:function(){return propertyStore;}},CacheService:{getScriptCache:function(){return cache;}},Utilities:utilities};
  }
  function withAuthEnvironment_(callback){const originalPropertiesService=PropertiesService,originalCacheService=CacheService,originalUtilities=Utilities;
    const environment=authEnvironment_();try{PropertiesService=environment.PropertiesService;CacheService=environment.CacheService;Utilities=environment.Utilities;callback(environment);}
    finally{PropertiesService=originalPropertiesService;CacheService=originalCacheService;Utilities=originalUtilities;}}

  test_("영속 인증 세션 로그인과 Cache miss 복구",function(){withAuthEnvironment_(function(env){
    const login=verifyWebAppPasscodeFromWeb("secret");equal_(login.success,true,"로그인 성공");equal_(login.authenticated,true,"인증 상태");
    equal_(login.expiresInSeconds,8*60*60,"8시간 응답");const propertyKey=getWebAccessSessionPropertyKey_(login.token),cacheKey=getWebAccessCacheKey_(login.token);
    equal_(Boolean(env.properties[propertyKey]),true,"ScriptProperties 세션 생성");equal_(Boolean(env.cacheValues[cacheKey]),true,"Cache 생성");
    equal_(env.cacheTtls[cacheKey],60*60,"Cache 1시간 TTL");equal_(propertyKey.indexOf(login.token),-1,"property key에 원문 token 미포함");
    equal_(isValidWebAccessToken_(login.token),true,"Cache hit 인증");delete env.cacheValues[cacheKey];
    equal_(validateWebAppTokenFromWeb(login.token).authenticated,true,"Cache miss 영속 세션 복구");equal_(Boolean(env.cacheValues[cacheKey]),true,"Cache 재등록");
    requireWebAccessToken_(login.token);
  });});
  test_("인증 세션 오류·만료·빈 token 정리",function(){withAuthEnvironment_(function(env){
    equal_(isValidWebAccessToken_(""),false,"빈 token 거부");equal_(isValidWebAccessToken_("missing"),false,"없는 세션 거부");
    const malformed="malformed",malformedProperty=getWebAccessSessionPropertyKey_(malformed);env.properties[malformedProperty]="not-json";
    equal_(isValidWebAccessToken_(malformed),false,"손상 세션 거부");equal_(env.properties[malformedProperty],undefined,"손상 property 삭제");
    const expired="expired",expiredProperty=getWebAccessSessionPropertyKey_(expired),expiredCache=getWebAccessCacheKey_(expired);
    env.properties[expiredProperty]=JSON.stringify({createdAt:1,expiresAt:2});env.cacheValues[expiredCache]=JSON.stringify({expiresAt:2});
    equal_(isValidWebAccessToken_(expired),false,"만료 세션 거부");equal_(env.properties[expiredProperty],undefined,"만료 property 삭제");equal_(env.cacheValues[expiredCache],undefined,"만료 cache 삭제");
  });});
  test_("로그아웃은 세션을 독립적으로 제거",function(){withAuthEnvironment_(function(env){
    const first=verifyWebAppPasscodeFromWeb("secret"),second=verifyWebAppPasscodeFromWeb("secret");
    equal_(isValidWebAccessToken_(first.token),true,"첫 세션 유효");equal_(isValidWebAccessToken_(second.token),true,"둘째 세션 유효");
    equal_(logoutWebAppFromWeb(first.token).success,true,"로그아웃 성공");equal_(isValidWebAccessToken_(first.token),false,"첫 세션 제거");equal_(isValidWebAccessToken_(second.token),true,"둘째 세션 유지");
    equal_(logoutWebAppFromWeb(first.token).success,true,"없는 세션 로그아웃 성공");
  });});

  test_("60명에서 80명 원자료 교체 시 lineage stale 보호",function(){
    const store=propertyStore_();
    markDynamicRawRevision_(store,"RAW_A_60");
    markDynamicStatisticsRevision_("RAW_A_60",store);
    markDynamicQualityRevision_("RAW_A_60",{status:"PASS",aiAllowed:true},store);
    markDynamicAIRevision_("RAW_A_60",store);
    let state=buildDynamicSurveyFreshnessState_(getDynamicSurveyRevisionState_(store),{
      statisticsSheetsComplete:true,aiSheetsComplete:true});
    equal_(state.statisticsFresh,true,"60명 통계 최신");equal_(state.exportReady,true,"60명 내보내기 가능");

    markDynamicRawRevision_(store,"RAW_B_80");
    state=buildDynamicSurveyFreshnessState_(getDynamicSurveyRevisionState_(store),{
      statisticsSheetsComplete:true,aiSheetsComplete:true});
    equal_(state.statisticsFresh,false,"이전 통계 시트가 있어도 stale");
    equal_(state.qualityFresh,false,"이전 품질검사 stale");equal_(state.aiFresh,false,"이전 AI stale");
    equal_(state.exportReady,false,"혼합 보고서 내보내기 차단");
    let aiBlocked=false,exportBlocked=false;
    try{assertDynamicQualityFresh_(store,true);}catch(error){aiBlocked=/통계 분석/.test(error.message);}
    try{assertDynamicAIReportFresh_(store);}catch(error){exportBlocked=/통계 분석/.test(error.message);}
    equal_(aiBlocked,true,"80명 통계 재실행 전 AI 차단");equal_(exportBlocked,true,"80명 통계 재실행 전 Export 차단");

    markDynamicStatisticsRevision_("RAW_B_80",store);
    state=buildDynamicSurveyFreshnessState_(getDynamicSurveyRevisionState_(store),{
      statisticsSheetsComplete:true,aiSheetsComplete:true});
    equal_(state.statisticsFresh,true,"80명 통계 재실행 후 최신");equal_(state.exportReady,false,"품질 및 AI 전 Export 차단");
    markDynamicQualityRevision_("RAW_B_80",{status:"PASS",aiAllowed:true},store);
    markDynamicAIRevision_("RAW_B_80",store);
    state=buildDynamicSurveyFreshnessState_(getDynamicSurveyRevisionState_(store),{
      statisticsSheetsComplete:true,aiSheetsComplete:true});
    equal_(state.qualityFresh,true,"80명 품질 최신");equal_(state.aiFresh,true,"80명 AI 최신");
    equal_(state.exportReady,true,"모든 stage가 같은 revision일 때만 Export 가능");

    markDynamicRawRevision_(store,"RAW_B_80_REUPLOAD");
    equal_(getDynamicSurveyRevisionState_(store).rawRevision,"RAW_B_80_REUPLOAD","동일 파일 재업로드도 새 revision");
  });
  test_("Visualization PDF·PNG freshness guard",function(){
    const store=propertyStore_();markDynamicRawRevision_(store,"VIS_A");markDynamicStatisticsRevision_("VIS_A",store);
    markDynamicQualityRevision_("VIS_A",{status:"PASS",aiAllowed:true},store);markDynamicAIRevision_("VIS_A",store);
    equal_(prepareDynamicVisualizationExportFromWeb_("PDF","VIS_A",store).rawRevision,"VIS_A","PDF current revision");
    equal_(prepareDynamicVisualizationExportFromWeb_("PNG","VIS_A",store).format,"PNG","PNG API format");
    let changed=false;try{prepareDynamicVisualizationExportFromWeb_("PDF","VIS_OLD",store);}catch(error){changed=/변경/.test(error.message);}
    equal_(changed,true,"생성 중 expected revision 변경 차단");
    markDynamicRawRevision_(store,"VIS_B");let stalePdf=false,stalePng=false;
    try{prepareDynamicVisualizationExportFromWeb_("PDF","VIS_A",store);}catch(error){stalePdf=/통계 분석/.test(error.message);}
    try{prepareDynamicVisualizationExportFromWeb_("PNG","VIS_A",store);}catch(error){stalePng=/통계 분석/.test(error.message);}
    equal_(stalePdf,true,"stale Raw PDF 차단");equal_(stalePng,true,"stale Raw PNG 차단");
  });

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
  test_("복수응답 집계 key와 원문 표시 label 분리",function(){const values=[
    "생성형AI활용교육",
    "프로그램 횟수 확대|AI·디지털 심화 프로그램 운영|생성형 AI 활용 교육|로봇·코딩 교육|VR·AR·XR 체험"
  ];
    const r=analyzeDynamicMultipleQuestions_({respondentCount:2,rows:values.map(function(v){return[v];}),mappings:[
      {columnNumber:1,originalHeader:"개선 요구",selectedType:"MULTIPLE",analysisTarget:true}
    ]})[0];
    const labels=r.items.map(function(item){return item.label;});
    ["프로그램 횟수 확대","AI·디지털 심화 프로그램 운영","생성형 AI 활용 교육","로봇·코딩 교육","VR·AR·XR 체험"]
      .forEach(function(label){equal_(labels.indexOf(label)>=0,true,"원문 label 보존: "+label);});
    const aiItem=r.items.filter(function(item){return item.key==="생성형ai활용교육";})[0];
    equal_(aiItem.count,2,"정규화 key count 합산");equal_(aiItem.label,"생성형 AI 활용 교육","최초 원문 표시");
    equal_(aiItem.normalizedLabel,"생성형ai활용교육","기존 normalizedLabel 호환");});
  test_("명시적 NPS",function(){const m={columnNumber:1,originalHeader:"추천",selectedType:"RECOMMENDATION",analysisTarget:true,scaleKind:"NPS_0_10"};
    const r=analyzeDynamicRecommendationQuestions_({respondentCount:6,rows:[["10"],["9"],["8"],["7"],["6"],["0"]],mappings:[m]})[0];
    equal_(r.promoterCount,2,"추천자");equal_(r.passiveCount,2,"중립자");equal_(r.detractorCount,2,"비추천자");equal_(r.nps,0,"NPS");});
  test_("5점 추천의향 NPS 미산출",function(){const vals=["매우 그렇다","그렇다","보통","그렇지 않다","전혀 그렇지 않다"];
    const m={columnNumber:1,originalHeader:"추천",selectedType:"RECOMMENDATION",analysisTarget:true,scaleKind:"RECOMMENDATION_1_5",scoreMap:{}};
    const r=analyzeDynamicRecommendationQuestions_({respondentCount:5,rows:vals.map(function(v){return[v];}),mappings:[m]})[0];
    equal_(r.average,3,"평균");equal_(r.nps,null,"NPS 미산출");});
  test_("5점 재이용·추천은 문항별 scaleValueMap으로 집계",function(){
    const values=["1) 매우 그렇다","2) 그렇다","3) 보통","4) 그렇지 않다","5) 전혀 그렇지 않다"];
    const valueMap={"1) 매우 그렇다":5,"2) 그렇다":4,"3) 보통":3,"4) 그렇지 않다":2,"5) 전혀 그렇지 않다":1};
    const mapping={columnNumber:1,originalHeader:"재이용 의향",selectedType:"RECOMMENDATION",analysisTarget:true,
      scaleKind:"RECOMMENDATION_1_5",scaleValueMap:valueMap,scaleValueOptions:values.map(function(label){return {label:label,count:1};})};
    const result=analyzeDynamicRecommendationQuestions_({respondentCount:5,rows:values.map(function(value){return [value];}),mappings:[mapping]})[0];
    equal_(result.validCount,5,"추천 유효응답");equal_(result.average,3,"추천 평균");equal_(result.positiveRate,40,"추천 긍정률");
    equal_(result.scoreDistribution[5],1,"5점 분포");equal_(result.scoreDistribution[1],1,"1점 분포");
    equal_(suggestSurveyScaleScore_("1) 매우 그렇다"),5,"번호 prefix 자동 추천");
    equal_(validateSurveyMappings_([mapping]).valid,true,"완료된 추천 매핑 저장 가능");
    const incomplete=Object.assign({},mapping,{scaleValueMap:{"3) 보통":3}});
    equal_(validateSurveyMappings_([incomplete]).valid,false,"미완료 추천 매핑 저장 차단");
    const nps={columnNumber:1,originalHeader:"추천 점수",selectedType:"RECOMMENDATION",scaleKind:"NPS_0_10",
      scaleValueMap:{},scaleValueOptions:[{label:"10",count:1}]};
    equal_(validateSurveyMappings_([nps]).valid,true,"NPS는 5점 매핑 검증 제외");
  });
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
  test_("Excel 보고서 시각화 함수 제거",function(){
    [createDynamicDashboardSheet_,createDynamicRespondentSheet_,createDynamicMultipleSheet_,createDynamicSatisfactionSheet_].forEach(function(renderer){
      ["SPARKLINE","시각화","setBackgrounds","newChart","insertChart","insertImage"].forEach(function(token){equal_(renderer.toString().indexOf(token),-1,"표 렌더러 금지 구현 "+token);});});});
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
    equal_(calls.setWrap,true,"긴 문항명 줄바꿈");
    styleDynamicReportTotalRow_(range);equal_(calls.setBackground,"#E7E6E6","합계행 배경");
    equal_(calls.setFontWeight,"bold","합계행 굵게");});
  test_("01 조사개요 핵심 7개 항목",function(){
    const source=createDynamicOverviewSheet_.toString();
    ["조사명","조사목적","조사기간","조사대상","조사방법","표본 수","분석방법"].forEach(function(label){
      equal_(source.indexOf('"'+label+'"')>=0,true,"개요 필수 항목 "+label);});
    ["담당부서","문의처","생성기관","분석 문항 수","유효응답 기준","개인정보 처리"].forEach(function(label){
      equal_(source.indexOf('"'+label+'"'),-1,"개요 제외 항목 "+label);});
    equal_(source.indexOf('"A4:B4"')>=0,true,"구분 병합");
    equal_(source.indexOf('"C4:H4"')>=0,true,"내용 병합");});
  test_("보고서 제목·문항 제목·인쇄 설정",function(){
    equal_(formatDynamicQuestionTitle_({question:"Q1 시설 및 환경 만족도"},0),"Q1. 시설 및 환경 만족도","Q 제목");
    equal_(formatDynamicQuestionTitle_({questionId:"Q2",originalHeader:"이용자 유형을 선택해 주세요.",question:"가공 문항"},1),
      "Q2. 이용자 유형을 선택해 주세요.","원본 문항명 우선");
    equal_(formatDynamicQuestionTitle_({questionText:"주로 이용한 공간을 모두 선택해 주세요."},5),
      "문항 6. 주로 이용한 공간을 모두 선택해 주세요.","실제 문항명과 fallback 번호");
    equal_(formatDynamicQuestionTitle_({columnNumber:8,header:"시설 및 환경에 만족하셨습니까?"},0),
      "Q8. 시설 및 환경에 만족하셨습니까?","원본 열 번호와 문항명");
    equal_(formatDynamicQuestionTitle_({questionId:"Q8"},7),"Q8","문항명 없는 questionId fallback");
    equal_(formatDynamicQuestionTitle_({},2),"문항 3","전체 문항정보 fallback");
    equal_(appendDynamicCategoricalQuestions_.toString().indexOf("formatDynamicQuestionTitle_")>=0,true,"03 실제 문항명 적용");
    equal_(createDynamicMultipleSheet_.toString().indexOf("formatDynamicQuestionTitle_")>=0,true,"04 실제 문항명 적용");
    equal_(appendDynamicScaleAnalysis_.toString().indexOf("formatDynamicQuestionTitle_")>=0,true,"05 실제 문항명 적용");
    const worksheet=applyDynamicWorksheetPrintSettingsXml_('<worksheet><sheetData/></worksheet>');
    equal_(worksheet.indexOf('paperSize="9"')>=0,true,"A4");equal_(worksheet.indexOf('orientation="landscape"')>=0,true,"가로");
    equal_(worksheet.indexOf('fitToWidth="1"')>=0,true,"페이지 맞춤");equal_(worksheet.indexOf('left="0.25"')>=0,true,"좁은 여백");
    equal_(worksheet.indexOf('fitToHeight="0"')>=0,true,"세로 여러 페이지 허용");
    const workbook=applyDynamicWorkbookPrintTitlesXml_('<workbook></workbook>',["01_조사개요"]);
    equal_(workbook.indexOf("$1:$4")>=0,true,"반복 머리글");});
  test_("06 주관식 시각화 열 제거와 열 정렬",function(){
    const source=createDynamicAIOpinionSheet_.toString();
    equal_(source.indexOf('"시각화"'),-1,"시각화 헤더 제거");
    equal_(source.indexOf("setDynamicBarSparklines_"),-1,"시각화 값 생성 제거");
    const opinion={validCount:2,categories:[{category:"시설 개선",count:1,responseNumbers:["R01"],
      representativeOpinions:["대표 의견 1","대표 의견 2"]}],opinionAssignments:[{id:"O1",responseNumber:"R01",
      question:"도서관 이용 의견",text:"원문 의견",categories:["시설 개선"]}]};
    const category=buildDynamicAIOpinionCategoryRows_(opinion)[0],detail=buildDynamicAIOpinionDetailRows_(opinion)[0];
    equal_(category.length,7,"요약 7열");equal_(category[3],50,"비율 4열");equal_(category[4],"R01","응답번호 5열");
    equal_(category[5],"대표 의견 1","대표의견1 6열");equal_(category[6],"대표 의견 2","대표의견2 7열");
    equal_(detail.length,6,"상세 6열");equal_(detail[1],"R01","상세 응답번호");equal_(detail[2],"도서관 이용 의견","상세 문항");
    equal_(detail[3],"원문 의견","상세 원문");equal_(detail[4],"시설 개선","상세 AI 범주");});
  test_("문항별 최다·최저와 동률 강조 대상",function(){
    equal_(getDynamicExtremeRowIndexes_([3,7,7,2],"max").join(","),"1,2","최다 동률");
    equal_(getDynamicExtremeRowIndexes_([3,7,7,2],"min").join(","),"3","최저");
    equal_(getDynamicExtremeRowIndexes_([9,2,2],"min",[false,true,true]).join(","),"1,2","제외 및 최저 동률");
    equal_(getDynamicScaleExtremeNames_([{question:"A",validCount:2,average:4.5},{question:"B",validCount:2,average:4.5},
      {question:"C",validCount:2,average:3},{question:"D",validCount:0,average:5}],"max"),"A / B","공동 최고");
    equal_(getDynamicScaleExtremeNames_([{question:"A",validCount:2,average:4},{question:"B",validCount:2,average:2}],"min"),"B","최저 문항");});
  test_("XLSX ZIP 입력 MIME 보정",function(){const calls=[];const blob={copyBlob:function(){return {
      setContentType:function(type){calls.push(type);return this;}};}};
    const zipInput=createDynamicXlsxZipInput_(blob);equal_(Boolean(zipInput),true,"ZIP 입력 Blob");
    equal_(calls[0],"application/zip","ZIP MIME");});
  test_("XLSX 인쇄 설정 실패 시 원본 Blob 유지",function(){const blob={};let logged="";
    const result=applyDynamicXlsxPrintLayoutSafely_(blob,[],"report.xlsx",function(){throw new Error("ZIP 변환 실패");},
      function(error){logged=error.message;});
    equal_(result.blob,blob,"원본 Blob");equal_(result.warning,"ZIP 변환 실패","경고 원문");equal_(logged,"ZIP 변환 실패","오류 로그");});
  test_("XLSX drawing 이미지 relationship 무결성",function(){
    function entry_(name,content){return {getName:function(){return name;},getDataAsString:function(){return content;}};}
    const valid=[entry_("xl/drawings/drawing2.xml",'<xdr:wsDr><a:blip r:embed="rId1"/><a:blip r:embed="rId2"/><a:blip r:embed="rId3"/></xdr:wsDr>'),
      entry_("xl/drawings/_rels/drawing2.xml.rels",'<Relationships><Relationship Id="rId1" Type="x/image" Target="../media/image1.png"/><Relationship Id="rId2" Type="x/image" Target="../media/image2.png"/><Relationship Id="rId3" Type="x/image" Target="../media/image3.png"/></Relationships>'),
      entry_("xl/media/image1.png","1"),entry_("xl/media/image2.png","2"),entry_("xl/media/image3.png","3")];
    const validResult=inspectDynamicXlsxDrawingRelationships_(valid);
    equal_(validResult.mediaCount,3,"media 3개");equal_(validResult.drawingRelationshipCount,3,"relationship 3개");
    equal_(validResult.drawingEmbedCount,3,"embed 3개");equal_(validResult.errors.length,0,"독립 관계 정상");
    const broken=[entry_("xl/drawings/drawing2.xml",'<xdr:wsDr><a:blip r:embed="rId1"/><a:blip r:embed="rId1"/><a:blip r:embed="rId1"/></xdr:wsDr>'),
      entry_("xl/drawings/_rels/drawing2.xml.rels",'<Relationships><Relationship Id="rId1" Type="x/image" Target="../media/image3.png"/></Relationships>'),entry_("xl/media/image3.png","3")];
    equal_(inspectDynamicXlsxDrawingRelationships_(broken).errors.length>0,true,"중복 relationship 탐지");});
  test_("XLSX 빈 drawing 전체 참조 정리",function(){
    function entry_(name,content){return {getName:function(){return name;},getContentType:function(){return "application/xml";},getDataAsString:function(){return content;}};}
    function factory_(content,type,name){return entry_(name,content);}
    const source=[entry_("[Content_Types].xml",'<Types><Override PartName="/xl/drawings/drawing1.xml" ContentType="drawing"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="sheet"/></Types>'),
      entry_("xl/worksheets/sheet1.xml",'<worksheet><sheetData/><drawing r:id="rId1"/></worksheet>'),
      entry_("xl/worksheets/_rels/sheet1.xml.rels",'<Relationships><Relationship Id="rId1" Type="x/drawing" Target="../drawings/drawing1.xml"/><Relationship Id="rId2" Type="x/hyperlink" Target="https://example.com"/></Relationships>'),
      entry_("xl/drawings/drawing1.xml",'<xdr:wsDr xmlns:xdr="x"/>'),
      entry_("xl/drawings/_rels/drawing1.xml.rels",'<Relationships/>')];
    const cleaned=cleanupEmptyDynamicXlsxDrawings_(source,factory_),byName={};
    cleaned.entries.forEach(function(entry){byName[entry.getName()]=entry.getDataAsString();});
    equal_(cleaned.removedDrawingNames.join(","),"xl/drawings/drawing1.xml","빈 drawing 삭제");
    equal_(Boolean(byName["xl/drawings/drawing1.xml"]),false,"drawing part 제거");
    equal_(Boolean(byName["xl/drawings/_rels/drawing1.xml.rels"]),false,"drawing rels 제거");
    equal_(byName["xl/worksheets/sheet1.xml"].indexOf("<drawing"),-1,"worksheet drawing 제거");
    equal_(byName["xl/worksheets/_rels/sheet1.xml.rels"].indexOf('Id="rId1"'),-1,"drawing relationship 제거");
    equal_(byName["xl/worksheets/_rels/sheet1.xml.rels"].indexOf('Id="rId2"')>=0,true,"hyperlink 보존");
    equal_(byName["[Content_Types].xml"].indexOf("drawing1.xml"),-1,"content type 제거");
    equal_(inspectDynamicXlsxDrawingRelationships_(cleaned.entries).errors.length,0,"cleanup 후 dangling 참조 없음");
    const imageDrawing=[entry_("xl/drawings/drawing2.xml",'<xdr:wsDr><xdr:twoCellAnchor><xdr:pic/></xdr:twoCellAnchor></xdr:wsDr>')];
    const chartDrawing=[entry_("xl/drawings/drawing3.xml",'<xdr:wsDr><xdr:absoluteAnchor><xdr:graphicFrame/></xdr:absoluteAnchor></xdr:wsDr>')];
    equal_(cleanupEmptyDynamicXlsxDrawings_(imageDrawing,factory_).removedDrawingNames.length,0,"실제 이미지 drawing 보호");
    equal_(cleanupEmptyDynamicXlsxDrawings_(chartDrawing,factory_).removedDrawingNames.length,0,"실제 chart drawing 보호");});
  test_("XLSX worksheet 인쇄 요소 순서",function(){
    const outlined=applyDynamicWorksheetPrintSettingsXml_(
      '<worksheet><sheetPr><outlinePr summaryBelow="1"/></sheetPr><sheetData/></worksheet>');
    equal_(outlined.indexOf("<outlinePr")<outlined.indexOf("<pageSetUpPr"),true,"outlinePr 뒤 pageSetUpPr");
    equal_(outlined.indexOf("<pageSetUpPr")<outlined.indexOf("</sheetPr>"),true,"pageSetUpPr는 sheetPr 내부");
    equal_(outlined.indexOf("<pageSetUpPr")<outlined.indexOf("<outlinePr"),false,"잘못된 자식 순서 방지");
    const existingFit=applyDynamicWorksheetPrintSettingsXml_(
      '<worksheet><sheetPr><outlinePr/><pageSetUpPr autoPageBreaks="0" fitToPage="0"/></sheetPr><sheetData/></worksheet>');
    equal_((existingFit.match(/<pageSetUpPr\b/g)||[]).length,1,"pageSetUpPr 중복 없음");
    equal_(existingFit.indexOf('fitToPage="1"')>=0,true,"기존 fitToPage 갱신");
    equal_(existingFit.indexOf('autoPageBreaks="0"')>=0,true,"기존 pageSetUpPr 속성 보존");
    const withoutSheetPr=applyDynamicWorksheetPrintSettingsXml_('<worksheet><dimension ref="A1"/><sheetData/></worksheet>');
    equal_(withoutSheetPr.indexOf("<sheetPr")<withoutSheetPr.indexOf("<dimension"),true,"sheetPr 최상위 스키마 위치");
    const drawing=applyDynamicWorksheetPrintSettingsXml_('<worksheet><sheetData/><drawing r:id="rId1"/></worksheet>');
    equal_(drawing.indexOf("<sheetData")<drawing.indexOf("<pageMargins"),true,"sheetData 다음 인쇄 요소");
    equal_(drawing.indexOf("<pageSetup")<drawing.indexOf("<drawing"),true,"drawing 앞 pageSetup");
    const legacy=applyDynamicWorksheetPrintSettingsXml_(
      '<worksheet><sheetData/><autoFilter/><drawing/><legacyDrawing/></worksheet>');
    equal_(legacy.indexOf("<autoFilter")<legacy.indexOf("<pageMargins"),true,"autoFilter 유지");
    equal_(legacy.indexOf("<pageSetup")<legacy.indexOf("<drawing"),true,"후반 요소 앞 삽입");
    const existing=applyDynamicWorksheetPrintSettingsXml_(
      '<worksheet><sheetData/><pageMargins left="1"/><pageSetup/><drawing/></worksheet>');
    equal_((existing.match(/<pageMargins\b/g)||[]).length,1,"pageMargins 중복 없음");
    equal_((existing.match(/<pageSetup\b/g)||[]).length,1,"pageSetup 중복 없음");
    const plain=applyDynamicWorksheetPrintSettingsXml_('<worksheet><sheetData/></worksheet>');
    equal_(plain.indexOf("<pageSetup")<plain.indexOf("</worksheet>"),true,"후반 요소 없을 때 종료 태그 앞");
    const namespaced=insertDynamicWorksheetPrintElements_(
      '<x:worksheet><x:sheetData/><x:drawing/></x:worksheet>','<x:pageMargins/><x:pageSetup/>');
    equal_(validateDynamicWorksheetElementOrder_(namespaced).length,0,"namespace prefix 순서");
    const invalid='<worksheet><sheetData/><drawing/><pageMargins/><pageSetup/></worksheet>';
    equal_(validateDynamicWorksheetElementOrder_(invalid).indexOf("pageSetup이 drawing 뒤에 있습니다.")>=0,true,
      "잘못된 요소 순서 탐지");});
  test_("Drive export 원본 Blob 무후처리 반환",function(){const calls=[];const blob={
      setName:function(name){calls.push(["name",name]);return this;},
      setContentType:function(type){calls.push(["type",type]);return this;}};
    const result=finalizeDynamicDriveExportBlob_(blob,"report.xlsx");
    equal_(result,blob,"동일 Blob 반환");equal_(calls.length,2,"이름과 MIME만 설정");
    equal_(calls[0][1],"report.xlsx","파일명");
    equal_(calls[1][1],"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","XLSX MIME");
    equal_(isDynamicXlsxDiagnosticMode_({xlsxDiagnosticMode:true}),true,"명시적 진단 모드");
    equal_(buildDynamicXlsxDiagnosticFileName_("report.xlsx","DRIVE_ORIGINAL"),
      "report_DRIVE_ORIGINAL.xlsx","원본 진단 파일명");
    equal_(buildDynamicXlsxDiagnosticFileName_("report","POSTPROCESSED"),
      "report_POSTPROCESSED.xlsx","후처리 진단 파일명");});
  test_("최종 내보내기 품질검사 제외",function(){
    const names=getDynamicExportSheetNames_();
    equal_(names.indexOf("00_품질검사"),-1,"품질검사 제외");
    equal_(names[0],"01_조사개요","첫 결과 시트");});
  test_("복수응답 구분자와 가운데점 보존",function(){
    equal_(splitDynamicMultipleValue_("A|B|C").join("|"),"A|B|C","파이프 구분자");
    equal_(splitDynamicMultipleValue_("A;B;C").join("|"),"A|B|C","세미콜론 구분자");
    equal_(splitDynamicMultipleValue_("A\nB\nC").join("|"),"A|B|C","줄바꿈 구분자");
    equal_(splitDynamicMultipleValue_("AI/VR/AR/XR 체험").join("|"),"AI/VR/AR/XR 체험","슬래시 항목 보존");
    equal_(splitDynamicMultipleValue_("온/오프라인").join("|"),"온/오프라인","온오프라인 보존");
    equal_(splitDynamicMultipleValue_("부모/보호자").join("|"),"부모/보호자","부모 보호자 보존");
    equal_(splitDynamicMultipleValue_("AI/VR 체험|로봇/코딩 교육").join("|"),"AI/VR 체험|로봇/코딩 교육","파이프만 분리");
    equal_(splitDynamicMultipleValue_("문화·예술").join("|"),"문화·예술","가운데점은 응답 일부");});
  test_("Mapping과 원자료 헤더 탐지 규칙 공유",function(){
    function sheet_(name,values){return {getName:function(){return name;},getLastRow:function(){return values.length;},
      getLastColumn:function(){return values.reduce(function(max,row){return Math.max(max,row.length);},0);},
      getRange:function(row,column,rowCount,columnCount){return {getDisplayValues:function(){return values.slice(row-1,row-1+rowCount).map(function(source){const result=source.slice(column-1,column-1+columnCount);while(result.length<columnCount)result.push("");return result;});}};}};}
    const first=sheet_("1행헤더",[["응답일시","Q1"],["1","A"],["2","B"]]);
    const third=sheet_("3행헤더",[["만족도 조사 결과",""],["2026년 상반기",""],["응답일시","Q1"],["1","A"],["2","B"]]);
    equal_(readSurveySheetStructureForMapping_(first).headerRow,1,"1행 헤더 호환");
    equal_(readSurveySheetStructureForMapping_(third).headerRow,3,"3행 헤더 탐지");
    equal_(readSurveySheetStructureForMapping_(first).responseCount,2,"1행 헤더 응답 2건");
    equal_(readSurveySheetStructureForMapping_(third).responseCount,2,"3행 헤더 응답 2건");
    const blanks=sheet_("빈행포함",[["응답일시","Q1"],["1","A"],["",""],["2","B"],["",""]]);
    equal_(readSurveySheetStructureForMapping_(blanks).responseCount,2,"중간·마지막 빈 행 제외");
    const eightyTwo=sheet_("82명",[["응답일시","Q1"]].concat(new Array(82).fill(null).map(function(_,index){return [String(index+1),"A"];})));
    equal_(readSurveySheetStructureForMapping_(eightyTwo).responseCount,82,"82명 server preview count");
    const selected=findBestSurveySheetForMapping_({getSheets:function(){return [sheet_("안내",[["제목","설명"],["내용",""]]),third];}});
    equal_(selected.getName(),"3행헤더","실제 응답 시트 선택");
    const rawSource=createGenericRawSheetFromWeb.toString();
    equal_(rawSource.indexOf("findBestSurveySheetForMapping_")>=0,true,"원자료 동일 시트 helper");
    equal_(rawSource.indexOf("readSurveySheetStructureForMapping_")>=0,true,"원자료 동일 헤더 helper");
    equal_(rawSource.indexOf("structure.headerRow")>=0,true,"헤더부터 원자료 읽기");});
  test_("동적 대시보드 호환성 시나리오",function(){
    function scales_(count,prefix){return new Array(count).fill(null).map(function(_,index){return {question:(prefix||"만족도 문항 ")+(index+1),average:4.8-index*0.1};});}
    function items_(count,prefix,zero){return new Array(count).fill(null).map(function(_,index){return {label:prefix+(index+1),count:zero?0:count-index,respondentRate:zero?0:(count-index)*10};});}
    function analysis_(respondents,scaleCount,improvementCount,futureCount,recommendation){return {respondentCount:respondents,
      scale:scales_(scaleCount),scaleSummary:scaleCount?{weightedAverage:4.1,overallPositiveRate:76.8}:{weightedAverage:null,overallPositiveRate:null},
      recommendation:recommendation||[],multiple:[{question:"개선 필요사항",items:items_(improvementCount,"개선 ",false)},
        {question:"향후 희망 서비스",items:items_(futureCount,"희망 ",false)}],text:[]};}
    const a=buildDynamicDashboardModel_(analysis_(30,3,2,4,[{question:"재이용",scaleKind:"RECOMMENDATION_1_5",positiveRate:85}]),{});
    equal_(a.kpis[0].displayText,"30명","A 응답자");equal_(a.satisfactionItems.length,3,"A 만족도 3개");
    equal_(a.improvementItems.length,2,"A 개선 2개");equal_(a.futureItems.length,4,"A 희망 4개");
    equal_(a.multipleSections.length,2,"A 대시보드 복수응답 2개");
    equal_(a.kpis[3].displayText,"85.0%","A NPS 없음");
    const b=buildDynamicDashboardModel_(analysis_(80,5,7,8,[{question:"재이용",scaleKind:"RECOMMENDATION_1_5",positiveRate:85},
      {question:"추천",scaleKind:"NPS_0_10",nps:30.4}]),{});
    equal_(b.satisfactionItems.length,5,"B 만족도 5개");equal_(b.improvementItems.length,5,"B 개선 TOP5");
    equal_(b.futureItems.length,5,"B 희망 TOP5");equal_(b.kpis[3].displayText,"85.0%\nNPS +30.4","B 복합 KPI");
    const c=buildDynamicDashboardModel_(analysis_(250,9,0,3,[{question:"추천",scaleKind:"NPS_0_10",nps:12.3}]),{});
    equal_(c.kpis[0].displayText,"250명","C 응답자");equal_(c.satisfactionItems.length,5,"C 만족도 최대5");
    equal_(c.hasMoreSatisfaction,true,"C 상세 안내");equal_(c.improvementItems.length,0,"C 개선 없음");
    equal_(c.kpis[3].label,"추천지수 NPS","C NPS 전용 제목");equal_(c.kpis[3].displayText,"+12.3","C NPS 전용 값");
    const d=buildDynamicDashboardModel_(analysis_(0,0,0,0,[]),{});
    equal_(d.kpis[1].displayText,"해당 없음","D 만족도 없음");equal_(d.kpis[2].displayText,"해당 없음","D 긍정률 없음");
    equal_(d.kpis[3].displayText,"해당 없음","D 추천 없음");equal_(d.coreMetrics[0].value,"해당 없음","D 핵심 결과 없음");
    const longLabel="매우 긴 문항명을 가진 중원도서관 이용환경 및 자료 서비스 전반에 대한 만족도 조사 문항입니다";
    const e=buildDynamicDashboardModel_({respondentCount:10,scale:[{question:longLabel,average:4.2}],
      scaleSummary:{weightedAverage:4.2,overallPositiveRate:80},recommendation:[],multiple:[],text:[]},{});
    equal_(e.satisfactionItems[0].label,longLabel,"E 긴 만족도 문항 원문 유지");
    equal_(e.coreMetrics[0].value,"4.20점","E 최고 만족도 값 분리 표시");
    equal_(getDynamicDashboardRowHeight_(longLabel,42,32,56)>32,true,"E 긴 문항 행 높이 확대");
    const zeroItems=buildDynamicDashboardItems_(items_(6,"동률 ",true),null,5,false);
    equal_(zeroItems.length,5,"F 0건 TOP5");equal_(zeroItems[0].label,"동률 1","F 동률 원래 순서");
    equal_(zeroItems[4].label,"동률 5","F 동률 안정 정렬");
    const onlyFive=buildDynamicDashboardModel_(analysis_(10,1,0,0,[{question:"재이용",scaleKind:"RECOMMENDATION_1_5",positiveRate:81.2}]),{});
    const onlyNps=buildDynamicDashboardModel_(analysis_(10,1,0,0,[{question:"추천",scaleKind:"NPS_0_10",nps:-5.5}]),{});
    equal_(onlyFive.kpis[3].displayText,"81.2%","I 5점 의향만 존재");equal_(onlyNps.kpis[3].displayText,"-5.5","J NPS만 존재");
    equal_(b.coreMetrics.length,5,"K 양쪽 지표 독립 행");equal_(d.coreMetrics[3].value,"해당 없음","L 의향 없음 명시");});
  test_("대시보드 복수응답 의미 분류와 동적 선택",function(){
    function q_(question,count){return {question:question,items:[{label:"항목",count:count,selectionRate:25,respondentRate:20,validRespondentRate:20}]};}
    const sections=buildDynamicDashboardMultipleSections_([
      q_("프로그램에서 좋았던 점을 모두 선택",3),q_("앞으로 참여하고 싶은 프로그램",4),
      q_("도서관 이용 목적",8),q_("개선이 필요한 사항",2)]);
    equal_(sections.length,2,"최대 2개");equal_(sections[0].title,"개선 필요사항 TOP 5","개선 우선");
    equal_(sections[1].title,"향후 희망 프로그램 TOP 5","향후 프로그램 다음");
    equal_(buildDynamicDashboardMultipleSections_([]).length,0,"복수응답 없음");
    equal_(buildDynamicDashboardMultipleSections_([q_("도서관 이용 목적",1)])[0].title,"도서관 이용 목적 TOP 5","기타 원문 제목");});
  test_("04 복수응답 표시 모델",function(){
    const source=[{label:"동률 B",count:3,selectionRate:30,respondentRate:20,validRespondentRate:20},
      {label:"최다",count:5,selectionRate:50,respondentRate:40,validRespondentRate:50},
      {label:"동률 A",count:3,selectionRate:20,respondentRate:20,validRespondentRate:20}];
    const display=getDynamicMultipleDisplayItems_(source);
    equal_(display.map(function(item){return item.label;}).join(","),"최다,동률 B,동률 A","count 내림차순 및 동률 안정 정렬");
    equal_(source[0].label,"동률 B","원본 배열 불변");
    equal_(shouldShowDynamicValidRespondentRate_(display),true,"선택률 차이 열 표시");
    equal_(shouldShowDynamicValidRespondentRate_([{respondentRate:20,validRespondentRate:20+1e-10}]),false,"epsilon 동일 처리");
    equal_(buildDynamicMultipleQuestionSummary_({validRespondents:4,totalSelections:6}),"유효 응답자 4명 · 총 선택 6건 · 1인 평균 1.50개 선택","문항 요약");
    equal_(buildDynamicMultipleQuestionSummary_({validRespondents:0,totalSelections:0}).indexOf("해당 없음")>=0,true,"0 분모 안전");
    const renderer=createDynamicMultipleSheet_.toString();
    ["setDynamicBarSparklines_","newChart","insertChart","insertImage","getBlob","SPARKLINE","█","░"].forEach(function(token){
      equal_(renderer.indexOf(token),-1,"04 금지 구현 "+token);});});
  test_("AI 문서형 본문 폭과 문단 높이",function(){
    equal_(getDynamicAIParagraphRowHeight_("짧은 문단"),54,"짧은 문단");
    equal_(getDynamicAIParagraphRowHeight_(new Array(320).join("가")),84,"중간 문단");
    equal_(getDynamicAIParagraphRowHeight_(new Array(920).join("가")),150,"긴 문단");
    const source=createDynamicAITextSheet_.toString();
    equal_(source.indexOf("setColumnWidths(1, 8, 220)")>=0,true,"07·08 A:H 문서 폭");
    equal_(source.indexOf("getDynamicAIParagraphRowHeight_")>=0,true,"07·08 동적 행 높이");});
  test_("07·08 공공기관 보고서 프롬프트 계약",function(){
    const context={respondentCount:3,satisfactionSummary:{weightedAverage:4.51,overallPositiveRate:92.3},
      satisfactionQuestions:[],recommendation:[],multipleResponses:[],respondentCharacteristics:[],opinionSummary:{validCount:0,categories:[]}};
    const summary=buildDynamicAISummaryPrompt_(context),future=buildDynamicAIFuturePlanPrompt_(context,"○ 검증된 총평");
    ["행정 실무자","제목을 출력하지 않고","○ ","⇒ ","나타남","상대적 최저","만들지 않는다","데이터가 있는 항목만","respondentRate"].forEach(function(token){
      equal_(summary.indexOf(token)>=0,true,"총평 지침 "+token);});
    ["제목을 출력하지 않고","총평을 반복하는 문서가 아니며","반영","확대·개편 검토","단계적 추진","확정되지 않은 사업"].forEach(function(token){
      equal_(future.indexOf(token)>=0,true,"향후계획 지침 "+token);});
    equal_(summary.indexOf('"weightedAverage": 4.51')>=0,true,"검증 평균 원문 유지");
    equal_(summary.indexOf('"overallPositiveRate": 92.3')>=0,true,"검증 긍정률 원문 유지");
    equal_(future.indexOf("○ 검증된 총평")>=0,true,"기존 총평 전달 유지");
    const common=buildDynamicAIInterpretationRules_();
    ["합산·재계산·추정","인과 표현","마크다운 제목","해당 분석 데이터가 없으면"].forEach(function(token){
      equal_(common.indexOf(token)>=0,true,"공통 사실성 지침 "+token);});});
  test_("AI plain text 최소 후처리",function(){
    const markdown="# Ⅶ. 총평\n\n**○ 결과가 확인됨**\n* 운영 검토\n| 구분 | 내용 |\n|---|---|\n```text\n⇒ 시사점\n```";
    const normalized=normalizeDynamicAIReportText_(markdown);
    ["#","**","```","|---|"].forEach(function(token){equal_(normalized.indexOf(token),-1,"마크다운 제거 "+token);});
    equal_(normalized.indexOf("Ⅶ. 총평"),-1,"중복 제목 제거");
    equal_(normalized.indexOf("○ 결과가 확인됨")>=0,true,"주요 결과 기호 보존");
    equal_(normalized.indexOf("- 운영 검토")>=0,true,"하위항목 통일");
    equal_(normalized.indexOf("⇒ 시사점")>=0,true,"시사점 기호 보존");
    equal_(splitDynamicAIParagraphs_("○ 결과\n⇒ 시사점\n- 실행\n⦁ 세부").join("|") ,"○ 결과|⇒ 시사점|- 실행|⦁ 세부","보고서 기호 문단 보존");});
  test_("대시보드 텍스트 셀 숫자 형식 미적용과 반복 초기화",function(){
    equal_(renderDynamicDashboardSatisfactionRows_.toString().indexOf("setNumberFormat")>=0,true,"숫자값 numberFormat 적용");
    const calls=[];const range={breakApart:function(){calls.push("unmerge");return this;},
      clearContent:function(){calls.push("content");return this;},clearDataValidations:function(){calls.push("validation");return this;},
      clearNote:function(){calls.push("notes");return this;},setBackground:function(){calls.push("visual");return this;},
      setFontColor:function(){return this;},setFontWeight:function(){return this;},setFontStyle:function(){return this;},
      setHorizontalAlignment:function(){return this;},setVerticalAlignment:function(){return this;},setWrap:function(){return this;},
      setBorder:function(){return this;}};
    const sheet={getRange:function(a1){equal_(a1,"A1:V40","이전 A:V 색상까지 초기화");return range;}};
    resetDynamicDashboardRange_(sheet);resetDynamicDashboardRange_(sheet);
    equal_(calls.join(","),"unmerge,content,validation,notes,visual,unmerge,content,validation,notes,visual","연속 초기화 순서");
    equal_(calls.indexOf("content")<calls.indexOf("visual"),true,"typed content 선제 제거");
    equal_(resetDynamicDashboardRange_.toString().indexOf("clearFormat"),-1,"숫자 형식 포함 초기화 없음");});
  test_("대시보드 고정 해제와 병합 계획",function(){
    [[1,0],[2,0],[0,1]].forEach(function(initial){const calls=[];const merged={getA1Notation:function(){return "A1:P2";},
      getRow:function(){return 1;},getLastRow:function(){return 2;},getColumn:function(){return 1;},getLastColumn:function(){return 16;},breakApart:function(){}};
      const sheet={getName:function(){return "02_대시보드";},getFrozenRows:function(){return initial[0];},
        getFrozenColumns:function(){return initial[1];},setFrozenRows:function(value){calls.push("rows="+value);},
        setFrozenColumns:function(value){calls.push("columns="+value);},getRange:function(){return {getMergedRanges:function(){return [merged];}};}};
      let logged="";prepareDynamicDashboardFreezeState_(sheet,function(message){logged=message;});
      equal_(calls.join(","),"rows=0,columns=0","고정 해제 순서 "+initial.join("/"));
      equal_(logged.indexOf("frozenRows="+initial[0])>=0,true,"기존 고정 행 로그");
      equal_(logged.indexOf("currentMerges=A1:P2")>=0,true,"기존 병합 로그");});
    const planned=getDynamicDashboardPlannedMerges_();
    equal_(planned.length,69,"동적 행 병합 계획 수");
    equal_(planned.indexOf("A1:P2")>=0,true,"A:P 제목 영역");
    equal_(planned.indexOf("A19:P19")>=0,true,"만족도 상세 안내 영역");
    equal_(getDynamicDashboardPlannedMerges_(0).length,31,"복수응답 없음 동적 당김");
    equal_(getDynamicDashboardPlannedMerges_(1).length,50,"복수응답 1개 동적 당김");
    equal_(planned.indexOf("H12:N20"),-1,"핵심 결과 대형 병합 제거");equal_(planned.indexOf("A34:N38"),-1,"해석 대형 병합 제거");
    equal_(new Set(planned).size,planned.length,"중복 병합 없음");
    equal_(validateDynamicDashboardMergePlan_(planned).length,0,"병합 범위 비중첩");
    equal_(validateDynamicDashboardMergePlan_(["A1:H2","A2:B3"]).length,1,"겹침 탐지");
    const merged=[];const sheet={getFrozenRows:function(){return 0;},getFrozenColumns:function(){return 0;},
      getRange:function(a1){return {getMergedRanges:function(){return [];},merge:function(){merged.push(a1);return this;}};}};
    planned.forEach(function(a1){safeMergeDynamicDashboardRange_(sheet,a1,"test");});
    equal_(merged.join(","),planned.join(","),"제목과 KPI 병합 성공");
    equal_(createDynamicDashboardSheet_.toString().indexOf("insertImage"),-1,"손상 가능 이미지 미삽입");
    equal_(createDynamicDashboardSheet_.toString().indexOf("newChart"),-1,"EmbeddedChart 미생성");
    const dashboardSource=createDynamicDashboardSheet_.toString()+renderDynamicDashboardSatisfactionRows_.toString()+renderDynamicDashboardTopRows_.toString();
    ["newChart","insertChart","insertImage","getBlob","SPARKLINE","setBackgrounds","시각화","█","░"].forEach(function(token){
      equal_(dashboardSource.indexOf(token),-1,"대시보드 금지 구현: "+token);});
    equal_(renderDynamicDashboardSatisfactionRows_.toString().indexOf("truncate")<0,true,"만족도 문항 축약 없음");
    equal_(renderDynamicDashboardTopRows_.toString().indexOf("truncate")<0,true,"TOP 항목 축약 없음");
    equal_(resetDynamicDashboardSheet_.toString().indexOf("getImages")>=0,true,"기존 PNG 제거");
    equal_(createDynamicDashboardSheet_.toString().indexOf("setFrozenRows(2)"),-1,"최종 고정 행 없음");});
  test_("파생열 기본 제외와 원문 보존",function(){["정규화 이용자 유형","Q1점수","6문항 평균","추천점수","선택수","주관식 유효여부","derived_value"].forEach(function(header){equal_(suggestSurveyQuestionType_(header,"1"),"EXCLUDE","파생열 "+header);});equal_(suggestSurveyQuestionType_("평균적으로 얼마나 만족하십니까?","매우 만족" )!=="EXCLUDE",true,"실제 문항 과잉 제외 방지");});
  test_("5점 척도 별칭은 매핑 추천에만 사용",function(){
    equal_(suggestSurveyScaleScore_("매우 만족"),5,"만족형 추천");
    equal_(suggestSurveyScaleScore_("매우 그러함"),5,"동의형 최상 추천");
    equal_(suggestSurveyScaleScore_("그러함"),4,"동의형 추천");
    equal_(suggestSurveyScaleScore_("그렇지 않음"),2,"동의형 부정 추천");
    equal_(suggestSurveyScaleScore_("매우 유익함"),null,"새 표현 임의 추천 금지");
  });
  test_("문항별 scaleValueMap이 새로운 표현과 공백 변형을 분석",function(){
    const first={columnNumber:1,originalHeader:"유익성",selectedType:"SCALE",analysisTarget:true,
      scaleValueMap:{"매우 유익함":5,"유익함":4,"보통":3,"유익하지 않음":2,"전혀 유익하지 않음":1}};
    const second={columnNumber:2,originalHeader:"도움",selectedType:"SCALE",analysisTarget:true,
      scaleValueMap:{"매우 도움됨":5,"도움됨":4,"보통":3,"도움되지 않음":2,"전혀 도움되지 않음":1}};
    const result=analyzeDynamicScaleQuestions_({respondentCount:2,rows:[[" 매우   유익함 ","도움됨"],["유익하지\n않음","전혀 도움되지 않음"]],mappings:[first,second]});
    equal_(result[0].validCount,2,"새 표현 유효응답");equal_(result[0].average,3.5,"사용자 지정 평균");
    equal_(result[0].unmappedCount,0,"공백 정규화 일치");equal_(result[1].average,2.5,"문항별 독립 매핑");
    const quality=validateDynamicSurveyQuality_({respondentCount:2,respondent:[],single:[],multiple:[],scale:result,recommendation:[],text:[]},{});
    equal_(quality.errors.filter(function(item){return item.code==="SCALE_UNMAPPED_VALUE";}).length,0,"Quality 동일 매핑 결과 사용");
  });
  test_("명시적 scaleValueMap은 미매핑 값을 별칭으로 우회하지 않음",function(){
    const explicit=analyzeDynamicScaleQuestions_({respondentCount:2,rows:[["만족"],["기타"]],mappings:[{columnNumber:1,originalHeader:"척도",selectedType:"SCALE",analysisTarget:true,scaleValueMap:{"만족":4}}]})[0];
    equal_(explicit.unmappedCount,1,"미매핑 값 탐지");
    const legacy=analyzeDynamicScaleQuestions_({respondentCount:1,rows:[["매우 만족"]],mappings:[{columnNumber:1,originalHeader:"척도",selectedType:"SCALE",analysisTarget:true,scoreMap:{}}]})[0];
    equal_(legacy.average,5,"기존 매핑 별칭 호환");
  });
  test_("scaleValueMap 저장 JSON 왕복과 미완료 검증",function(){
    const map={"매우 유익함":5,"유익함":4,"보통":3,"유익하지 않음":2,"전혀 유익하지 않음":1};
    const restored=parseSurveyMappingScoreMap_(JSON.stringify(map));
    equal_(restored["매우 유익함"],5,"저장 매핑 복원");equal_(restored["전혀 유익하지 않음"],1,"저장 매핑 최저점 복원");
    const valid=validateSurveyMappings_([{columnNumber:1,originalHeader:"유익성",selectedType:"SCALE",scaleKind:"RECOMMENDATION_1_5",scaleValueMap:map,scaleValueOptions:Object.keys(map).map(function(label){return {label:label,count:1};})}]);
    equal_(valid.valid,true,"완료된 신규 매핑 저장 가능");
    const invalid=validateSurveyMappings_([{columnNumber:1,originalHeader:"유익성",selectedType:"SCALE",scaleKind:"RECOMMENDATION_1_5",scaleValueMap:{"보통":3},scaleValueOptions:[{label:"보통"},{label:"기타"}]}]);
    equal_(invalid.valid,false,"미매핑 응답 저장 차단");
  });
  test_("Survey AI validator 허용 문항 5종",function(){
    const valid={description:" 안내문 ",questions:[
      {title:"단일",type:"SINGLE",required:true,options:["가","나"]},
      {title:"복수",type:"MULTIPLE",required:false,options:["가","나","다"],maxSelections:2},
      {title:"척도",type:"SCALE",required:true,scalePreset:"SATISFACTION_5"},
      {title:"의견",type:"TEXT",required:false},
      {title:"연령",type:"RESPONDENT",respondentField:"AGE_GROUP",required:false,options:["20대","30대"]}
    ]};
    equal_(validateSurveyDraftAiResponse_(valid),valid,"허용 구조 통과");
  });
  test_("Survey AI validator 금지 구조 차단",function(){
    function rejected_(question,top){let rejected=false;try{validateSurveyDraftAiResponse_(top||{description:"안내",questions:[question]});}catch(error){rejected=error.code==="SURVEY_AI_VALIDATION_ERROR";}return rejected;}
    equal_(rejected_({title:"x",type:"UNKNOWN",required:true}),true,"미지원 type");
    equal_(rejected_({title:"x",type:"SINGLE",required:true,options:["하나"]}),true,"단일 선택지 부족");
    equal_(rejected_({title:"x",type:"MULTIPLE",required:true,options:["가","나"],maxSelections:3}),true,"최대 선택 초과");
    equal_(rejected_({title:"x",type:"MULTIPLE",required:true,options:["가","나"],maxSelections:1}),true,"최대 선택 1 차단");
    equal_(rejected_({title:"x",type:"SCALE",required:true,scalePreset:"SATISFACTION_5",options:["가","나"]}),true,"SCALE options 차단");
    equal_(rejected_({title:"x",type:"SCALE",required:true,scalePreset:"OTHER"}),true,"미지원 preset");
    equal_(rejected_({title:"x",type:"TEXT",required:false,options:["가","나"]}),true,"TEXT options 차단");
    equal_(rejected_({title:"x",type:"RESPONDENT",required:false,respondentField:"UNKNOWN",options:["가","나"]}),true,"미지원 respondentField");
    equal_(rejected_({title:" ",type:"TEXT",required:false}),true,"빈 title");
    equal_(rejected_({title:"x",type:"TEXT",required:"false"}),true,"required 문자열");
    equal_(rejected_({title:"x",type:"TEXT",required:false,extra:true}),true,"추가 property");
    equal_(rejected_(null,{description:"안내",questions:[]}),true,"빈 questions");
    equal_(rejected_({questionId:"Q1",title:"x",type:"TEXT",required:false}),true,"AI questionId 차단");
  });
  test_("Survey AI normalizer 시스템 식별자와 preset 적용",function(){
    const input={title:"원본 조사명",targetAudience:"원본 조사 대상",requestContent:"요청",referenceInfo:""};
    const raw={description:"  안내문  ",questions:[
      {title:"  선택 질문  ",type:"SINGLE",required:true,options:[" 가 ","나","가"]},
      {title:"척도",type:"SCALE",required:true,scalePreset:"SATISFACTION_5"}
    ]};
    const normalized=normalizeSurveyDraft_(raw,input);
    equal_(normalized.survey.title,"원본 조사명","사용자 title 유지");equal_(normalized.survey.targetAudience,"원본 조사 대상","사용자 대상 유지");
    equal_(normalized.survey.description,"안내문","AI description 유지");equal_(normalized.questions[0].questionId,"Q1","Q1 생성");
    equal_(normalized.questions[1].questionId,"Q2","Q2 생성");equal_(normalized.questions[1].order,2,"order 생성");
    equal_(normalized.questions[0].options.join(","),"가,나","trim 및 중복 제거");
    equal_(normalized.questions[1].options.join(","),"매우 만족,만족,보통,불만족,매우 불만족","시스템 SCALE preset");
  });
  test_("Gemini thought part와 최종 JSON 분리",function(){
    const parts=[
      {text:"내부 사고 과정 {완성 JSON 아님}",thought:true,thoughtSignature:"signature"},
      {thoughtSignature:"metadata-only"},
      {text:'{"description":"안내","questions":[]}' }
    ];
    equal_(extractGeminiCandidateText_(parts),'{"description":"안내","questions":[]}',"최종 응답 text만 반환");
    equal_(parseSurveyDraftGeminiResponse_(extractGeminiCandidateText_(parts)).description,"안내","직접 JSON parse 성공");
  });
  test_("Survey AI responseSchema 문항 type별 분리",function(){
    const variants=getSurveyDraftGeminiResponseSchema_().properties.questions.items.anyOf;
    equal_(variants.length,5,"문항 schema 5종");
    const byType={};variants.forEach(function(variant){byType[variant.properties.type.enum[0]]=variant;});
    equal_(Object.keys(byType).sort().join(","),"MULTIPLE,RESPONDENT,SCALE,SINGLE,TEXT","허용 type 5종");
    equal_(Object.keys(byType.SINGLE.properties).sort().join(","),"options,required,title,type","SINGLE 필드");
    equal_(Object.keys(byType.MULTIPLE.properties).sort().join(","),"maxSelections,options,required,title,type","MULTIPLE 필드");
    equal_(byType.MULTIPLE.required.indexOf("maxSelections"),-1,"maxSelections 선택 필드");
    equal_(Object.keys(byType.SCALE.properties).sort().join(","),"required,scalePreset,title,type","SCALE 필드");
    equal_(byType.SCALE.properties.scalePreset.enum[0],"SATISFACTION_5","SCALE preset 고정");
    equal_(Object.keys(byType.TEXT.properties).sort().join(","),"required,title,type","TEXT 필드");
    equal_(Object.keys(byType.RESPONDENT.properties).sort().join(","),"options,required,respondentField,title,type","RESPONDENT 필드");
  });
  test_("Survey AI System Prompt v1.1 의미 품질 계약",function(){
    equal_(SURVEY_AI_SYSTEM_PROMPT_VERSION,"1.1","prompt version");
    const prompt=getSurveyAiSystemPrompt_();[
      "사용자가 요청하지 않은 새로운 평가 개념","SCALE 한 문항은 하나의 독립적인 평가 요소",
      "확인되지 않은 실제 홍보·접수 채널","법률명·법률 조항","개인정보는 안전하게 보호됩니다",
      "익명 또는 무기명으로 처리됩니다","required: false를 우선","실제 분석에 필요한 최소한",
      "보호자의 연령을 수강생 연령으로 착각","사용자가 복수응답을 명시하지 않았다면",
      "title에는 질문 자체의 의미만","담당 부서·담당자·전화번호","2~3개의 짧은 문단"
    ].forEach(function(token){equal_(prompt.indexOf(token)>=0,true,"v1.1 규칙: "+token);});
    equal_(getSurveyDraftGeminiResponseSchema_().properties.questions.items.anyOf.length,5,"responseSchema 유지");
  });
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
    "secureExportDynamicSurveyReportFromWeb",
    "securePrepareDynamicVisualizationPdfExportFromWeb",
    "securePrepareDynamicVisualizationPngExportFromWeb",
    "secureGenerateSurveyDraftFromWeb"
  ];
  const missing = requiredApis.filter(function(apiName) {
    return typeof globalThis[apiName] !== "function";
  });
  if (missing.length) {
    throw new Error("누락된 Dynamic Survey 공개 API: " + missing.join(", "));
  }
  return {success:true, checked:requiredApis.length, missing:[]};
}
