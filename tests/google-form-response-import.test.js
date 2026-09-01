const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('AppsScript/21_GoogleFormResponseImport.gs','utf8');
const secure=fs.readFileSync('AppsScript/16_SecureWebApi.gs','utf8');
const analysis=fs.readFileSync('AppsScript/12_DynamicAnalysis','utf8');
const headers=['타임스탬프','향후 관심 분야를 모두 선택해 주십시오.','성별','연령대','거주지역'];
const rows=[headers,['2026-08-25 17:19','독서·글쓰기, 인문학·교양','남','20대','중원구']];
const sheet={getName:()=> '임의 응답 탭',getLastRow:()=>2,getLastColumn:()=>5,getRange:()=>({getDisplayValues:()=>rows})};
const spreadsheet={getName:()=> '설문 응답',getSheets:()=>[sheet]};
const calls={openId:'',best:0,read:0,raw:null};
const context={console,
  SpreadsheetApp:{openById(id){calls.openId=id;return spreadsheet;},getActiveSpreadsheet(){return {getSheetByName:()=>({getLastRow:()=>2})};}},
  DYNAMIC_SURVEY_CONFIG:{SHEETS:{MAPPING:'mapping',LEGACY_MAPPING:'legacy'}},
  cleanText_:v=>String(v||'').trim(),normalizeHeader_:v=>String(v||'').replace(/\s+/g,'').toLowerCase(),
  getSurveyQuestionTypeLabel_:v=>v,validateSurveyMappings_:()=>({valid:true}),
  findBestSurveySheetForMapping_(){calls.best++;return sheet;},
  readSurveySheetStructureForMapping_(){calls.read++;return {headerRow:1,headers,sampleRow:rows[1],responseRows:[rows[1]],responseCount:1};},
  buildSurveyQuestionMappings_(){return headers.map((header,index)=>({columnIndex:index,columnNumber:index+1,originalHeader:header,normalizedHeader:String(header).replace(/\s+/g,''),sampleValue:rows[1][index],suggestedType:index===0?'EXCLUDE':'SINGLE',selectedType:index===0?'EXCLUDE':'SINGLE'}));},
  writeDynamicSurveyRawValues_(values,metadata){calls.raw={values,metadata};return {success:true,rowCount:1,rawRevision:'raw-2'};}
};
vm.createContext(context);vm.runInContext(source,context);
context.request={responseSpreadsheetId:' sheet-id ',formId:' form-id ',title:'조사',questionHints:[
  {title:headers[1],type:'MULTIPLE'},{title:'성별',type:'RESPONDENT'},{title:'연령대',type:'RESPONDENT'},{title:'거주지역',type:'RESPONDENT'}
]};
const inspect=JSON.parse(JSON.stringify(vm.runInContext('inspectGoogleFormResponsesForMappingFromWeb(request)',context)));
assert.strictEqual(calls.openId,'sheet-id');assert.strictEqual(calls.best,0);assert.strictEqual(calls.read,1);
assert.strictEqual(inspect.responseCount,1);assert.strictEqual(inspect.mappings[0].selectedType,'EXCLUDE');
assert.strictEqual(inspect.mappings[1].selectedType,'MULTIPLE');
assert.deepStrictEqual(inspect.mappings.slice(2).map(x=>x.selectedType),['RESPONDENT','RESPONDENT','RESPONDENT']);
assert(inspect.mappings.slice(1).every(x=>x.mappingSource==='GENERATED_FORM'));
context.request.questionHints=[{title:'일치하지 않는 제목',type:'MULTIPLE'}];
const mismatch=JSON.parse(JSON.stringify(vm.runInContext('inspectGoogleFormResponsesForMappingFromWeb(request)',context)));
assert.strictEqual(mismatch.mappings[1].selectedType,'SINGLE');assert.strictEqual(mismatch.mappingSource,'RULE');
const unrelatedSheet={getName:()=> '데이터',getLastRow:()=>50,getLastColumn:()=>2,getRange:()=>({getDisplayValues:()=>[['항목','값']]})};
const emptyResponseSheet={getName:()=> '사용자 지정 이름',getLastRow:()=>1,getLastColumn:()=>headers.length,getRange:()=>({getDisplayValues:()=>[headers]})};
spreadsheet.getSheets=()=>[unrelatedSheet,emptyResponseSheet];
context.readSurveySheetStructureForMapping_=candidate=>candidate===unrelatedSheet?{headerRow:1,headers:['항목','값'],sampleRow:['a','b'],responseCount:49}:{headerRow:1,headers,sampleRow:headers.map(()=>''),responseCount:0};
context.request.questionHints=[{title:headers[1],type:'MULTIPLE'},{title:'성별',type:'RESPONDENT'}];
const emptySource=vm.runInContext('openGoogleFormResponseSource_(request)',context);assert.strictEqual(emptySource.sheet.getName(),'사용자 지정 이름');assert.strictEqual(emptySource.structure.responseCount,0);
assert.throws(()=>vm.runInContext('inspectGoogleFormResponsesForMappingFromWeb(request)',context),error=>error.code==='GOOGLE_FORM_RESPONSE_EMPTY');
spreadsheet.getSheets=()=>[sheet];context.readSurveySheetStructureForMapping_=()=>({headerRow:1,headers,sampleRow:rows[1],responseRows:[rows[1]],responseCount:1});
context.request.questionHints=[];
const imported=vm.runInContext('importGoogleFormResponsesToRawFromWeb(request)',context);
assert.strictEqual(imported.success,true);assert.deepStrictEqual(calls.raw.values,rows);
assert.strictEqual(calls.raw.metadata.sourceType,'GOOGLE_FORM');assert.strictEqual(calls.raw.metadata.formId,'form-id');
const importSource=fs.readFileSync('AppsScript/04_SurveyImport.gs','utf8');
const writerMatch=importSource.match(/function writeDynamicSurveyRawValues_\(values, sourceMetadata\) \{[\s\S]*?\n\}/);assert(writerMatch);
const written={values:null,note:'',revision:0};
const range={breakApart(){return this;},setValues(v){written.values=v;return this;},setNote(v){written.note=v;return this;},createFilter(){return this;},applyRowBanding(){return this;},setBackground(){return this;},setFontColor(){return this;},setFontWeight(){return this;},setHorizontalAlignment(){return this;},setWrap(){return this;},setVerticalAlignment(){return this;}};
const target={getRange:()=>range,getMaxRows:()=>20,getMaxColumns:()=>5,clear(){},getFilter:()=>null,getBandings:()=>[],setFrozenRows(){},autoResizeColumns(){},showColumns(){},hideColumns(){},deleteColumns(){},insertColumnsAfter(){}};
const writerContext={console,Date,JSON,Object,cleanText_:v=>String(v||'').trim(),normalizeHeader_:v=>String(v||'').replace(/\s+/g,'').toLowerCase(),markDynamicRawRevision_:()=>{written.revision++;return 'raw-new';},removeAllCharts_:()=>{},getSavedSurveyMappingsFromWeb:()=>({success:true,exists:false}),DYNAMIC_SURVEY_CONFIG:{SHEETS:{RAW:'09_범용원자료'}},SpreadsheetApp:{BandingTheme:{LIGHT_GREY:'LIGHT_GREY'},getActiveSpreadsheet:()=>({getSheetByName:()=>target}),flush(){}}};
vm.createContext(writerContext);vm.runInContext(writerMatch[0],writerContext);writerContext.values=[['타임스탬프','성별','만족도'],['2026-08-25 17:19','남','매우 만족']];writerContext.meta={sourceType:'GOOGLE_FORM',sourceSheetName:'응답'};
const writeResult=vm.runInContext('writeDynamicSurveyRawValues_(values,meta)',writerContext);
assert.strictEqual(written.revision,1);assert.deepStrictEqual(JSON.parse(JSON.stringify(written.values)),JSON.parse(JSON.stringify(writerContext.values)));assert.strictEqual(writeResult.rowCount,1);assert.strictEqual(JSON.parse(written.note).sourceType,'GOOGLE_FORM');
const splitMatch=analysis.match(/function splitDynamicMultipleValue_\(value[^)]*\) \{[\s\S]*?\n\}/);
assert(splitMatch);vm.runInContext(splitMatch[0],context);
context.multiple='독서·글쓰기, 인문학·교양';assert.deepStrictEqual(Array.from(vm.runInContext('splitDynamicMultipleValue_(multiple)',context)),['독서·글쓰기','인문학·교양']);
context.multiple='인터넷(도서관 홈페이지, SNS, 배움숲), 홍보물';assert.deepStrictEqual(Array.from(vm.runInContext('splitDynamicMultipleValue_(multiple)',context)),['인터넷(도서관 홈페이지, SNS, 배움숲)','홍보물']);
['secureInspectGoogleFormResponsesForMappingFromWeb','secureImportGoogleFormResponsesToRawFromWeb'].forEach(name=>{const body=secure.match(new RegExp('function '+name+'[\\s\\S]*?\\n\\}'))[0];assert(body.indexOf('requireWebAccessToken_')<body.indexOf(name.includes('Inspect')?'inspectGoogleFormResponsesForMappingFromWeb':'importGoogleFormResponsesToRawFromWeb'));});
console.log('Google Form response inspect, hint, import and MULTIPLE checks passed');
