# StoryWeaver

캐릭터, 관계, 세계관, 필연을 조회하는 LangChain 도구를 이용해 설정에 일관된 장면을 생성하는 창작 워크스페이스입니다.

## 핵심 기능

- 캐릭터 프로필을 계속 추가하고 브라우저에 저장
- 세계관의 시대, 역사, 규칙, 세력 관리
- 죽음·도달·만남·이별·폭로와 같은 필연 및 성립 조건 관리
- LangChain 에이전트가 캐릭터, 관계, 세계관, 필연 도구를 호출
- 실제 역사 기반 작품에서는 Wikipedia 역사 검색 도구를 선택적으로 호출
- 구조화된 대사, 행동, 감정, 숨은 의도 생성
- 설정 일관성 검사와 필연 수렴도 반영
- API 키가 없어도 발표할 수 있는 로컬 데모 엔진

## 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:5173`을 엽니다.

실제 AI 생성이 필요하면 `.env.local`의 `OPENAI_API_KEY`를 설정합니다. 키가 없으면 동일한 입출력 구조의 데모 엔진을 사용합니다.

## LangChain 도구

- `get_character_profile`
- `get_relationship_state`
- `search_world_lore`
- `get_inevitabilities`
- `search_historical_context`
- 생성 후 `check_continuity` 단계

작품 내부 설정은 외부 역사 자료보다 항상 우선하도록 프롬프트에 명시되어 있습니다.
