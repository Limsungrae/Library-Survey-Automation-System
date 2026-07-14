# 📊 Library Survey Automation System

Google Apps Script와 Gemini API를 활용한  
**범용 만족도 조사 분석 및 자동 보고서 생성 시스템**입니다.

네이버 폼 등에서 수집한 Excel 설문 데이터를 업로드하면 문항 구조를 분석하고, 통계 분석부터 AI 기반 주관식 분석, 총평·향후계획 작성, Excel 결과보고서 생성까지 자동으로 처리합니다.

---

## ✨ 주요 기능

- Excel 설문 응답 업로드
- 설문 문항 구조 자동 분석
- 문항별 분석 유형 자동 추천 및 사용자 수정
- 단일응답·복수응답·5점 척도 동적 통계 분석
- Gemini API 기반 주관식 의견 분류
- AI 기반 조사 총평 및 향후계획 생성
- Google Spreadsheet 결과보고서 자동 생성
- 웹 대시보드 결과 시각화
- Excel `.xlsx` 결과보고서 다운로드
- 처리 단계에 따른 기능 버튼 순차 활성화

---

## 🔄 시스템 처리 흐름

    조사정보 입력
        ↓
    Excel 파일 업로드
        ↓
    문항 구조 자동 분석
        ↓
    분석 유형 확인 및 수정
        ↓
    범용 원자료 생성
        ↓
    동적 통계 분석
        ↓
    Gemini AI 분석
        ↓
    결과보고서 생성
        ↓
    Excel 다운로드

---

## 📊 지원 분석 유형

| 유형 | 설명 |
|---|---|
| `EXCLUDE` | 분석 제외 |
| `RESPONDENT` | 응답자 특성 |
| `PERSONAL_INFO` | 개인정보 |
| `SINGLE` | 단일응답 |
| `MULTIPLE` | 복수응답 |
| `SCALE` | 5점 척도 |
| `RECOMMENDATION` | 재이용·추천 의향 |
| `TEXT` | 주관식 의견 |

---

## 🤖 Gemini AI 활용

Gemini API를 활용하여 주관식 의견을 의미별로 분류하고, 통계 분석 결과를 기반으로 조사 총평과 향후계획 초안을 생성합니다.

AI 분석의 신뢰성을 높이기 위해 다음 검증 로직을 적용했습니다.

- 실제 원자료에 존재하는 응답만 분석
- AI가 반환한 응답 번호 검증
- 범주별 건수를 Apps Script에서 재계산
- 연락처와 이메일 비식별 처리
- 분석 결과에 존재하지 않는 정책·예산·일정 생성 제한
- 담당자 최종 검토 안내 표시

---

## 🛠 기술 스택

- Google Apps Script
- JavaScript
- HTML
- CSS
- Bulma CSS
- Chart.js
- Google Gemini API
- Google Spreadsheet
- Google Drive
- Excel `.xlsx`

---

## 📑 자동 생성 보고서

    01_조사개요
    02_대시보드
    03_응답자특성
    04_복수응답분석
    05_만족도분석
    06_주관식분석
    07_AI총평
    08_향후계획
    09_범용원자료

내부 관리용 시트인 `00_설정`, `10_문항매핑`은 최종 Excel 결과보고서에서 제외됩니다.

---

## 🔒 보안

본 저장소에는 다음 정보를 포함하지 않습니다.

- 실제 설문 응답자 개인정보
- 실제 전화번호 및 이메일
- Gemini API Key
- Google Spreadsheet ID
- 개인 Google Drive 파일 정보
- 실제 Apps Script 배포 URL

Gemini API Key는 코드에 직접 작성하지 않고 Google Apps Script의 Script Properties를 통해 관리합니다.

    const apiKey =
      PropertiesService
        .getScriptProperties()
        .getProperty("GEMINI_API_KEY");

---

## 🎯 개발 배경

도서관 인턴 업무 중 만족도 조사 결과를 정리하고 보고서를 작성하는 반복 업무를 자동화하기 위해 개발했습니다.

초기에는 특정 설문 양식을 처리하는 시스템으로 시작했으나, 설문마다 문항 구조가 다르다는 문제를 해결하기 위해 다음 기능을 추가하여 범용 시스템으로 확장했습니다.

- 문항 구조 자동 분석
- 분석 유형 사용자 매핑
- 문항 유형별 동적 통계 분석
- Gemini 기반 주관식 의견 분류
- AI 총평 및 향후계획 생성
- Excel 결과보고서 자동 저장

---

## 📂 프로젝트 구조

    Library-Survey-Automation-System/
    │
    ├── README.md
    ├── appsscript.json
    │
    └── src/
        ├── 00_Config.gs
        ├── 01_Setup.gs
        ├── 02_GeminiService.gs
        ├── 03_SurveySettings.gs
        ├── 04_SurveyImport.gs
        ├── 08_Export.gs
        ├── 09_Main.gs
        ├── 10_WebService.gs
        ├── 11_SurveyMapping.gs
        ├── 12_DynamicAnalysis.gs
        ├── 13_DynamicReport.gs
        ├── 14_DynamicAI.gs
        └── survey-dashboard.html

---

## 🚀 향후 개선 계획

- 문항 유형 자동 추천 정확도 개선
- AI 분석 결과 사용자 수정 기능
- 보고서 및 차트 디자인 개선
- PDF 결과보고서 생성
- 분석 이력 관리
- 대용량 설문 처리 성능 개선

---

## 👨‍💻 Developer

**Limsungrae**

Google Apps Script, 데이터 분석, AI 자동화 기능을 활용한 업무 시스템 개발
