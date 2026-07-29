/**
 * ==========================================================================
 * 성남시중원도서관 AI 홍보 비서 및 만족도 보고서 시스템
 * Gemini API 공통 통신 모듈
 * ==========================================================================
 *
 * 담당 기능
 * 1. Gemini 일반 텍스트 응답 생성
 * 2. Gemini JSON 응답 생성
 *
 * 주의
 * - API 키와 모델명은 00_Config.gs에서 가져옵니다.
 * - 다른 파일에서 callGeminiText_(), callGeminiJson_()을 중복 선언하지 않습니다.
 */


/**
 * Gemini API를 호출하고 텍스트 응답을 반환합니다.
 *
 * @param {Object} payload Gemini generateContent 요청 객체
 * @return {string} Gemini가 반환한 텍스트
 */
function callGeminiText_(payload) {

  const apiKey =
    getGeminiApiKey_();

  const model =
    getGeminiModel_();

  const url =
    APP_CONFIG.GEMINI_API_BASE
    + "/"
    + encodeURIComponent(model)
    + ":generateContent?key="
    + encodeURIComponent(apiKey);


  const options = {
    method:
      "post",

    contentType:
      "application/json",

    payload:
      JSON.stringify(payload),

    muteHttpExceptions:
      true
  };


  const maxAttempts = 3;
  const baseWaitTimeMs = 1200;


  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {

    let response;


    try {

      console.log("Gemini API 요청 시작", {
        model: model,
        attempt: attempt,
        maxAttempts: maxAttempts
      });

      response =
        UrlFetchApp.fetch(
          url,
          options
        );

    } catch (networkError) {

      if (attempt === maxAttempts) {

        throw new Error(
          "Gemini API 네트워크 연결에 실패했습니다: "
          + (
            networkError.message
            || networkError
          )
        );

      }


      Utilities.sleep(
        baseWaitTimeMs
        * Math.pow(
          2,
          attempt - 1
        )
      );

      continue;
    }


    const status =
      response.getResponseCode();

    const body =
      response.getContentText();

    console.log("Gemini API 응답 수신", {
      model: model,
      attempt: attempt,
      status: status,
      bodyLength: body ? body.length : 0
    });


    // ----------------------------------------------------------------------
    // 정상 응답
    // ----------------------------------------------------------------------

    if (status === 200) {

      let json;


      try {

        json =
          JSON.parse(
            body
          );

      } catch (parseError) {

        throw new Error(
          "Gemini API 응답을 JSON 형식으로 해석하지 못했습니다."
        );

      }


      const candidates =
        json.candidates
        || [];


      const firstCandidate =
        candidates.length
          ? candidates[0]
          : null;


      const parts =
        firstCandidate
        && firstCandidate.content
        && Array.isArray(
          firstCandidate.content.parts
        )
          ? firstCandidate.content.parts
          : [];


      if (!parts.length) {

        const finishReason =
          firstCandidate
          && firstCandidate.finishReason
            ? firstCandidate.finishReason
            : "확인되지 않음";


        const blockReason =
          json.promptFeedback
          && json.promptFeedback.blockReason
            ? json.promptFeedback.blockReason
            : "";


        let message =
          "Gemini가 유효한 텍스트를 반환하지 않았습니다."
          + " 종료 사유: "
          + finishReason;


        if (blockReason) {

          message +=
            " 차단 사유: "
            + blockReason;

        }


        throw new Error(
          message
        );
      }


      const text =
        parts
          .map(function(part) {
            return part.text || "";
          })
          .join("")
          .trim();


      if (!text) {

        throw new Error(
          "Gemini API의 응답 텍스트가 비어 있습니다."
        );

      }


      return text;
    }


    // ----------------------------------------------------------------------
    // 재시도 가능한 오류
    // ----------------------------------------------------------------------

    if (
      (
        status === 429
        || status === 500
        || status === 503
      )
      && attempt < maxAttempts
    ) {

      const waitTime =
        baseWaitTimeMs
        * Math.pow(
          2,
          attempt - 1
        )
        + Math.floor(
          Math.random()
          * 400
        );


      Utilities.sleep(
        waitTime
      );

      continue;
    }


    // ----------------------------------------------------------------------
    // 재시도하지 않는 API 오류
    // ----------------------------------------------------------------------

    let errorMessage =
      body
      || "응답 본문 없음";


    try {

      const parsed =
        JSON.parse(
          body
        );


      if (
        parsed.error
        && parsed.error.message
      ) {

        errorMessage =
          parsed.error.message;

      }

    } catch (ignored) {

      // JSON 형식이 아닌 오류 응답은 원문을 사용합니다.

    }


    throw new Error(
      "Gemini API 오류("
      + status
      + "): "
      + errorMessage
    );
  }


  throw new Error(
    "Gemini API 호출에 실패했습니다."
  );
}


/**
 * Gemini에게 JSON 형식의 응답을 요청하고 객체로 반환합니다.
 *
 * @param {string} prompt AI에게 전달할 지시문
 * @param {string} schemaText 응답받을 JSON 구조 예시
 * @return {Object} 파싱된 JSON 객체
 */
function callGeminiJson_(
  prompt,
  schemaText,
  beforeParse
) {

  const payload = {

    contents: [
      {
        parts: [
          {
            text:
              prompt
              + "\n\n"
              + "반드시 유효한 JSON만 출력한다.\n"
              + "코드블록, 설명, 인사말은 출력하지 않는다.\n"
              + "배열과 객체의 닫는 괄호를 빠뜨리지 않는다.\n"
              + "응답이 길어질 경우 대표 의견 수를 줄여서라도 완전한 JSON으로 끝낸다.\n"
              + "JSON 구조:\n"
              + schemaText
          }
        ]
      }
    ],

    generationConfig: {

      temperature:
        0.1,

      topP:
        0.8,

      responseMimeType:
        "application/json",

      maxOutputTokens:
        32768

    }

  };


  const text =
    callGeminiText_(
      payload
    );

  if (typeof beforeParse === "function") {
    beforeParse();
  }


  const cleaned =
    cleanJsonResponse_(
      text
    );


  try {

    return JSON.parse(
      cleaned
    );

  } catch (parseError) {

    const repaired =
      repairTruncatedGeminiJson_(
        cleaned
      );

    try {

      return JSON.parse(
        repaired
      );

    } catch (repairError) {

      throw new Error(
        "Gemini JSON 응답을 해석하지 못했습니다. "
        + "응답이 중간에서 잘렸거나 JSON 구조가 완성되지 않았습니다. "
        + "응답 앞부분: "
        + cleaned.substring(
          0,
          700
        )
      );

    }

  }
}


/**
 * 응답의 마지막 닫는 괄호만 누락된 경우 안전하게 복구합니다.
 *
 * @param {string} value
 * @return {string}
 */
function repairTruncatedGeminiJson_(
  value
) {

  const text =
    String(
      value
      || ""
    ).trim();

  if (!text) {
    return text;
  }


  let inString =
    false;

  let escaped =
    false;

  const stack =
    [];


  for (
    let index = 0;
    index < text.length;
    index++
  ) {

    const char =
      text.charAt(
        index
      );


    if (inString) {

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }

      continue;
    }


    if (char === "\"") {
      inString = true;
      continue;
    }


    if (
      char === "{"
      || char === "["
    ) {
      stack.push(
        char
      );
      continue;
    }


    if (
      char === "}"
      || char === "]"
    ) {
      stack.pop();
    }
  }


  // 문자열 자체가 중간에서 잘렸다면 임의 복구하지 않습니다.
  if (inString) {
    return text;
  }


  let repaired =
    text.replace(
      /,\s*$/,
      ""
    );


  while (
    stack.length > 0
  ) {

    const opening =
      stack.pop();

    repaired +=
      opening === "{"
        ? "}"
        : "]";
  }


  return repaired;
}


/**
 * Gemini가 JSON 앞뒤에 코드블록이나 설명을 붙였을 때 제거합니다.
 */
function cleanJsonResponse_(
  value
) {

  let text =
    String(
      value
      || ""
    ).trim();


  text =
    text
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();


  // JSON 객체 앞뒤의 불필요한 설명 제거
  const objectStart =
    text.indexOf(
      "{"
    );

  const objectEnd =
    text.lastIndexOf(
      "}"
    );


  if (
    objectStart !== -1
    && objectEnd !== -1
    && objectEnd > objectStart
  ) {

    return text.substring(
      objectStart,
      objectEnd + 1
    );

  }


  // JSON 배열 형태도 대응
  const arrayStart =
    text.indexOf(
      "["
    );

  const arrayEnd =
    text.lastIndexOf(
      "]"
    );


  if (
    arrayStart !== -1
    && arrayEnd !== -1
    && arrayEnd > arrayStart
  ) {

    return text.substring(
      arrayStart,
      arrayEnd + 1
    );

  }


  return text;
}
