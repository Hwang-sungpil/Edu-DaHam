# 교육다함 v66 전체 배포 프로젝트 (보완본)

이 배포본은 v66의 중앙 로그인 UI 및 도서관 배경 이미지에 v64의 Vercel API, legacy 및 vercel.json을 결합한 전체 프로젝트입니다.

## 배포
- ZIP을 압축 해제하고 **내부 파일 및 폴더 전체**를 GitHub 저장소 루트에 업로드합니다.
- `api/`, `legacy/`, `assets/`, `index.html`, `vercel.json`, `library-bg.svg`를 유지합니다.
- 기존 Vercel 환경변수 `NOTION_TOKEN`, `NOTION_DATABASE_ID`, `ADMIN_ACCESS_TOKEN`을 유지합니다.
- 배포 후 로그인, 계정설정, Notion 읽기/쓰기, 교육이수 기능을 실서비스에서 확인합니다.

주의: 이 보완본은 기존 API 파일을 복원한 것이며 실제 Vercel/Notion 연동을 실시간 검증한 것은 아닙니다.
