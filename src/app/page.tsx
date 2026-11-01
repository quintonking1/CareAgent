import { getDb } from "@/db";
import { hasModelKey } from "@/agent/llm";
import { getCurrentProfile } from "@/lib/profile";
import { getThread, serializeThread } from "@/lib/thread";
import { getViewer } from "@/lib/viewer";
import { Chat } from "@/components/chat/chat";
import { Topbar } from "@/components/topbar";

export default async function ChatPage() {
  const db = getDb();
  const profile = getCurrentProfile(db);
  const { viewer } = await getViewer(db, profile.id);
  const first = profile.parentName.split(" ")[0];

  return (
    <div className="flex h-full flex-col">
      <Topbar title="CareAgent" />
      <Chat
        initialMessages={serializeThread(db, getThread(db, profile.id))}
        viewerName={viewer.name}
        parentName={profile.parentName}
        online={hasModelKey()}
        suggestions={[
          `Is ${first} okay this week?`,
          `How has ${first} been sleeping?`,
          `Which refills are coming up?`,
        ]}
      />
    </div>
  );
}
