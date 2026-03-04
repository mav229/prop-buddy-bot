export const DEFAULT_AGENT_NAME = "Harris - PropScholar";
export const DEFAULT_AGENT_AVATAR_URL = "https://res.cloudinary.com/dzozyqlqr/image/upload/v1766327970/Gemini_Generated_Image_hvp9g0hvp9g0hvp9_1_q6pmq8.png";

const AGENT_NAME_REGEX = /\[\[AGENT_NAME:([^\]]+)\]\]/g;
const AGENT_AVATAR_REGEX = /\[\[AGENT_AVATAR:([^\]]+)\]\]/g;
const LEGACY_AGENT_PREFIX_REGEX = /\*\*💬\s*Agent Reply:\*\*\s*/i;

export interface ParsedAgentReply {
  isAgentReply: boolean;
  agentName: string;
  agentAvatarUrl: string;
  content: string;
}

export const parseAgentReply = (rawContent: string, source?: string): ParsedAgentReply => {
  const content = rawContent || "";
  const nameMatch = content.match(/\[\[AGENT_NAME:([^\]]+)\]\]/);
  const avatarMatch = content.match(/\[\[AGENT_AVATAR:([^\]]+)\]\]/);
  const isLegacyAgent = LEGACY_AGENT_PREFIX_REGEX.test(content);
  const isAgentReply = source === "agent" || Boolean(nameMatch) || Boolean(avatarMatch) || isLegacyAgent;

  const cleanedContent = content
    .replace(AGENT_NAME_REGEX, "")
    .replace(AGENT_AVATAR_REGEX, "")
    .replace(LEGACY_AGENT_PREFIX_REGEX, "")
    .trim();

  return {
    isAgentReply,
    agentName: nameMatch?.[1]?.trim() || DEFAULT_AGENT_NAME,
    agentAvatarUrl: avatarMatch?.[1]?.trim() || DEFAULT_AGENT_AVATAR_URL,
    content: cleanedContent,
  };
};
