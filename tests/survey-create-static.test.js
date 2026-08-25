const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('Web/survey-create.html','utf8');
const app = fs.readFileSync('Web/survey-create-app.html','utf8');
const css = fs.readFileSync('Web/survey-create-css.html','utf8');
const main = fs.readFileSync('AppsScript/01_Main.gs','utf8');
const script = app.slice(app.indexOf('<script>')+8,app.lastIndexOf('</script>'));
new vm.Script(script,{filename:'survey-create-app.js'});

assert(html.includes('includeHtml_("survey-dashboard-v2-css")'),'reuses V2 design system');
assert(html.includes('includeHtml_("survey-create-css")')&&html.includes('includeHtml_("survey-create-app")'),'includes create-specific assets');
assert(main.includes('requestedUi === "create"')&&main.includes('"survey-create"'),'create route exists');
[
  'surveyCreateTitleInput','surveyCreateAudienceInput','surveyCreateDepartmentInput','surveyCreateContactInput','surveyCreateRequestInput',
  'surveyCreateReferenceInput','surveyCreateGenerateButton','surveyCreateReviewView',
  'surveyCreateQuestionList','surveyCreateAddQuestionButton','surveyCreateFormButton'
].forEach(id=>assert(html.includes(`id="${id}"`),`${id} exists`));
assert.strictEqual((html.match(/ required/g)||[]).length>=4,true,'auth plus three survey fields are required');
const departmentInput=html.match(/<input[^>]*id="surveyCreateDepartmentInput"[^>]*>/)[0];
const contactInput=html.match(/<input[^>]*id="surveyCreateContactInput"[^>]*>/)[0];
assert(!/\brequired\b/.test(departmentInput)&&!/\brequired\b/.test(contactInput),'host metadata inputs are optional');
assert(/type="tel"/.test(contactInput)&&!/\bpattern=/.test(contactInput),'contact accepts flexible telephone text');
assert(html.includes('AI가 알기 어려운 프로그램명·서비스명·강좌명 등이 있을 때만 입력해주세요.'),'reference guidance is exact');
assert(html.includes('role="alert"')&&html.includes('role="status"')&&html.includes('aria-live="polite"')&&html.includes('aria-busy="true"'),'accessibility status contract');
assert(html.includes('?page=home')&&html.includes('?page=survey&amp;ui=v2'),'home and analysis navigation');
assert(app.includes('INPUT')&&app.includes('GENERATING')&&app.includes('DRAFT_REVIEW')&&app.includes('FORM_CREATING')&&app.includes('COMPLETED'),'mock workflow states exist');
assert(app.includes('secureGenerateSurveyDraftFromWeb')&&app.includes('api.generateSurveyDraft(input)')&&app.includes('renderQuestions_'),'secure Gemini result feeds the existing renderer');
assert(app.includes('data-action="edit"')&&app.includes('data-action="delete"')&&app.includes('data-action="up"')&&app.includes('data-action="down"'),'question editing actions exist');
assert(app.includes('addQuestion_')&&app.includes('data-edit="required"')&&app.includes('data-edit="type"'),'question addition and editable fields exist');
assert(app.includes('data-option-index')&&app.includes('add-option')&&app.includes('remove-option'),'options use individual input rows');
assert(app.includes('hasEditableOptions')&&app.includes('survey-create-scale-preset'),'question type controls the option editor');
assert(app.includes('data-edit="required" type="checkbox"')&&app.includes(".checked"),'required remains a boolean checkbox contract');
assert(app.includes('data-action="cancel"')&&app.includes('data-action="save"')&&app.includes('cancelEdit_'),'editing has cancel and save actions');
assert(app.includes('draftCounts_()')&&app.includes('renderSummary_()')&&app.includes('state.questions.filter'),'summary counts are derived from the draft model');
assert(app.includes('department:"",contact:""')&&app.includes('surveyCreateDepartmentInput')&&app.includes('surveyCreateContactInput'),'host metadata is retained in form state and read from inputs');
['surveyCreateSummaryContact','surveyCreateSummaryDepartment','surveyCreateSummaryPhone'].forEach(id=>assert(html.includes(`id="${id}"`),`${id} exists`));
assert(app.includes('surveyCreateSummaryDescription").textContent')&&!app.includes('surveyCreateSummaryDescription").innerHTML'),'description rendering remains text-only');
assert(app.includes('surveyCreateSummaryContact").hidden=!department&&!contact'),'empty contact summary is hidden');
assert(css.includes('white-space:pre-line')&&css.includes('line-height:1.7'),'description preserves safe newlines');
assert(css.includes('.survey-create-summary{display:grid')&&!css.includes('.survey-create-summary{display:flex'),'summary uses vertical grid on desktop');
assert(css.includes('.survey-create-summary__meta{display:grid')&&css.includes('border-top:1px solid var(--v2-border)')&&!css.includes('text-align:right'),'summary metadata is a divided bottom section');
assert(css.includes('min-width:0')&&css.includes('overflow-wrap:anywhere'),'summary content avoids horizontal overflow');
assert(app.includes('state.view="INPUT"')&&html.includes('입력내용 수정'),'review can return to input while retaining state');
assert(app.includes('표준 만족도 5점 척도')&&!app.includes('survey-create-question__options'),'five-point cards render a compact summary');
assert(!html.includes('Mock 완료')&&!html.includes('생성 준비가 완료되었습니다.')&&!app.includes('startFormMock_'),'mock completion was removed');
assert(app.includes('createGoogleForm:function')&&app.includes('secureCreateGoogleFormFromWeb'),'authenticated real Form API exists');
assert(app.includes('buildReviewedFormPayload_')&&app.includes('generatedForm:null'),'reviewed payload and generated result state exist');
assert(app.includes('state.view="FORM_CREATING"')&&app.includes('state.view="DRAFT_REVIEW"'),'creation state blocks duplicates and failure returns to review');
assert(app.includes('questions:state.questions.map')&&!app.includes('questions:state.questions}'),'final payload explicitly maps reviewed questions');
['surveyCreatePublishedLink','surveyCreateEditLink','surveyCreateSpreadsheetLink','surveyCreateGeneratedLinks'].forEach(id=>assert(html.includes(`id="${id}"`),`${id} exists`));
assert.strictEqual((html.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length,3,'generated links open safely');
assert(!app.includes('mockSurveyGenerator')&&!app.includes('mockQuestions_'),'production generation has no AI mock fallback');
assert(!app.includes('FormApp')&&!app.includes('GEMINI_API_KEY'),'Form API and Gemini secret remain server-side');
assert(app.includes('sessionStorage.getItem(TOKEN_KEY)')&&app.includes('validateWebAppTokenFromWeb')&&app.includes('verifyWebAppPasscodeFromWeb')&&app.includes('logoutWebAppFromWeb'),'existing authentication contract is reused');
assert(!app.includes('setInterval(')&&!app.match(/\b\d+%/),'no fake percentage progress');
assert(css.includes('@media(max-width:720px)')&&css.includes('prefers-reduced-motion:reduce'),'responsive and reduced-motion rules exist');

const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(match=>match[1]));
const references=new Set([...app.matchAll(/el\("([^"]+)"\)/g)].map(match=>match[1]));
assert.deepStrictEqual([...references].filter(id=>!ids.has(id)),[],'all el() references resolve');

console.log('survey-create static workflow checks passed');
