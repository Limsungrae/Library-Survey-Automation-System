const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('AppsScript/18_SurveyCreateService.gs', 'utf8');
const geminiSource = fs.readFileSync('AppsScript/02_GeminiService.gs', 'utf8');
const context = {console};
vm.createContext(context);
vm.runInContext(source, context, {filename:'AppsScript/18_SurveyCreateService.gs'});
const run = expression => vm.runInContext(expression, context);

assert.strictEqual(run('SURVEY_AI_SYSTEM_PROMPT_VERSION'), '1.0');
const prompt = run('getSurveyAiSystemPrompt_()');
[
  '중원도서관','공공도서관','SINGLE, MULTIPLE, SCALE, TEXT, RESPONDENT',
  'SATISFACTION_5','추가 참고정보에 제공된 것만 사용',
  '개인정보 최소화','questionId, order','유효한 JSON 하나만 반환'
].forEach(token => assert(prompt.includes(token), `system prompt contains: ${token}`));

const responseSchema = JSON.parse(JSON.stringify(run('getSurveyDraftGeminiResponseSchema_()')));
const variants = responseSchema.properties.questions.items.anyOf;
assert.strictEqual(variants.length, 5);
const variantByType = Object.fromEntries(variants.map(variant => [variant.properties.type.enum[0], variant]));
assert.deepStrictEqual(Object.keys(variantByType).sort(), ['MULTIPLE','RESPONDENT','SCALE','SINGLE','TEXT']);
assert.deepStrictEqual(Object.keys(variantByType.SINGLE.properties).sort(), ['options','required','title','type']);
assert.deepStrictEqual(Object.keys(variantByType.MULTIPLE.properties).sort(), ['maxSelections','options','required','title','type']);
assert(!variantByType.MULTIPLE.required.includes('maxSelections'));
assert.deepStrictEqual(Object.keys(variantByType.SCALE.properties).sort(), ['required','scalePreset','title','type']);
assert.deepStrictEqual(variantByType.SCALE.properties.scalePreset.enum, ['SATISFACTION_5']);
assert(!variantByType.SCALE.properties.options);
assert.deepStrictEqual(Object.keys(variantByType.TEXT.properties).sort(), ['required','title','type']);
assert.deepStrictEqual(Object.keys(variantByType.RESPONDENT.properties).sort(), ['options','required','respondentField','title','type']);
assert.deepStrictEqual(variantByType.RESPONDENT.properties.respondentField.enum, ['AGE_GROUP','GENDER','RESIDENCE','USER_TYPE','OTHER']);

const valid = {
  description:'설문 안내',
  questions:[
    {title:'단일',type:'SINGLE',required:true,options:['가','나']},
    {title:'복수',type:'MULTIPLE',required:false,options:['가','나','다'],maxSelections:2},
    {title:'척도',type:'SCALE',required:true,scalePreset:'SATISFACTION_5'},
    {title:'의견',type:'TEXT',required:false},
    {title:'연령',type:'RESPONDENT',respondentField:'AGE_GROUP',required:false,options:['20대','30대']}
  ]
};
context.fixture = valid;
assert.strictEqual(run('validateSurveyDraftAiResponse_(fixture)'), valid);

function rejects(question, top) {
  context.fixture = top || {description:'안내', questions:[question]};
  assert.throws(() => run('validateSurveyDraftAiResponse_(fixture)'), /./);
}
rejects({title:'x',type:'UNKNOWN',required:true});
rejects({title:'x',type:'SINGLE',required:true,options:['하나']});
rejects({title:'x',type:'MULTIPLE',required:true,options:['가','나'],maxSelections:3});
rejects({title:'x',type:'MULTIPLE',required:true,options:['가','나'],maxSelections:1});
rejects({title:'x',type:'SCALE',required:true,scalePreset:'SATISFACTION_5',options:['가','나']});
rejects({title:'x',type:'SCALE',required:true,scalePreset:'OTHER'});
rejects({title:'x',type:'TEXT',required:false,options:['가','나']});
rejects({title:'x',type:'RESPONDENT',required:false,respondentField:'UNKNOWN',options:['가','나']});
rejects({title:' ',type:'TEXT',required:false});
rejects({title:'x',type:'TEXT',required:'false'});
rejects({title:'x',type:'TEXT',required:false,extra:true});
rejects(null, {description:'안내',questions:[]});
rejects({questionId:'Q1',title:'x',type:'TEXT',required:false});

context.raw = {
  description:'  안내문  ',
  questions:[
    {title:'  선택 질문  ',type:'SINGLE',required:true,options:[' 가 ','나','가']},
    {title:'척도',type:'SCALE',required:true,scalePreset:'SATISFACTION_5'}
  ]
};
context.input = {title:'원본 조사명',targetAudience:'원본 대상',requestContent:'요청',referenceInfo:''};
const normalized = run('normalizeSurveyDraft_(raw,input)');
assert.strictEqual(normalized.survey.title, '원본 조사명');
assert.strictEqual(normalized.survey.targetAudience, '원본 대상');
assert.strictEqual(normalized.survey.description, '안내문');
assert.deepStrictEqual(Array.from(normalized.questions, q => q.questionId), ['Q1','Q2']);
assert.deepStrictEqual(Array.from(normalized.questions, q => q.order), [1,2]);
assert.deepStrictEqual(Array.from(normalized.questions[0].options), ['가','나']);
assert.deepStrictEqual(Array.from(normalized.questions[1].options), ['매우 만족','만족','보통','불만족','매우 불만족']);

context.input = {title:' 조사 ',targetAudience:' 대상 ',requestContent:' 요청 ',referenceInfo:''};
const checkedInput = run('validateSurveyDraftInput_(input)');
assert.deepStrictEqual(JSON.parse(JSON.stringify(checkedInput)), {
  title:'조사',targetAudience:'대상',requestContent:'요청',referenceInfo:''
});

assert(source.includes('systemInstruction'));
assert(source.includes('responseMimeType:"application/json"'));
assert(source.includes('callGeminiText_(payload)'));
assert(!source.includes('GEMINI_API_KEY'));
assert(!source.includes('FormApp'));

const extractMatch = geminiSource.match(/function extractGeminiCandidateText_\(parts\) \{[\s\S]*?\n\}/);
assert(extractMatch, 'Gemini final response extractor exists');
vm.runInContext(extractMatch[0], context);
context.parts = [
  {text:'내부 사고 과정 {완성 JSON 아님}', thought:true, thoughtSignature:'signature'},
  {thoughtSignature:'metadata-only'},
  {text:'{"description":"안내","questions":[]}'}
];
assert.strictEqual(run('extractGeminiCandidateText_(parts)'), '{"description":"안내","questions":[]}');

context.parseText = '{"description":"안내","questions":[]}';
assert.deepStrictEqual(JSON.parse(JSON.stringify(run('parseSurveyDraftGeminiResponse_(parseText)'))), {
  description:'안내',questions:[]
});
context.parseText = '```json\n{"description":"안내","questions":[]}\n```';
assert.strictEqual(run('parseSurveyDraftGeminiResponse_(parseText)').description, '안내');
context.parseText = '설명\n{"description":"안내","questions":[]}';
assert.throws(() => run('parseSurveyDraftGeminiResponse_(parseText)'), /Gemini JSON/);
assert(!source.includes('cleanJsonResponse_(text)'), 'survey parser does not use broad substring recovery');

console.log('survey-create service validator/normalizer checks passed');
