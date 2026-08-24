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

/** Script Cache는 영속 세션보다 짧게 유지하는 조회 가속 계층입니다. */
function getWebAccessCacheSeconds_() {
  return 60 * 60;
}

function normalizeWebAccessToken_(token) {
  return String(token || "").trim();
}

function getWebAccessTokenHash_(token) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    normalizeWebAccessToken_(token),
    Utilities.Charset.UTF_8
  );
  return digest.map(function(byte) {
    return ((byte + 256) % 256).toString(16).padStart(2, "0");
  }).join("");
}

function getWebAccessSessionPropertyKey_(token) {
  return "WEB_ACCESS_SESSION_" + getWebAccessTokenHash_(token);
}

function getWebAccessCacheKey_(token) {
  return "WEB_ACCESS_" + getWebAccessTokenHash_(token);
}

function refreshWebAccessCache_(token, expiresAt) {
  const remainingSeconds = Math.floor((Number(expiresAt) - Date.now()) / 1000);
  if (remainingSeconds <= 0) return;
  CacheService.getScriptCache().put(
    getWebAccessCacheKey_(token),
    JSON.stringify({expiresAt: Number(expiresAt)}),
    Math.min(getWebAccessCacheSeconds_(), remainingSeconds)
  );
}

function createWebAccessSession_(token) {
  const createdAt = Date.now();
  const session = {
    createdAt: createdAt,
    expiresAt: createdAt + getWebAccessSessionSeconds_() * 1000
  };
  PropertiesService.getScriptProperties().setProperty(
    getWebAccessSessionPropertyKey_(token),
    JSON.stringify(session)
  );
  refreshWebAccessCache_(token, session.expiresAt);
  return session;
}

function removeWebAccessSession_(token) {
  const normalizedToken = normalizeWebAccessToken_(token);
  if (!normalizedToken) return;
  CacheService.getScriptCache().remove(getWebAccessCacheKey_(normalizedToken));
  PropertiesService.getScriptProperties().deleteProperty(
    getWebAccessSessionPropertyKey_(normalizedToken)
  );
}

function parseWebAccessSession_(serialized) {
  try {
    const session = JSON.parse(String(serialized || ""));
    if (!session || typeof session !== "object" || !Number.isFinite(Number(session.expiresAt))) {
      return null;
    }
    return {createdAt: Number(session.createdAt || 0), expiresAt: Number(session.expiresAt)};
  } catch (ignored) {
    return null;
  }
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

    // 4. ScriptProperties에 8시간 세션을 저장하고 Script Cache를 예열
    createWebAccessSession_(token);

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
 * 내부용 토큰 유효성 검사. ScriptProperties가 source of truth이며 Cache는 가속 계층입니다.
 *
 * @param {string} token
 * @return {boolean}
 */
function isValidWebAccessToken_(token) {
  const normalizedToken = normalizeWebAccessToken_(token);

  if (!normalizedToken) return false;

  const cache = CacheService.getScriptCache();
  const cacheKey = getWebAccessCacheKey_(normalizedToken);
  const cachedSession = parseWebAccessSession_(cache.get(cacheKey));
  if (cachedSession && cachedSession.expiresAt > Date.now()) return true;

  const properties = PropertiesService.getScriptProperties();
  const propertyKey = getWebAccessSessionPropertyKey_(normalizedToken);
  const serialized = properties.getProperty(propertyKey);
  if (!serialized) {
    cache.remove(cacheKey);
    return false;
  }

  const session = parseWebAccessSession_(serialized);
  if (!session || session.expiresAt <= Date.now()) {
    properties.deleteProperty(propertyKey);
    cache.remove(cacheKey);
    return false;
  }

  refreshWebAccessCache_(normalizedToken, session.expiresAt);
  return true;
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
 * 사용자가 로그아웃하면 영속 세션과 조회 캐시를 함께 삭제합니다.
 *
 * @param {string} token
 * @return {Object}
 */
function logoutWebAppFromWeb(token) {
  removeWebAccessSession_(token);

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
