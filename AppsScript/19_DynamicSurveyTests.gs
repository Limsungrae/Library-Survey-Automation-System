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
    equal_(calls.setWrap,true,"긴 문항명 줄바꿈");
    styleDynamicReportTotalRow_(range);equal_(calls.setBackground,"#E7E6E6","합계행 배경");
    equal_(calls.setFontWeight,"bold","합계행 굵게");});
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
    equal_(splitDynamicMultipleValue_("A,B|C;D/E\nF").join("|"),"A|B|C|D|E|F","지원 구분자");
    equal_(splitDynamicMultipleValue_("문화·예술").join("|"),"문화·예술","가운데점은 응답 일부");});
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
    equal_(truncateDynamicDashboardLabel_(longLabel,20).length,20,"E 긴 라벨 길이");
    equal_(truncateDynamicDashboardLabel_(longLabel,20).slice(-1),"…","E 말줄임표");equal_(e.satisfactionItems[0].label,longLabel,"E 원본 불변");
    const zeroItems=buildDynamicDashboardItems_(items_(6,"동률 ",true),null,5,false);
    equal_(zeroItems.length,5,"F 0건 TOP5");equal_(zeroItems[0].label,"동률 1","F 동률 원래 순서");
    equal_(zeroItems[4].label,"동률 5","F 동률 안정 정렬");});
  test_("대시보드 텍스트 셀 숫자 형식 미적용과 반복 초기화",function(){
    equal_(createDynamicDashboardSheet_.toString().indexOf("setNumberFormat"),-1,"렌더러 숫자 형식 없음");
    const calls=[];const range={breakApart:function(){calls.push("unmerge");return this;},
      clearContent:function(){calls.push("content");return this;},clearDataValidations:function(){calls.push("validation");return this;},
      clearNote:function(){calls.push("notes");return this;},setBackground:function(){calls.push("visual");return this;},
      setFontColor:function(){return this;},setFontWeight:function(){return this;},setFontStyle:function(){return this;},
      setHorizontalAlignment:function(){return this;},setVerticalAlignment:function(){return this;},setWrap:function(){return this;},
      setBorder:function(){return this;}};
    const sheet={getRange:function(a1){equal_(a1,"A1:N40","초기화 범위");return range;}};
    resetDynamicDashboardRange_(sheet);resetDynamicDashboardRange_(sheet);
    equal_(calls.join(","),"unmerge,content,validation,notes,visual,unmerge,content,validation,notes,visual","연속 초기화 순서");
    equal_(calls.indexOf("content")<calls.indexOf("visual"),true,"typed content 선제 제거");
    equal_(resetDynamicDashboardRange_.toString().indexOf("clearFormat"),-1,"숫자 형식 포함 초기화 없음");});
  test_("대시보드 고정 해제와 병합 계획",function(){
    [[1,0],[2,0],[0,1]].forEach(function(initial){const calls=[];const merged={getA1Notation:function(){return "A1:N2";}};
      const sheet={getName:function(){return "02_대시보드";},getFrozenRows:function(){return initial[0];},
        getFrozenColumns:function(){return initial[1];},setFrozenRows:function(value){calls.push("rows="+value);},
        setFrozenColumns:function(value){calls.push("columns="+value);},getRange:function(){return {getMergedRanges:function(){return [merged];}};}};
      let logged="";prepareDynamicDashboardFreezeState_(sheet,function(message){logged=message;});
      equal_(calls.join(","),"rows=0,columns=0","고정 해제 순서 "+initial.join("/"));
      equal_(logged.indexOf("frozenRows="+initial[0])>=0,true,"기존 고정 행 로그");
      equal_(logged.indexOf("currentMerges=A1:N2")>=0,true,"기존 병합 로그");});
    const planned=getDynamicDashboardPlannedMerges_();
    equal_(planned.length,40,"동적 행 병합 계획 수");
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
    const dashboardSource=createDynamicDashboardSheet_.toString()+renderDynamicDashboardSatisfactionRows_.toString()+
      renderDynamicDashboardTopRows_.toString()+renderDynamicDashboardBackgroundBar_.toString();
    ["newChart","insertChart","insertImage","getBlob","SPARKLINE","█","░"].forEach(function(token){
      equal_(dashboardSource.indexOf(token),-1,"대시보드 금지 구현: "+token);});
    equal_(renderDynamicDashboardBackgroundBar_.toString().indexOf("setBackground")>=0,true,"배경색 막대");
    equal_(resetDynamicDashboardSheet_.toString().indexOf("getImages")>=0,true,"기존 PNG 제거");
    equal_(createDynamicDashboardSheet_.toString().indexOf("setFrozenRows(2)"),-1,"최종 고정 행 없음");});
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
