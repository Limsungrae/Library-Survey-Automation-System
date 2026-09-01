/** AI 설문 만들기로 생성한 Form/Spreadsheet 연결 정보만 관리합니다. 응답 데이터는 저장하지 않습니다. */
const SURVEY_REGISTRY_SHEET_NAME = "20_설문관리";
const SURVEY_REGISTRY_HEADERS = Object.freeze([
  "surveyId","title","targetAudience","department","contact","formId","publishedUrl","editUrl",
  "responseSpreadsheetId","responseSpreadsheetUrl","questionSchemaJson","status","createdAt","updatedAt","archivedAt"
]);
const SURVEY_REGISTRY_STATUSES = Object.freeze(["COLLECTING","ARCHIVED"]);

function createSurveyRegistryError_(code, message) { const error = new Error(message); error.code = code; return error; }
function createManagedSurveyId_() {
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Etc/UTC", "yyyyMMdd");
  return "SVY-" + date + "-" + Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase();
}
function getSurveyRegistrySheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SURVEY_REGISTRY_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SURVEY_REGISTRY_SHEET_NAME);
    sheet.getRange(1, 1, 1, SURVEY_REGISTRY_HEADERS.length).setValues([SURVEY_REGISTRY_HEADERS.slice()]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  const width = Math.max(sheet.getLastColumn(), SURVEY_REGISTRY_HEADERS.length);
  if (sheet.getLastRow() < 1 || width !== SURVEY_REGISTRY_HEADERS.length) throw createSurveyRegistryError_("SURVEY_REGISTRY_SCHEMA_ERROR", "설문 관리 시트 구조가 올바르지 않습니다.");
  const actual = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  if (actual.join("\n") !== SURVEY_REGISTRY_HEADERS.join("\n")) throw createSurveyRegistryError_("SURVEY_REGISTRY_SCHEMA_ERROR", "설문 관리 시트 구조가 올바르지 않습니다.");
  return sheet;
}
function registryQuestionSchema_(questions) {
  return (questions || []).map(function(question) { return {title:String(question.title || "").trim(), type:String(question.type || "").trim(), required:Boolean(question.required)}; });
}
function registerManagedSurvey_(reviewed, generatedForm) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = getSurveyRegistrySheet_(), now = new Date(), surveyId = createManagedSurveyId_();
    const survey = reviewed.survey || {}, questions = registryQuestionSchema_(reviewed.questions);
    sheet.appendRow([surveyId,survey.title || "",survey.targetAudience || "",survey.department || "",survey.contact || "",generatedForm.formId || "",generatedForm.publishedUrl || "",generatedForm.editUrl || "",generatedForm.responseSpreadsheetId || "",generatedForm.responseSpreadsheetUrl || "",JSON.stringify(questions),"COLLECTING",now,now,""]);
    return {surveyId:surveyId, status:"COLLECTING", registeredAt:now.toISOString()};
  } finally { lock.releaseLock(); }
}
function registryRowToSurvey_(row) {
  const item = {}; SURVEY_REGISTRY_HEADERS.forEach(function(header, index) { item[header] = row[index]; });
  let questions = []; try { questions = JSON.parse(String(item.questionSchemaJson || "[]")); } catch (ignored) { questions = []; }
  return {surveyId:String(item.surveyId || ""),title:String(item.title || ""),targetAudience:String(item.targetAudience || ""),department:String(item.department || ""),contact:String(item.contact || ""),formId:String(item.formId || ""),publishedUrl:String(item.publishedUrl || ""),editUrl:String(item.editUrl || ""),responseSpreadsheetId:String(item.responseSpreadsheetId || ""),responseSpreadsheetUrl:String(item.responseSpreadsheetUrl || ""),questions:registryQuestionSchema_(questions),status:String(item.status || ""),createdAt:item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt || ""),updatedAt:item.updatedAt instanceof Date ? item.updatedAt.toISOString() : String(item.updatedAt || ""),archivedAt:item.archivedAt instanceof Date ? item.archivedAt.toISOString() : String(item.archivedAt || "")};
}
function readSurveyRegistryRows_() { const sheet=getSurveyRegistrySheet_(); return sheet.getLastRow()<2?[]:sheet.getRange(2,1,sheet.getLastRow()-1,SURVEY_REGISTRY_HEADERS.length).getValues(); }
function managedSurveyResponseCount_(survey) {
  try { const source=openGoogleFormResponseSource_({responseSpreadsheetId:survey.responseSpreadsheetId,formId:survey.formId,title:survey.title,questionHints:survey.questions}); return {responseCount:Number(source.structure.responseCount || 0),responseCountAvailable:true}; }
  catch (error) { console.error("Managed survey response count failed", survey.surveyId, error && error.message); return {responseCount:null,responseCountAvailable:false}; }
}
function listManagedSurveysFromWeb(options) {
  options=options||{}; const includeArchived=Boolean(options.includeArchived), limit=Math.min(Math.max(Number(options.limit)||20,1),20);
  return {success:true,surveys:readSurveyRegistryRows_().map(registryRowToSurvey_).filter(function(item){return includeArchived||item.status==="COLLECTING";}).sort(function(a,b){return String(b.createdAt).localeCompare(String(a.createdAt));}).slice(0,limit).map(function(item){return Object.assign(item,managedSurveyResponseCount_(item));})};
}
function validateManagedSurveyId_(surveyId) { const value=String(surveyId||"").trim(); if(!/^SVY-\d{8}-[A-F0-9]{8}$/.test(value)) throw createSurveyRegistryError_("SURVEY_NOT_FOUND","설문을 찾을 수 없습니다."); return value; }
function getManagedSurveyFromWeb(surveyId) { const id=validateManagedSurveyId_(surveyId), found=readSurveyRegistryRows_().map(registryRowToSurvey_).find(function(item){return item.surveyId===id;}); if(!found) throw createSurveyRegistryError_("SURVEY_NOT_FOUND","설문을 찾을 수 없습니다."); return {success:true,survey:found}; }
function archiveManagedSurveyFromWeb(surveyId) {
  const id=validateManagedSurveyId_(surveyId), lock=LockService.getScriptLock(); lock.waitLock(30000);
  try { const sheet=getSurveyRegistrySheet_(), rows=readSurveyRegistryRows_(); for(let i=0;i<rows.length;i++){if(String(rows[i][0])===id){const now=new Date();sheet.getRange(i+2,12,1,4).setValues([["ARCHIVED",rows[i][12]||now,now,now]]);return {success:true,surveyId:id,status:"ARCHIVED"};}} throw createSurveyRegistryError_("SURVEY_NOT_FOUND","설문을 찾을 수 없습니다."); }
  finally { lock.releaseLock(); }
}
