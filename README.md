# 오션테크코리아 Astro 사이트

기존 워드프레스 사이트의 저장된 HTML 248개를 Astro 정적 경로로 빌드합니다. 원본 페이지 마크업은 `src/legacy/`, 이미지·스타일·스크립트·PDF는 `public/`에 있습니다. 섹션 첫 페이지(`/notice/`, `/notice/index.html` 등)는 `src/pages/[section]/index.astro`가, 개별 글의 `.html` 주소는 `src/pages/[...path].astro`가 생성합니다.

```sh
npm install
npm run dev
npm run build
npm run verify
npm run check
```

정적 배포에는 `dist/` 전체를 사용합니다. 게시판 목록 검색과 정렬은 저장된 페이지를 읽는 브라우저 스크립트로 동작합니다. 등록 버튼은 기존 Google Forms 링크를 유지합니다.

이 저장소에는 워드프레스 데이터베이스와 서버 기능이 없습니다. 게시글 작성·댓글·워드프레스 관리자 기능은 정적 사이트에서 제공되지 않습니다. 원본의 Elementor 마크업과 프런트엔드 스크립트는 화면을 유지하기 위해 보존했습니다. 페이지 디자인을 변경할 때는 `src/legacy/`의 해당 HTML을 수정하거나 Astro 컴포넌트로 점진적으로 옮길 수 있습니다.
# oceantech-korea
