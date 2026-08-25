const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('AppsScript/20_SurveyFormService.gs','utf8');
const secureSource = fs.readFileSync('AppsScript/16_SecureWebApi.gs','utf8');
const calls = {items:[], spreadsheets:[], destination:null};
function item(kind) {
  const record={kind,title:'',required:null,choices:null,other:false};
  calls.items.push(record);
  return {
    setChoiceValues(values){record.choices=Array.from(values);return this;},
    showOtherOption(value){record.other=value;return this;},
    setTitle(value){record.title=value;return this;},
    setRequired(value){record.required=value;return this;}
  };
}
const form={
  description:'',quiz:null,confirmation:'',
  setDescription(v){this.description=v;return this;},setIsQuiz(v){this.quiz=v;return this;},
  setConfirmationMessage(v){this.confirmation=v;return this;},
  addMultipleChoiceItem(){return item('multipleChoice');},addCheckboxItem(){return item('checkbox');},addParagraphTextItem(){return item('paragraph');},
  setDestination(type,id){calls.destination={type,id};return this;},getId(){return 'form-id';},
  getEditUrl(){return 'https://forms.example/edit';},getPublishedUrl(){return 'https://forms.example/view';}
};
const context={console,FormApp:{DestinationType:{SPREADSHEET:'SPREADSHEET'},create(title){calls.formTitle=title;return form;}},SpreadsheetApp:{create(title){calls.spreadsheets.push(title);return {getId:()=> 'sheet-id',getUrl:()=> 'https://sheets.example/sheet-id'};}}};
vm.createContext(context);vm.runInContext(source,context,{filename:'AppsScript/20_SurveyFormService.gs'});
const run=expression=>vm.runInContext(expression,context);
assert.strictEqual(run('SURVEY_FORM_GENERATION_VERSION'),'1.0');

const scale=['매우 만족','만족','보통','불만족','매우 불만족'];
const fixture={survey:{title:' 조사 ',targetAudience:' 대상 ',description:'안내',department:' 부서 ',contact:' 031 '},questions:[
  {title:'단일',type:'SINGLE',required:true,options:['온라인','홍보물','기타']},
  {title:'복수',type:'MULTIPLE',required:false,options:['가','기타 의견','기타']},
  {title:'척도',type:'SCALE',required:true,options:scale},
  {title:'의견',type:'TEXT',required:false},
  {title:'응답자',type:'RESPONDENT',required:false,options:['남','여']}
]};
context.fixture=fixture;
const valid=JSON.parse(JSON.stringify(run('validateReviewedSurveyForForm_(fixture)')));
assert.strictEqual(valid.survey.title,'조사');assert.strictEqual(valid.survey.department,'부서');
assert.strictEqual(valid.questions.length,5);
function rejects(question, payload){context.bad=payload||{survey:{title:'조사',targetAudience:'대상',description:'',department:'',contact:''},questions:[question]};assert.throws(()=>run('validateReviewedSurveyForForm_(bad)'),/./);}
rejects(null,{survey:fixture.survey,questions:[]});
rejects({title:'x',type:'UNKNOWN',required:true,options:['가','나']});
rejects({title:' ',type:'TEXT',required:false});
rejects({title:'x',type:'TEXT',required:'false'});
['SINGLE','MULTIPLE','RESPONDENT'].forEach(type=>rejects({title:type,type,required:false,options:['하나']}));
rejects({title:'척도',type:'SCALE',required:true,options:['1','2']});
rejects({title:'중복 선택',type:'SINGLE',required:true,options:['가','가']});
rejects(null,{survey:fixture.survey,questions:[{title:'같음',type:'TEXT',required:false},{title:' 같음 ',type:'TEXT',required:true}]});

context.options=['온라인','홍보물','기타'];
assert.deepStrictEqual(JSON.parse(JSON.stringify(run('prepareFormChoiceOptions_(options)'))),{choiceValues:['온라인','홍보물'],hasOther:true});
context.options=['기타 의견','기타 서비스'];
assert.deepStrictEqual(JSON.parse(JSON.stringify(run('prepareFormChoiceOptions_(options)'))),{choiceValues:['기타 의견','기타 서비스'],hasOther:false});
context.survey={description:'안내',targetAudience:'대상',department:'부서',contact:'031'};
assert.strictEqual(run('buildGoogleFormDescription_(survey)'),'안내\n\n대상: 대상\n담당부서: 부서\n문의: 031');
context.survey={description:'안내',targetAudience:'대상',department:'',contact:''};
assert.strictEqual(run('buildGoogleFormDescription_(survey)'),'안내\n\n대상: 대상');

const result=JSON.parse(JSON.stringify(run('createGoogleFormFromReviewedDraft_(fixture)')));
assert.strictEqual(result.generationVersion,'1.0');assert.strictEqual(result.questionCount,5);
assert.strictEqual(calls.formTitle,'조사');assert.deepStrictEqual(calls.spreadsheets,['조사 - 응답']);
assert.deepStrictEqual(calls.destination,{type:'SPREADSHEET',id:'sheet-id'});
assert.deepStrictEqual(calls.items.map(x=>x.kind),['multipleChoice','checkbox','multipleChoice','paragraph','multipleChoice']);
assert.deepStrictEqual(calls.items[0].choices,['온라인','홍보물']);assert.strictEqual(calls.items[0].other,true);
assert.deepStrictEqual(calls.items[1].choices,['가','기타 의견']);assert.strictEqual(calls.items[1].other,true);
assert.deepStrictEqual(calls.items[2].choices,scale);
calls.items.forEach((created,index)=>{assert.strictEqual(created.title,valid.questions[index].title);assert.strictEqual(created.required,valid.questions[index].required);});
assert.strictEqual(form.quiz,false);assert.strictEqual(form.confirmation,'응답이 제출되었습니다. 감사합니다.');
assert(!source.includes('DriveApp')&&!source.includes('setCollectEmail')&&!source.includes('setLimitOneResponsePerUser'));
assert(secureSource.includes('function secureCreateGoogleFormFromWeb(payload, accessToken)'));
const secureBody=secureSource.match(/function secureCreateGoogleFormFromWeb[\s\S]*?\n\}/)[0];
assert(secureBody.indexOf('requireWebAccessToken_(accessToken)')<secureBody.indexOf('createGoogleFormFromReviewedDraft_(payload)'));
console.log('survey Form service validation and mapping checks passed');
