/**
 * ==========================================================================
 * 웹앱 간이 인증 코드 관리
 * ==========================================================================
 *
 * [필수 설정] Apps Script 프로젝트 설정 > 스크립트 속성에 아래 값을 등록해야 합니다:
 * WEB_APP_PASSCODE = 실제 사용할 인증 비밀번호
 */

/**
 * 인증 세션 유지 시간 설정: 8시간 (8 * 60 * 60 초)
 */
function getWebAccessSessionSeconds_() {
  return 8 * 60 * 60;
}

/**
 * 프론트엔드에서 입력한 비밀번호를 확인하고 임시 접근 토큰을 발급합니다.
 *
 * @param {string} passcode
 * @return {Object} 인증 결과 및 토큰 객체
 */
function verifyWebAppPasscodeFromWeb(passcode) {
  try {
    // 1. 구글 프로젝트 내부 속성 시스템에서 마스터 비밀번호 조회
    const savedPasscode = PropertiesService.getScriptProperties().getProperty("WEB_APP_PASSCODE");

    if (!savedPasscode) {
      throw new Error("WEB_APP_PASSCODE가 스크ipart 스크립트 속성에 등록되지 않았습니다.");
    }

    const inputPasscode = String(passcode || "").trim();

    if (!inputPasscode) {
      return {
        success: false,
        authenticated: false,
        error: "인증 코드를 입력해 주세요."
      };
    }

    // 2. 타이밍 공격 방지용 해시 비교 함수로 비밀번호 검증
    if (!safePasscodeEquals_(inputPasscode, savedPasscode)) {
      return {
        success: false,
        authenticated: false,
        error: "인증 코드가 올바르지 않습니다."
      };
    }

    // 3. 인증 성공 시 고유 토큰(UUID) 생성
    const token = Utilities.getUuid() + Utilities.getUuid();

    // 4. 구글 스크립트 캐시 시스템에 8시간 동안 토큰 저장
    CacheService.getScriptCache().put(
      "WEB_ACCESS_" + token,
      "AUTHORIZED",
      getWebAccessSessionSeconds_()
    );

    return {
      success: true,
      authenticated: true,
      token: token,
      expiresInSeconds: getWebAccessSessionSeconds_(),
      message: "인증이 완료되었습니다."
    };

  } catch (error) {
    return {
      success: false,
      authenticated: false,
      error: error && error.message ? error.message : String(error)
    };
  }
}

/**
 * 브라우저 저장소에 보관 중인 토큰이 여전히 유효한 세션인지 확인합니다.
 *
 * @param {string} token
 * @return {Object}
 */
function validateWebAppTokenFromWeb(token) {
  return {
    success: true,
    authenticated: isValidWebAccessToken_(token)
  };
}

/**
 * 내부용 토큰 유효성 조회 검사 (Cache 확인)
 *
 * @param {string} token
 * @return {boolean}
 */
function isValidWebAccessToken_(token) {
  const normalizedToken = String(token || "").trim();

  if (!normalizedToken) {
    return false;
  }

  return CacheService.getScriptCache().get("WEB_ACCESS_" + normalizedToken) === "AUTHORIZED";
}

/**
 * 보호된 서버 Wrapper 함수들이 실행되기 전에 허가증을 강제로 확인하는 바운서 함수
 *
 * @param {string} token
 */
function requireWebAccessToken_(token) {
  if (!isValidWebAccessToken_(token)) {
    throw new Error("인증이 만료되었거나 유효하지 않습니다. 다시 인증해 주세요.");
  }
}

/**
 * 사용자가 로그아웃 버튼을 누르거나 세션을 파기할 때 캐시에서 토큰 삭제
 *
 * @param {string} token
 * @return {Object}
 */
function logoutWebAppFromWeb(token) {
  const normalizedToken = String(token || "").trim();

  if (normalizedToken) {
    CacheService.getScriptCache().remove("WEB_ACCESS_" + normalizedToken);
  }

  return {
    success: true,
    message: "로그아웃되었습니다."
  };
}

/**
 * 🔒 타이밍 공격(Timing Attack)을 방지하기 위한 SHA-256 해시 기반 안전 문자열 비교 함수
 */
function safePasscodeEquals_(inputValue, savedValue) {
  const inputBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(inputValue),
    Utilities.Charset.UTF_8
  );

  const savedBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(savedValue),
    Utilities.Charset.UTF_8
  );

  if (inputBytes.length !== savedBytes.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < inputBytes.length; index++) {
    difference |= (inputBytes[index] ^ savedBytes[index]);
  }

  return difference === 0;
}
