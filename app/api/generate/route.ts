import { ChatOpenAI } from "@langchain/openai";
import { createAgent, createMiddleware, modelRetryMiddleware, tool } from "langchain";
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
  skills: z.string().default(""),
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

const RelationshipSchema = z.object({
  id: z.string(),
  characterAId: z.string(),
  characterBId: z.string(),
  past: z.string(),
  current: z.string(),
  history: z.array(z.object({
    id: z.string(),
    sceneNumber: z.number().int().positive(),
    change: z.string(),
    reason: z.string(),
  })).default([]),
});

const StoryEventSchema = z.object({
  id: z.string(),
  sceneNumber: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  participantIds: z.array(z.string()),
});

const PreviousSceneSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  location: z.string(),
  stageDirection: z.string(),
  lines: z.array(z.object({
    speaker: z.string(),
    dialogue: z.string(),
    emotion: z.string(),
    action: z.string(),
    hiddenIntent: z.string(),
  })).max(24),
});

const RequestSchema = z.object({
  brief: z.string().min(2).max(4000),
  location: z.string().max(200).default("미정"),
  tone: z.string().max(200).default("긴장감"),
  sceneNumber: z.number().int().positive().default(1),
  dialogueLength: z.enum(["standard", "long"]).default("long"),
  previousScenes: z.array(PreviousSceneSchema).max(20).default([]),
  participants: z.array(z.string()).min(1),
  project: z.object({
    characters: z.array(CharacterSchema).max(30),
    fates: z.array(FateSchema).max(60),
    relationships: z.array(RelationshipSchema).max(200).default([]),
    events: z.array(StoryEventSchema).max(300).default([]),
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
  })).min(2).max(24),
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
  storyUpdates: z.object({
    eventSummary: z.string(),
    relationshipChanges: z.array(z.object({
      characterA: z.string(),
      characterB: z.string(),
      change: z.string(),
      reason: z.string(),
    })).max(8),
  }),
});

const ReviewSchema = z.object({
  verdict: z.enum(["approved", "revised"]),
  issues: z.array(z.string()).max(10),
  summary: z.string(),
  finalScene: SceneSchema,
});

function characterByName(project: StoryProject, names: string[]) {
  const wanted = new Set(names);
  return project.characters.filter((character) => wanted.has(character.name));
}

function fateForCharacters(project: StoryProject, characters: Character[]) {
  const ids = new Set(characters.map((character) => character.id));
  return project.fates.filter((fate) => ids.has(fate.characterId));
}

function serializeToolResult(value: unknown) {
  return JSON.stringify(value);
}

function shouldRetryModelError(error: Error) {
  const candidate = error as Error & { status?: unknown; statusCode?: unknown; code?: unknown };
  const status = Number(candidate.status ?? candidate.statusCode);
  const code = String(candidate.code ?? "").toLowerCase();
  const message = error.message.toLowerCase();

  return status === 408
    || status === 409
    || status === 429
    || status >= 500
    || ["etimedout", "econnreset", "econnrefused", "enotfound"].includes(code)
    || /timeout|timed out|network|connection|fetch failed|rate limit/.test(message);
}

function publicGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const candidate = error as { status?: unknown; statusCode?: unknown } | null;
  const status = Number(candidate?.status ?? candidate?.statusCode);

  if (error instanceof z.ZodError) {
    return { message: "입력 내용을 확인해주세요. 필수 정보가 없거나 너무 긴 항목이 있습니다.", status: 400 };
  }
  if (status === 401 || /api key|authentication|unauthorized/.test(message)) {
    return { message: "AI 연결 설정을 확인해주세요.", status: 503 };
  }
  if (status === 429 || /rate limit|too many requests/.test(message)) {
    return { message: "요청이 잠시 몰렸습니다. 잠시 후 다시 시도해주세요.", status: 503 };
  }
  if (status >= 500 || /timeout|timed out|network|connection|fetch failed/.test(message)) {
    return { message: "AI 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.", status: 503 };
  }
  if (/structured_output_invalid/.test(message)) {
    return { message: "대본 형식을 완성하지 못했습니다. 다시 생성해주세요.", status: 502 };
  }
  return { message: "장면 생성에 실패했습니다. 잠시 후 다시 시도해주세요.", status: 500 };
}

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const trace: ToolTrace[] = [];
    let activeAgent: NonNullable<ToolTrace["agent"]> = "writer";
    const addTrace = (entry: Omit<ToolTrace, "agent">) => trace.push({ ...entry, agent: activeAgent });
    const createExecutionTrackingMiddleware = (
      name: string,
      label: string,
    ) => {
      let startedAt = 0;
      let modelCallCount = 0;

      return createMiddleware({
        name,
        beforeAgent: () => {
          startedAt = Date.now();
          modelCallCount = 0;
        },
        wrapModelCall: async (modelRequest, handler) => {
          modelCallCount += 1;
          return handler(modelRequest);
        },
        afterAgent: () => {
          const elapsedSeconds = Math.max(0.1, (Date.now() - startedAt) / 1000).toFixed(1);
          addTrace({
            name: `${name}_complete`,
            label,
            detail: `${elapsedSeconds}초 동안 모델을 ${modelCallCount}회 호출해 정상적으로 완료했습니다.`,
          });
        },
      });
    };
    const createStabilityMiddleware = () => modelRetryMiddleware({
      maxRetries: 1,
      retryOn: shouldRetryModelError,
      backoffFactor: 2,
      initialDelayMs: 500,
      maxDelayMs: 2000,
      jitter: true,
      onFailure: "error",
    });
    const cast = characterByName(body.project, body.participants);
    const fates = fateForCharacters(body.project, cast);

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되지 않았습니다. 서버 환경 변수에 API 키를 추가해주세요." },
        { status: 503 },
      );
    }

    const getCharacterProfile = tool(
      ({ names }) => {
        const found = characterByName(body.project, names);
        addTrace({ name: "get_character_profile", label: "캐릭터 프로필", detail: `${found.map((c) => c.name).join(", ")}의 설정을 조회했습니다.` });
        return serializeToolResult(found);
      },
      {
        name: "get_character_profile",
        description: "장면에 등장하는 캐릭터의 성격, 말투, 과거사, 트라우마, 목표, 비밀과 명시된 기술·능력을 조회합니다.",
        schema: z.object({ names: z.array(z.string()) }),
      },
    );

    const getRelationshipState = tool(
      ({ names }) => {
        const found = characterByName(body.project, names);
        const ids = new Set(found.map((character) => character.id));
        const relationshipRecords = body.project.relationships.filter((relationship) => (
          ids.has(relationship.characterAId) || ids.has(relationship.characterBId)
        ));
        const eventRecords = body.project.events.filter((event) => event.participantIds.some((id) => ids.has(id)));
        const characterNotes = found.map(({ id, name, relationships, secret, goal }) => ({ id, name, relationships, secret, goal }));
        addTrace({ name: "get_relationship_state", label: "관계 기록", detail: `과거 관계와 장면별 변화 ${relationshipRecords.reduce((count, item) => count + item.history.length, 0)}건을 조회했습니다.` });
        return serializeToolResult({ characterNotes, relationshipRecords, eventRecords });
      },
      {
        name: "get_relationship_state",
        description: "등장인물 사이의 과거 관계, 현재 관계, 장면별 변화, 함께 겪은 사건과 각자의 숨겨진 의도를 조회합니다.",
        schema: z.object({ names: z.array(z.string()) }),
      },
    );

    const searchWorldLore = tool(
      ({ query }) => {
        addTrace({ name: "search_world_lore", label: "세계관 성서", detail: `“${query}”와 관련된 공식 설정을 검색했습니다.` });
        return serializeToolResult(body.project.world);
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
        addTrace({ name: "get_inevitabilities", label: "필연의 장부", detail: `장면과 연결된 필연 ${found.length}개를 확인했습니다.` });
        return serializeToolResult(found);
      },
      {
        name: "get_inevitabilities",
        description: "캐릭터가 반드시 죽거나, 도달하거나, 만나거나, 깨달아야 하는 필연과 성립 조건을 조회합니다.",
        schema: z.object({ names: z.array(z.string()) }),
      },
    );

    const getPreviousScenes = tool(
      () => {
        addTrace({
          name: "get_previous_scenes",
          label: "이전 장면 기억",
          detail: body.previousScenes.length
            ? `장면 1부터 ${body.sceneNumber - 1}까지의 사건과 대사를 불러왔습니다.`
            : "현재 장면보다 앞선 장면이 없습니다.",
        });
        return serializeToolResult(body.previousScenes);
      },
      {
        name: "get_previous_scenes",
        description: "현재 장면보다 앞서 완성된 모든 장면의 사건, 행동, 대사, 감정, 숨은 의도를 시간순으로 조회합니다.",
        schema: z.object({}),
      },
    );

    const searchHistoricalContext = tool(
      async ({ query }) => {
        addTrace({ name: "search_historical_context", label: "역사 자료 검색", detail: `“${query}”의 실제 역사적 맥락을 확인했습니다.` });
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
        if (!response.ok) {
          return serializeToolResult({ results: [], note: "외부 자료를 불러오지 못했습니다." });
        }
        const data = await response.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
        return serializeToolResult({
          results: (data.query?.search ?? []).map((item) => ({
            title: item.title,
            snippet: item.snippet.replace(/<[^>]+>/g, ""),
          })),
          note: "외부 역사 자료는 참고 정보이며 작품의 공식 설정을 변경하지 않습니다.",
        });
      },
      {
        name: "search_historical_context",
        description: "실제 역사 기반 작품일 때만 Wikipedia에서 시대와 장소의 역사적 맥락을 조회합니다. 가상 세계에는 사용하지 않습니다.",
        schema: z.object({ query: z.string() }),
      },
    );

    const tools = [
      getCharacterProfile,
      getRelationshipState,
      searchWorldLore,
      getInevitabilities,
      getPreviousScenes,
      searchHistoricalContext,
    ];

    const writerAgent = createAgent({
      model: new ChatOpenAI({
        model: process.env.STORYWEAVER_MODEL || "gpt-5.4-mini",
        temperature: 0.75,
      }),
      tools,
      middleware: [
        createStabilityMiddleware(),
        createExecutionTrackingMiddleware("writer_execution", "작가 장면 구성"),
      ],
      responseFormat: SceneSchema,
      systemPrompt: `당신은 영화·웹툰 작가를 돕는 StoryWeaver 장면 설계자입니다.
반드시 캐릭터 프로필, 관계 기록, 세계관 성서, 필연의 장부를 도구로 조회한 뒤 한국어 장면을 작성하세요.
장면 번호가 2 이상이면 반드시 이전 장면 기억 도구도 호출하세요. 앞선 모든 장면에서 벌어진 사건, 인물의 지식, 감정 변화, 부상, 소지품, 약속과 위치를 이어받고 이미 일어난 일을 모순되게 반복하지 마세요.
작품 내부 설정은 정사이며 외부 역사 정보보다 우선합니다. historical 모드일 때만 역사 검색 도구를 선택적으로 사용하세요.
	필연은 이야기가 궁극적으로 도달해야 하는 강제 조건이지만 매 장면에서 곧바로 실현하지 말고, 자연스러운 선택·반복 이미지·복선으로 조금씩 수렴시키세요.
	캐릭터가 모르는 정보를 말하게 하지 말고, 성별이나 나이만으로 성격을 추정하지 마세요. 트라우마는 자극적으로 소비하지 말고 행동과 감각에 섬세하게 반영하세요. 기술과 초능력은 프로필에 명시된 범위와 세계관 규칙 안에서만 사용하고, 입력되지 않은 능력을 임의로 발명하지 마세요.
	등록된 인물만 고유 이름을 가진 주요 화자로 사용하세요. 다만 사용자의 요청에 등장하거나 장소상 자연스러운 익명 단역·엑스트라(시민들, 경찰, 경비원, 연구원 등)는 허용합니다. 이들에게 고유 이름, 상세 과거사, 장기적 관계나 필연을 만들지 말고 relationshipChanges에 기록하지 마세요.
	대사 분량이 long이면 10~18번의 충분히 긴 대화 교환을 작성하세요. 각 대사는 상황에 따라 1~4문장까지 자연스럽게 확장하고, 행동과 감정의 변화가 장면 안에서 누적되게 하세요. standard이면 6~10번의 대화 교환을 작성하세요.
	각 대사의 숨은 의도를 분명히 하고, 설정 충돌이 있으면 continuity.warnings에 기록하세요.
		storyUpdates.eventSummary에는 이번 장면에서 실제로 일어난 핵심 사건을 한두 문장으로 요약하세요. relationshipChanges에는 이번 장면 때문에 관계가 의미 있게 달라진 두 인물만 기록하고, 단순히 함께 등장했다는 이유로 변화를 만들지 마세요. characterA와 characterB에는 등록된 캐릭터 이름을 정확히 사용하세요.`,
    });

    const writerInput = {
      messages: [{
        role: "user" as const,
        content: JSON.stringify({
          sceneBrief: body.brief,
          location: body.location,
          tone: body.tone,
          sceneNumber: body.sceneNumber,
          dialogueLength: body.dialogueLength,
          participants: body.participants,
          worldMode: body.project.world.mode,
          registeredFateIds: fates.map((fate: Fate) => fate.id),
          previousSceneCount: body.previousScenes.length,
        }),
      }],
    };
    let draftScene: z.infer<typeof SceneSchema> | undefined;
    for (let attempt = 0; attempt < 2 && !draftScene; attempt += 1) {
      const draftResult = await writerAgent.invoke(writerInput);
      const parsedDraft = SceneSchema.safeParse(draftResult.structuredResponse);
      if (parsedDraft.success) {
        draftScene = parsedDraft.data;
      } else if (attempt === 0) {
        addTrace({ name: "writer_structure_retry", label: "대본 형식 자동 복구", detail: "초안 형식이 완전하지 않아 한 번 더 생성했습니다." });
      }
    }
    if (!draftScene) throw new Error("WRITER_STRUCTURED_OUTPUT_INVALID");
    activeAgent = "reviewer";

    const reviewerAgent = createAgent({
      model: new ChatOpenAI({
        model: process.env.STORYWEAVER_REVIEW_MODEL || process.env.STORYWEAVER_MODEL || "gpt-5.4-mini",
        temperature: 0.1,
      }),
      tools,
      middleware: [
        createStabilityMiddleware(),
        createExecutionTrackingMiddleware("reviewer_execution", "설정 검수"),
      ],
      responseFormat: ReviewSchema,
      systemPrompt: `당신은 StoryWeaver의 독립적인 설정 검수 에이전트입니다.
작가 에이전트가 만든 초안을 그대로 신뢰하지 말고 캐릭터 프로필, 관계 기록, 세계관 성서, 필연의 장부를 직접 도구로 조회하세요.
장면 번호가 2 이상이면 이전 장면 기억도 반드시 직접 조회하세요. historical 모드일 때만 필요하면 역사 검색을 사용하세요.
캐릭터의 말투·성격·지식 범위·감정 변화, 등록된 스킬과 제약, 세계 규칙, 이전 사건과 위치, 필연의 조건, 대사 분량을 검사하세요.
취향 차이만으로 고치지 말고 명확한 설정 충돌이나 연속성 문제만 교정하세요.
문제가 없으면 verdict를 approved로 하고 finalScene에 초안을 유지하세요.
문제가 있으면 verdict를 revised로 하고 issues에 근거를 기록한 뒤 finalScene에서 직접 수정하세요.
관계 변화와 사건 요약도 최종 장면의 실제 내용과 일치해야 합니다. 등록되지 않은 고유명 주요 인물이나 능력을 임의로 추가하지 마세요. 단, 요청에 포함되거나 장소상 자연스러운 익명 단역·집단 엑스트라는 허용하며 이들의 관계·필연·과거사는 만들지 마세요.`,
    });

    const reviewerInput = {
      messages: [{
        role: "user" as const,
        content: JSON.stringify({
          task: "작가 에이전트의 장면 초안을 설정과 연속성에 맞게 검수하고 최종 장면을 반환하세요.",
          sceneRequest: {
            brief: body.brief,
            location: body.location,
            tone: body.tone,
            sceneNumber: body.sceneNumber,
            dialogueLength: body.dialogueLength,
            participants: body.participants,
            worldMode: body.project.world.mode,
          },
          draftScene,
        }),
      }],
    };
    let review: z.infer<typeof ReviewSchema> | undefined;
    for (let attempt = 0; attempt < 2 && !review; attempt += 1) {
      const reviewResult = await reviewerAgent.invoke(reviewerInput);
      const parsedReview = ReviewSchema.safeParse(reviewResult.structuredResponse);
      if (parsedReview.success) {
        review = parsedReview.data;
      } else if (attempt === 0) {
        addTrace({ name: "reviewer_structure_retry", label: "검수 형식 자동 복구", detail: "검수 결과 형식이 완전하지 않아 한 번 더 확인했습니다." });
      }
    }
    if (!review) throw new Error("REVIEWER_STRUCTURED_OUTPUT_INVALID");
    activeAgent = "system";
    addTrace({
      name: "orchestrate_agents",
      label: review.verdict === "approved" ? "검수 승인" : "검수 후 교정",
      detail: review.summary,
    });
    return Response.json({
      ...review.finalScene,
      engine: "langchain",
      toolTrace: trace,
      agentReview: {
        verdict: review.verdict,
        issues: review.issues,
        summary: review.summary,
      },
    } satisfies SceneResult);
  } catch (error) {
    console.error("[StoryWeaver] scene generation failed", error);
    const publicError = publicGenerationError(error);
    return Response.json({ error: publicError.message }, { status: publicError.status });
  }
}
