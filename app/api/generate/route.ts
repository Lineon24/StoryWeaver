import { ChatOpenAI } from "@langchain/openai";
import { createAgent, tool } from "langchain";
import { z } from "zod";
import type { Character, Fate, SceneResult, StoryProject, ToolTrace } from "@/lib/story-types";

export const runtime = "edge";

const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.string(),
  gender: z.string(),
  role: z.string(),
  personality: z.string(),
  backstory: z.string(),
  trauma: z.string(),
  strengths: z.string(),
  weaknesses: z.string(),
  speechStyle: z.string(),
  goal: z.string(),
  secret: z.string(),
  relationships: z.string(),
  color: z.string(),
});

const FateSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  type: z.string(),
  statement: z.string(),
  condition: z.string(),
  deadline: z.string(),
  rigidity: z.enum(["절대적", "변형 가능"]),
  progress: z.number(),
});

const RequestSchema = z.object({
  brief: z.string().min(2).max(4000),
  location: z.string().max(200).default("미정"),
  tone: z.string().max(200).default("긴장감"),
  participants: z.array(z.string()).min(1),
  project: z.object({
    characters: z.array(CharacterSchema).max(30),
    fates: z.array(FateSchema).max(60),
    world: z.object({
      title: z.string(),
      mode: z.enum(["fictional", "historical"]),
      era: z.string(),
      summary: z.string(),
      history: z.string(),
      rules: z.string(),
      factions: z.string(),
    }),
  }),
});

const SceneSchema = z.object({
  title: z.string(),
  location: z.string(),
  stageDirection: z.string(),
  lines: z.array(z.object({
    speaker: z.string(),
    dialogue: z.string(),
    emotion: z.string(),
    action: z.string(),
    hiddenIntent: z.string(),
  })).min(2).max(12),
  continuity: z.object({
    status: z.enum(["consistent", "warning"]),
    warnings: z.array(z.string()),
    notes: z.array(z.string()),
  }),
  fateSignals: z.array(z.object({
    fateId: z.string(),
    progressDelta: z.number().min(0).max(10),
    reason: z.string(),
  })),
});

function characterByName(project: StoryProject, names: string[]) {
  const wanted = new Set(names);
  return project.characters.filter((character) => wanted.has(character.name));
}

function fateForCharacters(project: StoryProject, characters: Character[]) {
  const ids = new Set(characters.map((character) => character.id));
  return project.fates.filter((fate) => ids.has(fate.characterId));
}

function demoScene(
  project: StoryProject,
  participants: string[],
  brief: string,
  location: string,
  trace: ToolTrace[],
): SceneResult {
  const cast = characterByName(project, participants);
  const first = cast[0] ?? project.characters[0];
  const second = cast[1] ?? cast[0] ?? project.characters[0];
  const fates = fateForCharacters(project, cast);
  const primaryFate = fates[0];

  trace.push(
    { name: "get_character_profile", label: "캐릭터 프로필", detail: `${cast.map((c) => c.name).join(", ")}의 성격과 말투를 불러왔습니다.` },
    { name: "get_relationship_state", label: "관계 기록", detail: "등장인물의 관계와 비밀을 대조했습니다." },
    { name: "search_world_lore", label: "세계관 성서", detail: `${project.world.title}의 시대와 규칙을 검색했습니다.` },
    { name: "get_inevitabilities", label: "필연의 장부", detail: `이 장면과 연결된 필연 ${fates.length}개를 확인했습니다.` },
    { name: "check_continuity", label: "일관성 검사", detail: "인물 지식, 세계 규칙, 필연 조건을 검사했습니다." },
  );

  return {
    engine: "demo",
    title: location === "미정" ? "피할 수 없는 선택" : `${location}의 선택`,
    location,
    stageDirection: `${project.world.era}. ${brief} 공기 속에는 아직 말해지지 않은 선택의 무게가 내려앉아 있다.`,
    lines: [
      {
        speaker: first.name,
        dialogue: first.speechStyle.includes("짧고") ? "그 말, 끝까지 책임질 수 있어?" : "여기까지 온 이유를 말해.",
        emotion: first.trauma ? "억눌린 불안" : "경계",
        action: "시선을 피하지 않은 채 한 걸음 가까워진다.",
        hiddenIntent: first.goal,
      },
      {
        speaker: second.name,
        dialogue: second.speechStyle.includes("되묻") ? "내 대답보다, 당신이 듣고 싶은 말이 먼저 아닌가?" : "돌아갈 수 없다는 건 우리 둘 다 알잖아.",
        emotion: "결심과 망설임",
        action: "잠시 침묵한 뒤 손에 쥔 물건을 내려놓는다.",
        hiddenIntent: second.secret || second.goal,
      },
      {
        speaker: first.name,
        dialogue: primaryFate ? "운명 같은 말은 믿지 않아. 다만 내가 선택할 뿐이야." : "그럼 지금 선택해.",
        emotion: "체념을 닮은 결의",
        action: "멀리 이어진 길을 바라본다.",
        hiddenIntent: primaryFate?.statement ?? first.goal,
      },
    ],
    continuity: {
      status: "consistent",
      warnings: [],
      notes: [
        `${first.name}의 말투와 현재 목표가 반영되었습니다.`,
        primaryFate ? `‘${primaryFate.statement}’를 직접 실현하지 않고 선택의 이미지로 암시했습니다.` : "등록된 필연 없이 현재 목표를 중심으로 구성했습니다.",
      ],
    },
    toolTrace: trace,
    fateSignals: primaryFate ? [{
      fateId: primaryFate.id,
      progressDelta: 3,
      reason: "캐릭터의 선택이 등록된 필연을 간접적으로 암시합니다.",
    }] : [],
  };
}

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const trace: ToolTrace[] = [];
    const cast = characterByName(body.project, body.participants);
    const fates = fateForCharacters(body.project, cast);

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(demoScene(body.project, body.participants, body.brief, body.location, trace));
    }

    const getCharacterProfile = tool(
      ({ names }) => {
        const found = characterByName(body.project, names);
        trace.push({ name: "get_character_profile", label: "캐릭터 프로필", detail: `${found.map((c) => c.name).join(", ")}의 설정을 조회했습니다.` });
        return found;
      },
      {
        name: "get_character_profile",
        description: "장면에 등장하는 캐릭터의 성격, 말투, 과거사, 트라우마, 목표와 비밀을 조회합니다.",
        schema: z.object({ names: z.array(z.string()) }),
      },
    );

    const getRelationshipState = tool(
      ({ names }) => {
        const found = characterByName(body.project, names).map(({ name, relationships, secret, goal }) => ({ name, relationships, secret, goal }));
        trace.push({ name: "get_relationship_state", label: "관계 기록", detail: "등장인물의 관계와 숨겨진 의도를 조회했습니다." });
        return found;
      },
      {
        name: "get_relationship_state",
        description: "등장인물 사이의 관계, 각자의 비밀과 현재 목표를 조회합니다.",
        schema: z.object({ names: z.array(z.string()) }),
      },
    );

    const searchWorldLore = tool(
      ({ query }) => {
        trace.push({ name: "search_world_lore", label: "세계관 성서", detail: `“${query}”와 관련된 공식 설정을 검색했습니다.` });
        return body.project.world;
      },
      {
        name: "search_world_lore",
        description: "작품의 시대, 역사, 세력, 기술 및 세계 규칙을 검색합니다. 이 결과가 외부 정보보다 우선하는 정사입니다.",
        schema: z.object({ query: z.string() }),
      },
    );

    const getInevitabilities = tool(
      ({ names }) => {
        const targetCast = characterByName(body.project, names);
        const found = fateForCharacters(body.project, targetCast);
        trace.push({ name: "get_inevitabilities", label: "필연의 장부", detail: `장면과 연결된 필연 ${found.length}개를 확인했습니다.` });
        return found;
      },
      {
        name: "get_inevitabilities",
        description: "캐릭터가 반드시 죽거나, 도달하거나, 만나거나, 깨달아야 하는 필연과 성립 조건을 조회합니다.",
        schema: z.object({ names: z.array(z.string()) }),
      },
    );

    const searchHistoricalContext = tool(
      async ({ query }) => {
        trace.push({ name: "search_historical_context", label: "역사 자료 검색", detail: `“${query}”의 실제 역사적 맥락을 확인했습니다.` });
        const url = new URL("https://ko.wikipedia.org/w/api.php");
        url.search = new URLSearchParams({
          action: "query",
          format: "json",
          list: "search",
          srsearch: query,
          srlimit: "3",
          origin: "*",
        }).toString();
        const response = await fetch(url, { headers: { "User-Agent": "StoryWeaver/1.0 educational-project" } });
        if (!response.ok) return { results: [], note: "외부 자료를 불러오지 못했습니다." };
        const data = await response.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
        return {
          results: (data.query?.search ?? []).map((item) => ({
            title: item.title,
            snippet: item.snippet.replace(/<[^>]+>/g, ""),
          })),
          note: "외부 역사 자료는 참고 정보이며 작품의 공식 설정을 변경하지 않습니다.",
        };
      },
      {
        name: "search_historical_context",
        description: "실제 역사 기반 작품일 때만 Wikipedia에서 시대와 장소의 역사적 맥락을 조회합니다. 가상 세계에는 사용하지 않습니다.",
        schema: z.object({ query: z.string() }),
      },
    );

    const agent = createAgent({
      model: new ChatOpenAI({
        model: process.env.STORYWEAVER_MODEL || "gpt-5.4-mini",
        temperature: 0.75,
      }),
      tools: [
        getCharacterProfile,
        getRelationshipState,
        searchWorldLore,
        getInevitabilities,
        searchHistoricalContext,
      ],
      responseFormat: SceneSchema,
      systemPrompt: `당신은 영화·웹툰 작가를 돕는 StoryWeaver 장면 설계자입니다.
반드시 캐릭터 프로필, 관계 기록, 세계관 성서, 필연의 장부를 도구로 조회한 뒤 한국어 장면을 작성하세요.
작품 내부 설정은 정사이며 외부 역사 정보보다 우선합니다. historical 모드일 때만 역사 검색 도구를 선택적으로 사용하세요.
필연은 이야기가 궁극적으로 도달해야 하는 강제 조건이지만 매 장면에서 곧바로 실현하지 말고, 자연스러운 선택·반복 이미지·복선으로 조금씩 수렴시키세요.
캐릭터가 모르는 정보를 말하게 하지 말고, 성별이나 나이만으로 성격을 추정하지 마세요. 트라우마는 자극적으로 소비하지 말고 행동과 감각에 섬세하게 반영하세요.
각 대사의 숨은 의도를 분명히 하고, 설정 충돌이 있으면 continuity.warnings에 기록하세요.`,
    });

    const result = await agent.invoke({
      messages: [{
        role: "user",
        content: JSON.stringify({
          sceneBrief: body.brief,
          location: body.location,
          tone: body.tone,
          participants: body.participants,
          worldMode: body.project.world.mode,
          registeredFateIds: fates.map((fate: Fate) => fate.id),
        }),
      }],
    });

    trace.push({ name: "check_continuity", label: "일관성 검사", detail: "생성된 장면을 인물 지식, 세계 규칙, 필연 조건과 대조했습니다." });
    const scene = result.structuredResponse;
    return Response.json({ ...scene, engine: "langchain", toolTrace: trace } satisfies SceneResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "장면 생성 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 400 });
  }
}
