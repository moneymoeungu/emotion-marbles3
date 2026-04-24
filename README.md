# 🫙 Emotion Marbles

일상의 감정을 영롱한 구슬에 담아 유리병에 수집하는 감성 기록 서비스

## 로컬 실행

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Vercel 배포

### 방법 1: GitHub 연동 (권장)

1. GitHub에 이 프로젝트 push
2. https://vercel.com 로그인
3. "New Project" → GitHub 저장소 선택
4. 그대로 "Deploy" 클릭 (설정 변경 불필요)
5. 자동으로 `https://emotion-marbles-xxx.vercel.app` 생성

### 방법 2: CLI 직접 배포

```bash
npm install -g vercel
vercel login
vercel --prod
```

## 기능

- 8가지 감정 구슬 기록 (행복/설렘/평온/즐거움/슬픔/분노/불안/무기력)
- 날짜 직접 선택 기록
- 기록 탭에서 병 미리보기 실시간 확인
- 20개 수집 시 보관함 자동 이동
- URL 인코딩 방식 공유 링크 생성 (서버 불필요)
- 모바일 네이티브 공유 지원 (iOS/Android)
- localStorage 기반 데이터 저장
