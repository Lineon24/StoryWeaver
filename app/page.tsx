"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenText,
  Bot,
  Check,
  ChevronDown,
  CirclePlus,
  Clock3,
  Flame,
  LoaderCircle,
  Orbit,
  PenLine,
  Search,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import {
  defaultProject,
  type Character,
  type Fate,
  type SceneResult,
  type StoryProject,
} from "@/lib/story-types";

const STORAGE_KEY = "storyweaver-project-v1";
const palette = ["#d8a653", "#72a8ae", "#a98ac0", "#c46e64", "#8395c9", "#7ba383"];

const initialScene: SceneResult = {
  engine: "demo",
  title: "신뢰가 무너지는 밤",
  location: "폐쇄된 지하철역",
  stageDirection: "깨진 전등이 불규칙하게 깜빡인다. 터널 끝에서 아이의 울음소리와 닮은 금속 마찰음이 번진다.",
  lines: [
    {
      speaker: "유진",
      dialogue: "가방 내려놔.",
      emotion: "불안을 숨기며",
      action: "말보다 먼저 총구가 움직인다. 그러나 방아쇠에 놓인 손가락은 미세하게 떨린다.",
      hiddenIntent: "소연의 배신 여부를 확인하면서도 결백하기를 바란다.",
    },
    {
      speaker: "소연",
      dialogue: "내가 설명할 시간을 준다면.",
      emotion: "시선을 피하지 않고",
      action: "두 손을 천천히 들어 올린다.",
      hiddenIntent: "진실의 절반만 밝혀 유진을 위험에서 밀어내려 한다.",
    },
    {
      speaker: "유진",
      dialogue: "설명이 필요한 사람은 보통 이미 늦었지.",
      emotion: "체념을 닮은 분노",
      action: "총구가 아주 조금 아래로 내려간다.",
      hiddenIntent: "소연에게 마지막 선택권을 준다.",
    },
  ],
  continuity: {
    status: "consistent",
    warnings: [],
    notes: ["유진의 불신과 절제된 말투가 반영되었습니다.", "죽음의 필연을 직접 실현하지 않고 선택의 이미지로 암시했습니다."],
  },
  toolTrace: [
    { name: "get_character_profile", label: "캐릭터 프로필", detail: "유진과 소연의 말투·목표·트라우마를 조회했습니다." },
    { name: "search_world_lore", label: "세계관 성서", detail: "휴전 협정과 기억 조작 규칙을 검색했습니다." },
    { name: "get_inevitabilities", label: "필연의 장부", detail: "두 인물에게 연결된 필연을 확인했습니다." },
    { name: "check_continuity", label: "일관성 검사", detail: "현재 장면은 공식 설정과 충돌하지 않습니다." },
  ],
  fateSignals: [],
};

const blankCharacter: Omit<Character, "id" | "color"> = {
  name: "",
  age: "",
  gender: "",
  role: "",
  personality: "",
  backstory: "",
  trauma: "",
  strengths: "",
  weaknesses: "",
  speechStyle: "",
  goal: "",
  secret: "",
  relationships: "",
};

const blankFate = {
  characterId: "",
  type: "죽음",
  statement: "",
  condition: "",
  deadline: "",
  rigidity: "절대적" as Fate["rigidity"],
};

export default function Home() {
  const [project, setProject] = useState<StoryProject>(defaultProject);
  const [activeCharacterId, setActiveCharacterId] = useState(defaultProject.characters[0].id);
  const [participants, setParticipants] = useState(["유진", "소연"]);
  const [brief, setBrief] = useState("휴전 협정 전날, 유진이 소연의 가방에서 적국의 암호표를 발견한다.");
  const [location, setLocation] = useState("폐쇄된 지하철역");
  const [tone, setTone] = useState("긴장감 있고 절제된 분위기");
  const [scene, setScene] = useState<SceneResult>(initialScene);
  const [generating, setGenerating] = useState(false);
  const [characterDialog, setCharacterDialog] = useState(false);
  const [fateDialog, setFateDialog] = useState(false);
  const [worldDialog, setWorldDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState(false);
  const [newCharacter, setNewCharacter] = useState(blankCharacter);
  const [newFate, setNewFate] = useState(blankFate);
  const [worldDraft, setWorldDraft] = useState(defaultProject.world);
  const [hydrated, setHydrated] = useState(false);
  const projectRef = useRef(project);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as StoryProject;
        setProject(parsed);
        setWorldDraft(parsed.world);
        setActiveCharacterId(parsed.characters[0]?.id ?? "");
        setParticipants(parsed.characters.slice(0, 2).map((character) => character.name));
      }
    } catch {
      toast.error("저장된 프로젝트를 불러오지 못했습니다.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    projectRef.current = project;
  }, [project, hydrated]);

  useEffect(() => {
    type ToolDefinition = {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<Record<string, unknown>>;
    };
    const modelContext = (document as Document & {
      modelContext?: {
        registerTool: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => void | Promise<void>;
      };
    }).modelContext;
    if (!modelContext?.registerTool) return;

    const lifecycle = new AbortController();
    const register = (definition: ToolDefinition) => {
      void Promise.resolve(modelContext.registerTool(definition, { signal: lifecycle.signal })).catch(() => undefined);
    };

    register({
      name: "add_story_character",
      title: "캐릭터 추가",
      description: "현재 StoryWeaver 프로젝트에 새 캐릭터를 완성된 상태로 추가합니다.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          age: { type: "string" },
          gender: { type: "string" },
          personality: { type: "string" },
          speechStyle: { type: "string" },
          goal: { type: "string" },
          backstory: { type: "string" },
          trauma: { type: "string" },
        },
        required: ["name", "personality", "speechStyle"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        const value = input as Partial<Character>;
        if (!value.name?.trim() || !value.personality?.trim() || !value.speechStyle?.trim()) {
          throw new Error("name, personality, speechStyle are required");
        }
        const character: Character = {
          ...blankCharacter,
          ...value,
          id: crypto.randomUUID(),
          color: palette[projectRef.current.characters.length % palette.length],
        };
        setProject((current) => ({ ...current, characters: [...current.characters, character] }));
        setActiveCharacterId(character.id);
        return { id: character.id, name: character.name, status: "created" };
      },
    });

    register({
      name: "add_inevitability",
      title: "필연 추가",
      description: "이름으로 지정한 캐릭터에게 반드시 일어나야 할 운명과 성립 조건을 추가합니다.",
      inputSchema: {
        type: "object",
        properties: {
          characterName: { type: "string" },
          type: { type: "string" },
          statement: { type: "string" },
          condition: { type: "string" },
          deadline: { type: "string" },
          rigidity: { type: "string", enum: ["절대적", "변형 가능"] },
        },
        required: ["characterName", "statement"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        const value = input as {
          characterName?: string;
          type?: string;
          statement?: string;
          condition?: string;
          deadline?: string;
          rigidity?: Fate["rigidity"];
        };
        const owner = projectRef.current.characters.find((character) => character.name === value.characterName);
        if (!owner || !value.statement?.trim()) throw new Error("valid characterName and statement are required");
        const fate: Fate = {
          id: crypto.randomUUID(),
          characterId: owner.id,
          type: value.type || "기타",
          statement: value.statement,
          condition: value.condition || "",
          deadline: value.deadline || "",
          rigidity: value.rigidity || "절대적",
          progress: 0,
        };
        setProject((current) => ({ ...current, fates: [...current.fates, fate] }));
        return { id: fate.id, characterName: owner.name, statement: fate.statement, status: "created" };
      },
    });

    return () => lifecycle.abort();
  }, []);

  const activeCharacter = useMemo(
    () => project.characters.find((character) => character.id === activeCharacterId) ?? project.characters[0],
    [activeCharacterId, project.characters],
  );

  const activeFates = useMemo(
    () => project.fates.filter((fate) => participants.some((name) => project.characters.find((character) => character.id === fate.characterId)?.name === name)),
    [participants, project.characters, project.fates],
  );

  function updateCharacterField<K extends keyof typeof blankCharacter>(field: K, value: (typeof blankCharacter)[K]) {
    setNewCharacter((current) => ({ ...current, [field]: value }));
  }

  function addCharacter(event: FormEvent) {
    event.preventDefault();
    if (!newCharacter.name.trim() || !newCharacter.personality.trim() || !newCharacter.speechStyle.trim()) {
      toast.error("이름, 성격, 말투는 꼭 입력해주세요.");
      return;
    }
    const character: Character = {
      ...newCharacter,
      id: crypto.randomUUID(),
      color: palette[project.characters.length % palette.length],
    };
    setProject((current) => ({ ...current, characters: [...current.characters, character] }));
    setParticipants((current) => [...current, character.name]);
    setActiveCharacterId(character.id);
    setNewCharacter(blankCharacter);
    setCharacterDialog(false);
    toast.success(character.name + " 캐릭터가 설정집에 추가되었습니다.");
  }

  function addFate(event: FormEvent) {
    event.preventDefault();
    if (!newFate.characterId || !newFate.statement.trim()) {
      toast.error("캐릭터와 반드시 일어날 사건을 입력해주세요.");
      return;
    }
    const fate: Fate = {
      ...newFate,
      id: crypto.randomUUID(),
      progress: 0,
    };
    setProject((current) => ({ ...current, fates: [...current.fates, fate] }));
    setNewFate(blankFate);
    setFateDialog(false);
    toast.success("새로운 필연이 장부에 새겨졌습니다.");
  }

  function saveWorld(event: FormEvent) {
    event.preventDefault();
    setProject((current) => ({ ...current, world: worldDraft }));
    setWorldDialog(false);
    toast.success("세계관 성서가 갱신되었습니다.");
  }

  function toggleParticipant(name: string, checked: boolean) {
    setParticipants((current) => checked
      ? Array.from(new Set([...current, name]))
      : current.filter((participant) => participant !== name));
  }

  async function generateScene() {
    if (!brief.trim() || participants.length === 0) {
      toast.error("장면 상황과 등장인물을 선택해주세요.");
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, location, tone, participants, project }),
      });
      const data = await response.json() as SceneResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "장면을 생성하지 못했습니다.");
      setScene(data);
      if (data.fateSignals.length) {
        setProject((current) => ({
          ...current,
          fates: current.fates.map((fate) => {
            const signal = data.fateSignals.find((item) => item.fateId === fate.id);
            return signal ? { ...fate, progress: Math.min(100, fate.progress + signal.progressDelta) } : fate;
          }),
        }));
      }
      toast.success(data.engine === "langchain" ? "LangChain이 장면을 완성했습니다." : "데모 엔진이 장면을 완성했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "장면 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="story-shell min-h-screen overflow-hidden text-[#eee9df]">
      <Toaster position="top-center" theme="dark" />
      <header className="app-header">
        <div className="flex items-center gap-3">
          <div className="brand-mark"><Orbit size={20} /></div>
          <div>
            <div className="font-serif text-lg font-semibold tracking-wide">StoryWeaver</div>
            <div className="text-xs text-[#88858a]">World & Character Studio</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="project-switcher" type="button" onClick={() => setWorldDialog(true)}>
            {project.world.title} <ChevronDown size={14} />
          </button>
          <button className="mobile-icon" type="button" aria-label="캐릭터 추가" onClick={() => setCharacterDialog(true)}><Users size={17} /></button>
          <button className="mobile-icon" type="button" aria-label="필연 추가" onClick={() => setFateDialog(true)}><Flame size={17} /></button>
          <Button className="generate-button" onClick={generateScene} disabled={generating}>
            {generating ? <LoaderCircle className="animate-spin" size={15} /> : <Sparkles size={15} />}
            <span>{generating ? "직조 중" : "장면 생성"}</span>
          </Button>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="roster-panel">
          <div className="panel-eyebrow">CAST</div>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-serif text-xl">등장인물</h2>
            <button className="icon-button" aria-label="캐릭터 추가" onClick={() => setCharacterDialog(true)}><CirclePlus size={18} /></button>
          </div>

          <div className="character-list">
            {project.characters.map((character) => (
              <button
                key={character.id}
                className={"character-card " + (character.id === activeCharacterId ? "active" : "")}
                type="button"
                onClick={() => setActiveCharacterId(character.id)}
              >
                <span className="character-sigil" style={{ "--sigil": character.color } as React.CSSProperties}>
                  {character.name[0]}
                </span>
                <span className="min-w-0 text-left">
                  <span className="block font-medium">{character.name}</span>
                  <span className="block truncate text-xs text-[#77747b]">{character.role || "역할 미정"} · {character.age || "?"}세</span>
                </span>
              </button>
            ))}
          </div>

          {activeCharacter && (
            <div className="character-glimpse">
              <div className="flex items-center justify-between">
                <span>{activeCharacter.name}의 핵심</span>
                <button type="button" onClick={() => setDetailDialog(true)}>전체 설정</button>
              </div>
              <p>{activeCharacter.personality}</p>
              <small>목표 · {activeCharacter.goal || "아직 정해지지 않음"}</small>
            </div>
          )}

          <div className="mt-6 border-t border-white/8 pt-5">
            <div className="panel-eyebrow">CANON</div>
            <button className="canon-link active" type="button" onClick={() => setWorldDialog(true)}><BookOpenText size={16} /> 세계관 성서</button>
            <button className="canon-link" type="button" onClick={() => setFateDialog(true)}><Flame size={16} /> 필연의 장부 <span>{project.fates.length}</span></button>
          </div>
        </aside>

        <section className="scene-stage">
          <div className="scene-toolbar">
            <div>
              <div className="scene-kicker"><span /> SCENE LAB · {scene.location}</div>
              <h1 className="font-serif text-3xl leading-tight md:text-4xl">{scene.title}</h1>
            </div>
            <div className="engine-badge">
              <Bot size={14} />
              {scene.engine === "langchain" ? "LangChain" : "데모 엔진"}
            </div>
          </div>

          <div className="scene-input-grid">
            <label>
              <span>장소</span>
              <Input value={location} onChange={(event) => setLocation(event.target.value)} />
            </label>
            <label>
              <span>톤</span>
              <Input value={tone} onChange={(event) => setTone(event.target.value)} />
            </label>
          </div>

          <div className="participant-row" aria-label="장면 등장인물">
            {project.characters.map((character) => (
              <label key={character.id}>
                <Checkbox
                  checked={participants.includes(character.name)}
                  onCheckedChange={(checked) => toggleParticipant(character.name, checked === true)}
                />
                <span>{character.name}</span>
              </label>
            ))}
          </div>

          <article className="script-paper" aria-live="polite">
            {generating && (
              <div className="generating-veil">
                <div className="fate-spinner"><WandSparkles size={25} /></div>
                <strong>가능성의 실을 엮는 중</strong>
                <span>성격, 관계, 세계관, 필연을 대조하고 있습니다.</span>
              </div>
            )}
            <p className="stage-direction">{scene.stageDirection}</p>
            {scene.lines.map((line, index) => {
              const character = project.characters.find((item) => item.name === line.speaker);
              return (
                <div className="dialogue-line" key={line.speaker + index}>
                  <div className="speaker" style={{ color: character?.color ?? "#e1ad5c" }}>
                    {line.speaker} <span>{line.emotion}</span>
                  </div>
                  <blockquote>“{line.dialogue}”</blockquote>
                  {line.action && <p>{line.action}</p>}
                  <details>
                    <summary>숨은 의도</summary>
                    <p>{line.hiddenIntent}</p>
                  </details>
                </div>
              );
            })}
          </article>

          <div className={"continuity-strip " + (scene.continuity.status === "warning" ? "warning" : "")}>
            <div>
              {scene.continuity.status === "consistent" ? <Check size={15} /> : <Flame size={15} />}
              {scene.continuity.status === "consistent" ? "설정 일관성 통과" : "설정 충돌 주의"}
            </div>
            <p>{[...scene.continuity.warnings, ...scene.continuity.notes].join(" · ")}</p>
          </div>

          <div className="tool-trace">
            <div className="panel-eyebrow">LANGCHAIN TOOL TRACE</div>
            <div>
              {scene.toolTrace.map((item) => (
                <span key={item.name} title={item.detail}><Search size={12} /> {item.label}</span>
              ))}
            </div>
          </div>

          <div className="prompt-dock">
            <Textarea
              aria-label="장면 상황 또는 수정 요청"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="이 장면에서 반드시 일어나야 할 상황을 적어주세요."
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") generateScene();
              }}
            />
            <button type="button" aria-label="장면 생성 요청 보내기" onClick={generateScene} disabled={generating}>
              {generating ? <LoaderCircle className="animate-spin" size={17} /> : <Sparkles size={17} />}
            </button>
          </div>
        </section>

        <aside className="fate-panel">
          <div className="fate-heading">
            <div className="fate-icon"><Flame size={18} /></div>
            <div>
              <div className="panel-eyebrow mb-0">INEVITABILITY</div>
              <h2 className="font-serif text-xl">필연의 장부</h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#8d8990]">
            이야기가 반드시 도달해야 하는 운명입니다. 장면은 필연을 향해 조금씩 수렴합니다.
          </p>

          <div className="fate-list">
            {activeFates.length ? activeFates.map((fate) => {
              const owner = project.characters.find((character) => character.id === fate.characterId);
              return (
                <div className={"fate-card " + (fate.rigidity === "절대적" ? "critical" : "")} key={fate.id}>
                  <div className="fate-meta"><span>{owner?.name ?? "미지정"} · {fate.type}</span><span>{fate.deadline || "시점 미정"}</span></div>
                  <h3>{fate.statement}</h3>
                  <p>{fate.condition || "성립 조건 없음"}</p>
                  <div className="fate-progress"><span style={{ width: fate.progress + "%" }} /></div>
                  <small>수렴도 {fate.progress}% · {fate.rigidity}</small>
                </div>
              );
            }) : <div className="empty-fate">선택된 인물에게 등록된 필연이 없습니다.</div>}
          </div>

          <button className="add-fate" type="button" onClick={() => setFateDialog(true)}><CirclePlus size={16} /> 새로운 필연 추가</button>

          <div className="continuity-note">
            <div><span className="pulse-dot" /> 필연 감시</div>
            <p>{scene.fateSignals[0]?.reason || "현재 장면이 등록된 필연을 너무 일찍 소모하지 않는지 감시합니다."}</p>
          </div>
        </aside>
      </div>

      <Dialog open={characterDialog} onOpenChange={setCharacterDialog}>
        <DialogContent className="editor-dialog max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>새 캐릭터 추가</DialogTitle>
            <DialogDescription>대사에 영향을 줄 핵심 설정을 입력합니다. 비어 있는 항목은 AI가 임의로 단정하지 않습니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addCharacter}>
            <div className="form-grid">
              <Field label="이름 *"><Input value={newCharacter.name} onChange={(e) => updateCharacterField("name", e.target.value)} /></Field>
              <Field label="역할"><Input value={newCharacter.role} onChange={(e) => updateCharacterField("role", e.target.value)} placeholder="예: 전쟁 기자" /></Field>
              <Field label="나이"><Input value={newCharacter.age} onChange={(e) => updateCharacterField("age", e.target.value)} /></Field>
              <Field label="성별"><Input value={newCharacter.gender} onChange={(e) => updateCharacterField("gender", e.target.value)} /></Field>
              <Field label="성격 *" wide><Textarea value={newCharacter.personality} onChange={(e) => updateCharacterField("personality", e.target.value)} /></Field>
              <Field label="말투 *" wide><Textarea value={newCharacter.speechStyle} onChange={(e) => updateCharacterField("speechStyle", e.target.value)} /></Field>
              <Field label="과거사" wide><Textarea value={newCharacter.backstory} onChange={(e) => updateCharacterField("backstory", e.target.value)} /></Field>
              <Field label="트라우마"><Textarea value={newCharacter.trauma} onChange={(e) => updateCharacterField("trauma", e.target.value)} /></Field>
              <Field label="목표"><Textarea value={newCharacter.goal} onChange={(e) => updateCharacterField("goal", e.target.value)} /></Field>
              <Field label="장점"><Input value={newCharacter.strengths} onChange={(e) => updateCharacterField("strengths", e.target.value)} /></Field>
              <Field label="단점"><Input value={newCharacter.weaknesses} onChange={(e) => updateCharacterField("weaknesses", e.target.value)} /></Field>
              <Field label="숨겨진 비밀" wide><Textarea value={newCharacter.secret} onChange={(e) => updateCharacterField("secret", e.target.value)} /></Field>
              <Field label="다른 인물과의 관계" wide><Textarea value={newCharacter.relationships} onChange={(e) => updateCharacterField("relationships", e.target.value)} /></Field>
            </div>
            <DialogFooter className="mt-5">
              <Button type="button" variant="ghost" onClick={() => setCharacterDialog(false)}>취소</Button>
              <Button type="submit">캐릭터 추가</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={fateDialog} onOpenChange={setFateDialog}>
        <DialogContent className="editor-dialog sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>필연 새기기</DialogTitle>
            <DialogDescription>언젠가 반드시 성립해야 할 사건과 그 조건을 정의합니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addFate} className="space-y-4">
            <Field label="운명의 주인 *">
              <Select value={newFate.characterId} onValueChange={(value) => setNewFate((current) => ({ ...current, characterId: value }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="캐릭터 선택" /></SelectTrigger>
                <SelectContent>{project.characters.map((character) => <SelectItem key={character.id} value={character.id}>{character.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="필연 유형">
                <Select value={newFate.type} onValueChange={(value) => setNewFate((current) => ({ ...current, type: value }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{["죽음", "도달", "만남", "이별", "배신", "폭로", "각성"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="강제력">
                <Select value={newFate.rigidity} onValueChange={(value: Fate["rigidity"]) => setNewFate((current) => ({ ...current, rigidity: value }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="절대적">절대적</SelectItem><SelectItem value="변형 가능">변형 가능</SelectItem></SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="반드시 일어날 사건 *"><Textarea value={newFate.statement} onChange={(e) => setNewFate((current) => ({ ...current, statement: e.target.value }))} placeholder="예: 반드시 북부 국경에서 죽는다." /></Field>
            <Field label="성립 조건"><Textarea value={newFate.condition} onChange={(e) => setNewFate((current) => ({ ...current, condition: e.target.value }))} placeholder="예: 자신의 선택으로 동료를 살린 뒤에만 성립한다." /></Field>
            <Field label="기한"><Input value={newFate.deadline} onChange={(e) => setNewFate((current) => ({ ...current, deadline: e.target.value }))} placeholder="예: 종막, 3막 이전" /></Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setFateDialog(false)}>취소</Button>
              <Button type="submit">필연 저장</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={worldDialog} onOpenChange={(open) => { setWorldDialog(open); if (open) setWorldDraft(project.world); }}>
        <DialogContent className="editor-dialog max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>세계관 성서</DialogTitle>
            <DialogDescription>모든 장면이 따라야 할 작품의 공식 설정입니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveWorld} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="작품명"><Input value={worldDraft.title} onChange={(e) => setWorldDraft((current) => ({ ...current, title: e.target.value }))} /></Field>
              <Field label="배경 유형">
                <Select value={worldDraft.mode} onValueChange={(value: StoryProject["world"]["mode"]) => setWorldDraft((current) => ({ ...current, mode: value }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="fictional">가상 세계</SelectItem><SelectItem value="historical">실제 역사 기반</SelectItem></SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="시대와 기술"><Input value={worldDraft.era} onChange={(e) => setWorldDraft((current) => ({ ...current, era: e.target.value }))} /></Field>
            <Field label="세계 요약"><Textarea value={worldDraft.summary} onChange={(e) => setWorldDraft((current) => ({ ...current, summary: e.target.value }))} /></Field>
            <Field label="가상 역사"><Textarea value={worldDraft.history} onChange={(e) => setWorldDraft((current) => ({ ...current, history: e.target.value }))} /></Field>
            <Field label="세계의 규칙과 금기"><Textarea value={worldDraft.rules} onChange={(e) => setWorldDraft((current) => ({ ...current, rules: e.target.value }))} /></Field>
            <Field label="국가와 세력"><Textarea value={worldDraft.factions} onChange={(e) => setWorldDraft((current) => ({ ...current, factions: e.target.value }))} /></Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setWorldDialog(false)}>취소</Button>
              <Button type="submit">세계관 저장</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className="editor-dialog sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeCharacter?.name}의 캐릭터 카드</DialogTitle>
            <DialogDescription>{activeCharacter?.role} · {activeCharacter?.age}세 · {activeCharacter?.gender}</DialogDescription>
          </DialogHeader>
          {activeCharacter && (
            <div className="detail-grid">
              <Detail label="성격" value={activeCharacter.personality} />
              <Detail label="말투" value={activeCharacter.speechStyle} />
              <Detail label="과거사" value={activeCharacter.backstory} />
              <Detail label="트라우마" value={activeCharacter.trauma} />
              <Detail label="장점" value={activeCharacter.strengths} />
              <Detail label="단점" value={activeCharacter.weaknesses} />
              <Detail label="현재 목표" value={activeCharacter.goal} />
              <Detail label="숨겨진 비밀" value={activeCharacter.secret} />
              <Detail label="관계" value={activeCharacter.relationships} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={wide ? "field-wide" : ""}><Label className="mb-2 block">{label}</Label>{children}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><p>{value || "설정되지 않음"}</p></div>;
}
