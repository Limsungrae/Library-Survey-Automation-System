/** Google Form 생성은 검토 완료 Draft만 입력으로 사용하는 독립 서비스입니다. */
const SURVEY_FORM_GENERATION_VERSION = "1.0";
const REVIEWED_SURVEY_FORM_TYPES = Object.freeze(["SINGLE", "MULTIPLE", "SCALE", "TEXT", "RESPONDENT"]);
const REVIEWED_SURVEY_SCALE_OPTIONS = Object.freeze(["매우 만족", "만족", "보통", "불만족", "매우 불만족"]);

function createSurveyFormError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertReviewedFormKeys_(value, allowed, location) {
  Object.keys(value).forEach(function(key) {
    if (allowed.indexOf(key) < 0) {
      throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", location + "에 허용되지 않은 항목이 있습니다.");
    }
  });
}

function reviewedFormString_(value, label, required, maxLength) {
  if (typeof value !== "string") {
    throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", label + " 형식이 올바르지 않습니다.");
  }
  const normalized = value.trim();
  if (required && !normalized) {
    throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", label + "을(를) 입력해 주세요.");
  }
  if (normalized.length > maxLength) {
    throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", label + "이(가) 너무 깁니다.");
  }
  return normalized;
}

function validateReviewedFormOptions_(options, location) {
  if (!Array.isArray(options) || options.length < 2 || options.length > 50) {
    throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", location + " 선택지는 2~50개여야 합니다.");
  }
  const seen = {};
  return options.map(function(option) {
    const normalized = reviewedFormString_(option, location + " 선택지", true, 150);
    if (seen[normalized]) {
      throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", location + " 선택지가 중복되었습니다.");
    }
    seen[normalized] = true;
    return normalized;
  });
}

function validateReviewedSurveyForForm_(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", "검토 완료 설문 형식이 올바르지 않습니다.");
  }
  assertReviewedFormKeys_(payload, ["survey", "questions"], "검토 완료 설문");
  if (!payload.survey || typeof payload.survey !== "object" || Array.isArray(payload.survey)) {
    throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", "설문 정보가 올바르지 않습니다.");
  }
  assertReviewedFormKeys_(payload.survey, ["title", "targetAudience", "description", "department", "contact"], "설문 정보");
  const survey = {
    title:reviewedFormString_(payload.survey.title, "조사명", true, 300),
    targetAudience:reviewedFormString_(payload.survey.targetAudience, "조사 대상", true, 500),
    description:reviewedFormString_(payload.survey.description, "설문 안내", false, 2000),
    department:reviewedFormString_(payload.survey.department, "담당부서", false, 200),
    contact:reviewedFormString_(payload.survey.contact, "문의전화", false, 200)
  };
  if (!Array.isArray(payload.questions) || payload.questions.length < 1 || payload.questions.length > 100) {
    throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", "설문 문항은 1~100개여야 합니다.");
  }
  const seenTitles = {};
  const questions = payload.questions.map(function(raw, index) {
    const location = "Q" + (index + 1);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", location + " 형식이 올바르지 않습니다.");
    }
    const allowed = raw.type === "TEXT" ? ["title", "type", "required"] : ["title", "type", "required", "options"];
    assertReviewedFormKeys_(raw, allowed, location);
    const title = reviewedFormString_(raw.title, location + " 질문", true, 300);
    if (seenTitles[title]) {
      throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", "동일한 질문 제목이 중복되었습니다.");
    }
    seenTitles[title] = true;
    if (REVIEWED_SURVEY_FORM_TYPES.indexOf(raw.type) < 0 || typeof raw.required !== "boolean") {
      throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", location + " 문항 유형 또는 필수 여부가 올바르지 않습니다.");
    }
    const question = {title:title, type:raw.type, required:raw.required};
    if (raw.type !== "TEXT") {
      question.options = validateReviewedFormOptions_(raw.options, location);
      if (raw.type === "SCALE" && question.options.join("\n") !== REVIEWED_SURVEY_SCALE_OPTIONS.join("\n")) {
        throw createSurveyFormError_("SURVEY_FORM_VALIDATION_ERROR", location + " 만족도 척도가 기관 표준과 다릅니다.");
      }
    }
    return question;
  });
  return {survey:survey, questions:questions};
}

function prepareFormChoiceOptions_(options) {
  return {
    choiceValues:options.filter(function(option) { return option !== "기타"; }),
    hasOther:options.indexOf("기타") >= 0
  };
}

function applyReviewedChoicesToItem_(item, options) {
  const prepared = prepareFormChoiceOptions_(options);
  item.setChoiceValues(prepared.choiceValues);
  if (prepared.hasOther) item.showOtherOption(true);
  return item;
}

function addReviewedQuestionToForm_(form, question) {
  let item;
  if (question.type === "MULTIPLE") {
    item = applyReviewedChoicesToItem_(form.addCheckboxItem(), question.options);
  } else if (question.type === "TEXT") {
    item = form.addParagraphTextItem();
  } else {
    item = applyReviewedChoicesToItem_(form.addMultipleChoiceItem(), question.options);
  }
  item.setTitle(question.title);
  item.setRequired(question.required);
  return item;
}

function buildGoogleFormDescription_(survey) {
  const metadata = ["대상: " + survey.targetAudience];
  if (survey.department) metadata.push("담당부서: " + survey.department);
  if (survey.contact) metadata.push("문의: " + survey.contact);
  return [survey.description, metadata.join("\n")].filter(Boolean).join("\n\n");
}

function createGoogleFormFromReviewedDraft_(payload) {
  const reviewed = validateReviewedSurveyForForm_(payload);
  let form = null;
  let spreadsheet = null;
  try {
    form = FormApp.create(reviewed.survey.title);
    form.setDescription(buildGoogleFormDescription_(reviewed.survey));
    form.setIsQuiz(false);
    form.setConfirmationMessage("응답이 제출되었습니다. 감사합니다.");
    reviewed.questions.forEach(function(question) {
      addReviewedQuestionToForm_(form, question);
    });
    spreadsheet = SpreadsheetApp.create(reviewed.survey.title + " - 응답");
    form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
    return {
      generationVersion:SURVEY_FORM_GENERATION_VERSION,
      formId:form.getId(),
      title:reviewed.survey.title,
      editUrl:form.getEditUrl(),
      publishedUrl:form.getPublishedUrl(),
      responseSpreadsheetId:spreadsheet.getId(),
      responseSpreadsheetUrl:spreadsheet.getUrl(),
      questionCount:reviewed.questions.length
    };
  } catch (error) {
    console.error("Google Form creation failed", {
      formId:form && typeof form.getId === "function" ? form.getId() : "",
      spreadsheetId:spreadsheet && typeof spreadsheet.getId === "function" ? spreadsheet.getId() : "",
      message:error && error.message ? error.message : String(error)
    });
    throw createSurveyFormError_("SURVEY_FORM_CREATE_ERROR", "Google Form 생성에 실패했습니다.");
  }
}
