import { supabase } from "@/integrations/supabase/client";

export interface Source {
  id: string;
  content: string;
  chunk_index: number;
  page_number: number | null;
  document_id?: string;
  score: number;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp?: string;
  feedback?: "up" | "down" | null;
}

export interface RetrievalMetrics {
  totalCandidates: number;
  selectedChunks: number;
  topScore: number;
  avgScore: number;
  retrievalTimeMs: number;
  searchMethods: Record<string, number>;
  reranked: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export async function streamChat({
  message,
  documentId,
  documentIds,
  chatSessionId,
  history,
  onSources,
  onMetrics,
  onDelta,
  onDone,
  onError,
}: {
  message: string;
  documentId?: string;
  documentIds?: string[];
  chatSessionId?: string;
  history: ChatMessage[];
  onSources: (sources: Source[]) => void;
  onMetrics?: (metrics: RetrievalMetrics) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        message,
        documentId,
        documentIds,
        chatSessionId,
        history: history.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: "Request failed" }));
      onError(errData.error || `Error ${resp.status}`);
      return;
    }

    if (!resp.body) {
      onError("No response body");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let sourcesReceived = false;
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.sources && !sourcesReceived) {
            onSources(parsed.sources);
            sourcesReceived = true;
            continue;
          }
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}

export async function uploadDocument(file: File, userId: string) {
  const filePath = `${userId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, file);
  if (uploadError) throw uploadError;

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: file.type || file.name.split(".").pop() || "unknown",
      status: "pending",
    })
    .select()
    .single();
  if (docError) throw docError;

  const { error: processError } = await supabase.functions.invoke("process-document", {
    body: { documentId: doc.id },
  });
  if (processError) {
    console.error("Process error:", processError);
  }

  return doc;
}

export async function getUserDocuments(userId: string) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function renameDocument(documentId: string, newName: string) {
  const { error } = await supabase
    .from("documents")
    .update({ name: newName })
    .eq("id", documentId);
  if (error) throw error;
}

export async function createChatSession(userId: string, documentId: string, title?: string) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id: userId,
      document_id: documentId,
      title: title || "New Chat",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getChatSessions(userId: string) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*, documents(name)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveMessage(chatSessionId: string, role: string, content: string, sources?: Source[]): Promise<string | null> {
  const { data, error } = await supabase.from("messages").insert({
    chat_session_id: chatSessionId,
    role,
    content,
    sources: sources ? JSON.stringify(sources) : "[]",
  }).select("id").single();
  if (error) {
    console.error("Failed to save message:", error);
    return null;
  }
  return data?.id || null;
}

export async function getChatMessages(chatSessionId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_session_id", chatSessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function deleteDocument(documentId: string) {
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) throw error;
}

export async function deleteChatSession(sessionId: string) {
  const { error } = await supabase.from("chat_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

export async function submitFeedback(messageId: string, userId: string, rating: "up" | "down") {
  const { error } = await supabase.from("feedback").upsert(
    { message_id: messageId, user_id: userId, rating },
    { onConflict: "message_id,user_id" }
  );
  if (error) console.error("Failed to save feedback:", error);
}

export async function getSuggestedQuestions(documentId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke("suggest-questions", {
      body: { documentId, type: "questions" },
    });
    if (error) throw error;
    return data?.items || [];
  } catch {
    return [];
  }
}

export async function getKeyPoints(documentId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke("suggest-questions", {
      body: { documentId, type: "keypoints" },
    });
    if (error) throw error;
    return data?.items || [];
  } catch {
    return [];
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function exportChatAsText(messages: ChatMessage[], documentName: string): void {
  const header = `DocChat AI - Conversation with "${documentName}"\nExported: ${new Date().toLocaleString()}\n${"=".repeat(60)}\n\n`;
  const body = messages
    .map((m) => {
      const role = m.role === "user" ? "You" : "AI";
      const time = m.timestamp ? ` (${new Date(m.timestamp).toLocaleString()})` : "";
      return `${role}${time}:\n${m.content}\n`;
    })
    .join("\n---\n\n");
  
  const blob = new Blob([header + body], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chat-${documentName.replace(/[^a-z0-9]/gi, "_")}-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
