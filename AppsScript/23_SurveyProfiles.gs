/** 사전 등록 설문 설계 metadata와 보수적 header 감지를 제공합니다. */
function getSurveyProfiles_() {
  const scoreMap={"100점 이하":100,"90점 이하":90,"80점 이하":80,"70점 이하":70,"60점 이하":60,"50점 이하":50};
  return [{
    profileId:"JUNGWON_MATERIAL_SATISFACTION_2026",title:"2026년 자료만족도 설문 조사",
    purpose:"중원도서관 자료 만족도 및 인지도 조사",period:"2026-05-18 ~ 2026-08-30",
    department:"중원도서관 자료봉사팀",contact:"031-724-0681",
    analysisNote:"설문 응답 선택지의 표기값을 기관의 점수척도 의도에 따라 100·90·80·70·60·50점으로 분석함.",
    sections:[{id:"USAGE",title:"이용 현황",questions:[1,2,3,4]},{id:"SERVICE",title:"서비스 인지도 및 이용",questions:[5,6,7,8]},{id:"SCORE",title:"자료서비스 점수평가",questions:[9,10,11,12,13]},{id:"OPINION",title:"자유의견",questions:[14]},{id:"RESPONDENT",title:"응답자 특성",questions:[15,16,17,18]}],
    questions:[
      {no:1,title:"중원도서관을 얼마나 자주 이용하십니까?",type:"SINGLE",tokens:["중원도서관","얼마나자주","이용"]},
      {no:2,title:"중원도서관을 이용하는 목적은 무엇입니까?",type:"MULTIPLE",tokens:["중원도서관","이용","목적"]},
      {no:3,title:"도서관에서 소장중인 자료 중 자주 이용하는 자료는 무엇입니까?",type:"MULTIPLE",tokens:["소장중인자료","자주이용","자료"]},
      {no:4,title:"대출할 자료를 선택할 때 주로 고려하는 기준은 무엇입니까?",type:"MULTIPLE",tokens:["대출할자료","선택","고려","기준"]},
      {no:5,title:"중원도서관에서 제공하는 자료 이용 서비스 중 알고 있는 항목을 선택해 주십시오.",type:"MULTIPLE",groupId:"자료 이용 서비스 인지도",tokens:["중원도서관","자료이용서비스","알고있는항목"]},
      {no:6,title:"중원도서관 홈페이지에서 제공하는 정보 및 서비스 중 이용해 본 항목을 선택해 주십시오.",type:"MULTIPLE",groupId:"홈페이지 서비스 이용 경험",multipleChoices:["(커뮤니티) 페이스북, X(舊 트위터), 블로그, 인스타그램, 유튜브, 카카오톡 채널 등"],tokens:["중원도서관홈페이지","정보및서비스","이용해본항목"]},
      {no:7,title:"중원도서관에서 제공하는 독서정보 중 도움을 받은 항목을 선택해 주십시오.",type:"MULTIPLE",groupId:"독서정보 도움 경험",multipleChoices:["(커뮤니티) 페이스북, X(舊 트위터), 블로그, 인스타그램, 유튜브, 카카오톡 채널 등"],tokens:["중원도서관","독서정보","도움을받은항목"]},
      {no:8,title:"중원도서관의 독서증진 사업 및 특화 코너 중 알고 있는 항목을 선택해 주십시오.",type:"MULTIPLE",groupId:"독서증진 사업 인지도",tokens:["중원도서관","독서증진사업","특화코너","알고있는항목"]},
      {no:9,title:"장서구성 평가",reportTitle:"장서구성",type:"SCORE",scoreMap:scoreMap,tokens:["장서구성","평가"]},
      {no:10,title:"자료입수 평가 점수",reportTitle:"자료입수",type:"SCORE",scoreMap:scoreMap,tokens:["자료입수","평가","점수"]},
      {no:11,title:"자료이용편의 평가 점수",reportTitle:"자료이용편의",type:"SCORE",scoreMap:scoreMap,tokens:["자료이용편의","평가","점수"]},
      {no:12,title:"사서의 참고서비스 평가 점수",reportTitle:"사서 참고서비스",type:"SCORE",scoreMap:scoreMap,tokens:["사서","참고서비스","평가","점수"]},
      {no:13,title:"온라인 정보제공 평가 점수",reportTitle:"온라인 정보제공",type:"SCORE",scoreMap:scoreMap,tokens:["온라인","정보제공","평가","점수"]},
      {no:14,title:"소장 자료 및 홈페이지에서 제공하는 독서정보 서비스와 관련하여 의견을 자유롭게 적어주십시오",type:"TEXT",tokens:["소장자료","홈페이지","독서정보서비스","의견","자유롭게"]},
      {no:15,title:"성별",type:"RESPONDENT",tokens:["성별"]},{no:16,title:"연령",type:"RESPONDENT",tokens:["연령"]},
      {no:17,title:"직업",type:"RESPONDENT",tokens:["직업"]},{no:18,title:"거주 지역",type:"RESPONDENT",tokens:["거주지역"]}
    ]
  }];
}
function normalizeSurveyProfileHeader_(value) {
  return normalizeHeader_(value).replace(/^(?:q|문항)?\d+/i,"").replace(/복수응답가능|복수선택|복수응답/g,"");
}
function matchSurveyProfileQuestion_(header, question) {
  const normalized=normalizeSurveyProfileHeader_(header),exact=normalizeSurveyProfileHeader_(question.title);
  if(normalized===exact)return true;
  return (question.tokens||[]).every(function(token){return normalized.indexOf(normalizeSurveyProfileHeader_(token))>=0;});
}
function detectSurveyProfile_(headers) {
  const candidates=getSurveyProfiles_().map(function(profile){
    const used={};const matches=[];
    profile.questions.forEach(function(question){const index=(headers||[]).findIndex(function(header,i){return !used[i]&&matchSurveyProfileQuestion_(header,question);});if(index>=0){used[index]=true;matches.push({question:question,columnIndex:index,header:headers[index]});}});
    const anchors=[1,9,14,15,16,17,18],anchorCount=anchors.filter(function(no){return matches.some(function(item){return item.question.no===no;});}).length;
    const matched=matches.length,expected=profile.questions.length,confidence=expected?matched/expected:0;
    const status=matched===expected&&anchorCount===anchors.length?"AUTO_PROFILE":matched>=14&&anchorCount>=6?"PROFILE_REVIEW":"NO_PROFILE";
    return {profile:profile,profileMatched:status!=="NO_PROFILE",profileId:profile.profileId,profileTitle:profile.title,status:status,matchedQuestionCount:matched,expectedQuestionCount:expected,confidence:confidence,matches:matches,unmatchedHeaders:(headers||[]).filter(function(header,i){return !used[i]&&!/타임스탬프|timestamp|응답일시/i.test(normalizeHeader_(header));})};
  }).sort(function(a,b){return b.confidence-a.confidence;});
  return candidates[0]&&candidates[0].profileMatched?candidates[0]:{profileMatched:false,profileId:"",status:"NO_PROFILE",matchedQuestionCount:0,expectedQuestionCount:candidates[0]?candidates[0].expectedQuestionCount:0,confidence:0,matches:[],unmatchedHeaders:(headers||[]).slice()};
}
function applySurveyProfileMappings_(mappings,detection) {
  if(!detection||!detection.profileMatched)return mappings;
  const byColumn={};detection.matches.forEach(function(match){byColumn[match.columnIndex+1]=match.question;});
  return (mappings||[]).map(function(mapping){const question=byColumn[mapping.columnNumber];if(!question)return mapping;return Object.assign({},mapping,{suggestedType:question.type,suggestedTypeLabel:getSurveyQuestionTypeLabel_(question.type),selectedType:question.type,analysisTarget:true,groupId:question.groupId||"",scoreMap:Object.assign({},question.scoreMap||{}),multipleChoices:(question.multipleChoices||[]).slice(),scaleValueMap:question.type==="SCORE"?{}:mapping.scaleValueMap,mappingSource:detection.status,reviewStatus:detection.status==="AUTO_PROFILE"?"AUTO_REVIEWED":"REVIEW_REQUIRED",confidence:detection.confidence,reason:"사전 등록 설문 프로필 "+detection.profileId+" 문항과 일치했습니다."});});
}
