# Library Survey Automation System — Project Context

> **Canonical project context** — 현재 repository의 실제 코드가 이 문서보다 우선하는 source of truth입니다.
>
> **Last updated:** 2026-08-26  
> **Runtime:** Google Apps Script V8 / HtmlService / Google Sheets  
> **Live verification:** 아직 수행되지 않음

## 1. Project Scope

Library Survey Automation System은 Excel 또는 Google Form 응답을 공통 문항 Mapping 계약으로 정규화한 뒤 Raw, Analysis, Quality, AI, Export 파이프라인을 실행하는 설문 자동화 시스템입니다. AI 설문 만들기는 Gemini Draft를 검토 가능한 설문으로 만들고 실제 Google Form과 응답 Spreadsheet를 생성합니다.

프로젝트에는 AI 홍보 비서도 포함되어 있으나, 설문 분석 변경 시 해당 기능을 회귀시키지 않아야 합니다.

## 2. Core Architecture

```text
EXCEL ─────────────┐
                   ↓
                Mapping
                   ↓
                  Raw
                   ↓
               Analysis
                   ↓
                Quality
                   ↓
                  AI
                   ↓
                Export
                   ↑
GOOGLE FORM ───────┘
```

> **중요한 Architecture Rule:** Google Form은 별도 분석 시스템이 아니라 기존 설문 분석 시스템의 또 다른 입력 채널이다.

- Excel과 Google Form은 입력 준비 방식만 다릅니다.
- 두 입력은 동일한 Mapping UI와 저장 계약을 사용합니다.
- Mapping 이후에는 동일한 Raw writer와 분석 파이프라인을 사용합니다.
- `AppsScript/12_DynamicAnalysis`, `AppsScript/13_DynamicReport.gs`, `AppsScript/14_DynamicAI.gs`는 입력 source가 Excel인지 Google Form인지, 또는 `surveyId`가 무엇인지 알 필요가 없어야 합니다.
- Google Form 전용 Analysis, Quality, AI 또는 Report 엔진을 만들지 않습니다.

## 3. Input Channels

### 3.1 Excel

- `.xlsx` 또는 `.xls`
- 브라우저 제한 12MB
- 브라우저에서 파일을 읽은 뒤 secure Excel inspect API로 Mapping 후보를 생성합니다.
- Excel 업로드 UI는 Dashboard V2의 응답 가져오기 화면에 항상 표시됩니다.

### 3.2 Google Form

Google Form 응답은 현재 다음 방식으로 연결할 수 있습니다.

1. **AI 설문 만들기에서 자동 연결**
   - 생성 완료 시 전달된 source context 또는 Registry의 `surveyId`를 사용합니다.
2. **응답 Spreadsheet 직접 연결**
   - 전체 Google Spreadsheet URL
   - raw Spreadsheet ID
3. **내 설문에서 선택**
   - Registry의 수집 중인 설문을 선택합니다.

Dashboard V2의 응답 가져오기 화면은 source context 유무와 관계없이 **Excel 파일**과 **Google Form 응답** UI를 항상 함께 제공합니다.

## 4. Manual Google Form Response Connection

관련 frontend는 `Web/survey-dashboard-v2.html`, `Web/survey-dashboard-v2-app.html`, `Web/survey-dashboard-v2-css.html`입니다.

- `parseSpreadsheetId_()`가 공백을 제거하고 정식 Google Spreadsheet URL에서 ID를 추출합니다.
- URL이 아닌 안전한 일반 문자열은 Spreadsheet ID 후보로 허용합니다.
- Google Forms `viewform` URL, 다른 domain URL, slash/query/hash가 섞인 raw ID, 빈 값과 비정상적으로 긴 값은 거부합니다.
- 서버가 `SpreadsheetApp.openById()`로 최종 접근 및 신뢰 검증을 수행합니다.
- 직접 연결은 `inputSource = "GOOGLE_FORM"`과 최소 `googleFormSource`를 구성합니다.
- 기존 `secureInspectGoogleFormResponsesForMappingFromWeb()`과 `inspectGoogleFormSource_()`를 재사용합니다.
- inspect 성공 후 기존 Mapping UI로 이동합니다. 새로운 Mapping 엔진은 없습니다.
- 원본 응답 Spreadsheet는 읽기 전용 source이며 수정하지 않습니다.
- 응답 내용은 Registry 또는 `sessionStorage`에 저장하지 않습니다.
- 연결 변경 시 Google Form source와 관련 Mapping state를 초기화하지만 Excel 기능은 유지합니다.

## 5. AI Survey Create

현재 생성 흐름은 다음과 같습니다.

```text
Gemini Draft
→ Draft Review / 문항 수정
→ Google Form 생성
→ Response Spreadsheet 생성
→ Managed Survey Registry 자동 등록
```

주요 서비스:

- `AppsScript/18_SurveyCreateService.gs`: Gemini 기반 설문 Draft
- `AppsScript/20_SurveyFormService.gs`: 검토 완료 Draft 검증, Form 및 Spreadsheet 생성
- `AppsScript/22_SurveyRegistry.gs`: 생성 결과 metadata 등록
- `Web/survey-create.html`, `Web/survey-create-app.html`: 작성, 검토, 생성 완료 UI

Form 생성 완료 화면에서는 응답 화면, Form 편집, 응답 시트, 내 설문, AI 설문 분석으로 이동할 수 있습니다.

### Registry failure policy

Google Form과 응답 Spreadsheet 생성은 성공했지만 Registry write만 실패한 경우 Form 생성 자체를 실패 처리하지 않습니다.

```json
{
  "registryRegistered": false,
  "surveyId": "",
  "warning": "Google Form은 생성되었지만 내 설문에 등록하지 못했습니다."
}
```

서버는 Registry 오류를 기록하고 생성된 Form 정보를 성공 응답으로 유지합니다. 사용자가 실패로 오인해 다시 생성하면서 Form이 중복되는 것을 방지하기 위한 정책입니다.

## 6. Managed Survey Registry

### Service and storage

- Service: `AppsScript/22_SurveyRegistry.gs`
- Management sheet: `20_설문관리`
- Primary key: 자체 생성 `surveyId` (`SVY-YYYYMMDD-XXXXXXXX`)
- Initial status: `COLLECTING`
- Current statuses: `COLLECTING`, `ARCHIVED`
- Registry row 추가와 archive 변경은 `LockService`로 보호합니다.
- 기존 관리 시트 header가 예상 schema와 다르면 기존 데이터를 덮어쓰지 않고 오류를 반환합니다.
- `20_설문관리`는 동적 분석 대상 sheet 목록에 포함하지 않습니다.

### Registry metadata

| Field | Purpose |
|---|---|
| `surveyId` | 시스템이 생성한 사용자용 primary key |
| `title` | 설문명 |
| `targetAudience` | 조사 대상 |
| `department` | 담당부서 |
| `contact` | 연락처 metadata |
| `formId` | Google Form 연결 ID |
| `publishedUrl` | 응답 화면 URL |
| `editUrl` | Form 편집 URL |
| `responseSpreadsheetId` | 응답 Spreadsheet 연결 ID |
| `responseSpreadsheetUrl` | 응답 Spreadsheet URL |
| `questionSchemaJson` | 확정 문항의 `title`, `type`, `required` metadata |
| `status` | `COLLECTING` 또는 `ARCHIVED` |
| `createdAt` | 생성 시각 |
| `updatedAt` | 최근 갱신 시각 |
| `archivedAt` | 보관 시각 |

Registry에는 실제 설문 응답, 응답자 이메일, 이름, 전화번호 응답 또는 자유의견 내용을 저장하지 않습니다. `questionSchemaJson`에는 설계 metadata만 저장하며 이후 Google Form Mapping hint로 사용합니다.

### Response count

- `responseCount`는 Registry의 영구 truth로 저장하지 않습니다.
- 목록 조회 시 실제 response Spreadsheet 구조에서 현재 응답 수를 읽습니다.
- 목록은 최대 20개로 제한합니다.
- 개별 Spreadsheet 접근 실패는 전체 목록을 실패시키지 않으며 해당 설문만 `확인 불가`로 표시합니다.

## 7. Managed Survey Page

Route:

```text
?page=survey&ui=manage
```

Files:

- `Web/survey-manage.html`
- `Web/survey-manage-app.html`
- `Web/survey-manage-css.html`

기능:

- 수집 중/보관 설문 목록
- 설문명, 상태, 실제 응답 수, 생성일 표시
- 응답하기
- Google Form 편집
- 응답 시트 열기
- AI 분석
- Registry 보관

보관은 Registry 상태만 `ARCHIVED`로 변경합니다. Google Form, 응답 Spreadsheet, Drive 파일 및 응답은 삭제하거나 휴지통으로 이동하지 않습니다. 실제 삭제 기능은 지원하지 않습니다.

## 8. `surveyId`-based AI Analysis

내 설문의 AI 분석 URL은 raw Spreadsheet ID를 노출하지 않습니다.

```text
?page=survey&ui=v2&surveyId=SVY-...
```

Dashboard V2는 browser가 전달한 Registry metadata를 신뢰하지 않고 인증된 `secureGetManagedSurveyFromWeb()`을 호출합니다.

```text
surveyId
→ responseSpreadsheetId
→ formId
→ title
→ questionSchema (`questions`)
→ inputSource = GOOGLE_FORM
→ 기존 secure inspect
→ 기존 Mapping
→ Raw → Analysis → Quality → AI → Export
```

내 설문 선택 panel도 `secureListManagedSurveysFromWeb()`으로 `COLLECTING` 설문을 가져오고 선택 후 기존 Google Form inspect/Mapping 흐름에 연결합니다.

## 9. Secure Registry APIs

모든 Registry business API는 `requireWebAccessToken_()`을 먼저 호출합니다.

- `secureListManagedSurveysFromWeb(options, accessToken)`
- `secureGetManagedSurveyFromWeb(surveyId, accessToken)`
- `secureArchiveManagedSurveyFromWeb(surveyId, accessToken)`

잘못되거나 존재하지 않는 `surveyId`는 서버에서 검증하며 내부 stack trace나 Spreadsheet ID를 일반 사용자 오류로 노출하지 않습니다.

기존 Google Form 응답 API도 계속 보호됩니다.

- `secureInspectGoogleFormResponsesForMappingFromWeb(request, accessToken)`
- `secureImportGoogleFormResponsesToRawFromWeb(request, accessToken)`

## 10. Current Pages and Routes

| Route | Page | Purpose |
|---|---|---|
| `?page=survey&ui=create` | AI 설문 만들기 | Draft, Review, Google Form 생성 |
| `?page=survey&ui=manage` | 내 설문 | Registry 설문 관리 |
| `?page=survey&ui=v2` | Dashboard V2 | 공통 설문 분석 workflow |
| `?page=survey&ui=v2&surveyId=...` | Dashboard V2 | Registry source 복원 후 Google Form 분석 |
| `?page=survey` | Legacy survey dashboard | 기존 호환 route |

## 11. Current Completion Status

### Completed

- AI Survey Create
- Gemini Survey Draft generation
- Draft Review and question editing
- Google Form generation
- Response Spreadsheet creation
- Google Form response import
- Manual Google Form response connection
- Managed Survey Registry
- Managed Survey page
- `surveyId`-based analysis source restoration
- Excel / Google Form common Mapping
- Generic Raw writer
- Dynamic Analysis
- Quality validation and AI gate
- Gemini AI opinion/summary report
- Excel/PDF/PNG export
- Authentication token wrappers

### Current Work

- Google Workspace Live Test
- Registry live creation verification
- Managed Survey response-count verification
- `surveyId` → AI analysis live navigation verification

Manual Google Form response connection과 Managed Survey Registry 구현은 완료되었으므로 Current Work가 아닙니다.

## 12. Testing Status

### Completed locally

현재 repository의 Node 기반 local/mock/static/regression tests는 통과했습니다. 테스트 범위에는 다음이 포함됩니다.

- Spreadsheet URL/ID parsing 및 잘못된 URL 거부
- Excel과 Google Form 입력 UI 공존
- secure Google Form inspect/import API 재사용
- Registry schema, unique `surveyId`, question schema 저장
- 응답 데이터 Registry 미저장
- Registry list/get/archive와 archived filter
- Form 생성 성공 후 Registry 등록
- Registry 등록 실패 시 Form 생성 성공 유지
- 인증된 Registry API contract
- 관리 페이지 routing과 작업 링크
- `surveyId` source 복원과 기존 GOOGLE_FORM inspect 연결
- 기존 Excel/Mapping/Analysis/Quality/AI/Export regression

### Not yet verified live

실제 Apps Script / Google Workspace Live Test는 아직 수행되지 않았습니다. 다음 항목은 local/mock/static test 통과만으로 운영 검증 완료라고 간주하지 않습니다.

- 실제 배포 Web App 인증 및 route
- 실제 Google Form/Response Spreadsheet 생성
- 실제 `20_설문관리` 생성과 row 등록
- 실제 Form destination 권한 및 Spreadsheet 접근
- 실제 응답 수 조회
- 실제 `surveyId` 기반 Dashboard 이동
- 실제 Gemini, Drive 및 Excel/PDF/PNG 산출물

Live Test는 배포된 Apps Script 및 실제 Workspace 권한으로 별도 수행해야 합니다.

## 13. Protected Architecture Rules

1. 현재 repository의 실제 코드와 테스트가 source of truth입니다.
2. Excel과 Google Form은 공통 Mapping 이후 같은 분석 pipeline을 사용합니다.
3. Google Form 전용 분석 엔진을 추가하지 않습니다.
4. `12_DynamicAnalysis`, `13_DynamicReport`, `14_DynamicAI`에 input source 분기를 넣지 않습니다.
5. 실제 응답을 Registry 또는 browser storage에 영구 저장하지 않습니다.
6. Registry archive는 외부 Form/Spreadsheet 삭제가 아닙니다.
7. Registry write 실패를 이미 생성된 Google Form의 생성 실패로 바꾸지 않습니다.
8. 공개 API 이름과 인자 순서, 인증 token guard를 호환성 검토 없이 변경하지 않습니다.
9. Mapping/Raw 이후 기존 Analysis, Quality, AI, Report 동작을 최대한 변경하지 않습니다.
10. Workspace runtime 동작은 실제 Live Test 없이 검증 완료로 보고하지 않습니다.

## 14. Operational Unknowns

다음은 repository만으로 확인할 수 없어 **Needs Verification** 상태입니다.

- Production deployment ID
- Bound Spreadsheet ID
- 배포된 Web App version
- 실제 OAuth scope와 Workspace 권한
- 운영 Spreadsheet에 이미 존재하는 `20_설문관리` 상태
- 운영 환경에서의 응답 수 조회 성능

## 15. Reference Commits

환경의 merge/rebase에 따라 SHA는 달라질 수 있으므로 현재 코드 존재 여부가 우선입니다.

- `b87b019518f8d2c5e01ffaad8c61f768a6826284` — Add manual Google Form response connection
- `b65965d1e04fcf94dc273d15b006efa7db5626f0` — Add managed survey registry and dashboard
