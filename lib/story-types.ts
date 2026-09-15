export type Character = {
  id: string;
  name: string;
  age: string;
  gender: string;
  role: string;
  personality: string;
  backstory: string;
  trauma: string;
  strengths: string;
  weaknesses: string;
  speechStyle: string;
  goal: string;
  secret: string;
  relationships: string;
  color: string;
};

export type Fate = {
  id: string;
  characterId: string;
  type: string;
  statement: string;
  condition: string;
  deadline: string;
  rigidity: "절대적" | "변형 가능";
  progress: number;
};

export type World = {
  title: string;
  mode: "fictional" | "historical";
  era: string;
  summary: string;
  history: string;
  rules: string;
  factions: string;
};

export type StoryProject = {
  characters: Character[];
  fates: Fate[];
  world: World;
};

export type ToolTrace = {
  name: string;
  label: string;
  detail: string;
};

export type SceneResult = {
  engine: "langchain" | "demo";
  title: string;
  location: string;
  stageDirection: string;
  lines: Array<{
    speaker: string;
    dialogue: string;
    emotion: string;
    action: string;
    hiddenIntent: string;
  }>;
  continuity: {
    status: "consistent" | "warning";
    warnings: string[];
    notes: string[];
  };
  toolTrace: ToolTrace[];
  fateSignals: Array<{
    fateId: string;
    progressDelta: number;
    reason: string;
  }>;
};

export const defaultProject: StoryProject = {
  characters: [
    {
      id: "char-yujin",
      name: "유진",
      age: "29",
      gender: "남성",
      role: "정보 장교",
      personality: "냉정하고 신중하며 타인을 쉽게 믿지 않는다.",
      backstory: "전쟁 중 가족을 잃고 군 정보부에 들어갔다.",
      trauma: "폭발음과 어린아이의 울음소리에 민감하다.",
      strengths: "상황 판단, 협상, 정보 수집",
      weaknesses: "과도한 불신, 죄책감",
      speechStyle: "짧고 건조하게 말하며 감정을 직접 표현하지 않는다.",
      goal: "전쟁을 일으킨 조직의 진실을 밝힌다.",
      secret: "수도 폭격 당시 잘못된 좌표를 전달한 사람이 자신이라고 믿는다.",
      relationships: "소연을 믿고 싶지만 배신을 의심한다. 카일을 혐오한다.",
      color: "#e7b45d",
    },
    {
      id: "char-soyeon",
      name: "소연",
      age: "27",
      gender: "여성",
      role: "이중 첩자",
      personality: "침착하고 관찰력이 뛰어나며 진실을 절반만 말한다.",
      backstory: "남부 제국에서 자랐지만 북부 연합의 첩보원으로 포섭됐다.",
      trauma: "밀폐된 공간에서 과거 심문을 떠올린다.",
      strengths: "위장, 기억력, 임기응변",
      weaknesses: "혼자 모든 책임을 지려는 습관",
      speechStyle: "상대의 질문을 되묻고, 중요한 말 앞에서 잠시 침묵한다.",
      goal: "전쟁을 끝낼 증거를 잿빛 기록보관소에서 찾는다.",
      secret: "유진의 가족이 살아 있을 가능성을 알고 있다.",
      relationships: "유진을 지키려 하지만 자신의 임무를 우선한다.",
      color: "#7aa7ad",
    },
    {
      id: "char-kyle",
      name: "카일",
      age: "46",
      gender: "남성",
      role: "북부 연합 대사",
      personality: "오만하고 예의 바르며 상대의 약점을 정확히 짚는다.",
      backstory: "휴전 협상을 설계한 정치가이자 비밀 조직의 후원자다.",
      trauma: "통제력을 잃는 상황을 견디지 못한다.",
      strengths: "정치적 영향력, 설득, 장기 계획",
      weaknesses: "자신의 계산을 지나치게 신뢰한다.",
      speechStyle: "존댓말을 사용하지만 모든 문장에 위협을 숨긴다.",
      goal: "휴전을 유지해 기억 조작 기술을 독점한다.",
      secret: "수도 폭격의 실제 명령자다.",
      relationships: "유진을 유용한 죄책감의 소유자로 본다.",
      color: "#a888bf",
    },
  ],
  fates: [
    {
      id: "fate-yujin-death",
      characterId: "char-yujin",
      type: "죽음",
      statement: "반드시 북부 국경에서 죽는다.",
      condition: "자신의 선택으로 소연을 살린 뒤에만 성립한다.",
      deadline: "종막",
      rigidity: "절대적",
      progress: 34,
    },
    {
      id: "fate-soyeon-archive",
      characterId: "char-soyeon",
      type: "도달",
      statement: "잿빛 기록보관소에 반드시 도달한다.",
      condition: "진실을 확인하지만 유진에게 즉시 밝히지 않는다.",
      deadline: "3막 이전",
      rigidity: "절대적",
      progress: 61,
    },
    {
      id: "fate-kyle-reveal",
      characterId: "char-kyle",
      type: "폭로",
      statement: "수도 폭격의 진짜 명령자가 드러난다.",
      condition: "카일 자신이 아니라 다른 인물의 증언으로 밝혀진다.",
      deadline: "종막 직전",
      rigidity: "변형 가능",
      progress: 18,
    },
  ],
  world: {
    title: "잿빛 휴전선",
    mode: "fictional",
    era: "가상 냉전 시대, 1960년대 기술 수준",
    summary: "두 제국이 불안한 휴전 상태에서 첩보전을 이어가는 세계다.",
    history: "15년 전 수도 폭격으로 전쟁이 시작됐고, 3년 전 기억 조작 기술이 유출됐다.",
    rules: "기억 조작에는 대상의 개인적인 물건이 필요하다. 민간인의 기술 사용은 금지된다.",
    factions: "북부 연합, 남부 제국, 중립 정보상 조직",
  },
};
