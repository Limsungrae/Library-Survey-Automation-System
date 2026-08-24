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
  'surveyCreateTitleInput','surveyCreateAudienceInput','surveyCreateRequestInput',
  'surveyCreateReferenceInput','surveyCreateGenerateButton','surveyCreateReviewView',
  'surveyCreateQuestionList','surveyCreateAddQuestionButton','surveyCreateFormButton'
].forEach(id=>assert(html.includes(`id="${id}"`),`${id} exists`));
assert.strictEqual((html.match(/ required/g)||[]).length>=4,true,'auth plus three survey fields are required');
assert(html.includes('AI가 알기 어려운 프로그램명·서비스명·강좌명 등이 있을 때만 입력해주세요.'),'reference guidance is exact');
assert(html.includes('role="alert"')&&html.includes('role="status"')&&html.includes('aria-live="polite"')&&html.includes('aria-busy="true"'),'accessibility status contract');
assert(html.includes('?page=home')&&html.includes('?page=survey&amp;ui=v2'),'home and analysis navigation');
assert(app.includes('INPUT')&&app.includes('GENERATING')&&app.includes('DRAFT_REVIEW')&&app.includes('FORM_CREATING')&&app.includes('COMPLETED'),'mock workflow states exist');
assert(app.includes('const mockSurveyGenerator')&&app.includes('mockQuestions_()')&&app.includes('renderQuestions_'),'mock data is separated from renderer');
assert(app.includes('data-action="edit"')&&app.includes('data-action="delete"')&&app.includes('data-action="up"')&&app.includes('data-action="down"'),'question editing actions exist');
assert(app.includes('addQuestion_')&&app.includes('data-edit="required"')&&app.includes('data-edit="type"'),'question addition and editable fields exist');
assert(app.includes('Google Form 생성 기능은 다음 개발 단계에서 연결됩니다.'),'mock completion is explicit');
assert(!app.includes('FormApp')&&!app.includes('secureGenerateSurveyDraftFromWeb')&&!app.includes('callGemini')&&!app.includes('GEMINI_API'),'no real Form or Gemini integration');
assert(app.includes('sessionStorage.getItem(TOKEN_KEY)')&&app.includes('validateWebAppTokenFromWeb')&&app.includes('verifyWebAppPasscodeFromWeb')&&app.includes('logoutWebAppFromWeb'),'existing authentication contract is reused');
assert(!app.includes('setInterval(')&&!app.match(/\b\d+%/),'no fake percentage progress');
assert(css.includes('@media(max-width:720px)')&&css.includes('prefers-reduced-motion:reduce'),'responsive and reduced-motion rules exist');

const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(match=>match[1]));
const references=new Set([...app.matchAll(/el\("([^"]+)"\)/g)].map(match=>match[1]));
assert.deepStrictEqual([...references].filter(id=>!ids.has(id)),[],'all el() references resolve');

console.log('survey-create static workflow checks passed');
