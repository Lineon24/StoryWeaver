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
  skills: string;
  color: string;
};

export type RelationshipHistory = {
  id: string;
  sceneNumber: number;
  change: string;
  reason: string;
};

export type CharacterRelationship = {
  id: string;
  characterAId: string;
  characterBId: string;
  past: string;
  current: string;
  history: RelationshipHistory[];
};

export type StoryEvent = {
  id: string;
  sceneNumber: number;
  title: string;
  summary: string;
  participantIds: string[];
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
  relationships: CharacterRelationship[];
  events: StoryEvent[];
  world: World;
};

export type ToolTrace = {
  name: string;
  label: string;
  detail: string;
  agent?: "writer" | "reviewer" | "system";
};

export type SceneResult = {
  engine: "langchain";
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
  storyUpdates: {
    eventSummary: string;
    relationshipChanges: Array<{
      characterA: string;
      characterB: string;
      change: string;
      reason: string;
    }>;
  };
  agentReview: {
    verdict: "approved" | "revised";
    issues: string[];
    summary: string;
  };
};

export type StoryScene = {
  id: string;
  number: number;
  brief: string;
  location: string;
  tone: string;
  dialogueLength: "standard" | "long";
  participants: string[];
  generated: boolean;
  result: SceneResult;
};

export const defaultProject: StoryProject = {
  characters: [],
  fates: [],
  relationships: [],
  events: [],
  world: {
    title: "제목 없는 이야기",
    mode: "fictional",
    era: "",
    summary: "",
    history: "",
    rules: "",
    factions: "",
  },
};
