/** Google Form 응답 Spreadsheet를 기존 Mapping/Raw 입력 계약에 연결합니다. */
const GOOGLE_FORM_RESPONSE_SOURCE_TYPE = "GOOGLE_FORM";

function createGoogleFormImportError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateGoogleFormResponseRequest_(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw createGoogleFormImportError_("GOOGLE_FORM_RESPONSE_VALIDATION_ERROR", "설문 응답 요청 형식이 올바르지 않습니다.");
  }
  const spreadsheetId = typeof request.responseSpreadsheetId === "string"
    ? request.responseSpreadsheetId.trim() : "";
  if (!spreadsheetId || spreadsheetId.length > 200) {
    throw createGoogleFormImportError_("GOOGLE_FORM_RESPONSE_VALIDATION_ERROR", "설문 응답 Spreadsheet ID가 올바르지 않습니다.");
  }
  const formId = typeof request.formId === "string" ? request.formId.trim() : "";
  if (formId.length > 200) {
    throw createGoogleFormImportError_("GOOGLE_FORM_RESPONSE_VALIDATION_ERROR", "Google Form ID가 올바르지 않습니다.");
  }
  const title = typeof request.title === "string" ? request.title.trim().slice(0, 300) : "";
  const hints = Array.isArray(request.questionHints) ? request.questionHints.slice(0, 100).map(function(hint) {
    if (!hint || typeof hint !== "object") return null;
    const hintTitle = typeof hint.title === "string" ? hint.title.trim() : "";
    const hintType = typeof hint.type === "string" ? hint.type.trim().toUpperCase() : "";
    if (!hintTitle || ["SINGLE", "MULTIPLE", "SCALE", "TEXT", "RESPONDENT"].indexOf(hintType) < 0) return null;
    return {title:hintTitle, type:hintType};
  }).filter(Boolean) : [];
  return {responseSpreadsheetId:spreadsheetId, formId:formId, title:title, questionHints:hints};
}

function openGoogleFormResponseSource_(request) {
  const validated = validateGoogleFormResponseRequest_(request);
  let spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(validated.responseSpreadsheetId);
  } catch (error) {
    throw createGoogleFormImportError_("GOOGLE_FORM_RESPONSE_ACCESS_ERROR", "Google Form 응답 시트에 접근할 수 없습니다. 응답 시트 권한을 확인해 주세요.");
  }
  const sheet = findBestSurveySheetForMapping_(spreadsheet);
  if (!sheet) {
    throw createGoogleFormImportError_("GOOGLE_FORM_RESPONSE_STRUCTURE_ERROR", "설문 응답 구조를 확인할 수 없습니다.");
  }
  let structure;
  try {
    structure = readSurveySheetStructureForMapping_(sheet);
  } catch (error) {
    throw createGoogleFormImportError_("GOOGLE_FORM_RESPONSE_STRUCTURE_ERROR", "설문 응답 구조를 확인할 수 없습니다.");
  }
  return {request:validated, spreadsheet:spreadsheet, sheet:sheet, structure:structure};
}

function applyGeneratedFormQuestionHints_(mappings, hints) {
  const hintByHeader = {};
  (hints || []).forEach(function(hint) {
    const key = normalizeHeader_(hint.title);
    if (key && !hintByHeader[key]) hintByHeader[key] = hint.type;
  });
  let applied = 0;
  const merged = (mappings || []).map(function(mapping) {
    const hintedType = hintByHeader[normalizeHeader_(mapping.originalHeader)];
    if (!hintedType) return mapping;
    applied++;
    const updated = Object.assign({}, mapping, {
      suggestedType:hintedType,
      suggestedTypeLabel:getSurveyQuestionTypeLabel_(hintedType),
      selectedType:hintedType,
      analysisTarget:true,
      mappingSource:"GENERATED_FORM",
      reviewStatus:"AUTO_REVIEWED",
      confidence:1,
      reason:"생성된 Google Form 문항 유형과 헤더가 일치했습니다."
    });
    if (hintedType === "SCALE") {
      updated.scaleKind = "RECOMMENDATION_1_5";
      updated.scaleValueMap = {"매우 만족":5,"만족":4,"보통":3,"불만족":2,"매우 불만족":1};
    }
    return updated;
  });
  return {mappings:merged, appliedCount:applied};
}

function inspectGoogleFormResponsesForMappingFromWeb(request) {
  const source = openGoogleFormResponseSource_(request);
  if (source.structure.responseCount < 1) {
    throw createGoogleFormImportError_("GOOGLE_FORM_RESPONSE_EMPTY", "아직 분석할 설문 응답이 없습니다.");
  }
  const base = buildSurveyQuestionMappings_(source.structure.headers, source.structure.sampleRow);
  const hinted = applyGeneratedFormQuestionHints_(base, source.request.questionHints);
  const mappingSource = hinted.appliedCount === 0 ? "RULE"
    : hinted.appliedCount === hinted.mappings.filter(function(mapping) { return mapping.selectedType !== "EXCLUDE"; }).length
      ? "GENERATED_FORM" : "MIXED";
  return {
    success:true,
    sourceType:GOOGLE_FORM_RESPONSE_SOURCE_TYPE,
    spreadsheetId:source.request.responseSpreadsheetId,
    spreadsheetName:source.spreadsheet.getName(),
    sheetName:source.sheet.getName(),
    headerRow:source.structure.headerRow,
    responseCount:source.structure.responseCount,
    questionCount:hinted.mappings.length,
    mappings:hinted.mappings,
    mappingSource:mappingSource,
    validation:validateSurveyMappings_(hinted.mappings),
    message:"Google Form 응답 " + source.structure.responseCount + "건과 문항 " + hinted.mappings.length + "개를 확인했습니다."
  };
}

function importGoogleFormResponsesToRawFromWeb(request) {
  const source = openGoogleFormResponseSource_(request);
  if (source.structure.responseCount < 1) {
    throw createGoogleFormImportError_("GOOGLE_FORM_RESPONSE_EMPTY", "아직 분석할 설문 응답이 없습니다.");
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  const mappingSheet = active.getSheetByName(DYNAMIC_SURVEY_CONFIG.SHEETS.MAPPING)
    || active.getSheetByName(DYNAMIC_SURVEY_CONFIG.SHEETS.LEGACY_MAPPING);
  if (!mappingSheet || mappingSheet.getLastRow() < 2) {
    throw createGoogleFormImportError_("GOOGLE_FORM_RESPONSE_MAPPING_ERROR", "먼저 문항 구조를 확인하고 문항 분석 유형을 저장해 주세요.");
  }
  const values = source.sheet.getRange(
    source.structure.headerRow, 1,
    source.sheet.getLastRow() - source.structure.headerRow + 1,
    source.sheet.getLastColumn()
  ).getDisplayValues();
  return writeDynamicSurveyRawValues_(values, {
    sourceType:GOOGLE_FORM_RESPONSE_SOURCE_TYPE,
    responseSpreadsheetId:source.request.responseSpreadsheetId,
    sourceSpreadsheetName:source.spreadsheet.getName(),
    sourceSheetName:source.sheet.getName(),
    formId:source.request.formId,
    headerRow:source.structure.headerRow
  });
}
