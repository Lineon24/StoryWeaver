"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenText,
  Check,
  ChevronDown,
  CirclePlus,
  Clock3,
  Copy,
  FileText,
  Flame,
  GitFork,
  LoaderCircle,
  Orbit,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  PenLine,
  Sparkles,
  Trash2,
  Users,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  defaultProject,
  type Character,
  type Fate,
  type SceneResult,
  type StoryProject,
  type StoryScene,
} from "@/lib/story-types";
import { spiderManCharacters } from "@/lib/spider-man-preset";

const STORAGE_KEY = "storyweaver-project-v2";
const SCENE_STORAGE_KEY = "storyweaver-scenes-v2";
const EMPTY_START_MIGRATION_KEY = "storyweaver-empty-start-v2";
const palette = ["#8f530a", "#176b74", "#704191", "#9b3f36", "#365ba3", "#37754d"];

type StoredStoryScene = Omit<StoryScene, "result"> & {
  result: Omit<SceneResult, "engine"> & { engine: string };
};

function createBlankSceneResult(number: number, instruction: string): SceneResult {
  return {
    engine: "langchain",
    title: `장면 ${number}`,
    location: "미정",
    stageDirection: instruction,
    lines: [],
    continuity: { status: "consistent", warnings: [], notes: [] },
    toolTrace: [],
    fateSignals: [],
    storyUpdates: { eventSummary: "", relationshipChanges: [] },
    agentReview: { verdict: "approved", issues: [], summary: "아직 검수되지 않았습니다." },
  };
}

const initialStoryScene: StoryScene = {
  id: "scene-1",
  number: 1,
  brief: "",
  location: "미정",
  tone: "긴장감 있고 절제된 분위기",
  dialogueLength: "long",
  participants: [],
  generated: false,
  result: createBlankSceneResult(1, "첫 장면에서 일어날 상황을 아래 입력창에 적고 장면을 생성하세요."),
};

const initialSecondScene: StoryScene = {
  id: "scene-2",
  number: 2,
  brief: "",
  location: "미정",
  tone: "앞선 장면의 감정을 이어가는 분위기",
  dialogueLength: "long",
  participants: [],
  generated: false,
  result: createBlankSceneResult(2, "장면 1에서 이어질 상황을 아래 입력창에 적고 장면을 생성하세요."),
};

function createEmptyScene(number: number, participants: string[]): StoryScene {
  return {
    id: crypto.randomUUID(),
    number,
    brief: "",
    location: "미정",
    tone: "앞선 장면의 감정을 이어가는 분위기",
    dialogueLength: "long",
    participants,
    generated: false,
    result: createBlankSceneResult(number, "이 장면에서 일어날 상황을 아래 입력창에 적고 장면을 생성하세요."),
  };
}

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
  skills: "",
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
  const [activeCharacterId, setActiveCharacterId] = useState(defaultProject.characters[0]?.id ?? "");
  const [scenes, setScenes] = useState<StoryScene[]>([initialStoryScene, initialSecondScene]);
  const [activeSceneId, setActiveSceneId] = useState(initialStoryScene.id);
  const [generating, setGenerating] = useState(false);
  const [characterDialog, setCharacterDialog] = useState(false);
  const [fateDialog, setFateDialog] = useState(false);
  const [worldDialog, setWorldDialog] = useState(false);
  const [relationshipDialog, setRelationshipDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState(false);
  const [finalScriptDialog, setFinalScriptDialog] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);
  const [fateToDelete, setFateToDelete] = useState<Fate | null>(null);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editingFateId, setEditingFateId] = useState<string | null>(null);
  const [newCharacter, setNewCharacter] = useState(blankCharacter);
  const [newFate, setNewFate] = useState(blankFate);
  const [worldDraft, setWorldDraft] = useState(defaultProject.world);
  const [hydrated, setHydrated] = useState(false);
  const projectRef = useRef(project);

  const activeScene = useMemo(
    () => scenes.find((item) => item.id === activeSceneId) ?? scenes[0] ?? initialStoryScene,
    [activeSceneId, scenes],
  );
  const scene = activeScene.result;
  const participants = activeScene.participants;
  const generatedScenes = useMemo(
    () => scenes.filter((item) => item.generated).sort((a, b) => a.number - b.number),
    [scenes],
  );
  const previousGeneratedScenes = useMemo(
    () => scenes
      .filter((item) => item.generated && item.number < activeScene.number)
      .sort((a, b) => a.number - b.number),
    [activeScene.number, scenes],
  );
  const finalScriptText = useMemo(() => {
    const body = generatedScenes.map((item) => {
      const lines = item.result.lines.flatMap((line) => [
        `${line.speaker} (${line.emotion})`,
        line.dialogue,
        line.action ? `[${line.action}]` : "",
      ].filter(Boolean));
      return [
        `장면 ${item.number}. ${item.result.title}`,
        `장소: ${item.result.location}`,
        "",
        `[${item.result.stageDirection}]`,
        "",
        ...lines,
      ].join("\n");
    }).join("\n\n────────────────────────\n\n");
    return `${project.world.title}\n최종 대본\n\n${body}`;
  }, [generatedScenes, project.world.title]);

  useEffect(() => {
    try {
      const shouldStartEmpty = window.localStorage.getItem(EMPTY_START_MIGRATION_KEY) !== "done";
      if (shouldStartEmpty) {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(SCENE_STORAGE_KEY);
        window.localStorage.setItem(EMPTY_START_MIGRATION_KEY, "done");
        setProject(defaultProject);
        setWorldDraft(defaultProject.world);
        setActiveCharacterId("");
        setScenes([initialStoryScene, initialSecondScene]);
        setActiveSceneId(initialStoryScene.id);
        return;
      }
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<StoryProject>;
        const restoredProject: StoryProject = {
          ...defaultProject,
          ...parsed,
          characters: (parsed.characters ?? defaultProject.characters).map((character) => ({
            ...character,
            skills: character.skills ?? "",
          })),
          fates: parsed.fates ?? defaultProject.fates,
          relationships: parsed.relationships ?? defaultProject.relationships,
          events: parsed.events ?? [],
          world: parsed.world ?? defaultProject.world,
        };
        setProject(restoredProject);
        setWorldDraft(restoredProject.world);
        setActiveCharacterId(restoredProject.characters[0]?.id ?? "");
      }
      const savedScenes = window.localStorage.getItem(SCENE_STORAGE_KEY);
      if (savedScenes) {
        const storedScenes = JSON.parse(savedScenes) as StoredStoryScene[];
        const parsedScenes: StoryScene[] = storedScenes.map((item) => (
          item.result.engine !== "langchain"
            ? {
                ...item,
                generated: false,
                result: createBlankSceneResult(item.number, `장면 ${item.number}의 상황을 입력하고 새로 생성하세요.`),
              }
            : {
                ...item,
                result: {
                  ...item.result,
                  engine: "langchain",
                  storyUpdates: item.result.storyUpdates ?? { eventSummary: "", relationshipChanges: [] },
                  agentReview: item.result.agentReview ?? { verdict: "approved", issues: [], summary: "이전 버전에서 생성된 장면입니다." },
                },
              }
        ));
        if (parsedScenes.length) {
          const restoredScenes = parsedScenes.length === 1
            ? [...parsedScenes, { ...initialSecondScene, participants: parsedScenes[0].participants }]
            : parsedScenes;
          setScenes(restoredScenes);
          setActiveSceneId(restoredScenes[0].id);
        }
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
    if (hydrated) window.localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(scenes));
  }, [scenes, hydrated]);

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
          skills: { type: "string" },
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
    () => project.fates.filter((fate) => fate.characterId === activeCharacter?.id),
    [activeCharacter?.id, project.fates],
  );

  function updateActiveScene(patch: Partial<StoryScene>) {
    setScenes((current) => current.map((item) => (
      item.id === activeScene.id ? { ...item, ...patch } : item
    )));
  }

  function addScene() {
    const nextNumber = Math.max(...scenes.map((item) => item.number), 0) + 1;
    const nextScene = createEmptyScene(
      nextNumber,
      activeScene.participants.length
        ? activeScene.participants
        : project.characters.slice(0, 2).map((character) => character.name),
    );
    setScenes((current) => [...current, nextScene]);
    setActiveSceneId(nextScene.id);
    toast.success(`장면 ${nextNumber}이 추가되었습니다. 앞선 장면의 기억을 이어받습니다.`);
  }

  async function copyFinalScript() {
    if (!generatedScenes.length) {
      toast.error("먼저 장면을 하나 이상 생성해주세요.");
      return;
    }
    try {
      await navigator.clipboard.writeText(finalScriptText);
      toast.success("최종 대본을 클립보드에 복사했습니다.");
    } catch {
      toast.error("대본을 복사하지 못했습니다.");
    }
  }

  function updateCharacterField<K extends keyof typeof blankCharacter>(field: K, value: (typeof blankCharacter)[K]) {
    setNewCharacter((current) => ({ ...current, [field]: value }));
  }

  function openCharacterCreate() {
    setEditingCharacterId(null);
    setNewCharacter(blankCharacter);
    setCharacterDialog(true);
  }

  function addSpiderManCharacters() {
    const registeredNames = new Set(project.characters.map((character) => character.name.trim().toLowerCase()));
    const additions = spiderManCharacters.filter((character) => !registeredNames.has(character.name.toLowerCase()));

    if (!additions.length) {
      toast.info("스파이더맨 주요 인물이 이미 모두 등록되어 있습니다.");
      return;
    }

    setProject((current) => ({ ...current, characters: [...current.characters, ...additions] }));
    setActiveCharacterId(additions[0].id);
    toast.success(`스파이더맨 주요 인물 ${additions.length}명을 추가했습니다.`);
  }

  function openCharacterEdit(character: Character) {
    const { id: _id, color: _color, ...editableCharacter } = character;
    setEditingCharacterId(character.id);
    setNewCharacter(editableCharacter);
    setCharacterDialog(true);
  }

  function saveCharacter(event: FormEvent) {
    event.preventDefault();
    if (!newCharacter.name.trim() || !newCharacter.personality.trim() || !newCharacter.speechStyle.trim()) {
      toast.error("이름, 성격, 말투는 꼭 입력해주세요.");
      return;
    }
    const existingCharacter = editingCharacterId
      ? project.characters.find((character) => character.id === editingCharacterId)
      : undefined;

    if (existingCharacter) {
      const updatedCharacter: Character = {
        ...existingCharacter,
        ...newCharacter,
      };
      setProject((current) => ({
        ...current,
        characters: current.characters.map((character) => (
          character.id === existingCharacter.id ? updatedCharacter : character
        )),
      }));
      if (existingCharacter.name !== updatedCharacter.name) {
        setScenes((current) => current.map((item) => ({
          ...item,
          participants: item.participants.map((name) => name === existingCharacter.name ? updatedCharacter.name : name),
          result: {
            ...item.result,
            lines: item.result.lines.map((line) => (
              line.speaker === existingCharacter.name ? { ...line, speaker: updatedCharacter.name } : line
            )),
            storyUpdates: {
              ...item.result.storyUpdates,
              relationshipChanges: item.result.storyUpdates.relationshipChanges.map((change) => ({
                ...change,
                characterA: change.characterA === existingCharacter.name ? updatedCharacter.name : change.characterA,
                characterB: change.characterB === existingCharacter.name ? updatedCharacter.name : change.characterB,
              })),
            },
          },
        })));
      }
      setActiveCharacterId(updatedCharacter.id);
      toast.success(updatedCharacter.name + " 캐릭터 설정이 수정되었습니다.");
    } else {
      const character: Character = {
        ...newCharacter,
        id: crypto.randomUUID(),
        color: palette[project.characters.length % palette.length],
      };
      setProject((current) => ({ ...current, characters: [...current.characters, character] }));
      updateActiveScene({ participants: [...participants, character.name] });
      setActiveCharacterId(character.id);
      toast.success(character.name + " 캐릭터가 설정집에 추가되었습니다.");
    }
    setNewCharacter(blankCharacter);
    setEditingCharacterId(null);
    setCharacterDialog(false);
  }

  function deleteCharacter() {
    if (!characterToDelete) return;
    const target = characterToDelete;
    const relatedFateCount = project.fates.filter((fate) => fate.characterId === target.id).length;
    const remainingCharacters = project.characters.filter((character) => character.id !== target.id);

    setProject((current) => ({
      ...current,
      characters: current.characters.filter((character) => character.id !== target.id),
      fates: current.fates.filter((fate) => fate.characterId !== target.id),
      relationships: current.relationships.filter((relationship) => (
        relationship.characterAId !== target.id && relationship.characterBId !== target.id
      )),
      events: current.events.map((event) => ({
        ...event,
        participantIds: event.participantIds.filter((id) => id !== target.id),
      })),
    }));
    setScenes((current) => current.map((item) => ({
      ...item,
      participants: item.participants.filter((name) => name !== target.name),
    })));
    if (activeCharacterId === target.id) {
      setActiveCharacterId(remainingCharacters[0]?.id ?? "");
    }
    setCharacterToDelete(null);
    toast.success(`${target.name} 캐릭터${relatedFateCount ? `와 연결된 필연 ${relatedFateCount}개가` : "가"} 삭제되었습니다.`);
  }

  function openFateCreate() {
    setEditingFateId(null);
    setNewFate({ ...blankFate, characterId: activeCharacter?.id ?? project.characters[0]?.id ?? "" });
    setFateDialog(true);
  }

  function openFateEdit(fate: Fate) {
    setEditingFateId(fate.id);
    setNewFate({
      characterId: fate.characterId,
      type: fate.type,
      statement: fate.statement,
      condition: fate.condition,
      deadline: fate.deadline,
      rigidity: fate.rigidity,
    });
    setFateDialog(true);
  }

  function saveFate(event: FormEvent) {
    event.preventDefault();
    if (!newFate.characterId || !newFate.statement.trim()) {
      toast.error("캐릭터와 반드시 일어날 사건을 입력해주세요.");
      return;
    }
    const fateOwnerId = newFate.characterId;
    const existingFate = editingFateId
      ? project.fates.find((fate) => fate.id === editingFateId)
      : undefined;
    if (existingFate) {
      setProject((current) => ({
        ...current,
        fates: current.fates.map((fate) => fate.id === existingFate.id ? { ...fate, ...newFate } : fate),
      }));
      toast.success("필연 설정이 수정되었습니다.");
    } else {
      const fate: Fate = {
        ...newFate,
        id: crypto.randomUUID(),
        progress: 0,
      };
      setProject((current) => ({ ...current, fates: [...current.fates, fate] }));
      toast.success("새로운 필연이 장부에 새겨졌습니다.");
    }
    setActiveCharacterId(fateOwnerId);
    setRightSidebarOpen(true);
    setNewFate(blankFate);
    setEditingFateId(null);
    setFateDialog(false);
  }

  function deleteFate() {
    if (!fateToDelete) return;
    const target = fateToDelete;
    setProject((current) => ({
      ...current,
      fates: current.fates.filter((fate) => fate.id !== target.id),
    }));
    setScenes((current) => current.map((item) => ({
      ...item,
      result: {
        ...item.result,
        fateSignals: item.result.fateSignals.filter((signal) => signal.fateId !== target.id),
      },
    })));
    setFateToDelete(null);
    toast.success("필연이 삭제되었습니다.");
  }

  function saveWorld(event: FormEvent) {
    event.preventDefault();
    setProject((current) => ({ ...current, world: worldDraft }));
    setWorldDialog(false);
    toast.success("세계관 성서가 갱신되었습니다.");
  }

  function toggleParticipant(name: string, checked: boolean) {
    updateActiveScene({
      participants: checked
        ? Array.from(new Set([...participants, name]))
        : participants.filter((participant) => participant !== name),
    });
  }

  async function generateScene() {
    if (!activeScene.brief.trim() || participants.length === 0) {
      toast.error("장면 상황과 등장인물을 선택해주세요.");
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: activeScene.brief,
          location: activeScene.location,
          tone: activeScene.tone,
          dialogueLength: activeScene.dialogueLength,
          participants,
          project,
          sceneNumber: activeScene.number,
          previousScenes: previousGeneratedScenes
            .map((item) => ({
              number: item.number,
              title: item.result.title,
              location: item.result.location,
              stageDirection: item.result.stageDirection,
              lines: item.result.lines,
            })),
        }),
      });
      const data = await response.json() as SceneResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "장면을 생성하지 못했습니다.");
      updateActiveScene({ generated: true, result: data });
      setProject((current) => {
        const characterByName = new Map(current.characters.map((character) => [character.name, character]));
        const cleanedRelationships = current.relationships.map((relationship) => {
          const history = relationship.history.filter((entry) => entry.sceneNumber !== activeScene.number);
          return {
            ...relationship,
            history,
            current: history.length === relationship.history.length
              ? relationship.current
              : history.at(-1)?.change ?? relationship.past,
          };
        });
        const relationships = [...cleanedRelationships];

        for (const change of data.storyUpdates.relationshipChanges) {
          const characterA = characterByName.get(change.characterA);
          const characterB = characterByName.get(change.characterB);
          if (!characterA || !characterB || characterA.id === characterB.id) continue;
          const existing = relationships.find((relationship) => (
            (relationship.characterAId === characterA.id && relationship.characterBId === characterB.id)
            || (relationship.characterAId === characterB.id && relationship.characterBId === characterA.id)
          ));
          const historyEntry = {
            id: `relationship-change-${activeScene.number}-${characterA.id}-${characterB.id}`,
            sceneNumber: activeScene.number,
            change: change.change,
            reason: change.reason,
          };
          if (existing) {
            existing.current = change.change;
            existing.history = [...existing.history, historyEntry].sort((a, b) => a.sceneNumber - b.sceneNumber);
          } else {
            relationships.push({
              id: `relationship-${[characterA.id, characterB.id].sort().join("-")}`,
              characterAId: characterA.id,
              characterBId: characterB.id,
              past: [characterA.relationships, characterB.relationships].filter(Boolean).join(" / ") || "이전 관계가 설정되지 않았습니다.",
              current: change.change,
              history: [historyEntry],
            });
          }
        }

        const events = current.events.filter((event) => event.sceneNumber !== activeScene.number);
        if (data.storyUpdates.eventSummary.trim()) {
          events.push({
            id: `event-scene-${activeScene.number}`,
            sceneNumber: activeScene.number,
            title: data.title,
            summary: data.storyUpdates.eventSummary,
            participantIds: participants
              .map((name) => characterByName.get(name)?.id)
              .filter((id): id is string => Boolean(id)),
          });
        }

        return {
          ...current,
          fates: current.fates.map((fate) => {
            const signal = data.fateSignals.find((item) => item.fateId === fate.id);
            return signal ? { ...fate, progress: Math.min(100, fate.progress + signal.progressDelta) } : fate;
          }),
          relationships,
          events: events.sort((a, b) => a.sceneNumber - b.sceneNumber),
        };
      });
      toast.success("장면과 관계·사건 기록이 함께 갱신되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "장면 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="story-shell min-h-screen overflow-hidden">
      <Toaster position="top-center" theme="light" />
      <header className="app-header">
        <div className="flex items-center gap-3">
          <button
            className="sidebar-toggle"
            type="button"
            aria-label={leftSidebarOpen ? "등장인물 사이드바 닫기" : "등장인물 사이드바 열기"}
            aria-expanded={leftSidebarOpen}
            aria-controls="character-sidebar"
            onClick={() => setLeftSidebarOpen((open) => !open)}
          >
            {leftSidebarOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
          </button>
          <div className="brand-mark"><Orbit size={20} /></div>
          <div>
            <div className="font-serif text-lg font-semibold tracking-wide">StoryWeaver</div>
            <div className="brand-subtitle">World & Character Studio</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="sidebar-toggle right-sidebar-toggle"
            type="button"
            aria-label={rightSidebarOpen ? "필연 사이드바 닫기" : "필연 사이드바 열기"}
            aria-expanded={rightSidebarOpen}
            aria-controls="fate-sidebar"
            onClick={() => setRightSidebarOpen((open) => !open)}
          >
            {rightSidebarOpen ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
          </button>
          <button className="project-switcher" type="button" onClick={() => setWorldDialog(true)}>
            {project.world.title} <ChevronDown size={14} />
          </button>
          <button className="mobile-icon" type="button" aria-label="캐릭터 추가" onClick={openCharacterCreate}><Users size={17} /></button>
          <button className="mobile-icon" type="button" aria-label="필연 추가" onClick={openFateCreate}><Flame size={17} /></button>
          <Button className="generate-button" onClick={generateScene} disabled={generating}>
            {generating ? <LoaderCircle className="animate-spin" size={15} /> : <Sparkles size={15} />}
            <span>{generating ? "직조 중" : "장면 생성"}</span>
          </Button>
        </div>
      </header>

      <div className={`workspace-grid${leftSidebarOpen ? "" : " roster-closed"}${rightSidebarOpen ? "" : " fate-closed"}`}>
        <aside className="roster-panel" id="character-sidebar" aria-hidden={!leftSidebarOpen}>
          <div className="panel-eyebrow">CAST</div>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-serif text-xl">등장인물</h2>
            <button className="icon-button" aria-label="캐릭터 추가" onClick={openCharacterCreate}><CirclePlus size={18} /></button>
          </div>
          <button className="character-preset-button" type="button" onClick={addSpiderManCharacters}>
            <BookOpenText size={15} /> 스파이더맨 주요 인물 추가
          </button>

          <div className="character-list">
            {project.characters.map((character) => (
              <div className="character-row" key={character.id}>
                <button
                  className={"character-card " + (character.id === activeCharacterId ? "active" : "")}
                  type="button"
                  onClick={() => setActiveCharacterId(character.id)}
                >
                  <span className="character-sigil" style={{ "--sigil": character.color } as React.CSSProperties}>
                    {character.name[0]}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block font-medium">{character.name}</span>
                    <span className="character-meta">{character.role || "역할 미정"}</span>
                  </span>
                </button>
                <div className="character-actions">
                  <button
                    className="character-edit"
                    type="button"
                    aria-label={`${character.name} 캐릭터 수정`}
                    title={`${character.name} 수정`}
                    onClick={() => openCharacterEdit(character)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="character-delete"
                    type="button"
                    aria-label={`${character.name} 캐릭터 삭제`}
                    title={`${character.name} 삭제`}
                    onClick={() => setCharacterToDelete(character)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            {!project.characters.length && <div className="empty-character">등록된 캐릭터가 없습니다.</div>}
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

          <div className="canon-section">
            <div className="panel-eyebrow">CANON</div>
            <button className="canon-link active" type="button" onClick={() => setWorldDialog(true)}><BookOpenText size={16} /> 세계관 성서</button>
            <button className="canon-link" type="button" onClick={() => setRelationshipDialog(true)}><GitFork size={16} /> 관계와 사건 <span>{project.relationships.length + project.events.length}</span></button>
            <button className="canon-link" type="button" onClick={openFateCreate}><Flame size={16} /> 필연의 장부 <span>{project.fates.length}</span></button>
          </div>
        </aside>

        <section className="scene-stage">
          <div className="scene-navigation">
            <Tabs className="scene-tabs" value={activeScene.id} onValueChange={setActiveSceneId}>
              <TabsList variant="line" aria-label="장면 선택">
                {[...scenes].sort((a, b) => a.number - b.number).map((item) => (
                  <TabsTrigger key={item.id} value={item.id}>
                    {item.generated ? <Check size={14} /> : <PenLine size={14} />}
                    장면 {item.number}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="scene-actions">
              <button type="button" onClick={addScene}><CirclePlus size={16} /> 새 장면</button>
              <button type="button" className="final-script-button" onClick={() => setFinalScriptDialog(true)}>
                <FileText size={16} /> 최종 대본
              </button>
            </div>
          </div>

          <div className="scene-toolbar">
            <div>
              <div className="scene-kicker"><span /> SCENE {activeScene.number} · {scene.location}</div>
              <h1 className="font-serif text-3xl leading-tight md:text-4xl">{scene.title}</h1>
            </div>
            {previousGeneratedScenes.length > 0 && (
              <div className="scene-statuses">
                <div className="memory-badge"><Clock3 size={14} /> 이전 장면 {previousGeneratedScenes.length}개 기억</div>
              </div>
            )}
          </div>

          <div className="scene-input-grid">
            <label>
              <span>장소</span>
              <Input value={activeScene.location} onChange={(event) => updateActiveScene({ location: event.target.value })} />
            </label>
            <label>
              <span>톤</span>
              <Input value={activeScene.tone} onChange={(event) => updateActiveScene({ tone: event.target.value })} />
            </label>
            <label>
              <span>대사 분량</span>
              <Select
                value={activeScene.dialogueLength}
                onValueChange={(value: StoryScene["dialogueLength"]) => updateActiveScene({ dialogueLength: value })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">보통 · 6~10회</SelectItem>
                  <SelectItem value="long">길게 · 10~18회</SelectItem>
                </SelectContent>
              </Select>
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
                <strong>작가와 검수 에이전트가 협업 중</strong>
                <span>초안을 작성한 뒤 설정·관계·필연·이전 장면을 독립적으로 재검사합니다.</span>
              </div>
            )}
            <p className="stage-direction">{scene.stageDirection}</p>
            {scene.lines.map((line, index) => {
              const character = project.characters.find((item) => item.name === line.speaker);
              return (
                <div className="dialogue-line" key={line.speaker + index}>
                  <div
                    className="speaker"
                    style={{ "--speaker-color": character?.color ?? "#8f530a" } as React.CSSProperties}
                  >
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

          <div className="prompt-dock">
            <div className="prompt-dock-header">
              <div>
                <Sparkles size={16} />
                <strong>장면 요청</strong>
              </div>
              <span>{activeScene.brief.length}자</span>
            </div>
            <Textarea
              aria-label="장면 상황 또는 수정 요청"
              value={activeScene.brief}
              onChange={(event) => updateActiveScene({ brief: event.target.value })}
              placeholder="이 장면에서 반드시 일어나야 할 상황을 적어주세요."
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") generateScene();
              }}
            />
            <div className="prompt-dock-footer">
              <span>단역은 ‘뉴욕 시민들’, ‘경찰들’처럼 장면 요청에 바로 적어도 됩니다.</span>
              <div>
                <button type="button" aria-label="장면 생성 요청 보내기" onClick={generateScene} disabled={generating}>
                  {generating ? <LoaderCircle className="animate-spin" size={17} /> : <Sparkles size={17} />}
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="fate-panel" id="fate-sidebar" aria-hidden={!rightSidebarOpen}>
          <div className="fate-heading">
            <div className="fate-icon"><Flame size={18} /></div>
            <div>
              <div className="panel-eyebrow mb-0">INEVITABILITY</div>
              <h2 className="font-serif text-xl">필연의 장부</h2>
            </div>
          </div>
          <p className="fate-intro">
            이야기가 반드시 도달해야 하는 운명입니다. 장면은 필연을 향해 조금씩 수렴합니다.
          </p>

          <div className="fate-list">
            {activeFates.length ? activeFates.map((fate) => {
              const owner = project.characters.find((character) => character.id === fate.characterId);
              return (
                <div className={"fate-card " + (fate.rigidity === "절대적" ? "critical" : "")} key={fate.id}>
                  <div className="fate-card-top">
                    <div className="fate-meta"><span>{owner?.name ?? "미지정"} · {fate.type}</span><span>{fate.deadline || "시점 미정"}</span></div>
                    <div className="fate-actions">
                      <button
                        className="fate-edit"
                        type="button"
                        aria-label={`필연 수정: ${fate.statement}`}
                        title="필연 수정"
                        onClick={() => openFateEdit(fate)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="fate-delete"
                        type="button"
                        aria-label={`필연 삭제: ${fate.statement}`}
                        title="필연 삭제"
                        onClick={() => setFateToDelete(fate)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <h3>{fate.statement}</h3>
                  <p>{fate.condition || "성립 조건 없음"}</p>
                  <div className="fate-progress"><span style={{ width: fate.progress + "%" }} /></div>
                  <small>수렴도 {fate.progress}% · {fate.rigidity}</small>
                </div>
              );
            }) : <div className="empty-fate">선택된 인물에게 등록된 필연이 없습니다.</div>}
          </div>

          <button className="add-fate" type="button" onClick={openFateCreate}><CirclePlus size={16} /> 새로운 필연 추가</button>

          <div className="continuity-note">
            <div><span className="pulse-dot" /> 필연 감시</div>
            <p>{scene.fateSignals[0]?.reason || "현재 장면이 등록된 필연을 너무 일찍 소모하지 않는지 감시합니다."}</p>
          </div>
        </aside>
      </div>

      <AlertDialog open={Boolean(characterToDelete)} onOpenChange={(open) => { if (!open) setCharacterToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{characterToDelete?.name} 캐릭터를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              캐릭터 설정과 연결된 필연·관계 기록이 함께 삭제되고, 사건과 모든 장면의 등장인물 목록에서 제외됩니다.
              이미 생성된 대본의 대사는 기록으로 남습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteCharacter}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(fateToDelete)} onOpenChange={(open) => { if (!open) setFateToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 필연을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              “{fateToDelete?.statement}” 필연과 지금까지 기록된 수렴 신호가 삭제됩니다. 이미 생성된 대본 내용은 변경되지 않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteFate}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={finalScriptDialog} onOpenChange={setFinalScriptDialog}>
        <DialogContent className="editor-dialog final-script-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText size={20} /> {project.world.title} · 최종 대본</DialogTitle>
            <DialogDescription>완성된 장면 {generatedScenes.length}개를 시간순으로 합쳤습니다.</DialogDescription>
          </DialogHeader>
          <div className="final-script-content">
            {generatedScenes.length ? generatedScenes.map((item) => (
              <section className="final-scene" key={item.id}>
                <div className="final-scene-number">SCENE {item.number}</div>
                <h3>{item.result.title}</h3>
                <div className="final-location">장소 · {item.result.location}</div>
                <p className="final-direction">{item.result.stageDirection}</p>
                {item.result.lines.map((line, index) => (
                  <div className="final-dialogue" key={`${item.id}-${line.speaker}-${index}`}>
                    <strong>{line.speaker} <span>{line.emotion}</span></strong>
                    <blockquote>{line.dialogue}</blockquote>
                    {line.action && <p>{line.action}</p>}
                  </div>
                ))}
              </section>
            )) : (
              <div className="final-script-empty">장면을 생성하면 이곳에 최종 대본이 정리됩니다.</div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFinalScriptDialog(false)}>닫기</Button>
            <Button type="button" onClick={copyFinalScript} disabled={!generatedScenes.length}><Copy size={16} /> 대본 복사</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={relationshipDialog} onOpenChange={setRelationshipDialog}>
        <DialogContent className="editor-dialog relationship-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><GitFork size={20} /> 관계와 사건 기록</DialogTitle>
            <DialogDescription>처음 설정한 과거 관계와 장면을 거치며 달라진 현재 관계를 함께 확인합니다.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="relationships" className="relationship-tabs">
            <TabsList aria-label="관계와 사건 보기">
              <TabsTrigger value="relationships">인물 관계 {project.relationships.length}</TabsTrigger>
              <TabsTrigger value="events">사건 연대기 {project.events.length}</TabsTrigger>
            </TabsList>
            <TabsContent value="relationships" className="relationship-scroll">
              {project.relationships.length ? project.relationships.map((relationship) => {
                const characterA = project.characters.find((character) => character.id === relationship.characterAId);
                const characterB = project.characters.find((character) => character.id === relationship.characterBId);
                return (
                  <article className="relationship-card" key={relationship.id}>
                    <div className="relationship-pair">
                      <span style={{ "--relation-color": characterA?.color ?? "#8f530a" } as React.CSSProperties}>{characterA?.name ?? "삭제된 인물"}</span>
                      <GitFork size={16} />
                      <span style={{ "--relation-color": characterB?.color ?? "#8f530a" } as React.CSSProperties}>{characterB?.name ?? "삭제된 인물"}</span>
                    </div>
                    <div className="relationship-state-grid">
                      <div><small>과거의 관계</small><p>{relationship.past || "과거 관계가 설정되지 않았습니다."}</p></div>
                      <div><small>현재의 관계</small><p>{relationship.current || relationship.past || "현재 관계가 설정되지 않았습니다."}</p></div>
                    </div>
                    {relationship.history.length > 0 && (
                      <div className="relationship-history">
                        {[...relationship.history].sort((a, b) => a.sceneNumber - b.sceneNumber).map((entry) => (
                          <div key={entry.id}>
                            <b>장면 {entry.sceneNumber}</b>
                            <span>{entry.change}</span>
                            <p>{entry.reason}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              }) : <div className="relationship-empty">관계가 아직 없습니다. 캐릭터들이 함께 등장하는 장면을 만들면 변화가 기록됩니다.</div>}

              <section className="relationship-notes">
                <h3>캐릭터별 관계 메모</h3>
                {project.characters.map((character) => (
                  <div key={character.id}><b>{character.name}</b><p>{character.relationships || "관계 메모가 없습니다."}</p></div>
                ))}
              </section>
            </TabsContent>
            <TabsContent value="events" className="relationship-scroll">
              {project.events.length ? [...project.events].sort((a, b) => a.sceneNumber - b.sceneNumber).map((event) => (
                <article className="story-event-card" key={event.id}>
                  <div><span>SCENE {event.sceneNumber}</span><h3>{event.title}</h3></div>
                  <p>{event.summary}</p>
                  <small>
                    등장 · {event.participantIds.map((id) => project.characters.find((character) => character.id === id)?.name).filter(Boolean).join(", ") || "기록 없음"}
                  </small>
                </article>
              )) : <div className="relationship-empty">장면을 생성하면 핵심 사건이 시간순으로 쌓입니다.</div>}
            </TabsContent>
          </Tabs>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setRelationshipDialog(false)}>닫기</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={characterDialog} onOpenChange={(open) => {
        setCharacterDialog(open);
        if (!open) {
          setEditingCharacterId(null);
          setNewCharacter(blankCharacter);
        }
      }}>
        <DialogContent className="editor-dialog max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingCharacterId ? "캐릭터 설정 수정" : "새 캐릭터 추가"}</DialogTitle>
            <DialogDescription>대사에 영향을 줄 핵심 설정을 입력합니다. 비어 있는 항목은 AI가 임의로 단정하지 않습니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveCharacter}>
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
              <Field label="스킬·능력" wide>
                <Textarea
                  value={newCharacter.skills}
                  onChange={(e) => updateCharacterField("skills", e.target.value)}
                  placeholder="예: 컴퓨터 보안, 엑셀 자동화 / 염력, 순간이동(하루 1회)"
                />
              </Field>
              <Field label="숨겨진 비밀" wide><Textarea value={newCharacter.secret} onChange={(e) => updateCharacterField("secret", e.target.value)} /></Field>
              <Field label="과거·초기 관계" wide><Textarea value={newCharacter.relationships} onChange={(e) => updateCharacterField("relationships", e.target.value)} placeholder="이야기가 시작되기 전 다른 인물과의 관계를 적어주세요." /></Field>
            </div>
            <DialogFooter className="mt-5">
              <Button type="button" variant="ghost" onClick={() => setCharacterDialog(false)}>취소</Button>
              <Button type="submit">{editingCharacterId ? "수정 저장" : "캐릭터 추가"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={fateDialog} onOpenChange={(open) => {
        setFateDialog(open);
        if (!open) {
          setEditingFateId(null);
          setNewFate(blankFate);
        }
      }}>
        <DialogContent className="editor-dialog sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingFateId ? "필연 수정" : "필연 새기기"}</DialogTitle>
            <DialogDescription>언젠가 반드시 성립해야 할 사건과 그 조건을 정의합니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveFate} className="space-y-4">
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
              <Button type="submit">{editingFateId ? "수정 저장" : "필연 저장"}</Button>
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
              <Detail label="스킬·능력" value={activeCharacter.skills} />
              <Detail label="현재 목표" value={activeCharacter.goal} />
              <Detail label="숨겨진 비밀" value={activeCharacter.secret} />
              <Detail label="과거·초기 관계" value={activeCharacter.relationships} />
            </div>
          )}
          {activeCharacter && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDetailDialog(false)}>닫기</Button>
              <Button type="button" onClick={() => { setDetailDialog(false); openCharacterEdit(activeCharacter); }}><Pencil size={15} /> 설정 수정</Button>
            </DialogFooter>
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
