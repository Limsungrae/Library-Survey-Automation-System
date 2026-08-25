const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('AppsScript/18_SurveyCreateService.gs', 'utf8');
const geminiSource = fs.readFileSync('AppsScript/02_GeminiService.gs', 'utf8');
const context = {console};
vm.createContext(context);
vm.runInContext(source, context, {filename:'AppsScript/18_SurveyCreateService.gs'});
const run = expression => vm.runInContext(expression, context);

assert.strictEqual(run('SURVEY_AI_SYSTEM_PROMPT_VERSION'), '1.2');
assert.strictEqual(run('SURVEY_DRAFT_CONTRACT_VERSION'), '1.1');
const prompt = run('getSurveyAiSystemPrompt_()');
[
  '중원도서관','공공도서관','SINGLE, MULTIPLE, SCALE, TEXT, RESPONDENT',
  'SATISFACTION_5','추가 참고정보에 제공된 것만 사용',
  '개인정보 최소화','questionId, order','유효한 JSON 하나만 반환'
].forEach(token => assert(prompt.includes(token), `system prompt contains: ${token}`));
[
  '사용자가 요청하지 않은 새로운 평가 개념',
  'SCALE 한 문항은 하나의 독립적인 평가 요소',
  '확인되지 않은 실제 홍보·접수 채널',
  '법률명·법률 조항',
  '개인정보는 안전하게 보호됩니다',
  '익명 또는 무기명으로 처리됩니다',
  'RESPONDENT는 사용자가',
  'required: false를 우선',
  '실제 분석에 필요한 최소한',
  '보호자의 연령을 수강생 연령으로 착각',
  '하나의 대표적인 답',
  '사용자가 복수응답을 명시하지 않았다면',
  'title에는 질문 자체의 의미만',
  '담당 부서·담당자·전화번호',
  '1~2개의 짧은 문장으로 된 한 문단',
  '참여해 주셔서 감사합니다',
  '같은 기관명이나 프로그램명을 불필요하게 반복하지 않습니다',
  '설문 응답은 통계적 목적으로만 이용됩니다',
  'choicePreset: "PROGRAM_DISCOVERY_PATH"',
  'choicePreset: "ADULT_AGE_GROUP"',
  'choicePreset: "CHILD_AGE_GROUP"',
  'choicePreset: "RESIDENCE_SEONGNAM"',
  'choicePreset: "GENDER_BASIC"',
  'choicePreset과 options를 동시에 생성하지 않습니다'
].forEach(token => assert(prompt.includes(token), `v1.2 prompt contains: ${token}`));
assert(!prompt.includes('2~3개의 짧은 문단'), 'legacy multi-paragraph description rule was removed');
assert(!prompt.includes('필요에 맞게 작성합니다. 예문을 기계적으로 복사하지 않습니다.'), 'v1.0 data-use allowance was replaced');

const choicePresets = JSON.parse(JSON.stringify(run('SURVEY_CHOICE_PRESETS')));
assert.deepStrictEqual(choicePresets.PROGRAM_DISCOVERY_PATH.options, [
  '인터넷(도서관 홈페이지, SNS, 배움숲)','현수막, 안내문 등 홍보물',
  '지인 추천(가족, 친구 등)','지역 커뮤니티 게시판','기타'
]);
assert.deepStrictEqual(choicePresets.ADULT_AGE_GROUP.options, ['20대','30대','40대','50대','60대','70대 이상']);
assert.deepStrictEqual(choicePresets.CHILD_AGE_GROUP.options, ['유아','초1~2','초3~4','초5~6']);
assert.deepStrictEqual(choicePresets.RESIDENCE_SEONGNAM.options, ['중원구','수정구','분당구','기타']);
assert.deepStrictEqual(choicePresets.GENDER_BASIC.options, ['남','여']);

const responseSchema = JSON.parse(JSON.stringify(run('getSurveyDraftGeminiResponseSchema_()')));
const variants = responseSchema.properties.questions.items.anyOf;
assert.strictEqual(variants.length, 5);
const variantByType = Object.fromEntries(variants.map(variant => [variant.properties.type.enum[0], variant]));
assert.deepStrictEqual(Object.keys(variantByType).sort(), ['MULTIPLE','RESPONDENT','SCALE','SINGLE','TEXT']);
assert.deepStrictEqual(Object.keys(variantByType.SINGLE.properties).sort(), ['choicePreset','options','required','title','type']);
assert(!variantByType.SINGLE.required.includes('options'));
assert.deepStrictEqual(variantByType.SINGLE.properties.choicePreset.enum, ['PROGRAM_DISCOVERY_PATH']);
assert.deepStrictEqual(Object.keys(variantByType.MULTIPLE.properties).sort(), ['maxSelections','options','required','title','type']);
assert(!variantByType.MULTIPLE.required.includes('maxSelections'));
assert.deepStrictEqual(Object.keys(variantByType.SCALE.properties).sort(), ['required','scalePreset','title','type']);
assert.deepStrictEqual(variantByType.SCALE.properties.scalePreset.enum, ['SATISFACTION_5']);
assert(!variantByType.SCALE.properties.options);
assert.deepStrictEqual(Object.keys(variantByType.TEXT.properties).sort(), ['required','title','type']);
assert.deepStrictEqual(Object.keys(variantByType.RESPONDENT.properties).sort(), ['choicePreset','options','required','respondentField','title','type']);
assert(!variantByType.RESPONDENT.required.includes('options'));
assert.deepStrictEqual(variantByType.RESPONDENT.properties.respondentField.enum, ['AGE_GROUP','GENDER','RESIDENCE','USER_TYPE','OTHER']);
assert.deepStrictEqual(variantByType.RESPONDENT.properties.choicePreset.enum, ['ADULT_AGE_GROUP','CHILD_AGE_GROUP','RESIDENCE_SEONGNAM','GENDER_BASIC']);
['MULTIPLE','SCALE','TEXT'].forEach(type => assert(!variantByType[type].properties.choicePreset));

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
[
  {title:'경로',type:'SINGLE',required:true,choicePreset:'PROGRAM_DISCOVERY_PATH'},
  {title:'성인 연령',type:'RESPONDENT',required:false,respondentField:'AGE_GROUP',choicePreset:'ADULT_AGE_GROUP'},
  {title:'어린이 연령',type:'RESPONDENT',required:false,respondentField:'AGE_GROUP',choicePreset:'CHILD_AGE_GROUP'},
  {title:'거주지역',type:'RESPONDENT',required:false,respondentField:'RESIDENCE',choicePreset:'RESIDENCE_SEONGNAM'},
  {title:'성별',type:'RESPONDENT',required:false,respondentField:'GENDER',choicePreset:'GENDER_BASIC'}
].forEach(question => {
  context.fixture={description:'안내',questions:[question]};
  assert.strictEqual(run('validateSurveyDraftAiResponse_(fixture)'), context.fixture);
});

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
rejects({title:'x',type:'SINGLE',required:true,choicePreset:'UNKNOWN'});
rejects({title:'x',type:'SINGLE',required:true,options:['가','나'],choicePreset:'PROGRAM_DISCOVERY_PATH'});
rejects({title:'x',type:'SINGLE',required:true});
rejects({title:'x',type:'MULTIPLE',required:true,options:['가','나'],choicePreset:'PROGRAM_DISCOVERY_PATH'});
rejects({title:'x',type:'SCALE',required:true,scalePreset:'SATISFACTION_5',choicePreset:'PROGRAM_DISCOVERY_PATH'});
rejects({title:'x',type:'TEXT',required:false,choicePreset:'PROGRAM_DISCOVERY_PATH'});
rejects({title:'x',type:'RESPONDENT',required:false,respondentField:'AGE_GROUP',choicePreset:'GENDER_BASIC'});
rejects({title:'x',type:'RESPONDENT',required:false,respondentField:'GENDER',choicePreset:'ADULT_AGE_GROUP'});
rejects({title:'x',type:'RESPONDENT',required:false,respondentField:'RESIDENCE',choicePreset:'CHILD_AGE_GROUP'});

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

context.raw={description:'안내',questions:[
  {title:'경로',type:'SINGLE',required:true,choicePreset:'PROGRAM_DISCOVERY_PATH'},
  {title:'성인 연령',type:'RESPONDENT',required:false,respondentField:'AGE_GROUP',choicePreset:'ADULT_AGE_GROUP'},
  {title:'어린이 연령',type:'RESPONDENT',required:false,respondentField:'AGE_GROUP',choicePreset:'CHILD_AGE_GROUP'},
  {title:'거주',type:'RESPONDENT',required:false,respondentField:'RESIDENCE',choicePreset:'RESIDENCE_SEONGNAM'},
  {title:'성별',type:'RESPONDENT',required:false,respondentField:'GENDER',choicePreset:'GENDER_BASIC'}
]};
const presetNormalized=run('normalizeSurveyDraft_(raw,input)');
assert.deepStrictEqual(Array.from(presetNormalized.questions[0].options), choicePresets.PROGRAM_DISCOVERY_PATH.options);
assert.deepStrictEqual(Array.from(presetNormalized.questions[1].options), choicePresets.ADULT_AGE_GROUP.options);
assert.deepStrictEqual(Array.from(presetNormalized.questions[2].options), choicePresets.CHILD_AGE_GROUP.options);
assert.deepStrictEqual(Array.from(presetNormalized.questions[3].options), choicePresets.RESIDENCE_SEONGNAM.options);
assert.deepStrictEqual(Array.from(presetNormalized.questions[4].options), choicePresets.GENDER_BASIC.options);
assert.deepStrictEqual(Array.from(presetNormalized.questions, question => question.choicePreset), [
  'PROGRAM_DISCOVERY_PATH','ADULT_AGE_GROUP','CHILD_AGE_GROUP','RESIDENCE_SEONGNAM','GENDER_BASIC'
]);

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
