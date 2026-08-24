const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const home = read("Web/index.html");
const promo = read("Web/promo-assistant.html");
const surveyV2 = read("Web/survey-dashboard-v2.html");
const surveyCreate = read("Web/survey-create.html");
const mainSource = read("AppsScript/01_Main.gs");

const rendered = [];
const context = {
  HtmlService: {
    XFrameOptionsMode: { ALLOWALL: "ALLOWALL" },
    createTemplateFromFile(fileName) {
      rendered.push(fileName);
      return {
        evaluate() {
          return {
            setTitle() { return this; },
            setXFrameOptionsMode() { return this; },
            addMetaTag() { return this; }
          };
        }
      };
    }
  },
  ScriptApp: { getService: () => ({ getUrl: () => "https://example.test/exec" }) },
  SpreadsheetApp: {},
  console
};
vm.createContext(context);
vm.runInContext(mainSource, context, { filename: "AppsScript/01_Main.gs" });

function routedFile(parameters) {
  rendered.length = 0;
  context.doGet(parameters ? { parameter: parameters } : undefined);
  return rendered[0];
}

assert.strictEqual(routedFile(), "index", "기본 접속은 플랫폼 홈이어야 합니다.");
assert.strictEqual(routedFile({ page: "home" }), "index", "명시적 홈 경로를 지원해야 합니다.");
assert.strictEqual(routedFile({ page: "promo" }), "promo-assistant", "promo 경로는 홍보 비서여야 합니다.");
assert.strictEqual(routedFile({ page: "index" }), "promo-assistant", "기존 index 경로는 홍보 비서로 호환해야 합니다.");
assert.strictEqual(routedFile({ page: "survey", ui: "v2" }), "survey-dashboard-v2", "설문 v2 경로를 유지해야 합니다.");
assert.strictEqual(routedFile({ page: "survey", ui: "create" }), "survey-create", "설문 만들기 경로를 지원해야 합니다.");
assert.strictEqual(routedFile({ page: "survey" }), "survey-dashboard", "기존 설문 경로를 유지해야 합니다.");

assert.match(home, /class="service-grid"/);
assert.strictEqual((home.match(/class="service-card service-card--/g) || []).length, 3, "운영 서비스 카드는 3개여야 합니다.");
assert.match(home, /href="<\?= webAppUrl \?>\?page=promo"/);
assert.match(home, /href="<\?= webAppUrl \?>\?page=survey&amp;ui=v2"/);
assert.match(home, /AI 설문 만들기/);
assert.match(home, /href="<\?= webAppUrl \?>\?page=survey&amp;ui=create"/);
assert.match(home, /\.service-grid\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
assert.match(home, /@media \(max-width:899px\)[\s\S]*?\.service-grid\s*\{\s*grid-template-columns:1fr;/);
assert.match(home, /:focus-visible/);
assert.match(home, /prefers-reduced-motion:reduce/);
assert.doesNotMatch(home, /google\.script\.run|processWebPromoRequest/);

[
  "fileUploadZone", "posterFile", "promoType", "generateButton",
  "homepage_out", "instagram_out", "poster_out",
  "handleFileSelect", "removeSelectedImage", "generateAIContents",
  "copyText", "processWebPromoRequest"
].forEach((token) => assert.ok(promo.includes(token), `홍보 화면 필수 기능 누락: ${token}`));
assert.match(promo, /href="<\?= webAppUrl \?>\?page=home"/);
assert.match(promo, /← AI 업무지원 홈/);
assert.match(surveyV2, /href="<\?= webAppUrl \?>\?page=home"/);
assert.match(surveyV2, /← AI 업무지원 홈/);
assert.match(surveyCreate, /href="<\?= webAppUrl \?>\?page=home"/);
assert.match(surveyCreate, /href="<\?= webAppUrl \?>\?page=survey&amp;ui=v2"/);

console.log("platform home/routing static tests passed");
